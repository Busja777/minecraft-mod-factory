package com.factory.afktag;

/**
 * The tag in front of an AFK player's name in the player list (since 1.2 with the AFK time),
 * without any Minecraft types, so it can be tested with plain JUnit.
 *
 * <p>The time is the player's idle time, counted in server ticks from their last input, so the tag
 * starts at the configured idle time ("[AFK 5m]" with the default 5 minutes) and grows by one
 * minute every 1200 ticks. The player list is sent again only when the shown minutes change.
 */
public final class AfkLabel {
    /** Server ticks in one minute (20 per second). */
    public static final long TICKS_PER_MINUTE = 1200;

    private AfkLabel() {}

    /**
     * The tag text without the name: "[AFK]", or with the time "[AFK 12m]", "[AFK 1h]", "[AFK 2h 5m]".
     *
     * @param idleTicks idle ticks since the player's last input
     * @param showTime  whether to show the time (config {@code showAfkTime})
     */
    public static String label(long idleTicks, boolean showTime) {
        if (!showTime) return "[AFK]";
        return "[AFK " + duration(Math.max(0, idleTicks) / TICKS_PER_MINUTE) + "]";
    }

    /** Whole minutes as "12m", "1h", "1h 5m", "26h 59m". */
    static String duration(long minutes) {
        if (minutes < 60) return minutes + "m";
        long hours = minutes / 60, rest = minutes % 60;
        return rest == 0 ? hours + "h" : hours + "h " + rest + "m";
    }

    /**
     * Whether the shown time changes with this tick, i.e. the player list entry needs to be sent
     * again: once per full idle minute, never in between.
     *
     * @param idleTicks idle ticks after this tick
     */
    public static boolean minuteTurned(long idleTicks) {
        return idleTicks > 0 && idleTicks % TICKS_PER_MINUTE == 0;
    }
}
