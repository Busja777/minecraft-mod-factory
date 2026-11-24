package com.factory.griefingrules;

import com.factory.griefingrules.GriefingRules.Kind;
import java.util.EnumMap;
import java.util.Map;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.gamerule.v1.GameRuleFactory;
import net.fabricmc.fabric.api.gamerule.v1.GameRuleRegistry;
import net.minecraft.world.GameRules;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Entry point: registers one boolean gamerule per {@link Kind} (category "Mobs", default true).
 * The mixins in the mixin package ask {@link #griefing} wherever vanilla reads mobGriefing for
 * that kind.
 */
public final class GriefingRulesMod implements ModInitializer {
    public static final String MOD_ID = "griefingrules";
    public static final Logger LOG = LoggerFactory.getLogger("Griefing Rules");

    private static final Map<Kind, GameRules.Key<GameRules.BooleanRule>> KEYS = new EnumMap<>(Kind.class);

    @Override
    public void onInitialize() {
        for (Kind kind : Kind.values()) {
            KEYS.put(kind, GameRuleRegistry.register(kind.ruleName(), GameRules.Category.MOBS, GameRuleFactory.createBooleanRule(GriefingRules.DEFAULT)));
        }
        LOG.info("Added the gamerules {}", KEYS.values().stream().map(GameRules.Key::getName).toList());
    }

    /** The gamerule of a kind (null before the mod is initialised). */
    public static GameRules.Key<GameRules.BooleanRule> key(Kind kind) {
        return KEYS.get(kind);
    }

    /**
     * The answer to vanilla's {@code rules.getBoolean(asked)}, where {@code vanilla} is what vanilla
     * read. Only a read of mobGriefing for a known kind is changed; a rule that is missing (a
     * GameRules object made before the mod registered its rules) counts as on.
     */
    public static boolean griefing(GameRules rules, GameRules.Key<?> asked, boolean vanilla, Kind kind) {
        if (asked != GameRules.DO_MOB_GRIEFING || kind == null) return vanilla;
        GameRules.Key<GameRules.BooleanRule> key = KEYS.get(kind);
        GameRules.BooleanRule rule = key == null ? null : rules.get(key);
        return GriefingRules.allows(vanilla, rule == null || rule.get());
    }
}
