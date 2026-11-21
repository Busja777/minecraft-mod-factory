package com.factory.fastleaffall.gametest;

import java.util.ArrayList;
import java.util.List;
import net.fabricmc.fabric.api.gametest.v1.FabricGameTest;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.block.LeavesBlock;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.test.GameTest;
import net.minecraft.test.TestContext;
import net.minecraft.util.math.BlockPos;
import net.minecraft.world.GameMode;

/**
 * In-world tests on a headless game test server (gradlew :fast-leaf-fall:runGametest).
 *
 * <p>Without the mod a leaf that lost its tree waits for a random tick: with the default random
 * tick speed of 3 a single leaf has about a 7 % chance to get one within five seconds, so a crown
 * of nine leaves vanishing within {@link #SECONDS} seconds is the mod's doing.
 */
public class FastLeafFallGameTest implements FabricGameTest {
    private static final int SECONDS = 5;
    private static final int SETTLE = 5; // ticks for vanilla to settle the distances after building

    private static BlockState leaves(int distance, boolean persistent) {
        return Blocks.OAK_LEAVES.getDefaultState().with(LeavesBlock.DISTANCE, distance).with(LeavesBlock.PERSISTENT, persistent);
    }

    /** A three-log trunk at (x, 1..3, z) with a crown of nine leaves; returns the leaf positions. */
    private static List<BlockPos> tree(TestContext ctx, int x, int z, boolean persistent) {
        for (int y = 1; y <= 3; y++) ctx.setBlockState(new BlockPos(x, y, z), Blocks.OAK_LOG);
        List<BlockPos> crown = new ArrayList<>();
        BlockPos top = new BlockPos(x, 3, z);
        for (BlockPos side : List.of(top.north(), top.south(), top.east(), top.west())) {
            ctx.setBlockState(side, leaves(1, persistent));
            crown.add(side);
        }
        BlockPos cap = top.up();
        ctx.setBlockState(cap, leaves(1, persistent));
        crown.add(cap);
        for (BlockPos side : List.of(cap.north(), cap.south(), cap.east(), cap.west())) {
            ctx.setBlockState(side, leaves(2, persistent));
            crown.add(side);
        }
        return crown;
    }

    private static void fell(TestContext ctx, int x, int z) {
        for (int y = 3; y >= 1; y--) ctx.setBlockState(new BlockPos(x, y, z), Blocks.AIR);
    }

    private static long leafCount(TestContext ctx, List<BlockPos> at) {
        return at.stream().filter(p -> ctx.getBlockState(p).getBlock() instanceof LeavesBlock).count();
    }

    @GameTest(templateName = EMPTY_STRUCTURE, tickLimit = SETTLE + SECONDS * 20 + 20)
    public void aFelledTreeLosesItsLeavesWithinSeconds(TestContext ctx) {
        List<BlockPos> crown = tree(ctx, 3, 3, false);
        ctx.waitAndRun(SETTLE, () -> {
            ctx.assertTrue(leafCount(ctx, crown) == crown.size(), "the leaves of a standing tree stay");
            fell(ctx, 3, 3);
            ctx.waitAndRun(SECONDS * 20, () -> {
                ctx.assertTrue(leafCount(ctx, crown) == 0, (leafCount(ctx, crown)) + " leaves are left after " + SECONDS + " seconds");
                ctx.complete();
            });
        });
    }

    @GameTest(templateName = EMPTY_STRUCTURE, tickLimit = SETTLE + SECONDS * 20 + 20)
    public void aChoppedTreeLosesItsLeavesWithinSeconds(TestContext ctx) {
        List<BlockPos> crown = tree(ctx, 3, 3, false);
        @SuppressWarnings("removal") // the mock server player is deprecated in 1.21.1 but still the way to test the server path
        ServerPlayerEntity player = ctx.createMockCreativeServerPlayerInWorld();
        player.changeGameMode(GameMode.SURVIVAL);
        ctx.waitAndRun(SETTLE, () -> {
            for (int y = 3; y >= 1; y--) {
                ctx.assertTrue(player.interactionManager.tryBreakBlock(ctx.getAbsolutePos(new BlockPos(3, y, 3))), "the player breaks the log");
            }
            ctx.waitAndRun(SECONDS * 20, () -> {
                ctx.assertTrue(leafCount(ctx, crown) == 0, (leafCount(ctx, crown)) + " leaves are left after " + SECONDS + " seconds");
                ctx.complete();
            });
        });
    }

    @GameTest(templateName = EMPTY_STRUCTURE, tickLimit = SETTLE + SECONDS * 20 + 20)
    public void placedLeavesStay(TestContext ctx) {
        List<BlockPos> crown = tree(ctx, 3, 3, true);
        ctx.waitAndRun(SETTLE, () -> {
            fell(ctx, 3, 3);
            ctx.waitAndRun(SECONDS * 20, () -> {
                ctx.assertTrue(leafCount(ctx, crown) == crown.size(), "persistent leaves never decay");
                ctx.complete();
            });
        });
    }

    @GameTest(templateName = EMPTY_STRUCTURE, tickLimit = SETTLE + SECONDS * 20 + 20)
    public void leavesThatStillReachALogStay(TestContext ctx) {
        // two trunks at x = 1 and x = 5 joined by a bridge of leaves at y = 3; one leaf sits only on the first
        for (int y = 1; y <= 3; y++) {
            ctx.setBlockState(new BlockPos(1, y, 3), Blocks.OAK_LOG);
            ctx.setBlockState(new BlockPos(5, y, 3), Blocks.OAK_LOG);
        }
        List<BlockPos> bridge = List.of(new BlockPos(2, 3, 3), new BlockPos(3, 3, 3), new BlockPos(4, 3, 3));
        ctx.setBlockState(bridge.get(0), leaves(1, false));
        ctx.setBlockState(bridge.get(1), leaves(2, false));
        ctx.setBlockState(bridge.get(2), leaves(1, false));
        BlockPos alone = new BlockPos(1, 4, 3);
        ctx.setBlockState(alone, leaves(1, false));
        ctx.waitAndRun(SETTLE, () -> {
            fell(ctx, 1, 3);
            ctx.waitAndRun(SECONDS * 20, () -> {
                ctx.assertTrue(leafCount(ctx, bridge) == bridge.size(), "the bridge still reaches the second trunk and stays");
                ctx.assertTrue(ctx.getBlockState(bridge.get(0)).get(LeavesBlock.DISTANCE) == 3, "vanilla's distance is kept: "
                    + ctx.getBlockState(bridge.get(0)));
                ctx.expectBlock(Blocks.AIR, alone);
                ctx.complete();
            });
        });
    }
}
