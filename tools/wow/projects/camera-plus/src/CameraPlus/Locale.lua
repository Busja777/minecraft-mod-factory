local _, ns = ...

-- English text is the key itself; other languages override single keys.
--
-- No GlobalStrings constant is spliced into a sentence: every game term here sits inside one, and the
-- German sentence needs its own article and case. They are written as the German client names them:
-- Max. Kameraentfernung / maximale Kameraentfernung (MAX_FOLLOW_DIST "Max. Kameraentfernung"; Retail's
-- own settings no longer show that slider, so the constant is not used as a label), Kamera
-- (CAMERA_LABEL), Optionen (the game's settings, SETTINGS), Kampf (COMBAT).
-- Factors keep the dot (2.6) in every language: they are what players type after /cplus far, which
-- takes 2,6 as well.
-- Slash commands and their words stay English: players type them as they are (/cplus far, /cplus off,
-- /cplus save 1, /cplus forget 1).
local L = setmetatable({}, { __index = function(_, key) return key end })
ns.L = L

local T = {}

T.deDE = {
  ["Camera Plus"] = "Camera Plus",
  ["Maximum camera distance is on (factor %s). Scroll out to use it."] =
    "Die maximale Kameraentfernung ist an (Faktor %s). Scrolle heraus, um sie zu nutzen.",
  ["Maximum camera distance is already off."] = "Die maximale Kameraentfernung ist schon aus.",
  ["Maximum camera distance is off. The game's value %s is back."] =
    "Die maximale Kameraentfernung ist aus. Der Wert des Spiels, %s, gilt wieder.",
  ["The camera distance was changed in the game's settings. Camera Plus is off and keeps that value."] =
    "Die Kameraentfernung wurde in den Optionen des Spiels geändert. Camera Plus ist aus und behält diesen Wert.",
  ["You are in combat. The camera changes when combat ends."] =
    "Du bist im Kampf. Die Kamera ändert sich, wenn der Kampf endet.",
  ["Combat is over, the camera change is done."] = "Der Kampf ist vorbei, die Kamera ist geändert.",
  ["A camera change waits for the end of combat."] = "Eine Kameraänderung wartet auf das Ende des Kampfes.",
  ["The game did not accept the change. Try again in a moment."] =
    "Das Spiel hat die Änderung nicht angenommen. Versuch es gleich noch einmal.",
  ["Use a number from %s to %s, for example /cplus far 2.2."] =
    "Nutze eine Zahl von %s bis %s, zum Beispiel /cplus far 2.2.",
  -- the status
  ["Maximum camera distance: on, factor %s."] = "Max. Kameraentfernung: an, Faktor %s.",
  ["Maximum camera distance: off, the game's value is %s."] = "Max. Kameraentfernung: aus, der Wert des Spiels ist %s.",
  ["Maximum camera distance: off."] = "Max. Kameraentfernung: aus.",
  ["Saved camera positions: %s."] = "Gespeicherte Kamerapositionen: %s.",
  ["Saved camera positions: none yet."] = "Gespeicherte Kamerapositionen: noch keine.",
  -- camera positions
  ["Choose a slot from 1 to 3, for example /cplus save 1."] = "Wähle einen Platz von 1 bis 3, zum Beispiel /cplus save 1.",
  ["Choose a slot from 1 to 3, for example /cplus 1."] = "Wähle einen Platz von 1 bis 3, zum Beispiel /cplus 1.",
  ["Choose a slot from 1 to 3, for example /cplus forget 1."] =
    "Wähle einen Platz von 1 bis 3, zum Beispiel /cplus forget 1.",
  ["Camera position %d saved. /cplus %d brings it back."] = "Kameraposition %d gespeichert. /cplus %d holt sie zurück.",
  ["Slot %d is empty. Save the current camera with /cplus save %d first."] =
    "Platz %d ist leer. Speichere zuerst die aktuelle Kamera mit /cplus save %d.",
  ["Slot %d is empty again."] = "Platz %d ist wieder leer.",
  ["This game version cannot save camera positions."] = "Diese Spielversion kann keine Kamerapositionen speichern.",
  ["This game version cannot load camera positions."] = "Diese Spielversion kann keine Kamerapositionen laden.",
  -- help
  ["/cplus far zooms out up to the game's limit (or /cplus far 2.2), /cplus off restores your old distance, /cplus save 1 saves the camera in slot 1 to 3, /cplus 1 brings it back, /cplus forget 1 empties a slot."] =
    "/cplus far zoomt bis zur Grenze des Spiels heraus (oder /cplus far 2.2), /cplus off stellt deine alte Entfernung wieder her, /cplus save 1 speichert die Kamera auf Platz 1 bis 3, /cplus 1 holt sie zurück, /cplus forget 1 leert einen Platz.",
}

local own = GetLocale and T[GetLocale()]
if own then
  for key, text in pairs(own) do rawset(L, key, text) end
end
