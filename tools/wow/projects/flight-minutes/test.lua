-- Tests for Flight Minutes, run by tools/wow/client/run.lua.
local NODES = { "Stormwind, Elwynn", "Ironforge, Dun Morogh", "Sentinel Hill, Westfall" }
local SW, IF, WF = 1, 2, 3
local SW_IF = "Stormwind, Elwynn > Ironforge, Dun Morogh"

-- The flight functions of the game that the stand-in client lacks. They must exist before the addon
-- loads, because it hooks TakeTaxiNode right away.
local function world(faction)
  local w = { nodes = NODES, current = SW, onTaxi = false, faction = faction or "Alliance", taken = {} }
  NumTaxiNodes = function() return #w.nodes end
  TaxiNodeName = function(i) return w.nodes[i] end
  TaxiNodeGetType = function(i) return w.types and w.types[i] or (i == w.current and "CURRENT" or "REACHABLE") end
  TakeTaxiNode = function(i) w.taken[#w.taken + 1] = i end
  TaxiRequestEarlyLanding = function() end
  UnitOnTaxi = function() return w.onTaxi end
  UnitFactionGroup = function() return w.faction, w.faction end
  return w
end

local function boot(wow, faction)
  local w = world(faction)
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("ADDON_LOADED", "FlightMinutes")
  wow.fire("PLAYER_LOGIN")
  return ns, w
end

-- Opens the flight map at `from`, picks `to` and takes off.
local function takeOff(wow, w, from, to)
  w.current = from
  wow.fire("TAXIMAP_OPENED")
  TakeTaxiNode(to)
  wow.fire("TAXIMAP_CLOSED")
  w.onTaxi = true
  wow.fire("PLAYER_CONTROL_LOST")
end

-- Lands and stays on the ground long enough for the landing to count (see ns.LAND_AFTER).
local function land(wow, w)
  w.onTaxi = false
  wow.fire("PLAYER_CONTROL_GAINED")
  local ns = wow.ns
  if ns and ns.flight and ns.flight.groundSince then
    wow.clock = wow.clock + ns.LAND_AFTER
    local fn = ns.eventFrame:GetScript("OnUpdate")
    if fn then fn(ns.eventFrame, ns.CHECK_EVERY or 1) end
  end
end

local function fly(wow, w, from, to, seconds)
  takeOff(wow, w, from, to)
  wow.clock = wow.clock + seconds
  land(wow, w)
end

-- Lets time pass the way the game does: through the OnUpdate script, if one is set.
local function tick(wow, ns, seconds)
  wow.clock = wow.clock + seconds
  local fn = ns.eventFrame:GetScript("OnUpdate")
  if fn then fn(ns.eventFrame, seconds) end
  return fn ~= nil
end

test("addon defines only its own globals", function(wow, installed, before)
  local w = world()
  local game = {}
  for k in pairs(_G) do if not before[k] and not installed[k] then game[k] = true end end
  wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("PLAYER_LOGIN")
  fly(wow, w, SW, IF, 100) -- creates the frame
  wow.slash("/fm")
  local allowed = { FlightMinutesDB = true, FlightMinutesFrame = true, SLASH_FLIGHTMINUTES1 = true, SLASH_FLIGHTMINUTES2 = true }
  for k in pairs(_G) do
    if not before[k] and not installed[k] and not game[k] and not allowed[k] then error("unexpected global " .. tostring(k)) end
  end
  eq(FlightMinutesFrame ~= nil, true)
  eq(wow.hooks.TakeTaxiNode, true)
  eq(w.taken[1], IF, "the game's own function still runs")
end)

test("login prepares the saved data and keeps what is there", function(wow)
  FlightMinutesDB = { factions = { Alliance = { [SW_IF] = { times = { 100 }, seconds = 100 } } }, settings = { point = { "LEFT", "LEFT", 5, 6 } } }
  local ns = boot(wow)
  eq(FlightMinutesDB.version, 1)
  eq(ns.routes, FlightMinutesDB.factions.Alliance)
  eq(ns.Seconds(ns.routes, SW_IF), 100)
  eq(FlightMinutesDB.settings.point[3], 5)
  eq(ns.faction, "Alliance")
end)

test("route keys", function(wow)
  local ns = boot(wow)
  eq(ns.RouteKey("A", "B"), "A > B")
  eq(ns.RouteKey("B", "A"), "B > A")
  eq(ns.RouteKey("A", "A"), nil, "no route to itself")
  eq(ns.RouteKey(nil, "B"), nil)
  eq(ns.RouteKey("A", nil), nil)
  eq(ns.RouteKey("", "B"), nil)
  eq(ns.RouteKey("A", 5), nil)
end)

test("running average of the last five measurements", function(wow)
  local ns = boot(wow)
  local routes = {}
  local route, isNew = ns.Learn(routes, "A > B", 100)
  eq(isNew, true)
  eq(route.seconds, 100)
  route, isNew = ns.Learn(routes, "A > B", 110)
  eq(isNew, false)
  eq(route.seconds, 105)
  for _, s in ipairs({ 120, 130, 140 }) do ns.Learn(routes, "A > B", s) end
  eq(routes["A > B"].seconds, 120)
  ns.Learn(routes, "A > B", 200) -- the oldest one (100) drops out
  eq(#routes["A > B"].times, 5)
  eq(routes["A > B"].times[1], 110)
  eq(routes["A > B"].seconds, 140)
  eq(ns.Learn(routes, "C > D", 10.26).seconds, 10.3, "rounded to a tenth")
  eq(ns.Count(routes), 2)
  eq(ns.Seconds(routes, "A > B"), 140)
  eq(ns.Seconds(routes, "X > Y"), nil)
  eq(ns.Seconds(nil, "A > B"), nil)
  eq(ns.Average({}), nil)
end)

test("plausible flight times", function(wow)
  local ns = boot(wow)
  eq(ns.Plausible(4.9), false)
  eq(ns.Plausible(5), true)
  eq(ns.Plausible(161.3), true)
  eq(ns.Plausible(3600), true)
  eq(ns.Plausible(3600.1), false)
  eq(ns.Plausible(-20), false)
  eq(ns.Plausible(nil), false)
  eq(ns.Plausible("60"), false)
end)

test("time and countdown texts", function(wow)
  local ns = boot(wow)
  eq(ns.FormatTime(0), "0:00")
  eq(ns.FormatTime(9), "0:09")
  eq(ns.FormatTime(59.6), "1:00")
  eq(ns.FormatTime(161), "2:41")
  eq(ns.FormatTime(600), "10:00")
  eq(ns.FormatTime(-3), "0:00")
  eq(ns.CountdownText(161, 0), "Landing in 2:41")
  eq(ns.CountdownText(161, 100.5), "Landing in 1:01")
  eq(ns.CountdownText(161, 160.9), "Landing in 0:01")
  eq(ns.CountdownText(161, 161), "Landing any moment ...")
  eq(ns.CountdownText(161, 170), "Landing any moment ...")
  eq(ns.CountdownText(nil, 0), "Learning this route ... 0:00")
  eq(ns.CountdownText(nil, 75), "Learning this route ... 1:15")
end)

test("the first flight learns the route", function(wow)
  local ns, w = boot(wow)
  eq(FlightMinutesFrame, nil, "no frame before the first flight")
  takeOff(wow, w, SW, IF)
  local f = FlightMinutesFrame
  eq(f:IsShown(), true)
  eq(f.title:GetText(), "Ironforge, Dun Morogh")
  eq(f.text:GetText(), "Learning this route ... 0:00")
  eq(tick(wow, ns, 42), true)
  eq(f.text:GetText(), "Learning this route ... 0:42")
  wow.clock = wow.clock + 119
  land(wow, w)
  eq(f:IsShown(), false)
  local route = FlightMinutesDB.factions.Alliance[SW_IF]
  eq(route.seconds, 161)
  eq(#route.times, 1)
  eq(#wow.chat, 1)
  eq(wow.chat[1], "|cffffd100Flight Minutes:|r New route learned: " .. SW_IF .. " takes 2:41.")
  eq(ns.flight, nil)
  eq(tick(wow, ns, 1), false, "the repeating check stops after landing")
end)

test("the second flight counts down", function(wow)
  local ns, w = boot(wow)
  fly(wow, w, SW, IF, 161)
  takeOff(wow, w, SW, IF)
  local f = FlightMinutesFrame
  eq(f:IsShown(), true)
  eq(f.title:GetText(), "Ironforge, Dun Morogh")
  eq(f.text:GetText(), "Landing in 2:41")
  tick(wow, ns, 60)
  eq(f.text:GetText(), "Landing in 1:41")
  tick(wow, ns, 100.5)
  eq(f.text:GetText(), "Landing in 0:01")
  tick(wow, ns, 4.5) -- this flight takes a little longer
  eq(f.text:GetText(), "Landing any moment ...")
  land(wow, w)
  eq(f:IsShown(), false)
  eq(#wow.chat, 1, "only a new route is announced")
  local route = ns.routes[SW_IF]
  eq(#route.times, 2)
  eq(route.seconds, 163)
end)

test("the way back is a route of its own", function(wow)
  local ns, w = boot(wow)
  fly(wow, w, SW, IF, 161)
  takeOff(wow, w, IF, SW)
  eq(FlightMinutesFrame.title:GetText(), "Stormwind, Elwynn")
  eq(FlightMinutesFrame.text:GetText(), "Learning this route ... 0:00")
  wow.clock = wow.clock + 150
  land(wow, w)
  eq(ns.routes["Ironforge, Dun Morogh > Stormwind, Elwynn"].seconds, 150)
  eq(ns.routes[SW_IF].seconds, 161)
  eq(ns.Count(ns.routes), 2)
end)

test("the repeating check notices take-off and landing without the control events", function(wow)
  local ns, w = boot(wow)
  wow.fire("TAXIMAP_OPENED")
  eq(tick(wow, ns, 1), false, "nothing to check before a destination is chosen")
  TakeTaxiNode(WF)
  wow.fire("TAXIMAP_CLOSED")
  eq(tick(wow, ns, 1), true)
  eq(ns.flight, nil, "still on the ground")
  w.onTaxi = true
  tick(wow, ns, 0.1) -- too soon for the next look
  eq(ns.flight, nil)
  tick(wow, ns, 0.1)
  eq(ns.flight.to, "Sentinel Hill, Westfall")
  eq(FlightMinutesFrame:IsShown(), true)
  tick(wow, ns, 80)
  w.onTaxi = false
  tick(wow, ns, 0.2)
  eq(ns.flight ~= nil, true, "first reading on the ground: wait for LAND_AFTER")
  tick(wow, ns, 2)
  eq(ns.flight, nil)
  eq(FlightMinutesFrame:IsShown(), false)
  eq(ns.routes["Stormwind, Elwynn > Sentinel Hill, Westfall"].seconds, 80.2, "timed until the first reading on the ground")
end)

test("implausible flights are not stored", function(wow)
  local ns, w = boot(wow)
  fly(wow, w, SW, IF, 3) -- under five seconds
  eq(ns.Count(ns.routes), 0)
  eq(FlightMinutesFrame:IsShown(), false)
  fly(wow, w, SW, IF, 4000) -- stuck for more than an hour
  eq(ns.Count(ns.routes), 0)
  eq(#wow.chat, 0)
  fly(wow, w, SW, IF, 161)
  fly(wow, w, SW, IF, 2) -- a bad measurement leaves a known route alone
  eq(ns.routes[SW_IF].seconds, 161)
  eq(#ns.routes[SW_IF].times, 1)
end)

test("logged out mid-flight: the rest of the flight is not measured", function(wow)
  local w = world()
  w.onTaxi = true -- the character logs in while still in the air
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("PLAYER_LOGIN")
  wow.fire("PLAYER_CONTROL_LOST")
  eq(ns.flight, nil)
  eq(FlightMinutesFrame, nil)
  eq(tick(wow, ns, 60), false)
  land(wow, w)
  eq(ns.Count(ns.routes), 0)
  eq(#wow.chat, 0)
  fly(wow, w, SW, IF, 161) -- the next full flight counts again
  eq(ns.routes[SW_IF].seconds, 161)
end)

test("a destination that never takes off is dropped", function(wow)
  local ns, w = boot(wow)
  wow.fire("TAXIMAP_OPENED")
  TakeTaxiNode(IF) -- not enough gold: the flight does not start
  wow.fire("TAXIMAP_CLOSED")
  eq(tick(wow, ns, 10), true)
  eq(tick(wow, ns, 10), true)
  eq(tick(wow, ns, 1), false, "given up after 15 seconds")
  w.onTaxi = true -- a flight that was not chosen on the map, e.g. a quest ride
  wow.fire("PLAYER_CONTROL_LOST")
  wow.clock = wow.clock + 90
  land(wow, w)
  eq(ns.Count(ns.routes), 0)
  eq(FlightMinutesFrame, nil)
end)

test("a flight ended early with the stop button is not counted", function(wow)
  local ns, w = boot(wow)
  fly(wow, w, SW, IF, 161)
  takeOff(wow, w, SW, IF)
  tick(wow, ns, 30)
  TaxiRequestEarlyLanding()
  eq(FlightMinutesFrame.text:GetText(), "Landing early, not timed")
  tick(wow, ns, 20)
  eq(FlightMinutesFrame.text:GetText(), "Landing early, not timed")
  land(wow, w)
  eq(FlightMinutesFrame:IsShown(), false)
  eq(#ns.routes[SW_IF].times, 1)
  eq(ns.routes[SW_IF].seconds, 161)
end)

test("Alliance and Horde keep their own routes", function(wow)
  FlightMinutesDB = { factions = { Alliance = { [SW_IF] = { times = { 161 }, seconds = 161 } } } }
  local ns, w = boot(wow, "Horde")
  eq(ns.Count(ns.routes), 0)
  takeOff(wow, w, SW, IF)
  eq(FlightMinutesFrame.text:GetText(), "Learning this route ... 0:00", "the Alliance time is not used")
  wow.clock = wow.clock + 200
  land(wow, w)
  eq(FlightMinutesDB.factions.Horde[SW_IF].seconds, 200)
  eq(FlightMinutesDB.factions.Alliance[SW_IF].seconds, 161)
  eq(#FlightMinutesDB.factions.Alliance[SW_IF].times, 1)
  wow.slash("/fm")
  eq(wow.chat[2]:match("Routes known for Horde: 1%.") ~= nil, true)
end)

test("secret or missing values from the game are ignored", function(wow)
  local ns, w = boot(wow)
  w.nodes = { "Stormwind, Elwynn", { secret = true }, "" }
  wow.fire("TAXIMAP_OPENED")
  TakeTaxiNode(2)
  eq(tick(wow, ns, 1), false, "no destination name, nothing to wait for")
  TakeTaxiNode(3)
  eq(tick(wow, ns, 1), false)
  w.nodes = NODES
  takeOff(wow, w, SW, IF)
  wow.clock = wow.clock + 100
  w.onTaxi = { secret = true }
  wow.fire("PLAYER_CONTROL_GAINED")
  eq(ns.flight ~= nil, true, "a secret answer does not end the flight")
  wow.clock = wow.clock + 61
  land(wow, w)
  eq(ns.routes[SW_IF].seconds, 161)
end)

test("/fm counts, lists and forgets the routes", function(wow)
  FlightMinutesDB = { factions = { Horde = { ["Orgrimmar > Thunder Bluff"] = { times = { 300 }, seconds = 300 } } } }
  local ns, w = boot(wow)
  wow.slash("/fm")
  eq(wow.chat[1], "|cffffd100Flight Minutes:|r No routes known yet. Every flight you take is timed.")
  wow.slash("/fm list")
  eq(wow.chat[2], wow.chat[1])
  fly(wow, w, SW, WF, 75)
  fly(wow, w, SW, IF, 161)
  eq(#wow.chat, 4)
  wow.slash("/flightminutes")
  eq(wow.chat[5], "|cffffd100Flight Minutes:|r Routes known for Alliance: 2. /fm list shows them, /fm forget clears all.")
  wow.slash("/fm LIST ")
  eq(#wow.chat, 7)
  eq(wow.chat[6], "|cffffd100Flight Minutes:|r " .. SW_IF .. "  |cffffffff2:41|r", "alphabetical")
  eq(wow.chat[7], "|cffffd100Flight Minutes:|r Stormwind, Elwynn > Sentinel Hill, Westfall  |cffffffff1:15|r")
  wow.slash("/fm help")
  eq(wow.chat[8]:match("/fm list shows them with their times") ~= nil, true)
  wow.slash("/fm forget")
  eq(wow.chat[9]:match("All routes forgotten") ~= nil, true)
  eq(ns.Count(ns.routes), 0)
  eq(ns.Count(FlightMinutesDB.factions.Horde), 0)
  eq(ns.routes, FlightMinutesDB.factions.Alliance, "still the saved table")
  wow.slash("/fm")
  eq(wow.chat[10], wow.chat[1])
  fly(wow, w, SW, IF, 150) -- learned again from scratch
  eq(ns.routes[SW_IF].seconds, 150)
  eq(#wow.chat, 11)
end)

test("/fm list stops after 40 lines and counts the rest", function(wow)
  local routes = {}
  for i = 1, 45 do routes[string.format("Node %02d > Home", i)] = { times = { 60 + i }, seconds = 60 + i } end
  FlightMinutesDB = { factions = { Alliance = routes } }
  local ns = boot(wow)
  wow.slash("/fm list")
  eq(#wow.chat, 41)
  eq(wow.chat[1]:find("Node 01 > Home  |cffffffff1:01|r", 1, true) ~= nil, true)
  eq(wow.chat[41]:match("and 5 more") ~= nil, true)
  local list = ns.RouteList(routes)
  eq(#list, 45)
  eq(list[45].key, "Node 45 > Home")
  eq(list[45].flights, 1)
end)

test("forgetting mid-flight turns the countdown back into learning", function(wow)
  local ns, w = boot(wow)
  fly(wow, w, SW, IF, 161)
  takeOff(wow, w, SW, IF)
  tick(wow, ns, 10)
  eq(FlightMinutesFrame.text:GetText(), "Landing in 2:31")
  wow.slash("/fm forget")
  eq(FlightMinutesFrame.text:GetText(), "Learning this route ... 0:10")
  wow.clock = wow.clock + 145
  land(wow, w)
  eq(ns.routes[SW_IF].seconds, 155)
end)

test("the frame can be moved and remembers its place", function(wow)
  local ns, w = boot(wow)
  takeOff(wow, w, SW, IF)
  local f = FlightMinutesFrame
  eq(f.scripts.OnDragStart ~= nil, true)
  local point, _, relativePoint, x, y = f:GetPoint()
  eq(point, "TOP")
  eq(y, -140)
  eq(FlightMinutesDB.settings.point, nil, "nothing saved until it is moved")
  f:SetPoint("BOTTOMLEFT", UIParent, "BOTTOMLEFT", 300, 420) -- the player drags it
  f.scripts.OnDragStop(f)
  local p = FlightMinutesDB.settings.point
  eq(p[1], "BOTTOMLEFT")
  eq(p[2], "BOTTOMLEFT")
  eq(p[3], 300)
  eq(p[4], 420)
end)

test("the saved place is used again after a restart", function(wow)
  FlightMinutesDB = { settings = { point = { "BOTTOMLEFT", "BOTTOMLEFT", 300, 420 } } }
  local ns, w = boot(wow)
  takeOff(wow, w, SW, IF)
  local point, relativeTo, relativePoint, x, y = FlightMinutesFrame:GetPoint()
  eq(point, "BOTTOMLEFT")
  eq(relativeTo, UIParent)
  eq(relativePoint, "BOTTOMLEFT")
  eq(x, 300)
  eq(y, 420)
end)

test("a short moment off the taxi (a loading screen) does not end the flight", function(wow)
  local ns, w = boot(wow)
  takeOff(wow, w, SW, IF)
  wow.clock = wow.clock + 60
  w.onTaxi = false
  wow.fire("PLAYER_CONTROL_GAINED")
  eq(ns.flight ~= nil, true, "not landed yet")
  wow.clock = wow.clock + 1
  w.onTaxi = true
  wow.fire("PLAYER_CONTROL_LOST")
  eq(ns.flight.groundSince, nil, "back on the taxi")
  wow.clock = wow.clock + 100
  land(wow, w)
  eq(ns.flight, nil)
  eq(FlightMinutesDB.factions.Alliance[SW_IF].seconds, 161, "timed until the real landing, not the blip")
end)


-- 1.1: the learned duration in the flight map tooltip

-- What the game does when the mouse enters a node, on the older map (a button whose ID is the
-- node's slot) and on the newer map (a pin carrying taxiNodeData). The game's own tooltip text
-- is the node name; Flight Minutes adds its line after that.
local function tooltipGame(wow)
  GameTooltip.GetOwner = function() return wow.tooltip.owner end
  GameTooltip.NumLines = function() return #(wow.tooltip.lines or {}) end
  TaxiNodeOnButtonEnter = function(button)
    GameTooltip:SetOwner(button, "ANCHOR_RIGHT")
    GameTooltip:AddLine(TaxiNodeName(button:GetID()))
    GameTooltip:Show()
  end
end

local function button(slot) return { GetID = function() return slot end } end
local function pin(slot) return { taxiNodeData = { slotIndex = slot, name = NODES[slot] } } end

local function hoverPin(p)
  GameTooltip:SetOwner(p, "ANCHOR_RIGHT")
  GameTooltip:AddLine(p.taxiNodeData.name)
  GameTooltip:Show()
end

local function lines(wow) return table.concat(wow.tooltip.lines or {}, " | ") end

local function bootWithTooltip(wow, faction)
  local w = world(faction)
  tooltipGame(wow)
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("ADDON_LOADED", "FlightMinutes")
  wow.fire("PLAYER_LOGIN")
  return ns, w
end

test("tooltip text", function(wow)
  local ns = boot(wow)
  eq(ns.TooltipText(161), "Flight time: 2:41")
  eq(ns.TooltipText(59.6), "Flight time: 1:00")
  eq(ns.TooltipText(nil), "Flight time: not timed yet")
end)

test("older flight map: hovering a destination shows the learned time", function(wow)
  local ns, w = bootWithTooltip(wow)
  eq(wow.hooks.TaxiNodeOnButtonEnter, true)
  fly(wow, w, SW, IF, 161)
  w.current = SW
  wow.fire("TAXIMAP_OPENED")
  TaxiNodeOnButtonEnter(button(IF))
  eq(lines(wow), "Ironforge, Dun Morogh | Flight time: 2:41")
  eq(wow.tooltip.shown, true)
  TaxiNodeOnButtonEnter(button(WF))
  eq(lines(wow), "Sentinel Hill, Westfall | Flight time: not timed yet")
  TaxiNodeOnButtonEnter(button(SW))
  eq(lines(wow), "Stormwind, Elwynn", "the place you stand at gets no line")
  wow.fire("TAXIMAP_CLOSED")
  TaxiNodeOnButtonEnter(button(IF))
  eq(lines(wow), "Ironforge, Dun Morogh", "map closed: nothing added")
end)

test("newer flight map: the pin tooltip gets the line once", function(wow)
  local ns, w = bootWithTooltip(wow)
  fly(wow, w, IF, SW, 150)
  w.current = IF
  wow.fire("TAXIMAP_OPENED")
  local p = pin(SW)
  hoverPin(p)
  eq(lines(wow), "Stormwind, Elwynn | Flight time: 2:30")
  GameTooltip:Show() -- the game refreshes the tooltip without clearing it
  GameTooltip:Show()
  eq(lines(wow), "Stormwind, Elwynn | Flight time: 2:30", "no second line")
  hoverPin(p) -- mouse leaves and comes back: the game rebuilds the tooltip
  eq(lines(wow), "Stormwind, Elwynn | Flight time: 2:30")
  hoverPin(pin(WF))
  eq(lines(wow), "Sentinel Hill, Westfall | Flight time: not timed yet")
  GameTooltip:SetOwner({}, "ANCHOR_RIGHT") -- any other tooltip while the map is open
  GameTooltip:AddLine("Hearthstone")
  GameTooltip:Show()
  eq(lines(wow), "Hearthstone")
  wow.fire("TAXIMAP_CLOSED")
  hoverPin(p)
  eq(lines(wow), "Stormwind, Elwynn", "map closed: nothing added")
end)

test("the pin's name is used when its slot is unknown", function(wow)
  local ns, w = bootWithTooltip(wow)
  fly(wow, w, SW, IF, 161)
  w.current = SW
  wow.fire("TAXIMAP_OPENED")
  hoverPin({ taxiNodeData = { name = "Ironforge, Dun Morogh" } })
  eq(lines(wow), "Ironforge, Dun Morogh | Flight time: 2:41")
end)

test("places you cannot fly to show no line unless a time is known", function(wow)
  local ns, w = bootWithTooltip(wow)
  fly(wow, w, SW, IF, 161)
  w.current = SW
  w.types = { [IF] = "DISTANT", [WF] = "NONE" }
  wow.fire("TAXIMAP_OPENED")
  TaxiNodeOnButtonEnter(button(WF))
  eq(lines(wow), "Sentinel Hill, Westfall")
  TaxiNodeOnButtonEnter(button(IF))
  eq(lines(wow), "Ironforge, Dun Morogh | Flight time: 2:41")
end)

test("the tooltip shows times other characters of the faction learned", function(wow)
  FlightMinutesDB = { version = 1, factions = { Alliance = { [SW_IF] = { times = { 170 }, seconds = 170 } } } }
  local ns, w = bootWithTooltip(wow) -- a character that never flew this route
  wow.fire("TAXIMAP_OPENED")
  TaxiNodeOnButtonEnter(button(IF))
  eq(lines(wow), "Ironforge, Dun Morogh | Flight time: 2:50")
  eq(FlightMinutesDB.version, 1, "1.0 data is used as it is")
end)

test("a Horde character does not see Alliance times in the tooltip", function(wow)
  FlightMinutesDB = { factions = { Alliance = { [SW_IF] = { times = { 170 }, seconds = 170 } } } }
  local ns, w = bootWithTooltip(wow, "Horde")
  wow.fire("TAXIMAP_OPENED")
  TaxiNodeOnButtonEnter(button(IF))
  eq(lines(wow), "Ironforge, Dun Morogh | Flight time: not timed yet")
end)

test("secret values in the flight map are skipped", function(wow)
  local ns, w = bootWithTooltip(wow)
  fly(wow, w, SW, IF, 161)
  w.current = SW
  wow.fire("TAXIMAP_OPENED")
  local secret = { secret = true }
  GameTooltip:SetOwner({ taxiNodeData = { slotIndex = secret, name = secret } })
  GameTooltip:AddLine("Hidden")
  GameTooltip:Show()
  eq(lines(wow), "Hidden", "nothing added, no error")
  w.types = { [WF] = secret }
  TaxiNodeOnButtonEnter(button(WF))
  eq(lines(wow), "Sentinel Hill, Westfall")
end)

test("a client without the tooltip functions does not break it", function(wow)
  local w = world() -- no TaxiNodeOnButtonEnter, no GetOwner, no NumLines
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("PLAYER_LOGIN")
  eq(wow.hooks.TaxiNodeOnButtonEnter, nil)
  wow.fire("TAXIMAP_OPENED")
  GameTooltip:SetOwner(pin(IF))
  GameTooltip:Show()
  eq(lines(wow), "")
  -- the older map arrives later with another part of the game
  tooltipGame(wow)
  wow.fire("ADDON_LOADED", "Blizzard_SomethingLater")
  eq(wow.hooks.TaxiNodeOnButtonEnter, true)
  TaxiNodeOnButtonEnter(button(IF))
  eq(lines(wow), "Ironforge, Dun Morogh | Flight time: not timed yet")
  wow.fire("ADDON_LOADED", "Another")
  TaxiNodeOnButtonEnter(button(IF))
  eq(lines(wow), "Ironforge, Dun Morogh | Flight time: not timed yet", "hooked only once")
end)
