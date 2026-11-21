local _, ns = ...

-- English text is the key itself; other languages override single keys.
--
-- Terms the game already has in the player's language come from the client itself:
--   Gold amounts: GetMoneyString, the client's own coin display. Item names: the game's item data.
-- No GlobalStrings constant is spliced into a sentence: every game term here sits inside one, and the
-- German sentence needs its own article and case. They are written as the German client names them:
-- Händler (vendor), Bank, Taschen (bags), Gegenstand (item).
-- Slash commands and their words stay English: players type them as they are (/vr bank on).
local L = setmetatable({}, { __index = function(_, key) return key end })
ns.L = L

local T = {}

T.deDE = {
  ["Vendor Refill"] = "Vendor Refill",
  ["item %d"] = "Gegenstand %d",
  ["Bought %s."] = "Gekauft: %s.", ["Bought %s for %s."] = "Gekauft: %s für %s.",
  ["Not enough gold for everything, still missing: %s."] = "Nicht genug Gold für alles, es fehlen noch: %s.",
  ["Refilling is on."] = "Auffüllen ist an.", ["Refilling is off."] = "Auffüllen ist aus.",
  ["Your list is empty."] = "Deine Liste ist leer.", ["1 item is on your list."] = "1 Gegenstand steht auf deiner Liste.",
  ["%d items are on your list."] = "%d Gegenstände stehen auf deiner Liste.",
  ["The count must be a whole number from 1 to %d."] = "Die Anzahl muss eine ganze Zahl von 1 bis %d sein.",
  ["Use /vr add <item link or item ID> <count>."] = "Nutze /vr add <Gegenstandslink oder Gegenstands-ID> <Anzahl>.",
  ["%s: keeping %d in your bags."] = "%s: %d Stück bleiben in deinen Taschen vorrätig.",
  ["Use /vr remove <item link or item ID>."] = "Nutze /vr remove <Gegenstandslink oder Gegenstands-ID>.",
  ["%s is not on your list."] = "%s steht nicht auf deiner Liste.", ["%s is off your list."] = "%s ist nicht mehr auf deiner Liste.",
  ["Your list is empty. Add an item with /vr add <item> <count>."] = "Deine Liste ist leer. Füge einen Gegenstand mit /vr add <Gegenstand> <Anzahl> hinzu.",
  ["Your list:"] = "Deine Liste:",
  -- 1.1: the low stock warning
  ["%s is running low: %d of %d left."] = "%s wird knapp: noch %d von %d.",
  ["The low stock warning is off."] = "Die Warnung bei knappem Vorrat ist aus.",
  ["Low stock warning below %d%% of your count."] = "Warnung bei knappem Vorrat unter %d%% deiner Anzahl.",
  ["The warning must be a whole percent from 1 to %d, or off."] = "Die Warnung muss eine ganze Prozentzahl von 1 bis %d sein, oder off.",
  -- 1.2: refilling from the bank
  ["Taken from the bank: %s."] = "Aus der Bank genommen: %s.",
  ["Your bags are full, the rest stays in the bank."] = "Deine Taschen sind voll, der Rest bleibt in der Bank.",
  ["Taking items from the bank is on."] = "Auffüllen aus der Bank ist an.", ["Taking items from the bank is off."] = "Auffüllen aus der Bank ist aus.",
  ["Use /vr bank on or /vr bank off."] = "Nutze /vr bank on oder /vr bank off.",
  ["/vr add <item> <count> keeps an item stocked, /vr remove <item> takes it off, /vr list shows your list, /vr on and /vr off switch all refilling (vendor and bank), /vr bank on or /vr bank off switches only taking items from the bank, /vr warn <percent> or /vr warn off sets the low stock warning. Use an item link (Shift-click the item) or an item ID. Hold Shift while you open a vendor or the bank to skip one visit."] =
    "/vr add <Gegenstand> <Anzahl> hält einen Gegenstand vorrätig, /vr remove <Gegenstand> nimmt ihn von der Liste, /vr list zeigt deine Liste, /vr on und /vr off schalten das ganze Auffüllen an oder aus (Händler und Bank), /vr bank on oder /vr bank off schaltet nur das Auffüllen aus der Bank, /vr warn <Prozent> oder /vr warn off stellt die Warnung bei knappem Vorrat ein. Nutze einen Gegenstandslink (Shift-Klick auf den Gegenstand) oder eine Gegenstands-ID. Halte Shift gedrückt, während du einen Händler oder die Bank öffnest, um diesen Besuch auszulassen.",
}

local own = GetLocale and T[GetLocale()]
if own then
  for key, text in pairs(own) do rawset(L, key, text) end
end
