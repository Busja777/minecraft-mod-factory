package com.factory.replantclick;

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
 * The settings in config/replantclick.json (since 1.2), without any Minecraft types. The file is
 * created with the defaults on the first start. Each setting is read on its own: a missing key gets
 * its default without a warning (so a file from an older version keeps working), a broken value gets
 * its default with a warning, and a broken file falls back to the defaults with a warning.
 *
 * @param areaWithHoe a right-click with a hoe also harvests the ripe crops of the same kind in the
 *                    3×3 area around the clicked one (since 1.2)
 */
public record ReplantConfig(boolean areaWithHoe) {
    public static final boolean DEFAULT_AREA_WITH_HOE = true;
    public static final String FILE_NAME = "replantclick.json";

    public static ReplantConfig defaults() {
        return new ReplantConfig(DEFAULT_AREA_WITH_HOE);
    }

    public String toJson() {
        return "{\n  \"areaWithHoe\": " + areaWithHoe + "\n}\n";
    }

    /** Reads the settings from the file's text; problems go to {@code warn} and use the default. */
    public static ReplantConfig parse(String json, Consumer<String> warn) {
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
        return new ReplantConfig(bool(obj, "areaWithHoe", DEFAULT_AREA_WITH_HOE, warn));
    }

    /** true or false; a missing key is not a problem (files of later versions may lack older keys and vice versa). */
    private static boolean bool(JsonObject obj, String key, boolean fallback, Consumer<String> warn) {
        if (!obj.has(key)) return fallback;
        JsonElement value = obj.get(key);
        if (!(value instanceof JsonPrimitive p) || !p.isBoolean()) {
            warn.accept("config/" + FILE_NAME + ": \"" + key + "\" must be true or false, using " + fallback);
            return fallback;
        }
        return p.getAsBoolean();
    }

    /** Reads {@code dir/replantclick.json}, or writes it with the defaults when it does not exist yet. */
    public static ReplantConfig load(Path dir, Consumer<String> warn) {
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
