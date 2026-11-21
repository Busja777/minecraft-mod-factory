package com.factory.ownersafepets.mixin;

import com.factory.ownersafepets.OwnerSafePets;
import com.llamalad7.mixinextras.injector.wrapoperation.Operation;
import com.llamalad7.mixinextras.injector.wrapoperation.WrapOperation;
import net.minecraft.entity.Entity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.projectile.thrown.PotionEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;

/**
 * Splash potions. In 1.21.1 {@code PotionEntity.applySplashPotion} gives every living entity within
 * four blocks the potion's effects: instant ones (instant damage) as damage that names the thrower
 * as attacker, which the damage event already cancels, and lasting ones (poison, weakness, slowness
 * …) through {@code LivingEntity.addStatusEffect(effect, thrower)}. Only that call is wrapped: a
 * harmful effect the owner threw at their own pet is skipped, everything else runs unchanged.
 * The {@code /effect} command uses the same method, so it is wrapped here, not at its head.
 */
@Mixin(PotionEntity.class)
abstract class PotionEntityMixin {
    @WrapOperation(method = "applySplashPotion", at = @At(value = "INVOKE",
        target = "Lnet/minecraft/entity/LivingEntity;addStatusEffect(Lnet/minecraft/entity/effect/StatusEffectInstance;Lnet/minecraft/entity/Entity;)Z"))
    private boolean ownersafepets$spareOwnPets(LivingEntity target, StatusEffectInstance effect, Entity source, Operation<Boolean> original) {
        if (OwnerSafePets.blocksPotionEffect(target, effect, ((ProjectileEntityAccessor) (Object) this).ownersafepets$ownerUuid())) return false;
        return original.call(target, effect, source);
    }
}
