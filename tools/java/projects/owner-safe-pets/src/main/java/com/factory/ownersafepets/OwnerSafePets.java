package com.factory.ownersafepets;

import java.util.UUID;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.entity.event.v1.ServerLivingEntityEvents;
import net.minecraft.entity.Entity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.Tameable;
import net.minecraft.entity.damage.DamageSource;
import net.minecraft.entity.passive.AbstractHorseEntity;
import net.minecraft.entity.passive.TameableEntity;
import net.minecraft.registry.tag.DamageTypeTags;

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
 */
public final class OwnerSafePets implements ModInitializer {
    public static final String MOD_ID = "ownersafepets";

    @Override
    public void onInitialize() {
        ServerLivingEntityEvents.ALLOW_DAMAGE.register(OwnerSafePets::allowDamage);
    }

    /** ALLOW_DAMAGE: false cancels the damage (the game then treats the hit as having missed). */
    static boolean allowDamage(LivingEntity entity, DamageSource source, float amount) {
        if (!(entity instanceof Tameable pet)) return true;
        UUID owner = pet.getOwnerUuid();
        if (owner == null) return true;
        if (!OwnerRules.blocksDamage(owner, isTamed(entity), uuid(source.getAttacker()), uuid(source.getSource()),
            source.isIn(DamageTypeTags.BYPASSES_INVULNERABILITY))) return true;
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
