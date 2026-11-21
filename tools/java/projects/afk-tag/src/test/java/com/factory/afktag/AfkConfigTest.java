package com.factory.afktag;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
    }

    @Test
    void createsTheFileOnTheFirstStart(@TempDir Path dir) throws IOException {
        Path config = dir.resolve("config");
        assertEquals(AfkConfig.DEFAULT_MINUTES, AfkConfig.load(config, warnings::add).minutes());
        Path file = config.resolve("afktag.json");
        assertTrue(Files.exists(file));
        Files.writeString(file, "{\"minutes\": 12}");
        assertEquals(12, AfkConfig.load(config, warnings::add).minutes());
        assertTrue(warnings.isEmpty(), warnings.toString());
    }
}
