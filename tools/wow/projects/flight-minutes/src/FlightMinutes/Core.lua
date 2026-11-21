local _, ns = ...
local L = ns.L

-- Pure logic: no frames, no events. Everything here runs outside the game in the tests.

ns.MIN_SECONDS = 5     -- anything shorter was not a flight
ns.MAX_SECONDS = 3600  -- anything longer is a measurement that got stuck
ns.KEEP = 5            -- measurements kept per route for the average
ns.SEPARATOR = " > "

function ns.IsSecret(value)
  return issecretvalue ~= nil and issecretvalue(value) and true or false
end

-- "From > To". A route and its way back are two routes: they often take different times.
function ns.RouteKey(from, to)
  if type(from) ~= "string" or type(to) ~= "string" then return nil end
  if from == "" or to == "" or from == to then return nil end
  return from .. ns.SEPARATOR .. to
end

function ns.Plausible(seconds)
  return type(seconds) == "number" and seconds >= ns.MIN_SECONDS and seconds <= ns.MAX_SECONDS
end

-- Rounded to a tenth of a second.
function ns.Average(times)
  if #times == 0 then return nil end
  local sum = 0
  for _, t in ipairs(times) do sum = sum + t end
  return math.floor(sum / #times * 10 + 0.5) / 10
end

-- routes = { ["From > To"] = { times = { last measurements }, seconds = their average } }
-- Adds one measurement. Returns the route and whether it is new.
function ns.Learn(routes, key, seconds)
  local route = routes[key]
  local isNew = route == nil
  if isNew then
    route = { times = {} }
    routes[key] = route
  end
  local times = route.times
  times[#times + 1] = seconds
  while #times > ns.KEEP do table.remove(times, 1) end
  route.seconds = ns.Average(times)
  return route, isNew
end

-- The learned duration of a route, or nil.
function ns.Seconds(routes, key)
  local route = routes and key and routes[key]
  return route and route.seconds or nil
end

function ns.Count(routes)
  local n = 0
  for _ in pairs(routes or {}) do n = n + 1 end
  return n
end

-- All routes in alphabetical order.
function ns.RouteList(routes)
  local list = {}
  for key, route in pairs(routes or {}) do
    list[#list + 1] = { key = key, seconds = route.seconds, flights = #route.times }
  end
  table.sort(list, function(a, b) return a.key < b.key end)
  return list
end

-- "m:ss"
function ns.FormatTime(seconds)
  local s = math.floor(seconds + 0.5)
  if s < 0 then s = 0 end
  return string.format("%d:%02d", math.floor(s / 60), s % 60)
end

-- The line under the destination. known = learned duration of the route (nil while learning),
-- elapsed = seconds in the air.
function ns.CountdownText(known, elapsed)
  if not known then
    return string.format(L["Learning this route ... %s"], ns.FormatTime(elapsed))
  end
  local left = known - elapsed
  if left <= 0 then return L["Landing any moment ..."] end
  return string.format(L["Landing in %s"], ns.FormatTime(math.ceil(left)))
end

-- The line in the flight map tooltip (1.1). known = learned duration of the route, nil while unknown.
function ns.TooltipText(known)
  if not known then return L["Flight time: not timed yet"] end
  return string.format(L["Flight time: %s"], ns.FormatTime(known))
end

-- 1.2: the arrival sound. Off by default; it can play a few seconds before the learned landing
-- time, at the landing, or both. The word typed in /fm sound and the game's SOUNDKIT name behind it.
ns.SOUND_WHEN = { "off", "before", "landing", "both" }
ns.SOUND_NAMES = { "bell", "chime", "horn", "warning", "whisper" }
ns.SOUND_KIT = {
  bell = "ALARM_CLOCK_WARNING_3",
  chime = "MAP_PING",
  horn = "READY_CHECK",
  warning = "RAID_WARNING",
  whisper = "TELL_MESSAGE",
}
ns.DEFAULT_SOUND = "bell"
ns.SOUND_LEAD = 10 -- seconds before the learned landing time

function ns.ValidWhen(value)
  for _, when in ipairs(ns.SOUND_WHEN) do
    if value == when then return when end
  end
  return nil
end

function ns.ValidSound(value)
  if type(value) == "string" and ns.SOUND_KIT[value] then return value end
  return nil
end

function ns.PlaysBefore(when)
  return when == "before" or when == "both"
end

function ns.PlaysAtLanding(when)
  return when == "landing" or when == "both"
end

-- True once the flight is SOUND_LEAD seconds or less from its learned landing time. Needs a known
-- route; a route shorter than twice the lead gets no early sound (it would come right at take-off).
function ns.ArrivalDue(known, elapsed)
  if type(known) ~= "number" or type(elapsed) ~= "number" then return false end
  if known < ns.SOUND_LEAD * 2 then return false end
  return elapsed >= known - ns.SOUND_LEAD
end

-- The sound id for a name from the game's SOUNDKIT table. A sound this client does not know falls
-- back to the bell; nil when not even that is there.
function ns.SoundId(kit, name)
  if type(kit) ~= "table" then return nil end
  local id = kit[ns.SOUND_KIT[name] or ""]
  if type(id) == "number" then return id end
  id = kit[ns.SOUND_KIT[ns.DEFAULT_SOUND]]
  if type(id) == "number" then return id end
  return nil
end

-- "a, b or c"
function ns.OrList(words)
  if #words < 2 then return words[1] or "" end
  local head = {}
  for i = 1, #words - 1 do head[i] = words[i] end
  return string.format(L["%s or %s"], table.concat(head, ", "), words[#words])
end

-- "Arrival sound: 10 seconds before landing and at landing, bell." or "Arrival sound is off."
function ns.SoundText(when, name)
  name = ns.ValidSound(name) or ns.DEFAULT_SOUND
  if when == "before" then
    return string.format(L["Arrival sound: %d seconds before landing, %s."], ns.SOUND_LEAD, name)
  elseif when == "landing" then
    return string.format(L["Arrival sound: at landing, %s."], name)
  elseif when == "both" then
    return string.format(L["Arrival sound: %d seconds before landing and at landing, %s."], ns.SOUND_LEAD, name)
  end
  return L["Arrival sound is off."]
end

-- Applies one word of /fm sound. Returns "when" or "sound" for what was changed, nil for an unknown word.
function ns.ChooseSound(settings, word)
  if ns.ValidWhen(word) then
    settings.soundWhen = word
    return "when"
  end
  if ns.ValidSound(word) then
    settings.soundName = word
    return "sound"
  end
  return nil
end

-- 1.3: total flight time. totals = { flights = count, seconds = time in the air }, kept for the
-- session and for all time per character.
function ns.NewTotals()
  return { flights = 0, seconds = 0 }
end

-- Saved totals in their current shape; anything broken counts as nothing flown.
function ns.CleanTotals(t)
  local clean = ns.NewTotals()
  if type(t) ~= "table" then return clean end
  if type(t.flights) == "number" and t.flights >= 0 and t.flights == math.floor(t.flights) then clean.flights = t.flights end
  if type(t.seconds) == "number" and t.seconds >= 0 and t.seconds < math.huge then clean.seconds = t.seconds end
  return clean
end

-- Adds one flight. Only plausible times count (see ns.Plausible).
function ns.AddFlight(totals, seconds)
  if not ns.Plausible(seconds) then return false end
  totals.flights = totals.flights + 1
  totals.seconds = totals.seconds + seconds
  return true
end

-- "45s", "12m 05s", "3h 07m": for totals that can run into hours.
function ns.FormatTotal(seconds)
  local s = math.floor((seconds or 0) + 0.5)
  if s < 60 then return string.format(L["%ds"], s) end
  if s < 3600 then return string.format(L["%dm %02ds"], math.floor(s / 60), s % 60) end
  return string.format(L["%dh %02dm"], math.floor(s / 3600), math.floor(s / 60) % 60)
end

local function totalsText(t)
  local text = t.flights == 1 and L["%d flight, %s in the air"] or L["%d flights, %s in the air"]
  return string.format(text, t.flights, ns.FormatTotal(t.seconds))
end

-- "This session: 3 flights, 7m 12s in the air." or "This session: no flights yet."
function ns.SessionText(t)
  if not t or t.flights == 0 then return L["This session: no flights yet."] end
  return string.format(L["This session: %s."], totalsText(t))
end

-- "All time on this character: 42 flights, 3h 05m in the air."
function ns.AllTimeText(t)
  if not t or t.flights == 0 then return L["All time on this character: no flights yet."] end
  return string.format(L["All time on this character: %s."], totalsText(t))
end
