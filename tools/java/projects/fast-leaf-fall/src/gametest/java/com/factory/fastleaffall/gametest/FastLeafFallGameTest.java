package com.factory.fastleaffall.gametest;

import com.factory.fastleaffall.FastLeafFall;
import com.factory.fastleaffall.LeafConfig;
import java.util.ArrayList;
import java.util.List;
import java.util.function.BooleanSupplier;
import net.fabricmc.fabric.api.gametest.v1.FabricGameTest;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.block.LeavesBlock;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.test.GameTest;
import net.minecraft.test.TestContext;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.ChunkPos;
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

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void theDefaultsAreThoseOf10(TestContext ctx) {
        ctx.assertTrue(FastLeafFall.config().equals(LeafConfig.defaults()), "the game test server runs with the defaults: " + FastLeafFall.config());
        ctx.assertTrue(LeafConfig.defaults().maxDelayTicks() + 20 <= SECONDS * 20, "the longest default wait fits into the test time");
        ctx.complete();
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
    // --- V1.2: leaves that were already without a tree when their chunk loaded ---

    /** Ticks the scan may take to reach a chunk (it works through every chunk loaded before, in order). */
    private static final int SCAN_TICKS = 200;

    /** Runs {@code then} in the first tick in which {@code check} holds; fails after {@code limit} ticks. */
    private static void when(TestContext ctx, int limit, String what, BooleanSupplier check, Runnable then) {
        if (check.getAsBoolean()) {
            then.run();
            return;
        }
        ctx.assertTrue(limit > 0, what);
        ctx.waitAndRun(1, () -> when(ctx, limit - 1, what, check, then));
    }

    /** What Fabric's chunk load event does for the chunk holding {@code at}: its scan is queued. */
    private static ChunkPos loadChunkOf(TestContext ctx, BlockPos at) {
        ServerWorld world = ctx.getWorld();
        BlockPos abs = ctx.getAbsolutePos(at);
        FastLeafFall.onChunkLoad(world, world.getWorldChunk(abs));
        return new ChunkPos(abs);
    }

    private static boolean isLeaf(TestContext ctx, BlockPos at) {
        return ctx.getBlockState(at).getBlock() instanceof LeavesBlock;
    }

    @GameTest(templateName = EMPTY_STRUCTURE, tickLimit = SCAN_TICKS + 100)
    public void anOldOrphanedLeafFallsWhenItsChunkLoads(TestContext ctx) {
        // a leaf from before the mod: no log anywhere, distance 7, not placed by a player. Nothing
        // around it changes, so vanilla never gives it a scheduled tick, only a rare random tick.
        ServerWorld world = ctx.getWorld();
        BlockPos leaf = new BlockPos(3, 3, 3);
        BlockPos abs = ctx.getAbsolutePos(leaf);
        ctx.setBlockState(leaf, leaves(7, false));
        ctx.assertTrue(!FastLeafFall.isQueued(world, abs), "placing the leaf does not queue it");
        ChunkPos chunk = loadChunkOf(ctx, leaf);
        ctx.assertTrue(FastLeafFall.isScanPending(world, chunk), "the loaded chunk waits for its scan");
        LeafConfig config = FastLeafFall.config();
        when(ctx, SCAN_TICKS, "the scan does not find the leaf within " + SCAN_TICKS + " ticks",
            () -> FastLeafFall.isQueued(world, abs) || !isLeaf(ctx, leaf), () -> {
                ctx.assertTrue(isLeaf(ctx, leaf), "the leaf is still there when the scan finds it");
                ctx.waitAndRun(config.minDelayTicks() / 2, () -> {
                    ctx.assertTrue(isLeaf(ctx, leaf), "the leaf waits like the leaves of a felled tree");
                    ctx.waitAndRun(config.maxDelayTicks() + 2 - config.minDelayTicks() / 2, () -> {
                        ctx.expectBlock(Blocks.AIR, leaf);
                        ctx.complete();
                    });
                });
            });
    }

    @GameTest(templateName = EMPTY_STRUCTURE, tickLimit = SCAN_TICKS + 100)
    public void theScanLeavesPlacedAndNearLeavesAlone(TestContext ctx) {
        // a player's leaf without a tree (persistent, distance 7) and a leaf vanilla still counts as
        // near a log (distance 6): neither decays in vanilla, so the scan leaves both alone
        ServerWorld world = ctx.getWorld();
        BlockPos placed = new BlockPos(1, 2, 1);
        BlockPos near = new BlockPos(5, 2, 5);
        ctx.setBlockState(placed, leaves(7, true));
        ctx.setBlockState(near, leaves(6, false));
        List<ChunkPos> chunks = List.of(loadChunkOf(ctx, placed), loadChunkOf(ctx, near));
        when(ctx, SCAN_TICKS, "the scan of the chunks does not end within " + SCAN_TICKS + " ticks",
            () -> chunks.stream().noneMatch(c -> FastLeafFall.isScanPending(world, c)), () -> {
                ctx.assertTrue(!FastLeafFall.isQueued(world, ctx.getAbsolutePos(placed)), "the placed leaf is not queued");
                ctx.assertTrue(!FastLeafFall.isQueued(world, ctx.getAbsolutePos(near)), "the leaf near a log is not queued");
                ctx.waitAndRun(FastLeafFall.config().maxDelayTicks() + 2, () -> {
                    ctx.assertTrue(isLeaf(ctx, placed) && ctx.getBlockState(placed).get(LeavesBlock.PERSISTENT), "the placed leaf stays");
                    ctx.assertTrue(isLeaf(ctx, near) && ctx.getBlockState(near).get(LeavesBlock.DISTANCE) == 6, "the leaf near a log stays");
                    ctx.complete();
                });
            });
    }
}
