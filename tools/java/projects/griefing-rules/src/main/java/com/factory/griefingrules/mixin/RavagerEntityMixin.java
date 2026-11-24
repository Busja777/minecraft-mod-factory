package com.factory.griefingrules.mixin;

import com.factory.griefingrules.GriefingRules;
import com.factory.griefingrules.GriefingRulesMod;
import com.llamalad7.mixinextras.injector.wrapoperation.Operation;
import com.llamalad7.mixinextras.injector.wrapoperation.WrapOperation;
import net.minecraft.entity.mob.RavagerEntity;
import net.minecraft.world.GameRules;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;

/**
 * Ravagers breaking leaves. {@code RavagerEntity#tickMovement} breaks every LeavesBlock it bumps
 * into when {@code horizontalCollision && mobGriefing}; otherwise it jumps, as in vanilla. That is
 * the only getBoolean call in the method.
 */
@Mixin(RavagerEntity.class)
abstract class RavagerEntityMixin {
    @WrapOperation(method = "tickMovement", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/GameRules;getBoolean(Lnet/minecraft/world/GameRules$Key;)Z"))
    private boolean griefingrules$ravagerLeaves(GameRules rules, GameRules.Key<GameRules.BooleanRule> key, Operation<Boolean> original) {
        return GriefingRulesMod.griefing(rules, key, original.call(rules, key), GriefingRules.Kind.RAVAGER);
    }
}
