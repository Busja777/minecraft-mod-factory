local _, ns = ...
local L = ns.L

-- Reads the reset countdowns from the game and runs the timer. The timer's end is kept as a
-- time() value in ResetClockDB, so it keeps running across /reload and logouts.

local TICK = 1 -- seconds between two checks of the timer and two refreshes of the window

function ns.Print(msg)
  DEFAULT_CHAT_FRAME:AddMessage("|cffffd100" .. L["Reset Clock"] .. ":|r " .. msg)
end

function ns.Now()
  return time()
end

function ns.DailySeconds()
  return ns.ResetSeconds(C_DateAndTime and C_DateAndTime.GetSecondsUntilDailyReset)
end

function ns.WeeklySeconds()
  return ns.ResetSeconds(C_DateAndTime and C_DateAndTime.GetSecondsUntilWeeklyReset)
end

function ns.Timer()
  return ns.db and ns.db.timer
end

function ns.StartTimer(seconds, label)
  local replaced = ns.db.timer ~= nil
  ns.db.timer = ns.NewTimer(seconds, label, ns.Now())
  if ns.Refresh then ns.Refresh() end
  return ns.db.timer, replaced
end

function ns.CancelTimer()
  local timer = ns.db.timer
  ns.db.timer = nil
  if ns.Refresh then ns.Refresh() end
  return timer
end

-- The timer ran out: a line in chat, the raid warning text in the middle of the screen and a sound.
local function alert(text)
  ns.Print(text)
  if RaidNotice_AddMessage and RaidWarningFrame and ChatTypeInfo and ChatTypeInfo.RAID_WARNING then
    pcall(RaidNotice_AddMessage, RaidWarningFrame, text, ChatTypeInfo.RAID_WARNING)
  end
  if PlaySound and SOUNDKIT and SOUNDKIT.RAID_WARNING then
    pcall(PlaySound, SOUNDKIT.RAID_WARNING, "Master")
  end
end

-- offline: the timer ran out before this login; it is reported in chat only, without sound.
function ns.CheckTimer(offline)
  local timer = ns.Timer()
  if not timer or not ns.Expired(timer, ns.Now()) then return false end
  ns.db.timer = nil
  if offline then ns.Print(ns.DoneText(timer, true)) else alert(ns.DoneText(timer)) end
  return true
end

local function onLogin()
  ResetClockDB = ResetClockDB or {}
  local db = ResetClockDB
  db.version = 1
  db.settings = db.settings or {}
  if db.timer and type(db.timer.endsAt) ~= "number" then db.timer = nil end
  ns.db = db
  ns.CheckTimer(true)
  if ns.WindowAtLogin then ns.WindowAtLogin() end
end

local frame = CreateFrame("Frame")
ns.eventFrame = frame

frame:SetScript("OnEvent", function(_, event)
  if event == "PLAYER_LOGIN" then onLogin() end
end)
frame:RegisterEvent("PLAYER_LOGIN")

local elapsed = 0
frame:SetScript("OnUpdate", function(_, dt)
  elapsed = elapsed + dt
  if elapsed < TICK then return end
  elapsed = 0
  if not ns.db then return end
  ns.CheckTimer(false)
  if ns.Refresh then ns.Refresh() end
end)
