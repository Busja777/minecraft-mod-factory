package com.factory.ownersafepets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class OwnerConfigTest {
    private final List<String> warnings = new ArrayList<>();

    private OwnerConfig parse(String json) {
        return OwnerConfig.parse(json, warnings::add);
    }

    @Test
    void theDefaultsAreTheBehaviourOf10() {
        OwnerConfig d = OwnerConfig.defaults();
        assertFalse(d.sneakToHit(), "1.0 protects the pet from every hit of its owner");
        assertTrue(d.protectFromOwnerExplosions(), "1.0 protects the pet from the owner's explosions");
    }

    @Test
    void readsBothSettings() {
        assertEquals(new OwnerConfig(true, false), parse("{\"sneakToHit\": true, \"protectFromOwnerExplosions\": false}"));
        assertEquals(new OwnerConfig(false, true), parse("{\"sneakToHit\": false, \"protectFromOwnerExplosions\": true}"));
        assertTrue(warnings.isEmpty(), warnings.toString());
    }

    @Test
    void missingKeysGetTheirDefaultWithoutAWarning() {
        assertEquals(OwnerConfig.defaults(), parse("{}"));
        assertEquals(new OwnerConfig(true, true), parse("{\"sneakToHit\": true}"));
        assertEquals(new OwnerConfig(false, false), parse("{\"protectFromOwnerExplosions\": false}"));
        assertEquals(new OwnerConfig(true, true), parse("{\"sneakToHit\": true, \"somethingElse\": 3}"));
        assertTrue(warnings.isEmpty(), warnings.toString());
    }

    @Test
    void aBrokenFileFallsBackToTheDefaultsWithAWarning() {
        for (String json : List.of("", "{", "[]", "true", "\"x\"")) {
            warnings.clear();
            assertEquals(OwnerConfig.defaults(), parse(json), json);
            assertEquals(1, warnings.size(), json);
        }
    }

    @Test
    void aBrokenValueFallsBackToItsDefaultAndKeepsTheOther() {
        for (String bad : List.of("1", "0", "\"true\"", "null", "[true]", "{}")) {
            warnings.clear();
            assertEquals(new OwnerConfig(false, false), parse("{\"sneakToHit\": " + bad + ", \"protectFromOwnerExplosions\": false}"), bad);
            assertEquals(1, warnings.size(), bad);
            warnings.clear();
            assertEquals(new OwnerConfig(true, true), parse("{\"sneakToHit\": true, \"protectFromOwnerExplosions\": " + bad + "}"), bad);
            assertEquals(1, warnings.size(), bad);
        }
    }

    @Test
    void theWrittenFileReadsBack() {
        for (OwnerConfig c : List.of(new OwnerConfig(true, true), new OwnerConfig(true, false), new OwnerConfig(false, false), OwnerConfig.defaults())) {
            assertEquals(c, parse(c.toJson()));
        }
        assertTrue(warnings.isEmpty(), warnings.toString());
    }

    @Test
    void createsTheFileOnTheFirstStart(@TempDir Path dir) throws IOException {
        Path config = dir.resolve("config");
        assertEquals(OwnerConfig.defaults(), OwnerConfig.load(config, warnings::add));
        Path file = config.resolve("ownersafepets.json");
        assertTrue(Files.exists(file));
        assertEquals(OwnerConfig.defaults(), parse(Files.readString(file)));
        Files.writeString(file, "{\"sneakToHit\": true}");
        assertEquals(new OwnerConfig(true, true), OwnerConfig.load(config, warnings::add));
        assertTrue(warnings.isEmpty(), warnings.toString());
    }

    @Test
    void thePotionGuardIsOnByDefault() {
        assertTrue(OwnerConfig.defaults().protectFromOwnerPotions());
        assertTrue(OwnerConfig.defaults().toJson().contains("\"protectFromOwnerPotions\": true"), "a new file shows the setting");
        assertTrue(new OwnerConfig(true, false).protectFromOwnerPotions(), "the 1.1 settings keep the guard");
    }

    @Test
    void aConfigFileOfVersion11KeepsWorkingWithoutAWarning() {
        // exactly what 1.1 wrote, with both values changed
        OwnerConfig old = parse("{\n  \"sneakToHit\": true,\n  \"protectFromOwnerExplosions\": false\n}\n");
        assertEquals(new OwnerConfig(true, false, true), old);
        assertTrue(warnings.isEmpty(), warnings.toString());
    }

    @Test
    void readsThePotionGuard() {
        assertEquals(new OwnerConfig(false, true, false), parse("{\"protectFromOwnerPotions\": false}"));
        assertEquals(new OwnerConfig(true, false, false), parse("{\"sneakToHit\": true, \"protectFromOwnerExplosions\": false, \"protectFromOwnerPotions\": false}"));
        assertTrue(warnings.isEmpty(), warnings.toString());
        for (String bad : List.of("1", "\"false\"", "null", "[]")) {
            warnings.clear();
            assertEquals(new OwnerConfig(true, false, true), parse("{\"sneakToHit\": true, \"protectFromOwnerExplosions\": false, \"protectFromOwnerPotions\": " + bad + "}"), bad);
            assertEquals(1, warnings.size(), bad);
        }
    }

    @Test
    void everyCombinationReadsBack() {
        for (boolean a : new boolean[] {false, true}) for (boolean b : new boolean[] {false, true}) for (boolean c : new boolean[] {false, true}) {
            OwnerConfig config = new OwnerConfig(a, b, c);
            assertEquals(config, parse(config.toJson()));
        }
        assertTrue(warnings.isEmpty(), warnings.toString());
    }
}
