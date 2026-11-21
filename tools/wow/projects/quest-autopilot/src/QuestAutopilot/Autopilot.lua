local _, ns = ...
local L = ns.L

-- Listens to the quest windows, reads the game and does what Core.lua decides.

ns.talk = { paused = false }

function ns.Say(msg)
  DEFAULT_CHAT_FRAME:AddMessage("|cffffd100" .. L["Quest Autopilot"] .. ":|r " .. msg)
end

-- The first value a game function returns, or nil when the function is missing or the value is
-- secret (a secret value must not be compared).
local function read(fn, ...)
  if not fn then return nil end
  local value = fn(...)
  if ns.IsSecret(value) then return nil end
  return value
end

-- A text from the game, or nil when it is missing, secret or empty.
local function text(value)
  if ns.IsSecret(value) or type(value) ~= "string" or value == "" then return nil end
  return value
end

-- A quest ID from the game, or nil.
local function questID(value)
  if ns.IsSecret(value) or type(value) ~= "number" or value <= 0 then return nil end
  return value
end

-- Daily, weekly or another quest that comes back on a timer. Enum.QuestFrequency: 0 is a normal
-- quest, everything above it resets on a schedule. A secret answer counts as daily: with the
-- switch on, an unclear quest is better left to the player.
local function periodic(frequency)
  if ns.IsSecret(frequency) then return true end
  return type(frequency) == "number" and frequency > 0
end

-- Whether a quest in the quest log is a daily or weekly quest.
local function periodicInLog(id)
  local log = C_QuestLog
  if not (id and log and log.GetLogIndexForQuestID and log.GetInfo) then return false end
  local index = read(log.GetLogIndexForQuestID, id)
  if type(index) ~= "number" then return false end
  local info = log.GetInfo(index)
  if type(info) ~= "table" or ns.IsSecret(info) then return false end
  return periodic(info.frequency)
end

local function manual(quest)
  return ns.IsManual(ns.manual, ns.settings, quest)
end

-- The quest of the open quest window (offer, progress or rewards). It is remembered after the
-- window closes, so /qa manual still knows the quest the autopilot just handled.
local function windowQuest()
  local quest = { id = questID(read(GetQuestID)), title = text(read(GetTitleText)) }
  quest.periodic = read(QuestIsDaily) == true or read(QuestIsWeekly) == true or periodicInLog(quest.id)
  if quest.id or quest.title then ns.lastQuest = quest end
  return quest
end

local function moneyNeeded()
  if not GetQuestMoneyToGet then return 0 end
  return read(GetQuestMoneyToGet)
end

local function onDetail(paused)
  local quest = windowQuest()
  if ns.OnDetail({ enabled = ns.IsOn(ns.settings, "accept"), paused = paused, manual = manual(quest) }) ~= "accept" then return end
  if AcknowledgeAutoAcceptQuest and read(QuestGetAutoAccept) == true then
    AcknowledgeAutoAcceptQuest() -- the game has already put this quest into the log
  else
    AcceptQuest()
  end
end

local function onProgress(paused)
  local quest = windowQuest()
  local what = ns.OnProgress({
    enabled = ns.IsOn(ns.settings, "turnin"), paused = paused, manual = manual(quest),
    completable = read(IsQuestCompletable), moneyNeeded = moneyNeeded(),
  })
  if what == "continue" then CompleteQuest() end
end

local function onComplete(paused)
  local quest = windowQuest()
  local what, index = ns.OnComplete({
    enabled = ns.IsOn(ns.settings, "turnin"), paused = paused, manual = manual(quest),
    choices = read(GetNumQuestChoices), moneyNeeded = moneyNeeded(),
  })
  if what == "take" then
    GetQuestReward(index)
  elseif what == "choose" then
    ns.Say(L["This quest has several rewards. Pick one yourself."])
  end
end

-- Quest lists of the newer conversation window.
local function gossipQuests(list)
  local quests = {}
  if type(list) ~= "table" or ns.IsSecret(list) then return quests end
  for _, info in ipairs(list) do
    local id, complete, repeatable = info.questID, info.isComplete, info.repeatable
    if id ~= nil and not ns.IsSecret(id) then
      quests[#quests + 1] = {
        id = id, complete = not ns.IsSecret(complete) and complete == true,
        -- unknown counts as repeatable: better to leave a quest to the player than to loop
        repeatable = ns.IsSecret(repeatable) or repeatable == true,
        manual = manual({ id = id, title = text(info.title), periodic = periodic(info.frequency) }),
      }
    end
  end
  return quests
end

local function onGossip(paused)
  local gossip = C_GossipInfo
  if not (gossip and gossip.GetActiveQuests and gossip.GetAvailableQuests) then return end
  local kind, id = ns.Pick({
    accept = ns.IsOn(ns.settings, "accept"), turnin = ns.IsOn(ns.settings, "turnin"), paused = paused,
    active = gossipQuests(gossip.GetActiveQuests()), available = gossipQuests(gossip.GetAvailableQuests()),
  })
  if kind == "active" and gossip.SelectActiveQuest then
    gossip.SelectActiveQuest(id)
  elseif kind == "available" and gossip.SelectAvailableQuest then
    gossip.SelectAvailableQuest(id)
  end
end

-- Quest lists of the older greeting window: quests are numbered, not named by ID.
local function onGreeting(paused)
  local active, available = {}, {}
  if GetActiveTitle then
    for i = 1, read(GetNumActiveQuests) or 0 do
      local title, complete = GetActiveTitle(i)
      local id = GetActiveQuestID and questID(GetActiveQuestID(i)) or nil
      active[i] = {
        id = i, complete = not ns.IsSecret(complete) and complete == true,
        manual = manual({ id = id, title = text(title), periodic = periodicInLog(id) }),
      }
    end
  end
  for i = 1, read(GetNumAvailableQuests) or 0 do
    local repeatable, frequency, id = false, nil, nil
    if GetAvailableQuestInfo then
      local _, often, isRepeatable, _, questId = GetAvailableQuestInfo(i)
      repeatable = ns.IsSecret(isRepeatable) or isRepeatable == true
      frequency, id = often, questID(questId)
    end
    local title = GetAvailableTitle and text(GetAvailableTitle(i)) or nil
    available[i] = {
      id = i, repeatable = repeatable,
      manual = manual({ id = id, title = title, periodic = periodic(frequency) }),
    }
  end
  local kind, id = ns.Pick({
    accept = ns.IsOn(ns.settings, "accept"), turnin = ns.IsOn(ns.settings, "turnin"), paused = paused,
    active = active, available = available,
  })
  if kind == "active" and SelectActiveQuest then
    SelectActiveQuest(id)
  elseif kind == "available" and SelectAvailableQuest then
    SelectAvailableQuest(id)
  end
end

local WINDOWS = {
  QUEST_DETAIL = onDetail, QUEST_PROGRESS = onProgress, QUEST_COMPLETE = onComplete,
  GOSSIP_SHOW = onGossip, QUEST_GREETING = onGreeting,
}
local CLOSED = { GOSSIP_CLOSED = true, QUEST_FINISHED = true }

local function onLogin()
  if type(QuestAutopilotDB) ~= "table" then QuestAutopilotDB = {} end
  local db = QuestAutopilotDB
  db.version = 2 -- 2 (1.1): the list of quests kept manual; 1.0 data needs nothing else
  if type(db.settings) ~= "table" then db.settings = {} end
  if type(db.manual) ~= "table" then db.manual = {} end
  ns.db = db
  ns.settings = ns.Settings(db.settings)
  ns.manual = ns.ManualList(db.manual)
end

local frame = CreateFrame("Frame")
ns.eventFrame = frame

frame:SetScript("OnEvent", function(_, event)
  if event == "PLAYER_LOGIN" then
    onLogin()
  elseif CLOSED[event] then
    ns.WindowClosed(ns.talk, GetTime())
  elseif WINDOWS[event] and ns.settings then
    local shift = IsShiftKeyDown ~= nil and IsShiftKeyDown() == true
    WINDOWS[event](ns.WindowOpened(ns.talk, shift, GetTime()))
  end
end)

-- Registered one by one: an event a client does not know is skipped.
local function listen(event)
  pcall(frame.RegisterEvent, frame, event)
end

listen("PLAYER_LOGIN")
for event in pairs(WINDOWS) do listen(event) end
for event in pairs(CLOSED) do listen(event) end
