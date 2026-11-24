package com.factory.bonemealmore;

import com.factory.bonemealmore.GrowthRules.Column;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.block.CactusBlock;
import net.minecraft.block.NetherWartBlock;
import net.minecraft.block.SugarCaneBlock;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.state.property.Properties;
import net.minecraft.util.math.BlockPos;
import net.minecraft.world.WorldView;

/**
 * What bone meal does to sugar cane, cactus and nether wart (rules in {@link GrowthRules}). The
 * mixins make the three blocks {@code Fertilizable} and call in here, so the game's own bone meal
 * code (by hand, from a dispenser) checks, grows, uses up one bone meal and shows the sparkles.
 */
public final class PlantGrowth {
    private PlantGrowth() {}

    /** Sugar cane and cactus: they grow by stacking blocks. */
    public static boolean isColumnPlant(BlockState state) {
        Block block = state.getBlock();
        return block instanceof SugarCaneBlock || block instanceof CactusBlock;
    }

    /** The plants this mod makes grow with bone meal. */
    public static boolean isModPlant(BlockState state) {
        return isColumnPlant(state) || state.getBlock() instanceof NetherWartBlock;
    }

    /** Whether bone meal would grow this plant now (false for every other block). */
    public static boolean canBoneMeal(WorldView world, BlockPos pos, BlockState state) {
        if (isColumnPlant(state)) return columnTop(world, pos, state) != null;
        if (state.getBlock() instanceof NetherWartBlock) return GrowthRules.wartCanGrow(state.get(NetherWartBlock.AGE));
        return false;
    }

    /**
     * The top block of the sugar cane or cactus column through {@code pos} if bone meal can add a
     * block above it, else null. The new block must be able to stand there by the plant's own
     * {@code canPlaceAt} (for cactus: no block at its sides, no lava, sand or cactus below).
     */
    public static BlockPos columnTop(WorldView world, BlockPos pos, BlockState state) {
        Block block = state.getBlock();
        Column column = GrowthRules.measure(dy -> world.getBlockState(pos.up(dy)).isOf(block));
        if (column.height() >= GrowthRules.MAX_COLUMN_HEIGHT) return null;
        BlockPos top = pos.up(column.above());
        BlockPos next = top.up();
        boolean inside = !world.isOutOfHeightLimit(next);
        boolean air = inside && world.getBlockState(next).isAir();
        boolean stays = air && block.getDefaultState().canPlaceAt(world, next);
        return GrowthRules.columnCanGrow(column, inside, air, stays) ? top : null;
    }

    /**
     * Adds one block on top of the column, the same two steps as the plant's random tick when it
     * grows: the new block with every update, then the old top's growth timer back to 0.
     */
    public static void growColumn(ServerWorld world, BlockPos pos, BlockState state) {
        BlockPos top = columnTop(world, pos, state);
        if (top == null) return;
        world.setBlockState(top.up(), state.getBlock().getDefaultState());
        BlockState topState = world.getBlockState(top);
        if (topState.contains(Properties.AGE_15)) world.setBlockState(top, topState.with(Properties.AGE_15, 0), Block.NO_REDRAW);
    }

    /** Whether bone meal advances this nether wart. */
    public static boolean canGrowWart(BlockState state) {
        return GrowthRules.wartCanGrow(state.get(NetherWartBlock.AGE));
    }

    /** One age further, set the way the wart's random tick sets it. */
    public static void growWart(ServerWorld world, BlockPos pos, BlockState state) {
        int age = state.get(NetherWartBlock.AGE);
        if (!GrowthRules.wartCanGrow(age)) return;
        world.setBlockState(pos, state.with(NetherWartBlock.AGE, GrowthRules.wartNextAge(age)), Block.NOTIFY_LISTENERS);
    }
}
