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
