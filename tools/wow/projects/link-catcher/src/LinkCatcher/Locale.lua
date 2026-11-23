local _, ns = ...

-- English text is the key itself; other languages override single keys.
--
-- No game words are needed from the client: the addon shows no channel, zone or item names of its own
-- (links and names inside chat lines are copied as the game wrote them).
-- No GlobalStrings constant is spliced into a sentence: the German sentence needs its own article
-- and case. Keys are written as on a German keyboard and in the German client's key bindings:
-- Strg (CTRL_KEY_TEXT "STRG"), Esc (KEY_ESCAPE "ESC"); Cmd stays Cmd on a Mac. Other terms as the
-- German client names them: Chat, Chatfenster (chat window), Link, Addons.
-- Slash commands and their words stay English: players type them as they are (/lc copy 50, /lc off).
local L = setmetatable({}, { __index = function(_, key) return key end })
ns.L = L

local T = {}

T.deDE = {
  ["Link Catcher"] = "Link Catcher",
  ["Copy chat"] = "Chat kopieren", ["(name)"] = "(Name)",
  ["Press Ctrl+C (Cmd+C on a Mac) to copy, Escape to close."] = "Drücke Strg+C (Cmd+C am Mac) zum Kopieren, Esc zum Schließen.",
  ["%d hidden lines left out. "] = "%d verborgene Zeilen ausgelassen. ",
  ["This link is too old, it cannot be opened any more."] = "Dieser Link ist zu alt, er lässt sich nicht mehr öffnen.",
  ["The chat window cannot be read."] = "Das Chatfenster lässt sich nicht lesen.",
  ["There is nothing to copy."] = "Es gibt nichts zu kopieren.",
  ["Web links in chat are clickable."] = "Weblinks im Chat sind anklickbar.",
  ["Web links in chat stay plain text."] = "Weblinks im Chat bleiben einfacher Text.",
  ["Clickable links are off right now."] = "Anklickbare Links sind gerade ausgeschaltet.",
  ["This game version does not let addons change chat lines, so links stay plain text."] =
    "Diese Spielversion lässt Addons keine Chatzeilen ändern, deshalb bleiben Links einfacher Text.",
  ["/lc copy shows the last lines of your main chat window to copy (/lc copy 50 for 50 lines), /lc on and /lc off switch the clickable links on and off. Click a link in chat to copy it."] =
    "/lc copy zeigt die letzten Zeilen deines Hauptchatfensters zum Kopieren (/lc copy 50 für 50 Zeilen), /lc on und /lc off schalten die anklickbaren Links ein und aus. Klicke auf einen Link im Chat, um ihn zu kopieren.",
}

local own = GetLocale and T[GetLocale()]
if own then
  for key, text in pairs(own) do rawset(L, key, text) end
end
