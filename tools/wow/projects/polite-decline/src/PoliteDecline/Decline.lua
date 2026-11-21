local _, ns = ...

-- Listens for duel requests and group invitations and turns down those from strangers.
-- When the player wants it, the stranger gets one short polite whisper (1.1). Every declined request
-- is written to the log (1.2).

ns.session = { duel = 0, invite = 0 }
ns.whispers = ns.NewWhisperState()
ns.sessionLog = {}    -- 1.2: what was declined since login (the last LOG_KEEP of it)
ns.sessionLogged = 0  -- and how much, since login or /pd log clear

local POPUPS = {
  duel = { "DUEL_REQUESTED" },
  invite = { "PARTY_INVITE", "PARTY_INVITE_XREALM" },
}

function ns.Print(msg)
  DEFAULT_CHAT_FRAME:AddMessage("|cffffd100" .. ns.L["Polite Decline"] .. ":|r " .. msg)
end

local function hidePopups(kind)
  if not StaticPopup_Hide then return end
  for _, which in ipairs(POPUPS[kind]) do StaticPopup_Hide(which) end
end

-- Sends the answer to the game. False when the game offers no way to decline.
local function decline(kind)
  if kind == "duel" then
    if not CancelDuel then return false end
    CancelDuel()
  else
    if not DeclineGroup then return false end
    DeclineGroup()
  end
  hidePopups(kind)
  -- The game may show its popup after this handler ran; hide it again on the next frame.
  if C_Timer and C_Timer.After then
    C_Timer.After(0, function() hidePopups(kind) end)
  end
  return true
end

function ns.WhisperText()
  return ns.settings.whisperText or ns.L[ns.DEFAULT_WHISPER]
end

-- The game's chat function: C_ChatInfo.SendChatMessage in current clients, SendChatMessage before.
local function send(text, target)
  local api = C_ChatInfo and C_ChatInfo.SendChatMessage or SendChatMessage
  if not api then return false end
  return pcall(api, text, "WHISPER", nil, target)
end

local function outdoors()
  if not IsInInstance then return false end
  local inInstance, instanceType = IsInInstance()
  local lockdown = nil
  if C_ChatInfo and C_ChatInfo.InChatMessagingLockdown then lockdown = C_ChatInfo.InChatMessagingLockdown() end
  return ns.SafeToWhisper(inInstance, instanceType, lockdown)
end

-- One polite whisper to the stranger who was just declined, if switched on, allowed here and not
-- sent to that name a short while ago.
local function reply(name)
  if not ns.settings.whisper or not outdoors() then return end
  if not ns.MayWhisper(ns.whispers, ns.WhisperKey(name, ns.HomeRealm()), GetTime()) then return end
  send(ns.WhisperText(), name)
end

-- Notes a declined request in the log of this session and in the saved log (1.2), also in quiet mode.
function ns.Log(kind, name)
  local entry = { t = time(), name = name, kind = kind }
  if not ns.ValidLogEntry(entry) then return end
  ns.AddLog(ns.sessionLog, entry)
  ns.AddLog(ns.db.log, { t = entry.t, name = name, kind = kind })
  ns.sessionLogged = ns.sessionLogged + 1
end

function ns.Handle(kind, name, guid)
  if not ns.settings then return end
  local person = ns.Identify(kind, name, guid)
  if not ns.Decide(kind, ns.settings, person, ns.db.allow, ns.HomeRealm()) then return end
  if not decline(kind) then return end
  ns.session[kind] = ns.session[kind] + 1
  if not ns.settings.quiet then ns.Print(ns.DeclineLine(kind, name, ns.session[kind])) end
  ns.Log(kind, name)
  reply(name)
end

local function onLogin()
  if type(PoliteDeclineDB) ~= "table" then PoliteDeclineDB = {} end
  local db = PoliteDeclineDB
  db.version = 3 -- 2 since 1.1: settings.whisper and settings.whisperText; 3 since 1.2: the log
  if type(db.settings) ~= "table" then db.settings = {} end
  if db.settings.duels == nil then db.settings.duels = true end
  if db.settings.invites == nil then db.settings.invites = true end
  if db.settings.quiet == nil then db.settings.quiet = false end
  if type(db.settings.whisper) ~= "boolean" then db.settings.whisper = false end
  db.settings.whisperText = ns.CleanWhisper(db.settings.whisperText) -- nil: the default text
  if type(db.allow) ~= "table" then db.allow = {} end
  db.log = ns.CleanLog(db.log)
  ns.db = db
  ns.settings = db.settings
  -- Asks the server for the guild roster, so guild mates are recognised by name.
  local inGuild = IsInGuild and IsInGuild()
  if C_GuildInfo and C_GuildInfo.GuildRoster and not ns.IsSecret(inGuild) and inGuild then
    C_GuildInfo.GuildRoster()
  end
end

local frame = CreateFrame("Frame")
ns.eventFrame = frame

frame:SetScript("OnEvent", function(_, event, ...)
  if event == "PLAYER_LOGIN" then
    onLogin()
  elseif event == "DUEL_REQUESTED" then
    ns.Handle("duel", (...))
  elseif event == "PARTY_INVITE_REQUEST" then
    -- name, isTank, isHealer, isDamage, isNativeRealm, allowMultipleRoles, inviterGUID, ...
    ns.Handle("invite", (...), (select(7, ...)))
  end
end)

-- Registered one by one: an event a client does not know is skipped.
local function listen(event)
  pcall(frame.RegisterEvent, frame, event)
end

listen("PLAYER_LOGIN")
listen("DUEL_REQUESTED")
listen("PARTY_INVITE_REQUEST")
