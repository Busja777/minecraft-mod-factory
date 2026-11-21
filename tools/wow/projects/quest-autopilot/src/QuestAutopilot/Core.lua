local _, ns = ...

-- Pure decisions: no frames, no events, no calls into the game. Everything here runs outside the game in the tests.
-- Every decision gets plain data and answers with what to do; Autopilot.lua reads the game and acts.

-- manualDailies (1.1): daily and weekly quests are left to the player. Off, so 1.0 behaviour stays.
ns.DEFAULTS = { enabled = true, accept = true, turnin = true, manualDailies = false }

ns.GRACE = 1.5 -- seconds between two windows that still belong to the same conversation

function ns.IsSecret(value)
  return issecretvalue ~= nil and issecretvalue(value) and true or false
end

-- Fills in what is missing and keeps what the player chose.
function ns.Settings(settings)
  for key, value in pairs(ns.DEFAULTS) do
    if type(settings[key]) ~= "boolean" then settings[key] = value end
  end
  return settings
end

-- half is "accept" or "turnin"; the main switch turns off both.
function ns.IsOn(settings, half)
  return settings.enabled == true and settings[half] == true
end

-- talk = { paused, closedAt }
-- Shift held while a window opens pauses the whole conversation. The next window is the same
-- conversation when it opens within GRACE seconds after the one before closed.
function ns.WindowOpened(talk, shift, now)
  if talk.paused and talk.closedAt and now - talk.closedAt > ns.GRACE then talk.paused = false end
  talk.closedAt = nil
  if shift then talk.paused = true end
  return talk.paused == true
end

function ns.WindowClosed(talk, now)
  talk.closedAt = now
end

local function ready(q)
  return q.enabled == true and not q.paused
end

-- A quest that asks for money is never handed in. An unknown amount counts as "asks for money".
local function free(q)
  return type(q.moneyNeeded) == "number" and q.moneyNeeded <= 0
end

-- q.manual: the player keeps this quest manual (exception list or daily switch), see ns.IsManual.

-- A quest is offered. q = { enabled, paused, manual } → "accept" or nil
function ns.OnDetail(q)
  if ready(q) and not q.manual then return "accept" end
  return nil
end

-- The quest giver asks whether the quest is done. q = { enabled, paused, manual, completable, moneyNeeded } → "continue" or nil
function ns.OnProgress(q)
  if ready(q) and not q.manual and q.completable == true and free(q) then return "continue" end
  return nil
end

-- The rewards are shown. q = { enabled, paused, manual, choices, moneyNeeded }
-- → "take", index of the reward | "choose" (the player has to pick) | nil
function ns.OnComplete(q)
  if not ready(q) or q.manual or not free(q) or type(q.choices) ~= "number" then return nil end
  if q.choices > 1 then return "choose" end
  return "take", 1
end

-- A quest giver lists several quests.
-- q = { accept, turnin, paused, active = { { id, complete, manual } }, available = { { id, repeatable, manual } } }
-- → "active", id (hand in a finished quest) | "available", id (take a new one) | nil
-- A repeatable quest is never taken on its own: handing it in and taking it again would use up
-- the player's items in a loop. The player picks it by hand when they want it.
function ns.Pick(q)
  if q.paused then return nil end
  if q.turnin == true and q.active then
    for _, quest in ipairs(q.active) do
      if quest.complete == true and quest.id ~= nil and not quest.manual then return "active", quest.id end
    end
  end
  if q.accept == true and q.available then
    for _, quest in ipairs(q.available) do
      if quest.id ~= nil and quest.repeatable ~= true and not quest.manual then return "available", quest.id end
    end
  end
  return nil
end

-- Quests the player keeps manual (1.1).
-- list = { ids = { [questID] = title or "" }, names = { [lower-case title] = title } }
-- A quest added from the quest window or by link is kept by its ID; one added by name matches every
-- quest with that title (the older greeting window does not always tell the ID).

local function key(title)
  if type(title) ~= "string" then return nil end
  title = title:gsub("^%s+", ""):gsub("%s+$", "")
  if title == "" then return nil end
  return title:lower()
end

-- Fills in what is missing and drops broken entries. Returns the list.
function ns.ManualList(list)
  if type(list.ids) ~= "table" then list.ids = {} end
  if type(list.names) ~= "table" then list.names = {} end
  for id, title in pairs(list.ids) do
    if type(id) ~= "number" then
      list.ids[id] = nil
    elseif type(title) ~= "string" then
      list.ids[id] = ""
    end
  end
  for k, title in pairs(list.names) do
    if type(k) ~= "string" or type(title) ~= "string" or key(title) ~= k then list.names[k] = nil end
  end
  return list
end

-- What the player typed after /qa manual or /qa auto: a quest link, an ID or a name.
-- → id, title (either can be nil) or nothing for an empty text.
function ns.ParseQuest(text)
  if type(text) ~= "string" then return nil end
  local id, title = text:match("|Hquest:(%d+)[^|]*|h%[(.-)%]|h")
  if id then return tonumber(id), key(title) and title or nil end
  text = text:gsub("^%s+", ""):gsub("%s+$", "")
  if text == "" then return nil end
  local number = text:match("^#?(%d+)$")
  if number then return tonumber(number), nil end
  return nil, text
end

-- How a quest is named in chat: "Title (ID)", "Title" or "Quest ID".
function ns.QuestLabel(id, title)
  if not key(title) then title = nil end
  if id and title then return string.format("%s (%d)", title, id) end
  if title then return title end
  if id then return string.format(ns.L["Quest %d"], id) end
  return "?"
end

-- Adds a quest. With an ID it is kept by its ID, otherwise by its name.
-- Returns the label and whether it was new, or nil when there is nothing to add.
function ns.AddManual(list, id, title)
  if id then
    local had = list.ids[id] ~= nil
    if key(title) or not had then list.ids[id] = key(title) and title or "" end
    return ns.QuestLabel(id, list.ids[id]), not had
  end
  local k = key(title)
  if not k then return nil end
  local had = list.names[k] ~= nil
  if not had then list.names[k] = title:gsub("^%s+", ""):gsub("%s+$", "") end
  return ns.QuestLabel(nil, list.names[k]), not had
end

-- Removes a quest by ID or by name (a name also removes quests kept by ID with that title).
-- Returns the label of what was removed, or nil.
function ns.RemoveManual(list, id, title)
  if id then
    local had = list.ids[id]
    if had == nil then return nil end
    list.ids[id] = nil
    return ns.QuestLabel(id, had)
  end
  local k = key(title)
  if not k then return nil end
  local label
  if list.names[k] then
    label = ns.QuestLabel(nil, list.names[k])
    list.names[k] = nil
  end
  for questID, questTitle in pairs(list.ids) do
    if key(questTitle) == k then
      label = label or ns.QuestLabel(questID, questTitle)
      list.ids[questID] = nil
    end
  end
  return label
end

-- Every kept quest as a label, in alphabetical order.
function ns.ManualLabels(list)
  local labels = {}
  for id, title in pairs(list.ids) do labels[#labels + 1] = ns.QuestLabel(id, title) end
  for _, title in pairs(list.names) do labels[#labels + 1] = ns.QuestLabel(nil, title) end
  table.sort(labels, function(a, b) return a:lower() < b:lower() end)
  return labels
end

function ns.ManualCount(list)
  return #ns.ManualLabels(list)
end

-- Whether the autopilot leaves a quest to the player.
-- quest = { id, title, periodic } where periodic is true for a daily or weekly quest.
function ns.IsManual(list, settings, quest)
  if settings.manualDailies == true and quest.periodic == true then return true end
  if quest.id ~= nil and list.ids[quest.id] ~= nil then return true end
  local k = key(quest.title)
  if k and list.names[k] ~= nil then return true end
  return false
end

-- One word of the slash command. Returns true when the word was known.
function ns.Apply(settings, word)
  if word == "on" then
    settings.enabled = true
  elseif word == "off" then
    settings.enabled = false
  elseif word == "accept" or word == "turnin" then
    settings[word] = not settings[word]
  elseif word == "dailies" then
    settings.manualDailies = not settings.manualDailies
  else
    return false
  end
  return true
end

-- count = number of quests the player keeps manual.
function ns.StateText(settings, count)
  local L = ns.L
  local function word(on) return on and L["on"] or L["off"] end
  return string.format(L["Autopilot is %s. Accepting quests: %s. Handing in quests: %s. Daily and weekly quests: %s. Kept manual: %d."],
    word(settings.enabled), word(settings.accept), word(settings.turnin),
    settings.manualDailies and L["manual"] or L["automatic"], count or 0)
end
