package com.factory.stackmore.gametest;

import java.util.List;
import net.fabricmc.fabric.api.gametest.v1.FabricGameTest;
import net.minecraft.block.Blocks;
import net.minecraft.block.DispenserBlock;
import net.minecraft.block.HopperBlock;
import net.minecraft.block.entity.BrewingStandBlockEntity;
import net.minecraft.block.entity.ChestBlockEntity;
import net.minecraft.block.entity.DispenserBlockEntity;
import net.minecraft.block.entity.HopperBlockEntity;
import net.minecraft.component.DataComponentTypes;
import net.minecraft.component.type.PotionContentsComponent;
import net.minecraft.entity.ItemEntity;
import net.minecraft.entity.player.PlayerInventory;
import net.minecraft.inventory.Inventory;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.potion.Potion;
import net.minecraft.potion.Potions;
import net.minecraft.registry.entry.RegistryEntry;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.test.GameTest;
import net.minecraft.test.TestContext;
import net.minecraft.util.Hand;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Direction;
import net.minecraft.world.GameMode;

/**
 * In-world tests on a headless game test server (gradlew :stack-more:runGametest).
 * The mod changes the items' default max_stack_size component, so every check here runs through
 * vanilla's own code: inventories, hoppers, the brewing stand, dispensers and drinking.
 */
public class StackMoreGameTest implements FabricGameTest {
    private static ItemStack potion(RegistryEntry<Potion> type, int count) {
        ItemStack stack = PotionContentsComponent.createStack(Items.POTION, type);
        stack.setCount(count);
        return stack;
    }

    @SuppressWarnings("removal") // the mock server player is deprecated in 1.21.1 but still the way to test the server path
    private static ServerPlayerEntity survivalPlayer(TestContext ctx) {
        ServerPlayerEntity player = ctx.createMockCreativeServerPlayerInWorld();
        player.changeGameMode(GameMode.SURVIVAL);
        player.getInventory().clear();
        return player;
    }

    /** Slots of the inventory that hold the item, as their counts. */
    private static List<Integer> counts(Inventory inventory, Item item, int slots) {
        java.util.ArrayList<Integer> out = new java.util.ArrayList<>();
        for (int i = 0; i < slots; i++) {
            ItemStack s = inventory.getStack(i);
            if (s.isOf(item)) out.add(s.getCount());
        }
        return out;
    }

    private static int total(Inventory inventory, Item item) {
        int n = 0;
        for (int i = 0; i < inventory.size(); i++) if (inventory.getStack(i).isOf(item)) n += inventory.getStack(i).getCount();
        return n;
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void theThreeItemsHaveTheNewStackSize(TestContext ctx) {
        ctx.assertTrue(Items.POTION.getMaxCount() == 16, "potion: 16, got " + Items.POTION.getMaxCount());
        ctx.assertTrue(Items.EGG.getMaxCount() == 64, "egg: 64, got " + Items.EGG.getMaxCount());
        ctx.assertTrue(Items.SNOWBALL.getMaxCount() == 64, "snowball: 64, got " + Items.SNOWBALL.getMaxCount());
        // stacks made now and stacks with their own potion contents read the same default
        ctx.assertTrue(new ItemStack(Items.POTION).getMaxCount() == 16, "a new potion stack: 16");
        ctx.assertTrue(potion(Potions.STRONG_HEALING, 1).getMaxCount() == 16, "a healing potion: 16");
        ctx.assertTrue(potion(Potions.WATER, 1).getMaxCount() == 16, "a water bottle: 16");
        ctx.assertTrue(new ItemStack(Items.EGG).getMaxCount() == 64 && new ItemStack(Items.SNOWBALL).getMaxCount() == 64, "new egg and snowball stacks: 64");
        // the change is the item's default, not a patch on the stack: nothing different is saved or sent
        ctx.assertTrue(new ItemStack(Items.POTION).getComponentChanges().isEmpty(), "a plain potion carries no component patch");
        ctx.assertTrue(potion(Potions.SWIFTNESS, 1).getComponentChanges().get(DataComponentTypes.MAX_STACK_SIZE) == null, "no max_stack_size in the patch");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void otherItemsKeepTheirVanillaSize(TestContext ctx) {
        ctx.assertTrue(Items.SPLASH_POTION.getMaxCount() == 1, "splash potion stays 1");
        ctx.assertTrue(Items.LINGERING_POTION.getMaxCount() == 1, "lingering potion stays 1");
        ctx.assertTrue(Items.ENDER_PEARL.getMaxCount() == 16, "ender pearl stays 16");
        ctx.assertTrue(Items.HONEY_BOTTLE.getMaxCount() == 16, "honey bottle stays 16");
        ctx.assertTrue(Items.GLASS_BOTTLE.getMaxCount() == 64, "glass bottle stays 64");
        ctx.assertTrue(Items.STONE.getMaxCount() == 64, "stone stays 64");
        ctx.assertTrue(Items.DIAMOND_SWORD.getMaxCount() == 1, "a sword stays 1");
        ctx.assertTrue(Items.BUCKET.getMaxCount() == 16, "bucket stays 16");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void identicalPotionsStackInThePlayerInventory(TestContext ctx) {
        ServerPlayerEntity player = survivalPlayer(ctx);
        PlayerInventory inv = player.getInventory();
        for (int i = 0; i < 17; i++) inv.insertStack(potion(Potions.SWIFTNESS, 1));
        List<Integer> stacks = counts(inv, Items.POTION, inv.main.size());
        ctx.assertTrue(stacks.equals(List.of(16, 1)), "17 swiftness potions: a stack of 16 and one more, got " + stacks);
        inv.insertStack(new ItemStack(Items.EGG, 64));
        inv.insertStack(new ItemStack(Items.SNOWBALL, 64));
        ctx.assertTrue(counts(inv, Items.EGG, inv.main.size()).equals(List.of(64)), "64 eggs in one slot");
        ctx.assertTrue(counts(inv, Items.SNOWBALL, inv.main.size()).equals(List.of(64)), "64 snowballs in one slot");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void differentPotionsDoNotStack(TestContext ctx) {
        ServerPlayerEntity player = survivalPlayer(ctx);
        PlayerInventory inv = player.getInventory();
        inv.insertStack(potion(Potions.SWIFTNESS, 1));
        inv.insertStack(potion(Potions.HEALING, 1));
        inv.insertStack(potion(Potions.LONG_SWIFTNESS, 1));
        inv.insertStack(potion(Potions.WATER, 1));
        ItemStack named = potion(Potions.SWIFTNESS, 1);
        named.set(DataComponentTypes.CUSTOM_NAME, net.minecraft.text.Text.literal("Fast"));
        inv.insertStack(named);
        List<Integer> stacks = counts(inv, Items.POTION, inv.main.size());
        ctx.assertTrue(stacks.equals(List.of(1, 1, 1, 1, 1)), "five different potions keep five slots, got " + stacks);
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void aHopperStacksIdenticalPotionsInAChest(TestContext ctx) {
        BlockPos at = new BlockPos(1, 1, 1);
        ctx.setBlockState(at, Blocks.CHEST);
        ChestBlockEntity chest = ctx.getBlockEntity(at);
        // a hopper moves one item at a time; HopperBlockEntity.transfer is its insert into the next inventory
        for (int i = 0; i < 17; i++) HopperBlockEntity.transfer(null, chest, potion(Potions.FIRE_RESISTANCE, 1), Direction.UP);
        HopperBlockEntity.transfer(null, chest, potion(Potions.NIGHT_VISION, 1), Direction.UP);
        List<Integer> fire = counts(chest, Items.POTION, chest.size());
        ctx.assertTrue(fire.equals(List.of(16, 1, 1)), "16 + 1 fire resistance and 1 night vision, got " + fire);
        ctx.assertTrue(PotionContentsComponent.createStack(Items.POTION, Potions.NIGHT_VISION).getComponents()
            .get(DataComponentTypes.POTION_CONTENTS).equals(chest.getStack(2).get(DataComponentTypes.POTION_CONTENTS)), "the night vision potion has a slot of its own");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE, tickLimit = 120)
    public void theBrewingStandStillTakesOnePotionPerBottleSlot(TestContext ctx) {
        BlockPos stand = new BlockPos(2, 1, 1);
        BlockPos hopper = new BlockPos(1, 1, 1);
        ctx.setBlockState(stand, Blocks.BREWING_STAND);
        ctx.setBlockState(hopper, Blocks.HOPPER.getDefaultState().with(HopperBlock.FACING, Direction.EAST));
        HopperBlockEntity from = ctx.getBlockEntity(hopper);
        from.setStack(0, potion(Potions.AWKWARD, 5));
        BrewingStandBlockEntity brewing = ctx.getBlockEntity(stand);
        ctx.waitAndRun(80, () -> {
            for (int slot = 0; slot < 3; slot++) {
                ItemStack s = brewing.getStack(slot);
                ctx.assertTrue(s.isOf(Items.POTION) && s.getCount() == 1, "bottle slot " + slot + " holds exactly one potion, got " + s);
            }
            ctx.assertTrue(from.getStack(0).getCount() == 2, "two potions stay in the hopper, got " + from.getStack(0));
            ctx.assertTrue(!brewing.isValid(0, potion(Potions.AWKWARD, 1)), "a filled bottle slot takes no second potion");
            ctx.complete();
        });
    }

    @GameTest(templateName = EMPTY_STRUCTURE, tickLimit = 60)
    public void aDispenserPoursOneWaterBottleOfAStack(TestContext ctx) {
        BlockPos dispenser = new BlockPos(1, 1, 1);
        BlockPos dirt = new BlockPos(2, 1, 1);
        ctx.setBlockState(dispenser, Blocks.DISPENSER.getDefaultState().with(DispenserBlock.FACING, Direction.EAST));
        ctx.setBlockState(dirt, Blocks.DIRT);
        DispenserBlockEntity box = ctx.getBlockEntity(dispenser);
        box.setStack(0, potion(Potions.WATER, 3));
        ctx.putAndRemoveRedstoneBlock(new BlockPos(0, 1, 1), 2);
        ctx.waitAndRun(20, () -> {
            ctx.expectBlock(Blocks.MUD, dirt);
            ctx.assertTrue(total(box, Items.POTION) == 2, "two water bottles are left, got " + total(box, Items.POTION));
            ctx.assertTrue(total(box, Items.GLASS_BOTTLE) == 1, "the empty bottle goes back into the dispenser");
            ctx.complete();
        });
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void drinkingFromAStackGivesTheBottleBack(TestContext ctx) {
        ServerPlayerEntity player = survivalPlayer(ctx);
        player.setStackInHand(Hand.MAIN_HAND, potion(Potions.WATER, 3));
        ItemStack left = player.getMainHandStack().finishUsing(ctx.getWorld(), player);
        ctx.assertTrue(left.isOf(Items.POTION) && left.getCount() == 2, "two potions are left in the hand, got " + left);
        ctx.assertTrue(total(player.getInventory(), Items.GLASS_BOTTLE) == 1, "the empty bottle is in the inventory");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void aFullInventoryDropsTheBottleInsteadOfLosingIt(TestContext ctx) {
        ServerPlayerEntity player = survivalPlayer(ctx);
        PlayerInventory inv = player.getInventory();
        player.setStackInHand(Hand.MAIN_HAND, potion(Potions.WATER, 3));
        for (int i = 0; i < inv.main.size(); i++) if (i != inv.selectedSlot) inv.main.set(i, new ItemStack(Items.STONE, 64));
        ItemStack left = player.getMainHandStack().finishUsing(ctx.getWorld(), player);
        ctx.assertTrue(left.getCount() == 2, "two potions are left, got " + left);
        ctx.assertTrue(total(inv, Items.GLASS_BOTTLE) == 0, "no room for the bottle in the inventory");
        List<ItemEntity> bottles = ctx.getWorld().getEntitiesByClass(ItemEntity.class, player.getBoundingBox().expand(3),
            e -> e.getStack().isOf(Items.GLASS_BOTTLE));
        ctx.assertTrue(bottles.size() == 1 && bottles.get(0).getStack().getCount() == 1, "the bottle drops at the player's feet, got " + bottles.size());
        ctx.complete();
    }
}
