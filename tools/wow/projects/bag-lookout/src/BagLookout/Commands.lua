local _, ns = ...
local L = ns.L

-- /bl shows the state and the commands; the rest changes one setting each.

local function viewText()
  if ns.settings.view == "split" then return L["View: one line per bag type."] end
  return L["View: total."]
end

local function stateText()
  local s, c = ns.settings, ns.counts or {}
  local parts = {}
  if ns.State(c.free, c.total, s.threshold) == "unknown" then
    parts[#parts + 1] = L["Bags not counted yet."]
  else
    parts[#parts + 1] = string.format(L["%d of %d bag slots free."], c.free, c.total)
  end
  parts[#parts + 1] = string.format(L["Warning at %d free slots or fewer."], s.threshold)
  parts[#parts + 1] = ns.SoundText(s)
  parts[#parts + 1] = ns.RepeatText(s.repeatWarn)
  if s.hidden then
    parts[#parts + 1] = L["The counter is hidden."]
  else
    parts[#parts + 1] = s.locked and L["The counter is locked."] or L["The counter is unlocked."]
  end
  parts[#parts + 1] = viewText()
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

local function setView(arg)
  if arg == "split" or arg == "total" then
    ns.settings.view = arg
    ns.Render()
  elseif arg ~= "" then
    ns.Print(L["Use /bl view total or /bl view split."])
    return
  end
  ns.Print(viewText())
end

local function soundChoices()
  ns.Print(string.format(L["Sounds: %s. /bl sound followed by a name picks it and plays it once, /bl sound none is silent."],
    ns.OrList(ns.SOUND_NAMES)))
end

-- /bl sound on, off or none switch the sound; /bl sound bell (or another name) picks it and plays it.
local function setSound(arg)
  local s = ns.settings
  if arg == "on" then
    s.sound = true
  elseif arg == "off" or arg == "none" then
    s.sound = false
  elseif ns.ValidSound(arg) then
    s.sound = true
    s.soundName = arg
    ns.PlayWarningSound() -- a preview of the new choice
  else
    ns.Print(ns.SoundText(s))
    soundChoices()
    return
  end
  ns.Print(ns.SoundText(s))
end

local function setRepeat(arg)
  local mode = ns.ValidRepeat(arg)
  if mode then
    ns.settings.repeatWarn = mode
  elseif arg ~= "" then
    ns.Print(L["Use /bl warn once or /bl warn always."])
    return
  end
  ns.Print(ns.RepeatText(ns.settings.repeatWarn))
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
  elseif cmd == "view" then
    setView(arg)
  elseif cmd == "warn" then
    setRepeat(arg)
  else
    ns.Print(stateText())
    ns.Print(L["Commands: /bl threshold <0-50>, /bl view total or split, /bl lock, /bl hide, /bl show, /bl sound on or off, /bl sound followed by a sound name or none, /bl warn once or always."])
  end
end
