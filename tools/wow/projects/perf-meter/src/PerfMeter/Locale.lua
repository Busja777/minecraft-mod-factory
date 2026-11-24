local _, ns = ...

-- English text is the key itself; other languages override single keys in a later version.
--
-- Terms the game already has in the player's language come from the client itself, not from this file
-- (ns.GameText / ns.GameFormat, each with the English text as fallback):
--   tooltip lines: MAINMENUBAR_FPS_LABEL ("Framerate: %.0f fps"), MAINMENUBAR_LATENCY_LABEL
--   ("Latency:\n%.0f ms (home)\n%.0f ms (world)"), TOTAL_MEM_MB_ABBR / TOTAL_MEM_KB_ABBR ("AddOn Memory: ..."),
--   ADDON_MEM_MB_ABBR / ADDON_MEM_KB_ABBR ("(%.2f MB) %s"), the same lines as the game's own performance tooltip.
--   on the meter: ADDONS ("AddOns"), MILLISECONDS_ABBR ("ms").
-- Slash commands and their words stay English: players type them as they are (/perfmeter lock).
ns.L = setmetatable({}, { __index = function(_, key) return key end })
