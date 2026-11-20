local _, ns = ...

-- Pure decisions: no frames, no events, no calls into the game. Everything here runs outside the game in the tests.
-- Every decision gets plain data and answers with what to do; Autopilot.lua reads the game and acts.

ns.DEFAULTS = { enabled = true, accept = true, turnin = true }

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

-- A quest is offered. q = { enabled, paused } → "accept" or nil
function ns.OnDetail(q)
  if ready(q) then return "accept" end
  return nil
end

-- The quest giver asks whether the quest is done. q = { enabled, paused, completable, moneyNeeded } → "continue" or nil
function ns.OnProgress(q)
  if ready(q) and q.completable == true and free(q) then return "continue" end
  return nil
end

-- The rewards are shown. q = { enabled, paused, choices, moneyNeeded }
-- → "take", index of the reward | "choose" (the player has to pick) | nil
function ns.OnComplete(q)
  if not ready(q) or not free(q) or type(q.choices) ~= "number" then return nil end
  if q.choices > 1 then return "choose" end
  return "take", 1
end

-- A quest giver lists several quests.
-- q = { accept, turnin, paused, active = { { id, complete } }, available = { { id, repeatable } } }
-- → "active", id (hand in a finished quest) | "available", id (take a new one) | nil
-- A repeatable quest is never taken on its own: handing it in and taking it again would use up
-- the player's items in a loop. The player picks it by hand when they want it.
function ns.Pick(q)
  if q.paused then return nil end
  if q.turnin == true and q.active then
    for _, quest in ipairs(q.active) do
      if quest.complete == true and quest.id ~= nil then return "active", quest.id end
    end
  end
  if q.accept == true and q.available then
    for _, quest in ipairs(q.available) do
      if quest.id ~= nil and quest.repeatable ~= true then return "available", quest.id end
    end
  end
  return nil
end

-- One word of the slash command. Returns true when the word was known.
function ns.Apply(settings, word)
  if word == "on" then
    settings.enabled = true
  elseif word == "off" then
    settings.enabled = false
  elseif word == "accept" or word == "turnin" then
    settings[word] = not settings[word]
  else
    return false
  end
  return true
end

function ns.StateText(settings)
  local L = ns.L
  local function word(on) return on and L["on"] or L["off"] end
  return string.format(L["Autopilot is %s. Accepting quests: %s. Handing in quests: %s."],
    word(settings.enabled), word(settings.accept), word(settings.turnin))
end
