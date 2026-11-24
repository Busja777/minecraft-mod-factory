local _, ns = ...
local L = ns.L

-- /smo shows whether the screenshots are on; on, off and test do the rest.

local function status()
  if ns.db.settings.on then
    ns.Print(L["Screenshots at a level up, an achievement and epic loot are on."])
  else
    ns.Print(L["Screenshots at special moments are off."])
  end
end

local function help()
  ns.Print(L["/smo on or /smo off switches the screenshots, /smo test takes a test screenshot. They are saved in the Screenshots folder of the game."])
end

local function test()
  local answer = ns.Moment(L["test"])
  if answer == "wait" then
    local left = ns.WaitLeft(ns.state, GetTime())
    ns.Print(string.format(L["The last screenshot was just taken. Try again in %d seconds."], math.max(1, left)))
  elseif answer == "loading" then
    ns.Print(L["Not during a loading screen."])
  else
    ns.Print(L["A test screenshot follows in a second."])
  end
end

SLASH_SHOTMOMENTS1 = "/shotmoments"
SLASH_SHOTMOMENTS2 = "/smo"
SlashCmdList.SHOTMOMENTS = function(msg)
  if not ns.db then return end
  local cmd = strtrim(msg or ""):lower():match("^(%S*)")
  if cmd == "on" then
    ns.db.settings.on = true
    status()
  elseif cmd == "off" then
    ns.db.settings.on = false
    status()
  elseif cmd == "test" then
    test()
  else
    status()
    help()
  end
end
