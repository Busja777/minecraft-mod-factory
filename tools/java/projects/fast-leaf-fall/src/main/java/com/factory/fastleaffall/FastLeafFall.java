package com.factory.fastleaffall;

import java.util.IdentityHashMap;
import java.util.Map;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerWorldEvents;
import net.minecraft.block.BlockState;
import net.minecraft.block.LeavesBlock;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.BlockPos;

/**
 * Entry point: leaves that lost their tree decay within a few seconds.
 *
 * <p>The mixin on {@code LeavesBlock#scheduledTick} reports every leaf whose log distance vanilla
 * just recalculated; those that vanilla now marks for decay (not persistent, distance 7) go into a
 * per-world queue with a short random wait. At the end of each world tick at most
 * {@link LeafRules#DECAYS_PER_TICK} of them get the decay vanilla would give them on a random tick
 * (the block's own random tick: same drops, same removal), after checking again that they still
 * qualify. Everything runs on the server.
 */
public final class FastLeafFall implements ModInitializer {
    public static final String MOD_ID = "fastleaffall";

    /** One queue per loaded world (server thread only). */
    private static final Map<ServerWorld, DecayQueue> QUEUES = new IdentityHashMap<>();

    @Override
    public void onInitialize() {
        ServerTickEvents.END_WORLD_TICK.register(FastLeafFall::tick);
        ServerWorldEvents.UNLOAD.register((server, world) -> QUEUES.remove(world));
        ServerLifecycleEvents.SERVER_STOPPED.register(server -> QUEUES.clear());
    }

    /** Called by the mixin after vanilla set a leaf's new distance at {@code pos}. */
    public static void onDistanceUpdated(ServerWorld world, BlockPos pos) {
        if (!decaysSoon(world.getBlockState(pos))) return;
        QUEUES.computeIfAbsent(world, w -> new DecayQueue(LeafRules.MAX_QUEUED))
            .add(pos.asLong(), LeafRules.delay(world.getRandom().nextInt(LeafRules.DELAY_SPREAD_TICKS)));
    }

    /** For the game tests: whether a position is waiting to decay. */
    public static boolean isQueued(ServerWorld world, BlockPos pos) {
        DecayQueue queue = QUEUES.get(world);
        return queue != null && queue.contains(pos.asLong());
    }

    private static boolean decaysSoon(BlockState state) {
        return state.getBlock() instanceof LeavesBlock
            && LeafRules.decaysSoon(state.get(LeavesBlock.PERSISTENT), state.get(LeavesBlock.DISTANCE), LeavesBlock.MAX_DISTANCE);
    }

    private static void tick(ServerWorld world) {
        DecayQueue queue = QUEUES.get(world);
        if (queue == null) return;
        queue.tick();
        if (queue.isEmpty()) return;
        queue.drain(LeafRules.DECAYS_PER_TICK, packed -> decay(world, BlockPos.fromLong(packed)));
    }

    private static void decay(ServerWorld world, BlockPos pos) {
        if (!world.isChunkLoaded(pos)) return; // an unloaded leaf keeps vanilla's slow decay
        BlockState state = world.getBlockState(pos);
        // A log placed since, a player who swapped the block, a leaf that found another tree: leave it.
        if (!decaysSoon(state)) return;
        // Vanilla's own decay: LeavesBlock.randomTick drops the loot (saplings, sticks, apples) and removes the block.
        state.randomTick(world, pos, world.getRandom());
    }
}
