package com.factory.stackmore;

import java.util.Map;

/**
 * The rules of Stack More without any Minecraft types, so they can be tested with plain JUnit.
 * Items are named by their registry id ("minecraft:potion").
 *
 * <p>V1.0 raises the stack size of three items that stack poorly in vanilla 1.21.1:
 * <ul>
 *   <li>drinkable potions 1 → 16: drinking takes 1.6 seconds per bottle, so a stack saves space
 *       without speeding up combat;</li>
 *   <li>eggs 16 → 64 and snowballs 16 → 64: they deal no damage to players, a full slot only means
 *       fewer trips to the chest.</li>
 * </ul>
 * Splash and lingering potions stay at 1 on purpose: they are thrown without any wait, so a stack
 * of healing or harming in one hotbar slot would change fights. Ender pearls (movement in fights)
 * and honey bottles are also left as they are in V1.0.
 */
public final class StackRules {
    /** The new stack size per item id. */
    public static final Map<String, Integer> NEW_SIZES = Map.of(
        "minecraft:potion", 16,
        "minecraft:egg", 64,
        "minecraft:snowball", 64);

    /** The vanilla 1.21.1 stack size of the same items (from their Item.Settings). */
    public static final Map<String, Integer> VANILLA_SIZES = Map.of(
        "minecraft:potion", 1,
        "minecraft:egg", 16,
        "minecraft:snowball", 16);

    /** The game's own upper bound for the max_stack_size component (Item.MAX_MAX_COUNT). */
    public static final int GAME_LIMIT = 99;

    private StackRules() {}

    /**
     * The stack size an item gets with the mod.
     *
     * @param itemId       registry id of the item
     * @param vanillaLimit its stack size without the mod
     */
    public static int limitFor(String itemId, int vanillaLimit) {
        Integer size = NEW_SIZES.get(itemId);
        return size == null ? vanillaLimit : size;
    }

    /** Whether the mod changes the item at all. */
    public static boolean changes(String itemId) {
        return NEW_SIZES.containsKey(itemId);
    }

    /**
     * Whether a stack size may be used for an item: within the game's range of 1 to 99, never
     * smaller than vanilla's (the mod only ever lets more fit), and never for an item that takes
     * damage (the game refuses a stackable damageable item).
     */
    public static boolean isAllowed(int size, int vanillaLimit, boolean damageable) {
        return !damageable && size >= 1 && size <= GAME_LIMIT && size >= vanillaLimit;
    }
}
