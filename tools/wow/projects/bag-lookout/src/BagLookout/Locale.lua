local _, ns = ...

-- English text is the key itself; other languages override single keys.
--
-- Terms the game already has in the player's language come from the client itself, not from this file
-- (each with the English name as fallback for a client without it):
--   names of the kinds of bag in the split view (Core.lua ns.ContainerName): the item subclasses of
--   containers from C_Item.GetItemSubClassInfo (or the older GetItemSubClassInfo), the names the
--   auction house lists: Reagent Bag (11), Herb Bag (2), Enchanting Bag (3), Engineering Bag (4),
--   Gem Bag (5), Mining Bag (6), Leatherworking Bag (7), Inscription Bag (8), Tackle Box (9),
--   Cooking Bag (10).
--   Amounts in /bl cheap and the "bags full" warning: GetMoneyString, the client's own coin display.
--   Item names and links come from the game.
-- No GlobalStrings constant is spliced into a sentence: every other game term here sits inside one,
-- and the German sentence needs its own article and case. They are written as the German client
-- names them: Taschen (bags), Taschenplatz/Platz (bag slot), Reagenzientasche (reagent bag),
-- Händler (vendor), Gegenstand (item), Stapel (stack), Sitzung (session).
-- The colours grey, white and green are plain words: the addon names item colours, not quality names.
-- Slash commands and their words stay English: players type them as they are (/bl view split).
-- The sound names (warning, bell, chime, horn, whisper) are command words too and stay English.
local L = setmetatable({}, { __index = function(_, key) return key end })
ns.L = L

local T = {}

T.deDE = {
  ["Bag Lookout"] = "Bag Lookout",
  ["Bags ..."] = "Taschen ...", ["Bags %d/%d"] = "Taschen %d/%d",
  ["No reagent bag"] = "Keine Reagenzientasche", ["%s %d/%d"] = "%s %d/%d",
  ["Your bags are full!"] = "Deine Taschen sind voll!",
  ["Bags almost full: 1 free slot left."] = "Taschen fast voll: noch 1 freier Platz.",
  ["Bags almost full: %d free slots left."] = "Taschen fast voll: noch %d freie Plätze.",
  ["Bags not counted yet."] = "Taschen noch nicht gezählt.",
  ["%d of %d bag slots free."] = "%d von %d Taschenplätzen frei.",
  ["Warning at %d free slots or fewer."] = "Warnung bei %d freien Plätzen oder weniger.",
  ["The counter is hidden."] = "Der Zähler ist ausgeblendet.",
  ["The counter is locked."] = "Der Zähler ist gesperrt.", ["The counter is unlocked."] = "Der Zähler ist entsperrt.",
  ["The counter is hidden. Warnings stay on. /bl show brings it back."] =
    "Der Zähler ist ausgeblendet. Die Warnungen bleiben an. /bl show holt ihn zurück.",
  ["The counter is shown."] = "Der Zähler ist eingeblendet.",
  ["The threshold must be a whole number from 0 to %d."] = "Die Schwelle muss eine ganze Zahl von 0 bis %d sein.",
  ["Click to switch between the total and one line per bag type."] =
    "Klicken, um zwischen der Summe und einer Zeile pro Taschenart zu wechseln.",
  ["Locked. Type /bl lock to move it."] = "Gesperrt. Gib /bl lock ein, um ihn zu verschieben.",
  ["Drag to move it."] = "Zum Verschieben ziehen.",
  ["Commands: /bl threshold <0-50>, /bl view total or split, /bl lock, /bl hide, /bl show, /bl sound on or off, /bl sound followed by a sound name or none, /bl warn once or always, /bl cheap lists the items worth the least."] =
    "Befehle: /bl threshold <0-50>, /bl view total oder split, /bl lock, /bl hide, /bl show, /bl sound on oder off, /bl sound mit einem Tonnamen oder none, /bl warn once oder always, /bl cheap zeigt die Gegenstände mit dem geringsten Wert.",
  -- 1.1: the split view by bag type
  ["View: one line per bag type."] = "Ansicht: eine Zeile pro Taschenart.",
  ["View: total."] = "Ansicht: Summe.",
  ["Use /bl view total or /bl view split."] = "Nutze /bl view total oder /bl view split.",
  ["Profession Bag"] = "Berufstasche",
  -- 1.2: the warning sound and how often to warn
  ["%s or %s"] = "%s oder %s",
  ["Sound is off."] = "Der Warnton ist aus.", ["Sound is on: %s."] = "Der Warnton ist an: %s.",
  ["Sounds: %s. /bl sound followed by a name picks it and plays it once, /bl sound none is silent."] =
    "Töne: %s. /bl sound mit einem Namen wählt ihn und spielt ihn einmal ab, /bl sound none ist stumm.",
  ["Warns once per session."] = "Warnt einmal pro Sitzung.",
  ["Warns every time the bags fill up again."] = "Warnt jedes Mal, wenn sich die Taschen wieder füllen.",
  ["Use /bl warn once or /bl warn always."] = "Nutze /bl warn once oder /bl warn always.",
  -- 1.3: the cheapest items
  ["item %d"] = "Gegenstand %d",
  ["Cheapest: %s (%s)"] = "Am wenigsten wert: %s (%s)",
  ["Lowest vendor value per slot (grey, white and green items, whole stack):"] =
    "Geringster Händlerwert pro Platz (graue, weiße und grüne Gegenstände, ganzer Stapel):",
  ["No grey, white or green item with a vendor price in your bags."] =
    "Kein grauer, weißer oder grüner Gegenstand mit Händlerpreis in deinen Taschen.",
  ["1 item is not loaded by the game yet and was skipped. Try again in a moment."] =
    "1 Gegenstand ist vom Spiel noch nicht geladen und wurde übersprungen. Versuch es gleich noch einmal.",
  ["%d items are not loaded by the game yet and were skipped. Try again in a moment."] =
    "%d Gegenstände sind vom Spiel noch nicht geladen und wurden übersprungen. Versuch es gleich noch einmal.",
}

local own = GetLocale and T[GetLocale()]
if own then
  for key, text in pairs(own) do rawset(L, key, text) end
end
