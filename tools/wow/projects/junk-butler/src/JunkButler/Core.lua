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

-- keep = { [itemID] = link or true }: the items the player never wants sold.
function ns.IsKept(keep, id)
  return keep ~= nil and id ~= nil and keep[id] ~= nil and keep[id] ~= false
end

-- The items to sell, in bag order, and the number of pieces held back by the keep list.
function ns.SellPlan(items, keep)
  local plan, kept = {}, 0
  for _, item in ipairs(items) do
    if ns.Sellable(item) then
      if ns.IsKept(keep, item.id) then
        kept = kept + item.count
      else
        plan[#plan + 1] = item
      end
    end
  end
  return plan, kept
end

-- Item IDs named in a chat command: from item links (shift-click) or typed as numbers.
-- Returns the IDs in order without repeats and, for each ID given as a link, that link.
function ns.ParseItems(text)
  local ids, links, seen = {}, {}, {}
  local function add(id)
    id = tonumber(id)
    if id and id > 0 and not seen[id] then
      seen[id] = true
      ids[#ids + 1] = id
    end
  end
  for link, id in text:gmatch("(|c[^|]*|Hitem:(%d+)[^|]*|h%[.-%]|h|r)") do
    if not links[tonumber(id)] then links[tonumber(id)] = link end
  end
  for id in text:gmatch("item:(%d+)") do add(id) end
  if #ids == 0 then
    for word in text:gmatch("%S+") do
      if word:match("^%d+$") then add(word) end
    end
  end
  return ids, links
end

-- Brings the saved keep list to its current shape: number keys only.
function ns.CleanKeepList(keep)
  local clean = {}
  if type(keep) ~= "table" then return clean end
  for id, value in pairs(keep) do
    if type(id) == "number" and id > 0 and value then
      clean[id] = type(value) == "string" and value or true
    end
  end
  return clean
end

-- The IDs of the keep list, smallest first.
function ns.KeptIDs(keep)
  local ids = {}
  for id in pairs(keep) do ids[#ids + 1] = id end
  table.sort(ids)
  return ids
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

-- result = { items, earned, repaired = cost paid, short = cost the gold did not reach for,
--           kept = pieces held back by the keep list }
-- Returns nil when nothing happened. Kept items alone are no reason to speak.
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
  if result.kept and result.kept > 0 then
    local text = result.kept == 1 and L["Kept %d item on your keep list."] or L["Kept %d items on your keep list."]
    parts[#parts + 1] = string.format(text, result.kept)
  end
  return table.concat(parts, " ")
end
