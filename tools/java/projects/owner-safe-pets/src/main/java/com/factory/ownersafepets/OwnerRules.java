package com.factory.ownersafepets;

import java.util.UUID;

/**
 * The rules of Owner Safe Pets without any Minecraft types, so they can be tested with plain JUnit.
 * Entities are named by their UUID.
 */
public final class OwnerRules {
    private OwnerRules() {}

    /**
     * Whether a hit on a pet is cancelled.
     *
     * @param petOwner     the UUID the pet stores as its owner (null: nobody owns it)
     * @param tamed        whether the pet is tamed (a wolf, cat or parrot can keep an owner id while untamed)
     * @param attacker     who is responsible for the damage: the player for a hit, the shooter for an
     *                     arrow or trident, the one who lit the TNT for an explosion (null: nobody)
     * @param directSource the entity that touched the pet: the player for a hit, the arrow for a shot
     * @param unstoppable  whether the damage type ignores invulnerability (the void, /kill); those stay
     */
    public static boolean blocksDamage(UUID petOwner, boolean tamed, UUID attacker, UUID directSource, boolean unstoppable) {
        if (petOwner == null || !tamed || unstoppable) return false;
        return petOwner.equals(attacker) || petOwner.equals(directSource);
    }

    /**
     * Whether a hit on a pet is cancelled, with the settings of config/ownersafepets.json (since 1.1).
     * With the default settings this is exactly the 1.0 rule above.
     *
     * @param explosion        whether the damage is an explosion (TNT, end crystal, firework)
     * @param attackerSneaking whether the one responsible for the damage is sneaking right now
     * @param config           the settings
     */
    public static boolean blocksDamage(UUID petOwner, boolean tamed, UUID attacker, UUID directSource, boolean unstoppable,
                                       boolean explosion, boolean attackerSneaking, OwnerConfig config) {
        return blocksDamage(petOwner, tamed, attacker, directSource, unstoppable, explosion, false, attackerSneaking, config);
    }

    /**
     * Whether a hit on a pet is cancelled, with every setting (since 1.2).
     *
     * @param potion whether the damage is a potion's magic (instant damage from a splash potion or a
     *               lingering cloud: the game's "indirect magic", which names the thrower as attacker).
     *               It was already cancelled in 1.0 and 1.1 like an arrow; with
     *               {@code protectFromOwnerPotions} off it goes through.
     */
    public static boolean blocksDamage(UUID petOwner, boolean tamed, UUID attacker, UUID directSource, boolean unstoppable,
                                       boolean explosion, boolean potion, boolean attackerSneaking, OwnerConfig config) {
        if (!blocksDamage(petOwner, tamed, attacker, directSource, unstoppable)) return false;
        if (explosion && !config.protectFromOwnerExplosions()) return false;
        if (potion && !config.protectFromOwnerPotions()) return false;
        // Only the owner's own hand (hit or sweep): the owner is both attacker and direct source.
        // An arrow is not the owner, so sneaking while it lands changes nothing.
        if (config.sneakToHit() && attackerSneaking && !explosion && petOwner.equals(attacker) && petOwner.equals(directSource)) return false;
        return true;
    }

    /**
     * Whether a potion effect from a splash potion or a lingering cloud is kept away from a pet
     * (since 1.2). Only harmful effects (poison, weakness, slowness, wither …) of a potion the pet's
     * own owner threw; helpful and neutral effects (healing, regeneration, glowing …) still apply.
     *
     * @param petOwner the UUID the pet stores as its owner (null: nobody owns it)
     * @param tamed    whether the pet is tamed
     * @param thrower  who threw the potion (the owner of the potion or of its cloud; null: nobody,
     *                 e.g. a dispenser)
     * @param harmful  whether the effect is in the game's "harmful" category
     * @param config   the settings
     */
    public static boolean blocksEffect(UUID petOwner, boolean tamed, UUID thrower, boolean harmful, OwnerConfig config) {
        if (petOwner == null || !tamed || !harmful || !config.protectFromOwnerPotions()) return false;
        return petOwner.equals(thrower);
    }

    /**
     * Whether a pet is left out of a lingering cloud altogether (since 1.2): when the cloud would give
     * it nothing but blocked effects. Then the pet does not use the cloud up either (every entity the
     * cloud affects makes it a little smaller). A cloud with a helpful effect still counts the pet.
     *
     * @param blocked for each effect of the cloud, whether {@link #blocksEffect} keeps it away
     */
    public static boolean skipsCloud(boolean[] blocked) {
        if (blocked.length == 0) return false;
        for (boolean b : blocked) if (!b) return false;
        return true;
    }

    /**
     * Whether a pet needs its sit order back after a cancelled hit. Wolves and parrots drop the order
     * on every hit before the game asks whether the hit does damage; the sitting pose itself only
     * ends a tick later. A pet still in the sitting pose without the order lost it to this hit.
     */
    public static boolean restoreSitOrder(boolean inSittingPose, boolean sitOrder) {
        return inSittingPose && !sitOrder;
    }
}
