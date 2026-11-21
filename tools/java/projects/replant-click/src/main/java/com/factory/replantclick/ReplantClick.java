package com.factory.replantclick;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.event.player.UseBlockCallback;
import net.fabricmc.fabric.api.event.player.UseItemCallback;

/** Entry point: right-click a fully grown crop, nether wart or cocoa pod to harvest and replant it. */
public final class ReplantClick implements ModInitializer {
    public static final String MOD_ID = "replantclick";

    @Override
    public void onInitialize() {
        UseBlockCallback.EVENT.register(CropHarvester::onUseBlock);
        UseItemCallback.EVENT.register(CropHarvester::onUseItem);
    }
}
