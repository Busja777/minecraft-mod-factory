local _, ns = ...

-- Notes how the character you are playing looks right now: class, level, gold, place, rested bonus
-- and played time.

ns.PLAYED_DELAY = 3   -- seconds after login before the played time is asked for
ns.HUSH_TIMEOUT = 15  -- the chat prints /played answers again at the latest after this many seconds

function ns.CharKey()
  return (UnitName("player") or "?") .. "-" .. (GetRealmName() or "?")
end

local function readable(value)
  return value ~= nil and not ns.IsSecret(value)
end

function ns.AtMaxLevel()
  if not IsPlayerAtEffectiveMaxLevel then return false end
  local atMax = IsPlayerAtEffectiveMaxLevel()
  return not ns.IsSecret(atMax) and atMax and true or false
end

local function saveClass(c)
  local _, classFile = UnitClass("player")
  if readable(classFile) then c.class = classFile end
end

local function saveLevel(c, level)
  if not readable(level) or type(level) ~= "number" then level = UnitLevel("player") end
  if readable(level) and level > 0 then c.level = level end
end

local function saveMoney(c)
  local money = GetMoney()
  if readable(money) then c.money = money end
end

local function saveZone(c)
  local zone = GetRealZoneText()
  if not readable(zone) or zone == "" then return end -- loading screen: keep the last place
  local subzone = GetSubZoneText and GetSubZoneText()
  c.zone = zone
  c.subzone = readable(subzone) and subzone ~= "" and subzone or nil
end

local function saveRested(c)
  if ns.AtMaxLevel() then
    c.maxLevel = true
    c.rested = 0
    return
  end
  c.maxLevel = nil
  local exhaustion, max = GetXPExhaustion(), UnitXPMax("player")
  if ns.IsSecret(exhaustion) or not readable(max) then return end
  local percent = ns.RestedPercent(exhaustion or 0, max) -- no rested bonus reads as nil
  if percent then c.rested = percent end
end

local function saveResting(c)
  local resting = IsResting()
  if readable(resting) then c.resting = resting and true or false end
end

-- The played time comes from the same answer as /played. While the addon asks for it, the chat
-- windows do not print that answer; they get it back right after (or after HUSH_TIMEOUT).
-- Without C_Timer there is no safe way back, so the chat is left alone.
local hushed

local function later(seconds, fn)
  if C_Timer and C_Timer.After then
    C_Timer.After(seconds, fn)
    return true
  end
  return false
end

local function unhush()
  if not hushed then return end
  for _, f in ipairs(hushed) do pcall(f.RegisterEvent, f, "TIME_PLAYED_MSG") end
  hushed = nil
end

local function hush()
  if hushed or not (C_Timer and C_Timer.After) or type(NUM_CHAT_WINDOWS) ~= "number" then return end
  hushed = {}
  for i = 1, NUM_CHAT_WINDOWS do
    local f = _G["ChatFrame" .. i]
    if type(f) == "table" and f.IsEventRegistered and f:IsEventRegistered("TIME_PLAYED_MSG") then
      f:UnregisterEvent("TIME_PLAYED_MSG")
      hushed[#hushed + 1] = f
    end
  end
  later(ns.HUSH_TIMEOUT, unhush)
end

function ns.RequestPlayed()
  if not ns.char or not RequestTimePlayed then return end
  hush()
  RequestTimePlayed()
end

local function savePlayed(c, total)
  if not readable(total) or type(total) ~= "number" or total < 0 then return end
  c.played = math.floor(total)
  c.playedAt = time()
end

-- The character's own clock keeps running while you play: brought up to date on logout.
local function advancePlayed(c)
  if type(c.played) ~= "number" or type(c.playedAt) ~= "number" then return end
  local now = time()
  if now > c.playedAt then c.played = c.played + (now - c.playedAt) end
  c.playedAt = now
end

function ns.SaveAll()
  local c = ns.char
  if not c then return end
  saveClass(c)
  saveLevel(c)
  saveMoney(c)
  saveZone(c)
  saveRested(c)
  saveResting(c)
  c.seen = time()
end

local function onLogin()
  AltAlmanacDB = AltAlmanacDB or {}
  local db = AltAlmanacDB
  -- 2: played time (1.1), entries of 1.0 simply have none yet; 3: sorting and filters (1.2).
  db.version = 3
  db.chars = db.chars or {}
  if type(db.settings) ~= "table" then db.settings = {} end
  local s = db.settings
  s.sortBy = ns.ValidSort(s.sortBy) or ns.DEFAULT_SORT
  s.sortReverse = s.sortReverse == true
  s.realmOnly = s.realmOnly == true
  s.minLevel = ns.ValidMinLevel(s.minLevel)
  if s.minLevel == 1 then s.minLevel = nil end -- level 1 and up is everyone
  ns.db = db

  local key = ns.CharKey()
  local char = db.chars[key] or {}
  db.chars[key] = char
  ns.char = char
  if type(char.played) == "number" then
    char.playedAt = time() -- the time logged out does not count as played
  else
    char.played, char.playedAt = nil, nil
  end
  ns.SaveAll()
  if not later(ns.PLAYED_DELAY, ns.RequestPlayed) then ns.RequestPlayed() end
end

local frame = CreateFrame("Frame")
ns.eventFrame = frame

frame:SetScript("OnEvent", function(_, event, ...)
  if event == "PLAYER_LOGIN" then
    onLogin()
  elseif not ns.char then
    return
  elseif event == "PLAYER_LOGOUT" then
    advancePlayed(ns.char)
    ns.SaveAll()
    return
  else
    local c = ns.char
    if event == "PLAYER_MONEY" then
      saveMoney(c)
    elseif event == "PLAYER_LEVEL_UP" then
      saveLevel(c, (...))
      -- The XP bar of the new level may not be readable yet; UPDATE_EXHAUSTION brings the rest.
      if ns.AtMaxLevel() then
        c.maxLevel = true
        c.rested = 0
      end
    elseif event == "ZONE_CHANGED_NEW_AREA" or event == "ZONE_CHANGED" or event == "ZONE_CHANGED_INDOORS" then
      saveZone(c)
    elseif event == "UPDATE_EXHAUSTION" then
      saveRested(c)
    elseif event == "PLAYER_UPDATE_RESTING" then
      saveResting(c)
      saveRested(c)
    elseif event == "TIME_PLAYED_MSG" then
      savePlayed(c, (...))
      if hushed and not later(0, unhush) then unhush() end
    end
    c.seen = time()
  end
  if ns.Refresh then ns.Refresh() end
end)

-- Registered one by one: an event a client does not know is skipped.
local function listen(event)
  pcall(frame.RegisterEvent, frame, event)
end

listen("PLAYER_LOGIN")
listen("PLAYER_LOGOUT")
listen("PLAYER_MONEY")
listen("PLAYER_LEVEL_UP")
listen("ZONE_CHANGED_NEW_AREA")
listen("ZONE_CHANGED")
listen("ZONE_CHANGED_INDOORS")
listen("UPDATE_EXHAUSTION")
listen("PLAYER_UPDATE_RESTING")
listen("TIME_PLAYED_MSG")
