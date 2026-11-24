local _, ns = ...
local L = ns.L

-- Listens for people coming online and rings the bell:
--   friends and guild members: the game's system message "[Name] has come online." (CHAT_MSG_SYSTEM),
--     matched with the game's own text (ERR_FRIEND_ONLINE_SS), so it works in every client language;
--   Battle.net friends: BN_FRIEND_ACCOUNT_ONLINE.
-- After login and after a reload the game fills its lists; the bell stays quiet for ns.QUIET seconds.
-- No combat log. Anything the game hands out as a secret value is skipped.

ns.state = ns.NewState()

local pattern -- the online message as a Lua pattern, built on first use

function ns.Print(msg)
  DEFAULT_CHAT_FRAME:AddMessage("|cffffd100" .. L["Login Bell"] .. ":|r " .. msg)
end

-- A value read from the game; nil when the function is missing, fails or the value is secret.
local function read(fn, ...)
  if not fn then return nil end
  local ok, a = pcall(fn, ...)
  if not ok or ns.IsSecret(a) then return nil end
  return a
end
ns.Read = read

local function now()
  return read(GetTime) or 0
end

-- Plays the bell once (also the preview of /lb test).
function ns.PlayBell()
  if not PlaySound then return end
  local id = ns.SoundId(SOUNDKIT)
  -- "Master" so it is heard even with sound effects turned down.
  if id then pcall(PlaySound, id, "Master") end
end

-- The names on the character friend list.
function ns.FriendNames()
  local names = {}
  local list = C_FriendList
  if not list or not list.GetNumFriends or not list.GetFriendInfoByIndex then return names end
  local n = read(list.GetNumFriends)
  if type(n) ~= "number" then return names end
  for i = 1, n do
    local info = read(list.GetFriendInfoByIndex, i)
    local name = type(info) == "table" and info.name
    if type(name) == "string" and not ns.IsSecret(name) then names[#names + 1] = name end
  end
  return names
end

local function inGuild()
  return read(IsInGuild) and true or false
end

-- Somebody came online: one chat line, and the sound unless it played a moment ago.
function ns.Announce(kind, key, who)
  if not ns.db then return end
  local result, sound = ns.Decide(ns.state, ns.db.settings, kind, key, now())
  if result ~= "ring" then return result end
  if sound then ns.PlayBell() end
  if kind == "guild" then
    ns.Print(string.format(L["Guild member online: %s"], who))
  else
    ns.Print(string.format(L["Friend online: %s"], who))
  end
  return result
end

local function onSystem(text)
  if not ns.db or type(text) ~= "string" or ns.IsSecret(text) then return end
  pattern = pattern or ns.OnlinePattern()
  local full, shown = ns.ParseOnline(text, pattern)
  if not full then return end
  if ns.SameName(full, read(UnitName, "player")) then return end
  local kind = ns.KindOf(full, ns.FriendNames(), inGuild())
  -- The same clickable name the game shows.
  local who = "|Hplayer:" .. full .. "|h[" .. shown .. "]|h"
  ns.Announce(kind, "char:" .. ns.NameKey(full), who)
end

local function onBNetOnline(friendId, isCompanionApp)
  -- Secret values are checked first: comparing one is an error in Midnight.
  if not ns.db or ns.IsSecret(friendId) or ns.IsSecret(isCompanionApp) or friendId == nil then return end
  if isCompanionApp == true then return end -- only in the mobile app, not playing
  local bn = C_BattleNet
  if not bn or not bn.GetAccountInfoByID then return end
  local name = ns.BNetName(read(bn.GetAccountInfoByID, friendId))
  if not name then return end
  ns.Announce("friend", "bn:" .. tostring(friendId), name)
end

local function onLogin()
  LoginBellDB = LoginBellDB or {}
  local db = LoginBellDB
  db.version = 1
  db.settings = ns.Settings(db.settings)
  ns.db = db
  ns.Quiet(ns.state, now())
end

local frame = CreateFrame("Frame")
ns.eventFrame = frame

frame:SetScript("OnEvent", function(_, event, ...)
  if event == "PLAYER_LOGIN" then
    onLogin()
  elseif event == "PLAYER_ENTERING_WORLD" then
    local isInitialLogin, isReloadingUi = ...
    if isInitialLogin == true or isReloadingUi == true then ns.Quiet(ns.state, now()) end
  elseif event == "CHAT_MSG_SYSTEM" then
    onSystem((...))
  elseif event == "BN_FRIEND_ACCOUNT_ONLINE" then
    onBNetOnline(...)
  end
end)

for _, event in ipairs({ "PLAYER_LOGIN", "PLAYER_ENTERING_WORLD", "CHAT_MSG_SYSTEM", "BN_FRIEND_ACCOUNT_ONLINE" }) do
  pcall(frame.RegisterEvent, frame, event)
end
