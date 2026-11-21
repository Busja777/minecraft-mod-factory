package com.factory.afktag.gametest;

import com.factory.afktag.AfkTag;
import net.fabricmc.fabric.api.gametest.v1.FabricGameTest;
import net.minecraft.network.packet.s2c.play.PlayerListS2CPacket;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.test.GameTest;
import net.minecraft.test.TestContext;
import net.minecraft.text.Text;

/**
 * In-world tests on a headless game test server (gradlew :afk-tag:runGametest). The mock players
 * are real server players in the player list (PlayerManager.onPlayerConnect), so the mod's
 * server tick sees them like anyone else; their bodies are not ticked, so they stand perfectly still.
 * The timeout is shortened to {@link #TIMEOUT} ticks for the whole test run.
 */
public class AfkTagGameTest implements FabricGameTest {
    private static final long TIMEOUT = 20;

    @SuppressWarnings("removal") // the mock server player is deprecated in 1.21.1 but still the way to test the server path
    private static ServerPlayerEntity player(TestContext ctx) {
        AfkTag.setTimeoutTicks(TIMEOUT);
        return ctx.createMockCreativeServerPlayerInWorld();
    }

    private static String listName(ServerPlayerEntity player) {
        Text name = player.getPlayerListName();
        return name == null ? null : name.getString();
    }

    /** The display name the player list packet carries for this player. */
    private static String packetName(ServerPlayerEntity player) {
        PlayerListS2CPacket packet = new PlayerListS2CPacket(PlayerListS2CPacket.Action.UPDATE_DISPLAY_NAME, player);
        Text name = packet.getEntries().get(0).displayName();
        return name == null ? null : name.getString();
    }

    @GameTest(templateName = EMPTY_STRUCTURE, tickLimit = 200)
    public void anIdlePlayerGetsTheTagAndLosesItOnInput(TestContext ctx) {
        ServerPlayerEntity player = player(ctx);
        String name = player.getName().getString();
        ctx.assertTrue(listName(player) == null, "a fresh player has the plain list name");
        ctx.waitAndRun(TIMEOUT + 10, () -> {
            ctx.assertTrue(AfkTag.isAfk(player.getUuid()), "the player is AFK after the timeout");
            ctx.assertTrue(("[AFK] " + name).equals(listName(player)), "list name: " + listName(player));
            ctx.assertTrue(("[AFK] " + name).equals(packetName(player)), "packet name: " + packetName(player));
            player.setYaw(player.getYaw() + 30f); // looking around, as a rotation packet would set it
            ctx.waitAndRun(2, () -> {
                ctx.assertTrue(!AfkTag.isAfk(player.getUuid()), "turning the view clears AFK");
                ctx.assertTrue(listName(player) == null, "the plain name is back: " + listName(player));
                ctx.complete();
            });
        });
    }

    @GameTest(templateName = EMPTY_STRUCTURE, tickLimit = 200)
    public void theGamesIdleClockClearsAfk(TestContext ctx) {
        ServerPlayerEntity player = player(ctx);
        ctx.waitAndRun(TIMEOUT + 10, () -> {
            ctx.assertTrue(AfkTag.isAfk(player.getUuid()), "the player is AFK after the timeout");
            // what the network handler calls on chat, commands, clicks and item use
            player.updateLastActionTime();
            ctx.waitAndRun(2, () -> {
                ctx.assertTrue(!AfkTag.isAfk(player.getUuid()), "an action clears AFK");
                ctx.complete();
            });
        });
    }

    @GameTest(templateName = EMPTY_STRUCTURE, tickLimit = 200)
    public void aPlayerWhoKeepsWalkingIsNeverAfk(TestContext ctx) {
        ServerPlayerEntity player = player(ctx);
        ctx.runAtEveryTick(() -> {
            player.setPosition(player.getX() + 0.2, player.getY(), player.getZ());
            ctx.assertTrue(!AfkTag.isAfk(player.getUuid()), "walking keeps the player active");
        });
        ctx.waitAndRun(TIMEOUT * 3, ctx::complete);
    }
}
