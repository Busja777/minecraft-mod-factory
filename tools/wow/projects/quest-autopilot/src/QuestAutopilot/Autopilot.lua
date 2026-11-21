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

-- 1.3: the reward hint ----------------------------------------------------------------------------
-- When a quest offers a choice of rewards, the one a vendor pays most for gets a small coin in the
-- reward window and one chat line. The autopilot still never picks.

ns.reward = nil -- { tries, shown } while a reward window with a choice is open
local MAX_TRIES = 10 -- how often prices that arrive later are looked at again in one window
local COIN = "Interface\\MoneyFrame\\UI-GoldIcon"

-- The vendor price of one item (a link or an item ID), or nil while the game has not loaded it.
-- C_Item.GetItemInfo and the older GetItemInfo return the price as their 11th value.
local function sellPrice(item)
  if item == nil then return nil end
  local getInfo = (C_Item and C_Item.GetItemInfo) or GetItemInfo
  if not getInfo then return nil end
  local results = { pcall(getInfo, item) }
  if not results[1] or results[2] == nil then return nil end
  local price = results[12]
  if ns.IsSecret(price) then return nil end
  return price
end

-- Asks the game to load an item it does not know yet; GET_ITEM_INFO_RECEIVED follows.
local function requestItem(itemID)
  if type(itemID) ~= "number" or not (C_Item and C_Item.RequestLoadItemDataByID) then return end
  pcall(C_Item.RequestLoadItemDataByID, itemID)
end

-- The choices of the reward window: { { value } } for Core.lua and the link (or name) of each.
local function readChoices(count)
  local choices, names = {}, {}
  for i = 1, count do
    local link = GetQuestItemLink and read(GetQuestItemLink, "choice", i) or nil
    if type(link) ~= "string" or link == "" then link = nil end
    local name, amount, itemID
    if GetQuestItemInfo then
      local ok, itemName, _, itemCount, _, _, id = pcall(GetQuestItemInfo, "choice", i)
      if ok then
        name = text(itemName)
        amount = itemCount
        if ns.IsSecret(itemCount) then amount = false end -- a secret count: no value
        itemID = questID(id)
      end
    end
    local value
    if amount ~= false then
      local price = sellPrice(link or itemID)
      if price == nil then requestItem(itemID) end
      value = ns.StackValue(price, amount)
    end
    choices[i] = { value = value }
    names[i] = link or name
  end
  return choices, names
end

-- The button of a reward choice in the quest window (QuestInfoRewardsFrame.RewardButtons). Only a
-- shown button the game marks as that choice counts; a different layout finds nothing.
local function rewardButton(index)
  local frame = QuestInfoRewardsFrame
  if type(frame) ~= "table" or type(frame.RewardButtons) ~= "table" then return nil end
  for _, button in ipairs(frame.RewardButtons) do
    if type(button) == "table" and button.type == "choice" and button.GetID and button:GetID() == index
      and button.IsShown and button:IsShown() then
      return button
    end
  end
  return nil
end

local mark -- the coin, one frame of its own that moves to the button it marks

local function showMark(button)
  if not mark then
    mark = CreateFrame("Frame")
    mark:SetSize(18, 18)
    mark.icon = mark:CreateTexture(nil, "OVERLAY")
    mark.icon:SetAllPoints()
    mark.icon:SetTexture(COIN)
    ns.mark = mark
  end
  mark:SetParent(button)
  mark:ClearAllPoints()
  mark:SetPoint("TOPLEFT", button, "TOPLEFT", -4, 4)
  local level = button.GetFrameLevel and button:GetFrameLevel()
  if type(level) == "number" then mark:SetFrameLevel(level + 5) end
  mark.button = button
  mark:Show()
end

local function clearHint()
  ns.reward = nil
  if mark then
    mark:Hide()
    mark.button = nil
  end
end

local function tryHint()
  local reward = ns.reward
  if not reward or reward.shown then return end
  reward.tries = reward.tries + 1
  local count = read(GetNumQuestChoices)
  if type(count) ~= "number" or count < 2 then return clearHint() end
  local choices, names = readChoices(count)
  local index, value = ns.BestReward(choices)
  if not index then
    if reward.tries >= MAX_TRIES then ns.reward = nil end
    return
  end
  reward.shown = true
  local button = rewardButton(index)
  if button then pcall(showMark, button) end
  ns.Say(ns.HintText(names[index], value))
end

local function startHint(paused, choices)
  clearHint()
  if not ns.WantHint({ enabled = ns.settings.enabled, hint = ns.settings.hint, paused = paused, choices = choices }) then return end
  local reward = { tries = 0 }
  ns.reward = reward
  -- A moment later the game has laid out its reward buttons.
  if C_Timer and C_Timer.After then
    C_Timer.After(0, function() if ns.reward == reward then tryHint() end end)
  else
    tryHint()
  end
end

-- A price the game has just loaded may complete the hint.
local function onItemInfo()
  if ns.reward then tryHint() end
end

local function onComplete(paused)
  local quest = windowQuest()
  local choices = read(GetNumQuestChoices)
  local what, index = ns.OnComplete({
    enabled = ns.IsOn(ns.settings, "turnin"), paused = paused, manual = manual(quest),
    choices = choices, moneyNeeded = moneyNeeded(),
  })
  if what == "take" then
    GetQuestReward(index)
  elseif what == "choose" then
    ns.Say(L["This quest has several rewards. Pick one yourself."])
  end
  startHint(paused, choices)
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

-- How many entries a list from the game has; nil when it is not a readable list.
local function count(list)
  if type(list) ~= "table" or ns.IsSecret(list) then return nil end
  return #list
end

-- 1.2: one dialogue option of the newer conversation window as the plain data Core.lua decides on
-- (C_GossipInfo.GetOptions, GossipOptionUIInfo). An option with a secret or unreadable field
-- becomes an empty record, which is never picked.
local function readOption(info)
  local o = {}
  if type(info) ~= "table" or ns.IsSecret(info) then return o end
  local id, icon, override = info.gossipOptionID, info.icon, info.overrideIconID
  local status, rewards, spell, auto = info.status, info.rewards, info.spellID, info.selectOptionWhenOnlyOption
  if ns.IsSecret(id) or ns.IsSecret(icon) or ns.IsSecret(override) or ns.IsSecret(status)
    or ns.IsSecret(rewards) or ns.IsSecret(spell) or ns.IsSecret(auto) then return o end
  o.id = type(id) == "number" and id or nil
  o.icon, o.override, o.status = icon, override, status
  if rewards == nil then o.rewards = 0 elseif type(rewards) == "table" then o.rewards = #rewards else o.rewards = 1 end
  o.spell = spell ~= nil and spell ~= 0
  o.auto = auto == true
  o.blocked = o.id ~= nil and ns.blocked[o.id] == true
  return o
end

-- 1.2: a character with no quests and exactly one plain line of conversation: pick it.
local function pickOption(gossip, paused, active, available)
  if not (gossip.GetOptions and gossip.SelectOption) then return end
  local list = gossip.GetOptions()
  if type(list) ~= "table" or ns.IsSecret(list) then return end
  local options = {}
  for i, info in ipairs(list) do options[i] = readOption(info) end
  local a, b = count(active), count(available)
  local talk = ns.talk
  local id = ns.PickOption({
    enabled = ns.settings.enabled, gossip = ns.settings.gossip, paused = paused,
    quests = a and b and a + b or nil, options = options, chosen = talk.chosen, picks = talk.picks,
  })
  if not id then return end
  talk.chosen = talk.chosen or {}
  talk.chosen[id] = true
  talk.picks = (talk.picks or 0) + 1
  talk.lastPick, talk.pickedAt = id, GetTime()
  gossip.SelectOption(id)
end

local function onGossip(paused)
  local gossip = C_GossipInfo
  if not (gossip and gossip.GetActiveQuests and gossip.GetAvailableQuests) then return end
  local active, available = gossip.GetActiveQuests(), gossip.GetAvailableQuests()
  local kind, id = ns.Pick({
    accept = ns.IsOn(ns.settings, "accept"), turnin = ns.IsOn(ns.settings, "turnin"), paused = paused,
    active = gossipQuests(active), available = gossipQuests(available),
  })
  if kind == "active" and gossip.SelectActiveQuest then
    gossip.SelectActiveQuest(id)
  elseif kind == "available" and gossip.SelectAvailableQuest then
    gossip.SelectAvailableQuest(id)
  elseif not kind then
    pickOption(gossip, paused, active, available)
  end
end

-- 1.2: the option just picked asks for a confirmation (gold, a code, a skip ...). The game shows its
-- question to the player, who decides; the autopilot never answers it and never picks that
-- option again.
local function onConfirm()
  local talk = ns.talk
  if talk.lastPick and talk.pickedAt and GetTime() - talk.pickedAt <= ns.GRACE then
    ns.blocked[talk.lastPick] = true
    ns.Say(L["This dialogue option asks you to confirm, so the choice is yours. The autopilot will not pick it again."])
  end
  talk.lastPick = nil
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
local CONFIRM = { GOSSIP_CONFIRM = true, GOSSIP_ENTER_CODE = true }

local function onLogin()
  if type(QuestAutopilotDB) ~= "table" then QuestAutopilotDB = {} end
  local db = QuestAutopilotDB
  -- 2 (1.1): the list of quests kept manual; 1.0 data needs nothing else.
  -- 3 (1.2): the dialogue options that asked for a confirmation; the gossip switch starts off.
  -- 4 (1.3): the reward hint switch, filled in by ns.Settings; it starts on.
  db.version = 4
  if type(db.settings) ~= "table" then db.settings = {} end
  if type(db.manual) ~= "table" then db.manual = {} end
  db.blocked = ns.BlockedList(db.blocked)
  ns.db = db
  ns.settings = ns.Settings(db.settings)
  ns.manual = ns.ManualList(db.manual)
  ns.blocked = db.blocked
end

local frame = CreateFrame("Frame")
ns.eventFrame = frame

frame:SetScript("OnEvent", function(_, event)
  if event == "PLAYER_LOGIN" then
    onLogin()
  elseif CLOSED[event] then
    ns.WindowClosed(ns.talk, GetTime())
    if event == "QUEST_FINISHED" then clearHint() end
  elseif event == "GET_ITEM_INFO_RECEIVED" then
    if ns.settings then onItemInfo() end
  elseif CONFIRM[event] then
    if ns.settings then onConfirm() end
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
for event in pairs(CONFIRM) do listen(event) end
listen("GET_ITEM_INFO_RECEIVED")
