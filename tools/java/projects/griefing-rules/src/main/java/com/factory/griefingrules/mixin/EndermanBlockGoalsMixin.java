package com.factory.griefingrules.mixin;

import com.factory.griefingrules.GriefingRules;
import com.factory.griefingrules.GriefingRulesMod;
import com.llamalad7.mixinextras.injector.wrapoperation.Operation;
import com.llamalad7.mixinextras.injector.wrapoperation.WrapOperation;
import net.minecraft.world.GameRules;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;

/**
 * Endermen taking and placing blocks. Both goals, {@code EndermanEntity.PickUpBlockGoal#canStart}
 * and {@code EndermanEntity.PlaceBlockGoal#canStart}, read mobGriefing once and do not start
 * without it (as in vanilla, an enderman that already holds a block keeps it).
 */
@Mixin(targets = {"net.minecraft.entity.mob.EndermanEntity$PickUpBlockGoal", "net.minecraft.entity.mob.EndermanEntity$PlaceBlockGoal"})
abstract class EndermanBlockGoalsMixin {
    @WrapOperation(method = "canStart", at = @At(value = "INVOKE", target = "Lnet/minecraft/world/GameRules;getBoolean(Lnet/minecraft/world/GameRules$Key;)Z"))
    private boolean griefingrules$endermanBlocks(GameRules rules, GameRules.Key<GameRules.BooleanRule> key, Operation<Boolean> original) {
        return GriefingRulesMod.griefing(rules, key, original.call(rules, key), GriefingRules.Kind.ENDERMAN);
    }
}
