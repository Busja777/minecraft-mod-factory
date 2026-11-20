package com.factory.replantclick;

import com.factory.replantclick.HarvestRules.Drop;
import java.util.List;
import java.util.Map;
import java.util.WeakHashMap;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.block.CropBlock;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.registry.Registries;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.TypedActionResult;
import net.minecraft.util.hit.BlockHitResult;
import net.minecraft.util.math.BlockPos;
import net.minecraft.world.World;
import net.minecraft.world.WorldEvents;
import net.minecraft.world.event.GameEvent;

/**
 * Harvests and replants a fully grown crop on right-click.
 *
 * <p>All work happens on the server, so the mod also helps players whose game has no mods. On a
 * client with the mod, the click only answers SUCCESS (arm swing, no block placement guess) and
 * the server does the rest.
 */
public final class CropHarvester {
    /** Server tick of each player's last harvest (server thread only). */
    private static final Map<PlayerEntity, Long> LAST_HARVEST = new WeakHashMap<>();

    private CropHarvester() {}

    /** Fabric's UseBlockCallback: SUCCESS when the crop was harvested, PASS to keep vanilla behaviour. */
    public static ActionResult onUseBlock(PlayerEntity player, World world, Hand hand, BlockHitResult hit) {
        // Only the main hand decides: if it holds bone meal, the off hand must not harvest either.
        if (hand != Hand.MAIN_HAND || player.isSpectator() || !player.canModifyBlocks()) return ActionResult.PASS;
        BlockPos pos = hit.getBlockPos();
        BlockState state = world.getBlockState(pos);
        if (!(state.getBlock() instanceof CropBlock crop)) return ActionResult.PASS;
        ItemStack tool = player.getStackInHand(hand);
        String blockId = Registries.BLOCK.getId(crop).toString();
        String heldId = Registries.ITEM.getId(tool.getItem()).toString();
        if (!HarvestRules.isHarvestable(blockId, crop.getAge(state), crop.getMaxAge(), player.isSneaking(), heldId)) return ActionResult.PASS;
        if (world.isClient()) return ActionResult.SUCCESS;
        return harvest((ServerWorld) world, pos, state, crop, player, tool) ? ActionResult.SUCCESS : ActionResult.PASS;
    }

    /**
     * Fabric's UseItemCallback: swallows the item use a game without the mod sends right behind a
     * harvest click, so the click does not also throw, eat or place what is in the hand.
     */
    public static TypedActionResult<ItemStack> onUseItem(PlayerEntity player, World world, Hand hand) {
        ItemStack stack = player.getStackInHand(hand);
        if (world.isClient() || !HarvestRules.blocksItemUse(LAST_HARVEST.getOrDefault(player, -1L), world.getTime())) return TypedActionResult.pass(stack);
        if (player instanceof ServerPlayerEntity serverPlayer) serverPlayer.currentScreenHandler.syncState();
        return TypedActionResult.fail(stack);
    }

    /** Drops the loot as if the player broke the crop with {@code tool}, keeps one seed and replants. */
    static boolean harvest(ServerWorld world, BlockPos pos, BlockState state, CropBlock crop, PlayerEntity player, ItemStack tool) {
        List<ItemStack> drops = Block.getDroppedStacks(state, world, pos, null, player, tool);
        String seedId = Registries.ITEM.getId(crop.getPickStack(world, pos, state).getItem()).toString();
        int seed = HarvestRules.replantIndex(drops.stream().map(s -> new Drop(Registries.ITEM.getId(s.getItem()).toString(), s.getCount())).toList(), seedId);
        if (seed < 0) return false; // a changed loot table without seeds: leave the crop as it is
        drops.get(seed).decrement(1);

        BlockState replanted = crop.withAge(0);
        // break particles and the vanilla break sound for everyone nearby, like breaking the block
        world.syncWorldEvent(WorldEvents.BLOCK_BROKEN, pos, Block.getRawIdFromState(state));
        world.setBlockState(pos, replanted, Block.NOTIFY_ALL);
        world.emitGameEvent(GameEvent.BLOCK_CHANGE, pos, GameEvent.Emitter.of(player, replanted));
        for (ItemStack stack : drops) if (!stack.isEmpty()) Block.dropStack(world, pos, stack);
        state.onStacksDropped(world, pos, tool, true);

        LAST_HARVEST.put(player, world.getTime());
        // A player without the mod may have guessed a block placement or item use on their side;
        // send the real inventory back so nothing looks used up.
        if (player instanceof ServerPlayerEntity serverPlayer && !tool.isEmpty()) serverPlayer.currentScreenHandler.syncState();
        return true;
    }
}
