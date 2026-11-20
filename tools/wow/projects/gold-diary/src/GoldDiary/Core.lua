local _, ns = ...

-- Pure bookkeeping: no frames, no events. Everything here runs outside the game in the tests.

ns.CATEGORIES = {
  "loot", "quests", "vendor", "repairs", "auction", "mail", "trainer",
  "travel", "trade", "appearance", "bank", "guildbank", "other",
}

ns.CATEGORY_LABEL = {
  loot = "Loot", quests = "Quests", vendor = "Vendor", repairs = "Repairs",
  auction = "Auction House", mail = "Mail", trainer = "Trainer", travel = "Flight paths",
  trade = "Trade", appearance = "Barber & transmog", bank = "Warband bank",
  guildbank = "Guild bank", other = "Other",
}

-- Moving gold into or out of a bank is neither earning nor spending.
ns.TRANSFERS = { bank = true, guildbank = true }

-- When several windows are open, the first one in this list explains the money change.
ns.CONTEXT_PRIORITY = {
  "trade", "auction", "mail", "vendor", "trainer", "travel",
  "appearance", "bank", "guildbank", "quests", "loot",
}

ns.GRACE = 1.5      -- seconds a closed window still explains a money change
ns.KEEP_DAYS = 60   -- days of history kept per character

function ns.IsSecret(value)
  return issecretvalue ~= nil and issecretvalue(value) and true or false
end

function ns.NewBucket()
  return { inc = {}, out = {} }
end

function ns.Add(bucket, cat, diff)
  if diff > 0 then
    bucket.inc[cat] = (bucket.inc[cat] or 0) + diff
  elseif diff < 0 then
    bucket.out[cat] = (bucket.out[cat] or 0) - diff
  end
end

-- Re-books an earlier change from one category to another.
function ns.Move(bucket, from, to, diff)
  if from == to or diff == 0 then return end
  local side = diff > 0 and bucket.inc or bucket.out
  local amount = diff > 0 and diff or -diff
  local left = (side[from] or 0) - amount
  side[from] = left > 0 and left or nil
  side[to] = (side[to] or 0) + amount
end

function ns.Merge(into, bucket)
  for cat, v in pairs(bucket.inc) do into.inc[cat] = (into.inc[cat] or 0) + v end
  for cat, v in pairs(bucket.out) do into.out[cat] = (into.out[cat] or 0) + v end
  return into
end

function ns.Totals(bucket)
  local t = { income = 0, expense = 0, moved = 0 }
  for cat, v in pairs(bucket.inc) do
    if ns.TRANSFERS[cat] then t.moved = t.moved + v else t.income = t.income + v end
  end
  for cat, v in pairs(bucket.out) do
    if ns.TRANSFERS[cat] then t.moved = t.moved - v else t.expense = t.expense + v end
  end
  t.net = t.income - t.expense
  return t
end

-- Category rows in a fixed order, only those that moved any money.
function ns.Rows(bucket)
  local rows = {}
  for _, cat in ipairs(ns.CATEGORIES) do
    local inc, out = bucket.inc[cat] or 0, bucket.out[cat] or 0
    if inc > 0 or out > 0 then
      rows[#rows + 1] = { cat = cat, label = ns.L[ns.CATEGORY_LABEL[cat]], inc = inc, out = out }
    end
  end
  return rows
end

-- Day keys are local dates. Counting back from noon keeps daylight saving changes harmless.
function ns.DayKey(now, back)
  local d = date("*t", now)
  return date("%Y-%m-%d", time({ year = d.year, month = d.month, day = d.day - (back or 0), hour = 12 }))
end

function ns.LastDays(days, n, now)
  local total = ns.NewBucket()
  for i = 0, n - 1 do
    local day = days[ns.DayKey(now, i)]
    if day then ns.Merge(total, day) end
  end
  return total
end

function ns.Prune(days, now, keep)
  local cutoff = ns.DayKey(now, (keep or ns.KEEP_DAYS) - 1)
  for key in pairs(days) do
    if key < cutoff then days[key] = nil end
  end
end

-- ctx = { open = { cat = true }, closedAt = { cat = seconds }, forced = { cat, at, sign, amount } }
function ns.Classify(ctx, diff, now)
  local f = ctx.forced
  if f and now - f.at <= ns.GRACE and (diff > 0) == (f.sign > 0) and (not f.amount or f.amount == diff) then
    ctx.forced = nil
    return f.cat
  end
  for _, cat in ipairs(ns.CONTEXT_PRIORITY) do
    if ctx.open[cat] then return cat end
  end
  local best, bestAt
  for _, cat in ipairs(ns.CONTEXT_PRIORITY) do
    local t = ctx.closedAt[cat]
    if t and now - t <= ns.GRACE and (not bestAt or t > bestAt) then best, bestAt = cat, t end
  end
  return best or "other"
end

function ns.PerHour(amount, seconds)
  if not seconds or seconds < 60 then return nil end
  return math.floor(amount * 3600 / seconds)
end

local function thousands(n)
  local s = tostring(n)
  local out = s:reverse():gsub("(%d%d%d)", "%1,"):reverse()
  return (out:gsub("^,", ""))
end

function ns.PlainMoney(copper)
  local sign = copper < 0 and "-" or ""
  copper = math.abs(copper)
  local g = math.floor(copper / 10000)
  local s = math.floor(copper / 100) % 100
  local c = copper % 100
  if g > 0 then return string.format("%s%sg %02ds %02dc", sign, thousands(g), s, c) end
  if s > 0 then return string.format("%s%ds %02dc", sign, s, c) end
  return string.format("%s%dc", sign, c)
end

function ns.FormatMoney(copper)
  if copper == 0 then return "0" end
  if GetMoneyString then
    local text = GetMoneyString(math.abs(copper), true)
    return copper < 0 and ("-" .. text) or text
  end
  return ns.PlainMoney(copper)
end

-- All characters of the account, richest first.
function ns.CharacterList(chars)
  local list, total = {}, 0
  for key, c in pairs(chars) do
    local money = c.money or 0
    local name, realm = key:match("^(.-)%-(.+)$")
    list[#list + 1] = { key = key, name = name or key, realm = realm or "", class = c.class, money = money }
    total = total + money
  end
  table.sort(list, function(a, b)
    if a.money ~= b.money then return a.money > b.money end
    return a.key < b.key
  end)
  return list, total
end

function ns.ClassColored(name, classFile)
  local color = RAID_CLASS_COLORS and classFile and RAID_CLASS_COLORS[classFile]
  if color and color.colorStr then return "|c" .. color.colorStr .. name .. "|r" end
  return name
end

function ns.DayTime(now, back)
  local d = date("*t", now)
  return time({ year = d.year, month = d.month, day = d.day - (back or 0), hour = 12 })
end

-- One entry per day, today first, plus totals and the best day.
function ns.History(days, n, now)
  local list, total, best, active = {}, ns.NewBucket(), nil, 0
  for i = 0, n - 1 do
    local key = ns.DayKey(now, i)
    local day = days[key] or ns.NewBucket()
    local t = ns.Totals(day)
    local entry = { key = key, time = ns.DayTime(now, i), income = t.income, expense = t.expense, net = t.net }
    list[#list + 1] = entry
    ns.Merge(total, day)
    if t.income > 0 or t.expense > 0 then
      active = active + 1
      if not best or t.net > best.net then best = entry end
    end
  end
  return list, ns.Totals(total), best, active
end
