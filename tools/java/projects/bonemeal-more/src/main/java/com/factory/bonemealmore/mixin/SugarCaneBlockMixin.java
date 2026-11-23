package com.factory.bonemealmore.mixin;

import com.factory.bonemealmore.PlantGrowth;
import net.minecraft.block.BlockState;
import net.minecraft.block.Fertilizable;
import net.minecraft.block.SugarCaneBlock;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.random.Random;
import net.minecraft.world.World;
import net.minecraft.world.WorldView;
import org.spongepowered.asm.mixin.Mixin;

/**
 * Makes sugar cane {@link Fertilizable}, the interface the game's bone meal code asks
 * ({@code BoneMealItem.useOnFertilizable}, used by a right-click and by dispensers). Nothing in the
 * block itself is changed. Bees and farmer villagers look for other blocks, so they are not affected.
 */
@Mixin(SugarCaneBlock.class)
abstract class SugarCaneBlockMixin implements Fertilizable {
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
