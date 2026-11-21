package com.factory.ownersafepets.gametest;

import com.factory.ownersafepets.OwnerConfig;
import com.factory.ownersafepets.OwnerSafePets;
import java.util.List;
import net.minecraft.component.type.PotionContentsComponent;
import net.minecraft.entity.AreaEffectCloudEntity;
import net.fabricmc.fabric.api.gametest.v1.FabricGameTest;
import net.minecraft.block.Blocks;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.TntEntity;
import net.minecraft.entity.effect.StatusEffects;
import net.minecraft.entity.mob.MobEntity;
import net.minecraft.entity.mob.ZombieEntity;
import net.minecraft.entity.passive.AbstractHorseEntity;
import net.minecraft.entity.passive.TameableEntity;
import net.minecraft.entity.passive.WolfEntity;
import net.minecraft.entity.projectile.ArrowEntity;
import net.minecraft.entity.projectile.PersistentProjectileEntity;
import net.minecraft.entity.projectile.thrown.PotionEntity;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.potion.Potion;
import net.minecraft.potion.Potions;
import net.minecraft.registry.entry.RegistryEntry;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.test.GameTest;
import net.minecraft.test.TestContext;
import net.minecraft.util.Hand;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.GameMode;
import net.minecraft.world.World;

/**
 * In-world tests on a headless game test server (gradlew :owner-safe-pets:runGametest).
 * Mock server players hit through the real {@code PlayerEntity.attack}; arrows fly for real; the
 * explosions are real explosions that break no blocks. Animals have no AI so they stay in place.
 * Tests with other settings than the defaults set them and put the defaults back within the same
 * call, so the tests running next to them see the defaults.
 */
public class OwnerSafePetsGameTest implements FabricGameTest {
    private static final Vec3d PET = new Vec3d(2.5, 2, 2.5);

    /** A stone floor at y = 1, so everything stands at y = 2. */
    private static void floor(TestContext ctx) {
        for (int x = 0; x < 7; x++) for (int z = 0; z < 7; z++) ctx.setBlockState(x, 1, z, Blocks.STONE);
    }

    @SuppressWarnings("removal") // the mock server player is deprecated in 1.21.1 but still the way to test the server path
    private static ServerPlayerEntity player(TestContext ctx, Vec3d at, float yaw) {
        ServerPlayerEntity player = ctx.createMockCreativeServerPlayerInWorld();
        player.changeGameMode(GameMode.SURVIVAL);
        Vec3d abs = ctx.getAbsolute(at);
        player.refreshPositionAndAngles(abs.x, abs.y, abs.z, yaw, 0);
        return player;
    }

    private static ServerPlayerEntity player(TestContext ctx) {
        return player(ctx, new Vec3d(0.5, 2, 0.5), 0);
    }

    private static <E extends MobEntity> E still(TestContext ctx, EntityType<E> type, Vec3d at) {
        E mob = ctx.spawnEntity(type, at);
        mob.setAiDisabled(true);
        return mob;
    }

    private static WolfEntity wolf(TestContext ctx, Vec3d at, ServerPlayerEntity owner) {
        WolfEntity wolf = still(ctx, EntityType.WOLF, at);
        if (owner != null) wolf.setOwner(owner);
        return wolf;
    }

    private static boolean unhurt(LivingEntity pet) {
        return pet.getHealth() == pet.getMaxHealth();
    }

    private static String hp(LivingEntity pet) {
        return pet.getHealth() + "/" + pet.getMaxHealth();
    }

    private static void shoot(TestContext ctx, ServerPlayerEntity shooter, Vec3d from) {
        shoot(ctx, shooter, from, new ItemStack(Items.ARROW));
    }

    private static void shoot(TestContext ctx, ServerPlayerEntity shooter, Vec3d from, ItemStack ammo) {
        ArrowEntity arrow = new ArrowEntity(ctx.getWorld(), shooter, ammo, null);
        Vec3d abs = ctx.getAbsolute(from);
        arrow.refreshPositionAndAngles(abs.x, abs.y, abs.z, 0, 0);
        arrow.setVelocity(0, 0, 1.2); // towards +z, into the pet
        arrow.pickupType = PersistentProjectileEntity.PickupPermission.DISALLOWED;
        ctx.getWorld().spawnEntity(arrow);
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void theOwnersHitDoesNoDamage(TestContext ctx) {
        floor(ctx);
        ServerPlayerEntity owner = player(ctx);
        WolfEntity wolf = wolf(ctx, PET, owner);
        owner.attack(wolf);
        ctx.assertTrue(unhurt(wolf), "the owner's hit does no damage: " + hp(wolf));
        ctx.assertTrue(wolf.getAttacker() == null, "the wolf does not remember the owner as attacker");
        ctx.complete();
    }

    /** Runs {@code body} with other settings and puts the previous ones back. */
    private static void with(OwnerConfig settings, Runnable body) {
        OwnerConfig before = OwnerSafePets.config();
        OwnerSafePets.setConfig(settings);
        try {
            body.run();
        } finally {
            OwnerSafePets.setConfig(before);
        }
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void theDefaultsAreThoseOf10(TestContext ctx) {
        ctx.assertTrue(OwnerSafePets.config().equals(OwnerConfig.defaults()), "the game test server runs with the defaults: " + OwnerSafePets.config());
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void aSneakingOwnersHitDoesNoDamageByDefault(TestContext ctx) {
        floor(ctx);
        ServerPlayerEntity owner = player(ctx);
        WolfEntity wolf = wolf(ctx, PET, owner);
        owner.setSneaking(true);
        ctx.assertTrue(owner.isSneaking(), "the owner sneaks");
        owner.attack(wolf);
        ctx.assertTrue(unhurt(wolf), "without sneakToHit a sneaking owner's hit does no damage: " + hp(wolf));
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void withSneakToHitOnlyASneakingOwnersHitHurts(TestContext ctx) {
        floor(ctx);
        ServerPlayerEntity owner = player(ctx);
        WolfEntity wolf = wolf(ctx, PET, owner);
        with(new OwnerConfig(true, true), () -> {
            owner.attack(wolf);
            ctx.assertTrue(unhurt(wolf), "a standing owner's hit still does no damage: " + hp(wolf));
            owner.setSneaking(true);
            owner.attack(wolf);
            ctx.assertTrue(!unhurt(wolf), "a sneaking owner's hit does damage: " + hp(wolf));
        });
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void withSneakToHitTheOwnersExplosionStillDoesNoDamage(TestContext ctx) {
        floor(ctx);
        ServerPlayerEntity owner = player(ctx);
        WolfEntity wolf = wolf(ctx, PET, owner);
        owner.setSneaking(true);
        Vec3d at = ctx.getAbsolute(new Vec3d(2.5, 2.5, 3.5));
        with(new OwnerConfig(true, true), () -> {
            TntEntity tnt = new TntEntity(ctx.getWorld(), at.x, at.y, at.z, owner);
            ctx.getWorld().createExplosion(tnt, null, null, at.x, at.y, at.z, 1.0f, false, World.ExplosionSourceType.NONE);
        });
        ctx.assertTrue(unhurt(wolf), "sneaking does not let the owner's TNT through: " + hp(wolf));
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void withoutTheExplosionGuardTheOwnersExplosionHurts(TestContext ctx) {
        floor(ctx);
        ServerPlayerEntity owner = player(ctx);
        WolfEntity wolf = wolf(ctx, PET, owner);
        Vec3d at = ctx.getAbsolute(new Vec3d(2.5, 2.5, 3.5));
        with(new OwnerConfig(false, false), () -> {
            owner.attack(wolf);
            ctx.assertTrue(unhurt(wolf), "the owner's hit still does no damage: " + hp(wolf));
            TntEntity tnt = new TntEntity(ctx.getWorld(), at.x, at.y, at.z, owner);
            ctx.getWorld().createExplosion(tnt, null, null, at.x, at.y, at.z, 1.0f, false, World.ExplosionSourceType.NONE);
        });
        ctx.assertTrue(!unhurt(wolf), "with protectFromOwnerExplosions false the owner's TNT does damage: " + hp(wolf));
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void anotherPlayersHitHurts(TestContext ctx) {
        floor(ctx);
        ServerPlayerEntity owner = player(ctx);
        ServerPlayerEntity stranger = player(ctx);
        ctx.assertTrue(!owner.getUuid().equals(stranger.getUuid()), "two different players");
        WolfEntity wolf = wolf(ctx, PET, owner);
        stranger.attack(wolf);
        ctx.assertTrue(!unhurt(wolf), "another player's hit does damage: " + hp(wolf));
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void aZombiesHitHurts(TestContext ctx) {
        floor(ctx);
        WolfEntity wolf = wolf(ctx, PET, player(ctx));
        ZombieEntity zombie = still(ctx, EntityType.ZOMBIE, new Vec3d(2.5, 2, 3.5));
        zombie.tryAttack(wolf);
        ctx.assertTrue(!unhurt(wolf), "a zombie's hit does damage: " + hp(wolf));
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void aSittingWolfStaysSeated(TestContext ctx) {
        floor(ctx);
        ServerPlayerEntity owner = player(ctx);
        WolfEntity wolf = wolf(ctx, PET, owner);
        wolf.setAiDisabled(false); // the sit goal has to run
        wolf.setSitting(true);
        wolf.setInSittingPose(true);
        owner.attack(wolf);
        ctx.assertTrue(unhurt(wolf), "no damage: " + hp(wolf));
        ctx.assertTrue(wolf.isSitting(), "the wolf keeps its sit order");
        ctx.waitAndRun(10, () -> {
            ctx.assertTrue(wolf.isInSittingPose(), "the wolf is still sitting ten ticks later");
            ctx.complete();
        });
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void everyTamedKindIsSafeFromItsOwner(TestContext ctx) {
        floor(ctx);
        ServerPlayerEntity owner = player(ctx);
        ServerPlayerEntity stranger = player(ctx);
        List<EntityType<? extends MobEntity>> kinds = List.of(EntityType.WOLF, EntityType.CAT, EntityType.PARROT,
            EntityType.HORSE, EntityType.DONKEY, EntityType.MULE, EntityType.LLAMA, EntityType.CAMEL);
        for (int i = 0; i < kinds.size(); i++) {
            MobEntity pet = still(ctx, kinds.get(i), new Vec3d(0.5 + (i % 4) * 1.5, 2, 1.5 + (i / 4) * 3));
            String name = kinds.get(i).getUntranslatedName();
            if (pet instanceof TameableEntity tameable) tameable.setOwner(owner);
            else if (pet instanceof AbstractHorseEntity horse) ctx.assertTrue(horse.bondWithPlayer(owner), name + " is tamed");
            owner.attack(pet);
            ctx.assertTrue(unhurt(pet), name + ": the owner's hit does no damage: " + hp(pet));
            stranger.attack(pet);
            ctx.assertTrue(!unhurt(pet), name + ": another player's hit does damage: " + hp(pet));
        }
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void anUntamedAnimalIsNotProtected(TestContext ctx) {
        floor(ctx);
        ServerPlayerEntity player = player(ctx);
        WolfEntity wolf = wolf(ctx, PET, null);
        player.attack(wolf);
        ctx.assertTrue(!unhurt(wolf), "a wild wolf takes damage: " + hp(wolf));
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE, tickLimit = 40)
    public void theOwnersArrowDoesNoDamage(TestContext ctx) {
        floor(ctx);
        ServerPlayerEntity owner = player(ctx);
        WolfEntity wolf = wolf(ctx, new Vec3d(2.5, 2, 4.5), owner);
        shoot(ctx, owner, new Vec3d(2.5, 2.4, 1.5));
        ctx.waitAndRun(20, () -> {
            ctx.assertTrue(unhurt(wolf), "the owner's arrow does no damage: " + hp(wolf));
            ctx.complete();
        });
    }

    @GameTest(templateName = EMPTY_STRUCTURE, tickLimit = 40)
    public void anotherPlayersArrowHurts(TestContext ctx) {
        // the same shot as above, so the arrow really reaches the pet
        floor(ctx);
        ServerPlayerEntity owner = player(ctx);
        ServerPlayerEntity stranger = player(ctx);
        WolfEntity wolf = wolf(ctx, new Vec3d(2.5, 2, 4.5), owner);
        shoot(ctx, stranger, new Vec3d(2.5, 2.4, 1.5));
        ctx.waitAndRun(20, () -> {
            ctx.assertTrue(!unhurt(wolf), "another player's arrow does damage: " + hp(wolf));
            ctx.complete();
        });
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void theOwnersExplosionDoesNoDamage(TestContext ctx) {
        floor(ctx);
        ServerPlayerEntity owner = player(ctx);
        WolfEntity wolf = wolf(ctx, PET, owner);
        Vec3d at = ctx.getAbsolute(new Vec3d(2.5, 2.5, 3.5));
        // TNT the owner lit: the TNT explodes, the owner is named as the one who caused it
        TntEntity tnt = new TntEntity(ctx.getWorld(), at.x, at.y, at.z, owner);
        ctx.getWorld().createExplosion(tnt, null, null, at.x, at.y, at.z, 1.0f, false, World.ExplosionSourceType.NONE);
        ctx.assertTrue(unhurt(wolf), "the owner's TNT does no damage: " + hp(wolf));
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void anExplosionWithoutTheOwnerHurts(TestContext ctx) {
        // the same blast as above, lit by nobody
        floor(ctx);
        WolfEntity wolf = wolf(ctx, PET, player(ctx));
        Vec3d at = ctx.getAbsolute(new Vec3d(2.5, 2.5, 3.5));
        TntEntity tnt = new TntEntity(ctx.getWorld(), at.x, at.y, at.z, null);
        ctx.getWorld().createExplosion(tnt, null, null, at.x, at.y, at.z, 1.0f, false, World.ExplosionSourceType.NONE);
        ctx.assertTrue(!unhurt(wolf), "an explosion nobody caused does damage: " + hp(wolf));
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void theOwnersSweepSparesThePet(TestContext ctx) {
        floor(ctx);
        // facing +x (yaw -90) towards the zombie, with a sword and a full attack cooldown
        ServerPlayerEntity owner = player(ctx, new Vec3d(1.5, 2, 2.5), -90);
        owner.setStackInHand(Hand.MAIN_HAND, new ItemStack(Items.IRON_SWORD));
        owner.setOnGround(true);
        for (int i = 0; i < 30; i++) owner.playerTick(); // applies the sword's attributes and fills the cooldown
        owner.setOnGround(true);
        ctx.assertTrue(owner.getAttackCooldownProgress(0.5f) >= 1.0f, "full cooldown: " + owner.getAttackCooldownProgress(0.5f));

        ZombieEntity zombie = still(ctx, EntityType.ZOMBIE, new Vec3d(2.5, 2, 2.5));
        WolfEntity pet = wolf(ctx, new Vec3d(2.5, 2, 3.5), owner);
        WolfEntity wild = wolf(ctx, new Vec3d(2.5, 2, 1.5), null);
        owner.attack(zombie);
        ctx.assertTrue(!unhurt(zombie), "the zombie is hit: " + hp(zombie));
        ctx.assertTrue(!unhurt(wild), "the sweep reaches the wild wolf next to it: " + hp(wild));
        ctx.assertTrue(unhurt(pet), "the sweep does no damage to the owner's wolf: " + hp(pet));
        ctx.complete();
    }

    // --- Potions (1.2) ---------------------------------------------------------------------------
    // The potions are thrown and land within the test's own call (the potion entity is ticked by
    // hand, it is never added to the world), so a test that changes the settings changes them only
    // for its own throw. Each potion test runs in a batch of its own: a splash reaches four blocks,
    // no other test's animals stand next to it.

    /** Throws a splash or lingering potion of {@code thrower} straight down onto {@code at}; it lands before this returns. */
    private static void splash(TestContext ctx, ServerPlayerEntity thrower, Item kind, RegistryEntry<Potion> potion, Vec3d at) {
        PotionEntity entity = new PotionEntity(ctx.getWorld(), thrower);
        entity.setItem(PotionContentsComponent.createStack(kind, potion));
        Vec3d abs = ctx.getAbsolute(at.add(0, 1.2, 0));
        entity.refreshPositionAndAngles(abs.x, abs.y, abs.z, 0, 0);
        entity.setVelocity(0, -0.8, 0);
        for (int i = 0; i < 10 && !entity.isRemoved(); i++) entity.tick();
        ctx.assertTrue(entity.isRemoved(), "the potion landed");
    }

    /** Back to full health without effects, and without the half second after a hit in which smaller hits do nothing. */
    private static void heal(LivingEntity pet) {
        pet.clearStatusEffects();
        pet.setHealth(pet.getMaxHealth());
        pet.timeUntilRegen = 0;
    }

    @GameTest(templateName = EMPTY_STRUCTURE, batchId = "ownersafepets_splash")
    public void theOwnersSplashPotionsDoNoHarm(TestContext ctx) {
        floor(ctx);
        ServerPlayerEntity owner = player(ctx);
        ServerPlayerEntity stranger = player(ctx);
        WolfEntity wolf = wolf(ctx, PET, owner);

        splash(ctx, owner, Items.SPLASH_POTION, Potions.HARMING, PET);
        ctx.assertTrue(unhurt(wolf), "the owner's harming potion does no damage: " + hp(wolf));
        splash(ctx, owner, Items.SPLASH_POTION, Potions.POISON, PET);
        ctx.assertFalse(wolf.hasStatusEffect(StatusEffects.POISON), "the owner's poison does not poison the wolf");
        splash(ctx, owner, Items.SPLASH_POTION, Potions.WEAKNESS, PET);
        ctx.assertFalse(wolf.hasStatusEffect(StatusEffects.WEAKNESS), "the owner's weakness potion does not weaken the wolf");
        splash(ctx, owner, Items.SPLASH_POTION, Potions.SLOWNESS, PET);
        ctx.assertFalse(wolf.hasStatusEffect(StatusEffects.SLOWNESS), "the owner's slowness potion does not slow the wolf");
        ctx.assertTrue(wolf.getStatusEffects().isEmpty(), "no effect at all: " + wolf.getStatusEffects());
        ctx.assertTrue(owner.hasStatusEffect(StatusEffects.POISON), "the splash itself worked: the owner next to it is poisoned");

        // helpful effects still apply
        splash(ctx, owner, Items.SPLASH_POTION, Potions.REGENERATION, PET);
        ctx.assertTrue(wolf.hasStatusEffect(StatusEffects.REGENERATION), "the owner's regeneration potion works");
        splash(ctx, owner, Items.SPLASH_POTION, Potions.TURTLE_MASTER, PET);
        ctx.assertTrue(wolf.hasStatusEffect(StatusEffects.RESISTANCE), "turtle master: resistance applies");
        ctx.assertFalse(wolf.hasStatusEffect(StatusEffects.SLOWNESS), "turtle master: its slowness does not");

        // someone else's potions are unchanged
        heal(wolf);
        splash(ctx, stranger, Items.SPLASH_POTION, Potions.POISON, PET);
        ctx.assertTrue(wolf.hasStatusEffect(StatusEffects.POISON), "another player's poison poisons the wolf");
        splash(ctx, stranger, Items.SPLASH_POTION, Potions.HARMING, PET);
        ctx.assertTrue(!unhurt(wolf), "another player's harming potion does damage: " + hp(wolf));
        float hurt = wolf.getHealth();
        splash(ctx, owner, Items.SPLASH_POTION, Potions.HEALING, PET);
        ctx.assertTrue(wolf.getHealth() > hurt, "the owner's healing potion heals: " + hurt + " -> " + hp(wolf));

        // with protectFromOwnerPotions off the owner's potions work as in vanilla
        heal(wolf);
        with(new OwnerConfig(false, true, false), () -> {
            splash(ctx, owner, Items.SPLASH_POTION, Potions.POISON, PET);
            splash(ctx, owner, Items.SPLASH_POTION, Potions.HARMING, PET);
        });
        ctx.assertTrue(wolf.hasStatusEffect(StatusEffects.POISON), "without the guard the owner's poison poisons the wolf");
        ctx.assertTrue(!unhurt(wolf), "without the guard the owner's harming potion does damage: " + hp(wolf));
        ctx.complete();
    }

    /** The lingering cloud the potion leaves (it is in the world), moved onto {@code at} and ticked once by hand at its first dose. */
    private static AreaEffectCloudEntity cloud(TestContext ctx, Vec3d at) {
        Vec3d abs = ctx.getAbsolute(at);
        List<AreaEffectCloudEntity> clouds = ctx.getWorld().getEntitiesByClass(AreaEffectCloudEntity.class, new Box(abs, abs).expand(5), c -> true);
        ctx.assertTrue(clouds.size() == 1, "one cloud: " + clouds.size());
        AreaEffectCloudEntity cloud = clouds.get(0);
        cloud.setPosition(abs.x, abs.y, abs.z);
        cloud.age = cloud.getWaitTime(); // its wait time (10 ticks) is over and it is a dose tick (every 5)
        return cloud;
    }

    @GameTest(templateName = EMPTY_STRUCTURE, batchId = "ownersafepets_lingering")
    public void theOwnersLingeringCloudDoesNoHarm(TestContext ctx) {
        floor(ctx);
        ServerPlayerEntity owner = player(ctx);
        ServerPlayerEntity stranger = player(ctx);
        Vec3d at = new Vec3d(5.5, 2, 5.5); // more than three blocks from the players, so only the wolf is in the cloud
        WolfEntity wolf = wolf(ctx, at, owner);

        splash(ctx, owner, Items.LINGERING_POTION, Potions.POISON, at);
        AreaEffectCloudEntity mine = cloud(ctx, at);
        ctx.assertTrue(mine.getOwner() == owner, "the cloud belongs to the owner: " + mine.getOwner());
        float radius = mine.getRadius();
        mine.tick();
        mine.discard();
        ctx.assertFalse(wolf.hasStatusEffect(StatusEffects.POISON), "the owner's poison cloud does not poison the wolf");
        ctx.assertTrue(mine.getRadius() > radius - 0.25f, "the wolf does not use the cloud up: " + radius + " -> " + mine.getRadius());

        splash(ctx, stranger, Items.LINGERING_POTION, Potions.POISON, at);
        AreaEffectCloudEntity theirs = cloud(ctx, at);
        radius = theirs.getRadius();
        theirs.tick();
        theirs.discard();
        ctx.assertTrue(wolf.hasStatusEffect(StatusEffects.POISON), "another player's poison cloud poisons the wolf");
        ctx.assertTrue(theirs.getRadius() < radius - 0.25f, "and the cloud gets smaller as usual: " + radius + " -> " + theirs.getRadius());
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE, tickLimit = 40)
    public void theOwnersTippedArrowGivesNoEffect(TestContext ctx) {
        // tipped arrows needed nothing new: their effect only lands together with the arrow's damage
        floor(ctx);
        ServerPlayerEntity owner = player(ctx);
        WolfEntity wolf = wolf(ctx, new Vec3d(2.5, 2, 4.5), owner);
        shoot(ctx, owner, new Vec3d(2.5, 2.4, 1.5), PotionContentsComponent.createStack(Items.TIPPED_ARROW, Potions.POISON));
        ctx.waitAndRun(20, () -> {
            ctx.assertTrue(unhurt(wolf), "the owner's tipped arrow does no damage: " + hp(wolf));
            ctx.assertFalse(wolf.hasStatusEffect(StatusEffects.POISON), "and does not poison the wolf");
            ctx.complete();
        });
    }

    @GameTest(templateName = EMPTY_STRUCTURE, tickLimit = 40)
    public void anotherPlayersTippedArrowPoisons(TestContext ctx) {
        floor(ctx);
        ServerPlayerEntity owner = player(ctx);
        ServerPlayerEntity stranger = player(ctx);
        WolfEntity wolf = wolf(ctx, new Vec3d(2.5, 2, 4.5), owner);
        shoot(ctx, stranger, new Vec3d(2.5, 2.4, 1.5), PotionContentsComponent.createStack(Items.TIPPED_ARROW, Potions.POISON));
        ctx.waitAndRun(20, () -> {
            ctx.assertTrue(wolf.hasStatusEffect(StatusEffects.POISON), "another player's tipped arrow poisons the wolf");
            ctx.complete();
        });
    }
}
