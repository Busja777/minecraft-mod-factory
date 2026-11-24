package com.factory.stackmore;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class StackRulesTest {
    @Test
    void potionsStackToSixteen() {
        assertEquals(16, StackRules.limitFor("minecraft:potion", 1));
    }

    @Test
    void eggsAndSnowballsStackToSixtyFour() {
        assertEquals(64, StackRules.limitFor("minecraft:egg", 16));
        assertEquals(64, StackRules.limitFor("minecraft:snowball", 16));
    }

    @Test
    void theListHoldsExactlyTheThreeItemsOfVersionOne() {
        assertEquals(Map.of("minecraft:potion", 16, "minecraft:egg", 64, "minecraft:snowball", 64), StackRules.NEW_SIZES);
        assertEquals(StackRules.NEW_SIZES.keySet(), StackRules.VANILLA_SIZES.keySet(), "every changed item has its vanilla size noted");
    }

    @Test
    void thrownPotionsAndOtherItemsKeepTheirSize() {
        // splash and lingering potions are thrown without a wait: a stack would change fights
        assertEquals(1, StackRules.limitFor("minecraft:splash_potion", 1));
        assertEquals(1, StackRules.limitFor("minecraft:lingering_potion", 1));
        assertEquals(16, StackRules.limitFor("minecraft:ender_pearl", 16));
        assertEquals(16, StackRules.limitFor("minecraft:honey_bottle", 16));
        assertEquals(64, StackRules.limitFor("minecraft:stone", 64));
        assertEquals(1, StackRules.limitFor("minecraft:diamond_sword", 1));
        assertEquals(1, StackRules.limitFor("othermod:potion", 1), "only the vanilla ids count");
        for (String id : List.of("minecraft:splash_potion", "minecraft:lingering_potion", "minecraft:ender_pearl", "minecraft:honey_bottle", "minecraft:stone")) {
            assertFalse(StackRules.changes(id), id);
        }
    }

    @Test
    void everyNewSizeIsAllowedAndBiggerThanVanilla() {
        for (Map.Entry<String, Integer> e : StackRules.NEW_SIZES.entrySet()) {
            int vanilla = StackRules.VANILLA_SIZES.get(e.getKey());
            assertTrue(StackRules.isAllowed(e.getValue(), vanilla, false), e.getKey());
            assertTrue(e.getValue() > vanilla, e.getKey() + " must stack more than in vanilla");
            assertTrue(StackRules.changes(e.getKey()), e.getKey());
        }
    }

    @Test
    void sizesOutsideTheGameRangeAreRefused() {
        assertFalse(StackRules.isAllowed(0, 1, false));
        assertFalse(StackRules.isAllowed(100, 1, false), "the component allows at most 99");
        assertTrue(StackRules.isAllowed(99, 1, false));
        assertTrue(StackRules.isAllowed(1, 1, false));
    }

    @Test
    void neverSmallerThanVanillaAndNeverForDamageableItems() {
        assertFalse(StackRules.isAllowed(16, 64, false), "the mod only ever lets more fit");
        assertFalse(StackRules.isAllowed(16, 1, true), "the game refuses stackable items that take damage");
    }
}
