package com.factory.afktag;

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

class AfkConfigTest {
    private final List<String> warnings = new ArrayList<>();

    private AfkConfig parse(String json) {
        return AfkConfig.parse(json, warnings::add);
    }

    @Test
    void readsMinutes() {
        assertEquals(10, parse("{\"minutes\": 10}").minutes());
        assertEquals(1, parse("{\"minutes\": 1}").minutes());
        assertEquals(1440, parse("{\"minutes\": 1440}").minutes());
        assertTrue(warnings.isEmpty(), warnings.toString());
    }

    @Test
    void fiveMinutesAre6000Ticks() {
        assertEquals(6000, AfkConfig.defaults().timeoutTicks());
        assertEquals(5, AfkConfig.DEFAULT_MINUTES);
    }

    @Test
    void badValuesFallBackToTheDefaultWithAWarning() {
        for (String json : List.of("", "{", "[]", "{}", "{\"minutes\": 0}", "{\"minutes\": -3}", "{\"minutes\": 1441}",
            "{\"minutes\": 2.5}", "{\"minutes\": \"ten\"}", "{\"minutes\": null}", "{\"minutes\": [5]}")) {
            warnings.clear();
            assertEquals(AfkConfig.DEFAULT_MINUTES, parse(json).minutes(), json);
            assertEquals(1, warnings.size(), json);
        }
    }

    @Test
    void theWrittenFileReadsBack() {
        assertEquals(7, parse(new AfkConfig(7).toJson()).minutes());
        assertEquals(new AfkConfig(9, false), parse(new AfkConfig(9, false).toJson()));
        assertEquals(AfkConfig.defaults(), parse(AfkConfig.defaults().toJson()));
        assertTrue(warnings.isEmpty(), warnings.toString());
    }

    @Test
    void afkPlayersDoNotCountForSleepByDefault() {
        assertTrue(AfkConfig.DEFAULT_IGNORE_AFK_FOR_SLEEP);
        assertTrue(AfkConfig.defaults().ignoreAfkForSleep());
        assertTrue(AfkConfig.defaults().toJson().contains("\"ignoreAfkForSleep\": true"));
    }

    @Test
    void aConfigFileOfVersion1_0KeepsWorkingWithoutAWarning() {
        // exactly what 1.0 wrote
        AfkConfig old = parse("{\n  \"minutes\": 12\n}\n");
        assertEquals(12, old.minutes());
        assertTrue(old.ignoreAfkForSleep(), "a missing key gets the default");
        assertTrue(warnings.isEmpty(), warnings.toString());
    }

    @Test
    void readsTheSleepSwitch() {
        assertFalse(parse("{\"minutes\": 5, \"ignoreAfkForSleep\": false}").ignoreAfkForSleep());
        assertTrue(parse("{\"minutes\": 5, \"ignoreAfkForSleep\": true}").ignoreAfkForSleep());
        assertTrue(warnings.isEmpty(), warnings.toString());
    }

    @Test
    void eachSettingFallsBackOnItsOwn() {
        for (String bad : List.of("\"no\"", "0", "1", "null", "[]", "{}")) {
            warnings.clear();
            AfkConfig config = parse("{\"minutes\": 8, \"ignoreAfkForSleep\": " + bad + "}");
            assertEquals(8, config.minutes(), bad);
            assertTrue(config.ignoreAfkForSleep(), bad);
            assertEquals(1, warnings.size(), bad);
        }
        warnings.clear();
        AfkConfig config = parse("{\"minutes\": 0, \"ignoreAfkForSleep\": false}");
        assertEquals(AfkConfig.DEFAULT_MINUTES, config.minutes());
        assertFalse(config.ignoreAfkForSleep(), "a bad idle time does not reset the sleep switch");
        assertEquals(1, warnings.size());
    }

    @Test
    void createsTheFileOnTheFirstStart(@TempDir Path dir) throws IOException {
        Path config = dir.resolve("config");
        assertEquals(AfkConfig.defaults(), AfkConfig.load(config, warnings::add));
        Path file = config.resolve("afktag.json");
        assertTrue(Files.exists(file));
        assertTrue(Files.readString(file).contains("ignoreAfkForSleep"), "the new file shows the switch");
        Files.writeString(file, "{\"minutes\": 12}");
        assertEquals(12, AfkConfig.load(config, warnings::add).minutes());
        assertTrue(AfkConfig.load(config, warnings::add).ignoreAfkForSleep());
        Files.writeString(file, "{\"minutes\": 12, \"ignoreAfkForSleep\": false}");
        assertFalse(AfkConfig.load(config, warnings::add).ignoreAfkForSleep());
        assertTrue(warnings.isEmpty(), warnings.toString());
    }
}
