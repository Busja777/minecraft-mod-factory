local _, ns = ...

-- English text is the key itself; other languages override single keys.
--
-- Every text here is a sentence, so no name is taken from the client's GlobalStrings: the game's
-- own words would not fit into German sentences (DUEL is only "Duell", GROUP_INVITE is shortened
-- to "Gruppeneinlad." in German). Game terms inside sentences are written here as the German client
-- names them: Duell (duel), Gruppeneinladung (group invite), Flüsternachricht (whisper), Realm.
-- Player names come from the game. The default reply whisper is in the player's language too: the
-- stranger most likely plays on a realm of that language. A reply the player typed is sent as it is.
-- Slash commands and their words stay English: players type them as they are (/pd allow Name,
-- /pd whisper on, /pd log all).
local L = setmetatable({}, { __index = function(_, key) return key end })
ns.L = L

local T = {}

T.deDE = {
  ["Polite Decline"] = "Polite Decline",
  ["Declined a duel from %s (%d this session)."] = "Duell von %s abgelehnt (%d in dieser Sitzung).",
  ["Declined a group invite from %s (%d this session)."] = "Gruppeneinladung von %s abgelehnt (%d in dieser Sitzung).",
  ["Declining duels from strangers is on."] = "Duelle von Fremden ablehnen ist an.",
  ["Declining duels from strangers is off."] = "Duelle von Fremden ablehnen ist aus.",
  ["Declining group invites from strangers is on."] = "Gruppeneinladungen von Fremden ablehnen ist an.",
  ["Declining group invites from strangers is off."] = "Gruppeneinladungen von Fremden ablehnen ist aus.",
  ["Quiet mode is on: nothing is said in chat."] = "Der stille Modus ist an: Im Chat erscheint nichts.",
  ["Quiet mode is off."] = "Der stille Modus ist aus.",
  ["/pd duels on/off, /pd invites on/off, /pd quiet on/off, /pd allow Name, /pd unallow Name, /pd list, /pd log."] =
    "/pd duels on/off, /pd invites on/off, /pd quiet on/off, /pd allow Name, /pd unallow Name, /pd list, /pd log.",
  ["Type a name: /pd allow Name or Name-Realm."] = "Gib einen Namen an: /pd allow Name oder Name-Realm.",
  ["Type a name: /pd unallow Name or Name-Realm."] = "Gib einen Namen an: /pd unallow Name oder Name-Realm.",
  ["%s is already on your allow list."] = "%s steht schon auf deiner Ausnahmeliste.",
  ["%s is now on your allow list."] = "%s steht jetzt auf deiner Ausnahmeliste.",
  ["%s is not on your allow list."] = "%s steht nicht auf deiner Ausnahmeliste.",
  ["%s was removed from your allow list."] = "%s wurde von deiner Ausnahmeliste genommen.",
  ["Your allow list is empty."] = "Deine Ausnahmeliste ist leer.",
  ["Allow list: %s."] = "Ausnahmeliste: %s.",
  -- 1.1: the reply whisper
  ["Thanks, but I don't take duels or group invites from people I don't know. Have a good day!"] =
    "Danke, aber ich nehme keine Duelle und Gruppeneinladungen von Leuten an, die ich nicht kenne. Einen schönen Tag noch!",
  ["Reply whisper is on."] = "Die Antwort per Flüsternachricht ist an.",
  ["Reply whisper is off."] = "Die Antwort per Flüsternachricht ist aus.",
  ["Reply text: %s"] = "Antworttext: %s",
  ["That text is too long: %d characters at most."] = "Der Text ist zu lang: höchstens %d Zeichen.",
  ["/pd whisper on or off sends declined strangers a short polite whisper, /pd whisper text Your words sets it, /pd whisper reset brings back the default."] =
    "/pd whisper on oder off schickt abgelehnten Fremden eine kurze, höfliche Flüsternachricht, /pd whisper text Deine Worte legt sie fest, /pd whisper reset stellt den Standardtext wieder her.",
  -- 1.2: the log
  ["%b %d %H:%M"] = "%d.%m. %H:%M",
  ["%s: duel from %s."] = "%s: Duell von %s.",
  ["%s: group invite from %s."] = "%s: Gruppeneinladung von %s.",
  ["Nothing declined this session."] = "In dieser Sitzung wurde nichts abgelehnt.",
  ["Declined this session: %d. Newest first:"] = "In dieser Sitzung abgelehnt: %d. Neueste zuerst:",
  ["Nothing declined yet."] = "Noch nichts abgelehnt.",
  ["The last %d declined requests, newest first:"] = "Die letzten %d abgelehnten Anfragen, neueste zuerst:",
  ["The log is empty now."] = "Das Protokoll ist jetzt leer.",
  ["/pd log lists what was declined this session, /pd log all the last 50 across sessions, /pd log clear empties the log."] =
    "/pd log zeigt, was in dieser Sitzung abgelehnt wurde, /pd log all die letzten 50 über alle Sitzungen, /pd log clear leert das Protokoll.",
}

local own = GetLocale and T[GetLocale()]
if own then
  for key, text in pairs(own) do rawset(L, key, text) end
end
