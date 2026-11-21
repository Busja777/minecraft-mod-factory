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
  eq(LevelClockDB.version, 2)
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
  eq(LevelClockDB.version, 2)
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
  eq(LevelClockDB.version, 2)
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
