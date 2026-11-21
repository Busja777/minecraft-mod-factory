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
  -- 1.2: the moment the character reaches the maximum level
  local atMax = ns.AtMaxLevel()
  if atMax and ns.wasAtMax == false and ns.ReachedMaxLevel then ns.ReachedMaxLevel() end
  ns.wasAtMax = atMax
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

-- 1.3: level history -------------------------------------------------------------------------------

ns.played = nil -- the played time the game told in this session (see ns.PlayedAnchor)

local function plain(value)
  if ns.IsSecret(value) or type(value) ~= "number" then return nil end
  return value
end

-- The game tells the played time (the player typed /played, or another addon asked).
local function onTimePlayed(total, thisLevel)
  if not ns.char then return end
  local level = plain(UnitLevel("player")) or (ns.session.last and ns.session.last.level)
  local anchor = ns.PlayedAnchor(plain(total), plain(thisLevel), GetTime(), level)
  if not anchor then return end
  ns.played = anchor
  ns.FillPlayed(ns.char.levels, anchor)
end

local function onLevelUp(level)
  level = plain(level)
  if not ns.char or not level then return end
  local played, took, anchor = ns.LevelUpPlayed(ns.played, level, GetTime())
  ns.played = anchor
  ns.AddLevel(ns.char.levels, level, time(), played, took)
end

local function onLogin()
  if type(LevelClockDB) ~= "table" then LevelClockDB = {} end
  local db = LevelClockDB
  -- 3 (1.2): window options in db.settings, filled in with their defaults.
  -- 4 (1.3): a list of level-ups per character (char.levels), empty for older data.
  db.version = 4
  if type(db.chars) ~= "table" then db.chars = {} end
  if type(db.settings) ~= "table" then db.settings = {} end
  ns.WindowSettings(db.settings)
  ns.db = db

  local key = ns.CharKey()
  local char = type(db.chars[key]) == "table" and db.chars[key] or {}
  db.chars[key] = char
  ns.MigrateChar(char)
  ns.char = char

  ns.session = ns.NewSession(GetTime(), read(), time(), true)
  ns.played = nil -- told again in each session
  ns.wasAtMax = ns.AtMaxLevel()
  if ns.WindowAtLogin then ns.WindowAtLogin() end
end

local frame = CreateFrame("Frame")
ns.eventFrame = frame

frame:SetScript("OnEvent", function(_, event, arg1, arg2)
  if event == "PLAYER_LOGIN" then
    onLogin()
  elseif event == "PLAYER_LOGOUT" then
    ns.EndSession()
  elseif event == "PLAYER_XP_UPDATE" then
    if arg1 == nil or arg1 == "player" then sample() end
  elseif event == "PLAYER_LEVEL_UP" then
    onLevelUp(arg1)
    sample()
  elseif event == "TIME_PLAYED_MSG" then
    onTimePlayed(arg1, arg2)
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
listen("PLAYER_LEVEL_UP")
listen("TIME_PLAYED_MSG")
