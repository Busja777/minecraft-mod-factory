-- luajit test/run.lua <addon folder>   (run from tools/wow/gold-diary, or through npm test)
local here = arg[0]:match("^(.*)/[^/]*$") or "."
local dir = arg[1] or (here .. "/../src/GoldDiary")

local passed, failed = 0, 0
local function test(name, fn)
  local fresh = dofile(here .. "/wow.lua") -- every test gets a fresh client
  local before = {}
  for k in pairs(_G) do before[k] = true end
  fresh.install()
  local installed = {}
  for k in pairs(_G) do if not before[k] then installed[k] = true end end
  GoldDiaryDB = nil
  local ok, err = pcall(fn, fresh, installed, before)
  for k in pairs(_G) do if not before[k] then _G[k] = nil end end
  if ok then passed = passed + 1 else failed = failed + 1; print("FAIL " .. name .. "\n  " .. tostring(err)) end
end

local function eq(a, b, msg)
  if a ~= b then error((msg or "") .. " expected " .. tostring(b) .. ", got " .. tostring(a), 2) end
end

local function boot(wow, money)
  local ns = wow.load(dir, "GoldDiary")
  wow.money = money or 0
  wow.fire("ADDON_LOADED", "GoldDiary")
  wow.fire("PLAYER_LOGIN")
  return ns
end

local function today(ns) return ns.char.days[ns.DayKey(time())] end

test("addon defines only its own globals", function(wow, installed, before)
  boot(wow, 100)
  wow.slash("/gd") -- creates the window
  local allowed = { GoldDiaryDB = true, GoldDiaryFrame = true, SLASH_GOLDDIARY1 = true, SLASH_GOLDDIARY2 = true, GoldDiary_OnAddonCompartmentClick = true, GoldDiary_OnAddonCompartmentEnter = true, GoldDiary_OnAddonCompartmentLeave = true }
  for k in pairs(_G) do
    if not before[k] and not installed[k] and not allowed[k] then error("unexpected global " .. tostring(k)) end
  end
end)

test("login records the character and its gold", function(wow)
  local ns = boot(wow, 12345)
  local char = GoldDiaryDB.chars["Yubi-Silvermoon"]
  eq(char.money, 12345)
  eq(char.class, "MAGE")
  eq(ns.char, char)
end)

test("selling and buying at a vendor", function(wow)
  local ns = boot(wow, 1000)
  wow.fire("MERCHANT_SHOW")
  wow.setMoney(1500)
  wow.setMoney(1300)
  wow.fire("MERCHANT_CLOSED")
  eq(ns.session.bucket.inc.vendor, 500)
  eq(ns.session.bucket.out.vendor, 200)
  eq(today(ns).inc.vendor, 500)
  eq(GoldDiaryDB.chars["Yubi-Silvermoon"].money, 1300)
end)

test("the newer interaction events work as well", function(wow)
  local ns = boot(wow, 1000)
  wow.fire("PLAYER_INTERACTION_MANAGER_FRAME_SHOW", 17) -- mailbox
  wow.setMoney(5000)
  wow.fire("PLAYER_INTERACTION_MANAGER_FRAME_HIDE", 17)
  eq(ns.session.bucket.inc.mail, 4000)
  wow.clock = wow.clock + 5
  wow.fire("PLAYER_INTERACTION_MANAGER_FRAME_SHOW", 999) -- unknown window
  wow.setMoney(4000)
  eq(ns.session.bucket.out.other, 1000)
end)

test("a window closed a moment ago still explains the change", function(wow)
  local ns = boot(wow, 50000)
  wow.fire("TAXIMAP_OPENED")
  wow.fire("TAXIMAP_CLOSED")
  wow.clock = wow.clock + 0.5
  wow.setMoney(49000)
  eq(ns.session.bucket.out.travel, 1000)
  wow.clock = wow.clock + 10
  wow.setMoney(48000)
  eq(ns.session.bucket.out.other, 1000)
end)

test("repairs are told apart from vendor purchases, guild repairs are not booked", function(wow)
  local ns = boot(wow, 100000)
  wow.fire("MERCHANT_SHOW")
  RepairAllItems()
  wow.setMoney(90000)
  wow.setMoney(89000)
  eq(ns.session.bucket.out.repairs, 10000)
  eq(ns.session.bucket.out.vendor, 1000)
  RepairAllItems(true)
  wow.setMoney(88000)
  eq(ns.session.bucket.out.vendor, 2000)
end)

test("quest rewards, before or after the turn-in event", function(wow)
  local ns = boot(wow, 0)
  wow.fire("QUEST_TURNED_IN", 123, 500, 2500)
  wow.setMoney(2500)
  eq(ns.session.bucket.inc.quests, 2500)
  wow.fire("LOOT_OPENED")
  wow.setMoney(3000) -- loot
  wow.setMoney(4000) -- a world quest pays while the loot window is still open
  wow.fire("LOOT_CLOSED")
  wow.fire("QUEST_TURNED_IN", 124, 0, 1000)
  eq(ns.session.bucket.inc.loot, 500)
  eq(ns.session.bucket.inc.quests, 3500)
  eq(today(ns).inc.quests, 3500)
  eq(today(ns).inc.loot, 500)
end)

test("bank transfers are neither earned nor spent", function(wow)
  local ns = boot(wow, 100000)
  wow.fire("BANKFRAME_OPENED")
  wow.setMoney(20000)
  wow.fire("BANKFRAME_CLOSED")
  local t = ns.Totals(ns.session.bucket)
  eq(t.income, 0)
  eq(t.expense, 0)
  eq(t.net, 0)
  eq(t.moved, -80000)
end)

test("secret values are ignored", function(wow)
  local ns = boot(wow, 100)
  wow.money = { secret = true }
  wow.fire("PLAYER_MONEY")
  wow.setMoney(300)
  eq(ns.session.bucket.inc.other, 200)
end)

test("days add up, old days are pruned", function(wow)
  local ns = boot(wow, 0)
  local days = ns.char.days
  local function bucket(inc) local b = ns.NewBucket(); b.inc.loot = inc; return b end
  days[ns.DayKey(time(), 0)] = bucket(1)
  days[ns.DayKey(time(), 3)] = bucket(10)
  days[ns.DayKey(time(), 6)] = bucket(100)
  days[ns.DayKey(time(), 7)] = bucket(1000)
  days[ns.DayKey(time(), 59)] = bucket(1)
  days[ns.DayKey(time(), 60)] = bucket(1)
  eq(ns.LastDays(days, 1, time()).inc.loot, 1)
  eq(ns.LastDays(days, 7, time()).inc.loot, 111)
  ns.Prune(days, time())
  eq(days[ns.DayKey(time(), 59)] ~= nil, true, "day 59 kept")
  eq(days[ns.DayKey(time(), 60)], nil, "day 60 pruned")
  eq(ns.DayKey(os.time({ year = 2026, month = 3, day = 30, hour = 1 }), 1), "2026-03-29", "across daylight saving")
  eq(ns.DayKey(os.time({ year = 2026, month = 1, day = 1, hour = 9 }), 1), "2025-12-31", "across new year")
end)

test("money texts", function(wow)
  local ns = boot(wow, 0)
  eq(ns.PlainMoney(0), "0c")
  eq(ns.PlainMoney(5), "5c")
  eq(ns.PlainMoney(1205), "12s 05c")
  eq(ns.PlainMoney(123456789), "12,345g 67s 89c")
  eq(ns.PlainMoney(-10000), "-1g 00s 00c")
  eq(ns.PerHour(1000, 30), nil)
  eq(ns.PerHour(1000, 1800), 2000)
end)

test("the window opens, switches period, shows rows and totals", function(wow)
  local ns = boot(wow, 1000)
  wow.fire("MERCHANT_SHOW")
  wow.setMoney(3000)
  wow.slash("/gd")
  local f = GoldDiaryFrame
  eq(f:IsShown(), true)
  eq(UISpecialFrames[1], "GoldDiaryFrame")
  eq(f.rows[1].label:GetText(), "Vendor")
  eq(f.rows[2].label:GetText(), "")
  eq(f.tabs.session:IsEnabled(), false)
  eq(f.empty:IsShown(), false)
  eq(f.summary[3].left:GetText(), "Net")
  eq(f.summary[3].right:GetText(), "|cff40ff4020s 00c|r")
  f.tabs.week:Click()
  eq(f.tabs.week:IsEnabled(), false)
  eq(f.rows[1].label:GetText(), "Vendor")
  wow.slash("/gd reset")
  f.tabs.session:Click()
  eq(f.empty:IsShown(), true)
  eq(#wow.chat, 1)
  f.scripts.OnDragStop(f)
  eq(GoldDiaryDB.settings.point[1], "CENTER")
  wow.slash("/gd")
  eq(f:IsShown(), false)
  wow.slash("/gd help")
  eq(#wow.chat, 2)
end)

test("characters overview: richest first, class colours, total", function(wow)
  GoldDiaryDB = { chars = {
    ["Brakk-Silvermoon"] = { class = "WARRIOR", money = 500000, days = {} },
    ["Old-Argent Dawn"] = { money = 10, days = {} },
  } }
  local ns = boot(wow, 20000)
  local list, total = ns.CharacterList(GoldDiaryDB.chars)
  eq(#list, 3)
  eq(list[1].name, "Brakk")
  eq(list[3].realm, "Argent Dawn")
  eq(total, 520010)
  wow.slash("/gd")
  local f = GoldDiaryFrame
  f.tabs.chars:Click()
  eq(f.head:GetText(), "Character")
  eq(f.rows[1].label:GetText(), "|cffc69b6dBrakk|r")
  eq(f.rows[2].label:GetText(), "|cff3fc7ebYubi|r *")
  eq(f.rows[3].label:GetText(), "Old")
  eq(f.rows[1].out:GetText(), "50g 00s 00c")
  eq(f.summary[1].right:GetText(), "52g 00s 10c")
  eq(f.summary[2].right:GetText(), "3")
  f.tabs.today:Click()
  eq(f.head:GetText(), "Source")
end)

test("many characters: the last row counts the rest", function(wow)
  GoldDiaryDB = { chars = {} }
  for i = 1, 20 do GoldDiaryDB.chars["Alt" .. i .. "-Realm"] = { money = i, days = {} } end
  local ns = boot(wow, 0)
  wow.slash("/gd")
  GoldDiaryFrame.tabs.chars:Click()
  local rows = GoldDiaryFrame.rows
  eq(rows[1].label:GetText(), "Alt20")
  eq(rows[#rows].label:GetText(), "|cff9d9d9dand 9 more|r")
end)

test("/gd forget removes another character, never the current one", function(wow)
  GoldDiaryDB = { chars = { ["Brakk-Silvermoon"] = { money = 5, days = {} } } }
  local ns = boot(wow, 0)
  wow.slash("/gd forget brakk-silvermoon")
  eq(GoldDiaryDB.chars["Brakk-Silvermoon"], nil)
  wow.slash("/gd forget Yubi-Silvermoon")
  eq(GoldDiaryDB.chars["Yubi-Silvermoon"] ~= nil, true)
  wow.slash("/gd forget Nobody-Realm")
  eq(#wow.chat, 3)
  eq(wow.chat[3]:match("No character called Nobody%-Realm") ~= nil, true)
end)

test("history: one row per day, today first, best day and average", function(wow)
  local ns = boot(wow, 0)
  local days = ns.char.days
  local function day(inc, out) local b = ns.NewBucket(); b.inc.loot = inc; b.out.vendor = out; return b end
  days[ns.DayKey(time(), 0)] = day(1000, 0)
  days[ns.DayKey(time(), 2)] = day(50000, 10000)
  days[ns.DayKey(time(), 20)] = day(99999999, 0) -- older than the view
  local list, totals, best, active = ns.History(days, 13, time())
  eq(#list, 13)
  eq(list[1].income, 1000)
  eq(list[2].income, 0)
  eq(totals.net, 41000)
  eq(best.key, ns.DayKey(time(), 2))
  eq(active, 2)
  wow.slash("/gd")
  GoldDiaryFrame.tabs.history:Click()
  local f = GoldDiaryFrame
  eq(f.head:GetText(), "Day")
  eq(f.rows[1].label:GetText(), "Today")
  eq(f.rows[2].label:GetText(), "Thu, Nov 19")
  eq(f.rows[3].inc:GetText(), "|cff40ff405g 00s 00c|r")
  eq(f.rows[2].inc:GetText(), "|cff9d9d9d-|r")
  eq(f.summary[2].right:GetText(), "|cff40ff402g 05s 00c|r")
  eq(f.summary[3].right:GetText(), "Wed, Nov 18  |cff40ff404g 00s 00c|r")
end)

test("addon menu entry opens the window and shows today in the tooltip", function(wow)
  local ns = boot(wow, 0)
  wow.setMoney(2500)
  GoldDiary_OnAddonCompartmentEnter("GoldDiary", "button")
  eq(wow.tooltip.shown, true)
  eq(wow.tooltip.owner, "button")
  eq(wow.tooltip.lines[2], "Today = |cff40ff4025s 00c|r")
  GoldDiary_OnAddonCompartmentLeave()
  eq(wow.tooltip.shown, false)
  GoldDiary_OnAddonCompartmentClick()
  eq(GoldDiaryFrame:IsShown(), true)
end)

test("German client: labels, dates and help are translated", function(wow)
  wow.locale = "deDE"
  local ns = boot(wow, 1000)
  wow.fire("MERCHANT_SHOW")
  wow.setMoney(3000)
  wow.slash("/gd")
  local f = GoldDiaryFrame
  eq(f.rows[1].label:GetText(), "Händler")
  eq(f.tabs.week:GetText(), "7 Tage")
  f.tabs.history:Click()
  eq(f.rows[2].label:GetText(), "19.11.")
  wow.slash("/gd hilfe")
  eq(wow.chat[1]:match("/gd report zeigt die Bilanz") ~= nil, true)
end)

test("/gd report prints today and the session to chat", function(wow)
  local ns = boot(wow, 10000)
  wow.fire("MERCHANT_SHOW")
  wow.setMoney(15000)
  wow.setMoney(14000)
  wow.slash("/gd report")
  eq(#wow.chat, 2)
  eq(wow.chat[1]:match("Today: earned 50s 00c, spent 10s 00c, net 40s 00c%.") ~= nil, true)
  eq(wow.chat[2]:match("This session: net 40s 00c%.") ~= nil, true)
end)

print(string.format("%d passed, %d failed", passed, failed))
os.exit(failed == 0 and 0 or 1)
