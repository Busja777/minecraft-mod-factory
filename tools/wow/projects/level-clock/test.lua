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
  LevelClockFrame.switch:Click()
  wow.slash("/lc history")
  wow.slash("/lc lock")
  wow.slash("/lc scale 1.2")
  wow.slash("/lc hidemax")
  wow.slash("/lc options")
  wow.fire("TIME_PLAYED_MSG", 5000, 100)
  wow.fire("PLAYER_LEVEL_UP", 11)
  wow.slash("/lc levels")
  wow.fire("PLAYER_LOGOUT")
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
  eq(LevelClockDB.version, 4)
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
  eq(#wow.chat, 2)
  eq(wow.chat[1]:match("/lc reset starts a new session") ~= nil, true)
  eq(wow.chat[2]:match("/lc lock and /lc unlock fix the window in place") ~= nil, true)
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

-- 1.1: session history ---------------------------------------------------------------------------

-- Logs out, lets time pass and logs in again with the saved data, the way the game does
-- (a /reload works the same way). Returns the namespace of the freshly loaded addon.
local function relog(wow, seconds)
  wow.fire("PLAYER_LOGOUT")
  wow.now = wow.now + (seconds or 0)
  wow.clock = wow.clock + (seconds or 0)
  for _, f in ipairs(wow.frames) do f.events = {} end -- the old copy of the addon no longer listens
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("PLAYER_LOGIN")
  return ns
end

-- Plays for a while and earns XP.
local function play(wow, seconds, xp)
  wow.clock = wow.clock + seconds
  wow.now = wow.now + seconds
  bar(wow, { xp = player.xp + xp })
end

local function when(t) return date("%b %d %H:%M", t) end

test("history: the 1.0 last session becomes the first entry, nothing is lost", function(wow)
  LevelClockDB = { version = 1, settings = { point = { "TOP", "TOP", 0, -50 } }, chars = {
    ["Yubi-Silvermoon"] = { last = { xp = 12000, seconds = 3600, levels = 1, level = 31, at = 1700003600 } },
    ["Brakk-Silvermoon"] = { last = { xp = 5, seconds = 90, levels = 0, level = 3, at = 2 } },
  } }
  local ns = boot(wow)
  eq(LevelClockDB.version, 4)
  local h = ns.char.history
  eq(#h, 1)
  eq(h[1].xp, 12000)
  eq(h[1].seconds, 3600)
  eq(h[1].levels, 1)
  eq(h[1].level, 31)
  eq(h[1].at, 1700003600)
  eq(h[1].from, 1700000000, "the start is worked out from the end and the length")
  eq(ns.char.last.xp, 12000, "the 1.0 field stays")
  eq(LevelClockDB.settings.point[1], "TOP", "settings stay")
  eq(LevelClockDB.chars["Brakk-Silvermoon"].history, nil, "other characters move over when they log in")
  eq(LevelClockDB.chars["Brakk-Silvermoon"].last.xp, 5)
end)

test("history: migration runs once and drops only broken rows", function(wow)
  LevelClockDB = { version = 2, chars = { ["Yubi-Silvermoon"] = {
    last = { xp = 300, seconds = 600, levels = 0, at = 5000, from = 4400 },
    history = { { xp = 300, seconds = 600, levels = 0, at = 5000, from = 4400 }, "broken", { xp = 0, seconds = 50 }, { xp = 100, seconds = 120, at = 3000, from = 2880 } },
  } } }
  local ns = boot(wow)
  local h = ns.char.history
  eq(#h, 2, "the last session is not added a second time")
  eq(h[1].xp, 300)
  eq(h[2].xp, 100)

  LevelClockDB = { chars = { ["Yubi-Silvermoon"] = { last = { xp = 0, seconds = 10 } } } }
  ns = relog(wow)
  eq(#ns.char.history, 0, "a 1.0 summary without XP is not shown")
  LevelClockDB = { chars = { ["Yubi-Silvermoon"] = "broken" }, settings = "broken" }
  ns = relog(wow)
  eq(#ns.char.history, 0)
  eq(type(LevelClockDB.settings), "table")
  LevelClockDB = "broken"
  ns = relog(wow)
  eq(LevelClockDB.version, 4)
end)

test("history: newest first, at most ten sessions", function(wow)
  local ns = boot(wow)
  local h = {}
  for i = 1, 12 do ns.AddToHistory(h, { xp = i, seconds = 60, levels = 0, from = i * 10000, at = i * 10000 + 60 }) end
  eq(#h, 10)
  eq(ns.HISTORY, 10)
  eq(h[1].xp, 12)
  eq(h[10].xp, 3)
  local entry = { xp = 99, seconds = 60, from = 1, at = 61 }
  ns.AddToHistory(h, entry)
  h[1].xp = 1
  eq(entry.xp, 99, "the history keeps its own copy")
end)

test("history: a session that starts right after the last one continues it", function(wow)
  local ns = boot(wow)
  local h = { { xp = 1000, seconds = 1800, levels = 0, level = 20, from = 10000, at = 11800 } }
  ns.AddToHistory(h, { xp = 500, seconds = 600, levels = 1, level = 21, from = 11830, at = 12430 }, true)
  eq(#h, 1)
  eq(h[1].xp, 1500)
  eq(h[1].seconds, 2400, "only the time actually played")
  eq(h[1].levels, 1)
  eq(h[1].level, 21)
  eq(h[1].from, 10000)
  eq(h[1].at, 12430)
  ns.AddToHistory(h, { xp = 7, seconds = 60, levels = 0, from = 12430 + 301, at = 12430 + 361 }, true)
  eq(#h, 2, "more than five minutes later is a new session")
  ns.AddToHistory(h, { xp = 8, seconds = 60, levels = 0, from = 12430 + 361, at = 12430 + 421 }, false)
  eq(#h, 3, "a session started by hand is never merged")
  ns.AddToHistory(h, { xp = 9, seconds = 60, levels = 0, from = 1, at = 61 }, true)
  eq(#h, 4, "a start before the last end is not merged")
end)

test("history: logout, reload and reset in the game", function(wow)
  local ns = boot(wow, { xp = 0, max = 100000, level = 20 })
  local started = wow.now
  play(wow, 1800, 3000)
  ns = relog(wow, 20) -- a /reload
  eq(#ns.char.history, 1)
  play(wow, 600, 1000)
  ns = relog(wow, 3600) -- logged out, came back an hour later
  local h = ns.char.history
  eq(#h, 1, "the reload did not split the session")
  eq(h[1].xp, 4000)
  eq(h[1].seconds, 2400)
  eq(h[1].from, started)
  ns = relog(wow, 30) -- no XP in this one
  eq(#ns.char.history, 1, "a session without XP is not kept")
  play(wow, 900, 1500)
  wow.slash("/lc reset")
  play(wow, 300, 200)
  wow.fire("PLAYER_LOGOUT")
  h = ns.char.history
  eq(#h, 3)
  eq(h[1].xp, 200, "after a reset the new session stands on its own")
  eq(h[2].xp, 1500)
  eq(h[2].from, started + 2400 + 20 + 3600 + 30, "a fresh login after more than five minutes")
  eq(h[3].xp, 4000)
end)

test("history: rows and chat lines", function(wow)
  local ns = boot(wow)
  local r = ns.HistoryRow({ xp = 12345, seconds = 4320, levels = 2, from = 1763658000 })
  eq(r.when, when(1763658000))
  eq(r.duration, "1h 12m")
  eq(r.xp, "12,345")
  eq(r.perHour, "10,287")
  eq(r.levels, "+2")
  r = ns.HistoryRow({ xp = 40, seconds = 30, levels = 0 })
  eq(r.when, "-", "start unknown")
  eq(r.perHour, "-", "too short for a rate")
  eq(r.levels, "")
  eq(ns.HistoryText({ xp = 12345, seconds = 4320, levels = 1, from = 1763658000 }), when(1763658000) .. ": 12,345 XP in 1h 12m, 10,287 XP per hour, 1 level up")
  eq(ns.HistoryText({ xp = 9000, seconds = 3600, levels = 3, from = 1763658000 }), when(1763658000) .. ": 9,000 XP in 1h 00m, 9,000 XP per hour, 3 levels up")
  eq(ns.HistoryText({ xp = 40, seconds = 30, levels = 0 }), "-: 40 XP in under a minute")
end)

test("history: the window switches between clock and history", function(wow)
  local ns = boot(wow, { xp = 0, max = 100000, level = 20 })
  wow.slash("/lc")
  local f = LevelClockFrame
  eq(f.switch:GetText(), "History")
  f.SetSize = function(self, w, h) self.size = { w, h } end -- the stand-in does not keep the size
  f.switch:Click()
  eq(f.size[1], 350, "the history view is wider")
  eq(f.title:GetText(), "Session history")
  eq(f.switch:GetText(), "Back")
  eq(f.empty:IsShown(), true)
  eq(f.empty:GetText(), "No finished sessions with XP yet.")
  eq(f.lines[1].left:IsShown(), false, "the clock lines are hidden")
  eq(f.history.head[1]:IsShown(), false)

  play(wow, 1800, 3000)
  local first = wow.now - 1800
  wow.slash("/lc reset")
  play(wow, 600, 600)
  wow.slash("/lc reset")
  eq(f.empty:IsShown(), false)
  eq(f.history.head[1]:GetText(), "Started")
  eq(f.history.head[4]:GetText(), "XP/hour")
  local row = f.history.rows[1]
  eq(row[1]:GetText(), when(wow.now - 600), "newest first")
  eq(row[2]:GetText(), "10m")
  eq(row[3]:GetText(), "600")
  eq(row[4]:GetText(), "3,600")
  eq(row[5]:GetText(), "")
  eq(f.history.rows[2][1]:GetText(), when(first))
  eq(f.history.rows[2][3]:GetText(), "3,000")
  eq(f.history.rows[3][1]:GetText(), "")

  f.switch:Click()
  eq(f.size[1], 230)
  eq(f.title:GetText(), "Level Clock")
  eq(f.lines[1].left:IsShown(), true)
  eq(f.lines[1].left:GetText(), "XP per hour")
  eq(f.history.rows[1][1]:IsShown(), false)
  eq(f.empty:IsShown(), false)
end)

test("history: the history view still works at max level", function(wow)
  LevelClockDB = { chars = { ["Yubi-Silvermoon"] = { history = { { xp = 500, seconds = 600, levels = 1, from = 100, at = 700 } } } } }
  local ns = boot(wow, { xp = 0, max = 0, level = 90, atMax = true })
  wow.slash("/lc")
  local f = LevelClockFrame
  eq(f.note:IsShown(), true)
  f.switch:Click()
  eq(f.note:IsShown(), false)
  eq(f.history.rows[1][3]:GetText(), "500")
  eq(f.history.rows[1][5]:GetText(), "+1")
  f.switch:Click()
  eq(f.note:IsShown(), true)
end)

test("/lc history lists the last sessions in the chat", function(wow)
  local ns = boot(wow, { xp = 0, max = 100000, level = 20 })
  wow.slash("/lc history")
  eq(#wow.chat, 1)
  eq(wow.chat[1], "|cffffd100Level Clock:|r No finished sessions with XP yet.")
  play(wow, 3600, 9000)
  local from = wow.now - 3600
  wow.slash("/lc reset")
  wow.chat = {}
  wow.slash("/lc HISTORY ")
  eq(#wow.chat, 2)
  eq(wow.chat[1], "|cffffd100Level Clock:|r Your last sessions with XP, newest first:")
  eq(wow.chat[2], "  " .. when(from) .. ": 9,000 XP in 1h 00m, 9,000 XP per hour")
  wow.slash("/lc what")
  eq(wow.chat[3]:match("/lc history lists your last sessions") ~= nil, true)
end)

test("/lc history before login does nothing", function(wow)
  client()
  wow.load(ADDON_DIR, ADDON_NAME)
  wow.slash("/lc history")
  eq(#wow.chat, 0)
end)

-- 1.2: window options ------------------------------------------------------------------------------

-- The stand-in keeps no size or drag state; these windows do, and note what happens to them.
local function trackWindows()
  local create = CreateFrame
  CreateFrame = function(...)
    local f = create(...)
    f.SetScale = function(self, v) self.scale = v end
    f.GetScale = function(self) return self.scale or 1 end
    f.dragged = 0
    f.StartMoving = function(self) self.dragged = self.dragged + 1 end
    return f
  end
end

-- The player closes the window with its close button or Escape: the game hides it and runs OnHide.
local function close(f)
  f:Hide()
  f.scripts.OnHide(f)
end

local function drag(f, point, x, y)
  local before = f.dragged
  f.scripts.OnDragStart(f)
  if f.dragged > before then f:SetPoint(point, UIParent, point, x, y) end
  f.scripts.OnDragStop(f)
end

test("window: sizes the player can type", function(wow)
  local ns = boot(wow)
  eq(ns.ParseScale("1.2"), 1.2)
  eq(ns.ParseScale("1,2"), 1.2, "a comma works too")
  eq(ns.ParseScale("120"), 1.2, "as a percentage")
  eq(ns.ParseScale(" 90 % "), 0.9)
  eq(ns.ParseScale("0.8"), 0.8)
  eq(ns.ParseScale("1.5"), 1.5)
  eq(ns.ParseScale("1.25"), 1.25)
  eq(ns.ParseScale("1"), 1)
  eq(ns.ParseScale("0.79"), nil, "too small")
  eq(ns.ParseScale("1.51"), nil, "too large")
  eq(ns.ParseScale("151"), nil)
  eq(ns.ParseScale("5"), nil)
  eq(ns.ParseScale("big"), nil)
  eq(ns.ParseScale("-1"), nil)
  eq(ns.ParseScale(""), nil)
  eq(ns.ParseScale(nil), nil)
  eq(ns.ScaleText(1.2), "120%")
  eq(ns.ScaleText(0.85), "85%")
  local x, y = ns.ScaledOffsets(100, -50, 1, 1.25)
  eq(x, 80)
  eq(y, -40)
end)

test("window: options get their defaults, broken ones are repaired", function(wow)
  local ns = boot(wow)
  local s = ns.WindowSettings({})
  eq(s.locked, false)
  eq(s.scale, 1)
  eq(s.hideAtMax, false)
  eq(s.shown, false)
  s = ns.WindowSettings({ locked = true, scale = 1.3, hideAtMax = true, shown = true })
  eq(s.locked, true)
  eq(s.scale, 1.3)
  eq(s.hideAtMax, true)
  eq(s.shown, true)
  eq(ns.WindowSettings({ scale = 3 }).scale, 1)
  eq(ns.WindowSettings({ scale = 0.5 }).scale, 1)
  eq(ns.WindowSettings({ scale = "1.2" }).scale, 1)
  eq(ns.WindowSettings({ scale = 0 / 0 }).scale, 1, "not a number")
  eq(ns.WindowSettings({ locked = "yes" }).locked, false)
  eq(ns.ShowAtLogin({ shown = true, hideAtMax = false }, true), true)
  eq(ns.ShowAtLogin({ shown = true, hideAtMax = true }, false), true)
  eq(ns.ShowAtLogin({ shown = true, hideAtMax = true }, true), false)
  eq(ns.ShowAtLogin({ shown = false, hideAtMax = false }, false), false)
end)

test("window: 1.1 settings stay, the new options start as before", function(wow)
  LevelClockDB = { version = 2, settings = { point = { "TOP", "TOP", 0, -50 } }, chars = {
    ["Yubi-Silvermoon"] = { history = { { xp = 500, seconds = 600, levels = 0, from = 100, at = 700 } } },
  } }
  local ns = boot(wow)
  local s = LevelClockDB.settings
  eq(LevelClockDB.version, 4)
  eq(s.point[1], "TOP")
  eq(s.point[4], -50)
  eq(s.locked, false)
  eq(s.scale, 1)
  eq(s.hideAtMax, false)
  eq(s.shown, false)
  eq(LevelClockFrame, nil, "the window does not open by itself")
  eq(#ns.char.history, 1)
end)

test("/lc lock keeps the window in place, /lc unlock lets it move again", function(wow)
  trackWindows()
  boot(wow)
  wow.slash("/lc")
  local f = LevelClockFrame
  drag(f, "TOPLEFT", 10, -10)
  eq(f.dragged, 1)
  eq(LevelClockDB.settings.point[3], 10)
  wow.slash("/lc LOCK")
  eq(wow.chat[1], "|cffffd100Level Clock:|r The window is locked in place. /lc unlock lets you move it again.")
  eq(LevelClockDB.settings.locked, true)
  drag(f, "TOPLEFT", 99, -99)
  eq(f.dragged, 1, "not moved")
  eq(LevelClockDB.settings.point[3], 10, "the saved place stays")
  wow.slash("/lc unlock")
  eq(wow.chat[2], "|cffffd100Level Clock:|r The window can be moved again: drag it with the left mouse button.")
  drag(f, "TOPLEFT", 30, -30)
  eq(f.dragged, 2)
  eq(LevelClockDB.settings.point[3], 30)
  wow.slash("/lc lock")
  relog(wow)
  eq(LevelClockDB.settings.locked, true, "the lock is saved")
end)

test("/lc scale sizes the window and keeps it in its place", function(wow)
  trackWindows()
  LevelClockDB = { settings = { point = { "TOPLEFT", "TOPLEFT", 100, -50 } } }
  boot(wow)
  wow.slash("/lc scale")
  eq(wow.chat[1], "|cffffd100Level Clock:|r The window size is 100%. /lc scale followed by a number from 0.8 to 1.5 changes it.")
  wow.slash("/lc scale 1.25")
  eq(wow.chat[2], "|cffffd100Level Clock:|r The window size is 125%.")
  eq(LevelClockDB.settings.scale, 1.25)
  wow.slash("/lc") -- the window is built with the size chosen before
  local f = LevelClockFrame
  eq(f.scale, 1.25)
  eq(f.point[4], 100, "the saved place is in the window's own units")
  wow.slash("/lc scale 80%")
  eq(f.scale, 0.8)
  eq(f.point[1], "TOPLEFT")
  eq(f.point[4], 100 * 1.25 / 0.8, "the corner stays where it was on the screen")
  eq(f.point[5], -50 * 1.25 / 0.8)
  eq(LevelClockDB.settings.point[3], 100 * 1.25 / 0.8)
  wow.slash("/lc scale 2")
  eq(wow.chat[4], "|cffffd100Level Clock:|r Choose a size from 0.8 to 1.5, for example /lc scale 1.2.")
  eq(LevelClockDB.settings.scale, 0.8, "a wrong size changes nothing")
  wow.slash("/lc scale huge")
  eq(wow.chat[5], wow.chat[4])
  relog(wow)
  wow.slash("/lc")
  eq(LevelClockFrame.scale, 0.8, "the size is saved")
end)

test("the window opens again at login when it was left open", function(wow)
  trackWindows()
  boot(wow)
  wow.slash("/lc")
  eq(LevelClockDB.settings.shown, true)
  relog(wow)
  eq(LevelClockFrame:IsShown(), true, "open again")
  LevelClockFrame.scripts.OnHide(LevelClockFrame) -- Alt+Z hides the whole interface, not the window
  eq(LevelClockDB.settings.shown, true)
  close(LevelClockFrame) -- the close button or Escape
  eq(LevelClockDB.settings.shown, false)
  local old = LevelClockFrame
  relog(wow)
  eq(LevelClockFrame, old, "closed stays closed: no new window is built")
  wow.slash("/lc")
  wow.slash("/lc")
  eq(LevelClockDB.settings.shown, false, "closed with /lc")
  old = LevelClockFrame
  relog(wow)
  eq(LevelClockFrame, old)
end)

test("/lc hidemax: the window stays closed at maximum level, other characters still see it", function(wow)
  trackWindows()
  boot(wow, { xp = 9000, max = 10000, level = 89 })
  wow.slash("/lc")
  wow.slash("/lc hidemax")
  eq(wow.chat[1], "|cffffd100Level Clock:|r The window now stays closed at maximum level. /lc still opens it.")
  eq(LevelClockDB.settings.hideAtMax, true)
  eq(LevelClockFrame:IsShown(), true, "not at maximum level yet")
  bar(wow, { xp = 0, max = 0, level = 90, atMax = true })
  eq(LevelClockFrame:IsShown(), false, "closed on reaching the maximum level")
  eq(LevelClockDB.settings.shown, true, "the player's choice to keep it open stays")
  local old = LevelClockFrame
  relog(wow)
  eq(LevelClockFrame, old, "a max-level character does not see it at login")
  wow.slash("/lc")
  local f = LevelClockFrame
  eq(f ~= old, true)
  eq(f:IsShown(), true, "/lc still opens it")
  eq(f.note:IsShown(), true)
  f.switch:Click()
  eq(f.history.rows[1][3]:GetText(), "1,000", "the history view still works")
  wow.slash("/lc")
  wow.slash("/lc")
  wow.player = "Brakk" -- an alt that is still levelling
  player.atMax, player.level, player.max = false, 20, 5000
  relog(wow)
  eq(LevelClockFrame:IsShown(), true, "the alt sees it at login")
end)

test("/lc hidemax at maximum level closes the open window, typed again it is undone", function(wow)
  trackWindows()
  boot(wow, { xp = 0, max = 0, level = 90, atMax = true })
  wow.slash("/lc")
  wow.slash("/lc hidemax")
  eq(LevelClockFrame:IsShown(), false)
  eq(LevelClockDB.settings.shown, true)
  wow.slash("/lc hidemax")
  eq(wow.chat[2], "|cffffd100Level Clock:|r The window now also opens at maximum level.")
  eq(LevelClockDB.settings.hideAtMax, false)
  relog(wow)
  eq(LevelClockFrame:IsShown(), true)
  bar(wow, { xp = 0 })
  eq(LevelClockFrame:IsShown(), true, "already at maximum level: nothing is closed")
end)

test("/lc options shows the window options", function(wow)
  boot(wow)
  wow.slash("/lc options")
  eq(wow.chat[1], "|cffffd100Level Clock:|r Window: movable, size 100%, shown at maximum level.")
  wow.slash("/lc lock")
  wow.slash("/lc scale 1,1")
  wow.slash("/lc hidemax")
  wow.slash("/lc Options ")
  eq(wow.chat[5], "|cffffd100Level Clock:|r Window: locked, size 110%, hidden at maximum level.")
end)

test("window commands before login do nothing", function(wow)
  client()
  wow.load(ADDON_DIR, ADDON_NAME)
  for _, cmd in ipairs({ "/lc lock", "/lc unlock", "/lc scale 1.2", "/lc scale", "/lc hidemax", "/lc options", "/lc what" }) do
    wow.slash(cmd)
  end
  eq(#wow.chat, 0)
  eq(LevelClockDB, nil)
  eq(LevelClockFrame, nil)
end)

-- 1.3: level history ---------------------------------------------------------------------------------

local PREFIX = "|cffffd100Level Clock:|r "

-- The game reports a level-up: the bar wraps and PLAYER_LEVEL_UP names the new level.
local function levelUp(wow, level)
  player.level = level
  wow.fire("PLAYER_LEVEL_UP", level, 0, 0, 0, 0)
end

-- Time passes in the game.
local function wait(wow, seconds)
  wow.clock = wow.clock + seconds
  wow.now = wow.now + seconds
end

test("levels: a level-up is noted once, at most LEVELS per character", function(wow)
  local ns = boot(wow)
  local list = {}
  eq(ns.AddLevel(list, 11, 5000).level, 11)
  eq(ns.AddLevel(list, 11, 5010), nil, "the same level again is not noted twice")
  eq(ns.AddLevel(list, 12, 6000, 7200.6, 900.2).played, 7200)
  eq(list[2].took, 900)
  eq(ns.AddLevel(list, 13, 7000, nil, -5).took, nil)
  eq(ns.AddLevel(list, nil, 7000), nil)
  eq(ns.AddLevel(list, 14, nil), nil)
  eq(ns.AddLevel(list, 0 / 0, 1), nil)
  eq(#list, 3)
  for level = 14, 14 + ns.LEVELS do ns.AddLevel(list, level, level * 10) end
  eq(#list, ns.LEVELS)
  eq(list[#list].level, 14 + ns.LEVELS, "the newest stay")
  eq(ns.LEVELS_SHOWN, 10)
end)

test("levels: played time from what the game told, carried over each level-up", function(wow)
  local ns = boot(wow)
  local anchor = ns.PlayedAnchor(5000, 600, 1000, 20)
  eq(ns.PlayedNow(anchor, 1100), 5100)
  eq(ns.PlayedNow(anchor, 900), nil, "a time before the anchor")
  local played, took, nextAnchor = ns.LevelUpPlayed(anchor, 21, 1100)
  eq(played, 5100)
  eq(took, 700, "600 seconds in the level when told, 100 since")
  eq(nextAnchor.level, 21)
  eq(nextAnchor.thisLevel, 0)
  played, took = ns.LevelUpPlayed(nextAnchor, 22, 2900)
  eq(played, 6900)
  eq(took, 1800)
  played, took, nextAnchor = ns.LevelUpPlayed(anchor, 23, 1100)
  eq(played, 5100)
  eq(took, nil, "the anchor is from another level")
  eq(ns.LevelUpPlayed(nil, 21, 1100), nil)
  eq(ns.PlayedAnchor(500, 600, 1000, 20), nil, "more time in the level than in total")
  eq(ns.PlayedAnchor(nil, 0, 1000, 20), nil)
  eq(ns.PlayedAnchor(5000, 0, 1000, nil), nil)
  local list = { { level = 20, at = 1 } }
  ns.FillPlayed(list, anchor)
  eq(list[1].played, 4400, "reached at the total minus the time in the level")
  list[1].played = 1
  ns.FillPlayed(list, anchor)
  eq(list[1].played, 1, "a known value stays")
  list = { { level = 19, at = 1 } }
  ns.FillPlayed(list, anchor)
  eq(list[1].played, nil, "another level")
  ns.FillPlayed({}, anchor)
end)

test("levels: how long a level took, in played time or real time", function(wow)
  local ns = boot(wow)
  local list = {
    { level = 30, at = 1000 },
    { level = 31, at = 4600 },
    { level = 32, at = 90000, played = 50000 },
    { level = 33, at = 99000, played = 53000 },
    { level = 34, at = 100000, took = 1500 },
    { level = 36, at = 200000 },
  }
  eq(ns.LevelTook(list, 1), nil, "the first one noted")
  local seconds, kind = ns.LevelTook(list, 2)
  eq(seconds, 3600)
  eq(kind, "real")
  seconds, kind = ns.LevelTook(list, 3)
  eq(seconds, 85400)
  eq(kind, "real", "only one side has the played time")
  seconds, kind = ns.LevelTook(list, 4)
  eq(seconds, 3000)
  eq(kind, "played")
  seconds, kind = ns.LevelTook(list, 5)
  eq(seconds, 1500)
  eq(kind, "played")
  eq(ns.LevelTook(list, 6), nil, "a level in between is missing")
  eq(ns.LevelTook(list, 7), nil)
  eq(ns.LevelText(list, 1), "Level 30 on " .. when(1000))
  eq(ns.LevelText(list, 2), "Level 31 on " .. when(4600) .. ", took 1h 00m real time")
  eq(ns.LevelText(list, 4), "Level 33 on " .. when(99000) .. ", took 50m played (/played 14h 43m)")
  eq(ns.LevelText(list, 5), "Level 34 on " .. when(100000) .. ", took 25m played")
end)

test("levels: level-ups in the game, with the date only while the played time is unknown", function(wow)
  local ns = boot(wow, { level = 10 })
  wait(wow, 1200)
  levelUp(wow, 11)
  local first = wow.now
  wait(wow, 1800)
  levelUp(wow, 12)
  wow.fire("PLAYER_LEVEL_UP", 12) -- sent again
  local levels = LevelClockDB.chars["Yubi-Silvermoon"].levels
  eq(#levels, 2)
  eq(levels[1].level, 11)
  eq(levels[1].at, first)
  eq(levels[1].played, nil)
  wow.slash("/lc levels")
  eq(wow.chat[1], PREFIX .. "Your last levels on this character, newest first:")
  eq(wow.chat[2], "  Level 12 on " .. when(first + 1800) .. ", took 30m real time")
  eq(wow.chat[3], "  Level 11 on " .. when(first))
  eq(#wow.chat, 3)
end)

test("levels: with /played known, each level gets its played time", function(wow)
  local ns = boot(wow, { level = 40 })
  wow.fire("TIME_PLAYED_MSG", 360000, 1200) -- the player typed /played
  wait(wow, 600)
  levelUp(wow, 41)
  wait(wow, 2400)
  levelUp(wow, 42)
  local levels = ns.char.levels
  eq(levels[1].played, 360600)
  eq(levels[1].took, 1800, "1200 seconds before /played and 600 after")
  eq(levels[2].played, 363000)
  eq(levels[2].took, 2400)
  wow.slash("/lc levels")
  eq(wow.chat[2], "  Level 42 on " .. when(wow.now) .. ", took 40m played (/played 4d 4h)")
end)

test("levels: /played typed after a level-up fills in when that level was reached", function(wow)
  local ns = boot(wow, { level = 50 })
  levelUp(wow, 51)
  wait(wow, 300)
  wow.fire("TIME_PLAYED_MSG", 800300, 300)
  eq(ns.char.levels[1].played, 800000)
  wait(wow, 900)
  levelUp(wow, 52)
  eq(ns.char.levels[2].took, 1200)
  eq(ns.char.levels[2].played, 801200)
end)

test("levels: kept across a relog, the played time is told again in each session", function(wow)
  local ns = boot(wow, { level = 20 })
  wow.fire("TIME_PLAYED_MSG", 100000, 0)
  levelUp(wow, 21)
  ns = relog(wow, 3600)
  eq(#ns.char.levels, 1)
  eq(ns.played, nil)
  wait(wow, 600)
  levelUp(wow, 22)
  local seconds, kind = ns.LevelTook(ns.char.levels, 2)
  eq(kind, "real", "after the relog only the real time is known")
  eq(seconds, 4200)
  eq(ns.char.levels[2].played, nil)
end)

test("levels: /lc levels shows the newest ten", function(wow)
  local ns = boot(wow, { level = 1 })
  wow.slash("/lc levels")
  eq(wow.chat[1], PREFIX .. "No level-ups noted yet. Level Clock notes every level from now on.")
  for level = 2, 14 do
    wait(wow, 60)
    levelUp(wow, level)
  end
  wow.chat = {}
  wow.slash("/lc LEVELS ")
  eq(#wow.chat, 11)
  eq(wow.chat[2]:match("^  Level 14 on ") ~= nil, true)
  eq(wow.chat[11]:match("^  Level 5 on ") ~= nil, true)
  wow.slash("/lc help")
  eq(wow.chat[12]:match("/lc levels lists your last levels") ~= nil, true)
end)

test("levels: secret or broken values are not noted, nothing before login", function(wow)
  client()
  wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("PLAYER_LEVEL_UP", 11)
  wow.fire("TIME_PLAYED_MSG", 100, 10)
  wow.slash("/lc levels")
  eq(#wow.chat, 0)
  eq(LevelClockDB, nil)
  local ns = boot(wow, { level = 10 })
  local secret = { secret = true }
  wow.fire("PLAYER_LEVEL_UP", secret)
  wow.fire("PLAYER_LEVEL_UP", nil)
  wow.fire("TIME_PLAYED_MSG", secret, 10)
  wow.fire("TIME_PLAYED_MSG", 100, secret)
  eq(ns.played, nil)
  eq(#ns.char.levels, 0)
  player.level = secret
  wow.fire("TIME_PLAYED_MSG", 5000, 10)
  eq(ns.played.level, 10, "the level from the last readable bar")
  levelUp(wow, 11)
  eq(#ns.char.levels, 1)
end)

test("levels: 1.2 saved data stays, the level list starts empty and broken rows are dropped", function(wow)
  LevelClockDB = { version = 3, settings = { point = { "TOP", "TOP", 0, -50 }, locked = true, scale = 1.2, hideAtMax = true, shown = false },
    chars = { ["Yubi-Silvermoon"] = { history = { { xp = 500, seconds = 600, levels = 1, from = 100, at = 700 } }, last = { xp = 500, seconds = 600 } } } }
  local ns = boot(wow)
  eq(LevelClockDB.version, 4)
  eq(LevelClockDB.settings.locked, true)
  eq(LevelClockDB.settings.scale, 1.2)
  eq(#ns.char.history, 1)
  eq(type(ns.char.levels), "table")
  eq(#ns.char.levels, 0)
  eq(ns.char, LevelClockDB.chars["Yubi-Silvermoon"])
  LevelClockDB = { version = 4, chars = { ["Yubi-Silvermoon"] = { levels = {
    { level = 5, at = 100 }, "broken", { level = "6", at = 200 }, { level = 7 }, { level = 8, at = 300, played = "x" }, { level = 9, at = 400, took = 60 },
  } } } }
  ns = relog(wow)
  eq(#ns.char.levels, 2)
  eq(ns.char.levels[2].level, 9)
  LevelClockDB = { chars = { ["Yubi-Silvermoon"] = { levels = "broken" } } }
  ns = relog(wow)
  eq(#ns.char.levels, 0)
end)

-- 1.4: German ------------------------------------------------------------------------------------------

-- Every placeholder of a text, in order: "%d", "%s", "%%".
local function placeholders(text)
  local out = {}
  for p in text:gmatch("%%[%d%.]*[%a%%]") do out[#out + 1] = p end
  return table.concat(out, " ")
end

-- A German client: its language and the words it has (GlobalStrings). The stand-in client has none.
local function germanClient(wow)
  wow.locale = "deDE"
  XP, TUTORIAL_TITLE26, BACK, LARGE_NUMBER_SEPERATOR = "EP", "Erholt", "Zurück", "."
end

local function deWhen(t) return date("%d.%m. %H:%M", t) end

-- One line of the clock as "label = value".
local function shows(i) return table.concat({ line(i) }, " = ") end

test("game words: XP, Rested, Back and the thousands from the game, English when the client has none", function(wow)
  local ns = boot(wow, { xp = 0, max = 10000, rested = 1000 })
  wow.slash("/lc")
  eq(line(4), "Rested")
  LevelClockFrame.switch:Click()
  eq(LevelClockFrame.switch:GetText(), "Back")
  eq(ns.FormatNumber(1234567), "1,234,567")
  eq(ns.GameText("XP", "XP"), "XP")
  germanClient(wow)
  eq(ns.FormatNumber(1234567), "1.234.567")
  eq(ns.FormatNumber(999), "999")
  eq(ns.GameText("XP", "XP"), "EP")
  LARGE_NUMBER_SEPERATOR = ""
  eq(ns.FormatNumber(12345), "12,345", "an empty one stays English")
  BACK = { secret = true }
  eq(ns.GameText("BACK", "Back"), "Back", "so does anything that is not a text")
end)

test("German client: clock and history window in German with the game's words", function(wow)
  germanClient(wow)
  local ns = boot(wow, { xp = 1000, max = 10000, level = 20, rested = 4500 })
  wow.slash("/lc")
  local f = LevelClockFrame
  eq(f.title:GetText(), "Level Clock")
  eq(shows(1), "EP pro Stunde = " .. WAITING)
  eq(shows(2), "Zeit bis zum Aufstieg = " .. WAITING)
  eq(shows(3), "EP bis zum Aufstieg = 9.000")
  eq(shows(4), "Erholt = 45%")
  eq(shows(5), "EP der Sitzung = 0")
  eq(shows(6), "Sitzungsdauer = unter 1 Min.")
  eq(f.switch:GetText(), "Verlauf")
  wow.clock = wow.clock + 1800
  bar(wow, { xp = 4000 })
  eq(select(2, line(1)), "6.000")
  eq(select(2, line(2)), "1h 00m")
  eq(select(2, line(6)), "30m")

  f.switch:Click()
  eq(f.title:GetText(), "Sitzungsverlauf")
  eq(f.switch:GetText(), "Zurück")
  eq(f.empty:GetText(), "Noch keine abgeschlossene Sitzung mit EP.")
  local first = wow.now
  wow.slash("/lc reset")
  eq(f.history.head[1]:GetText(), "Beginn")
  eq(f.history.head[2]:GetText(), "Dauer")
  eq(f.history.head[3]:GetText(), "EP")
  eq(f.history.head[4]:GetText(), "EP/Std.")
  eq(f.history.head[5]:GetText(), "Stufen")
  local row = f.history.rows[1]
  eq(row[1]:GetText(), deWhen(first), "the date the German way")
  eq(row[2]:GetText(), "30m")
  eq(row[3]:GetText(), "3.000")
  eq(row[4]:GetText(), "6.000")

  bar(wow, { xp = 0, max = 0, level = 90, atMax = true })
  f.switch:Click()
  eq(f.note:GetText(), "Du hast die Höchststufe erreicht.")
end)

test("German client: history and levels in the chat in German", function(wow)
  germanClient(wow)
  local ns = boot(wow, { level = 40, xp = 0, max = 100000 })
  local P = PREFIX
  wow.slash("/lc history")
  eq(wow.chat[1], P .. "Noch keine abgeschlossene Sitzung mit EP.")
  wow.slash("/lc levels")
  eq(wow.chat[2], P .. "Noch keine Stufenaufstiege notiert. Level Clock notiert ab jetzt jede Stufe.")
  eq(ns.HistoryText({ xp = 12345, seconds = 4320, levels = 1, from = 1763658000 }),
    deWhen(1763658000) .. ": 12.345 EP in 1h 12m, 10.287 EP pro Stunde, 1 Stufenaufstieg")
  eq(ns.HistoryText({ xp = 9000, seconds = 3600, levels = 3, from = 1763658000 }),
    deWhen(1763658000) .. ": 9.000 EP in 1h 00m, 9.000 EP pro Stunde, 3 Stufenaufstiege")
  eq(ns.HistoryText({ xp = 40, seconds = 30, levels = 0 }), "-: 40 EP in unter 1 Min.")
  eq(ns.LevelText({ { level = 11, at = 1763658000 }, { level = 12, at = 1763658000 + 1800 } }, 2),
    "Stufe 12 am " .. deWhen(1763658000 + 1800) .. ", Dauer: 30m Echtzeit")

  wow.chat = {}
  play(wow, 600, 6000)
  wow.slash("/lc reset")
  wow.slash("/lc history")
  eq(wow.chat[1], P .. "Neue Sitzung gestartet.")
  eq(wow.chat[2], P .. "Deine letzten Sitzungen mit EP, neueste zuerst:")
  eq(wow.chat[3], "  " .. deWhen(wow.now - 600) .. ": 6.000 EP in 10m, 36.000 EP pro Stunde")

  wow.fire("TIME_PLAYED_MSG", 360000, 1200) -- the player typed /played
  wait(wow, 600)
  levelUp(wow, 41)
  wait(wow, 2400)
  levelUp(wow, 42)
  wow.chat = {}
  wow.slash("/lc levels")
  eq(wow.chat[1], P .. "Deine letzten Stufen mit diesem Charakter, neueste zuerst:")
  eq(wow.chat[2], "  Stufe 42 am " .. deWhen(wow.now) .. ", Dauer: 40m Spielzeit (/played 4d 4h)")
  eq(wow.chat[3], "  Stufe 41 am " .. deWhen(wow.now - 2400) .. ", Dauer: 30m Spielzeit (/played 4d 4h)")
end)

test("German client: every window command answers in German, the command words stay English", function(wow)
  germanClient(wow)
  boot(wow)
  local P = PREFIX
  wow.slash("/lc options")
  eq(wow.chat[1], P .. "Fenster: verschiebbar, Größe 100%, auf Höchststufe eingeblendet.")
  wow.slash("/lc lock")
  eq(wow.chat[2], P .. "Das Fenster ist gesperrt. Mit /lc unlock kannst du es wieder verschieben.")
  wow.slash("/lc unlock")
  eq(wow.chat[3], P .. "Das Fenster lässt sich wieder verschieben: Zieh es mit der linken Maustaste.")
  wow.slash("/lc scale")
  eq(wow.chat[4], P .. "Die Fenstergröße ist 100%. /lc scale mit einer Zahl von 0,8 bis 1,5 ändert sie.")
  wow.slash("/lc scale 3")
  eq(wow.chat[5], P .. "Wähle eine Größe von 0,8 bis 1,5, zum Beispiel /lc scale 1,2.")
  wow.slash("/lc scale 1,2")
  eq(wow.chat[6], P .. "Die Fenstergröße ist 120%.", "the comma of the German example works")
  wow.slash("/lc hidemax")
  eq(wow.chat[7], P .. "Das Fenster bleibt jetzt auf Höchststufe geschlossen. /lc öffnet es trotzdem.")
  wow.slash("/lc lock")
  wow.slash("/lc options")
  eq(wow.chat[9], P .. "Fenster: gesperrt, Größe 120%, auf Höchststufe ausgeblendet.")
  wow.slash("/lc hidemax")
  eq(wow.chat[10], P .. "Das Fenster öffnet sich jetzt auch auf Höchststufe.")
  wow.slash("/lc hilfe")
  eq(wow.chat[11], P .. "/lc öffnet oder schließt die Uhr, /lc history zeigt deine letzten Sitzungen, /lc levels zeigt deine letzten Stufen, /lc reset startet eine neue Sitzung.")
  eq(wow.chat[12], P .. "/lc lock und /lc unlock sperren oder entsperren das Fenster, /lc scale 0,8 bis 1,5 legt seine Größe fest, /lc hidemax blendet es auf Höchststufe aus, /lc options zeigt diese Einstellungen.")
  eq(#wow.chat, 12)
end)

test("German texts keep every placeholder of the English text, in order", function(wow)
  wow.locale = "deDE"
  local ns = boot(wow)
  local n = 0
  for key, text in pairs(ns.L) do
    n = n + 1
    if not key:find("%H", 1, true) then eq(placeholders(text), placeholders(key), key) end
  end
  eq(n, 47, "every text on screen has its German one")
  eq(ns.L["%b %d %H:%M"], "%d.%m. %H:%M", "dates the German way")
end)

test("an English client keeps the English texts", function(wow)
  wow.locale = "enGB"
  local ns = boot(wow, { xp = 1000, max = 10000 })
  eq(next(ns.L), nil)
  wow.slash("/lc")
  eq(shows(3), "XP to level = 9,000")
  LevelClockFrame.switch:Click()
  eq(LevelClockFrame.title:GetText(), "Session history")
  eq(ns.HistoryText({ xp = 40, seconds = 30, levels = 0 }), "-: 40 XP in under a minute")
end)
