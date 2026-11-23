package com.factory.bottledlevels;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.factory.bottledlevels.XpMath.Xp;
import org.junit.jupiter.api.Test;

class XpMathTest {
    @Test
    void pointsForTheNextLevelFollowTheThreeStepsOf1211() {
        assertEquals(7, XpMath.pointsForNextLevel(0));
        assertEquals(9, XpMath.pointsForNextLevel(1));
        assertEquals(35, XpMath.pointsForNextLevel(14));
        assertEquals(37, XpMath.pointsForNextLevel(15));
        assertEquals(107, XpMath.pointsForNextLevel(29));
        assertEquals(112, XpMath.pointsForNextLevel(30));
        assertEquals(121, XpMath.pointsForNextLevel(31));
    }

    @Test
    void pointsAtALevelAreTheSumOfAllStepsBelowIt() {
        long sum = 0;
        for (int level = 0; level <= 1000; level++) {
            assertEquals(sum, XpMath.pointsAtLevel(level), "level " + level);
            sum += XpMath.pointsForNextLevel(level);
        }
    }

    @Test
    void knownLevelTotals() {
        assertEquals(0, XpMath.pointsAtLevel(0));
        assertEquals(55, XpMath.pointsAtLevel(5));
        assertEquals(160, XpMath.pointsAtLevel(10));
        assertEquals(352, XpMath.pointsAtLevel(16));
        assertEquals(1395, XpMath.pointsAtLevel(30));
        assertEquals(1628, XpMath.pointsAtLevel(32));
        assertEquals(0, XpMath.pointsAtLevel(-3), "a negative level counts as 0");
    }

    @Test
    void theBarIsRoundedToWholePoints() {
        assertEquals(0, XpMath.pointsInLevel(0, 0f));
        assertEquals(5, XpMath.pointsInLevel(0, 5f / 7f));
        // float arithmetic can leave the bar a hair below a whole point
        assertEquals(7, XpMath.pointsInLevel(29, 0.0654205f));
        assertEquals(7, XpMath.pointsInLevel(29, 0.0654206f));
        assertEquals(0, XpMath.pointsInLevel(3, -0.2f), "never below 0");
        assertEquals(13, XpMath.pointsInLevel(3, 1.5f), "never more than the level's step");
        assertEquals(1395 + 56, XpMath.totalPoints(30, 0.5f));
    }

    @Test
    void removingStaysInTheLevelWhenTheBarIsFullEnough() {
        assertEquals(new Xp(30, 10), XpMath.remove(30, 60, 50));
        assertEquals(new Xp(30, 0), XpMath.remove(30, 50, 50));
    }

    @Test
    void removingGoesDownAsManyLevelsAsNeeded() {
        // level 30 with an empty bar has 1395 points; 1345 is level 29 (1288) plus 57
        assertEquals(new Xp(29, 57), XpMath.remove(30, 0, 50));
        // level 5 has 55 points; 5 are left, which is level 0 with 5 points
        assertEquals(new Xp(0, 5), XpMath.remove(5, 0, 50));
        // level 4 (40) plus 10 = 50: everything goes
        assertEquals(new Xp(0, 0), XpMath.remove(4, 10, 50));
    }

    @Test
    void removingAlwaysTakesExactlyTheCost() {
        for (int level = 0; level <= 120; level++) {
            int step = XpMath.pointsForNextLevel(level);
            for (int points = 0; points < step; points++) {
                long before = XpMath.pointsAtLevel(level) + points;
                Xp after = XpMath.remove(level, points, BottleRules.COST);
                if (before < BottleRules.COST) {
                    assertNull(after, "level " + level + " + " + points + " has too few points");
                    continue;
                }
                assertEquals(before - BottleRules.COST, XpMath.pointsAtLevel(after.level()) + after.points(), "level " + level + " + " + points);
                assertEquals(after, XpMath.fromTotal(before - BottleRules.COST));
            }
        }
    }

    @Test
    void notEnoughPointsTakesNothing() {
        assertNull(XpMath.remove(0, 0, 50));
        assertNull(XpMath.remove(4, 9, 50), "level 4 (40) plus 9 = 49 points");
        assertThrows(IllegalArgumentException.class, () -> XpMath.remove(10, 0, -1));
    }

    @Test
    void aFullBarIsTheNextLevel() {
        // a rounded-up bar at 7 of 7 points: after removing 0 the player is at level 1
        assertEquals(new Xp(1, 0), XpMath.remove(0, 7, 0));
    }

    @Test
    void fromTotalFindsTheLevel() {
        assertEquals(new Xp(0, 0), XpMath.fromTotal(0));
        assertEquals(new Xp(11, 13), XpMath.fromTotal(200));
        assertEquals(new Xp(30, 0), XpMath.fromTotal(1395));
        assertEquals(new Xp(29, 106), XpMath.fromTotal(1394));
    }
}
