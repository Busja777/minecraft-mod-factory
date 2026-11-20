local _, ns = ...

-- Pure bookkeeping: no frames, no events. Everything here runs outside the game in the tests.
-- A character entry is { class, level, money, zone, subzone, rested, resting, maxLevel, seen }.

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

-- One row per character: highest level first, then by name. Also returns the gold of all of them.
function ns.BuildRows(chars, currentKey, now)
  local rows, total = {}, 0
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
    }
    total = total + (c.money or 0)
  end
  table.sort(rows, function(a, b)
    local la, lb = a.level or 0, b.level or 0
    if la ~= lb then return la > lb end
    local na, nb = a.name:lower(), b.name:lower()
    if na ~= nb then return na < nb end
    return a.key < b.key
  end)
  return rows, total
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
