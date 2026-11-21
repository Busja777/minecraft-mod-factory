package com.factory.fastleaffall;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class LeafConfigTest {
    private final List<String> warnings = new ArrayList<>();

    private LeafConfig parse(String json) {
        return LeafConfig.parse(json, warnings::add);
    }

    @Test
    void theDefaultsAreTheValuesOf10() {
        LeafConfig d = LeafConfig.defaults();
        assertEquals(new LeafConfig(10, 49, 64), d);
        assertEquals(LeafRules.DELAY_SPREAD_TICKS, d.delaySpread());
        for (int roll = -50; roll < 100; roll++) assertEquals(LeafRules.delay(roll), d.delay(roll), "roll " + roll);
    }

    @Test
    void readsAllSettings() {
        assertEquals(new LeafConfig(1, 1, 1), parse("{\"minDelayTicks\": 1, \"maxDelayTicks\": 1, \"leavesPerTick\": 1}"));
        assertEquals(new LeafConfig(100, 400, 512), parse("{\"minDelayTicks\": 100, \"maxDelayTicks\": 400, \"leavesPerTick\": 512}"));
        assertEquals(new LeafConfig(5, 20, 16), parse("{\"minDelayTicks\": 5.0, \"maxDelayTicks\": 20, \"leavesPerTick\": 16}"));
        assertTrue(warnings.isEmpty(), warnings.toString());
    }

    @Test
    void missingKeysGetTheirDefaultWithoutAWarning() {
        assertEquals(LeafConfig.defaults(), parse("{}"));
        assertEquals(new LeafConfig(10, 49, 8), parse("{\"leavesPerTick\": 8}"));
        assertEquals(new LeafConfig(2, 49, 64), parse("{\"minDelayTicks\": 2}"));
        assertEquals(new LeafConfig(10, 200, 64), parse("{\"maxDelayTicks\": 200, \"other\": true}"));
        assertTrue(warnings.isEmpty(), warnings.toString());
    }

    @Test
    void aBrokenFileFallsBackToTheDefaultsWithAWarning() {
        for (String json : List.of("", "{", "[]", "7", "\"x\"")) {
            warnings.clear();
            assertEquals(LeafConfig.defaults(), parse(json), json);
            assertEquals(1, warnings.size(), json);
        }
    }

    @Test
    void outOfRangeOrBrokenValuesFallBackToTheirDefault() {
        for (String bad : List.of("0", "-1", "401", "2.5", "\"ten\"", "null", "[5]", "true")) {
            warnings.clear();
            assertEquals(new LeafConfig(10, 30, 64), parse("{\"minDelayTicks\": " + bad + ", \"maxDelayTicks\": 30}"), "min " + bad);
            assertEquals(1, warnings.size(), "min " + bad);
            warnings.clear();
            assertEquals(new LeafConfig(5, 49, 64), parse("{\"minDelayTicks\": 5, \"maxDelayTicks\": " + bad + "}"), "max " + bad);
            assertEquals(1, warnings.size(), "max " + bad);
        }
        for (String bad : List.of("0", "-5", "513", "1.5", "\"many\"", "null")) {
            warnings.clear();
            assertEquals(new LeafConfig(10, 49, 64), parse("{\"leavesPerTick\": " + bad + "}"), "per tick " + bad);
            assertEquals(1, warnings.size(), "per tick " + bad);
        }
    }

    @Test
    void aMaximumBelowTheMinimumUsesTheMinimumForBoth() {
        assertEquals(new LeafConfig(30, 30, 64), parse("{\"minDelayTicks\": 30, \"maxDelayTicks\": 20}"));
        assertEquals(1, warnings.size());
        warnings.clear();
        // only the minimum set, above the default maximum of 49
        assertEquals(new LeafConfig(100, 100, 64), parse("{\"minDelayTicks\": 100}"));
        assertEquals(1, warnings.size());
    }

    @Test
    void theWaitStaysInsideTheSetRange() {
        LeafConfig c = new LeafConfig(3, 7, 64);
        assertEquals(5, c.delaySpread());
        for (int roll = -20; roll < 20; roll++) {
            int d = c.delay(roll);
            assertTrue(d >= 3 && d <= 7, "roll " + roll + " gave " + d);
        }
        assertEquals(3, c.delay(0));
        assertEquals(7, c.delay(4));
        assertEquals(1, new LeafConfig(1, 1, 1).delay(12345));
    }

    @Test
    void impossibleSettingsCannotBeBuilt() {
        assertThrows(IllegalArgumentException.class, () -> new LeafConfig(0, 10, 64));
        assertThrows(IllegalArgumentException.class, () -> new LeafConfig(20, 10, 64));
        assertThrows(IllegalArgumentException.class, () -> new LeafConfig(10, 401, 64));
        assertThrows(IllegalArgumentException.class, () -> new LeafConfig(10, 49, 0));
        assertThrows(IllegalArgumentException.class, () -> new LeafConfig(10, 49, 513));
    }

    @Test
    void theWrittenFileReadsBack() {
        for (LeafConfig c : List.of(LeafConfig.defaults(), new LeafConfig(1, 1, 1), new LeafConfig(40, 400, 512))) {
            assertEquals(c, parse(c.toJson()));
        }
        assertTrue(warnings.isEmpty(), warnings.toString());
    }

    @Test
    void createsTheFileOnTheFirstStart(@TempDir Path dir) throws IOException {
        Path config = dir.resolve("config");
        assertEquals(LeafConfig.defaults(), LeafConfig.load(config, warnings::add));
        Path file = config.resolve("fastleaffall.json");
        assertTrue(Files.exists(file));
        assertEquals(LeafConfig.defaults(), parse(Files.readString(file)));
        Files.writeString(file, "{\"leavesPerTick\": 128}");
        assertEquals(new LeafConfig(10, 49, 128), LeafConfig.load(config, warnings::add));
        assertTrue(warnings.isEmpty(), warnings.toString());
    }
}
