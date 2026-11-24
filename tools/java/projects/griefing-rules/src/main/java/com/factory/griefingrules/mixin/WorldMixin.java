package com.factory.griefingrules.mixin;

import com.factory.griefingrules.GriefingRules;
import com.factory.griefingrules.GriefingRulesMod;
import com.llamalad7.mixinextras.injector.wrapoperation.Operation;
import com.llamalad7.mixinextras.injector.wrapoperation.WrapOperation;
import com.llamalad7.mixinextras.sugar.Local;
import net.minecraft.entity.Entity;
import net.minecraft.registry.Registries;
import net.minecraft.world.GameRules;
import net.minecraft.world.World;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;

/**
 * Creeper, ghast fireball, wither and wither skull explosions.
 *
 * <p>Every explosion of 1.21.1 ends in the 13-argument {@code World#createExplosion} (ServerWorld
 * overrides the 12-argument one and calls it). There, {@code ExplosionSourceType.MOB} picks the
 * destruction type: {@code getGameRules().getBoolean(DO_MOB_GRIEFING) ? MOB_EXPLOSION_DROP_DECAY
 * : KEEP}. That is the only getBoolean call in the method (checked in the bytecode). With KEEP the
 * explosion still damages and pushes entities but breaks no block. The exploding entity is the
 * method's Entity argument: the creeper itself, the ghast's FireballEntity, the wither (its spawn
 * blast) or the WitherSkullEntity.
 */
@Mixin(World.class)
abstract class WorldMixin {
    @WrapOperation(
        method = "createExplosion(Lnet/minecraft/entity/Entity;Lnet/minecraft/entity/damage/DamageSource;Lnet/minecraft/world/explosion/ExplosionBehavior;DDDFZLnet/minecraft/world/World$ExplosionSourceType;ZLnet/minecraft/particle/ParticleEffect;Lnet/minecraft/particle/ParticleEffect;Lnet/minecraft/registry/entry/RegistryEntry;)Lnet/minecraft/world/explosion/Explosion;",
        at = @At(value = "INVOKE", target = "Lnet/minecraft/world/GameRules;getBoolean(Lnet/minecraft/world/GameRules$Key;)Z"))
    private boolean griefingrules$bySource(GameRules rules, GameRules.Key<GameRules.BooleanRule> key, Operation<Boolean> original, @Local(argsOnly = true) Entity entity) {
        boolean vanilla = original.call(rules, key);
        GriefingRules.Kind kind = entity == null ? null : GriefingRules.explosionKind(Registries.ENTITY_TYPE.getId(entity.getType()).toString());
        return GriefingRulesMod.griefing(rules, key, vanilla, kind);
    }
}
