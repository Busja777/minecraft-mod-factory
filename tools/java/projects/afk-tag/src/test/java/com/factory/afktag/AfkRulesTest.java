package com.factory.afktag;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.factory.afktag.AfkRules.Change;
import com.factory.afktag.AfkRules.Sample;
import com.factory.afktag.AfkRules.Timer;
import org.junit.jupiter.api.Test;

class AfkRulesTest {
    private static final String OVERWORLD = "minecraft:overworld";
    private static final Sample STILL = new Sample(OVERWORLD, 10.5, -20.5, 90f, 0f, 1000L, false, false);

    private static Sample moved(Sample s, double dx, double dz) {
        return new Sample(s.dimension(), s.x() + dx, s.z() + dz, s.yaw(), s.pitch(), s.lastActionTime(), s.pushedAround(), s.steering());
    }

    private static Sample looked(Sample s, float yaw, float pitch) {
        return new Sample(s.dimension(), s.x(), s.z(), yaw, pitch, s.lastActionTime(), s.pushedAround(), s.steering());
    }

    private static Sample acted(Sample s, long time) {
        return new Sample(s.dimension(), s.x(), s.z(), s.yaw(), s.pitch(), time, s.pushedAround(), s.steering());
    }

    private static Sample pushed(Sample s, boolean pushedAround, boolean steering) {
        return new Sample(s.dimension(), s.x(), s.z(), s.yaw(), s.pitch(), s.lastActionTime(), pushedAround, steering);
    }

    @Test
    void standingStillIsNoInput() {
        assertFalse(AfkRules.isInput(STILL, STILL));
        assertFalse(AfkRules.isInput(STILL, moved(STILL, 0.005, 0)), "a tiny wobble");
    }

    @Test
    void walkingIsInput() {
        assertTrue(AfkRules.isInput(STILL, moved(STILL, 0.2, 0)), "walking");
        assertTrue(AfkRules.isInput(STILL, moved(STILL, 0.05, 0.05)), "sneaking");
    }

    @Test
    void turningTheViewIsInput() {
        assertTrue(AfkRules.isInput(STILL, looked(STILL, 91f, 0f)));
        assertTrue(AfkRules.isInput(STILL, looked(STILL, 90f, -12f)));
        assertTrue(AfkRules.isInput(looked(STILL, 179.9f, 0f), looked(STILL, -179.9f, 0f)), "across the 180 wrap");
        assertFalse(AfkRules.isInput(looked(STILL, 180f, 0f), looked(STILL, -180f, 0f)), "the same direction");
        assertFalse(AfkRules.isInput(STILL, looked(STILL, 90.001f, 0f)), "rounding noise");
    }

    @Test
    void theGamesOwnIdleClockCountsChatCommandsAndClicks() {
        assertTrue(AfkRules.isInput(STILL, acted(STILL, 1050L)));
    }

    @Test
    void beingCarriedIsNoInput() {
        Sample inWater = pushed(STILL, true, false);
        assertFalse(AfkRules.isInput(inWater, moved(inWater, 0.3, 0)), "a water stream");
        assertFalse(AfkRules.isInput(STILL, moved(inWater, 0.3, 0)), "falling into water");
        assertFalse(AfkRules.isInput(inWater, moved(STILL, 0.3, 0)), "washed out of water");
        Sample steering = pushed(STILL, true, true);
        assertTrue(AfkRules.isInput(inWater, steering), "pressing a movement key in a boat or on a horse");
    }

    @Test
    void teleportsAndDimensionChangesAreNoInput() {
        assertFalse(AfkRules.isInput(STILL, moved(STILL, 100, 0)), "/tp");
        Sample nether = new Sample("minecraft:the_nether", 1.3, -2.5, 90f, 0f, 1000L, false, false);
        assertFalse(AfkRules.isInput(STILL, nether));
    }

    @Test
    void theTimerTagsAfterTheTimeoutAndClearsOnInput() {
        Timer timer = new Timer();
        assertEquals(Change.NONE, timer.tick(STILL, 3), "the first look");
        assertEquals(Change.NONE, timer.tick(STILL, 3));
        assertEquals(Change.NONE, timer.tick(STILL, 3));
        assertFalse(timer.isAfk());
        assertEquals(Change.NOW_AFK, timer.tick(STILL, 3), "three idle ticks");
        assertTrue(timer.isAfk());
        assertEquals(Change.NONE, timer.tick(STILL, 3), "announced once");
        assertEquals(Change.BACK, timer.tick(looked(STILL, 10f, 0f), 3));
        assertFalse(timer.isAfk());
        assertEquals(0, timer.idleTicks());
    }

    @Test
    void inputRestartsTheCount() {
        Timer timer = new Timer();
        timer.tick(STILL, 3);
        timer.tick(STILL, 3);
        timer.tick(STILL, 3);
        Sample walked = moved(STILL, 0.2, 0);
        assertEquals(Change.NONE, timer.tick(walked, 3), "one tick before the tag");
        assertEquals(Change.NONE, timer.tick(walked, 3));
        assertEquals(Change.NONE, timer.tick(walked, 3));
        assertEquals(Change.NOW_AFK, timer.tick(walked, 3));
    }

    @Test
    void aWaterStreamDoesNotKeepAPlayerActive() {
        Timer timer = new Timer();
        Sample s = pushed(STILL, true, false);
        timer.tick(s, 5);
        Change last = Change.NONE;
        for (int i = 0; i < 5; i++) {
            s = moved(s, 0.3, 0);
            last = timer.tick(s, 5);
        }
        assertEquals(Change.NOW_AFK, last);
    }

    @Test
    void aZeroTimeoutStillNeedsOneIdleTick() {
        Timer timer = new Timer();
        assertEquals(Change.NONE, timer.tick(STILL, 0));
        assertEquals(Change.NOW_AFK, timer.tick(STILL, 0));
    }
}
