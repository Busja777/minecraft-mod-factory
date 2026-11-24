package com.factory.joingreeter;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * The rules of Join Greeter without any Minecraft types, so they can be tested with plain JUnit:
 * which lines a player gets, colour codes, placeholders, the first-join decision and how a kit
 * entry is split into stacks.
 */
public final class Greeting {
    /** The codes of Minecraft's classic formatting, after "&" or the section sign. */
    public static final String CODES = "0123456789abcdefklmnor";
    public static final char SECTION = '§';

    private Greeting() {}

    /** The message templates a joining player gets, in order (colour codes and placeholders still in them). */
    public static List<String> lines(JoinConfig config, boolean firstTime) {
        List<String> lines = new ArrayList<>();
        String welcome = firstTime ? config.welcome() : config.welcomeBack();
        if (!welcome.isBlank()) lines.add(welcome);
        if (firstTime || config.rulesEveryJoin()) lines.addAll(config.rules());
        return lines;
    }

    /**
     * Whether this is the player's first time in this world, read from the player's own statistics
     * (saved in the world's stats folder together with the player data): a player who never left the
     * world and never spent a tick in it has never been here.
     *
     * @param leaveGame      the "Games Quit" statistic (counted every time the player leaves)
     * @param playTime       the "Time Played" statistic in ticks
     * @param totalWorldTime the "Time Since World Open" statistic in ticks (counts while dead, too)
     */
    public static boolean isFirstJoin(int leaveGame, int playTime, int totalWorldTime) {
        return leaveGame <= 0 && playTime <= 0 && totalWorldTime <= 0;
    }

    /** Splits {@code count} items into stack sizes of at most {@code maxStack}. */
    public static List<Integer> stacks(int count, int maxStack) {
        int size = Math.max(1, maxStack);
        List<Integer> stacks = new ArrayList<>();
        for (int left = count; left > 0; left -= size) stacks.add(Math.min(left, size));
        return stacks;
    }

    /** Replaces {@code {name}} placeholders; unknown ones stay as they are. */
    public static String fill(String text, Map<String, String> values) {
        StringBuilder out = new StringBuilder(text.length());
        int i = 0;
        while (i < text.length()) {
            int open = text.indexOf('{', i);
            int close = open < 0 ? -1 : text.indexOf('}', open);
            if (close < 0) {
                out.append(text, i, text.length());
                break;
            }
            String value = values.get(text.substring(open + 1, close));
            out.append(text, i, open);
            if (value != null) {
                out.append(value);
                i = close + 1;
            } else {
                out.append('{'); // not a placeholder: keep the brace and look on behind it
                i = open + 1;
            }
        }
        return out.toString();
    }

    /**
     * One run of text with one look.
     *
     * @param color the colour code ('0'-'9', 'a'-'f'), or 0 for the default colour
     */
    public record Segment(String text, char color, boolean bold, boolean italic, boolean underlined, boolean strikethrough, boolean obfuscated) {}

    /**
     * Splits a line with classic colour codes into segments. "&amp;" and the section sign both start a
     * code; a colour code also ends bold, italic and the other styles (as in vanilla), "r" resets
     * everything, "&amp;&amp;" is a plain "&amp;", and an "&amp;" before anything else stays as it is.
     */
    public static List<Segment> parse(String line) {
        List<Segment> out = new ArrayList<>();
        StringBuilder run = new StringBuilder();
        Style style = new Style();
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            boolean marker = c == '&' || c == SECTION;
            if (marker && i + 1 < line.length()) {
                char next = line.charAt(i + 1);
                if (c == '&' && next == '&') {
                    run.append('&');
                    i++;
                    continue;
                }
                char code = Character.toLowerCase(next);
                if (CODES.indexOf(code) >= 0) {
                    if (run.length() > 0) out.add(style.segment(run.toString()));
                    run.setLength(0);
                    style.apply(code);
                    i++;
                    continue;
                }
            }
            run.append(c);
        }
        if (run.length() > 0) out.add(style.segment(run.toString()));
        return out;
    }

    /** The plain text of a line, without colour codes (what the player reads). */
    public static String plain(String line) {
        StringBuilder out = new StringBuilder();
        for (Segment s : parse(line)) out.append(s.text());
        return out.toString();
    }

    /** Colour codes first, placeholders second, so a player name can never inject a colour. */
    public static List<Segment> render(String template, Map<String, String> values) {
        List<Segment> out = new ArrayList<>();
        for (Segment s : parse(template)) {
            out.add(new Segment(fill(s.text(), values), s.color(), s.bold(), s.italic(), s.underlined(), s.strikethrough(), s.obfuscated()));
        }
        return out;
    }

    private static final class Style {
        char color;
        boolean bold, italic, underlined, strikethrough, obfuscated;

        void apply(char code) {
            switch (code) {
                case 'k' -> obfuscated = true;
                case 'l' -> bold = true;
                case 'm' -> strikethrough = true;
                case 'n' -> underlined = true;
                case 'o' -> italic = true;
                case 'r' -> reset((char) 0);
                default -> reset(code);
            }
        }

        private void reset(char newColor) {
            color = newColor;
            bold = italic = underlined = strikethrough = obfuscated = false;
        }

        Segment segment(String text) {
            return new Segment(text, color, bold, italic, underlined, strikethrough, obfuscated);
        }
    }
}
