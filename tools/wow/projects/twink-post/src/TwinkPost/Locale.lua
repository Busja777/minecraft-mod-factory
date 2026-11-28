local _, ns = ...

-- English text is the key itself; other languages override single keys.
--
-- Terms the game already has in the player's language come from the client itself, not from this file:
--   the level in the menu and the list (UNIT_LEVEL_TEMPLATE "Stufe %d") and the faction names
--   (FACTION_ALLIANCE, FACTION_HORDE), see ns.GameText in Core.lua, since 1.0. Character and realm
--   names come from the game as they are.
-- No GlobalStrings constant is spliced into a sentence: every game term here sits inside a sentence,
-- and the German sentence needs its own article and case. They are written as the German client
-- names them: Charakter/Charaktere (CHARACTER), Briefkasten (mailbox), Empfänger (recipient),
-- Realm (the German client keeps the English word), Schaltfläche (button).
-- The Send Mail tab is not named in German (its tab text is not a constant we could check); the
-- help says "beim Verschicken von Post" instead.
-- Slash commands and their words stay English: players type them as they are (/twinkpost,
-- /twinkpost forget, /tp). "Name-Realm" stays as written: it is the form the recipient box expects.
local L = setmetatable({}, { __index = function(_, key) return key end })
ns.L = L

local T = {}

T.deDE = {
  ["Twink Post"] = "Twink Post",
  -- the button and the menu
  ["Click to pick one of your characters as the recipient."] = "Klicken, um einen deiner Charaktere als Empfänger zu wählen.",
  ["No other character known here yet. Log in once with each of your characters."] =
    "Hier ist noch kein anderer Charakter bekannt. Melde dich einmal mit jedem deiner Charaktere an.",
  -- /twinkpost
  ["Known characters: %d"] = "Bekannte Charaktere: %d",
  ["(this character)"] = "(dieser Charakter)",
  -- /twinkpost forget
  ["%s forgotten."] = "%s vergessen.",
  ["You cannot forget the character you are playing."] = "Den Charakter, den du gerade spielst, kannst du nicht vergessen.",
  ["Several characters are called %s. Use Name-Realm."] = "Mehrere Charaktere heißen %s. Gib Name-Realm an.",
  ["No character called %s."] = "Kein Charakter heißt %s.",
  -- help
  ["/twinkpost lists your characters, /twinkpost forget Name or Name-Realm removes one. At a mailbox, the button next to the recipient box on the Send Mail tab fills in one of them."] =
    "/twinkpost zeigt deine Charaktere, /twinkpost forget Name oder Name-Realm entfernt einen. Am Briefkasten trägt die Schaltfläche neben dem Empfängerfeld beim Verschicken von Post einen davon ein.",
}

local own = GetLocale and T[GetLocale()]
if own then
  for key, text in pairs(own) do rawset(L, key, text) end
end
