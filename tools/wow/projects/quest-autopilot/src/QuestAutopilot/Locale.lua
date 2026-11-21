local _, ns = ...

-- English text is the key itself; other languages override single keys.
--
-- Terms the game already has in the player's language come from the client's own GlobalStrings,
-- not from this file (each with the English letter as fallback for a client without it):
--   GOLD_AMOUNT_SYMBOL, SILVER_AMOUNT_SYMBOL, COPPER_AMOUNT_SYMBOL: the coin letters in the reward
--   hint (Core.lua ns.MoneyText), "1g 20s" in English, "1G 20S" in German.
-- Game terms inside sentences are written here as the German client names them: Quest, Belohnung
-- (reward), Händler (vendor), Gesprächsoption (dialogue option), täglich/wöchentlich (daily/weekly).
-- Quest names, item links and NPC names come from the game.
-- Slash commands and their words stay English: players type them as they are (/qa manual,
-- /qa dailies, /qa hint off).
local L = setmetatable({}, { __index = function(_, key) return key end })
ns.L = L

local T = {}

T.deDE = {
  ["Quest Autopilot"] = "Quest Autopilot",
  ["This quest has several rewards. Pick one yourself."] = "Diese Quest hat mehrere Belohnungen. Wähle selbst eine aus.",
  ["on"] = "an", ["off"] = "aus",
  ["Autopilot is %s. Accepting quests: %s. Handing in quests: %s. Daily and weekly quests: %s. Only dialogue option: %s. Reward hint: %s. Kept manual: %d."] =
    "Autopilot ist %s. Quests annehmen: %s. Quests abgeben: %s. Tägliche und wöchentliche Quests: %s. Einzige Gesprächsoption: %s. Belohnungshinweis: %s. Manuell: %d.",
  ["/qa shows the state, /qa on and /qa off switch everything, /qa accept and /qa turnin switch one half. Hold Shift while talking to pause."] =
    "/qa zeigt den Stand, /qa on und /qa off schalten alles, /qa accept und /qa turnin schalten das Annehmen oder das Abgeben. Halte Shift gedrückt, während du jemanden ansprichst, um zu pausieren.",
  -- 1.1: quests kept manual
  ["manual"] = "manuell", ["automatic"] = "automatisch",
  ["Quest %d"] = "Quest %d",
  ["/qa manual keeps the quest you just saw manual, /qa manual <ID, name or quest link> adds one, /qa auto <ID or name> hands it back, /qa list shows them."] =
    "/qa manual stellt die Quest, die du gerade gesehen hast, auf manuell, /qa manual <ID, Name oder Questlink> fügt eine hinzu, /qa auto <ID oder Name> gibt sie dem Autopiloten zurück, /qa list zeigt sie.",
  ["/qa dailies leaves all daily and weekly quests to you, type it again to undo."] =
    "/qa dailies überlässt dir alle täglichen und wöchentlichen Quests, nochmal eingeben macht es rückgängig.",
  ["No quest seen yet. Open one while holding Shift and type /qa manual, or use /qa manual <ID or name>."] =
    "Noch keine Quest gesehen. Öffne eine mit gedrückter Shift-Taste und gib /qa manual ein, oder nutze /qa manual <ID oder Name>.",
  ["%s stays manual from now on."] = "%s bleibt ab jetzt manuell.",
  ["%s is already kept manual."] = "%s ist schon manuell.",
  ["%s is handled by the autopilot again."] = "%s übernimmt wieder der Autopilot.",
  ["%s is not on your list. /qa list shows it."] = "%s steht nicht auf deiner Liste. /qa list zeigt sie.",
  ["You keep no quests manual. /qa manual adds the quest you just saw."] =
    "Du hast keine manuellen Quests. /qa manual fügt die Quest hinzu, die du gerade gesehen hast.",
  ["Quests you keep manual: %d"] = "Manuelle Quests: %d",
  -- 1.2: the only dialogue option
  ["/qa gossip picks the only dialogue option of a character without quests for you, type it again to undo."] =
    "/qa gossip wählt die einzige Gesprächsoption eines NPCs, der keine Quests für dich hat, nochmal eingeben macht es rückgängig.",
  ["This dialogue option asks you to confirm, so the choice is yours. The autopilot will not pick it again."] =
    "Diese Gesprächsoption verlangt eine Bestätigung, also entscheidest du. Der Autopilot wählt sie nicht noch einmal.",
  -- 1.3: the reward hint
  ["/qa hint on or /qa hint off: marks the reward a vendor pays most for when a quest lets you choose. It never picks for you."] =
    "/qa hint on oder /qa hint off: markiert die Belohnung, für die ein Händler am meisten zahlt, wenn du bei einer Quest wählen darfst. Der Hinweis wählt nie für dich.",
  ["Reward hint is on: when a quest lets you choose, the reward a vendor pays most for gets a coin."] =
    "Der Belohnungshinweis ist an: Wenn du bei einer Quest wählen darfst, bekommt die Belohnung, für die ein Händler am meisten zahlt, eine Münze.",
  ["Reward hint is off."] = "Der Belohnungshinweis ist aus.",
  ["Highest vendor value: %s (%s). The choice is still yours."] = "Höchster Verkaufswert beim Händler: %s (%s). Die Wahl bleibt bei dir.",
}

local own = GetLocale and T[GetLocale()]
if own then
  for key, text in pairs(own) do rawset(L, key, text) end
end
