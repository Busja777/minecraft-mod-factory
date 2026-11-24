local _, ns = ...

-- English text is the key itself; other languages override single keys.
--
-- No GlobalStrings constant is spliced into a sentence or used as a label: every game term here sits
-- inside a sentence, and the German sentence needs its own article and case. They are written as the
-- German client's macro window names them: Makro/Makros (MACRO, MACROS), allgemeine Makros (the account
-- macros, GENERAL_MACROS "Allgemeine Makros"), Charaktermakros (the tab CHARACTER_SPECIFIC_MACROS
-- "Makros von %s"), Symbol (icon, CHANGE_MACRO_NAME_ICON "Name/Symbol ändern"), Zeichen (characters,
-- MACRO_POPUP_TEXT), Kampf (COMBAT). The button "Makros erstellen" reads like the game's CREATE_MACROS.
-- Dates are written the German way: 20.11.2026 18:00.
-- Slash commands and their words stay English: players type them as they are (/macroshelf import,
-- /mshelf backup). The words of the export text stay English too, in every language, so an export
-- from a German client imports on an English one and back: [macro], [end], account, character and
-- the > in front of each macro line. Only the comment line at the top (# ...) is German.
local L = setmetatable({}, { __index = function(_, key) return key end })
ns.L = L

local T = {}

T.deDE = {
  ["Macro Shelf"] = "Macro Shelf",
  -- the window
  ["Export"] = "Exportieren", ["Import"] = "Importieren", ["Back up"] = "Sichern", ["Restore"] = "Wiederherstellen",
  ["Create macros"] = "Makros erstellen",
  ["Press Ctrl+C (Cmd+C on a Mac) to copy, then paste it into Import on another character."] =
    "Kopiere mit Strg+C (Mac: Cmd+C) und füge es bei einem anderen Charakter unter Importieren ein.",
  ["You have no macros to export yet."] = "Du hast noch keine Makros zum Exportieren.",
  ["Paste an export here and press Create macros. Existing macros are never changed."] =
    "Füge hier einen Export ein und klicke auf Makros erstellen. Vorhandene Makros bleiben unverändert.",
  -- backup and restore
  ["Saved %d account macros."] = "Allgemeine Makros gesichert: %d.",
  ["Saved %d character macros."] = "Charaktermakros gesichert: %d.",
  ["No account macros found right now, the older backup of %d was kept."] =
    "Gerade keine allgemeinen Makros gefunden, die ältere Sicherung mit %d bleibt erhalten.",
  ["No character macros found right now, the older backup of %d was kept."] =
    "Gerade keine Charaktermakros gefunden, die ältere Sicherung mit %d bleibt erhalten.",
  ["Backup: %s, %s."] = "Sicherung: %s, %s.",
  ["no account backup"] = "keine Sicherung der allgemeinen Makros",
  ["no character backup"] = "keine Sicherung der Charaktermakros",
  ["%d account macros from %s"] = "allgemeine Makros (%d) vom %s",
  ["%d character macros from %s"] = "Charaktermakros (%d) vom %s",
  ["%Y-%m-%d %H:%M"] = "%d.%m.%Y %H:%M",
  ["There is no backup yet. Type /macroshelf backup first."] =
    "Es gibt noch keine Sicherung. Gib zuerst /macroshelf backup ein.",
  ["Macros cannot be created in combat. Try again after the fight."] =
    "Im Kampf lassen sich keine Makros erstellen. Versuch es nach dem Kampf noch einmal.",
  ["This game client does not let addons create macros."] = "Dieser Spielclient lässt Addons keine Makros erstellen.",
  -- what an import or a restore did
  ["Created 1 macro."] = "1 Makro erstellt.", ["Created %d macros."] = "%d Makros erstellt.",
  ["Already there: %s."] = "Schon vorhanden: %s.",
  ["Skipped, a different macro with this name exists (rename one to keep both): %s."] =
    "Übersprungen, es gibt schon ein anderes Makro mit diesem Namen (benenne eins um, um beide zu behalten): %s.",
  ["No free macro slot left for: %s."] = "Kein freier Makroplatz mehr für: %s.",
  ["Not valid: %s (%s)."] = "Ungültig: %s (%s).",
  ["The game refused: %s."] = "Das Spiel hat abgelehnt: %s.",
  ["and %d more"] = "und %d weitere",
  ["Nothing was imported:"] = "Nichts wurde importiert:",
  -- the export text and its mistakes
  ["# Macro Shelf export, %d macros. Paste it into /macroshelf import."] =
    "# Macro-Shelf-Export, %d Makros. Füge ihn mit /macroshelf import ein.",
  ["There is no text to read."] = "Es gibt keinen Text zum Lesen.",
  ["The text holds no macros."] = "Der Text enthält keine Makros.",
  ["Line %d: %s."] = "Zeile %d: %s.",
  ["write \\! instead of |"] = "schreib \\! statt |",
  ["a \\ must be followed by \\ or !"] = "auf ein \\ muss \\ oder ! folgen",
  ["not a macro"] = "kein Makro",
  ["the place must be account or character"] = "der Ort muss account oder character sein",
  ["the name is empty"] = "der Name ist leer",
  ["the name has a line break"] = "der Name hat einen Zeilenumbruch",
  ["the name is longer than %d characters"] = "der Name ist länger als %d Zeichen",
  ["the macro text is missing"] = "der Makrotext fehlt",
  ["the macro text has a stray line break"] = "der Makrotext hat einen überzähligen Zeilenumbruch",
  ["the macro text is longer than %d characters"] = "der Makrotext ist länger als %d Zeichen",
  ["the icon is not valid"] = "das Symbol ist ungültig",
  ["every line of a macro starts with >, and [end] closes the macro"] =
    "jede Zeile eines Makros beginnt mit >, und [end] schließt das Makro ab",
  ["a macro starts with [macro], the place, the icon and the name"] =
    "ein Makro beginnt mit [macro], dem Ort, dem Symbol und dem Namen",
  ["this line is not part of a macro"] = "diese Zeile gehört zu keinem Makro",
  ["the macro is not closed with [end]"] = "das Makro wird nicht mit [end] abgeschlossen",
  -- help
  ["/macroshelf opens the window, /macroshelf export shows your macros as text, /macroshelf import opens the paste box, /macroshelf backup saves your macros, /macroshelf restore creates the missing ones from the backup. Short form: /mshelf."] =
    "/macroshelf öffnet das Fenster, /macroshelf export zeigt deine Makros als Text, /macroshelf import öffnet das Feld zum Einfügen, /macroshelf backup sichert deine Makros, /macroshelf restore erstellt die fehlenden aus der Sicherung. Kurzform: /mshelf.",
}

local own = GetLocale and T[GetLocale()]
if own then
  for key, text in pairs(own) do rawset(L, key, text) end
end
