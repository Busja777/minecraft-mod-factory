local _, ns = ...

-- Pure bookkeeping: no frames, no events. Everything here runs outside the game in the tests.
-- A catch is one fishing loot window. Its items are the summed stack sizes of its item slots.
-- Zone totals look like { catches = n, items = n }, so later versions can add fields beside them.

ns.UNKNOWN_ZONE = "Unknown"
ns.RATE_MIN_CATCHES = 2    -- a rate from a single catch says nothing
ns.RATE_MIN_SECONDS = 300  -- nor does one from the first few minutes: two quick catches are not 400 an hour
ns.TOP_ZONES = 3           -- zones the session summary names
ns.NO_RATE = "–"

function ns.IsSecret(value)
  return issecretvalue ~= nil and issecretvalue(value) and true or false
end

-- A number read from the game that may be used for arithmetic: not secret, a real number.
function ns.Number(value)
  if value == nil or ns.IsSecret(value) or type(value) ~= "number" or value ~= value then return nil end
  return value
end

function ns.ZoneName(text)
  if text == nil or ns.IsSecret(text) or type(text) ~= "string" or text == "" then return ns.UNKNOWN_ZONE end
  return text
end

-- 1.1: a word the game itself has (a GlobalStrings constant such as UNKNOWN), in the client's language;
-- the English word when the client lacks it.
function ns.GameText(global, english)
  local text = _G[global]
  if type(text) ~= "string" or text == "" then return english end
  return text
end

-- 1.1: a zone as it is shown. The saved key of a catch without a zone stays "Unknown"; on screen it
-- reads like the game's own word for it.
function ns.ZoneLabel(zone)
  if zone == ns.UNKNOWN_ZONE then return ns.GameText("UNKNOWN", ns.UNKNOWN_ZONE) end
  return zone
end

function ns.NewSession(now)
  return { start = now, first = nil, last = nil, catches = 0, items = 0, zones = {} }
end

-- slots: { { item = true|false, quantity = n }, ... } as read from the loot window.
-- Money and currency slots, empty slots and unreadable quantities add nothing.
function ns.CountItems(slots)
  local total = 0
  for _, slot in ipairs(slots) do
    local q = slot.item and ns.Number(slot.quantity)
    if q and q > 0 then total = total + math.floor(q) end
  end
  return total
end

local function addTo(zones, zone, items)
  local z = zones[zone]
  if not z then
    z = { catches = 0, items = 0 }
    zones[zone] = z
  end
  z.catches = (z.catches or 0) + 1
  z.items = (z.items or 0) + items
end

-- Books one catch into the session and into the all-time zone totals.
function ns.AddCatch(session, allTime, zone, items, now)
  session.catches = session.catches + 1
  session.items = session.items + items
  session.first = session.first or now
  session.last = now
  addTo(session.zones, zone, items)
  if allTime then addTo(allTime, zone, items) end
end

-- Catches per hour since the first catch of the session, or nil while that would be guesswork.
function ns.PerHour(session, now)
  if not session.first or session.catches < ns.RATE_MIN_CATCHES then return nil end
  local seconds = now - session.first
  if seconds < ns.RATE_MIN_SECONDS then return nil end
  return math.floor(session.catches * 3600 / seconds + 0.5)
end

function ns.RateText(rate)
  if not rate then return ns.NO_RATE end
  return tostring(rate)
end

-- Zones with the most catches first, ties by name. n limits the list.
function ns.SortedZones(zones, n)
  local list = {}
  for name, z in pairs(zones) do
    list[#list + 1] = { zone = name, catches = z.catches or 0, items = z.items or 0 }
  end
  table.sort(list, function(a, b)
    if a.catches ~= b.catches then return a.catches > b.catches end
    return a.zone < b.zone
  end)
  if n then
    for i = #list, n + 1, -1 do list[i] = nil end
  end
  return list
end

function ns.Totals(zones)
  local catches, items = 0, 0
  for _, z in pairs(zones) do
    catches = catches + (z.catches or 0)
    items = items + (z.items or 0)
  end
  return catches, items
end
