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
     * Whether a pet needs its sit order back after a cancelled hit. Wolves and parrots drop the order
     * on every hit before the game asks whether the hit does damage; the sitting pose itself only
     * ends a tick later. A pet still in the sitting pose without the order lost it to this hit.
     */
    public static boolean restoreSitOrder(boolean inSittingPose, boolean sitOrder) {
        return inSittingPose && !sitOrder;
    }
}
