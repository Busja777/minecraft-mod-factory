local _, ns = ...
local L = ns.L

-- Follows the player from the flight map to the landing and times the flight.

ns.CHECK_EVERY = 0.2   -- seconds between two looks at "is the player on a flight?"
ns.START_WITHIN = 15   -- a chosen destination that does not take off in this time is dropped
ns.LAND_AFTER = 2      -- seconds off the taxi before a flight counts as landed (loading screens)

local map      -- { from = name, names = { [slot] = name } } while the flight map is open
local pending  -- { from, to, key, at } once a destination was chosen
ns.flight = nil -- { from, to, key, start, known, early } while in the air

function ns.Print(msg)
  DEFAULT_CHAT_FRAME:AddMessage("|cffffd100" .. L["Flight Minutes"] .. ":|r " .. msg)
end

local function nodeName(index)
  if not TaxiNodeName then return nil end
  local name = TaxiNodeName(index)
  if ns.IsSecret(name) or type(name) ~= "string" or name == "" then return nil end
  return name
end

-- Reads the open flight map: every node's name and the one the player stands at.
local function readMap()
  map = { names = {} }
  if not NumTaxiNodes then return end
  local count = NumTaxiNodes()
  if ns.IsSecret(count) or type(count) ~= "number" then return end
  for i = 1, count do
    local name = nodeName(i)
    map.names[i] = name
    local kind = TaxiNodeGetType and TaxiNodeGetType(i)
    if name and not ns.IsSecret(kind) and kind == "CURRENT" then map.from = name end
  end
end

local frame = CreateFrame("Frame")
ns.eventFrame = frame

local sinceCheck = 0
local watching = false
local function onUpdate(_, dt)
  sinceCheck = sinceCheck + dt
  if sinceCheck < ns.CHECK_EVERY then return end
  sinceCheck = 0
  ns.Check()
end

-- The repeating check runs only between choosing a destination and landing.
local function watch(on)
  if on == watching then return end
  watching = on
  sinceCheck = 0
  frame:SetScript("OnUpdate", on and onUpdate or nil)
end

local function onTakeNode(index)
  if not ns.routes or ns.flight then return end
  if not map then readMap() end
  local from = map.from
  local to = map.names[index] or nodeName(index)
  local key = ns.RouteKey(from, to)
  pending = key and { from = from, to = to, key = key, at = GetTime() } or nil
  watch(pending ~= nil)
end

local function takeOff(now)
  ns.flight = { from = pending.from, to = pending.to, key = pending.key, start = now, known = ns.Seconds(ns.routes, pending.key) }
  pending = nil
end

local function land(now)
  local flight = ns.flight
  ns.flight = nil
  local seconds = now - flight.start
  if flight.early or not ns.Plausible(seconds) then return end
  local route, isNew = ns.Learn(ns.routes, flight.key, seconds)
  if isNew then
    ns.Print(string.format(L["New route learned: %s takes %s."], flight.key, ns.FormatTime(route.seconds)))
  end
end

-- Looks whether the flight has started or ended. Called on the control events and by the repeating check.
function ns.Check()
  if not UnitOnTaxi then return end
  local flying = UnitOnTaxi("player")
  if ns.IsSecret(flying) then return end
  local now = GetTime()
  if ns.flight then
    -- A loading screen on the way can report "not on a taxi" for a moment: the flight only
    -- counts as ended after LAND_AFTER seconds on the ground, timed from the first such reading.
    if flying then
      ns.flight.groundSince = nil
    elseif not ns.flight.groundSince then
      ns.flight.groundSince = now
    elseif now - ns.flight.groundSince >= ns.LAND_AFTER then
      land(ns.flight.groundSince)
    end
  elseif pending then
    if flying then
      takeOff(now)
    elseif now - pending.at > ns.START_WITHIN then
      pending = nil
    end
  end
  watch(ns.flight ~= nil or pending ~= nil)
  if ns.Refresh then ns.Refresh() end
end

local function onLogin()
  FlightMinutesDB = FlightMinutesDB or {}
  local db = FlightMinutesDB
  db.version = 1
  db.factions = db.factions or {}
  db.settings = db.settings or {}
  ns.db = db

  -- Alliance and Horde use different flight masters, so each faction has its own routes.
  local faction, factionName
  if UnitFactionGroup then faction, factionName = UnitFactionGroup("player") end
  if ns.IsSecret(faction) or type(faction) ~= "string" or faction == "" then faction = "Neutral" end
  if ns.IsSecret(factionName) or type(factionName) ~= "string" or factionName == "" then factionName = faction end
  ns.faction = faction
  ns.factionName = factionName
  db.factions[faction] = db.factions[faction] or {}
  ns.routes = db.factions[faction]
end

frame:SetScript("OnEvent", function(_, event)
  if event == "PLAYER_LOGIN" then
    onLogin()
  elseif event == "TAXIMAP_OPENED" then
    readMap()
  elseif event == "TAXIMAP_CLOSED" then
    map = nil
  elseif event == "PLAYER_CONTROL_LOST" or event == "PLAYER_CONTROL_GAINED" then
    ns.Check()
  end
end)

local function listen(event)
  pcall(frame.RegisterEvent, frame, event)
end

listen("PLAYER_LOGIN")
listen("TAXIMAP_OPENED")
listen("TAXIMAP_CLOSED")
listen("PLAYER_CONTROL_LOST")
listen("PLAYER_CONTROL_GAINED")

if TakeTaxiNode then hooksecurefunc("TakeTaxiNode", onTakeNode) end

-- The "stop at the next flight point" button: the flight ends somewhere else, so its time says nothing.
if TaxiRequestEarlyLanding then
  hooksecurefunc("TaxiRequestEarlyLanding", function()
    if ns.flight then
      ns.flight.early = true
      if ns.Refresh then ns.Refresh() end
    end
  end)
end
