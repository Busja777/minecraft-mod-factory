local _, ns = ...
local L = ns.L

-- /dw shows the state and the commands; warn, instance, lock, hide and show change the settings,
-- history lists the repair costs (1.2).

local function instanceText()
  local s = ns.settings
  if not s.instanceWarn then return L["No warning before dungeons and raids."] end
  return string.format(L["Warning before dungeons and raids at %d%%."], s.instanceLevel)
end

local function stateText()
  local s, cond = ns.settings, ns.condition
  local gear
  if not cond.overall then
    gear = L["Nothing you wear has durability."]
  elseif #cond.damaged == 0 then
    gear = string.format(L["Gear %d%%, nothing damaged."], cond.overall)
  else
    gear = string.format(L["Gear %d%%, lowest %s %d%%."], cond.overall, L[ns.SLOT_LABEL[cond.lowestSlot]], cond.lowest)
  end
  local shown
  if s.hidden then
    shown = L["The display is hidden."]
  elseif s.locked then
    shown = L["The display is locked."]
  else
    shown = L["The display can be dragged."]
  end
  return gear .. " " .. string.format(L["Warning at %d%%."], s.warn) .. " " .. instanceText() .. " " .. shown
end

-- /dw instance on|off|<percent>
local function instanceCommand(rest)
  local s = ns.settings
  if rest == "off" then
    s.instanceWarn = false
  elseif rest == "on" then
    s.instanceWarn = true
  elseif rest ~= "" then
    local level = ns.ParseWarn(rest)
    if not level then
      ns.Print(string.format(L["Use /dw instance on, /dw instance off or a whole number from %d to %d, for example /dw instance 40."], ns.MIN_WARN, ns.MAX_WARN))
      return
    end
    s.instanceLevel = level
    s.instanceWarn = true
  end
  ns.Print(instanceText())
  ns.Recount()
end

-- /dw history lists the noted repair costs of this character, /dw history clear empties the list.
local function historyCommand(rest)
  local list = ns.History()
  if rest == "clear" then
    for i = #list, 1, -1 do list[i] = nil end
    ns.visit = nil
    ns.Print(L["The repair cost history of this character is empty now."])
    return
  end
  if rest ~= "" then
    ns.Print(L["Use /dw history to list your repair costs, /dw history clear to empty the list."])
    return
  end
  if #list == 0 then
    ns.Print(L["No repair costs noted yet. They are noted at a vendor who can repair while your gear is damaged."])
    return
  end
  ns.Print(string.format(L["Repair costs of your last %d vendor visits, newest first:"], #list))
  for i = #list, 1, -1 do ns.Print(ns.VisitText(list[i])) end
  ns.Print(ns.WeekText(list, time()))
end

SLASH_DURABILITYWATCH1 = "/durabilitywatch"
SLASH_DURABILITYWATCH2 = "/dw"
SlashCmdList.DURABILITYWATCH = function(msg)
  if not ns.settings then return end
  local cmd, rest = strtrim(msg or ""):lower():match("^(%S*)%s*(.-)$")
  local s = ns.settings
  if cmd == "warn" then
    local level = ns.ParseWarn(rest)
    if not level then
      ns.Print(string.format(L["Use a whole number from %d to %d, for example /dw warn 30."], ns.MIN_WARN, ns.MAX_WARN))
      return
    end
    s.warn = level
    ns.Print(string.format(L["Warning at %d%%."], level))
    ns.Recount()
  elseif cmd == "instance" then
    instanceCommand(rest)
  elseif cmd == "history" then
    historyCommand(rest)
  elseif cmd == "lock" then
    s.locked = not s.locked
    ns.Print(s.locked and L["The display is locked."] or L["The display can be dragged."])
  elseif cmd == "hide" then
    s.hidden = true
    ns.Refresh()
    ns.Print(L["The display is hidden. /dw show brings it back."])
  elseif cmd == "show" then
    s.hidden = false
    ns.Refresh()
    ns.Print(L["The display is shown."])
  else
    ns.Print(stateText())
    ns.Print(L["/dw warn <percent> sets the warning level (5 to 90), /dw lock locks or unlocks the display, /dw hide and /dw show hide or show it."])
    ns.Print(L["/dw instance <percent> warns you before dungeons and raids when an item is at or below it, /dw instance off switches that off."])
    ns.Print(L["/dw history lists the repair costs of your last 20 vendor visits, /dw history clear empties the list."])
  end
end
