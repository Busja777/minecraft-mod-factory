package com.factory.afktag;

/**
 * What counts as a player's own input, without any Minecraft types, so it can be tested with plain
 * JUnit. The server compares one {@link Sample} per player and tick with the one before.
 */
public final class AfkRules {
    /** Horizontal movement per tick below this is noise (blocks). Sneaking moves about 0.065. */
    public static final double MIN_STEP = 0.01;
    /** Movement per tick above this is a teleport (command, portal), not walking (blocks). */
    public static final double MAX_STEP = 8.0;
    /** Turning the view by less than this is noise (degrees). */
    public static final float MIN_TURN = 0.01f;

    private AfkRules() {}

    /**
     * One look at a player.
     *
     * @param dimension      registry id of the player's world ("minecraft:overworld")
     * @param x              position
     * @param z              position (height is left out: falling, bubble columns and lifts are not input)
     * @param yaw            view direction
     * @param pitch          view direction
     * @param lastActionTime the game's own idle clock (ServerPlayerEntity#getLastActionTime): it changes
     *                       when the player chats, runs a command, swings, uses or attacks something,
     *                       clicks in an inventory, changes the hotbar slot, sneaks, sprints or drops items
     * @param pushedAround   in a vehicle or in water or lava: moving there does not need the player
     * @param steering       in a vehicle and pressing a movement key
     */
    public record Sample(String dimension, double x, double z, float yaw, float pitch, long lastActionTime, boolean pushedAround, boolean steering) {}

    /** Whether the player did something between {@code before} and {@code now} (one tick apart). */
    public static boolean isInput(Sample before, Sample now) {
        if (now.lastActionTime() != before.lastActionTime()) return true;
        if (now.steering()) return true;
        // after a dimension change the numbers are not comparable; the portal walk itself was input
        if (!now.dimension().equals(before.dimension())) return false;
        if (turned(before.yaw(), now.yaw()) || Math.abs(now.pitch() - before.pitch()) >= MIN_TURN) return true;
        if (now.pushedAround() || before.pushedAround()) return false;
        double dx = now.x() - before.x(), dz = now.z() - before.z();
        double step = Math.sqrt(dx * dx + dz * dz);
        return step >= MIN_STEP && step <= MAX_STEP;
    }

    /** Whether the view turned, also across the wrap from 180 to -180 degrees. */
    static boolean turned(float before, float now) {
        float diff = Math.abs(now - before) % 360f;
        if (diff > 180f) diff = 360f - diff;
        return diff >= MIN_TURN;
    }

    /** What a tick changed. */
    public enum Change { NONE, NOW_AFK, BACK }

    /** The idle timer of one player (server thread only). */
    public static final class Timer {
        private Sample last;
        private long idleTicks;
        private boolean afk;

        public boolean isAfk() {
            return afk;
        }

        public long idleTicks() {
            return idleTicks;
        }

        /**
         * Takes this tick's sample.
         *
         * @param timeoutTicks idle ticks after which the player is AFK (at least 1)
         */
        public Change tick(Sample now, long timeoutTicks) {
            Sample before = last;
            last = now;
            if (before == null) return Change.NONE; // the first look has nothing to compare with
            if (isInput(before, now)) {
                idleTicks = 0;
                if (!afk) return Change.NONE;
                afk = false;
                return Change.BACK;
            }
            idleTicks++;
            if (afk || idleTicks < Math.max(1, timeoutTicks)) return Change.NONE;
            afk = true;
            return Change.NOW_AFK;
        }
    }
}
