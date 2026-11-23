local _, ns = ...
local L = ns.L

-- /rc prints both countdowns; timer, cancel and window do the rest.

local function help()
  ns.Print(L["/rc timer 10m tea starts a timer with a label, /rc timer shows the time left, /rc cancel stops it, /rc window opens the window."])
end

local function countdowns()
  ns.Print(ns.ResetText(L["Daily reset"], ns.DailySeconds()))
  ns.Print(ns.ResetText(L["Weekly reset"], ns.WeeklySeconds()))
  local timer = ns.Timer()
  if timer then ns.Print(ns.TimerText(timer, ns.Now())) end
end

local function timer(rest)
  if rest == "" then
    ns.Print(ns.TimerText(ns.Timer(), ns.Now()))
    return
  end
  local seconds, label = ns.ParseTimerArgs(rest)
  if not seconds then
    ns.Print(ns.InvalidText(label))
    return
  end
  ns.Print(ns.StartedText(ns.StartTimer(seconds, label)))
end

local function cancel()
  local stopped = ns.CancelTimer()
  if stopped then
    ns.Print(stopped.label and string.format(L["Timer \"%s\" stopped."], stopped.label) or L["Timer stopped."])
  else
    ns.Print(L["No timer is running."])
  end
end

SLASH_RESETCLOCK1 = "/resetclock"
SLASH_RESETCLOCK2 = "/rc"
SlashCmdList.RESETCLOCK = function(msg)
  if not ns.db then return end
  local word, rest = strtrim(msg or ""):match("^(%S*)%s*(.-)$")
  word = word:lower()
  if word == "" then
    countdowns()
  elseif word == "timer" then
    timer(rest)
  elseif word == "cancel" then
    cancel()
  elseif word == "window" then
    ns.Toggle()
  else
    help()
  end
end
