package com.factory.doubledoorbuddy.mixin;

import com.factory.doubledoorbuddy.DoubleDoors;
import net.minecraft.block.BlockState;
import net.minecraft.block.DoorBlock;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.util.ActionResult;
import net.minecraft.util.hit.BlockHitResult;
import net.minecraft.util.math.BlockPos;
import net.minecraft.world.World;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * The only mixin of the mod. {@code DoorBlock#onUse} is vanilla's right-click on a door: it flips
 * OPEN, plays the sound and returns SUCCESS, or returns PASS at once for doors that do not open by
 * hand (iron). It is only reached by a player's click, after vanilla's own checks (main hand, no
 * sneaking with an item, not a spectator, spawn protection). Hooking its end therefore sees exactly
 * the clicks that moved a door, and the door's new state. Fabric API's UseBlockCallback runs before
 * all of that and would have to guess vanilla's decision.
 */
@Mixin(DoorBlock.class)
abstract class DoorBlockMixin {
    @Inject(method = "onUse", at = @At("RETURN"))
    private void doubledoorbuddy$movePartner(BlockState state, World world, BlockPos pos, PlayerEntity player, BlockHitResult hit,
            CallbackInfoReturnable<ActionResult> cir) {
        DoubleDoors.afterUse(world, pos, player, cir.getReturnValue());
    }
}
