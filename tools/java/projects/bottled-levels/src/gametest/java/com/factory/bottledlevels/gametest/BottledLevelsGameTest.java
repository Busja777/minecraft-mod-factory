package com.factory.bottledlevels.gametest;

import com.factory.bottledlevels.BottleRules;
import com.factory.bottledlevels.Bottling;
import com.factory.bottledlevels.XpMath;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import net.fabricmc.fabric.api.gametest.v1.FabricGameTest;
import net.minecraft.block.Blocks;
import net.minecraft.block.DispenserBlock;
import net.minecraft.block.entity.DispenserBlockEntity;
import net.minecraft.component.DataComponentTypes;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.ExperienceOrbEntity;
import net.minecraft.entity.player.PlayerInventory;
import net.minecraft.entity.projectile.thrown.ExperienceBottleEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.nbt.NbtCompound;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
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
 * In-world tests on a headless game test server (gradlew :bottled-levels:runGametest).
 * A survival server player right-clicks through the real server path
 * (ServerPlayerInteractionManager.interactBlock / interactItem, where Fabric API fires
 * UseBlockCallback and UseItemCallback). Thrown bottles break through the game's own projectile
 * code. Tests that count orbs run in their own batch (one after another) and count every orb of the
 * world, so orbs drifting towards a mock player or from another test cannot blur the count.
 */
public class BottledLevelsGameTest implements FabricGameTest {
    private static final BlockPos TABLE = new BlockPos(1, 1, 1);

    @SuppressWarnings("removal") // the mock server player is deprecated in 1.21.1 but still the way to test the server path
    private static ServerPlayerEntity player(TestContext ctx, ItemStack mainHand, int points) {
        ServerPlayerEntity player = ctx.createMockCreativeServerPlayerInWorld();
        player.changeGameMode(GameMode.SURVIVAL);
        player.setStackInHand(Hand.MAIN_HAND, mainHand);
        XpMath.Xp xp = XpMath.fromTotal(points);
        player.setExperienceLevel(xp.level());
        player.setExperiencePoints(xp.points());
        player.totalExperience = points;
        return player;
    }

    private static long points(ServerPlayerEntity player) {
        return XpMath.totalPoints(player.experienceLevel, player.experienceProgress);
    }

    private static ActionResult click(TestContext ctx, ServerPlayerEntity player, Hand hand, BlockPos at) {
        BlockPos pos = ctx.getAbsolutePos(at);
        BlockHitResult hit = new BlockHitResult(Vec3d.ofCenter(pos), Direction.UP, pos, false);
        return player.interactionManager.interactBlock(player, ctx.getWorld(), player.getStackInHand(hand), hand, hit);
    }

    /** A sneak-click on the enchanting table at {@link #TABLE}. */
    private static ActionResult sneakClick(TestContext ctx, ServerPlayerEntity player, Hand hand) {
        player.setSneaking(true);
        return click(ctx, player, hand, TABLE);
    }

    private static ActionResult useItem(TestContext ctx, ServerPlayerEntity player, Hand hand) {
        return player.interactionManager.interactItem(player, ctx.getWorld(), player.getStackInHand(hand), hand);
    }

    private static List<ItemStack> allStacks(ServerPlayerEntity player) {
        PlayerInventory inv = player.getInventory();
        return java.util.stream.Stream.concat(inv.main.stream(), inv.offHand.stream()).toList();
    }

    /** Filled bottles in the inventory holding {@code xp} points. */
    private static int filled(ServerPlayerEntity player, int xp) {
        return allStacks(player).stream().filter(s -> Bottling.storedXp(s) == xp).mapToInt(ItemStack::getCount).sum();
    }

    private static int count(ServerPlayerEntity player, net.minecraft.item.Item item) {
        return allStacks(player).stream().filter(s -> s.isOf(item)).mapToInt(ItemStack::getCount).sum();
    }

    private static List<? extends ExperienceOrbEntity> orbs(ServerWorld world) {
        return world.getEntitiesByType(EntityType.EXPERIENCE_ORB, orb -> orb.isAlive());
    }

    /** Points of all orbs in the world (merged orbs count once per orb they stand for). */
    private static int orbPoints(ServerWorld world) {
        int sum = 0;
        for (ExperienceOrbEntity orb : orbs(world)) {
            NbtCompound nbt = new NbtCompound();
            orb.writeCustomDataToNbt(nbt);
            sum += orb.getExperienceAmount() * nbt.getInt("Count");
        }
        return sum;
    }

    private static void clearOrbs(ServerWorld world) {
        for (ExperienceOrbEntity orb : List.copyOf(orbs(world))) orb.discard();
    }

    private static int bottlesInFlight(ServerWorld world) {
        return world.getEntitiesByType(EntityType.EXPERIENCE_BOTTLE, e -> e.isAlive()).size();
    }

    /** Drops a bottle holding {@code stack} at {@code at} (relative); it falls onto a stone block below. */
    private static void drop(TestContext ctx, BlockPos at, ItemStack stack) {
        ctx.setBlockState(at, Blocks.STONE);
        Vec3d pos = ctx.getAbsolute(Vec3d.ofCenter(at).add(0, 1.5, 0));
        ExperienceBottleEntity bottle = new ExperienceBottleEntity(ctx.getWorld(), pos.x, pos.y, pos.z);
        bottle.setItem(stack);
        ctx.getWorld().spawnEntity(bottle);
    }

    // --- bottling ---

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void bottlingTakesFiftyPointsAndGivesAFilledBottle(TestContext ctx) {
        ctx.setBlockState(TABLE, Blocks.ENCHANTING_TABLE);
        ServerPlayerEntity player = player(ctx, new ItemStack(Items.GLASS_BOTTLE, 3), 200);
        ctx.assertTrue(points(player) == 200, "the player starts with 200 points, has " + points(player));
        ctx.assertTrue(sneakClick(ctx, player, Hand.MAIN_HAND) == ActionResult.SUCCESS, "a sneak-click on the table with a glass bottle is handled");
        ctx.assertTrue(points(player) == 150, "exactly 50 points are taken, left " + points(player));
        ctx.assertTrue(player.totalExperience == 150, "the total follows, got " + player.totalExperience);
        ctx.assertTrue(player.getMainHandStack().isOf(Items.GLASS_BOTTLE) && player.getMainHandStack().getCount() == 2, "one glass bottle is used");
        ctx.assertTrue(filled(player, 45) == 1, "one bottle holding 45 points is in the inventory");
        ItemStack bottle = allStacks(player).stream().filter(s -> Bottling.storedXp(s) > 0).findFirst().orElseThrow();
        ctx.assertTrue(bottle.isOf(Items.EXPERIENCE_BOTTLE), "the filled bottle is a vanilla Bottle o' Enchanting");
        ctx.assertTrue(bottle.get(DataComponentTypes.LORE).lines().get(0).getString().equals("Holds 45 experience points"), "the lore names the amount");
        ctx.assertTrue(bottle.get(DataComponentTypes.ITEM_NAME).getString().equals("Bottled Experience"), "the bottle has its own name");
        ctx.assertTrue(!ItemStack.areItemsAndComponentsEqual(bottle, new ItemStack(Items.EXPERIENCE_BOTTLE)), "it does not stack with plain bottles");
        ctx.assertTrue(ItemStack.areItemsAndComponentsEqual(bottle, Bottling.filledBottle(45)), "it stacks with other filled bottles");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void theLastGlassBottleBecomesTheFilledOneAndIsNotThrown(TestContext ctx) {
        // a game without the mod sends "use item" right after the click on the table
        ctx.setBlockState(TABLE, Blocks.ENCHANTING_TABLE);
        ServerPlayerEntity player = player(ctx, new ItemStack(Items.GLASS_BOTTLE), 60);
        ctx.assertTrue(sneakClick(ctx, player, Hand.MAIN_HAND) == ActionResult.SUCCESS, "the bottle is filled");
        ctx.assertTrue(Bottling.storedXp(player.getMainHandStack()) == 45, "the filled bottle is in the hand");
        ActionResult use = useItem(ctx, player, Hand.MAIN_HAND);
        ctx.assertTrue(!use.isAccepted(), "the item use behind the click is ignored: " + use);
        ctx.assertTrue(player.getMainHandStack().getCount() == 1 && Bottling.storedXp(player.getMainHandStack()) == 45, "the filled bottle is still in the hand");
        ctx.assertTrue(points(player) == 10, "10 points are left, got " + points(player));
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void notEnoughPointsChangesNothing(TestContext ctx) {
        ctx.setBlockState(TABLE, Blocks.ENCHANTING_TABLE);
        ServerPlayerEntity player = player(ctx, new ItemStack(Items.GLASS_BOTTLE, 2), 49);
        ctx.assertTrue(sneakClick(ctx, player, Hand.MAIN_HAND) != ActionResult.SUCCESS, "49 points are not enough");
        ctx.assertTrue(points(player) == 49, "no points are taken, has " + points(player));
        ctx.assertTrue(player.getMainHandStack().getCount() == 2, "no glass bottle is used");
        ctx.assertTrue(count(player, Items.EXPERIENCE_BOTTLE) == 0, "no bottle is filled");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void onlyASneakClickOnTheTableBottles(TestContext ctx) {
        ctx.setBlockState(TABLE, Blocks.ENCHANTING_TABLE);
        BlockPos crafting = new BlockPos(3, 1, 1);
        ctx.setBlockState(crafting, Blocks.CRAFTING_TABLE);
        ServerPlayerEntity player = player(ctx, new ItemStack(Items.GLASS_BOTTLE, 2), 300);
        player.setSneaking(false);
        click(ctx, player, Hand.MAIN_HAND, TABLE); // opens the table as usual
        player.setSneaking(true);
        click(ctx, player, Hand.MAIN_HAND, crafting);
        ctx.assertTrue(points(player) == 300, "no points are taken, has " + points(player));
        ctx.assertTrue(player.getMainHandStack().getCount() == 2, "no glass bottle is used");
        ctx.assertTrue(count(player, Items.EXPERIENCE_BOTTLE) == 0, "no bottle is filled");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void theOffHandBottlesWhenTheMainHandHoldsNoGlassBottle(TestContext ctx) {
        ctx.setBlockState(TABLE, Blocks.ENCHANTING_TABLE);
        ServerPlayerEntity player = player(ctx, new ItemStack(Items.STICK), 120);
        player.setStackInHand(Hand.OFF_HAND, new ItemStack(Items.GLASS_BOTTLE, 4));
        ctx.assertTrue(sneakClick(ctx, player, Hand.MAIN_HAND) != ActionResult.SUCCESS, "the stick does nothing");
        ctx.assertTrue(sneakClick(ctx, player, Hand.OFF_HAND) == ActionResult.SUCCESS, "the off hand's glass bottle is filled");
        ctx.assertTrue(points(player) == 70, "50 points are taken, left " + points(player));
        ctx.assertTrue(player.getOffHandStack().getCount() == 3, "one glass bottle of the off hand is used");
        ctx.assertTrue(filled(player, 45) == 1, "one filled bottle");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void oneClickFillsOneBottle(TestContext ctx) {
        // a game without the mod tries the off hand right after the main hand: that must not fill again
        ctx.setBlockState(TABLE, Blocks.ENCHANTING_TABLE);
        ServerPlayerEntity player = player(ctx, new ItemStack(Items.GLASS_BOTTLE), 500);
        player.setStackInHand(Hand.OFF_HAND, new ItemStack(Items.GLASS_BOTTLE, 4));
        ctx.assertTrue(sneakClick(ctx, player, Hand.MAIN_HAND) == ActionResult.SUCCESS, "the main hand fills");
        ctx.assertTrue(sneakClick(ctx, player, Hand.OFF_HAND) != ActionResult.SUCCESS, "the off hand of the same click does not");
        ctx.assertTrue(points(player) == 450, "50 points in total are taken, left " + points(player));
        ctx.assertTrue(player.getOffHandStack().getCount() == 4, "the off hand keeps its glass bottles");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void sneakClickingWithAFilledBottleNeverThrowsIt(TestContext ctx) {
        ctx.setBlockState(TABLE, Blocks.ENCHANTING_TABLE);
        ItemStack two = Bottling.filledBottle(45);
        two.setCount(2);
        ServerPlayerEntity player = player(ctx, two, 100);
        ctx.assertTrue(sneakClick(ctx, player, Hand.MAIN_HAND) != ActionResult.SUCCESS, "nothing to fill");
        ActionResult use = useItem(ctx, player, Hand.MAIN_HAND);
        ctx.assertTrue(!use.isAccepted(), "the bottle is not thrown: " + use);
        ctx.assertTrue(player.getMainHandStack().getCount() == 2, "both bottles are still there");
        ctx.assertTrue(points(player) == 100, "no points change");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void aThrowFromThePlayerCarriesTheStoredAmount(TestContext ctx) {
        // the real item use: ExperienceBottleItem.use copies the stack into the thrown entity
        ItemStack bottles = Bottling.filledBottle(45);
        bottles.setCount(3);
        ServerPlayerEntity player = player(ctx, bottles, 0);
        ctx.assertTrue(useItem(ctx, player, Hand.MAIN_HAND).isAccepted(), "the filled bottle is thrown like any other");
        ctx.assertTrue(player.getMainHandStack().getCount() == 2, "one bottle left the hand");
        List<ExperienceBottleEntity> thrown = ctx.getWorld().getEntitiesByClass(ExperienceBottleEntity.class, player.getBoundingBox().expand(4), e -> e.getOwner() == player);
        ctx.assertTrue(thrown.size() == 1, "one bottle flies, found " + thrown.size());
        ctx.assertTrue(Bottling.storedXp(thrown.get(0).getStack()) == 45, "the flying bottle holds 45 points");
        thrown.forEach(ExperienceBottleEntity::discard);
        ctx.complete();
    }

    // --- thrown bottles (each in its own batch, counting every orb of the world) ---

    @GameTest(templateName = EMPTY_STRUCTURE, batchId = "bottledlevels-filled")
    public void aFilledBottleReleasesExactlyItsAmount(TestContext ctx) {
        ServerWorld world = ctx.getWorld();
        clearOrbs(world);
        drop(ctx, new BlockPos(2, 1, 2), Bottling.filledBottle(45));
        ctx.addInstantFinalTask(() -> {
            ctx.assertTrue(bottlesInFlight(world) == 0, "the bottle is still flying");
            ctx.assertTrue(orbPoints(world) == 45, "the orbs hold 45 points, got " + orbPoints(world));
        });
    }

    @GameTest(templateName = EMPTY_STRUCTURE, batchId = "bottledlevels-plain")
    public void plainBottlesStayVanilla(TestContext ctx) {
        ServerWorld world = ctx.getWorld();
        clearOrbs(world);
        for (int x = 1; x <= 5; x++) drop(ctx, new BlockPos(x, 1, 2), new ItemStack(Items.EXPERIENCE_BOTTLE));
        ctx.addInstantFinalTask(() -> {
            ctx.assertTrue(bottlesInFlight(world) == 0, "bottles are still flying");
            int sum = orbPoints(world);
            // each plain bottle gives 3 + 0..4 + 0..4 points
            ctx.assertTrue(sum >= 15 && sum <= 55, "five plain bottles give 15 to 55 points, got " + sum);
        });
    }

    @GameTest(templateName = EMPTY_STRUCTURE, batchId = "bottledlevels-dispenser")
    public void aDispenserThrowsTheStoredAmount(TestContext ctx) {
        ServerWorld world = ctx.getWorld();
        clearOrbs(world);
        BlockPos floor = new BlockPos(2, 1, 2);
        BlockPos dispenser = new BlockPos(2, 4, 2);
        ctx.setBlockState(floor, Blocks.STONE);
        ctx.setBlockState(dispenser, Blocks.DISPENSER.getDefaultState().with(DispenserBlock.FACING, Direction.DOWN));
        DispenserBlockEntity inventory = ctx.getBlockEntity(dispenser);
        inventory.setStack(0, Bottling.filledBottle(45));
        ctx.setBlockState(dispenser.up(), Blocks.REDSTONE_BLOCK);
        ctx.addInstantFinalTask(() -> {
            ctx.assertTrue(inventory.getStack(0).isEmpty(), "the dispenser has not fired yet");
            ctx.assertTrue(bottlesInFlight(world) == 0, "the bottle is still flying");
            ctx.assertTrue(orbPoints(world) == 45, "the orbs hold 45 points, got " + orbPoints(world));
        });
    }

    @GameTest(templateName = EMPTY_STRUCTURE, batchId = "bottledlevels-fair", tickLimit = 200)
    public void bottlingAndCollectingNeverGainsPoints(TestContext ctx) {
        ServerWorld world = ctx.getWorld();
        clearOrbs(world);
        ctx.setBlockState(TABLE, Blocks.ENCHANTING_TABLE);
        int start = 500;
        ServerPlayerEntity player = player(ctx, new ItemStack(Items.GLASS_BOTTLE, 5), start);
        // five clicks, two ticks apart (holding the button repeats every four)
        for (int i = 0; i < 5; i++) {
            int n = i + 1;
            ctx.runAtTick(1 + 2L * i, () -> ctx.assertTrue(sneakClick(ctx, player, Hand.MAIN_HAND) == ActionResult.SUCCESS, "click " + n + " fills a bottle"));
        }
        AtomicBoolean thrown = new AtomicBoolean();
        ctx.runAtTick(12, () -> {
            ctx.assertTrue(points(player) == start - 5 * BottleRules.COST, "5 bottlings take 250 points, left " + points(player));
            ctx.assertTrue(filled(player, 45) == 5, "five filled bottles, found " + filled(player, 45));
            ctx.assertTrue(count(player, Items.GLASS_BOTTLE) == 0, "all glass bottles are used");
            int x = 1;
            for (ItemStack stack : allStacks(player)) {
                while (Bottling.storedXp(stack) > 0) drop(ctx, new BlockPos(x++, 1, 4), stack.split(1));
            }
            thrown.set(true);
        });
        ctx.addInstantFinalTask(() -> {
            ctx.assertTrue(thrown.get(), "the bottles are not thrown yet");
            ctx.assertTrue(bottlesInFlight(world) == 0, "bottles are still flying");
            ctx.assertTrue(orbPoints(world) == 5 * 45, "the orbs hold 225 points, got " + orbPoints(world));
            // pick every orb up the way a player touching it does
            for (ExperienceOrbEntity orb : List.copyOf(orbs(world))) {
                while (orb.isAlive()) {
                    player.experiencePickUpDelay = 0;
                    orb.onPlayerCollision(player);
                }
            }
            long end = points(player);
            ctx.assertTrue(end == start - 5 * BottleRules.loss(BottleRules.COST), "the player ends with 475 points, has " + end);
            ctx.assertTrue(end <= start, "no points are gained");
        });
    }
}
