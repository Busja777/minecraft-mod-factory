local _, ns = ...

-- English text is the key itself; other languages override single keys.
--
-- Terms the game already has in the player's language come from the client itself, not from this file:
--   the loot lines in chat are read with the client's own GlobalStrings (Core.lua ns.SELF_LOOT:
--   LOOT_ITEM_SELF and LOOT_ITEM_SELF_MULTIPLE, since 1.0), so a German client's "Ihr erhaltet Beute: %s"
--   is understood; item links and achievement names come from the game in the client's language.
-- No GlobalStrings constant is spliced into a sentence or used as a label: every game term here sits
-- inside a sentence, and the German sentence needs its own article and case. They are written as the
-- German client names them: Stufe (LEVEL "Stufe"), Stufenaufstieg (level up), Erfolg (ACHIEVEMENTS
-- "Erfolge"), episch (ITEM_QUALITY4_DESC "Episch"), Beute (LOOT "Beute"), Screenshot (the German
-- client keeps the English word), Ladebildschirm (loading screen).
-- The folder name "Screenshots" stays: it is the folder on disk. The addon's name stays English.
-- Slash commands and their words stay English: players type them as they are (/smo on, /smo off,
-- /smo test, /shotmoments).
local L = setmetatable({}, { __index = function(_, key) return key end })
ns.L = L

local T = {}

T.deDE = {
  ["Screenshot Moments"] = "Screenshot Moments",
  -- the state and the help
  ["Screenshots at a level up, an achievement and epic loot are on."] =
    "Screenshots bei einem Stufenaufstieg, einem Erfolg und epischer Beute sind an.",
  ["Screenshots at special moments are off."] = "Screenshots bei besonderen Momenten sind aus.",
  ["/smo on or /smo off switches the screenshots, /smo test takes a test screenshot. They are saved in the Screenshots folder of the game."] =
    "/smo on oder /smo off schaltet die Screenshots ein oder aus, /smo test macht einen Test-Screenshot. Sie landen im Ordner Screenshots des Spiels.",
  -- the test screenshot
  ["test"] = "Test",
  ["The last screenshot was just taken. Try again in %d seconds."] =
    "Der letzte Screenshot wurde gerade gemacht. Versuch es in %d Sekunden noch mal.",
  ["Not during a loading screen."] = "Nicht während eines Ladebildschirms.",
  ["A test screenshot follows in a second."] = "Ein Test-Screenshot folgt in einer Sekunde.",
  -- the moments in the chat line
  ["level %d"] = "Stufe %d",
  ["new level"] = "neue Stufe",
  ["achievement %s"] = "Erfolg %s",
  ["achievement"] = "Erfolg",
  ["epic loot %s"] = "epische Beute %s",
  ["Screenshot saved: %s."] = "Screenshot gespeichert: %s.",
  ["The screenshot did not work: %s."] = "Der Screenshot hat nicht geklappt: %s.",
}

local own = GetLocale and T[GetLocale()]
if own then
  for key, text in pairs(own) do rawset(L, key, text) end
end
