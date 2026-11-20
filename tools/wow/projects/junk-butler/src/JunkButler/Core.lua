local _, ns = ...

-- Pure decisions: no frames, no events. Everything here runs outside the game in the tests.

ns.POOR = 0     -- item quality of grey items
ns.STEP = 6     -- items sold in one step
ns.DELAY = 0.2  -- seconds between two steps

function ns.IsSecret(value)
  return issecretvalue ~= nil and issecretvalue(value) and true or false
end

-- item = { bag, slot, id, quality, price, count, locked }; price is the vendor price of one piece.
function ns.Sellable(item)
  if item.quality ~= ns.POOR or item.locked then return false end
  if type(item.price) ~= "number" or item.price <= 0 then return false end
  return type(item.count) == "number" and item.count > 0
end

-- The items to sell, in bag order.
function ns.SellPlan(items)
  local plan = {}
  for _, item in ipairs(items) do
    if ns.Sellable(item) then plan[#plan + 1] = item end
  end
  return plan
end

function ns.Totals(items)
  local t = { stacks = 0, items = 0, earned = 0 }
  for _, item in ipairs(items) do
    t.stacks = t.stacks + 1
    t.items = t.items + item.count
    t.earned = t.earned + item.price * item.count
  end
  return t
end

-- The items of one step and the index the next step starts at.
function ns.Step(plan, from, size)
  local step = {}
  local last = math.min(from + (size or ns.STEP) - 1, #plan)
  for i = from, last do step[#step + 1] = plan[i] end
  return step, last + 1
end

-- true when the gear should be repaired now; false, "poor" when the gold does not reach.
function ns.ShouldRepair(cost, money, canRepair)
  if not canRepair or type(cost) ~= "number" or cost <= 0 then return false end
  if type(money) ~= "number" then return false end
  if money < cost then return false, "poor" end
  return true
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

-- result = { items, earned, repaired = cost paid, short = cost the gold did not reach for }
-- Returns nil when nothing happened.
function ns.Summary(result)
  local L = ns.L
  local parts = {}
  if result.items and result.items > 0 then
    local text = result.items == 1 and L["Sold %d junk item for %s."] or L["Sold %d junk items for %s."]
    parts[#parts + 1] = string.format(text, result.items, ns.FormatMoney(result.earned))
  end
  if result.repaired then
    parts[#parts + 1] = string.format(L["Repaired your gear for %s."], ns.FormatMoney(result.repaired))
  elseif result.short then
    parts[#parts + 1] = string.format(L["Not enough gold to repair your gear (%s)."], ns.FormatMoney(result.short))
  end
  if #parts == 0 then return nil end
  return table.concat(parts, " ")
end
