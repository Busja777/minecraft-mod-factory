-- Tests for Level Clock, run by tools/wow/client/run.lua.

-- The stand-in client has no XP bar; these are the game functions the addon reads it with.
local STAND_IN = { "UnitXP", "UnitXPMax", "UnitLevel", "GetXPExhaustion", "IsPlayerAtEffectiveMaxLevel" }
local player

local function client(p)
  player = { xp = 0, max = 1000, level = 10, rested = nil, atMax = false }
  for k, v in pairs(p or {}) do player[k] = v end
  UnitXP = function() return player.xp end
  UnitXPMax = function() return player.max end
  UnitLevel = function() return player.level end
  GetXPExhaustion = function() return player.rested end
  IsPlayerAtEffectiveMaxLevel = function() return player.atMax end
end

local function boot(wow, p)
  client(p)
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("ADDON_LOADED", "LevelClock")
  wow.fire("PLAYER_LOGIN")
  return ns
end

-- Changes the XP bar and tells the addon, the way the game does.
local function bar(wow, p)
  for k, v in pairs(p) do player[k] = v end
  wow.fire("PLAYER_XP_UPDATE", "player")
end

local function line(i) return LevelClockFrame.lines[i].left:GetText(), LevelClockFrame.lines[i].right:GetText() end

local WAITING = "|cff9d9d9d...|r"

test("addon defines only its own globals", function(wow, installed, before)
  boot(wow)
  wow.slash("/lc") -- creates the window
  local allowed = { LevelClockDB = true, LevelClockFrame = true, SLASH_LEVELCLOCK1 = true, SLASH_LEVELCLOCK2 = true }
  for _, name in ipairs(STAND_IN) do installed[name] = true end
  for k in pairs(_G) do
    if not before[k] and not installed[k] and not allowed[k] then error("unexpected global " .. tostring(k)) end
  end
end)

test("XP between two readings: plain gain, level-up, several levels", function(wow)
  local ns = boot(wow)
  local function step(a, b) return ns.Step({ xp = a[1], max = a[2], level = a[3] }, { xp = b[1], max = b[2], level = b[3] }) end
  local gained, levels = step({ 200, 1000, 10 }, { 450, 1000, 10 })
  eq(gained, 250)
  eq(levels, 0)
  gained, levels = step({ 900, 1000, 10 }, { 50, 1200, 11 })
  eq(gained, 150, "rest of the old level plus the start of the new one")
  eq(levels, 1)
  gained, levels = step({ 100, 1000, 10 }, { 300, 1200, 11 })
  eq(gained, 1200, "a reward larger than a whole level")
  eq(levels, 1)
  gained, levels = step({ 900, 1000, 10 }, { 50, 1200, 10 })
  eq(gained, 150, "the bar wrapped, the level reading is still the old one")
  eq(levels, 1)
  gained, levels = step({ 900, 1000, 10 }, { 20, 1500, 12 })
  eq(gained, 120, "levels in between are left out")
  eq(levels, 2)
  gained, levels = step({ 500, 1000, 10 }, { 500, 1000, 10 })
  eq(gained, 0)
  eq(levels, 0)
end)

test("XP per hour and time to level need a minute of data", function(wow)
  local ns = boot(wow)
  eq(ns.PerHour(500, 59), nil)
  eq(ns.PerHour(500, nil), nil)
  eq(ns.PerHour(500, 60), 30000)
  eq(ns.PerHour(1000, 1800), 2000)
  eq(ns.PerHour(0, 600), 0)
  eq(ns.PerHour(1000, 7000), 514, "rounded down")
  eq(ns.TimeToLevel(3000, 500, 30), nil)
  eq(ns.TimeToLevel(3000, 0, 600), nil, "no XP yet, no estimate")
  eq(ns.TimeToLevel(3000, 1000, 600), 1800)
  eq(ns.TimeToLevel(0, 1000, 600), 0)
end)

test("durations as text", function(wow)
  local ns = boot(wow)
  eq(ns.FormatDuration(nil), "...")
  eq(ns.FormatDuration(0), "under a minute")
  eq(ns.FormatDuration(59.9), "under a minute")
  eq(ns.FormatDuration(60), "1m")
  eq(ns.FormatDuration(3599), "59m")
  eq(ns.FormatDuration(3600), "1h 00m")
  eq(ns.FormatDuration(4320), "1h 12m")
  eq(ns.FormatDuration(86399), "23h 59m")
  eq(ns.FormatDuration(86400 + 3 * 3600 + 120), "1d 3h")
end)

test("rested percentage and large numbers", function(wow)
  local ns = boot(wow)
  eq(ns.RestedPercent(0, 1000), 0)
  eq(ns.RestedPercent(450, 1000), 45)
  eq(ns.RestedPercent(1500, 1000), 150)
  eq(ns.RestedPercent(1, 3), 33)
  eq(ns.RestedPercent(2, 3), 67)
  eq(ns.RestedPercent(nil, 1000), nil)
  eq(ns.RestedPercent(100, 0), nil, "no level size, no percentage")
  eq(ns.FormatNumber(0), "0")
  eq(ns.FormatNumber(999), "999")
  eq(ns.FormatNumber(1000), "1,000")
  eq(ns.FormatNumber(123456), "123,456")
  eq(ns.FormatNumber(1234567.8), "1,234,567")
end)

test("login takes the first reading without counting it", function(wow)
  local ns = boot(wow, { xp = 4200, max = 10000, level = 30, rested = 2500 })
  eq(ns.session.gained, 0)
  eq(ns.session.start, wow.clock)
  eq(ns.session.last.xp, 4200)
  eq(ns.session.last.rested, 2500)
  eq(LevelClockDB.version, 1)
  eq(LevelClockDB.chars["Yubi-Silvermoon"], ns.char)
  local v = ns.View(ns.session, wow.clock + 10)
  eq(v.needed, 5800)
  eq(v.rested, 25)
  eq(v.level, 30)
  eq(v.perHour, nil)
  eq(v.timeToLevel, nil)
end)

test("XP events add up, other units are ignored", function(wow)
  local ns = boot(wow, { xp = 100, max = 1000 })
  bar(wow, { xp = 250 })
  bar(wow, { xp = 600 })
  eq(ns.session.gained, 500)
  wow.fire("PLAYER_XP_UPDATE", "player") -- the same reading again
  eq(ns.session.gained, 500)
  player.xp = 900
  wow.fire("PLAYER_XP_UPDATE", "pet")
  eq(ns.session.gained, 500)
  wow.fire("PLAYER_XP_UPDATE")
  eq(ns.session.gained, 800)
  eq(ns.session.levels, 0)
end)

test("a level-up wraps the bar and changes its size", function(wow)
  local ns = boot(wow, { xp = 900, max = 1000, level = 10 })
  bar(wow, { xp = 50, max = 1200, level = 11 })
  eq(ns.session.gained, 150)
  eq(ns.session.levels, 1)
  bar(wow, { xp = 350 })
  eq(ns.session.gained, 450)
  bar(wow, { xp = 10, max = 1400, level = 12 })
  eq(ns.session.gained, 450 + 850 + 10)
  eq(ns.session.levels, 2)
  local v = ns.View(ns.session, wow.clock + 3600)
  eq(v.perHour, 1310)
  eq(v.needed, 1390)
  eq(v.level, 12)
end)

test("a level reading that follows late is not counted twice", function(wow)
  local ns = boot(wow, { xp = 900, max = 1000, level = 10 })
  bar(wow, { xp = 50, max = 1200 }) -- bar wrapped, level still 10
  eq(ns.session.gained, 150)
  eq(ns.session.levels, 1)
  bar(wow, { xp = 80 })             -- level still 10
  eq(ns.session.gained, 180)
  bar(wow, { xp = 100, level = 11 })
  eq(ns.session.gained, 200)
  eq(ns.session.levels, 1)
  eq(ns.session.last.level, 11)
end)

test("secret values are ignored", function(wow)
  local ns = boot(wow, { xp = 100, max = 1000 })
  bar(wow, { xp = { secret = true } })
  eq(ns.session.gained, 0)
  eq(ns.session.last.xp, 100)
  bar(wow, { xp = 300, rested = { secret = true } })
  eq(ns.session.gained, 200)
  eq(ns.session.last.rested, nil, "rested unknown")
  wow.slash("/lc")
  local _, rested = line(4)
  eq(rested, WAITING)
  player.atMax = { secret = true }
  eq(ns.AtMaxLevel(), false)
end)

test("secret values at login: the clock starts with the first readable bar", function(wow)
  local ns = boot(wow, { xp = { secret = true }, max = 1000 })
  eq(ns.session.last, nil)
  wow.slash("/lc")
  local label, value = line(3)
  eq(label, "XP to level")
  eq(value, WAITING)
  bar(wow, { xp = 400 })
  eq(ns.session.gained, 0)
  bar(wow, { xp = 500 })
  eq(ns.session.gained, 100)
  eq(select(2, line(3)), "500")
end)

test("the rested bonus follows its own event", function(wow)
  local ns = boot(wow, { xp = 0, max = 2000 })
  eq(ns.View(ns.session, wow.clock).rested, 0, "no rested bonus")
  player.rested = 3000
  wow.fire("UPDATE_EXHAUSTION")
  eq(ns.View(ns.session, wow.clock).rested, 150)
  eq(ns.session.gained, 0)
  player.rested = nil
  wow.fire("UPDATE_EXHAUSTION")
  eq(ns.View(ns.session, wow.clock).rested, 0)
end)

test("the window shows rate, time to level, missing XP and rested bonus", function(wow)
  local ns = boot(wow, { xp = 1000, max = 10000, level = 20, rested = 4500 })
  wow.slash("/lc")
  local f = LevelClockFrame
  eq(f:IsShown(), true)
  eq(UISpecialFrames[1], "LevelClockFrame")
  eq(f.note:IsShown(), false)
  eq(#f.lines, 6)
  local label, value = line(1)
  eq(label, "XP per hour")
  eq(value, WAITING)
  eq(select(2, line(2)), WAITING)
  eq(select(2, line(3)), "9,000")
  label, value = line(4)
  eq(label, "Rested")
  eq(value, "45%")
  eq(select(2, line(5)), "0")
  eq(select(2, line(6)), "under a minute")

  wow.clock = wow.clock + 1800
  bar(wow, { xp = 4000 }) -- 3,000 XP in half an hour
  eq(select(2, line(1)), "6,000")
  label, value = line(2)
  eq(label, "Time to level")
  eq(value, "1h 00m")
  eq(select(2, line(3)), "6,000")
  label, value = line(5)
  eq(label, "Session XP")
  eq(value, "3,000")
  label, value = line(6)
  eq(label, "Session time")
  eq(value, "30m")

  bar(wow, { xp = 9990 })
  eq(select(2, line(2)), "under a minute")
end)

test("the window refreshes while it is open", function(wow)
  local ns = boot(wow, { xp = 0, max = 6000 })
  wow.slash("/lc")
  bar(wow, { xp = 1000 })
  eq(select(2, line(1)), WAITING)
  wow.clock = wow.clock + 600
  local tick = LevelClockFrame.scripts.OnUpdate
  tick(LevelClockFrame, 0.5)
  eq(select(2, line(1)), WAITING, "not yet, the last refresh was half a second ago")
  tick(LevelClockFrame, 0.5)
  eq(select(2, line(1)), "6,000")
  eq(select(2, line(2)), "50m")
  eq(select(2, line(6)), "10m")
end)

test("at max level the window says so instead of showing numbers", function(wow)
  local ns = boot(wow, { xp = 9000, max = 10000, level = 89 })
  wow.slash("/lc")
  local f = LevelClockFrame
  eq(f.note:IsShown(), false)
  bar(wow, { xp = 0, max = 0, level = 90, atMax = true })
  eq(ns.session.gained, 1000, "the last level-up still counts")
  eq(f.note:IsShown(), true)
  eq(f.note:GetText(), "You have reached the maximum level.")
  for i = 1, #f.lines do
    local label, value = line(i)
    eq(label, "")
    eq(value, "")
  end
end)

test("a client without the max level function still shows the clock", function(wow)
  local ns = boot(wow, { xp = 100, max = 1000 })
  IsPlayerAtEffectiveMaxLevel = nil
  eq(ns.AtMaxLevel(), false)
  wow.slash("/lc")
  eq(LevelClockFrame.note:IsShown(), false)
  eq(select(2, line(3)), "900")
end)

test("/lc and /levelclock toggle the window, anything else prints help", function(wow)
  local ns = boot(wow)
  eq(LevelClockFrame, nil, "the window is built on first use")
  wow.slash("/lc")
  eq(LevelClockFrame:IsShown(), true)
  wow.slash("/levelclock")
  eq(LevelClockFrame:IsShown(), false)
  wow.slash("/lc  ")
  eq(LevelClockFrame:IsShown(), true)
  eq(#wow.chat, 0)
  wow.slash("/lc help")
  eq(#wow.chat, 1)
  eq(wow.chat[1]:match("/lc reset starts a new session") ~= nil, true)
  eq(LevelClockFrame:IsShown(), true)
end)

test("/lc reset starts a new session from the current bar", function(wow)
  local ns = boot(wow, { xp = 100, max = 1000 })
  wow.slash("/lc")
  wow.clock = wow.clock + 600
  bar(wow, { xp = 600 })
  eq(select(2, line(5)), "500")
  wow.slash("/lc RESET")
  eq(#wow.chat, 1)
  eq(wow.chat[1]:match("New session started%.") ~= nil, true)
  eq(ns.session.gained, 0)
  eq(ns.session.start, wow.clock)
  eq(select(2, line(5)), "0")
  eq(select(2, line(1)), WAITING)
  eq(select(2, line(3)), "400", "the bar itself is kept")
  bar(wow, { xp = 700 })
  eq(ns.session.gained, 100, "only XP after the reset counts")
  eq(ns.char.last.xp, 500, "the finished session is kept as the last one")
  eq(ns.char.last.seconds, 600)
end)

test("the window can be moved and comes back where it was left", function(wow)
  LevelClockDB = { settings = { point = { "TOPLEFT", "TOPLEFT", 40, -200 } } }
  local ns = boot(wow)
  wow.slash("/lc")
  local f = LevelClockFrame
  eq(f.point[1], "TOPLEFT")
  eq(f.point[2], UIParent)
  eq(f.point[4], 40)
  eq(f.point[5], -200)
  f:SetPoint("BOTTOMRIGHT", UIParent, "BOTTOMRIGHT", -12, 34) -- dragged
  f.scripts.OnDragStop(f)
  local p = LevelClockDB.settings.point
  eq(p[1], "BOTTOMRIGHT")
  eq(p[2], "BOTTOMRIGHT")
  eq(p[3], -12)
  eq(p[4], 34)
end)

test("logging out keeps a summary of the session for the character", function(wow)
  local ns = boot(wow, { xp = 900, max = 1000, level = 10 })
  wow.clock = wow.clock + 1200.4
  bar(wow, { xp = 300, max = 1200, level = 11 })
  wow.fire("PLAYER_LOGOUT")
  local last = LevelClockDB.chars["Yubi-Silvermoon"].last
  eq(last.xp, 400)
  eq(last.seconds, 1200)
  eq(last.levels, 1)
  eq(last.level, 11)
  eq(last.at, wow.now)
end)

test("a session without XP does not replace the last summary", function(wow)
  LevelClockDB = { chars = {
    ["Yubi-Silvermoon"] = { last = { xp = 777, seconds = 60, levels = 0, level = 9, at = 1 } },
    ["Brakk-Silvermoon"] = { last = { xp = 5, seconds = 90, levels = 0, level = 3, at = 2 } },
  } }
  local ns = boot(wow)
  wow.slash("/lc reset")
  wow.fire("PLAYER_LOGOUT")
  eq(LevelClockDB.chars["Yubi-Silvermoon"].last.xp, 777)
  bar(wow, { xp = 40 })
  wow.fire("PLAYER_LOGOUT")
  eq(LevelClockDB.chars["Yubi-Silvermoon"].last.xp, 40)
  eq(LevelClockDB.chars["Brakk-Silvermoon"].last.xp, 5, "other characters keep their own summary")
end)

test("nothing happens before login", function(wow)
  client()
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  player.xp = 500
  wow.fire("PLAYER_XP_UPDATE", "player")
  wow.fire("UPDATE_EXHAUSTION")
  wow.fire("PLAYER_LOGOUT")
  wow.slash("/lc")
  wow.slash("/lc reset")
  eq(ns.session.gained, 0)
  eq(LevelClockFrame, nil)
  eq(LevelClockDB, nil)
  eq(#wow.chat, 0)
end)
