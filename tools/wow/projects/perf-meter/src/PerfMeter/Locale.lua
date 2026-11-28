local _, ns = ...

-- English text is the key itself; other languages override single keys.
--
-- Terms the game already has in the player's language come from the client itself, not from this file
-- (ns.GameText / ns.GameFormat, each with the English text as fallback, since 1.0):
--   tooltip lines: MAINMENUBAR_FPS_LABEL ("Framerate: %.0f fps"), MAINMENUBAR_LATENCY_LABEL
--   ("Latency:\n%.0f ms (home)\n%.0f ms (world)"), TOTAL_MEM_MB_ABBR / TOTAL_MEM_KB_ABBR ("AddOn Memory: ..."),
--   ADDON_MEM_MB_ABBR / ADDON_MEM_KB_ABBR ("(%.2f MB) %s"), the same lines as the game's own performance tooltip.
--   on the meter: ADDONS ("AddOns"), MILLISECONDS_ABBR ("ms").
-- Numbers keep the decimal point of 1.0 (31.2 MB): the game's own memory lines above write it the same way,
-- so the meter and the tooltip never mix two styles.
-- No GlobalStrings constant is spliced into a sentence here: every game term sits inside a sentence with its
-- own German article and case. They are written as the German client names them: Anzeige (the meter),
-- sperren/entsperren (LOCK "Sperren", UNLOCK_FRAME "Fenster entsperren"), Kampf (COMBAT "Kampf"),
-- Speicher (memory), FPS (frames per second), einblenden/ausblenden (show/hide).
-- Slash commands and their words stay English: players type them as they are (/perfmeter lock,
-- /perfmeter unlock, /perfmeter reset, /pm).
local L = setmetatable({}, { __index = function(_, key) return key end })
ns.L = L

local T = {}

T.deDE = {
  ["Perf Meter"] = "Perf Meter",
  -- the meter and its tooltip
  ["%d fps"] = "%d FPS",
  ["Memory scan: %d s ago."] = "Speichermessung: vor %d s.",
  ["Addon memory is measured outside of combat."] = "Der Speicher der Addons wird außerhalb des Kampfes gemessen.",
  ["Memory is not measured during combat."] = "Im Kampf wird kein Speicher gemessen.",
  ["Drag to move. /perfmeter lock keeps it in place."] = "Zum Verschieben ziehen. /perfmeter lock hält die Anzeige fest.",
  -- answers to commands
  ["The meter is locked."] = "Die Anzeige ist gesperrt.",
  ["The meter is unlocked. Drag it to move it."] = "Die Anzeige ist entsperrt. Zieh sie, um sie zu verschieben.",
  ["The meter is back at the top of the screen."] = "Die Anzeige ist wieder oben am Bildschirm.",
  ["/perfmeter shows or hides the meter, /perfmeter lock or unlock fixes or frees it, /perfmeter reset puts it back at the top."] =
    "/perfmeter blendet die Anzeige ein oder aus, /perfmeter lock oder unlock sperrt oder entsperrt sie, /perfmeter reset setzt sie wieder nach oben.",
}

local own = GetLocale and T[GetLocale()]
if own then
  for key, text in pairs(own) do rawset(L, key, text) end
end
