local _, ns = ...
local L = ns.L

-- Runs a roll call: while it is open, every /roll line of the game (CHAT_MSG_SYSTEM) is read with
-- the game's own text (RANDOM_ROLL_RESULT), so it works in every client language. When the time is
-- up the result goes to the player's own chat window only; nothing is ever sent to other players.
-- No combat log. In Midnight the game can hand chat text to addons as a secret value (in instances);
-- such a line is skipped and counted, and the window says that rolls may be missing.

ns.round = nil -- the running round, or the last finished one

local rollPattern -- built on first use

function ns.Print(msg)
  DEFAULT_CHAT_FRAME:AddMessage("|cffffd100" .. L["Roll Call"] .. ":|r " .. msg)
end

function ns.Running()
  return ns.round ~= nil and ns.round.open == true
end

local frame = CreateFrame("Frame")
ns.eventFrame = frame

local shownLeft -- the whole seconds the window shows, so it refreshes once a second

local function refresh()
  if ns.Refresh then ns.Refresh() end
end

-- Prints the result of a round (also for /rollcall).
function ns.Report(round)
  round = round or ns.round
  if not round then
    ns.Print(L["No roll call yet. Type /rollcall start to begin one."])
    return
  end
  ns.Print(ns.ResultText(round))
  if round.unreadable > 0 then ns.Print(L["Some lines could not be read here, rolls may be missing."]) end
end

-- Ends the running round and prints the winner.
function ns.Finish()
  local round = ns.round
  if not ns.Close(round, GetTime()) then return false end
  frame:SetScript("OnUpdate", nil)
  frame:UnregisterEvent("CHAT_MSG_SYSTEM")
  if ns.db then ns.db.last = round end
  ns.Report(round)
  refresh()
  return true
end

local function onUpdate()
  local round = ns.round
  if not round or not round.open then
    frame:SetScript("OnUpdate", nil)
    return
  end
  local now = GetTime()
  if now >= round.ends then
    ns.Finish()
    return
  end
  local left = math.ceil(round.ends - now)
  if left ~= shownLeft then
    shownLeft = left
    refresh()
  end
end

-- Starts a round of the given seconds. false when one is already running.
function ns.Start(seconds)
  if ns.Running() then return false end
  rollPattern = rollPattern or ns.RollPattern()
  ns.round = ns.NewRound(GetTime(), seconds)
  shownLeft = nil
  frame:RegisterEvent("CHAT_MSG_SYSTEM")
  frame:SetScript("OnUpdate", onUpdate)
  if ns.ShowWindow then ns.ShowWindow() end
  refresh()
  return true
end

local function onSystem(text)
  local round = ns.round
  if not round or not round.open then return end
  -- A line can arrive in the same moment the time runs out, before the next OnUpdate.
  if GetTime() >= round.ends then
    ns.Finish()
    return
  end
  if ns.IsSecret(text) then
    ns.AddUnreadable(round)
    refresh()
    return
  end
  local name, roll, low, high = ns.ParseRoll(text, rollPattern)
  if not name then return end
  if ns.AddRoll(round, name, roll, low, high) ~= "closed" then refresh() end
end

frame:SetScript("OnEvent", function(_, event, ...)
  if event == "PLAYER_LOGIN" then
    RollCallDB = type(RollCallDB) == "table" and RollCallDB or {}
    local db = RollCallDB
    db.version = 1
    -- The last result survives a reload; a round that was still running is not kept.
    local last = db.last
    if type(last) ~= "table" or type(last.rolls) ~= "table" or last.open then
      db.last = nil
    else
      last.unreadable = tonumber(last.unreadable) or 0
      last.repeats = tonumber(last.repeats) or 0
      ns.round = last
    end
    ns.db = db
  elseif event == "CHAT_MSG_SYSTEM" then
    onSystem((...))
  end
end)

frame:RegisterEvent("PLAYER_LOGIN")
