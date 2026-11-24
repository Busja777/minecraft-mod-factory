package com.factory.doubledoorbuddy.gametest;

import net.fabricmc.fabric.api.gametest.v1.FabricGameTest;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.block.DoorBlock;
import net.minecraft.block.enums.DoorHinge;
import net.minecraft.block.enums.DoubleBlockHalf;
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
 * In-world tests on a headless game test server (gradlew :double-door-buddy:runGametest).
 * A survival server player right-clicks through the real server path
 * (ServerPlayerInteractionManager.interactBlock → BlockState#onUse → DoorBlock#onUse and the mixin).
 *
 * <p>Two doors stand side by side facing north: LEFT at x=1, RIGHT at x=2 (a LEFT door looks for its
 * partner on its clockwise side, east, +x). The floor is stone at y=1, the doors at y=2 and 3.
 */
public class DoubleDoorBuddyGameTest implements FabricGameTest {
    private static final BlockPos LEFT = new BlockPos(1, 2, 1);
    private static final BlockPos RIGHT = new BlockPos(2, 2, 1);

    @SuppressWarnings("removal") // the mock server player is deprecated in 1.21.1 but still the way to test the server path
    private static ServerPlayerEntity player(TestContext ctx, ItemStack mainHand) {
        ServerPlayerEntity player = ctx.createMockCreativeServerPlayerInWorld();
        player.changeGameMode(GameMode.SURVIVAL);
        player.setStackInHand(Hand.MAIN_HAND, mainHand);
        // in front of the doors, looking north at them
        Vec3d at = Vec3d.ofBottomCenter(ctx.getAbsolutePos(new BlockPos(1, 2, 4)));
        player.refreshPositionAndAngles(at.x, at.y, at.z, 180.0F, 0.0F);
        return player;
    }

    private static ServerPlayerEntity player(TestContext ctx) {
        return player(ctx, ItemStack.EMPTY);
    }

    /** Places both halves of a door on a stone floor, as vanilla's DoorBlock#onPlaced would. */
    private static void door(TestContext ctx, BlockPos lower, Block block, Direction facing, DoorHinge hinge, boolean open) {
        ctx.setBlockState(lower.down(), Blocks.STONE);
        BlockState state = block.getDefaultState().with(DoorBlock.FACING, facing).with(DoorBlock.HINGE, hinge).with(DoorBlock.OPEN, open);
        ctx.setBlockState(lower, state.with(DoorBlock.HALF, DoubleBlockHalf.LOWER));
        ctx.setBlockState(lower.up(), state.with(DoorBlock.HALF, DoubleBlockHalf.UPPER));
    }

    /** The usual double door: same block, facing north, mirrored hinges. */
    private static void pair(TestContext ctx, Block block) {
        door(ctx, LEFT, block, Direction.NORTH, DoorHinge.LEFT, false);
        door(ctx, RIGHT, block, Direction.NORTH, DoorHinge.RIGHT, false);
    }

    private static ActionResult click(TestContext ctx, ServerPlayerEntity player, BlockPos at) {
        BlockPos pos = ctx.getAbsolutePos(at);
        BlockHitResult hit = new BlockHitResult(Vec3d.ofCenter(pos), Direction.SOUTH, pos, false);
        return player.interactionManager.interactBlock(player, ctx.getWorld(), player.getMainHandStack(), Hand.MAIN_HAND, hit);
    }

    /** Whether both halves of the door at {@code lower} are open (fails when the halves disagree or the door is gone). */
    private static boolean open(TestContext ctx, BlockPos lower) {
        BlockState bottom = ctx.getBlockState(lower);
        BlockState top = ctx.getBlockState(lower.up());
        ctx.assertTrue(bottom.getBlock() instanceof DoorBlock && top.isOf(bottom.getBlock()), "the door at " + lower + " is gone: " + bottom + " / " + top);
        ctx.assertTrue(bottom.get(DoorBlock.OPEN) == top.get(DoorBlock.OPEN), "the halves of the door at " + lower + " disagree");
        return bottom.get(DoorBlock.OPEN);
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void bothDoorsOpenAndClose(TestContext ctx) {
        pair(ctx, Blocks.OAK_DOOR);
        ServerPlayerEntity player = player(ctx);
        ctx.assertTrue(click(ctx, player, LEFT).isAccepted(), "the click on the left door is handled");
        ctx.assertTrue(open(ctx, LEFT), "the clicked door opens");
        ctx.assertTrue(open(ctx, RIGHT), "its partner opens with it");
        click(ctx, player, LEFT);
        ctx.assertFalse(open(ctx, LEFT), "the clicked door closes");
        ctx.assertFalse(open(ctx, RIGHT), "its partner closes with it");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void theRightDoorAndTheUpperHalfWorkToo(TestContext ctx) {
        pair(ctx, Blocks.SPRUCE_DOOR);
        ServerPlayerEntity player = player(ctx);
        click(ctx, player, RIGHT.up());
        ctx.assertTrue(open(ctx, RIGHT), "the clicked right door opens");
        ctx.assertTrue(open(ctx, LEFT), "the left door opens with it");
        click(ctx, player, LEFT.up());
        ctx.assertFalse(open(ctx, LEFT) || open(ctx, RIGHT), "a click on the left door's upper half closes both");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void doorsPlacedByAPlayerPair(TestContext ctx) {
        // vanilla chooses the hinges itself: the second door next to the first gets the mirrored hinge
        ctx.setBlockState(LEFT.down(), Blocks.STONE);
        ctx.setBlockState(RIGHT.down(), Blocks.STONE);
        ServerPlayerEntity player = player(ctx, new ItemStack(Items.BIRCH_DOOR, 2));
        for (BlockPos at : new BlockPos[] {LEFT, RIGHT}) {
            BlockPos floor = ctx.getAbsolutePos(at.down());
            BlockHitResult hit = new BlockHitResult(Vec3d.ofCenter(floor).add(0, 0.5, 0), Direction.UP, floor, false);
            ctx.assertTrue(player.interactionManager.interactBlock(player, ctx.getWorld(), player.getMainHandStack(), Hand.MAIN_HAND, hit).isAccepted(),
                "the door at " + at + " is placed");
        }
        ctx.expectBlock(Blocks.BIRCH_DOOR, LEFT);
        ctx.expectBlock(Blocks.BIRCH_DOOR, RIGHT);
        ctx.assertTrue(ctx.getBlockState(LEFT).get(DoorBlock.FACING) == Direction.NORTH, "the doors face the way the player looks");
        ctx.assertTrue(ctx.getBlockState(LEFT).get(DoorBlock.HINGE) != ctx.getBlockState(RIGHT).get(DoorBlock.HINGE), "vanilla mirrored the hinges");
        player.setStackInHand(Hand.MAIN_HAND, ItemStack.EMPTY);
        click(ctx, player, RIGHT);
        ctx.assertTrue(open(ctx, LEFT) && open(ctx, RIGHT), "a pair placed by hand opens together");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void doorsWithTheSameHingeStayApart(TestContext ctx) {
        door(ctx, LEFT, Blocks.OAK_DOOR, Direction.NORTH, DoorHinge.LEFT, false);
        door(ctx, RIGHT, Blocks.OAK_DOOR, Direction.NORTH, DoorHinge.LEFT, false);
        ServerPlayerEntity player = player(ctx);
        click(ctx, player, LEFT);
        ctx.assertTrue(open(ctx, LEFT), "the clicked door opens");
        ctx.assertFalse(open(ctx, RIGHT), "a neighbour with the same hinge is no partner");
        click(ctx, player, RIGHT);
        ctx.assertTrue(open(ctx, RIGHT), "the other door opens on its own click");
        ctx.assertTrue(open(ctx, LEFT), "and leaves the first door as it is");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void doorsFacingOtherWaysStayApart(TestContext ctx) {
        door(ctx, LEFT, Blocks.OAK_DOOR, Direction.NORTH, DoorHinge.LEFT, false);
        door(ctx, RIGHT, Blocks.OAK_DOOR, Direction.SOUTH, DoorHinge.RIGHT, false);
        ServerPlayerEntity player = player(ctx);
        click(ctx, player, LEFT);
        ctx.assertTrue(open(ctx, LEFT), "the clicked door opens");
        ctx.assertFalse(open(ctx, RIGHT), "a door facing the other way is no partner");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void differentWoodStaysApart(TestContext ctx) {
        door(ctx, LEFT, Blocks.OAK_DOOR, Direction.NORTH, DoorHinge.LEFT, false);
        door(ctx, RIGHT, Blocks.DARK_OAK_DOOR, Direction.NORTH, DoorHinge.RIGHT, false);
        ServerPlayerEntity player = player(ctx);
        click(ctx, player, LEFT);
        ctx.assertTrue(open(ctx, LEFT), "the oak door opens");
        ctx.assertFalse(open(ctx, RIGHT), "the dark oak door next to it stays closed");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void sneakingOpensOnlyOneDoor(TestContext ctx) {
        pair(ctx, Blocks.OAK_DOOR);
        ServerPlayerEntity player = player(ctx);
        player.setSneaking(true);
        ctx.assertTrue(click(ctx, player, LEFT).isAccepted(), "vanilla opens a door for a sneaking player with an empty hand");
        ctx.assertTrue(open(ctx, LEFT), "the clicked door opens");
        ctx.assertFalse(open(ctx, RIGHT), "sneaking leaves the partner closed");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void thePartnerTakesTheStateInsteadOfToggling(TestContext ctx) {
        // a pair out of step: the right door is already open
        door(ctx, LEFT, Blocks.OAK_DOOR, Direction.NORTH, DoorHinge.LEFT, false);
        door(ctx, RIGHT, Blocks.OAK_DOOR, Direction.NORTH, DoorHinge.RIGHT, true);
        ServerPlayerEntity player = player(ctx);
        click(ctx, player, LEFT);
        ctx.assertTrue(open(ctx, LEFT), "the clicked door opens");
        ctx.assertTrue(open(ctx, RIGHT), "the open partner stays open instead of closing");
        click(ctx, player, LEFT);
        ctx.assertFalse(open(ctx, LEFT) || open(ctx, RIGHT), "from now on they move together");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void ironDoorsStayShut(TestContext ctx) {
        pair(ctx, Blocks.IRON_DOOR);
        ServerPlayerEntity player = player(ctx);
        ctx.assertFalse(click(ctx, player, LEFT).isAccepted(), "an iron door does not open by hand");
        ctx.assertFalse(open(ctx, LEFT) || open(ctx, RIGHT), "both iron doors stay shut");
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void redstoneMovesOnlyThePoweredDoor(TestContext ctx) {
        pair(ctx, Blocks.OAK_DOOR);
        // north of the left door only; it touches neither half of the right door
        ctx.setBlockState(LEFT.north(), Blocks.REDSTONE_BLOCK);
        ctx.assertTrue(open(ctx, LEFT), "redstone opens the powered door");
        ctx.assertFalse(open(ctx, RIGHT), "its partner does not follow redstone");
        ctx.setBlockState(LEFT.north(), Blocks.AIR);
        ctx.assertFalse(open(ctx, LEFT), "the door closes when the power is gone");
        ctx.assertFalse(open(ctx, RIGHT), "the partner is still closed");
        ctx.complete();
    }
}
