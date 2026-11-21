package com.factory.ownersafepets.gametest;

import java.util.List;
import net.fabricmc.fabric.api.gametest.v1.FabricGameTest;
import net.minecraft.block.Blocks;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.TntEntity;
import net.minecraft.entity.mob.MobEntity;
import net.minecraft.entity.mob.ZombieEntity;
import net.minecraft.entity.passive.AbstractHorseEntity;
import net.minecraft.entity.passive.TameableEntity;
import net.minecraft.entity.passive.WolfEntity;
import net.minecraft.entity.projectile.ArrowEntity;
import net.minecraft.entity.projectile.PersistentProjectileEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.test.GameTest;
import net.minecraft.test.TestContext;
import net.minecraft.util.Hand;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.GameMode;
import net.minecraft.world.World;

/**
 * In-world tests on a headless game test server (gradlew :owner-safe-pets:runGametest).
 * Mock server players hit through the real {@code PlayerEntity.attack}; arrows fly for real; the
 * explosions are real explosions that break no blocks. Animals have no AI so they stay in place.
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
        ArrowEntity arrow = new ArrowEntity(ctx.getWorld(), shooter, new ItemStack(Items.ARROW), null);
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
}
