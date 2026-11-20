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
