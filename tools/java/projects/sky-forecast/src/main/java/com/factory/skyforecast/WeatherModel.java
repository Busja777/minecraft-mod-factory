package com.factory.skyforecast;

/**
 * The weather timers of Minecraft 1.21.1 as plain numbers, and one server tick of them exactly as
 * {@code ServerWorld.tickWeather} does it (yarn 1.21.1+build.3).
 *
 * <p>Vanilla keeps five values in the overworld's {@code ServerWorldProperties}: clearWeatherTime
 * (only set by {@code /weather clear}), rainTime, thunderTime and the raining / thundering flags.
 * Rain and thunder are two independent timers; a thunderstorm is seen only while both flags are on.
 * When a timer reaches 0 its flag flips; on the next tick a new duration is drawn for the new state.
 */
public final class WeatherModel {
    /** ServerWorld.CLEAR_WEATHER_DURATION_PROVIDER: ticks without rain (also /weather clear without a time). */
    public static final int CLEAR_MIN = 12_000, CLEAR_MAX = 180_000;
    /** ServerWorld.RAIN_WEATHER_DURATION_PROVIDER: ticks of rain. */
    public static final int RAIN_MIN = 12_000, RAIN_MAX = 24_000;
    /** ServerWorld.CLEAR_THUNDER_WEATHER_DURATION_PROVIDER: ticks without the thunder flag. */
    public static final int CALM_MIN = 12_000, CALM_MAX = 180_000;
    /** ServerWorld.THUNDER_WEATHER_DURATION_PROVIDER: ticks with the thunder flag. */
    public static final int THUNDER_MIN = 3_600, THUNDER_MAX = 15_600;

    /** The five weather values of the overworld's level properties. */
    public record Sky(int clearTime, int rainTime, int thunderTime, boolean raining, boolean thundering) {}

    /** The random duration vanilla draws (UniformIntProvider, both ends included). */
    @FunctionalInterface
    public interface Dice {
        int roll(int min, int max);
    }

    private WeatherModel() {}

    /** One tick of ServerWorld.tickWeather with the doWeatherCycle game rule on (with it off nothing changes). */
    public static Sky step(Sky sky, Dice dice) {
        int clear = sky.clearTime(), thunder = sky.thunderTime(), rain = sky.rainTime();
        boolean thundering = sky.thundering(), raining = sky.raining();
        if (clear > 0) {
            // /weather clear: both flags off; the timers wait at 1, so both flags flip on the tick after it ends
            clear--;
            thunder = thundering ? 0 : 1;
            rain = raining ? 0 : 1;
            thundering = false;
            raining = false;
        } else {
            if (thunder > 0) {
                if (--thunder == 0) thundering = !thundering;
            } else {
                thunder = thundering ? dice.roll(THUNDER_MIN, THUNDER_MAX) : dice.roll(CALM_MIN, CALM_MAX);
            }
            if (rain > 0) {
                if (--rain == 0) raining = !raining;
            } else {
                rain = raining ? dice.roll(RAIN_MIN, RAIN_MAX) : dice.roll(CLEAR_MIN, CLEAR_MAX);
            }
        }
        return new Sky(clear, rain, thunder, raining, thundering);
    }

    /** Ticks a sky n times. */
    public static Sky steps(Sky sky, long n, Dice dice) {
        for (long i = 0; i < n; i++) sky = step(sky, dice);
        return sky;
    }
}
