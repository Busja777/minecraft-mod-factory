package com.factory.skyforecast;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.factory.skyforecast.Forecast.Place;
import com.factory.skyforecast.Forecast.Precipitation;
import com.factory.skyforecast.Forecast.Report;
import com.factory.skyforecast.Forecast.Rules;
import com.factory.skyforecast.Forecast.Span;
import com.factory.skyforecast.Forecast.Thunder;
import com.factory.skyforecast.WeatherModel.Dice;
import com.factory.skyforecast.WeatherModel.Sky;
import java.util.EnumSet;
import java.util.List;
import java.util.Random;
import java.util.Set;
import org.junit.jupiter.api.Test;

class ForecastTest {
    private static final Rules NORMAL = new Rules(true, true, false);

    private static List<String> lines(Sky sky) {
        return Forecast.lines(sky, NORMAL, Place.WEATHER, Precipitation.RAIN);
    }

    @Test
    void clearSkyWithAKnownRainTimer() {
        assertEquals(List.of("Now: clear sky.", "Rain starts in about 1.5 days.", "No thunder with this rain."),
            lines(new Sky(0, 36_000, 100_000, false, false)));
    }

    @Test
    void rainThatEndsSoon() {
        assertEquals(List.of("Now: rain.", "The rain stops in about 6 minutes.", "No thunder before it stops.",
            "Sleeping through the night stops the rain."), lines(new Sky(0, 7_200, 50_000, true, false)));
    }

    @Test
    void theRuleOffMeansNoChange() {
        Rules off = new Rules(false, true, false);
        assertEquals(List.of("Now: rain.", "The weather will not change: the doWeatherCycle game rule is off."),
            Forecast.lines(new Sky(0, 100, 100, true, false), off, Place.WEATHER, Precipitation.RAIN));
        assertFalse(Forecast.of(new Sky(500, 0, 0, false, false), false).changes(), "/weather clear does not count down either");
    }

    @Test
    void weatherClearEndsInAThunderstorm() {
        assertEquals(List.of("Now: clear sky.", "Clear for about 1.5 days (set by /weather clear), then a thunderstorm starts."),
            lines(new Sky(36_000, 0, 0, false, false)));
        assertEquals("Clear for less than a minute (set by /weather clear), then a thunderstorm starts.",
            lines(new Sky(30, 1, 1, false, false)).get(1));
    }

    @Test
    void aStormWhoseThunderStopsFirst() {
        assertEquals(List.of("Now: thunderstorm.", "The rain stops in about 17 minutes.", "The thunder stops in about 5 minutes, the rain goes on.",
            "Sleeping in a bed stops the storm."), lines(new Sky(0, 20_000, 6_000, true, true)));
    }

    @Test
    void weatherThunderEndsRainAndThunderTogether() {
        // /weather thunder sets both timers to the same duration
        assertEquals(Thunder.LASTS, Forecast.of(new Sky(0, 6_000, 6_000, true, true), true).thunder());
        assertEquals("The thunder lasts until the rain stops.", lines(new Sky(0, 6_000, 6_000, true, true)).get(2));
    }

    @Test
    void anUnknownTimerGivesTheVanillaRange() {
        // after sleeping through the rain both timers are 0 until the next tick draws them
        assertEquals(List.of("Now: clear sky.", "Rain starts in 10 minutes to 7.5 days.", "Thunder is possible with this rain."),
            lines(new Sky(0, 0, 0, false, false)));
        assertEquals("The rain stops in 10 to 20 minutes.", lines(new Sky(0, 0, 50_000, true, false)).get(1));
    }

    @Test
    void thunderThatStartsOrComesWithTheRain() {
        Report starts = Forecast.of(new Sky(0, 1_000, 5_000, false, false), true);
        assertEquals(Thunder.STARTS, starts.thunder());
        assertEquals(Span.of(5_000), starts.thunderAt());
        assertEquals("Thunder starts in about 4 minutes.", lines(new Sky(0, 1_000, 5_000, false, false)).get(2));
        assertEquals("The rain comes with thunder.", lines(new Sky(0, 1_000, 5_000, false, true)).get(2));
        assertEquals("Thunder starts in about 2 minutes.", lines(new Sky(0, 9_000, 2_400, true, false)).get(2));
    }

    @Test
    void otherDimensionsBiomesAndFrozenTime() {
        List<String> nether = Forecast.lines(new Sky(0, 7_200, 50_000, true, false), NORMAL, Place.NO_WEATHER, Precipitation.UNKNOWN);
        assertEquals("There is no weather in this dimension. In the Overworld:", nether.get(0));
        assertEquals("Now: rain.", nether.get(1));
        Rules frozen = new Rules(true, true, true);
        List<String> snowy = Forecast.lines(new Sky(0, 7_200, 50_000, true, false), frozen, Place.WEATHER, Precipitation.SNOW);
        assertEquals(List.of("The game is frozen with /tick, so the weather waits too.", "Here it snows instead of raining."),
            snowy.subList(snowy.size() - 2, snowy.size()));
        List<String> desert = Forecast.lines(new Sky(0, 7_200, 50_000, true, false), NORMAL, Place.WEATHER, Precipitation.NONE);
        assertEquals("It never rains in this biome.", desert.get(desert.size() - 1));
    }

    @Test
    void durationsInWords() {
        assertEquals("in less than a minute", Forecast.in(Span.of(1_199), true));
        assertEquals("in about 1 minute", Forecast.in(Span.of(1_200), true));
        assertEquals("in about 30 minutes", Forecast.in(Span.of(35_999), true));
        assertEquals("in about 1.5 days", Forecast.in(Span.of(36_000), true));
        assertEquals("in about 2 days", Forecast.in(Span.of(48_000), true));
        assertEquals("in about 7.5 days", Forecast.in(Span.of(180_000), true));
        assertEquals("in about 2.5 hours", Forecast.in(Span.of(180_000), false), "no days without the daylight cycle");
        assertEquals("in about 119 minutes", Forecast.in(Span.of(142_800), false));
        assertEquals("in 3 to 13 minutes", Forecast.in(new Span(3_601, 15_601), true));
        assertEquals("in 10 minutes to 7.5 days", Forecast.in(new Span(12_001, 180_001), true));
    }

    // Every claim must hold in the real tick rules: random skies, ticked with random, smallest and largest draws.
    @Test
    void everyClaimHoldsWhenTheWeatherIsTicked() {
        Random random = new Random(19);
        Set<Thunder> seen = EnumSet.noneOf(Thunder.class);
        for (int i = 0; i < 1_500; i++) {
            Sky sky = randomSky(random);
            Report report = Forecast.of(sky, true);
            seen.add(report.thunder());
            long seed = random.nextLong();
            Random draws = new Random(seed);
            for (Dice dice : List.<Dice>of((min, max) -> min + draws.nextInt(max - min + 1), (min, max) -> min, (min, max) -> max)) {
                check(sky, report, dice);
            }
        }
        assertEquals(EnumSet.allOf(Thunder.class), seen, "the random skies reach every kind of forecast");
    }

    private static Sky randomSky(Random r) {
        if (r.nextInt(5) == 0) return new Sky(1 + r.nextInt(50_000), r.nextInt(3), r.nextInt(3), false, false);
        int rain = r.nextInt(8) == 0 ? 0 : 1 + r.nextInt(r.nextBoolean() ? 30_000 : 200_000);
        int thunder = r.nextInt(8) == 0 ? 0 : 1 + r.nextInt(r.nextBoolean() ? 20_000 : 200_000);
        return new Sky(0, rain, thunder, r.nextBoolean(), r.nextBoolean());
    }

    private static boolean within(long tick, Span span) {
        return span.min() <= tick && tick <= span.max();
    }

    /** Ticks the sky until the forecast rain window is over and compares. */
    private static void check(Sky start, Report report, Dice dice) {
        String what = start + " " + report;
        boolean rainingNow = start.raining() && start.clearTime() == 0;
        Sky s = start;
        long tick = 0, windowStart = rainingNow ? 0 : -1, windowEnd = -1;
        long firstThunder = -1, firstCalm = -1;
        while (windowEnd < 0) {
            if (tick > 0) s = WeatherModel.step(s, dice);
            if (windowStart < 0 && s.raining()) windowStart = tick;
            if (windowStart >= 0 && tick >= windowStart) {
                if (!s.raining()) windowEnd = tick;
                else if (s.thundering() && firstThunder < 0) firstThunder = tick;
                else if (!s.thundering() && firstCalm < 0) firstCalm = tick;
            }
            tick++;
            assertTrue(tick < 2_000_000, "runaway: " + what);
        }
        long change = rainingNow ? windowEnd : windowStart;
        assertTrue(within(change, report.rainChange()), "rain changes at " + change + ": " + what);
        switch (report.thunder()) {
            case NONE -> assertTrue(firstThunder < 0, "thunder at " + firstThunder + ": " + what);
            case WITH_RAIN, STORM -> assertEquals(windowStart, firstThunder, what);
            case STARTS -> assertEquals(report.thunderAt().min(), firstThunder, what);
            case STOPS_FIRST -> assertTrue(firstCalm >= 0 && within(firstCalm, report.thunderAt()), "calm at " + firstCalm + ": " + what);
            case LASTS -> assertTrue(firstCalm < 0, "calm at " + firstCalm + ": " + what);
            case POSSIBLE, MAY_STOP -> { }
        }
    }
}
