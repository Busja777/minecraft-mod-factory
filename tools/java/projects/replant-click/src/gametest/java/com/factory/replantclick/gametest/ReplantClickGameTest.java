package com.factory.replantclick.gametest;

import net.fabricmc.fabric.api.gametest.v1.FabricGameTest;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.block.CocoaBlock;
import net.minecraft.block.CropBlock;
import net.minecraft.block.NetherWartBlock;
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
        return click(ctx, player, hand, at, Direction.UP);
    }

    private static ActionResult click(TestContext ctx, ServerPlayerEntity player, Hand hand, BlockPos at, Direction side) {
        BlockPos pos = ctx.getAbsolutePos(at);
        BlockHitResult hit = new BlockHitResult(Vec3d.ofCenter(pos), side, pos, false);
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

    // --- V1.1: nether wart and cocoa pods ---

    private static void plantWart(TestContext ctx, int age) {
        ctx.setBlockState(SOIL, Blocks.SOUL_SAND);
        ctx.setBlockState(CROP, Blocks.NETHER_WART.getDefaultState().with(NetherWartBlock.AGE, age));
    }

    /** A cocoa pod at {@code at} hanging on a jungle log on its {@code facing} side. */
    private static void plantCocoa(TestContext ctx, BlockPos at, Direction facing, int age) {
        ctx.setBlockState(at.offset(facing), Blocks.JUNGLE_LOG);
        ctx.setBlockState(at, Blocks.COCOA.getDefaultState().with(CocoaBlock.FACING, facing).with(CocoaBlock.AGE, age));
    }

    private static int wartAge(TestContext ctx) {
        BlockState state = ctx.getBlockState(CROP);
        ctx.assertTrue(state.isOf(Blocks.NETHER_WART), "the nether wart is gone: " + state);
        return state.get(NetherWartBlock.AGE);
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void harvestsAndReplantsNetherWart(TestContext ctx) {
        plantWart(ctx, NetherWartBlock.MAX_AGE);
        ServerPlayerEntity player = farmer(ctx, ItemStack.EMPTY);
        ctx.assertTrue(click(ctx, player, Hand.MAIN_HAND) == ActionResult.SUCCESS, "a right-click on ripe nether wart is handled");
        ctx.assertTrue(wartAge(ctx) == 0, "the nether wart is replanted at age 0");
        ctx.expectBlock(Blocks.SOUL_SAND, SOIL);
        // the loot gives 2 to 4 nether wart; one of them was planted again
        int wart = dropped(ctx, Items.NETHER_WART);
        ctx.assertTrue(wart >= 1 && wart <= 3, "1 to 3 nether wart drop, got " + wart);
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void netherWartWithItemsInHand(TestContext ctx) {
        // a hoe takes no damage; nether wart in hand is not planted somewhere else
        plantWart(ctx, NetherWartBlock.MAX_AGE);
        ServerPlayerEntity player = farmer(ctx, new ItemStack(Items.NETHER_WART, 5));
        ctx.assertTrue(click(ctx, player, Hand.MAIN_HAND) == ActionResult.SUCCESS, "ripe nether wart is harvested with nether wart in hand");
        ctx.assertTrue(wartAge(ctx) == 0, "the nether wart is replanted");
        ctx.assertTrue(player.getMainHandStack().getCount() == 5, "the held nether wart is not used");
        ctx.expectBlock(Blocks.AIR, CROP.up());
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void fortuneGivesMoreNetherWart(TestContext ctx) {
        // 60 harvests each: on average 2 against 3.5 nether wart are left per harvest with Fortune III
        // (uniform bonus 0 to 3), so the Fortune pile is bigger by 90 (about seven standard deviations).
        BlockPos plain = new BlockPos(1, 2, 1);
        BlockPos lucky = new BlockPos(5, 2, 5);
        ItemStack fortuneHoe = new ItemStack(Items.IRON_HOE);
        fortuneHoe.addEnchantment(ctx.getWorld().getRegistryManager().get(RegistryKeys.ENCHANTMENT).entryOf(Enchantments.FORTUNE), 3);
        ServerPlayerEntity plainFarmer = farmer(ctx, new ItemStack(Items.IRON_HOE));
        ServerPlayerEntity luckyFarmer = farmer(ctx, fortuneHoe);
        ctx.setBlockState(plain.down(), Blocks.SOUL_SAND);
        ctx.setBlockState(lucky.down(), Blocks.SOUL_SAND);
        BlockState ripe = Blocks.NETHER_WART.getDefaultState().with(NetherWartBlock.AGE, NetherWartBlock.MAX_AGE);
        for (int i = 0; i < 60; i++) {
            ctx.setBlockState(plain, ripe);
            ctx.setBlockState(lucky, ripe);
            click(ctx, plainFarmer, Hand.MAIN_HAND, plain);
            click(ctx, luckyFarmer, Hand.MAIN_HAND, lucky);
        }
        int without = dropped(ctx, Items.NETHER_WART, plain);
        int with = dropped(ctx, Items.NETHER_WART, lucky);
        ctx.assertTrue(without >= 60 && without <= 180, "1 to 3 nether wart per plain harvest, got " + without);
        ctx.assertTrue(with > without + 40, "Fortune III gives more nether wart: " + with + " against " + without);
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void youngNetherWartStays(TestContext ctx) {
        plantWart(ctx, NetherWartBlock.MAX_AGE - 1);
        ServerPlayerEntity player = farmer(ctx, ItemStack.EMPTY);
        ctx.assertTrue(click(ctx, player, Hand.MAIN_HAND) != ActionResult.SUCCESS, "young nether wart is not handled");
        ctx.assertTrue(wartAge(ctx) == NetherWartBlock.MAX_AGE - 1, "young nether wart keeps growing");
        ctx.assertTrue(dropped(ctx, Items.NETHER_WART) == 0, "nothing drops from young nether wart");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void sneakingLeavesTheNetherWart(TestContext ctx) {
        plantWart(ctx, NetherWartBlock.MAX_AGE);
        ServerPlayerEntity player = farmer(ctx, ItemStack.EMPTY);
        player.setSneaking(true);
        click(ctx, player, Hand.MAIN_HAND);
        ctx.assertTrue(wartAge(ctx) == NetherWartBlock.MAX_AGE, "sneaking keeps the nether wart ripe");
        ctx.assertTrue(dropped(ctx, Items.NETHER_WART) == 0, "nothing drops while sneaking");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void harvestsCocoaAndReplantsOnTheSameLogSide(TestContext ctx) {
        // one pod per side of a log, each clicked on the face that looks away from its log
        Direction[] sides = { Direction.NORTH, Direction.EAST, Direction.SOUTH, Direction.WEST };
        BlockPos[] pods = { new BlockPos(2, 2, 2), new BlockPos(6, 2, 2), new BlockPos(2, 2, 6), new BlockPos(6, 2, 6) };
        ServerPlayerEntity player = farmer(ctx, ItemStack.EMPTY);
        for (int i = 0; i < sides.length; i++) plantCocoa(ctx, pods[i], sides[i], CocoaBlock.MAX_AGE);
        for (int i = 0; i < sides.length; i++) {
            ctx.assertTrue(click(ctx, player, Hand.MAIN_HAND, pods[i], sides[i].getOpposite()) == ActionResult.SUCCESS, "a right-click on a ripe pod facing " + sides[i] + " is handled");
            BlockState state = ctx.getBlockState(pods[i]);
            ctx.assertTrue(state.isOf(Blocks.COCOA), "the pod facing " + sides[i] + " is replanted: " + state);
            ctx.assertTrue(state.get(CocoaBlock.AGE) == 0, "the new pod facing " + sides[i] + " is at age 0");
            ctx.assertTrue(state.get(CocoaBlock.FACING) == sides[i], "the new pod still hangs on the log to the " + sides[i] + ", got " + state.get(CocoaBlock.FACING));
            ctx.expectBlock(Blocks.JUNGLE_LOG, pods[i].offset(sides[i]));
            // a ripe pod drops 3 cocoa beans; one of them was planted again
            int beans = dropped(ctx, Items.COCOA_BEANS, pods[i]);
            ctx.assertTrue(beans == 2, "two cocoa beans drop from the pod facing " + sides[i] + ", got " + beans);
        }
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void cocoaWithBeansInHandIsHarvestedNotPlaced(TestContext ctx) {
        plantCocoa(ctx, CROP, Direction.EAST, CocoaBlock.MAX_AGE);
        ServerPlayerEntity player = farmer(ctx, new ItemStack(Items.COCOA_BEANS, 4));
        ctx.assertTrue(click(ctx, player, Hand.MAIN_HAND, CROP, Direction.WEST) == ActionResult.SUCCESS, "a ripe pod is harvested with beans in hand");
        ctx.assertTrue(ctx.getBlockState(CROP).get(CocoaBlock.AGE) == 0, "the pod is replanted");
        ctx.assertTrue(player.getMainHandStack().getCount() == 4, "the held beans are not used");
        ctx.assertTrue(dropped(ctx, Items.COCOA_BEANS) == 2, "two cocoa beans drop");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void youngCocoaStays(TestContext ctx) {
        plantCocoa(ctx, CROP, Direction.SOUTH, CocoaBlock.MAX_AGE - 1);
        ServerPlayerEntity player = farmer(ctx, ItemStack.EMPTY);
        ctx.assertTrue(click(ctx, player, Hand.MAIN_HAND, CROP, Direction.NORTH) != ActionResult.SUCCESS, "a young pod is not handled");
        ctx.assertTrue(ctx.getBlockState(CROP).get(CocoaBlock.AGE) == CocoaBlock.MAX_AGE - 1, "the young pod keeps growing");
        ctx.assertTrue(dropped(ctx, Items.COCOA_BEANS) == 0, "nothing drops from a young pod");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void sneakingAndBoneMealLeaveTheCocoa(TestContext ctx) {
        plantCocoa(ctx, CROP, Direction.WEST, CocoaBlock.MAX_AGE);
        ServerPlayerEntity sneaker = farmer(ctx, ItemStack.EMPTY);
        sneaker.setSneaking(true);
        click(ctx, sneaker, Hand.MAIN_HAND, CROP, Direction.EAST);
        ServerPlayerEntity boneMeal = farmer(ctx, new ItemStack(Items.BONE_MEAL, 3));
        click(ctx, boneMeal, Hand.MAIN_HAND, CROP, Direction.EAST);
        click(ctx, boneMeal, Hand.OFF_HAND, CROP, Direction.EAST);
        ctx.assertTrue(ctx.getBlockState(CROP).get(CocoaBlock.AGE) == CocoaBlock.MAX_AGE, "the ripe pod stays");
        ctx.assertTrue(dropped(ctx, Items.COCOA_BEANS) == 0, "nothing drops");
        ctx.assertTrue(boneMeal.getMainHandStack().getCount() == 3, "no bone meal is used on a ripe pod");
        ctx.complete();
    }
}
