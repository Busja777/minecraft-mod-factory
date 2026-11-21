package com.factory.fastleaffall;

import java.util.Comparator;
import java.util.HashSet;
import java.util.PriorityQueue;
import java.util.Set;
import java.util.function.LongConsumer;

/**
 * Leaves waiting to decay in one world, by packed block position (BlockPos.asLong), with its own
 * tick clock. No Minecraft types, so it can be tested with plain JUnit. Server thread only.
 */
public final class DecayQueue {
    private record Entry(long due, long order, long pos) {}

    private final PriorityQueue<Entry> queue = new PriorityQueue<>(Comparator.comparingLong(Entry::due).thenComparingLong(Entry::order));
    private final Set<Long> queued = new HashSet<>();
    private final int capacity;
    private long now;
    private long order;

    public DecayQueue(int capacity) {
        this.capacity = capacity;
    }

    /**
     * Queues a position to decay {@code delay} ticks from now.
     *
     * @return false when it is already waiting or the queue is full
     */
    public boolean add(long pos, int delay) {
        if (queued.size() >= capacity || !queued.add(pos)) return false;
        queue.add(new Entry(now + Math.max(0, delay), order++, pos));
        return true;
    }

    /** Advances the clock by one tick. */
    public void tick() {
        now++;
    }

    /**
     * Hands every position that is due to {@code action}, earliest first, but at most {@code budget};
     * the others stay for the next call.
     *
     * @return how many were handed over
     */
    public int drain(int budget, LongConsumer action) {
        int done = 0;
        while (done < budget && !queue.isEmpty() && queue.peek().due() <= now) {
            Entry next = queue.poll();
            queued.remove(next.pos());
            action.accept(next.pos());
            done++;
        }
        return done;
    }

    public boolean contains(long pos) {
        return queued.contains(pos);
    }

    public int size() {
        return queue.size();
    }

    public boolean isEmpty() {
        return queue.isEmpty();
    }

    public long now() {
        return now;
    }

    public void clear() {
        queue.clear();
        queued.clear();
    }
}
