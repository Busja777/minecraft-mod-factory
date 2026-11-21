package com.factory.afktag;

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
 * The settings in config/afktag.json, without any Minecraft types. The file is created with the
 * defaults on the first start; a broken file or value falls back to the default with a warning.
 * Each setting is read on its own, so a file from an older version (without the newer keys) keeps
 * its values and gets the defaults for the rest, without a warning.
 *
 * @param minutes           idle minutes before a player gets the AFK tag (1 to 1440)
 * @param ignoreAfkForSleep AFK players count as neither sleeping nor required when the server
 *                          decides whether enough players sleep to skip the night (since 1.1)
 */
public record AfkConfig(int minutes, boolean ignoreAfkForSleep) {
    public static final int DEFAULT_MINUTES = 5;
    public static final int MIN_MINUTES = 1;
    public static final int MAX_MINUTES = 1440;
    public static final boolean DEFAULT_IGNORE_AFK_FOR_SLEEP = true;
    public static final String FILE_NAME = "afktag.json";

    /** Only the idle time; everything else at its default. */
    public AfkConfig(int minutes) {
        this(minutes, DEFAULT_IGNORE_AFK_FOR_SLEEP);
    }

    public static AfkConfig defaults() {
        return new AfkConfig(DEFAULT_MINUTES, DEFAULT_IGNORE_AFK_FOR_SLEEP);
    }

    /** Idle ticks before the tag (20 ticks per second). */
    public long timeoutTicks() {
        return minutes * 60L * 20L;
    }

    public String toJson() {
        return "{\n  \"minutes\": " + minutes + ",\n  \"ignoreAfkForSleep\": " + ignoreAfkForSleep + "\n}\n";
    }

    /** Reads the settings from the file's text; problems go to {@code warn} and use the default. */
    public static AfkConfig parse(String json, Consumer<String> warn) {
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
        return new AfkConfig(minutes(obj, warn), ignoreAfkForSleep(obj, warn));
    }

    private static int minutes(JsonObject obj, Consumer<String> warn) {
        if (!obj.has("minutes")) {
            warn.accept("config/" + FILE_NAME + " has no \"minutes\", using " + DEFAULT_MINUTES);
            return DEFAULT_MINUTES;
        }
        JsonElement value = obj.get("minutes");
        if (!(value instanceof JsonPrimitive p) || !p.isNumber() || p.getAsDouble() != Math.rint(p.getAsDouble())) {
            warn.accept("config/" + FILE_NAME + ": \"minutes\" must be a whole number, using " + DEFAULT_MINUTES);
            return DEFAULT_MINUTES;
        }
        double minutes = p.getAsDouble();
        if (minutes < MIN_MINUTES || minutes > MAX_MINUTES) {
            warn.accept("config/" + FILE_NAME + ": \"minutes\" must be between " + MIN_MINUTES + " and " + MAX_MINUTES + ", using " + DEFAULT_MINUTES);
            return DEFAULT_MINUTES;
        }
        return (int) minutes;
    }

    /** A missing key is not a problem: config files of 1.0 do not have it. */
    private static boolean ignoreAfkForSleep(JsonObject obj, Consumer<String> warn) {
        if (!obj.has("ignoreAfkForSleep")) return DEFAULT_IGNORE_AFK_FOR_SLEEP;
        JsonElement value = obj.get("ignoreAfkForSleep");
        if (!(value instanceof JsonPrimitive p) || !p.isBoolean()) {
            warn.accept("config/" + FILE_NAME + ": \"ignoreAfkForSleep\" must be true or false, using " + DEFAULT_IGNORE_AFK_FOR_SLEEP);
            return DEFAULT_IGNORE_AFK_FOR_SLEEP;
        }
        return p.getAsBoolean();
    }

    /** Reads {@code dir/afktag.json}, or writes it with the defaults when it does not exist yet. */
    public static AfkConfig load(Path dir, Consumer<String> warn) {
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
