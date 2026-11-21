package com.factory.afktag.mixin;

import com.factory.afktag.AfkTag;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * The only mixin of the mod. {@code ServerPlayerEntity#getPlayerListName()} is where the game asks
 * for the name a player gets in the player list (vanilla always answers null, i.e. "the plain
 * name"); every player list packet (join, display name update) reads it. Fabric API has no event
 * for it, so the tag goes in here, at RETURN so a name set by another mod is kept behind the tag.
 */
@Mixin(ServerPlayerEntity.class)
abstract class ServerPlayerEntityMixin {
    @Inject(method = "getPlayerListName", at = @At("RETURN"), cancellable = true)
    private void afktag$tagIdlePlayers(CallbackInfoReturnable<Text> cir) {
        ServerPlayerEntity self = (ServerPlayerEntity) (Object) this;
        if (AfkTag.isAfk(self.getUuid())) cir.setReturnValue(AfkTag.tagged(self, cir.getReturnValue()));
    }
}
