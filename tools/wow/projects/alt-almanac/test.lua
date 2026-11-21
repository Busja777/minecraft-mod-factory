-- Tests for Alt Almanac, run by tools/wow/client/run.lua.

-- The stand-in client has no XP bar, zones or resting; these are the game functions the addon reads.
-- Since 1.1 also /played (RequestTimePlayed), timers (C_Timer) and the chat windows that print the answer.
local STAND_IN = {
  "UnitLevel", "UnitXPMax", "GetXPExhaustion", "IsPlayerAtEffectiveMaxLevel",
  "IsResting", "GetRealZoneText", "GetSubZoneText",
  "RequestTimePlayed", "C_Timer", "NUM_CHAT_WINDOWS", "ChatFrame1", "ChatFrame2",
}
local player, timers

-- A chat window: it prints the /played answer while it listens for TIME_PLAYED_MSG.
local function chatFrame()
  local f = { events = { TIME_PLAYED_MSG = true }, printed = 0 }
  function f:IsEventRegistered(e) return self.events[e] == true end
  function f:RegisterEvent(e) self.events[e] = true end
  function f:UnregisterEvent(e) self.events[e] = nil end
  return f
end

local function client(p)
  player = { level = 20, max = 10000, rested = nil, atMax = false, resting = false, zone = "Stormwind City", subzone = "Trade District" }
  for k, v in pairs(p or {}) do player[k] = v end
  UnitLevel = function() return player.level end
  UnitXPMax = function() return player.max end
  GetXPExhaustion = function() return player.rested end
  IsPlayerAtEffectiveMaxLevel = function() return player.atMax end
  IsResting = function() return player.resting end
  GetRealZoneText = function() return player.zone end
  GetSubZoneText = function() return player.subzone end
  player.requests = 0
  RequestTimePlayed = function() player.requests = player.requests + 1 end
  timers = {}
  C_Timer = { After = function(seconds, fn) timers[#timers + 1] = { seconds, fn } end }
  NUM_CHAT_WINDOWS = 2
  ChatFrame1, ChatFrame2 = chatFrame(), chatFrame()
end

-- Runs the timers that are due within the given seconds, the way the game does a moment later.
local function wait(seconds)
  local due, rest = {}, {}
  for _, t in ipairs(timers) do
    if t[1] <= seconds then due[#due + 1] = t[2] else rest[#rest + 1] = { t[1] - seconds, t[2] } end
  end
  timers = rest
  for _, fn in ipairs(due) do fn() end
end

-- The server's answer to /played: the addon and every listening chat window get it.
local function answer(wow, total, level)
  wow.fire("TIME_PLAYED_MSG", total, level or 0)
  for _, f in ipairs({ ChatFrame1, ChatFrame2 }) do
    if f.events.TIME_PLAYED_MSG then f.printed = f.printed + 1 end
  end
end

local function printed() return ChatFrame1.printed + ChatFrame2.printed end

local function boot(wow, p, money)
  client(p)
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.money = money or 0
  wow.fire("ADDON_LOADED", "AltAlmanac")
  wow.fire("PLAYER_LOGIN")
  return ns
end

local function me() return AltAlmanacDB.chars["Yubi-Silvermoon"] end

-- Texts of row i of the window, by column.
local function row(i)
  local cells = AltAlmanacFrame.rows[i]
  return {
    name = cells.name:GetText(), level = cells.level:GetText(), gold = cells.gold:GetText(),
    zone = cells.zone:GetText(), rested = cells.rested:GetText(), seen = cells.seen:GetText(),
    played = cells.played:GetText(),
  }
end

local HOUR = 3600
local DAY = 86400
local DASH = "|cff9d9d9d\226\128\148|r"

test("addon defines only its own globals", function(wow, installed, before)
  boot(wow)
  wait(3)
  answer(wow, 5000)
  wait(0)
  wow.fire("PLAYER_LOGOUT")
  wow.slash("/aa") -- creates the window
  AltAlmanacFrame.headButtons.gold:Click()
  AltAlmanacFrame.realmCheck:Click()
  AltAlmanacFrame.levelBox:SetText("10")
  AltAlmanacFrame.levelBox.scripts.OnEnterPressed(AltAlmanacFrame.levelBox)
  wow.slash("/aa realm all")
  wow.slash("/aa level off")
  local allowed = { AltAlmanacDB = true, AltAlmanacFrame = true, SLASH_ALTALMANAC1 = true, SLASH_ALTALMANAC2 = true }
  for _, name in ipairs(STAND_IN) do installed[name] = true end
  for k in pairs(_G) do
    if not before[k] and not installed[k] and not allowed[k] then error("unexpected global " .. tostring(k)) end
  end
end)

test("login stores the whole character", function(wow)
  local ns = boot(wow, { level = 42, max = 20000, rested = 9000, resting = true }, 123456)
  local c = me()
  eq(AltAlmanacDB.version, 3)
  eq(ns.char, c)
  eq(c.class, "MAGE")
  eq(c.level, 42)
  eq(c.money, 123456)
  eq(c.zone, "Stormwind City")
  eq(c.subzone, "Trade District")
  eq(c.rested, 45)
  eq(c.resting, true)
  eq(c.maxLevel, nil)
  eq(c.seen, wow.now)
end)

test("rested estimate: inn, outside, cap, nothing stored", function(wow)
  local ns = boot(wow)
  eq(ns.RestedEstimate(0, true, 8 * HOUR), 5)
  eq(ns.RestedEstimate(0, false, 8 * HOUR), 1.25)
  eq(ns.RestedEstimate(10, false, 32 * HOUR), 15)
  eq(ns.RestedEstimate(140, true, 24 * HOUR), 150, "capped at one and a half levels")
  eq(ns.RestedEstimate(0, true, 30 * 86400), 150)
  eq(ns.RestedEstimate(150, false, 1000), 150)
  eq(ns.RestedEstimate(30, true, 0), 30)
  eq(ns.RestedEstimate(30, true, -500), 30, "a clock that went back changes nothing")
  eq(ns.RestedEstimate(nil, true, 8 * HOUR), nil)
  eq(ns.RestedPercent(4500, 10000), 45)
  eq(ns.RestedPercent(1, 3), 33)
  eq(ns.RestedPercent(100, 0), nil)
end)

test("relative time texts", function(wow)
  local ns = boot(wow)
  eq(ns.RelativeTime(0), "now")
  eq(ns.RelativeTime(59), "now")
  eq(ns.RelativeTime(60), "1m")
  eq(ns.RelativeTime(3599), "59m")
  eq(ns.RelativeTime(3 * HOUR), "3h")
  eq(ns.RelativeTime(86399), "23h")
  eq(ns.RelativeTime(2 * 86400 + 5 * HOUR), "2d")
  eq(ns.RelativeTime(nil), "?")
end)

test("money and place texts", function(wow)
  local ns = boot(wow)
  eq(ns.PlainMoney(0), "0c")
  eq(ns.PlainMoney(5), "5c")
  eq(ns.PlainMoney(1205), "12s 05c")
  eq(ns.PlainMoney(123456789), "12,345g 67s 89c")
  eq(ns.FormatMoney(0), "0")
  eq(ns.FormatMoney(10000), "1g 00s 00c")
  GetMoneyString = function(copper) return "[" .. copper .. "]" end
  eq(ns.FormatMoney(250), "[250]", "the game's own money text when it exists")
  eq(ns.PlaceText("Dornogal", "The Coreway"), "Dornogal - The Coreway")
  eq(ns.PlaceText("Dornogal", ""), "Dornogal")
  eq(ns.PlaceText("Dornogal", "Dornogal"), "Dornogal")
  eq(ns.PlaceText("", "Somewhere"), nil)
  eq(ns.ClassColored("Brakk", "WARRIOR"), "|cffc69b6dBrakk|r")
  eq(ns.ClassColored("Old", nil), "Old")
  eq(ns.ClassColored("Odd", "UNKNOWNCLASS"), "Odd")
end)

test("rows: highest level first, then by name, with total gold", function(wow)
  local ns = boot(wow)
  local now = wow.now
  local chars = {
    ["zed-Silvermoon"] = { level = 70, money = 100, seen = now - HOUR },
    ["Anna-Silvermoon"] = { level = 70, money = 200, seen = now - 2 * HOUR },
    ["Brakk-Argent Dawn"] = { level = 80, money = 3000, seen = now - 86400 },
    ["Old-Silvermoon"] = { },
  }
  local rows, total = ns.BuildRows(chars, "Anna-Silvermoon", now)
  eq(#rows, 4)
  eq(rows[1].name, "Brakk")
  eq(rows[1].realm, "Argent Dawn")
  eq(rows[2].name, "Anna")
  eq(rows[3].name, "zed", "names compare without case")
  eq(rows[4].name, "Old", "unknown level goes last")
  eq(total, 3300)
  eq(rows[2].current, true)
  eq(rows[2].ago, 0)
  eq(rows[3].ago, HOUR)
  eq(rows[4].ago, nil)
end)

test("rows: rested grows for other characters, not for the current one or at max level", function(wow)
  local ns = boot(wow)
  local now = wow.now
  local chars = {
    ["Inn-Silvermoon"] = { level = 30, rested = 10, resting = true, seen = now - 16 * HOUR },
    ["Field-Silvermoon"] = { level = 30, rested = 10, resting = false, seen = now - 16 * HOUR },
    ["Max-Silvermoon"] = { level = 80, rested = 0, maxLevel = true, resting = true, seen = now - 30 * 86400 },
    ["Here-Silvermoon"] = { level = 30, rested = 10, resting = true, seen = now - 16 * HOUR },
  }
  local rows = ns.BuildRows(chars, "Here-Silvermoon", now)
  local by = {}
  for _, r in ipairs(rows) do by[r.name] = r end
  eq(by.Inn.rested, 20)
  eq(by.Field.rested, 12.5)
  eq(by.Max.rested, 0)
  eq(by.Here.rested, 10, "the character you play shows what the game says")
end)

test("visible rows: up to 15, else the last one counts the rest", function(wow)
  local ns = boot(wow)
  local rows = {}
  for i = 1, 15 do rows[i] = { name = "A" .. i } end
  local shown, more = ns.Visible(rows, 15)
  eq(#shown, 15)
  eq(more, 0)
  rows[16] = { name = "A16" }
  shown, more = ns.Visible(rows, 15)
  eq(#shown, 14)
  eq(more, 2)
end)

test("money, level, zone, rested and resting follow their events", function(wow)
  local ns = boot(wow, { level = 10, max = 1000, rested = 0 }, 500)
  local c = me()
  wow.now = wow.now + 30
  wow.setMoney(900)
  eq(c.money, 900)
  eq(c.seen, wow.now)
  player.level = 999 -- the event argument wins over the late unit reading
  wow.fire("PLAYER_LEVEL_UP", 11, 0, 0, 0, 0)
  eq(c.level, 11)
  player.zone, player.subzone = "Elwynn Forest", "Goldshire"
  wow.fire("ZONE_CHANGED_NEW_AREA")
  eq(c.zone, "Elwynn Forest")
  eq(c.subzone, "Goldshire")
  player.subzone = ""
  wow.fire("ZONE_CHANGED")
  eq(c.subzone, nil)
  player.rested = 1500
  wow.fire("UPDATE_EXHAUSTION")
  eq(c.rested, 150)
  player.rested = nil
  wow.fire("UPDATE_EXHAUSTION")
  eq(c.rested, 0, "no rested bonus at all")
  player.resting = true
  wow.fire("PLAYER_UPDATE_RESTING")
  eq(c.resting, true)
  player.resting = false
  wow.fire("PLAYER_UPDATE_RESTING")
  eq(c.resting, false)
end)

test("a level-up without a readable argument reads the level itself", function(wow)
  local ns = boot(wow, { level = 10 })
  player.level = 11
  wow.fire("PLAYER_LEVEL_UP")
  eq(me().level, 11)
  player.level = 12
  wow.fire("PLAYER_LEVEL_UP", { secret = true })
  eq(me().level, 12)
end)

test("at max level the rested bonus is 0 and does not grow", function(wow)
  local ns = boot(wow, { level = 79, max = 1000, rested = 800 })
  eq(me().rested, 80)
  player.atMax = true
  wow.fire("PLAYER_LEVEL_UP", 80)
  eq(me().level, 80)
  eq(me().maxLevel, true)
  eq(me().rested, 0)
  player.rested = 5000
  wow.fire("UPDATE_EXHAUSTION")
  eq(me().rested, 0)
  wow.slash("/aa")
  eq(row(1).rested, "|cff9d9d9d-|r")
end)

test("a client without the max level function still works", function(wow)
  local ns = boot(wow, { rested = 2000 })
  IsPlayerAtEffectiveMaxLevel = nil
  eq(ns.AtMaxLevel(), false)
  wow.fire("UPDATE_EXHAUSTION")
  eq(me().rested, 20)
end)

test("secret values are skipped and the last good value stays", function(wow)
  local ns = boot(wow, { level = 30, rested = 3000 }, 700)
  local c = me()
  local secret = { secret = true }
  wow.setMoney(secret)
  eq(c.money, 700)
  player.rested = secret
  wow.fire("UPDATE_EXHAUSTION")
  eq(c.rested, 30)
  player.rested, player.max = 1000, secret
  wow.fire("UPDATE_EXHAUSTION")
  eq(c.rested, 30)
  player.resting = secret
  wow.fire("PLAYER_UPDATE_RESTING")
  eq(c.resting, false)
  player.zone = secret
  wow.fire("ZONE_CHANGED_NEW_AREA")
  eq(c.zone, "Stormwind City")
  player.atMax = secret
  eq(ns.AtMaxLevel(), false)
end)

test("a loading screen with no zone name keeps the last place", function(wow)
  local ns = boot(wow)
  player.zone, player.subzone = "", ""
  wow.fire("ZONE_CHANGED_NEW_AREA")
  eq(me().zone, "Stormwind City")
  eq(me().subzone, "Trade District")
end)

test("logging out saves everything once more", function(wow)
  local ns = boot(wow, { level = 20, max = 1000, rested = 100 }, 10)
  player.level, player.rested, player.resting = 21, 500, true
  player.zone, player.subzone = "Valdrakken", "The Seat of the Aspects"
  wow.money = 4242
  wow.now = wow.now + 600
  wow.fire("PLAYER_LOGOUT")
  local c = me()
  eq(c.level, 21)
  eq(c.rested, 50)
  eq(c.resting, true)
  eq(c.money, 4242)
  eq(c.zone, "Valdrakken")
  eq(c.subzone, "The Seat of the Aspects")
  eq(c.seen, wow.now)
end)

test("the window lists every character with class colour, gold, zone, rested and last seen", function(wow)
  AltAlmanacDB = { chars = {
    ["Brakk-Silvermoon"] = { class = "WARRIOR", level = 80, money = 5000000, zone = "Dornogal", rested = 0, maxLevel = true, seen = os.time({ year = 2026, month = 11, day = 18, hour = 12 }) },
    ["Lia-Argent Dawn"] = { class = "PRIEST", level = 35, money = 1234, zone = "Duskwood", subzone = "Darkshire", rested = 10, resting = true, seen = os.time({ year = 2026, month = 11, day = 20, hour = 2 }) },
    ["Old-Silvermoon"] = { },
  } }
  local ns = boot(wow, { level = 42, max = 10000, rested = 4500, resting = false }, 20000)
  wow.slash("/aa")
  local f = AltAlmanacFrame
  eq(f:IsShown(), true)
  eq(UISpecialFrames[1], "AltAlmanacFrame")
  eq(f.head.name:GetText(), "Character")
  eq(f.head.rested:GetText(), "Rested")
  local r = row(1)
  eq(r.name, "|cffc69b6dBrakk|r")
  eq(r.level, "80")
  eq(r.gold, "500g 00s 00c")
  eq(r.zone, "Dornogal")
  eq(r.rested, "|cff9d9d9d-|r")
  eq(r.seen, "2d")
  r = row(2)
  eq(r.name, "|cff3fc7ebYubi|r")
  eq(r.zone, "Stormwind City - Trade District")
  eq(r.rested, "45%")
  eq(r.seen, "now")
  r = row(3)
  eq(r.name, "Lia|cff9d9d9d-Argent Dawn|r", "no colour for an unknown class, the realm when it is not yours")
  eq(r.level, "35")
  eq(r.rested, "|cff4da6ff20%|r", "16 hours in an inn: 10 + 10, shown in blue")
  eq(r.seen, "16h")
  r = row(4)
  eq(r.name, "Old")
  eq(r.level, "|cff9d9d9d?|r")
  eq(r.gold, "|cff9d9d9d?|r")
  eq(r.zone, "|cff9d9d9d?|r")
  eq(r.seen, "?")
  eq(row(5).name, "")
  eq(f.head.played:GetText(), "Played")
  eq(row(1).played, DASH, "not seen with 1.1 yet")
  eq(f.totalLabel:GetText(), "Total")
  eq(f.total:GetText(), "502g 12s 34c")
  eq(f.totalPlayed:GetText(), DASH)
end)

test("the window follows changes while it is open", function(wow)
  local ns = boot(wow, {}, 10000)
  wow.slash("/aa")
  eq(row(1).gold, "1g 00s 00c")
  wow.setMoney(30000)
  eq(row(1).gold, "3g 00s 00c")
  eq(AltAlmanacFrame.total:GetText(), "3g 00s 00c")
  wow.fire("PLAYER_LEVEL_UP", 21)
  eq(row(1).level, "21")
end)

test("many characters: 14 rows and one that counts the rest", function(wow)
  AltAlmanacDB = { chars = {} }
  for i = 1, 20 do AltAlmanacDB.chars["Alt" .. string.format("%02d", i) .. "-Silvermoon"] = { level = i, money = i } end
  local ns = boot(wow, { level = 70 })
  wow.slash("/aa")
  local rows = AltAlmanacFrame.rows
  eq(#rows, 15)
  eq(row(1).name, "|cff3fc7ebYubi|r")
  eq(row(2).name, "Alt20")
  eq(row(14).name, "Alt08")
  eq(row(15).name, "|cff9d9d9dand 7 more|r")
  eq(row(15).level, "")
end)

test("/aa forget removes another character, never the current one", function(wow)
  AltAlmanacDB = { chars = { ["Brakk-Argent Dawn"] = { level = 5 } } }
  local ns = boot(wow)
  wow.slash("/aa")
  eq(row(2).name, "Brakk|cff9d9d9d-Argent Dawn|r")
  wow.slash("/aa forget brakk-argent dawn")
  eq(AltAlmanacDB.chars["Brakk-Argent Dawn"], nil)
  eq(wow.chat[1]:match("Brakk%-Argent Dawn forgotten%.") ~= nil, true)
  eq(row(2).name, "", "the window drops the row at once")
  wow.slash("/aa FORGET Yubi-Silvermoon")
  eq(AltAlmanacDB.chars["Yubi-Silvermoon"] ~= nil, true)
  eq(wow.chat[2]:match("cannot forget the character you are playing") ~= nil, true)
  wow.slash("/aa forget Nobody-Realm")
  eq(wow.chat[3]:match("No character called Nobody%-Realm") ~= nil, true)
  eq(#wow.chat, 3)
end)

test("/aa and /altalmanac toggle the window, anything else prints help", function(wow)
  local ns = boot(wow)
  eq(AltAlmanacFrame, nil, "the window is built on first use")
  wow.slash("/aa")
  eq(AltAlmanacFrame:IsShown(), true)
  wow.slash("/altalmanac")
  eq(AltAlmanacFrame:IsShown(), false)
  wow.slash("/aa  ")
  eq(AltAlmanacFrame:IsShown(), true)
  eq(#wow.chat, 0)
  wow.slash("/aa help")
  wow.slash("/aa forget")
  eq(#wow.chat, 4)
  eq(wow.chat[1]:match("/aa forget Name%-Realm removes a character") ~= nil, true)
  eq(wow.chat[2]:match("Click a heading to sort%. /aa realm this or /aa realm all filters by realm") ~= nil, true)
end)

test("the window can be moved and comes back where it was left", function(wow)
  AltAlmanacDB = { settings = { point = { "TOPLEFT", "TOPLEFT", 40, -200 } } }
  local ns = boot(wow)
  wow.slash("/aa")
  local f = AltAlmanacFrame
  eq(f.point[1], "TOPLEFT")
  eq(f.point[2], UIParent)
  eq(f.point[4], 40)
  eq(f.point[5], -200)
  f:SetPoint("BOTTOMRIGHT", UIParent, "BOTTOMRIGHT", -12, 34) -- dragged
  f.scripts.OnDragStop(f)
  local p = AltAlmanacDB.settings.point
  eq(p[1], "BOTTOMRIGHT")
  eq(p[2], "BOTTOMRIGHT")
  eq(p[3], -12)
  eq(p[4], 34)
  eq(AltAlmanacDB.chars["Yubi-Silvermoon"] ~= nil, true, "old saved data without characters is completed")
end)

test("nothing happens before login", function(wow)
  client()
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.setMoney(500)
  wow.fire("PLAYER_LEVEL_UP", 30)
  wow.fire("ZONE_CHANGED_NEW_AREA")
  wow.fire("UPDATE_EXHAUSTION")
  wow.fire("PLAYER_UPDATE_RESTING")
  wow.fire("PLAYER_LOGOUT")
  wow.fire("TIME_PLAYED_MSG", 5000, 100)
  wow.slash("/aa")
  wow.slash("/aa forget Brakk-Silvermoon")
  eq(player.requests, 0)
  eq(#timers, 0)
  eq(AltAlmanacFrame, nil)
  eq(AltAlmanacDB, nil)
  eq(#wow.chat, 0)
end)

-- 1.1: played time

test("core: played time texts", function(wow)
  local ns = boot(wow)
  eq(ns.PlayedText(0), "0m")
  eq(ns.PlayedText(59), "0m")
  eq(ns.PlayedText(45 * 60), "45m")
  eq(ns.PlayedText(HOUR), "1h 0m")
  eq(ns.PlayedText(5 * HOUR + 12 * 60 + 30), "5h 12m")
  eq(ns.PlayedText(DAY - 1), "23h 59m")
  eq(ns.PlayedText(DAY), "1d 0h")
  eq(ns.PlayedText(12 * DAY + 4 * HOUR + 59 * 60), "12d 4h")
  eq(ns.PlayedText(400 * DAY), "400d 0h")
  eq(ns.PlayedText(nil), nil)
  eq(ns.PlayedText(-1), nil)
end)

test("core: played time keeps counting only for the character you play, and adds up", function(wow)
  local ns = boot(wow)
  local now = wow.now
  eq(ns.PlayedNow({ played = 100, playedAt = now - 60 }, true, now), 160)
  eq(ns.PlayedNow({ played = 100, playedAt = now - 60 }, false, now), 100, "logged out: the clock stands")
  eq(ns.PlayedNow({ played = 100, playedAt = now + 60 }, true, now), 100, "a clock that went back")
  eq(ns.PlayedNow({ played = 100 }, true, now), 100)
  eq(ns.PlayedNow({}, true, now), nil)
  local chars = {
    ["A-Silvermoon"] = { level = 10, played = 2 * DAY, playedAt = now - DAY },
    ["B-Silvermoon"] = { level = 20, played = HOUR, playedAt = now - 600 },
    ["C-Silvermoon"] = { level = 30 },
  }
  local rows, total, played = ns.BuildRows(chars, "B-Silvermoon", now)
  eq(rows[1].played, nil)
  eq(rows[2].played, HOUR + 600)
  eq(rows[3].played, 2 * DAY)
  eq(played, 2 * DAY + HOUR + 600, "characters without a time are left out")
  local _, _, none = ns.BuildRows({ ["C-Silvermoon"] = { level = 30 } }, "x", now)
  eq(none, nil)
end)

test("login asks for the played time once, a few seconds later, without chat spam", function(wow)
  local ns = boot(wow)
  eq(player.requests, 0, "not during the loading screen")
  eq(me().played, nil)
  wait(3)
  eq(player.requests, 1)
  eq(ChatFrame1:IsEventRegistered("TIME_PLAYED_MSG"), false, "the chat does not print this answer")
  eq(ChatFrame2:IsEventRegistered("TIME_PLAYED_MSG"), false)
  wow.now = wow.now + 1
  answer(wow, 3 * DAY + 5 * HOUR, 2 * HOUR)
  eq(me().played, 3 * DAY + 5 * HOUR)
  eq(me().playedAt, wow.now)
  eq(printed(), 0)
  wait(0)
  eq(ChatFrame1:IsEventRegistered("TIME_PLAYED_MSG"), true, "the chat gets /played back right after")
  eq(ChatFrame2:IsEventRegistered("TIME_PLAYED_MSG"), true)
  wait(15)
  eq(player.requests, 1, "asked only once")
end)

test("your own /played later is printed as usual and updates the time", function(wow)
  local ns = boot(wow)
  wait(3)
  answer(wow, 1000)
  wait(0)
  wow.now = wow.now + 600
  answer(wow, 1600)
  eq(printed(), 2, "both chat windows print it")
  eq(me().played, 1600)
end)

test("without an answer the chat gets /played back after 15 seconds", function(wow)
  local ns = boot(wow)
  wait(3)
  eq(ChatFrame1:IsEventRegistered("TIME_PLAYED_MSG"), false)
  wait(14)
  eq(ChatFrame1:IsEventRegistered("TIME_PLAYED_MSG"), false)
  wait(1)
  eq(ChatFrame1:IsEventRegistered("TIME_PLAYED_MSG"), true)
  eq(ChatFrame2:IsEventRegistered("TIME_PLAYED_MSG"), true)
  eq(me().played, nil)
  answer(wow, 1000)
  eq(printed(), 2)
end)

test("a chat window that did not listen is left alone", function(wow)
  local ns = boot(wow)
  ChatFrame2:UnregisterEvent("TIME_PLAYED_MSG") -- set up that way by the player or another addon
  wait(3)
  answer(wow, 1000)
  wait(0)
  eq(ChatFrame1:IsEventRegistered("TIME_PLAYED_MSG"), true)
  eq(ChatFrame2:IsEventRegistered("TIME_PLAYED_MSG"), false)
  eq(printed(), 0)
end)

test("the window shows the played time per character and in the total line", function(wow)
  local now = wow.now
  AltAlmanacDB = { version = 2, chars = {
    ["Brakk-Silvermoon"] = { class = "WARRIOR", level = 80, played = 12 * DAY + 4 * HOUR, playedAt = now - 5 * DAY, seen = now - 5 * DAY },
    ["Lia-Silvermoon"] = { level = 35 },
  } }
  local ns = boot(wow, { level = 42 })
  wait(3)
  answer(wow, 2 * HOUR + 30 * 60)
  wait(0)
  wow.slash("/aa")
  eq(row(1).played, "12d 4h", "logged out for five days: still the same")
  eq(row(2).played, "2h 30m")
  eq(row(3).played, DASH, "not seen with 1.1 yet")
  eq(AltAlmanacFrame.totalPlayed:GetText(), "12d 6h")
  wow.now = wow.now + 40 * 60
  wow.setMoney(5)
  eq(row(2).played, "3h 10m", "your own time keeps counting")
  eq(AltAlmanacFrame.totalPlayed:GetText(), "12d 7h")
end)

test("logout keeps the played time up to date, the time logged out does not count", function(wow)
  local ns = boot(wow)
  wait(3)
  answer(wow, 10 * HOUR)
  wait(0)
  wow.now = wow.now + HOUR
  wow.fire("PLAYER_LOGOUT")
  eq(me().played, 11 * HOUR)
  eq(me().playedAt, wow.now)
  -- three days later the same character logs in again
  wow.now = wow.now + 3 * DAY
  wow.fire("PLAYER_LOGIN")
  eq(me().played, 11 * HOUR)
  eq(me().playedAt, wow.now)
  wow.now = wow.now + 600
  local rows = ns.BuildRows(AltAlmanacDB.chars, "Yubi-Silvermoon", wow.now)
  eq(rows[1].played, 11 * HOUR + 600, "until the answer arrives the stored time counts on")
end)

test("saved data of 1.0 keeps everything and shows a dash until the character logs in", function(wow)
  AltAlmanacDB = { version = 1, settings = { point = { "TOP", "TOP", 0, -50 } }, chars = {
    ["Brakk-Silvermoon"] = { class = "WARRIOR", level = 80, money = 5000000, zone = "Dornogal", rested = 0, maxLevel = true, seen = wow.now - DAY },
    ["Yubi-Silvermoon"] = { class = "MAGE", level = 41, money = 100, seen = wow.now - DAY },
  } }
  local ns = boot(wow, { level = 42 }, 200)
  eq(AltAlmanacDB.version, 3)
  eq(AltAlmanacDB.settings.point[1], "TOP")
  eq(AltAlmanacDB.chars["Brakk-Silvermoon"].money, 5000000)
  eq(AltAlmanacDB.chars["Brakk-Silvermoon"].played, nil)
  eq(me().played, nil)
  wow.slash("/aa")
  eq(row(1).played, DASH)
  eq(row(2).played, DASH)
  eq(AltAlmanacFrame.totalPlayed:GetText(), DASH)
  wait(3)
  answer(wow, 90 * 60)
  eq(row(2).played, "1h 30m", "the open window follows the answer")
  eq(row(1).played, DASH)
  eq(AltAlmanacFrame.totalPlayed:GetText(), "1h 30m")
end)

test("answers that cannot be used are skipped, broken saved times are dropped", function(wow)
  AltAlmanacDB = { chars = { ["Yubi-Silvermoon"] = { level = 20, played = "a lot", playedAt = 5 } } }
  local ns = boot(wow)
  eq(me().played, nil)
  eq(me().playedAt, nil)
  answer(wow, { secret = true })
  eq(me().played, nil)
  answer(wow, -5)
  answer(wow, nil)
  eq(me().played, nil)
  answer(wow, 1234.7)
  eq(me().played, 1234)
end)

test("a client without RequestTimePlayed still works and leaves the chat alone", function(wow)
  client()
  RequestTimePlayed = nil
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("PLAYER_LOGIN")
  wait(3)
  eq(ChatFrame1:IsEventRegistered("TIME_PLAYED_MSG"), true)
  wait(20)
  eq(me().played, nil)
  wow.slash("/aa")
  eq(row(1).played, DASH)
end)

test("without timers the time is asked at once and the chat is not touched", function(wow)
  client()
  C_Timer = nil
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("PLAYER_LOGIN")
  eq(player.requests, 1)
  eq(ChatFrame1:IsEventRegistered("TIME_PLAYED_MSG"), true)
  answer(wow, 7200)
  eq(me().played, 7200)
  eq(printed(), 2, "the answer shows in the chat once")
end)

-- 1.2: sorting and filters

local function names()
  local out = {}
  for i = 1, 15 do
    local n = row(i).name
    if n == "" then break end
    out[#out + 1] = (n:gsub("|c%x%x%x%x%x%x%x%x", ""):gsub("|r", ""))
  end
  return table.concat(out, ",")
end

local function plainRows(spec)
  local rows = {}
  for _, r in ipairs(spec) do
    local name, realm = r.key:match("^(.-)%-(.+)$")
    r.name, r.realm = name, realm
    rows[#rows + 1] = r
  end
  return rows
end

local function order(rows)
  local out = {}
  for i, r in ipairs(rows) do out[i] = r.name end
  return table.concat(out, ",")
end

-- Four characters on two realms; you play Yubi (level 20) on Silvermoon.
local function family(wow)
  local now = wow.now
  AltAlmanacDB = { version = 2, chars = {
    ["Brakk-Silvermoon"] = { class = "WARRIOR", level = 80, money = 50000, zone = "Dornogal", rested = 0, maxLevel = true, played = 10 * DAY, playedAt = now - DAY, seen = now - DAY },
    ["Lia-Argent Dawn"] = { level = 35, money = 900000, zone = "Duskwood", rested = 10, seen = now - 2 * HOUR, played = HOUR, playedAt = now - 2 * HOUR },
    ["anna-Silvermoon"] = { level = 12, money = 100, zone = "Elwynn Forest", rested = 60, resting = true, seen = now - 3 * DAY },
  } }
end

test("core: rows sort by every column, a second click reverses, unknown values go last", function(wow)
  local ns = boot(wow)
  local function rows()
    return plainRows({
      { key = "Cara-A", level = 30, money = 500, place = "Zuldazar", rested = 20, played = 300, ago = 60 },
      { key = "bob-A", level = 70, money = 9000, place = "azsuna", rested = 0, played = 100, ago = 0 },
      { key = "Abe-B", level = 30, money = nil, place = nil, rested = nil, played = nil, ago = nil },
      { key = "Dex-A", level = nil, money = 20, place = "Bastion", rested = 150, played = 50, ago = 5000 },
    })
  end
  eq(order(ns.SortRows(rows(), "level")), "bob,Abe,Cara,Dex", "highest level first, equal levels by name, unknown last")
  eq(order(ns.SortRows(rows(), "level", true)), "Abe,Cara,bob,Dex", "reversed: lowest first, unknown still last")
  eq(order(ns.SortRows(rows(), "name")), "Abe,bob,Cara,Dex", "names A to Z without case")
  eq(order(ns.SortRows(rows(), "name", true)), "Dex,Cara,bob,Abe")
  eq(order(ns.SortRows(rows(), "gold")), "bob,Cara,Dex,Abe", "richest first")
  eq(order(ns.SortRows(rows(), "zone")), "bob,Dex,Cara,Abe", "zones A to Z without case")
  eq(order(ns.SortRows(rows(), "rested")), "Dex,Cara,bob,Abe", "most rested first")
  eq(order(ns.SortRows(rows(), "played")), "Cara,bob,Dex,Abe", "most played first")
  eq(order(ns.SortRows(rows(), "seen")), "bob,Cara,Dex,Abe", "most recently seen first")
  eq(order(ns.SortRows(rows(), "seen", true)), "Dex,Cara,bob,Abe")
  eq(order(ns.SortRows(rows(), "bogus")), "bob,Abe,Cara,Dex", "an unknown column sorts by level")
  eq(ns.ValidSort("gold"), "gold")
  eq(ns.ValidSort("Gold"), nil)
  eq(ns.ValidSort(nil), nil)
end)

test("core: the filter leaves out other realms and low levels, never your own character", function(wow)
  local ns = boot(wow)
  local rows = plainRows({
    { key = "Yubi-Silvermoon", level = 5, money = 1, played = 10, current = true },
    { key = "Brakk-Silvermoon", level = 80, money = 100, played = 1000 },
    { key = "Lia-Argent Dawn", level = 70, money = 10000 },
    { key = "Old-Silvermoon", money = 5 },
  })
  local shown, hidden = ns.FilterRows(rows, {}, "Silvermoon")
  eq(#shown, 4)
  eq(hidden, 0)
  shown, hidden = ns.FilterRows(rows, { realmOnly = true }, "Silvermoon")
  eq(order(shown), "Yubi,Brakk,Old")
  eq(hidden, 1)
  shown, hidden = ns.FilterRows(rows, { minLevel = 70 }, "Silvermoon")
  eq(order(shown), "Yubi,Brakk,Lia", "your own level 5 stays, an unknown level counts as below")
  eq(hidden, 1)
  shown, hidden = ns.FilterRows(rows, { realmOnly = true, minLevel = 80 }, "Silvermoon")
  eq(order(shown), "Yubi,Brakk")
  eq(hidden, 2)
  local total, played = ns.Totals(shown)
  eq(total, 101)
  eq(played, 1010)
  eq(ns.Totals({}), 0)
  eq(select(2, ns.Totals({ { money = 3 } })), nil)
end)

test("core: levels for the filter and the headings", function(wow)
  local ns = boot(wow)
  eq(ns.ParseLevel("70"), 70)
  eq(ns.ParseLevel(" 1 "), 1)
  eq(ns.ParseLevel("100"), 100)
  eq(ns.ParseLevel("101"), nil)
  eq(ns.ParseLevel("0"), nil)
  eq(ns.ParseLevel("7.5"), nil)
  eq(ns.ParseLevel("seventy"), nil)
  eq(ns.ParseLevel(nil), nil)
  eq(ns.ValidMinLevel(70.5), nil)
  eq(ns.HeadingText("level", "level", false), "|cffffffffLevel v|r")
  eq(ns.HeadingText("level", "level", true), "|cffffffffLevel ^|r")
  eq(ns.HeadingText("name", "name", false), "|cffffffffCharacter ^|r")
  eq(ns.HeadingText("gold", "level", false), "Gold")
end)

test("a click on a heading sorts the window, a second click reverses, the choice is saved", function(wow)
  family(wow)
  local ns = boot(wow, { level = 20 }, 7000)
  wow.slash("/aa")
  local f = AltAlmanacFrame
  eq(names(), "Brakk,Lia-Argent Dawn,Yubi,anna", "by level as before")
  eq(f.head.level:GetText(), "|cffffffffLevel v|r")
  f.headButtons.gold:Click()
  eq(names(), "Lia-Argent Dawn,Brakk,Yubi,anna")
  eq(f.head.gold:GetText(), "|cffffffffGold v|r")
  eq(f.head.level:GetText(), "Level")
  eq(AltAlmanacDB.settings.sortBy, "gold")
  eq(AltAlmanacDB.settings.sortReverse, false)
  f.headButtons.gold:Click()
  eq(names(), "anna,Yubi,Brakk,Lia-Argent Dawn")
  eq(f.head.gold:GetText(), "|cffffffffGold ^|r")
  eq(AltAlmanacDB.settings.sortReverse, true)
  f.headButtons.name:Click()
  eq(names(), "anna,Brakk,Lia-Argent Dawn,Yubi", "a new column starts in its own direction")
  eq(AltAlmanacDB.settings.sortReverse, false)
  f.headButtons.zone:Click()
  eq(names(), "Brakk,Lia-Argent Dawn,anna,Yubi", "Dornogal, Duskwood, Elwynn Forest, Stormwind City")
  f.headButtons.rested:Click()
  eq(names(), "anna,Lia-Argent Dawn,Brakk,Yubi", "max level and no rested bonus both count as 0, then by name")
  f.headButtons.played:Click()
  eq(names(), "Brakk,Lia-Argent Dawn,anna,Yubi", "characters without a played time go last, by name")
  f.headButtons.seen:Click()
  eq(names(), "Yubi,Lia-Argent Dawn,Brakk,anna")
  f.headButtons.seen.scripts.OnEnter(f.headButtons.seen)
  eq(wow.tooltip.lines[1], "Click to sort by this column, click again to reverse the order.")
  f.headButtons.seen.scripts.OnLeave(f.headButtons.seen)
  eq(wow.tooltip.shown, false)
  eq(#wow.chat, 0, "sorting says nothing in chat")
end)

test("the sort order is still there after a reload", function(wow)
  family(wow)
  AltAlmanacDB.settings = { sortBy = "gold", sortReverse = true }
  local ns = boot(wow, { level = 20 }, 7000)
  wow.slash("/aa")
  eq(names(), "anna,Yubi,Brakk,Lia-Argent Dawn")
  eq(AltAlmanacFrame.head.gold:GetText(), "|cffffffffGold ^|r")
end)

test("this realm only: the checkbox filters the window and the total, and is saved", function(wow)
  family(wow)
  local ns = boot(wow, { level = 20 }, 7000)
  wow.slash("/aa")
  local f = AltAlmanacFrame
  eq(f.realmLabel:GetText(), "This realm only")
  eq(f.filterInfo:GetText(), "")
  eq(f.total:GetText(), "95g 71s 00c")
  f.realmCheck:Click()
  eq(AltAlmanacDB.settings.realmOnly, true)
  eq(wow.chat[1], "|cffffd100Alt Almanac:|r Showing the characters of this realm only.")
  eq(names(), "Brakk,Yubi,anna")
  eq(f.total:GetText(), "5g 71s 00c", "the total adds up the characters shown")
  eq(f.totalPlayed:GetText(), "10d 0h")
  eq(f.filterInfo:GetText(), "1 hidden by the filter")
  f.realmCheck:Click()
  eq(AltAlmanacDB.settings.realmOnly, false)
  eq(wow.chat[2], "|cffffd100Alt Almanac:|r Showing the characters of all realms.")
  eq(names(), "Brakk,Lia-Argent Dawn,Yubi,anna")
end)

test("hide below level: the box takes a level, Enter applies it, wrong values are put back", function(wow)
  family(wow)
  local ns = boot(wow, { level = 20 }, 7000)
  wow.slash("/aa")
  local f = AltAlmanacFrame
  local box = f.levelBox
  eq(f.levelLabel:GetText(), "Hide below level")
  eq(box:GetText(), "")
  box:SetText("30")
  box.scripts.OnEnterPressed(box)
  eq(AltAlmanacDB.settings.minLevel, 30)
  eq(wow.chat[1], "|cffffd100Alt Almanac:|r Hiding characters below level 30.")
  eq(names(), "Brakk,Lia-Argent Dawn,Yubi", "anna (12) is hidden, Yubi (20) is you")
  eq(f.filterInfo:GetText(), "1 hidden by the filter")
  box.scripts.OnEditFocusLost(box)
  eq(#wow.chat, 1, "the same level again says nothing")
  box:SetText("500")
  box.scripts.OnEnterPressed(box)
  eq(box:GetText(), "30", "a level the filter cannot take puts the old one back")
  eq(AltAlmanacDB.settings.minLevel, 30)
  box:SetText("80")
  box.scripts.OnEscapePressed(box)
  eq(box:GetText(), "30", "Escape puts the old level back")
  box.scripts.OnEditFocusLost(box)
  eq(AltAlmanacDB.settings.minLevel, 30)
  box:SetText("")
  box.scripts.OnEnterPressed(box)
  eq(AltAlmanacDB.settings.minLevel, nil)
  eq(wow.chat[2], "|cffffd100Alt Almanac:|r Showing characters of every level.")
  eq(names(), "Brakk,Lia-Argent Dawn,Yubi,anna")
  box:SetText("0")
  box.scripts.OnEnterPressed(box)
  eq(#wow.chat, 2)
end)

test("/aa realm and /aa level set the filters from the chat", function(wow)
  family(wow)
  local ns = boot(wow, { level = 20 }, 7000)
  local P = "|cffffd100Alt Almanac:|r "
  wow.slash("/aa realm this")
  eq(AltAlmanacDB.settings.realmOnly, true)
  eq(wow.chat[1], P .. "Showing the characters of this realm only.")
  wow.slash("/aa REALM All")
  eq(AltAlmanacDB.settings.realmOnly, false)
  wow.slash("/aa level 70")
  eq(AltAlmanacDB.settings.minLevel, 70)
  eq(wow.chat[3], P .. "Hiding characters below level 70.")
  wow.slash("/aa")
  eq(names(), "Brakk,Yubi")
  eq(AltAlmanacFrame.levelBox:GetText(), "70")
  eq(AltAlmanacFrame.filterInfo:GetText(), "2 hidden by the filter")
  wow.slash("/aa level 101")
  eq(wow.chat[4], P .. "Use a whole number from 1 to 100, for example /aa level 70, or /aa level off.")
  eq(AltAlmanacDB.settings.minLevel, 70)
  wow.slash("/aa level off")
  eq(AltAlmanacDB.settings.minLevel, nil)
  eq(wow.chat[5], P .. "Showing characters of every level.")
  wow.slash("/aa level off")
  eq(wow.chat[6], P .. "Showing characters of every level.", "the chat always answers")
  wow.slash("/aa level 1")
  eq(AltAlmanacDB.settings.minLevel, nil, "level 1 and up is everyone")
  wow.slash("/aa realm")
  eq(wow.chat[#wow.chat]:match("^" .. P:gsub("%p", "%%%0") .. "Click a heading to sort") ~= nil, true, "without this or all: the help")
  eq(AltAlmanacFrame.levelBox:GetText(), "")
end)

test("with a filter the last row counts only the characters left after it", function(wow)
  AltAlmanacDB = { chars = {} }
  for i = 1, 20 do AltAlmanacDB.chars["Alt" .. string.format("%02d", i) .. "-Silvermoon"] = { level = i } end
  for i = 1, 5 do AltAlmanacDB.chars["Far" .. i .. "-Kazzak"] = { level = 60 + i } end
  local ns = boot(wow, { level = 70 })
  wow.slash("/aa realm this")
  wow.slash("/aa")
  eq(row(1).name, "|cff3fc7ebYubi|r")
  eq(row(2).name, "Alt20")
  eq(row(15).name, "|cff9d9d9dand 7 more|r")
  eq(AltAlmanacFrame.filterInfo:GetText(), "5 hidden by the filter")
  wow.slash("/aa level 10")
  eq(row(12).name, "Alt10")
  eq(row(13).name, "")
  eq(AltAlmanacFrame.filterInfo:GetText(), "14 hidden by the filter")
end)

test("saved data of 1.1 keeps everything and gets the old order, broken sort settings are replaced", function(wow)
  family(wow)
  AltAlmanacDB.settings = { point = { "TOP", "TOP", 0, -50 } }
  local ns = boot(wow, { level = 20 }, 7000)
  local s = AltAlmanacDB.settings
  eq(AltAlmanacDB.version, 3)
  eq(s.point[1], "TOP")
  eq(s.sortBy, "level")
  eq(s.sortReverse, false)
  eq(s.realmOnly, false)
  eq(s.minLevel, nil)
  eq(AltAlmanacDB.chars["Brakk-Silvermoon"].played, 10 * DAY)
  wow.slash("/aa")
  eq(names(), "Brakk,Lia-Argent Dawn,Yubi,anna")

  AltAlmanacDB.settings = { sortBy = "mood", sortReverse = "yes", realmOnly = 1, minLevel = 250 }
  wow.fire("PLAYER_LOGIN")
  s = AltAlmanacDB.settings
  eq(s.sortBy, "level")
  eq(s.sortReverse, false)
  eq(s.realmOnly, false)
  eq(s.minLevel, nil)
  AltAlmanacDB.settings = "broken"
  wow.fire("PLAYER_LOGIN")
  eq(type(AltAlmanacDB.settings), "table")
  AltAlmanacDB.settings = { sortBy = "seen", sortReverse = true, realmOnly = true, minLevel = 1 }
  wow.fire("PLAYER_LOGIN")
  eq(AltAlmanacDB.settings.sortBy, "seen")
  eq(AltAlmanacDB.settings.realmOnly, true)
  eq(AltAlmanacDB.settings.minLevel, nil)
end)
