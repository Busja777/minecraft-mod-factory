package com.factory.griefingrules;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.factory.griefingrules.GriefingRules.Kind;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class GriefingRulesTest {
    @Test
    void theFiveRulesHaveTheseNames() {
        assertEquals(List.of("creeperGriefing", "ghastGriefing", "witherGriefing", "endermanGriefing", "ravagerGriefing"),
            List.of(Kind.values()).stream().map(Kind::ruleName).toList());
    }

    @Test
    void ruleNamesAreUniqueAndFitTheGameruleCommand() {
        Set<String> seen = new HashSet<>();
        for (Kind kind : Kind.values()) {
            String name = kind.ruleName();
            assertTrue(name.matches("[a-z][A-Za-z]*Griefing"), name);
            assertTrue(seen.add(name.toLowerCase()), "twice: " + name);
            assertFalse(name.equals("mobGriefing"), "vanilla's own rule stays as it is");
        }
    }

    @Test
    void everyRuleStartsOnSoNothingChangesUntilAnAdminSaysSo() {
        assertTrue(GriefingRules.DEFAULT);
        assertTrue(GriefingRules.allows(true, GriefingRules.DEFAULT));
    }

    @Test
    void bothVanillaAndTheKindMustAllowIt() {
        assertTrue(GriefingRules.allows(true, true));
        assertFalse(GriefingRules.allows(true, false), "the kind's rule switched off");
        assertFalse(GriefingRules.allows(false, true), "mobGriefing false still turns everything off");
        assertFalse(GriefingRules.allows(false, false));
    }

    @Test
    void mobExplosionsAreSortedByTheEntityThatExplodes() {
        assertEquals(Kind.CREEPER, GriefingRules.explosionKind("minecraft:creeper"));
        assertEquals(Kind.GHAST, GriefingRules.explosionKind("minecraft:fireball"), "the ghast's large fireball");
        assertEquals(Kind.WITHER, GriefingRules.explosionKind("minecraft:wither"), "the blast when it spawns");
        assertEquals(Kind.WITHER, GriefingRules.explosionKind("minecraft:wither_skull"));
    }

    @Test
    void otherExplosionsKeepVanillasRule() {
        // small fireballs (blazes, dispensers) do not explode; TNT, beds, anchors and crystals are not mob explosions;
        // the ender dragon and breeze wind charges are left to mobGriefing in V1.0
        for (String id : List.of("minecraft:small_fireball", "minecraft:tnt", "minecraft:end_crystal", "minecraft:ender_dragon",
                "minecraft:breeze_wind_charge", "minecraft:wind_charge", "minecraft:ghast", "othermod:bomb", "creeper", "")) {
            assertNull(GriefingRules.explosionKind(id), id);
        }
        assertNull(GriefingRules.explosionKind(null), "an explosion without an entity");
    }
}
