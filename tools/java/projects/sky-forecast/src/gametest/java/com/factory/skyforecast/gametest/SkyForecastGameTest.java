package com.factory.skyforecast.gametest;

import com.factory.skyforecast.Forecast;
import com.factory.skyforecast.SkyForecast;
import com.factory.skyforecast.WeatherModel;
import com.factory.skyforecast.WeatherModel.Sky;
import java.util.ArrayList;
import java.util.List;
import net.fabricmc.fabric.api.gametest.v1.FabricGameTest;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.command.CommandOutput;
import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.test.GameTest;
import net.minecraft.test.TestContext;
import net.minecraft.text.Text;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec2f;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.GameRules;
import net.minecraft.world.World;
import net.minecraft.world.level.ServerWorldProperties;

/**
 * In-world tests on a headless game test server (gradlew :sky-forecast:runGametest).
 *
 * <p>The command runs through the server's real command dispatcher with permission level 0, like a
 * player without OP. The weather is global, so every test that lets the weather tick runs in a batch
 * of its own (batches run one after another) and compares the real ServerWorld.tickWeather with
 * {@link WeatherModel} over the ticks that passed. The test server keeps doWeatherCycle off and the
 * weather fixed (TestServer.setupServer); each test puts that back when it is done.
 */
public class SkyForecastGameTest implements FabricGameTest {
    private static MinecraftServer server(TestContext ctx) {
        return ctx.getWorld().getServer();
    }

    private static ServerWorldProperties properties(TestContext ctx) {
        return server(ctx).getSaveProperties().getMainWorldProperties();
    }

    private static void setSky(TestContext ctx, Sky sky) {
        ServerWorldProperties p = properties(ctx);
        p.setClearWeatherTime(sky.clearTime());
        p.setRainTime(sky.rainTime());
        p.setThunderTime(sky.thunderTime());
        p.setRaining(sky.raining());
        p.setThundering(sky.thundering());
    }

    private static void weatherCycle(TestContext ctx, boolean on) {
        server(ctx).getGameRules().get(GameRules.DO_WEATHER_CYCLE).set(on, server(ctx));
    }

    /** What TestServer sets up: no weather cycle, clear for good. */
    private static void restore(TestContext ctx) {
        weatherCycle(ctx, false);
        server(ctx).getOverworld().setWeather(20_000_000, 20_000_000, false, false);
    }

    private static CommandOutput collect(List<String> lines) {
        return new CommandOutput() {
            @Override
            public void sendMessage(Text message) {
                lines.add(message.getString());
            }

            @Override
            public boolean shouldReceiveFeedback() {
                return true;
            }

            @Override
            public boolean shouldTrackOutput() {
                return true;
            }

            @Override
            public boolean shouldBroadcastConsoleToOps() {
                return false;
            }
        };
    }

    /** Types /forecast as a source without OP in the given world; returns the chat lines. */
    private static List<String> forecast(TestContext ctx, ServerWorld world) {
        List<String> lines = new ArrayList<>();
        ServerCommandSource source = new ServerCommandSource(collect(lines), Vec3d.ofCenter(ctx.getAbsolutePos(new BlockPos(1, 2, 1))),
            Vec2f.ZERO, world, 0, "Tester", Text.literal("Tester"), server(ctx), null);
        ctx.assertTrue(!source.hasPermissionLevel(1), "the source has no OP");
        server(ctx).getCommandManager().executeWithPrefix(source, "/forecast");
        return lines;
    }

    private static void expectLines(TestContext ctx, List<String> expected, List<String> got) {
        ctx.assertTrue(expected.equals(got), "expected " + expected + ", got " + got);
    }

    /**
     * The real weather after the ticks that passed (counted with the world time, which ticks in the
     * same ServerWorld.tick) must be what the model gives, the drawn timers between the smallest and
     * largest draw.
     */
    private static long expectModel(TestContext ctx, Sky start, long startTime) {
        long n = ctx.getWorld().getTime() - startTime;
        Sky real = SkyForecast.skyOf(server(ctx));
        Sky lo = WeatherModel.steps(start, n, (min, max) -> min);
        Sky hi = WeatherModel.steps(start, n, (min, max) -> max);
        String what = "after " + n + " ticks from " + start + ": real " + real + ", model " + lo + " / " + hi;
        ctx.assertTrue(real.raining() == lo.raining() && real.raining() == hi.raining(), "raining " + what);
        ctx.assertTrue(real.thundering() == lo.thundering() && real.thundering() == hi.thundering(), "thundering " + what);
        ctx.assertTrue(real.clearTime() == lo.clearTime(), "clear time " + what);
        ctx.assertTrue(lo.rainTime() <= real.rainTime() && real.rainTime() <= hi.rainTime(), "rain time " + what);
        ctx.assertTrue(lo.thunderTime() <= real.thunderTime() && real.thunderTime() <= hi.thunderTime(), "thunder time " + what);
        return n;
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void anyPlayerGetsTheForecast(TestContext ctx) {
        setSky(ctx, new Sky(0, 7_200, 50_000, true, false));
        weatherCycle(ctx, true);
        List<String> lines = forecast(ctx, server(ctx).getOverworld());
        restore(ctx);
        expectLines(ctx, List.of("Now: rain.", "The rain stops in about 6 minutes.", "No thunder before it stops.",
            "Sleeping through the night stops the rain."), lines.subList(0, Math.min(4, lines.size())));
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void aPlayerInTheWorldGetsTheSameForecast(TestContext ctx) {
        @SuppressWarnings("removal") // the mock server player is deprecated in 1.21.1 but still the way to test a real player
        ServerPlayerEntity player = ctx.createMockCreativeServerPlayerInWorld();
        List<String> lines = new ArrayList<>();
        setSky(ctx, new Sky(0, 36_000, 100_000, false, false));
        weatherCycle(ctx, true);
        server(ctx).getCommandManager().executeWithPrefix(player.getCommandSource().withOutput(collect(lines)).withLevel(0), "/forecast");
        restore(ctx);
        // the test server keeps doDaylightCycle off, so the forecast speaks in minutes, not days
        boolean days = server(ctx).getGameRules().getBoolean(GameRules.DO_DAYLIGHT_CYCLE);
        expectLines(ctx, List.of("Now: clear sky.", days ? "Rain starts in about 1.5 days." : "Rain starts in about 30 minutes.",
            "No thunder with this rain."), lines.subList(0, Math.min(3, lines.size())));
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void theRuleOffMeansNoChange(TestContext ctx) {
        setSky(ctx, new Sky(0, 600, 600, true, true));
        weatherCycle(ctx, false);
        List<String> lines = forecast(ctx, server(ctx).getOverworld());
        restore(ctx);
        expectLines(ctx, List.of("Now: thunderstorm.", "The weather will not change: the doWeatherCycle game rule is off."),
            lines.subList(0, Math.min(2, lines.size())));
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE)
    public void theNetherHasNoWeather(TestContext ctx) {
        ServerWorld nether = server(ctx).getWorld(World.NETHER);
        ctx.assertTrue(nether != null, "the test server has a Nether");
        setSky(ctx, new Sky(0, 7_200, 50_000, true, false));
        weatherCycle(ctx, true);
        List<String> lines = forecast(ctx, nether);
        restore(ctx);
        expectLines(ctx, List.of("There is no weather in this dimension. In the Overworld:", "Now: rain.", "The rain stops in about 6 minutes.",
            "No thunder before it stops.", "Sleeping through the night stops the rain."), lines);
        ctx.complete();
    }

    @GameTest(templateName = EMPTY_STRUCTURE, batchId = "skyforecast_weather_clear", tickLimit = 200)
    public void weatherClearEndsInAThunderstorm(TestContext ctx) {
        weatherCycle(ctx, true);
        // the real vanilla command, as an operator would type it
        server(ctx).getCommandManager().executeWithPrefix(server(ctx).getCommandSource().withSilent(), "/weather clear 30t");
        Sky start = SkyForecast.skyOf(server(ctx));
        long t0 = ctx.getWorld().getTime();
        ctx.assertTrue(start.clearTime() == 30 && !start.raining(), "/weather clear 30t set " + start);
        expectLines(ctx, List.of("Now: clear sky.", "Clear for less than a minute (set by /weather clear), then a thunderstorm starts."),
            forecast(ctx, server(ctx).getOverworld()));
        ctx.waitAndRun(45, () -> {
            long n = expectModel(ctx, start, t0);
            Sky now = SkyForecast.skyOf(server(ctx));
            restore(ctx);
            ctx.assertTrue(n >= 31 && now.raining() && now.thundering(), "a thunderstorm after " + n + " ticks: " + now);
            ctx.complete();
        });
    }

    @GameTest(templateName = EMPTY_STRUCTURE, batchId = "skyforecast_weather_rain", tickLimit = 200)
    public void theRainStartsWhenTheForecastSays(TestContext ctx) {
        Sky start = new Sky(0, 25, 200, false, false);
        setSky(ctx, start);
        weatherCycle(ctx, true);
        long t0 = ctx.getWorld().getTime();
        Forecast.Report report = Forecast.of(SkyForecast.skyOf(server(ctx)), true);
        ctx.assertTrue(report.rainChange().equals(Forecast.Span.of(25)), "rain in 25 ticks: " + report);
        ctx.waitAndRun(40, () -> {
            long n = expectModel(ctx, start, t0);
            Sky now = SkyForecast.skyOf(server(ctx));
            restore(ctx);
            ctx.assertTrue(n >= 25 && now.raining() && !now.thundering(), "rain after " + n + " ticks: " + now);
            ctx.complete();
        });
    }

    @GameTest(templateName = EMPTY_STRUCTURE, batchId = "skyforecast_weather_storm", tickLimit = 200)
    public void theThunderStopsBeforeTheRain(TestContext ctx) {
        Sky start = new Sky(0, 300, 20, true, true);
        setSky(ctx, start);
        weatherCycle(ctx, true);
        long t0 = ctx.getWorld().getTime();
        Forecast.Report report = Forecast.of(start, true);
        ctx.assertTrue(report.thunder() == Forecast.Thunder.STOPS_FIRST && report.thunderAt().equals(Forecast.Span.of(20)), "thunder stops first: " + report);
        ctx.waitAndRun(40, () -> {
            long n = expectModel(ctx, start, t0);
            Sky now = SkyForecast.skyOf(server(ctx));
            restore(ctx);
            ctx.assertTrue(n >= 21 && now.raining() && !now.thundering(), "rain without thunder after " + n + " ticks: " + now);
            ctx.complete();
        });
    }
}
