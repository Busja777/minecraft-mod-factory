package com.factory.patientanvil.mixin;

import com.factory.patientanvil.AnvilRules;
import net.minecraft.client.gui.screen.ingame.AnvilScreen;
import net.minecraft.screen.AnvilScreenHandler;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.Constant;
import org.spongepowered.asm.mixin.injection.ModifyConstant;

/**
 * The optional client-side half (listed under "client" in the mixin config, so a server never loads
 * it). {@code AnvilScreen#drawForeground} writes "Too Expensive!" in red for any cost of 40 or more
 * (its only int constant 40, checked in the 1.21.1 bytecode), even when the server sent a result.
 * With this, the screen shows "Enchantment Cost: N" whenever there is a result to take, and keeps
 * "Too Expensive!" when the result slot is empty (for example on a server without the mod).
 */
@Mixin(AnvilScreen.class)
abstract class AnvilScreenMixin {
    // require = 0: this only changes a label and was never run in a real client. If the target ever
    // does not match, the client keeps vanilla's "Too Expensive!" text instead of crashing.
    @ModifyConstant(method = "drawForeground", constant = @Constant(intValue = 40), require = 0)
    private int patientanvil$showTheCost(int forty) {
        AnvilScreenHandler handler = ((AnvilScreen) (Object) this).getScreenHandler();
        return AnvilRules.labelFrom(handler.getSlot(AnvilScreenHandler.OUTPUT_ID).hasStack());
    }
}
