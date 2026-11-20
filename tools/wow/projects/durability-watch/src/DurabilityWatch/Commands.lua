local _, ns = ...
local L = ns.L

-- /dw shows the state and the commands; warn, lock, hide and show change the settings.

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
  return gear .. " " .. string.format(L["Warning at %d%%."], s.warn) .. " " .. shown
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
  end
end
