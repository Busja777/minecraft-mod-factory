local _, ns = ...

-- English text is the key itself; other languages override single keys.
--
-- Terms the game already has in the player's language come from the client's own GlobalStrings,
-- not from this file (Core.lua ns.TOGGLES, each with the English name as fallback for a client
-- without it): the names of the three sound options exactly as the game's sound settings show them,
-- ENABLE_ERROR_SPEECH (Error Speech), ENABLE_EMOTE_SOUNDS (Emote Sounds), ENABLE_PET_SOUNDS
-- (Enable Pet Sounds). In German sentences such a name stands in quotes („%s“), so the sentence
-- needs no article or case for it.
-- Other game terms inside sentences are written as the German client names them: Sound/Sounds
-- (SOUND, "Emote-Sounds"), stummschalten (mute, ADD_MUTE_LABEL), Client.
-- Slash commands and their words stay English: players type them as they are (/quiet add 12345,
-- /quiet off, /quiet pets on); only the word for the label text in the help is German (Text).
local L = setmetatable({}, { __index = function(_, key) return key end })
ns.L = L

local T = {}

T.deDE = {
  ["Quiet Please"] = "Quiet Please",
  ["%s: %s"] = "%s: %s", ["on"] = "an", ["off"] = "aus",
  ["%d sound files on your list, switched off (/quiet on mutes them again)."] =
    "%d Sounddateien auf deiner Liste, ausgeschaltet (/quiet on schaltet sie wieder stumm).",
  ["%d sound files on your list, muted."] = "%d Sounddateien auf deiner Liste, stummgeschaltet.",
  ["/quiet add 12345 67890 mutes sound files by their file ID, /quiet remove 12345 unmutes them, /quiet list shows your list, /quiet label 12345 text names a file, /quiet play 12345 plays a file once, /quiet off unmutes all, /quiet on mutes them again, /quiet errors, /quiet emotes and /quiet pets switch those sounds on or off."] =
    "/quiet add 12345 67890 schaltet Sounddateien über ihre Datei-ID stumm, /quiet remove 12345 macht sie wieder hörbar, /quiet list zeigt deine Liste, /quiet label 12345 Text benennt eine Datei, /quiet play 12345 spielt eine Datei einmal ab, /quiet off macht alle wieder hörbar, /quiet on schaltet sie wieder stumm, /quiet errors, /quiet emotes und /quiet pets schalten diese Sounds ein oder aus.",
  ["Not a sound file ID: %s. File IDs are whole numbers above 0."] =
    "Keine Sounddatei-ID: %s. Datei-IDs sind ganze Zahlen über 0.",
  ["Muted: %s."] = "Stummgeschaltet: %s.",
  ["Added: %s. They are muted when you type /quiet on."] =
    "Hinzugefügt: %s. Sie werden stummgeschaltet, sobald du /quiet on eingibst.",
  ["Already on your list: %s."] = "Schon auf deiner Liste: %s.",
  ["This client cannot mute sound files, the list is only saved."] =
    "Dieser Client kann keine Sounddateien stummschalten, die Liste wird nur gespeichert.",
  ["Removed and unmuted: %s."] = "Entfernt und wieder hörbar: %s.",
  ["Not on your list: %s."] = "Nicht auf deiner Liste: %s.",
  ["Your list is empty. Add a sound file with /quiet add followed by its file ID."] =
    "Deine Liste ist leer. Füge eine Sounddatei mit /quiet add und ihrer Datei-ID hinzu.",
  ["%d is now labelled: %s"] = "%d trägt jetzt die Bezeichnung: %s",
  ["Label of %d removed."] = "Bezeichnung von %d entfernt.",
  ["%d is muted. Use /quiet remove to hear it again."] = "%d ist stummgeschaltet. Mit /quiet remove hörst du sie wieder.",
  ["Playing %d."] = "Spiele %d ab.",
  ["The game could not play %d. It may be muted, or not a sound file."] =
    "Das Spiel konnte %d nicht abspielen. Vielleicht ist die Datei stummgeschaltet oder keine Sounddatei.",
  ["Your list is already muted."] = "Deine Liste ist schon stummgeschaltet.",
  ["Your list is already switched off."] = "Deine Liste ist schon ausgeschaltet.",
  ["Muted %d sound files again."] = "%d Sounddateien wieder stummgeschaltet.",
  ["All sound files on your list can be heard again until you type /quiet on."] =
    "Alle Sounddateien auf deiner Liste sind wieder hörbar, bis du /quiet on eingibst.",
  ["%s cannot be switched on this client."] = "„%s“ lässt sich auf diesem Client nicht umschalten.",
  ["%s could not be changed right now."] = "„%s“ ließ sich gerade nicht ändern.",
}

local own = GetLocale and T[GetLocale()]
if own then
  for key, text in pairs(own) do rawset(L, key, text) end
end
