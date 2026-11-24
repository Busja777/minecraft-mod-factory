local _, ns = ...
local L = ns.L

-- Watches three moments: a level up, an achievement and epic loot of the player. Each one plans a
-- screenshot a second later (the game's toast is then on screen), at most one in ns.GAP seconds and
-- never during a loading screen. No combat log. Anything the game hands out as a secret value is skipped.

ns.NOTE_WAIT = 5 -- seconds in which the game's answer to a screenshot belongs to ours

ns.state = { last = nil, pending = nil, loading = false }
ns.taken = nil -- { occasions, at } of the screenshot asked for, until the game answers
local patterns

function ns.Print(msg)
  DEFAULT_CHAT_FRAME:AddMessage("|cffffd100" .. L["Screenshot Moments"] .. ":|r " .. msg)
end

-- A value read from the game; nil when the function is missing or fails.
local function read(fn, ...)
  if not fn then return nil end
  local ok, a, b, c = pcall(fn, ...)
  if not ok then return nil end
  return a, b, c
end

local function now()
  local t = read(GetTime)
  if type(t) ~= "number" or ns.IsSecret(t) then return 0 end
  return t
end

-- Takes the screenshot of the waiting moments.
function ns.Shoot()
  local occasions = ns.Take(ns.state)
  if not occasions then return end
  if not Screenshot then
    ns.Print(ns.FailedText(occasions))
    return
  end
  ns.taken = { occasions = occasions, at = now() } -- before the call: the game may answer at once
  local ok = pcall(Screenshot)
  if not ok then
    ns.taken = nil
    ns.Print(ns.FailedText(occasions))
  end
end

local function later(seconds, fn)
  if C_Timer and C_Timer.After then
    C_Timer.After(seconds, fn)
  else
    fn()
  end
end

-- One moment. → the answer of ns.Offer.
function ns.Moment(occasion)
  local answer = ns.Offer(ns.state, now(), occasion)
  if answer == "shoot" then later(ns.DELAY, ns.Shoot) end
  return answer
end

local function on()
  return ns.db and ns.db.settings.on
end

-- The game's answer to a screenshot: a chat line only for ours, never for one taken by key.
local function answered(ok)
  local taken = ns.taken
  ns.taken = nil
  if not taken or now() - taken.at > ns.NOTE_WAIT then return end
  ns.Print(ok and ns.SavedText(taken.occasions) or ns.FailedText(taken.occasions))
end

-- Quality of an item link from the client's cache; nil while unknown or secret.
function ns.ItemQuality(link)
  local q = C_Item and C_Item.GetItemQualityByID and read(C_Item.GetItemQualityByID, link)
  if type(q) == "number" and not ns.IsSecret(q) then return q end
  local info = (C_Item and C_Item.GetItemInfo) or GetItemInfo
  local _, _, quality = read(info, link)
  if type(quality) == "number" and not ns.IsSecret(quality) then return quality end
  return nil
end

local function onLevel(level)
  ns.Moment(ns.LevelOccasion(level))
end

local function onAchievement(id, alreadyEarned)
  -- An achievement the account had already earned is no new moment.
  if alreadyEarned == true and not ns.IsSecret(alreadyEarned) then return end
  local name
  if id ~= nil and not ns.IsSecret(id) then
    local _, n = read(GetAchievementInfo, id)
    name = n
  end
  ns.Moment(ns.AchievementOccasion(name))
end

local function onLoot(text)
  if type(text) ~= "string" or ns.IsSecret(text) then return end
  patterns = patterns or ns.LootPatterns()
  local link = ns.SelfLootLink(text, patterns)
  if not link or not ns.IsEpic(ns.ItemQuality(link)) then return end
  ns.Moment(ns.LootOccasion(link))
end

local function onLogin()
  ScreenshotMomentsDB = ScreenshotMomentsDB or {}
  local db = ScreenshotMomentsDB
  db.version = 1
  db.settings = db.settings or {}
  if db.settings.on == nil then db.settings.on = true end
  ns.db = db
end

local frame = CreateFrame("Frame")
ns.eventFrame = frame

frame:SetScript("OnEvent", function(_, event, ...)
  if event == "PLAYER_LOGIN" then
    onLogin()
  elseif event == "LOADING_SCREEN_ENABLED" then
    ns.state.loading = true
  elseif event == "LOADING_SCREEN_DISABLED" or event == "PLAYER_ENTERING_WORLD" then
    -- PLAYER_ENTERING_WORLD also ends the block, in case the client ever skips LOADING_SCREEN_DISABLED
    ns.state.loading = false
  elseif event == "SCREENSHOT_SUCCEEDED" then
    answered(true)
  elseif event == "SCREENSHOT_FAILED" then
    answered(false)
  elseif not on() then
    return
  elseif event == "PLAYER_LEVEL_UP" then
    onLevel((...))
  elseif event == "ACHIEVEMENT_EARNED" then
    onAchievement(...)
  elseif event == "CHAT_MSG_LOOT" then
    onLoot((...))
  end
end)

for _, event in ipairs({
  "PLAYER_LOGIN", "PLAYER_ENTERING_WORLD", "LOADING_SCREEN_ENABLED", "LOADING_SCREEN_DISABLED", "SCREENSHOT_SUCCEEDED", "SCREENSHOT_FAILED",
  "PLAYER_LEVEL_UP", "ACHIEVEMENT_EARNED", "CHAT_MSG_LOOT",
}) do
  pcall(frame.RegisterEvent, frame, event)
end
