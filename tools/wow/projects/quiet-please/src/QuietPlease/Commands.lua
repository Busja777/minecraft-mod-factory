local _, ns = ...
local L = ns.L

-- /quiet add, remove, list, label, play, on, off, the sound category switches and help.

function ns.Print(msg)
  DEFAULT_CHAT_FRAME:AddMessage("|cffffd100" .. L["Quiet Please"] .. ":|r " .. msg)
end

local function status()
  local n = ns.Count(ns.db.ids)
  if not ns.db.enabled then
    ns.Print(string.format(L["%d sound files on your list, switched off (/quiet on mutes them again)."], n))
  else
    ns.Print(string.format(L["%d sound files on your list, muted."], n))
  end
  local parts = {}
  for _, t in ipairs(ns.TOGGLES) do
    local on = ns.ToggleState(t)
    if on ~= nil then
      parts[#parts + 1] = string.format(L["%s: %s"], ns.ToggleName(t), on and L["on"] or L["off"])
    end
  end
  if #parts > 0 then ns.Print(table.concat(parts, ", ")) end
end

local function help()
  ns.Print(L["/quiet add 12345 67890 mutes sound files by their file ID, /quiet remove 12345 unmutes them, /quiet list shows your list, /quiet label 12345 text names a file, /quiet play 12345 plays a file once, /quiet off unmutes all, /quiet on mutes them again, /quiet errors, /quiet emotes and /quiet pets switch those sounds on or off."])
  status()
end

-- Parses the IDs after a command; prints what was not a file ID. Returns nil when nothing usable was typed.
local function readIDs(rest)
  local ids, bad = ns.ParseIDs(rest)
  if #bad > 0 then
    ns.Print(string.format(L["Not a sound file ID: %s. File IDs are whole numbers above 0."], table.concat(bad, ", ")))
  end
  if #ids == 0 then
    if #bad == 0 then help() end
    return nil
  end
  return ids
end

local function add(rest)
  local ids = readIDs(rest)
  if not ids then return end
  local added, known = ns.AddIDs(ns.db.ids, ids)
  if ns.db.enabled then
    for _, id in ipairs(added) do ns.Mute(id) end
  end
  if #added > 0 then
    if ns.db.enabled then
      ns.Print(string.format(L["Muted: %s."], ns.Join(added)))
    else
      ns.Print(string.format(L["Added: %s. They are muted when you type /quiet on."], ns.Join(added)))
    end
  end
  if #known > 0 then ns.Print(string.format(L["Already on your list: %s."], ns.Join(known))) end
  if not ns.CanMute() then ns.Print(L["This client cannot mute sound files, the list is only saved."]) end
end

local function remove(rest)
  local ids = readIDs(rest)
  if not ids then return end
  local removed, missing = ns.RemoveIDs(ns.db.ids, ids)
  for _, id in ipairs(removed) do ns.Unmute(id) end
  if #removed > 0 then ns.Print(string.format(L["Removed and unmuted: %s."], ns.Join(removed))) end
  if #missing > 0 then ns.Print(string.format(L["Not on your list: %s."], ns.Join(missing))) end
end

local function list()
  local lines = ns.ListLines(ns.db.ids)
  if #lines == 0 then
    ns.Print(L["Your list is empty. Add a sound file with /quiet add followed by its file ID."])
    return
  end
  status()
  for _, line in ipairs(lines) do ns.Print(line) end
end

local function label(rest)
  local token, text = rest:match("^(%S+)%s*(.-)$")
  local id = ns.ParseID(token)
  if not id then return help() end
  local result = ns.SetLabel(ns.db.ids, id, text)
  if result == false then
    ns.Print(string.format(L["Not on your list: %s."], id))
  elseif result then
    ns.Print(string.format(L["%d is now labelled: %s"], id, result))
  else
    ns.Print(string.format(L["Label of %d removed."], id))
  end
end

local function play(rest)
  local id = ns.ParseID(strtrim(rest))
  if not id then return help() end
  if ns.applied[id] then
    ns.Print(string.format(L["%d is muted. Use /quiet remove to hear it again."], id))
    return
  end
  if not PlaySoundFile then return end
  if PlaySoundFile(id, "Master") then
    ns.Print(string.format(L["Playing %d."], id))
  else
    ns.Print(string.format(L["The game could not play %d. It may be muted, or not a sound file."], id))
  end
end

local function switchAll(on)
  if on == ns.db.enabled then
    ns.Print(on and L["Your list is already muted."] or L["Your list is already switched off."])
    return
  end
  ns.db.enabled = on
  if on then
    ns.ApplyAll()
    ns.Print(string.format(L["Muted %d sound files again."], ns.Count(ns.db.ids)))
  else
    ns.UnmuteAll()
    ns.Print(L["All sound files on your list can be heard again until you type /quiet on."])
  end
end

local function toggle(t, word)
  local current = ns.ToggleState(t)
  local name = ns.ToggleName(t)
  if current == nil then
    ns.Print(string.format(L["%s cannot be switched on this client."], name))
    return
  end
  local wanted
  if word == "on" then wanted = true elseif word == "off" then wanted = false else wanted = not current end
  local now = ns.SetToggle(t, wanted)
  if now == nil or now ~= wanted then
    ns.Print(string.format(L["%s could not be changed right now."], name))
  else
    ns.Print(string.format(L["%s: %s"], name, now and L["on"] or L["off"]))
  end
end

SLASH_QUIETPLEASE1 = "/quietplease"
SLASH_QUIETPLEASE2 = "/quiet"
SlashCmdList.QUIETPLEASE = function(msg)
  if not ns.db then return end
  local cmd, rest = strtrim(msg or ""):match("^(%S*)%s*(.-)$")
  cmd = cmd:lower()
  if cmd == "add" then
    add(rest)
  elseif cmd == "remove" then
    remove(rest)
  elseif cmd == "list" then
    list()
  elseif cmd == "label" then
    label(rest)
  elseif cmd == "play" then
    play(rest)
  elseif cmd == "on" or cmd == "off" then
    switchAll(cmd == "on")
  elseif ns.FindToggle(cmd) then
    toggle(ns.FindToggle(cmd), rest:lower())
  else
    help()
  end
end
