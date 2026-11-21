package com.factory.ownersafepets;

import static org.junit.jupiter.api.Assertions.assertEquals;
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

    private static final OwnerConfig DEFAULTS = OwnerConfig.defaults();
    private static final OwnerConfig SNEAK = new OwnerConfig(true, true);
    private static final OwnerConfig NO_EXPLOSION_GUARD = new OwnerConfig(false, false);

    private static boolean blocks(UUID attacker, UUID direct, boolean explosion, boolean sneaking, OwnerConfig config) {
        return OwnerRules.blocksDamage(OWNER, true, attacker, direct, false, explosion, sneaking, config);
    }

    @Test
    void theDefaultSettingsGiveThe10Rule() {
        UUID tnt = UUID.randomUUID();
        // every case of the 1.0 rule, sneaking or not
        for (boolean sneaking : new boolean[] {false, true}) {
            assertTrue(blocks(OWNER, OWNER, false, sneaking, DEFAULTS), "the owner's hit");
            assertTrue(blocks(OWNER, ARROW, false, sneaking, DEFAULTS), "the owner's arrow");
            assertTrue(blocks(OWNER, tnt, true, sneaking, DEFAULTS), "the owner's TNT");
            assertTrue(blocks(null, OWNER, false, sneaking, DEFAULTS), "a source naming only the owner");
            assertFalse(blocks(STRANGER, STRANGER, false, sneaking, DEFAULTS), "another player");
            assertFalse(blocks(null, null, false, sneaking, DEFAULTS), "fall damage");
        }
        assertFalse(OwnerRules.blocksDamage(OWNER, true, OWNER, OWNER, true, false, false, DEFAULTS), "the void and /kill");
        assertFalse(OwnerRules.blocksDamage(OWNER, false, OWNER, OWNER, false, false, false, DEFAULTS), "untamed");
        assertFalse(OwnerRules.blocksDamage(null, true, OWNER, OWNER, false, false, false, DEFAULTS), "no owner");
    }

    @Test
    void withSneakToHitASneakingOwnersOwnHitHurts() {
        assertFalse(blocks(OWNER, OWNER, false, true, SNEAK), "sneaking owner's hit or sweep");
        assertTrue(blocks(OWNER, OWNER, false, false, SNEAK), "standing owner's hit is still cancelled");
        assertTrue(blocks(OWNER, ARROW, false, true, SNEAK), "an arrow landing while the owner sneaks is still cancelled");
        assertTrue(blocks(OWNER, UUID.randomUUID(), true, true, SNEAK), "the owner's TNT is still cancelled");
        assertTrue(blocks(null, OWNER, false, true, SNEAK), "a source that only names the owner as direct entity");
    }

    @Test
    void withoutTheExplosionGuardTheOwnersExplosionsHurt() {
        UUID tnt = UUID.randomUUID();
        assertFalse(blocks(OWNER, tnt, true, false, NO_EXPLOSION_GUARD), "the owner's TNT");
        assertTrue(blocks(OWNER, OWNER, false, false, NO_EXPLOSION_GUARD), "the owner's hit is still cancelled");
        assertTrue(blocks(OWNER, ARROW, false, false, NO_EXPLOSION_GUARD), "the owner's arrow is still cancelled");
        assertFalse(blocks(STRANGER, tnt, true, false, DEFAULTS), "someone else's TNT always hurts");
    }

    @Test
    void aSittingPetKeepsItsSitOrder() {
        assertTrue(OwnerRules.restoreSitOrder(true, false), "the hit removed the order, the pose is still there");
        assertFalse(OwnerRules.restoreSitOrder(true, true), "the order is still there");
        assertFalse(OwnerRules.restoreSitOrder(false, false), "a standing pet stays standing");
        assertFalse(OwnerRules.restoreSitOrder(false, true), "told to sit, not yet sitting: nothing to restore");
    }

    private static final OwnerConfig NO_POTION_GUARD = new OwnerConfig(false, true, false);

    @Test
    void theOwnersHarmfulPotionEffectsAreKeptAway() {
        assertTrue(OwnerRules.blocksEffect(OWNER, true, OWNER, true, DEFAULTS), "poison, weakness, slowness from the owner");
        assertTrue(OwnerRules.blocksEffect(OWNER, true, OWNER, true, SNEAK), "sneakToHit is only about the owner's hand");
        assertTrue(OwnerRules.blocksEffect(OWNER, true, OWNER, true, NO_EXPLOSION_GUARD), "the explosion switch changes nothing here");
    }

    @Test
    void helpfulEffectsAndOtherThrowersStillCount() {
        assertFalse(OwnerRules.blocksEffect(OWNER, true, OWNER, false, DEFAULTS), "healing, regeneration from the owner");
        assertFalse(OwnerRules.blocksEffect(OWNER, true, STRANGER, true, DEFAULTS), "another player's poison");
        assertFalse(OwnerRules.blocksEffect(OWNER, true, null, true, DEFAULTS), "a dispenser's potion");
        assertFalse(OwnerRules.blocksEffect(OWNER, false, OWNER, true, DEFAULTS), "an untamed animal");
        assertFalse(OwnerRules.blocksEffect(null, true, OWNER, true, DEFAULTS), "no owner");
    }

    @Test
    void withoutThePotionGuardTheOwnersPotionsWorkAsInVanilla() {
        assertFalse(OwnerRules.blocksEffect(OWNER, true, OWNER, true, NO_POTION_GUARD), "the owner's poison");
        UUID potion = UUID.randomUUID();
        // instant damage: the thrown potion (or cloud) is the direct source, the thrower the attacker
        assertFalse(OwnerRules.blocksDamage(OWNER, true, OWNER, potion, false, false, true, false, NO_POTION_GUARD), "the owner's instant damage");
        assertTrue(OwnerRules.blocksDamage(OWNER, true, OWNER, OWNER, false, false, false, false, NO_POTION_GUARD), "the owner's hit is still cancelled");
        assertTrue(OwnerRules.blocksDamage(OWNER, true, OWNER, ARROW, false, false, false, false, NO_POTION_GUARD), "the owner's arrow is still cancelled");
    }

    @Test
    void theOwnersInstantDamageIsCancelledByDefaultAsIn11() {
        UUID potion = UUID.randomUUID();
        assertTrue(OwnerRules.blocksDamage(OWNER, true, OWNER, potion, false, false, true, false, DEFAULTS));
        assertTrue(OwnerRules.blocksDamage(OWNER, true, OWNER, potion, false, false, true, true, SNEAK), "sneaking changes nothing for a potion");
        assertFalse(OwnerRules.blocksDamage(OWNER, true, STRANGER, potion, false, false, true, false, DEFAULTS), "another player's potion hurts");
        // the 8-argument rule of 1.1 is the 9-argument rule without a potion
        for (OwnerConfig c : new OwnerConfig[] {DEFAULTS, SNEAK, NO_EXPLOSION_GUARD, NO_POTION_GUARD}) {
            for (boolean explosion : new boolean[] {false, true}) for (boolean sneaking : new boolean[] {false, true}) {
                assertEquals(OwnerRules.blocksDamage(OWNER, true, OWNER, potion, false, explosion, sneaking, c),
                    OwnerRules.blocksDamage(OWNER, true, OWNER, potion, false, explosion, false, sneaking, c));
            }
        }
    }

    @Test
    void aPetLeavesTheCloudOnlyWhenEveryEffectIsKeptAway() {
        assertTrue(OwnerRules.skipsCloud(new boolean[] {true}), "the owner's poison cloud");
        assertTrue(OwnerRules.skipsCloud(new boolean[] {true, true}));
        assertFalse(OwnerRules.skipsCloud(new boolean[] {true, false}), "turtle master: slowness kept away, resistance applies");
        assertFalse(OwnerRules.skipsCloud(new boolean[] {false}), "a regeneration cloud");
        assertFalse(OwnerRules.skipsCloud(new boolean[] {}), "a cloud without effects is the game's business");
    }
}
