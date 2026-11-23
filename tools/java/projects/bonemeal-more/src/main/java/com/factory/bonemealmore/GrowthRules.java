package com.factory.bonemealmore;

import java.util.function.IntPredicate;

/**
 * The growth rules of the mod, without Minecraft classes (tested by JUnit).
 *
 * <p>Sugar cane and cactus: one use of bone meal adds one block on top of the column, the same
 * step a random tick makes when the plant has finished its growth timer. It only works while the
 * column is shorter than three blocks (the height they reach on their own), the space above the
 * top is air inside the world, and the new block could stand there by the game's own placement
 * rule (a cactus must not touch a block at its sides). Otherwise nothing happens and no bone meal
 * is used.
 *
 * <p>Nether wart: one use advances one of its four ages (0 to 3), so a fresh wart is ripe after
 * three uses. A crop jumps 2 to 5 of its 8 ages per use; one of four is the closest fair step for
 * a plant with so few ages, and it never skips the ripe stage. Ripe wart uses no bone meal.
 */
public final class GrowthRules {
    /** Sugar cane and cactus stop growing on their own at this height. */
    public static final int MAX_COLUMN_HEIGHT = 3;
    /** Nether wart is ripe at this age. */
    public static final int NETHER_WART_MAX_AGE = 3;
    /**
     * Ticks after a growth by bone meal in which the same player's further clicks of that
     * right-click are ignored. A game without the mod thinks the bone meal did nothing and tries
     * the item use and the off hand right behind it (a held block would be placed, food eaten);
     * a person cannot click twice that fast.
     */
    public static final long FOLLOW_UP_GUARD_TICKS = 1;

    private GrowthRules() {}

    /** A column of sugar cane or cactus as seen from the clicked block. */
    public record Column(int below, int above) {
        /** Blocks in the column, the clicked one included (capped at {@link #MAX_COLUMN_HEIGHT}). */
        public int height() {
            return below + 1 + above;
        }
    }

    /**
     * Measures the column through the clicked block. {@code sameAt.test(dy)} says whether the block
     * {@code dy} above the clicked one (below for negative {@code dy}) is the same plant. Counting
     * stops at {@link #MAX_COLUMN_HEIGHT}, so a tall column built by hand is never walked through.
     */
    public static Column measure(IntPredicate sameAt) {
        int above = 0;
        int below = 0;
        while (below + 1 + above < MAX_COLUMN_HEIGHT && sameAt.test(above + 1)) above++;
        while (below + 1 + above < MAX_COLUMN_HEIGHT && sameAt.test(-(below + 1))) below++;
        return new Column(below, above);
    }

    /**
     * Whether bone meal grows the column by one block on top.
     *
     * @param insideWorld   the space above the top is inside the world's height limits
     * @param airAboveTop   that space is air
     * @param newBlockStays a new block of the plant could stand there (the game's placement rule)
     */
    public static boolean columnCanGrow(Column column, boolean insideWorld, boolean airAboveTop, boolean newBlockStays) {
        return column.height() < MAX_COLUMN_HEIGHT && insideWorld && airAboveTop && newBlockStays;
    }

    /** Whether bone meal advances nether wart of this age. */
    public static boolean wartCanGrow(int age) {
        return age >= 0 && age < NETHER_WART_MAX_AGE;
    }

    /** The age of nether wart after one use of bone meal. */
    public static int wartNextAge(int age) {
        return wartCanGrow(age) ? age + 1 : age;
    }

    /** Whether a click at tick {@code now} belongs to the right-click that grew a plant at {@code lastGrowth}. */
    public static boolean blocksFollowUp(long lastGrowth, long now) {
        return lastGrowth >= 0 && now >= lastGrowth && now - lastGrowth <= FOLLOW_UP_GUARD_TICKS;
    }
}
