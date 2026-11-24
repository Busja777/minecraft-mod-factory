local _, ns = ...
local L = ns.L

-- The character's lists in ChoreListCharDB and the reset check: at login (a reset that passed
-- while offline) and every few seconds while playing.

local TICK = 10 -- seconds between two reset checks

function ns.Print(msg)
  DEFAULT_CHAT_FRAME:AddMessage("|cffffd100" .. L["Chore List"] .. ":|r " .. msg)
end

-- Server time, the same clock the reset times are stored in. nil when it cannot be read.
function ns.Now()
  local now = GetServerTime and GetServerTime()
  if type(now) ~= "number" or ns.IsSecret(now) then return nil end
  return now
end

function ns.SecondsLeft(kind)
  local api = C_DateAndTime
  if not api then return nil end
  if kind == "daily" then return ns.ResetSeconds(api.GetSecondsUntilDailyReset) end
  return ns.ResetSeconds(api.GetSecondsUntilWeeklyReset)
end

function ns.List(kind)
  return ns.db and ns.db[kind]
end

-- offline: the check at login; the chat line then says the reset came while the player was away.
function ns.CheckResets(offline)
  if not ns.db then return end
  local now = ns.Now()
  if not now then return end
  local changed = false
  for _, kind in ipairs(ns.KINDS) do
    if ns.CheckReset(ns.db, kind, now, ns.SecondsLeft(kind)) then
      local n = ns.Uncheck(ns.db[kind])
      if n > 0 then
        changed = true
        if kind == "daily" then
          ns.Print(offline and L["The daily reset came while you were away: your daily chores are open again."] or L["Daily reset: your daily chores are open again."])
        else
          ns.Print(offline and L["The weekly reset came while you were away: your weekly chores are open again."] or L["Weekly reset: your weekly chores are open again."])
        end
      end
    end
  end
  if changed and ns.Refresh then ns.Refresh() end
end

local function onLogin()
  ChoreListCharDB = ns.Normalize(ChoreListCharDB)
  ns.db = ChoreListCharDB
  ns.CheckResets(true)
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
  ns.CheckResets(false)
  if ns.Refresh then ns.Refresh() end -- the "resets in" line of the window
end)
