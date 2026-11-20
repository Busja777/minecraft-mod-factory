local _, ns = ...
local L = ns.L

-- /mb shows the characters with mail and the help; /mb sound, /mb login and /mb forget change things.

local function soundText()
  return ns.settings.sound and L["Sound is on."] or L["Sound is off."]
end

local function loginText()
  return ns.settings.login and L["Login list is on."] or L["Login list is off."]
end

local function help()
  ns.Print(L["/mb sound on|off plays the bell or not, /mb login on|off names your characters with mail at login, /mb forget Name-Realm removes a character."])
end

local function show()
  ns.Print(ns.WaitingText(ns.db.chars, ns.me, ns.MyRealm()) or L["No mail waiting on your other characters."])
  ns.Print(soundText() .. " " .. loginText())
  help()
end

local function forget(wanted)
  local key = ns.FindChar(ns.db.chars, wanted)
  if not key then
    ns.Print(string.format(L["No character called %s. Use Name-Realm."], wanted))
  elseif key == ns.me then
    ns.Print(L["You cannot forget the character you are playing."])
  else
    ns.db.chars[key] = nil
    ns.Print(string.format(L["%s forgotten."], key))
  end
end

SLASH_MAILBELL1 = "/mailbell"
SLASH_MAILBELL2 = "/mb"
SlashCmdList.MAILBELL = function(msg)
  if not ns.settings then return end
  local text = strtrim(msg or "")
  local cmd, rest = text:match("^(%S*)%s*(.-)$")
  cmd = (cmd or ""):lower()
  if cmd == "sound" or cmd == "login" then
    if ns.Switch(ns.settings, cmd, rest) == nil then
      help()
    else
      ns.Print(cmd == "sound" and soundText() or loginText())
    end
  elseif cmd == "forget" and rest ~= "" then
    forget(rest)
  else
    show()
  end
end
