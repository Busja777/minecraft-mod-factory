package com.factory.stackmore.mixin;

import com.llamalad7.mixinextras.injector.wrapoperation.Operation;
import com.llamalad7.mixinextras.injector.wrapoperation.WrapOperation;
import net.minecraft.entity.player.PlayerInventory;
import net.minecraft.item.ItemStack;
import net.minecraft.item.PotionItem;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;

/**
 * The only mixin of the mod. In 1.21.1 {@code PotionItem.finishUsing} hands the empty glass bottle
 * back in two ways: as the new hand stack when the potion was the last one, or, when more potions
 * are left in the stack, through {@code PlayerInventory.insertStack}, whose result vanilla ignores.
 * In vanilla that second case never happens in survival (potions do not stack), but with stacks of
 * 16 a full inventory would swallow the bottle. Wrapped here: when the bottle does not fit, it drops
 * at the player's feet, the same way {@code ItemUsage.exchangeStack} (cauldrons, honey bottles)
 * already does. Everything else in the method runs unchanged.
 */
@Mixin(PotionItem.class)
abstract class PotionItemMixin {
    @WrapOperation(method = "finishUsing", at = @At(value = "INVOKE",
        target = "Lnet/minecraft/entity/player/PlayerInventory;insertStack(Lnet/minecraft/item/ItemStack;)Z"))
    private boolean stackmore$dropBottleWhenFull(PlayerInventory inventory, ItemStack bottle, Operation<Boolean> original) {
        boolean inserted = original.call(inventory, bottle);
        if (!inserted && !bottle.isEmpty()) inventory.player.dropItem(bottle, false);
        return inserted;
    }
}
