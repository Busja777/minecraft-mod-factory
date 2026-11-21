local _, ns = ...

-- Pure decisions and arithmetic: no frames, no events. Everything here runs outside the game in the tests.
-- An item is one equipment slot with durability: { slot, cur, max }.

-- Equipment slots that can wear out: 1 to 18 without the shirt (4); the tabard (19) never does.
ns.SLOTS = { 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18 }

ns.SLOT_LABEL = {
  [1] = "Head", [2] = "Neck", [3] = "Shoulders", [5] = "Chest", [6] = "Waist", [7] = "Legs",
  [8] = "Feet", [9] = "Wrists", [10] = "Hands", [11] = "Ring 1", [12] = "Ring 2",
  [13] = "Trinket 1", [14] = "Trinket 2", [15] = "Back", [16] = "Main Hand", [17] = "Off Hand",
  [18] = "Ranged",
}

ns.DEFAULT_WARN = 25 -- percent
ns.MIN_WARN = 5
ns.MAX_WARN = 90
ns.DEFAULT_INSTANCE = 50 -- percent: the check before dungeons and raids
ns.YELLOW = 50       -- at or below: yellow
ns.RED = 20          -- at or below: red

ns.COLOR = { green = "|cff40ff40", yellow = "|cffffff00", red = "|cffff4040" }
ns.GREY = "|cff9d9d9d"

function ns.IsSecret(value)
  return issecretvalue ~= nil and issecretvalue(value) and true or false
end

-- Whole percent, rounded down: an item shows 100 % only when it is not worn at all.
function ns.Percent(cur, max)
  if type(cur) ~= "number" or type(max) ~= "number" or max <= 0 then return nil end
  local p = math.floor(cur * 100 / max)
  if p < 0 then return 0 end
  if p > 100 then return 100 end
  return p
end

-- The state of the whole gear. overall and lowest are nil when nothing worn has durability.
-- damaged lists every item below 100 %, lowest first.
function ns.Condition(items)
  local cond = { count = 0, damaged = {} }
  local sumCur, sumMax = 0, 0
  for _, it in ipairs(items or {}) do
    local p = ns.Percent(it.cur, it.max)
    if p then
      cond.count = cond.count + 1
      local cur = math.max(math.min(it.cur, it.max), 0)
      sumCur, sumMax = sumCur + cur, sumMax + it.max
      if not cond.lowest or p < cond.lowest or (p == cond.lowest and it.slot < cond.lowestSlot) then
        cond.lowest, cond.lowestSlot = p, it.slot
      end
      if cur < it.max then
        cond.damaged[#cond.damaged + 1] = { slot = it.slot, cur = cur, max = it.max, percent = p }
      end
    end
  end
  if cond.count > 0 then cond.overall = ns.Percent(sumCur, sumMax) end
  table.sort(cond.damaged, function(a, b)
    if a.percent ~= b.percent then return a.percent < b.percent end
    return a.slot < b.slot
  end)
  return cond
end

function ns.ColorState(percent)
  if type(percent) ~= "number" then return nil end
  if percent <= ns.RED then return "red" end
  if percent <= ns.YELLOW then return "yellow" end
  return "green"
end

function ns.Colored(percent)
  local state = ns.ColorState(percent)
  if not state then return ns.GREY .. "-|r" end
  return ns.COLOR[state] .. percent .. "%|r"
end

-- The warning fires once when the lowest item reaches the level, and is armed again only
-- once the lowest item is above the level (after a repair or a change of gear).
-- state = { armed = true|false }. Returns true when the warning is to be shown now.
function ns.Warning(state, lowest, level)
  if type(lowest) ~= "number" or type(level) ~= "number" then return false end
  if lowest <= level then
    if state.armed then
      state.armed = false
      return true
    end
  else
    state.armed = true
  end
  return false
end

-- Instance kinds the check before an instance looks at: dungeons ("party") and raids.
ns.INSTANCE_KINDS = { party = true, raid = true }

-- Once the lowest item is above the level again (a repair, new gear), the next instance may warn.
function ns.InstanceRearm(state, lowest, level)
  if type(lowest) == "number" and type(level) == "number" and lowest > level then state.warnedFor = nil end
end

-- The warning when you enter a dungeon or raid with worn gear. place = { kind, key } of the instance
-- you are in, nil outside one; level nil means the check is switched off. state = { warnedFor = key }.
-- It fires once per instance: not again after a wipe and the run back, only after the gear was above
-- the level in between or in a different instance. Returns true when the warning is to be shown now.
function ns.InstanceWarning(state, place, lowest, level)
  if type(level) ~= "number" then return false end
  ns.InstanceRearm(state, lowest, level)
  if type(place) ~= "table" or not ns.INSTANCE_KINDS[place.kind] or place.key == nil then return false end
  if type(lowest) ~= "number" or lowest > level then return false end
  if state.warnedFor == place.key then return false end
  state.warnedFor = place.key
  return true
end

-- A warning level from the settings or the chat: a whole number from 5 to 90, else nil.
function ns.ValidWarn(value)
  if type(value) ~= "number" or value ~= math.floor(value) then return nil end
  if value < ns.MIN_WARN or value > ns.MAX_WARN then return nil end
  return value
end

function ns.ParseWarn(text)
  if type(text) ~= "string" then return nil end
  local digits = text:match("^%s*(%d+)%s*%%?%s*$")
  return digits and ns.ValidWarn(tonumber(digits)) or nil
end

-- The two lines of the display: "Gear 87%" and the lowest item.
function ns.DisplayLines(cond)
  local L = ns.L
  if not cond or not cond.overall then
    return L["Gear"] .. " " .. ns.Colored(nil), ns.GREY .. L["Nothing to wear out"] .. "|r"
  end
  local first = L["Gear"] .. " " .. ns.Colored(cond.overall)
  if #cond.damaged == 0 then return first, ns.GREY .. L["No damage"] .. "|r" end
  return first, L[ns.SLOT_LABEL[cond.lowestSlot]] .. " " .. ns.Colored(cond.lowest)
end

local function thousands(n)
  local s = tostring(n)
  local out = s:reverse():gsub("(%d%d%d)", "%1,"):reverse()
  return (out:gsub("^,", ""))
end

function ns.PlainMoney(copper)
  local g = math.floor(copper / 10000)
  local s = math.floor(copper / 100) % 100
  local c = copper % 100
  if g > 0 then return string.format("%sg %02ds %02dc", thousands(g), s, c) end
  if s > 0 then return string.format("%ds %02dc", s, c) end
  return string.format("%dc", c)
end

function ns.FormatMoney(copper)
  if GetMoneyString then return GetMoneyString(copper, true) end
  return ns.PlainMoney(copper)
end

-- 1.2: the repair cost history. One visit is { t = time, cost = copper, paid = "gold"|"guild"|nil }:
-- the full repair price shown at a vendor who can repair while the gear was damaged, and how it was
-- paid when you repaired there (nil: not repaired at that visit). The list is oldest first.

ns.HISTORY_KEEP = 20       -- visits kept per character
ns.WEEK = 7 * 86400        -- seconds the total looks back
ns.REVISIT = 600           -- seconds: the same price again this soon, unrepaired, is the same visit
ns.PAID = { gold = true, guild = true }

-- A saved visit that can be used, else nil.
function ns.ValidVisit(v)
  if type(v) ~= "table" then return nil end
  if type(v.t) ~= "number" or v.t <= 0 then return nil end
  if type(v.cost) ~= "number" or v.cost <= 0 or v.cost ~= math.floor(v.cost) then return nil end
  if v.paid ~= nil and not ns.PAID[v.paid] then v.paid = nil end
  return v
end

-- The saved list of one character, cleaned: only usable visits, oldest first, at most HISTORY_KEEP.
function ns.CleanHistory(list)
  local out = {}
  if type(list) ~= "table" then return out end
  for _, v in ipairs(list) do
    if ns.ValidVisit(v) then out[#out + 1] = v end
  end
  table.sort(out, function(a, b) return a.t < b.t end)
  while #out > ns.HISTORY_KEEP do table.remove(out, 1) end
  return out
end

-- Notes the price seen at a vendor. The same price again within REVISIT seconds, without a repair
-- in between, is the same visit. Returns the visit, or nil when the cost cannot be used.
function ns.AddVisit(list, now, cost)
  if type(list) ~= "table" or type(now) ~= "number" then return nil end
  if type(cost) ~= "number" or cost <= 0 or cost ~= math.floor(cost) then return nil end
  local last = list[#list]
  if last and last.paid == nil and last.cost == cost and now >= last.t and now - last.t < ns.REVISIT then
    last.t = now
    return last
  end
  local visit = { t = now, cost = cost }
  list[#list + 1] = visit
  while #list > ns.HISTORY_KEEP do table.remove(list, 1) end
  return visit
end

-- Notes how a visit was paid. The first answer counts: a guild repair is not turned into gold later.
function ns.MarkPaid(visit, how)
  if type(visit) ~= "table" or not ns.PAID[how] or visit.paid ~= nil then return false end
  visit.paid = how
  return true
end

-- What the repairs of the last 7 days cost: all of them, the part paid by the guild, and how many.
-- Visits without a repair do not count.
function ns.WeekTotal(list, now)
  local total, guild, count = 0, 0, 0
  if type(list) ~= "table" or type(now) ~= "number" then return total, guild, count end
  for _, v in ipairs(list) do
    if v.paid and v.t <= now and now - v.t < ns.WEEK then
      total, count = total + v.cost, count + 1
      if v.paid == "guild" then guild = guild + v.cost end
    end
  end
  return total, guild, count
end

-- How much durability is missing in total, and the total maximum. A repair lowers the first while
-- the second stays the same; other gear changes the second.
function ns.Wear(items)
  local missing, max = 0, 0
  for _, it in ipairs(items or {}) do
    if type(it.cur) == "number" and type(it.max) == "number" and it.max > 0 then
      missing = missing + math.max(it.max - math.max(it.cur, 0), 0)
      max = max + it.max
    end
  end
  return missing, max
end

-- "Nov 20 18:05: 12g 34s 56c, repaired with your gold."
function ns.VisitText(v)
  local L = ns.L
  local how = v.paid == "guild" and L["repaired with guild money"] or v.paid == "gold" and L["repaired with your gold"] or L["not repaired"]
  return string.format(L["%s: %s, %s."], date(L["%b %d %H:%M"], v.t), ns.FormatMoney(v.cost), how)
end

-- "Repairs in the last 7 days: 3g 00s 00c (1g 00s 00c from the guild)."
function ns.WeekText(list, now)
  local L = ns.L
  local total, guild, count = ns.WeekTotal(list, now)
  if count == 0 then return L["No repairs in the last 7 days."] end
  if guild > 0 then
    return string.format(L["Repairs in the last 7 days: %s (%s from the guild)."], ns.FormatMoney(total), ns.FormatMoney(guild))
  end
  return string.format(L["Repairs in the last 7 days: %s."], ns.FormatMoney(total))
end
