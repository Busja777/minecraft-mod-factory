-- Tests for Chore List, run by tools/wow/client/run.lua.

-- The stand-in client has no server time and no reset timers; these model them. The game's resets
-- follow a fixed schedule: game.daily and game.weekly are the next reset times and move on by a
-- day or a week once they have passed, the way the real counters start over.
local STAND_IN = { "C_DateAndTime", "GetServerTime" }
local DAY, WEEK = 86400, 7 * 86400
local game

local function client(wow, g)
  game = { daily = wow.now + 3 * 3600, weekly = wow.now + 2 * DAY + 3 * 3600 }
  for k, v in pairs(g or {}) do game[k] = v end
  GetServerTime = function() return game.server or wow.now end
  if game.noTimers then C_DateAndTime = nil return end
  local function left(field, period)
    while game[field] <= wow.now do game[field] = game[field] + period end
    return game[field] - wow.now
  end
  C_DateAndTime = {
    GetSecondsUntilDailyReset = function() return game.dailyValue or left("daily", DAY) end,
    GetSecondsUntilWeeklyReset = function() return game.weeklyValue or left("weekly", WEEK) end,
  }
end

local function boot(wow, g)
  client(wow, g)
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("ADDON_LOADED", "ChoreList")
  wow.fire("PLAYER_LOGIN")
  return ns
end

-- Logs out: the addon's frame is gone. Time passes, then the next login hands back the saved data.
local function relog(wow, ns, away)
  local saved = ChoreListCharDB
  ns.eventFrame.events, ns.eventFrame.scripts = {}, {}
  wow.now = wow.now + (away or 0)
  ns = wow.load(ADDON_DIR, ADDON_NAME)
  ChoreListCharDB = saved
  wow.fire("PLAYER_LOGIN")
  return ns
end

-- Lets seconds pass in steps of ten, the way the game calls OnUpdate every frame.
local function pass(wow, ns, seconds)
  for _ = 1, math.floor(seconds / 10) do
    wow.now = wow.now + 10
    wow.clock = wow.clock + 10
    ns.eventFrame.scripts.OnUpdate(ns.eventFrame, 10)
  end
end

local function last(wow) return wow.chat[#wow.chat] end
local PREFIX = "|cffffd100Chore List:|r "

local function texts(list)
  local out = {}
  for i, task in ipairs(list) do out[i] = (task.done and "x " or "- ") .. task.text end
  return table.concat(out, ", ")
end

test("addon defines only its own globals", function(wow, installed, before)
  local ns = boot(wow)
  wow.slash("/chores add daily Feed the pet")
  wow.slash("/chores add weekly Raid")
  wow.slash("/chores")
  ChoreListFrame.rows[1].check:Click()
  ChoreListFrame.rows[2].remove:Click()
  wow.slash("/chores done daily 1")
  wow.slash("/chores remove daily 1")
  wow.slash("/chores list")
  wow.slash("/chores help")
  pass(wow, ns, 4 * 3600)
  local allowed = { ChoreListCharDB = true, ChoreListFrame = true, SLASH_CHORELIST1 = true, SLASH_CHORELIST2 = true }
  for _, name in ipairs(STAND_IN) do installed[name] = true end
  for k in pairs(_G) do
    if not before[k] and not installed[k] and not allowed[k] then error("unexpected global " .. tostring(k)) end
  end
end)

test("/chores and /chorelist are registered, no short alias", function(wow)
  boot(wow)
  eq(SLASH_CHORELIST1, "/chores")
  eq(SLASH_CHORELIST2, "/chorelist")
  eq(SLASH_CHORELIST3, nil)
  wow.slash("/chorelist")
  eq(ChoreListFrame:IsShown(), true)
  wow.slash("/chores")
  eq(ChoreListFrame:IsShown(), false)
  eq(UISpecialFrames[1], "ChoreListFrame", "Escape closes the window")
end)

test("task texts: no escape codes, no line breaks, cut at 100 characters on a whole letter", function(wow)
  local ns = boot(wow)
  eq(ns.CleanText("  Feed   the pet "), "Feed the pet")
  eq(ns.CleanText("|cffff0000Red|r text"), "cffff0000Redr text")
  eq(ns.CleanText("two\nlines\tand tab"), "two lines and tab")
  eq(ns.CleanText("   "), nil)
  eq(ns.CleanText(nil), nil)
  eq(#ns.CleanText(string.rep("a", 150)), 100)
  local umlauts = string.rep("a", 99) .. "\195\164" -- "ä" would end at byte 101
  eq(ns.CleanText(umlauts), string.rep("a", 99), "never half a letter")
  eq(ns.CleanText(string.rep("a", 99) .. " b"), string.rep("a", 99), "no trailing space after the cut")
end)

test("list names: daily and weekly, any case, day and week too", function(wow)
  local ns = boot(wow)
  eq(ns.ParseKind("daily"), "daily")
  eq(ns.ParseKind("DAILY"), "daily")
  eq(ns.ParseKind("day"), "daily")
  eq(ns.ParseKind("Weekly"), "weekly")
  eq(ns.ParseKind("week"), "weekly")
  eq(ns.ParseKind("monthly"), nil)
  eq(ns.ParseKind(nil), nil)
end)

test("/chores add puts tasks on the character's lists", function(wow)
  local ns = boot(wow)
  wow.slash("/chores add daily Feed the pet")
  eq(last(wow), PREFIX .. "Added to your daily chores: Feed the pet")
  wow.slash("/chores add WEEKLY World boss")
  eq(last(wow), PREFIX .. "Added to your weekly chores: World boss")
  wow.slash("/chores add day Check the mail")
  eq(texts(ChoreListCharDB.daily), "- Feed the pet, - Check the mail")
  eq(texts(ChoreListCharDB.weekly), "- World boss")
  eq(ns.db, ChoreListCharDB)
end)

test("limits: 30 tasks per list, no duplicates, no empty task, unknown list shows the help", function(wow)
  local ns = boot(wow)
  for i = 1, 30 do wow.slash("/chores add daily Task " .. i) end
  eq(#ChoreListCharDB.daily, 30)
  wow.slash("/chores add daily Task 31")
  eq(#ChoreListCharDB.daily, 30)
  eq(last(wow), PREFIX .. "Your daily list is full (30 tasks).")
  wow.slash("/chores add weekly Raid")
  wow.slash("/chores add weekly raid")
  eq(last(wow), PREFIX .. "That task is already on the list.")
  wow.slash("/chores add weekly    ")
  eq(last(wow), PREFIX .. "Write the task after the list, for example /chores add daily Feed the pet.")
  wow.slash("/chores add monthly Rent")
  eq(last(wow):find("/chores opens the list", 1, true) ~= nil, true, "help")
  eq(#ChoreListCharDB.weekly, 1)
  local list = {}
  eq(ns.AddTask(list, string.rep("x", 140)).text, string.rep("x", 100))
  for i = 1, 29 do ns.AddTask(list, "w" .. i) end
  local task, why = ns.AddTask(list, "one more")
  eq(task, nil)
  eq(why, "full")
  eq(ns.AddFailText("full", "weekly"), "Your weekly list is full (30 tasks).")
end)

test("/chores done ticks a task off and on, /chores remove removes it, wrong numbers do nothing", function(wow)
  boot(wow)
  wow.slash("/chores add daily A")
  wow.slash("/chores add daily B")
  wow.slash("/chores add weekly C")
  wow.slash("/chores done daily 2")
  eq(last(wow), PREFIX .. "Done: B")
  eq(texts(ChoreListCharDB.daily), "- A, x B")
  wow.slash("/chores done daily 2")
  eq(last(wow), PREFIX .. "Open again: B")
  eq(texts(ChoreListCharDB.daily), "- A, - B")
  for _, bad in ipairs({ "daily 0", "daily 3", "daily x", "daily 1.5", "daily", "monthly 1", "" }) do
    wow.slash("/chores done " .. bad)
    eq(last(wow), PREFIX .. "No such task. /chores list shows the numbers.", bad)
    wow.slash("/chores remove " .. bad)
    eq(last(wow), PREFIX .. "No such task. /chores list shows the numbers.", bad)
  end
  wow.slash("/chores remove daily 1")
  eq(last(wow), PREFIX .. "Removed: A")
  eq(texts(ChoreListCharDB.daily), "- B")
  eq(texts(ChoreListCharDB.weekly), "- C")
end)

test("/chores list shows both lists with numbers in chat", function(wow)
  boot(wow)
  wow.slash("/chores add daily A")
  wow.slash("/chores add daily B")
  wow.slash("/chores done daily 2")
  local before = #wow.chat
  wow.slash("/chores list")
  eq(#wow.chat, before + 4)
  eq(wow.chat[before + 1], PREFIX .. "Daily chores: 1 of 2 done.")
  eq(wow.chat[before + 2], PREFIX .. "1. A")
  eq(wow.chat[before + 3], PREFIX .. "2. [done] B")
  eq(wow.chat[before + 4], PREFIX .. "Weekly chores: 0 of 0 done.")
end)

test("broken saved data is repaired, more than 30 tasks are cut", function(wow)
  local daily = { { text = "Fine", done = true }, { text = 42 }, "junk", { text = "  " }, { text = "Not done", done = "yes" } }
  local weekly = {}
  for i = 1, 35 do weekly[i] = { text = "W" .. i } end
  ChoreListCharDB = { daily = daily, weekly = weekly, due = { daily = "soon", weekly = 5 }, last = 7, point = "here" }
  local ns = boot(wow)
  eq(texts(ChoreListCharDB.daily), "x Fine, - Not done")
  eq(#ChoreListCharDB.weekly, 30)
  eq(ChoreListCharDB.version, 1)
  eq(type(ChoreListCharDB.last), "table")
  eq(ChoreListCharDB.point, nil)
  eq(ChoreListCharDB.due.daily, game.daily, "a broken due time is read again from the game")
  local fresh = ns.Normalize(nil)
  eq(#fresh.daily, 0)
  eq(#fresh.weekly, 0)
end)

test("the reset check: records the next reset, fires once when it has passed", function(wow)
  local ns = boot(wow)
  local db = ns.Normalize({})
  eq(ns.CheckReset(db, "daily", 1000, 500), false, "nothing known yet")
  eq(db.due.daily, 1500)
  eq(ns.CheckReset(db, "daily", 1490, 10), false)
  eq(db.due.daily, 1500)
  eq(ns.CheckReset(db, "daily", 1500, 86400), true, "the reset itself")
  eq(db.due.daily, 87900)
  eq(db.last.daily, 1500)
  eq(ns.CheckReset(db, "daily", 1510, 86390), false, "only once")
  -- Without a reading from the game the known reset still fires, and nothing new is guessed.
  eq(ns.CheckReset(db, "daily", 90000, nil), true)
  eq(db.due.daily, nil)
  eq(ns.CheckReset(db, "daily", 90010, nil), false)
  -- Long offline: several resets passed, the list is cleared once.
  db.due.weekly = 100
  eq(ns.CheckReset(db, "weekly", 100 + 5 * WEEK, 3 * DAY), true)
  eq(ns.CheckReset(db, "weekly", 110 + 5 * WEEK, 3 * DAY - 10), false)
end)

test("a reset read a moment late does not clear the list twice", function(wow)
  local ns = boot(wow)
  local db = ns.Normalize({})
  ns.CheckReset(db, "daily", 1000, 498) -- due 1498, two seconds before the game resets
  eq(ns.CheckReset(db, "daily", 1498, 2), true)
  eq(db.due.daily, nil, "the game still counts to the same reset: ignored")
  eq(ns.CheckReset(db, "daily", 1499, 1), false)
  eq(ns.CheckReset(db, "daily", 1500, 0), false, "zero seconds left is no reading")
  eq(ns.CheckReset(db, "daily", 1510, 86390), false)
  eq(db.due.daily, 87900)
end)

test("the daily reset while playing unchecks the daily list only, with one line in chat", function(wow)
  local ns = boot(wow)
  wow.slash("/chores add daily A")
  wow.slash("/chores add daily B")
  wow.slash("/chores add weekly C")
  wow.slash("/chores done daily 1")
  wow.slash("/chores done weekly 1")
  local before = #wow.chat
  pass(wow, ns, 3 * 3600 - 20)
  eq(texts(ChoreListCharDB.daily), "x A, - B", "not yet")
  pass(wow, ns, 30)
  eq(texts(ChoreListCharDB.daily), "- A, - B")
  eq(texts(ChoreListCharDB.weekly), "x C")
  eq(#wow.chat, before + 1)
  eq(last(wow), PREFIX .. "Daily reset: your daily chores are open again.")
  wow.slash("/chores done daily 2")
  pass(wow, ns, 3600)
  eq(texts(ChoreListCharDB.daily), "- A, x B", "ticked after the reset stays ticked")
  -- A reset with nothing ticked says nothing.
  wow.slash("/chores done daily 2")
  before = #wow.chat
  pass(wow, ns, DAY)
  eq(#wow.chat, before)
end)

test("the weekly reset unchecks the weekly list", function(wow)
  local ns = boot(wow)
  wow.slash("/chores add weekly Raid")
  wow.slash("/chores add weekly Delves")
  wow.slash("/chores done weekly 1")
  wow.slash("/chores done weekly 2")
  pass(wow, ns, 2 * DAY + 3 * 3600 - 20)
  eq(texts(ChoreListCharDB.weekly), "x Raid, x Delves")
  pass(wow, ns, 30)
  eq(texts(ChoreListCharDB.weekly), "- Raid, - Delves")
  eq(last(wow), PREFIX .. "Weekly reset: your weekly chores are open again.")
  eq(ChoreListCharDB.due.weekly, game.weekly)
end)

test("a reset that came while logged out is found at the next login", function(wow)
  local ns = boot(wow)
  wow.slash("/chores add daily A")
  wow.slash("/chores add weekly B")
  wow.slash("/chores done daily 1")
  wow.slash("/chores done weekly 1")
  ns = relog(wow, ns, 5 * 3600) -- past the daily reset, before the weekly one
  eq(texts(ChoreListCharDB.daily), "- A")
  eq(texts(ChoreListCharDB.weekly), "x B")
  eq(last(wow), PREFIX .. "The daily reset came while you were away: your daily chores are open again.")
  wow.slash("/chores done daily 1")
  ns = relog(wow, ns, 3 * WEEK) -- three weeks away
  eq(texts(ChoreListCharDB.daily), "- A")
  eq(texts(ChoreListCharDB.weekly), "- B")
  eq(last(wow), PREFIX .. "The weekly reset came while you were away: your weekly chores are open again.")
end)

test("/reload before the reset keeps every tick", function(wow)
  local ns = boot(wow)
  wow.slash("/chores add daily A")
  wow.slash("/chores done daily 1")
  local before = #wow.chat
  ns = relog(wow, ns, 60)
  eq(texts(ChoreListCharDB.daily), "x A")
  eq(#wow.chat, before)
  eq(ns.db, ChoreListCharDB)
end)

test("without reset timers, server time or with secret values nothing is unchecked", function(wow)
  ChoreListCharDB = { daily = { { text = "A", done = true } }, due = { daily = wow.now - 10 } }
  local ns = boot(wow, { noTimers = true })
  -- The reset known from last time still counts: it passed while offline.
  eq(texts(ChoreListCharDB.daily), "- A")
  wow.slash("/chores done daily 1")
  pass(wow, ns, 2 * DAY)
  eq(texts(ChoreListCharDB.daily), "x A", "nothing new is known, nothing is guessed")
  eq(ns.HeadingInfo("daily"), "1/1")
  ns.eventFrame.events, ns.eventFrame.scripts = {}, {}
  ChoreListCharDB = { daily = { { text = "A", done = true } }, due = { daily = wow.now - 10 } }
  ns = boot(wow, { server = { secret = true } })
  eq(texts(ChoreListCharDB.daily), "x A", "secret server time: no check")
  pass(wow, ns, 60)
  eq(texts(ChoreListCharDB.daily), "x A")
  game.server = nil
  game.dailyValue = { secret = true }
  game.weeklyValue = -5
  eq(ns.SecondsLeft("daily"), nil)
  eq(ns.SecondsLeft("weekly"), nil)
  pass(wow, ns, 10)
  eq(texts(ChoreListCharDB.daily), "- A", "the known reset from last time")
  eq(ChoreListCharDB.due.daily, nil)
end)

test("time left reads short", function(wow)
  local ns = boot(wow)
  eq(ns.FormatLeft(nil), nil)
  eq(ns.FormatLeft(0), "1m")
  eq(ns.FormatLeft(59), "1m")
  eq(ns.FormatLeft(125), "2m")
  eq(ns.FormatLeft(3 * 3600 + 12 * 60 + 59), "3h 12m")
  eq(ns.FormatLeft(2 * DAY + 5 * 3600), "2d 5h")
end)

test("the window lists both kinds with checkboxes, ticks and removes tasks", function(wow)
  local ns = boot(wow)
  wow.slash("/chores")
  local f = ChoreListFrame
  eq(f.title:GetText(), "Chore List")
  eq(f.headings.daily.label:GetText(), "Daily")
  eq(f.headings.weekly.label:GetText(), "Weekly")
  eq(f.headings.daily.empty:IsShown(), true)
  eq(f.headings.daily.empty:GetText(), "Nothing on this list yet.")
  eq(f.headings.daily.info:GetText(), "|cff9d9d9dresets in 3h 0m|r")
  eq(f.headings.weekly.info:GetText(), "|cff9d9d9dresets in 2d 3h|r")
  wow.slash("/chores add daily Feed the pet")
  wow.slash("/chores add daily Check the mail")
  wow.slash("/chores add weekly Raid")
  eq(f.headings.daily.empty:IsShown(), false)
  eq(f.headings.weekly.empty:IsShown(), false)
  eq(#f.rows, 3)
  eq(f.rows[1].label:GetText(), "Feed the pet")
  eq(f.rows[3].label:GetText(), "Raid")
  eq(f.rows[3].kind, "weekly")
  f.rows[2].check:Click()
  eq(texts(ChoreListCharDB.daily), "- Feed the pet, x Check the mail")
  eq(f.rows[2].label:GetText(), "|cff9d9d9dCheck the mail|r", "done tasks are grey")
  eq(f.headings.daily.info:GetText(), "|cff9d9d9d1/2, resets in 3h 0m|r")
  f.rows[1].remove:Click()
  eq(texts(ChoreListCharDB.daily), "x Check the mail")
  eq(f.rows[1].label:GetText(), "|cff9d9d9dCheck the mail|r")
  eq(f.rows[2].label:GetText(), "Raid")
  eq(f.rows[3].label:IsShown(), false, "the spare row is hidden")
  eq(f.rows[3].check:IsShown(), false)
  -- The reset shows in the open window without reopening it.
  pass(wow, ns, 3 * 3600 + 10)
  eq(f.rows[1].label:GetText(), "Check the mail")
  eq(f.headings.daily.info:GetText(), "|cff9d9d9d0/1, resets in 23h 59m|r")
end)

test("the window remembers its place for this character", function(wow)
  local ns = boot(wow)
  wow.slash("/chores")
  local f = ChoreListFrame
  f:SetPoint("TOPLEFT", 100, -50)
  f.scripts.OnDragStop(f)
  eq(ChoreListCharDB.point[1], "TOPLEFT")
  eq(ChoreListCharDB.point[3], 100)
  eq(ChoreListCharDB.point[4], -50)
  ns = relog(wow, ns, 60)
  wow.slash("/chores")
  eq(ChoreListFrame.point[1], "TOPLEFT")
  eq(ChoreListFrame.point[2], UIParent)
  eq(ChoreListFrame.point[4], 100)
end)

test("slash commands before login do nothing, unknown words show the help", function(wow)
  client(wow)
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.slash("/chores add daily A")
  wow.slash("/chores")
  eq(#wow.chat, 0)
  eq(ChoreListFrame, nil)
  wow.fire("PLAYER_LOGIN")
  wow.slash("/chores what")
  eq(last(wow), PREFIX .. "/chores opens the list, /chores add daily Feed the pet adds a task (or weekly), /chores done daily 2 ticks a task off, /chores remove weekly 1 removes one, /chores list shows both lists in chat.")
  eq(last(wow):find("|", #PREFIX + 1, true), nil, "help texts never use a pipe")
  eq(ns.db ~= nil, true)
end)
