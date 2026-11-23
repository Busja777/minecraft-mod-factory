local _, ns = ...
local L = ns.L

-- Reads the party or raid whenever it changes and remembers who was in it.
-- Inside instances the game can hand out names as secret values; those players are skipped.

function ns.Print(msg)
  DEFAULT_CHAT_FRAME:AddMessage("|cffffd100" .. L["Met Before"] .. ":|r " .. msg)
end

-- A value read from the game; nil when the function is missing or fails.
local function read(fn, ...)
  if not fn then return nil end
  local ok, a, b = pcall(fn, ...)
  if not ok then return nil end
  return a, b
end
ns.Read = read

function ns.HomeRealm()
  local realm = ns.CleanText(read(GetNormalizedRealmName))
  if not realm then realm = ns.CleanText(read(GetRealmName)) end
  return realm
end

function ns.SelfKey()
  return ns.Key(read(UnitName, "player"), nil, ns.HomeRealm())
end

-- Name and realm of a unit when it is a player and nothing about it is secret; nil otherwise.
function ns.UnitPlayer(unit)
  if unit == nil or ns.IsSecret(unit) then return nil end
  local isPlayer = read(UnitIsPlayer, unit)
  if ns.IsSecret(isPlayer) or not isPlayer then return nil end
  local name, realm = read(UnitName, unit)
  if ns.IsSecret(name) or ns.IsSecret(realm) then return nil end
  name = ns.CleanText(name)
  if not name or name == UNKNOWNOBJECT then return nil end
  return name, ns.CleanText(realm)
end

-- The number of group members, 0 outside a group, nil when the game does not tell.
local function groupSize()
  local n = read(GetNumGroupMembers)
  if n == nil or ns.IsSecret(n) or type(n) ~= "number" then return nil end
  return n
end

-- Everyone else in the group as { name, realm }.
function ns.ReadGroup()
  local n = groupSize()
  if not n or n <= 0 then return {}, n end
  local raid = read(IsInRaid)
  if ns.IsSecret(raid) then return {}, nil end
  local members = {}
  local prefix, last = "party", n - 1
  if raid then prefix, last = "raid", n end
  for i = 1, last do
    local unit = prefix .. i
    local name, realm = ns.UnitPlayer(unit)
    if name then members[#members + 1] = { name = name, realm = realm } end
  end
  return members, n
end

function ns.Scan()
  if not ns.db then return end
  local now = read(time)
  if type(now) ~= "number" then return end
  local members, n = ns.ReadGroup()
  if n == nil then return end -- the game could not say: change nothing
  if n <= 0 then
    ns.db.session = ns.NewSession(now)
    return
  end
  ns.Record(ns.db.people, ns.db.session, members, now, read(GetRealZoneText), ns.HomeRealm(), ns.SelfKey())
end

local function onLogin()
  MetBeforeDB = MetBeforeDB or {}
  local db = MetBeforeDB
  db.version = 1
  db.people = db.people or {}
  ns.db = db
  ns.Prune(db.people)
  local n = groupSize()
  local now = read(time)
  if not ns.ContinueSession(db.session, now, n ~= nil and n > 0) then db.session = ns.NewSession(now) end
end

local frame = CreateFrame("Frame")
ns.eventFrame = frame

frame:SetScript("OnEvent", function(_, event)
  if event == "PLAYER_LOGIN" then
    onLogin()
  elseif event == "GROUP_LEFT" then
    if ns.db then ns.db.session = ns.NewSession(read(time)) end
  else
    ns.Scan()
  end
end)

for _, event in ipairs({ "PLAYER_LOGIN", "PLAYER_ENTERING_WORLD", "GROUP_ROSTER_UPDATE", "GROUP_LEFT" }) do
  pcall(frame.RegisterEvent, frame, event)
end
