-- Tests for Quest Autopilot, run by tools/wow/client/run.lua.

-- The quest side of the game, which the stand-in client does not have. Every call that changes
-- something is noted in g.calls; the fields of g are what the game "shows" at the moment.
local function game()
  local g = {
    calls = {}, shift = false, completable = true, choices = 0, money = 0, autoAccept = false,
    gossipActive = {}, gossipAvailable = {}, greetingActive = {}, greetingAvailable = 0,
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
  GetAvailableQuestInfo = function(i) return false, 0, g.greetingRepeatable and g.greetingRepeatable[i] == true end
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
  eq(wow.chat[1], "|cffffd100Quest Autopilot:|r Autopilot is on. Accepting quests: on. Handing in quests: on.")
  wow.slash("/questautopilot OFF ")
  eq(wow.chat[2], "|cffffd100Quest Autopilot:|r Autopilot is off. Accepting quests: on. Handing in quests: on.")
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
  eq(#wow.chat, 4)
  eq(wow.chat[4]:match("/qa accept and /qa turnin switch one half") ~= nil, true)
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
  eq(saved.version, 1)
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

