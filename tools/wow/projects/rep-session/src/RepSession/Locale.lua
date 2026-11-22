local _, ns = ...

-- English text is the key itself; other languages override single keys.
--
-- Terms the game already has in the player's language come from the client itself, not from this file
-- (ns.GameText, each with the English word as fallback for a client without it):
--   standings: FACTION_STANDING_LABEL1 to 8 (Hated ... Exalted), since 1.0; friendship ranks come from
--   C_GossipInfo.GetFriendshipReputation, faction names from the reputation API.
--   renown: RENOWN_LEVEL_LABEL ("Renown %d", German "Ruhmstufe %d"), the game's own format.
--   the first line of the window and the report: FACTION (Faction); the window's button: RESET (Reset).
--   Thousands separator: LARGE_NUMBER_SEPERATOR (German 4.750, English 4,750), since 1.0.
-- Short times keep the letters m, h and d: the German client writes them the same way
-- (MINUTE_ONELETTER_ABBR, HOUR_ONELETTER_ABBR, DAY_ONELETTER_ABBR).
-- No GlobalStrings constant is spliced into a sentence: the German sentence needs its own article
-- and case. Game terms inside sentences are written as the German client names them: Fraktion
-- (faction), Ruffenster (reputation panel), Rang (standing), Sitzung (session).
-- Slash commands and their words stay English: players type them as they are (/rs show, /rs reset).
local L = setmetatable({}, { __index = function(_, key) return key end })
ns.L = L

local T = {}

T.deDE = {
  ["Rep Session"] = "Rep Session",
  ["No faction is watched. Pick one in the reputation panel."] =
    "Du beobachtest keine Fraktion. Wähle eine im Ruffenster aus.",
  ["This session"] = "Diese Sitzung", ["Per hour"] = "Pro Stunde", ["Next standing"] = "Nächster Rang",
  ["in %s"] = "in %s", ["after %d minutes"] = "nach %d Minuten", ["max"] = "max.",
  ["%s to go"] = "noch %s", ["%s to go, about %s"] = "noch %s, etwa %s",
  ["under a minute"] = "unter einer Minute",
  ["%dm"] = "%dm", ["%dh %02dm"] = "%dh %02dm", ["%dd %dh"] = "%dd %dh",
  ["Session started again."] = "Neue Sitzung gestartet.",
  ["/rs shows the watched faction in chat, /rs show opens the window, /rs reset starts a new session."] =
    "/rs zeigt die beobachtete Fraktion im Chat, /rs show öffnet das Fenster, /rs reset startet eine neue Sitzung.",
}

local own = GetLocale and T[GetLocale()]
if own then
  for key, text in pairs(own) do rawset(L, key, text) end
end
