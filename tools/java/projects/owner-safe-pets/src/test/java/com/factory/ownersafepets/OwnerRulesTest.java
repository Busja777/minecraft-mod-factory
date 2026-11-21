package com.factory.ownersafepets;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;
import org.junit.jupiter.api.Test;

class OwnerRulesTest {
    private static final UUID OWNER = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID STRANGER = UUID.fromString("00000000-0000-0000-0000-000000000002");
    private static final UUID ARROW = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ZOMBIE = UUID.fromString("00000000-0000-0000-0000-000000000004");

    @Test
    void theOwnersHitIsCancelled() {
        // melee and sweeping: the player is attacker and direct source
        assertTrue(OwnerRules.blocksDamage(OWNER, true, OWNER, OWNER, false));
    }

    @Test
    void theOwnersShotsAndExplosionsAreCancelled() {
        // arrow, trident: the projectile hits, the owner is named as attacker
        assertTrue(OwnerRules.blocksDamage(OWNER, true, OWNER, ARROW, false));
        // explosion of the owner's TNT: the TNT is the direct source, the owner the attacker
        assertTrue(OwnerRules.blocksDamage(OWNER, true, OWNER, UUID.randomUUID(), false));
        // a source that only names the owner as the direct entity (e.g. made by another mod)
        assertTrue(OwnerRules.blocksDamage(OWNER, true, null, OWNER, false));
    }

    @Test
    void everyoneElseStillHurts() {
        assertFalse(OwnerRules.blocksDamage(OWNER, true, STRANGER, STRANGER, false), "another player");
        assertFalse(OwnerRules.blocksDamage(OWNER, true, STRANGER, ARROW, false), "another player's arrow");
        assertFalse(OwnerRules.blocksDamage(OWNER, true, ZOMBIE, ZOMBIE, false), "a zombie");
        assertFalse(OwnerRules.blocksDamage(OWNER, true, null, null, false), "fall, fire, drowning, lava");
    }

    @Test
    void untamedOrOwnerlessAnimalsAreNotProtected() {
        assertFalse(OwnerRules.blocksDamage(null, true, OWNER, OWNER, false), "a skeleton trap horse: tame without owner");
        assertFalse(OwnerRules.blocksDamage(OWNER, false, OWNER, OWNER, false), "an owner id on an untamed animal");
        assertFalse(OwnerRules.blocksDamage(null, false, null, null, false));
    }

    @Test
    void theVoidAndKillStillWork() {
        assertFalse(OwnerRules.blocksDamage(OWNER, true, OWNER, OWNER, true));
    }

    @Test
    void aSittingPetKeepsItsSitOrder() {
        assertTrue(OwnerRules.restoreSitOrder(true, false), "the hit removed the order, the pose is still there");
        assertFalse(OwnerRules.restoreSitOrder(true, true), "the order is still there");
        assertFalse(OwnerRules.restoreSitOrder(false, false), "a standing pet stays standing");
        assertFalse(OwnerRules.restoreSitOrder(false, true), "told to sit, not yet sitting: nothing to restore");
    }
}
