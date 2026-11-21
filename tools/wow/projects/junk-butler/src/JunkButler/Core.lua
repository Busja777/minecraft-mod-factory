local _, ns = ...

-- Pure decisions: no frames, no events. Everything here runs outside the game in the tests.

ns.POOR = 0     -- item quality of grey items
ns.STEP = 6     -- items sold in one step
ns.DELAY = 0.2  -- seconds between two steps
ns.GUILD_WAIT = 1 -- seconds the game gets to answer a guild bank repair before it is checked

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

-- 1.2: whether the guild bank can pay a repair of this cost.
-- withdraw = what the player may still take from the guild bank today (GetGuildBankWithdrawMoney,
-- -1 means no limit), bankMoney = the gold in the guild bank (GetGuildBankMoney).
-- Unknown numbers count as "cannot pay": then the player's own gold pays as before.
function ns.GuildCanPay(cost, withdraw, bankMoney)
  if type(cost) ~= "number" or cost <= 0 then return false end
  if type(withdraw) ~= "number" or type(bankMoney) ~= "number" then return false end
  local limit = bankMoney
  if withdraw >= 0 then limit = math.min(withdraw, bankMoney) end
  return limit >= cost
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

-- result = { items, earned, repaired = cost paid, guild = true when the guild bank paid it,
--           short = cost the gold did not reach for, kept = pieces held back by the keep list }
-- Returns nil when nothing happened. Kept items alone are no reason to speak.
function ns.Summary(result)
  local L = ns.L
  local parts = {}
  if result.items and result.items > 0 then
    local text = result.items == 1 and L["Sold %d junk item for %s."] or L["Sold %d junk items for %s."]
    parts[#parts + 1] = string.format(text, result.items, ns.FormatMoney(result.earned))
  end
  if result.repaired and result.guild then
    parts[#parts + 1] = string.format(L["Repaired your gear for %s from the guild bank."], ns.FormatMoney(result.repaired))
  elseif result.repaired then
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

-- 1.3: the sale log. Each character keeps its last LOG_KEEP vendor visits that sold something,
-- newest first: visit = { at = time(), vendor = name or nil, count = pieces, earned = copper,
-- items = { { id, link = link or nil, name = name or nil (only without a link), count, earned } } }.
ns.LOG_KEEP = 20
ns.RECENT = 15 * 60 -- seconds a sale counts as recent in /jb log

-- Adds one sold stack to a visit's item list; stacks of the same item are added up.
function ns.AddSale(items, id, link, count, earned, name)
  for _, it in ipairs(items) do
    if it.id == id then
      it.count = it.count + count
      it.earned = it.earned + earned
      it.link = it.link or link
      if it.link then it.name = nil else it.name = it.name or name end
      return it
    end
  end
  local it = { id = id, link = link, name = not link and name or nil, count = count, earned = earned }
  items[#items + 1] = it
  return it
end

-- Puts a visit at the top of the log; the oldest beyond LOG_KEEP fall off.
function ns.AddVisit(log, visit)
  table.insert(log, 1, visit)
  while #log > ns.LOG_KEEP do table.remove(log) end
end

local function whole(value)
  return type(value) == "number" and value >= 0 and value == math.floor(value)
end

local function cleanVisit(v)
  if type(v) ~= "table" or not whole(v.count) or not whole(v.earned) then return nil end
  local items = {}
  for _, it in ipairs(type(v.items) == "table" and v.items or {}) do
    if type(it) == "table" and whole(it.id) and whole(it.count) and whole(it.earned) then
      items[#items + 1] = {
        id = it.id, count = it.count, earned = it.earned,
        link = type(it.link) == "string" and it.link or nil,
        name = type(it.name) == "string" and it.name or nil,
      }
    end
  end
  return {
    at = type(v.at) == "number" and v.at or nil,
    vendor = type(v.vendor) == "string" and v.vendor or nil,
    count = v.count, earned = v.earned, items = items,
  }
end

-- Brings the saved logs to their current shape: { ["Name-Realm"] = { visit, ... } }, at most
-- LOG_KEEP visits each, broken entries dropped. 1.2 data has no log and starts with an empty one.
function ns.CleanLogs(logs)
  local clean = {}
  if type(logs) ~= "table" then return clean end
  for key, list in pairs(logs) do
    if type(key) == "string" and type(list) == "table" then
      local visits = {}
      for _, v in ipairs(list) do
        local c = cleanVisit(v)
        if c and #visits < ns.LOG_KEEP then visits[#visits + 1] = c end
      end
      clean[key] = visits
    end
  end
  return clean
end

-- Whole minutes since a sale while it is less than RECENT seconds old; nil otherwise.
function ns.RecentMinutes(at, now)
  if type(at) ~= "number" or type(now) ~= "number" then return nil end
  local age = now - at
  if age < 0 or age >= ns.RECENT then return nil end
  return math.floor(age / 60)
end

local function when(at)
  if type(at) ~= "number" or not date then return "?" end
  return date(ns.L["%b %d %H:%M"], at)
end

-- "2. Nov 20 18:04, Grumbold: 12 items for 1g 20s 00c (8 min ago)". The mark for recent sales
-- only says how old they are; whether the vendor still offers them back is up to the game.
function ns.VisitLine(n, v, now)
  local L = ns.L
  local text = v.count == 1 and L["%d item for %s"] or L["%d items for %s"]
  local line = string.format("%d. %s", n, when(v.at))
  if v.vendor then line = line .. ", " .. v.vendor end
  line = line .. ": " .. string.format(text, v.count, ns.FormatMoney(v.earned))
  local minutes = ns.RecentMinutes(v.at, now)
  if minutes == 0 then
    line = line .. " " .. L["(less than a minute ago)"]
  elseif minutes then
    line = line .. " " .. string.format(L["(%d min ago)"], minutes)
  end
  return line
end

-- "[Torn Wristband] x5: 50c"; without a link the item's name, and an item the game had not
-- loaded at the sale is named by its ID.
function ns.SaleLine(it)
  local name = it.link or it.name or string.format(ns.L["item %d"], it.id)
  return string.format("%s x%d: %s", name, it.count, ns.FormatMoney(it.earned))
end

-- Pieces and copper of all visits in the log.
function ns.LogTotals(log)
  local count, earned = 0, 0
  for _, v in ipairs(log) do
    count = count + v.count
    earned = earned + v.earned
  end
  return count, earned
end

-- Whether any visit of the log is recent.
function ns.AnyRecent(log, now)
  for _, v in ipairs(log) do
    if ns.RecentMinutes(v.at, now) then return true end
  end
  return false
end
