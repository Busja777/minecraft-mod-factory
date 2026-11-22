local _, ns = ...

-- English text is the key itself; other languages override single keys.
--
-- Terms the game already has in the player's language come from the client itself, not from this file:
--   item names and links (loot window, tooltip, /gt).
-- No GlobalStrings constant is used: the game has no word for "Herbs" and "Ores" as this addon counts
-- them. Its item subclass names are singular in English ("Herb") and lump ore with stone
-- ("Metal & Stone"), so the two kinds are this addon's own words. In German they are written as the
-- German client names the items: Kräuter (its subclass name for herbs), Erze (ores).
-- Game terms inside sentences: Sitzung (session), Anzeige (display); "pro Stunde" and "/Std." for
-- per hour. The "x4" after an item stays as it is: the German client writes stack counts the same way.
-- Slash commands and their words stay English: players type them as they are (/gt reset, /gt hide).
local L = setmetatable({}, { __index = function(_, key) return key end })
ns.L = L

local T = {}

T.deDE = {
  ["Gather Tally"] = "Gather Tally",
  ["Herbs"] = "Kräuter", ["Ores"] = "Erze",
  ["%s: none yet"] = "%s: noch keine",
  ["%s: %d (%d per hour)"] = "%s: %d (%d pro Stunde)",
  ["%s: %d (per hour after 5 minutes)"] = "%s: %d (pro Stunde nach 5 Minuten)",
  ["%s %d  |cff9d9d9d%d/h|r"] = "%s %d  |cff9d9d9d%d/Std.|r",
  ["%s %d"] = "%s %d", ["%s x%d"] = "%s x%d",
  ["Most gathered:"] = "Am meisten gesammelt:",
  ["Drag to move. /gt reset starts a new session."] = "Zum Verschieben ziehen. /gt reset startet eine neue Sitzung.",
  ["New session started."] = "Neue Sitzung gestartet.",
  ["The display is hidden. /gt show brings it back."] = "Die Anzeige ist ausgeblendet. /gt show holt sie zurück.",
  ["The display is shown while you have gathered something this session."] =
    "Die Anzeige erscheint, sobald du in dieser Sitzung etwas gesammelt hast.",
  ["/gt reset starts a new session, /gt hide and /gt show hide or show the display."] =
    "/gt reset startet eine neue Sitzung, /gt hide und /gt show blenden die Anzeige aus oder ein.",
  ["/gt shows this session, /gt reset starts a new one, /gt hide and /gt show hide or show the display."] =
    "/gt zeigt diese Sitzung, /gt reset startet eine neue, /gt hide und /gt show blenden die Anzeige aus oder ein.",
}

local own = GetLocale and T[GetLocale()]
if own then
  for key, text in pairs(own) do rawset(L, key, text) end
end
