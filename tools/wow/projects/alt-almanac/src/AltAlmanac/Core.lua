local _, ns = ...

-- Pure bookkeeping: no frames, no events. Everything here runs outside the game in the tests.
-- A character entry is { class, level, money, zone, subzone, rested, resting, maxLevel, seen,
-- played, playedAt }: played is the total time played in seconds as it was at the time playedAt.

ns.MAX_ROWS = 15
ns.RESTED_CAP = 150                    -- the game stores at most one and a half levels
ns.RESTED_PER_SECOND = 5 / (8 * 3600)  -- percent of a level, resting in an inn or a city
ns.OUTSIDE_FACTOR = 0.25               -- logged out anywhere else

function ns.IsSecret(value)
  return issecretvalue ~= nil and issecretvalue(value) and true or false
end

-- Rested XP as a percentage of the whole level.
function ns.RestedPercent(rested, max)
  if not rested or not max or max <= 0 then return nil end
  return math.floor(rested * 100 / max + 0.5)
end

-- The rested bonus a character has by now, from what was stored when it was last seen.
function ns.RestedEstimate(percent, resting, elapsed)
  if not percent then return nil end
  if not elapsed or elapsed <= 0 then return percent end
  local rate = ns.RESTED_PER_SECOND
  if not resting then rate = rate * ns.OUTSIDE_FACTOR end
  local value = percent + rate * elapsed
  if value > ns.RESTED_CAP then value = ns.RESTED_CAP end
  if percent > value then return percent end -- never lower than what was stored
  return value
end

-- "now", "12m", "3h", "2d".
function ns.RelativeTime(seconds)
  if not seconds then return "?" end
  if seconds < 60 then return ns.L["now"] end
  if seconds < 3600 then return string.format(ns.L["%dm"], math.floor(seconds / 60)) end
  if seconds < 86400 then return string.format(ns.L["%dh"], math.floor(seconds / 3600)) end
  return string.format(ns.L["%dd"], math.floor(seconds / 86400))
end

-- Played time: "45m", "5h 12m", "12d 4h".
function ns.PlayedText(seconds)
  if type(seconds) ~= "number" or seconds < 0 then return nil end
  if seconds < 3600 then return string.format(ns.L["%dm"], math.floor(seconds / 60)) end
  if seconds < 86400 then
    return string.format(ns.L["%dh %dm"], math.floor(seconds / 3600), math.floor(seconds % 3600 / 60))
  end
  return string.format(ns.L["%dd %dh"], math.floor(seconds / 86400), math.floor(seconds % 86400 / 3600))
end

-- The played time of one character by now: the character you play keeps counting since the
-- reading, everyone else stands still while logged out. nil until it was read once.
function ns.PlayedNow(c, current, now)
  if type(c.played) ~= "number" then return nil end
  if current and type(c.playedAt) == "number" and now and now > c.playedAt then
    return c.played + (now - c.playedAt)
  end
  return c.played
end

local function thousands(n)
  local s = tostring(n)
  local out = s:reverse():gsub("(%d%d%d)", "%1,"):reverse()
  return (out:gsub("^,", ""))
end

function ns.PlainMoney(copper)
  local sign = copper < 0 and "-" or ""
  copper = math.abs(copper)
  local g = math.floor(copper / 10000)
  local s = math.floor(copper / 100) % 100
  local c = copper % 100
  if g > 0 then return string.format("%s%sg %02ds %02dc", sign, thousands(g), s, c) end
  if s > 0 then return string.format("%s%ds %02dc", sign, s, c) end
  return string.format("%s%dc", sign, c)
end

function ns.FormatMoney(copper)
  if copper == 0 then return "0" end
  if GetMoneyString then
    local text = GetMoneyString(math.abs(copper), true)
    return copper < 0 and ("-" .. text) or text
  end
  return ns.PlainMoney(copper)
end

function ns.ClassColored(name, classFile)
  local color = RAID_CLASS_COLORS and classFile and RAID_CLASS_COLORS[classFile]
  if color and color.colorStr then return "|c" .. color.colorStr .. name .. "|r" end
  return name
end

-- "Zone - Subzone", or just the zone when there is no subzone of its own.
function ns.PlaceText(zone, subzone)
  if not zone or zone == "" then return nil end
  if subzone and subzone ~= "" and subzone ~= zone then return zone .. " - " .. subzone end
  return zone
end

function ns.SplitKey(key)
  local name, realm = key:match("^(.-)%-(.+)$")
  return name or key, realm or ""
end

-- One row per character: highest level first, then by name. Also returns the gold of all of them
-- and the played time of all whose time is known (nil when nobody's is).
function ns.BuildRows(chars, currentKey, now)
  local rows, total, played = {}, 0, nil
  for key, c in pairs(chars) do
    local name, realm = ns.SplitKey(key)
    local current = key == currentKey
    local elapsed = (not current and c.seen) and (now - c.seen) or 0
    local rested
    if c.maxLevel then
      rested = 0
    else
      rested = ns.RestedEstimate(c.rested, c.resting, elapsed)
    end
    rows[#rows + 1] = {
      key = key, name = name, realm = realm, class = c.class, level = c.level, money = c.money,
      place = ns.PlaceText(c.zone, c.subzone), rested = rested, resting = c.resting and true or false,
      maxLevel = c.maxLevel and true or false, current = current,
      ago = current and 0 or (c.seen and math.max(now - c.seen, 0) or nil),
      played = ns.PlayedNow(c, current, now),
    }
    total = total + (c.money or 0)
    if rows[#rows].played then played = (played or 0) + rows[#rows].played end
  end
  table.sort(rows, function(a, b)
    local la, lb = a.level or 0, b.level or 0
    if la ~= lb then return la > lb end
    local na, nb = a.name:lower(), b.name:lower()
    if na ~= nb then return na < nb end
    return a.key < b.key
  end)
  return rows, total, played
end

-- 1.2: sorting by any column and filtering.
-- The columns that can be sorted, with their first direction: true = highest first.
ns.SORT_DESC = { name = false, level = true, gold = true, zone = false, rested = true, played = true, seen = false }
ns.DEFAULT_SORT = "level"
ns.MIN_LEVEL_LIMIT = 100 -- the highest level the filter accepts

local function sortValue(row, field)
  if field == "name" then return row.name:lower() end
  if field == "level" then return row.level end
  if field == "gold" then return row.money end
  if field == "zone" then return row.place and row.place:lower() end
  if field == "rested" then return row.rested end
  if field == "played" then return row.played end
  return row.ago -- seen: the most recent first
end

function ns.ValidSort(field)
  if type(field) == "string" and ns.SORT_DESC[field] ~= nil then return field end
  return nil
end

-- Sorts the rows by one column; reverse turns its direction around. Unknown values always go last,
-- equal values by name. Sorting by level without reverse is the order of 1.0.
function ns.SortRows(rows, field, reverse)
  field = ns.ValidSort(field) or ns.DEFAULT_SORT
  local desc = ns.SORT_DESC[field]
  if reverse then desc = not desc end
  table.sort(rows, function(a, b)
    local va, vb = sortValue(a, field), sortValue(b, field)
    if va ~= vb then
      if va == nil then return false end
      if vb == nil then return true end
      if desc then return va > vb end
      return va < vb
    end
    local na, nb = a.name:lower(), b.name:lower()
    if na ~= nb then return na < nb end
    return a.key < b.key
  end)
  return rows
end

-- A level for the filter: a whole number from 1 to MIN_LEVEL_LIMIT, else nil.
function ns.ValidMinLevel(value)
  if type(value) ~= "number" or value ~= math.floor(value) then return nil end
  if value < 1 or value > ns.MIN_LEVEL_LIMIT then return nil end
  return value
end

function ns.ParseLevel(text)
  if type(text) ~= "string" then return nil end
  local digits = text:match("^%s*(%d+)%s*$")
  return digits and ns.ValidMinLevel(tonumber(digits)) or nil
end

-- filter = { realmOnly, minLevel }. Characters of other realms (realmOnly) and below minLevel are
-- left out; a character whose level is unknown counts as below. The character you are playing is
-- always shown. Returns the rows to show and how many were left out.
function ns.FilterRows(rows, filter, realm)
  local shown, hidden = {}, 0
  filter = filter or {}
  for _, r in ipairs(rows) do
    local keep = true
    if not r.current then
      if filter.realmOnly and r.realm ~= realm then keep = false end
      if filter.minLevel and (r.level or 0) < filter.minLevel then keep = false end
    end
    if keep then shown[#shown + 1] = r else hidden = hidden + 1 end
  end
  return shown, hidden
end

-- The gold of the given rows, and their played time (nil when nobody's is known).
function ns.Totals(rows)
  local total, played = 0, nil
  for _, r in ipairs(rows) do
    total = total + (r.money or 0)
    if r.played then played = (played or 0) + r.played end
  end
  return total, played
end

-- The rows that fit into the window; when there are more, the last place says how many are left.
-- Returns the rows to show and the number of characters left out.
function ns.Visible(rows, max)
  max = max or ns.MAX_ROWS
  if #rows <= max then return rows, 0 end
  local shown = {}
  for i = 1, max - 1 do shown[i] = rows[i] end
  return shown, #rows - (max - 1)
end
