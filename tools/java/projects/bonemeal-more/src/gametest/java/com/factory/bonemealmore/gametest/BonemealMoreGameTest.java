package com.factory.bonemealmore.gametest;

import net.fabricmc.fabric.api.gametest.v1.FabricGameTest;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.block.CactusBlock;
import net.minecraft.block.CropBlock;
import net.minecraft.block.DispenserBlock;
import net.minecraft.block.NetherWartBlock;
import net.minecraft.block.entity.DispenserBlockEntity;
import net.minecraft.entity.EntityType;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
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
 * In-world tests on a headless game test server (gradlew :bonemeal-more:runGametest). A survival
 * server player right-clicks through the real server path (ServerPlayerInteractionManager.interactBlock,
 * where the game's BoneMealItem asks the block whether it is Fertilizable), and a dispenser fires
 * bone meal through the game's own dispenser behaviour.
 */
public class BonemealMoreGameTest implements FabricGameTest {
    private static final BlockPos GROUND = new BlockPos(2, 1, 2);
    private static final BlockPos PLANT = GROUND.up();
    private static final BlockPos WATER = GROUND.east();

    @SuppressWarnings("removal") // the mock server player is deprecated in 1.21.1 but still the way to test the server path
    private static ServerPlayerEntity farmer(TestContext ctx, ItemStack mainHand, ItemStack offHand) {
        ServerPlayerEntity player = ctx.createMockCreativeServerPlayerInWorld();
        player.changeGameMode(GameMode.SURVIVAL);
        // away from the plants, so a block placed next to them is not stopped by the player standing there
        player.setPosition(ctx.getAbsolute(new Vec3d(6.5, 2, 6.5)));
        player.setStackInHand(Hand.MAIN_HAND, mainHand);
        player.setStackInHand(Hand.OFF_HAND, offHand);
        return player;
    }

    private static ServerPlayerEntity farmer(TestContext ctx, int boneMeal) {
        return farmer(ctx, new ItemStack(Items.BONE_MEAL, boneMeal), ItemStack.EMPTY);
    }

    private static ActionResult click(TestContext ctx, ServerPlayerEntity player, Hand hand, BlockPos at, Direction side) {
        BlockPos pos = ctx.getAbsolutePos(at);
        BlockHitResult hit = new BlockHitResult(Vec3d.ofCenter(pos), side, pos, false);
        return player.interactionManager.interactBlock(player, ctx.getWorld(), player.getStackInHand(hand), hand, hit);
    }

    private static ActionResult boneMeal(TestContext ctx, ServerPlayerEntity player, BlockPos at) {
        return click(ctx, player, Hand.MAIN_HAND, at, Direction.UP);
    }

    private static int boneMealLeft(ServerPlayerEntity player) {
        ItemStack stack = player.getMainHandStack();
        return stack.isOf(Items.BONE_MEAL) ? stack.getCount() : 0;
    }

    /** Sand on stone with a water source next to it, closed in so it cannot flow. */
    private static void sugarCaneGround(TestContext ctx) {
        ctx.setBlockState(GROUND.down(), Blocks.STONE);
        ctx.setBlockState(WATER.down(), Blocks.STONE);
        ctx.setBlockState(WATER.east(), Blocks.STONE);
        ctx.setBlockState(WATER.north(), Blocks.STONE);
        ctx.setBlockState(WATER.south(), Blocks.STONE);
        ctx.setBlockState(WATER, Blocks.WATER);
        ctx.setBlockState(GROUND, Blocks.SAND);
    }

    private static void sugarCane(TestContext ctx, int height) {
        sugarCaneGround(ctx);
        for (int i = 0; i < height; i++) ctx.setBlockState(PLANT.up(i), Blocks.SUGAR_CANE);
    }

    private static void cactus(TestContext ctx, int height) {
        ctx.setBlockState(GROUND.down(), Blocks.STONE);
        ctx.setBlockState(GROUND, Blocks.SAND);
        for (int i = 0; i < height; i++) ctx.setBlockState(PLANT.up(i), Blocks.CACTUS);
    }

    /** Height of the column of {@code block} standing on GROUND. */
    private static int height(TestContext ctx, Block block) {
        int h = 0;
        while (h < 10 && ctx.getBlockState(PLANT.up(h)).isOf(block)) h++;
        return h;
    }

    // --- sugar cane ---

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void sugarCaneGrowsOneBlockPerUse(TestContext ctx) {
        sugarCane(ctx, 1);
        ServerPlayerEntity player = farmer(ctx, 5);
        ctx.assertTrue(boneMeal(ctx, player, PLANT).isAccepted(), "bone meal on sugar cane is used");
        ctx.assertTrue(height(ctx, Blocks.SUGAR_CANE) == 2, "height 1 grows to 2, got " + height(ctx, Blocks.SUGAR_CANE));
        ctx.assertTrue(boneMealLeft(player) == 4, "one bone meal is used, left " + boneMealLeft(player));
        boneMeal(ctx, player, PLANT);
        ctx.assertTrue(height(ctx, Blocks.SUGAR_CANE) == 3, "height 2 grows to 3, got " + height(ctx, Blocks.SUGAR_CANE));
        ctx.assertTrue(boneMealLeft(player) == 3, "one more bone meal is used");
        ctx.expectBlock(Blocks.AIR, PLANT.up(3));
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void sugarCaneAtThreeBlocksTakesNoBoneMeal(TestContext ctx) {
        sugarCane(ctx, 3);
        ServerPlayerEntity player = farmer(ctx, 3);
        ctx.assertTrue(!boneMeal(ctx, player, PLANT).isAccepted(), "full-height sugar cane does not take bone meal");
        boneMeal(ctx, player, PLANT.up(2));
        ctx.assertTrue(height(ctx, Blocks.SUGAR_CANE) == 3, "it stays three blocks tall");
        ctx.assertTrue(boneMealLeft(player) == 3, "no bone meal is used, left " + boneMealLeft(player));
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void anyBlockOfTheColumnGrowsTheTop(TestContext ctx) {
        sugarCane(ctx, 2);
        ServerPlayerEntity player = farmer(ctx, 2);
        boneMeal(ctx, player, PLANT); // the bottom block
        ctx.assertTrue(height(ctx, Blocks.SUGAR_CANE) == 3, "the new block lands on top of the column");
        ctx.assertTrue(boneMealLeft(player) == 1, "one bone meal is used");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void sugarCaneUnderABlockTakesNoBoneMeal(TestContext ctx) {
        sugarCane(ctx, 1);
        ctx.setBlockState(PLANT.up(), Blocks.STONE);
        ServerPlayerEntity player = farmer(ctx, 2);
        boneMeal(ctx, player, PLANT);
        ctx.expectBlock(Blocks.STONE, PLANT.up());
        ctx.assertTrue(boneMealLeft(player) == 2, "no bone meal is used");
        ctx.complete();
    }

    // --- cactus ---

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void cactusGrowsOneBlockAndStartsItsTimerAgain(TestContext ctx) {
        cactus(ctx, 1);
        ctx.setBlockState(PLANT, Blocks.CACTUS.getDefaultState().with(CactusBlock.AGE, 7));
        ServerPlayerEntity player = farmer(ctx, 4);
        ctx.assertTrue(boneMeal(ctx, player, PLANT).isAccepted(), "bone meal on cactus is used");
        ctx.assertTrue(height(ctx, Blocks.CACTUS) == 2, "height 1 grows to 2");
        ctx.assertTrue(ctx.getBlockState(PLANT).get(CactusBlock.AGE) == 0, "the old top starts its growth timer again, like a natural growth");
        ctx.assertTrue(boneMealLeft(player) == 3, "one bone meal is used");
        boneMeal(ctx, player, PLANT.up());
        boneMeal(ctx, player, PLANT.up(2));
        ctx.assertTrue(height(ctx, Blocks.CACTUS) == 3, "cactus stops at three blocks");
        ctx.assertTrue(boneMealLeft(player) == 2, "the use at full height costs nothing");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void cactusThatWouldBreakDoesNotGrow(TestContext ctx) {
        // a block beside the space above the cactus: a new cactus there would break off at once
        cactus(ctx, 1);
        ctx.setBlockState(PLANT.up().west(), Blocks.STONE);
        ServerPlayerEntity player = farmer(ctx, 2);
        ctx.assertTrue(!boneMeal(ctx, player, PLANT).isAccepted(), "the click is not used");
        ctx.expectBlock(Blocks.AIR, PLANT.up());
        ctx.expectBlock(Blocks.CACTUS, PLANT);
        ctx.assertTrue(boneMealLeft(player) == 2, "no bone meal is used");
        ctx.assertTrue(ctx.getEntities(EntityType.ITEM).isEmpty(), "no cactus pops off");
        ctx.complete();
    }

    // --- nether wart ---

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void netherWartAdvancesOneAgePerUse(TestContext ctx) {
        ctx.setBlockState(GROUND, Blocks.SOUL_SAND);
        ctx.setBlockState(PLANT, Blocks.NETHER_WART);
        ServerPlayerEntity player = farmer(ctx, 5);
        for (int expected = 1; expected <= 3; expected++) {
            ctx.assertTrue(boneMeal(ctx, player, PLANT).isAccepted(), "bone meal on young wart is used");
            int age = ctx.getBlockState(PLANT).get(NetherWartBlock.AGE);
            ctx.assertTrue(age == expected, "age " + (expected - 1) + " goes to " + expected + ", got " + age);
            ctx.assertTrue(boneMealLeft(player) == 5 - expected, "one bone meal per use");
        }
        ctx.assertTrue(!boneMeal(ctx, player, PLANT).isAccepted(), "ripe wart does not take bone meal");
        ctx.assertTrue(ctx.getBlockState(PLANT).get(NetherWartBlock.AGE) == 3, "it stays ripe");
        ctx.assertTrue(boneMealLeft(player) == 2, "no bone meal is used on ripe wart");
        ctx.complete();
    }

    // --- dispensers ---

    private static final BlockPos DISPENSER = PLANT.west();

    private static void dispenserWithBoneMeal(TestContext ctx, int count) {
        ctx.setBlockState(DISPENSER, Blocks.DISPENSER.getDefaultState().with(DispenserBlock.FACING, Direction.EAST));
        DispenserBlockEntity dispenser = ctx.getBlockEntity(DISPENSER);
        dispenser.setStack(0, new ItemStack(Items.BONE_MEAL, count));
    }

    private static int dispenserBoneMeal(TestContext ctx) {
        DispenserBlockEntity dispenser = ctx.getBlockEntity(DISPENSER);
        int n = 0;
        for (int i = 0; i < dispenser.size(); i++) if (dispenser.getStack(i).isOf(Items.BONE_MEAL)) n += dispenser.getStack(i).getCount();
        return n;
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void dispenserGrowsSugarCane(TestContext ctx) {
        sugarCane(ctx, 1);
        dispenserWithBoneMeal(ctx, 2);
        ctx.setBlockState(DISPENSER.west(), Blocks.REDSTONE_BLOCK);
        // the dispenser fires 4 ticks after it is powered, once (the redstone block stays)
        ctx.runAtTick(15, () -> {
            ctx.expectBlock(Blocks.SUGAR_CANE, PLANT.up());
            ctx.assertTrue(dispenserBoneMeal(ctx) == 1, "the dispenser used one bone meal, left " + dispenserBoneMeal(ctx));
            ctx.expectBlock(Blocks.AIR, PLANT.up(2));
            ctx.complete();
        });
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void dispenserKeepsBoneMealForFullSugarCane(TestContext ctx) {
        sugarCane(ctx, 3);
        dispenserWithBoneMeal(ctx, 2);
        ctx.setBlockState(DISPENSER.west(), Blocks.REDSTONE_BLOCK);
        // the dispenser fires 4 ticks after it is powered
        ctx.runAtTick(15, () -> {
            ctx.assertTrue(height(ctx, Blocks.SUGAR_CANE) == 3, "the cane stays three blocks tall");
            ctx.assertTrue(dispenserBoneMeal(ctx) == 2, "the dispenser keeps its bone meal, has " + dispenserBoneMeal(ctx));
            ctx.assertTrue(ctx.getEntities(EntityType.ITEM).isEmpty(), "nothing is spat out");
            ctx.complete();
        });
    }

    // --- players without the mod ---

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void theRestOfTheClickIsIgnoredAfterAGrowth(TestContext ctx) {
        // a game without the mod guesses the bone meal did nothing and tries the off hand right behind it
        sugarCane(ctx, 1);
        ServerPlayerEntity player = farmer(ctx, new ItemStack(Items.BONE_MEAL, 3), new ItemStack(Items.DIRT, 5));
        boneMeal(ctx, player, PLANT);
        ctx.assertTrue(height(ctx, Blocks.SUGAR_CANE) == 2, "the cane grew");
        ctx.assertTrue(!click(ctx, player, Hand.OFF_HAND, PLANT, Direction.WEST).isAccepted(), "the off hand of the same click is ignored");
        ctx.expectBlock(Blocks.AIR, PLANT.west());
        ctx.assertTrue(player.getOffHandStack().getCount() == 5, "no dirt is placed");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void theItemUseBehindAGrowthIsIgnored(TestContext ctx) {
        sugarCane(ctx, 1);
        ServerPlayerEntity player = farmer(ctx, new ItemStack(Items.BONE_MEAL, 3), new ItemStack(Items.ENDER_PEARL, 4));
        boneMeal(ctx, player, PLANT);
        ActionResult use = player.interactionManager.interactItem(player, ctx.getWorld(), player.getOffHandStack(), Hand.OFF_HAND);
        ctx.assertTrue(!use.isAccepted(), "the pearl is not thrown: " + use);
        ctx.assertTrue(player.getOffHandStack().getCount() == 4, "all four pearls are still there");
        ctx.assertTrue(ctx.getEntities(EntityType.ENDER_PEARL).isEmpty(), "no pearl flies");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void withoutAGrowthTheOffHandWorksAsUsual(TestContext ctx) {
        sugarCane(ctx, 3);
        ServerPlayerEntity player = farmer(ctx, new ItemStack(Items.BONE_MEAL, 3), new ItemStack(Items.DIRT, 5));
        boneMeal(ctx, player, PLANT);
        ctx.assertTrue(click(ctx, player, Hand.OFF_HAND, PLANT, Direction.WEST).isAccepted(), "the off hand places its block as in the plain game");
        ctx.expectBlock(Blocks.DIRT, PLANT.west());
        ctx.assertTrue(player.getOffHandStack().getCount() == 4, "one dirt is placed");
        ctx.complete();
    }

    // --- the game's own bone meal targets are unchanged ---

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void wheatStillGrowsTwoToFiveStages(TestContext ctx) {
        ctx.setBlockState(GROUND, Blocks.FARMLAND);
        ctx.setBlockState(PLANT, Blocks.WHEAT);
        ServerPlayerEntity player = farmer(ctx, 2);
        ctx.assertTrue(boneMeal(ctx, player, PLANT).isAccepted(), "bone meal on young wheat is used");
        BlockState wheat = ctx.getBlockState(PLANT);
        int age = ((CropBlock) Blocks.WHEAT).getAge(wheat);
        ctx.assertTrue(age >= 2 && age <= 5, "wheat grows 2 to 5 stages, got " + age);
        ctx.assertTrue(boneMealLeft(player) == 1, "one bone meal is used");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void ripeWheatAndStoneTakeNoBoneMeal(TestContext ctx) {
        ctx.setBlockState(GROUND, Blocks.FARMLAND);
        ctx.setBlockState(PLANT, ((CropBlock) Blocks.WHEAT).withAge(7));
        ctx.setBlockState(new BlockPos(5, 1, 5), Blocks.STONE);
        ServerPlayerEntity player = farmer(ctx, 3);
        boneMeal(ctx, player, PLANT);
        boneMeal(ctx, player, new BlockPos(5, 1, 5));
        ctx.assertTrue(boneMealLeft(player) == 3, "no bone meal is used, left " + boneMealLeft(player));
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void saplingStillTakesBoneMeal(TestContext ctx) {
        ctx.setBlockState(GROUND, Blocks.DIRT);
        ctx.setBlockState(PLANT, Blocks.OAK_SAPLING);
        ServerPlayerEntity player = farmer(ctx, 2);
        ctx.assertTrue(boneMeal(ctx, player, PLANT).isAccepted(), "bone meal on a sapling is used");
        ctx.assertTrue(boneMealLeft(player) == 1, "one bone meal is used (the tree may or may not grow yet)");
        ctx.complete();
    }
}
