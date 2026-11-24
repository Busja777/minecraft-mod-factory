local _, ns = ...

-- English text is the key itself; other languages override single keys.
--
-- Terms the game already has in the player's language come from the client's own GlobalStrings,
-- not from this file (ns.GameText, each with the English word as fallback for a client without it):
--   the headings of the two lists in the window (UI.lua, Core.lua ns.KIND_HEADING): DAILY (Daily),
--   WEEKLY (Weekly). The tasks themselves are the player's own text and stay as typed.
-- No GlobalStrings constant is spliced into a sentence: the German sentence needs its own article
-- and case. Game terms inside sentences are written as the German client names them: tägliche und
-- wöchentliche Zurücksetzung (CONDUIT_INSTALL_CONFIRM, CONFIRM_RELIC_CHOICE; the same words as Reset
-- Clock), Aufgaben (the chores), Liste, Chat. Short times keep the letters d, h and m: the German
-- client writes them the same way (DAY_ONELETTER_ABBR, HOUR_ONELETTER_ABBR, MINUTE_ONELETTER_ABBR).
-- Slash commands and their words stay English: players type them as they are (/chores add daily,
-- /chores done weekly 2, /chores remove, /chores list); the task in the examples is free text, so it
-- is German (Haustier füttern).
local L = setmetatable({}, { __index = function(_, key) return key end })
ns.L = L

local T = {}

T.deDE = {
  ["Chore List"] = "Chore List",
  -- the window
  ["resets in %s"] = "Zurücksetzung in %s",
  ["Nothing on this list yet."] = "Noch nichts auf dieser Liste.",
  ["Add with /chores add daily or weekly, then the task."] = "Neu: /chores add daily oder weekly, dann die Aufgabe.",
  ["%dd %dh"] = "%dd %dh", ["%dh %dm"] = "%dh %dm", ["%dm"] = "%dm",
  -- the resets
  ["Daily reset: your daily chores are open again."] = "Tägliche Zurücksetzung: Deine täglichen Aufgaben sind wieder offen.",
  ["Weekly reset: your weekly chores are open again."] = "Wöchentliche Zurücksetzung: Deine wöchentlichen Aufgaben sind wieder offen.",
  ["The daily reset came while you were away: your daily chores are open again."] =
    "Die tägliche Zurücksetzung kam, während du weg warst: Deine täglichen Aufgaben sind wieder offen.",
  ["The weekly reset came while you were away: your weekly chores are open again."] =
    "Die wöchentliche Zurücksetzung kam, während du weg warst: Deine wöchentlichen Aufgaben sind wieder offen.",
  -- the commands
  ["Added to your daily chores: %s"] = "Zu deinen täglichen Aufgaben hinzugefügt: %s",
  ["Added to your weekly chores: %s"] = "Zu deinen wöchentlichen Aufgaben hinzugefügt: %s",
  ["Your daily list is full (%d tasks)."] = "Deine tägliche Liste ist voll (%d Aufgaben).",
  ["Your weekly list is full (%d tasks)."] = "Deine wöchentliche Liste ist voll (%d Aufgaben).",
  ["That task is already on the list."] = "Diese Aufgabe steht schon auf der Liste.",
  ["Write the task after the list, for example /chores add daily Feed the pet."] =
    "Schreib die Aufgabe hinter die Liste, zum Beispiel /chores add daily Haustier füttern.",
  ["No such task. /chores list shows the numbers."] = "Diese Aufgabe gibt es nicht. /chores list zeigt die Nummern.",
  ["Done: %s"] = "Erledigt: %s", ["Open again: %s"] = "Wieder offen: %s", ["Removed: %s"] = "Entfernt: %s",
  ["Daily chores: %d of %d done."] = "Tägliche Aufgaben: %d von %d erledigt.",
  ["Weekly chores: %d of %d done."] = "Wöchentliche Aufgaben: %d von %d erledigt.",
  ["[done] "] = "[erledigt] ",
  -- help
  ["/chores opens the list, /chores add daily Feed the pet adds a task (or weekly), /chores done daily 2 ticks a task off, /chores remove weekly 1 removes one, /chores list shows both lists in chat."] =
    "/chores öffnet die Liste, /chores add daily Haustier füttern fügt eine Aufgabe hinzu (oder weekly), /chores done daily 2 hakt eine Aufgabe ab, /chores remove weekly 1 entfernt eine, /chores list zeigt beide Listen im Chat.",
}

local own = GetLocale and T[GetLocale()]
if own then
  for key, text in pairs(own) do rawset(L, key, text) end
end
