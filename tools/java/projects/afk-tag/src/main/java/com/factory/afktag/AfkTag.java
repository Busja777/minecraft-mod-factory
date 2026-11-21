package com.factory.afktag;

import com.factory.afktag.AfkRules.Change;
import com.factory.afktag.AfkRules.Sample;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.entity.Entity;
import net.minecraft.network.packet.s2c.play.PlayerListS2CPacket;
import net.minecraft.scoreboard.Team;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.MutableText;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Entry point: players who stay idle get "[AFK]" in front of their name in the player list and a
 * chat line when they go and come back. Everything runs on the server; the player list entry is
 * sent with vanilla packets, so players without the mod see the tag too.
 */
public final class AfkTag implements ModInitializer {
    public static final String MOD_ID = "afktag";
    public static final Logger LOG = LoggerFactory.getLogger("AFK Tag");

    /** One idle timer per online player (server thread only; concurrent for the odd read elsewhere). */
    private static final Map<UUID, AfkRules.Timer> TIMERS = new ConcurrentHashMap<>();
    private static volatile long timeoutTicks = AfkConfig.defaults().timeoutTicks();

    @Override
    public void onInitialize() {
        ServerLifecycleEvents.SERVER_STARTING.register(server -> {
            AfkConfig config = AfkConfig.load(FabricLoader.getInstance().getConfigDir(), LOG::warn);
            timeoutTicks = config.timeoutTicks();
            TIMERS.clear();
            LOG.info("Players count as AFK after {} idle minute(s)", config.minutes());
        });
        ServerLifecycleEvents.SERVER_STOPPED.register(server -> TIMERS.clear());
        // A player who leaves starts fresh (not AFK) on the next join.
        ServerPlayConnectionEvents.DISCONNECT.register((handler, server) -> TIMERS.remove(handler.getPlayer().getUuid()));
        ServerTickEvents.END_SERVER_TICK.register(AfkTag::tick);
    }

    /** Whether the player with this id is AFK right now. */
    public static boolean isAfk(UUID player) {
        AfkRules.Timer timer = TIMERS.get(player);
        return timer != null && timer.isAfk();
    }

    /** For the game tests: idle ticks before the tag (the config file sets it on server start). */
    public static void setTimeoutTicks(long ticks) {
        timeoutTicks = Math.max(1, ticks);
    }

    /** The player list name with the tag in front (called by the mixin when the player is AFK). */
    public static Text tagged(ServerPlayerEntity player, Text listName) {
        // Without a list name the client shows the name with its team prefix and colour, so keep those.
        Text name = listName != null ? listName : Team.decorateName(player.getScoreboardTeam(), player.getName());
        return Text.empty().append(Text.literal("[AFK] ").formatted(Formatting.GRAY)).append(name);
    }

    private static void tick(MinecraftServer server) {
        for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
            AfkRules.Timer timer = TIMERS.computeIfAbsent(player.getUuid(), id -> new AfkRules.Timer());
            Change change = timer.tick(sample(player), timeoutTicks);
            if (change != Change.NONE) announce(server, player, change);
        }
    }

    static Sample sample(ServerPlayerEntity player) {
        Entity vehicle = player.getVehicle();
        boolean steering = vehicle != null && (player.forwardSpeed != 0 || player.sidewaysSpeed != 0);
        boolean pushedAround = vehicle != null || player.isTouchingWater() || player.isInLava();
        return new Sample(player.getWorld().getRegistryKey().getValue().toString(), player.getX(), player.getZ(),
            player.getYaw(), player.getPitch(), player.getLastActionTime(), pushedAround, steering);
    }

    private static void announce(MinecraftServer server, ServerPlayerEntity player, Change change) {
        // the new player list name (see the mixin) to everyone, then the chat line
        server.getPlayerManager().sendToAll(new PlayerListS2CPacket(PlayerListS2CPacket.Action.UPDATE_DISPLAY_NAME, player));
        MutableText line = Text.empty().append(player.getDisplayName())
            .append(change == Change.NOW_AFK ? " is now AFK" : " is back");
        server.getPlayerManager().broadcast(line.formatted(Formatting.GRAY), false);
    }
}
