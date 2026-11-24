local _, ns = ...

-- English text is the key itself; other languages override single keys.
--
-- Terms the game already has in the player's language come from the client itself, not from this file
-- (ns.GameText, each with the English word as fallback for a client without it):
--   the label in front of your note in the tooltip: NOTE_COLON ("Note:", German "Notiz:").
--   Player, realm and zone names come from the game (UnitName, GetNormalizedRealmName,
--   GetRealZoneText), the zone in the client's language at the time of the meeting.
-- No GlobalStrings constant is spliced into a sentence: the German sentence needs its own article
-- and case. Game terms inside sentences are written as the German client names them: Spieler (PLAYER),
-- Ziel (TARGET), Realm (FRIENDS_LIST_REALM), Gruppe (group), Notiz (note, LABEL_NOTE), Addon.
-- Slash commands and their words stay English: players type them as they are (/metbefore note target,
-- /metbefore forget Name-Realm); "Name-Realm" reads the same in German.
local L = setmetatable({}, { __index = function(_, key) return key end })
ns.L = L

local T = {}

T.deDE = {
  ["Met Before"] = "Met Before",
  ["Met before: %s"] = "Schon getroffen: %s", [", last %s"] = ", zuletzt %s",
  ["1 time"] = "1-mal", ["%d times"] = "%d-mal",
  ["just now"] = "gerade eben", ["1 hour ago"] = "vor 1 Stunde", ["%d hours ago"] = "vor %d Stunden",
  ["1 day ago"] = "vor 1 Tag", ["%d days ago"] = "vor %d Tagen",
  ["%s: %s, last %s"] = "%s: %s, zuletzt %s", [" in %s"] = " in %s", [" - %s"] = " - %s",
  ["%s: not met yet"] = "%s: noch nicht getroffen",
  ["No players remembered yet. Join a group and they appear here."] =
    "Noch keine Spieler gemerkt. Tritt einer Gruppe bei, dann erscheinen sie hier.",
  ["The last %d players you grouped with, newest first:"] = "Die letzten %d Spieler aus deinen Gruppen, neueste zuerst:",
  ["Note on %s: %s"] = "Notiz zu %s: %s", ["Note on %s removed."] = "Notiz zu %s gelöscht.",
  ["No note on %s to remove."] = "Zu %s gibt es keine Notiz zum Löschen.",
  ["%s is not a name the addon can use."] = "%s ist kein Name, den das Addon verwenden kann.",
  ["Several players are called %s, add the realm: %s."] = "Mehrere Spieler heißen %s, gib den Realm mit an: %s.",
  ["Your target is not a player whose name the game shows right now."] =
    "Dein Ziel ist kein Spieler, dessen Namen das Spiel gerade zeigt.",
  ["No player called %s is remembered."] = "Kein gemerkter Spieler heißt %s.",
  ["%s forgotten."] = "%s vergessen.",
  ["/metbefore list shows the last 10 players you grouped with, /metbefore note Name-Realm text sets your note (no text removes it), /metbefore note target text notes your target, /metbefore forget Name-Realm removes a player."] =
    "/metbefore list zeigt die letzten 10 Spieler aus deinen Gruppen, /metbefore note Name-Realm Text setzt deine Notiz (ohne Text wird sie gelöscht), /metbefore note target Text notiert etwas zu deinem Ziel, /metbefore forget Name-Realm entfernt einen Spieler.",
}

local own = GetLocale and T[GetLocale()]
if own then
  for key, text in pairs(own) do rawset(L, key, text) end
end
