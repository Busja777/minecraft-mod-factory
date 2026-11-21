local _, ns = ...
local L = ns.L

-- /pd shows the state; duels, invites, quiet and whisper switch on or off; allow, unallow and list
-- keep the allow list; whisper text and whisper reset set the reply.

local HELP = "/pd duels on/off, /pd invites on/off, /pd quiet on/off, /pd allow Name, /pd unallow Name, /pd list."
local WHISPER_HELP = "/pd whisper on or off sends declined strangers a short polite whisper, /pd whisper text Your words sets it, /pd whisper reset brings back the default."

local SWITCHES = {
  duels = { on = "Declining duels from strangers is on.", off = "Declining duels from strangers is off." },
  invites = { on = "Declining group invites from strangers is on.", off = "Declining group invites from strangers is off." },
  quiet = { on = "Quiet mode is on: nothing is said in chat.", off = "Quiet mode is off." },
  whisper = { on = "Reply whisper is on.", off = "Reply whisper is off." },
}

local function switchText(key)
  local texts = SWITCHES[key]
  return ns.settings[key] and L[texts.on] or L[texts.off]
end

local function help()
  ns.Print(L[HELP])
  ns.Print(L[WHISPER_HELP])
end

local function showState()
  ns.Print(switchText("duels") .. " " .. switchText("invites") .. " " .. switchText("quiet") .. " " .. switchText("whisper"))
  help()
end

local function replyText()
  ns.Print(string.format(L["Reply text: %s"], ns.WhisperText()))
end

-- /pd whisper, /pd whisper text ..., /pd whisper reset (on and off are plain switches).
local function whisper(rest)
  local sub, words = rest:match("^(%S*)%s*(.-)$")
  sub = (sub or ""):lower()
  if sub == "" then
    ns.Print(switchText("whisper"))
    replyText()
  elseif sub == "text" and words == "" then
    replyText()
  elseif sub == "text" then
    local text, why = ns.CleanWhisper(words)
    if not text then
      if why == "long" then return ns.Print(string.format(L["That text is too long: %d characters at most."], ns.WHISPER_MAX)) end
      return help()
    end
    ns.settings.whisperText = text
    replyText()
  elseif sub == "reset" then
    ns.settings.whisperText = nil
    replyText()
  else
    help()
  end
end

local function allow(name)
  local key = ns.NameKey(name)
  if not key then return ns.Print(L["Type a name: /pd allow Name or Name-Realm."]) end
  name = strtrim(name)
  if ns.db.allow[key] then return ns.Print(string.format(L["%s is already on your allow list."], ns.db.allow[key])) end
  ns.db.allow[key] = name
  ns.Print(string.format(L["%s is now on your allow list."], name))
end

local function unallow(name)
  local key = ns.NameKey(name)
  if not key then return ns.Print(L["Type a name: /pd unallow Name or Name-Realm."]) end
  local shown = ns.db.allow[key]
  if not shown then return ns.Print(string.format(L["%s is not on your allow list."], strtrim(name))) end
  ns.db.allow[key] = nil
  ns.Print(string.format(L["%s was removed from your allow list."], shown))
end

local function list()
  local names = ns.AllowNames(ns.db.allow)
  if #names == 0 then return ns.Print(L["Your allow list is empty."]) end
  ns.Print(string.format(L["Allow list: %s."], table.concat(names, ", ")))
end

SLASH_POLITEDECLINE1 = "/politedecline"
SLASH_POLITEDECLINE2 = "/pd"
SlashCmdList.POLITEDECLINE = function(msg)
  if not ns.settings then return end
  local text = strtrim(msg or "")
  local cmd, rest = text:match("^(%S+)%s*(.-)$")
  cmd = cmd and cmd:lower() or ""
  local value = rest and rest:lower() or ""
  if cmd == "" then
    showState()
  elseif SWITCHES[cmd] and (value == "on" or value == "off") then
    ns.settings[cmd] = value == "on"
    ns.Print(switchText(cmd))
    if cmd == "whisper" and ns.settings.whisper then replyText() end
  elseif cmd == "allow" then
    allow(rest)
  elseif cmd == "unallow" then
    unallow(rest)
  elseif cmd == "list" then
    list()
  elseif cmd == "whisper" then
    whisper(rest)
  else
    help()
  end
end
