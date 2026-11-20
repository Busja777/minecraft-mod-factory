local _, ns = ...
local L = ns.L

-- /bl shows the state and the commands; the rest changes one setting each.

local function stateText()
  local s, c = ns.settings, ns.counts or {}
  local parts = {}
  if ns.State(c.free, c.total, s.threshold) == "unknown" then
    parts[#parts + 1] = L["Bags not counted yet."]
  else
    parts[#parts + 1] = string.format(L["%d of %d bag slots free."], c.free, c.total)
  end
  parts[#parts + 1] = string.format(L["Warning at %d free slots or fewer."], s.threshold)
  parts[#parts + 1] = s.sound and L["Sound is on."] or L["Sound is off."]
  if s.hidden then
    parts[#parts + 1] = L["The counter is hidden."]
  else
    parts[#parts + 1] = s.locked and L["The counter is locked."] or L["The counter is unlocked."]
  end
  return table.concat(parts, " ")
end

local function setThreshold(arg)
  local n = ns.ParseThreshold(arg)
  if not n then
    ns.Print(string.format(L["The threshold must be a whole number from 0 to %d."], ns.MAX_THRESHOLD))
    return
  end
  ns.settings.threshold = n
  ns.ResetWarner(ns.warner) -- a new threshold does not warn about the bags as they are now
  ns.Recount()
  ns.Print(string.format(L["Warning at %d free slots or fewer."], n))
end

local function setSound(arg)
  if arg == "on" then
    ns.settings.sound = true
  elseif arg == "off" then
    ns.settings.sound = false
  end
  ns.Print(ns.settings.sound and L["Sound is on."] or L["Sound is off."])
end

SLASH_BAGLOOKOUT1 = "/baglookout"
SLASH_BAGLOOKOUT2 = "/bl"
SlashCmdList.BAGLOOKOUT = function(msg)
  if not ns.settings then return end
  local cmd, arg = strtrim(msg or ""):lower():match("^(%S*)%s*(.-)$")
  if cmd == "threshold" then
    setThreshold(arg)
  elseif cmd == "lock" then
    ns.settings.locked = not ns.settings.locked
    ns.Print(ns.settings.locked and L["The counter is locked."] or L["The counter is unlocked."])
  elseif cmd == "hide" then
    ns.settings.hidden = true
    ns.Render()
    ns.Print(L["The counter is hidden. Warnings stay on. /bl show brings it back."])
  elseif cmd == "show" then
    ns.settings.hidden = false
    ns.Render()
    ns.Print(L["The counter is shown."])
  elseif cmd == "sound" then
    setSound(arg)
  else
    ns.Print(stateText())
    ns.Print(L["Commands: /bl threshold <0-50>, /bl lock, /bl hide, /bl show, /bl sound on or off."])
  end
end
