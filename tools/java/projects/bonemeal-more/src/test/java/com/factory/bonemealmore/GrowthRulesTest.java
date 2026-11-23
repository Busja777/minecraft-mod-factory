package com.factory.bonemealmore;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.factory.bonemealmore.GrowthRules.Column;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class GrowthRulesTest {
    /**
     * A column from bottom to top ('#' = the plant, anything else = another block) and the index
     * of the clicked block; returns the measured column and the offsets that were looked at.
     */
    private record Probe(Column column, List<Integer> looked) {}

    private static Probe probe(String blocks, int clicked) {
        List<Integer> looked = new ArrayList<>();
        Column column = GrowthRules.measure(dy -> {
            looked.add(dy);
            int i = clicked + dy;
            return i >= 0 && i < blocks.length() && blocks.charAt(i) == '#';
        });
        return new Probe(column, looked);
    }

    private static Column measure(String blocks, int clicked) {
        return probe(blocks, clicked).column();
    }

    @Test
    void measuresTheColumnThroughTheClickedBlock() {
        assertEquals(new Column(0, 0), measure("s#.", 1), "a single block");
        assertEquals(new Column(0, 1), measure("s##.", 1), "clicked the bottom of two");
        assertEquals(new Column(1, 0), measure("s##.", 2), "clicked the top of two");
        assertEquals(2, measure("s##.", 1).height());
    }

    @Test
    void anyBlockOfTheColumnFindsTheSameTop() {
        // the top is the clicked block plus 'above': for bottom and top of a two-block column it is index 2
        assertEquals(2, 1 + measure("s##.", 1).above());
        assertEquals(2, 2 + measure("s##.", 2).above());
    }

    @Test
    void countingStopsAtTheMaximumHeight() {
        assertEquals(3, measure("s###.", 1).height());
        assertEquals(3, measure("s#######", 4).height(), "a tall column built by hand counts as full");
        assertTrue(probe("s#######", 1).looked().size() <= 3, "a tall column is not walked through: " + probe("s#######", 1).looked());
    }

    @Test
    void otherBlocksEndTheColumn() {
        assertEquals(new Column(0, 0), measure("s#x#", 1), "a block in between splits it");
        assertEquals(new Column(0, 0), measure("#x#x", 2));
    }

    @Test
    void columnGrowsOnlyBelowThreeBlocks() {
        assertTrue(GrowthRules.columnCanGrow(new Column(0, 0), true, true, true), "height 1 grows to 2");
        assertTrue(GrowthRules.columnCanGrow(new Column(1, 0), true, true, true), "height 2 grows to 3");
        assertFalse(GrowthRules.columnCanGrow(new Column(1, 1), true, true, true), "height 3 is the natural maximum");
        assertFalse(GrowthRules.columnCanGrow(new Column(2, 0), true, true, true));
    }

    @Test
    void columnNeedsRoomAndAPlaceTheNewBlockCanStand() {
        Column one = new Column(0, 0);
        assertFalse(GrowthRules.columnCanGrow(one, true, false, true), "a block above the top");
        assertFalse(GrowthRules.columnCanGrow(one, true, true, false), "the new block could not stand there (cactus next to a block)");
        assertFalse(GrowthRules.columnCanGrow(one, false, true, true), "at the top of the world");
    }

    @Test
    void netherWartAdvancesOneAgePerUse() {
        assertEquals(1, GrowthRules.wartNextAge(0));
        assertEquals(2, GrowthRules.wartNextAge(1));
        assertEquals(3, GrowthRules.wartNextAge(2));
        int age = 0;
        int uses = 0;
        while (GrowthRules.wartCanGrow(age)) {
            age = GrowthRules.wartNextAge(age);
            uses++;
        }
        assertEquals(3, uses, "fresh wart is ripe after three uses");
        assertEquals(GrowthRules.NETHER_WART_MAX_AGE, age);
    }

    @Test
    void ripeNetherWartTakesNoBoneMeal() {
        assertFalse(GrowthRules.wartCanGrow(3));
        assertEquals(3, GrowthRules.wartNextAge(3));
        assertFalse(GrowthRules.wartCanGrow(-1), "no such age");
    }

    @Test
    void followUpsOfTheSameClickAreRecognised() {
        assertTrue(GrowthRules.blocksFollowUp(100, 100), "same tick");
        assertTrue(GrowthRules.blocksFollowUp(100, 101), "the next tick");
        assertFalse(GrowthRules.blocksFollowUp(100, 102), "a new click");
        assertFalse(GrowthRules.blocksFollowUp(-1, 0), "nothing grown yet");
        assertFalse(GrowthRules.blocksFollowUp(100, 99), "time went back (another world)");
    }
}
