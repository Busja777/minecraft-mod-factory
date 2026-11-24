local _, ns = ...

-- English text is the key itself; other languages override single keys.
--
-- Terms the game already has in the player's language come from the client itself, not from this file:
--   the loot lines in chat are read with the client's own GlobalStrings (Core.lua ns.SELF_LOOT and
--   ns.OTHER_LOOT: LOOT_ITEM_SELF, LOOT_ITEM and their kin, since 1.0), so a German client's
--   "Ihr erhaltet Beute: %s" is understood as well. Item names and links come from the game.
-- No GlobalStrings constant is spliced into a sentence: every game term here sits inside one, and the
-- German sentence needs its own article and case. They are written as the German client names them:
-- Beute (LOOT), Händler (MERCHANT), Gegenstand (item, ITEMS "Gegenstände"), gewürfelt (ROLL "Würfeln"),
-- umschalt-klicken (shift-click), Chateingabe (the chat line), Wunschliste (wish list).
-- Slash commands and their words stay English: players type them as they are (/lw add, /lw sound off);
-- only the hints in angle brackets are German (<Gegenstand>, <Gegenstand oder Nummer>).
local L = setmetatable({}, { __index = function(_, key) return key end })
ns.L = L

local T = {}

T.deDE = {
  ["Loot Wishes"] = "Loot Wishes",
  ["item %d"] = "Gegenstand %d", ["%d. %s (ID %d)"] = "%d. %s (ID %d)",
  ["%s is in this loot."] = "%s ist in dieser Beute.",
  ["%s is up for a roll."] = "Um %s wird gewürfelt.",
  ["You got %s."] = "Du hast %s bekommen.",
  ["%s got %s."] = "%s hat %s bekommen.",
  ["This merchant sells %s."] = "Dieser Händler verkauft %s.",
  ["just now"] = "gerade eben",
  ["1 day ago"] = "vor 1 Tag", ["%d days ago"] = "vor %d Tagen",
  ["1 hour ago"] = "vor 1 Stunde", ["%d hours ago"] = "vor %d Stunden",
  [" - seen once, %s"] = " - einmal gesehen, %s",
  [" - seen %d times, last %s"] = " - %d-mal gesehen, zuletzt %s",
  [" - not seen yet"] = " - noch nicht gesehen",
  [", you got it"] = ", du hast ihn bekommen",
  ["There is no item with the ID %d, it was not added."] =
    "Es gibt keinen Gegenstand mit der ID %d, er wurde nicht hinzugefügt.",
  ["Added to your wish list: %s"] = "Auf deine Wunschliste gesetzt: %s",
  ["On your wish list"] = "Auf deiner Wunschliste",
  ["/lw add <item> puts an item on your wish list (shift-click the item into the chat line, or type its item ID), /lw remove <item or number> takes it off, /lw list shows the list, /lw sound on or off switches the alert sound."] =
    "/lw add <Gegenstand> setzt einen Gegenstand auf deine Wunschliste (umschalt-klicke ihn in die Chateingabe oder gib seine Gegenstands-ID ein), /lw remove <Gegenstand oder Nummer> nimmt ihn herunter, /lw list zeigt die Liste, /lw sound on oder off schaltet den Alarmton ein oder aus.",
  ["Shift-click an item into the chat line after /lw add, or type its item ID: /lw add 19019."] =
    "Umschalt-klicke einen Gegenstand hinter /lw add in die Chateingabe oder gib seine Gegenstands-ID ein: /lw add 19019.",
  ["Your wish list is full (%d items). Remove one with /lw remove first."] =
    "Deine Wunschliste ist voll (%d Gegenstände). Nimm zuerst einen mit /lw remove herunter.",
  ["%s is already on your wish list."] = "%s steht schon auf deiner Wunschliste.",
  ["That item is not on your wish list. See /lw list for the numbers."] =
    "Dieser Gegenstand steht nicht auf deiner Wunschliste. Die Nummern zeigt /lw list.",
  ["Removed from your wish list: %s"] = "Von deiner Wunschliste genommen: %s",
  ["Your wish list is empty. Add an item with /lw add and shift-click it into the chat line."] =
    "Deine Wunschliste ist leer. Füge einen Gegenstand mit /lw add hinzu und umschalt-klicke ihn in die Chateingabe.",
  ["Your wish list (%d items):"] = "Deine Wunschliste (%d Gegenstände):",
  ["An alert sound plays when a wished item shows up."] =
    "Ein Alarmton erklingt, wenn ein gewünschter Gegenstand auftaucht.",
  ["No sound, only the chat line."] = "Kein Ton, nur die Zeile im Chat.",
  ["Use /lw sound on or /lw sound off."] = "Nutze /lw sound on oder /lw sound off.",
}

local own = GetLocale and T[GetLocale()]
if own then
  for key, text in pairs(own) do rawset(L, key, text) end
end
