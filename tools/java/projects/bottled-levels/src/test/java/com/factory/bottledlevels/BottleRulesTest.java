package com.factory.bottledlevels;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.factory.bottledlevels.BottleRules.Outcome;
import org.junit.jupiter.api.Test;

class BottleRulesTest {
    private static final String GLASS = BottleRules.GLASS_BOTTLE;
    private static final String XP_BOTTLE = BottleRules.EXPERIENCE_BOTTLE;
    private static final String TABLE = BottleRules.ENCHANTING_TABLE;
    private static final String AIR = "minecraft:air";

    @Test
    void aBottleHoldsFiftyPointsMinusTenPercent() {
        assertEquals(50, BottleRules.COST);
        assertEquals(5, BottleRules.loss(BottleRules.COST));
        assertEquals(45, BottleRules.stored(BottleRules.COST));
    }

    @Test
    void theLossIsRoundedUpAndNeverZero() {
        assertEquals(1, BottleRules.loss(1));
        assertEquals(1, BottleRules.loss(7));
        assertEquals(1, BottleRules.loss(10));
        assertEquals(2, BottleRules.loss(11));
        assertEquals(0, BottleRules.loss(0));
        for (int cost = 1; cost <= 10_000; cost++) {
            assertTrue(BottleRules.stored(cost) < cost, "a bottle never holds what it took: " + cost);
            assertTrue(BottleRules.loss(cost) * 100 >= cost * BottleRules.LOSS_PERCENT, "at least the full share is lost: " + cost);
        }
    }

    @Test
    void onlyPositiveStoredAmountsCount() {
        assertEquals(0, BottleRules.releasable(0), "a plain bottle");
        assertEquals(0, BottleRules.releasable(-5));
        assertEquals(45, BottleRules.releasable(45));
        assertEquals(BottleRules.MAX_STORED, BottleRules.releasable(Integer.MAX_VALUE), "edited bottles are cut");
    }

    @Test
    void sneakClickOnTheTableWithAGlassBottleFills() {
        assertEquals(Outcome.FILL, BottleRules.decide(true, TABLE, true, GLASS, AIR, true));
        assertEquals(Outcome.NOT_ENOUGH, BottleRules.decide(true, TABLE, true, GLASS, AIR, false));
    }

    @Test
    void withoutSneakingOrOnAnotherBlockNothingChanges() {
        assertEquals(Outcome.PASS, BottleRules.decide(false, TABLE, true, GLASS, AIR, true), "a plain click opens the table");
        assertEquals(Outcome.PASS, BottleRules.decide(true, "minecraft:crafting_table", true, GLASS, AIR, true));
        assertEquals(Outcome.PASS, BottleRules.decide(false, TABLE, true, XP_BOTTLE, AIR, true), "throwing without sneaking stays vanilla");
        assertEquals(Outcome.PASS, BottleRules.decide(true, TABLE, true, "minecraft:potion", AIR, true));
    }

    @Test
    void theOffHandFillsOnlyWhenTheMainHandHoldsNoGlassBottle() {
        assertEquals(Outcome.PASS, BottleRules.decide(true, TABLE, true, AIR, GLASS, true));
        assertEquals(Outcome.FILL, BottleRules.decide(true, TABLE, false, AIR, GLASS, true));
        assertEquals(Outcome.FILL, BottleRules.decide(true, TABLE, false, "minecraft:stick", GLASS, true));
        assertEquals(Outcome.PASS, BottleRules.decide(true, TABLE, false, GLASS, GLASS, true), "the main hand already filled");
    }

    @Test
    void aBottleInTheHandIsNeverThrownBySneakClickingTheTable() {
        assertEquals(Outcome.KEEP_BOTTLE, BottleRules.decide(true, TABLE, true, XP_BOTTLE, AIR, true));
        assertEquals(Outcome.KEEP_BOTTLE, BottleRules.decide(true, TABLE, true, XP_BOTTLE, GLASS, true));
        assertEquals(Outcome.KEEP_BOTTLE, BottleRules.decide(true, TABLE, false, AIR, XP_BOTTLE, false));
    }

    @Test
    void followUpsOnlyInTheSameOrNextTick() {
        assertFalse(BottleRules.isFollowUp(-1, 0));
        assertTrue(BottleRules.isFollowUp(100, 100));
        assertTrue(BottleRules.isFollowUp(100, 101));
        assertFalse(BottleRules.isFollowUp(100, 102));
        assertFalse(BottleRules.isFollowUp(100, 99), "time went back (another world)");
    }
}
