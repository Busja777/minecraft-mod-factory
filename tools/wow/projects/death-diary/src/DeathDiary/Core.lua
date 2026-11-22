local _, ns = ...
local L = ns.L

-- Pure bookkeeping: no frames, no events. Everything here runs outside the game in the tests.

ns.MAX_ENTRIES = 500 -- deaths kept per character, the oldest go first
ns.REPEAT = 5        -- seconds in which a second death event counts as the same death
ns.BRACKET = 10      -- levels per bracket: 1-10, 11-20, ...
ns.TOP_ZONES = 5     -- zones in the chat summary
ns.LAST = 10         -- deaths listed by /dd last

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

-- A level read from the game; nil when it is secret, missing or not a positive whole number.
function ns.CleanLevel(value)
  if value == nil or ns.IsSecret(value) or type(value) ~= "number" then return nil end
  if value ~= value or value < 1 or value > 1000 then return nil end
  return math.floor(value)
end

-- "Name-Realm", or nil while the game does not know one of the two.
function ns.MakeCharKey(name, realm)
  name, realm = ns.CleanText(name), ns.CleanText(realm)
  if not name or not realm then return nil end
  return name .. "-" .. realm
end

-- One death. The sub-zone is left out when it is the zone itself.
function ns.NewEntry(zone, subZone, level, when)
  zone, subZone = ns.CleanText(zone), ns.CleanText(subZone)
  if subZone and subZone == zone then subZone = nil end
  local t = nil
  if type(when) == "number" and not ns.IsSecret(when) then t = when end
  return { t = t, zone = zone, sub = subZone, level = ns.CleanLevel(level) }
end

-- guard = { at = seconds of the last counted death, waiting = true until the player is alive again }
-- Returns true when a death event at `now` is a new death.
function ns.IsNewDeath(guard, now)
  if guard.waiting and guard.at and now >= guard.at and now - guard.at < ns.REPEAT then return false end
  return true
end

function ns.Push(list, entry, cap)
  list[#list + 1] = entry
  local over = #list - (cap or ns.MAX_ENTRIES)
  if over > 0 then
    for _ = 1, over do table.remove(list, 1) end
  end
end

function ns.ZoneName(entry)
  return entry.zone or L["Unknown zone"]
end

-- Deaths per zone, most deaths first, then by name.
function ns.ByZone(list)
  local counts, rows = {}, {}
  for _, e in ipairs(list) do
    local name = ns.ZoneName(e)
    if not counts[name] then
      counts[name] = { name = name, count = 0 }
      rows[#rows + 1] = counts[name]
    end
    counts[name].count = counts[name].count + 1
  end
  table.sort(rows, function(a, b)
    if a.count ~= b.count then return a.count > b.count end
    return a.name < b.name
  end)
  return rows
end

-- The bracket of a level: 1-10 -> 1, 11-20 -> 11, ...
function ns.BracketStart(level, size)
  size = size or ns.BRACKET
  return math.floor((level - 1) / size) * size + 1
end

-- Deaths per level bracket, lowest bracket first; deaths without a level are counted apart.
function ns.ByBracket(list, size)
  size = size or ns.BRACKET
  local counts, rows, unknown = {}, {}, 0
  for _, e in ipairs(list) do
    if e.level then
      local from = ns.BracketStart(e.level, size)
      if not counts[from] then
        counts[from] = { from = from, to = from + size - 1, count = 0 }
        rows[#rows + 1] = counts[from]
      end
      counts[from].count = counts[from].count + 1
    else
      unknown = unknown + 1
    end
  end
  table.sort(rows, function(a, b) return a.from < b.from end)
  return rows, unknown
end

-- The newest `n` deaths, newest first.
function ns.Last(list, n)
  local out = {}
  for i = #list, math.max(1, #list - (n or ns.LAST) + 1), -1 do out[#out + 1] = list[i] end
  return out
end

function ns.PlaceText(entry)
  if entry.sub then return string.format(L["%s, %s"], ns.ZoneName(entry), entry.sub) end
  return ns.ZoneName(entry)
end

function ns.LevelText(level)
  if not level then return L["unknown level"] end
  return string.format(L["level %d"], level)
end

function ns.WhenText(t)
  if not t then return L["unknown time"] end
  return date(L["%b %d %H:%M"], t)
end

-- "Nov 20 18:00: Elwynn Forest, Goldshire, level 12"
function ns.EntryText(entry)
  return string.format(L["%s: %s, %s"], ns.WhenText(entry.t), ns.PlaceText(entry), ns.LevelText(entry.level))
end

function ns.BracketText(row)
  return string.format(L["Levels %d-%d: %d"], row.from, row.to, row.count)
end

-- The chat summary as a list of lines.
function ns.SummaryLines(list)
  if #list == 0 then return { L["No deaths noted for this character yet."] } end
  local lines = { string.format(L["Deaths noted for this character: %d."], #list) }
  local zones = ns.ByZone(list)
  local top = {}
  for i = 1, math.min(ns.TOP_ZONES, #zones) do
    top[#top + 1] = string.format(L["%s (%d)"], zones[i].name, zones[i].count)
  end
  lines[#lines + 1] = L["Top zones: "] .. table.concat(top, ", ") .. "."
  local brackets, unknown = ns.ByBracket(list)
  local parts = {}
  for _, row in ipairs(brackets) do parts[#parts + 1] = ns.BracketText(row) end
  if unknown > 0 then parts[#parts + 1] = string.format(L["unknown level: %d"], unknown) end
  lines[#lines + 1] = L["By level: "] .. table.concat(parts, ", ") .. "."
  return lines
end

-- The note in chat right after a death.
function ns.DeathNote(entry, count)
  return string.format(L["Death %d noted: %s, %s."], count, ns.PlaceText(entry), ns.LevelText(entry.level))
end
