-- Tests for Quest Autopilot, run by tools/wow/client/run.lua.

-- The quest side of the game, which the stand-in client does not have. Every call that changes
-- something is noted in g.calls; the fields of g are what the game "shows" at the moment.
local function game()
  local g = {
    calls = {}, shift = false, completable = true, choices = 0, money = 0, autoAccept = false,
    gossipActive = {}, gossipAvailable = {}, greetingActive = {}, greetingAvailable = 0,
    -- 1.1: the quest of the open quest window, quest log entries by ID, greeting window details
    quest = {}, log = {}, titles = {}, greetingIDs = {}, greetingTitles = {}, greetingFrequency = {},
  }
  local function call(name)
    return function(arg) g.calls[#g.calls + 1] = arg ~= nil and (name .. " " .. tostring(arg)) or name end
  end
  IsShiftKeyDown = function() return g.shift end
  AcceptQuest = call("AcceptQuest")
  QuestGetAutoAccept = function() return g.autoAccept end
  AcknowledgeAutoAcceptQuest = call("AcknowledgeAutoAcceptQuest")
  IsQuestCompletable = function() return g.completable end
  CompleteQuest = call("CompleteQuest")
  GetNumQuestChoices = function() return g.choices end
  GetQuestMoneyToGet = function() return g.money end
  GetQuestReward = call("GetQuestReward")
  C_GossipInfo = {
    GetActiveQuests = function() return g.gossipActive end,
    GetAvailableQuests = function() return g.gossipAvailable end,
    SelectActiveQuest = call("Gossip.SelectActiveQuest"),
    SelectAvailableQuest = call("Gossip.SelectAvailableQuest"),
  }
  GetNumActiveQuests = function() return #g.greetingActive end
  GetActiveTitle = function(i) return g.greetingActive[i].title, g.greetingActive[i].complete end
  SelectActiveQuest = call("SelectActiveQuest")
  GetNumAvailableQuests = function() return g.greetingAvailable end
  GetAvailableQuestInfo = function(i)
    return false, g.greetingFrequency[i] or 0, g.greetingRepeatable and g.greetingRepeatable[i] == true, false, g.greetingIDs[i] or 0
  end
  GetAvailableTitle = function(i) return g.greetingTitles[i] or ("Offer " .. i) end
  GetActiveQuestID = function(i) return g.greetingActive[i].id or 0 end
  GetQuestID = function() return g.quest.id or 0 end
  GetTitleText = function() return g.quest.title or "" end
  QuestIsDaily = function() return g.quest.daily == true end
  QuestIsWeekly = function() return g.quest.weekly == true end
  C_QuestLog = {
    GetLogIndexForQuestID = function(id) if g.log[id] then return 7 + id end end,
    GetInfo = function(index) for id, info in pairs(g.log) do if 7 + id == index then return info end end end,
    GetTitleForQuestID = function(id) return g.titles[id] end,
  }
  SelectAvailableQuest = call("SelectAvailableQuest")
  g.done = function() return table.concat(g.calls, ", ") end
  return g
end

local function boot(wow)
  local g = game()
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("ADDON_LOADED", "QuestAutopilot")
  wow.fire("PLAYER_LOGIN")
  return ns, g
end

-- The player closes the window and walks away.
local function leave(wow, event)
  wow.fire(event or "QUEST_FINISHED")
  wow.clock = wow.clock + 10
end

test("addon defines only its own globals", function(wow, installed, before)
  game()
  local stubs = {}
  for k in pairs(_G) do stubs[k] = true end
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("PLAYER_LOGIN")
  wow.fire("QUEST_DETAIL")
  wow.slash("/qa")
  local allowed = { QuestAutopilotDB = true, SLASH_QUESTAUTOPILOT1 = true, SLASH_QUESTAUTOPILOT2 = true }
  for k in pairs(_G) do
    if not stubs[k] and not allowed[k] then error("unexpected global " .. tostring(k)) end
  end
  eq(SLASH_QUESTAUTOPILOT1, "/questautopilot")
  eq(SLASH_QUESTAUTOPILOT2, "/qa")
  eq(type(QuestAutopilotDB), "table")
end)

test("decision: a quest is accepted unless paused or switched off", function(wow)
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  eq(ns.OnDetail({ enabled = true, paused = false }), "accept")
  eq(ns.OnDetail({ enabled = true, paused = true }), nil)
  eq(ns.OnDetail({ enabled = false, paused = false }), nil)
  eq(ns.OnDetail({}), nil)
end)

test("decision: a quest is continued only when it is done and costs nothing", function(wow)
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  eq(ns.OnProgress({ enabled = true, completable = true, moneyNeeded = 0 }), "continue")
  eq(ns.OnProgress({ enabled = true, completable = false, moneyNeeded = 0 }), nil)
  eq(ns.OnProgress({ enabled = true, completable = nil, moneyNeeded = 0 }), nil, "unknown state")
  eq(ns.OnProgress({ enabled = true, completable = true, moneyNeeded = 1 }), nil)
  eq(ns.OnProgress({ enabled = true, completable = true, moneyNeeded = nil }), nil, "unknown price")
  eq(ns.OnProgress({ enabled = true, paused = true, completable = true, moneyNeeded = 0 }), nil)
  eq(ns.OnProgress({ enabled = false, completable = true, moneyNeeded = 0 }), nil)
end)

test("decision: the reward is taken with at most one choice", function(wow)
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  local what, index = ns.OnComplete({ enabled = true, choices = 0, moneyNeeded = 0 })
  eq(what, "take")
  eq(index, 1)
  what, index = ns.OnComplete({ enabled = true, choices = 1, moneyNeeded = 0 })
  eq(what, "take")
  eq(index, 1)
  eq(ns.OnComplete({ enabled = true, choices = 2, moneyNeeded = 0 }), "choose")
  eq(ns.OnComplete({ enabled = true, choices = 4, moneyNeeded = 0 }), "choose")
  eq(ns.OnComplete({ enabled = true, choices = nil, moneyNeeded = 0 }), nil, "unknown number of rewards")
  eq(ns.OnComplete({ enabled = true, choices = 0, moneyNeeded = 500 }), nil)
  eq(ns.OnComplete({ enabled = true, paused = true, choices = 0, moneyNeeded = 0 }), nil)
  eq(ns.OnComplete({ enabled = true, paused = true, choices = 3, moneyNeeded = 0 }), nil, "no chat line while paused")
  eq(ns.OnComplete({ enabled = false, choices = 3, moneyNeeded = 0 }), nil, "no chat line when off")
end)

test("decision: finished quests first, then new ones", function(wow)
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  local active = { { id = 11, complete = false }, { id = 12, complete = true }, { id = 13, complete = true } }
  local available = { { id = 21 }, { id = 22 } }
  local kind, id = ns.Pick({ accept = true, turnin = true, active = active, available = available })
  eq(kind, "active")
  eq(id, 12)
  kind, id = ns.Pick({ accept = true, turnin = true, active = { active[1] }, available = available })
  eq(kind, "available")
  eq(id, 21)
  kind, id = ns.Pick({ accept = true, turnin = false, active = active, available = available })
  eq(kind, "available", "handing in is off")
  eq(id, 21)
  kind, id = ns.Pick({ accept = false, turnin = true, active = active, available = available })
  eq(kind, "active", "accepting is off")
  eq(ns.Pick({ accept = false, turnin = true, active = { active[1] }, available = available }), nil)
  eq(ns.Pick({ accept = true, turnin = true, paused = true, active = active, available = available }), nil)
  eq(ns.Pick({ accept = true, turnin = true, active = {}, available = {} }), nil)
  eq(ns.Pick({ accept = true, turnin = true }), nil)
end)

test("decision: Shift pauses the whole conversation, not the next one", function(wow)
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  local talk = {}
  eq(ns.WindowOpened(talk, false, 100), false)
  eq(ns.WindowOpened(talk, true, 101), true, "Shift held")
  eq(ns.WindowOpened(talk, false, 160), true, "no window closed in between: same conversation")
  ns.WindowClosed(talk, 200)
  eq(ns.WindowOpened(talk, false, 200.5), true, "next window right after: same conversation")
  ns.WindowClosed(talk, 300)
  eq(ns.WindowOpened(talk, false, 300 + ns.GRACE + 0.1), false, "later: a new conversation")
  eq(ns.WindowOpened(talk, false, 400), false)
end)

test("a quest is accepted when it is offered", function(wow)
  local ns, g = boot(wow)
  wow.fire("QUEST_DETAIL", 0)
  eq(g.done(), "AcceptQuest")
  eq(#wow.chat, 0, "accepting is silent")
end)

test("a quest the game accepted by itself is only acknowledged", function(wow)
  local ns, g = boot(wow)
  g.autoAccept = true
  wow.fire("QUEST_DETAIL")
  eq(g.done(), "AcknowledgeAutoAcceptQuest")
end)

test("a finished quest is handed in and the single reward taken", function(wow)
  local ns, g = boot(wow)
  wow.fire("QUEST_PROGRESS")
  eq(g.done(), "CompleteQuest")
  wow.fire("QUEST_COMPLETE")
  eq(g.done(), "CompleteQuest, GetQuestReward 1")
  g.choices = 1
  wow.fire("QUEST_COMPLETE")
  eq(g.done(), "CompleteQuest, GetQuestReward 1, GetQuestReward 1")
  eq(#wow.chat, 0)
end)

test("an unfinished quest is left alone", function(wow)
  local ns, g = boot(wow)
  g.completable = false
  wow.fire("QUEST_PROGRESS")
  eq(g.done(), "")
end)

test("several rewards: it stops and says so once", function(wow)
  local ns, g = boot(wow)
  g.choices = 3
  wow.fire("QUEST_COMPLETE")
  eq(g.done(), "")
  eq(#wow.chat, 1)
  eq(wow.chat[1], "|cffffd100Quest Autopilot:|r This quest has several rewards. Pick one yourself.")
end)

test("a quest that asks for money is never handed in", function(wow)
  local ns, g = boot(wow)
  g.money = 250000
  wow.fire("QUEST_PROGRESS")
  wow.fire("QUEST_COMPLETE")
  eq(g.done(), "")
  eq(#wow.chat, 0)
  g.money = 0
  wow.fire("QUEST_PROGRESS")
  eq(g.done(), "CompleteQuest")
end)

test("nothing happens while Shift is held", function(wow)
  local ns, g = boot(wow)
  g.shift = true
  g.gossipActive = { { questID = 1, isComplete = true } }
  g.gossipAvailable = { { questID = 2 } }
  g.greetingActive = { { title = "Done", complete = true } }
  g.greetingAvailable = 1
  for _, event in ipairs({ "GOSSIP_SHOW", "QUEST_GREETING", "QUEST_DETAIL", "QUEST_PROGRESS", "QUEST_COMPLETE" }) do
    wow.fire(event)
    leave(wow)
  end
  g.choices = 3
  wow.fire("QUEST_COMPLETE")
  eq(g.done(), "")
  eq(#wow.chat, 0)
end)

test("Shift at the start pauses the whole conversation, the next one runs again", function(wow)
  local ns, g = boot(wow)
  g.gossipAvailable = { { questID = 2 } }
  g.shift = true
  wow.fire("GOSSIP_SHOW")
  g.shift = false
  wow.fire("GOSSIP_CLOSED") -- the player picks the quest by hand: the list closes, the quest text opens
  wow.clock = wow.clock + 0.3
  wow.fire("QUEST_DETAIL")
  wow.clock = wow.clock + 45 -- reads it
  eq(g.done(), "", "still paused")
  eq(ns.talk.paused, true)
  leave(wow)
  wow.fire("GOSSIP_SHOW")
  eq(g.done(), "Gossip.SelectAvailableQuest 2")
  eq(ns.talk.paused, false)
end)

test("quest giver with several quests: hands in first, then accepts, one step per window", function(wow)
  local ns, g = boot(wow)
  g.gossipActive = { { questID = 101, isComplete = false }, { questID = 102, isComplete = true } }
  g.gossipAvailable = { { questID = 201 }, { questID = 202 } }
  wow.fire("GOSSIP_SHOW")
  eq(g.done(), "Gossip.SelectActiveQuest 102")
  g.gossipActive = { { questID = 101, isComplete = false } }
  wow.fire("GOSSIP_SHOW")
  eq(g.done(), "Gossip.SelectActiveQuest 102, Gossip.SelectAvailableQuest 201")
  g.gossipAvailable = { { questID = 202 } }
  wow.fire("GOSSIP_SHOW")
  g.gossipAvailable = {}
  wow.fire("GOSSIP_SHOW") -- only the unfinished quest is left
  eq(g.done(), "Gossip.SelectActiveQuest 102, Gossip.SelectAvailableQuest 201, Gossip.SelectAvailableQuest 202")
end)

test("greeting window: the same order, quests picked by their number", function(wow)
  local ns, g = boot(wow)
  g.greetingActive = { { title = "Still busy", complete = false }, { title = "Done", complete = true } }
  g.greetingAvailable = 2
  wow.fire("QUEST_GREETING")
  eq(g.done(), "SelectActiveQuest 2")
  g.greetingActive = { { title = "Still busy", complete = false } }
  wow.fire("QUEST_GREETING")
  eq(g.done(), "SelectActiveQuest 2, SelectAvailableQuest 1")
  g.greetingAvailable = 0
  wow.fire("QUEST_GREETING")
  eq(g.done(), "SelectActiveQuest 2, SelectAvailableQuest 1")
end)

test("/qa prints the state, on and off switch everything", function(wow)
  local ns, g = boot(wow)
  wow.slash("/qa")
  eq(wow.chat[1], "|cffffd100Quest Autopilot:|r Autopilot is on. Accepting quests: on. Handing in quests: on. Daily and weekly quests: automatic. Kept manual: 0.")
  wow.slash("/questautopilot OFF ")
  eq(wow.chat[2], "|cffffd100Quest Autopilot:|r Autopilot is off. Accepting quests: on. Handing in quests: on. Daily and weekly quests: automatic. Kept manual: 0.")
  eq(QuestAutopilotDB.settings.enabled, false)
  g.gossipActive = { { questID = 1, isComplete = true } }
  g.gossipAvailable = { { questID = 2 } }
  g.greetingActive = { { title = "Done", complete = true } }
  g.greetingAvailable = 1
  g.choices = 3
  for _, event in ipairs({ "GOSSIP_SHOW", "QUEST_GREETING", "QUEST_DETAIL", "QUEST_PROGRESS", "QUEST_COMPLETE" }) do wow.fire(event) end
  eq(g.done(), "", "switched off: nothing happens")
  eq(#wow.chat, 2, "and nothing is said")
  wow.slash("/qa on")
  eq(QuestAutopilotDB.settings.enabled, true)
  wow.fire("QUEST_DETAIL")
  eq(g.done(), "AcceptQuest")
  wow.slash("/qa what")
  eq(#wow.chat, 6, "three help lines")
  eq(wow.chat[4]:match("/qa accept and /qa turnin switch one half") ~= nil, true)
  eq(wow.chat[5]:match("/qa manual keeps the quest you just saw manual") ~= nil, true)
  eq(wow.chat[6]:match("/qa dailies leaves all daily and weekly quests to you") ~= nil, true)
  wow.slash("/qa on now")
  eq(#wow.chat, 9, "a known word with something after it is not a switch")
end)

test("/qa accept and /qa turnin switch one half each", function(wow)
  local ns, g = boot(wow)
  g.gossipActive = { { questID = 1, isComplete = true } }
  g.gossipAvailable = { { questID = 2 } }
  wow.slash("/qa accept")
  eq(wow.chat[1]:match("Autopilot is on%. Accepting quests: off%. Handing in quests: on%.") ~= nil, true)
  wow.fire("QUEST_DETAIL")
  eq(g.done(), "", "accepting is off")
  wow.fire("QUEST_PROGRESS")
  wow.fire("GOSSIP_SHOW")
  eq(g.done(), "CompleteQuest, Gossip.SelectActiveQuest 1")
  g.gossipActive = {}
  wow.fire("GOSSIP_SHOW")
  eq(g.done(), "CompleteQuest, Gossip.SelectActiveQuest 1", "new quests stay untouched")

  wow.slash("/qa accept")
  wow.slash("/qa turnin")
  eq(wow.chat[3]:match("Accepting quests: on%. Handing in quests: off%.") ~= nil, true)
  g.calls = {}
  g.gossipActive = { { questID = 1, isComplete = true } }
  wow.fire("QUEST_PROGRESS")
  wow.fire("QUEST_COMPLETE")
  wow.fire("GOSSIP_SHOW")
  wow.fire("QUEST_DETAIL")
  eq(g.done(), "Gossip.SelectAvailableQuest 2, AcceptQuest")
end)

test("settings survive a restart, missing ones get their default", function(wow)
  QuestAutopilotDB = { settings = { turnin = false, accept = "broken" } }
  local saved = QuestAutopilotDB
  local ns, g = boot(wow)
  eq(QuestAutopilotDB, saved, "the saved table is kept")
  eq(saved.settings.turnin, false)
  eq(saved.settings.accept, true)
  eq(saved.settings.enabled, true)
  eq(saved.version, 2)
  wow.fire("QUEST_PROGRESS")
  eq(g.done(), "")
  wow.slash("/qa turnin")
  eq(saved.settings.turnin, true, "the command writes into the saved table")
end)

test("a first start has everything switched on", function(wow)
  local ns, g = boot(wow)
  eq(QuestAutopilotDB.settings.enabled, true)
  eq(QuestAutopilotDB.settings.accept, true)
  eq(QuestAutopilotDB.settings.turnin, true)
end)

-- Fails when a secret value reaches a decision: there it would be compared.
local function noSecrets(ns, name)
  local decide = ns[name]
  local function look(t, where)
    for key, value in pairs(t) do
      if issecretvalue(value) then error(name .. " got a secret value in " .. where .. tostring(key)) end
      if type(value) == "table" then look(value, where .. tostring(key) .. ".") end
    end
  end
  ns[name] = function(q)
    look(q, "")
    return decide(q)
  end
end

test("secret values are never compared: it stops instead", function(wow)
  local ns, g = boot(wow)
  for _, name in ipairs({ "OnDetail", "OnProgress", "OnComplete", "Pick" }) do noSecrets(ns, name) end
  local secret = { secret = true }
  g.autoAccept = secret
  wow.fire("QUEST_DETAIL")
  eq(g.done(), "AcceptQuest", "an unknown answer counts as a normal quest")
  g.calls = {}
  g.completable = secret
  wow.fire("QUEST_PROGRESS")
  g.completable, g.money = true, secret
  wow.fire("QUEST_PROGRESS")
  wow.fire("QUEST_COMPLETE")
  g.money, g.choices = 0, secret
  wow.fire("QUEST_COMPLETE")
  g.gossipActive = { { questID = secret, isComplete = true }, { questID = 5, isComplete = secret } }
  wow.fire("GOSSIP_SHOW")
  g.greetingActive = { { title = "Hidden", complete = secret } }
  wow.fire("QUEST_GREETING")
  eq(g.done(), "")
  eq(#wow.chat, 0)
end)

test("a client without the newer conversation functions does not break it", function(wow)
  local ns, g = boot(wow)
  C_GossipInfo = nil
  QuestGetAutoAccept, AcknowledgeAutoAcceptQuest, GetQuestMoneyToGet, IsShiftKeyDown = nil, nil, nil, nil
  wow.fire("GOSSIP_SHOW")
  wow.fire("QUEST_DETAIL")
  wow.fire("QUEST_PROGRESS")
  eq(g.done(), "AcceptQuest, CompleteQuest")
end)

test("nothing happens before the settings are loaded", function(wow)
  local g = game()
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("QUEST_DETAIL")
  wow.slash("/qa")
  eq(g.done(), "")
  eq(#wow.chat, 0)
  eq(QuestAutopilotDB, nil)
end)

test("decision: a repeatable quest is never taken on its own", function(wow)
  local ns = boot(wow)
  eq(ns.Pick({ accept = true, turnin = true, available = { { id = 7, repeatable = true } } }), nil)
  local kind, id = ns.Pick({ accept = true, turnin = true, available = { { id = 7, repeatable = true }, { id = 8 } } })
  eq(kind, "available")
  eq(id, 8)
  kind, id = ns.Pick({ accept = true, turnin = true, active = { { id = 7, complete = true } }, available = { { id = 7, repeatable = true } } })
  eq(kind, "active", "a finished repeatable quest is still handed in once")
  eq(id, 7)
end)

test("repeatable quests at a quest giver: handed in once, never taken again by the addon", function(wow)
  local ns, g = boot(wow)
  g.gossipActive = { { questID = 50, isComplete = true } }
  g.gossipAvailable = { { questID = 50, repeatable = true } }
  wow.fire("GOSSIP_SHOW")
  eq(g.done(), "Gossip.SelectActiveQuest 50")
  leave(wow, "GOSSIP_CLOSED")
  g.gossipActive = {}
  wow.fire("GOSSIP_SHOW")
  eq(g.done(), "Gossip.SelectActiveQuest 50", "the repeatable offer is left to the player")
  leave(wow, "GOSSIP_CLOSED")
  g.gossipAvailable = { { questID = 51, repeatable = { secret = true } } }
  wow.fire("GOSSIP_SHOW")
  eq(g.done(), "Gossip.SelectActiveQuest 50", "unknown counts as repeatable")
  leave(wow, "GOSSIP_CLOSED")
  g.greetingAvailable = 2
  g.greetingRepeatable = { true, false }
  wow.fire("QUEST_GREETING")
  eq(g.done(), "Gossip.SelectActiveQuest 50, SelectAvailableQuest 2", "greeting window: the repeatable first quest is skipped")
end)


-- 1.1: quests kept manual and the switch for daily and weekly quests

test("decision: a quest kept manual is never accepted, continued or rewarded", function(wow)
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  eq(ns.OnDetail({ enabled = true, manual = true }), nil)
  eq(ns.OnDetail({ enabled = true, manual = false }), "accept")
  eq(ns.OnProgress({ enabled = true, manual = true, completable = true, moneyNeeded = 0 }), nil)
  eq(ns.OnComplete({ enabled = true, manual = true, choices = 0, moneyNeeded = 0 }), nil)
  eq(ns.OnComplete({ enabled = true, manual = true, choices = 3, moneyNeeded = 0 }), nil, "no chat line for a manual quest")
end)

test("decision: a quest giver's manual quests are passed over, the others still run", function(wow)
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  local active = { { id = 1, complete = true, manual = true }, { id = 2, complete = true } }
  local available = { { id = 3, manual = true }, { id = 4 } }
  local kind, id = ns.Pick({ accept = true, turnin = true, active = active, available = available })
  eq(kind, "active")
  eq(id, 2)
  kind, id = ns.Pick({ accept = true, turnin = true, active = { active[1] }, available = available })
  eq(kind, "available")
  eq(id, 4)
  eq(ns.Pick({ accept = true, turnin = true, active = { active[1] }, available = { available[1] } }), nil)
end)

test("reading what the player typed: ID, name or quest link", function(wow)
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  local id, title = ns.ParseQuest("12345")
  eq(id, 12345)
  eq(title, nil)
  id, title = ns.ParseQuest(" #777 ")
  eq(id, 777)
  id, title = ns.ParseQuest("  Feed the Gryphons ")
  eq(id, nil)
  eq(title, "Feed the Gryphons")
  id, title = ns.ParseQuest("|cffffff00|Hquest:83432:80|h[Into the Deep]|h|r")
  eq(id, 83432)
  eq(title, "Into the Deep")
  eq(ns.ParseQuest(""), nil)
  eq(ns.ParseQuest("   "), nil)
  eq(ns.ParseQuest(nil), nil)
end)

test("the list: add, find, remove, labels", function(wow)
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  local list = ns.ManualList({})
  local settings = ns.Settings({})
  local label, isNew = ns.AddManual(list, 100, "Feed the Gryphons")
  eq(label, "Feed the Gryphons (100)")
  eq(isNew, true)
  label, isNew = ns.AddManual(list, 100, nil)
  eq(label, "Feed the Gryphons (100)", "a known title is kept")
  eq(isNew, false)
  eq(select(1, ns.AddManual(list, 200, nil)), "Quest 200")
  eq(select(1, ns.AddManual(list, nil, " Sweep the Deck ")), "Sweep the Deck")
  eq(select(2, ns.AddManual(list, nil, "SWEEP THE DECK")), false, "names ignore upper and lower case")
  eq(ns.AddManual(list, nil, "  "), nil)
  eq(ns.ManualCount(list), 3)
  eq(table.concat(ns.ManualLabels(list), "|"), "Feed the Gryphons (100)|Quest 200|Sweep the Deck")

  eq(ns.IsManual(list, settings, { id = 100 }), true)
  eq(ns.IsManual(list, settings, { id = 101, title = "Feed the Gryphons" }), false, "kept by ID, not by title")
  eq(ns.IsManual(list, settings, { id = 300, title = "sweep the deck" }), true, "kept by name")
  eq(ns.IsManual(list, settings, { title = "Other" }), false)
  eq(ns.IsManual(list, settings, {}), false)

  eq(ns.RemoveManual(list, 200), "Quest 200")
  eq(ns.RemoveManual(list, 200), nil)
  eq(ns.RemoveManual(list, nil, "feed the gryphons"), "Feed the Gryphons (100)", "a name also removes a quest kept by ID")
  eq(ns.RemoveManual(list, nil, "Sweep the Deck"), "Sweep the Deck")
  eq(ns.ManualCount(list), 0)
end)

test("decision: the daily switch is off by default and catches only daily and weekly quests", function(wow)
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  local list = ns.ManualList({})
  local settings = ns.Settings({})
  eq(settings.manualDailies, false)
  eq(ns.IsManual(list, settings, { id = 1, periodic = true }), false, "1.0 behaviour by default")
  eq(ns.Apply(settings, "dailies"), true)
  eq(ns.IsManual(list, settings, { id = 1, periodic = true }), true)
  eq(ns.IsManual(list, settings, { id = 1, periodic = false }), false)
  eq(ns.IsManual(list, settings, { id = 1 }), false)
  ns.Apply(settings, "dailies")
  eq(settings.manualDailies, false)
end)

test("/qa manual <ID>: that quest is left to the player, others still run", function(wow)
  local ns, g = boot(wow)
  g.titles[4242] = "Feed the Gryphons"
  wow.slash("/qa manual 4242")
  eq(wow.chat[1], "|cffffd100Quest Autopilot:|r Feed the Gryphons (4242) stays manual from now on.")
  eq(QuestAutopilotDB.manual.ids[4242], "Feed the Gryphons", "saved")
  g.quest = { id = 4242, title = "Feed the Gryphons" }
  wow.fire("QUEST_DETAIL")
  wow.fire("QUEST_PROGRESS")
  g.choices = 3
  wow.fire("QUEST_COMPLETE")
  eq(g.done(), "")
  eq(#wow.chat, 1, "no line about rewards for a manual quest")
  g.quest, g.choices = { id = 5000, title = "Other" }, 0
  wow.fire("QUEST_DETAIL")
  wow.fire("QUEST_PROGRESS")
  wow.fire("QUEST_COMPLETE")
  eq(g.done(), "AcceptQuest, CompleteQuest, GetQuestReward 1")
  wow.slash("/qa manual 4242")
  eq(wow.chat[2], "|cffffd100Quest Autopilot:|r Feed the Gryphons (4242) is already kept manual.")
end)

test("/qa manual without a quest: the quest of the window, or the one the autopilot just took", function(wow)
  local ns, g = boot(wow)
  wow.slash("/qa manual")
  eq(wow.chat[1]:match("No quest seen yet%.") ~= nil, true)
  eq(ns.ManualCount(ns.manual), 0)
  g.quest = { id = 900, title = "Daily Delivery" }
  wow.fire("QUEST_DETAIL") -- the autopilot accepts it and the window closes
  leave(wow)
  eq(g.done(), "AcceptQuest")
  wow.slash("/qa manual")
  eq(wow.chat[2], "|cffffd100Quest Autopilot:|r Daily Delivery (900) stays manual from now on.")
  wow.fire("QUEST_PROGRESS")
  eq(g.done(), "AcceptQuest", "handing it in is left to the player too")
  wow.slash("/qa")
  eq(wow.chat[3]:match("Kept manual: 1%.$") ~= nil, true)
end)

test("a quest kept by name is skipped in both quest giver lists", function(wow)
  local ns, g = boot(wow)
  wow.slash("/qa manual   sweep the deck")
  eq(wow.chat[1], "|cffffd100Quest Autopilot:|r sweep the deck stays manual from now on.")
  g.gossipActive = { { questID = 31, isComplete = true, title = "Sweep the Deck" }, { questID = 32, isComplete = true, title = "Other" } }
  g.gossipAvailable = { { questID = 41, title = "Sweep the Deck" }, { questID = 42, title = "Fresh" } }
  wow.fire("GOSSIP_SHOW")
  eq(g.done(), "Gossip.SelectActiveQuest 32")
  g.gossipActive = { g.gossipActive[1] }
  wow.fire("GOSSIP_SHOW")
  eq(g.done(), "Gossip.SelectActiveQuest 32, Gossip.SelectAvailableQuest 42")
  g.calls = {}
  g.greetingActive = { { title = "Sweep the Deck", complete = true }, { title = "Other", complete = true } }
  g.greetingAvailable = 2
  g.greetingTitles = { "Sweep the Deck", "Fresh" }
  wow.fire("QUEST_GREETING")
  eq(g.done(), "SelectActiveQuest 2")
  g.greetingActive = { g.greetingActive[1] }
  wow.fire("QUEST_GREETING")
  eq(g.done(), "SelectActiveQuest 2, SelectAvailableQuest 2")
  g.quest = { id = 77, title = "Sweep The Deck" }
  wow.fire("QUEST_DETAIL")
  eq(g.done(), "SelectActiveQuest 2, SelectAvailableQuest 2", "the quest window too")
end)

test("a quest kept by ID is found in the greeting window by its ID", function(wow)
  local ns, g = boot(wow)
  wow.slash("/qa manual 61")
  eq(wow.chat[1], "|cffffd100Quest Autopilot:|r Quest 61 stays manual from now on.", "no title known yet")
  g.greetingActive = { { title = "A", complete = true, id = 61 }, { title = "B", complete = true, id = 62 } }
  g.greetingAvailable = 2
  g.greetingIDs = { 61, 63 }
  wow.fire("QUEST_GREETING")
  eq(g.done(), "SelectActiveQuest 2")
  g.greetingActive = { g.greetingActive[1] }
  wow.fire("QUEST_GREETING")
  eq(g.done(), "SelectActiveQuest 2, SelectAvailableQuest 2")
end)

test("a quest link works for adding and handing back", function(wow)
  local ns, g = boot(wow)
  wow.slash("/qa manual |cffffff00|Hquest:83432:80|h[Into the Deep]|h|r")
  eq(wow.chat[1], "|cffffd100Quest Autopilot:|r Into the Deep (83432) stays manual from now on.")
  wow.slash("/qa auto |cffffff00|Hquest:83432:80|h[Into the Deep]|h|r")
  eq(wow.chat[2], "|cffffd100Quest Autopilot:|r Into the Deep (83432) is handled by the autopilot again.")
  eq(ns.ManualCount(ns.manual), 0)
end)

test("/qa auto and /qa list", function(wow)
  local ns, g = boot(wow)
  wow.slash("/qa list")
  eq(wow.chat[1], "|cffffd100Quest Autopilot:|r You keep no quests manual. /qa manual adds the quest you just saw.")
  wow.slash("/qa manual 5")
  wow.slash("/qa manual Zebra Hunt")
  wow.slash("/qa manual apple picking")
  wow.slash("/qa LIST")
  eq(wow.chat[5], "|cffffd100Quest Autopilot:|r Quests you keep manual: 3")
  eq(wow.chat[6], "|cffffd100Quest Autopilot:|r   apple picking")
  eq(wow.chat[7], "|cffffd100Quest Autopilot:|r   Quest 5")
  eq(wow.chat[8], "|cffffd100Quest Autopilot:|r   Zebra Hunt")
  wow.slash("/qa auto zebra hunt")
  eq(wow.chat[9], "|cffffd100Quest Autopilot:|r Zebra Hunt is handled by the autopilot again.")
  wow.slash("/qa auto 6")
  eq(wow.chat[10], "|cffffd100Quest Autopilot:|r Quest 6 is not on your list. /qa list shows it.")
  wow.slash("/qa auto")
  eq(#wow.chat, 13, "nothing named: the help")
  eq(QuestAutopilotDB.manual.ids[5], "")
  eq(QuestAutopilotDB.manual.names["zebra hunt"], nil)
  g.quest = { id = 5 }
  wow.fire("QUEST_DETAIL")
  eq(g.done(), "")
  wow.slash("/qa auto 5")
  wow.fire("QUEST_DETAIL")
  eq(g.done(), "AcceptQuest")
end)

test("/qa dailies leaves daily and weekly quests to the player everywhere", function(wow)
  local ns, g = boot(wow)
  g.quest = { id = 10, title = "Daily", daily = true }
  wow.fire("QUEST_DETAIL")
  eq(g.done(), "AcceptQuest", "off by default: 1.0 behaviour")
  wow.slash("/qa dailies")
  eq(wow.chat[1]:match("Daily and weekly quests: manual%.") ~= nil, true)
  eq(QuestAutopilotDB.settings.manualDailies, true)
  g.calls = {}
  wow.fire("QUEST_DETAIL")
  g.quest = { id = 11, title = "Weekly", weekly = true }
  wow.fire("QUEST_DETAIL")
  -- handing in: the quest window may not say it, the quest log does
  g.quest = { id = 12, title = "Logged daily" }
  g.log[12] = { frequency = 1 }
  wow.fire("QUEST_PROGRESS")
  wow.fire("QUEST_COMPLETE")
  g.gossipActive = { { questID = 12, isComplete = true, frequency = 1 } }
  g.gossipAvailable = { { questID = 13, frequency = 2 } }
  wow.fire("GOSSIP_SHOW")
  g.greetingActive = { { title = "Logged daily", complete = true, id = 12 } }
  g.greetingAvailable = 1
  g.greetingFrequency = { 1 }
  wow.fire("QUEST_GREETING")
  eq(g.done(), "")
  g.quest = { id = 14, title = "Normal" }
  g.log[14] = { frequency = 0 }
  wow.fire("QUEST_DETAIL")
  wow.fire("QUEST_PROGRESS")
  g.gossipAvailable = { { questID = 13, frequency = 2 }, { questID = 15, frequency = 0 } }
  wow.fire("GOSSIP_SHOW")
  eq(g.done(), "AcceptQuest, CompleteQuest, Gossip.SelectAvailableQuest 15", "normal quests still run")
  wow.slash("/qa dailies")
  eq(QuestAutopilotDB.settings.manualDailies, false)
end)

test("1.0 saved data is taken over: settings stay, the list starts empty", function(wow)
  QuestAutopilotDB = { version = 1, settings = { enabled = true, accept = false, turnin = true } }
  local saved = QuestAutopilotDB
  local ns, g = boot(wow)
  eq(QuestAutopilotDB, saved)
  eq(saved.version, 2)
  eq(saved.settings.accept, false)
  eq(saved.settings.manualDailies, false)
  eq(type(saved.manual), "table")
  eq(ns.ManualCount(ns.manual), 0)
  eq(ns.manual, saved.manual, "commands write into the saved table")
  wow.slash("/qa manual 9")
  eq(saved.manual.ids[9], "")
end)

test("a broken list is repaired, good entries stay", function(wow)
  QuestAutopilotDB = { version = 2, manual = { ids = { [5] = "Five", [6] = true, x = "bad" }, names = { ["sweep"] = "Sweep", ["wrong"] = "Other", [3] = "x" } } }
  local ns, g = boot(wow)
  local list = QuestAutopilotDB.manual
  eq(list.ids[5], "Five")
  eq(list.ids[6], "")
  eq(list.ids.x, nil)
  eq(list.names.sweep, "Sweep")
  eq(list.names.wrong, nil)
  eq(list.names[3], nil)
  QuestAutopilotDB = { manual = "broken" }
  ns = boot(wow)
  eq(type(QuestAutopilotDB.manual.ids), "table")
end)

test("secret quest IDs, titles or frequencies never break it", function(wow)
  local ns, g = boot(wow)
  for _, name in ipairs({ "OnDetail", "OnProgress", "OnComplete", "Pick" }) do noSecrets(ns, name) end
  local secret = { secret = true }
  wow.slash("/qa manual 20")
  g.quest = { id = secret, title = secret }
  wow.fire("QUEST_DETAIL")
  eq(g.done(), "AcceptQuest", "an unknown quest is a normal quest")
  wow.slash("/qa manual")
  eq(wow.chat[2]:match("No quest seen yet") ~= nil, true, "nothing usable to remember")
  wow.slash("/qa dailies")
  g.calls = {}
  g.gossipAvailable = { { questID = 21, frequency = secret, title = secret } }
  wow.fire("GOSSIP_SHOW")
  eq(g.done(), "", "with the daily switch on, an unclear frequency is left to the player")
  wow.slash("/qa dailies")
  wow.fire("GOSSIP_SHOW")
  eq(g.done(), "Gossip.SelectAvailableQuest 21")
end)

test("a client without the quest log or quest window details still works", function(wow)
  local ns, g = boot(wow)
  C_QuestLog, GetQuestID, GetTitleText, QuestIsDaily, QuestIsWeekly = nil, nil, nil, nil, nil
  GetActiveQuestID, GetAvailableTitle = nil, nil
  wow.slash("/qa dailies")
  wow.slash("/qa manual 30")
  eq(wow.chat[2], "|cffffd100Quest Autopilot:|r Quest 30 stays manual from now on.")
  wow.fire("QUEST_DETAIL")
  wow.fire("QUEST_PROGRESS")
  g.greetingActive = { { title = "Done", complete = true } }
  g.greetingAvailable = 1
  wow.fire("QUEST_GREETING")
  eq(g.done(), "AcceptQuest, CompleteQuest, SelectActiveQuest 1")
end)
