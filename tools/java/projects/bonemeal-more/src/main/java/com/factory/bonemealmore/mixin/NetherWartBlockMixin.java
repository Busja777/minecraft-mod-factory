package com.factory.bonemealmore.mixin;

import com.factory.bonemealmore.PlantGrowth;
import net.minecraft.block.BlockState;
import net.minecraft.block.Fertilizable;
import net.minecraft.block.NetherWartBlock;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.random.Random;
import net.minecraft.world.World;
import net.minecraft.world.WorldView;
import org.spongepowered.asm.mixin.Mixin;

/** Makes nether wart {@link Fertilizable} (see {@link SugarCaneBlockMixin}): one age per use. */
@Mixin(NetherWartBlock.class)
abstract class NetherWartBlockMixin implements Fertilizable {
    @Override
    public boolean isFertilizable(WorldView world, BlockPos pos, BlockState state) {
        return PlantGrowth.canGrowWart(state);
    }

    @Override
    public boolean canGrow(World world, Random random, BlockPos pos, BlockState state) {
        return true;
    }

    @Override
    public void grow(ServerWorld world, Random random, BlockPos pos, BlockState state) {
        PlantGrowth.growWart(world, pos, state);
    }
}
