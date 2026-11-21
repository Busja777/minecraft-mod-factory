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

function ns.FlightMapOpen()
  return map ~= nil
end

-- The route from where the player stands to a node of the open flight map (1.1, for the tooltip).
-- index = the node's slot on the map, name = its name when the slot is unknown. Nil while the map is closed.
function ns.RouteToNode(index, name)
  if not map or ns.IsSecret(index) or ns.IsSecret(name) then return nil end
  local to = type(index) == "number" and map.names[index] or nil
  if not to and type(name) == "string" and name ~= "" then to = name end
  return ns.RouteKey(map.from, to)
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

-- 1.2: plays the chosen arrival sound once (also as the preview of /fm sound).
function ns.PlayArrivalSound()
  if not PlaySound then return end
  local id = ns.SoundId(SOUNDKIT, ns.db and ns.db.settings.soundName)
  if not id then return end
  -- "Master" so it is heard even with sound effects muted.
  pcall(PlaySound, id, "Master")
end

local function soundWhen()
  return ns.db and ns.db.settings.soundWhen
end

-- The early sound: once per flight, a few seconds before the learned landing time.
local function checkArrival(now)
  local flight = ns.flight
  if not flight or flight.early or flight.soundPlayed or not ns.PlaysBefore(soundWhen()) then return end
  if ns.ArrivalDue(flight.known, now - flight.start) then
    flight.soundPlayed = true
    ns.PlayArrivalSound()
  end
end

local function land(now)
  local flight = ns.flight
  ns.flight = nil
  if ns.PlaysAtLanding(soundWhen()) then ns.PlayArrivalSound() end
  local seconds = now - flight.start
  -- 1.3: every flight counts for the totals, also one stopped early: it was time in the air.
  if ns.session and ns.AddFlight(ns.session, seconds) and ns.allTime then ns.AddFlight(ns.allTime, seconds) end
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
    if flying then checkArrival(now) end
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

local function plain(value)
  if value == nil or ns.IsSecret(value) then return nil end
  return value
end

local function characterKey()
  local name = UnitName and plain(UnitName("player"))
  local realm = GetRealmName and plain(GetRealmName())
  return (type(name) == "string" and name or "?") .. "-" .. (type(realm) == "string" and realm or "?")
end

-- 1.3: the totals of this character. The session starts at login; after a /reload the session
-- before it goes on (see PLAYER_ENTERING_WORLD), so only logging in starts a new one.
local lastSession -- the session saved before this login or reload
local entered = false

local function loadTotals(db)
  local chars = {}
  for key, t in pairs(type(db.chars) == "table" and db.chars or {}) do
    if type(key) == "string" and type(t) == "table" then
      local clean = ns.CleanTotals(t)
      clean.session = ns.CleanTotals(t.session)
      chars[key] = clean
    end
  end
  db.chars = chars
  local key = characterKey()
  local char = chars[key] or ns.CleanTotals(nil)
  chars[key] = char
  lastSession = char.session or ns.NewTotals()
  char.session = ns.NewTotals()
  ns.allTime = char
  ns.session = char.session
  entered = false
end

local function onEnteringWorld(isReload)
  if entered then return end
  entered = true
  if isReload == true and lastSession and ns.allTime and ns.session.flights == 0 then
    ns.allTime.session = lastSession
    ns.session = lastSession
  end
  lastSession = nil
end

local function onLogin()
  FlightMinutesDB = FlightMinutesDB or {}
  local db = FlightMinutesDB
  -- 2 since 1.2: settings.soundWhen and settings.soundName; 3 since 1.3: chars (flight totals)
  db.version = 3
  db.factions = db.factions or {}
  db.settings = db.settings or {}
  local s = db.settings
  s.soundWhen = ns.ValidWhen(s.soundWhen) or "off"
  s.soundName = ns.ValidSound(s.soundName) or ns.DEFAULT_SOUND
  loadTotals(db)
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

frame:SetScript("OnEvent", function(_, event, ...)
  if event == "PLAYER_LOGIN" then
    onLogin()
  elseif event == "PLAYER_ENTERING_WORLD" then
    onEnteringWorld(plain((select(2, ...))))
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
listen("PLAYER_ENTERING_WORLD")
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
