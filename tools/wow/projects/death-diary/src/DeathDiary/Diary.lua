local _, ns = ...
local L = ns.L

-- Notes each death of the player: zone, sub-zone, level and time. It never reads the combat log,
-- so it does not know what killed you.

ns.guard = { at = nil, waiting = false }

function ns.Print(msg)
  DEFAULT_CHAT_FRAME:AddMessage("|cffffd100" .. L["Death Diary"] .. ":|r " .. msg)
end

-- A value read from the game; nil when the function is missing or fails.
local function read(fn, ...)
  if not fn then return nil end
  local ok, a, b = pcall(fn, ...)
  if not ok then return nil end
  return a, b
end

function ns.CurrentCharKey()
  local name = read(UnitName, "player")
  local realm = read(GetRealmName)
  if not ns.CleanText(realm) then
    local _, fullRealm = read(UnitFullName, "player")
    realm = fullRealm
  end
  if not ns.CleanText(name) then name = read(UnitFullName, "player") end
  return ns.MakeCharKey(name, realm)
end

-- The diary of the character being played; created as soon as name and realm are known.
function ns.Char()
  if not ns.db then return nil end
  if ns.char then return ns.char end
  local key = ns.CurrentCharKey()
  if not key then return nil end
  local char = ns.db.chars[key] or { deaths = {} }
  char.deaths = char.deaths or {}
  ns.db.chars[key] = char
  ns.char, ns.charKey = char, key
  return char
end

function ns.Deaths()
  local char = ns.Char()
  return char and char.deaths or {}
end

local function onLogin()
  DeathDiaryDB = DeathDiaryDB or {}
  local db = DeathDiaryDB
  db.version = 1
  db.chars = db.chars or {}
  db.settings = db.settings or {}
  if db.settings.quiet == nil then db.settings.quiet = false end
  ns.db = db
  ns.char = nil
  ns.Char()
  -- Logged in while dead: a death event right now belongs to a death that is already noted.
  local dead = read(UnitIsDeadOrGhost, "player")
  if not ns.IsSecret(dead) and dead == true then
    ns.guard.at, ns.guard.waiting = GetTime(), true
  end
end

local function onDead()
  local char = ns.Char()
  if not char then return end
  local now = GetTime()
  if not ns.IsNewDeath(ns.guard, now) then return end
  ns.guard.at, ns.guard.waiting = now, true
  local entry = ns.NewEntry(read(GetRealZoneText), read(GetSubZoneText), read(UnitLevel, "player"), read(time))
  ns.Push(char.deaths, entry)
  if not ns.db.settings.quiet then ns.Print(ns.DeathNote(entry, #char.deaths)) end
  if ns.Refresh then ns.Refresh() end
end

local function onAlive()
  ns.guard.waiting = false
end

local frame = CreateFrame("Frame")
ns.eventFrame = frame

frame:SetScript("OnEvent", function(_, event)
  if event == "PLAYER_LOGIN" then
    onLogin()
  elseif event == "PLAYER_DEAD" then
    if ns.db then onDead() end
  elseif event == "PLAYER_ALIVE" or event == "PLAYER_UNGHOST" then
    onAlive()
  end
end)

for _, event in ipairs({ "PLAYER_LOGIN", "PLAYER_DEAD", "PLAYER_ALIVE", "PLAYER_UNGHOST" }) do
  pcall(frame.RegisterEvent, frame, event)
end
