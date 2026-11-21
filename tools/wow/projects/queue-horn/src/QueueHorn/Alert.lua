local _, ns = ...
local L = ns.L

-- Listens for the moments a queue pops or a ready check starts and plays the alert:
-- one sound on the Master channel, the flashing game icon and one line in the middle of the screen.

local COLOR = { r = 1, g = 0.82, b = 0 }

local last = {}   -- last[kind] = time of the latest alert of that kind
local seen = {}   -- seen[slot] = status of a battleground or arena queue slot last time

function ns.Print(msg)
  DEFAULT_CHAT_FRAME:AddMessage("|cffffd100" .. L["Queue Horn"] .. ":|r " .. msg)
end

-- A value read from the game; nil when it is missing or must not be used.
local function plain(value)
  if value == nil or ns.IsSecret(value) then return nil end
  return value
end

-- Plays the sound chosen for one kind of alert (nil: the horn).
function ns.PlayAlertSound(kind)
  if not PlaySound then return end
  local id = ns.SoundId(SOUNDKIT, ns.SoundFor(ns.settings, kind))
  if not id then return end
  -- Master plays even when the effects channel is turned down or muted.
  PlaySound(id, "Master")
end

local function showMessage(text)
  if RaidNotice_AddMessage and RaidWarningFrame then
    RaidNotice_AddMessage(RaidWarningFrame, text, COLOR)
  elseif UIErrorsFrame then
    UIErrorsFrame:AddMessage(text, COLOR.r, COLOR.g, COLOR.b)
  end
end

-- The alert itself, without any check. kind = nil is the test from /qh test; test = true plays the
-- sound of that kind with the test message (/qh test lfg).
function ns.Play(kind, test)
  ns.PlayAlertSound(kind)
  if ns.settings.flash and FlashClientIcon then FlashClientIcon() end
  showMessage(ns.Message((not test) and kind or nil))
end

function ns.Alert(kind)
  if ns.Allow(last, ns.settings, kind, GetTime()) then ns.Play(kind) end
end

local function onReadyCheck(initiator)
  local realm = GetNormalizedRealmName and GetNormalizedRealmName() or nil
  if ns.IsOwnReadyCheck(initiator, UnitName("player"), realm) then return end
  ns.Alert("ready")
end

-- Reads every battleground and arena queue slot; alerts once for a slot that has just become ready.
-- quiet only notes the slots, without an alert.
local function onBattlefieldStatus(quiet)
  if not GetBattlefieldStatus then return end
  local count = plain(GetMaxBattlefieldID and GetMaxBattlefieldID()) or 3
  local statuses = {}
  for slot = 1, count do statuses[slot] = (GetBattlefieldStatus(slot)) end
  if ns.NewConfirms(seen, statuses, count) > 0 and not quiet then ns.Alert("pvp") end
end

local function onLogin()
  if type(QueueHornDB) ~= "table" then QueueHornDB = {} end
  local db = QueueHornDB
  db.version = 2 -- 2 since 1.1: settings.sounds[kind]
  if type(db.settings) ~= "table" then db.settings = {} end
  ns.db = db
  ns.settings = ns.Settings(db.settings)
  -- Queues that are already ready after a reload were announced before.
  onBattlefieldStatus(true)
end

local frame = CreateFrame("Frame")
ns.eventFrame = frame

frame:SetScript("OnEvent", function(_, event, ...)
  if event == "PLAYER_LOGIN" then
    onLogin()
  elseif not ns.settings then
    return
  elseif event == "READY_CHECK" then
    onReadyCheck((...))
  elseif event == "UPDATE_BATTLEFIELD_STATUS" then
    onBattlefieldStatus()
  else
    local kind = ns.EVENT_KIND[event]
    if kind then ns.Alert(kind) end
  end
end)

-- Registered one by one: an event a client does not know is skipped.
local function listen(event)
  pcall(frame.RegisterEvent, frame, event)
end

listen("PLAYER_LOGIN")
for event in pairs(ns.EVENT_KIND) do listen(event) end
