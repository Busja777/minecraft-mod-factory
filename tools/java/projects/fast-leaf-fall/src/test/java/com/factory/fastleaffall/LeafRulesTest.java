package com.factory.fastleaffall;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class LeafRulesTest {
    private static final int MAX = LeafRules.VANILLA_MAX_DISTANCE;

    @Test
    void onlyLeavesWithoutATreeDecay() {
        assertTrue(LeafRules.decaysSoon(false, 7, MAX), "no log within six blocks");
        for (int d = 1; d < 7; d++) assertFalse(LeafRules.decaysSoon(false, d, MAX), "a log " + d + " blocks away");
    }

    @Test
    void placedLeavesNeverDecay() {
        for (int d = 1; d <= 7; d++) assertFalse(LeafRules.decaysSoon(true, d, MAX), "persistent at distance " + d);
    }

    @Test
    void theWaitIsAFewSeconds() {
        assertEquals(LeafRules.MIN_DELAY_TICKS, LeafRules.delay(0));
        int longest = LeafRules.delay(LeafRules.DELAY_SPREAD_TICKS - 1);
        assertEquals(LeafRules.MIN_DELAY_TICKS + LeafRules.DELAY_SPREAD_TICKS - 1, longest);
        assertTrue(LeafRules.MIN_DELAY_TICKS >= 5, "not instant: the crown falls apart visibly");
        assertTrue(longest <= 3 * 20, "at most three seconds");
        // rolls out of range still give a valid wait
        assertEquals(LeafRules.delay(5), LeafRules.delay(5 + LeafRules.DELAY_SPREAD_TICKS));
        assertTrue(LeafRules.delay(-1) >= LeafRules.MIN_DELAY_TICKS);
    }

    @Test
    void theWorkPerTickIsBounded() {
        assertTrue(LeafRules.DECAYS_PER_TICK > 0 && LeafRules.DECAYS_PER_TICK <= 128);
        assertTrue(LeafRules.MAX_QUEUED >= 4096, "room for the crowns of several big trees");
    }
}
