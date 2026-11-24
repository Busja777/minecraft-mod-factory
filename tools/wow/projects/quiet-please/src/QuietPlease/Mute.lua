local _, ns = ...

-- Talks to the game: mutes and unmutes the listed sound files, reads and sets the sound CVars.
-- The game forgets muted files when the client closes, so the list is muted again on every login.

ns.applied = {} -- file IDs this addon has muted in the current session

function ns.CanMute()
  return MuteSoundFile ~= nil and UnmuteSoundFile ~= nil
end

function ns.Mute(id)
  if not ns.CanMute() or ns.applied[id] then return end
  MuteSoundFile(id)
  ns.applied[id] = true
end

function ns.Unmute(id)
  if not ns.CanMute() or not ns.applied[id] then return end
  UnmuteSoundFile(id)
  ns.applied[id] = nil
end

-- Mutes every listed file (when the addon is switched on), returns how many are muted now.
function ns.ApplyAll()
  if ns.db.enabled then
    for id in pairs(ns.db.ids) do ns.Mute(id) end
  end
  return ns.Count(ns.applied)
end

function ns.UnmuteAll()
  for id in pairs(ns.applied) do ns.Unmute(id) end
end

-- Sound CVars: the current value as true/false, or nil when this client does not know the CVar.
local function readCVar(name)
  local value
  if C_CVar and C_CVar.GetCVar then
    value = C_CVar.GetCVar(name)
  elseif GetCVar then
    value = GetCVar(name)
  end
  if value == nil then return nil end
  return value ~= "0"
end

function ns.ToggleState(toggle)
  return readCVar(toggle.cvar)
end

-- Switches a sound category on (true) or off (false). Returns the new state, nil when not available.
function ns.SetToggle(toggle, on)
  if readCVar(toggle.cvar) == nil then return nil end
  local value = on and "1" or "0"
  if C_CVar and C_CVar.SetCVar then
    C_CVar.SetCVar(toggle.cvar, value)
  elseif SetCVar then
    SetCVar(toggle.cvar, value)
  else
    return nil
  end
  return readCVar(toggle.cvar)
end

local function onLogin()
  local db = type(QuietPleaseDB) == "table" and QuietPleaseDB or {}
  QuietPleaseDB = db
  db.version = 1
  db.ids = ns.CleanList(db.ids)
  if db.enabled == nil then db.enabled = true end
  ns.db = db
  ns.ApplyAll()
end

local frame = CreateFrame("Frame")
ns.eventFrame = frame
frame:SetScript("OnEvent", function(_, event)
  if event == "PLAYER_LOGIN" then onLogin() end
end)
frame:RegisterEvent("PLAYER_LOGIN")
