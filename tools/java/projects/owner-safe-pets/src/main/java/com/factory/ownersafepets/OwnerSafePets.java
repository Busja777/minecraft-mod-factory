package com.factory.ownersafepets;

import java.util.UUID;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.entity.event.v1.ServerLivingEntityEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.entity.Entity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.Tameable;
import net.minecraft.entity.damage.DamageSource;
import net.minecraft.entity.passive.AbstractHorseEntity;
import net.minecraft.entity.passive.TameableEntity;
import net.minecraft.registry.tag.DamageTypeTags;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Entry point: tamed animals take no damage from their own owner.
 *
 * <p>No mixin. Fabric API's {@code ServerLivingEntityEvents.ALLOW_DAMAGE} runs inside
 * {@code LivingEntity.damage} on the server, after the game's own invulnerability checks and before
 * anything happens to the pet (no health loss, no red flash, no knockback from the hit, no anger, no
 * sleeping pet woken up). Every kind of damage goes through it: melee and sweeping hits use the
 * player's attack source, arrows and tridents name their shooter as attacker, and an explosion
 * names the player who caused it (lit TNT, an exploding end crystal they hit).
 *
 * <p>Pets: everything that implements {@link Tameable}, i.e. wolves, cats, parrots (the
 * TameableEntity family) and horses, donkeys, mules, llamas, camels, skeleton and zombie horses
 * (the AbstractHorseEntity family), once a player has tamed them.
 *
 * <p>Since 1.1 the settings in config/ownersafepets.json (see {@link OwnerConfig}) are read on
 * every server start; without the file the mod behaves exactly like 1.0.
 */
public final class OwnerSafePets implements ModInitializer {
    public static final String MOD_ID = "ownersafepets";
    public static final Logger LOG = LoggerFactory.getLogger("Owner Safe Pets");

    private static volatile OwnerConfig config = OwnerConfig.defaults();

    @Override
    public void onInitialize() {
        ServerLifecycleEvents.SERVER_STARTING.register(server -> {
            config = OwnerConfig.load(FabricLoader.getInstance().getConfigDir(), LOG::warn);
            LOG.info("Settings: sneakToHit={}, protectFromOwnerExplosions={}", config.sneakToHit(), config.protectFromOwnerExplosions());
        });
        ServerLivingEntityEvents.ALLOW_DAMAGE.register(OwnerSafePets::allowDamage);
    }

    /** The settings in use (the config file sets them on server start). */
    public static OwnerConfig config() {
        return config;
    }

    /** For the game tests: other settings than the config file's. */
    public static void setConfig(OwnerConfig settings) {
        config = settings;
    }

    /** ALLOW_DAMAGE: false cancels the damage (the game then treats the hit as having missed). */
    static boolean allowDamage(LivingEntity entity, DamageSource source, float amount) {
        if (!(entity instanceof Tameable pet)) return true;
        UUID owner = pet.getOwnerUuid();
        if (owner == null) return true;
        Entity attacker = source.getAttacker();
        if (!OwnerRules.blocksDamage(owner, isTamed(entity), uuid(attacker), uuid(source.getSource()),
            source.isIn(DamageTypeTags.BYPASSES_INVULNERABILITY), source.isIn(DamageTypeTags.IS_EXPLOSION),
            attacker != null && attacker.isSneaking(), config)) return true;
        // Wolves and parrots stand up on any hit before this event runs; a cancelled hit keeps them seated.
        if (entity instanceof TameableEntity tameable && OwnerRules.restoreSitOrder(tameable.isInSittingPose(), tameable.isSitting())) {
            tameable.setSitting(true);
        }
        return false;
    }

    private static boolean isTamed(LivingEntity entity) {
        if (entity instanceof TameableEntity tameable) return tameable.isTamed();
        if (entity instanceof AbstractHorseEntity horse) return horse.isTame();
        return true; // another Tameable (from a mod): an owner id means it has an owner
    }

    private static UUID uuid(Entity entity) {
        return entity == null ? null : entity.getUuid();
    }
}
