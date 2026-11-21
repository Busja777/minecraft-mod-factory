package com.factory.fastleaffall.mixin;

import com.factory.fastleaffall.FastLeafFall;
import net.minecraft.block.BlockState;
import net.minecraft.block.LeavesBlock;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.random.Random;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * The only mixin of the mod. {@code LeavesBlock#scheduledTick} is where vanilla recalculates a leaf's
 * distance to the nearest log after a neighbour changed: when a log disappears, the neighbouring
 * leaves schedule this tick and pass the change on, one block per tick, until the leaves that lost
 * their tree reach distance 7 (vanilla's "decay on the next random tick" mark). Hooking the end of
 * it catches every way a tree can lose its logs (axe, fire, explosions, other mods) and only ever
 * sees leaves whose distance vanilla itself just set. Fabric API has no event for scheduled block
 * ticks or leaf distances. The hook only reads the new state and queues the position; it changes
 * nothing in the tick itself.
 */
@Mixin(LeavesBlock.class)
abstract class LeavesBlockMixin {
    @Inject(method = "scheduledTick", at = @At("TAIL"))
    private void fastleaffall$queueOrphanedLeaves(BlockState state, ServerWorld world, BlockPos pos, Random random, CallbackInfo ci) {
        FastLeafFall.onDistanceUpdated(world, pos);
    }
}
