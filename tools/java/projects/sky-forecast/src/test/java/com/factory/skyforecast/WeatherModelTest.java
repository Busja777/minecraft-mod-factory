package com.factory.skyforecast;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.factory.skyforecast.WeatherModel.Dice;
import com.factory.skyforecast.WeatherModel.Sky;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/** The model must tick like ServerWorld.tickWeather in 1.21.1 (the game tests compare it with the real server). */
class WeatherModelTest {
    private static final Dice NO_DICE = (min, max) -> {
        throw new AssertionError("no draw expected");
    };

    @Test
    void aTimerFlipsItsFlagWhenItReachesZero() {
        Sky s = WeatherModel.step(new Sky(0, 1, 5, false, false), NO_DICE);
        assertEquals(new Sky(0, 0, 4, true, false), s);
        s = WeatherModel.steps(s, 4, (min, max) -> 777);
        assertEquals(new Sky(0, 774, 0, true, true), s, "rain drew a duration on the tick after it started, thunder flipped at 0");
    }

    @Test
    void theTickAfterAFlipDrawsTheNewDurationThunderFirst() {
        List<int[]> rolls = new ArrayList<>();
        Dice record = (min, max) -> {
            rolls.add(new int[] {min, max});
            return min;
        };
        Sky s = WeatherModel.step(new Sky(0, 0, 0, true, false), record);
        assertEquals(2, rolls.size());
        assertEquals(WeatherModel.CALM_MIN, rolls.get(0)[0]);
        assertEquals(WeatherModel.CALM_MAX, rolls.get(0)[1]);
        assertEquals(WeatherModel.RAIN_MIN, rolls.get(1)[0]);
        assertEquals(WeatherModel.RAIN_MAX, rolls.get(1)[1]);
        assertEquals(new Sky(0, WeatherModel.RAIN_MIN, WeatherModel.CALM_MIN, true, false), s, "drawing does not count down");

        rolls.clear();
        WeatherModel.step(new Sky(0, 0, 0, false, true), record);
        assertEquals(WeatherModel.THUNDER_MIN, rolls.get(0)[0]);
        assertEquals(WeatherModel.THUNDER_MAX, rolls.get(0)[1]);
        assertEquals(WeatherModel.CLEAR_MIN, rolls.get(1)[0]);
        assertEquals(WeatherModel.CLEAR_MAX, rolls.get(1)[1]);
    }

    @Test
    void weatherClearHoldsBothTimersAtOneAndEndsInAStorm() {
        // what /weather clear 3t leaves: setWeather(3, 0, false, false)
        Sky s = WeatherModel.step(new Sky(3, 0, 0, false, false), NO_DICE);
        assertEquals(new Sky(2, 1, 1, false, false), s);
        s = WeatherModel.steps(s, 2, NO_DICE);
        assertEquals(new Sky(0, 1, 1, false, false), s);
        s = WeatherModel.step(s, NO_DICE);
        assertTrue(s.raining() && s.thundering(), "rain and thunder start on the tick after the clear time ends");
    }

    @Test
    void weatherClearStopsARunningStorm() {
        Sky s = WeatherModel.step(new Sky(100, 5000, 5000, true, true), NO_DICE);
        assertFalse(s.raining());
        assertFalse(s.thundering());
        assertEquals(99, s.clearTime());
    }
}
