package com.factory.griefingrules;

import java.util.Map;

/**
 * The pure logic of the mod, without Minecraft classes (covered by JUnit).
 *
 * <p>Vanilla 1.21.1 asks one gamerule, {@code mobGriefing}, at every place where a mob changes
 * blocks. This mod adds one gamerule per kind of griefing and answers those places with
 * "vanilla's mobGriefing AND the rule of this kind". Every new rule is on by default, so nothing
 * changes until an admin switches one off, and {@code mobGriefing false} still turns everything off.
 */
public final class GriefingRules {
    private GriefingRules() {}

    /** One kind of griefing = one new gamerule (category "Mobs"). */
    public enum Kind {
        /** Creeper explosions breaking blocks. */
        CREEPER("creeperGriefing"),
        /** Ghast fireballs breaking blocks and setting fire. */
        GHAST("ghastGriefing"),
        /** The wither's explosions (its spawn blast and its skulls), the blocks it breaks when hurt, and the wither roses it plants. */
        WITHER("witherGriefing"),
        /** Endermen picking up and placing blocks. */
        ENDERMAN("endermanGriefing"),
        /** Ravagers breaking leaves they walk into. */
        RAVAGER("ravagerGriefing");

        private final String ruleName;

        Kind(String ruleName) {
            this.ruleName = ruleName;
        }

        /** The name used with /gamerule. */
        public String ruleName() {
            return ruleName;
        }
    }

    /** Every new rule starts on: the world behaves as in vanilla until an admin changes it. */
    public static final boolean DEFAULT = true;

    // The entities vanilla passes to World#createExplosion with ExplosionSourceType.MOB in 1.21.1
    // (CreeperEntity#explode, FireballEntity#onCollision, WitherEntity#mobTick, WitherSkullEntity#onCollision).
    private static final Map<String, Kind> EXPLOSION_SOURCES = Map.of(
        "minecraft:creeper", Kind.CREEPER,
        "minecraft:fireball", Kind.GHAST,
        "minecraft:wither", Kind.WITHER,
        "minecraft:wither_skull", Kind.WITHER);

    /**
     * Which rule decides about a mob explosion, from the id of the entity that explodes
     * ({@code null}: none of ours, vanilla's mobGriefing alone decides).
     */
    public static Kind explosionKind(String entityTypeId) {
        return entityTypeId == null ? null : EXPLOSION_SOURCES.get(entityTypeId);
    }

    /** Whether the griefing happens: vanilla's mobGriefing and the rule of its kind must both allow it. */
    public static boolean allows(boolean mobGriefing, boolean kindRule) {
        return mobGriefing && kindRule;
    }
}
