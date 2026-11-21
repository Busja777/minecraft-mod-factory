package com.factory.fastleaffall;

/**
 * The rules of Fast Leaf Fall without any Minecraft types, so they can be tested with plain JUnit.
 */
public final class LeafRules {
    /** Vanilla's distance mark for "no log within reach" (LeavesBlock.MAX_DISTANCE in 1.21.1). */
    public static final int VANILLA_MAX_DISTANCE = 7;

    /** Shortest wait between a leaf losing its tree and its decay: half a second (the default of minDelayTicks). */
    public static final int MIN_DELAY_TICKS = 10;

    /** The wait is spread over this many ticks (here up to two seconds more), so a crown falls apart leaf by leaf. */
    public static final int DELAY_SPREAD_TICKS = 40;

    /** At most this many leaves decay per world and tick; the rest wait for the next tick (the default of leavesPerTick). */
    public static final int DECAYS_PER_TICK = 64;

    /** At most this many leaves wait per world; beyond that vanilla's slow decay takes over for the rest. */
    public static final int MAX_QUEUED = 32768;

    /**
     * Work of the scan of loaded chunks (since 1.2) per world and tick: one unit per block read, so
     * at most one 16×16×16 section of blocks; looking a chunk up or a section's palette costs
     * {@link ChunkScanner#CHUNK_COST} or {@link ChunkScanner#SECTION_COST}.
     */
    public static final int SCAN_WORK_PER_TICK = 4096;

    /** At most this many loaded chunks wait for their scan per world; beyond that new ones are not scanned. */
    public static final int MAX_SCAN_CHUNKS = 65536;

    /** A loaded chunk whose blocks do not tick yet is looked at again after this many ticks (five seconds). */
    public static final int RECHECK_TICKS = 100;

    /** At most this many chunks per world and tick come back from waiting for their blocks to tick. */
    public static final int RECHECKS_PER_TICK = 32;

    private LeafRules() {}

    /**
     * Whether a leaf decays soon: exactly vanilla's own decay rule. Leaves placed by players are
     * persistent and never decay; other leaves decay once no log is within six blocks (distance 7).
     */
    public static boolean decaysSoon(boolean persistent, int distance, int maxDistance) {
        return !persistent && distance >= maxDistance;
    }

    /** The wait in ticks for a random roll in [0, DELAY_SPREAD_TICKS), with the default settings (see {@link LeafConfig#delay}). */
    public static int delay(int roll) {
        return MIN_DELAY_TICKS + Math.floorMod(roll, DELAY_SPREAD_TICKS);
    }
}
