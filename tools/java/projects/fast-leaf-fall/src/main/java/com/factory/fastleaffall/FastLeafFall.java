package com.factory.fastleaffall;

import java.util.IdentityHashMap;
import java.util.Map;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerChunkEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerWorldEvents;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.block.BlockState;
import net.minecraft.block.LeavesBlock;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.ChunkPos;
import net.minecraft.util.math.ChunkSectionPos;
import net.minecraft.world.chunk.ChunkSection;
import net.minecraft.world.chunk.WorldChunk;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Entry point: leaves that lost their tree decay within a few seconds.
 *
 * <p>The mixin on {@code LeavesBlock#scheduledTick} reports every leaf whose log distance vanilla
 * just recalculated; those that vanilla now marks for decay (not persistent, distance 7) go into a
 * per-world queue with a short random wait. At the end of each world tick at most
 * {@code leavesPerTick} of them get the decay vanilla would give them on a random tick
 * (the block's own random tick: same drops, same removal), after checking again that they still
 * qualify. Everything runs on the server.
 *
 * <p>Since 1.1 the wait and the number of leaves per tick come from config/fastleaffall.json (see
 * {@link LeafConfig}), read on every server start; its defaults are the fixed values of 1.0.
 *
 * <p>Since 1.2 leaves that were already without a tree when their chunk loaded (cut or generated
 * before the mod was installed; vanilla only lets them decay on a random tick) are caught too: every
 * loaded chunk is scanned once per load by a {@link ChunkScanner}, spread over ticks with a small
 * work budget, and the leaves it finds go into the same queue with the same wait. Only chunks whose
 * blocks tick are scanned and decayed, so nothing changes at the edge of the loaded area.
 */
public final class FastLeafFall implements ModInitializer {
    public static final String MOD_ID = "fastleaffall";
    public static final Logger LOG = LoggerFactory.getLogger("Fast Leaf Fall");

    private static volatile LeafConfig config = LeafConfig.defaults();

    /** One queue per loaded world (server thread only). */
    private static final Map<ServerWorld, DecayQueue> QUEUES = new IdentityHashMap<>();

    /** One scan of loaded chunks per world (server thread only). */
    private static final Map<ServerWorld, ChunkScanner> SCANNERS = new IdentityHashMap<>();

    /** Reads the chunks of one world for the scanner; bound for one call of {@link ChunkScanner#scan} at a time. */
    private static final OldLeaves OLD_LEAVES = new OldLeaves();

    @Override
    public void onInitialize() {
        ServerLifecycleEvents.SERVER_STARTING.register(server -> {
            config = LeafConfig.load(FabricLoader.getInstance().getConfigDir(), LOG::warn);
            LOG.info("Leaves decay after {} to {} ticks, at most {} per world and tick; leaves of loaded chunks are {}",
                config.minDelayTicks(), config.maxDelayTicks(), config.leavesPerTick(), config.catchOldLeaves() ? "caught too" : "left to vanilla");
        });
        ServerChunkEvents.CHUNK_LOAD.register(FastLeafFall::onChunkLoad);
        ServerChunkEvents.CHUNK_UNLOAD.register((world, chunk) -> {
            ChunkScanner scanner = SCANNERS.get(world);
            if (scanner != null) scanner.remove(chunk.getPos().toLong());
        });
        ServerTickEvents.END_WORLD_TICK.register(FastLeafFall::tick);
        ServerWorldEvents.UNLOAD.register((server, world) -> {
            QUEUES.remove(world);
            SCANNERS.remove(world);
        });
        ServerLifecycleEvents.SERVER_STOPPED.register(server -> {
            QUEUES.clear();
            SCANNERS.clear();
        });
    }

    /**
     * Fabric's ServerChunkEvents.CHUNK_LOAD (also called by the game tests): the chunk gets scanned
     * for leaves that are already without a tree, starting in the next world tick.
     */
    public static void onChunkLoad(ServerWorld world, WorldChunk chunk) {
        if (!config.catchOldLeaves()) return;
        long pos = chunk.getPos().toLong();
        if (!world.getServer().isOnThread()) {
            world.getServer().execute(() -> queueScan(world, pos));
            return;
        }
        queueScan(world, pos);
    }

    private static void queueScan(ServerWorld world, long chunk) {
        SCANNERS.computeIfAbsent(world, w -> new ChunkScanner(LeafRules.MAX_SCAN_CHUNKS, LeafRules.RECHECK_TICKS, LeafRules.RECHECKS_PER_TICK))
            .add(chunk);
    }

    /** Called by the mixin after vanilla set a leaf's new distance at {@code pos}. */
    public static void onDistanceUpdated(ServerWorld world, BlockPos pos) {
        if (!decaysSoon(world.getBlockState(pos))) return;
        QUEUES.computeIfAbsent(world, w -> new DecayQueue(LeafRules.MAX_QUEUED))
            .add(pos.asLong(), config.delay(world.getRandom().nextInt(config.delaySpread())));
    }

    /** The settings in use (the config file sets them on server start). */
    public static LeafConfig config() {
        return config;
    }

    /** For the game tests: other settings than the config file's. */
    public static void setConfig(LeafConfig settings) {
        config = settings;
    }

    /** For the game tests: whether a position is waiting to decay. */
    public static boolean isQueued(ServerWorld world, BlockPos pos) {
        DecayQueue queue = QUEUES.get(world);
        return queue != null && queue.contains(pos.asLong());
    }

    /** For the game tests: whether a chunk still waits for (or is in) its scan. */
    public static boolean isScanPending(ServerWorld world, ChunkPos pos) {
        ChunkScanner scanner = SCANNERS.get(world);
        return scanner != null && scanner.contains(pos.toLong());
    }

    /**
     * Whether the blocks of a chunk tick: vanilla's own condition for scheduled block ticks
     * (ServerWorld#isTickingFutureReady), which holds only when the chunk and its neighbours are
     * fully loaded, so a decaying leaf never makes the game load a chunk.
     */
    private static boolean blocksTick(ServerWorld world, long chunk) {
        return world.getChunkManager().isChunkLoaded(ChunkPos.getPackedX(chunk), ChunkPos.getPackedZ(chunk))
            && world.getChunkManager().isTickingFutureReady(chunk);
    }

    static boolean decaysSoon(BlockState state) {
        return state.getBlock() instanceof LeavesBlock
            && LeafRules.decaysSoon(state.get(LeavesBlock.PERSISTENT), state.get(LeavesBlock.DISTANCE), LeavesBlock.MAX_DISTANCE);
    }

    private static void tick(ServerWorld world) {
        ChunkScanner scanner = SCANNERS.get(world);
        if (scanner != null) {
            scanner.tick();
            if (scanner.hasWork()) {
                DecayQueue target = QUEUES.computeIfAbsent(world, w -> new DecayQueue(LeafRules.MAX_QUEUED));
                OLD_LEAVES.bind(world, target);
                try {
                    scanner.scan(OLD_LEAVES, LeafRules.SCAN_WORK_PER_TICK, config.leavesPerTick(), OLD_LEAVES);
                } finally {
                    OLD_LEAVES.release();
                }
            }
        }
        DecayQueue queue = QUEUES.get(world);
        if (queue == null) return;
        queue.tick();
        if (queue.isEmpty()) return;
        queue.drain(config.leavesPerTick(), packed -> decay(world, BlockPos.fromLong(packed)));
    }

    private static void decay(ServerWorld world, BlockPos pos) {
        // An unloaded leaf, or one at the edge of the loaded area whose blocks do not tick, keeps
        // vanilla's slow decay (its removal would update neighbours in chunks that are not loaded).
        if (!blocksTick(world, ChunkPos.toLong(pos))) return;
        BlockState state = world.getBlockState(pos);
        // A log placed since, a player who swapped the block, a leaf that found another tree: leave it.
        if (!decaysSoon(state)) return;
        // Vanilla's own decay: LeavesBlock.randomTick drops the loot (saplings, sticks, apples) and removes the block.
        state.randomTick(world, pos, world.getRandom());
    }

    /**
     * The world's loaded chunks as {@link ChunkScanner} reads them, and the sink that queues the
     * leaves it finds with the usual random wait.
     */
    private static final class OldLeaves implements ChunkScanner.Source, ChunkScanner.Sink {
        private ServerWorld world;
        private DecayQueue queue;
        private WorldChunk chunk;
        private ChunkSection[] sections;

        void bind(ServerWorld world, DecayQueue queue) {
            this.world = world;
            this.queue = queue;
        }

        void release() {
            world = null;
            queue = null;
            chunk = null;
            sections = null;
        }

        @Override
        public int open(long pos) {
            chunk = null;
            sections = null;
            // never loads a chunk: null when it is not (fully) loaded any more
            WorldChunk loaded = world.getChunkManager().getWorldChunk(ChunkPos.getPackedX(pos), ChunkPos.getPackedZ(pos));
            if (loaded == null) return ChunkScanner.NOT_LOADED;
            if (!blocksTick(world, pos)) return ChunkScanner.NOT_READY;
            chunk = loaded;
            sections = loaded.getSectionArray();
            return sections.length;
        }

        @Override
        public boolean mayHold(int section) {
            ChunkSection s = sections[section];
            // only the palette: a section without a decaying leaf state is skipped without reading its blocks
            return !s.isEmpty() && s.hasAny(FastLeafFall::decaysSoon);
        }

        @Override
        public boolean isCandidate(int section, int index) {
            return decaysSoon(sections[section].getBlockState(index & 15, index >> 8, (index >> 4) & 15));
        }

        @Override
        public boolean accept(int section, int index) {
            if (queue.isFull()) return false;
            BlockPos pos = new BlockPos(
                chunk.getPos().getStartX() + (index & 15),
                ChunkSectionPos.getBlockCoord(chunk.sectionIndexToCoord(section)) + (index >> 8),
                chunk.getPos().getStartZ() + ((index >> 4) & 15));
            queue.add(pos.asLong(), config.delay(world.getRandom().nextInt(config.delaySpread())));
            return true;
        }
    }
}
