package com.factory.patientanvil.mixin;

import com.factory.patientanvil.AnvilRules;
import net.minecraft.screen.AnvilScreenHandler;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Constant;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.ModifyConstant;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * The server-side half (it also runs in singleplayer and in the client's own prediction).
 *
 * <p>{@code AnvilScreenHandler#updateResult()} is the only place where the game refuses an
 * expensive anvil result: after the cost is set it runs
 * {@code if (levelCost.get() >= 40 && !player.getAbilities().creativeMode) result = EMPTY}.
 * Fabric API has no event for it, so this mixin moves that 40. The method holds the int constant 40
 * three times (checked in the 1.21.1 bytecode):
 * <ol start="0">
 *   <li>{@code if (left.getCount() > 1) cost = 40;} while enchanting: vanilla's way to refuse
 *       enchanting a stack of items. It is left as it is, only noted, so that stays refused.</li>
 *   <li>{@code if (renameOnly && levelCost >= 40) levelCost = 39;} the rename discount: untouched.</li>
 *   <li>the refusal above: replaced by {@link AnvilRules#refuseFrom}.</li>
 * </ol>
 * The cost and the level check when taking the result ({@code canTakeOutput}: levels &gt;= cost)
 * are not touched.
 */
@Mixin(AnvilScreenHandler.class)
abstract class AnvilScreenHandlerMixin {
    /** Whether this updateResult() hit vanilla's "enchanting a stack" marker. */
    @Unique
    private boolean patientanvil$enchantsAStack;

    @Inject(method = "updateResult", at = @At("HEAD"))
    private void patientanvil$startFresh(CallbackInfo ci) {
        patientanvil$enchantsAStack = false;
    }

    // Only reached when the left item is a stack of more than one (the constant sits behind that check).
    @ModifyConstant(method = "updateResult", constant = @Constant(intValue = 40, ordinal = 0))
    private int patientanvil$noteStack(int forty) {
        patientanvil$enchantsAStack = true;
        return forty;
    }

    @ModifyConstant(method = "updateResult", constant = @Constant(intValue = 40, ordinal = 2))
    private int patientanvil$liftLimit(int forty) {
        return AnvilRules.refuseFrom(patientanvil$enchantsAStack);
    }
}
