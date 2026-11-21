package com.factory.fastleaffall;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class ChunkScannerTest {
    private static final int N = ChunkScanner.BLOCKS_PER_SECTION;
    private static final int BIG = 1_000_000;

    /** A fake world: chunks with 4 sections each, leaves that decay at (chunk, section, index). */
    private static final class World implements ChunkScanner.Source {
        final Set<Long> loaded = new HashSet<>();
        final Set<Long> notTicking = new HashSet<>();
        final Map<Long, Set<Integer>> leaves = new HashMap<>(); // chunk → section * N + index
        int opens;
        int paletteChecks;
        int blockReads;
        long open = Long.MIN_VALUE;

        void leaf(long chunk, int section, int index) {
            loaded.add(chunk);
            leaves.computeIfAbsent(chunk, c -> new HashSet<>()).add(section * N + index);
        }

        @Override
        public int open(long chunk) {
            opens++;
            open = chunk;
            if (!loaded.contains(chunk)) return ChunkScanner.NOT_LOADED;
            if (notTicking.contains(chunk)) return ChunkScanner.NOT_READY;
            return 4;
        }

        @Override
        public boolean mayHold(int section) {
            paletteChecks++;
            return leaves.getOrDefault(open, Set.of()).stream().anyMatch(i -> i / N == section);
        }

        @Override
        public boolean isCandidate(int section, int index) {
            blockReads++;
            return leaves.getOrDefault(open, Set.of()).contains(section * N + index);
        }
    }

    /** Collects what the scanner finds as "chunk/section/index", with room for {@code room} leaves. */
    private static final class Found implements ChunkScanner.Sink {
        final List<String> got = new ArrayList<>();
        final World world;
        int room;

        Found(World world, int room) {
            this.world = world;
            this.room = room;
        }

        @Override
        public boolean accept(int section, int index) {
            if (room <= 0) return false;
            room--;
            got.add(world.open + "/" + section + "/" + index);
            return true;
        }
    }

    private static ChunkScanner scanner() {
        return new ChunkScanner(100, 10, 4);
    }

    @Test
    void findsEveryDecayingLeafOfALoadedChunk() {
        World world = new World();
        world.leaf(1L, 0, 5);
        world.leaf(1L, 2, 4095);
        world.leaf(1L, 2, 0);
        ChunkScanner s = scanner();
        assertTrue(s.add(1L));
        Found found = new Found(world, BIG);
        assertEquals(3, s.scan(world, BIG, BIG, found));
        assertEquals(List.of("1/0/5", "1/2/0", "1/2/4095"), found.got);
        assertFalse(s.contains(1L), "done with the chunk");
        assertFalse(s.hasWork());
    }

    @Test
    void sectionsWithoutADecayingLeafAreNotRead() {
        World world = new World();
        world.leaf(1L, 3, 7);
        ChunkScanner s = scanner();
        s.add(1L);
        s.scan(world, BIG, BIG, new Found(world, BIG));
        assertEquals(4, world.paletteChecks, "one palette check per section");
        assertEquals(N, world.blockReads, "only the section with the leaf is read");
        world.loaded.add(2L); // a chunk without any decaying leaf
        world.blockReads = 0;
        s.add(2L);
        s.scan(world, BIG, BIG, new Found(world, BIG));
        assertEquals(0, world.blockReads, "a chunk without decaying leaves costs four palette checks");
    }

    @Test
    void theWorkIsSpreadOverTicksAndGoesOnWhereItStopped() {
        World world = new World();
        for (int section = 0; section < 4; section++) world.leaf(1L, section, 4000);
        ChunkScanner s = scanner();
        s.add(1L);
        List<String> all = new ArrayList<>();
        int ticks = 0;
        while (s.hasWork()) {
            Found found = new Found(world, BIG);
            world.blockReads = 0;
            s.scan(world, 1000, BIG, found);
            assertTrue(world.blockReads <= 1000, "at most the budget of block reads per tick: " + world.blockReads);
            all.addAll(found.got);
            s.tick();
            assertTrue(++ticks < 100);
        }
        assertEquals(List.of("1/0/4000", "1/1/4000", "1/2/4000", "1/3/4000"), all);
        assertTrue(ticks >= 4 * N / 1000, "four sections of reads need at least " + 4 * N / 1000 + " ticks, took " + ticks);
    }

    @Test
    void atMostTheFindsBudgetPerTick() {
        World world = new World();
        for (int i = 0; i < 10; i++) world.leaf(1L, 0, i);
        ChunkScanner s = scanner();
        s.add(1L);
        Found first = new Found(world, BIG);
        assertEquals(4, s.scan(world, BIG, 4, first));
        Found second = new Found(world, BIG);
        assertEquals(4, s.scan(world, BIG, 4, second));
        Found third = new Found(world, BIG);
        assertEquals(2, s.scan(world, BIG, 4, third));
        assertEquals(List.of("1/0/0", "1/0/1", "1/0/2", "1/0/3"), first.got);
        assertEquals(List.of("1/0/8", "1/0/9"), third.got);
    }

    @Test
    void aFullQueueStopsTheScanAndTheLeafIsTriedAgain() {
        World world = new World();
        world.leaf(1L, 0, 1);
        world.leaf(1L, 0, 2);
        ChunkScanner s = scanner();
        s.add(1L);
        Found noRoom = new Found(world, 1);
        assertEquals(1, s.scan(world, BIG, BIG, noRoom));
        assertEquals(List.of("1/0/1"), noRoom.got);
        assertTrue(s.contains(1L), "the chunk is not done yet");
        Found room = new Found(world, BIG);
        assertEquals(1, s.scan(world, BIG, BIG, room));
        assertEquals(List.of("1/0/2"), room.got, "the leaf without room comes again");
    }

    @Test
    void chunksAreScannedInOrderOfLoadingAndOnlyOncePerLoad() {
        World world = new World();
        world.leaf(2L, 0, 0);
        world.leaf(1L, 0, 0);
        ChunkScanner s = scanner();
        assertTrue(s.add(2L));
        assertTrue(s.add(1L));
        assertFalse(s.add(2L), "already in line");
        Found found = new Found(world, BIG);
        s.scan(world, BIG, BIG, found);
        assertEquals(List.of("2/0/0", "1/0/0"), found.got);
        Found again = new Found(world, BIG);
        s.scan(world, BIG, BIG, again);
        assertEquals(List.of(), again.got, "no new scan without a new load");
        assertTrue(s.add(1L), "loaded again: scanned again");
    }

    @Test
    void anUnloadedChunkIsDropped() {
        World world = new World();
        world.leaf(1L, 0, 3000);
        world.leaf(2L, 0, 0);
        ChunkScanner s = scanner();
        s.add(1L);
        s.add(2L);
        s.scan(world, 100, BIG, new Found(world, BIG)); // stops inside chunk 1
        assertTrue(s.contains(1L));
        s.remove(1L);
        s.remove(2L);
        assertFalse(s.contains(1L));
        assertFalse(s.contains(2L));
        assertEquals(0, s.size());
        // a chunk that unloads without the event is dropped when it is opened
        s.add(3L);
        assertEquals(0, s.scan(world, BIG, BIG, new Found(world, BIG)));
        assertEquals(0, s.size());
    }

    @Test
    void aChunkWhoseBlocksDoNotTickWaitsAndComesBack() {
        World world = new World();
        world.leaf(1L, 0, 0);
        world.notTicking.add(1L);
        ChunkScanner s = new ChunkScanner(100, 10, 4);
        s.add(1L);
        assertEquals(0, s.scan(world, BIG, BIG, new Found(world, BIG)));
        assertEquals(1, s.waitingCount());
        assertTrue(s.contains(1L));
        assertFalse(s.hasWork(), "nothing to do before it is due");
        for (int i = 0; i < 9; i++) s.tick();
        assertFalse(s.hasWork());
        s.tick();
        assertTrue(s.hasWork(), "due after ten ticks");
        assertEquals(0, s.scan(world, BIG, BIG, new Found(world, BIG)), "still not ticking: waits again");
        assertEquals(1, s.waitingCount());
        world.notTicking.clear();
        for (int i = 0; i < 10; i++) s.tick();
        Found found = new Found(world, BIG);
        assertEquals(1, s.scan(world, BIG, BIG, found));
        assertEquals(List.of("1/0/0"), found.got);
        assertEquals(0, s.size());
    }

    @Test
    void onlyAFewWaitingChunksComeBackPerTick() {
        World world = new World();
        ChunkScanner s = new ChunkScanner(100, 1, 4);
        for (long c = 0; c < 20; c++) {
            world.loaded.add(c);
            world.notTicking.add(c);
            s.add(c);
        }
        s.scan(world, BIG, BIG, new Found(world, BIG));
        assertEquals(20, s.waitingCount());
        s.tick();
        world.opens = 0;
        s.scan(world, BIG, BIG, new Found(world, BIG));
        assertEquals(4, world.opens, "four chunks looked at again per tick");
    }

    @Test
    void aChunkLoadedAgainWhileItIsScannedStartsOver() {
        World world = new World();
        world.leaf(1L, 0, 10);
        world.leaf(1L, 0, 3000);
        ChunkScanner s = scanner();
        s.add(1L);
        Found first = new Found(world, BIG);
        s.scan(world, 2000, BIG, first);
        assertEquals(List.of("1/0/10"), first.got);
        assertTrue(s.add(1L));
        Found again = new Found(world, BIG);
        s.scan(world, BIG, BIG, again);
        assertEquals(List.of("1/0/10", "1/0/3000"), again.got, "from the start");
    }

    @Test
    void theNumberOfChunksInLineIsBounded() {
        ChunkScanner s = new ChunkScanner(3, 10, 4);
        assertTrue(s.add(1L));
        assertTrue(s.add(2L));
        assertTrue(s.add(3L));
        assertFalse(s.add(4L), "full: this chunk keeps vanilla's slow decay");
        s.remove(1L);
        assertTrue(s.add(4L));
    }

    @Test
    void theDefaultBudgetIsSmall() {
        assertTrue(LeafRules.SCAN_WORK_PER_TICK <= N, "at most one section of block reads per world and tick");
        assertTrue(LeafRules.RECHECKS_PER_TICK * ChunkScanner.CHUNK_COST < LeafRules.SCAN_WORK_PER_TICK);
        assertTrue(LeafRules.RECHECK_TICKS >= 20, "waiting chunks are not looked at every tick");
    }
}
