package com.factory.ownersafepets.mixin;

import java.util.UUID;
import net.minecraft.entity.projectile.ProjectileEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Accessor;

/**
 * The stored owner id of a thrown potion. {@code getOwner()} looks the owner up in the world and
 * answers null once the thrower has logged out; the id stays.
 */
@Mixin(ProjectileEntity.class)
public interface ProjectileEntityAccessor {
    @Accessor("ownerUuid")
    UUID ownersafepets$ownerUuid();
}
