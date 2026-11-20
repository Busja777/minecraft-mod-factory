local _, ns = ...
local L = ns.L

-- /jb shows the settings, /jb sell and /jb repair switch each half on or off.

local function sellText()
  return ns.settings.sell and L["Selling junk is on."] or L["Selling junk is off."]
end

local function repairText()
  return ns.settings.repair and L["Repairing is on."] or L["Repairing is off."]
end

SLASH_JUNKBUTLER1 = "/junkbutler"
SLASH_JUNKBUTLER2 = "/jb"
SlashCmdList.JUNKBUTLER = function(msg)
  if not ns.settings then return end
  local cmd = strtrim(msg or ""):lower()
  if cmd == "" then
    ns.Print(sellText() .. " " .. repairText())
  elseif cmd == "sell" then
    ns.settings.sell = not ns.settings.sell
    ns.Print(sellText())
  elseif cmd == "repair" then
    ns.settings.repair = not ns.settings.repair
    ns.Print(repairText())
  else
    ns.Print(L["/jb shows the settings, /jb sell and /jb repair switch each half on or off. Hold Shift while you open a vendor to skip one visit."])
  end
end
