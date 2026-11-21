local _, ns = ...

-- Pure decisions: no frames, no events, no calls into the game. Everything here runs outside the game in the tests.
-- Alert.lua reads the game, asks these functions what to do and plays the alert.

ns.KINDS = { "lfg", "ready", "pvp", "pet" }
ns.DEFAULTS = { lfg = true, ready = true, pvp = true, pet = true, flash = true }
ns.REPEAT = 5 -- seconds in which a second alert of the same kind stays silent

-- Which event stands for which kind of alert.
ns.EVENT_KIND = {
  LFG_PROPOSAL_SHOW = "lfg",
  READY_CHECK = "ready",
  UPDATE_BATTLEFIELD_STATUS = "pvp",
  PET_BATTLE_QUEUE_PROPOSE_MATCH = "pet",
}

-- The alerts a player can name in /qh (lfg, ready, pvp, pet).
ns.IS_KIND = { lfg = true, ready = true, pvp = true, pet = true }

-- 1.3: the name of each alert as the game itself writes it, from the client's own GlobalStrings in
-- the player's language: { global, English name for a client without it }. The battleground and
-- arena alert joins two names.
ns.KIND_NAME = {
  lfg = { { "DUNGEONS_BUTTON", "Group Finder" } },
  ready = { { "QUEUED_STATUS_READY_CHECK_IN_PROGRESS", "Ready Check" } },
  pvp = { { "BATTLEGROUND", "Battleground" }, { "ARENA", "Arena" } },
  pet = { { "PET_BATTLE_PVP_QUEUE", "Pet Battle" } },
}

-- A text of the game (a GlobalStrings name); the English text when the client has none.
function ns.GameText(global, english)
  local text = _G[global]
  if type(text) ~= "string" or text == "" then return english end
  return text
end

-- The name of one alert, in the player's language.
function ns.KindName(kind)
  local names = ns.KIND_NAME[kind]
  if not names then return nil end
  local first = ns.GameText(names[1][1], names[1][2])
  if not names[2] then return first end
  return string.format(ns.L["%s and %s"], first, ns.GameText(names[2][1], names[2][2]))
end

-- The sounds a player can pick per alert: the word typed in /qh sound, and the game's SOUNDKIT
-- name behind it. "horn" is the ready check sound every alert played in 1.0.
ns.SOUND_NAMES = { "horn", "warning", "alarm", "invite", "whisper" }
ns.SOUND_KIT = {
  horn = "READY_CHECK",
  warning = "RAID_WARNING",
  alarm = "ALARM_CLOCK_WARNING_3",
  invite = "IG_PLAYER_INVITE",
  whisper = "TELL_MESSAGE",
}
ns.DEFAULT_SOUND = "horn"

-- 1.2: the screen flash, a coloured glow at the edges of the screen that fades in and out a few
-- times. Each alert has its own colour or "off"; every alert starts "off".
ns.SCREEN_NAMES = { "red", "gold", "blue", "green" }
ns.SCREEN_RGB = {
  red = { 1, 0.1, 0.1 },
  gold = { 1, 0.82, 0 },
  blue = { 0.2, 0.55, 1 },
  green = { 0.2, 1, 0.3 },
}
ns.SCREEN_OFF = "off"
ns.FLASH_PULSES = 3   -- how often the glow fades in and out
ns.FLASH_PULSE = 0.6  -- seconds for one pulse
ns.FLASH_ALPHA = 0.8  -- the strongest the glow gets

function ns.IsSecret(value)
  return issecretvalue ~= nil and issecretvalue(value) and true or false
end

-- Fills in what is missing and keeps what the player chose. Settings of 1.0 have no sounds yet:
-- every alert starts with the horn, as before.
function ns.Settings(settings)
  for key, value in pairs(ns.DEFAULTS) do
    if type(settings[key]) ~= "boolean" then settings[key] = value end
  end
  if type(settings.sounds) ~= "table" then settings.sounds = {} end
  for _, kind in ipairs(ns.KINDS) do
    if not ns.SOUND_KIT[settings.sounds[kind]] then settings.sounds[kind] = ns.DEFAULT_SOUND end
  end
  -- Settings of 1.0 and 1.1 have no screen flash yet: every alert starts without it.
  if type(settings.screen) ~= "table" then settings.screen = {} end
  for _, kind in ipairs(ns.KINDS) do
    if not ns.SCREEN_RGB[settings.screen[kind]] then settings.screen[kind] = ns.SCREEN_OFF end
  end
  return settings
end

-- The sound name an alert plays. kind = nil (the plain test) plays the horn.
function ns.SoundFor(settings, kind)
  local sounds = type(settings) == "table" and settings.sounds
  local name = type(sounds) == "table" and kind and sounds[kind]
  if ns.SOUND_KIT[name] then return name end
  return ns.DEFAULT_SOUND
end

-- The sound id for a name from the game's SOUNDKIT table. A sound this client does not know falls
-- back to the horn; nil when not even that is there.
function ns.SoundId(kit, name)
  if type(kit) ~= "table" then return nil end
  local id = kit[ns.SOUND_KIT[name] or ""]
  if type(id) == "number" then return id end
  id = kit[ns.SOUND_KIT[ns.DEFAULT_SOUND]]
  if type(id) == "number" then return id end
  return nil
end

-- Picks a sound for one alert. Returns true, or nil when the alert or the sound is not known.
function ns.ChooseSound(settings, kind, name)
  if not ns.IS_KIND[kind] or not ns.SOUND_KIT[name] then return nil end
  if type(settings.sounds) ~= "table" then settings.sounds = {} end
  settings.sounds[kind] = name
  return true
end

-- "Sounds: Group Finder horn, ... Choices: horn, warning, alarm, invite, whisper."
function ns.SoundText(settings)
  local L = ns.L
  local parts = {}
  for _, kind in ipairs(ns.KINDS) do
    parts[#parts + 1] = ns.KindName(kind) .. " " .. ns.SoundFor(settings, kind)
  end
  return string.format(L["Sounds: %s. Choices: %s."], table.concat(parts, ", "), table.concat(ns.SOUND_NAMES, ", "))
end

-- The colour of the screen flash for one alert; nil when it has none (off, or the plain test).
function ns.ScreenFor(settings, kind)
  local screen = type(settings) == "table" and settings.screen
  local name = type(screen) == "table" and kind and screen[kind]
  if ns.SCREEN_RGB[name] then return name end
  return nil
end

-- Picks the screen flash colour (or "off") for one alert. Returns true, or nil when the alert or the
-- colour is not known.
function ns.ChooseScreen(settings, kind, name)
  if not ns.IS_KIND[kind] then return nil end
  if name ~= ns.SCREEN_OFF and not ns.SCREEN_RGB[name] then return nil end
  if type(settings.screen) ~= "table" then settings.screen = {} end
  settings.screen[kind] = name
  return true
end

-- "Screen flash: Group Finder off, Ready Check red, ... Choices: red, gold, blue, green, off. Icon flash: on."
function ns.ScreenText(settings)
  local L = ns.L
  local parts = {}
  for _, kind in ipairs(ns.KINDS) do
    parts[#parts + 1] = ns.KindName(kind) .. " " .. (ns.ScreenFor(settings, kind) or ns.SCREEN_OFF)
  end
  local choices = table.concat(ns.SCREEN_NAMES, ", ") .. ", " .. ns.SCREEN_OFF
  local icon = settings.flash and L["on"] or L["off"]
  return string.format(L["Screen flash: %s. Choices: %s. Icon flash: %s."], table.concat(parts, ", "), choices, icon)
end

-- How strong the screen flash is after elapsed seconds: it rises from nothing to FLASH_ALPHA and
-- back, FLASH_PULSES times. nil when the flash is over.
function ns.FlashAlpha(elapsed)
  if type(elapsed) ~= "number" or elapsed < 0 or elapsed >= ns.FLASH_PULSES * ns.FLASH_PULSE then return nil end
  local phase = (elapsed % ns.FLASH_PULSE) / ns.FLASH_PULSE
  return ns.FLASH_ALPHA * (1 - math.abs(2 * phase - 1))
end

-- The text in the middle of the screen for one kind of alert.
function ns.Message(kind)
  local L = ns.L
  if kind == "lfg" then return L["Your group is ready!"] end
  if kind == "ready" then return L["Ready check!"] end
  if kind == "pvp" then return L["Your battleground or arena is ready!"] end
  if kind == "pet" then return L["Your pet battle is ready!"] end
  return L["Queue Horn test: this is how an alert looks."]
end

-- true when the player started the ready check. initiator is "Name" or "Name-Realm".
-- A secret or missing name cannot be compared, so the check is skipped and it counts as someone else.
function ns.IsOwnReadyCheck(initiator, player, realm)
  if type(initiator) ~= "string" or ns.IsSecret(initiator) then return false end
  if type(player) ~= "string" or ns.IsSecret(player) then return false end
  if initiator == player then return true end
  if type(realm) == "string" and not ns.IsSecret(realm) and realm ~= "" then
    return initiator == player .. "-" .. realm
  end
  return false
end

-- seen[slot] = the status a queue slot had last time. statuses[slot] = its status now, for slots 1..count.
-- Returns how many slots have just turned "confirm" (ready to enter). A slot that stays "confirm"
-- counts once; it counts again only after its status has changed in between.
-- A secret status is skipped: the slot keeps what was seen before.
function ns.NewConfirms(seen, statuses, count)
  local new = 0
  for slot = 1, count do
    local status = statuses[slot]
    if not ns.IsSecret(status) then
      if type(status) ~= "string" then status = "none" end
      if status == "confirm" and seen[slot] ~= "confirm" then new = new + 1 end
      seen[slot] = status
    end
  end
  for slot in pairs(seen) do
    if type(slot) ~= "number" or slot > count then seen[slot] = nil end -- the slot is gone
  end
  return new
end

-- last[kind] = the time of the latest alert of that kind. Returns true when the alert may play now,
-- and notes the time. A kind that is switched off stays silent and is not noted.
function ns.Allow(last, settings, kind, now)
  if settings[kind] ~= true then return false end
  local before = last[kind]
  if before and now - before < ns.REPEAT then return false end
  last[kind] = now
  return true
end

local SWITCHES = { lfg = true, ready = true, pvp = true, pet = true, flash = true }

-- "lfg on", "pvp off", "flash on" ... Returns the switch and its new value, or nil when the words are not known.
function ns.Apply(settings, words)
  local key, value = string.match(words or "", "^(%a+)%s+(%a+)$")
  if not key or not SWITCHES[key] then return nil end
  if value == "on" then
    settings[key] = true
  elseif value == "off" then
    settings[key] = false
  else
    return nil
  end
  return key, settings[key]
end

function ns.StateText(settings)
  local L = ns.L
  local function word(on) return on and L["on"] or L["off"] end
  local parts = {}
  for _, kind in ipairs(ns.KINDS) do
    parts[#parts + 1] = ns.KindName(kind) .. " " .. word(settings[kind])
  end
  return string.format(L["Alerts: %s. Icon flash: %s."], table.concat(parts, ", "), word(settings.flash))
end

-- The game's "Sound in Background" option. "0" means no sound at all while you are tabbed out.
function ns.BackgroundSoundOff(value)
  if ns.IsSecret(value) then return false end
  return value == "0" or value == 0 or value == false
end
