package com.factory.doubledoorbuddy;

/**
 * The rules of Double Door Buddy without any Minecraft types, so they can be tested with plain JUnit.
 * A door is described by its block id ("minecraft:oak_door") and the three properties of
 * {@code DoorBlock} that decide whether two doors form a double door: FACING, HINGE and HALF.
 *
 * <p>The geometry follows vanilla's own placement ({@code DoorBlock#getHinge}, Minecraft 1.21.1): a
 * door placed next to a door on its counter-clockwise side (seen from FACING) gets the RIGHT hinge,
 * so two doors placed side by side end up with mirrored hinges. A LEFT-hinged door therefore finds
 * its partner on its clockwise side, a RIGHT-hinged door on its counter-clockwise side.
 */
public final class DoorRules {
    private DoorRules() {}

    /** The four horizontal directions in the order of a clockwise turn (seen from above). */
    public enum Facing {
        NORTH(0, -1), EAST(1, 0), SOUTH(0, 1), WEST(-1, 0);

        /** Step along x and z, as Minecraft's Direction (north is -z, east is +x). */
        public final int dx;
        public final int dz;

        Facing(int dx, int dz) {
            this.dx = dx;
            this.dz = dz;
        }

        public Facing clockwise() {
            return values()[(ordinal() + 1) % 4];
        }

        public Facing counterClockwise() {
            return values()[(ordinal() + 3) % 4];
        }
    }

    public enum Hinge {
        LEFT, RIGHT;

        public Hinge opposite() {
            return this == LEFT ? RIGHT : LEFT;
        }
    }

    public enum Half { LOWER, UPPER }

    /** One half of a door as the rules see it. */
    public record Door(String blockId, Facing facing, Hinge hinge, Half half) {}

    /** The side of {@code door} on which its partner would stand: away from its own hinge. */
    public static Facing partnerSide(Door door) {
        return door.hinge() == Hinge.LEFT ? door.facing().clockwise() : door.facing().counterClockwise();
    }

    /**
     * Whether {@code other}, the block on {@link #partnerSide} of {@code clicked}, is its partner:
     * the same kind of door (same block, so oak never pairs with spruce and iron never with wood),
     * the same facing, the mirrored hinge and the same half. Anything else (two doors with the same
     * hinge, doors facing different ways) is left alone.
     */
    public static boolean isPartner(Door clicked, Door other) {
        return other != null
            && clicked.blockId().equals(other.blockId())
            && clicked.facing() == other.facing()
            && clicked.hinge().opposite() == other.hinge()
            && clicked.half() == other.half();
    }

    /**
     * Whether a door click should move the partner too.
     *
     * @param accepted  vanilla opened or closed the clicked door (false for iron doors, which do not
     *                  open by hand)
     * @param server    the click runs on the server (the server alone decides, so players without
     *                  the mod see the same)
     * @param sneaking  the player sneaks: then only the clicked door moves
     */
    public static boolean partnerFollows(boolean accepted, boolean server, boolean sneaking) {
        return accepted && server && !sneaking;
    }

    /**
     * Whether the partner has to change: it takes the clicked door's new open state and is only
     * touched when it differs. It is never toggled blindly, so a pair that got out of step (one door
     * opened by redstone, say) comes back in step instead of swapping.
     */
    public static boolean partnerChanges(boolean clickedOpen, boolean partnerOpen) {
        return clickedOpen != partnerOpen;
    }
}
