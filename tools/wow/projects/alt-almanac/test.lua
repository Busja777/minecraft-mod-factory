-- Tests for Alt Almanac, run by tools/wow/client/run.lua.

-- The stand-in client has no XP bar, zones or resting; these are the game functions the addon reads.
local STAND_IN = {
  "UnitLevel", "UnitXPMax", "GetXPExhaustion", "IsPlayerAtEffectiveMaxLevel",
  "IsResting", "GetRealZoneText", "GetSubZoneText",
}
local player

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
end

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
  }
end

local HOUR = 3600

test("addon defines only its own globals", function(wow, installed, before)
  boot(wow)
  wow.slash("/aa") -- creates the window
  local allowed = { AltAlmanacDB = true, AltAlmanacFrame = true, SLASH_ALTALMANAC1 = true, SLASH_ALTALMANAC2 = true }
  for _, name in ipairs(STAND_IN) do installed[name] = true end
  for k in pairs(_G) do
    if not before[k] and not installed[k] and not allowed[k] then error("unexpected global " .. tostring(k)) end
  end
end)

test("login stores the whole character", function(wow)
  local ns = boot(wow, { level = 42, max = 20000, rested = 9000, resting = true }, 123456)
  local c = me()
  eq(AltAlmanacDB.version, 1)
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
  eq(f.totalLabel:GetText(), "Total gold")
  eq(f.total:GetText(), "502g 12s 34c")
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
  eq(#wow.chat, 2)
  eq(wow.chat[1]:match("/aa forget Name%-Realm removes a character") ~= nil, true)
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
  wow.slash("/aa")
  wow.slash("/aa forget Brakk-Silvermoon")
  eq(AltAlmanacFrame, nil)
  eq(AltAlmanacDB, nil)
  eq(#wow.chat, 0)
end)
