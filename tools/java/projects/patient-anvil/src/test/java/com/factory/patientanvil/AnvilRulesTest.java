package com.factory.patientanvil;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class AnvilRulesTest {
    private static final int VANILLA = AnvilRules.VANILLA_LIMIT;

    @Test
    void vanillaRefusesFromFortyLevels() {
        assertFalse(AnvilRules.refuses(39, false, VANILLA));
        assertTrue(AnvilRules.refuses(40, false, VANILLA));
        assertFalse(AnvilRules.refuses(40, true, VANILLA), "creative never sees Too Expensive");
    }

    @Test
    void theModRefusesNoCost() {
        int limit = AnvilRules.refuseFrom(false);
        for (int cost : new int[] {1, 39, 40, 41, 64, 1000, 1_000_000}) assertFalse(AnvilRules.refuses(cost, false, limit), "cost " + cost);
    }

    @Test
    void enchantingAStackStaysRefused() {
        assertEquals(VANILLA, AnvilRules.refuseFrom(true));
        assertTrue(AnvilRules.refuses(40, false, AnvilRules.refuseFrom(true)));
    }

    @Test
    void youStillNeedTheLevels() {
        assertTrue(AnvilRules.canTake(45, 45, false));
        assertFalse(AnvilRules.canTake(44, 45, false), "one level short");
        assertTrue(AnvilRules.canTake(0, 45, true), "creative pays nothing");
        assertFalse(AnvilRules.canTake(100, 0, false), "nothing to pay means nothing to take");
    }

    @Test
    void theScreenShowsTheCostWhenThereIsAResult() {
        assertEquals(AnvilRules.NO_LIMIT, AnvilRules.labelFrom(true));
        assertEquals(VANILLA, AnvilRules.labelFrom(false), "an empty result slot keeps Too Expensive");
    }
}
