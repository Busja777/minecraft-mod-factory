package com.factory.joingreeter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.factory.joingreeter.JoinConfig.KitItem;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class JoinConfigTest {
    private final List<String> warnings = new ArrayList<>();

    private JoinConfig parse(String json) {
        return JoinConfig.parse(json, warnings::add);
    }

    @Test
    void readsAFullFile() {
        JoinConfig c = parse("""
            {"_help": "ignored", "welcome": "&aHi {player}", "welcomeBack": "", "rules": ["1. Be nice", "2. No griefing"],
             "rulesEveryJoin": true, "starterKit": [{"item": "minecraft:bread", "count": 8}, {"item": "stone_axe"}]}
            """);
        assertEquals("&aHi {player}", c.welcome());
        assertEquals("", c.welcomeBack());
        assertEquals(List.of("1. Be nice", "2. No griefing"), c.rules());
        assertTrue(c.rulesEveryJoin());
        assertEquals(List.of(new KitItem("minecraft:bread", 8), new KitItem("minecraft:stone_axe", 1)), c.starterKit());
        assertTrue(warnings.isEmpty(), warnings.toString());
    }

    @Test
    void missingFieldsKeepTheirDefaults() {
        JoinConfig c = parse("{}");
        assertEquals(JoinConfig.defaults(), c);
        assertTrue(warnings.isEmpty(), warnings.toString());
    }

    @Test
    void brokenFilesFallBackToTheDefaultsWithAWarning() {
        for (String json : List.of("", "{", "[]", "\"text\"")) {
            warnings.clear();
            assertEquals(JoinConfig.defaults(), parse(json), json);
            assertEquals(1, warnings.size(), json);
        }
    }

    @Test
    void aBrokenFieldOnlyLosesThatField() {
        JoinConfig c = parse("{\"welcome\": 5, \"welcomeBack\": \"Back!\", \"rules\": \"no list\", \"rulesEveryJoin\": \"yes\"}");
        assertEquals(JoinConfig.DEFAULT_WELCOME, c.welcome());
        assertEquals("Back!", c.welcomeBack());
        assertTrue(c.rules().isEmpty());
        assertFalse(c.rulesEveryJoin());
        assertEquals(3, warnings.size(), warnings.toString());
    }

    @Test
    void badKitEntriesAreSkipped() {
        JoinConfig c = parse("""
            {"starterKit": [{"item": "minecraft:bread", "count": 0}, {"item": "Bad Id!"}, {"count": 3}, "bread",
              {"item": "minecraft:torch", "count": 2.5}, {"item": "minecraft:torch", "count": 99999},
              {"item": "Minecraft:Torch", "count": 16}]}
            """);
        assertEquals(List.of(new KitItem("minecraft:torch", 16)), c.starterKit());
        assertEquals(6, warnings.size(), warnings.toString());
        warnings.clear();
        assertTrue(parse("{\"starterKit\": {\"item\": \"minecraft:bread\"}}").starterKit().isEmpty());
        assertEquals(1, warnings.size());
    }

    @Test
    void itemIdsAreNormalized() {
        assertEquals("minecraft:bread", JoinConfig.normalizeId(" Bread "));
        assertEquals("othermod:copper_coin", JoinConfig.normalizeId("othermod:copper_coin"));
        assertNull(JoinConfig.normalizeId("two words"));
        assertNull(JoinConfig.normalizeId("minecraft:"));
    }

    @Test
    void longLinesAndTooManyRulesAreCut() {
        String rules = "[" + "\"r\",".repeat(JoinConfig.MAX_RULES + 5) + "\"last\"]";
        assertEquals(JoinConfig.MAX_RULES, parse("{\"rules\": " + rules + "}").rules().size());
        String longLine = "x".repeat(JoinConfig.MAX_LINE + 10);
        assertEquals(JoinConfig.MAX_LINE, parse("{\"welcome\": \"" + longLine + "\"}").welcome().length());
    }

    @Test
    void theWrittenFileReadsBack() {
        JoinConfig c = new JoinConfig("&6Hi §l{player}", "Back", List.of("Rule \"one\""), true, List.of(new KitItem("minecraft:apple", 3)));
        assertEquals(c, parse(c.toJson()));
        assertEquals(JoinConfig.defaults(), parse(JoinConfig.defaults().toJson()));
        assertTrue(warnings.isEmpty(), warnings.toString());
    }

    @Test
    void createsTheFileOnTheFirstStart(@TempDir Path dir) throws IOException {
        Path config = dir.resolve("config");
        assertEquals(JoinConfig.defaults(), JoinConfig.load(config, warnings::add));
        Path file = config.resolve("joingreeter.json");
        assertTrue(Files.exists(file));
        assertTrue(Files.readString(file).contains("\"starterKit\": []"), "the kit is empty by default");
        Files.writeString(file, "{\"welcome\": \"Hello\"}");
        assertEquals("Hello", JoinConfig.load(config, warnings::add).welcome());
        assertTrue(warnings.isEmpty(), warnings.toString());
    }
}
