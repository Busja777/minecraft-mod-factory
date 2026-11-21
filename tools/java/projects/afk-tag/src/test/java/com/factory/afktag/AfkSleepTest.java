package com.factory.afktag;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class AfkSleepTest {
    private static final Set<String> AFK = Set.of("bob", "dave");

    private static List<String> counted(List<String> players, boolean ignoreAfk) {
        return AfkSleep.counted(players, AFK::contains, ignoreAfk);
    }

    @Test
    void leavesAfkPlayersOutInTheirOrder() {
        assertEquals(List.of("ann", "cleo"), counted(List.of("ann", "bob", "cleo", "dave"), true));
        assertEquals(List.of("cleo"), counted(List.of("bob", "cleo"), true));
        assertEquals(List.of(), counted(List.of("bob", "dave"), true));
    }

    @Test
    void withTheSwitchOffEveryoneCounts() {
        List<String> players = List.of("ann", "bob");
        assertSame(players, counted(players, false));
    }

    @Test
    void withoutAfkPlayersTheGamesListIsUsedAsItIs() {
        List<String> players = List.of("ann", "cleo");
        assertSame(players, counted(players, true));
        List<String> none = List.of();
        assertSame(none, counted(none, true));
    }

    @Test
    void neverChangesTheGamesList() {
        List<String> players = new ArrayList<>(List.of("ann", "bob", "cleo"));
        counted(players, true);
        assertEquals(List.of("ann", "bob", "cleo"), players);
    }

    /** Vanilla's rule (SleepManager#getNightSkippingRequirement in 1.21.1), applied to the counted players. */
    private static boolean nightSkips(List<String> players, Set<String> asleep, int percentage, boolean ignoreAfk) {
        List<String> counted = counted(players, ignoreAfk);
        long sleeping = counted.stream().filter(asleep::contains).count();
        int needed = Math.max(1, (int) Math.ceil(counted.size() * percentage / 100f));
        return sleeping >= needed;
    }

    @Test
    void oneAsleepOneAfkSkipsTheNightAtOneHundredPercent() {
        List<String> players = List.of("ann", "bob");
        assertEquals(true, nightSkips(players, Set.of("ann"), 100, true));
        assertEquals(false, nightSkips(players, Set.of("ann"), 100, false));
    }

    @Test
    void nobodyAwakeAndActiveMeansNoSkip() {
        // only AFK players online: nobody sleeps, and vanilla always needs at least one sleeper
        assertEquals(false, nightSkips(List.of("bob", "dave"), Set.of(), 0, true));
        // an AFK player in bed does not count as sleeping either
        assertEquals(false, nightSkips(List.of("ann", "bob"), Set.of("bob"), 50, true));
    }
}
