package com.factory.afktag;

import com.factory.afktag.AfkRules.Change;
import com.factory.afktag.AfkRules.Sample;
import java.util.List;
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
 * chat line when they go and come back, and (since 1.1) do not count when the server decides
 * whether enough players sleep to skip the night. Since 1.2 the tag shows how long the player has
 * been idle ("[AFK 12m]"); the entry is sent again only when the shown minutes change, i.e. once a
 * minute per AFK player. Everything runs on the server; the player list entry is sent with vanilla
 * packets, so players without the mod see the tag too.
 */
public final class AfkTag implements ModInitializer {
    public static final String MOD_ID = "afktag";
    public static final Logger LOG = LoggerFactory.getLogger("AFK Tag");

    /** One idle timer per online player (server thread only; concurrent for the odd read elsewhere). */
    private static final Map<UUID, AfkRules.Timer> TIMERS = new ConcurrentHashMap<>();
    private static volatile long timeoutTicks = AfkConfig.defaults().timeoutTicks();
    private static volatile boolean ignoreAfkForSleep = AfkConfig.DEFAULT_IGNORE_AFK_FOR_SLEEP;
    private static volatile boolean showAfkTime = AfkConfig.DEFAULT_SHOW_AFK_TIME;

    @Override
    public void onInitialize() {
        ServerLifecycleEvents.SERVER_STARTING.register(server -> {
            AfkConfig config = AfkConfig.load(FabricLoader.getInstance().getConfigDir(), LOG::warn);
            timeoutTicks = config.timeoutTicks();
            ignoreAfkForSleep = config.ignoreAfkForSleep();
            showAfkTime = config.showAfkTime();
            TIMERS.clear();
            LOG.info("Players count as AFK after {} idle minute(s); AFK players {} for skipping the night; the player list {} the AFK time",
                config.minutes(), config.ignoreAfkForSleep() ? "do not count" : "count", config.showAfkTime() ? "shows" : "does not show");
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

    /** Idle ticks of the player with this id since their last input (0 when unknown). */
    public static long idleTicks(UUID player) {
        AfkRules.Timer timer = TIMERS.get(player);
        return timer == null ? 0 : timer.idleTicks();
    }

    /** For the game tests: idle ticks before the tag (the config file sets it on server start). */
    public static void setTimeoutTicks(long ticks) {
        timeoutTicks = Math.max(1, ticks);
    }

    /** For the game tests: whether AFK players are left out of the night-skip count (the config file sets it on server start). */
    public static void setIgnoreAfkForSleep(boolean ignore) {
        ignoreAfkForSleep = ignore;
    }

    /** For the game tests: whether the player list shows the AFK time (the config file sets it on server start). */
    public static void setShowAfkTime(boolean show) {
        showAfkTime = show;
    }

    /** For the game tests: as if the player had been idle {@code ticks} more ticks. */
    public static void addIdleTicks(UUID player, long ticks) {
        AfkRules.Timer timer = TIMERS.get(player);
        if (timer != null) timer.addIdleTicks(ticks);
    }

    /** The players the night-skip vote counts (called by the SleepManager mixin). */
    public static List<ServerPlayerEntity> sleepCounted(List<ServerPlayerEntity> players) {
        return AfkSleep.counted(players, player -> isAfk(player.getUuid()), ignoreAfkForSleep);
    }

    /** The player list name with the tag in front (called by the mixin when the player is AFK). */
    public static Text tagged(ServerPlayerEntity player, Text listName) {
        // Without a list name the client shows the name with its team prefix and colour, so keep those.
        Text name = listName != null ? listName : Team.decorateName(player.getScoreboardTeam(), player.getName());
        AfkRules.Timer timer = TIMERS.get(player.getUuid());
        String label = AfkLabel.label(timer == null ? 0 : timer.idleTicks(), showAfkTime);
        return Text.empty().append(Text.literal(label + " ").formatted(Formatting.GRAY)).append(name);
    }

    private static void tick(MinecraftServer server) {
        for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
            AfkRules.Timer timer = TIMERS.computeIfAbsent(player.getUuid(), id -> new AfkRules.Timer());
            Change change = timer.tick(sample(player), timeoutTicks);
            if (change != Change.NONE) announce(server, player, change);
            // the shown AFK time went up by a minute: only then is the entry sent again
            else if (showAfkTime && timer.isAfk() && AfkLabel.minuteTurned(timer.idleTicks())) sendListName(server, player);
        }
    }

    static Sample sample(ServerPlayerEntity player) {
        Entity vehicle = player.getVehicle();
        boolean steering = vehicle != null && (player.forwardSpeed != 0 || player.sidewaysSpeed != 0);
        boolean pushedAround = vehicle != null || player.isTouchingWater() || player.isInLava();
        return new Sample(player.getWorld().getRegistryKey().getValue().toString(), player.getX(), player.getZ(),
            player.getYaw(), player.getPitch(), player.getLastActionTime(), pushedAround, steering);
    }

    /** Sends the player's list name (see the mixin) to everyone, with the vanilla packet for display names. */
    private static void sendListName(MinecraftServer server, ServerPlayerEntity player) {
        server.getPlayerManager().sendToAll(new PlayerListS2CPacket(PlayerListS2CPacket.Action.UPDATE_DISPLAY_NAME, player));
    }

    private static void announce(MinecraftServer server, ServerPlayerEntity player, Change change) {
        // the new player list name (see the mixin) to everyone, then the chat line
        sendListName(server, player);
        MutableText line = Text.empty().append(player.getDisplayName())
            .append(change == Change.NOW_AFK ? " is now AFK" : " is back");
        server.getPlayerManager().broadcast(line.formatted(Formatting.GRAY), false);
        // The world caches its sleep count and only recounts when someone lies down, gets up, joins or
        // leaves; recount now so going AFK (or coming back) changes the vote at once.
        if (ignoreAfkForSleep) player.getServerWorld().updateSleepingPlayers();
    }
}
