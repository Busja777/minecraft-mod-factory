package com.factory.afktag;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Predicate;

/**
 * Which players the night-skip check sees, without any Minecraft types. The game counts every
 * non-spectator in a world (SleepManager#update) and needs playersSleepingPercentage of them in bed;
 * with {@code ignoreAfkForSleep} an AFK player is left out of that list, so they count as neither
 * sleeping nor required, the same way vanilla already treats spectators.
 */
public final class AfkSleep {
    private AfkSleep() {}

    /**
     * The players the sleep check should count. Returns {@code players} itself when nothing is left
     * out (no copy on the common path); otherwise a new list, the game's own list is never changed.
     */
    public static <P> List<P> counted(List<P> players, Predicate<P> isAfk, boolean ignoreAfk) {
        if (!ignoreAfk || players.isEmpty()) return players;
        List<P> kept = null;
        for (int i = 0; i < players.size(); i++) {
            P player = players.get(i);
            if (isAfk.test(player)) {
                if (kept == null) kept = new ArrayList<>(players.subList(0, i));
            } else if (kept != null) {
                kept.add(player);
            }
        }
        return kept == null ? players : kept;
    }
}
