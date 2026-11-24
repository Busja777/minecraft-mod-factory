local _, ns = ...
local L = ns.L

-- /cplus far, /cplus off, /cplus save 1, /cplus 1, /cplus forget 1 and the status with help.

local function status()
  local db = ns.db
  if db.on then
    ns.Print(string.format(L["Maximum camera distance: on, factor %s."], ns.FormatFactor(db.factor)))
  else
    local current = ns.ToNumber(ns.ReadCVar())
    if current then
      ns.Print(string.format(L["Maximum camera distance: off, the game's value is %s."], ns.FormatFactor(current)))
    else
      ns.Print(L["Maximum camera distance: off."])
    end
  end
  local slots = ns.SlotList(ns.SavedSlots())
  if slots then
    ns.Print(string.format(L["Saved camera positions: %s."], slots))
  else
    ns.Print(L["Saved camera positions: none yet."])
  end
  if ns.pending then ns.Print(L["A camera change waits for the end of combat."]) end
  ns.Print(L["/cplus far zooms out up to the game's limit (or /cplus far 2.2), /cplus off restores your old distance, /cplus save 1 saves the camera in slot 1 to 3, /cplus 1 brings it back, /cplus forget 1 empties a slot."])
end

local function far(rest)
  local factor = ns.ParseFactor(rest)
  if not factor then
    ns.Print(string.format(L["Use a number from %s to %s, for example /cplus far 2.2."], ns.FormatFactor(ns.MIN_FACTOR), ns.FormatFactor(ns.MAX_FACTOR)))
    return
  end
  ns.Enable(factor)
end

SLASH_CAMERAPLUS1 = "/cameraplus"
SLASH_CAMERAPLUS2 = "/cplus"
SlashCmdList.CAMERAPLUS = function(msg)
  if not ns.db then return end
  local cmd, rest = ns.SplitCommand(msg)
  if cmd == "far" or cmd == "on" or cmd == "max" then
    far(rest)
  elseif cmd == "off" then
    ns.Disable()
  elseif cmd == "save" then
    ns.SaveSlot(rest)
  elseif cmd == "view" or cmd == "load" then
    ns.LoadSlot(rest)
  elseif cmd == "forget" then
    ns.ForgetSlot(rest)
  elseif cmd:match("^%d+$") then
    ns.LoadSlot(cmd)
  else
    status()
  end
end
