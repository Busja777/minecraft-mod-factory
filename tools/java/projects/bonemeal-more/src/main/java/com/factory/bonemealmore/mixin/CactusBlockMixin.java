package com.factory.bonemealmore.mixin;

import com.factory.bonemealmore.PlantGrowth;
import net.minecraft.block.BlockState;
import net.minecraft.block.CactusBlock;
import net.minecraft.block.Fertilizable;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.random.Random;
import net.minecraft.world.World;
import net.minecraft.world.WorldView;
import org.spongepowered.asm.mixin.Mixin;

/**
 * Makes cactus {@link Fertilizable} (see {@link SugarCaneBlockMixin}). A cactus only grows where the
 * new block could stand by the cactus' own placement rule, so bone meal never makes a cactus that
 * breaks off at once.
 */
@Mixin(CactusBlock.class)
abstract class CactusBlockMixin implements Fertilizable {
    @Override
    public boolean isFertilizable(WorldView world, BlockPos pos, BlockState state) {
        return PlantGrowth.columnTop(world, pos, state) != null;
    }

    @Override
    public boolean canGrow(World world, Random random, BlockPos pos, BlockState state) {
        return true;
    }

    @Override
    public void grow(ServerWorld world, Random random, BlockPos pos, BlockState state) {
        PlantGrowth.growColumn(world, pos, state);
    }
}
