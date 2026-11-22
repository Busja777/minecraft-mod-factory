local _, ns = ...
local L = ns.L

-- Chat commands. Everything is printed to the chat window; there is no window of its own yet.

local GREY = "|cff9d9d9d"

local function print(msg)
  DEFAULT_CHAT_FRAME:AddMessage("|cffffd100" .. L["Fishing Log"] .. ":|r " .. msg)
end

local function zoneList(list)
  local parts = {}
  for _, z in ipairs(list) do
    parts[#parts + 1] = ns.ZoneLabel(z.zone) .. " " .. z.catches
  end
  return table.concat(parts, ", ")
end

function ns.Summary()
  local s = ns.session
  if s.catches == 0 then
    return { L["No catches yet this session."] }
  end
  local lines = {
    string.format(L["This session: %d catches, %d items, %s per hour."], s.catches, s.items, ns.RateText(ns.PerHour(s, GetTime()))),
    string.format(L["Top zones: %s."], zoneList(ns.SortedZones(s.zones, ns.TOP_ZONES))),
  }
  if not ns.PerHour(s, GetTime()) then
    lines[#lines + 1] = GREY .. L["The rate shows after two catches and five minutes of fishing."] .. "|r"
  end
  return lines
end

function ns.ZoneLines()
  local list = ns.SortedZones(ns.db.zones)
  if #list == 0 then return { L["No catches recorded yet."] } end
  local catches, items = ns.Totals(ns.db.zones)
  local lines = { string.format(L["All-time catches per zone (%d catches, %d items):"], catches, items) }
  for _, z in ipairs(list) do
    lines[#lines + 1] = string.format(L["  %s: %d catches, %d items"], ns.ZoneLabel(z.zone), z.catches, z.items)
  end
  return lines
end

SLASH_FISHINGLOG1 = "/fishinglog"
SLASH_FISHINGLOG2 = "/fl"
SlashCmdList.FISHINGLOG = function(msg)
  if not ns.db then return end
  local cmd = strtrim(msg or ""):lower()
  local lines
  if cmd == "" then
    lines = ns.Summary()
  elseif cmd == "reset" then
    ns.NewSessionNow()
    lines = { L["Session started again."] }
  elseif cmd == "zones" then
    lines = ns.ZoneLines()
  else
    lines = { L["/fl shows this session, /fl zones lists all catches per zone, /fl reset starts a new session."] }
  end
  for _, line in ipairs(lines) do print(line) end
end
