local _, ns = ...
local L = ns.L

-- /zn shows the notes of the zone you are in; add, list, remove, all, window, popup, quiet and help do the rest.

local function help()
  ns.Print(L["/zn add <text> notes something for this zone, /zn list shows its notes, /zn remove <number> deletes one, /zn all lists every zone with notes, /zn window opens the notes window, /zn popup on or off switches the window on arrival, /zn quiet on or off switches the chat lines on arrival."])
end

local function noZone()
  ns.Print(L["The game does not tell which zone you are in right now. Try again in a moment."])
end

local function list(key, name)
  if key == nil then return noZone() end
  if #ns.NotesOf(ns.Zones(), key, name) == 0 then
    ns.Print(string.format(L["No notes for %s yet. Add one with /zn add <text>."], name or ns.ZoneName(nil, key)))
    return
  end
  ns.PrintNotes(key, name)
end

local function add(key, name, rest)
  local index, why = ns.AddNote(ns.Zones(), key, name, rest, time())
  if not index then
    if why == "nozone" then
      noZone()
    elseif why == "full" then
      ns.Print(string.format(L["This zone already has %d notes. Remove one with /zn remove <number> first."], ns.MAX_NOTES))
    else
      ns.Print(L["Type the note after the command: /zn add <text>."])
    end
    return
  end
  local label = ns.ZoneName(ns.Entry(ns.Zones(), key, name, false), key)
  ns.Print(string.format(L["Note %d for %s saved."], index, label))
  if why then ns.Print(string.format(L["Notes are kept to %d characters, the rest was cut."], ns.MAX_LEN)) end
  ns.Refresh(key)
end

local function remove(key, name, rest)
  if key == nil then return noZone() end
  local count = #ns.NotesOf(ns.Zones(), key, name)
  if count == 0 then
    ns.Print(string.format(L["No notes for %s yet. Add one with /zn add <text>."], name or ns.ZoneName(nil, key)))
    return
  end
  local removed = ns.RemoveNote(ns.Zones(), key, name, rest)
  if not removed then
    ns.Print(string.format(L["Use /zn remove <number> with a number from 1 to %d, see /zn list."], count))
    return
  end
  ns.Print(string.format(L["Removed: %s"], removed))
  ns.Refresh(key)
end

local function all()
  local rows = ns.ZoneList(ns.Zones())
  if #rows == 0 then
    ns.Print(L["You have no notes yet. Add one with /zn add <text>."])
    return
  end
  ns.Print(string.format(L["Zones with notes: %d"], #rows))
  for _, row in ipairs(rows) do ns.Print(string.format(L["%s: %d"], row.name, row.count)) end
end

-- /zn popup and /zn quiet: "on" sets the setting, "off" clears it, nothing just tells its state.
local function onOff(setting, rest, usage, onText, offText)
  local s = ns.db.settings
  if rest == "on" then
    s[setting] = true
  elseif rest == "off" then
    s[setting] = false
  elseif rest ~= "" then
    ns.Print(usage)
    return
  end
  ns.Print(s[setting] and onText or offText)
end

SLASH_ZONENOTES1 = "/zonenotes"
SLASH_ZONENOTES2 = "/zn"
SlashCmdList.ZONENOTES = function(msg)
  if not ns.db then return end
  local cmd, rest = strtrim(msg or ""):match("^(%S*)%s*(.-)$")
  cmd = (cmd or ""):lower()
  rest = rest or ""
  local key, name = ns.CurrentZone()
  if cmd == "add" then
    add(key, name, rest)
  elseif cmd == "list" then
    list(key, name)
  elseif cmd == "remove" then
    remove(key, name, rest)
  elseif cmd == "all" then
    all()
  elseif cmd == "window" then
    ns.Toggle(key, name)
  elseif cmd == "popup" then
    onOff("popup", rest:lower(), L["Use /zn popup on or /zn popup off."],
      L["The notes window opens when you enter a zone with notes."],
      L["The notes window stays closed when you enter a zone."])
  elseif cmd == "quiet" then
    onOff("quiet", rest:lower(), L["Use /zn quiet on or /zn quiet off."],
      L["No chat lines when you enter a zone."],
      L["Your notes show in chat when you enter a zone."])
  elseif cmd == "help" then
    help()
  else
    list(key, name)
    help()
  end
end
