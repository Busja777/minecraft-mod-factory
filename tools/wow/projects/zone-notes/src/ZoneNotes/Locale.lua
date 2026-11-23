local _, ns = ...

-- English text is the key itself; other languages override single keys.
--
-- Terms the game already has in the player's language come from the client itself, not from this file:
--   zone names: C_Map.GetMapInfo and GetRealZoneText, in the client's language at the time the zone
--   was seen (a saved name follows the newest name the game gave).
-- No GlobalStrings constant is spliced into a sentence: the German sentence needs its own article
-- and case. Game terms inside sentences are written as the German client names them: Zone, Notiz
-- (note, as in LABEL_NOTE), Chat, Fenster (window).
-- Slash commands and their words stay English: players type them as they are (/zn add, /zn popup off,
-- /zn quiet on); only the hints in angle brackets are German (<Text>, <Nummer>).
local L = setmetatable({}, { __index = function(_, key) return key end })
ns.L = L

local T = {}

T.deDE = {
  ["Zone Notes"] = "Zone Notes",
  ["Unknown zone"] = "Unbekannte Zone", ["%d. %s"] = "%d. %s", ["%s: %d"] = "%s: %d",
  ["Your notes for %s:"] = "Deine Notizen für %s:",
  ["No notes for %s yet. Add one with /zn add <text>."] = "Noch keine Notizen für %s. Füge eine mit /zn add <Text> hinzu.",
  ["No notes for this zone yet. Add one with /zn add <text>."] =
    "Noch keine Notizen für diese Zone. Füge eine mit /zn add <Text> hinzu.",
  ["You have no notes yet. Add one with /zn add <text>."] = "Du hast noch keine Notizen. Füge eine mit /zn add <Text> hinzu.",
  ["The game does not tell which zone you are in right now. Try again in a moment."] =
    "Das Spiel verrät gerade nicht, in welcher Zone du bist. Versuch es gleich noch einmal.",
  ["This zone already has %d notes. Remove one with /zn remove <number> first."] =
    "Diese Zone hat schon %d Notizen. Lösche zuerst eine mit /zn remove <Nummer>.",
  ["Type the note after the command: /zn add <text>."] = "Schreib die Notiz hinter den Befehl: /zn add <Text>.",
  ["Note %d for %s saved."] = "Notiz %d für %s gespeichert.",
  ["Notes are kept to %d characters, the rest was cut."] = "Notizen haben höchstens %d Zeichen, der Rest wurde abgeschnitten.",
  ["Use /zn remove <number> with a number from 1 to %d, see /zn list."] =
    "Nutze /zn remove <Nummer> mit einer Zahl von 1 bis %d, siehe /zn list.",
  ["Removed: %s"] = "Gelöscht: %s",
  ["Zones with notes: %d"] = "Zonen mit Notizen: %d",
  ["Use /zn popup on or /zn popup off."] = "Nutze /zn popup on oder /zn popup off.",
  ["The notes window opens when you enter a zone with notes."] =
    "Das Notizfenster öffnet sich, wenn du eine Zone mit Notizen betrittst.",
  ["The notes window stays closed when you enter a zone."] = "Das Notizfenster bleibt geschlossen, wenn du eine Zone betrittst.",
  ["Use /zn quiet on or /zn quiet off."] = "Nutze /zn quiet on oder /zn quiet off.",
  ["No chat lines when you enter a zone."] = "Keine Chatzeilen, wenn du eine Zone betrittst.",
  ["Your notes show in chat when you enter a zone."] = "Deine Notizen erscheinen im Chat, wenn du eine Zone betrittst.",
  ["/zn add <text> notes something for this zone, /zn list shows its notes, /zn remove <number> deletes one, /zn all lists every zone with notes, /zn window opens the notes window, /zn popup on or off switches the window on arrival, /zn quiet on or off switches the chat lines on arrival."] =
    "/zn add <Text> notiert etwas für diese Zone, /zn list zeigt ihre Notizen, /zn remove <Nummer> löscht eine, /zn all zeigt alle Zonen mit Notizen, /zn window öffnet das Notizfenster, /zn popup on oder off schaltet das Fenster beim Betreten einer Zone ein oder aus, /zn quiet on oder off schaltet die Chatzeilen beim Betreten aus oder ein.",
}

local own = GetLocale and T[GetLocale()]
if own then
  for key, text in pairs(own) do rawset(L, key, text) end
end
