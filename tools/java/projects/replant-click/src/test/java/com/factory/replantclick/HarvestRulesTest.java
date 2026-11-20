package com.factory.replantclick;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.factory.replantclick.HarvestRules.Drop;
import java.util.List;
import org.junit.jupiter.api.Test;

class HarvestRulesTest {
    private static final String AIR = "minecraft:air";

    @Test
    void harvestsTheFourCropsWhenFullyGrown() {
        assertTrue(HarvestRules.isHarvestable("minecraft:wheat", 7, 7, false, AIR));
        assertTrue(HarvestRules.isHarvestable("minecraft:carrots", 7, 7, false, AIR));
        assertTrue(HarvestRules.isHarvestable("minecraft:potatoes", 7, 7, false, AIR));
        assertTrue(HarvestRules.isHarvestable("minecraft:beetroots", 3, 3, false, AIR));
    }

    @Test
    void leavesGrowingCropsAlone() {
        assertFalse(HarvestRules.isHarvestable("minecraft:wheat", 6, 7, false, AIR));
        assertFalse(HarvestRules.isHarvestable("minecraft:wheat", 0, 7, false, AIR));
        assertFalse(HarvestRules.isHarvestable("minecraft:beetroots", 2, 3, false, AIR));
    }

    @Test
    void sneakingKeepsTheVanillaBehaviour() {
        assertFalse(HarvestRules.isHarvestable("minecraft:wheat", 7, 7, true, AIR));
    }

    @Test
    void anyItemExceptBoneMealHarvests() {
        assertTrue(HarvestRules.isHarvestable("minecraft:wheat", 7, 7, false, "minecraft:diamond_hoe"));
        assertTrue(HarvestRules.isHarvestable("minecraft:wheat", 7, 7, false, "minecraft:wheat_seeds"));
        assertTrue(HarvestRules.isHarvestable("minecraft:wheat", 7, 7, false, "minecraft:dirt"));
        assertFalse(HarvestRules.isHarvestable("minecraft:wheat", 7, 7, false, "minecraft:bone_meal"));
    }

    @Test
    void otherBlocksAreNotHarvested() {
        // not in V1.0: nether wart, cocoa, torchflower and pitcher crops, modded crops
        for (String id : List.of("minecraft:nether_wart", "minecraft:cocoa", "minecraft:torchflower_crop", "minecraft:pitcher_crop", "minecraft:melon_stem", "othermod:rice")) {
            assertFalse(HarvestRules.isHarvestable(id, 7, 7, false, AIR), id);
        }
        assertFalse(HarvestRules.isHarvestable("minecraft:wheat", 0, 0, false, AIR), "a crop without ages");
    }

    @Test
    void replantsFromTheFirstSeedStack() {
        List<Drop> wheat = List.of(new Drop("minecraft:wheat", 1), new Drop("minecraft:wheat_seeds", 3));
        assertEquals(1, HarvestRules.replantIndex(wheat, "minecraft:wheat_seeds"));

        List<Drop> carrots = List.of(new Drop("minecraft:carrot", 4));
        assertEquals(0, HarvestRules.replantIndex(carrots, "minecraft:carrot"));

        List<Drop> potatoes = List.of(new Drop("minecraft:potato", 2), new Drop("minecraft:poisonous_potato", 1));
        assertEquals(0, HarvestRules.replantIndex(potatoes, "minecraft:potato"));
    }

    @Test
    void skipsEmptyStacksAndReportsMissingSeeds() {
        List<Drop> drops = List.of(new Drop("minecraft:beetroot_seeds", 0), new Drop("minecraft:beetroot", 1), new Drop("minecraft:beetroot_seeds", 2));
        assertEquals(2, HarvestRules.replantIndex(drops, "minecraft:beetroot_seeds"));
        assertEquals(-1, HarvestRules.replantIndex(List.of(new Drop("minecraft:wheat", 1)), "minecraft:wheat_seeds"));
        assertEquals(-1, HarvestRules.replantIndex(List.of(), "minecraft:wheat_seeds"));
    }

    @Test
    void ignoresTheItemUseRightBehindAHarvest() {
        assertTrue(HarvestRules.blocksItemUse(100, 100), "same tick");
        assertTrue(HarvestRules.blocksItemUse(100, 101), "next tick");
        assertFalse(HarvestRules.blocksItemUse(100, 102), "a real second click");
        assertFalse(HarvestRules.blocksItemUse(-1, 0), "no harvest yet");
        assertFalse(HarvestRules.blocksItemUse(100, 99), "time went back (another world)");
    }
}
