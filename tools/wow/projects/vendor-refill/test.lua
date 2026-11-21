-- Tests for Vendor Refill, run by tools/wow/client/run.lua.

-- The parts of the game the stand-in client lacks: bags, a vendor and a timer.
-- goods[index] = { id, name, price (per stack), stack, max (pieces per purchase), avail (-1 = unlimited), extended, purchasable }
local function world(wow, goods, bags)
  local w = { goods = goods or {}, bags = bags or {}, names = {}, open = false, shift = false, bought = {}, timers = {} }

  C_Item = {
    GetItemCount = function(id, includeBank)
      if includeBank then error("only the bags count") end
      return w.bags[id] or 0
    end,
    GetItemNameByID = function(id) return w.names[id] end,
  }
  C_MerchantFrame = {
    GetItemInfo = function(index)
      local g = w.goods[index]
      if not g then return nil end
      return {
        name = g.name, texture = 134400, price = g.price, stackCount = g.stack or 1, numAvailable = g.avail or -1,
        isPurchasable = g.purchasable ~= false, isUsable = true, hasExtendedCost = g.extended or false,
      }
    end,
  }
  GetMerchantNumItems = function() return #w.goods end
  GetMerchantItemID = function(index) return w.goods[index] and w.goods[index].id end
  GetMerchantItemLink = function(index) return w.links and w.goods[index] and ("[" .. w.goods[index].name .. "]") or nil end
  GetMerchantItemMaxStack = function(index) return w.goods[index] and (w.goods[index].max or 20) end
  BuyMerchantItem = function(index, quantity)
    local g = w.goods[index]
    if not g or not w.open then return end
    local stack = g.stack or 1
    w.bought[#w.bought + 1] = index .. "x" .. quantity
    w.bags[g.id] = (w.bags[g.id] or 0) + quantity
    wow.money = wow.money - g.price * quantity / stack
    if g.avail and g.avail > 0 then g.avail = g.avail - quantity / stack end
  end

  C_Timer = { After = function(seconds, fn) w.timers[#w.timers + 1] = { seconds = seconds, fn = fn } end }
  IsShiftKeyDown = function() return w.shift end

  -- Runs the timers that are waiting now; what they start waits for the next tick.
  function w.tick()
    local due = w.timers
    w.timers = {}
    for _, t in ipairs(due) do t.fn() end
    return #due
  end
  function w.run()
    for _ = 1, 100 do if w.tick() == 0 then return end end
    error("the timers never stop")
  end
  function w.visit()
    w.open = true
    wow.fire("MERCHANT_SHOW")
  end
  function w.leave()
    w.open = false
    wow.fire("MERCHANT_CLOSED")
  end
  return w
end

local WATER, BREAD, FEATHER, POWDER, TOKEN = 159, 4540, 17056, 17020, 9999

-- Starts the addon with a list for the current character (itemID → count).
local function boot(wow, money, list)
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.money = money or 0
  wow.fire("ADDON_LOADED", "VendorRefill")
  wow.fire("PLAYER_LOGIN")
  for id, count in pairs(list or {}) do ns.list[id] = count end
  return ns
end

local function water(price) return { id = WATER, name = "Water", price = price or 25 } end
local function bread(price) return { id = BREAD, name = "Bread", price = price or 25 } end

local PREFIX = "|cffffd100Vendor Refill:|r "

test("addon defines only its own globals", function(wow)
  local w = world(wow, { water(), bread() })
  local mine = {}
  for k in pairs(_G) do mine[k] = true end
  boot(wow, 10000, { [WATER] = 10 })
  w.visit()
  w.run()
  w.leave()
  wow.slash("/vr")
  wow.slash("/vr add 4540 5")
  wow.slash("/vendorrefill list")
  wow.slash("/vr remove 4540")
  wow.slash("/vr off")
  eq(w.bags[WATER], 10)
  wow.clock = wow.clock + 60
  w.bags[WATER] = 1
  wow.fire("BAG_UPDATE_DELAYED")
  wow.slash("/vr warn 40")
  local allowed = { VendorRefillDB = true, SLASH_VENDORREFILL1 = true, SLASH_VENDORREFILL2 = true }
  for k in pairs(_G) do
    if not mine[k] and not allowed[k] then error("unexpected global " .. tostring(k)) end
  end
  eq(#wow.chat > 0 and wow.chat[#wow.chat]:find("running low", 1, true) ~= nil, true)
end)

test("core: item links, item IDs and the add command are read", function(wow)
  local ns = boot(wow)
  eq(ns.ParseItem("159"), 159)
  eq(ns.ParseItem("  159 "), 159)
  eq(ns.ParseItem("item:159"), 159)
  eq(ns.ParseItem("|cffffffff|Hitem:159::::::::80:::::|h[Refreshing Spring Water]|h|r"), 159)
  eq(ns.ParseItem("|cnIQ1:|Hitem:159::::::::80:::::|h[Refreshing Spring Water]|h|r"), 159, "the newer colour code")
  eq(ns.ParseItem("|Hitem:159|h[Water]|h"), 159)
  eq(ns.ParseItem("Water"), nil)
  eq(ns.ParseItem("0"), nil)
  eq(ns.ParseItem("|Hspell:133|h[Fireball]|h"), nil, "not an item")
  eq(ns.ParseItem(nil), nil)

  local id, count = ns.ParseAdd("159 20")
  eq(id, 159)
  eq(count, 20)
  id, count = ns.ParseAdd("|cffffffff|Hitem:159::::::::80:::::|h[Water 2]|h|r   1000 ")
  eq(id, 159, "digits inside the link name are not the count")
  eq(count, 1000)
  eq(select(2, ns.ParseAdd("159 0")), "count")
  eq(select(2, ns.ParseAdd("159 1001")), "count")
  eq(select(2, ns.ParseAdd("159")), "usage", "count missing")
  eq(select(2, ns.ParseAdd("20")), "usage", "item missing")
  eq(select(2, ns.ParseAdd("159 -5")), "usage")
  eq(select(2, ns.ParseAdd("159 2.5")), "usage")
  eq(select(2, ns.ParseAdd("Water 20")), "usage")
  eq(ns.LinkName("|cffffffff|Hitem:159|h[Refreshing Spring Water]|h|r"), "Refreshing Spring Water")
  eq(ns.LinkName("159"), nil)
end)

test("core: the list is cleaned, counted and sorted by name", function(wow)
  local ns = boot(wow)
  local list = { [159] = 20, [4540] = 5, [17056] = 0, [3] = 1001, [2.5] = 3, x = 4, [17020] = "10", [8] = 1000 }
  local clean = ns.CleanList(list)
  eq(clean[159], 20)
  eq(clean[4540], 5)
  eq(clean[8], 1000)
  eq(clean[17056], nil)
  eq(clean[3], nil)
  eq(clean.x, nil)
  eq(clean[17020], nil)
  eq(ns.CountList(list), 3)
  eq(ns.CountList("broken"), 0)
  local names = { [159] = "Water", [4540] = "Bread" }
  local lines = ns.ListLines(list, function(id) return names[id] end)
  eq(table.concat(lines, " | "), "Bread: 5 | Water: 20 | item 8: 1000")
  eq(#ns.ListLines({}), 0)
end)

test("core: the plan buys what is missing, in stacks and pieces per purchase", function(wow)
  local ns = boot(wow)
  local slots = {
    { index = 1, itemID = WATER, name = "Water", price = 25, stackCount = 1, maxStack = 20, numAvailable = -1 },
    { index = 2, itemID = BREAD, name = "Bread", price = 100, stackCount = 5, maxStack = 20, numAvailable = -1 },
    { index = 3, itemID = FEATHER, name = "Feather", price = 150, stackCount = 1, maxStack = 20, numAvailable = -1 },
  }
  local plan = ns.Plan(slots, { [WATER] = 2, [BREAD] = 3, [FEATHER] = 0 }, { [WATER] = 45, [BREAD] = 20, [POWDER] = 10 }, 1000000)
  local buys = {}
  for _, b in ipairs(plan.buys) do buys[#buys + 1] = b.index .. "x" .. b.quantity .. "=" .. b.cost end
  -- 43 water as 20 + 20 + 3; 17 bread rounded up to 4 stacks of 5; feathers are not on the list.
  eq(table.concat(buys, " "), "1x20=500 1x20=500 1x3=75 2x20=400")
  eq(plan.spent, 1475)
  eq(#plan.short, 0)

  plan = ns.Plan(slots, { [WATER] = 45, [BREAD] = 50 }, { [WATER] = 45, [BREAD] = 20 }, 1000000)
  eq(#plan.buys, 0, "enough in the bags")
  plan = ns.Plan({ slots[2] }, { [BREAD] = 0 }, { [BREAD] = 12 }, 1000000)
  eq(plan.buys[1].quantity, 15, "rounded up to whole stacks so the count is reached")
  slots[2].maxStack = 3 -- less than one stack: one stack per purchase
  plan = ns.Plan({ slots[2] }, { [BREAD] = 0 }, { [BREAD] = 12 }, 1000000)
  eq(#plan.buys, 3)
  eq(plan.buys[3].quantity, 5)
  slots[1].maxStack = nil
  plan = ns.Plan({ slots[1] }, { [WATER] = 0 }, { [WATER] = 3 }, 1000000)
  eq(#plan.buys, 3, "max per purchase unknown: one stack at a time")
end)

test("core: currencies, sold out items, limited stock and unknown counts", function(wow)
  local ns = boot(wow)
  local wanted = { [WATER] = 10, [BREAD] = 10, [FEATHER] = 10, [POWDER] = 10, [TOKEN] = 10 }
  local owned = { [WATER] = 0, [BREAD] = 0, [FEATHER] = 0, [TOKEN] = 0 } -- powder: count unknown
  local slots = {
    { index = 1, itemID = TOKEN, price = 0, stackCount = 1, maxStack = 20, numAvailable = -1, extendedCost = true },
    { index = 2, itemID = FEATHER, price = 10, stackCount = 1, maxStack = 20, numAvailable = 0 },
    { index = 3, itemID = BREAD, price = 10, stackCount = 1, maxStack = 20, numAvailable = 4 },
    { index = 4, itemID = POWDER, price = 10, stackCount = 1, maxStack = 20, numAvailable = -1 },
    { index = 5, itemID = WATER, price = 10, stackCount = 1, maxStack = 20, numAvailable = -1, purchasable = false },
  }
  local plan = ns.Plan(slots, owned, wanted, 100000)
  eq(#plan.buys, 1)
  eq(plan.buys[1].index, 3)
  eq(plan.buys[1].quantity, 4, "only what the vendor has left")
  eq(#plan.short, 0, "limited stock is not a lack of gold")
  eq(ns.Plan(slots, owned, wanted, nil).buys[1], nil, "gold unknown: nothing")
  eq(#ns.Plan(nil, owned, wanted, 100).buys, 0)
  local free = { { index = 1, itemID = WATER, price = 0, stackCount = 1, maxStack = 20, numAvailable = -1 } }
  eq(ns.Plan(free, { [WATER] = 0 }, { [WATER] = 2 }, 0).buys[1].quantity, 2, "free items need no gold")
end)

test("core: the gold limits the plan and the rest is listed as short", function(wow)
  local ns = boot(wow)
  local slots = {
    { index = 1, itemID = WATER, name = "Water", price = 100, stackCount = 1, maxStack = 20, numAvailable = -1 },
    { index = 2, itemID = BREAD, name = "Bread", price = 500, stackCount = 5, maxStack = 20, numAvailable = -1 },
  }
  local plan = ns.Plan(slots, { [WATER] = 0, [BREAD] = 0 }, { [WATER] = 10, [BREAD] = 20 }, 2700)
  eq(plan.buys[1].quantity, 10)
  eq(plan.buys[2].quantity, 15, "three stacks of bread for the 1700 copper left")
  eq(plan.spent, 2500)
  eq(#plan.short, 1)
  eq(plan.short[1].name, "Bread")
  eq(plan.short[1].count, 5)

  plan = ns.Plan(slots, { [WATER] = 0, [BREAD] = 0 }, { [WATER] = 10, [BREAD] = 20 }, 50)
  eq(#plan.buys, 0)
  eq(ns.ShortLine(plan.short), "Not enough gold for everything, still missing: 10 Water, 20 Bread.")

  -- The same item twice: the cheap slot cannot be paid in full, the second slot is not needed then.
  local twice = {
    { index = 1, itemID = WATER, name = "Water", price = 100, stackCount = 1, maxStack = 20, numAvailable = 3 },
    { index = 2, itemID = WATER, name = "Water", price = 100, stackCount = 1, maxStack = 20, numAvailable = -1 },
  }
  plan = ns.Plan(twice, { [WATER] = 0 }, { [WATER] = 10 }, 100000)
  eq(#plan.buys, 2)
  eq(plan.buys[1].quantity, 3)
  eq(plan.buys[2].quantity, 7, "the second slot only buys the rest")
  eq(#plan.short, 0)
end)

test("core: money texts and the chat lines", function(wow)
  local ns = boot(wow)
  eq(ns.PlainMoney(0), "0c")
  eq(ns.PlainMoney(1205), "12s 05c")
  eq(ns.PlainMoney(123456789), "12,345g 67s 89c")
  eq(ns.BoughtLine({}, 0), nil)
  eq(ns.BoughtLine({ { itemID = 1, name = "Water", count = 20 } }, 500), "Bought 20 Water for 5s 00c.")
  eq(ns.BoughtLine({ { itemID = 1, name = "Water", count = 20 }, { itemID = 9, count = 5 } }, 10500), "Bought 20 Water, 5 item 9 for 1g 05s 00c.")
  eq(ns.BoughtLine({ { itemID = 1, name = "Water", count = 2 } }, 0), "Bought 2 Water.", "free items")
  eq(ns.ShortLine({}), nil)
  local list = {}
  ns.Note(list, 1, nil, 2, 10)
  ns.Note(list, 1, "Water", 3, 15)
  eq(#list, 1)
  eq(list[1].count, 5)
  eq(list[1].cost, 25)
  eq(list[1].name, "Water")
  GetMoneyString = function(copper, separate) return "<" .. copper .. (separate and "," or "") .. ">" end
  eq(ns.FormatMoney(1205), "<1205,>", "the game's own money text is used when it exists")
end)

test("a vendor visit buys what is missing in steps and tells the result", function(wow)
  local goods = { water(25), { id = FEATHER, name = "Feather", price = 150, max = 5 }, bread(25) }
  local w = world(wow, goods, { [WATER] = 5, [BREAD] = 30 })
  local ns = boot(wow, 100000, { [WATER] = 45, [FEATHER] = 20, [BREAD] = 20 })
  w.visit()
  eq(table.concat(w.bought, " "), "1x20 1x20 2x5 2x5", "first step")
  eq(#w.timers, 1)
  eq(w.timers[1].seconds, ns.DELAY)
  eq(#wow.chat, 0, "nothing is said before the work is done")
  w.tick()
  eq(table.concat(w.bought, " "), "1x20 1x20 2x5 2x5 2x5 2x5")
  eq(#w.timers, 0)
  eq(w.bags[WATER], 45)
  eq(w.bags[FEATHER], 20)
  eq(w.bags[BREAD], 30, "more than wanted is left alone")
  eq(wow.money, 100000 - 1000 - 3000)
  eq(#wow.chat, 1)
  eq(wow.chat[1], PREFIX .. "Bought 40 Water, 20 Feather for 40s 00c.")
end)

test("items sold in stacks are bought in whole stacks", function(wow)
  local w = world(wow, { { id = BREAD, name = "Bread", price = 100, stack = 5, max = 20 } }, { [BREAD] = 3 })
  w.links = true
  boot(wow, 100000, { [BREAD] = 20 })
  w.visit()
  w.run()
  eq(table.concat(w.bought, " "), "1x20", "17 missing, 4 stacks of 5")
  eq(w.bags[BREAD], 23)
  eq(wow.money, 100000 - 400)
  eq(wow.chat[1], PREFIX .. "Bought 20 [Bread] for 4s 00c.", "the vendor's item link is used")
end)

test("not enough gold: buys what it can and says what is missing", function(wow)
  local w = world(wow, { water(100), bread(100) }, {})
  boot(wow, 1500, { [WATER] = 10, [BREAD] = 10 })
  w.visit()
  w.run()
  eq(w.bags[WATER], 10)
  eq(w.bags[BREAD], 5)
  eq(wow.money, 0)
  eq(#wow.chat, 2)
  eq(wow.chat[1], PREFIX .. "Bought 10 Water, 5 Bread for 15s 00c.")
  eq(wow.chat[2], PREFIX .. "Not enough gold for everything, still missing: 5 Bread.")

  w.leave()
  w.visit() -- broke: only the short line
  w.run()
  eq(#wow.chat, 3)
  eq(wow.chat[3], PREFIX .. "Not enough gold for everything, still missing: 5 Bread.")
end)

test("nothing needed, nothing printed", function(wow)
  local w = world(wow, { water(), bread() }, { [WATER] = 20 })
  boot(wow, 100000, { [WATER] = 20, [FEATHER] = 5 })
  w.visit()
  w.run()
  w.leave()
  eq(#w.bought, 0)
  eq(#w.timers, 0)
  eq(#wow.chat, 0)

  world(wow, {}, {}).visit() -- a vendor with nothing to sell
  eq(#wow.chat, 0)
end)

test("holding Shift skips one visit", function(wow)
  local w = world(wow, { water() })
  boot(wow, 100000, { [WATER] = 5 })
  w.shift = true
  w.visit()
  w.run()
  w.leave()
  eq(#w.bought, 0)
  eq(#wow.chat, 0)
  w.shift = false
  w.visit()
  w.run()
  eq(w.bags[WATER], 5)
  eq(wow.chat[1], PREFIX .. "Bought 5 Water for 1s 25c.")
end)

test("buying stops when the vendor window closes", function(wow)
  local w = world(wow, { { id = WATER, name = "Water", price = 10, max = 1 } })
  boot(wow, 100000, { [WATER] = 10 })
  w.visit()
  eq(#w.bought, 4)
  w.leave()
  eq(#wow.chat, 1)
  eq(wow.chat[1], PREFIX .. "Bought 4 Water for 40c.")
  w.open = true -- even if a window were open again, the old visit is over
  w.run()
  eq(#w.bought, 4)
  w.open = false
  w.visit() -- the next visit buys the rest
  w.run()
  eq(w.bags[WATER], 10)
  eq(wow.chat[2], PREFIX .. "Bought 6 Water for 60c.")
end)

test("items for a currency and sold out items are skipped", function(wow)
  local w = world(wow, {
    { id = TOKEN, name = "Token Item", price = 0, extended = true },
    { id = FEATHER, name = "Feather", price = 150, avail = 0 },
    { id = POWDER, name = "Powder", price = 10, avail = 3 },
    { id = BREAD, name = "Bread", price = 10, purchasable = false },
    water(10),
  })
  boot(wow, 100000, { [TOKEN] = 5, [FEATHER] = 5, [POWDER] = 5, [BREAD] = 5, [WATER] = 5 })
  w.visit()
  w.run()
  eq(table.concat(w.bought, " "), "3x3 5x5")
  eq(w.bags[TOKEN], nil)
  eq(#wow.chat, 1, "no claim that the gold is short")
  eq(wow.chat[1], PREFIX .. "Bought 3 Powder, 5 Water for 80c.")
end)

test("a slot is checked again before it is bought", function(wow)
  local w = world(wow, { { id = WATER, name = "Water", price = 10, max = 1 }, bread(10) })
  boot(wow, 100000, { [WATER] = 6, [BREAD] = 2 })
  w.visit()
  eq(#w.bought, 4)
  w.goods[1], w.goods[2] = w.goods[2], w.goods[1] -- the vendor's list changed (a filter, for example)
  w.run()
  eq(#w.bought, 4, "the old slot numbers are not trusted any more")
  eq(w.bags[WATER], 4)
  eq(wow.chat[1], PREFIX .. "Bought 4 Water for 40c.")
end)

test("a second MERCHANT_SHOW during a visit does not start a second run", function(wow)
  local w = world(wow, { { id = WATER, name = "Water", price = 10, max = 1 } })
  boot(wow, 100000, { [WATER] = 6 })
  w.visit()
  w.visit()
  eq(#w.bought, 4)
  eq(#w.timers, 1)
  w.run()
  eq(w.bags[WATER], 6)
  eq(#wow.chat, 1)
end)

test("slash commands add, remove, list and show the state", function(wow)
  local w = world(wow, { water(10) })
  w.names[WATER] = "Refreshing Spring Water"
  local ns = boot(wow, 100000)
  wow.slash("/vr")
  eq(wow.chat[1], PREFIX .. "Refilling is on. Your list is empty. Low stock warning below 25% of your count.")
  eq(wow.chat[2]:match("^" .. PREFIX:gsub("%p", "%%%0") .. "/vr add <item> <count> keeps an item stocked") ~= nil, true)
  wow.slash("/vr add 159 20")
  eq(wow.chat[3], PREFIX .. "Refreshing Spring Water: keeping 20 in your bags.")
  eq(VendorRefillDB.lists["Yubi-Silvermoon"][WATER], 20)
  local link = "|cffffffff|Hitem:4540::::::::80:::::|h[Tough Hunk of Bread]|h|r"
  wow.slash("/vr ADD " .. link .. " 5")
  eq(wow.chat[4], PREFIX .. link .. ": keeping 5 in your bags.", "the link is shown as given")
  wow.slash("/vr add 159 40")
  eq(ns.list[WATER], 40, "adding again changes the count")
  wow.slash("/vr")
  eq(wow.chat[6], PREFIX .. "Refilling is on. 2 items are on your list. Low stock warning below 25% of your count.")
  wow.slash("/vr list")
  eq(wow.chat[8], PREFIX .. "Your list:")
  eq(wow.chat[9], PREFIX .. "  Refreshing Spring Water: 40")
  eq(wow.chat[10], PREFIX .. "  item 4540: 5", "a name the game does not know yet")
  wow.slash("/vr add 159 0")
  eq(wow.chat[11], PREFIX .. "The count must be a whole number from 1 to 1000.")
  wow.slash("/vr add 159")
  eq(wow.chat[12], PREFIX .. "Use /vr add <item link or item ID> <count>.")
  eq(ns.list[WATER], 40, "a wrong command changes nothing")
  wow.slash("/vr remove " .. link)
  eq(wow.chat[13], PREFIX .. link .. " is off your list.")
  wow.slash("/vr remove 4540")
  eq(wow.chat[14], PREFIX .. "item 4540 is not on your list.")
  wow.slash("/vr remove water")
  eq(wow.chat[15], PREFIX .. "Use /vr remove <item link or item ID>.")
  wow.slash("/vendorrefill")
  eq(wow.chat[16], PREFIX .. "Refilling is on. 1 item is on your list. Low stock warning below 25% of your count.")
  wow.slash("/vr nonsense")
  eq(wow.chat[18]:match("Hold Shift while you open a vendor to skip one visit%.$") ~= nil, true)
  eq(#wow.chat, 18)
  w.visit()
  w.run()
  eq(w.bags[WATER], 40)
end)

test("/vr off and /vr on switch refilling for all characters", function(wow)
  local w = world(wow, { water(10) })
  boot(wow, 100000, { [WATER] = 5 })
  wow.slash("/vr off")
  eq(wow.chat[1], PREFIX .. "Refilling is off.")
  eq(VendorRefillDB.enabled, false)
  w.visit()
  w.run()
  w.leave()
  eq(#w.bought, 0)
  wow.slash("/vr")
  eq(wow.chat[2], PREFIX .. "Refilling is off. 1 item is on your list. Low stock warning below 25% of your count.")
  wow.slash("/vr  On ")
  eq(wow.chat[4], PREFIX .. "Refilling is on.")
  w.visit()
  w.run()
  eq(w.bags[WATER], 5)
end)

test("each character keeps its own list, saved values survive the next login", function(wow)
  local w = world(wow, { water(10), bread(10) })
  boot(wow, 100000, { [WATER] = 5 })
  eq(VendorRefillDB.version, 2)
  eq(VendorRefillDB.enabled, true)

  -- As the game loads it at the next login, now on another character.
  VendorRefillDB = { enabled = false, lists = { ["Yubi-Silvermoon"] = { [WATER] = 5 }, ["Alt-Silvermoon"] = { [BREAD] = 3 } }, later = "kept" }
  wow.player = "Alt"
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.frames[1].events = {} -- the first copy of the addon no longer listens
  wow.fire("PLAYER_LOGIN")
  eq(ns.list[BREAD], 3)
  eq(ns.list[WATER], nil, "the other character's list is not used")
  eq(VendorRefillDB.enabled, false)
  eq(VendorRefillDB.later, "kept")
  wow.slash("/vr on")
  w.visit()
  w.run()
  eq(w.bags[BREAD], 3)
  eq(w.bags[WATER], nil)

  VendorRefillDB = { lists = "broken", enabled = "yes" }
  wow.fire("PLAYER_LOGIN")
  eq(type(VendorRefillDB.lists["Alt-Silvermoon"]), "table")
  eq(VendorRefillDB.enabled, true)
  VendorRefillDB = "broken"
  wow.fire("PLAYER_LOGIN")
  eq(VendorRefillDB.enabled, true)
end)

test("broken list entries are ignored at the vendor", function(wow)
  local w = world(wow, { water(10), bread(10) })
  boot(wow, 100000, { [WATER] = "lots", [BREAD] = 3000 })
  w.visit()
  w.run()
  eq(#w.bought, 0)
  eq(#wow.chat, 0)
end)

test("secret values are never used for decisions", function(wow)
  local secret = { secret = true }
  local w = world(wow, { water(10), bread(10), { id = FEATHER, name = "Feather", price = 10 } })
  w.goods[3].price = secret
  boot(wow, 100000, { [WATER] = 5, [BREAD] = 5, [FEATHER] = 5 })
  local count = C_Item.GetItemCount
  C_Item.GetItemCount = function(id) if id == BREAD then return secret end return count(id) end
  w.visit()
  w.run()
  w.leave()
  eq(table.concat(w.bought, " "), "1x5", "bread: count unknown; feather: price unknown")
  eq(wow.chat[1], PREFIX .. "Bought 5 Water for 50c.")

  wow.money = secret
  w.bags[WATER] = 0
  w.visit()
  w.run()
  w.leave()
  eq(#w.bought, 1, "gold unknown, nothing bought")
  eq(#wow.chat, 1, "and no claim that the gold is short")

  wow.money = 100000
  GetMerchantItemID = function() return secret end
  w.visit()
  w.run()
  eq(#w.bought, 1)
end)

test("older names of the game functions work, missing ones are no error", function(wow)
  local w = world(wow, { water(10), { id = BREAD, name = "Bread", price = 100, stack = 5 } }, { [WATER] = 1 })
  local count = C_Item.GetItemCount
  C_Item = nil
  GetItemCount = count
  GetItemInfo = function(id) if id == WATER then return "Water" end end
  C_MerchantFrame = nil
  GetMerchantItemInfo = function(index) -- name, texture, price, stackCount, numAvailable, isPurchasable, isUsable, extendedCost
    local g = w.goods[index]
    return g.name, 134400, g.price, g.stack or 1, -1, true, true, false
  end
  GetMerchantItemLink = nil
  GetMerchantItemMaxStack = nil
  IsShiftKeyDown = nil
  boot(wow, 100000, { [WATER] = 3, [BREAD] = 10 })
  wow.slash("/vr list")
  eq(wow.chat[2], PREFIX .. "  Water: 3")
  eq(wow.chat[3], PREFIX .. "  item 4540: 10")
  w.visit()
  w.run()
  w.leave()
  eq(table.concat(w.bought, " "), "1x1 1x1 2x5 2x5", "without the max per purchase: one stack at a time")
  eq(wow.chat[4], PREFIX .. "Bought 2 Water, 10 Bread for 2s 20c.")

  GetMerchantItemInfo = nil
  w.bags[WATER] = 0
  w.visit()
  w.leave()
  eq(#wow.chat, 4)
  BuyMerchantItem = nil
  w.visit()
  w.leave()
  eq(#wow.chat, 4)
end)

test("a slash command before login does nothing", function(wow)
  world(wow, { water() })
  wow.load(ADDON_DIR, ADDON_NAME)
  wow.slash("/vr add 159 5")
  wow.fire("MERCHANT_SHOW")
  eq(#wow.chat, 0)
  eq(VendorRefillDB, nil)
end)

-- 1.1: the low stock warning away from vendors.

-- The bags change after the login wait is over (eating, drinking, using an item).
local function bagsChanged(wow)
  if wow.clock < 2000 then wow.clock = 2000 end
  wow.fire("BAG_UPDATE_DELAYED")
end

test("core: the warning share is read and checked", function(wow)
  local ns = boot(wow)
  eq(ns.ParseShare("25"), 25)
  eq(ns.ParseShare(" 40% "), 40)
  eq(ns.ParseShare("40 %"), 40)
  eq(ns.ParseShare("off"), 0)
  eq(ns.ParseShare("OFF"), 0)
  eq(ns.ParseShare("0"), 0)
  eq(ns.ParseShare("90"), 90)
  eq(ns.ParseShare("91"), nil)
  eq(ns.ParseShare("-5"), nil)
  eq(ns.ParseShare("2.5"), nil)
  eq(ns.ParseShare("lots"), nil)
  eq(ns.ParseShare(""), nil)
  eq(ns.ParseShare(nil), nil)
  eq(ns.ValidShare(25), 25)
  eq(ns.ValidShare("25"), nil, "only numbers are kept from saved settings")
  eq(ns.ValidShare(0 / 0), nil)
  eq(ns.IsLow(4, 20, 25), true)
  eq(ns.IsLow(5, 20, 25), false, "exactly the share is not below it")
  eq(ns.IsLow(0, 1, 25), true, "a count of 1: low only when none is left")
  eq(ns.IsLow(1, 1, 25), false)
  eq(ns.IsLow(0, 20, 0), false, "share 0: never")
  eq(ns.IsLow(nil, 20, 25), false)
end)

test("core: each item is warned about once, and again only after it was restocked", function(wow)
  local ns = boot(wow)
  local warned = {}
  local wanted = { [WATER] = 20, [BREAD] = 10, [FEATHER] = "broken" }
  local function due(owned, share)
    local parts = {}
    for _, e in ipairs(ns.LowStock(owned, wanted, share or 25, warned)) do parts[#parts + 1] = e.itemID .. ":" .. e.have .. "/" .. e.want end
    return table.concat(parts, " ")
  end
  eq(due({ [WATER] = 10, [BREAD] = 5 }), "")
  eq(due({ [WATER] = 4, [BREAD] = 2, [FEATHER] = 0 }), "159:4/20 4540:2/10", "sorted by item ID, broken entries left out")
  eq(due({ [WATER] = 3, [BREAD] = 1 }), "", "no repeat while it keeps dropping")
  eq(due({ [WATER] = 0, [BREAD] = 0 }), "")
  eq(due({ [BREAD] = 9 }), "", "water unknown: left as it is")
  eq(warned[WATER], true)
  eq(warned[BREAD], nil, "bread went back up and is armed again")
  eq(due({ [WATER] = 2, [BREAD] = 2 }), "4540:2/10")
  eq(due({ [WATER] = 5, [BREAD] = 2 }), "")
  eq(due({ [WATER] = 4, [BREAD] = 2 }), "159:4/20")
  eq(due({ [WATER] = 0, [BREAD] = 0 }, 0), "", "share 0 says nothing")
  eq(next(warned), nil, "and arms everything again")
  eq(due({ [WATER] = 10 }, 60), "159:10/20", "a higher share")
  eq(#ns.LowStock(nil, wanted, 25, warned), 0)
  eq(ns.LowLine({ itemID = WATER, have = 4, want = 20 }, "Water"), "Water is running low: 4 of 20 left.")
  eq(ns.LowLine({ itemID = WATER, have = 0, want = 20 }), "item 159 is running low: 0 of 20 left.")
end)

test("low stock: one chat line per item when the bags change away from a vendor", function(wow)
  local w = world(wow, {}, { [WATER] = 20, [BREAD] = 10, [FEATHER] = 1 })
  w.names[WATER] = "Water"
  boot(wow, 100000, { [WATER] = 20, [BREAD] = 10, [FEATHER] = 2 })
  bagsChanged(wow)
  eq(#wow.chat, 0, "everything is stocked")
  w.bags[WATER] = 5
  bagsChanged(wow)
  eq(#wow.chat, 0, "5 of 20 is exactly 25 %")
  w.bags[WATER] = 4
  bagsChanged(wow)
  eq(#wow.chat, 1)
  eq(wow.chat[1], PREFIX .. "Water is running low: 4 of 20 left.")
  for n = 3, 0, -1 do
    w.bags[WATER] = n
    bagsChanged(wow)
  end
  eq(#wow.chat, 1, "one warning, not one per drink")
  w.bags[BREAD] = 0
  w.bags[FEATHER] = 0
  bagsChanged(wow)
  eq(#wow.chat, 3)
  eq(wow.chat[2], PREFIX .. "item 4540 is running low: 0 of 10 left.", "a name the game does not know yet")
  eq(wow.chat[3], PREFIX .. "item 17056 is running low: 0 of 2 left.")
  w.bags[WATER] = 20 -- restocked
  bagsChanged(wow)
  w.bags[WATER] = 2
  bagsChanged(wow)
  eq(#wow.chat, 4, "warned again after a restock")
  eq(wow.chat[4], PREFIX .. "Water is running low: 2 of 20 left.")
end)

test("low stock: no warning while a vendor is open, and none in the first seconds after login", function(wow)
  local w = world(wow, { water(10) }, { [WATER] = 1, [BREAD] = 0 })
  local ns = boot(wow, 100000, { [WATER] = 20, [BREAD] = 10 })
  wow.fire("BAG_UPDATE_DELAYED")
  wow.clock = wow.clock + ns.WARN_DELAY - 1
  wow.fire("BAG_UPDATE_DELAYED")
  eq(#wow.chat, 0, "the bags may still be loading")
  wow.clock = wow.clock + 1
  w.visit()
  w.run()
  eq(#wow.chat, 1)
  eq(wow.chat[1], PREFIX .. "Bought 19 Water for 1s 90c.")
  wow.fire("BAG_UPDATE_DELAYED") -- the bought water arrives while the vendor is open
  eq(#wow.chat, 1, "no warning about bread while the vendor is open")
  w.leave()
  wow.fire("BAG_UPDATE_DELAYED")
  eq(#wow.chat, 2)
  eq(wow.chat[2], PREFIX .. "item 4540 is running low: 0 of 10 left.", "this vendor had no bread")
end)

test("/vr warn sets the share, checks at once and switches the warning off", function(wow)
  local w = world(wow, {}, { [WATER] = 7 })
  w.names[WATER] = "Water"
  boot(wow, 100000, { [WATER] = 20 })
  eq(VendorRefillDB.warnShare, 25)
  wow.slash("/vr warn")
  eq(wow.chat[1], PREFIX .. "Low stock warning below 25% of your count.")
  wow.slash("/vr warn 40%")
  eq(VendorRefillDB.warnShare, 40)
  eq(wow.chat[2], PREFIX .. "Low stock warning below 40% of your count.")
  eq(wow.chat[3], PREFIX .. "Water is running low: 7 of 20 left.", "checked at once, even right after login")
  wow.slash("/vr WARN 30")
  eq(wow.chat[4], PREFIX .. "Low stock warning below 30% of your count.")
  eq(#wow.chat, 4, "7 of 20 is not below 30 %")
  for _, bad in ipairs({ "91", "-1", "2.5", "half" }) do
    wow.slash("/vr warn " .. bad)
    eq(wow.chat[#wow.chat], PREFIX .. "The warning must be a whole percent from 1 to 90, or off.", bad)
  end
  eq(VendorRefillDB.warnShare, 30)
  wow.slash("/vr warn off")
  eq(VendorRefillDB.warnShare, 0)
  eq(wow.chat[#wow.chat], PREFIX .. "The low stock warning is off.")
  local n = #wow.chat
  w.bags[WATER] = 0
  bagsChanged(wow)
  eq(#wow.chat, n, "off means off")
  wow.slash("/vr")
  eq(wow.chat[n + 1], PREFIX .. "Refilling is on. 1 item is on your list. The low stock warning is off.")
  eq(wow.chat[n + 2]:match("/vr warn <percent> or /vr warn off sets the low stock warning%.") ~= nil, true)
end)

test("/vr remove forgets the warning, /vr off keeps warnings on", function(wow)
  local w = world(wow, {}, { [WATER] = 0 })
  local ns = boot(wow, 100000, { [WATER] = 20 })
  wow.slash("/vr off")
  bagsChanged(wow)
  eq(#wow.chat, 2, "the warning has its own switch")
  eq(wow.chat[2], PREFIX .. "item 159 is running low: 0 of 20 left.")
  wow.slash("/vr remove 159")
  eq(ns.warned[WATER], nil)
  bagsChanged(wow)
  eq(#wow.chat, 3, "not on the list any more")
  wow.slash("/vr add 159 10")
  bagsChanged(wow)
  eq(wow.chat[5], PREFIX .. "item 159 is running low: 0 of 10 left.", "back on the list: warned again")
end)

test("1.0 settings move on to 1.1: the list stays, the warning starts at 25 %", function(wow)
  local w = world(wow, {}, { [BREAD] = 1 })
  -- As 1.0 saved it.
  VendorRefillDB = { version = 1, enabled = false, lists = { ["Yubi-Silvermoon"] = { [BREAD] = 12 } } }
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("PLAYER_LOGIN")
  eq(VendorRefillDB.version, 2)
  eq(VendorRefillDB.enabled, false)
  eq(VendorRefillDB.warnShare, 25)
  eq(ns.list[BREAD], 12)
  bagsChanged(wow)
  eq(wow.chat[1], PREFIX .. "item 4540 is running low: 1 of 12 left.")

  VendorRefillDB = { version = 2, warnShare = 0, lists = {} }
  wow.fire("PLAYER_LOGIN")
  eq(VendorRefillDB.warnShare, 0, "off stays off")
  VendorRefillDB = { warnShare = 95 }
  wow.fire("PLAYER_LOGIN")
  eq(VendorRefillDB.warnShare, 25)
  VendorRefillDB = { warnShare = "lots" }
  wow.fire("PLAYER_LOGIN")
  eq(VendorRefillDB.warnShare, 25)
  eq(#wow.chat, 1)
end)

test("low stock: secret or missing counts never warn, missing functions are no error", function(wow)
  local w = world(wow, {}, { [WATER] = 0, [BREAD] = 0 })
  local ns = boot(wow, 100000, { [WATER] = 20, [BREAD] = 10 })
  local count = C_Item.GetItemCount
  C_Item.GetItemCount = function(id) if id == WATER then return { secret = true } end return count(id) end
  bagsChanged(wow)
  eq(#wow.chat, 1)
  eq(wow.chat[1], PREFIX .. "item 4540 is running low: 0 of 10 left.")
  eq(ns.warned[WATER], nil)
  C_Item = nil
  GetItemCount = nil
  w.bags[BREAD] = 10
  bagsChanged(wow)
  eq(ns.warned[BREAD], true, "an unknown count changes nothing")
  GetTime = nil
  bagsChanged(wow)
  eq(#wow.chat, 1)
end)
