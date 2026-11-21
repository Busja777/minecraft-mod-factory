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

-- The two views of the counter: "total" (one line, the normal bags) and "split" (one line per bag type).
function ns.ValidView(value)
  if value == "total" or value == "split" then return value end
  return nil
end

-- What a profession bag holds, by its bag family (the item family bits the game reports for it).
-- A family that is not listed, or a bag for more than one kind, is shown as "Profession".
local OTHER = 0 -- the "Profession" line: every other kind, listed after the named ones
local FAMILY_LABEL = {
  [OTHER] = "Profession",
  [8] = "Leather", [16] = "Inscription", [32] = "Herbs", [64] = "Enchanting", [128] = "Engineering",
  [512] = "Gems", [1024] = "Mining", [32768] = "Fishing", [65536] = "Cooking",
}

function ns.FamilyLabel(family)
  return FAMILY_LABEL[family] or FAMILY_LABEL[OTHER]
end

-- The bags that hold only one kind of item, added up per kind and sorted by family (unknown last).
-- bags = { { free, total, family } ... } as for Totals. Returns { { family, label, free, total } ... }.
function ns.Professions(bags)
  local groups, list = {}, {}
  for _, bag in ipairs(bags) do
    local family = bag.family
    local special = type(family) == "number" and family ~= 0 and not ns.IsSecret(family)
    if special and count(bag.free) and count(bag.total) and bag.total > 0 then
      local key = FAMILY_LABEL[family] and family or OTHER
      local g = groups[key]
      if not g then
        g = { family = key, label = ns.FamilyLabel(key), free = 0, total = 0 }
        groups[key] = g
        list[#list + 1] = g
      end
      g.free = g.free + math.min(bag.free, bag.total)
      g.total = g.total + bag.total
    end
  end
  table.sort(list, function(a, b)
    if (a.family == OTHER) ~= (b.family == OTHER) then return b.family == OTHER end
    return a.family < b.family
  end)
  return list
end

-- "Herbs 12/36", coloured with the same rule as the counter.
function ns.ProfessionText(label, free, total, threshold)
  local state = ns.State(free, total, threshold)
  return paint(state, string.format(ns.L["%s %d/%d"], ns.L[label], free or 0, total or 0))
end

-- The lines under the counter in the split view: the reagent bag (or that there is none), then
-- one line per kind of profession bag.
function ns.SplitLines(counts, threshold)
  counts = type(counts) == "table" and counts or {}
  local lines = { ns.ReagentText(counts.reagentFree, counts.reagentTotal, threshold) }
  for _, g in ipairs(type(counts.professions) == "table" and counts.professions or {}) do
    lines[#lines + 1] = ns.ProfessionText(g.label, g.free, g.total, threshold)
  end
  return lines
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

-- 1.2: the warning sound and how often to warn.
-- The word typed in /bl sound and the game's SOUNDKIT name behind it. "warning" is the raid
-- warning sound every warning played in 1.0 and 1.1; "none" (or /bl sound off) is silent.
ns.SOUND_NAMES = { "warning", "bell", "chime", "horn", "whisper" }
ns.SOUND_KIT = {
  warning = "RAID_WARNING",
  bell = "ALARM_CLOCK_WARNING_3",
  chime = "MAP_PING",
  horn = "READY_CHECK",
  whisper = "TELL_MESSAGE",
}
ns.DEFAULT_SOUND = "warning"

function ns.ValidSound(value)
  if type(value) == "string" and ns.SOUND_KIT[value] then return value end
  return nil
end

-- The sound id for a name from the game's SOUNDKIT table. A sound this client does not know falls
-- back to the raid warning; nil when not even that is there.
function ns.SoundId(kit, name)
  if type(kit) ~= "table" then return nil end
  local id = kit[ns.SOUND_KIT[name] or ""]
  if type(id) == "number" then return id end
  id = kit[ns.SOUND_KIT[ns.DEFAULT_SOUND]]
  if type(id) == "number" then return id end
  return nil
end

-- "always": warn every time the bags fill up again (as in 1.1). "once": each warning (almost
-- full, full) comes at most once per session.
function ns.ValidRepeat(value)
  if value == "always" or value == "once" then return value end
  return nil
end

-- Whether a warning the state machine gave is shown. shown = { low = true, ... } is what this
-- session has already shown; it is noted here.
function ns.AllowWarning(shown, kind, mode)
  if not kind then return false end
  local before = shown[kind]
  shown[kind] = true
  return mode ~= "once" or not before
end

-- "a, b or c"
function ns.OrList(words)
  if #words < 2 then return words[1] or "" end
  local head = {}
  for i = 1, #words - 1 do head[i] = words[i] end
  return string.format(ns.L["%s or %s"], table.concat(head, ", "), words[#words])
end

-- "Sound is on: warning." or "Sound is off."
function ns.SoundText(settings)
  if not settings.sound then return ns.L["Sound is off."] end
  return string.format(ns.L["Sound is on: %s."], ns.ValidSound(settings.soundName) or ns.DEFAULT_SOUND)
end

function ns.RepeatText(mode)
  if mode == "once" then return ns.L["Warns once per session."] end
  return ns.L["Warns every time the bags fill up again."]
end

-- 1.3: the cheapest items, to know what to throw out when the bags are full.
-- item = { bag, slot, id, link, quality, count, price (vendor price of one piece), quest, noValue }
ns.CHEAP_COUNT = 5   -- items /bl cheap lists
ns.CHEAP_QUALITY = 2 -- grey, white and green only: better items are worth keeping

-- Whether an item may be suggested: a known vendor price, not a quest item, at most green.
function ns.CheapCandidate(item)
  if type(item) ~= "table" or item.quest or item.noValue then return false end
  if type(item.quality) ~= "number" or item.quality < 0 or item.quality > ns.CHEAP_QUALITY then return false end
  if type(item.price) ~= "number" or item.price <= 0 then return false end
  return type(item.count) == "number" and item.count > 0
end

-- The value of the whole stack in the slot.
function ns.SlotValue(item)
  return item.price * item.count
end

-- The n candidates with the lowest slot value, lowest first; equal values keep their bag order.
function ns.Cheapest(items, n)
  local list = {}
  for i, item in ipairs(items) do
    if ns.CheapCandidate(item) then list[#list + 1] = { item = item, value = ns.SlotValue(item), order = i } end
  end
  table.sort(list, function(a, b)
    if a.value ~= b.value then return a.value < b.value end
    return a.order < b.order
  end)
  local out = {}
  for i = 1, math.min(n or ns.CHEAP_COUNT, #list) do out[i] = list[i].item end
  return out
end

local function thousands(n)
  local s = tostring(n)
  local out = s:reverse():gsub("(%d%d%d)", "%1,"):reverse()
  return (out:gsub("^,", ""))
end

-- "12c", "3s 05c", "1,234g 00s 07c"
function ns.PlainMoney(copper)
  copper = math.floor(copper)
  local g = math.floor(copper / 10000)
  local s = math.floor(copper / 100) % 100
  local c = copper % 100
  if g > 0 then return string.format("%sg %02ds %02dc", thousands(g), s, c) end
  if s > 0 then return string.format("%ds %02dc", s, c) end
  return string.format("%dc", c)
end

local function itemName(item)
  return item.link or string.format(ns.L["item %d"], item.id or 0)
end

-- "2. [Linen Cloth] x3: 12c" for /bl cheap.
function ns.CheapLine(n, item)
  local name = itemName(item)
  if item.count > 1 then name = name .. " x" .. item.count end
  return string.format("%d. %s: %s", n, name, ns.PlainMoney(ns.SlotValue(item)))
end

-- "Cheapest: [Linen Cloth] (12c)" under the "bags full" warning.
function ns.CheapWarning(item)
  return string.format(ns.L["Cheapest: %s (%s)"], itemName(item), ns.PlainMoney(ns.SlotValue(item)))
end
