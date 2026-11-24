package com.factory.joingreeter;

import com.factory.joingreeter.Greeting.Segment;
import com.factory.joingreeter.JoinConfig.KitItem;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.registry.Registries;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.stat.Stats;
import net.minecraft.text.MutableText;
import net.minecraft.text.Style;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import net.minecraft.util.Identifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Entry point: greets players when they join, shows the rules and gives first-time players the
 * starter kit. Everything runs on the server with vanilla chat messages, so players need nothing.
 *
 * <p>The decision "first time or back" and the kit happen in Fabric's JOIN event, while the player
 * is still being connected (before the first tick counts their play time). The messages follow a
 * second later from the server tick, after vanilla's "joined the game" line, when the player is in
 * the player list and {online} counts them too.
 */
public final class JoinGreeter implements ModInitializer {
    public static final String MOD_ID = "joingreeter";
    public static final Logger LOG = LoggerFactory.getLogger("Join Greeter");
    /** Ticks between joining and the messages. */
    public static final int DELAY_TICKS = 20;

    private record Pending(boolean firstTime, int dueTick) {}

    /** One resolved kit entry. */
    private record KitStack(Item item, int count) {}

    private static final Map<UUID, Pending> PENDING = new ConcurrentHashMap<>();
    private static volatile JoinConfig config = JoinConfig.defaults();
    private static volatile List<KitStack> kit = List.of();

    @Override
    public void onInitialize() {
        ServerLifecycleEvents.SERVER_STARTING.register(server -> {
            setConfig(JoinConfig.load(FabricLoader.getInstance().getConfigDir(), LOG::warn));
            PENDING.clear();
            LOG.info("Greeting players; starter kit: {}", kit.isEmpty() ? "none" : kit.size() + " item type(s)");
        });
        ServerLifecycleEvents.SERVER_STOPPED.register(server -> PENDING.clear());
        ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> onJoin(handler.getPlayer(), server));
        ServerPlayConnectionEvents.DISCONNECT.register((handler, server) -> PENDING.remove(handler.getPlayer().getUuid()));
        ServerTickEvents.END_SERVER_TICK.register(JoinGreeter::deliver);
    }

    /** Uses these settings from now on; kit items that do not exist in this game are skipped with a warning. */
    public static void setConfig(JoinConfig newConfig) {
        List<KitStack> resolved = new ArrayList<>();
        for (KitItem entry : newConfig.starterKit()) {
            Identifier id = Identifier.tryParse(entry.item());
            Item item = id == null ? Items.AIR : Registries.ITEM.get(id);
            if (id == null || item == Items.AIR || !Registries.ITEM.containsId(id)) {
                LOG.warn("config/{}: there is no item {}, it is left out of the starter kit", JoinConfig.FILE_NAME, entry.item());
                continue;
            }
            resolved.add(new KitStack(item, entry.count()));
        }
        config = newConfig;
        kit = List.copyOf(resolved);
    }

    public static JoinConfig config() {
        return config;
    }

    /** Whether this player has never been in this world before (see {@link Greeting#isFirstJoin}). */
    public static boolean isFirstJoin(ServerPlayerEntity player) {
        var stats = player.getStatHandler();
        return Greeting.isFirstJoin(
            stats.getStat(Stats.CUSTOM, Stats.LEAVE_GAME),
            stats.getStat(Stats.CUSTOM, Stats.PLAY_TIME),
            stats.getStat(Stats.CUSTOM, Stats.TOTAL_WORLD_TIME));
    }

    /** Called when a player joins: decides first time or back, gives the kit, queues the messages. */
    public static void onJoin(ServerPlayerEntity player, MinecraftServer server) {
        boolean firstTime = isFirstJoin(player);
        if (firstTime) {
            int given = giveKit(player);
            LOG.info("{} joins for the first time{}", player.getName().getString(), given > 0 ? ", gave " + given + " starter kit stack(s)" : "");
        }
        PENDING.put(player.getUuid(), new Pending(firstTime, server.getTicks() + DELAY_TICKS));
    }

    /** Whether a player's messages are still waiting to be sent. */
    public static boolean isPending(UUID player) {
        return PENDING.containsKey(player);
    }

    /** Puts the starter kit into the player's inventory (dropped at their feet if it is full); returns the stacks given. */
    public static int giveKit(ServerPlayerEntity player) {
        int stacks = 0;
        for (KitStack entry : kit) {
            int max = new ItemStack(entry.item()).getMaxCount();
            for (int size : Greeting.stacks(entry.count(), max)) {
                player.getInventory().offerOrDrop(new ItemStack(entry.item(), size));
                stacks++;
            }
        }
        return stacks;
    }

    /** The chat lines for a player, coloured and with the placeholders filled. */
    public static List<Text> messages(JoinConfig config, boolean firstTime, String playerName, int online) {
        Map<String, String> values = Map.of("player", playerName, "online", Integer.toString(online));
        List<Text> out = new ArrayList<>();
        for (String line : Greeting.lines(config, firstTime)) out.add(toText(Greeting.render(line, values)));
        return out;
    }

    static Text toText(List<Segment> segments) {
        MutableText line = Text.empty();
        for (Segment s : segments) {
            Style style = Style.EMPTY.withBold(s.bold() ? true : null).withItalic(s.italic() ? true : null)
                .withUnderline(s.underlined() ? true : null).withStrikethrough(s.strikethrough() ? true : null)
                .withObfuscated(s.obfuscated() ? true : null);
            if (s.color() != 0) style = style.withColor(Formatting.byCode(s.color()));
            line.append(Text.literal(s.text()).setStyle(style));
        }
        return line;
    }

    private static void deliver(MinecraftServer server) {
        if (PENDING.isEmpty()) return;
        int now = server.getTicks();
        PENDING.entrySet().removeIf(entry -> {
            if (entry.getValue().dueTick() > now) return false;
            ServerPlayerEntity player = server.getPlayerManager().getPlayer(entry.getKey());
            if (player != null) {
                List<Text> lines = messages(config, entry.getValue().firstTime(), player.getName().getString(), server.getCurrentPlayerCount());
                for (Text line : lines) player.sendMessage(line, false);
            }
            return true;
        });
    }
}
