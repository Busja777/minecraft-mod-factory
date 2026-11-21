local _, ns = ...

-- English text is the key itself; other languages override single keys.
--
-- Terms the game already has in the player's language come from the client's own GlobalStrings,
-- not from this file (with the English name as fallback for a client without it):
--   BUYBACK: the name of the vendor's Buyback tab in /jb log (Commands.lua).
--   Gold amounts: GetMoneyString, the client's own coin display.
-- Game terms inside sentences are written here as the German client names them: Händler (vendor),
-- Plunder (junk), Gildenbank (guild bank), Gildenrang (guild rank). Item names come from the game.
-- Slash commands and their words stay English: players type them as they are (/jb keep, /jb log 1).
local L = setmetatable({}, { __index = function(_, key) return key end })
ns.L = L

local T = {}

T.deDE = {
  ["Junk Butler"] = "Junk Butler",
  ["Sold %d junk item for %s."] = "%d Stück Plunder für %s verkauft.",
  ["Sold %d junk items for %s."] = "%d Stück Plunder für %s verkauft.",
  ["Repaired your gear for %s."] = "Ausrüstung für %s repariert.",
  ["Not enough gold to repair your gear (%s)."] = "Nicht genug Gold, um deine Ausrüstung zu reparieren (%s).",
  ["Selling junk is on."] = "Plunder verkaufen ist an.", ["Selling junk is off."] = "Plunder verkaufen ist aus.",
  ["Repairing is on."] = "Reparieren ist an.", ["Repairing is off."] = "Reparieren ist aus.",
  ["/jb shows the settings, /jb sell and /jb repair switch each half on or off. Hold Shift while you open a vendor to skip one visit."] =
    "/jb zeigt die Einstellungen, /jb sell und /jb repair schalten das Verkaufen und das Reparieren einzeln an oder aus. Halte Shift gedrückt, während du einen Händler ansprichst, um diesen Besuch auszulassen.",
  -- 1.1: the keep list
  ["Kept %d item on your keep list."] = "Wegen deiner Behalteliste %d Gegenstand behalten.",
  ["Kept %d items on your keep list."] = "Wegen deiner Behalteliste %d Gegenstände behalten.",
  ["item %d"] = "Gegenstand %d",
  ["Your keep list is empty. Add a grey item with /jb keep and its link or item ID."] =
    "Deine Behalteliste ist leer. Füge einen grauen Gegenstand mit /jb keep und seinem Link oder seiner Gegenstands-ID hinzu.",
  ["Never sold (%d):"] = "Wird nie verkauft (%d):",
  ["Name the item after %s: shift-click it into the chat or type its item ID."] =
    "Nenne den Gegenstand nach %s: per Shift-Klick in den Chat oder mit seiner Gegenstands-ID.",
  ["%s is on your keep list and will never be sold."] = "%s steht auf deiner Behalteliste und wird nie verkauft.",
  ["%s is off your keep list."] = "%s ist nicht mehr auf deiner Behalteliste.",
  ["%s is not on your keep list."] = "%s steht nicht auf deiner Behalteliste.",
  ["/jb keep followed by an item link or ID never sells that item, /jb unkeep takes it off again, /jb keep alone lists your keep list."] =
    "/jb keep mit einem Gegenstandslink oder einer ID verkauft diesen Gegenstand nie, /jb unkeep nimmt ihn wieder herunter, /jb keep allein zeigt deine Behalteliste.",
  -- 1.2: guild bank repairs
  ["Repaired your gear for %s from the guild bank."] = "Ausrüstung für %s aus der Gildenbank repariert.",
  ["Guild bank repairs are on."] = "Reparieren aus der Gildenbank ist an.",
  ["Guild bank repairs are off."] = "Reparieren aus der Gildenbank ist aus.",
  ["/jb guild on lets the guild bank pay your repairs first when your guild rank allows it and the bank has the gold. /jb guild off pays from your own gold again."] =
    "/jb guild on lässt zuerst die Gildenbank deine Reparaturen bezahlen, wenn dein Gildenrang es erlaubt und die Bank genug Gold hat. /jb guild off zahlt wieder mit deinem eigenen Gold.",
  ["/jb guild on/off lets the guild bank pay your repairs first when your guild rank allows it."] =
    "/jb guild on/off lässt zuerst die Gildenbank deine Reparaturen bezahlen, wenn dein Gildenrang es erlaubt.",
  -- 1.3: the sale log
  ["%b %d %H:%M"] = "%d.%m. %H:%M",
  ["%d item for %s"] = "%d Gegenstand für %s", ["%d items for %s"] = "%d Gegenstände für %s",
  ["(less than a minute ago)"] = "(vor weniger als einer Minute)", ["(%d min ago)"] = "(vor %d Min.)",
  ["/jb log lists your last vendor visits, /jb log followed by a number shows what was sold in that visit, /jb log clear empties the log of this character."] =
    "/jb log zeigt deine letzten Händlerbesuche, /jb log mit einer Nummer zeigt, was bei diesem Besuch verkauft wurde, /jb log clear leert das Verkaufsprotokoll dieses Charakters.",
  ["No sales logged yet on this character. Every vendor visit that sells something is noted here."] =
    "Mit diesem Charakter wurde noch nichts verkauft. Jeder Händlerbesuch mit Verkäufen wird hier notiert.",
  ["Your last %d vendor visits with sales, newest first:"] = "Deine letzten %d Händlerbesuche mit Verkäufen, neueste zuerst:",
  ["Together: %d items for %s. /jb log followed by a number shows the items of that visit."] =
    "Zusammen: %d Gegenstände für %s. /jb log mit einer Nummer zeigt die Gegenstände dieses Besuchs.",
  ["Sales from the last 15 minutes are marked. The vendor's %s tab may still have them, but it keeps only your latest sold items and empties when you log out."] =
    "Verkäufe der letzten 15 Minuten sind markiert. Der Reiter „%s“ des Händlers hat sie vielleicht noch, er behält aber nur deine zuletzt verkauften Gegenstände und wird beim Ausloggen geleert.",
  ["There is no visit %d. /jb log lists visits 1 to %d."] = "Es gibt keinen Besuch %d. /jb log zeigt die Besuche 1 bis %d.",
  ["The sale log of this character is empty now."] = "Das Verkaufsprotokoll dieses Charakters ist jetzt leer.",
}

local own = GetLocale and T[GetLocale()]
if own then
  for key, text in pairs(own) do rawset(L, key, text) end
end
