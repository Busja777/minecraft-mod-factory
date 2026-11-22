local _, ns = ...

-- English text is the key itself; other languages override single keys.
--
-- Terms the game already has in the player's language come from the client itself, not from this file
-- (each with the English word as fallback for a client without it):
--   UNKNOWN (Unknown): the zone of a catch the game named no zone for (Core.lua ns.ZoneLabel). The
--   saved key stays "Unknown", only the text on screen comes from the client.
--   Zone names come from the game (GetRealZoneText), in the client's language.
-- No GlobalStrings constant is spliced into a sentence: the German sentence needs its own article
-- and case. Game terms inside sentences are written as the German client names them: Angeln (fishing,
-- PROFESSIONS_FISHING), Gegenstände (items, ITEMS), Zone (ZONE), Sitzung (session).
-- The rate keeps its "–" while there is none, the top zones their "Dornogal 4".
-- Slash commands and their words stay English: players type them as they are (/fl zones, /fl reset).
local L = setmetatable({}, { __index = function(_, key) return key end })
ns.L = L

local T = {}

T.deDE = {
  ["Fishing Log"] = "Fishing Log",
  ["No catches yet this session."] = "In dieser Sitzung noch keine Fänge.",
  ["This session: %d catches, %d items, %s per hour."] = "Diese Sitzung: %d Fänge, %d Gegenstände, %s pro Stunde.",
  ["Top zones: %s."] = "Häufigste Zonen: %s.",
  ["The rate shows after two catches and five minutes of fishing."] =
    "Die Fänge pro Stunde erscheinen nach zwei Fängen und fünf Minuten Angeln.",
  ["No catches recorded yet."] = "Noch keine Fänge notiert.",
  ["All-time catches per zone (%d catches, %d items):"] = "Alle bisherigen Fänge pro Zone (%d Fänge, %d Gegenstände):",
  ["  %s: %d catches, %d items"] = "  %s: %d Fänge, %d Gegenstände",
  ["Session started again."] = "Neue Sitzung gestartet.",
  ["/fl shows this session, /fl zones lists all catches per zone, /fl reset starts a new session."] =
    "/fl zeigt diese Sitzung, /fl zones listet alle Fänge pro Zone auf, /fl reset startet eine neue Sitzung.",
}

local own = GetLocale and T[GetLocale()]
if own then
  for key, text in pairs(own) do rawset(L, key, text) end
end
