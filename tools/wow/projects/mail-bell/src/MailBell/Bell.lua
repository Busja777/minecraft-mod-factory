local _, ns = ...
local L = ns.L

-- Listens for mail: rings on new mail, keeps track of which characters have mail waiting and
-- names them after login.

ns.ring = ns.NewRingState()

local entered = false     -- the first PLAYER_ENTERING_WORLD of this UI session has been seen
local mailboxOpen = false -- between MAIL_SHOW and MAIL_CLOSED

function ns.Print(msg)
  DEFAULT_CHAT_FRAME:AddMessage("|cffffd100" .. L["Mail Bell"] .. ":|r " .. msg)
end

function ns.CharKey()
  return (UnitName("player") or "?") .. "-" .. (GetRealmName() or "?")
end

function ns.MyRealm()
  return GetRealmName() or "?"
end

-- A plain true/false from HasNewMail(); nil when it is missing or secret.
local function readNewMail()
  if not HasNewMail then return nil end
  local value = HasNewMail()
  if ns.IsSecret(value) then return nil end
  return value and true or false
end

-- The first sound constant this client knows.
local function bellSound()
  if not SOUNDKIT then return nil end
  for _, name in ipairs({ "ALARM_CLOCK_WARNING_3", "TELL_MESSAGE" }) do
    if type(SOUNDKIT[name]) == "number" then return SOUNDKIT[name] end
  end
  return nil
end

local function ring()
  if ns.settings.sound and PlaySound then
    local sound = bellSound()
    -- "Master" so it is heard even with sound effects muted.
    if sound then pcall(PlaySound, sound, "Master") end
  end
  ns.Print(L["You have new mail."])
end

-- One reading after the game told us something about new mail.
local function check()
  local hasNew = readNewMail()
  if hasNew == nil then return end
  if hasNew then ns.NoteMail(ns.db.chars, ns.me, time()) end
  if ns.ShouldRing(ns.ring, hasNew, GetTime()) then ring() end
end

local function loginList()
  if not ns.settings.login then return end
  local text = ns.WaitingText(ns.db.chars, ns.me, ns.MyRealm())
  if text then ns.Print(text) end
end

local function onLogin()
  MailBellDB = ns.PrepareDB(MailBellDB)
  ns.db = MailBellDB
  ns.settings = MailBellDB.settings
  ns.me = ns.CharKey()
  if C_Timer and C_Timer.After then
    C_Timer.After(ns.LOGIN_DELAY, loginList)
  else
    loginList()
  end
end

local function onEnteringWorld()
  -- Only the first time: mail that was already there must not ring. After a loading screen the
  -- state is kept, so mail that arrived meanwhile still rings.
  if not entered then
    entered = true
    ns.Settle(ns.ring, GetTime())
  end
  check()
end

local function onInboxUpdate()
  if not mailboxOpen or not GetInboxNumItems then return end
  local count = GetInboxNumItems()
  if ns.IsSecret(count) then return end
  if count == 0 then ns.ClearMail(ns.db.chars, ns.me) end
end

local function onMailClosed()
  if not mailboxOpen then return end -- the game can send MAIL_CLOSED twice
  mailboxOpen = false
  if readNewMail() == false then ns.ClearMail(ns.db.chars, ns.me) end
end

local frame = CreateFrame("Frame")
ns.eventFrame = frame

frame:SetScript("OnEvent", function(_, event)
  if event == "PLAYER_LOGIN" then
    onLogin()
    return
  end
  if not ns.db then return end -- nothing is known before login
  if event == "PLAYER_ENTERING_WORLD" then
    onEnteringWorld()
  elseif event == "UPDATE_PENDING_MAIL" then
    check()
  elseif event == "MAIL_SHOW" then
    mailboxOpen = true
  elseif event == "MAIL_INBOX_UPDATE" then
    onInboxUpdate()
  elseif event == "MAIL_CLOSED" then
    onMailClosed()
  end
end)

-- Registered one by one: an event a client does not know is skipped.
local function listen(event)
  pcall(frame.RegisterEvent, frame, event)
end

listen("PLAYER_LOGIN")
listen("PLAYER_ENTERING_WORLD")
listen("UPDATE_PENDING_MAIL")
listen("MAIL_SHOW")
listen("MAIL_INBOX_UPDATE")
listen("MAIL_CLOSED")
