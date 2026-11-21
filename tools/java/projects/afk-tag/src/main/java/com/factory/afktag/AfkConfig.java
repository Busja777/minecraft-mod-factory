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
 *
 * @param minutes idle minutes before a player gets the AFK tag (1 to 1440)
 */
public record AfkConfig(int minutes) {
    public static final int DEFAULT_MINUTES = 5;
    public static final int MIN_MINUTES = 1;
    public static final int MAX_MINUTES = 1440;
    public static final String FILE_NAME = "afktag.json";

    public static AfkConfig defaults() {
        return new AfkConfig(DEFAULT_MINUTES);
    }

    /** Idle ticks before the tag (20 ticks per second). */
    public long timeoutTicks() {
        return minutes * 60L * 20L;
    }

    public String toJson() {
        return "{\n  \"minutes\": " + minutes + "\n}\n";
    }

    /** Reads the settings from the file's text; problems go to {@code warn} and use the default. */
    public static AfkConfig parse(String json, Consumer<String> warn) {
        JsonElement root;
        try {
            root = JsonParser.parseString(json);
        } catch (RuntimeException e) {
            warn.accept("config/" + FILE_NAME + " is not valid JSON, using " + DEFAULT_MINUTES + " minutes");
            return defaults();
        }
        if (!(root instanceof JsonObject obj) || !obj.has("minutes")) {
            warn.accept("config/" + FILE_NAME + " has no \"minutes\", using " + DEFAULT_MINUTES);
            return defaults();
        }
        JsonElement value = obj.get("minutes");
        if (!(value instanceof JsonPrimitive p) || !p.isNumber() || p.getAsDouble() != Math.rint(p.getAsDouble())) {
            warn.accept("config/" + FILE_NAME + ": \"minutes\" must be a whole number, using " + DEFAULT_MINUTES);
            return defaults();
        }
        double minutes = p.getAsDouble();
        if (minutes < MIN_MINUTES || minutes > MAX_MINUTES) {
            warn.accept("config/" + FILE_NAME + ": \"minutes\" must be between " + MIN_MINUTES + " and " + MAX_MINUTES + ", using " + DEFAULT_MINUTES);
            return defaults();
        }
        return new AfkConfig((int) minutes);
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
            warn.accept("cannot read or write config/" + FILE_NAME + " (" + e.getMessage() + "), using " + DEFAULT_MINUTES + " minutes");
            return defaults();
        }
    }
}
