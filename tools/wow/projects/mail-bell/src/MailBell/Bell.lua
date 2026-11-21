local _, ns = ...
local L = ns.L

-- Listens for mail: rings on new mail, keeps track of which characters have mail waiting and
-- names them after login. While the mailbox is open it looks for letters with items or gold that
-- run out soon, warns once per session and remembers it for the login list.

ns.ring = ns.NewRingState()

local entered = false     -- the first PLAYER_ENTERING_WORLD of this UI session has been seen
local mailboxOpen = false -- between MAIL_SHOW and MAIL_CLOSED
local expiryWarned = false -- the expiry warning has been printed in this UI session

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

-- Plays the chosen bell once (also the preview of /mb sound <name>).
function ns.PlayBell()
  if not PlaySound then return end
  local sound = ns.SoundId(SOUNDKIT, ns.settings.bell)
  -- "Master" so it is heard even with sound effects muted.
  if sound then pcall(PlaySound, sound, "Master") end
end

local function ring()
  if ns.settings.sound then ns.PlayBell() end
  ns.Print(L["You have new mail."])
end

-- One reading after the game told us something about new mail.
local function check()
  local hasNew = readNewMail()
  if hasNew == nil then return end
  if hasNew then ns.NoteMail(ns.db.chars, ns.me, time()) end
  if ns.ShouldRing(ns.ring, hasNew, GetTime()) then ring() end
end

function ns.ExpiringLine()
  return ns.ExpiringText(ns.db.chars, time(), ns.settings.expire, ns.MyRealm())
end

-- After login: the other characters with mail, the other characters whose items or gold run out
-- soon, and (1.3) the letters of this character that run out soon, from its last mailbox visit.
local function loginList()
  if not ns.settings.login then return end
  local text = ns.WaitingText(ns.db.chars, ns.me, ns.MyRealm())
  if text then ns.Print(text) end
  local now = time()
  local expiring = ns.ExpiringText(ns.db.chars, now, ns.settings.expire, ns.MyRealm(), ns.me)
  if expiring then ns.Print(expiring) end
  local own = ns.OwnExpiryText(ns.db.chars[ns.me], now, ns.settings.expire)
  if own then ns.Print(own) end
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

-- The letters of the inbox as ScanExpiry wants them. GetInboxHeaderInfo(index) returns
-- packageIcon, stationeryIcon, sender, subject, money, CODAmount, daysLeft, hasItem, ...
local function readLetters(count)
  local letters = {}
  if not GetInboxHeaderInfo then return letters end
  for i = 1, count do
    local ok, _, _, sender, subject, money, cod, daysLeft, hasItem = pcall(GetInboxHeaderInfo, i)
    if ok then
      letters[#letters + 1] = { sender = sender, subject = subject, money = money, cod = cod, daysLeft = daysLeft, hasItem = hasItem }
    end
  end
  return letters
end

local function checkExpiry(count)
  if not GetInboxHeaderInfo then return end
  local letters, now = readLetters(count), time()
  local soonest, expiring = ns.ScanExpiry(letters, ns.settings.expire)
  local counted = ns.CountedLetters(letters)
  ns.NoteExpiry(ns.db.chars, ns.me, soonest, now)
  ns.NoteLetters(ns.db.chars, ns.me, counted, now) -- 1.3: for the login line and /mb letters
  if expiryWarned or ns.settings.expire == 0 then return end
  local firstSoon = nil
  if expiring > 0 then firstSoon = soonest end
  local names = {}
  for _, m in ipairs(counted) do
    if ns.Within(m.days, ns.settings.expire) then names[#names + 1] = ns.LetterLabel(m.sender, m.subject) end
  end
  local text = ns.ExpiryWarning(expiring, firstSoon, ns.settings.expire, names)
  if text then
    expiryWarned = true
    ns.Print(text)
  end
end

local function onInboxUpdate()
  if not mailboxOpen or not GetInboxNumItems then return end
  local count = GetInboxNumItems()
  if ns.IsSecret(count) or type(count) ~= "number" then return end
  if count == 0 then ns.ClearMail(ns.db.chars, ns.me) end
  checkExpiry(count)
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
