local _, ns = ...
local L = ns.L

-- Reads and writes the camera CVar, waits for the end of combat, saves and loads camera positions.

ns.pending = nil   -- CVar value waiting for the end of combat
local writing = false
local watching = false -- changes from the game's settings are noticed only after the login has settled

function ns.Print(msg)
  DEFAULT_CHAT_FRAME:AddMessage("|cff66ccff" .. L["Camera Plus"] .. ":|r " .. msg)
end

function ns.ReadCVar()
  local value
  if C_CVar and C_CVar.GetCVar then
    value = C_CVar.GetCVar(ns.CVAR)
  elseif GetCVar then
    value = GetCVar(ns.CVAR)
  end
  if ns.ToNumber(value) then return value end
  return nil
end

local function writeCVar(value)
  local set = (C_CVar and C_CVar.SetCVar) or SetCVar
  if not set then return false end
  writing = true
  local ok, result = pcall(set, ns.CVAR, value)
  writing = false
  return ok and result ~= false
end

local function gameDefault()
  local value = C_CVar and C_CVar.GetCVarDefault and C_CVar.GetCVarDefault(ns.CVAR)
  if ns.ToNumber(value) then return value end
  return nil
end

function ns.InCombat()
  return InCombatLockdown ~= nil and InCombatLockdown() and true or false
end

-- Puts a value into the CVar now, or after combat. Returns "done", "queued" or "failed".
function ns.Write(value)
  if ns.InCombat() then
    ns.pending = value
    return "queued"
  end
  ns.pending = nil
  if ns.Same(ns.ReadCVar(), value) then return "done" end
  if writeCVar(value) then return "done" end
  return "failed"
end

local function report(result, doneText)
  if result == "queued" then
    ns.Print(L["You are in combat. The camera changes when combat ends."])
  elseif result == "failed" then
    ns.Print(L["The game did not accept the change. Try again in a moment."])
  else
    ns.Print(doneText)
  end
end

function ns.Enable(factor)
  local db = ns.db
  if not db.on then
    -- A restore still waiting for the end of combat is the real value from before.
    local before = ns.pending or ns.ReadCVar()
    db.previous = ns.ToNumber(before) and before or nil
  end
  db.on = true
  db.factor = factor
  local result = ns.Write(ns.FormatFactor(factor))
  report(result, string.format(L["Maximum camera distance is on (factor %s). Scroll out to use it."], ns.FormatFactor(factor)))
end

function ns.Disable()
  local db = ns.db
  if not db.on then
    ns.Print(L["Maximum camera distance is already off."])
    return
  end
  local value = ns.RestoreValue(db.previous, gameDefault())
  db.on = false
  db.previous = nil
  local result = ns.Write(value)
  report(result, string.format(L["Maximum camera distance is off. The game's value %s is back."], ns.FormatFactor(ns.ToNumber(value))))
end

-- Keeps the CVar at the saved factor (login, after loading screens). Quiet.
local function reapply()
  local db = ns.db
  if db and db.on then ns.Write(ns.FormatFactor(db.factor)) end
end

-- The player moved the game's own camera distance slider while Camera Plus was on: leave their choice alone.
local function onCVarUpdate(name)
  if not watching or writing or name ~= ns.CVAR then return end
  local db = ns.db
  if not db or not db.on or ns.pending then return end
  local current = ns.ReadCVar()
  if not current or ns.Same(current, ns.FormatFactor(db.factor)) then return end
  db.on = false
  db.previous = nil
  ns.Print(L["The camera distance was changed in the game's settings. Camera Plus is off and keeps that value."])
end

local function onCombatEnd()
  local value = ns.pending
  if not value then return end
  local result = ns.Write(value)
  if result == "done" then
    ns.Print(L["Combat is over, the camera change is done."])
  elseif result == "failed" then
    ns.Print(L["The game did not accept the change. Try again in a moment."])
  end
end

function ns.CharKey()
  return (UnitName("player") or "?") .. "-" .. (GetRealmName() or "?")
end

function ns.SavedSlots()
  local key = ns.CharKey()
  ns.db.views[key] = ns.db.views[key] or {}
  return ns.db.views[key]
end

function ns.SaveSlot(text)
  local view, slot = ns.ViewFor(text)
  if not view then
    ns.Print(L["Choose a slot from 1 to 3, for example /cplus save 1."])
    return
  end
  if not SaveView then
    ns.Print(L["This game version cannot save camera positions."])
    return
  end
  SaveView(view)
  ns.SavedSlots()[slot] = true
  ns.Print(string.format(L["Camera position %d saved. /cplus %d brings it back."], slot, slot))
end

function ns.LoadSlot(text)
  local view, slot = ns.ViewFor(text)
  if not view then
    ns.Print(L["Choose a slot from 1 to 3, for example /cplus 1."])
    return
  end
  if not ns.SavedSlots()[slot] then
    ns.Print(string.format(L["Slot %d is empty. Save the current camera with /cplus save %d first."], slot, slot))
    return
  end
  if not SetView then
    ns.Print(L["This game version cannot load camera positions."])
    return
  end
  SetView(view)
end

function ns.ForgetSlot(text)
  local _, slot = ns.ViewFor(text)
  if not slot then
    ns.Print(L["Choose a slot from 1 to 3, for example /cplus forget 1."])
    return
  end
  ns.SavedSlots()[slot] = nil
  ns.Print(string.format(L["Slot %d is empty again."], slot))
end

local function onLogin()
  ns.db = ns.CleanSettings(CameraPlusDB)
  CameraPlusDB = ns.db
  reapply()
end

local frame = CreateFrame("Frame")
ns.eventFrame = frame

frame:SetScript("OnEvent", function(_, event, ...)
  if event == "PLAYER_LOGIN" then
    onLogin()
  elseif event == "PLAYER_ENTERING_WORLD" then
    -- The game may load its own camera settings late; set ours again, then start noticing slider changes.
    reapply()
    watching = true
  elseif event == "PLAYER_REGEN_ENABLED" then
    onCombatEnd()
  elseif event == "CVAR_UPDATE" then
    onCVarUpdate(...)
  end
end)

for _, event in ipairs({ "PLAYER_LOGIN", "PLAYER_ENTERING_WORLD", "PLAYER_REGEN_ENABLED", "CVAR_UPDATE" }) do
  pcall(frame.RegisterEvent, frame, event)
end
