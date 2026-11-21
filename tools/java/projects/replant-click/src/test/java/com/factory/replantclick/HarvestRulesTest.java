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
    void harvestsRipeNetherWartAndCocoa() {
        // V1.1: nether wart is ripe at age 3, a cocoa pod at age 2
        assertTrue(HarvestRules.isHarvestable("minecraft:nether_wart", 3, 3, false, AIR));
        assertTrue(HarvestRules.isHarvestable("minecraft:cocoa", 2, 2, false, AIR));
        assertTrue(HarvestRules.isHarvestable("minecraft:cocoa", 2, 2, false, "minecraft:cocoa_beans"), "beans in hand still harvest, like seeds on wheat");
        assertTrue(HarvestRules.isHarvestable("minecraft:nether_wart", 3, 3, false, "minecraft:golden_hoe"));
    }

    @Test
    void youngNetherWartAndCocoaStay() {
        for (int age = 0; age < 3; age++) assertFalse(HarvestRules.isHarvestable("minecraft:nether_wart", age, 3, false, AIR), "nether wart age " + age);
        for (int age = 0; age < 2; age++) assertFalse(HarvestRules.isHarvestable("minecraft:cocoa", age, 2, false, AIR), "cocoa age " + age);
    }

    @Test
    void netherWartAndCocoaFollowTheSameRules() {
        assertFalse(HarvestRules.isHarvestable("minecraft:nether_wart", 3, 3, true, AIR), "sneaking");
        assertFalse(HarvestRules.isHarvestable("minecraft:cocoa", 2, 2, true, AIR), "sneaking");
        assertFalse(HarvestRules.isHarvestable("minecraft:cocoa", 2, 2, false, "minecraft:bone_meal"), "bone meal");
        assertFalse(HarvestRules.isHarvestable("minecraft:nether_wart", 3, 3, false, "minecraft:bone_meal"), "bone meal");
    }

    @Test
    void replantsNetherWartAndCocoaFromTheirDrops() {
        assertEquals(0, HarvestRules.replantIndex(List.of(new Drop("minecraft:nether_wart", 3)), "minecraft:nether_wart"));
        assertEquals(0, HarvestRules.replantIndex(List.of(new Drop("minecraft:cocoa_beans", 3)), "minecraft:cocoa_beans"));
        // a young pod drops one bean; it is never harvested, but a ripe one without beans is left alone
        assertEquals(-1, HarvestRules.replantIndex(List.of(), "minecraft:cocoa_beans"));
    }

    @Test
    void otherBlocksAreNotHarvested() {
        // not handled: torchflower and pitcher crops, stems, sweet berries, modded crops
        for (String id : List.of("minecraft:torchflower_crop", "minecraft:pitcher_crop", "minecraft:melon_stem", "minecraft:sweet_berry_bush", "othermod:rice")) {
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
    // --- V1.2: 3×3 area with a hoe ---

    @Test
    void theAreaNeedsAHoeAndTheSetting() {
        assertTrue(HarvestRules.harvestsArea("minecraft:wheat", true, true));
        assertFalse(HarvestRules.harvestsArea("minecraft:wheat", false, true), "without a hoe nothing changes");
        assertFalse(HarvestRules.harvestsArea("minecraft:wheat", true, false), "areaWithHoe off");
    }

    @Test
    void theAreaCoversFieldCropsAndNetherWartButNotCocoa() {
        for (String id : List.of("minecraft:wheat", "minecraft:carrots", "minecraft:potatoes", "minecraft:beetroots", "minecraft:nether_wart")) {
            assertTrue(HarvestRules.harvestsArea(id, true, true), id);
        }
        assertFalse(HarvestRules.harvestsArea("minecraft:cocoa", true, true), "pods hang on logs, not in a flat grid");
        assertTrue(HarvestRules.CROPS.containsAll(HarvestRules.AREA_CROPS), "the area only harvests what a single click harvests");
    }

    @Test
    void theAreaIsTheEightNeighboursOnTheSameLevel() {
        assertEquals(8, HarvestRules.AREA_OFFSETS.size());
        java.util.Set<String> seen = new java.util.HashSet<>();
        for (int[] d : HarvestRules.AREA_OFFSETS) {
            assertEquals(2, d.length);
            assertTrue(Math.abs(d[0]) <= 1 && Math.abs(d[1]) <= 1, d[0] + "," + d[1]);
            assertFalse(d[0] == 0 && d[1] == 0, "the clicked crop is not part of the neighbours");
            assertTrue(seen.add(d[0] + "," + d[1]), "each neighbour once");
        }
    }

    @Test
    void theHoeNeverBreaks() {
        assertTrue(HarvestRules.hoeCanTakeHit(true, 0, 250));
        assertTrue(HarvestRules.hoeCanTakeHit(true, 248, 250), "two points left: one may go");
        assertFalse(HarvestRules.hoeCanTakeHit(true, 249, 250), "one point left: the next hit would break it");
        assertFalse(HarvestRules.hoeCanTakeHit(true, 250, 250));
        assertTrue(HarvestRules.hoeCanTakeHit(false, 0, 0), "an unbreakable hoe");
    }
}
