package com.factory.joingreeter.gametest;

import com.factory.joingreeter.JoinConfig;
import com.factory.joingreeter.JoinConfig.KitItem;
import com.factory.joingreeter.JoinGreeter;
import java.util.List;
import net.fabricmc.fabric.api.gametest.v1.FabricGameTest;
import net.minecraft.item.Item;
import net.minecraft.item.Items;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.stat.Stats;
import net.minecraft.test.GameTest;
import net.minecraft.test.TestContext;
import net.minecraft.text.Text;
import net.minecraft.text.TextColor;
import net.minecraft.util.Formatting;

/**
 * In-world tests on a headless game test server (gradlew :join-greeter:runGametest). A mock player
 * is connected through the real PlayerManager.onPlayerConnect, where Fabric API fires the JOIN event,
 * so the mod sees it like any player who logs in. Every test uses the same settings, because the
 * tests of a batch run at the same time.
 */
public class JoinGreeterGameTest implements FabricGameTest {
    private static final JoinConfig CONFIG = new JoinConfig(
        "&6Welcome, &e{player}&6! {online} online", "&7Welcome back, {player}", List.of("&c1. No griefing", "2. Be nice"), false,
        List.of(new KitItem("minecraft:bread", 70), new KitItem("minecraft:stone_pickaxe", 1), new KitItem("minecraft:no_such_item", 5)));

    @SuppressWarnings("removal") // the mock server player is deprecated in 1.21.1 but still the way to test the server path
    private static ServerPlayerEntity join(TestContext ctx) {
        JoinGreeter.setConfig(CONFIG);
        return ctx.createMockCreativeServerPlayerInWorld();
    }

    private static int count(ServerPlayerEntity player, Item item) {
        return player.getInventory().count(item);
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void aNewPlayerGetsTheStarterKit(TestContext ctx) {
        ServerPlayerEntity player = join(ctx);
        ctx.assertTrue(JoinGreeter.isFirstJoin(player), "a fresh player joins for the first time");
        ctx.assertTrue(count(player, Items.BREAD) == 70, "70 bread in two stacks, got " + count(player, Items.BREAD));
        ctx.assertTrue(count(player, Items.STONE_PICKAXE) == 1, "one stone pickaxe");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void aReturningPlayerGetsNoSecondKit(TestContext ctx) {
        ServerPlayerEntity player = join(ctx);
        player.getInventory().clear();
        player.incrementStat(Stats.LEAVE_GAME); // what the server counts when a player leaves
        ctx.assertTrue(!JoinGreeter.isFirstJoin(player), "a player who left before is back");
        JoinGreeter.onJoin(player, ctx.getWorld().getServer());
        ctx.assertTrue(count(player, Items.BREAD) == 0, "no second kit");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE, tickLimit = 100)
    public void theMessagesFollowAfterASecond(TestContext ctx) {
        ServerPlayerEntity player = join(ctx);
        ctx.assertTrue(JoinGreeter.isPending(player.getUuid()), "the greeting waits until the player is in the list");
        ctx.waitAndRun(JoinGreeter.DELAY_TICKS + 5, () -> {
            ctx.assertTrue(!JoinGreeter.isPending(player.getUuid()), "the greeting was sent");
            ctx.complete();
        });
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void theLinesAreColouredAndFilled(TestContext ctx) {
        List<Text> first = JoinGreeter.messages(CONFIG, true, "Alex", 3);
        ctx.assertTrue(first.size() == 3, "welcome and two rules, got " + first.size());
        ctx.assertTrue(first.get(0).getString().equals("Welcome, Alex! 3 online"), "line: " + first.get(0).getString());
        ctx.assertTrue(first.get(1).getString().equals("1. No griefing"), "rule: " + first.get(1).getString());
        Text gold = first.get(0).getSiblings().get(0);
        Text name = first.get(0).getSiblings().get(1);
        ctx.assertTrue(TextColor.fromFormatting(Formatting.GOLD).equals(gold.getStyle().getColor()), "gold: " + gold.getStyle());
        ctx.assertTrue(TextColor.fromFormatting(Formatting.YELLOW).equals(name.getStyle().getColor()) && name.getString().equals("Alex"), "yellow name: " + name);
        List<Text> back = JoinGreeter.messages(CONFIG, false, "Alex", 3);
        ctx.assertTrue(back.size() == 1 && back.get(0).getString().equals("Welcome back, Alex"), "returning players get one line: " + back);
        ctx.complete();
    }
}
