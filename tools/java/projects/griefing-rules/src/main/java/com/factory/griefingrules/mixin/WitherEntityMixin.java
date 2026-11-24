package com.factory.griefingrules.mixin;

import com.factory.griefingrules.GriefingRules;
import com.factory.griefingrules.GriefingRulesMod;
import com.llamalad7.mixinextras.injector.wrapoperation.Operation;
import com.llamalad7.mixinextras.injector.wrapoperation.WrapOperation;
import net.minecraft.entity.boss.WitherEntity;
import net.minecraft.world.GameRules;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;

/**
 * The blocks the wither breaks around itself after it was hurt. {@code WitherEntity#mobTick} counts
 * down blockBreakingCooldown (set to 20 by damage) and at 0 breaks every block in its box that
 * {@code canDestroy} allows, if mobGriefing is on. That is the only getBoolean call in mobTick.
 * Its explosions are handled in {@link WorldMixin}.
 */
@Mixin(WitherEntity.class)
abstract class WitherEntityMixin {
    @WrapOperation(method = "mobTick", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/GameRules;getBoolean(Lnet/minecraft/world/GameRules$Key;)Z"))
    private boolean griefingrules$witherBreaksOut(GameRules rules, GameRules.Key<GameRules.BooleanRule> key, Operation<Boolean> original) {
        return GriefingRulesMod.griefing(rules, key, original.call(rules, key), GriefingRules.Kind.WITHER);
    }
}
