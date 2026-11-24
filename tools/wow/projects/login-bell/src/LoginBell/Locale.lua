local _, ns = ...

-- English text is the key itself; other languages override single keys.
--
-- Terms the game already has in the player's language come from the client itself, not from this file:
--   the online message in chat is read with the client's own GlobalStrings (Core.lua ns.ONLINE_TEXT:
--   ERR_FRIEND_ONLINE_SS, since 1.0), so a German client's "ist jetzt online." is understood as well.
--   Player names and Battle.net names come from the game.
-- No GlobalStrings constant is spliced into a line: the English lines would change with them
-- ("Guild Member", "Friends"). Game terms are written as the German client names them: Freund (FRIEND),
-- Freunde (FRIENDS), Gilde (GUILD), Gildenmitglied (LFG_LIST_GUILD_MEMBER), Sound (SOUND),
-- an / aus (SLASH_TEXTTOSPEECH_ON / SLASH_TEXTTOSPEECH_OFF).
-- Slash commands and their words stay English: players type them as they are (/lb sound off,
-- /lb friends, /lb guild on, /lb test).
local L = setmetatable({}, { __index = function(_, key) return key end })
ns.L = L

local T = {}

T.deDE = {
  ["Login Bell"] = "Login Bell",
  ["Friend online: %s"] = "Freund online: %s",
  ["Guild member online: %s"] = "Gildenmitglied online: %s",
  -- the settings
  ["on"] = "an", ["off"] = "aus",
  ["Sound: %s, friends: %s, guild: %s."] = "Sound: %s, Freunde: %s, Gilde: %s.",
  -- help and the bell test
  ["/lb sound, /lb friends and /lb guild switch the sound, friends and guild members on or off (add on or off to set it), /lb test plays the bell."] =
    "/lb sound, /lb friends und /lb guild schalten den Sound, Freunde und Gildenmitglieder ein oder aus (mit on oder off dahinter legst du es fest), /lb test spielt die Glocke ab.",
  ["This is the bell."] = "So klingt die Glocke.",
  ["This is the bell. The sound is off, /lb sound switches it on."] =
    "So klingt die Glocke. Der Sound ist aus, /lb sound schaltet ihn ein.",
}

local own = GetLocale and T[GetLocale()]
if own then
  for key, text in pairs(own) do rawset(L, key, text) end
end
