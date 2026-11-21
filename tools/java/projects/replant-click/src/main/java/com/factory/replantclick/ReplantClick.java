package com.factory.replantclick;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.player.UseBlockCallback;
import net.fabricmc.fabric.api.event.player.UseItemCallback;
import net.fabricmc.loader.api.FabricLoader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Entry point: right-click a fully grown crop, nether wart or cocoa pod to harvest and replant it;
 * with a hoe (since 1.2) the ripe crops of the same kind in the 3×3 area around it too.
 *
 * <p>The settings come from config/replantclick.json (see {@link ReplantConfig}), read on every
 * server start.
 */
public final class ReplantClick implements ModInitializer {
    public static final String MOD_ID = "replantclick";
    public static final Logger LOG = LoggerFactory.getLogger("Replant Click");

    private static volatile ReplantConfig config = ReplantConfig.defaults();

    @Override
    public void onInitialize() {
        ServerLifecycleEvents.SERVER_STARTING.register(server -> {
            config = ReplantConfig.load(FabricLoader.getInstance().getConfigDir(), LOG::warn);
            LOG.info("Area harvest with a hoe is {}", config.areaWithHoe() ? "on" : "off");
        });
        UseBlockCallback.EVENT.register(CropHarvester::onUseBlock);
        UseItemCallback.EVENT.register(CropHarvester::onUseItem);
    }

    /** The settings in use (the config file sets them on server start). */
    public static ReplantConfig config() {
        return config;
    }

    /** For the game tests: other settings than the config file's. */
    public static void setConfig(ReplantConfig settings) {
        config = settings;
    }
}
