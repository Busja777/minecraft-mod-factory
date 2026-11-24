package com.factory.skyforecast;

import static com.factory.skyforecast.WeatherModel.CALM_MAX;
import static com.factory.skyforecast.WeatherModel.CALM_MIN;
import static com.factory.skyforecast.WeatherModel.CLEAR_MAX;
import static com.factory.skyforecast.WeatherModel.CLEAR_MIN;
import static com.factory.skyforecast.WeatherModel.RAIN_MAX;
import static com.factory.skyforecast.WeatherModel.RAIN_MIN;
import static com.factory.skyforecast.WeatherModel.THUNDER_MAX;
import static com.factory.skyforecast.WeatherModel.THUNDER_MIN;

import com.factory.skyforecast.WeatherModel.Sky;
import java.util.ArrayList;
import java.util.List;

/**
 * What the weather does next, worked out from the timers alone (no guessing of random numbers).
 *
 * <p>A timer above 0 says exactly when its flag flips. Every duration after that is random, so the
 * forecast only claims what holds for every possible draw: an exact time where the timer is known,
 * a range ("10 to 20 minutes") where the next draw decides, and for thunder "certain", "possible"
 * or "not with this rain". All times are game ticks from now (20 ticks a second).
 */
public final class Forecast {
    public static final int TICKS_PER_MINUTE = 1_200;
    public static final int TICKS_PER_DAY = 24_000;

    /** A tick count from now that is known only within a range (min == max when exact). */
    public record Span(long min, long max) {
        public static Span of(long ticks) {
            return new Span(ticks, ticks);
        }

        public boolean exact() {
            return min == max;
        }

        Span plus(long lo, long hi) {
            return new Span(min + lo, max + hi);
        }
    }

    /** A stretch of time in which the thunder flag is on or off. */
    record Phase(boolean on, Span start, Span end) {}

    public enum Now { CLEAR, RAIN, THUNDERSTORM }

    /** What the thunder does with the current rain, or with the next one when it is dry. */
    public enum Thunder {
        /** No thunderstorm during this rain, whatever the dice say. */
        NONE,
        /** Thunder can come or not; the dice decide. */
        POSSIBLE,
        /** The coming rain starts as a thunderstorm. */
        WITH_RAIN,
        /** Thunder starts at a known time while it rains. */
        STARTS,
        /** A storm now: the thunder stops before the rain. */
        STOPS_FIRST,
        /** A storm now: the thunder lasts as long as the rain. */
        LASTS,
        /** A storm now: the thunder may stop before the rain or not. */
        MAY_STOP,
        /** The end of /weather clear: rain and thunder start together. */
        STORM
    }

    /**
     * The forecast.
     *
     * @param changes      false when the doWeatherCycle game rule is off (nothing changes then)
     * @param fromCommand  the clear sky was set with /weather clear (clearWeatherTime above 0)
     * @param rainChange   when the rain starts (dry now) or stops (raining now)
     * @param thunderAt    when the thunder starts (STARTS) or stops (STOPS_FIRST), else null
     */
    public record Report(Now now, boolean changes, boolean fromCommand, Span rainChange, Thunder thunder, Span thunderAt) {}

    /** Where the player stands. */
    public enum Place { WEATHER, NO_WEATHER }

    /** What falls in the player's biome when it rains (Biome.getPrecipitation at their position). */
    public enum Precipitation { RAIN, SNOW, NONE, UNKNOWN }

    /** The rules that matter: doWeatherCycle, doDaylightCycle (days or only minutes) and /tick freeze. */
    public record Rules(boolean weatherCycle, boolean daylightCycle, boolean frozen) {}

    private Forecast() {}

    public static Report of(Sky sky, boolean weatherCycle) {
        Now now = sky.raining() ? (sky.thundering() ? Now.THUNDERSTORM : Now.RAIN) : Now.CLEAR;
        if (!weatherCycle) return new Report(now, false, false, null, null, null);
        if (sky.clearTime() > 0) {
            // both flags are off and both timers wait at 1, so both flip on the tick after clearWeatherTime ends
            Span at = Span.of(sky.clearTime() + 1L);
            return new Report(Now.CLEAR, true, true, at, Thunder.STORM, at);
        }
        Span rainFlip = sky.raining() ? firstFlip(sky.rainTime(), RAIN_MIN, RAIN_MAX) : firstFlip(sky.rainTime(), CLEAR_MIN, CLEAR_MAX);
        // the rain window: the current rain, or the next one
        Span from = sky.raining() ? Span.of(0) : rainFlip;
        Span to = sky.raining() ? rainFlip : rainFlip.plus(RAIN_MIN + 1L, RAIN_MAX + 1L);
        List<Phase> thunder = thunderPhases(sky.thundering(), sky.thunderTime(), to.max());

        if (sky.raining() && sky.thundering()) {
            Span stop = thunder.get(0).end();
            if (stop.max() < to.min()) return new Report(now, true, false, rainFlip, Thunder.STOPS_FIRST, stop);
            if (stop.min() >= to.max()) return new Report(now, true, false, rainFlip, Thunder.LASTS, null);
            return new Report(now, true, false, rainFlip, Thunder.MAY_STOP, null);
        }
        return thunderDuring(now, rainFlip, from, to, thunder);
    }

    /** When a timer flips its flag: exactly at the timer, or (timer 0) after a duration drawn on the next tick. */
    static Span firstFlip(int timer, int min, int max) {
        return timer > 0 ? Span.of(timer) : new Span(1L + min, 1L + max);
    }

    /** The thunder flag's phases from now until the horizon. */
    static List<Phase> thunderPhases(boolean on, int timer, long horizon) {
        List<Phase> out = new ArrayList<>();
        Span start = Span.of(0);
        Span end = on ? firstFlip(timer, THUNDER_MIN, THUNDER_MAX) : firstFlip(timer, CALM_MIN, CALM_MAX);
        while (true) {
            out.add(new Phase(on, start, end));
            if (end.min() >= horizon) return out;
            on = !on;
            start = end;
            // the flag flips at the end, the next tick draws the duration: one tick more than the draw
            end = on ? start.plus(THUNDER_MIN + 1L, THUNDER_MAX + 1L) : start.plus(CALM_MIN + 1L, CALM_MAX + 1L);
        }
    }

    /**
     * Thunder during the rain window [from, to): only what holds for every draw. A thunder phase is
     * on for sure in [latest start, earliest end) and maybe in [earliest start, latest end); the rain
     * likewise in [from.max, to.min) and [from.min, to.max).
     */
    private static Report thunderDuring(Now now, Span rainFlip, Span from, Span to, List<Phase> phases) {
        long sureFrom = from.max(), sureTo = to.min(), mayFrom = from.min(), mayTo = to.max();
        boolean maybe = false;
        for (Phase p : phases) {
            if (!p.on()) continue;
            long onFrom = p.start().max(), onTo = p.end().min();
            if (now == Now.CLEAR && onFrom <= from.min() && from.max() < onTo && from.max() < sureTo) {
                return new Report(now, true, false, rainFlip, Thunder.WITH_RAIN, null);
            }
            if (Math.max(p.start().min(), mayFrom) >= Math.min(p.end().max(), mayTo)) continue;
            // the first thunder phase that can meet this rain: exact start while it surely rains → that is when
            if (!maybe && p.start().exact() && p.start().min() >= sureFrom && p.start().min() < Math.min(onTo, sureTo)) {
                return new Report(now, true, false, rainFlip, Thunder.STARTS, p.start());
            }
            maybe = true;
        }
        // a later phase is never certain: its start is spread over at least the 12,000-tick range of a calm draw
        return new Report(now, true, false, rainFlip, maybe ? Thunder.POSSIBLE : Thunder.NONE, null);
    }

    /** The chat lines of /forecast. */
    public static List<String> lines(Sky sky, Rules rules, Place place, Precipitation precipitation) {
        List<String> out = new ArrayList<>();
        if (place == Place.NO_WEATHER) out.add("There is no weather in this dimension. In the Overworld:");
        Report r = of(sky, rules.weatherCycle());
        boolean days = rules.daylightCycle();
        out.add(switch (r.now()) {
            case CLEAR -> "Now: clear sky.";
            case RAIN -> "Now: rain.";
            case THUNDERSTORM -> "Now: thunderstorm.";
        });
        if (!r.changes()) {
            out.add("The weather will not change: the doWeatherCycle game rule is off.");
        } else if (r.fromCommand()) {
            long ticks = r.rainChange().min();
            out.add((ticks < TICKS_PER_MINUTE ? "Clear for less than a minute" : "Clear for about " + duration(ticks, days))
                + " (set by /weather clear), then a thunderstorm starts.");
        } else {
            boolean raining = r.now() != Now.CLEAR;
            out.add((raining ? "The rain stops " : "Rain starts ") + in(r.rainChange(), days) + ".");
            String thunder = switch (r.thunder()) {
                case NONE -> raining ? "No thunder before it stops." : "No thunder with this rain.";
                case POSSIBLE -> raining ? "Thunder is possible before it stops." : "Thunder is possible with this rain.";
                case WITH_RAIN -> "The rain comes with thunder.";
                case STARTS -> "Thunder starts " + in(r.thunderAt(), days) + ".";
                case STOPS_FIRST -> "The thunder stops " + in(r.thunderAt(), days) + ", the rain goes on.";
                case LASTS -> "The thunder lasts until the rain stops.";
                case MAY_STOP -> "The thunder may stop before the rain does.";
                case STORM -> null;
            };
            if (thunder != null) out.add(thunder);
            if (r.now() == Now.RAIN) out.add("Sleeping through the night stops the rain.");
            if (r.now() == Now.THUNDERSTORM) out.add("Sleeping in a bed stops the storm.");
        }
        if (r.changes() && rules.frozen()) out.add("The game is frozen with /tick, so the weather waits too.");
        if (place == Place.WEATHER && precipitation == Precipitation.SNOW) out.add("Here it snows instead of raining.");
        if (place == Place.WEATHER && precipitation == Precipitation.NONE) out.add("It never rains in this biome.");
        return out;
    }

    /** "in about 6 minutes", "in less than a minute", "in 10 to 20 minutes", "in 10 minutes to 7.5 days". */
    static String in(Span span, boolean days) {
        if (span.exact()) return span.min() < TICKS_PER_MINUTE ? "in less than a minute" : "in about " + duration(span.min(), days);
        String lo = duration(span.min(), days), hi = duration(span.max(), days);
        String unit = lo.replaceAll("^[0-9.]+ ", "");
        // same unit at both ends: "10 to 20 minutes"
        if (unit.equals(hi.replaceAll("^[0-9.]+ ", ""))) return "in " + lo.split(" ")[0] + " to " + hi;
        return "in " + lo + " to " + hi;
    }

    /**
     * A tick count in words, rounded: minutes up to one and a half in-game days (30 minutes), then
     * days in half steps; without the daylight cycle days do not pass, so minutes and then hours.
     */
    static String duration(long ticks, boolean days) {
        if (days && ticks >= TICKS_PER_DAY * 3 / 2) return count(Math.round(ticks / (TICKS_PER_DAY / 2.0)) / 2.0, "day");
        long minutes = Math.max(1, Math.round(ticks / (double) TICKS_PER_MINUTE));
        if (minutes < 120) return count(minutes, "minute");
        return count(Math.round(ticks / (TICKS_PER_MINUTE * 30.0)) / 2.0, "hour");
    }

    private static String count(double n, String unit) {
        String number = n == Math.rint(n) ? Long.toString((long) n) : Double.toString(n);
        return number + " " + unit + (n == 1 ? "" : "s");
    }
}
