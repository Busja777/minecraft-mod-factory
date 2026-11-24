package com.factory.bottledlevels;

/**
 * The experience formula of Minecraft 1.21.1 without any Minecraft types, so it can be tested with
 * plain JUnit. The game keeps a player's experience as a level plus a progress bar (a float from 0
 * to 1 of the points the next level needs); the points are what orbs and bottles carry.
 *
 * <p>Bottled Levels never uses the game's {@code addExperience(-n)} to take points: that adds a
 * float fraction to the bar and walks down level by level in float math, so the result can be off
 * by a point. Instead the new level and the points into it are worked out here in whole numbers and
 * set directly (the way the game's own {@code /xp set} does it).
 */
public final class XpMath {
    private XpMath() {}

    /** A player's experience in whole points: the level and the points collected towards the next one. */
    public record Xp(int level, int points) {}

    /** Points from {@code level} to the next level: PlayerEntity.getNextLevelExperience of 1.21.1. */
    public static int pointsForNextLevel(int level) {
        if (level >= 30) return 112 + (level - 30) * 9;
        return level >= 15 ? 37 + (level - 15) * 5 : 7 + level * 2;
    }

    /** All points a player at the start of {@code level} (empty bar) has collected since level 0. */
    public static long pointsAtLevel(int level) {
        long l = Math.max(0, level);
        if (l <= 16) return l * l + 6 * l;
        if (l <= 31) return (5 * l * l - 81 * l + 720) / 2;
        return (9 * l * l - 325 * l + 4440) / 2;
    }

    /**
     * The points into the current level that the progress bar stands for. The bar is a float, so it
     * is rounded to the nearest point (orbs always carry whole points) and kept between 0 and a full
     * level.
     */
    public static int pointsInLevel(int level, float progress) {
        int next = pointsForNextLevel(level);
        long points = Math.round((double) progress * next);
        return (int) Math.max(0, Math.min(next, points));
    }

    /** All points of a player with {@code level} and the bar at {@code progress}. */
    public static long totalPoints(int level, float progress) {
        return pointsAtLevel(level) + pointsInLevel(level, progress);
    }

    /**
     * Takes {@code cost} points from a player at {@code level} with {@code points} into it, going
     * down as many levels as needed.
     *
     * @return the new level and points into it, or null when the player has fewer than {@code cost}
     *         points in total (then nothing may be taken)
     */
    public static Xp remove(int level, int points, int cost) {
        if (cost < 0) throw new IllegalArgumentException("cost must not be negative: " + cost);
        int l = Math.max(0, level);
        long rest = (long) points - cost;
        while (rest < 0) {
            if (l == 0) return null;
            l--;
            rest += pointsForNextLevel(l);
        }
        // a full bar (rest == the level's whole step) is the start of the next level
        while (rest >= pointsForNextLevel(l)) {
            rest -= pointsForNextLevel(l);
            l++;
        }
        return new Xp(l, (int) rest);
    }

    /** The level and points into it for {@code total} points collected since level 0. */
    public static Xp fromTotal(long total) {
        if (total < 0) throw new IllegalArgumentException("total must not be negative: " + total);
        int l = 0;
        long rest = total;
        while (rest >= pointsForNextLevel(l)) {
            rest -= pointsForNextLevel(l);
            l++;
        }
        return new Xp(l, (int) rest);
    }
}
