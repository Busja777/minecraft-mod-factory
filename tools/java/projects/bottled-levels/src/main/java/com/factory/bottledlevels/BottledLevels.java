package com.factory.bottledlevels;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.event.player.UseBlockCallback;
import net.fabricmc.fabric.api.event.player.UseItemCallback;

/**
 * Entry point: sneak and right-click an enchanting table with a glass bottle to bottle 50 experience
 * points (see {@link Bottling}); a thrown filled bottle releases its stored amount (see
 * {@code mixin.ExperienceBottleEntityMixin}).
 */
public final class BottledLevels implements ModInitializer {
    public static final String MOD_ID = "bottledlevels";

    @Override
    public void onInitialize() {
        UseBlockCallback.EVENT.register(Bottling::onUseBlock);
        UseItemCallback.EVENT.register(Bottling::onUseItem);
    }
}
