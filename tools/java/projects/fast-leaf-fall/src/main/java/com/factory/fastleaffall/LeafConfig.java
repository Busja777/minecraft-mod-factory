package com.factory.fastleaffall;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonPrimitive;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.function.Consumer;

/**
 * The settings in config/fastleaffall.json (since 1.1), without any Minecraft types. The file is
 * created with the defaults on the first start. Each setting is read on its own: a missing key gets
 * its default without a warning (so a file of 1.1 keeps its values and gets the newer keys' defaults),
 * a broken or out-of-range value gets its default with a warning. The delay defaults are exactly the
 * fixed values of 1.0, which had no config file.
 *
 * @param minDelayTicks  shortest wait between a leaf losing its tree and its decay (1 to 400 ticks)
 * @param maxDelayTicks  longest wait (minDelayTicks to 400 ticks); each leaf gets a random wait in between
 * @param leavesPerTick  at most this many leaves decay per world and tick (1 to 512); also the most
 *                       leaves the scan of loaded chunks may queue per world and tick (since 1.2)
 * @param catchOldLeaves leaves that were already without a tree when their chunk loaded (cut or
 *                       generated before the mod was installed) fall fast too (since 1.2)
 */
public record LeafConfig(int minDelayTicks, int maxDelayTicks, int leavesPerTick, boolean catchOldLeaves) {
    public static final int DEFAULT_MIN_DELAY_TICKS = LeafRules.MIN_DELAY_TICKS;
    public static final int DEFAULT_MAX_DELAY_TICKS = LeafRules.MIN_DELAY_TICKS + LeafRules.DELAY_SPREAD_TICKS - 1;
    public static final int DEFAULT_LEAVES_PER_TICK = LeafRules.DECAYS_PER_TICK;
    public static final boolean DEFAULT_CATCH_OLD_LEAVES = true;
    /** Lower bound of both waits: a leaf never decays in the same tick it lost its tree. */
    public static final int MIN_TICKS = 1;
    /** Upper bound of both waits: 20 seconds; anything slower is close to vanilla's own decay. */
    public static final int MAX_TICKS = 400;
    public static final int MIN_LEAVES_PER_TICK = 1;
    public static final int MAX_LEAVES_PER_TICK = 512;
    public static final String FILE_NAME = "fastleaffall.json";

    public LeafConfig {
        if (minDelayTicks < MIN_TICKS || maxDelayTicks < minDelayTicks || maxDelayTicks > MAX_TICKS)
            throw new IllegalArgumentException("delay " + minDelayTicks + ".." + maxDelayTicks + " ticks");
        if (leavesPerTick < MIN_LEAVES_PER_TICK || leavesPerTick > MAX_LEAVES_PER_TICK)
            throw new IllegalArgumentException("leavesPerTick " + leavesPerTick);
    }

    /** The settings of 1.1; {@code catchOldLeaves} at its default. */
    public LeafConfig(int minDelayTicks, int maxDelayTicks, int leavesPerTick) {
        this(minDelayTicks, maxDelayTicks, leavesPerTick, DEFAULT_CATCH_OLD_LEAVES);
    }

    public static LeafConfig defaults() {
        return new LeafConfig(DEFAULT_MIN_DELAY_TICKS, DEFAULT_MAX_DELAY_TICKS, DEFAULT_LEAVES_PER_TICK, DEFAULT_CATCH_OLD_LEAVES);
    }

    /** How many different waits there are (for a random roll in [0, spread)). */
    public int delaySpread() {
        return maxDelayTicks - minDelayTicks + 1;
    }

    /** The wait in ticks for a random roll in [0, delaySpread()); rolls out of range wrap around. */
    public int delay(int roll) {
        return minDelayTicks + Math.floorMod(roll, delaySpread());
    }

    public String toJson() {
        return "{\n  \"minDelayTicks\": " + minDelayTicks + ",\n  \"maxDelayTicks\": " + maxDelayTicks
            + ",\n  \"leavesPerTick\": " + leavesPerTick + ",\n  \"catchOldLeaves\": " + catchOldLeaves + "\n}\n";
    }

    /** Reads the settings from the file's text; problems go to {@code warn} and use the default. */
    public static LeafConfig parse(String json, Consumer<String> warn) {
        JsonElement root;
        try {
            root = JsonParser.parseString(json);
        } catch (RuntimeException e) {
            warn.accept("config/" + FILE_NAME + " is not valid JSON, using the defaults");
            return defaults();
        }
        if (!(root instanceof JsonObject obj)) {
            warn.accept("config/" + FILE_NAME + " is not a JSON object, using the defaults");
            return defaults();
        }
        int min = whole(obj, "minDelayTicks", MIN_TICKS, MAX_TICKS, DEFAULT_MIN_DELAY_TICKS, warn);
        int max = whole(obj, "maxDelayTicks", MIN_TICKS, MAX_TICKS, DEFAULT_MAX_DELAY_TICKS, warn);
        if (max < min) {
            warn.accept("config/" + FILE_NAME + ": \"maxDelayTicks\" (" + max + ") is below \"minDelayTicks\" (" + min
                + "), using " + min + " for both");
            max = min;
        }
        int perTick = whole(obj, "leavesPerTick", MIN_LEAVES_PER_TICK, MAX_LEAVES_PER_TICK, DEFAULT_LEAVES_PER_TICK, warn);
        boolean catchOld = bool(obj, "catchOldLeaves", DEFAULT_CATCH_OLD_LEAVES, warn);
        return new LeafConfig(min, max, perTick, catchOld);
    }

    /** true or false; a missing key is not a problem (files of 1.1 do not have the keys of 1.2). */
    private static boolean bool(JsonObject obj, String key, boolean fallback, Consumer<String> warn) {
        if (!obj.has(key)) return fallback;
        JsonElement value = obj.get(key);
        if (!(value instanceof JsonPrimitive p) || !p.isBoolean()) {
            warn.accept("config/" + FILE_NAME + ": \"" + key + "\" must be true or false, using " + fallback);
            return fallback;
        }
        return p.getAsBoolean();
    }

    /** A whole number in [low, high]; a missing key is not a problem (config files did not exist before 1.1). */
    private static int whole(JsonObject obj, String key, int low, int high, int fallback, Consumer<String> warn) {
        if (!obj.has(key)) return fallback;
        JsonElement value = obj.get(key);
        if (!(value instanceof JsonPrimitive p) || !p.isNumber() || p.getAsDouble() != Math.rint(p.getAsDouble())) {
            warn.accept("config/" + FILE_NAME + ": \"" + key + "\" must be a whole number, using " + fallback);
            return fallback;
        }
        double n = p.getAsDouble();
        if (n < low || n > high) {
            warn.accept("config/" + FILE_NAME + ": \"" + key + "\" must be between " + low + " and " + high + ", using " + fallback);
            return fallback;
        }
        return (int) n;
    }

    /** Reads {@code dir/fastleaffall.json}, or writes it with the defaults when it does not exist yet. */
    public static LeafConfig load(Path dir, Consumer<String> warn) {
        Path file = dir.resolve(FILE_NAME);
        try {
            if (Files.notExists(file)) {
                Files.createDirectories(dir);
                Files.writeString(file, defaults().toJson(), StandardCharsets.UTF_8);
                return defaults();
            }
            return parse(Files.readString(file, StandardCharsets.UTF_8), warn);
        } catch (IOException e) {
            warn.accept("cannot read or write config/" + FILE_NAME + " (" + e.getMessage() + "), using the defaults");
            return defaults();
        }
    }
}
