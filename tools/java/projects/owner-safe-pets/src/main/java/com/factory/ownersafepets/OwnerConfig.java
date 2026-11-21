package com.factory.ownersafepets;

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
 * The settings in config/ownersafepets.json (since 1.1), without any Minecraft types. The file is
 * created with the defaults on the first start. Each setting is read on its own: a missing key gets
 * its default without a warning, a broken value gets its default with a warning. The defaults are
 * exactly the behaviour of 1.0, which had no config file.
 *
 * @param sneakToHit                 an owner who is sneaking can hurt their own pet with their own
 *                                   hits (to put a sick animal down); arrows and explosions stay as
 *                                   they are
 * @param protectFromOwnerExplosions explosions the owner caused (lit TNT, a crystal they hit) do no
 *                                   damage to their pets
 */
public record OwnerConfig(boolean sneakToHit, boolean protectFromOwnerExplosions) {
    public static final boolean DEFAULT_SNEAK_TO_HIT = false;
    public static final boolean DEFAULT_PROTECT_FROM_OWNER_EXPLOSIONS = true;
    public static final String FILE_NAME = "ownersafepets.json";

    public static OwnerConfig defaults() {
        return new OwnerConfig(DEFAULT_SNEAK_TO_HIT, DEFAULT_PROTECT_FROM_OWNER_EXPLOSIONS);
    }

    public String toJson() {
        return "{\n  \"sneakToHit\": " + sneakToHit + ",\n  \"protectFromOwnerExplosions\": " + protectFromOwnerExplosions + "\n}\n";
    }

    /** Reads the settings from the file's text; problems go to {@code warn} and use the default. */
    public static OwnerConfig parse(String json, Consumer<String> warn) {
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
        return new OwnerConfig(bool(obj, "sneakToHit", DEFAULT_SNEAK_TO_HIT, warn),
            bool(obj, "protectFromOwnerExplosions", DEFAULT_PROTECT_FROM_OWNER_EXPLOSIONS, warn));
    }

    private static boolean bool(JsonObject obj, String key, boolean fallback, Consumer<String> warn) {
        if (!obj.has(key)) return fallback;
        JsonElement value = obj.get(key);
        if (!(value instanceof JsonPrimitive p) || !p.isBoolean()) {
            warn.accept("config/" + FILE_NAME + ": \"" + key + "\" must be true or false, using " + fallback);
            return fallback;
        }
        return p.getAsBoolean();
    }

    /** Reads {@code dir/ownersafepets.json}, or writes it with the defaults when it does not exist yet. */
    public static OwnerConfig load(Path dir, Consumer<String> warn) {
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
