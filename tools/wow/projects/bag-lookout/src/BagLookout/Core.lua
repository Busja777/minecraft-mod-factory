local _, ns = ...

-- Pure decisions: no frames, no events. Everything here runs outside the game in the tests.

ns.DEFAULT_THRESHOLD = 5 -- warn at this many free slots or fewer
ns.MAX_THRESHOLD = 50

-- Colours of the counter: plenty of room, few slots left, no slot left.
ns.COLOR = { ok = "ffffffff", low = "ffffd100", full = "ffff2020", unknown = "ff9d9d9d" }
ns.RGB = { low = { 1, 0.82, 0 }, full = { 1, 0.13, 0.13 } }

function ns.IsSecret(value)
  return issecretvalue ~= nil and issecretvalue(value) and true or false
end

local function count(value)
  return type(value) == "number" and value >= 0 and not ns.IsSecret(value)
end

-- bags = { { free, total, family } ... }, one record per bag as read from the game.
-- A bag that can only hold one kind of item (family other than 0) is left out, like the game's
-- own free-slot count does; so is a bag whose numbers cannot be read.
-- Returns { free, total }.
function ns.Totals(bags)
  local t = { free = 0, total = 0 }
  for _, bag in ipairs(bags) do
    local special = type(bag.family) == "number" and bag.family ~= 0
    if not special and count(bag.free) and count(bag.total) then
      t.free = t.free + math.min(bag.free, bag.total)
      t.total = t.total + bag.total
    end
  end
  return t
end

-- A threshold the addon accepts: a whole number from 0 to MAX_THRESHOLD; nil otherwise.
function ns.ValidThreshold(value)
  if type(value) ~= "number" or value ~= value then return nil end
  if value ~= math.floor(value) or value < 0 or value > ns.MAX_THRESHOLD then return nil end
  return value
end

function ns.ParseThreshold(text)
  return ns.ValidThreshold(tonumber(text))
end

-- "ok", "low" (at or below the threshold) or "full" (no slot left); "unknown" without a count.
function ns.State(free, total, threshold)
  if type(free) ~= "number" or type(total) ~= "number" or total <= 0 then return "unknown" end
  if free <= 0 then return "full" end
  if free <= (threshold or ns.DEFAULT_THRESHOLD) then return "low" end
  return "ok"
end

local function paint(state, text)
  return "|c" .. (ns.COLOR[state] or ns.COLOR.unknown) .. text .. "|r"
end

-- "Bags 12/98", coloured by its state.
function ns.CounterText(free, total, threshold)
  local state = ns.State(free, total, threshold)
  if state == "unknown" then return paint(state, ns.L["Bags ..."]) end
  return paint(state, string.format(ns.L["Bags %d/%d"], free, total))
end

-- The detail line for the reagent bag, coloured with the same rule.
function ns.ReagentText(free, total, threshold)
  local state = ns.State(free, total, threshold)
  if state == "unknown" then return paint(state, ns.L["No reagent bag"]) end
  return paint(state, string.format(ns.L["Reagents %d/%d"], free, total))
end

-- The warning state machine. It warns once when the free count drops to or below the threshold,
-- once more when it reaches 0, and is armed again only after the count went above the threshold.
-- The first count it sees (login, reload, a new threshold) only sets its state and never warns.
function ns.NewWarner()
  return { primed = false, low = false, full = false }
end

function ns.ResetWarner(w)
  w.primed = false
end

-- Returns "low", "full" or nil (nothing to say).
function ns.Warn(w, free, total, threshold)
  local state = ns.State(free, total, threshold)
  if state == "unknown" then return nil end
  local first = not w.primed
  w.primed = true
  if state == "ok" then
    w.low, w.full = false, false
    return nil
  end
  local kind
  if state == "full" then
    if not w.full then kind = "full" end
    w.low, w.full = true, true
  else
    if not w.low then kind = "low" end
    w.low = true
  end
  if first then return nil end
  return kind
end

function ns.WarningText(kind, free)
  local L = ns.L
  if kind == "full" then return L["Your bags are full!"] end
  if free == 1 then return L["Bags almost full: 1 free slot left."] end
  return string.format(L["Bags almost full: %d free slots left."], free or 0)
end
