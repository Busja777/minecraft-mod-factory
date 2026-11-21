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
  eq(wow.chat[1], PREFIX .. "Refilling is on. Your list is empty. Taking items from the bank is on. Low stock warning below 25% of your count.")
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
  eq(wow.chat[6], PREFIX .. "Refilling is on. 2 items are on your list. Taking items from the bank is on. Low stock warning below 25% of your count.")
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
  eq(wow.chat[16], PREFIX .. "Refilling is on. 1 item is on your list. Taking items from the bank is on. Low stock warning below 25% of your count.")
  wow.slash("/vr nonsense")
  eq(wow.chat[18]:match("Hold Shift while you open a vendor or the bank to skip one visit%.$") ~= nil, true)
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
  eq(wow.chat[2], PREFIX .. "Refilling is off. 1 item is on your list. Taking items from the bank is on. Low stock warning below 25% of your count.")
  wow.slash("/vr  On ")
  eq(wow.chat[4], PREFIX .. "Refilling is on.")
  w.visit()
  w.run()
  eq(w.bags[WATER], 5)
end)

test("each character keeps its own list, saved values survive the next login", function(wow)
  local w = world(wow, { water(10), bread(10) })
  boot(wow, 100000, { [WATER] = 5 })
  eq(VendorRefillDB.version, 3)
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
  eq(wow.chat[n + 1], PREFIX .. "Refilling is on. 1 item is on your list. Taking items from the bank is on. The low stock warning is off.")
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
  eq(VendorRefillDB.version, 3)
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

-- 1.2: taking items of the list out of the bank.

local BANK1, BANK2, WARBAND1 = 6, 7, 12 -- character bank tabs and the first Warband bank tab

-- The bank, the bags, the cursor and the combat state, which the stand-in client lacks.
-- Call after world(). b.bag(bag, size, { [slot] = { id, count, locked } }) fills a container;
-- bags 0 to 4 are the player's bags and their contents are what C_Item.GetItemCount counts.
local function bankWorld(wow, w)
  local b = { c = {}, cursor = nil, combat = false, family = {}, maxStack = {}, reject = {}, calls = {}, canUse = {} }
  Enum.BagIndex = {
    Backpack = 0, Bag_1 = 1, Bag_2 = 2, Bag_3 = 3, Bag_4 = 4, ReagentBag = 5,
    CharacterBankTab_1 = BANK1, CharacterBankTab_2 = BANK2,
    AccountBankTab_1 = WARBAND1, AccountBankTab_2 = 13,
  }
  Enum.BankType = { Character = 0, Guild = 1, Account = 2 }
  C_Bank.CanUseBank = function(kind) return b.canUse[kind] ~= false end
  function b.bag(bag, size, items)
    local box = { size = size }
    for slot, it in pairs(items or {}) do box[slot] = { id = it[1], count = it[2], locked = it[3] } end
    b.c[bag] = box
    return box
  end
  local function at(bag, slot) return b.c[bag] and b.c[bag][slot] end
  C_Container = {
    GetContainerNumSlots = function(bag) return b.c[bag] and b.c[bag].size or 0 end,
    GetContainerItemInfo = function(bag, slot)
      local it = at(bag, slot)
      if not it then return nil end
      if it.secret then return { itemID = { secret = true }, stackCount = it.count, isLocked = false } end
      return { itemID = it.id, stackCount = it.count, isLocked = it.locked or false, hyperlink = it.link }
    end,
    GetContainerNumFreeSlots = function(bag)
      local free = 0
      for slot = 1, b.c[bag] and b.c[bag].size or 0 do if not at(bag, slot) then free = free + 1 end end
      return free, b.family[bag] or 0
    end,
    PickupContainerItem = function(bag, slot)
      b.calls[#b.calls + 1] = "pick " .. bag .. ":" .. slot
      local it = at(bag, slot)
      if not b.cursor then
        if not it or it.locked then return end
        b.cursor = { id = it.id, count = it.count, from = { bag, slot } }
        b.c[bag][slot] = nil
        return
      end
      if b.reject[bag] then return end -- this bag does not take it, the item stays on the cursor
      local cur = b.cursor
      if not it then
        b.c[bag][slot] = { id = cur.id, count = cur.count }
      elseif it.id == cur.id and it.count + cur.count <= (b.maxStack[cur.id] or 20) then
        it.count = it.count + cur.count
      else
        error("the addon dropped onto a slot that cannot take it")
      end
      b.cursor = nil
    end,
    SplitContainerItem = function(bag, slot, count)
      b.calls[#b.calls + 1] = "split " .. bag .. ":" .. slot .. "x" .. count
      local it = at(bag, slot)
      if b.cursor or not it or it.locked or count >= it.count then return end
      it.count = it.count - count
      b.cursor = { id = it.id, count = count, from = { bag, slot }, split = true }
    end,
  }
  CursorHasItem = function() return b.cursor ~= nil end
  ClearCursor = function()
    local cur = b.cursor
    if not cur then return end
    b.calls[#b.calls + 1] = "clear"
    local back = at(cur.from[1], cur.from[2])
    if back then back.count = back.count + cur.count else b.c[cur.from[1]][cur.from[2]] = { id = cur.id, count = cur.count } end
    b.cursor = nil
  end
  InCombatLockdown = function() return b.combat end
  C_Item.GetItemMaxStackSizeByID = function(id) return b.maxStack[id] or 20 end
  C_Item.GetItemCount = function(id, includeBank)
    if includeBank then error("only the bags count") end
    local n = 0
    for bag = 0, 4 do
      for slot = 1, b.c[bag] and b.c[bag].size or 0 do
        local it = at(bag, slot)
        if it and it.id == id then n = n + it.count end
      end
    end
    return n
  end
  for bag = 0, 4 do if not b.c[bag] then b.bag(bag, 0) end end

  -- The count of an item in some containers.
  function b.count(id, from, to)
    local n = 0
    for bag = from or 0, to or 4 do
      for slot = 1, b.c[bag] and b.c[bag].size or 0 do
        local it = at(bag, slot)
        if it and it.id == id then n = n + it.count end
      end
    end
    return n
  end
  function b.open() wow.fire("BANKFRAME_OPENED") end
  function b.close() wow.fire("BANKFRAME_CLOSED") end
  return b
end

test("core: what the bags miss, the next move out of the bank and where it goes", function(wow)
  local ns = boot(wow)
  local need = ns.BankNeed({ [WATER] = 8, [BREAD] = 30, [FEATHER] = 0 }, { [WATER] = 20, [BREAD] = 20, [FEATHER] = 5, [POWDER] = 10, [TOKEN] = "x" })
  eq(need[WATER], 12)
  eq(need[BREAD], nil, "more than wanted: nothing")
  eq(need[FEATHER], 5)
  eq(need[POWDER], nil, "count in the bags unknown: nothing")
  eq(need[TOKEN], nil)
  eq(next(ns.BankNeed(nil, { [WATER] = 1 })), nil)

  local slots = {
    { bag = 6, slot = 1, itemID = BREAD, count = 20 },
    { bag = 6, slot = 2, itemID = WATER, count = 5 },
    { bag = 6, slot = 3, itemID = WATER, count = 20, locked = true },
    { bag = 6, slot = 4, itemID = WATER, count = 15 },
    { bag = 6, slot = 5 },
    { bag = 6, slot = 6, itemID = false, count = 0 },
    { bag = 12, slot = 1, itemID = FEATHER, count = 3 },
  }
  local move = ns.NextBankMove(slots, { [WATER] = 12, [FEATHER] = 5 })
  eq(move.bag .. ":" .. move.slot, "6:4", "the biggest free stack of the first needed item")
  eq(move.count, 12)
  eq(move.whole, false, "split")
  move = ns.NextBankMove(slots, { [WATER] = 15 })
  eq(move.count, 15)
  eq(move.whole, true, "exactly a whole stack")
  move = ns.NextBankMove(slots, { [FEATHER] = 5 })
  eq(move.bag .. ":" .. move.slot .. "x" .. move.count, "12:1x3", "less than missing: the whole stack")
  eq(move.whole, true)
  eq(ns.NextBankMove(slots, { [POWDER] = 5 }), nil, "not in the bank")
  eq(ns.NextBankMove(slots, { [WATER] = 0 }), nil)
  eq(ns.NextBankMove(nil, { [WATER] = 1 }), nil)

  local bags = {
    { bag = 0, slot = 1, itemID = WATER, count = 15 },
    { bag = 0, slot = 2, itemID = WATER, count = 5, locked = true },
    { bag = 0, slot = 3, itemID = false, count = 0 },
    { bag = 1, slot = 1 },
    { bag = 1, slot = 2 },
  }
  eq(table.concat({ ns.BagTarget(bags, WATER, 5, 20) }, ":"), "0:1", "fills a stack up to its limit")
  eq(table.concat({ ns.BagTarget(bags, WATER, 6, 20) }, ":"), "1:1", "never past it: an empty slot")
  eq(table.concat({ ns.BagTarget(bags, WATER, 5, nil) }, ":"), "1:1", "limit unknown: only empty slots")
  eq(table.concat({ ns.BagTarget(bags, BREAD, 5, 20) }, ":"), "1:1")
  eq(ns.BagTarget({ bags[1], bags[3] }, BREAD, 5, 20), nil, "bags full")
  eq(ns.BagTarget(bags, WATER, 0, 20), nil)

  eq(ns.TakenLine({}), nil)
  eq(ns.TakenLine({ { itemID = WATER, name = "Water", count = 12 } }), "Taken from the bank: Water x12.")
  eq(ns.TakenLine({ { itemID = WATER, name = "Water", count = 12 }, { itemID = BREAD, count = 5 } }), "Taken from the bank: Water x12, item 4540 x5.")
end)

test("bank: takes whole and split stacks up to the count, one move at a time", function(wow)
  local w = world(wow)
  local b = bankWorld(wow, w)
  w.names[WATER] = "Water"
  w.names[BREAD] = "Bread"
  b.bag(0, 4, { [1] = { WATER, 8 }, [2] = { POWDER, 3 } })
  b.bag(BANK1, 6, { [1] = { WATER, 5 }, [2] = { FEATHER, 20 }, [3] = { BREAD, 20 }, [4] = { WATER, 20 } })
  boot(wow, 100000, { [WATER] = 25, [BREAD] = 5 })
  b.open()
  eq(#b.calls, 0, "it waits a moment for the bank to fill in")
  w.tick()
  eq(table.concat(b.calls, " "), "split 6:4x17 pick 0:3", "17 missing: split from the biggest stack, into an empty slot (8 + 17 does not fit a stack of 20)")
  w.run()
  eq(b.count(WATER), 25, "exactly the count")
  eq(b.count(BREAD), 5)
  eq(b.count(WATER, BANK1, BANK1), 8)
  eq(b.count(BREAD, BANK1, BANK1), 15)
  eq(b.count(FEATHER, BANK1, BANK1), 20, "not on the list: untouched")
  eq(b.count(POWDER), 3)
  eq(b.cursor, nil)
  eq(#wow.chat, 1)
  eq(wow.chat[1], PREFIX .. "Taken from the bank: Water x17, Bread x5.")
  b.close()
  eq(#wow.chat, 1, "said once")
end)

test("bank: a stack in the bags is filled up, never past its limit", function(wow)
  local w = world(wow)
  local b = bankWorld(wow, w)
  b.maxStack[WATER] = 20
  b.bag(0, 3, { [1] = { WATER, 16 } })
  b.bag(BANK1, 2, { [1] = { WATER, 20 } })
  local ns = boot(wow, 100000, { [WATER] = 20 })
  b.open()
  w.run()
  b.close()
  eq(table.concat(b.calls, " "), "split 6:1x4 pick 0:1", "4 fill the stack in the bags up to 20")
  eq(b.c[0][1].count, 20)
  ns.list[WATER] = 40
  b.open()
  w.run()
  b.close()
  eq(table.concat(b.calls, " "), "split 6:1x4 pick 0:1 pick 6:1 pick 0:2", "the full stack has no room: an empty slot")
  eq(b.c[0][2].count, 16)
  eq(b.count(WATER), 36, "the bank had no more")
  eq(wow.chat[1], PREFIX .. "Taken from the bank: item 159 x4.")
  eq(wow.chat[2], PREFIX .. "Taken from the bank: item 159 x16.")
end)

test("bank: the Warband bank counts too, unless the game says it cannot be used here", function(wow)
  local w = world(wow)
  local b = bankWorld(wow, w)
  b.bag(0, 4)
  b.bag(BANK1, 2, { [1] = { WATER, 3 } })
  b.bag(WARBAND1, 2, { [2] = { WATER, 10 } })
  boot(wow, 100000, { [WATER] = 10 })
  b.canUse[2] = false
  b.open()
  w.run()
  b.close()
  eq(b.count(WATER), 3, "the Warband bank was not available")
  b.canUse[2] = nil
  b.open()
  w.run()
  b.close()
  eq(b.count(WATER), 10)
  eq(b.count(WATER, WARBAND1, WARBAND1), 3)
  eq(wow.chat[2], PREFIX .. "Taken from the bank: item 159 x7.")
end)

test("bank: the Warband bank and the bank window open through the newer event, each visit runs once", function(wow)
  local w = world(wow)
  local b = bankWorld(wow, w)
  b.bag(0, 4)
  b.bag(WARBAND1, 2, { [1] = { WATER, 20 } })
  local ns = boot(wow, 100000, { [WATER] = 5 })
  wow.fire("PLAYER_INTERACTION_MANAGER_FRAME_SHOW", Enum.PlayerInteractionType.AccountBanker)
  wow.fire("BANKFRAME_OPENED") -- the same window, told twice
  eq(ns.bankOpen, true)
  w.run()
  eq(b.count(WATER), 5)
  eq(#wow.chat, 1)
  wow.fire("PLAYER_INTERACTION_MANAGER_FRAME_HIDE", Enum.PlayerInteractionType.AccountBanker)
  wow.fire("BANKFRAME_CLOSED")
  eq(ns.bankOpen, false)
  wow.fire("PLAYER_INTERACTION_MANAGER_FRAME_SHOW", Enum.PlayerInteractionType.Merchant)
  eq(ns.bankOpen, false, "a vendor is not the bank")
  wow.fire("PLAYER_INTERACTION_MANAGER_FRAME_SHOW", { secret = true })
  eq(ns.bankOpen, false)
  wow.fire("PLAYER_INTERACTION_MANAGER_FRAME_SHOW", Enum.PlayerInteractionType.Banker)
  eq(ns.bankOpen, true)
  w.run()
  eq(#wow.chat, 1, "nothing missing: nothing said")
end)

test("bank: full bags and bags for one profession", function(wow)
  local w = world(wow)
  local b = bankWorld(wow, w)
  b.bag(0, 1, { [1] = { POWDER, 1 } })
  b.bag(1, 2) -- a herb bag: water cannot go in there
  b.family[1] = 32
  b.bag(BANK1, 2, { [1] = { WATER, 20 }, [2] = { BREAD, 20 } })
  boot(wow, 100000, { [WATER] = 5, [BREAD] = 5 })
  b.open()
  w.run()
  eq(#b.calls, 0)
  eq(b.count(WATER, BANK1, BANK1), 20)
  eq(#wow.chat, 1)
  eq(wow.chat[1], PREFIX .. "Your bags are full, the rest stays in the bank.")
  b.close()

  b.bag(2, 1)
  b.open()
  w.run()
  b.close()
  eq(b.count(WATER), 5)
  eq(b.count(BREAD), 0)
  eq(wow.chat[2], PREFIX .. "Taken from the bank: item 159 x5.")
  eq(wow.chat[3], PREFIX .. "Your bags are full, the rest stays in the bank.")
end)

test("bank: when a bag does not take the item, it goes back and nothing stays on the cursor", function(wow)
  local w = world(wow)
  local b = bankWorld(wow, w)
  b.bag(0, 2)
  b.reject[0] = true
  b.bag(BANK1, 1, { [1] = { WATER, 20 } })
  boot(wow, 100000, { [WATER] = 5 })
  b.open()
  w.run()
  eq(table.concat(b.calls, " "), "split 6:1x5 pick 0:1 clear")
  eq(b.cursor, nil)
  eq(b.c[BANK1][1].count, 20, "back in the bank")
  eq(#wow.chat, 0, "nothing was taken")
end)

test("bank: nothing in combat, nothing while the cursor holds an item, and it stops when that starts", function(wow)
  local w = world(wow)
  local b = bankWorld(wow, w)
  b.bag(0, 4)
  b.bag(BANK1, 4, { [1] = { WATER, 2 }, [2] = { WATER, 2 }, [3] = { WATER, 2 } })
  boot(wow, 100000, { [WATER] = 6 })
  b.combat = true
  b.open()
  w.run()
  b.close()
  eq(#b.calls, 0, "combat")
  b.combat = false
  b.cursor = { id = TOKEN, count = 1, from = { 0, 4 } }
  b.open()
  w.run()
  b.close()
  eq(#b.calls, 0, "the player holds an item")
  b.cursor = nil
  b.open()
  w.tick()
  eq(b.count(WATER), 2, "first move")
  b.cursor = { id = TOKEN, count = 1, from = { 0, 4 } } -- the player picks something up
  w.run()
  eq(b.count(WATER), 2, "stopped")
  eq(b.cursor.id, TOKEN, "the player's item is left alone")
  eq(#wow.chat, 1)
  eq(wow.chat[1], PREFIX .. "Taken from the bank: item 159 x2.")
  b.cursor = nil
  b.close()
  b.open()
  w.tick()
  b.combat = true
  w.run()
  eq(b.count(WATER), 4, "combat starts: it stops after the move before")
end)

test("bank: closing the bank stops the moves and tells what was taken", function(wow)
  local w = world(wow)
  local b = bankWorld(wow, w)
  b.bag(0, 4)
  b.bag(BANK1, 4, { [1] = { WATER, 2 }, [2] = { WATER, 2 }, [3] = { WATER, 2 } })
  boot(wow, 100000, { [WATER] = 6 })
  b.open()
  w.tick()
  eq(b.count(WATER), 2)
  b.close()
  eq(#wow.chat, 1)
  eq(wow.chat[1], PREFIX .. "Taken from the bank: item 159 x2.")
  w.run()
  eq(b.count(WATER), 2, "nothing after the bank is closed")
  b.close()
  eq(#wow.chat, 1)
end)

test("bank: locked slots are skipped, and the bags never get more than the count", function(wow)
  local w = world(wow)
  local b = bankWorld(wow, w)
  b.bag(0, 4, { [1] = { WATER, 3 } })
  b.bag(BANK1, 3, { [1] = { WATER, 20, true }, [2] = { WATER, 4 } })
  boot(wow, 100000, { [WATER] = 10 })
  b.open()
  w.run()
  eq(b.count(WATER), 7, "the locked stack is left alone")
  b.close()
  b.c[BANK1][1].locked = false
  -- The count in the bags lags behind after a move: the addon keeps its own tally.
  local count = C_Item.GetItemCount
  local frozen = count(WATER)
  C_Item.GetItemCount = function(id) if id == WATER then return frozen end return count(id) end
  b.bag(BANK1, 3, { [1] = { WATER, 1 }, [2] = { WATER, 1 }, [3] = { WATER, 1 } })
  b.bag(WARBAND1, 1, { [1] = { WATER, 20 } })
  b.open()
  w.run()
  b.close()
  eq(count(WATER), 10, "3 missing, 3 taken")
end)

test("bank: /vr bank on and off, Shift skips one visit, warnings wait until the bank closes", function(wow)
  local w = world(wow)
  local b = bankWorld(wow, w)
  b.bag(0, 4)
  b.bag(BANK1, 2, { [1] = { WATER, 20 } })
  boot(wow, 100000, { [WATER] = 10 })
  wow.slash("/vr bank")
  eq(wow.chat[1], PREFIX .. "Taking items from the bank is on.")
  wow.slash("/vr bank OFF")
  eq(wow.chat[2], PREFIX .. "Taking items from the bank is off.")
  eq(VendorRefillDB.bank, false)
  b.open()
  w.run()
  b.close()
  eq(b.count(WATER), 0)
  wow.slash("/vr bank maybe")
  eq(wow.chat[3], PREFIX .. "Use /vr bank on or /vr bank off.")
  eq(VendorRefillDB.bank, false)
  wow.slash("/vr")
  eq(wow.chat[4], PREFIX .. "Refilling is on. 1 item is on your list. Taking items from the bank is off. Low stock warning below 25% of your count.")
  eq(wow.chat[5]:find("/vr on and /vr off switch all refilling (vendor and bank), /vr bank on or /vr bank off switches only taking items from the bank", 1, true) ~= nil, true)
  wow.slash("/vr bank on")
  eq(VendorRefillDB.bank, true)
  w.shift = true
  b.open()
  w.run()
  b.close()
  eq(b.count(WATER), 0, "Shift")
  w.shift = false
  local n = #wow.chat
  wow.clock = 2000
  b.open()
  wow.fire("BAG_UPDATE_DELAYED")
  eq(#wow.chat, n, "no low stock warning while the bank is open")
  w.run()
  eq(b.count(WATER), 10)
  eq(wow.chat[n + 1], PREFIX .. "Taken from the bank: item 159 x10.")
  b.close()
  b.c[0][1].count = 1
  wow.fire("BAG_UPDATE_DELAYED")
  eq(wow.chat[n + 2], PREFIX .. "item 159 is running low: 1 of 10 left.")
end)

test("bank first, then the vendor buys only the rest", function(wow)
  local w = world(wow, { water(10) })
  local b = bankWorld(wow, w)
  b.bag(0, 4)
  b.bag(BANK1, 1, { [1] = { WATER, 12 } })
  BuyMerchantItem = function(index, quantity)
    w.bought[#w.bought + 1] = index .. "x" .. quantity
    b.c[0][4] = { id = WATER, count = quantity }
  end
  boot(wow, 100000, { [WATER] = 20 })
  b.open()
  w.run()
  b.close()
  w.visit()
  w.run()
  eq(table.concat(w.bought, " "), "1x8")
  eq(b.count(WATER), 20)
end)

test("bank: secret values are never used, missing functions leave the bank alone", function(wow)
  local w = world(wow)
  local b = bankWorld(wow, w)
  b.bag(0, 2, { [1] = { BREAD, 1 } })
  b.c[0][1].secret = true -- a slot that cannot be read is not taken as empty
  b.bag(BANK1, 2, { [1] = { WATER, 20 }, [2] = { BREAD, 20 } })
  b.c[BANK1][2].secret = true
  local count = C_Item.GetItemCount
  C_Item.GetItemCount = function(id) if id == FEATHER then return { secret = true } end return count(id) end
  b.bag(BANK1 + 1, 1, { [1] = { FEATHER, 20 } })
  boot(wow, 100000, { [WATER] = 5, [BREAD] = 5, [FEATHER] = 5 })
  b.open()
  w.run()
  b.close()
  eq(b.c[0][2].id, WATER)
  eq(b.count(BREAD, BANK1, BANK1), 20, "a bank slot that cannot be read is left alone")
  eq(b.count(FEATHER, BANK1 + 1, BANK1 + 1), 20, "a count that cannot be read: nothing taken")
  eq(b.cursor, nil)

  local before = #b.calls
  b.c[BANK1][1].count = 20
  b.c[0][2] = nil -- water is missing again
  for _, name in ipairs({ "SplitContainerItem", "PickupContainerItem", "GetContainerItemInfo" }) do
    local keep = C_Container[name]
    C_Container[name] = nil
    b.open()
    w.run()
    b.close()
    C_Container[name] = keep
  end
  CursorHasItem = nil
  b.open()
  w.run()
  b.close()
  eq(#b.calls, before, "no move without every function it needs")
  eq(b.count(WATER), 0)
  eq(#wow.chat, 1)
end)

test("bank: a client without the bank tabs or the container functions is no error", function(wow)
  local w = world(wow)
  local b = bankWorld(wow, w)
  b.bag(0, 2)
  b.bag(BANK1, 1, { [1] = { WATER, 20 } })
  boot(wow, 100000, { [WATER] = 5 })
  Enum.BagIndex = { Backpack = 0 }
  b.open()
  w.run()
  b.close()
  C_Container = nil
  b.open()
  w.run()
  b.close()
  C_Bank = nil
  InCombatLockdown = nil
  b.open()
  w.run()
  b.close()
  eq(#b.calls, 0)
  eq(#wow.chat, 0)
end)

test("1.1 settings move on to 1.2: list, switches and warning stay, the bank starts on", function(wow)
  local w = world(wow)
  local b = bankWorld(wow, w)
  b.bag(0, 2)
  b.bag(BANK1, 1, { [1] = { BREAD, 20 } })
  -- As 1.1 saved it.
  VendorRefillDB = { version = 2, enabled = false, warnShare = 40, lists = { ["Yubi-Silvermoon"] = { [BREAD] = 12 } } }
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("PLAYER_LOGIN")
  eq(VendorRefillDB.version, 3)
  eq(VendorRefillDB.enabled, false)
  eq(VendorRefillDB.warnShare, 40)
  eq(VendorRefillDB.bank, true)
  eq(ns.list[BREAD], 12)
  b.open()
  w.run()
  b.close()
  eq(b.count(BREAD), 0, "refilling was switched off in 1.1: the bank stays untouched too")
  wow.slash("/vr on")
  b.open()
  w.run()
  eq(b.count(BREAD), 12)

  VendorRefillDB = { version = 3, bank = false, lists = {} }
  wow.fire("PLAYER_LOGIN")
  eq(VendorRefillDB.bank, false, "off stays off")
  VendorRefillDB = { bank = "yes" }
  wow.fire("PLAYER_LOGIN")
  eq(VendorRefillDB.bank, true)
end)

test("the bank part defines no globals of its own", function(wow)
  local w = world(wow)
  local b = bankWorld(wow, w)
  b.bag(0, 2)
  b.bag(BANK1, 1, { [1] = { WATER, 20 } })
  local mine = {}
  for k in pairs(_G) do mine[k] = true end
  boot(wow, 100000, { [WATER] = 5 })
  b.open()
  w.run()
  b.close()
  wow.slash("/vr bank off")
  wow.slash("/vr bank")
  local allowed = { VendorRefillDB = true, SLASH_VENDORREFILL1 = true, SLASH_VENDORREFILL2 = true }
  for k in pairs(_G) do
    if not mine[k] and not allowed[k] then error("unexpected global " .. tostring(k)) end
  end
  eq(b.count(WATER), 5)
end)

test("core: the chat line reports what really arrived, at most what was moved", function(wow)
  local ns = boot(wow)
  local taken = { { itemID = WATER, name = "Water", count = 12 }, { itemID = BREAD, name = "Bread", count = 5 }, { itemID = FEATHER, count = 3 } }
  local arrived = ns.Arrived(taken, { [WATER] = 8, [BREAD] = 0, [FEATHER] = 1 }, { [WATER] = 20, [BREAD] = 0, [FEATHER] = { secret = true } })
  eq(ns.TakenLine(arrived), "Taken from the bank: Water x12.", "bread did not arrive, feather cannot be counted")
  arrived = ns.Arrived(taken, { [WATER] = 8 }, { [WATER] = 14 })
  eq(ns.TakenLine(arrived), "Taken from the bank: Water x6.", "only part arrived")
  arrived = ns.Arrived(taken, { [WATER] = 8 }, { [WATER] = 30 })
  eq(arrived[1].count, 12, "something else came in too: never more than was moved")
  eq(#ns.Arrived(taken, { [WATER] = 8 }, { [WATER] = 5 }), 0)
  eq(#ns.Arrived(nil, {}, {}), 0)
  eq(ns.TakenLine(ns.Arrived(taken, {}, {})), nil)
end)

test("bank: /vr off switches the bank part off too, /vr bank off only the bank", function(wow)
  local w = world(wow, { water(10) })
  local b = bankWorld(wow, w)
  b.bag(0, 4)
  b.bag(BANK1, 2, { [1] = { WATER, 20 } })
  BuyMerchantItem = function(index, quantity)
    w.bought[#w.bought + 1] = index .. "x" .. quantity
    b.c[0][4] = { id = WATER, count = quantity }
  end
  boot(wow, 100000, { [WATER] = 5 })
  wow.slash("/vr off")
  b.open()
  w.run()
  b.close()
  eq(#b.calls, 0, "refilling is off: nothing moves")
  eq(VendorRefillDB.bank, true, "the bank setting itself is kept")
  wow.slash("/vr on")
  wow.slash("/vr bank off")
  b.open()
  w.run()
  b.close()
  eq(#b.calls, 0)
  w.visit()
  w.run()
  w.leave()
  eq(table.concat(w.bought, " "), "1x5", "the vendor part still works")
  b.c[0][4] = nil
  wow.slash("/vr bank on")
  b.open()
  w.tick()
  eq(b.count(WATER), 5)
  b.close()
  eq(wow.chat[#wow.chat], PREFIX .. "Taken from the bank: item 159 x5.")

  b.c[0] = { size = 4 }
  b.c[BANK1][1] = { id = WATER, count = 1 }
  b.c[BANK1][2] = { id = WATER, count = 1 }
  b.open()
  w.tick()
  eq(b.count(WATER), 1)
  wow.slash("/vr off") -- switched off during the visit: no more moves
  w.run()
  b.close()
  eq(b.count(WATER), 1)
end)

test("bank: a move the game takes back is not reported", function(wow)
  local w = world(wow)
  local b = bankWorld(wow, w)
  w.names[WATER] = "Water"
  w.names[BREAD] = "Bread"
  b.bag(0, 4)
  b.bag(BANK1, 2, { [1] = { WATER, 20 }, [2] = { BREAD, 20 } })
  -- The bag takes the bread from the cursor, but the server sends it back to the bank.
  local pick = C_Container.PickupContainerItem
  C_Container.PickupContainerItem = function(bag, slot)
    local cur = b.cursor
    if cur and cur.id == BREAD and bag <= 4 then
      b.calls[#b.calls + 1] = "pick " .. bag .. ":" .. slot .. " (taken back)"
      b.c[cur.from[1]][cur.from[2]].count = b.c[cur.from[1]][cur.from[2]].count + cur.count
      b.cursor = nil
      return
    end
    return pick(bag, slot)
  end
  boot(wow, 100000, { [WATER] = 12, [BREAD] = 5 })
  b.open()
  w.tick()
  w.tick()
  w.tick()
  eq(#b.calls, 4, "two moves")
  eq(#w.timers, 1, "the bags are counted a moment later")
  eq(w.timers[1].seconds, 0.5)
  eq(#wow.chat, 0)
  w.run()
  eq(b.count(WATER), 12)
  eq(b.count(BREAD), 0)
  eq(#wow.chat, 1)
  eq(wow.chat[1], PREFIX .. "Taken from the bank: Water x12.", "the bread is left out")
  b.close()
  eq(#wow.chat, 1)

  -- Nothing arrives at all: no line.
  C_Container.PickupContainerItem = function(bag, slot)
    local cur = b.cursor
    if cur and bag <= 4 then
      b.c[cur.from[1]][cur.from[2]].count = b.c[cur.from[1]][cur.from[2]].count + cur.count
      b.cursor = nil
      return
    end
    return pick(bag, slot)
  end
  b.open()
  w.run()
  b.close()
  eq(#wow.chat, 1, "nothing arrived, nothing said")
end)

test("bank: closing the bank before the count reports at once, and only once", function(wow)
  local w = world(wow)
  local b = bankWorld(wow, w)
  b.bag(0, 4)
  b.bag(BANK1, 1, { [1] = { WATER, 20 } })
  boot(wow, 100000, { [WATER] = 7 })
  b.open()
  w.tick()
  w.tick()
  eq(#w.timers, 1, "waiting to count")
  b.close()
  eq(#wow.chat, 1)
  eq(wow.chat[1], PREFIX .. "Taken from the bank: item 159 x7.")
  w.run()
  eq(#wow.chat, 1, "the waiting count says nothing more")
end)
