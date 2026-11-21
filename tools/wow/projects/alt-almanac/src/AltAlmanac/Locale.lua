local _, ns = ...

-- English text is the key itself; other languages override single keys.
--
-- Terms the game already has in the player's language come from the client's own GlobalStrings,
-- not from this file (ns.GameText, each with the English word as fallback for a client without it):
--   column headings (UI.lua): CHARACTER (Character), LEVEL (Level), ZONE (Zone),
--   TUTORIAL_TITLE26 (Rested, the game's name for the rested state of the XP bar),
--   PLAYED (Played); the total line: TOTAL (Total).
--   Gold amounts: GetMoneyString, the client's own coin display.
--   Character, realm and zone names come from the game; class colours too.
-- Short times keep the letters m, h and d: the German client writes them the same way
-- (MINUTE_ONELETTER_ABBR, HOUR_ONELETTER_ABBR, DAY_ONELETTER_ABBR).
-- No GlobalStrings constant is spliced into a sentence: the German sentence needs its own article
-- and case. Game terms inside sentences are written as the German client names them: Stufe (level),
-- Realm, Charakter. "Seen" is "Zul." as in the client's "Zul. online": the column is 40 wide.
-- Slash commands and their words stay English: players type them as they are (/aa realm this).
local L = setmetatable({}, { __index = function(_, key) return key end })
ns.L = L

local T = {}

T.deDE = {
  ["Alt Almanac"] = "Alt Almanac",
  ["Gold"] = "Gold", ["Seen"] = "Zul.", ["now"] = "jetzt",
  ["%dm"] = "%dm", ["%dh"] = "%dh", ["%dd"] = "%dd", ["%dh %dm"] = "%dh %dm", ["%dd %dh"] = "%dd %dh",
  ["%d%%"] = "%d%%",
  ["and %d more"] = "und %d weitere",
  ["Click to sort by this column, click again to reverse the order."] =
    "Klicken, um nach dieser Spalte zu sortieren, erneut klicken, um die Reihenfolge umzukehren.",
  ["/aa opens or closes the almanac, /aa forget Name-Realm removes a character."] =
    "/aa öffnet oder schließt den Almanach, /aa forget Name-Realm entfernt einen Charakter.",
  ["No character called %s. Use Name-Realm."] = "Kein Charakter namens %s. Schreibweise: Name-Realm.",
  ["You cannot forget the character you are playing."] = "Den Charakter, den du gerade spielst, kannst du nicht entfernen.",
  ["%s forgotten."] = "%s entfernt.",
  -- 1.2: sorting and filters
  ["This realm only"] = "Nur dieser Realm", ["Hide below level"] = "Mindeststufe",
  ["%d hidden by the filter"] = "%d durch den Filter ausgeblendet",
  ["Showing the characters of this realm only."] = "Nur die Charaktere dieses Realms werden angezeigt.",
  ["Showing the characters of all realms."] = "Die Charaktere aller Realms werden angezeigt.",
  ["Hiding characters below level %d."] = "Charaktere unter Stufe %d werden ausgeblendet.",
  ["Showing characters of every level."] = "Charaktere jeder Stufe werden angezeigt.",
  ["Use a whole number from 1 to %d, for example /aa level 70, or /aa level off."] =
    "Nutze eine ganze Zahl von 1 bis %d, zum Beispiel /aa level 70, oder /aa level off.",
  ["Click a heading to sort. /aa realm this or /aa realm all filters by realm, /aa level 70 hides characters below level 70, /aa level off shows them again."] =
    "Klicke auf eine Spaltenüberschrift, um zu sortieren. /aa realm this oder /aa realm all filtert nach Realm, /aa level 70 blendet Charaktere unter Stufe 70 aus, /aa level off zeigt sie wieder an.",
}

local own = GetLocale and T[GetLocale()]
if own then
  for key, text in pairs(own) do rawset(L, key, text) end
end
