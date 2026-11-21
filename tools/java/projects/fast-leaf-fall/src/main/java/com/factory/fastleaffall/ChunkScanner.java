package com.factory.fastleaffall;

import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;

/**
 * The scan of loaded chunks for leaves that were already without a tree when their chunk loaded
 * (since 1.2), in one world. No Minecraft types, so it can be tested with plain JUnit. Server thread
 * only.
 *
 * <p>Each chunk is scanned once per load, in order of loading, and the work is spread over ticks:
 * {@link #scan} stops after a work budget (one unit per block read) or a number of finds and goes on
 * where it stopped in the next tick. A section whose palette holds no leaf that decays is skipped
 * without reading its blocks, which is the case for almost every section. A chunk whose blocks do
 * not tick yet (loaded at the edge of the view distance) waits and is looked at again later, so
 * nothing changes in chunks the game itself does not update.
 */
public final class ChunkScanner {
    /** Blocks in a 16×16×16 section; index = y << 8 | z << 4 | x. */
    public static final int BLOCKS_PER_SECTION = 4096;
    /** Work for looking a chunk up. */
    public static final int CHUNK_COST = 16;
    /** Work for checking a section's palette. */
    public static final int SECTION_COST = 16;

    /** {@link Source#open}: the chunk is not loaded any more; it is dropped. */
    public static final int NOT_LOADED = -1;
    /** {@link Source#open}: the chunk is loaded but its blocks do not tick yet; it waits. */
    public static final int NOT_READY = -2;

    /** The world's chunks as the scanner sees them. */
    public interface Source {
        /** Opens a chunk for the calls below: its number of sections, {@link #NOT_LOADED} or {@link #NOT_READY}. */
        int open(long chunk);

        /** Whether the section's palette holds a leaf that decays (false: the section is skipped). */
        boolean mayHold(int section);

        /** Whether the block at {@code index} of the section is a leaf that decays. */
        boolean isCandidate(int section, int index);
    }

    /** Takes a found leaf; false when there is no room (the scan stops and tries it again next tick). */
    public interface Sink {
        boolean accept(int section, int index);
    }

    private static final long NONE = Long.MIN_VALUE;

    private final LinkedHashSet<Long> pending = new LinkedHashSet<>();
    /** Chunks whose blocks do not tick yet, with the tick they are looked at again (in order of that tick). */
    private final LinkedHashMap<Long, Long> waiting = new LinkedHashMap<>();
    private final int capacity;
    private final int recheckTicks;
    private final int rechecksPerTick;
    private long now;

    private long current = NONE;
    private int section;
    private int index;
    private boolean sectionChecked;

    public ChunkScanner(int capacity, int recheckTicks, int rechecksPerTick) {
        this.capacity = capacity;
        this.recheckTicks = recheckTicks;
        this.rechecksPerTick = rechecksPerTick;
    }

    /**
     * A chunk was loaded: it gets scanned from the start. A chunk being scanned starts over (its
     * blocks may have changed); one already waiting keeps its place.
     *
     * @return false when it was already in line or there is no room
     */
    public boolean add(long chunk) {
        if (chunk == current) {
            restart();
            return true;
        }
        if (pending.contains(chunk) || waiting.containsKey(chunk)) return false;
        if (size() >= capacity) return false;
        return pending.add(chunk);
    }

    /** A chunk was unloaded: it is not scanned (any more). */
    public void remove(long chunk) {
        if (chunk == current) current = NONE;
        pending.remove(chunk);
        waiting.remove(chunk);
    }

    /** Advances the clock by one tick. */
    public void tick() {
        now++;
    }

    /** Whether {@link #scan} has something to do in this tick. */
    public boolean hasWork() {
        if (current != NONE || !pending.isEmpty()) return true;
        return !waiting.isEmpty() && waiting.values().iterator().next() <= now;
    }

    /**
     * Scans on where the last call stopped, until {@code work} units are used up, {@code finds}
     * leaves were found, the sink has no room, or every chunk in line is done.
     *
     * @return how many leaves were handed to the sink
     */
    public int scan(Source source, int work, int finds, Sink sink) {
        // chunks whose time has come go back in line, a few per tick
        Iterator<Map.Entry<Long, Long>> back = waiting.entrySet().iterator();
        for (int moved = 0; moved < rechecksPerTick && back.hasNext(); moved++) {
            Map.Entry<Long, Long> next = back.next();
            if (next.getValue() > now) break;
            back.remove();
            pending.add(next.getKey());
        }

        int found = 0;
        int sections = 0;
        boolean opened = false;
        while (work > 0 && found < finds) {
            if (current == NONE) {
                if (pending.isEmpty()) break;
                Iterator<Long> first = pending.iterator();
                current = first.next();
                first.remove();
                restart();
                opened = false;
            }
            if (!opened) {
                work -= CHUNK_COST;
                sections = source.open(current);
                if (sections == NOT_LOADED) {
                    current = NONE;
                    continue;
                }
                if (sections == NOT_READY) {
                    waiting.put(current, now + recheckTicks);
                    current = NONE;
                    continue;
                }
                opened = true;
            }
            if (section >= sections) {
                current = NONE; // done with this chunk
                continue;
            }
            if (!sectionChecked) {
                work -= SECTION_COST;
                if (!source.mayHold(section)) {
                    section++;
                    continue;
                }
                sectionChecked = true;
            }
            while (index < BLOCKS_PER_SECTION && work > 0 && found < finds) {
                work--;
                if (source.isCandidate(section, index)) {
                    if (!sink.accept(section, index)) return found; // no room: this block again next tick
                    found++;
                }
                index++;
            }
            if (index >= BLOCKS_PER_SECTION) {
                section++;
                index = 0;
                sectionChecked = false;
            }
        }
        return found;
    }

    /** Whether a chunk is in line, being scanned or waiting. */
    public boolean contains(long chunk) {
        return chunk == current || pending.contains(chunk) || waiting.containsKey(chunk);
    }

    /** Chunks in line, being scanned or waiting. */
    public int size() {
        return pending.size() + waiting.size() + (current == NONE ? 0 : 1);
    }

    public int waitingCount() {
        return waiting.size();
    }

    public void clear() {
        pending.clear();
        waiting.clear();
        current = NONE;
    }

    private void restart() {
        section = 0;
        index = 0;
        sectionChecked = false;
    }
}
