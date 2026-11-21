package com.factory.patientanvil;

/**
 * The rules of Patient Anvil without any Minecraft types, so they can be tested with plain JUnit.
 *
 * <p>Vanilla 1.21.1 ({@code AnvilScreenHandler#updateResult}) works out the level cost and then
 * empties the result when {@code cost >= 40} and the player is not in creative mode; the client
 * draws "Too Expensive!" for the same numbers. Taking the result only needs
 * {@code levels >= cost} ({@code canTakeOutput}), with no upper limit. Patient Anvil moves only the
 * point where the result is refused; the cost itself is never touched.
 */
public final class AnvilRules {
    /** Vanilla refuses a result from this cost on. */
    public static final int VANILLA_LIMIT = 40;
    /** A limit no cost reaches (the game clamps costs to this value). */
    public static final int NO_LIMIT = Integer.MAX_VALUE;

    private AnvilRules() {}

    /**
     * From which cost the anvil refuses the result.
     *
     * @param enchantsAStack vanilla marks "put enchantments on more than one item at once" by setting
     *                       the cost to 40 so that it is refused; that stays refused
     */
    public static int refuseFrom(boolean enchantsAStack) {
        return enchantsAStack ? VANILLA_LIMIT : NO_LIMIT;
    }

    /** The refusal check as the game runs it, with the limit from {@link #refuseFrom}. */
    public static boolean refuses(int cost, boolean creative, int limit) {
        return !creative && cost >= limit;
    }

    /** Whether the player can take the result: vanilla's own check, unchanged by the mod. */
    public static boolean canTake(int levels, int cost, boolean creative) {
        return (creative || levels >= cost) && cost > 0;
    }

    /**
     * From which cost the anvil screen writes "Too Expensive!" instead of the cost (client side).
     * When the server sent a result, it is not too expensive, so the real cost is shown; when the
     * result slot is empty (a server without the mod, or a stack), the vanilla text stays.
     */
    public static int labelFrom(boolean resultShown) {
        return resultShown ? NO_LIMIT : VANILLA_LIMIT;
    }
}
