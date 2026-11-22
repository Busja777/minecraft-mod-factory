local _, ns = ...
local L = ns.L

-- Pure bookkeeping: no frames, no events. Everything here runs outside the game in the tests.

ns.KINDS = { "herb", "ore" }
ns.KIND_LABEL = { herb = "Herbs", ore = "Ores" }

ns.MIN_RATE_SECONDS = 300 -- a rate is shown once 5 minutes have passed since the first item
ns.TOP = 5                -- items listed in chat and in the tooltip

-- Item classes from the client's own enums, with the numbers they have always had as fallback.
local function enum(group, key, fallback)
  local t = Enum and Enum[group]
  local v = t and t[key]
  if type(v) == "number" then return v end
  return fallback
end

ns.CLASS_TRADEGOODS = enum("ItemClass", "Tradegoods", 7)
ns.SUBCLASS_HERB = enum("ItemTradeGoodsSubclass", "Herb", 9)
ns.SUBCLASS_ORE = enum("ItemTradeGoodsSubclass", "MetalAndStone", 7)
ns.LOOT_SLOT_ITEM = enum("LootSlotType", "Item", LOOT_SLOT_ITEM or 1)

function ns.IsSecret(value)
  return issecretvalue ~= nil and issecretvalue(value) and true or false
end

-- A value read from the game; nil when it is missing or must not be used.
function ns.Plain(value)
  if value == nil or ns.IsSecret(value) then return nil end
  return value
end

-- "herb", "ore" or nil for anything else.
function ns.KindOf(classID, subclassID)
  classID, subclassID = ns.Plain(classID), ns.Plain(subclassID)
  if type(classID) ~= "number" or type(subclassID) ~= "number" then return nil end
  if classID ~= ns.CLASS_TRADEGOODS then return nil end
  if subclassID == ns.SUBCLASS_HERB then return "herb" end
  if subclassID == ns.SUBCLASS_ORE then return "ore" end
  return nil
end

function ns.ItemIDFromLink(link)
  if type(link) ~= "string" then return nil end
  return tonumber(link:match("item:(%d+)"))
end

function ns.NameFromLink(link)
  if type(link) ~= "string" then return nil end
  local name = link:match("%[(.-)%]")
  if name and name ~= "" then return name end
  return nil
end

-- One loot slot as a plain record { kind, itemID, name, link, count }, or nil when it is not a
-- herb or ore, or when any value needed is unknown or secret.
function ns.LootEntry(slotType, link, name, quantity, itemID, classID, subclassID)
  slotType, link, name, quantity = ns.Plain(slotType), ns.Plain(link), ns.Plain(name), ns.Plain(quantity)
  itemID = ns.Plain(itemID)
  if slotType ~= ns.LOOT_SLOT_ITEM then return nil end
  if type(quantity) ~= "number" or quantity < 1 or quantity ~= math.floor(quantity) then return nil end
  local kind = ns.KindOf(classID, subclassID)
  if not kind then return nil end
  if type(itemID) ~= "number" then itemID = ns.ItemIDFromLink(link) end
  if not itemID then return nil end
  if type(link) ~= "string" or link == "" then link = nil end
  if type(name) ~= "string" or name == "" then name = ns.NameFromLink(link) end
  return { kind = kind, itemID = itemID, name = name or ("item:" .. itemID), link = link, count = quantity }
end

-- A session: what was gathered since login, a reload or /gt reset. first is the time of the first
-- herb or ore, the start of the per-hour rate.
function ns.NewSession(now)
  return { start = now, first = nil, items = {}, totals = { herb = 0, ore = 0 } }
end

function ns.Add(session, entry, now)
  if not entry then return end
  local item = session.items[entry.itemID]
  if not item then
    item = { itemID = entry.itemID, kind = entry.kind, name = entry.name, link = entry.link, count = 0 }
    session.items[entry.itemID] = item
  end
  if entry.link then item.link = entry.link end
  item.count = item.count + entry.count
  session.totals[entry.kind] = (session.totals[entry.kind] or 0) + entry.count
  session.first = session.first or now
end

function ns.Total(session)
  return (session.totals.herb or 0) + (session.totals.ore or 0)
end

-- Seconds since the first herb or ore of the session, nil before it.
function ns.Elapsed(session, now)
  if not session.first then return nil end
  local s = now - session.first
  return s > 0 and s or 0
end

-- Items per hour, nil while there is nothing or less than MIN_RATE_SECONDS to measure:
-- one node in the first minute would otherwise read as hundreds per hour.
function ns.PerHour(count, seconds)
  if not count or count <= 0 then return nil end
  if not seconds or seconds < ns.MIN_RATE_SECONDS then return nil end
  return math.floor(count * 3600 / seconds + 0.5)
end

function ns.Rate(session, kind, now)
  return ns.PerHour(session.totals[kind] or 0, ns.Elapsed(session, now))
end

-- The items of one kind (or of both when kind is nil), most gathered first.
function ns.Top(session, kind, n)
  local list = {}
  for _, item in pairs(session.items) do
    if not kind or item.kind == kind then list[#list + 1] = item end
  end
  table.sort(list, function(a, b)
    if a.count ~= b.count then return a.count > b.count end
    if a.name ~= b.name then return a.name < b.name end
    return a.itemID < b.itemID
  end)
  if n then
    for i = #list, n + 1, -1 do list[i] = nil end
  end
  return list
end

-- "Herbs: 42 (120 per hour)" for chat.
function ns.KindLine(session, kind, now)
  local total = session.totals[kind] or 0
  local label = L[ns.KIND_LABEL[kind]]
  if total == 0 then return string.format(L["%s: none yet"], label) end
  local rate = ns.Rate(session, kind, now)
  if rate then return string.format(L["%s: %d (%d per hour)"], label, total, rate) end
  return string.format(L["%s: %d (per hour after 5 minutes)"], label, total)
end

-- "Herbs 42  ·  120/h" for the small display.
function ns.ShortLine(session, kind, now)
  local total = session.totals[kind] or 0
  local rate = ns.Rate(session, kind, now)
  local label = L[ns.KIND_LABEL[kind]]
  if rate then return string.format(L["%s %d  |cff9d9d9d%d/h|r"], label, total, rate) end
  return string.format(L["%s %d"], label, total)
end

function ns.ItemText(item)
  return string.format(L["%s x%d"], item.link or item.name, item.count)
end
