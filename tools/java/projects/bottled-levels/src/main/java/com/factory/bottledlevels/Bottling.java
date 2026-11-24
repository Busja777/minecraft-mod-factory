package com.factory.bottledlevels;

import com.factory.bottledlevels.BottleRules.Outcome;
import java.util.List;
import java.util.Map;
import java.util.WeakHashMap;
import net.minecraft.component.DataComponentTypes;
import net.minecraft.component.type.LoreComponent;
import net.minecraft.component.type.NbtComponent;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.item.ItemUsage;
import net.minecraft.item.Items;
import net.minecraft.nbt.NbtCompound;
import net.minecraft.nbt.NbtElement;
import net.minecraft.registry.Registries;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.stat.Stats;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Formatting;
import net.minecraft.util.Hand;
import net.minecraft.util.TypedActionResult;
import net.minecraft.util.hit.BlockHitResult;
import net.minecraft.world.World;

/**
 * Sneak + right-click on an enchanting table with a glass bottle: {@link BottleRules#COST} points of
 * the player's experience go into a vanilla Bottle o' Enchanting that holds {@link BottleRules#stored}
 * of them. The bottle is an ordinary {@code minecraft:experience_bottle} with three components every
 * game knows: {@code custom_data} (the amount), {@code item_name} and {@code lore} (so the player sees
 * what it holds). No new item, block or registry entry, so players without the mod can join.
 *
 * <p>All work happens on the server. On a client with the mod the click only answers SUCCESS (arm
 * swing, no item use behind it) and the server does the rest.
 */
public final class Bottling {
    /** Compound in the bottle's custom_data that marks a filled bottle. */
    public static final String DATA_KEY = "bottledlevels";
    /** Int in that compound: the points the bottle releases when it breaks. */
    public static final String DATA_XP = "xp";

    /** Server tick of each player's last handled sneak-click on the table (server thread only). */
    private static final Map<PlayerEntity, Long> LAST_CLICK = new WeakHashMap<>();

    private Bottling() {}

    private static String id(ItemStack stack) {
        return Registries.ITEM.getId(stack.getItem()).toString();
    }

    /** Fabric's UseBlockCallback: SUCCESS when a bottle was filled, FAIL when the click was used up, PASS for vanilla. */
    public static ActionResult onUseBlock(PlayerEntity player, World world, Hand hand, BlockHitResult hit) {
        if (player.isSpectator()) return ActionResult.PASS;
        if (!world.isClient() && BottleRules.isFollowUp(LAST_CLICK.getOrDefault(player, -1L), world.getTime())) {
            // the off hand of the same click (a game without the mod tries it next): do nothing there
            resync(player);
            return ActionResult.FAIL;
        }
        String blockId = Registries.BLOCK.getId(world.getBlockState(hit.getBlockPos()).getBlock()).toString();
        int level = player.experienceLevel;
        XpMath.Xp after = XpMath.remove(level, XpMath.pointsInLevel(level, player.experienceProgress), BottleRules.COST);
        Outcome outcome = BottleRules.decide(player.isSneaking(), blockId, hand == Hand.MAIN_HAND,
            id(player.getMainHandStack()), id(player.getOffHandStack()), after != null);
        if (outcome == Outcome.PASS) return ActionResult.PASS;
        if (world.isClient()) {
            // Fabric API only sends the click to the server for SUCCESS, so a client with the mod shows
            // the hint itself; FAIL keeps the game from using the item in the hand right after.
            if (outcome == Outcome.NOT_ENOUGH) player.sendMessage(notEnoughMessage(), true);
            return outcome == Outcome.FILL ? ActionResult.SUCCESS : ActionResult.FAIL;
        }
        if (!(player instanceof ServerPlayerEntity serverPlayer)) return ActionResult.PASS;

        LAST_CLICK.put(player, world.getTime());
        if (outcome == Outcome.NOT_ENOUGH) {
            serverPlayer.sendMessage(notEnoughMessage(), true);
        } else if (outcome == Outcome.FILL) {
            fill(serverPlayer, hand, after);
        }
        resync(player);
        return outcome == Outcome.FILL ? ActionResult.SUCCESS : ActionResult.FAIL;
    }

    /**
     * Fabric's UseItemCallback: swallows the item use a game without the mod sends right behind a
     * handled sneak-click, so the bottle now in the hand is not thrown.
     */
    public static TypedActionResult<ItemStack> onUseItem(PlayerEntity player, World world, Hand hand) {
        ItemStack stack = player.getStackInHand(hand);
        if (world.isClient() || !BottleRules.isFollowUp(LAST_CLICK.getOrDefault(player, -1L), world.getTime())) return TypedActionResult.pass(stack);
        resync(player);
        return TypedActionResult.fail(stack);
    }

    /** The hint above the hotbar when the player has too few points. */
    static Text notEnoughMessage() {
        return Text.literal("Filling a bottle takes " + BottleRules.COST + " experience points.").formatted(Formatting.GRAY);
    }

    /** Sends the real inventory back: a game without the mod may have guessed an item use on its side. */
    private static void resync(PlayerEntity player) {
        if (player instanceof ServerPlayerEntity serverPlayer) serverPlayer.currentScreenHandler.syncState();
    }

    /**
     * Takes the points and swaps one glass bottle of {@code hand} for a filled bottle, the way the game
     * fills a bottle with water (the filled one goes into the hand when it was the last glass bottle,
     * otherwise into the inventory, or drops when the inventory is full). The level and bar are set to
     * the exact result of {@link XpMath#remove}; the total and score lose the points as with
     * {@code /xp add <player> -50 points}.
     */
    static void fill(ServerPlayerEntity player, Hand hand, XpMath.Xp after) {
        int cost = BottleRules.COST;
        player.setExperienceLevel(after.level());
        player.setExperiencePoints(after.points());
        player.totalExperience = Math.max(0, player.totalExperience - cost);
        player.addScore(-cost);

        ItemStack glass = player.getStackInHand(hand);
        player.setStackInHand(hand, ItemUsage.exchangeStack(glass, player, filledBottle(BottleRules.stored(cost)), false));
        player.incrementStat(Stats.USED.getOrCreateStat(Items.GLASS_BOTTLE));
        player.getWorld().playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.ITEM_BOTTLE_FILL_DRAGONBREATH, SoundCategory.PLAYERS, 1.0F, 1.0F);
    }

    /** A Bottle o' Enchanting that releases {@code xp} points; bottles with the same amount stack. */
    public static ItemStack filledBottle(int xp) {
        ItemStack bottle = new ItemStack(Items.EXPERIENCE_BOTTLE);
        NbtCompound inner = new NbtCompound();
        inner.putInt(DATA_XP, xp);
        NbtCompound data = new NbtCompound();
        data.put(DATA_KEY, inner);
        bottle.set(DataComponentTypes.CUSTOM_DATA, NbtComponent.of(data));
        bottle.set(DataComponentTypes.ITEM_NAME, Text.literal("Bottled Experience"));
        bottle.set(DataComponentTypes.LORE, new LoreComponent(List.of(
            Text.literal("Holds " + xp + " experience points").styled(s -> s.withColor(Formatting.GRAY).withItalic(false)))));
        return bottle;
    }

    /** The points a thrown bottle releases: its stored amount, or 0 for a plain bottle (vanilla's 3 to 11). */
    public static int storedXp(ItemStack stack) {
        if (!stack.isOf(Items.EXPERIENCE_BOTTLE)) return 0;
        NbtComponent data = stack.get(DataComponentTypes.CUSTOM_DATA);
        if (data == null || !data.contains(DATA_KEY)) return 0;
        NbtCompound nbt = data.copyNbt();
        if (!nbt.contains(DATA_KEY, NbtElement.COMPOUND_TYPE)) return 0;
        return BottleRules.releasable(nbt.getCompound(DATA_KEY).getInt(DATA_XP));
    }
}
