-- Tests for Reset Clock, run by tools/wow/client/run.lua.

-- The stand-in client has no reset clock, no sounds and no raid warnings; these model them.
local STAND_IN = { "C_DateAndTime", "PlaySound", "SOUNDKIT", "RaidNotice_AddMessage", "RaidWarningFrame", "ChatTypeInfo" }
local game

local function client(g)
  game = { daily = 3 * 3600 + 12 * 60, weekly = 2 * 86400 + 5 * 3600, sounds = {}, warnings = {} }
  for k, v in pairs(g or {}) do game[k] = v end
  C_DateAndTime = {
    GetSecondsUntilDailyReset = function() return game.daily end,
    GetSecondsUntilWeeklyReset = function() return game.weekly end,
  }
  SOUNDKIT = { RAID_WARNING = 8959 }
  PlaySound = function(id, channel) table.insert(game.sounds, { id, channel }) end
  RaidWarningFrame = {}
  ChatTypeInfo = { RAID_WARNING = { r = 1, g = 0.3, b = 0 } }
  RaidNotice_AddMessage = function(frame, text) table.insert(game.warnings, text) end
end

local function boot(wow, g)
  client(g)
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("ADDON_LOADED", "ResetClock")
  wow.fire("PLAYER_LOGIN")
  return ns
end

-- Lets seconds pass, the way the game calls OnUpdate every frame.
local function pass(wow, ns, seconds)
  for _ = 1, seconds do
    wow.now = wow.now + 1
    wow.clock = wow.clock + 1
    ns.eventFrame.scripts.OnUpdate(ns.eventFrame, 1)
  end
end

local function last(wow) return wow.chat[#wow.chat] end
local function has(text, pattern) return text ~= nil and text:find(pattern, 1, true) ~= nil end

test("addon defines only its own globals", function(wow, installed, before)
  local ns = boot(wow)
  wow.slash("/rc")
  wow.slash("/rc timer 10m tea")
  wow.slash("/rc timer")
  wow.slash("/rc window")
  pass(wow, ns, 601)
  wow.slash("/rc cancel")
  wow.slash("/rc help")
  local allowed = { ResetClockDB = true, ResetClockFrame = true, SLASH_RESETCLOCK1 = true, SLASH_RESETCLOCK2 = true }
  for _, name in ipairs(STAND_IN) do installed[name] = true end
  for k in pairs(_G) do
    if not before[k] and not installed[k] and not allowed[k] then error("unexpected global " .. tostring(k)) end
  end
end)

test("durations read short: days and hours, hours and minutes, minutes and seconds", function(wow)
  local ns = boot(wow)
  eq(ns.FormatDuration(0), "0s")
  eq(ns.FormatDuration(45), "45s")
  eq(ns.FormatDuration(59.9), "59s", "fractions are cut off")
  eq(ns.FormatDuration(60), "1m 0s")
  eq(ns.FormatDuration(570), "9m 30s")
  eq(ns.FormatDuration(3600), "1h 0m")
  eq(ns.FormatDuration(3 * 3600 + 12 * 60 + 59), "3h 12m")
  eq(ns.FormatDuration(86400), "1d 0h")
  eq(ns.FormatDuration(2 * 86400 + 5 * 3600 + 3599), "2d 5h")
  eq(ns.FormatDuration(-5), "0s")
  eq(ns.FormatDuration(nil), "0s")
end)

test("timer lengths: units, combinations, plain minutes", function(wow)
  local ns = boot(wow)
  eq(ns.ParseDuration("10m"), 600)
  eq(ns.ParseDuration("1h30m"), 5400)
  eq(ns.ParseDuration("1h 30m"), 5400)
  eq(ns.ParseDuration("90s"), 90)
  eq(ns.ParseDuration("2H"), 7200)
  eq(ns.ParseDuration("1m30s"), 90)
  eq(ns.ParseDuration("30s1m"), 90, "order does not matter")
  eq(ns.ParseDuration("15"), 900, "a plain number is minutes")
  eq(ns.ParseDuration("24h"), 86400, "the longest timer")
end)

test("timer lengths: what is refused and why", function(wow)
  local ns = boot(wow)
  local function why(text) return select(2, ns.ParseDuration(text)) end
  eq(why(""), "invalid")
  eq(why("abc"), "invalid")
  eq(why("10x"), "invalid")
  eq(why("1.5h"), "invalid")
  eq(why("-5m"), "invalid")
  eq(why("1h30"), "invalid", "a bare number after a unit is unclear")
  eq(why("5m5m"), "invalid", "a unit twice")
  eq(why("0"), "short")
  eq(why("0s"), "short")
  eq(why("24h1s"), "long")
  eq(why("1441"), "long", "more than 24 hours in minutes")
end)

test("timer arguments: the duration first, the rest is the label", function(wow)
  local ns = boot(wow)
  local s, label = ns.ParseTimerArgs("10m tea")
  eq(s, 600) eq(label, "tea")
  s, label = ns.ParseTimerArgs("1h 30m Raid starts")
  eq(s, 5400) eq(label, "Raid starts")
  s, label = ns.ParseTimerArgs("5 2 eggs")
  eq(s, 300, "a plain number stands alone") eq(label, "2 eggs")
  s, label = ns.ParseTimerArgs("90s")
  eq(s, 90) eq(label, nil)
  s, label = ns.ParseTimerArgs("tea 10m")
  eq(s, nil) eq(label, "invalid")
  s, label = ns.ParseTimerArgs("48h")
  eq(s, nil) eq(label, "long")
end)

test("labels: no escape codes, no line breaks, cut at 40 characters on a whole letter", function(wow)
  local ns = boot(wow)
  eq(ns.CleanLabel("|cffff0000red|r tea"), "cffff0000redr tea")
  eq(ns.CleanLabel("  a\nb  "), "a b")
  eq(ns.CleanLabel("   "), nil)
  eq(ns.CleanLabel(string.rep("x", 50)), string.rep("x", 40))
  local long = string.rep("x", 39) .. "ää" -- the first ä takes bytes 40 and 41
  eq(ns.CleanLabel(long), string.rep("x", 39))
end)

test("/rc prints both countdowns", function(wow)
  boot(wow)
  wow.slash("/rc")
  eq(#wow.chat, 2)
  eq(wow.chat[1], "|cffffd100Reset Clock:|r Daily reset in 3h 12m.")
  eq(wow.chat[2], "|cffffd100Reset Clock:|r Weekly reset in 2d 5h.")
  wow.slash("/resetclock")
  eq(#wow.chat, 4)
end)

test("without the reset functions or with secret values the countdowns say so", function(wow)
  local ns = boot(wow, { daily = { secret = true } })
  C_DateAndTime.GetSecondsUntilWeeklyReset = nil
  eq(ns.DailySeconds(), nil)
  eq(ns.WeeklySeconds(), nil)
  wow.slash("/rc")
  eq(wow.chat[1], "|cffffd100Reset Clock:|r Daily reset: not available.")
  eq(wow.chat[2], "|cffffd100Reset Clock:|r Weekly reset: not available.")
  C_DateAndTime = nil
  eq(ns.DailySeconds(), nil)
  C_DateAndTime = { GetSecondsUntilDailyReset = function() error("broken") end }
  eq(ns.DailySeconds(), nil, "a failing call")
  C_DateAndTime.GetSecondsUntilDailyReset = function() return "soon" end
  eq(ns.DailySeconds(), nil, "not a number")
  C_DateAndTime.GetSecondsUntilDailyReset = function() return -1 end
  eq(ns.DailySeconds(), nil, "below zero")
end)

test("a timer starts, shows the time left and is saved with its end time", function(wow)
  local ns = boot(wow)
  local start = wow.now
  wow.slash("/rc timer 10m Tea")
  eq(last(wow), "|cffffd100Reset Clock:|r Timer \"Tea\" started: 10m 0s.")
  eq(ResetClockDB.timer.endsAt, start + 600)
  eq(ResetClockDB.timer.seconds, 600)
  eq(ResetClockDB.timer.label, "Tea", "the label keeps its capital letter")
  pass(wow, ns, 150)
  wow.slash("/rc timer")
  eq(last(wow), "|cffffd100Reset Clock:|r Timer \"Tea\": 7m 30s left of 10m 0s.")
  wow.slash("/rc")
  eq(#wow.chat, 5, "the countdowns list the running timer too")
  eq(last(wow), "|cffffd100Reset Clock:|r Timer \"Tea\": 7m 30s left of 10m 0s.")
end)

test("when the timer runs out: chat, raid warning and sound, once", function(wow)
  local ns = boot(wow)
  wow.slash("/rc timer 90s")
  pass(wow, ns, 89)
  eq(#game.sounds, 0)
  eq(ResetClockDB.timer ~= nil, true)
  pass(wow, ns, 1)
  eq(last(wow), "|cffffd100Reset Clock:|r Timer is up!")
  eq(game.warnings[1], "Timer is up!")
  eq(game.sounds[1][1], 8959)
  eq(game.sounds[1][2], "Master")
  eq(ResetClockDB.timer, nil)
  local count = #wow.chat
  pass(wow, ns, 10)
  eq(#wow.chat, count, "no second announcement")
  eq(#game.sounds, 1)
end)

test("the alert still works without sound and raid warning functions", function(wow)
  local ns = boot(wow)
  PlaySound, SOUNDKIT, RaidNotice_AddMessage = nil, nil, nil
  wow.slash("/rc timer 5s pot")
  pass(wow, ns, 5)
  eq(last(wow), "|cffffd100Reset Clock:|r Timer \"pot\" is up!")
end)

test("a running timer survives /reload", function(wow)
  local ns = boot(wow)
  wow.slash("/rc timer 1h Mount")
  local saved = ResetClockDB
  pass(wow, ns, 600)
  -- /reload: the addon loads again and the game hands back the saved variables.
  ns = wow.load(ADDON_DIR, ADDON_NAME)
  ResetClockDB = saved
  wow.fire("PLAYER_LOGIN")
  eq(ns.Timer().label, "Mount")
  wow.slash("/rc timer")
  eq(last(wow), "|cffffd100Reset Clock:|r Timer \"Mount\": 50m 0s left of 1h 0m.")
end)

test("a timer that ran out while logged out is reported at login, without sound", function(wow)
  ResetClockDB = { version = 1, settings = {}, timer = { endsAt = wow.now - 30, seconds = 600, label = "Bread" } }
  boot(wow)
  eq(wow.chat[1], "|cffffd100Reset Clock:|r Timer \"Bread\" ran out while you were away.")
  eq(#game.sounds, 0)
  eq(ResetClockDB.timer, nil)
end)

test("a broken saved timer is dropped", function(wow)
  ResetClockDB = { settings = {}, timer = { endsAt = "later" } }
  local ns = boot(wow)
  eq(ResetClockDB.timer, nil)
  eq(#wow.chat, 0)
  pass(wow, ns, 2)
end)

test("a new timer replaces the running one, cancel stops it", function(wow)
  boot(wow)
  wow.slash("/rc timer 10m")
  wow.slash("/rc timer 5m eggs")
  eq(last(wow), "|cffffd100Reset Clock:|r Timer \"eggs\" started: 5m 0s. It replaces the timer that was running.")
  eq(ResetClockDB.timer.seconds, 300)
  wow.slash("/rc cancel")
  eq(last(wow), "|cffffd100Reset Clock:|r Timer \"eggs\" stopped.")
  eq(ResetClockDB.timer, nil)
  wow.slash("/rc cancel")
  eq(last(wow), "|cffffd100Reset Clock:|r No timer is running.")
  wow.slash("/rc timer")
  eq(last(wow), "|cffffd100Reset Clock:|r No timer running. /rc timer 10m starts one.")
  wow.slash("/rc timer 2m")
  wow.slash("/rc CANCEL")
  eq(last(wow), "|cffffd100Reset Clock:|r Timer stopped.")
end)

test("wrong timer input explains itself and starts nothing", function(wow)
  boot(wow)
  wow.slash("/rc timer soon")
  eq(has(last(wow), "Give the time like 10m, 1h30m, 90s or 15 (minutes)"), true)
  wow.slash("/rc timer 25h")
  eq(last(wow), "|cffffd100Reset Clock:|r A timer can run at most 24 hours.")
  wow.slash("/rc timer 0")
  eq(last(wow), "|cffffd100Reset Clock:|r A timer needs at least one second.")
  eq(ResetClockDB.timer, nil)
end)

test("the window shows both countdowns and the timer and updates each second", function(wow)
  local ns = boot(wow)
  wow.slash("/rc window")
  local f = ResetClockFrame
  eq(f:IsShown(), true)
  eq(UISpecialFrames[1], "ResetClockFrame")
  eq(f.lines[1].left:GetText(), "Daily reset")
  eq(f.lines[1].right:GetText(), "3h 12m")
  eq(f.lines[2].right:GetText(), "2d 5h")
  eq(f.lines[3].left:GetText(), "Timer")
  eq(f.lines[3].right:GetText(), "|cff9d9d9d-|r")
  wow.slash("/rc timer 2m Tea")
  eq(f.lines[3].left:GetText(), "Tea")
  eq(f.lines[3].right:GetText(), "2m 0s")
  game.daily = game.daily - 60
  pass(wow, ns, 1)
  eq(f.lines[3].right:GetText(), "1m 59s")
  eq(f.lines[1].right:GetText(), "3h 11m")
  pass(wow, ns, 119)
  eq(f.lines[3].left:GetText(), "Timer")
  eq(f.lines[3].right:GetText(), "|cff9d9d9d-|r")
end)

test("the window remembers its place and whether it was open", function(wow)
  local ns = boot(wow)
  wow.slash("/rc window")
  local f = ResetClockFrame
  f:SetPoint("TOPLEFT", 100, -50)
  f.scripts.OnDragStop(f)
  eq(ResetClockDB.settings.point[1], "TOPLEFT")
  eq(ResetClockDB.settings.point[3], 100)
  eq(ResetClockDB.settings.shown, true)
  local saved = ResetClockDB
  -- /reload with the window open: it comes back at the same place.
  ns = wow.load(ADDON_DIR, ADDON_NAME)
  ResetClockDB = saved
  wow.fire("PLAYER_LOGIN")
  eq(ResetClockFrame:IsShown(), true)
  eq(ResetClockFrame.point[1], "TOPLEFT")
  eq(ResetClockFrame.point[4], 100)
  -- The close button: it stays closed next time.
  ResetClockFrame:Hide()
  ResetClockFrame.scripts.OnHide(ResetClockFrame)
  eq(ResetClockDB.settings.shown, false)
  wow.slash("/rc window")
  eq(ResetClockFrame:IsShown(), true)
  wow.slash("/rc window")
  eq(ResetClockFrame:IsShown(), false)
  eq(ResetClockDB.settings.shown, false)
end)

test("hiding the whole interface does not count as closing the window", function(wow)
  boot(wow)
  wow.slash("/rc window")
  local f = ResetClockFrame
  f.scripts.OnHide(f) -- Alt+Z: OnHide runs, but the window itself is still shown
  eq(ResetClockDB.settings.shown, true)
end)

test("slash commands before login do nothing, unknown words show the help", function(wow)
  client()
  wow.load(ADDON_DIR, ADDON_NAME)
  wow.slash("/rc timer 5m")
  eq(#wow.chat, 0)
  wow.fire("PLAYER_LOGIN")
  wow.slash("/rc what")
  eq(has(last(wow), "/rc timer 10m tea starts a timer with a label"), true)
end)

-- 1.1: German ------------------------------------------------------------------------------------------

local P = "|cffffd100Reset Clock:|r "

-- Every placeholder of a text, in order: "%d", "%s", "%%".
local function placeholders(text)
  local out = {}
  for p in text:gmatch("%%[%d%.]*[%a%%]") do out[#out + 1] = p end
  return table.concat(out, " ")
end

local function german(wow)
  wow.locale = "deDE"
  return boot(wow)
end

test("German client: the countdowns and the help in German", function(wow)
  german(wow)
  wow.slash("/rc")
  eq(wow.chat[1], P .. "Tägliche Zurücksetzung in 3h 12m.")
  eq(wow.chat[2], P .. "Wöchentliche Zurücksetzung in 2d 5h.")
  C_DateAndTime = nil
  wow.slash("/rc")
  eq(wow.chat[3], P .. "Tägliche Zurücksetzung: nicht verfügbar.")
  eq(wow.chat[4], P .. "Wöchentliche Zurücksetzung: nicht verfügbar.")
  wow.slash("/rc hilfe")
  eq(last(wow), P .. "/rc timer 10m Tee startet einen Timer mit Namen, /rc timer zeigt die verbleibende Zeit, /rc cancel beendet ihn, /rc window öffnet das Fenster.")
end)

test("German client: the timer in German, the command words and time letters stay English", function(wow)
  local ns = german(wow)
  wow.slash("/rc timer")
  eq(last(wow), P .. "Es läuft kein Timer. /rc timer 10m startet einen.")
  wow.slash("/rc timer 10m")
  eq(last(wow), P .. "Timer gestartet: 10m 0s.")
  wow.slash("/rc timer 1h30m Tee")
  eq(last(wow), P .. "Timer „Tee“ gestartet: 1h 30m. Er ersetzt den Timer, der lief.")
  pass(wow, ns, 150)
  wow.slash("/rc timer")
  eq(last(wow), P .. "Timer „Tee“: noch 1h 27m von 1h 30m.")
  wow.slash("/rc abbrechen")
  eq(ResetClockDB.timer ~= nil, true, "German command words are not commands")
  eq(has(last(wow), "/rc cancel beendet ihn"), true)
  wow.slash("/rc cancel")
  eq(last(wow), P .. "Timer „Tee“ beendet.")
  wow.slash("/rc cancel")
  eq(last(wow), P .. "Es läuft kein Timer.")
  wow.slash("/rc timer 2m")
  wow.slash("/rc cancel")
  eq(last(wow), P .. "Timer beendet.")
  wow.slash("/rc timer bald")
  eq(last(wow), P .. "Gib die Zeit so an: 10m, 1h30m, 90s oder 15 (Minuten), zum Beispiel /rc timer 10m Tee.")
  wow.slash("/rc timer 25h")
  eq(last(wow), P .. "Ein Timer läuft höchstens 24 Stunden.")
  wow.slash("/rc timer 0")
  eq(last(wow), P .. "Ein Timer braucht mindestens eine Sekunde.")
  wow.slash("/rc timer 5s Brot")
  pass(wow, ns, 5)
  eq(last(wow), P .. "Timer „Brot“ ist abgelaufen!")
  eq(game.warnings[1], "Timer „Brot“ ist abgelaufen!", "the raid warning in German too")
end)

test("German client: a timer that ran out while logged out, and the window in German", function(wow)
  wow.locale = "deDE"
  ResetClockDB = { version = 1, settings = {}, timer = { endsAt = wow.now - 30, seconds = 600 } }
  local ns = boot(wow)
  eq(wow.chat[1], P .. "Timer ist abgelaufen, während du weg warst.")
  wow.slash("/rc window")
  local f = ResetClockFrame
  eq(f.title:GetText(), "Reset Clock")
  eq(f.lines[1].left:GetText(), "Tägliche Zurücksetzung")
  eq(f.lines[1].right:GetText(), "3h 12m")
  eq(f.lines[2].left:GetText(), "Wöchentliche Zurücksetzung")
  eq(f.lines[3].left:GetText(), "Timer")
  wow.slash("/rc timer 2m Tee")
  pass(wow, ns, 1)
  eq(f.lines[3].left:GetText(), "Tee")
  eq(f.lines[3].right:GetText(), "1m 59s")
  eq(ResetClockDB.timer.label, "Tee", "the timer is saved the same way as in 1.0")
end)

test("German texts keep every placeholder of the English text, in order", function(wow)
  local ns = german(wow)
  local n = 0
  for key, text in pairs(ns.L) do
    n = n + 1
    eq(placeholders(text), placeholders(key), key)
  end
  eq(n, 24, "every text on screen has its German one")
end)

test("an English client keeps the English texts", function(wow)
  wow.locale = "enUS"
  local ns = boot(wow)
  eq(next(ns.L), nil)
  wow.slash("/rc")
  eq(wow.chat[1], P .. "Daily reset in 3h 12m.")
  wow.slash("/rc timer 5s pot")
  pass(wow, ns, 5)
  eq(last(wow), P .. "Timer \"pot\" is up!")
  wow.slash("/rc window")
  eq(ResetClockFrame.lines[2].left:GetText(), "Weekly reset")
end)
