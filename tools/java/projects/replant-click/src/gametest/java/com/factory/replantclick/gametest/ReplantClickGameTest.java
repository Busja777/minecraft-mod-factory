package com.factory.replantclick.gametest;

import com.factory.replantclick.ReplantClick;
import com.factory.replantclick.ReplantConfig;
import net.fabricmc.fabric.api.event.player.PlayerBlockBreakEvents;
import net.fabricmc.fabric.api.gametest.v1.FabricGameTest;
import net.minecraft.block.Block;
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
    // --- V1.2: the 3×3 area with a hoe ---

    /** A 3×3 field around {@code center} (soil one below), every plant in {@code ripe}. */
    private static void field(TestContext ctx, BlockPos center, Block soil, BlockState ripe) {
        for (int dx = -1; dx <= 1; dx++) for (int dz = -1; dz <= 1; dz++) {
            BlockPos at = center.add(dx, 0, dz);
            ctx.setBlockState(at.down(), soil);
            ctx.setBlockState(at, ripe);
        }
    }

    private static BlockState ripe(CropBlock crop) {
        return crop.withAge(crop.getMaxAge());
    }

    /** How many plants of the 3×3 field around {@code center} are at age 0 (freshly replanted). */
    private static int replanted(TestContext ctx, BlockPos center) {
        int n = 0;
        for (int dx = -1; dx <= 1; dx++) for (int dz = -1; dz <= 1; dz++) if (plantAge(ctx, center.add(dx, 0, dz)) == 0) n++;
        return n;
    }

    private static int plantAge(TestContext ctx, BlockPos at) {
        BlockState state = ctx.getBlockState(at);
        if (state.getBlock() instanceof CropBlock crop) return crop.getAge(state);
        if (state.isOf(Blocks.NETHER_WART)) return state.get(NetherWartBlock.AGE);
        if (state.isOf(Blocks.COCOA)) return state.get(CocoaBlock.AGE);
        throw new AssertionError("no plant at " + at + ": " + state);
    }

    private static ItemStack enchanted(TestContext ctx, Item item, net.minecraft.registry.RegistryKey<net.minecraft.enchantment.Enchantment> enchantment, int level) {
        ItemStack stack = new ItemStack(item);
        stack.addEnchantment(ctx.getWorld().getRegistryManager().get(RegistryKeys.ENCHANTMENT).entryOf(enchantment), level);
        return stack;
    }

    private static final BlockPos FIELD = new BlockPos(3, 2, 3);

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void aHoeHarvestsTheRipeCropsOfTheSameKindAround(TestContext ctx) {
        field(ctx, FIELD, Blocks.FARMLAND, ripe((CropBlock) Blocks.WHEAT));
        BlockPos young = FIELD.add(-1, 0, -1);
        BlockPos carrot = FIELD.add(1, 0, 1);
        BlockPos outside = FIELD.add(3, 0, 0);
        ctx.setBlockState(young, ((CropBlock) Blocks.WHEAT).withAge(3));
        ctx.setBlockState(carrot, ripe((CropBlock) Blocks.CARROTS));
        plant(ctx, outside, (CropBlock) Blocks.WHEAT, 7);
        ServerPlayerEntity player = farmer(ctx, new ItemStack(Items.IRON_HOE));
        ctx.assertTrue(click(ctx, player, Hand.MAIN_HAND, FIELD) == ActionResult.SUCCESS, "a right-click on ripe wheat with a hoe is handled");
        ctx.assertTrue(replanted(ctx, FIELD) == 7, "the clicked wheat and its six ripe wheat neighbours are replanted, got " + replanted(ctx, FIELD));
        ctx.assertTrue(plantAge(ctx, young) == 3, "young wheat in the area keeps growing");
        ctx.assertTrue(plantAge(ctx, carrot) == 7, "a crop of another kind in the area stays ripe");
        ctx.assertTrue(plantAge(ctx, outside) == 7, "ripe wheat outside the 3×3 area stays ripe");
        for (int dx = -1; dx <= 1; dx++) for (int dz = -1; dz <= 1; dz++) ctx.expectBlock(Blocks.FARMLAND, FIELD.add(dx, -1, dz));
        int wheat = ctx.getEntitiesAround(EntityType.ITEM, FIELD, 2.5).stream().map(ItemEntity::getStack).filter(st -> st.isOf(Items.WHEAT)).mapToInt(ItemStack::getCount).sum();
        ctx.assertTrue(wheat == 7, "one wheat drops per harvested crop, got " + wheat);
        ctx.assertTrue(player.getMainHandStack().getDamage() == 6, "one point of durability per neighbour, the clicked crop is free: " + player.getMainHandStack().getDamage());
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void withoutAHoeOnlyTheClickedCrop(TestContext ctx) {
        field(ctx, FIELD, Blocks.FARMLAND, ripe((CropBlock) Blocks.WHEAT));
        ServerPlayerEntity bare = farmer(ctx, ItemStack.EMPTY);
        ctx.assertTrue(click(ctx, bare, Hand.MAIN_HAND, FIELD) == ActionResult.SUCCESS, "an empty hand harvests");
        ctx.assertTrue(replanted(ctx, FIELD) == 1, "an empty hand harvests only the clicked wheat, got " + replanted(ctx, FIELD));
        field(ctx, FIELD, Blocks.FARMLAND, ripe((CropBlock) Blocks.WHEAT));
        ServerPlayerEntity shovel = farmer(ctx, new ItemStack(Items.IRON_SHOVEL));
        ctx.assertTrue(click(ctx, shovel, Hand.MAIN_HAND, FIELD) == ActionResult.SUCCESS, "another tool harvests");
        ctx.assertTrue(replanted(ctx, FIELD) == 1, "another tool harvests only the clicked wheat, got " + replanted(ctx, FIELD));
        ctx.assertTrue(shovel.getMainHandStack().getDamage() == 0, "the shovel takes no damage");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void theHoeNeverBreaks(TestContext ctx) {
        field(ctx, FIELD, Blocks.FARMLAND, ripe((CropBlock) Blocks.POTATOES));
        ItemStack worn = new ItemStack(Items.IRON_HOE);
        worn.setDamage(worn.getMaxDamage() - 3); // three points left
        ServerPlayerEntity player = farmer(ctx, worn);
        ctx.assertTrue(click(ctx, player, Hand.MAIN_HAND, FIELD) == ActionResult.SUCCESS, "a worn hoe still harvests");
        ItemStack hoe = player.getMainHandStack();
        ctx.assertTrue(hoe.isOf(Items.IRON_HOE), "the hoe is still there: " + hoe);
        ctx.assertTrue(hoe.getDamage() == hoe.getMaxDamage() - 1, "the hoe stops at its last point, damage " + hoe.getDamage());
        ctx.assertTrue(replanted(ctx, FIELD) == 3, "the clicked potatoes and two neighbours are harvested, got " + replanted(ctx, FIELD));
        // the next click with one point left harvests the clicked crop only
        field(ctx, FIELD, Blocks.FARMLAND, ripe((CropBlock) Blocks.POTATOES));
        ctx.assertTrue(click(ctx, player, Hand.MAIN_HAND, FIELD) == ActionResult.SUCCESS, "a hoe with one point left still harvests the clicked crop");
        ctx.assertTrue(replanted(ctx, FIELD) == 1, "only the clicked potatoes, got " + replanted(ctx, FIELD));
        ctx.assertTrue(player.getMainHandStack().isOf(Items.IRON_HOE) && player.getMainHandStack().getDamage() == hoe.getMaxDamage() - 1, "the hoe is unchanged");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void unbreakingSavesTheHoe(TestContext ctx) {
        // 5 clicks on a full field: 40 neighbours. Unbreaking III lets a hoe take a hit only one time
        // in four, so about 10 points go (above 30 is far outside chance); without it all 40 would.
        ServerPlayerEntity player = farmer(ctx, enchanted(ctx, Items.DIAMOND_HOE, Enchantments.UNBREAKING, 3));
        for (int i = 0; i < 5; i++) {
            field(ctx, FIELD, Blocks.FARMLAND, ripe((CropBlock) Blocks.CARROTS));
            click(ctx, player, Hand.MAIN_HAND, FIELD);
            ctx.assertTrue(replanted(ctx, FIELD) == 9, "round " + i + ": the whole field is harvested, got " + replanted(ctx, FIELD));
        }
        int damage = player.getMainHandStack().getDamage();
        ctx.assertTrue(damage < 30, "Unbreaking III spares the hoe: " + damage + " points for 40 crops");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void fortuneCountsForEveryCropOfTheArea(TestContext ctx) {
        // 4 clicks on a full field of carrots each: 36 harvests, on average 1.7 against 3.4 carrots
        // left per harvest with Fortune III, so the Fortune pile is bigger by about 60.
        BlockPos plain = new BlockPos(2, 2, 2);
        BlockPos lucky = new BlockPos(6, 2, 6);
        ServerPlayerEntity plainFarmer = farmer(ctx, new ItemStack(Items.DIAMOND_HOE));
        ServerPlayerEntity luckyFarmer = farmer(ctx, enchanted(ctx, Items.DIAMOND_HOE, Enchantments.FORTUNE, 3));
        for (int i = 0; i < 4; i++) {
            field(ctx, plain, Blocks.FARMLAND, ripe((CropBlock) Blocks.CARROTS));
            field(ctx, lucky, Blocks.FARMLAND, ripe((CropBlock) Blocks.CARROTS));
            click(ctx, plainFarmer, Hand.MAIN_HAND, plain);
            click(ctx, luckyFarmer, Hand.MAIN_HAND, lucky);
        }
        int without = ctx.getEntitiesAround(EntityType.ITEM, plain, 2.5).stream().map(ItemEntity::getStack).filter(st -> st.isOf(Items.CARROT)).mapToInt(ItemStack::getCount).sum();
        int with = ctx.getEntitiesAround(EntityType.ITEM, lucky, 2.5).stream().map(ItemEntity::getStack).filter(st -> st.isOf(Items.CARROT)).mapToInt(ItemStack::getCount).sum();
        ctx.assertTrue(without >= 36, "at least one carrot is left per plain harvest, got " + without);
        ctx.assertTrue(with > without + 25, "Fortune III gives more carrots on every crop of the area: " + with + " against " + without);
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void netherWartIsHarvestedInTheAreaToo(TestContext ctx) {
        field(ctx, FIELD, Blocks.SOUL_SAND, Blocks.NETHER_WART.getDefaultState().with(NetherWartBlock.AGE, NetherWartBlock.MAX_AGE));
        ServerPlayerEntity player = farmer(ctx, new ItemStack(Items.GOLDEN_HOE));
        ctx.assertTrue(click(ctx, player, Hand.MAIN_HAND, FIELD) == ActionResult.SUCCESS, "ripe nether wart with a hoe is handled");
        ctx.assertTrue(replanted(ctx, FIELD) == 9, "the whole patch of nether wart is replanted, got " + replanted(ctx, FIELD));
        ctx.assertTrue(player.getMainHandStack().getDamage() == 8, "eight neighbours cost eight points: " + player.getMainHandStack().getDamage());
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void cocoaStaysSingleWithAHoe(TestContext ctx) {
        // two ripe pods side by side on two logs
        BlockPos first = new BlockPos(2, 2, 2);
        BlockPos second = new BlockPos(2, 2, 3);
        plantCocoa(ctx, first, Direction.EAST, CocoaBlock.MAX_AGE);
        plantCocoa(ctx, second, Direction.EAST, CocoaBlock.MAX_AGE);
        ServerPlayerEntity player = farmer(ctx, new ItemStack(Items.IRON_HOE));
        ctx.assertTrue(click(ctx, player, Hand.MAIN_HAND, first, Direction.WEST) == ActionResult.SUCCESS, "a ripe pod is harvested with a hoe");
        ctx.assertTrue(plantAge(ctx, first) == 0, "the clicked pod is replanted");
        ctx.assertTrue(plantAge(ctx, second) == CocoaBlock.MAX_AGE, "the pod next to it stays ripe");
        ctx.assertTrue(player.getMainHandStack().getDamage() == 0, "the hoe takes no damage");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void sneakingWithAHoeLeavesTheField(TestContext ctx) {
        field(ctx, FIELD, Blocks.FARMLAND, ripe((CropBlock) Blocks.BEETROOTS));
        ServerPlayerEntity player = farmer(ctx, new ItemStack(Items.IRON_HOE));
        player.setSneaking(true);
        click(ctx, player, Hand.MAIN_HAND, FIELD);
        ctx.assertTrue(replanted(ctx, FIELD) == 0, "sneaking harvests nothing");
        ctx.assertTrue(player.getMainHandStack().getDamage() == 0, "the hoe takes no damage");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void theAreaCanBeSwitchedOff(TestContext ctx) {
        // the setting is global; the click happens in this same tick, so no other test sees it
        field(ctx, FIELD, Blocks.FARMLAND, ripe((CropBlock) Blocks.WHEAT));
        ServerPlayerEntity player = farmer(ctx, new ItemStack(Items.IRON_HOE));
        ReplantConfig before = ReplantClick.config();
        ctx.assertTrue(before.areaWithHoe(), "the area is on by default");
        ReplantClick.setConfig(new ReplantConfig(false));
        try {
            ctx.assertTrue(click(ctx, player, Hand.MAIN_HAND, FIELD) == ActionResult.SUCCESS, "the clicked wheat is still harvested");
        } finally {
            ReplantClick.setConfig(before);
        }
        ctx.assertTrue(replanted(ctx, FIELD) == 1, "with areaWithHoe off only the clicked wheat, got " + replanted(ctx, FIELD));
        ctx.assertTrue(player.getMainHandStack().getDamage() == 0, "the hoe takes no damage");
        ctx.complete();
    }
    /** The position a stand-in claim mod protects (absolute; null: none). Server thread only. */
    private static BlockPos protectedPos;
    private static boolean claimModRegistered;

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void protectedNeighboursAreSkipped(TestContext ctx) {
        // a stand-in claim mod: vetoes breaking one block the way claim mods do, via PlayerBlockBreakEvents.BEFORE
        if (!claimModRegistered) {
            PlayerBlockBreakEvents.BEFORE.register((world, player, pos, state, blockEntity) -> !pos.equals(protectedPos));
            claimModRegistered = true;
        }
        field(ctx, FIELD, Blocks.FARMLAND, ripe((CropBlock) Blocks.WHEAT));
        BlockPos guarded = FIELD.add(1, 0, 0);
        ServerPlayerEntity player = farmer(ctx, new ItemStack(Items.IRON_HOE));
        // set and cleared within this tick, so no other test sees the veto
        protectedPos = ctx.getAbsolutePos(guarded);
        try {
            ctx.assertTrue(click(ctx, player, Hand.MAIN_HAND, FIELD) == ActionResult.SUCCESS, "the clicked wheat is harvested");
        } finally {
            protectedPos = null;
        }
        ctx.assertTrue(plantAge(ctx, guarded) == 7, "the protected wheat stays ripe");
        ctx.assertTrue(replanted(ctx, FIELD) == 8, "the clicked wheat and the seven unprotected neighbours are harvested, got " + replanted(ctx, FIELD));
        int wheat = ctx.getEntitiesAround(EntityType.ITEM, FIELD, 2.5).stream().map(ItemEntity::getStack).filter(st -> st.isOf(Items.WHEAT)).mapToInt(ItemStack::getCount).sum();
        ctx.assertTrue(wheat == 8, "nothing drops from the protected wheat, got " + wheat + " wheat");
        ctx.assertTrue(player.getMainHandStack().getDamage() == 7, "the protected wheat costs no durability: " + player.getMainHandStack().getDamage());
        ctx.complete();
    }
}
