-- Tests for Screenshot Moments, run by tools/wow/client/run.lua.

-- The stand-in client has no timers, screenshots, achievements, items or loot texts; these are the
-- game functions and GlobalStrings the addon reads.
local STAND_IN = { "C_Timer", "Screenshot", "GetAchievementInfo", "C_Item", "GetItemInfo", "LOOT_ITEM_SELF", "LOOT_ITEM_SELF_MULTIPLE" }
local game

local EPIC_LINK = "|cnIQ4:|Hitem:212395::::::::80:::::|h[Fang of the Deep]|h|r"
local RARE_LINK = "|cff0070dd|Hitem:190001::::::::80:::::|h[Plain Blade]|h|r"
local LEGENDARY_LINK = "|cffff8000|Hitem:19019::::::::80:::::|h[Thunderfury]|h|r"
local UNCACHED_LINK = "|cnIQ4:|Hitem:999999::::::::80:::::|h[Unknown Thing]|h|r"

local function client(g)
  game = {
    timers = {}, shots = 0, fail = false,
    achievements = { [6] = "Level 10", [46] = "Explore Elwynn Forest" },
    quality = { [212395] = 4, [190001] = 3, [19019] = 5 },
    infoQuality = {}, -- items only C_Item.GetItemInfo knows
  }
  for k, v in pairs(g or {}) do game[k] = v end
  C_Timer = { After = function(seconds, fn) table.insert(game.timers, { seconds = seconds, fn = fn }) end }
  Screenshot = function()
    if game.fail then error("no screenshot") end
    game.shots = game.shots + 1
  end
  GetAchievementInfo = function(id)
    if game.achievements[id] == nil then return nil end
    return id, game.achievements[id], 10, true
  end
  local function id(link) return tonumber(tostring(link):match("item:(%d+)")) end
  C_Item = {
    GetItemQualityByID = function(link) return game.quality[id(link)] end,
    GetItemInfo = function(link)
      local q = game.infoQuality[id(link)]
      if q == nil then return nil end
      return "Name", link, q
    end,
  }
  LOOT_ITEM_SELF = game.lootSelf or "You receive loot: %s"
  LOOT_ITEM_SELF_MULTIPLE = game.lootSelfMultiple or "You receive loot: %sx%d"
end

local function boot(wow, g, saved)
  client(g)
  ScreenshotMomentsDB = saved
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("ADDON_LOADED", "ScreenshotMoments")
  wow.fire("PLAYER_LOGIN")
  return ns
end

-- Lets the planned timers run, then the game answers the screenshot.
local function settle(wow, answer)
  local timers = game.timers
  game.timers = {}
  for _, t in ipairs(timers) do t.fn() end
  if answer ~= false then wow.fire(answer or "SCREENSHOT_SUCCEEDED") end
end

local function later(wow, seconds) wow.clock = wow.clock + seconds end
local function lastChat(wow) return wow.chat[#wow.chat] end
local function has(text, part) return text ~= nil and text:find(part, 1, true) ~= nil end

local P = "|cffffd100Screenshot Moments:|r "
local SECRET = { secret = true }

test("addon defines only its own globals", function(wow, installed, before)
  boot(wow)
  wow.fire("PLAYER_LEVEL_UP", 12)
  settle(wow)
  wow.slash("/smo")
  wow.slash("/smo off")
  wow.slash("/smo test")
  settle(wow)
  wow.slash("/shotmoments on")
  local allowed = { ScreenshotMomentsDB = true, SLASH_SHOTMOMENTS1 = true, SLASH_SHOTMOMENTS2 = true }
  for _, name in ipairs(STAND_IN) do installed[name] = true end
  for k in pairs(_G) do
    if not before[k] and not installed[k] and not allowed[k] then error("unexpected global " .. tostring(k)) end
  end
end)

test("login creates the account-wide settings, switched on", function(wow)
  local ns = boot(wow)
  eq(ScreenshotMomentsDB.version, 1)
  eq(ScreenshotMomentsDB.settings.on, true)
  eq(ns.db, ScreenshotMomentsDB)
  eq(#wow.chat, 0, "nothing in chat at login")
end)

test("a level up takes one screenshot a second later and names the level", function(wow)
  boot(wow)
  wow.fire("PLAYER_LEVEL_UP", 42, 100, 0, 0)
  eq(#game.timers, 1)
  eq(game.timers[1].seconds, 1, "after a second")
  eq(game.shots, 0, "not at once")
  settle(wow)
  eq(game.shots, 1)
  eq(lastChat(wow), P .. "Screenshot saved: level 42.")
end)

test("an achievement takes one screenshot and names the achievement", function(wow)
  boot(wow)
  wow.fire("ACHIEVEMENT_EARNED", 46, false)
  settle(wow)
  eq(game.shots, 1)
  eq(lastChat(wow), P .. "Screenshot saved: achievement Explore Elwynn Forest.")
  later(wow, 20)
  wow.fire("ACHIEVEMENT_EARNED", 6)
  settle(wow)
  eq(game.shots, 2, "without the second value as well")
  eq(lastChat(wow), P .. "Screenshot saved: achievement Level 10.")
end)

test("an achievement the account had already earned takes no screenshot", function(wow)
  boot(wow)
  wow.fire("ACHIEVEMENT_EARNED", 46, true)
  settle(wow, false)
  eq(game.shots, 0)
  eq(#wow.chat, 0)
end)

test("epic loot of the player takes one screenshot and names the item", function(wow)
  boot(wow)
  wow.fire("CHAT_MSG_LOOT", "You receive loot: " .. EPIC_LINK .. ".", "Yubi")
  settle(wow)
  eq(game.shots, 1)
  eq(lastChat(wow), P .. "Screenshot saved: epic loot " .. EPIC_LINK .. ".")
  later(wow, 10)
  wow.fire("CHAT_MSG_LOOT", "You receive loot: " .. LEGENDARY_LINK .. "x2", "Yubi")
  settle(wow)
  eq(game.shots, 2, "several at once, legendary counts")
  eq(lastChat(wow), P .. "Screenshot saved: epic loot " .. LEGENDARY_LINK .. ".")
end)

test("loot below epic, other players' loot and other lines take no screenshot", function(wow)
  boot(wow)
  wow.fire("CHAT_MSG_LOOT", "You receive loot: " .. RARE_LINK .. ".")
  wow.fire("CHAT_MSG_LOOT", "Ohm receives loot: " .. EPIC_LINK .. ".")
  wow.fire("CHAT_MSG_LOOT", "You receive item: " .. EPIC_LINK .. ".")
  wow.fire("CHAT_MSG_LOOT", "You receive loot: Fang of the Deep.")
  wow.fire("CHAT_MSG_LOOT", nil)
  settle(wow, false)
  eq(game.shots, 0)
  eq(#game.timers, 0)
  eq(#wow.chat, 0)
end)

test("a German client: the German loot line counts, the English one is not a German line", function(wow)
  boot(wow, { lootSelf = "Ihr erhaltet Beute: %s", lootSelfMultiple = "Ihr erhaltet Beute: %sx%d" })
  wow.fire("CHAT_MSG_LOOT", "Ohm erhält Beute: " .. EPIC_LINK .. ".")
  wow.fire("CHAT_MSG_LOOT", "Ihr erhaltet Beute: " .. RARE_LINK .. ".")
  settle(wow, false)
  eq(game.shots, 0)
  wow.fire("CHAT_MSG_LOOT", "Ihr erhaltet Beute: " .. EPIC_LINK .. "x3.")
  settle(wow)
  eq(game.shots, 1)
  eq(lastChat(wow), P .. "Screenshot saved: epic loot " .. EPIC_LINK .. ".")
end)

test("the loot lines fall back to English when the client has no text", function(wow)
  local ns = boot(wow)
  LOOT_ITEM_SELF, LOOT_ITEM_SELF_MULTIPLE = nil, SECRET
  local patterns = ns.LootPatterns()
  eq(ns.SelfLootLink("You receive loot: " .. EPIC_LINK, patterns), EPIC_LINK)
  eq(ns.SelfLootLink("You receive loot: " .. EPIC_LINK .. "x2.", patterns), EPIC_LINK)
  eq(ns.SelfLootLink("You receive loot: nothing", patterns), nil)
end)

test("secret loot texts and secret qualities are skipped", function(wow)
  local ns = boot(wow)
  wow.fire("CHAT_MSG_LOOT", SECRET)
  game.quality[212395] = SECRET
  wow.fire("CHAT_MSG_LOOT", "You receive loot: " .. EPIC_LINK .. ".")
  settle(wow, false)
  eq(game.shots, 0)
  eq(ns.IsEpic(SECRET), false)
  eq(ns.IsEpic(nil), false)
  eq(ns.IsEpic(3), false)
  eq(ns.IsEpic(4), true)
  eq(ns.SelfLootLink(SECRET, ns.LootPatterns()), nil)
end)

test("the quality comes from C_Item.GetItemInfo when the first answer is missing, unknown items are skipped", function(wow)
  boot(wow)
  wow.fire("CHAT_MSG_LOOT", "You receive loot: " .. UNCACHED_LINK .. ".")
  settle(wow, false)
  eq(game.shots, 0, "quality unknown")
  game.infoQuality[999999] = 4
  wow.fire("CHAT_MSG_LOOT", "You receive loot: " .. UNCACHED_LINK .. ".")
  settle(wow)
  eq(game.shots, 1)
  C_Item = nil
  GetItemInfo = function(link) return "Name", link, 5 end
  later(wow, 10)
  wow.fire("CHAT_MSG_LOOT", "You receive loot: " .. RARE_LINK .. ".")
  settle(wow)
  eq(game.shots, 2, "the old GetItemInfo without C_Item")
end)

test("at most one screenshot in 10 seconds", function(wow)
  boot(wow)
  wow.fire("PLAYER_LEVEL_UP", 20)
  settle(wow)
  later(wow, 5)
  wow.fire("ACHIEVEMENT_EARNED", 46, false)
  wow.fire("CHAT_MSG_LOOT", "You receive loot: " .. EPIC_LINK .. ".")
  settle(wow, false)
  eq(game.shots, 1, "too soon")
  eq(#game.timers, 0)
  later(wow, 4)
  wow.fire("PLAYER_LEVEL_UP", 21)
  settle(wow, false)
  eq(game.shots, 1, "still too soon after 9 seconds")
  later(wow, 1)
  wow.fire("PLAYER_LEVEL_UP", 22)
  settle(wow)
  eq(game.shots, 2, "10 seconds after the last one")
  eq(lastChat(wow), P .. "Screenshot saved: level 22.")
end)

test("moments within the second before the screenshot share it and are all named", function(wow)
  boot(wow)
  wow.fire("PLAYER_LEVEL_UP", 10)
  later(wow, 0.5)
  wow.fire("ACHIEVEMENT_EARNED", 6, false)
  wow.fire("ACHIEVEMENT_EARNED", 6, false)
  eq(#game.timers, 1, "one screenshot planned")
  settle(wow)
  eq(game.shots, 1)
  eq(lastChat(wow), P .. "Screenshot saved: level 10, achievement Level 10.")
end)

test("entering the world also ends the loading block", function(wow)
  boot(wow)
  wow.fire("LOADING_SCREEN_ENABLED")
  wow.fire("PLAYER_ENTERING_WORLD", false, false)
  wow.fire("PLAYER_LEVEL_UP", 40)
  settle(wow)
  eq(game.shots, 1, "no LOADING_SCREEN_DISABLED, but the world is there")
end)

test("no screenshot during a loading screen", function(wow)
  boot(wow)
  wow.fire("LOADING_SCREEN_ENABLED")
  wow.fire("PLAYER_LEVEL_UP", 30)
  settle(wow, false)
  eq(game.shots, 0, "moment during the loading screen")
  wow.fire("LOADING_SCREEN_DISABLED")
  wow.fire("PLAYER_LEVEL_UP", 31)
  wow.fire("LOADING_SCREEN_ENABLED")
  settle(wow, false)
  eq(game.shots, 0, "loading screen came up during the second")
  wow.fire("LOADING_SCREEN_DISABLED")
  later(wow, 10)
  wow.fire("PLAYER_LEVEL_UP", 32)
  settle(wow)
  eq(game.shots, 1, "after the loading screen")
  eq(#wow.chat, 1)
end)

test("/smo off stops every moment, is saved, and /smo on brings them back", function(wow)
  boot(wow)
  wow.slash("/smo off")
  eq(ScreenshotMomentsDB.settings.on, false)
  eq(lastChat(wow), P .. "Screenshots at special moments are off.")
  local from = #wow.chat
  wow.fire("PLAYER_LEVEL_UP", 40)
  wow.fire("ACHIEVEMENT_EARNED", 46, false)
  wow.fire("CHAT_MSG_LOOT", "You receive loot: " .. EPIC_LINK .. ".")
  settle(wow, false)
  eq(game.shots, 0)
  eq(#wow.chat, from)
  wow.slash("/shotmoments ON")
  eq(ScreenshotMomentsDB.settings.on, true)
  eq(lastChat(wow), P .. "Screenshots at a level up, an achievement and epic loot are on.")
  wow.fire("PLAYER_LEVEL_UP", 41)
  settle(wow)
  eq(game.shots, 1)
end)

test("the off switch survives a reload", function(wow)
  boot(wow, nil, { version = 1, settings = { on = false } })
  eq(ScreenshotMomentsDB.settings.on, false)
  wow.fire("PLAYER_LEVEL_UP", 50)
  settle(wow, false)
  eq(game.shots, 0)
end)

test("/smo shows the state and the commands, without a | in the help", function(wow)
  boot(wow)
  wow.slash("/smo")
  eq(wow.chat[1], P .. "Screenshots at a level up, an achievement and epic loot are on.")
  eq(wow.chat[2], P .. "/smo on or /smo off switches the screenshots, /smo test takes a test screenshot. They are saved in the Screenshots folder of the game.")
  eq(has(wow.chat[2]:sub(#P + 1), "|"), false)
  wow.slash("/shotmoments whatever")
  eq(#wow.chat, 4, "unknown words show the help")
end)

test("/smo test takes a screenshot even while switched off, but keeps the 10 seconds", function(wow)
  boot(wow)
  wow.slash("/smo off")
  wow.slash("/smo test")
  eq(lastChat(wow), P .. "A test screenshot follows in a second.")
  settle(wow)
  eq(game.shots, 1)
  eq(lastChat(wow), P .. "Screenshot saved: test.")
  later(wow, 3)
  wow.slash("/smo test")
  settle(wow, false)
  eq(game.shots, 1)
  eq(lastChat(wow), P .. "The last screenshot was just taken. Try again in 7 seconds.")
  wow.fire("LOADING_SCREEN_ENABLED")
  later(wow, 10)
  wow.slash("/smo test")
  eq(lastChat(wow), P .. "Not during a loading screen.")
end)

test("a failed screenshot says so in chat", function(wow)
  boot(wow, { fail = true })
  wow.fire("PLAYER_LEVEL_UP", 60)
  settle(wow, false)
  eq(lastChat(wow), P .. "The screenshot did not work: level 60.")
  game.fail = false
  later(wow, 10)
  wow.fire("PLAYER_LEVEL_UP", 61)
  settle(wow, "SCREENSHOT_FAILED")
  eq(game.shots, 1)
  eq(lastChat(wow), P .. "The screenshot did not work: level 61.", "the game's own answer")
  Screenshot = nil
  later(wow, 10)
  wow.fire("PLAYER_LEVEL_UP", 62)
  settle(wow, false)
  eq(lastChat(wow), P .. "The screenshot did not work: level 62.", "no Screenshot function")
end)

test("screenshots the player takes by key get no chat line", function(wow)
  boot(wow)
  wow.fire("SCREENSHOT_SUCCEEDED")
  eq(#wow.chat, 0)
  wow.fire("PLAYER_LEVEL_UP", 70)
  settle(wow)
  wow.fire("SCREENSHOT_SUCCEEDED")
  eq(#wow.chat, 1, "only one line for ours")
  later(wow, 10)
  wow.fire("PLAYER_LEVEL_UP", 71)
  settle(wow, false)
  later(wow, 6)
  wow.fire("SCREENSHOT_SUCCEEDED")
  eq(#wow.chat, 1, "an answer long after ours is not ours")
end)

test("secret or missing level and achievement values still take the screenshot", function(wow)
  local ns = boot(wow)
  wow.fire("PLAYER_LEVEL_UP", SECRET)
  settle(wow)
  eq(lastChat(wow), P .. "Screenshot saved: new level.")
  later(wow, 10)
  wow.fire("ACHIEVEMENT_EARNED", SECRET, SECRET)
  settle(wow)
  eq(lastChat(wow), P .. "Screenshot saved: achievement.")
  later(wow, 10)
  GetAchievementInfo = function() return 1, SECRET end
  wow.fire("ACHIEVEMENT_EARNED", 46, false)
  settle(wow)
  eq(lastChat(wow), P .. "Screenshot saved: achievement.")
  later(wow, 10)
  GetAchievementInfo = nil
  wow.fire("ACHIEVEMENT_EARNED", 999, false)
  settle(wow)
  eq(lastChat(wow), P .. "Screenshot saved: achievement.")
  eq(game.shots, 4)
  eq(ns.LevelOccasion(0), "new level")
  eq(ns.LevelOccasion(80.0), "level 80")
end)

test("without C_Timer the screenshot is taken at once", function(wow)
  boot(wow)
  C_Timer = nil
  wow.fire("PLAYER_LEVEL_UP", 15)
  eq(game.shots, 1)
end)

test("events before login change nothing", function(wow)
  client()
  wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("PLAYER_LEVEL_UP", 5)
  wow.fire("CHAT_MSG_LOOT", "You receive loot: " .. EPIC_LINK .. ".")
  wow.slash("/smo test")
  settle(wow, false)
  eq(ScreenshotMomentsDB, nil)
  eq(game.shots, 0)
  eq(#wow.chat, 0)
end)

test("game format strings become anchored patterns", function(wow)
  local ns = boot(wow)
  eq(ns.FormatPattern("You receive loot: %s"), "^You receive loot: (.+)%.?$")
  eq(ns.FormatPattern("You receive loot: %sx%d."), "^You receive loot: (.+)x(%d+)%.?$")
  eq(ns.FormatPattern("%1$s (100%%)"), "^(.+) %(100%%%)%.?$", "a doubled % is one % on screen")
  eq(("Fang (100%)"):find(ns.FormatPattern("%1$s (100%%)")) ~= nil, true)
  eq(ns.FirstLink("a " .. RARE_LINK .. " b"), RARE_LINK)
  eq(ns.FirstLink("a |Hitem:5|h[X]|h b"), "|Hitem:5|h[X]|h", "a link without colour")
  eq(ns.FirstLink("no link"), nil)
  local state = {}
  eq(ns.Offer(state, 100, "a"), "shoot")
  eq(ns.Offer(state, 100.5, "b"), "join")
  eq(#ns.Take(state), 2)
  eq(ns.Offer(state, 105, "c"), "wait")
  eq(ns.WaitLeft(state, 105), 5)
  eq(ns.Offer(state, 110, "d"), "shoot")
  state.loading = true
  eq(ns.Take(state), nil, "a loading screen drops the waiting screenshot")
  eq(ns.Offer(state, 200, "e"), "loading")
end)

-- 1.1: German ------------------------------------------------------------------------------------------

-- Every placeholder of a text, in order: "%d", "%s", "%%".
local function placeholders(text)
  local out = {}
  for p in text:gmatch("%%[%d%.]*[%a%%]") do out[#out + 1] = p end
  return table.concat(out, " ")
end

-- Every command in a text with its words: "/smo on, /smo off, /smo test".
local WORDS = { on = true, off = true, test = true }
local function commands(text)
  local out = {}
  for cmd, rest in text:gmatch("(/s%a+)([^,%.%(%)/]*)") do
    if cmd == "/smo" or cmd == "/shotmoments" then
      local word = rest:match("^ (%a+)")
      out[#out + 1] = (word and WORDS[word]) and (cmd .. " " .. word) or cmd
    end
  end
  return table.concat(out, ", ")
end

local function german(wow, g, saved)
  wow.locale = "deDE"
  return boot(wow, g or { lootSelf = "Ihr erhaltet Beute: %s", lootSelfMultiple = "Ihr erhaltet Beute: %sx%d" }, saved)
end

test("German client: the chat lines of the moments are German", function(wow)
  german(wow, { lootSelf = "Ihr erhaltet Beute: %s", lootSelfMultiple = "Ihr erhaltet Beute: %sx%d",
    achievements = { [6] = "Stufe 10", [46] = "Erkundet den Wald von Elwynn" } })
  wow.fire("PLAYER_LEVEL_UP", 42)
  settle(wow)
  eq(lastChat(wow), P .. "Screenshot gespeichert: Stufe 42.")
  later(wow, 10)
  wow.fire("ACHIEVEMENT_EARNED", 46, false)
  settle(wow)
  eq(lastChat(wow), P .. "Screenshot gespeichert: Erfolg Erkundet den Wald von Elwynn.", "the achievement name from the game")
  later(wow, 10)
  wow.fire("CHAT_MSG_LOOT", "Ihr erhaltet Beute: " .. EPIC_LINK .. ".")
  settle(wow)
  eq(lastChat(wow), P .. "Screenshot gespeichert: epische Beute " .. EPIC_LINK .. ".")
  later(wow, 10)
  wow.fire("PLAYER_LEVEL_UP", 43)
  wow.fire("ACHIEVEMENT_EARNED", 6, false)
  settle(wow)
  eq(lastChat(wow), P .. "Screenshot gespeichert: Stufe 43, Erfolg Stufe 10.", "shared screenshot")
  later(wow, 10)
  wow.fire("PLAYER_LEVEL_UP", SECRET)
  wow.fire("ACHIEVEMENT_EARNED", SECRET)
  settle(wow)
  eq(lastChat(wow), P .. "Screenshot gespeichert: neue Stufe, Erfolg.")
  later(wow, 10)
  wow.fire("PLAYER_LEVEL_UP", 44)
  settle(wow, "SCREENSHOT_FAILED")
  eq(lastChat(wow), P .. "Der Screenshot hat nicht geklappt: Stufe 44.")
  eq(game.shots, 6)
end)

test("German client: every answer to a command in German", function(wow)
  german(wow)
  wow.slash("/smo")
  eq(wow.chat[1], P .. "Screenshots bei einem Stufenaufstieg, einem Erfolg und epischer Beute sind an.")
  eq(wow.chat[2], P .. "/smo on oder /smo off schaltet die Screenshots ein oder aus, /smo test macht einen Test-Screenshot. Sie landen im Ordner Screenshots des Spiels.")
  wow.slash("/smo off")
  eq(lastChat(wow), P .. "Screenshots bei besonderen Momenten sind aus.")
  wow.slash("/smo test")
  eq(lastChat(wow), P .. "Ein Test-Screenshot folgt in einer Sekunde.")
  settle(wow)
  eq(lastChat(wow), P .. "Screenshot gespeichert: Test.")
  later(wow, 3)
  wow.slash("/smo test")
  eq(lastChat(wow), P .. "Der letzte Screenshot wurde gerade gemacht. Versuch es in 7 Sekunden noch mal.")
  wow.fire("LOADING_SCREEN_ENABLED")
  later(wow, 10)
  wow.slash("/shotmoments test")
  eq(lastChat(wow), P .. "Nicht während eines Ladebildschirms.")
  wow.slash("/smo on")
  eq(lastChat(wow), P .. "Screenshots bei einem Stufenaufstieg, einem Erfolg und epischer Beute sind an.", "the commands stay English")
end)

test("German client: the off switch saved in 1.0 is kept", function(wow)
  german(wow, nil, { version = 1, settings = { on = false } })
  eq(ScreenshotMomentsDB.settings.on, false)
  wow.fire("PLAYER_LEVEL_UP", 50)
  settle(wow, false)
  eq(game.shots, 0)
  eq(#wow.chat, 0)
end)

test("German texts keep every placeholder and command of the English text, in order", function(wow)
  local ns = german(wow)
  local n = 0
  for key, text in pairs(ns.L) do
    n = n + 1
    eq(placeholders(text), placeholders(key), key)
    eq(commands(text), commands(key), "the commands stay: " .. key)
    eq(text:find("|", 1, true), nil, "no | in a German text: " .. key)
  end
  eq(n, 15, "every text on screen has its German one")
  eq(commands("/smo on or /smo off switches, /shotmoments shows."), "/smo on, /smo off, /shotmoments")
end)

test("an English client keeps the English texts", function(wow)
  wow.locale = "enUS"
  local ns = boot(wow)
  eq(next(ns.L), nil)
  wow.fire("PLAYER_LEVEL_UP", 12)
  settle(wow)
  eq(lastChat(wow), P .. "Screenshot saved: level 12.")
  wow.slash("/smo off")
  eq(lastChat(wow), P .. "Screenshots at special moments are off.")
end)
