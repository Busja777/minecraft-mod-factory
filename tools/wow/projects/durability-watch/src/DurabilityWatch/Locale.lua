local _, ns = ...

-- English text is the key itself; other languages override single keys.
--
-- Terms the game already has in the player's language come from the client's own GlobalStrings,
-- not from this file (each with the English name as fallback for a client without it):
--   slot names (Core.lua ns.SLOT_NAME): HEADSLOT, NECKSLOT, SHOULDERSLOT, CHESTSLOT, WAISTSLOT,
--   LEGSSLOT, FEETSLOT, WRISTSLOT, HANDSSLOT, FINGER0SLOT/FINGER1SLOT (+ " 1"/" 2"),
--   TRINKET0SLOT/TRINKET1SLOT (+ " 1"/" 2"), BACKSLOT, MAINHANDSLOT, SECONDARYHANDSLOT, RANGEDSLOT.
--   Gold amounts: GetMoneyString, the client's own coin display.
-- Game terms inside sentences are written here as the German client names them: Händler (vendor),
-- Haltbarkeit (durability), Gildenbank (guild bank), Dungeon, Schlachtzug (raid).
-- Slash commands and their words stay English: players type them as they are.
local L = setmetatable({}, { __index = function(_, key) return key end })
ns.L = L

local T = {}

T.deDE = {
  ["Durability Watch"] = "Durability Watch",
  ["Gear"] = "Ausrüstung", ["No damage"] = "Kein Schaden", ["Nothing to wear out"] = "Nichts nutzt sich ab", ["Other"] = "Sonstiges",
  ["Nothing is damaged."] = "Nichts ist beschädigt.",
  ["Drag to move. /dw lock locks it."] = "Zum Verschieben ziehen. /dw lock sperrt die Anzeige.",
  ["Locked. /dw lock unlocks it."] = "Gesperrt. /dw lock entsperrt die Anzeige.",
  ["Warning at %d%%."] = "Warnung bei %d%%.",
  ["%s is at %d%% durability"] = "%s hat nur noch %d%% Haltbarkeit",
  ["%s is at %d%% durability. Time to repair."] = "%s hat nur noch %d%% Haltbarkeit. Zeit für eine Reparatur.",
  ["Nothing you wear has durability."] = "Nichts, was du trägst, hat Haltbarkeit.",
  ["Gear %d%%, nothing damaged."] = "Ausrüstung %d%%, nichts beschädigt.",
  ["Gear %d%%, lowest %s %d%%."] = "Ausrüstung %d%%, am stärksten abgenutzt: %s %d%%.",
  ["The display is hidden."] = "Die Anzeige ist ausgeblendet.",
  ["The display is locked."] = "Die Anzeige ist gesperrt.",
  ["The display can be dragged."] = "Die Anzeige lässt sich verschieben.",
  ["The display is hidden. /dw show brings it back."] = "Die Anzeige ist ausgeblendet. /dw show holt sie zurück.",
  ["The display is shown."] = "Die Anzeige ist eingeblendet.",
  ["Use a whole number from %d to %d, for example /dw warn 30."] = "Nutze eine ganze Zahl von %d bis %d, zum Beispiel /dw warn 30.",
  ["/dw warn <percent> sets the warning level (5 to 90), /dw lock locks or unlocks the display, /dw hide and /dw show hide or show it."] =
    "/dw warn <Prozent> legt die Warnschwelle fest (5 bis 90), /dw lock sperrt oder entsperrt die Anzeige, /dw hide und /dw show blenden sie aus oder ein.",
  -- 1.1: the warning before dungeons and raids
  ["No warning before dungeons and raids."] = "Keine Warnung vor Dungeons und Schlachtzügen.",
  ["Warning before dungeons and raids at %d%%."] = "Warnung vor Dungeons und Schlachtzügen bei %d%%.",
  ["Use /dw instance on, /dw instance off or a whole number from %d to %d, for example /dw instance 40."] =
    "Nutze /dw instance on, /dw instance off oder eine ganze Zahl von %d bis %d, zum Beispiel /dw instance 40.",
  ["/dw instance <percent> warns you before dungeons and raids when an item is at or below it, /dw instance off switches that off."] =
    "/dw instance <Prozent> warnt dich vor Dungeons und Schlachtzügen, wenn ein Gegenstand bei diesem Wert oder darunter ist, /dw instance off schaltet das aus.",
  ["Repair first: %s is at %d%% durability"] = "Erst reparieren: %s hat nur noch %d%% Haltbarkeit",
  ["You are entering %s with %s at %d%% durability. Repair first."] = "Du betrittst %s, aber %s hat nur noch %d%% Haltbarkeit. Repariere vorher.",
  ["You are entering a raid with %s at %d%% durability. Repair first."] = "Du betrittst einen Schlachtzug, aber %s hat nur noch %d%% Haltbarkeit. Repariere vorher.",
  ["You are entering a dungeon with %s at %d%% durability. Repair first."] = "Du betrittst einen Dungeon, aber %s hat nur noch %d%% Haltbarkeit. Repariere vorher.",
  -- 1.2: the repair cost history
  ["Repairing all your gear here costs %s."] = "Deine ganze Ausrüstung hier zu reparieren kostet %s.",
  ["%b %d %H:%M"] = "%d.%m. %H:%M", ["%s: %s, %s."] = "%s: %s, %s.",
  ["repaired with guild money"] = "mit Gold aus der Gildenbank repariert", ["repaired with your gold"] = "mit deinem Gold repariert",
  ["not repaired"] = "nicht repariert",
  ["No repairs in the last 7 days."] = "Keine Reparaturen in den letzten 7 Tagen.",
  ["Repairs in the last 7 days: %s."] = "Reparaturen in den letzten 7 Tagen: %s.",
  ["Repairs in the last 7 days: %s (%s from the guild)."] = "Reparaturen in den letzten 7 Tagen: %s (davon %s von der Gilde).",
  ["/dw history lists your last repair costs."] = "/dw history zeigt deine letzten Reparaturkosten.",
  ["The repair cost history of this character is empty now."] = "Der Reparaturverlauf dieses Charakters ist jetzt leer.",
  ["Use /dw history to list your repair costs, /dw history clear to empty the list."] =
    "Mit /dw history siehst du deine Reparaturkosten, mit /dw history clear leerst du die Liste.",
  ["No repair costs noted yet. They are noted at a vendor who can repair while your gear is damaged."] =
    "Noch keine Reparaturkosten notiert. Sie werden bei einem Händler notiert, der reparieren kann, während deine Ausrüstung beschädigt ist.",
  ["Repair costs of your last %d vendor visits, newest first:"] = "Reparaturkosten deiner letzten %d Händlerbesuche, neueste zuerst:",
  ["/dw history lists the repair costs of your last 20 vendor visits, /dw history clear empties the list."] =
    "/dw history zeigt die Reparaturkosten deiner letzten 20 Händlerbesuche, /dw history clear leert die Liste.",
}

local own = GetLocale and T[GetLocale()]
if own then
  for key, text in pairs(own) do rawset(L, key, text) end
end
