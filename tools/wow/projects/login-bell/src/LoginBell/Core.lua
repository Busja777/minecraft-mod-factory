local _, ns = ...

-- Pure decisions: no frames, no events. Everything here runs outside the game in the tests.
--
-- state = { quietUntil = seconds, last = { [key] = seconds of the last bell }, lastSound = seconds }
-- key = "char:<name-realm in lower case>" for a character, "bn:<account id>" for a Battle.net friend.

ns.QUIET = 15       -- seconds without a bell after login or a reload, while the game fills its lists
ns.COOLDOWN = 300   -- seconds before the same person rings again (a disconnect and reconnect)
ns.SOUND_GAP = 2    -- seconds between two sounds when several people come online at once

-- The game's SOUNDKIT names, tried in this order: the Battle.net friend toast, then the whisper sound.
ns.SOUND_KITS = { "UI_BNET_TOAST", "TELL_MESSAGE" }

ns.DEFAULTS = { sound = true, friends = true, guild = true }

-- The system message the game shows when a friend or guild member logs in, as a GlobalStrings
-- constant (in the player's language) with the English text as fallback.
ns.ONLINE_TEXT = { "ERR_FRIEND_ONLINE_SS", "|Hplayer:%s|h[%s]|h has come online." }

function ns.IsSecret(value)
  return issecretvalue ~= nil and issecretvalue(value) and true or false
end

-- A text the game has in the player's language (a GlobalStrings constant); the English one otherwise.
function ns.GameText(global, english)
  local text = _G[global]
  if type(text) ~= "string" or text == "" or ns.IsSecret(text) then return english end
  return text
end

-- A format string of the game ("%s has come online.", also "%1$s") as an anchored Lua pattern.
function ns.FormatPattern(fmt)
  local s = fmt:gsub("%%%d*%$?s", "\1"):gsub("%%%d*%$?d", "\2")
  s = s:gsub("[%^%$%(%)%%%.%[%]%*%+%-%?]", "%%%0")
  s = s:gsub("\1", "(.+)"):gsub("\2", "(%%d+)")
  return "^" .. s .. "$"
end

function ns.OnlinePattern()
  return ns.FormatPattern(ns.GameText(ns.ONLINE_TEXT[1], ns.ONLINE_TEXT[2]))
end

-- The player named in an online message: the full name from the link and the name shown in
-- brackets. nil for every other line and for secret text.
function ns.ParseOnline(text, pattern)
  if type(text) ~= "string" or ns.IsSecret(text) then return nil end
  local full, shown = text:match(pattern)
  if not full or full == "" or full:find("|", 1, true) then return nil end
  if not shown or shown == "" then shown = full end
  return full, shown
end

-- "Ohm-Argent Dawn" -> "ohm-argentdawn": case and spaces do not matter when names are compared.
function ns.NameKey(name)
  if type(name) ~= "string" then return nil end
  return (name:lower():gsub("[%s']", ""))
end

-- Two character names are the same person. A name without a realm matches the same name on any realm.
function ns.SameName(a, b)
  a, b = ns.NameKey(a), ns.NameKey(b)
  if not a or not b or a == "" or b == "" then return false end
  if a == b then return true end
  local shortA, realmA = a:match("^([^%-]+)%-?(.*)$")
  local shortB, realmB = b:match("^([^%-]+)%-?(.*)$")
  if shortA ~= shortB then return false end
  return realmA == "" or realmB == ""
end

-- "friend" when the name is on the friend list, otherwise "guild" while the player is in a guild.
-- The game only announces friends and guild members, so a name on neither list is a friend whose
-- entry the list has not loaded yet.
function ns.KindOf(name, friendNames, inGuild)
  for _, friend in ipairs(friendNames or {}) do
    if ns.SameName(name, friend) then return "friend" end
  end
  if inGuild then return "guild" end
  return "friend"
end

-- The name of a Battle.net friend from C_BattleNet.GetAccountInfoByID: the account name the
-- friends list shows, or the BattleTag without its number. nil when nothing usable is there.
function ns.BNetName(info)
  if type(info) ~= "table" then return nil end
  local name = info.accountName
  if type(name) == "string" and not ns.IsSecret(name) and name ~= "" then return name end
  local tag = info.battleTag
  if type(tag) == "string" and not ns.IsSecret(tag) and tag ~= "" then
    return tag:match("^([^#]+)") or tag
  end
  return nil
end

-- Fills in what is missing and keeps what the player chose.
function ns.Settings(settings)
  if type(settings) ~= "table" then settings = {} end
  for key, value in pairs(ns.DEFAULTS) do
    if type(settings[key]) ~= "boolean" then settings[key] = value end
  end
  return settings
end

-- The word after /lb sound (friends, guild): "on", "off" or nothing to switch. nil for anything else.
function ns.Switch(word, current)
  word = (word or ""):lower()
  if word == "" then return not current end
  if word == "on" then return true end
  if word == "off" then return false end
  return nil
end

function ns.NewState()
  return { quietUntil = 0, last = {}, lastSound = nil }
end

-- No bell until now + seconds. A later start never shortens a quiet time already running.
function ns.Quiet(state, now, seconds)
  local untilAt = now + (seconds or ns.QUIET)
  if untilAt > state.quietUntil then state.quietUntil = untilAt end
end

-- Forgets people whose cooldown is over, so the table stays small in a big guild.
function ns.Prune(state, now)
  for key, at in pairs(state.last) do
    if now - at >= ns.COOLDOWN then state.last[key] = nil end
  end
end

-- What happens when kind ("friend" or "guild") with key comes online at now.
-- → "quiet" (startup), "off" (switched off), "cooldown" (rang a moment ago) or "ring";
--   with "ring" the second value says whether to play the sound.
function ns.Decide(state, settings, kind, key, now)
  if now < state.quietUntil then return "quiet" end
  if kind == "guild" and not settings.guild then return "off" end
  if kind ~= "guild" and not settings.friends then return "off" end
  local last = state.last[key]
  if last and now - last < ns.COOLDOWN then return "cooldown" end
  ns.Prune(state, now)
  state.last[key] = now
  local sound = settings.sound and (not state.lastSound or now - state.lastSound >= ns.SOUND_GAP) or false
  if sound then state.lastSound = now end
  return "ring", sound
end

-- The sound id from the game's SOUNDKIT table: the first of SOUND_KITS this client knows, or nil.
function ns.SoundId(kit)
  if type(kit) ~= "table" then return nil end
  for _, name in ipairs(ns.SOUND_KITS) do
    local id = kit[name]
    if type(id) == "number" then return id end
  end
  return nil
end

-- "Sound: on, friends: on, guild: off."
function ns.StatusText(settings)
  local L = ns.L
  local function word(v) return v and L["on"] or L["off"] end
  return string.format(L["Sound: %s, friends: %s, guild: %s."], word(settings.sound), word(settings.friends), word(settings.guild))
end
