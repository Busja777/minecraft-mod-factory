package com.factory.skyforecast;

import com.factory.skyforecast.Forecast.Place;
import com.factory.skyforecast.Forecast.Precipitation;
import com.factory.skyforecast.Forecast.Rules;
import com.factory.skyforecast.WeatherModel.Sky;
import java.util.List;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.command.CommandManager;
import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import net.minecraft.util.math.BlockPos;
import net.minecraft.world.GameRules;
import net.minecraft.world.dimension.DimensionType;
import net.minecraft.world.level.ServerWorldProperties;

/**
 * Entry point: the /forecast command. It reads the overworld's weather timers on the server (all
 * dimensions share them) and answers in plain chat, so it works for every player without OP and
 * without the mod on their side.
 */
public final class SkyForecast implements ModInitializer {
    public static final String MOD_ID = "skyforecast";

    @Override
    public void onInitialize() {
        CommandRegistrationCallback.EVENT.register((dispatcher, registries, environment) ->
            dispatcher.register(CommandManager.literal("forecast").executes(ctx -> run(ctx.getSource()))));
    }

    /** Sends the forecast to whoever ran the command; returns the number of lines. */
    public static int run(ServerCommandSource source) {
        List<String> lines = linesFor(source);
        for (int i = 0; i < lines.size(); i++) {
            Text line = Text.literal(lines.get(i)).formatted(i == 0 ? Formatting.AQUA : Formatting.GRAY);
            source.sendFeedback(() -> line, false);
        }
        return lines.size();
    }

    /** The forecast lines for a command source: its dimension and, for a player or block, its biome. */
    public static List<String> linesFor(ServerCommandSource source) {
        MinecraftServer server = source.getServer();
        ServerWorld world = source.getWorld();
        boolean weatherHere = hasWeather(world.getDimension());
        Precipitation precipitation = Precipitation.UNKNOWN;
        if (weatherHere) {
            BlockPos pos = BlockPos.ofFloored(source.getPosition());
            precipitation = switch (world.getBiome(pos).value().getPrecipitation(pos)) {
                case RAIN -> Precipitation.RAIN;
                case SNOW -> Precipitation.SNOW;
                case NONE -> Precipitation.NONE;
            };
        }
        return Forecast.lines(skyOf(server), rulesOf(server), weatherHere ? Place.WEATHER : Place.NO_WEATHER, precipitation);
    }

    /** Weather only falls where the sky is open (World.isRaining/isThundering check the same). */
    static boolean hasWeather(DimensionType dimension) {
        return dimension.hasSkyLight() && !dimension.hasCeiling();
    }

    /** The overworld's weather values; the other dimensions read the same ones. */
    public static Sky skyOf(MinecraftServer server) {
        ServerWorldProperties p = server.getSaveProperties().getMainWorldProperties();
        return new Sky(p.getClearWeatherTime(), p.getRainTime(), p.getThunderTime(), p.isRaining(), p.isThundering());
    }

    public static Rules rulesOf(MinecraftServer server) {
        GameRules rules = server.getGameRules();
        return new Rules(rules.getBoolean(GameRules.DO_WEATHER_CYCLE), rules.getBoolean(GameRules.DO_DAYLIGHT_CYCLE),
            server.getTickManager().isFrozen());
    }
}
