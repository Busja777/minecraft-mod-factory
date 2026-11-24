package com.factory.bottledlevels.mixin;

import com.factory.bottledlevels.Bottling;
import net.minecraft.entity.projectile.thrown.ExperienceBottleEntity;
import net.minecraft.entity.projectile.thrown.ThrownItemEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyArg;

/**
 * The only mixin of the mod. {@code ExperienceBottleEntity#onCollision} rolls 3 + 0..4 + 0..4 points
 * and hands them to {@code ExperienceOrbEntity.spawn}. For a filled bottle this replaces that amount
 * with the stored one; a plain bottle keeps its roll. The thrown entity carries a one-item copy of the
 * stack it was thrown from ({@code ThrownItemEntity#setItem}, called by both
 * {@code ExperienceBottleItem#use} for players and {@code ExperienceBottleItem#createEntity} for
 * dispensers), so the stored amount arrives either way. Fabric API has no event for projectile hits.
 */
@Mixin(ExperienceBottleEntity.class)
abstract class ExperienceBottleEntityMixin {
    @ModifyArg(method = "onCollision",
        at = @At(value = "INVOKE", target = "Lnet/minecraft/entity/ExperienceOrbEntity;spawn(Lnet/minecraft/server/world/ServerWorld;Lnet/minecraft/util/math/Vec3d;I)V"),
        index = 2)
    private int bottledlevels$storedAmount(int rolled) {
        int stored = Bottling.storedXp(((ThrownItemEntity) (Object) this).getStack());
        return stored > 0 ? stored : rolled;
    }
}
