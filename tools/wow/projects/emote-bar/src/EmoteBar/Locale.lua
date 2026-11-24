local _, ns = ...

-- English text is the key itself; other languages override single keys.
--
-- Terms the game already has in the player's language come from the client itself, not from this file:
--   the emotes on the buttons, in the tooltip and in every chat line are the client's own chat commands
--   (Core.lua ns.BuildIndex: EMOTE<i>_CMD<j>, since 1.0), so a German client shows /winken, /hallo,
--   /danken and still accepts the English /wave, /hello, /thank.
-- No GlobalStrings constant is spliced into a sentence or used as a label: every game term here sits
-- inside a sentence, and the German sentence needs its own article and case. They are written as the
-- German client names them: Emote/Emotes (EMOTE "Emote"), sperren/entsperren (LOCK "Sperren",
-- UNLOCK_FRAME "Fenster entsperren"), Ziel (TARGET), Leiste (BINDING_HEADER_ACTIONBAR "Aktionsleiste"),
-- Schaltfläche (button), Chatbefehl (chat command), einblenden/ausblenden (show/hide).
-- Slash commands and their words stay English: players type them as they are (/emotebar add,
-- /emotebar remove, /emotebar list, /emotebar lock, /eb); only the hints in angle brackets are German
-- (<Emote>, <Emote oder Nummer>). The emote in the examples is the German client's own command (winken).
local L = setmetatable({}, { __index = function(_, key) return key end })
ns.L = L

local T = {}

T.deDE = {
  ["Emote Bar"] = "Emote Bar",
  -- the buttons and the bar
  ["Click to use this emote on your target."] = "Klicken, um dieses Emote bei deinem Ziel auszuführen.",
  ["Drag to move. /emotebar lock locks it."] = "Zum Verschieben ziehen. /emotebar lock sperrt die Leiste.",
  ["Locked. /emotebar lock unlocks it."] = "Gesperrt. /emotebar lock entsperrt die Leiste.",
  ["Add an emote with /emotebar add wave."] = "Füge ein Emote mit /emotebar add winken hinzu.",
  ["The game did not run %s right now."] = "Das Spiel hat %s gerade nicht ausgeführt.",
  -- add
  ["Name the emote, for example /emotebar add wave."] = "Nenne das Emote, zum Beispiel /emotebar add winken.",
  ["The game's emote list could not be read, so no emote can be added right now."] =
    "Die Emote-Liste des Spiels ließ sich nicht lesen, darum kann gerade kein Emote hinzugefügt werden.",
  ["%s is not an emote of the game. Use its chat command, for example /emotebar add wave."] =
    "%s ist kein Emote des Spiels. Nimm seinen Chatbefehl, zum Beispiel /emotebar add winken.",
  ["The bar is full with %d emotes. Remove one first with /emotebar remove <emote or number>."] =
    "Die Leiste ist mit %d Emotes voll. Entferne zuerst eins mit /emotebar remove <Emote oder Nummer>.",
  ["%s is on the bar already, as button %d."] = "%s ist schon auf der Leiste, als Schaltfläche %d.",
  ["%s added as button %d."] = "%s als Schaltfläche %d hinzugefügt.",
  -- remove
  ["Name the emote or its button number, for example /emotebar remove wave or /emotebar remove 2."] =
    "Nenne das Emote oder die Nummer seiner Schaltfläche, zum Beispiel /emotebar remove winken oder /emotebar remove 2.",
  ["%s removed."] = "%s entfernt.",
  ["There is no button %d. The bar has %d."] = "Es gibt keine Schaltfläche %d. Die Leiste hat %d.",
  ["%s is not on the bar."] = "%s ist nicht auf der Leiste.",
  ["%s is not an emote of the game."] = "%s ist kein Emote des Spiels.",
  -- list, show, hide and lock
  ["The bar is empty. Add an emote with /emotebar add wave."] = "Die Leiste ist leer. Füge ein Emote mit /emotebar add winken hinzu.",
  ["On the bar: %s."] = "Auf der Leiste: %s.",
  ["The bar is hidden. /emotebar shows it again."] = "Die Leiste ist ausgeblendet. /emotebar blendet sie wieder ein.",
  ["The bar is shown."] = "Die Leiste ist eingeblendet.",
  ["The bar is locked."] = "Die Leiste ist gesperrt.",
  ["The bar can be dragged."] = "Die Leiste lässt sich verschieben.",
  -- help
  ["/emotebar shows or hides the bar, /emotebar add <emote> adds a button (for example /emotebar add wave), /emotebar remove <emote or number> removes one, /emotebar list lists them, /emotebar lock locks or unlocks the bar. Short form: /eb."] =
    "/emotebar blendet die Leiste ein oder aus, /emotebar add <Emote> fügt eine Schaltfläche hinzu (zum Beispiel /emotebar add winken), /emotebar remove <Emote oder Nummer> entfernt eine, /emotebar list zeigt alle, /emotebar lock sperrt oder entsperrt die Leiste. Kurzform: /eb.",
}

local own = GetLocale and T[GetLocale()]
if own then
  for key, text in pairs(own) do rawset(L, key, text) end
end
