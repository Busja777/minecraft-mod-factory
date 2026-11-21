local _, ns = ...

-- English text is the key itself; other languages override single keys.
--
-- Terms the game already has in the player's language come from the client's own GlobalStrings,
-- not from this file (ns.GameText, each with the English word as fallback for a client without it):
--   XP: the XP column of the history (German "EP"),
--   TUTORIAL_TITLE26: the Rested line of the clock (the game's name for the rested state of the XP bar),
--   BACK: the button that leads from the history back to the clock,
--   LARGE_NUMBER_SEPERATOR: the thousands in XP numbers (Core.lua ns.FormatNumber; German "12.345").
-- Short times keep the letters m, h and d: the German client writes them the same way
-- (MINUTE_ONELETTER_ABBR, HOUR_ONELETTER_ABBR, DAY_ONELETTER_ABBR).
-- No GlobalStrings constant is spliced into a sentence: the German sentence needs its own article
-- and case. Game terms inside sentences are written as the German client names them: EP (XP),
-- Stufe (level), Stufenaufstieg (level-up), Höchststufe (maximum level), Spielzeit (played time),
-- Charakter. Decimal sizes are written with a comma (0,8); /lc scale takes both.
-- Slash commands and their words stay English: players type them as they are (/lc hidemax),
-- and so does /played, the game's own command.
local L = setmetatable({}, { __index = function(_, key) return key end })
ns.L = L

local T = {}

T.deDE = {
  ["Level Clock"] = "Level Clock",
  ["XP per hour"] = "EP pro Stunde", ["Time to level"] = "Zeit bis zum Aufstieg", ["XP to level"] = "EP bis zum Aufstieg",
  ["Session XP"] = "EP der Sitzung", ["Session time"] = "Sitzungsdauer", ["%d%%"] = "%d%%",
  ["under a minute"] = "unter 1 Min.", ["%dm"] = "%dm", ["%dh %02dm"] = "%dh %02dm", ["%dd %dh"] = "%dd %dh",
  ["You have reached the maximum level."] = "Du hast die Höchststufe erreicht.",
  ["New session started."] = "Neue Sitzung gestartet.",
  ["/lc opens or closes the clock, /lc history lists your last sessions, /lc levels lists your last levels, /lc reset starts a new session."] =
    "/lc öffnet oder schließt die Uhr, /lc history zeigt deine letzten Sitzungen, /lc levels zeigt deine letzten Stufen, /lc reset startet eine neue Sitzung.",
  -- 1.1: the session history
  ["History"] = "Verlauf", ["Session history"] = "Sitzungsverlauf",
  ["Started"] = "Beginn", ["Time"] = "Dauer", ["XP/hour"] = "EP/Std.", ["Levels"] = "Stufen", ["+%d"] = "+%d",
  ["%b %d %H:%M"] = "%d.%m. %H:%M",
  ["No finished sessions with XP yet."] = "Noch keine abgeschlossene Sitzung mit EP.",
  ["Your last sessions with XP, newest first:"] = "Deine letzten Sitzungen mit EP, neueste zuerst:",
  ["%s: %s XP in %s, %s XP per hour"] = "%s: %s EP in %s, %s EP pro Stunde",
  ["%s: %s XP in %s"] = "%s: %s EP in %s",
  [", 1 level up"] = ", 1 Stufenaufstieg", [", %d levels up"] = ", %d Stufenaufstiege",
  -- 1.2: window options
  ["Window: %s, size %s, %s at maximum level."] = "Fenster: %s, Größe %s, auf Höchststufe %s.",
  ["locked"] = "gesperrt", ["movable"] = "verschiebbar", ["hidden"] = "ausgeblendet", ["shown"] = "eingeblendet",
  ["The window size is %s. /lc scale followed by a number from 0.8 to 1.5 changes it."] =
    "Die Fenstergröße ist %s. /lc scale mit einer Zahl von 0,8 bis 1,5 ändert sie.",
  ["Choose a size from 0.8 to 1.5, for example /lc scale 1.2."] = "Wähle eine Größe von 0,8 bis 1,5, zum Beispiel /lc scale 1,2.",
  ["The window size is %s."] = "Die Fenstergröße ist %s.",
  ["The window is locked in place. /lc unlock lets you move it again."] =
    "Das Fenster ist gesperrt. Mit /lc unlock kannst du es wieder verschieben.",
  ["The window can be moved again: drag it with the left mouse button."] =
    "Das Fenster lässt sich wieder verschieben: Zieh es mit der linken Maustaste.",
  ["The window now stays closed at maximum level. /lc still opens it."] =
    "Das Fenster bleibt jetzt auf Höchststufe geschlossen. /lc öffnet es trotzdem.",
  ["The window now also opens at maximum level."] = "Das Fenster öffnet sich jetzt auch auf Höchststufe.",
  ["/lc lock and /lc unlock fix the window in place, /lc scale 0.8 to 1.5 sets its size, /lc hidemax hides it at maximum level, /lc options shows these settings."] =
    "/lc lock und /lc unlock sperren oder entsperren das Fenster, /lc scale 0,8 bis 1,5 legt seine Größe fest, /lc hidemax blendet es auf Höchststufe aus, /lc options zeigt diese Einstellungen.",
  -- 1.3: the level history
  ["Level %d on %s"] = "Stufe %d am %s",
  [", took %s played"] = ", Dauer: %s Spielzeit", [", took %s real time"] = ", Dauer: %s Echtzeit",
  [" (/played %s)"] = " (/played %s)",
  ["No level-ups noted yet. Level Clock notes every level from now on."] =
    "Noch keine Stufenaufstiege notiert. Level Clock notiert ab jetzt jede Stufe.",
  ["Your last levels on this character, newest first:"] = "Deine letzten Stufen mit diesem Charakter, neueste zuerst:",
}

local own = GetLocale and T[GetLocale()]
if own then
  for key, text in pairs(own) do rawset(L, key, text) end
end
