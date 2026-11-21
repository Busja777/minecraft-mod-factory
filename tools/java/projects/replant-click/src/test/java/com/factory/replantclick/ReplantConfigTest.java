package com.factory.replantclick;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ReplantConfigTest {
    private final List<String> warnings = new ArrayList<>();

    private ReplantConfig parse(String json) {
        return ReplantConfig.parse(json, warnings::add);
    }

    @Test
    void theAreaIsOnByDefault() {
        assertTrue(ReplantConfig.defaults().areaWithHoe());
    }

    @Test
    void readsTheSetting() {
        assertEquals(new ReplantConfig(false), parse("{\"areaWithHoe\": false}"));
        assertEquals(new ReplantConfig(true), parse("{\"areaWithHoe\": true}"));
        assertTrue(warnings.isEmpty(), warnings.toString());
    }

    @Test
    void missingOrUnknownKeysAreNoProblem() {
        assertEquals(ReplantConfig.defaults(), parse("{}"));
        assertEquals(ReplantConfig.defaults(), parse("{\"somethingLater\": 3}"));
        assertTrue(warnings.isEmpty(), warnings.toString());
    }

    @Test
    void aBrokenFileFallsBackToTheDefaultsWithAWarning() {
        for (String json : List.of("", "{", "[]", "7", "\"x\"")) {
            warnings.clear();
            assertEquals(ReplantConfig.defaults(), parse(json), json);
            assertEquals(1, warnings.size(), json);
        }
    }

    @Test
    void aBrokenValueFallsBackToItsDefaultWithAWarning() {
        for (String bad : List.of("0", "1", "\"false\"", "null", "[false]", "{}")) {
            warnings.clear();
            assertEquals(ReplantConfig.defaults(), parse("{\"areaWithHoe\": " + bad + "}"), bad);
            assertEquals(1, warnings.size(), bad);
        }
    }

    @Test
    void theWrittenFileReadsBack() {
        for (ReplantConfig c : List.of(new ReplantConfig(true), new ReplantConfig(false))) assertEquals(c, parse(c.toJson()));
        assertTrue(warnings.isEmpty(), warnings.toString());
    }

    @Test
    void createsTheFileOnTheFirstStart(@TempDir Path dir) throws IOException {
        Path config = dir.resolve("config");
        assertEquals(ReplantConfig.defaults(), ReplantConfig.load(config, warnings::add));
        Path file = config.resolve("replantclick.json");
        assertTrue(Files.exists(file));
        assertEquals(ReplantConfig.defaults(), parse(Files.readString(file)));
        Files.writeString(file, "{\"areaWithHoe\": false}");
        assertEquals(new ReplantConfig(false), ReplantConfig.load(config, warnings::add));
        assertTrue(warnings.isEmpty(), warnings.toString());
    }
}
