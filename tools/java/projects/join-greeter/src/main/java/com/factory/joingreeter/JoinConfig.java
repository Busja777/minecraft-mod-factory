package com.factory.joingreeter;

import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonPrimitive;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import java.util.regex.Pattern;

/**
 * The settings in config/joingreeter.json, without any Minecraft types. The file is created with
 * the defaults on the first start. Every field is read on its own: a missing or broken field keeps
 * its default (with a warning), so one typo does not throw away the rest of the file.
 *
 * @param welcome        line for players who join this world for the first time ("" = none)
 * @param welcomeBack    line for everyone else ("" = none)
 * @param rules          rule lines shown after the welcome line to first-time players
 * @param rulesEveryJoin also show the rules to returning players
 * @param starterKit     items a first-time player gets (empty = nothing)
 */
public record JoinConfig(String welcome, String welcomeBack, List<String> rules, boolean rulesEveryJoin, List<KitItem> starterKit) {
    public static final String FILE_NAME = "joingreeter.json";
    public static final String DEFAULT_WELCOME = "&6Welcome, &e{player}&6! Have fun on the server.";
    public static final String DEFAULT_WELCOME_BACK = "&7Welcome back, &f{player}&7! Players online: &f{online}";
    /** Most items of one kind a kit entry may give: a full inventory of 64-stacks. */
    public static final int MAX_COUNT = 36 * 64;
    /** Lines longer than this are cut (a chat line wraps long before). */
    public static final int MAX_LINE = 256;
    /** Rule lines beyond this are dropped. */
    public static final int MAX_RULES = 20;
    /** Help text written into the file; the mod ignores this field. */
    public static final String HELP = "Colours: &0-&9 and &a-&f, styles: &l bold, &o italic, &n underline, &m strikethrough, "
        + "&k obfuscated, &r reset (the section sign works too, && is a plain &). Placeholders: {player}, {online}. "
        + "An empty welcome text sends nothing. starterKit example: [{\"item\": \"minecraft:bread\", \"count\": 8}]. "
        + "Restart the server after editing.";

    private static final Pattern ITEM_ID = Pattern.compile("[a-z0-9_.-]+:[a-z0-9_./-]+");

    /** One entry of the starter kit, e.g. {"item": "minecraft:bread", "count": 8}. */
    public record KitItem(String item, int count) {}

    public JoinConfig {
        rules = List.copyOf(rules);
        starterKit = List.copyOf(starterKit);
    }

    public static JoinConfig defaults() {
        return new JoinConfig(DEFAULT_WELCOME, DEFAULT_WELCOME_BACK, List.of(), false, List.of());
    }

    public JoinConfig withStarterKit(List<KitItem> kit) {
        return new JoinConfig(welcome, welcomeBack, rules, rulesEveryJoin, kit);
    }

    public String toJson() {
        JsonObject obj = new JsonObject();
        obj.addProperty("_help", HELP);
        obj.addProperty("welcome", welcome);
        obj.addProperty("welcomeBack", welcomeBack);
        JsonArray ruleArray = new JsonArray();
        rules.forEach(ruleArray::add);
        obj.add("rules", ruleArray);
        obj.addProperty("rulesEveryJoin", rulesEveryJoin);
        JsonArray kit = new JsonArray();
        for (KitItem k : starterKit) {
            JsonObject entry = new JsonObject();
            entry.addProperty("item", k.item());
            entry.addProperty("count", k.count());
            kit.add(entry);
        }
        obj.add("starterKit", kit);
        return new GsonBuilder().setPrettyPrinting().disableHtmlEscaping().create().toJson(obj) + "\n";
    }

    /** Reads the settings from the file's text; problems go to {@code warn}. */
    public static JoinConfig parse(String json, Consumer<String> warn) {
        JsonElement root;
        try {
            root = JsonParser.parseString(json);
        } catch (RuntimeException e) {
            warn.accept(where() + " is not valid JSON, using the defaults");
            return defaults();
        }
        if (!(root instanceof JsonObject obj)) {
            warn.accept(where() + " must be a JSON object, using the defaults");
            return defaults();
        }
        JoinConfig d = defaults();
        String welcome = text(obj, "welcome", d.welcome(), warn);
        String welcomeBack = text(obj, "welcomeBack", d.welcomeBack(), warn);
        List<String> rules = rules(obj, warn);
        boolean rulesEveryJoin = d.rulesEveryJoin();
        if (obj.has("rulesEveryJoin")) {
            if (obj.get("rulesEveryJoin") instanceof JsonPrimitive p && p.isBoolean()) rulesEveryJoin = p.getAsBoolean();
            else warn.accept(where() + ": \"rulesEveryJoin\" must be true or false, using false");
        }
        return new JoinConfig(welcome, welcomeBack, rules, rulesEveryJoin, kit(obj, warn));
    }

    private static String where() {
        return "config/" + FILE_NAME;
    }

    private static String text(JsonObject obj, String key, String fallback, Consumer<String> warn) {
        if (!obj.has(key)) return fallback;
        if (!(obj.get(key) instanceof JsonPrimitive p) || !p.isString()) {
            warn.accept(where() + ": \"" + key + "\" must be a text, using the default");
            return fallback;
        }
        return cut(p.getAsString(), key, warn);
    }

    private static String cut(String line, String key, Consumer<String> warn) {
        if (line.length() <= MAX_LINE) return line;
        warn.accept(where() + ": \"" + key + "\" is longer than " + MAX_LINE + " characters and was cut");
        return line.substring(0, MAX_LINE);
    }

    private static List<String> rules(JsonObject obj, Consumer<String> warn) {
        if (!obj.has("rules")) return List.of();
        if (!(obj.get("rules") instanceof JsonArray array)) {
            warn.accept(where() + ": \"rules\" must be a list of texts, showing no rules");
            return List.of();
        }
        List<String> rules = new ArrayList<>();
        for (JsonElement e : array) {
            if (rules.size() == MAX_RULES) {
                warn.accept(where() + ": only the first " + MAX_RULES + " rules are shown");
                break;
            }
            if (e instanceof JsonPrimitive p && p.isString()) rules.add(cut(p.getAsString(), "rules", warn));
            else warn.accept(where() + ": a rule that is not a text was skipped: " + e);
        }
        return rules;
    }

    private static List<KitItem> kit(JsonObject obj, Consumer<String> warn) {
        if (!obj.has("starterKit")) return List.of();
        if (!(obj.get("starterKit") instanceof JsonArray array)) {
            warn.accept(where() + ": \"starterKit\" must be a list like [{\"item\": \"minecraft:bread\", \"count\": 8}], giving nothing");
            return List.of();
        }
        List<KitItem> kit = new ArrayList<>();
        for (JsonElement e : array) {
            KitItem item = kitItem(e, warn);
            if (item != null) kit.add(item);
        }
        return kit;
    }

    private static KitItem kitItem(JsonElement e, Consumer<String> warn) {
        if (!(e instanceof JsonObject entry) || !(entry.get("item") instanceof JsonPrimitive idValue) || !idValue.isString()) {
            warn.accept(where() + ": a starter kit entry without \"item\" was skipped: " + e);
            return null;
        }
        String id = normalizeId(idValue.getAsString());
        if (id == null) {
            warn.accept(where() + ": \"" + idValue.getAsString() + "\" is not an item id, skipped");
            return null;
        }
        int count = 1;
        if (entry.has("count")) {
            if (!(entry.get("count") instanceof JsonPrimitive p) || !p.isNumber() || p.getAsDouble() != Math.rint(p.getAsDouble())
                || p.getAsDouble() < 1 || p.getAsDouble() > MAX_COUNT) {
                warn.accept(where() + ": the count of " + id + " must be a whole number from 1 to " + MAX_COUNT + ", skipped");
                return null;
            }
            count = (int) entry.get("count").getAsDouble();
        }
        return new KitItem(id, count);
    }

    /** "bread" and "Minecraft:Bread" become "minecraft:bread"; returns null for something that is no id. */
    public static String normalizeId(String raw) {
        String id = raw.trim().toLowerCase(java.util.Locale.ROOT);
        if (!id.contains(":")) id = "minecraft:" + id;
        return ITEM_ID.matcher(id).matches() ? id : null;
    }

    /** Reads {@code dir/joingreeter.json}, or writes it with the defaults when it does not exist yet. */
    public static JoinConfig load(Path dir, Consumer<String> warn) {
        Path file = dir.resolve(FILE_NAME);
        try {
            if (Files.notExists(file)) {
                Files.createDirectories(dir);
                Files.writeString(file, defaults().toJson(), StandardCharsets.UTF_8);
                return defaults();
            }
            return parse(Files.readString(file, StandardCharsets.UTF_8), warn);
        } catch (IOException e) {
            warn.accept("cannot read or write " + where() + " (" + e.getMessage() + "), using the defaults");
            return defaults();
        }
    }
}
