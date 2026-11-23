local _, ns = ...
local L = ns.L

-- Pure bookkeeping: no frames, no events. Everything here runs outside the game in the tests.
--
-- Saved notes: zones[key] = { name = "Elwynn Forest", notes = { { text = "...", t = time } } }
-- The key is the zone's uiMapID (a number). When the game gives no map, the zone name (a string)
-- is the key; such an entry moves to the map ID as soon as the same zone is seen with one.

ns.MAX_LEN = 200    -- characters (bytes) per note
ns.MAX_NOTES = 10   -- notes per zone
ns.MAX_UP = 5       -- steps from a small map (a cave, a building) up to its zone

function ns.IsSecret(value)
  return issecretvalue ~= nil and issecretvalue(value) and true or false
end

-- A text read from the game; nil when it is secret, missing or empty.
function ns.CleanText(value)
  if value == nil or ns.IsSecret(value) or type(value) ~= "string" then return nil end
  local s = value:gsub("^%s+", ""):gsub("%s+$", "")
  if s == "" then return nil end
  return s
end

-- A map ID read from the game; nil when it is secret, missing or not a positive whole number.
function ns.CleanMapID(value)
  if value == nil or ns.IsSecret(value) or type(value) ~= "number" then return nil end
  if value ~= value or value < 1 or value ~= math.floor(value) then return nil end
  return value
end

local function microType()
  local t = Enum and Enum.UIMapType and Enum.UIMapType.Micro
  if type(t) == "number" then return t end
  return 5
end

-- The zone the player is in: (key, name).
-- mapID is the best map for the player, getInfo(id) returns { name, mapType, parentMapID } or nil,
-- fallbackName is the zone text of the game. Small maps inside a zone (mapType Micro) count as
-- their zone. Returns nil when neither a map nor a name is known.
function ns.ZoneOf(mapID, getInfo, fallbackName)
  local id = ns.CleanMapID(mapID)
  local name
  if id and getInfo then
    local info = getInfo(id)
    for _ = 1, ns.MAX_UP do
      if type(info) ~= "table" or ns.IsSecret(info.mapType) or info.mapType ~= microType() then break end
      local parent = ns.CleanMapID(info.parentMapID)
      if not parent then break end
      local up = getInfo(parent)
      if type(up) ~= "table" then break end
      id, info = parent, up
    end
    if type(info) == "table" then name = ns.CleanText(info.name) end
  end
  name = name or ns.CleanText(fallbackName)
  if id then return id, name end
  if name then return name, name end
  return nil
end

-- A note as typed: trimmed, inner whitespace folded, no "|" (the game's escape character), cut to
-- MAX_LEN without splitting a letter. Returns (text, cut) or nil when nothing is left.
function ns.CleanNote(text)
  if type(text) ~= "string" then return nil end
  local s = text:gsub("|", ""):gsub("%s+", " "):gsub("^ ", ""):gsub(" $", "")
  if s == "" then return nil end
  if #s <= ns.MAX_LEN then return s, false end
  local stop = ns.MAX_LEN
  -- step back over UTF-8 continuation bytes so a letter is not cut in half
  while stop > 0 and s:byte(stop + 1) and s:byte(stop + 1) >= 128 and s:byte(stop + 1) < 192 do stop = stop - 1 end
  s = s:sub(1, stop):gsub(" $", "")
  return s, true
end

-- The saved entry of a zone. A name-keyed entry of the same zone moves to its map ID.
-- With create, a missing entry is made. The stored name follows the newest name the game gave.
function ns.Entry(zones, key, name, create)
  if key == nil then return nil end
  local entry = zones[key]
  if not entry and type(key) == "number" and name and type(zones[name]) == "table" then
    entry = zones[name]
    zones[name] = nil
    zones[key] = entry
  end
  if not entry and create then
    entry = { notes = {} }
    zones[key] = entry
  end
  if entry then
    entry.notes = entry.notes or {}
    if name then entry.name = name end
  end
  return entry
end

function ns.ZoneName(entry, key)
  if entry and entry.name then return entry.name end
  if type(key) == "string" then return key end
  return L["Unknown zone"]
end

-- Adds a note. Returns (index, cut) or (nil, reason) with reason "empty", "full" or "nozone".
function ns.AddNote(zones, key, name, text, when)
  if key == nil then return nil, "nozone" end
  local clean, cut = ns.CleanNote(text)
  if not clean then return nil, "empty" end
  local entry = ns.Entry(zones, key, name, false)
  if entry and #entry.notes >= ns.MAX_NOTES then return nil, "full" end
  entry = entry or ns.Entry(zones, key, name, true)
  local t = nil
  if type(when) == "number" and not ns.IsSecret(when) then t = when end
  entry.notes[#entry.notes + 1] = { text = clean, t = t }
  return #entry.notes, cut
end

-- Removes note n of a zone; a zone without notes is dropped. Returns the removed text or nil.
function ns.RemoveNote(zones, key, name, n)
  local entry = ns.Entry(zones, key, name, false)
  n = tonumber(n)
  if not entry or not n or n ~= math.floor(n) or n < 1 or n > #entry.notes then return nil end
  local removed = table.remove(entry.notes, n)
  if #entry.notes == 0 then zones[key] = nil end
  return removed.text
end

-- The notes of a zone (an empty list when it has none).
function ns.NotesOf(zones, key, name)
  local entry = ns.Entry(zones, key, name, false)
  return entry and entry.notes or {}
end

-- Every zone with notes: { { key, name, count } }, by name.
function ns.ZoneList(zones)
  local rows = {}
  for key, entry in pairs(zones) do
    if type(entry) == "table" and type(entry.notes) == "table" and #entry.notes > 0 then
      rows[#rows + 1] = { key = key, name = ns.ZoneName(entry, key), count = #entry.notes }
    end
  end
  table.sort(rows, function(a, b)
    if a.name ~= b.name then return a.name < b.name end
    return tostring(a.key) < tostring(b.key)
  end)
  return rows
end

-- "1. Herbs behind the inn" for every note.
function ns.NumberedLines(notes)
  local out = {}
  for i, note in ipairs(notes) do out[i] = string.format(L["%d. %s"], i, note.text) end
  return out
end

-- True when (key, name) is the place shown last, so a second event for the same arrival is quiet.
function ns.SamePlace(last, key, name)
  if not last then return false end
  if key ~= nil and last.key == key then return true end
  if type(key) == "number" and type(last.key) == "number" then return false end -- two maps, one name
  return name ~= nil and last.name == name
end
