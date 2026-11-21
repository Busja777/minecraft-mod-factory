package com.factory.ownersafepets.mixin;

import com.factory.ownersafepets.OwnerSafePets;
import com.llamalad7.mixinextras.injector.wrapoperation.Operation;
import com.llamalad7.mixinextras.injector.wrapoperation.WrapOperation;
import java.util.UUID;
import net.minecraft.component.type.PotionContentsComponent;
import net.minecraft.entity.AreaEffectCloudEntity;
import net.minecraft.entity.Entity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.effect.StatusEffectInstance;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;

/**
 * Lingering potions. The thrown potion leaves an {@code AreaEffectCloudEntity} whose owner is the
 * thrower; every five ticks {@code tick()} picks the living entities in it (those whose
 * {@code isAffectedBySplashPotions()} is true), marks them so they wait before the next dose, makes
 * the cloud a little smaller and gives them the effects (instant ones as damage naming the owner,
 * lasting ones through {@code addStatusEffect(effect, cloud)}).
 * <ul>
 *   <li>A pet that would get nothing but harmful effects of its own owner's cloud is not picked at
 *       all, so it does not use the cloud up either.</li>
 *   <li>A pet in a mixed cloud (turtle master: slowness and resistance) is picked and only the
 *       harmful effects are skipped.</li>
 * </ul>
 * The owner id is read from the field, not {@code getOwner()}, so a cloud keeps sparing the pets of
 * a thrower who has logged out.
 */
@Mixin(AreaEffectCloudEntity.class)
abstract class AreaEffectCloudEntityMixin {
    @Shadow private UUID ownerUuid;
    @Shadow private PotionContentsComponent potionContentsComponent;

    @WrapOperation(method = "tick", at = @At(value = "INVOKE",
        target = "Lnet/minecraft/entity/LivingEntity;isAffectedBySplashPotions()Z"))
    private boolean ownersafepets$leaveOutOwnPets(LivingEntity target, Operation<Boolean> original) {
        if (!original.call(target)) return false;
        return !OwnerSafePets.skipsCloud(target, potionContentsComponent.getEffects(), ownerUuid);
    }

    @WrapOperation(method = "tick", at = @At(value = "INVOKE",
        target = "Lnet/minecraft/entity/LivingEntity;addStatusEffect(Lnet/minecraft/entity/effect/StatusEffectInstance;Lnet/minecraft/entity/Entity;)Z"))
    private boolean ownersafepets$spareOwnPets(LivingEntity target, StatusEffectInstance effect, Entity source, Operation<Boolean> original) {
        if (OwnerSafePets.blocksPotionEffect(target, effect, ownerUuid)) return false;
        return original.call(target, effect, source);
    }
}
