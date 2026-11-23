package com.factory.doubledoorbuddy;

import com.factory.doubledoorbuddy.DoorRules.Door;
import com.factory.doubledoorbuddy.DoorRules.Facing;
import com.factory.doubledoorbuddy.DoorRules.Half;
import com.factory.doubledoorbuddy.DoorRules.Hinge;
import net.minecraft.block.Block;
import net.minecraft.block.BlockSetType;
import net.minecraft.block.BlockState;
import net.minecraft.block.DoorBlock;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.registry.Registries;
import net.minecraft.sound.SoundCategory;
import net.minecraft.util.ActionResult;
import net.minecraft.util.math.BlockPos;
import net.minecraft.world.World;
import net.minecraft.world.event.GameEvent;

/**
 * Opens and closes the partner of a double door after a player used one of its doors.
 *
 * <p>Called from the end of vanilla's {@code DoorBlock#onUse} (see the mixin), which only runs for a
 * player's right-click: vanilla has already decided everything about the click (iron doors return
 * PASS, sneaking with an item in hand never reaches the door, spectators never get here) and has
 * flipped the clicked door. The partner then gets the same open state. It is changed with
 * {@code setBlockState}, not through {@code onUse}, so it never answers back and nothing loops;
 * redstone ({@code DoorBlock#neighborUpdate}) and villagers ({@code DoorBlock#setOpen}) do not pass
 * through {@code onUse} and so never move a partner.
 *
 * <p>Everything runs on the server. The server sends the partner's new state (both halves) to every
 * player nearby, so players without the mod see both doors move. A client with the mod does not
 * predict the partner: on a server without the mod it would show a door the server never opened.
 */
public final class DoubleDoors {
    private DoubleDoors() {}

    /** Vanilla's flags for opening a door (onUse and setOpen): send to clients, redraw at once, no neighbour update. */
    private static final int DOOR_FLAGS = Block.NOTIFY_LISTENERS | Block.REDRAW_ON_MAIN_THREAD;

    /** The door at {@code state} as the rules see it, or null when it is no door. */
    static Door doorOf(BlockState state) {
        if (!(state.getBlock() instanceof DoorBlock)) return null;
        return new Door(Registries.BLOCK.getId(state.getBlock()).toString(),
            Facing.valueOf(state.get(DoorBlock.FACING).name()),
            Hinge.valueOf(state.get(DoorBlock.HINGE).name()),
            Half.valueOf(state.get(DoorBlock.HALF).name()));
    }

    /**
     * After {@code player} used the door at {@code pos} and vanilla answered {@code result}: gives the
     * partner door the clicked door's new open state, with its own sound and game event.
     *
     * @return whether the partner moved
     */
    public static boolean afterUse(World world, BlockPos pos, PlayerEntity player, ActionResult result) {
        if (!DoorRules.partnerFollows(result.isAccepted(), !world.isClient(), player.isSneaking())) return false;
        BlockState clicked = world.getBlockState(pos);
        Door door = doorOf(clicked);
        if (door == null) return false;
        Facing side = DoorRules.partnerSide(door);
        BlockPos partnerPos = pos.add(side.dx, 0, side.dz);
        BlockState partner = world.getBlockState(partnerPos);
        if (!DoorRules.isPartner(door, doorOf(partner))) return false;
        boolean open = clicked.get(DoorBlock.OPEN);
        if (!DoorRules.partnerChanges(open, partner.get(DoorBlock.OPEN))) return false;
        // spawn protection and the world border apply to the partner as they did to the clicked door
        if (!world.canPlayerModifyAt(player, partnerPos)) return false;

        // the other half of the partner follows through vanilla's shape update (DoorBlock#getStateForNeighborUpdate)
        world.setBlockState(partnerPos, partner.with(DoorBlock.OPEN, open), DOOR_FLAGS);
        BlockSetType type = ((DoorBlock) partner.getBlock()).getBlockSetType();
        // like DoorBlock#playOpenCloseSound, but heard by everyone: the clicking player's game only
        // plays the sound of the door it clicked itself
        world.playSound((PlayerEntity) null, partnerPos, open ? type.doorOpen() : type.doorClose(), SoundCategory.BLOCKS,
            1.0F, world.getRandom().nextFloat() * 0.1F + 0.9F);
        world.emitGameEvent(player, open ? GameEvent.BLOCK_OPEN : GameEvent.BLOCK_CLOSE, partnerPos);
        return true;
    }
}
