local _, ns = ...

-- Pure decisions: no frames, no events. Everything here runs outside the game in the tests.

ns.MAX_WANTED = 1000 -- highest count a list entry may ask for
ns.STEP = 4          -- purchases in one step
ns.DELAY = 0.2       -- seconds between two steps
ns.DEFAULT_SHARE = 25 -- warn when an item drops below this percent of its count
ns.MAX_SHARE = 90
ns.WARN_DELAY = 5     -- seconds after login before the first low stock check (the bags are still loading)

function ns.IsSecret(value)
  return issecretvalue ~= nil and issecretvalue(value) and true or false
end

local function whole(n)
  return type(n) == "number" and n == math.floor(n)
end

local function trim(s)
  return (s:gsub("^%s+", ""):gsub("%s+$", ""))
end

-- The item ID of an item link ("|Hitem:6948:...|h[...]|h") or of a plain number; nil otherwise.
function ns.ParseItem(text)
  if type(text) ~= "string" then return nil end
  text = trim(text)
  local id = tonumber(text:match("^(%d+)$") or text:match("^item:(%d+)") or text:match("^|.-|Hitem:(%d+)") or text:match("^|Hitem:(%d+)"))
  if id and id > 0 then return id end
  return nil
end

-- "<item link or item ID> <count>" → itemID, count; or nil, "usage" | "count".
function ns.ParseAdd(text)
  if type(text) ~= "string" then return nil, "usage" end
  local itemText, countText = trim(text):match("^(.-)%s+(%d+)$")
  if not itemText then return nil, "usage" end
  local id = ns.ParseItem(itemText)
  if not id then return nil, "usage" end
  local count = tonumber(countText)
  if count < 1 or count > ns.MAX_WANTED then return nil, "count" end
  return id, count
end

-- The name inside an item link, or nil.
function ns.LinkName(text)
  if type(text) ~= "string" then return nil end
  return text:match("|h%[(.-)%]|h")
end

-- Only the entries the addon can trust: a whole item ID and a whole count from 1 to MAX_WANTED.
function ns.CleanList(list)
  local clean = {}
  if type(list) ~= "table" then return clean end
  for id, count in pairs(list) do
    if whole(id) and id > 0 and whole(count) and count >= 1 and count <= ns.MAX_WANTED then clean[id] = count end
  end
  return clean
end

function ns.CountList(list)
  local n = 0
  for _ in pairs(ns.CleanList(list)) do n = n + 1 end
  return n
end

-- Adds count to the entry of itemID in an ordered list { { itemID, name, count, cost } }.
function ns.Note(list, itemID, name, count, cost)
  for _, entry in ipairs(list) do
    if entry.itemID == itemID then
      entry.count = entry.count + count
      entry.cost = entry.cost + (cost or 0)
      if not entry.name then entry.name = name end
      return list
    end
  end
  list[#list + 1] = { itemID = itemID, name = name, count = count, cost = cost or 0 }
  return list
end

-- A slot can be bought with gold right now.
function ns.Buyable(slot)
  if slot.extendedCost or slot.purchasable == false then return false end
  if type(slot.price) ~= "number" or slot.price < 0 then return false end
  if slot.numAvailable == 0 then return false end -- limited stock, sold out
  return whole(slot.itemID)
end

-- The purchase plan for one vendor visit.
--   slots:  { { index, itemID, name, price (per stack), stackCount, maxStack (pieces per purchase),
--              numAvailable (-1 = unlimited, else stacks left), extendedCost, purchasable } } in vendor order
--   owned:  itemID → count in the bags (nil = unknown, the item is left alone)
--   wanted: itemID → count on the list
--   money:  the player's gold in copper
-- → { buys = { { index, itemID, name, quantity (pieces), cost } }, spent, short = { { itemID, name, count } } }
-- Stacks are rounded up, so the count is reached; short lists what the gold did not reach for.
function ns.Plan(slots, owned, wanted, money)
  local plan = { buys = {}, spent = 0, short = {} }
  if type(money) ~= "number" or type(wanted) ~= "table" or type(slots) ~= "table" then return plan end
  owned = type(owned) == "table" and owned or {}
  local need, poor, order, names = {}, {}, {}, {}
  for position, slot in ipairs(slots) do
    local id = slot.itemID
    local want = wanted[id]
    if want and need[id] == nil then
      local have = owned[id]
      need[id] = type(have) == "number" and math.max(0, want - have) or 0
    end
    if want and need[id] > 0 and ns.Buyable(slot) then
      if names[id] == nil then order[#order + 1] = id end
      names[id] = names[id] or slot.name or false
      local size = whole(slot.stackCount) and slot.stackCount >= 1 and slot.stackCount or 1
      local stacks = math.ceil(need[id] / size)
      if whole(slot.numAvailable) and slot.numAvailable > 0 then stacks = math.min(stacks, slot.numAvailable) end
      if slot.price > 0 then
        local afford = math.floor(money / slot.price)
        if afford < stacks then stacks = math.max(0, afford); poor[id] = true end
      end
      if stacks > 0 then
        local per = math.max(1, math.floor((type(slot.maxStack) == "number" and slot.maxStack or size) / size))
        local left = stacks
        while left > 0 do
          local k = math.min(per, left)
          plan.buys[#plan.buys + 1] = { index = slot.index or position, itemID = id, name = slot.name, quantity = k * size, cost = k * slot.price }
          left = left - k
        end
        money = money - stacks * slot.price
        plan.spent = plan.spent + stacks * slot.price
        need[id] = math.max(0, need[id] - stacks * size)
        if need[id] == 0 then poor[id] = nil end
      end
    end
  end
  for _, id in ipairs(order) do
    if poor[id] and need[id] > 0 then
      ns.Note(plan.short, id, names[id] or nil, need[id])
    end
  end
  return plan
end

-- The purchases of one step and the index the next step starts at.
function ns.Step(buys, from, size)
  local step = {}
  local last = math.min(from + (size or ns.STEP) - 1, #buys)
  for i = from, last do step[#step + 1] = buys[i] end
  return step, last + 1
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

local function label(entry)
  return entry.name or string.format(ns.L["item %d"], entry.itemID)
end

local function items(list)
  local parts = {}
  for _, entry in ipairs(list) do parts[#parts + 1] = entry.count .. " " .. label(entry) end
  return table.concat(parts, ", ")
end

-- "Bought 20 Water, 5 Feather for 1g 20s 00c."; nil when nothing was bought.
function ns.BoughtLine(bought, spent)
  if type(bought) ~= "table" or #bought == 0 then return nil end
  if not spent or spent <= 0 then return string.format(ns.L["Bought %s."], items(bought)) end
  return string.format(ns.L["Bought %s for %s."], items(bought), ns.FormatMoney(spent))
end

-- The line about what the gold did not reach for; nil when it reached.
function ns.ShortLine(short)
  if type(short) ~= "table" or #short == 0 then return nil end
  return string.format(ns.L["Not enough gold for everything, still missing: %s."], items(short))
end

-- The low stock warning: a share (in percent) of the count on the list; 0 switches it off.
function ns.ValidShare(value)
  if not whole(value) or value < 0 or value > ns.MAX_SHARE then return nil end
  return value
end

-- "25", "25%" or "off" → a share; nil for anything else.
function ns.ParseShare(text)
  if type(text) ~= "string" then return nil end
  text = trim(text):lower()
  if text == "off" then return 0 end
  local digits = text:match("^(%d+)%s*%%?$")
  return ns.ValidShare(tonumber(digits or ""))
end

-- True when have is below share percent of want (whole numbers only, no rounding).
function ns.IsLow(have, want, share)
  if type(have) ~= "number" or type(want) ~= "number" or type(share) ~= "number" or share <= 0 then return false end
  return have * 100 < want * share
end

-- The items to warn about now, sorted by item ID: { { itemID, have, want } }.
--   owned:  itemID → count in the bags (nil = unknown, that item is left as it is)
--   warned: itemID → true for items already warned about; updated here. An item is warned about
--           once, and again only after its count went back up to the share or above.
function ns.LowStock(owned, wanted, share, warned)
  local due = {}
  if type(owned) ~= "table" or type(warned) ~= "table" then return due end
  share = ns.ValidShare(share) or 0
  wanted = ns.CleanList(wanted)
  local ids = {}
  for id in pairs(wanted) do ids[#ids + 1] = id end
  table.sort(ids)
  for _, id in ipairs(ids) do
    local have = owned[id]
    if type(have) == "number" then
      if not ns.IsLow(have, wanted[id], share) then
        warned[id] = nil
      elseif not warned[id] then
        warned[id] = true
        due[#due + 1] = { itemID = id, have = have, want = wanted[id] }
      end
    end
  end
  return due
end

-- "Water is running low: 4 of 20 left."
function ns.LowLine(entry, name)
  return string.format(ns.L["%s is running low: %d of %d left."], name or string.format(ns.L["item %d"], entry.itemID), entry.have, entry.want)
end

-- The list sorted by name (then ID) as lines "Name: 20". nameOf(itemID) gives the name or nil.
function ns.ListLines(list, nameOf)
  local rows = {}
  for id, count in pairs(ns.CleanList(list)) do
    local name = nameOf and nameOf(id) or nil
    rows[#rows + 1] = { id = id, name = name or string.format(ns.L["item %d"], id), count = count }
  end
  table.sort(rows, function(a, b)
    if a.name ~= b.name then return a.name < b.name end
    return a.id < b.id
  end)
  local lines = {}
  for _, row in ipairs(rows) do lines[#lines + 1] = row.name .. ": " .. row.count end
  return lines
end
