local _, ns = ...
local L = ns.L

-- /mb note, /mb forget, /mb list and /mb help.

local function help()
  ns.Print(L["/mb list shows the last 10 players you grouped with, /mb note Name-Realm text sets your note (no text removes it), /mb note target text notes your target, /mb forget Name-Realm removes a player."])
end

local function notUnique(typed, names)
  ns.Print(string.format(L["Several players are called %s, add the realm: %s."], typed, table.concat(names, ", ")))
end

local function setNote(typed, text)
  local p, _, names = ns.SetNote(ns.db.people, typed, text, ns.HomeRealm())
  if names then return notUnique(typed, names) end
  if not p then
    if ns.CleanNote(text) then
      ns.Print(string.format(L["%s is not a name the addon can use."], typed))
    else
      ns.Print(string.format(L["No note on %s to remove."], typed))
    end
    return
  end
  if p.note then
    ns.Print(string.format(L["Note on %s: %s"], p.name, p.note))
  else
    ns.Print(string.format(L["Note on %s removed."], p.name))
  end
end

local function note(rest)
  local who, text = ns.SplitNameAndText(ns.db.people, rest, ns.HomeRealm())
  if not who then return help() end
  if who:lower() == "target" then
    local name, realm = ns.UnitPlayer("target")
    if not name then
      ns.Print(L["Your target is not a player whose name the game shows right now."])
      return
    end
    who = ns.DisplayName(name, realm, ns.HomeRealm())
  end
  setNote(who, text)
end

local function forget(rest)
  local typed = strtrim(rest)
  if typed == "" then return help() end
  local key, names = ns.Find(ns.db.people, typed, ns.HomeRealm())
  if not key then
    if names and #names > 1 then return notUnique(typed, names) end
    ns.Print(string.format(L["No player called %s is remembered."], typed))
    return
  end
  local name = ns.db.people[key].name or typed
  ns.db.people[key] = nil
  local session = ns.db.session
  if session then
    session.skip = session.skip or {}
    session.skip[key] = true -- stays out while this group lasts
  end
  ns.Print(string.format(L["%s forgotten."], name))
end

local function list()
  local rows = ns.Recent(ns.db.people, ns.LIST)
  if #rows == 0 then
    ns.Print(L["No players remembered yet. Join a group and they appear here."])
    return
  end
  local now = ns.Read(time) or 0
  ns.Print(string.format(L["The last %d players you grouped with, newest first:"], #rows))
  for _, p in ipairs(rows) do ns.Print(ns.ListText(p, now)) end
end

SLASH_METBEFORE1 = "/metbefore"
SLASH_METBEFORE2 = "/mb"
SlashCmdList.METBEFORE = function(msg)
  if not ns.db then return end
  local cmd, rest = strtrim(msg or ""):match("^(%S*)%s*(.-)$")
  cmd = cmd:lower()
  if cmd == "note" then
    note(rest)
  elseif cmd == "forget" then
    forget(rest)
  elseif cmd == "list" then
    list()
  else
    help()
  end
end
