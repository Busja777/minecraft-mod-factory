package com.factory.replantclick;

import java.util.List;
import java.util.Set;

/**
 * The rules of Replant Click without any Minecraft types, so they can be tested with plain JUnit.
 * Blocks and items are named by their registry id ("minecraft:wheat").
 */
public final class HarvestRules {
    /**
     * Plants that are harvested and replanted: the four farmland crops of V1.0, and since V1.1
     * nether wart (ripe at age 3) and cocoa pods (ripe at age 2, replanted facing the same log side).
     */
    public static final Set<String> CROPS = Set.of("minecraft:wheat", "minecraft:carrots", "minecraft:potatoes", "minecraft:beetroots",
        "minecraft:nether_wart", "minecraft:cocoa");

    /** Items that keep their own use on a crop, so right-clicking with them never harvests. */
    public static final Set<String> KEEP_ITEM_USE = Set.of("minecraft:bone_meal");

    private HarvestRules() {}

    /**
     * Whether a right-click should harvest and replant.
     *
     * @param blockId    registry id of the clicked block
     * @param age        its current age
     * @param maxAge     the age at which it is fully grown
     * @param sneaking   whether the player sneaks (sneaking keeps the vanilla behaviour, e.g. placing blocks)
     * @param heldItemId registry id of the item in the main hand ("minecraft:air" when empty)
     */
    public static boolean isHarvestable(String blockId, int age, int maxAge, boolean sneaking, String heldItemId) {
        if (sneaking) return false;
        if (!CROPS.contains(blockId)) return false;
        if (maxAge <= 0 || age < maxAge) return false;
        return !KEEP_ITEM_USE.contains(heldItemId);
    }

    /**
     * Ticks after a harvest in which the same player's item use is ignored. A game without the mod
     * does not know the click was used up and sends an item use right behind it (an ender pearl
     * would fly, food would be eaten); a person cannot click twice that fast.
     */
    public static final long ITEM_USE_GUARD_TICKS = 1;

    /** Whether an item use at {@code now} comes right behind a harvest at {@code lastHarvest} (-1: none yet). */
    public static boolean blocksItemUse(long lastHarvest, long now) {
        return lastHarvest >= 0 && now >= lastHarvest && now - lastHarvest <= ITEM_USE_GUARD_TICKS;
    }

    /**
     * Plants a right-click with a hoe also harvests around the clicked one (since 1.2): the
     * farmland crops and nether wart, which grow in flat fields. Cocoa pods hang on the sides of
     * logs, not in a flat grid, so they stay single.
     */
    public static final Set<String> AREA_CROPS = Set.of("minecraft:wheat", "minecraft:carrots", "minecraft:potatoes", "minecraft:beetroots",
        "minecraft:nether_wart");

    /** The eight neighbours of the clicked crop on the same y level, as {dx, dz}, row by row. */
    public static final List<int[]> AREA_OFFSETS = List.of(
        new int[] {-1, -1}, new int[] {0, -1}, new int[] {1, -1},
        new int[] {-1, 0}, new int[] {1, 0},
        new int[] {-1, 1}, new int[] {0, 1}, new int[] {1, 1});

    /**
     * Whether a harvest of {@code blockId} also harvests the ripe crops of the same kind in the 3×3
     * area around it: only with a hoe in the main hand, only for {@link #AREA_CROPS}, and only while
     * the setting {@code areaWithHoe} is on.
     */
    public static boolean harvestsArea(String blockId, boolean holdingHoe, boolean areaWithHoe) {
        return areaWithHoe && holdingHoe && AREA_CROPS.contains(blockId);
    }

    /**
     * Whether the hoe may pay one more point of durability for a neighbour crop. The hoe never breaks:
     * at one point left it stops (a hit of 1 would break it). Unbreakable hoes always may.
     */
    public static boolean hoeCanTakeHit(boolean damageable, int damage, int maxDamage) {
        return !damageable || maxDamage - damage > 1;
    }

    /** One stack of drops as the rules see it. */
    public record Drop(String itemId, int count) {}

    /**
     * Which drop gives up one item for replanting: the first non-empty stack of the seed item.
     *
     * @return its index in {@code drops}, or -1 when the drops hold no seed (then nothing is harvested)
     */
    public static int replantIndex(List<Drop> drops, String seedId) {
        for (int i = 0; i < drops.size(); i++) {
            Drop d = drops.get(i);
            if (d.count() > 0 && d.itemId().equals(seedId)) return i;
        }
        return -1;
    }
}
