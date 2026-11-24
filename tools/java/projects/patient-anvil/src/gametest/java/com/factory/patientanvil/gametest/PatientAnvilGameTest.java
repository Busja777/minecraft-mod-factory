package com.factory.patientanvil.gametest;

import it.unimi.dsi.fastutil.ints.Int2ObjectOpenHashMap;
import net.fabricmc.fabric.api.gametest.v1.FabricGameTest;
import net.minecraft.block.Blocks;
import net.minecraft.component.DataComponentTypes;
import net.minecraft.enchantment.EnchantmentHelper;
import net.minecraft.enchantment.EnchantmentLevelEntry;
import net.minecraft.enchantment.Enchantments;
import net.minecraft.item.EnchantedBookItem;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.network.packet.c2s.play.ClickSlotC2SPacket;
import net.minecraft.registry.RegistryKey;
import net.minecraft.registry.RegistryKeys;
import net.minecraft.registry.entry.RegistryEntry;
import net.minecraft.enchantment.Enchantment;
import net.minecraft.screen.AnvilScreenHandler;
import net.minecraft.screen.slot.SlotActionType;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.test.GameTest;
import net.minecraft.test.TestContext;
import net.minecraft.util.math.BlockPos;
import net.minecraft.world.GameMode;

/**
 * In-world tests on a headless game test server (gradlew :patient-anvil:runGametest). A survival
 * server player opens a real anvil (the block's own screen handler factory) and puts items into it,
 * which runs AnvilScreenHandler.updateResult on the server, where the mixin works.
 *
 * <p>Costs used here: a diamond sword with a prior work penalty of N plus a Sharpness I book costs
 * N + 1 levels (Sharpness has anvil_cost 1, halved for books but at least 1).
 */
public class PatientAnvilGameTest implements FabricGameTest {
    private static final BlockPos ANVIL = new BlockPos(1, 1, 1);

    @SuppressWarnings("removal") // the mock server player is deprecated in 1.21.1 but still the way to test the server path
    private static AnvilScreenHandler openAnvil(TestContext ctx, int levels) {
        ctx.setBlockState(ANVIL, Blocks.ANVIL);
        BlockPos pos = ctx.getAbsolutePos(ANVIL);
        ServerPlayerEntity player = ctx.createMockCreativeServerPlayerInWorld();
        player.changeGameMode(GameMode.SURVIVAL);
        player.refreshPositionAndAngles(pos.getX() + 0.5, pos.getY() + 1, pos.getZ() + 1.5, 0, 0);
        player.setExperienceLevel(levels);
        player.openHandledScreen(ctx.getWorld().getBlockState(pos).createScreenHandlerFactory(ctx.getWorld(), pos));
        ctx.assertTrue(player.currentScreenHandler instanceof AnvilScreenHandler, "the anvil screen is open: " + player.currentScreenHandler);
        return (AnvilScreenHandler) player.currentScreenHandler;
    }

    private static ServerPlayerEntity player(AnvilScreenHandler anvil, TestContext ctx) {
        return ctx.getWorld().getPlayers().stream().filter(p -> p.currentScreenHandler == anvil).findFirst().orElseThrow();
    }

    private static RegistryEntry<Enchantment> enchantment(TestContext ctx, RegistryKey<Enchantment> key) {
        return ctx.getWorld().getRegistryManager().get(RegistryKeys.ENCHANTMENT).entryOf(key);
    }

    private static ItemStack book(TestContext ctx, RegistryKey<Enchantment> key) {
        return EnchantedBookItem.forEnchantment(new EnchantmentLevelEntry(enchantment(ctx, key), 1));
    }

    private static ItemStack sword(int priorWork) {
        ItemStack sword = new ItemStack(Items.DIAMOND_SWORD);
        sword.set(DataComponentTypes.REPAIR_COST, priorWork);
        return sword;
    }

    private static void put(AnvilScreenHandler anvil, ItemStack left, ItemStack right) {
        anvil.getSlot(AnvilScreenHandler.INPUT_1_ID).setStack(left);
        anvil.getSlot(AnvilScreenHandler.INPUT_2_ID).setStack(right);
    }

    private static ItemStack result(AnvilScreenHandler anvil) {
        return anvil.getSlot(AnvilScreenHandler.OUTPUT_ID).getStack();
    }

    private static boolean hasSharpness(TestContext ctx, ItemStack stack) {
        return EnchantmentHelper.getLevel(enchantment(ctx, Enchantments.SHARPNESS), stack) == 1;
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void cheapWorkIsUnchanged(TestContext ctx) {
        AnvilScreenHandler anvil = openAnvil(ctx, 10);
        put(anvil, sword(0), book(ctx, Enchantments.SHARPNESS));
        ctx.assertTrue(anvil.getLevelCost() == 1, "Sharpness I on a new sword costs 1, got " + anvil.getLevelCost());
        ctx.assertTrue(hasSharpness(ctx, result(anvil)), "the sword gets Sharpness");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void fortyLevelsAreNoLongerTooExpensive(TestContext ctx) {
        AnvilScreenHandler anvil = openAnvil(ctx, 45);
        ServerPlayerEntity player = player(anvil, ctx);
        put(anvil, sword(39), book(ctx, Enchantments.SHARPNESS));
        ctx.assertTrue(anvil.getLevelCost() == 40, "the vanilla cost stays 40, got " + anvil.getLevelCost());
        ItemStack out = result(anvil).copy();
        ctx.assertTrue(hasSharpness(ctx, out), "vanilla would leave the result empty here; got " + out);
        ctx.assertTrue(out.getOrDefault(DataComponentTypes.REPAIR_COST, 0) == 79, "the prior work penalty grows as in vanilla: "
            + out.getOrDefault(DataComponentTypes.REPAIR_COST, 0));

        // What a game without the mod sends when the player clicks the result: it shows "Too Expensive!",
        // but the result slot holds the server's item, so it picks it up and reports the slots it changed.
        Int2ObjectOpenHashMap<ItemStack> changed = new Int2ObjectOpenHashMap<>();
        changed.put(AnvilScreenHandler.INPUT_1_ID, ItemStack.EMPTY);
        changed.put(AnvilScreenHandler.INPUT_2_ID, ItemStack.EMPTY);
        changed.put(AnvilScreenHandler.OUTPUT_ID, ItemStack.EMPTY);
        player.networkHandler.onClickSlot(new ClickSlotC2SPacket(anvil.syncId, anvil.getRevision(), AnvilScreenHandler.OUTPUT_ID, 0,
            SlotActionType.PICKUP, out.copy(), changed));
        ctx.assertTrue(hasSharpness(ctx, anvil.getCursorStack()), "the player holds the sword: " + anvil.getCursorStack());
        ctx.assertTrue(player.experienceLevel == 5, "40 of 45 levels are paid, left: " + player.experienceLevel);
        ctx.assertTrue(anvil.getSlot(AnvilScreenHandler.INPUT_1_ID).getStack().isEmpty(), "the old sword is used up");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void veryExpensiveWorkCostsWhatVanillaSays(TestContext ctx) {
        AnvilScreenHandler anvil = openAnvil(ctx, 70);
        put(anvil, sword(63), book(ctx, Enchantments.SHARPNESS));
        ctx.assertTrue(anvil.getLevelCost() == 64, "cost 64, got " + anvil.getLevelCost());
        ctx.assertTrue(hasSharpness(ctx, result(anvil)), "a result at 64 levels");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void youStillNeedTheLevels(TestContext ctx) {
        AnvilScreenHandler anvil = openAnvil(ctx, 39);
        ServerPlayerEntity player = player(anvil, ctx);
        put(anvil, sword(39), book(ctx, Enchantments.SHARPNESS));
        ctx.assertTrue(!result(anvil).isEmpty(), "the result is shown");
        anvil.onSlotClick(AnvilScreenHandler.OUTPUT_ID, 0, SlotActionType.PICKUP, player);
        ctx.assertTrue(anvil.getCursorStack().isEmpty(), "39 levels cannot pay 40");
        ctx.assertTrue(player.experienceLevel == 39, "no levels are taken");
        ctx.assertTrue(!anvil.getSlot(AnvilScreenHandler.INPUT_1_ID).getStack().isEmpty(), "the sword stays in the anvil");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void enchantingAStackStaysRefused(TestContext ctx) {
        AnvilScreenHandler anvil = openAnvil(ctx, 100);
        // control: one Sharpness book plus an Unbreaking book is a cheap, normal combination
        ItemStack single = book(ctx, Enchantments.SHARPNESS);
        put(anvil, single, book(ctx, Enchantments.UNBREAKING));
        ctx.assertTrue(!result(anvil).isEmpty() && anvil.getLevelCost() < 40, "one book combines, cost " + anvil.getLevelCost());
        // two of them at once: vanilla sets the cost to 40 to refuse it, and so does the mod
        ItemStack two = book(ctx, Enchantments.SHARPNESS);
        two.set(DataComponentTypes.MAX_STACK_SIZE, 16);
        two.setCount(2);
        put(anvil, two, book(ctx, Enchantments.UNBREAKING));
        ctx.assertTrue(anvil.getSlot(AnvilScreenHandler.INPUT_1_ID).getStack().getCount() == 2, "two books lie in the anvil");
        ctx.assertTrue(result(anvil).isEmpty(), "a stack is not enchanted: " + result(anvil));
        ctx.complete();
    }
}
