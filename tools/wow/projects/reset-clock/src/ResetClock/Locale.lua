local _, ns = ...

-- English text is the key itself; other languages override single keys.
--
-- The game has no single word for the two resets, so they are written here as the German client
-- names them in its own texts: "tägliche Zurücksetzung" (DAILY_RESET_INSTANCE_WELCOME) and
-- "wöchentliche Zurücksetzung" (CONDUIT_INSTALL_CONFIRM, CONFIRM_RELIC_CHOICE).
-- Short times keep the letters d, h, m and s: the German client writes them the same way
-- (DAY_ONELETTER_ABBR, HOUR_ONELETTER_ABBR, MINUTE_ONELETTER_ABBR, SECOND_ONELETTER_ABBR), and the
-- timer lengths players type (10m, 1h30m, 90s) stay the same in every language.
-- Other game terms inside sentences: Timer, Fenster (window).
-- Slash commands and their words stay English: players type them as they are (/rc timer, /rc cancel,
-- /rc window); the label of a timer is free text, so the example label is German (Tee).
local L = setmetatable({}, { __index = function(_, key) return key end })
ns.L = L

local T = {}

T.deDE = {
  ["Reset Clock"] = "Reset Clock",
  ["Daily reset"] = "Tägliche Zurücksetzung", ["Weekly reset"] = "Wöchentliche Zurücksetzung",
  ["%dd %dh"] = "%dd %dh", ["%dh %dm"] = "%dh %dm", ["%dm %ds"] = "%dm %ds", ["%ds"] = "%ds",
  ["%s in %s."] = "%s in %s.", ["%s: not available."] = "%s: nicht verfügbar.",
  ["Timer"] = "Timer", ["Timer \"%s\""] = "Timer „%s“",
  ["%s: %s left of %s."] = "%s: noch %s von %s.",
  ["%s started: %s."] = "%s gestartet: %s.",
  ["It replaces the timer that was running."] = "Er ersetzt den Timer, der lief.",
  ["%s is up!"] = "%s ist abgelaufen!",
  ["%s ran out while you were away."] = "%s ist abgelaufen, während du weg warst.",
  ["Timer \"%s\" stopped."] = "Timer „%s“ beendet.", ["Timer stopped."] = "Timer beendet.",
  ["No timer is running."] = "Es läuft kein Timer.",
  ["No timer running. /rc timer 10m starts one."] = "Es läuft kein Timer. /rc timer 10m startet einen.",
  ["A timer needs at least one second."] = "Ein Timer braucht mindestens eine Sekunde.",
  ["A timer can run at most 24 hours."] = "Ein Timer läuft höchstens 24 Stunden.",
  ["Give the time like 10m, 1h30m, 90s or 15 (minutes), for example /rc timer 10m tea."] =
    "Gib die Zeit so an: 10m, 1h30m, 90s oder 15 (Minuten), zum Beispiel /rc timer 10m Tee.",
  ["/rc timer 10m tea starts a timer with a label, /rc timer shows the time left, /rc cancel stops it, /rc window opens the window."] =
    "/rc timer 10m Tee startet einen Timer mit Namen, /rc timer zeigt die verbleibende Zeit, /rc cancel beendet ihn, /rc window öffnet das Fenster.",
}

local own = GetLocale and T[GetLocale()]
if own then
  for key, text in pairs(own) do rawset(L, key, text) end
end
