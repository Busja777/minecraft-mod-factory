local _, ns = ...

-- English text is the key itself; other languages override single keys.
--
-- Terms the game already has in the player's language come from the client itself, not from this file:
--   flight point names (TaxiNodeName) and the faction name in /fm (UnitFactionGroup).
-- No GlobalStrings constant is spliced into a sentence: every game term here sits inside one, and the
-- German sentence needs its own article and case. They are written as the German client names them:
-- Flugroute/Route (flight path), Flugzeit (flight time), Fraktion (faction), Sitzung (session).
-- Slash commands and their words stay English: players type them as they are (/fm sound both).
-- The sound names (bell, chime, horn, warning, whisper) are command words too and stay English.
local L = setmetatable({}, { __index = function(_, key) return key end })
ns.L = L

local T = {}

T.deDE = {
  ["Flight Minutes"] = "Flight Minutes",
  ["Learning this route ... %s"] = "Route wird gemessen ... %s",
  ["Landing any moment ..."] = "Landung jeden Moment ...",
  ["Landing in %s"] = "Landung in %s",
  ["Landing early, not timed"] = "Vorzeitige Landung, nicht gemessen",
  ["New route learned: %s takes %s."] = "Neue Route gelernt: %s dauert %s.",
  ["No routes known yet. Every flight you take is timed."] = "Noch keine Routen bekannt. Jeder Flug, den du nimmst, wird gemessen.",
  ["Routes known for %s: %d. /fm list shows them, /fm forget clears all."] =
    "Bekannte Routen für %s: %d. /fm list zeigt sie, /fm forget löscht alle.",
  ["and %d more"] = "und %d weitere",
  ["All routes forgotten, for both factions."] = "Alle Routen gelöscht, für beide Fraktionen.",
  ["Drag to move it."] = "Zum Verschieben ziehen.",
  ["/fm shows how many routes are known, /fm list shows them with their times, /fm forget clears all routes."] =
    "/fm zeigt, wie viele Routen bekannt sind, /fm list zeigt sie mit ihren Zeiten, /fm forget löscht alle Routen.",
  -- 1.1: the flight map tooltip
  ["Flight time: %s"] = "Flugzeit: %s",
  ["Flight time: not timed yet"] = "Flugzeit: noch nicht gemessen",
  -- 1.2: the arrival sound
  ["%s or %s"] = "%s oder %s",
  ["Arrival sound is off."] = "Der Ankunftston ist aus.",
  ["Arrival sound: %d seconds before landing, %s."] = "Ankunftston: %d Sekunden vor der Landung, %s.",
  ["Arrival sound: at landing, %s."] = "Ankunftston: bei der Landung, %s.",
  ["Arrival sound: %d seconds before landing and at landing, %s."] = "Ankunftston: %d Sekunden vor der Landung und bei der Landung, %s.",
  ["/fm sound before, landing, both or off sets when it plays; /fm sound followed by %s picks the sound."] =
    "/fm sound before, landing, both oder off legt fest, wann er spielt; /fm sound mit %s wählt den Ton.",
  ["/fm sound both switches it on."] = "/fm sound both schaltet ihn an.",
  -- 1.3: the flight totals
  ["%ds"] = "%d Sek.", ["%dm %02ds"] = "%d Min. %02d Sek.", ["%dh %02dm"] = "%d Std. %02d Min.",
  ["%d flight, %s in the air"] = "%d Flug, %s in der Luft",
  ["%d flights, %s in the air"] = "%d Flüge, %s in der Luft",
  ["This session: no flights yet."] = "Diese Sitzung: noch keine Flüge.",
  ["This session: %s."] = "Diese Sitzung: %s.",
  ["All time on this character: no flights yet."] = "Insgesamt mit diesem Charakter: noch keine Flüge.",
  ["All time on this character: %s."] = "Insgesamt mit diesem Charakter: %s.",
  ["The all-time flight total of this character is cleared. Your routes and this session's total stay."] =
    "Die Gesamtsumme der Flüge dieses Charakters ist gelöscht. Deine Routen und die Summe dieser Sitzung bleiben.",
  ["/fm stats shows your flight totals, /fm stats reset clears the all-time total of this character."] =
    "/fm stats zeigt deine Flugsummen, /fm stats reset löscht die Gesamtsumme dieses Charakters.",
}

local own = GetLocale and T[GetLocale()]
if own then
  for key, text in pairs(own) do rawset(L, key, text) end
end
