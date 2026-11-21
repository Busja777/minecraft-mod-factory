package com.factory.joingreeter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.factory.joingreeter.Greeting.Segment;
import com.factory.joingreeter.JoinConfig.KitItem;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class GreetingTest {
    private static final Map<String, String> VALUES = Map.of("player", "Alex", "online", "3");

    private static JoinConfig config(List<String> rules, boolean everyJoin) {
        return new JoinConfig("Hi {player}", "Back, {player}", rules, everyJoin, List.of());
    }

    @Test
    void newcomersGetTheWelcomeAndTheRules() {
        assertEquals(List.of("Hi {player}", "No griefing", "Be nice"), Greeting.lines(config(List.of("No griefing", "Be nice"), false), true));
    }

    @Test
    void returningPlayersGetTheWelcomeBackWithoutRulesUnlessAsked() {
        JoinConfig quiet = config(List.of("No griefing"), false);
        assertEquals(List.of("Back, {player}"), Greeting.lines(quiet, false));
        JoinConfig every = config(List.of("No griefing"), true);
        assertEquals(List.of("Back, {player}", "No griefing"), Greeting.lines(every, false));
    }

    @Test
    void anEmptyWelcomeSendsNothing() {
        JoinConfig silent = new JoinConfig("", " ", List.of(), false, List.of());
        assertTrue(Greeting.lines(silent, true).isEmpty());
        assertTrue(Greeting.lines(silent, false).isEmpty());
    }

    @Test
    void firstJoinOnlyWithoutAnyTraceInTheStatistics() {
        assertTrue(Greeting.isFirstJoin(0, 0, 0));
        assertFalse(Greeting.isFirstJoin(1, 0, 0), "left the world before");
        assertFalse(Greeting.isFirstJoin(0, 600, 600), "played until an autosave, then the server crashed");
        assertFalse(Greeting.isFirstJoin(0, 0, 20), "was only dead, but in the world");
    }

    @Test
    void placeholdersAreFilled() {
        assertEquals("Hello Alex, 3 online", Greeting.fill("Hello {player}, {online} online", VALUES));
        assertEquals("{unknown} Alex {", Greeting.fill("{unknown} {player} {", VALUES));
        assertEquals("{{Alex}}", Greeting.fill("{{{player}}}", VALUES));
        assertEquals("", Greeting.fill("", VALUES));
    }

    @Test
    void ampersandAndSectionCodesGiveColours() {
        List<Segment> s = Greeting.parse("&6Gold §eYellow&r plain");
        assertEquals(3, s.size());
        assertEquals(new Segment("Gold ", '6', false, false, false, false, false), s.get(0));
        assertEquals(new Segment("Yellow", 'e', false, false, false, false, false), s.get(1));
        assertEquals(new Segment(" plain", (char) 0, false, false, false, false, false), s.get(2));
    }

    @Test
    void stylesAddUpAndAColourEndsThem() {
        List<Segment> s = Greeting.parse("&l&oBoth&cRed");
        assertEquals(new Segment("Both", (char) 0, true, true, false, false, false), s.get(0));
        assertEquals(new Segment("Red", 'c', false, false, false, false, false), s.get(1));
        assertEquals(new Segment("x", 'a', false, false, true, true, true), Greeting.parse("&A&N&M&Kx").get(0), "codes are case-insensitive");
    }

    @Test
    void otherAmpersandsStay() {
        assertEquals("Tom & Jerry &z &", Greeting.plain("Tom & Jerry &z &"));
        assertEquals("R&D", Greeting.plain("R&&D"));
        assertEquals("&6", Greeting.plain("&&6"), "a doubled & escapes a code");
        assertTrue(Greeting.parse("").isEmpty());
    }

    @Test
    void aPlayerNameCannotInjectColours() {
        List<Segment> s = Greeting.render("&aHi {player}", Map.of("player", "&cEvil"));
        assertEquals(1, s.size());
        assertEquals(new Segment("Hi &cEvil", 'a', false, false, false, false, false), s.get(0));
    }

    @Test
    void theDefaultLinesReadWell() {
        Map<String, String> values = Map.of("player", "Alex", "online", "4");
        JoinConfig d = JoinConfig.defaults();
        assertEquals("Welcome, Alex! Have fun on the server.", Greeting.plain(Greeting.fill(d.welcome(), values)));
        assertEquals("Welcome back, Alex! Players online: 4", Greeting.plain(Greeting.fill(d.welcomeBack(), values)));
        assertTrue(d.starterKit().isEmpty(), "nothing is given unless the admin sets a kit");
        assertTrue(d.rules().isEmpty());
    }

    @Test
    void kitCountsAreSplitIntoStacks() {
        assertEquals(List.of(64, 6), Greeting.stacks(70, 64));
        assertEquals(List.of(16, 16, 1), Greeting.stacks(33, 16));
        assertEquals(List.of(1, 1), Greeting.stacks(2, 1));
        assertEquals(List.of(5), Greeting.stacks(5, 64));
        assertTrue(Greeting.stacks(0, 64).isEmpty());
    }

    @Test
    void kitItemRecordHoldsTheEntry() {
        assertEquals("minecraft:bread", new KitItem("minecraft:bread", 8).item());
    }
}
