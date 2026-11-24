package com.factory.griefingrules.mixin;

import com.factory.griefingrules.GriefingRules;
import com.factory.griefingrules.GriefingRulesMod;
import com.llamalad7.mixinextras.injector.wrapoperation.Operation;
import com.llamalad7.mixinextras.injector.wrapoperation.WrapOperation;
import net.minecraft.entity.LivingEntity;
import net.minecraft.world.GameRules;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;

/**
 * The wither rose planted where the wither kills a mob. {@code LivingEntity#onKilledBy} reads
 * mobGriefing once, and only behind {@code if (adversary instanceof WitherEntity)}; when it is false
 * vanilla drops the rose as an item instead, which then happens here too.
 */
@Mixin(LivingEntity.class)
abstract class LivingEntityMixin {
    @WrapOperation(method = "onKilledBy", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/GameRules;getBoolean(Lnet/minecraft/world/GameRules$Key;)Z"))
    private boolean griefingrules$witherRose(GameRules rules, GameRules.Key<GameRules.BooleanRule> key, Operation<Boolean> original) {
        return GriefingRulesMod.griefing(rules, key, original.call(rules, key), GriefingRules.Kind.WITHER);
    }
}
