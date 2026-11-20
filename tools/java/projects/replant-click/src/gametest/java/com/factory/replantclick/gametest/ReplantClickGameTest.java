package com.factory.replantclick.gametest;

import net.fabricmc.fabric.api.gametest.v1.FabricGameTest;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.block.CropBlock;
import net.minecraft.enchantment.Enchantments;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.ItemEntity;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.registry.RegistryKeys;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.test.GameTest;
import net.minecraft.test.TestContext;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.hit.BlockHitResult;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Direction;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.GameMode;

/**
 * In-world tests on a headless game test server (gradlew :replant-click:runGametest).
 * A survival server player right-clicks through the real server path
 * (ServerPlayerInteractionManager.interactBlock, where Fabric API fires UseBlockCallback).
 */
public class ReplantClickGameTest implements FabricGameTest {
    private static final BlockPos SOIL = new BlockPos(1, 1, 1);
    private static final BlockPos CROP = SOIL.up();

    @SuppressWarnings("removal") // the mock server player is deprecated in 1.21.1 but still the way to test the server path
    private static ServerPlayerEntity farmer(TestContext ctx, ItemStack mainHand) {
        ServerPlayerEntity player = ctx.createMockCreativeServerPlayerInWorld();
        player.changeGameMode(GameMode.SURVIVAL);
        player.setStackInHand(Hand.MAIN_HAND, mainHand);
        return player;
    }

    private static void plant(TestContext ctx, CropBlock crop, int age) {
        plant(ctx, CROP, crop, age);
    }

    private static void plant(TestContext ctx, BlockPos at, CropBlock crop, int age) {
        ctx.setBlockState(at.down(), Blocks.FARMLAND);
        ctx.setBlockState(at, crop.withAge(age));
    }

    private static ActionResult click(TestContext ctx, ServerPlayerEntity player, Hand hand) {
        return click(ctx, player, hand, CROP);
    }

    private static ActionResult click(TestContext ctx, ServerPlayerEntity player, Hand hand, BlockPos at) {
        BlockPos pos = ctx.getAbsolutePos(at);
        BlockHitResult hit = new BlockHitResult(Vec3d.ofCenter(pos), Direction.UP, pos, false);
        return player.interactionManager.interactBlock(player, ctx.getWorld(), player.getStackInHand(hand), hand, hit);
    }

    private static int dropped(TestContext ctx, Item item) {
        return dropped(ctx, item, CROP);
    }

    private static int dropped(TestContext ctx, Item item, BlockPos at) {
        return ctx.getEntitiesAround(EntityType.ITEM, at, 1.5).stream()
            .map(ItemEntity::getStack).filter(s -> s.isOf(item)).mapToInt(ItemStack::getCount).sum();
    }

    private static int age(TestContext ctx) {
        BlockState state = ctx.getBlockState(CROP);
        ctx.assertTrue(state.getBlock() instanceof CropBlock, "the crop is gone: " + state);
        return ((CropBlock) state.getBlock()).getAge(state);
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void harvestsAndReplantsWheat(TestContext ctx) {
        plant(ctx, (CropBlock) Blocks.WHEAT, 7);
        ServerPlayerEntity player = farmer(ctx, ItemStack.EMPTY);
        ctx.assertTrue(click(ctx, player, Hand.MAIN_HAND) == ActionResult.SUCCESS, "a right-click on ripe wheat is handled");
        ctx.expectBlock(Blocks.WHEAT, CROP);
        ctx.assertTrue(age(ctx) == 0, "the wheat is replanted at age 0");
        ctx.expectBlock(Blocks.FARMLAND, SOIL);
        ctx.assertTrue(dropped(ctx, Items.WHEAT) == 1, "one wheat drops, got " + dropped(ctx, Items.WHEAT));
        // the loot gives 1 to 4 seeds (binomial bonus); one of them was planted again
        ctx.assertTrue(dropped(ctx, Items.WHEAT_SEEDS) <= 3, "at most three seeds are left, got " + dropped(ctx, Items.WHEAT_SEEDS));
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void harvestsBeetrootsWithAHoeWithoutWearingIt(TestContext ctx) {
        plant(ctx, (CropBlock) Blocks.BEETROOTS, 3);
        ItemStack hoe = new ItemStack(Items.IRON_HOE);
        ServerPlayerEntity player = farmer(ctx, hoe);
        ctx.assertTrue(click(ctx, player, Hand.MAIN_HAND) == ActionResult.SUCCESS, "a right-click on ripe beetroots is handled");
        ctx.expectBlock(Blocks.BEETROOTS, CROP);
        ctx.assertTrue(age(ctx) == 0, "the beetroots are replanted");
        ctx.assertTrue(dropped(ctx, Items.BEETROOT) == 1, "one beetroot drops");
        ctx.assertTrue(player.getMainHandStack().getDamage() == 0, "the hoe takes no damage");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void carrotsGiveBackAllButOne(TestContext ctx) {
        plant(ctx, (CropBlock) Blocks.CARROTS, 7);
        ServerPlayerEntity player = farmer(ctx, new ItemStack(Items.DIRT, 5));
        ctx.assertTrue(click(ctx, player, Hand.MAIN_HAND) == ActionResult.SUCCESS, "a right-click with a block in hand still harvests");
        ctx.assertTrue(age(ctx) == 0, "the carrots are replanted");
        int carrots = dropped(ctx, Items.CARROT);
        // loot: 1 carrot + (1 + binomial(3, 0.5714)) carrots, minus the one that was planted
        ctx.assertTrue(carrots >= 1 && carrots <= 4, "1 to 4 carrots drop, got " + carrots);
        ctx.assertTrue(player.getMainHandStack().getCount() == 5, "the held blocks are not used");
        ctx.expectBlock(Blocks.AIR, CROP.up());
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void fortuneGivesMore(TestContext ctx) {
        // 30 harvests each with a plain hoe and a Fortune III hoe: on average 1.7 against 3.4 carrots
        // are left per harvest, so the Fortune pile is bigger by far (about twelve standard deviations).
        BlockPos plain = new BlockPos(1, 2, 1);
        BlockPos lucky = new BlockPos(5, 2, 5);
        ItemStack fortuneHoe = new ItemStack(Items.IRON_HOE);
        fortuneHoe.addEnchantment(ctx.getWorld().getRegistryManager().get(RegistryKeys.ENCHANTMENT).entryOf(Enchantments.FORTUNE), 3);
        ServerPlayerEntity plainFarmer = farmer(ctx, new ItemStack(Items.IRON_HOE));
        ServerPlayerEntity luckyFarmer = farmer(ctx, fortuneHoe);
        for (int i = 0; i < 30; i++) {
            plant(ctx, plain, (CropBlock) Blocks.CARROTS, 7);
            plant(ctx, lucky, (CropBlock) Blocks.CARROTS, 7);
            click(ctx, plainFarmer, Hand.MAIN_HAND, plain);
            click(ctx, luckyFarmer, Hand.MAIN_HAND, lucky);
        }
        int without = dropped(ctx, Items.CARROT, plain);
        int with = dropped(ctx, Items.CARROT, lucky);
        ctx.assertTrue(with > without + 20, "Fortune III gives more carrots: " + with + " against " + without);
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void theItemUseBehindAHarvestIsIgnored(TestContext ctx) {
        // a game without the mod sends "use item" right after the click on the crop
        plant(ctx, (CropBlock) Blocks.WHEAT, 7);
        ServerPlayerEntity player = farmer(ctx, new ItemStack(Items.ENDER_PEARL, 4));
        ctx.assertTrue(click(ctx, player, Hand.MAIN_HAND) == ActionResult.SUCCESS, "ripe wheat is harvested with pearls in hand");
        ActionResult use = player.interactionManager.interactItem(player, ctx.getWorld(), player.getMainHandStack(), Hand.MAIN_HAND);
        ctx.assertTrue(!use.isAccepted(), "the pearl is not thrown: " + use);
        ctx.assertTrue(player.getMainHandStack().getCount() == 4, "all four pearls are still there");
        ctx.assertTrue(ctx.getEntities(EntityType.ENDER_PEARL).isEmpty(), "no pearl flies");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void sneakingLeavesTheCrop(TestContext ctx) {
        plant(ctx, (CropBlock) Blocks.POTATOES, 7);
        ServerPlayerEntity player = farmer(ctx, ItemStack.EMPTY);
        player.setSneaking(true);
        click(ctx, player, Hand.MAIN_HAND);
        ctx.assertTrue(age(ctx) == 7, "sneaking keeps the potatoes ripe");
        ctx.assertTrue(dropped(ctx, Items.POTATO) == 0, "nothing drops while sneaking");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void youngCropsStay(TestContext ctx) {
        plant(ctx, (CropBlock) Blocks.WHEAT, 6);
        ServerPlayerEntity player = farmer(ctx, ItemStack.EMPTY);
        ctx.assertTrue(click(ctx, player, Hand.MAIN_HAND) != ActionResult.SUCCESS, "young wheat is not handled");
        ctx.assertTrue(age(ctx) == 6, "young wheat keeps growing");
        ctx.assertTrue(dropped(ctx, Items.WHEAT_SEEDS) == 0, "nothing drops from young wheat");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void boneMealKeepsItsUseInBothHands(TestContext ctx) {
        plant(ctx, (CropBlock) Blocks.WHEAT, 7);
        ServerPlayerEntity player = farmer(ctx, new ItemStack(Items.BONE_MEAL, 3));
        click(ctx, player, Hand.MAIN_HAND);
        click(ctx, player, Hand.OFF_HAND); // the game tries the empty off hand next
        ctx.assertTrue(age(ctx) == 7, "bone meal in the main hand never harvests");
        ctx.assertTrue(dropped(ctx, Items.WHEAT) == 0, "nothing drops");
        ctx.assertTrue(player.getMainHandStack().getCount() == 3, "no bone meal is used on ripe wheat");
        ctx.complete();
    }
}
