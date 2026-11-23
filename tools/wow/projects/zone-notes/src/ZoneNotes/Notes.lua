local _, ns = ...
local L = ns.L

-- Reads where the player is and shows the notes of that zone on arrival: a chat line per note and,
-- if switched on, the small window. Notes are shared by all characters of the account.

ns.last = nil -- { key, name } of the zone whose arrival was handled last

function ns.Print(msg)
  DEFAULT_CHAT_FRAME:AddMessage("|cffffd100" .. L["Zone Notes"] .. ":|r " .. msg)
end

-- A value read from the game; nil when the function is missing or fails.
local function read(fn, ...)
  if not fn then return nil end
  local ok, a = pcall(fn, ...)
  if not ok then return nil end
  return a
end

local function mapInfo(id)
  local info = read(C_Map and C_Map.GetMapInfo, id)
  if type(info) ~= "table" then return nil end
  return info
end

-- The zone the player is in now: (key, name), or nil.
function ns.CurrentZone()
  local mapID = read(C_Map and C_Map.GetBestMapForUnit, "player")
  return ns.ZoneOf(mapID, mapInfo, read(GetRealZoneText))
end

function ns.Zones()
  return ns.db and ns.db.zones or {}
end

-- Shows the notes of a zone in chat: a heading, then one line per note.
function ns.PrintNotes(key, name)
  local notes = ns.NotesOf(ns.Zones(), key, name)
  local label = ns.ZoneName(ns.Entry(ns.Zones(), key, name, false), key)
  ns.Print(string.format(L["Your notes for %s:"], label))
  for _, line in ipairs(ns.NumberedLines(notes)) do ns.Print(line) end
end

-- Arrival in a zone (login, loading screen, new area). The same zone twice in a row stays quiet.
function ns.OnZone()
  if not ns.db then return end
  local key, name = ns.CurrentZone()
  if key == nil then return end
  if ns.SamePlace(ns.last, key, name) then
    ns.last.key, ns.last.name = key, name or ns.last.name
    return
  end
  ns.last = { key = key, name = name }
  local notes = ns.NotesOf(ns.Zones(), key, name)
  if #notes == 0 then
    if ns.HideWindow then ns.HideWindow() end
    return
  end
  if not ns.db.settings.quiet then ns.PrintNotes(key, name) end
  if ns.db.settings.popup and ns.ShowWindow then ns.ShowWindow(key, name) end
end

local function onLogin()
  ZoneNotesDB = ZoneNotesDB or {}
  local db = ZoneNotesDB
  db.version = 1
  if type(db.zones) ~= "table" then db.zones = {} end
  if type(db.settings) ~= "table" then db.settings = {} end
  if db.settings.quiet == nil then db.settings.quiet = false end
  if db.settings.popup == nil then db.settings.popup = true end
  ns.db = db
  ns.last = nil
end

local frame = CreateFrame("Frame")
ns.eventFrame = frame

frame:SetScript("OnEvent", function(_, event)
  if event == "PLAYER_LOGIN" then
    onLogin()
  elseif event == "PLAYER_ENTERING_WORLD" or event == "ZONE_CHANGED_NEW_AREA" then
    ns.OnZone()
  end
end)

for _, event in ipairs({ "PLAYER_LOGIN", "PLAYER_ENTERING_WORLD", "ZONE_CHANGED_NEW_AREA" }) do
  pcall(frame.RegisterEvent, frame, event)
end
