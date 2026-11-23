package com.factory.bottledlevels;

/**
 * The rules of Bottled Levels without any Minecraft types, so they can be tested with plain JUnit.
 * Blocks and items are named by their registry id ("minecraft:glass_bottle").
 */
public final class BottleRules {
    private BottleRules() {}

    public static final String GLASS_BOTTLE = "minecraft:glass_bottle";
    public static final String EXPERIENCE_BOTTLE = "minecraft:experience_bottle";
    public static final String ENCHANTING_TABLE = "minecraft:enchanting_table";

    /** Experience points one bottling takes from the player. */
    public static final int COST = 50;

    /** Share of the taken points that is lost, in percent: bottling is a convenience, not a free copy. */
    public static final int LOSS_PERCENT = 10;

    /**
     * Highest amount a bottle can release. Only bottles changed by commands can claim more; they are
     * cut to this so one bottle cannot flood the world with orbs.
     */
    public static final int MAX_STORED = 100_000;

    /** Points lost when {@code cost} points are bottled: {@link #LOSS_PERCENT} rounded up, so never 0. */
    public static int loss(int cost) {
        if (cost <= 0) return 0;
        return (int) (((long) cost * LOSS_PERCENT + 99) / 100);
    }

    /** Points the bottle holds (and releases when thrown) after bottling {@code cost} points. */
    public static int stored(int cost) {
        return cost - loss(cost);
    }

    /** The amount a bottle with {@code raw} in its data releases: 0 (a plain bottle) unless positive. */
    public static int releasable(int raw) {
        return raw <= 0 ? 0 : Math.min(raw, MAX_STORED);
    }

    /** What a right-click on a block does for one hand. */
    public enum Outcome {
        /** Not ours: the game handles the click as usual. */
        PASS,
        /** This hand's glass bottle is filled with the player's experience. */
        FILL,
        /** This hand would fill, but the player has too few points: nothing happens, with a message. */
        NOT_ENOUGH,
        /**
         * The hand holds a Bottle o' Enchanting: nothing happens, so sneak-clicking the table again
         * after the last glass bottle was filled never throws the bottle that is now in the hand.
         */
        KEEP_BOTTLE
    }

    /** Which hand's glass bottle is filled: the main hand first, then the off hand. */
    public static boolean fillsWithMainHand(String mainHandId) {
        return GLASS_BOTTLE.equals(mainHandId);
    }

    /**
     * The outcome of a right-click on a block with one hand.
     *
     * @param sneaking   whether the player sneaks (only a sneak-click bottles; a plain click opens the table)
     * @param blockId    the clicked block
     * @param mainHand   whether the click is for the main hand (the game tries the main hand, then the off hand)
     * @param mainHandId the item in the main hand ("minecraft:air" when empty)
     * @param offHandId  the item in the off hand
     * @param enoughXp   whether the player has at least {@link #COST} points
     */
    public static Outcome decide(boolean sneaking, String blockId, boolean mainHand, String mainHandId, String offHandId, boolean enoughXp) {
        if (!sneaking || !ENCHANTING_TABLE.equals(blockId)) return Outcome.PASS;
        String held = mainHand ? mainHandId : offHandId;
        boolean filling = mainHand ? fillsWithMainHand(mainHandId) : !fillsWithMainHand(mainHandId) && GLASS_BOTTLE.equals(offHandId);
        if (filling) return enoughXp ? Outcome.FILL : Outcome.NOT_ENOUGH;
        if (EXPERIENCE_BOTTLE.equals(held)) return Outcome.KEEP_BOTTLE;
        return Outcome.PASS;
    }

    /**
     * Ticks after a handled sneak-click in which the same player's next item or block use is ignored.
     * A game without the mod does not know the click was used up and sends an item use right behind it
     * (the bottle now in the hand would fly), then tries the off hand (a torch there would be placed);
     * a person cannot click twice that fast (holding the button repeats every 4 ticks).
     */
    public static final long FOLLOW_UP_TICKS = 1;

    /** Whether a use at {@code now} comes right behind a handled click at {@code lastClick} (-1: none yet). */
    public static boolean isFollowUp(long lastClick, long now) {
        return lastClick >= 0 && now >= lastClick && now - lastClick <= FOLLOW_UP_TICKS;
    }
}
