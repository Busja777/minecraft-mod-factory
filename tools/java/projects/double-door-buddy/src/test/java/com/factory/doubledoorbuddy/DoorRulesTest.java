package com.factory.doubledoorbuddy;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.factory.doubledoorbuddy.DoorRules.Door;
import com.factory.doubledoorbuddy.DoorRules.Facing;
import com.factory.doubledoorbuddy.DoorRules.Half;
import com.factory.doubledoorbuddy.DoorRules.Hinge;
import org.junit.jupiter.api.Test;

class DoorRulesTest {
    private static final String OAK = "minecraft:oak_door";

    private static Door door(Facing facing, Hinge hinge) {
        return new Door(OAK, facing, hinge, Half.LOWER);
    }

    @Test
    void facingsTurnLikeMinecraftsDirections() {
        assertEquals(Facing.EAST, Facing.NORTH.clockwise());
        assertEquals(Facing.NORTH, Facing.WEST.clockwise());
        assertEquals(Facing.WEST, Facing.NORTH.counterClockwise());
        assertEquals(Facing.SOUTH, Facing.WEST.counterClockwise());
        for (Facing f : Facing.values()) {
            assertEquals(f, f.clockwise().counterClockwise());
            assertEquals(f, f.clockwise().clockwise().clockwise().clockwise());
        }
        // north is -z, east is +x, as in Minecraft
        assertEquals(-1, Facing.NORTH.dz);
        assertEquals(1, Facing.EAST.dx);
        assertEquals(1, Facing.SOUTH.dz);
        assertEquals(-1, Facing.WEST.dx);
    }

    @Test
    void partnerStandsAwayFromTheHinge() {
        // vanilla: a door placed with a door on its counter-clockwise side gets the RIGHT hinge,
        // so a LEFT door looks clockwise and a RIGHT door counter-clockwise
        assertEquals(Facing.EAST, DoorRules.partnerSide(door(Facing.NORTH, Hinge.LEFT)));
        assertEquals(Facing.WEST, DoorRules.partnerSide(door(Facing.NORTH, Hinge.RIGHT)));
        assertEquals(Facing.WEST, DoorRules.partnerSide(door(Facing.SOUTH, Hinge.LEFT)));
        assertEquals(Facing.NORTH, DoorRules.partnerSide(door(Facing.WEST, Hinge.LEFT)));
        assertEquals(Facing.SOUTH, DoorRules.partnerSide(door(Facing.EAST, Hinge.LEFT)));
    }

    @Test
    void theTwoDoorsOfAPairFindEachOther() {
        for (Facing f : Facing.values()) {
            Door left = door(f, Hinge.LEFT);
            Door right = door(f, Hinge.RIGHT);
            assertTrue(DoorRules.isPartner(left, right));
            assertTrue(DoorRules.isPartner(right, left));
            // the right door stands on the left door's partner side, and the left door on the right door's
            Facing there = DoorRules.partnerSide(left);
            Facing back = DoorRules.partnerSide(right);
            assertEquals(0, there.dx + back.dx);
            assertEquals(0, there.dz + back.dz);
        }
    }

    @Test
    void bothHalvesPairWithTheSameHalf() {
        Door upperLeft = new Door(OAK, Facing.NORTH, Hinge.LEFT, Half.UPPER);
        assertTrue(DoorRules.isPartner(upperLeft, new Door(OAK, Facing.NORTH, Hinge.RIGHT, Half.UPPER)));
        assertFalse(DoorRules.isPartner(upperLeft, new Door(OAK, Facing.NORTH, Hinge.RIGHT, Half.LOWER)));
    }

    @Test
    void doorsWithTheSameHingeStayApart() {
        assertFalse(DoorRules.isPartner(door(Facing.NORTH, Hinge.LEFT), door(Facing.NORTH, Hinge.LEFT)));
        assertFalse(DoorRules.isPartner(door(Facing.EAST, Hinge.RIGHT), door(Facing.EAST, Hinge.RIGHT)));
    }

    @Test
    void doorsFacingOtherWaysStayApart() {
        assertFalse(DoorRules.isPartner(door(Facing.NORTH, Hinge.LEFT), door(Facing.SOUTH, Hinge.RIGHT)));
        assertFalse(DoorRules.isPartner(door(Facing.NORTH, Hinge.LEFT), door(Facing.EAST, Hinge.RIGHT)));
    }

    @Test
    void differentKindsOfDoorStayApart() {
        Door oak = door(Facing.NORTH, Hinge.LEFT);
        assertFalse(DoorRules.isPartner(oak, new Door("minecraft:spruce_door", Facing.NORTH, Hinge.RIGHT, Half.LOWER)));
        assertFalse(DoorRules.isPartner(oak, new Door("minecraft:iron_door", Facing.NORTH, Hinge.RIGHT, Half.LOWER)));
        assertFalse(DoorRules.isPartner(oak, null));
    }

    @Test
    void onlyAServerClickWithoutSneakingMovesThePartner() {
        assertTrue(DoorRules.partnerFollows(true, true, false));
        assertFalse(DoorRules.partnerFollows(true, true, true), "sneaking moves only the clicked door");
        assertFalse(DoorRules.partnerFollows(false, true, false), "iron doors: vanilla did nothing");
        assertFalse(DoorRules.partnerFollows(true, false, false), "the client never guesses");
    }

    @Test
    void thePartnerTakesTheStateInsteadOfToggling() {
        assertTrue(DoorRules.partnerChanges(true, false));
        assertTrue(DoorRules.partnerChanges(false, true));
        assertFalse(DoorRules.partnerChanges(true, true), "an already open partner stays open");
        assertFalse(DoorRules.partnerChanges(false, false));
    }
}
