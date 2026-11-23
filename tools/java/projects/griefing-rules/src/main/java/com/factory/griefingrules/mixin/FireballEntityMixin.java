package com.factory.griefingrules.mixin;

import com.factory.griefingrules.GriefingRules;
import com.factory.griefingrules.GriefingRulesMod;
import com.llamalad7.mixinextras.injector.wrapoperation.Operation;
import com.llamalad7.mixinextras.injector.wrapoperation.WrapOperation;
import net.minecraft.entity.projectile.FireballEntity;
import net.minecraft.world.GameRules;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;

/**
 * The ghast fireball's fire. {@code FireballEntity#onCollision} reads mobGriefing once (its only
 * getBoolean call) and passes it as the "create fire" flag of its explosion; the explosion's
 * block damage is decided in {@link WorldMixin}. FireballEntity is the large fireball, which only
 * ghasts shoot in vanilla (blazes and dispensers use SmallFireballEntity, untouched).
 */
@Mixin(FireballEntity.class)
abstract class FireballEntityMixin {
    @WrapOperation(method = "onCollision", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/GameRules;getBoolean(Lnet/minecraft/world/GameRules$Key;)Z"))
    private boolean griefingrules$ghastFire(GameRules rules, GameRules.Key<GameRules.BooleanRule> key, Operation<Boolean> original) {
        return GriefingRulesMod.griefing(rules, key, original.call(rules, key), GriefingRules.Kind.GHAST);
    }
}
