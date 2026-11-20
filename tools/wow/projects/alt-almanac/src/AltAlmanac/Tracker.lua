local _, ns = ...

-- Notes how the character you are playing looks right now: class, level, gold, place and rested bonus.

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
  db.version = 1
  db.chars = db.chars or {}
  db.settings = db.settings or {}
  ns.db = db

  local key = ns.CharKey()
  local char = db.chars[key] or {}
  db.chars[key] = char
  ns.char = char
  ns.SaveAll()
end

local frame = CreateFrame("Frame")
ns.eventFrame = frame

frame:SetScript("OnEvent", function(_, event, ...)
  if event == "PLAYER_LOGIN" then
    onLogin()
  elseif not ns.char then
    return
  elseif event == "PLAYER_LOGOUT" then
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
