package com.factory.fastleaffall;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class DecayQueueTest {
    private static List<Long> drain(DecayQueue queue, int budget) {
        List<Long> out = new ArrayList<>();
        assertEquals(queue.drain(budget, out::add), out.size());
        return out;
    }

    private static void ticks(DecayQueue queue, int n) {
        for (int i = 0; i < n; i++) queue.tick();
    }

    @Test
    void nothingDecaysBeforeItsTime() {
        DecayQueue queue = new DecayQueue(100);
        assertTrue(queue.add(1L, 10));
        ticks(queue, 9);
        assertEquals(List.of(), drain(queue, 64));
        queue.tick();
        assertEquals(List.of(1L), drain(queue, 64));
        assertTrue(queue.isEmpty());
        assertFalse(queue.contains(1L));
    }

    @Test
    void earliestFirstThenInOrderOfArrival() {
        DecayQueue queue = new DecayQueue(100);
        queue.add(3L, 20);
        queue.add(1L, 10);
        queue.add(2L, 10);
        ticks(queue, 20);
        assertEquals(List.of(1L, 2L, 3L), drain(queue, 64));
    }

    @Test
    void aPositionWaitsOnlyOnce() {
        DecayQueue queue = new DecayQueue(100);
        assertTrue(queue.add(7L, 10));
        assertFalse(queue.add(7L, 2), "already waiting");
        assertEquals(1, queue.size());
        ticks(queue, 10);
        assertEquals(List.of(7L), drain(queue, 64));
        assertTrue(queue.add(7L, 1), "can wait again once handled");
    }

    @Test
    void theBudgetLimitsEachTick() {
        DecayQueue queue = new DecayQueue(1000);
        for (long p = 0; p < 150; p++) queue.add(p, 0);
        assertEquals(64, drain(queue, 64).size());
        assertEquals(64, drain(queue, 64).size());
        assertEquals(22, drain(queue, 64).size());
        assertTrue(queue.isEmpty());
    }

    @Test
    void aFullQueueTurnsNewLeavesAway() {
        DecayQueue queue = new DecayQueue(3);
        assertTrue(queue.add(1L, 0));
        assertTrue(queue.add(2L, 0));
        assertTrue(queue.add(3L, 0));
        assertTrue(queue.isFull());
        assertFalse(queue.add(4L, 0), "full: vanilla's slow decay handles this one");
        drain(queue, 1);
        assertFalse(queue.isFull());
        assertTrue(queue.add(4L, 0), "room again");
    }

    @Test
    void negativeWaitsAreDueAtOnceAndClearEmpties() {
        DecayQueue queue = new DecayQueue(10);
        queue.add(5L, -3);
        assertEquals(List.of(5L), drain(queue, 64));
        queue.add(6L, 5);
        queue.clear();
        assertTrue(queue.isEmpty());
        assertFalse(queue.contains(6L));
        ticks(queue, 10);
        assertEquals(List.of(), drain(queue, 64));
    }
}
