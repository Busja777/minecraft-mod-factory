local _, ns = ...

-- Reads the XP bar whenever the game reports a change and keeps the session up to date.

ns.session = ns.NewSession(0)

function ns.CharKey()
  return (UnitName("player") or "?") .. "-" .. (GetRealmName() or "?")
end

-- The XP bar right now, or nil while the game keeps the numbers to itself.
local function read()
  local xp, max, level = UnitXP("player"), UnitXPMax("player"), UnitLevel("player")
  if ns.IsSecret(xp) or ns.IsSecret(max) or ns.IsSecret(level) then return nil end
  if not xp or not max or not level then return nil end
  local rested = GetXPExhaustion() -- nil when there is no rested bonus
  if ns.IsSecret(rested) then rested = nil else rested = rested or 0 end
  return { xp = xp, max = max, level = level, rested = rested }
end

function ns.AtMaxLevel()
  if not IsPlayerAtEffectiveMaxLevel then return false end
  local atMax = IsPlayerAtEffectiveMaxLevel()
  return not ns.IsSecret(atMax) and atMax and true or false
end

local function sample()
  if not ns.char then return end
  local reading = read()
  if not reading then return end
  ns.Advance(ns.session, reading)
  if ns.Refresh then ns.Refresh() end
end

-- Keeps a summary of the session that ends, in the history and as the last session (as 1.0 did).
-- A session without XP is not kept.
function ns.EndSession()
  if ns.char and ns.session.gained > 0 then
    local summary = ns.SessionSummary(ns.session, GetTime(), time())
    ns.char.last = summary
    ns.AddToHistory(ns.char.history, summary, ns.session.login)
  end
end

-- A session started by hand is never merged into the one before it.
function ns.Reset()
  ns.EndSession()
  ns.session = ns.NewSession(GetTime(), ns.session.last, time(), false)
  if ns.Refresh then ns.Refresh() end
end

local function onLogin()
  if type(LevelClockDB) ~= "table" then LevelClockDB = {} end
  local db = LevelClockDB
  db.version = 2
  if type(db.chars) ~= "table" then db.chars = {} end
  if type(db.settings) ~= "table" then db.settings = {} end
  ns.db = db

  local key = ns.CharKey()
  local char = type(db.chars[key]) == "table" and db.chars[key] or {}
  db.chars[key] = char
  ns.MigrateChar(char)
  ns.char = char

  ns.session = ns.NewSession(GetTime(), read(), time(), true)
end

local frame = CreateFrame("Frame")
ns.eventFrame = frame

frame:SetScript("OnEvent", function(_, event, unit)
  if event == "PLAYER_LOGIN" then
    onLogin()
  elseif event == "PLAYER_LOGOUT" then
    ns.EndSession()
  elseif event == "PLAYER_XP_UPDATE" then
    if unit == nil or unit == "player" then sample() end
  else
    sample()
  end
end)

-- Registered one by one: an event a client does not know is skipped.
local function listen(event)
  pcall(frame.RegisterEvent, frame, event)
end

listen("PLAYER_LOGIN")
listen("PLAYER_LOGOUT")
listen("PLAYER_XP_UPDATE")
listen("UPDATE_EXHAUSTION")
