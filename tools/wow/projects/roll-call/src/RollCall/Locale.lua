local _, ns = ...

-- English text is the key itself; other languages override single keys.
--
-- Terms the game already has in the player's language come from the client itself, not from this file:
--   the roll lines are read with the client's own GlobalStrings (Core.lua ns.ROLL_TEXT: RANDOM_ROLL_RESULT,
--   since 1.0), so a German client's "würfelt. Ergebnis:" is understood. Player names come from the game.
-- No GlobalStrings constant is spliced into a sentence: every game term here sits inside a sentence, and
-- the German sentence needs its own article and case. They are written as the German client names them:
--   würfeln / Wurf (RANDOM_ROLL_RESULT "würfelt. Ergebnis"), Gewinner, Gleichstand, Sekunden.
-- The addon's name stays "Roll Call" (title and chat prefix), like the names of the other addons.
-- Slash commands and their words stay English: players type them as they are (/rollcall start,
-- /rollcall stop, /rolls, and the game's own /roll).
local L = setmetatable({}, { __index = function(_, key) return key end })
ns.L = L

local T = {}

T.deDE = {
  ["Roll Call"] = "Roll Call",
  -- the result
  ["Winner: %s with %d (%s)."] = "Gewinner: %s mit %d (%s).",
  ["Winner: %s with %d (%s, not 1-100)."] = "Gewinner: %s mit %d (%s, nicht 1-100).",
  ["Tie at %d: %s."] = "Gleichstand bei %d: %s.",
  ["No rolls were seen."] = "Es wurden keine Würfe gesehen.",
  -- the window
  ["No roll call yet."] = "Noch keine Würfelrunde.",
  ["Collecting rolls: %d seconds left"] = "Würfe werden gesammelt: noch %d Sekunden",
  ["tie"] = "gleich",
  ["and %d more"] = "und %d weitere",
  ["Some lines could not be read here, rolls may be missing."] =
    "Einige Zeilen ließen sich hier nicht lesen, es können Würfe fehlen.",
  ["Orange ranges are not 1-100."] = "Orange Bereiche sind nicht 1-100.",
  ["Only the first roll counts: %d more ignored."] = "Nur der erste Wurf zählt: %d weitere ignoriert.",
  ["Waiting for /roll ..."] = "Warte auf /roll ...",
  ["Stop"] = "Beenden",
  ["Start (%d s)"] = "Starten (%d s)",
  -- commands
  ["No roll call yet. Type /rollcall start to begin one."] =
    "Noch keine Würfelrunde. Mit /rollcall start beginnst du eine.",
  ["A roll call is already running. /rollcall stop ends it."] =
    "Es läuft schon eine Würfelrunde. /rollcall stop beendet sie.",
  ["Roll call started for %d seconds (between 5 and 120). Everyone can /roll now."] =
    "Würfelrunde für %d Sekunden gestartet (zwischen 5 und 120). Jetzt kann jeder mit /roll würfeln.",
  ["Roll call started for %d seconds. Everyone can /roll now."] =
    "Würfelrunde für %d Sekunden gestartet. Jetzt kann jeder mit /roll würfeln.",
  ["No roll call is running."] = "Es läuft keine Würfelrunde.",
  -- help
  ["/rollcall start 30 collects rolls for 30 seconds (5 to 120), /rollcall stop ends it early, /rollcall shows the last result."] =
    "/rollcall start 30 sammelt 30 Sekunden lang Würfe (5 bis 120), /rollcall stop beendet die Runde vorzeitig, /rollcall zeigt das letzte Ergebnis.",
}

local own = GetLocale and T[GetLocale()]
if own then
  for key, text in pairs(own) do rawset(L, key, text) end
end
