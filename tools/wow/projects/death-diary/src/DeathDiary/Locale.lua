local _, ns = ...

-- English text is the key itself; other languages override single keys.
--
-- Terms the game already has in the player's language come from the client's own GlobalStrings,
-- not from this file (ns.GameText, each with the English word as fallback for a client without it):
--   column headings of the window (UI.lua): ZONE (Zone), LEVEL (Level);
--   the row for deaths without a level: UNKNOWN (Unknown).
--   Zone and sub-zone names come from the game (GetRealZoneText, GetSubZoneText), in the client's
--   language at the time of the death.
-- No GlobalStrings constant is spliced into a sentence: the German sentence needs its own article
-- and case. Game terms inside sentences are written as the German client names them: Stufe (level),
-- Zone, Tode (deaths, DEATHS), Charakter, Chat.
-- Dates are written the German way: 20.11. 18:00.
-- Slash commands and their words stay English: players type them as they are (/dd quiet on,
-- /dd reset confirm).
local L = setmetatable({}, { __index = function(_, key) return key end })
ns.L = L

local T = {}

T.deDE = {
  ["Death Diary"] = "Death Diary",
  ["Unknown zone"] = "Unbekannte Zone", ["unknown level"] = "Stufe unbekannt", ["unknown time"] = "Zeit unbekannt",
  ["level %d"] = "Stufe %d", ["Levels %d-%d: %d"] = "Stufe %d-%d: %d", ["unknown level: %d"] = "Stufe unbekannt: %d",
  ["%b %d %H:%M"] = "%d.%m. %H:%M",
  ["%s, %s"] = "%s, %s", ["%s: %s, %s"] = "%s: %s, %s", ["%s (%d)"] = "%s (%d)", ["%d-%d"] = "%d-%d",
  ["No deaths noted for this character yet."] = "Für diesen Charakter sind noch keine Tode notiert.",
  ["Deaths noted for this character: %d."] = "Notierte Tode dieses Charakters: %d.",
  ["Top zones: "] = "Häufigste Zonen: ", ["By level: "] = "Nach Stufe: ",
  ["Death %d noted: %s, %s."] = "Tod %d notiert: %s, %s.",
  ["%d other zones"] = "%d weitere Zonen", ["Deaths: %d"] = "Tode: %d", ["Last: "] = "Zuletzt: ",
  ["Your last %d deaths, newest first:"] = "Deine letzten %d Tode, neueste zuerst:",
  ["Use /dd quiet on or /dd quiet off."] = "Nutze /dd quiet on oder /dd quiet off.",
  ["No note in chat after a death."] = "Keine Notiz im Chat nach einem Tod.",
  ["A note in chat after each death."] = "Eine Notiz im Chat nach jedem Tod.",
  ["This clears all %d deaths of this character. Type /dd reset confirm to do it."] =
    "Damit löschst du alle %d Tode dieses Charakters. Gib /dd reset confirm ein, um es zu tun.",
  ["The diary of this character is empty now."] = "Das Tagebuch dieses Charakters ist jetzt leer.",
  ["/dd last lists your last 10 deaths, /dd window opens the window, /dd quiet on or off switches the note after a death, /dd reset confirm clears this character's diary."] =
    "/dd last zeigt deine letzten 10 Tode, /dd window öffnet das Fenster, /dd quiet on oder off schaltet die Notiz nach einem Tod aus oder ein, /dd reset confirm leert das Tagebuch dieses Charakters.",
}

local own = GetLocale and T[GetLocale()]
if own then
  for key, text in pairs(own) do rawset(L, key, text) end
end
