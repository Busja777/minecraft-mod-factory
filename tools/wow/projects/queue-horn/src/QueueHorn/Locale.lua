local _, ns = ...

-- English text is the key itself; other languages override single keys.
--
-- Terms the game already has in the player's language come from the client's own GlobalStrings,
-- not from this file (each with the English name as fallback for a client without it):
--   alert names (Core.lua ns.KIND_NAME): DUNGEONS_BUTTON (Group Finder), QUEUED_STATUS_READY_CHECK_IN_PROGRESS
--   (Ready Check; READY_CHECK itself is only "Bereitschaft" in German), BATTLEGROUND and ARENA
--   (joined by "%s and %s"), PET_BATTLE_PVP_QUEUE (Pet Battle).
--   ENABLE_BGSOUND: the "Sound in Background" option in the /qh hint (Commands.lua).
-- Game terms inside sentences are written here as the German client names them: Bereitschaftscheck
-- (ready check), Schlachtfeld (battleground), Arena, Haustierkampf (pet battle).
-- Slash commands and their words stay English: players type them as they are (/qh lfg off,
-- /qh sound ready alarm, /qh flash pvp red), so the sound and colour names stay English too.
local L = setmetatable({}, { __index = function(_, key) return key end })
ns.L = L

local T = {}

T.deDE = {
  ["Queue Horn"] = "Queue Horn",
  ["%s and %s"] = "%s und %s",
  ["on"] = "an", ["off"] = "aus",
  ["Alerts: %s. Icon flash: %s."] = "Alarme: %s. Blinken des Spielsymbols: %s.",
  ["Your group is ready!"] = "Deine Gruppe ist bereit!",
  ["Ready check!"] = "Bereitschaftscheck!",
  ["Your battleground or arena is ready!"] = "Dein Schlachtfeld oder deine Arena ist bereit!",
  ["Your pet battle is ready!"] = "Dein Haustierkampf ist bereit!",
  ["Queue Horn test: this is how an alert looks."] = "Test von Queue Horn: So sieht ein Alarm aus.",
  ["%s is off in the game's sound options, so you hear nothing while tabbed out."] =
    "%s ist in den Audioeinstellungen des Spiels aus, deshalb hörst du nichts, solange das Spiel im Hintergrund läuft.",
  ["/qh shows this, /qh test plays the alert once. /qh lfg, ready, pvp or pet with on or off switches one alert, /qh flash on or off switches the icon flash."] =
    "/qh zeigt das hier, /qh test spielt den Alarm einmal ab. /qh lfg, ready, pvp oder pet mit on oder off schaltet einen Alarm an oder aus, /qh flash on oder off das Blinken des Spielsymbols.",
  -- 1.1: a sound for each alert
  ["Sounds: %s. Choices: %s."] = "Sounds: %s. Zur Auswahl: %s.",
  ["%s now plays %s."] = "%s spielt jetzt den Sound %s.",
  ["/qh sound lists the sounds, /qh sound lfg alarm picks one for an alert, /qh test lfg plays it."] =
    "/qh sound zeigt die Sounds, /qh sound lfg alarm wählt einen für einen Alarm, /qh test lfg spielt ihn ab.",
  -- 1.2: the screen flash
  ["Screen flash: %s. Choices: %s. Icon flash: %s."] = "Bildschirmblitz: %s. Zur Auswahl: %s. Blinken des Spielsymbols: %s.",
  ["%s: no screen flash."] = "%s: kein Bildschirmblitz.",
  ["%s now flashes the screen %s."] = "%s: Bildschirmblitz jetzt %s.",
  ["/qh flash lists the screen flash, /qh flash lfg red gives an alert a coloured flash at the screen edges (red, gold, blue, green or off)."] =
    "/qh flash zeigt die Bildschirmblitze, /qh flash lfg red gibt einem Alarm einen farbigen Blitz an den Bildschirmrändern (red, gold, blue, green oder off).",
}

local own = GetLocale and T[GetLocale()]
if own then
  for key, text in pairs(own) do rawset(L, key, text) end
end
