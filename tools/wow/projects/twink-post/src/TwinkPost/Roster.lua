local _, ns = ...

-- Notes the character being played (name, realm, class, level, faction) in the account-wide saved
-- list: at login, on a level-up and whenever a mailbox opens (a Pandaren may have picked a faction).

local function call(fn, ...)
  if type(fn) ~= "function" then return nil end
  local ok, a, b = pcall(fn, ...)
  if not ok then return nil end
  return a, b
end

-- What the game says about the character being played. Secret values are dropped by ns.Record.
function ns.ReadSelf(level)
  local _, classFile = call(UnitClass, "player")
  return {
    name = call(UnitName, "player"),
    realm = call(GetRealmName),
    realmKey = call(GetNormalizedRealmName),
    class = classFile,
    level = level or call(UnitLevel, "player"),
    faction = call(UnitFactionGroup, "player"),
  }
end

function ns.RecordSelf(level)
  if not ns.db then return end
  local key = ns.Record(ns.db.chars, ns.ReadSelf(level), time())
  if key then ns.me = key end
end

-- The saved entry of the character being played, or an empty table before it is known.
function ns.Me()
  return ns.db and ns.me and ns.db.chars[ns.me] or {}
end

-- The connected realms of the player's realm as the game's own recipient completion knows them.
function ns.ConnectedRealms()
  local fn = C_AutoComplete and C_AutoComplete.GetAutoCompleteRealms or GetAutoCompleteRealms
  local realms = call(fn)
  if type(realms) ~= "table" or ns.IsSecret(realms) then return {} end
  return realms
end

-- The characters the player can send mail to right now.
function ns.CurrentCandidates()
  if not ns.db then return {} end
  local me = ns.Me()
  return ns.Candidates(ns.db.chars, ns.me, me.realmKey, ns.ConnectedRealms(), me.faction)
end

local function onLogin()
  TwinkPostDB = ns.PrepareDB(TwinkPostDB)
  ns.db = TwinkPostDB
  ns.RecordSelf()
  if ns.AttachButton then ns.AttachButton() end
end

local frame = CreateFrame("Frame")
ns.eventFrame = frame

frame:SetScript("OnEvent", function(_, event, ...)
  if event == "PLAYER_LOGIN" then
    onLogin()
    return
  end
  if not ns.db then return end -- nothing is known before login
  if event == "PLAYER_LEVEL_UP" then
    local level = ...
    if ns.IsSecret(level) or type(level) ~= "number" then level = nil end
    ns.RecordSelf(level)
  elseif event == "MAIL_SHOW" then
    ns.RecordSelf()
    if ns.AttachButton then ns.AttachButton() end
  end
end)

-- Registered one by one: an event a client does not know is skipped.
local function listen(event)
  pcall(frame.RegisterEvent, frame, event)
end

listen("PLAYER_LOGIN")
listen("PLAYER_LEVEL_UP")
listen("MAIL_SHOW")
