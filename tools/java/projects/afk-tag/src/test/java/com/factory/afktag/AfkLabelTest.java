package com.factory.afktag;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.factory.afktag.AfkRules.Change;
import com.factory.afktag.AfkRules.Sample;
import com.factory.afktag.AfkRules.Timer;
import org.junit.jupiter.api.Test;

class AfkLabelTest {
    private static final long MINUTE = AfkLabel.TICKS_PER_MINUTE;

    @Test
    void aMinuteIs1200Ticks() {
        assertEquals(1200, MINUTE);
    }

    @Test
    void showsWholeIdleMinutes() {
        assertEquals("[AFK 5m]", AfkLabel.label(5 * MINUTE, true), "the default idle time, the moment the tag appears");
        assertEquals("[AFK 5m]", AfkLabel.label(6 * MINUTE - 1, true), "rounded down");
        assertEquals("[AFK 12m]", AfkLabel.label(12 * MINUTE + 300, true));
        assertEquals("[AFK 0m]", AfkLabel.label(30, true), "below a minute (only with a test timeout)");
        assertEquals("[AFK 0m]", AfkLabel.label(-5, true), "never negative");
    }

    @Test
    void anHourAndMoreIsShownInHours() {
        assertEquals("[AFK 59m]", AfkLabel.label(59 * MINUTE, true));
        assertEquals("[AFK 1h]", AfkLabel.label(60 * MINUTE, true));
        assertEquals("[AFK 1h 5m]", AfkLabel.label(65 * MINUTE, true));
        assertEquals("[AFK 2h 30m]", AfkLabel.label(150 * MINUTE, true));
        assertEquals("[AFK 26h 59m]", AfkLabel.label((26 * 60 + 59) * MINUTE, true));
    }

    @Test
    void withoutTheTimeTheTagIsThatOf11() {
        for (long ticks : new long[] {0, 30, 5 * MINUTE, 65 * MINUTE}) assertEquals("[AFK]", AfkLabel.label(ticks, false));
    }

    @Test
    void theEntryIsSentAgainOncePerMinuteAndNeverInBetween() {
        assertFalse(AfkLabel.minuteTurned(0));
        assertFalse(AfkLabel.minuteTurned(1));
        assertFalse(AfkLabel.minuteTurned(MINUTE - 1));
        assertTrue(AfkLabel.minuteTurned(MINUTE));
        assertFalse(AfkLabel.minuteTurned(MINUTE + 1));
        assertTrue(AfkLabel.minuteTurned(7 * MINUTE));
        // ten minutes of ticks: exactly ten updates, and the label changes exactly then
        int updates = 0;
        String shown = AfkLabel.label(0, true);
        for (long t = 1; t <= 10 * MINUTE; t++) {
            String now = AfkLabel.label(t, true);
            assertEquals(!now.equals(shown), AfkLabel.minuteTurned(t), "tick " + t);
            if (AfkLabel.minuteTurned(t)) updates++;
            shown = now;
        }
        assertEquals(10, updates);
    }

    private static Sample still() {
        return new Sample("minecraft:overworld", 0, 0, 0, 0, 0, false, false);
    }

    @Test
    void theTimerCountsOnWhileAfkAndStartsAgainOnInput() {
        Timer timer = new Timer();
        timer.tick(still(), 100);
        for (int i = 0; i < 100; i++) timer.tick(still(), 100);
        assertTrue(timer.isAfk());
        for (int i = 0; i < 50; i++) assertEquals(Change.NONE, timer.tick(still(), 100));
        assertEquals(150, timer.idleTicks(), "the idle clock keeps counting while the tag is shown");
        timer.addIdleTicks(MINUTE);
        assertEquals(150 + MINUTE, timer.idleTicks());
        assertEquals(Change.BACK, timer.tick(new Sample("minecraft:overworld", 1, 0, 0, 0, 0, false, false), 100));
        assertEquals(0, timer.idleTicks(), "back: the clock starts again");
    }
}
