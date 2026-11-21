-- Tests for Quest Autopilot, run by tools/wow/client/run.lua.

-- The quest side of the game, which the stand-in client does not have. Every call that changes
-- something is noted in g.calls; the fields of g are what the game "shows" at the moment.
local function game()
  local g = {
    calls = {}, shift = false, completable = true, choices = 0, money = 0, autoAccept = false,
    gossipActive = {}, gossipAvailable = {}, greetingActive = {}, greetingAvailable = 0,
    -- 1.1: the quest of the open quest window, quest log entries by ID, greeting window details
    quest = {}, log = {}, titles = {}, greetingIDs = {}, greetingTitles = {}, greetingFrequency = {},
    -- 1.2: the dialogue options of the conversation window
    options = {},
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
    GetOptions = function() return g.options end,
    SelectOption = call("Gossip.SelectOption"),
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

-- 1.3: reward choices of the reward window. list[i] = { name, id, count, price }; a price of nil
-- means the game has not loaded that item yet. Builds the reward buttons the game would show.
local function rewardsGame(g, list)
  g.rewards, g.choices, g.requests = list, #list, {}
  local function find(item)
    local id = type(item) == "number" and item or tonumber(tostring(item):match("item:(%d+)"))
    for _, r in ipairs(g.rewards) do if r.id == id then return r end end
  end
  GetQuestItemLink = function(kind, i)
    local r = kind == "choice" and g.rewards[i]
    if r then return r.link or ("|cff1eff00|Hitem:" .. r.id .. "::|h[" .. r.name .. "]|h|r") end
  end
  GetQuestItemInfo = function(kind, i)
    local r = kind == "choice" and g.rewards[i]
    if r then return r.name, 134400, r.count or 1, 2, true, r.id end
  end
  C_Item = {
    GetItemInfo = function(item)
      local r = find(item)
      if r and r.price ~= nil then return r.name, "link", 2, 100, 80, "Armor", "Cloth", 1, "INVTYPE_CHEST", 134400, r.price end
    end,
    RequestLoadItemDataByID = function(id) g.requests[#g.requests + 1] = id end,
  }
  local buttons = {}
  for i = 1, #list do
    local b = CreateFrame("Button")
    b.type = "choice"
    b.GetID = function() return i end
    buttons[i] = b
  end
  local fixed = CreateFrame("Button") -- a reward that comes anyway, listed after the choices
  fixed.type = "reward"
  fixed.GetID = function() return 1 end
  buttons[#buttons + 1] = fixed
  QuestInfoRewardsFrame = { RewardButtons = buttons }
  return buttons
end

test("addon defines only its own globals", function(wow, installed, before)
  local g = game()
  rewardsGame(g, { { name = "Cloak", id = 1, price = 10 }, { name = "Ring", id = 2, price = 99 } })
  local stubs = {}
  for k in pairs(_G) do stubs[k] = true end
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("PLAYER_LOGIN")
  wow.fire("QUEST_DETAIL")
  wow.slash("/qa")
  wow.slash("/qa gossip")
  wow.fire("GOSSIP_SHOW")
  wow.fire("GOSSIP_CONFIRM", 1, "Sure?", 0)
  wow.fire("GOSSIP_CLOSED")
  wow.fire("QUEST_COMPLETE")
  wow.fire("GET_ITEM_INFO_RECEIVED", 2, true)
  wow.fire("QUEST_FINISHED")
  wow.slash("/qa hint off")
  eq(wow.chat[#wow.chat], "|cffffd100Quest Autopilot:|r Reward hint is off.")
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
  eq(wow.chat[1], "|cffffd100Quest Autopilot:|r Autopilot is on. Accepting quests: on. Handing in quests: on. Daily and weekly quests: automatic. Only dialogue option: off. Reward hint: on. Kept manual: 0.")
  wow.slash("/questautopilot OFF ")
  eq(wow.chat[2], "|cffffd100Quest Autopilot:|r Autopilot is off. Accepting quests: on. Handing in quests: on. Daily and weekly quests: automatic. Only dialogue option: off. Reward hint: on. Kept manual: 0.")
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
  eq(#wow.chat, 8, "five help lines")
  eq(wow.chat[4]:match("/qa accept and /qa turnin switch one half") ~= nil, true)
  eq(wow.chat[5]:match("/qa manual keeps the quest you just saw manual") ~= nil, true)
  eq(wow.chat[6]:match("/qa dailies leaves all daily and weekly quests to you") ~= nil, true)
  eq(wow.chat[7]:match("/qa gossip picks the only dialogue option") ~= nil, true)
  eq(wow.chat[8]:match("/qa hint on or /qa hint off") ~= nil, true)
  wow.slash("/qa on now")
  eq(#wow.chat, 13, "a known word with something after it is not a switch")
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
  eq(saved.version, 4)
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
  eq(#wow.chat, 15, "nothing named: the help")
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
  eq(saved.version, 4)
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

-- 1.2: the only dialogue option ---------------------------------------------------------------------

local NONE = {} -- stands for nil in the option helpers below (pairs skips nil)

local TALK, VENDOR, TAXI, TRAINER, BANKER, INNKEEPER = 132053, 132060, 132057, 132058, 132050, 132052

-- A dialogue option as C_GossipInfo.GetOptions lists it.
local function option(id, extra)
  local o = { gossipOptionID = id, name = "Tell me more.", icon = TALK, status = 0, rewards = {}, flags = 0, orderIndex = 0 }
  for k, v in pairs(extra or {}) do if v == NONE then o[k] = nil else o[k] = v end end
  return o
end

local function gossipOn(wow)
  local ns, g = boot(wow)
  wow.slash("/qa gossip")
  wow.chat = {}
  return ns, g
end

local function plain(extra)
  local o = { id = 7, icon = 132053, status = 0, rewards = 0, spell = false, auto = false }
  for k, v in pairs(extra or {}) do if v == NONE then o[k] = nil else o[k] = v end end
  return o
end

test("decision: only a plain line of conversation is safe to pick", function(wow)
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  eq(ns.PlainOption(plain()), true)
  eq(ns.PlainOption(plain({ status = NONE })), true, "no status given")
  eq(ns.PlainOption(plain({ override = 132053 })), true)
  eq(ns.PlainOption(plain({ icon = VENDOR })), false, "shop")
  eq(ns.PlainOption(plain({ icon = TAXI })), false, "flight map")
  eq(ns.PlainOption(plain({ icon = TRAINER })), false, "trainer")
  eq(ns.PlainOption(plain({ icon = BANKER })), false, "bank")
  eq(ns.PlainOption(plain({ icon = INNKEEPER })), false, "innkeeper")
  eq(ns.PlainOption(plain({ icon = NONE })), false, "no icon known")
  eq(ns.PlainOption(plain({ override = VENDOR })), false, "the icon shown is a shop")
  eq(ns.PlainOption(plain({ status = 1 })), false, "unavailable")
  eq(ns.PlainOption(plain({ status = 2 })), false, "locked")
  eq(ns.PlainOption(plain({ rewards = 1 })), false, "lists a reward")
  eq(ns.PlainOption(plain({ rewards = NONE })), false, "rewards unknown")
  eq(ns.PlainOption(plain({ spell = true })), false, "casts a spell")
  eq(ns.PlainOption(plain({ auto = true })), false, "the game's window picks it itself")
  eq(ns.PlainOption(plain({ blocked = true })), false, "asked for a confirmation before")
  eq(ns.PlainOption(plain({ id = NONE })), false)
  eq(ns.PlainOption({}), false)
  eq(ns.PlainOption(nil), false)
end)

test("decision: exactly one option and no quests, switched on and not paused", function(wow)
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  local function q(extra)
    local t = { enabled = true, gossip = true, paused = false, quests = 0, options = { plain() } }
    for k, v in pairs(extra or {}) do if v == NONE then t[k] = nil else t[k] = v end end
    return t
  end
  eq(ns.PickOption(q()), 7)
  eq(ns.PickOption(q({ gossip = false })), nil, "the switch is off")
  eq(ns.PickOption(q({ enabled = false })), nil, "the autopilot is off")
  eq(ns.PickOption(q({ paused = true })), nil, "Shift")
  eq(ns.PickOption(q({ quests = 1 })), nil, "there is a quest")
  eq(ns.PickOption(q({ quests = NONE })), nil, "quests unknown")
  eq(ns.PickOption(q({ options = {} })), nil)
  eq(ns.PickOption(q({ options = { plain(), plain({ id = 8 }) } })), nil, "a real choice is the player's")
  eq(ns.PickOption(q({ options = { plain({ icon = VENDOR }) } })), nil)
  eq(ns.PickOption(q({ chosen = { [7] = true }, picks = 1 })), nil, "the same line twice is a loop")
  eq(ns.PickOption(q({ chosen = { [6] = true }, picks = 1 })), 7)
  eq(ns.PickOption(q({ chosen = {}, picks = ns.MAX_OPTIONS })), nil, "at most MAX_OPTIONS in one conversation")
  eq(ns.DEFAULTS.gossip, false)
end)

test("off by default: a single line of conversation is left to the player", function(wow)
  local ns, g = boot(wow)
  g.options = { option(51) }
  wow.fire("GOSSIP_SHOW")
  eq(g.done(), "")
  eq(QuestAutopilotDB.settings.gossip, false)
end)

test("/qa gossip: the only line of conversation is picked, page by page", function(wow)
  local ns, g = boot(wow)
  wow.slash("/qa gossip")
  eq(wow.chat[1]:match("Only dialogue option: on%. Reward hint: on%. Kept manual: 0%.$") ~= nil, true)
  eq(QuestAutopilotDB.settings.gossip, true)
  g.options = { option(51) }
  wow.fire("GOSSIP_SHOW")
  eq(g.done(), "Gossip.SelectOption 51")
  g.options = { option(52, { flags = 1 }) } -- the next page, a line marked (Quest)
  wow.clock = wow.clock + 0.5
  wow.fire("GOSSIP_SHOW")
  eq(g.done(), "Gossip.SelectOption 51, Gossip.SelectOption 52")
  g.options = { option(52) } -- the character says the same again: no loop
  wow.fire("GOSSIP_SHOW")
  eq(g.done(), "Gossip.SelectOption 51, Gossip.SelectOption 52")
  leave(wow, "GOSSIP_CLOSED")
  wow.fire("GOSSIP_SHOW") -- a new conversation later: picked again
  eq(g.done(), "Gossip.SelectOption 51, Gossip.SelectOption 52, Gossip.SelectOption 52")
  eq(#wow.chat, 1, "picking is silent")
  wow.slash("/qa gossip")
  eq(QuestAutopilotDB.settings.gossip, false)
  leave(wow, "GOSSIP_CLOSED")
  g.calls = {}
  wow.fire("GOSSIP_SHOW")
  eq(g.done(), "")
end)

test("never while the character lists quests, also quests the autopilot leaves alone", function(wow)
  local ns, g = gossipOn(wow)
  g.options = { option(51) }
  g.gossipAvailable = { { questID = 2 } }
  wow.fire("GOSSIP_SHOW")
  eq(g.done(), "Gossip.SelectAvailableQuest 2", "the quest comes first")
  g.calls = {}
  g.gossipAvailable = { { questID = 3, repeatable = true } }
  wow.fire("GOSSIP_SHOW")
  g.gossipAvailable = {}
  g.gossipActive = { { questID = 4, isComplete = false } }
  wow.fire("GOSSIP_SHOW")
  g.gossipActive = { { questID = { secret = true }, isComplete = true } }
  wow.fire("GOSSIP_SHOW")
  eq(g.done(), "", "a quest the player handles, an unfinished quest, an unreadable quest")
  wow.slash("/qa manual 5")
  g.gossipActive = { { questID = 5, isComplete = true } }
  wow.fire("GOSSIP_SHOW")
  eq(g.done(), "")
end)

test("never shops, trainers, banks, flight maps, rewards, spells or a real choice", function(wow)
  local ns, g = gossipOn(wow)
  local cases = {
    { option(60, { icon = VENDOR, name = "Let me browse your goods." }) },
    { option(61, { icon = TAXI, name = "Show me where I can fly." }) },
    { option(62, { icon = TRAINER, name = "Train me." }) },
    { option(63, { icon = BANKER, name = "I would like to check my deposit box." }) },
    { option(64, { icon = INNKEEPER, name = "Make this inn your home." }) },
    { option(65, { overrideIconID = VENDOR }) },
    { option(66, { rewards = { { id = 1, quantity = 1, rewardType = 0 } } }) },
    { option(67, { spellID = 1234 }) },
    { option(68, { status = 2 }) },
    { option(69, { selectOptionWhenOnlyOption = true }) },
    { option(70, { gossipOptionID = NONE }) },
    { option(71), option(72) },
    {},
  }
  for _, options in ipairs(cases) do
    g.options = options
    wow.fire("GOSSIP_SHOW")
    leave(wow, "GOSSIP_CLOSED")
  end
  eq(g.done(), "")
end)

test("Shift and /qa off stop it, like every other step", function(wow)
  local ns, g = gossipOn(wow)
  g.options = { option(51) }
  g.shift = true
  wow.fire("GOSSIP_SHOW")
  g.shift = false
  g.options = { option(52) }
  wow.clock = wow.clock + 0.5
  wow.fire("GOSSIP_SHOW")
  eq(g.done(), "", "the whole conversation is paused")
  leave(wow, "GOSSIP_CLOSED")
  wow.slash("/qa off")
  wow.fire("GOSSIP_SHOW")
  eq(g.done(), "")
  wow.slash("/qa on")
  leave(wow, "GOSSIP_CLOSED")
  wow.fire("GOSSIP_SHOW")
  eq(g.done(), "Gossip.SelectOption 52")
end)

test("at most five lines in one conversation", function(wow)
  local ns, g = gossipOn(wow)
  for id = 1, 8 do
    g.options = { option(id) }
    wow.fire("GOSSIP_SHOW")
    wow.clock = wow.clock + 0.2
  end
  eq(g.done(), "Gossip.SelectOption 1, Gossip.SelectOption 2, Gossip.SelectOption 3, Gossip.SelectOption 4, Gossip.SelectOption 5")
end)

test("an option that asks for a confirmation is left to the player from then on", function(wow)
  local ns, g = gossipOn(wow)
  g.options = { option(80, { name = "Take me to the camp." }) }
  wow.fire("GOSSIP_SHOW")
  eq(g.done(), "Gossip.SelectOption 80")
  wow.clock = wow.clock + 0.1
  wow.fire("GOSSIP_CONFIRM", 80, "Pay 5 gold?", 50000) -- the game asks the player; the autopilot never answers
  eq(#wow.chat, 1)
  eq(wow.chat[1], "|cffffd100Quest Autopilot:|r This dialogue option asks you to confirm, so the choice is yours. The autopilot will not pick it again.")
  eq(QuestAutopilotDB.blocked[80], true)
  leave(wow, "GOSSIP_CLOSED")
  wow.fire("GOSSIP_SHOW")
  eq(g.done(), "Gossip.SelectOption 80", "not picked again")
  -- the next login still knows it
  for _, f in ipairs(wow.frames) do f.events = {} end
  wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("PLAYER_LOGIN")
  wow.fire("GOSSIP_SHOW")
  eq(g.done(), "Gossip.SelectOption 80")
  g.options = { option(81) }
  wow.fire("GOSSIP_SHOW")
  eq(g.done(), "Gossip.SelectOption 80, Gossip.SelectOption 81", "other options still run")
end)

test("a confirmation the player caused alone changes nothing", function(wow)
  local ns, g = gossipOn(wow)
  wow.fire("GOSSIP_CONFIRM", 90, "Sure?", 0)
  g.options = { option(91) }
  wow.fire("GOSSIP_SHOW")
  wow.clock = wow.clock + 30 -- long after the pick, the player clicked something else
  wow.fire("GOSSIP_ENTER_CODE", 92)
  eq(#wow.chat, 0)
  eq(next(QuestAutopilotDB.blocked), nil)
  eq(g.done(), "Gossip.SelectOption 91")
end)

test("secret option data or lists are never picked", function(wow)
  local ns, g = gossipOn(wow)
  local secret = { secret = true }
  local fields = { "gossipOptionID", "icon", "overrideIconID", "status", "rewards", "spellID", "selectOptionWhenOnlyOption" }
  for _, field in ipairs(fields) do
    g.options = { option(51, { [field] = secret }) }
    wow.fire("GOSSIP_SHOW")
    leave(wow, "GOSSIP_CLOSED")
  end
  g.options = { secret }
  wow.fire("GOSSIP_SHOW")
  leave(wow, "GOSSIP_CLOSED")
  g.options = secret
  wow.fire("GOSSIP_SHOW")
  leave(wow, "GOSSIP_CLOSED")
  g.options = { option(51) }
  g.gossipAvailable = secret
  wow.fire("GOSSIP_SHOW")
  eq(g.done(), "")
end)

test("a client without the option functions does not break it", function(wow)
  local ns, g = gossipOn(wow)
  g.options = { option(51) }
  C_GossipInfo.SelectOption = nil
  wow.fire("GOSSIP_SHOW")
  leave(wow, "GOSSIP_CLOSED")
  C_GossipInfo.GetOptions = nil
  wow.fire("GOSSIP_SHOW")
  eq(g.done(), "")
end)

test("1.1 saved data is taken over: everything stays, the gossip switch starts off", function(wow)
  QuestAutopilotDB = { version = 2, settings = { enabled = true, accept = false, turnin = true, manualDailies = true }, manual = { ids = { [5] = "Five" }, names = {} } }
  local saved = QuestAutopilotDB
  local ns, g = boot(wow)
  eq(saved.version, 4)
  eq(saved.settings.accept, false)
  eq(saved.settings.manualDailies, true)
  eq(saved.settings.gossip, false)
  eq(saved.manual.ids[5], "Five")
  eq(type(saved.blocked), "table")
  eq(next(saved.blocked), nil)
  QuestAutopilotDB = { version = 3, blocked = { [80] = true, [81] = "x", x = true } }
  boot(wow)
  eq(QuestAutopilotDB.blocked[80], true)
  eq(QuestAutopilotDB.blocked[81], nil)
  eq(QuestAutopilotDB.blocked.x, nil)
  QuestAutopilotDB = { blocked = "broken" }
  boot(wow)
  eq(type(QuestAutopilotDB.blocked), "table")
end)

test("a confirmation before login does nothing", function(wow)
  local g = game()
  wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("GOSSIP_CONFIRM", 1, "Sure?", 0)
  g.options = { option(51) }
  wow.fire("GOSSIP_SHOW")
  eq(g.done(), "")
  eq(#wow.chat, 0)
end)

-- 1.3: the reward hint --------------------------------------------------------------------------------

local HINT = "|cffffd100Quest Autopilot:|r Highest vendor value: "
local CHOOSE = "|cffffd100Quest Autopilot:|r This quest has several rewards. Pick one yourself."
local function link(id, name) return "|cff1eff00|Hitem:" .. id .. "::|h[" .. name .. "]|h|r" end

test("decision: the reward with the highest vendor value, only when every price is known", function(wow)
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  local function best(...)
    local list = {}
    for i, v in ipairs({ ... }) do list[i] = { value = v ~= false and v or nil } end
    return ns.BestReward(list)
  end
  local index, value = best(100, 500, 200)
  eq(index, 2)
  eq(value, 500)
  eq(best(500, 100, 100), 1, "a tie further down does not matter")
  eq(best(100, false, 200), nil, "a price is not known yet")
  eq(best(0, 0, 0), nil, "nothing is worth anything")
  eq(best(0, 300), 2)
  eq(best(300, 300, 5), nil, "two rewards share the top price: no hint")
  eq(best(300), nil, "one reward is no choice")
  eq(best(-1, 5), nil)
  eq(ns.BestReward(nil), nil)
  eq(ns.BestReward({ 5, 6 }), nil, "broken entries")
  eq(ns.StackValue(25, 4), 100)
  eq(ns.StackValue(25, nil), 25)
  eq(ns.StackValue(25, 0), 25)
  eq(ns.StackValue(nil, 3), nil)
  eq(ns.StackValue(0 / 0, 1), nil)
  eq(ns.MoneyText(12000), "1g 20s")
  eq(ns.MoneyText(12003), "1g 20s 3c")
  eq(ns.MoneyText(4503), "45s 3c")
  eq(ns.MoneyText(7), "7c")
  eq(ns.MoneyText(0), "0c")
  eq(ns.MoneyText(1000000), "100g")
  eq(ns.WantHint({ enabled = true, hint = true, choices = 2 }), true)
  eq(ns.WantHint({ enabled = true, hint = true, choices = 1 }), false)
  eq(ns.WantHint({ enabled = true, hint = true, choices = nil }), false)
  eq(ns.WantHint({ enabled = true, hint = false, choices = 3 }), false)
  eq(ns.WantHint({ enabled = false, hint = true, choices = 3 }), false)
  eq(ns.WantHint({ enabled = true, hint = true, paused = true, choices = 3 }), false)
  eq(ns.DEFAULTS.hint, true)
end)

test("a choice of rewards: a coin on the most valuable one and one chat line, nothing is picked", function(wow)
  local ns, g = boot(wow)
  local buttons = rewardsGame(g, {
    { name = "Cloak", id = 11, price = 4500 },
    { name = "Staff", id = 12, price = 12000 },
    { name = "Ring", id = 13, price = 900 },
  })
  wow.fire("QUEST_COMPLETE")
  eq(g.done(), "", "the autopilot never picks")
  eq(#wow.chat, 2)
  eq(wow.chat[1], CHOOSE)
  eq(wow.chat[2], HINT .. link(12, "Staff") .. " (1g 20s). The choice is still yours.")
  eq(ns.mark:IsShown(), true)
  eq(ns.mark.button, buttons[2])
  eq(ns.mark.icon.kind, "Texture")
  wow.fire("QUEST_FINISHED")
  eq(ns.mark:IsShown(), false, "the coin goes with the window")
  eq(rawget(ns.mark, "button"), nil)
end)

test("a stack counts with all its items", function(wow)
  local ns, g = boot(wow)
  rewardsGame(g, { { name = "Gem", id = 21, price = 5000 }, { name = "Potion", id = 22, price = 500, count = 20 } })
  wow.fire("QUEST_COMPLETE")
  eq(wow.chat[2], HINT .. link(22, "Potion") .. " (1g). The choice is still yours.")
end)

test("a price the game loads later completes the hint, once", function(wow)
  local ns, g = boot(wow)
  local buttons = rewardsGame(g, { { name = "Cloak", id = 31, price = 100 }, { name = "Staff", id = 32 } })
  wow.fire("QUEST_COMPLETE")
  eq(#wow.chat, 1, "a price is missing: no hint yet")
  eq(g.requests[1], 32, "the game is asked to load the item")
  eq(ns.mark, nil)
  g.rewards[2].price = 250
  wow.fire("GET_ITEM_INFO_RECEIVED", 32, true)
  eq(#wow.chat, 2)
  eq(wow.chat[2], HINT .. link(32, "Staff") .. " (2s 50c). The choice is still yours.")
  eq(ns.mark.button, buttons[2])
  wow.fire("GET_ITEM_INFO_RECEIVED", 99, true)
  eq(#wow.chat, 2, "said once")
  wow.fire("QUEST_FINISHED")
  g.rewards[1].price = 999999
  wow.fire("GET_ITEM_INFO_RECEIVED", 31, true)
  eq(#wow.chat, 2, "nothing after the window has closed")
end)

test("no hint when nothing is worth anything or two rewards share the top price", function(wow)
  local ns, g = boot(wow)
  rewardsGame(g, { { name = "Token", id = 41, price = 0 }, { name = "Badge", id = 42, price = 0 } })
  wow.fire("QUEST_COMPLETE")
  wow.fire("QUEST_FINISHED")
  rewardsGame(g, { { name = "Left", id = 43, price = 700 }, { name = "Right", id = 44, price = 700 } })
  wow.fire("QUEST_COMPLETE")
  wow.fire("GET_ITEM_INFO_RECEIVED", 43, true)
  eq(#wow.chat, 2, "only the line about several rewards, twice")
  eq(wow.chat[2], CHOOSE)
  eq(ns.mark, nil)
end)

test("/qa hint on, off and alone; it is saved and /qa off, Shift and a single reward stop it", function(wow)
  local ns, g = boot(wow)
  rewardsGame(g, { { name = "Cloak", id = 51, price = 100 }, { name = "Staff", id = 52, price = 200 } })
  wow.slash("/qa hint off")
  eq(QuestAutopilotDB.settings.hint, false)
  wow.fire("QUEST_COMPLETE")
  eq(#wow.chat, 2)
  eq(wow.chat[2], CHOOSE)
  wow.slash("/qa HINT On")
  eq(wow.chat[3], "|cffffd100Quest Autopilot:|r Reward hint is on: when a quest lets you choose, the reward a vendor pays most for gets a coin.")
  eq(QuestAutopilotDB.settings.hint, true)
  wow.slash("/qa hint")
  eq(QuestAutopilotDB.settings.hint, false, "alone it switches")
  wow.slash("/qa hint")
  eq(QuestAutopilotDB.settings.hint, true)
  wow.slash("/qa hint maybe")
  eq(wow.chat[6]:match("^|cffffd100Quest Autopilot:|r /qa shows the state") ~= nil, true, "an unknown word shows the help")
  eq(QuestAutopilotDB.settings.hint, true)
  wow.chat = {}
  wow.slash("/qa off")
  wow.fire("QUEST_COMPLETE")
  eq(#wow.chat, 1, "switched off: only the state line")
  wow.slash("/qa on")
  leave(wow)
  g.shift = true
  wow.fire("QUEST_COMPLETE")
  eq(#wow.chat, 2, "Shift: nothing")
  leave(wow)
  g.shift = false
  g.rewards = { g.rewards[1] }
  g.choices = 1
  wow.fire("QUEST_COMPLETE")
  eq(g.done(), "GetQuestReward 1", "one reward: taken as before, no hint")
  eq(#wow.chat, 2)
end)

test("a quest kept manual still gets the hint, but the autopilot stays out", function(wow)
  local ns, g = boot(wow)
  rewardsGame(g, { { name = "Cloak", id = 61, price = 300 }, { name = "Staff", id = 62, price = 200 } })
  wow.slash("/qa manual 600")
  g.quest = { id = 600, title = "Mine" }
  wow.fire("QUEST_COMPLETE")
  eq(#wow.chat, 2)
  eq(wow.chat[2], HINT .. link(61, "Cloak") .. " (3s). The choice is still yours.")
  eq(g.done(), "")
end)

test("a different reward window: only the chat line", function(wow)
  local ns, g = boot(wow)
  local list = { { name = "Cloak", id = 71, price = 300 }, { name = "Staff", id = 72, price = 200 } }
  rewardsGame(g, list)
  QuestInfoRewardsFrame = nil
  wow.fire("QUEST_COMPLETE")
  eq(wow.chat[2], HINT .. link(71, "Cloak") .. " (3s). The choice is still yours.")
  eq(ns.mark, nil)
  leave(wow)
  local buttons = rewardsGame(g, list)
  for _, b in ipairs(buttons) do b.type = nil end
  wow.fire("QUEST_COMPLETE")
  eq(ns.mark, nil, "buttons the game does not mark as choices are left alone")
  leave(wow)
  buttons = rewardsGame(g, list)
  buttons[1]:Hide()
  wow.fire("QUEST_COMPLETE")
  eq(ns.mark, nil, "a hidden button is not marked")
  leave(wow)
  buttons = rewardsGame(g, list)
  QuestInfoRewardsFrame.RewardButtons = "broken"
  wow.fire("QUEST_COMPLETE")
  eq(#wow.chat, 8)
  eq(ns.mark, nil)
end)

test("the next reward window takes the coin away", function(wow)
  local ns, g = boot(wow)
  rewardsGame(g, { { name = "Cloak", id = 81, price = 300 }, { name = "Staff", id = 82, price = 200 } })
  wow.fire("QUEST_COMPLETE")
  eq(ns.mark:IsShown(), true)
  rewardsGame(g, { { name = "Ring", id = 83 }, { name = "Belt", id = 84 } })
  wow.fire("QUEST_COMPLETE") -- no QUEST_FINISHED in between
  eq(ns.mark:IsShown(), false)
end)

test("secret or missing reward details give no hint and no error", function(wow)
  local ns, g = boot(wow)
  local secret = { secret = true }
  rewardsGame(g, { { name = "Cloak", id = 91, price = secret }, { name = "Staff", id = 92, price = 200 } })
  wow.fire("QUEST_COMPLETE")
  leave(wow)
  rewardsGame(g, { { name = "Cloak", id = 91, price = 100, count = secret }, { name = "Staff", id = 92, price = 200 } })
  wow.fire("QUEST_COMPLETE")
  leave(wow)
  rewardsGame(g, { { name = "Cloak", id = 91, price = 100 }, { name = "Staff", id = 92, price = 200 } })
  C_Item.GetItemInfo = function() error("not now") end
  wow.fire("QUEST_COMPLETE")
  leave(wow)
  g.choices = secret
  wow.fire("QUEST_COMPLETE")
  eq(#wow.chat, 3, "only the lines about several rewards")
  eq(ns.mark, nil)
end)

test("a client with only the older item functions still gets the hint", function(wow)
  local ns, g = boot(wow)
  rewardsGame(g, { { name = "Cloak", id = 101, price = 300 }, { name = "Staff", id = 102, price = 200 } })
  GetItemInfo = C_Item.GetItemInfo
  C_Item = nil
  GetQuestItemLink = nil
  wow.fire("QUEST_COMPLETE")
  eq(wow.chat[2], HINT .. "Cloak (3s). The choice is still yours.", "the name instead of the link")
  leave(wow)
  GetItemInfo, GetQuestItemInfo = nil, nil
  wow.fire("QUEST_COMPLETE")
  eq(#wow.chat, 3)
end)

test("the hint waits a moment for the game to lay out its reward buttons", function(wow)
  local ns, g = boot(wow)
  local timers = {}
  C_Timer = { After = function(_, fn) timers[#timers + 1] = fn end }
  local buttons = rewardsGame(g, { { name = "Cloak", id = 111, price = 300 }, { name = "Staff", id = 112, price = 200 } })
  wow.fire("QUEST_COMPLETE")
  eq(#wow.chat, 1)
  timers[1]()
  eq(#wow.chat, 2)
  eq(ns.mark.button, buttons[1])
  leave(wow)
  wow.fire("QUEST_COMPLETE")
  wow.fire("QUEST_FINISHED") -- closed before the moment passed
  timers[2]()
  eq(#wow.chat, 3)
end)

test("1.2 saved data is taken over: everything stays, the reward hint starts on", function(wow)
  QuestAutopilotDB = { version = 3, settings = { enabled = true, accept = true, turnin = false, manualDailies = true, gossip = true },
    manual = { ids = { [7] = "Seven" }, names = {} }, blocked = { [80] = true } }
  local saved = QuestAutopilotDB
  local ns, g = boot(wow)
  eq(saved.version, 4)
  eq(saved.settings.hint, true)
  eq(saved.settings.turnin, false)
  eq(saved.settings.gossip, true)
  eq(saved.manual.ids[7], "Seven")
  eq(saved.blocked[80], true)
  QuestAutopilotDB = { version = 4, settings = { hint = false } }
  boot(wow)
  eq(QuestAutopilotDB.settings.hint, false, "a switched-off hint stays off")
end)

-- 1.4: German

local P = "|cffffd100Quest Autopilot:|r "

-- A German client: its language and the coin letters it has (GlobalStrings). The stand-in client
-- has none.
local function germanClient(wow)
  wow.locale = "deDE"
  GOLD_AMOUNT_SYMBOL, SILVER_AMOUNT_SYMBOL, COPPER_AMOUNT_SYMBOL = "G", "S", "K"
end

-- Every placeholder of a text, in order: "%d", "%s", "%%".
local function placeholders(text)
  local out = {}
  for p in text:gmatch("%%[%d%.]*[%a%%]") do out[#out + 1] = p end
  return table.concat(out, " ")
end

test("coin letters come from the game, English when the client has none", function(wow)
  local ns = boot(wow)
  eq(ns.MoneyText(12003), "1g 20s 3c")
  germanClient(wow)
  eq(ns.MoneyText(12003), "1G 20S 3K")
  eq(ns.MoneyText(0), "0K")
  eq(ns.MoneyText(1000000), "100G")
  COPPER_AMOUNT_SYMBOL = ""
  eq(ns.MoneyText(7), "7c", "an empty letter stays English")
  SILVER_AMOUNT_SYMBOL = 5
  eq(ns.MoneyText(4503), "45s 3c", "so does one that is no text")
end)

test("German client: state, switches and help in German, the command words stay English", function(wow)
  germanClient(wow)
  local ns, g = boot(wow)
  wow.slash("/qa")
  eq(wow.chat[1], P .. "Autopilot ist an. Quests annehmen: an. Quests abgeben: an. Tägliche und wöchentliche Quests: automatisch. Einzige Gesprächsoption: aus. Belohnungshinweis: an. Manuell: 0.")
  wow.slash("/qa dailies")
  eq(wow.chat[2], P .. "Autopilot ist an. Quests annehmen: an. Quests abgeben: an. Tägliche und wöchentliche Quests: manuell. Einzige Gesprächsoption: aus. Belohnungshinweis: an. Manuell: 0.")
  wow.slash("/qa off")
  eq(wow.chat[3]:match("^.-Autopilot ist aus%. ") ~= nil, true)
  eq(QuestAutopilotDB.settings.enabled, false)
  wow.slash("/qa aus")
  eq(#wow.chat, 8, "German command words are not commands: the five help lines")
  eq(wow.chat[4], P .. "/qa zeigt den Stand, /qa on und /qa off schalten alles, /qa accept und /qa turnin schalten das Annehmen oder das Abgeben. Halte Shift gedrückt, während du jemanden ansprichst, um zu pausieren.")
  eq(wow.chat[5], P .. "/qa manual stellt die Quest, die du gerade gesehen hast, auf manuell, /qa manual <ID, Name oder Questlink> fügt eine hinzu, /qa auto <ID oder Name> gibt sie dem Autopiloten zurück, /qa list zeigt sie.")
  eq(wow.chat[6], P .. "/qa dailies überlässt dir alle täglichen und wöchentlichen Quests, nochmal eingeben macht es rückgängig.")
  eq(wow.chat[7], P .. "/qa gossip wählt die einzige Gesprächsoption eines NPCs, der keine Quests für dich hat, nochmal eingeben macht es rückgängig.")
  eq(wow.chat[8], P .. "/qa hint on oder /qa hint off: markiert die Belohnung, für die ein Händler am meisten zahlt, wenn du bei einer Quest wählen darfst. Der Hinweis wählt nie für dich.")
  wow.slash("/qa hint off")
  eq(wow.chat[9], P .. "Der Belohnungshinweis ist aus.")
  wow.slash("/qa hint on")
  eq(wow.chat[10], P .. "Der Belohnungshinweis ist an: Wenn du bei einer Quest wählen darfst, bekommt die Belohnung, für die ein Händler am meisten zahlt, eine Münze.")
end)

test("German client: quests kept manual in German, quest names from the game", function(wow)
  germanClient(wow)
  local ns, g = boot(wow)
  wow.slash("/qa manual")
  eq(wow.chat[1], P .. "Noch keine Quest gesehen. Öffne eine mit gedrückter Shift-Taste und gib /qa manual ein, oder nutze /qa manual <ID oder Name>.")
  wow.slash("/qa list")
  eq(wow.chat[2], P .. "Du hast keine manuellen Quests. /qa manual fügt die Quest hinzu, die du gerade gesehen hast.")
  g.titles[4242] = "Füttert die Greifen"
  wow.slash("/qa manual 4242")
  eq(wow.chat[3], P .. "Füttert die Greifen (4242) bleibt ab jetzt manuell.")
  wow.slash("/qa manual 4242")
  eq(wow.chat[4], P .. "Füttert die Greifen (4242) ist schon manuell.")
  wow.slash("/qa manual 61")
  eq(wow.chat[5], P .. "Quest 61 bleibt ab jetzt manuell.")
  wow.slash("/qa list")
  eq(wow.chat[6], P .. "Manuelle Quests: 2")
  eq(wow.chat[7], P .. "  Füttert die Greifen (4242)")
  eq(wow.chat[8], P .. "  Quest 61")
  wow.slash("/qa auto 61")
  eq(wow.chat[9], P .. "Quest 61 übernimmt wieder der Autopilot.")
  wow.slash("/qa auto 6")
  eq(wow.chat[10], P .. "Quest 6 steht nicht auf deiner Liste. /qa list zeigt sie.")
  wow.slash("/qa")
  eq(wow.chat[11]:match("Manuell: 1%.$") ~= nil, true)
end)

test("German client: rewards, the reward hint with the game's coin letters and the dialogue question in German", function(wow)
  germanClient(wow)
  local ns, g = boot(wow)
  rewardsGame(g, {
    { name = "Umhang", id = 11, price = 4500 },
    { name = "Stab", id = 12, price = 12003 },
  })
  wow.fire("QUEST_COMPLETE")
  eq(g.done(), "", "the autopilot never picks")
  eq(wow.chat[1], P .. "Diese Quest hat mehrere Belohnungen. Wähle selbst eine aus.")
  eq(wow.chat[2], P .. "Höchster Verkaufswert beim Händler: " .. link(12, "Stab") .. " (1G 20S 3K). Die Wahl bleibt bei dir.")
  leave(wow)
  wow.slash("/qa gossip")
  wow.chat = {}
  g.options = { option(80) }
  wow.fire("GOSSIP_SHOW")
  wow.clock = wow.clock + 0.1
  wow.fire("GOSSIP_CONFIRM", 80, "5 Gold bezahlen?", 50000)
  eq(wow.chat[1], P .. "Diese Gesprächsoption verlangt eine Bestätigung, also entscheidest du. Der Autopilot wählt sie nicht noch einmal.")
end)

test("German texts keep every placeholder of the English text, in order", function(wow)
  wow.locale = "deDE"
  local ns = boot(wow)
  local n = 0
  for key, text in pairs(ns.L) do
    n = n + 1
    eq(placeholders(text), placeholders(key), key)
  end
  eq(n, 24, "every text on screen has its German one")
end)

test("an English client keeps the English texts and the game's English coin letters", function(wow)
  wow.locale = "enUS"
  GOLD_AMOUNT_SYMBOL, SILVER_AMOUNT_SYMBOL, COPPER_AMOUNT_SYMBOL = "g", "s", "c"
  local ns, g = boot(wow)
  eq(next(ns.L), nil)
  rewardsGame(g, { { name = "Cloak", id = 11, price = 4500 }, { name = "Staff", id = 12, price = 12000 } })
  wow.fire("QUEST_COMPLETE")
  eq(wow.chat[1], CHOOSE)
  eq(wow.chat[2], HINT .. link(12, "Staff") .. " (1g 20s). The choice is still yours.")
end)
