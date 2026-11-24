local _, ns = ...
local L = ns.L

-- /lb shows the settings, /lb sound, /lb friends and /lb guild switch them, /lb test plays the bell.

local function help()
  ns.Print(L["/lb sound, /lb friends and /lb guild switch the sound, friends and guild members on or off (add on or off to set it), /lb test plays the bell."])
end

local function status()
  ns.Print(ns.StatusText(ns.db.settings))
end

local SWITCHES = { sound = true, friends = true, guild = true }

SLASH_LOGINBELL1 = "/loginbell"
SLASH_LOGINBELL2 = "/lb"
SlashCmdList.LOGINBELL = function(msg)
  if not ns.db then return end
  local cmd, rest = strtrim(msg or ""):match("^(%S*)%s*(.-)$")
  cmd = cmd:lower()
  if cmd == "" then
    status()
    help()
  elseif SWITCHES[cmd] then
    local value = ns.Switch(rest, ns.db.settings[cmd])
    if value == nil then return help() end
    ns.db.settings[cmd] = value
    status()
  elseif cmd == "test" then
    ns.PlayBell()
    if ns.db.settings.sound then
      ns.Print(L["This is the bell."])
    else
      ns.Print(L["This is the bell. The sound is off, /lb sound switches it on."])
    end
  else
    help()
  end
end
