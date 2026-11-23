package com.factory.bonemealmore;

import java.util.Map;
import java.util.WeakHashMap;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.event.player.UseBlockCallback;
import net.fabricmc.fabric.api.event.player.UseItemCallback;
import net.minecraft.block.BlockState;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.TypedActionResult;
import net.minecraft.util.hit.BlockHitResult;
import net.minecraft.util.math.BlockPos;
import net.minecraft.world.World;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Entry point. The growth itself comes from the three mixins (sugar cane, cactus and nether wart
 * become {@code Fertilizable}); this class only keeps players without the mod in step.
 *
 * <p>A game without the mod does not know these plants take bone meal: its own guess for the
 * click is "nothing happened", so right behind the click it tries the bone meal's item use and
 * then the off hand (a held block would be placed next to the plant, food eaten). The server
 * grows the plant from the first click and ignores those follow-ups of the same right-click. A
 * game with the mod already knows the click worked and never sends them.
 */
public final class BonemealMore implements ModInitializer {
    public static final String MOD_ID = "bonemealmore";
    public static final Logger LOG = LoggerFactory.getLogger("Bonemeal More");

    /** Server tick of each player's last growth by bone meal on one of the mod's plants (server thread only). */
    private static final Map<PlayerEntity, Long> LAST_GROWTH = new WeakHashMap<>();

    @Override
    public void onInitialize() {
        UseBlockCallback.EVENT.register(BonemealMore::onUseBlock);
        UseItemCallback.EVENT.register(BonemealMore::onUseItem);
        LOG.info("Bone meal now grows sugar cane, cactus and nether wart");
    }

    /** Remembers a bone meal click that will grow one of the mod's plants; drops the follow-ups behind it. */
    static ActionResult onUseBlock(PlayerEntity player, World world, Hand hand, BlockHitResult hit) {
        if (world.isClient()) return ActionResult.PASS;
        if (hand == Hand.MAIN_HAND) {
            ItemStack held = player.getStackInHand(hand);
            BlockPos pos = hit.getBlockPos();
            BlockState state = world.getBlockState(pos);
            // the game's bone meal code runs right after this callback and grows the plant
            if (held.isOf(Items.BONE_MEAL) && !player.isSpectator() && player.canModifyBlocks() && PlantGrowth.canBoneMeal(world, pos, state)) {
                LAST_GROWTH.put(player, world.getTime());
            }
            return ActionResult.PASS;
        }
        return isFollowUp(player, world) ? ignore(player) : ActionResult.PASS;
    }

    /** The item use a game without the mod sends behind the click is ignored. */
    static TypedActionResult<ItemStack> onUseItem(PlayerEntity player, World world, Hand hand) {
        ItemStack stack = player.getStackInHand(hand);
        if (world.isClient() || !isFollowUp(player, world)) return TypedActionResult.pass(stack);
        ignore(player);
        return TypedActionResult.fail(stack);
    }

    private static boolean isFollowUp(PlayerEntity player, World world) {
        return GrowthRules.blocksFollowUp(LAST_GROWTH.getOrDefault(player, -1L), world.getTime());
    }

    /** Sends the real inventory back, so a guessed block placement or bite does not look used up. */
    private static ActionResult ignore(PlayerEntity player) {
        if (player instanceof ServerPlayerEntity serverPlayer) serverPlayer.currentScreenHandler.syncState();
        return ActionResult.FAIL;
    }
}
