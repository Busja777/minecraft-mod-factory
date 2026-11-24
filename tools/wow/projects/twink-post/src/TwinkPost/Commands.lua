local _, ns = ...
local L = ns.L

-- /twinkpost lists the characters Twink Post knows, /twinkpost forget removes one.

function ns.Print(msg)
  DEFAULT_CHAT_FRAME:AddMessage("|cffffd100" .. L["Twink Post"] .. ":|r " .. msg)
end

local function line(text)
  DEFAULT_CHAT_FRAME:AddMessage("  " .. text)
end

local function help()
  ns.Print(L["/twinkpost lists your characters, /twinkpost forget Name or Name-Realm removes one. At a mailbox, the button next to the recipient box on the Send Mail tab fills in one of them."])
end

-- Every known character with level, realm and faction; the one being played is marked.
local function list()
  local all = ns.AllCharacters(ns.db.chars)
  ns.Print(string.format(L["Known characters: %d"], #all))
  for _, entry in ipairs(all) do
    local c = entry.c
    local text = ns.ClassColored(c.name, c.class) .. " - " .. c.realm
    local level, faction = ns.LevelText(c.level), ns.FactionName(c.faction)
    if level then text = text .. ", " .. level end
    if faction then text = text .. ", " .. faction end
    if entry.key == ns.me then text = text .. " " .. L["(this character)"] end
    line(text)
  end
end

-- The menu in chat, for a client without the game's menu system.
function ns.PrintCandidates()
  local me = ns.Me()
  local candidates = ns.CurrentCandidates()
  if #candidates == 0 then
    ns.Print(L["No other character known here yet. Log in once with each of your characters."])
    return
  end
  for _, entry in ipairs(candidates) do line(ns.Label(entry, me.realmKey, me.faction)) end
end

local function forget(wanted)
  local result, key = ns.Forget(ns.db.chars, wanted, ns.me)
  if result == "forgotten" then
    ns.Print(string.format(L["%s forgotten."], key))
  elseif result == "self" then
    ns.Print(L["You cannot forget the character you are playing."])
  elseif result == "several" then
    ns.Print(string.format(L["Several characters are called %s. Use Name-Realm."], wanted))
  else
    ns.Print(string.format(L["No character called %s."], wanted))
  end
end

SLASH_TWINKPOST1 = "/twinkpost"
SLASH_TWINKPOST2 = "/tp"
SlashCmdList.TWINKPOST = function(msg)
  if not ns.db then return end
  local text = strtrim(msg or "")
  local cmd, rest = text:match("^(%S*)%s*(.-)$")
  cmd = (cmd or ""):lower()
  if cmd == "" or cmd == "list" then
    list()
    help()
  elseif cmd == "forget" and rest ~= "" then
    forget(rest)
  else
    help()
  end
end
