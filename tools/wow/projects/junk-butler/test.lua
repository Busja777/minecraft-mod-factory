-- Tests for Junk Butler, run by tools/wow/client/run.lua.

-- The parts of the game the stand-in client lacks: a few bags, a vendor and a timer.
-- bags[bag][slot] = { id, quality, count, price (one piece), locked, noValue }
local function world(wow, bags)
  local w = { bags = bags or {}, size = {}, open = false, shift = false, canRepair = true, repairCost = 0, sold = {}, repairs = {}, timers = {}, lookups = 0 }

  NUM_BAG_SLOTS = 4
  NUM_REAGENTBAG_SLOTS = 1
  NUM_TOTAL_EQUIPPED_BAG_SLOTS = 5

  local function itemInfo(link)
    w.lookups = w.lookups + 1
    for _, bag in pairs(w.bags) do
      for _, it in pairs(bag) do
        if link == "item:" .. it.id or link == it.id then
          return "Item " .. it.id, link, it.quality, 1, 1, "Junk", "Junk", 20, "", 134400, it.price
        end
      end
    end
  end
  C_Item = { GetItemInfo = itemInfo }

  C_Container = {
    GetContainerNumSlots = function(bag) return w.bags[bag] and (w.size[bag] or 16) or 0 end,
    GetContainerItemInfo = function(bag, slot)
      local it = w.bags[bag] and w.bags[bag][slot]
      if not it then return nil end
      return { itemID = it.id, quality = it.quality, stackCount = it.count or 1, isLocked = it.locked or false, hasNoValue = it.noValue or false, hyperlink = "item:" .. it.id }
    end,
    UseContainerItem = function(bag, slot)
      local it = w.bags[bag] and w.bags[bag][slot]
      if not it or not w.open then return end
      w.sold[#w.sold + 1] = bag .. ":" .. slot
      w.bags[bag][slot] = nil
      wow.money = wow.money + (it.price or 0) * (it.count or 1)
    end,
  }

  C_Timer = { After = function(seconds, fn) w.timers[#w.timers + 1] = { seconds = seconds, fn = fn } end }
  IsShiftKeyDown = function() return w.shift end
  CanMerchantRepair = function() return w.canRepair end
  GetRepairAllCost = function() return w.repairCost, w.repairCost > 0 end
  RepairAllItems = function(fromGuildBank)
    w.repairs[#w.repairs + 1] = { cost = w.repairCost, guild = fromGuildBank }
    wow.money = wow.money - w.repairCost
    w.repairCost = 0
  end

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

local function boot(wow, money)
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.money = money or 0
  wow.fire("ADDON_LOADED", "JunkButler")
  wow.fire("PLAYER_LOGIN")
  return ns
end

local function grey(id, price, count) return { id = id, quality = 0, price = price, count = count or 1 } end

local function greys(n, price)
  local bag = {}
  for i = 1, n do bag[i] = grey(100 + i, price or 10) end
  return bag
end

local PREFIX = "|cffffd100Junk Butler:|r "

test("addon defines only its own globals", function(wow, installed, before)
  local w = world(wow, { [0] = greys(8) })
  w.repairCost = 50
  local mine = {}
  for k in pairs(_G) do mine[k] = true end
  boot(wow, 1000)
  w.visit()
  w.run()
  w.leave()
  wow.slash("/jb")
  wow.slash("/junkbutler sell")
  wow.slash("/jb keep 101")
  wow.slash("/jb keep")
  wow.slash("/jb unkeep 101")
  local allowed = { JunkButlerDB = true, SLASH_JUNKBUTLER1 = true, SLASH_JUNKBUTLER2 = true }
  for k in pairs(_G) do
    if not mine[k] and not allowed[k] then error("unexpected global " .. tostring(k)) end
  end
  eq(#w.sold, 8)
end)

test("core: only grey items with a price that are not locked are picked", function(wow)
  local ns = boot(wow)
  local items = {
    { bag = 0, slot = 1, id = 1, quality = 0, price = 10, count = 1, locked = false },
    { bag = 0, slot = 2, id = 2, quality = 1, price = 10, count = 1, locked = false }, -- white
    { bag = 0, slot = 3, id = 3, quality = 0, price = 0, count = 1, locked = false },  -- worth nothing
    { bag = 1, slot = 1, id = 4, quality = 0, price = 10, count = 1, locked = true },  -- being moved
    { bag = 1, slot = 2, id = 5, quality = 0, price = nil, count = 1, locked = false }, -- price unknown
    { bag = 1, slot = 3, id = 6, quality = nil, price = 10, count = 1, locked = false }, -- quality unknown
    { bag = 2, slot = 7, id = 7, quality = 0, price = 25, count = 20, locked = false },
    { bag = 2, slot = 8, id = 8, quality = 4, price = 99999, count = 1, locked = false }, -- epic
  }
  local plan = ns.SellPlan(items)
  eq(#plan, 2)
  eq(plan[1].id, 1)
  eq(plan[2].id, 7)
  eq(plan[2].bag, 2)
  eq(plan[2].slot, 7)
  eq(#ns.SellPlan({}), 0)
end)

test("core: totals count stacks, pieces and gold", function(wow)
  local ns = boot(wow)
  local t = ns.Totals({ { price = 10, count = 1 }, { price = 25, count = 20 }, { price = 3, count = 5 } })
  eq(t.stacks, 3)
  eq(t.items, 26)
  eq(t.earned, 525)
  eq(ns.Totals({}).earned, 0)
end)

test("core: steps cut the plan into pieces", function(wow)
  local ns = boot(wow)
  local plan = { "a", "b", "c", "d", "e" }
  local step, nextIndex = ns.Step(plan, 1, 2)
  eq(#step, 2)
  eq(step[2], "b")
  eq(nextIndex, 3)
  step, nextIndex = ns.Step(plan, 5, 2)
  eq(#step, 1)
  eq(step[1], "e")
  eq(nextIndex, 6)
  step, nextIndex = ns.Step({}, 1, 2)
  eq(#step, 0)
  eq(nextIndex, 1)
  eq(#ns.Step(plan, 1), 5, "default size is ns.STEP")
  eq(ns.STEP, 6)
end)

test("core: when to repair", function(wow)
  local ns = boot(wow)
  eq(ns.ShouldRepair(500, 1000, true), true)
  eq(ns.ShouldRepair(500, 500, true), true, "exactly enough")
  local ok, why = ns.ShouldRepair(500, 499, true)
  eq(ok, false)
  eq(why, "poor")
  ok, why = ns.ShouldRepair(0, 1000, true)
  eq(ok, false, "nothing is damaged")
  eq(why, nil)
  eq(ns.ShouldRepair(500, 1000, false), false, "vendor cannot repair")
  eq(ns.ShouldRepair(nil, 1000, true), false, "cost unknown")
  ok, why = ns.ShouldRepair(500, nil, true)
  eq(ok, false, "gold unknown")
  eq(why, nil)
end)

test("core: money texts and the summary line", function(wow)
  local ns = boot(wow)
  eq(ns.PlainMoney(0), "0c")
  eq(ns.PlainMoney(5), "5c")
  eq(ns.PlainMoney(1205), "12s 05c")
  eq(ns.PlainMoney(10000), "1g 00s 00c")
  eq(ns.PlainMoney(123456789), "12,345g 67s 89c")
  eq(ns.Summary({ items = 0, earned = 0 }), nil)
  eq(ns.Summary({ items = 1, earned = 5 }), "Sold 1 junk item for 5c.")
  eq(ns.Summary({ items = 12, earned = 12005 }), "Sold 12 junk items for 1g 20s 05c.")
  eq(ns.Summary({ items = 0, earned = 0, repaired = 20000 }), "Repaired your gear for 2g 00s 00c.")
  eq(ns.Summary({ items = 3, earned = 150, repaired = 20000 }), "Sold 3 junk items for 1s 50c. Repaired your gear for 2g 00s 00c.")
  eq(ns.Summary({ items = 3, earned = 150, short = 20000 }), "Sold 3 junk items for 1s 50c. Not enough gold to repair your gear (2g 00s 00c).")
  GetMoneyString = function(copper, separate) return "<" .. copper .. (separate and "," or "") .. ">" end
  eq(ns.FormatMoney(1205), "<1205,>", "the game's own money text is used when it exists")
end)

test("a vendor visit sells the grey items in steps and tells the result", function(wow)
  local w = world(wow, { [0] = greys(8, 10), [2] = { [3] = grey(200, 25, 20), [4] = { id = 201, quality = 2, price = 5000 } } })
  local ns = boot(wow, 100)
  w.visit()
  eq(#w.sold, 6, "first step")
  eq(#w.timers, 1)
  eq(w.timers[1].seconds, ns.DELAY)
  eq(#wow.chat, 0, "nothing is said before the work is done")
  w.tick()
  eq(#w.sold, 9, "second step")
  eq(w.sold[9], "2:3")
  w.tick()
  eq(#w.timers, 0)
  eq(#w.sold, 9)
  eq(w.bags[2][4].id, 201, "the green item stays")
  eq(wow.money, 100 + 80 + 500)
  eq(#wow.chat, 1)
  eq(wow.chat[1], PREFIX .. "Sold 28 junk items for 5s 80c.")
end)

test("selling stops when the vendor window closes", function(wow)
  local w = world(wow, { [0] = greys(14, 10) })
  boot(wow, 0)
  w.visit()
  eq(#w.sold, 6)
  w.leave()
  eq(#wow.chat, 1)
  eq(wow.chat[1], PREFIX .. "Sold 6 junk items for 60c.")
  w.open = true -- even if a window were open again, the old visit is over
  w.run()
  eq(#w.sold, 6)
  eq(#wow.chat, 1)
  w.open = false
  w.visit() -- the next visit sells the rest
  w.run()
  eq(#w.sold, 14)
  eq(wow.chat[2], PREFIX .. "Sold 8 junk items for 80c.")
end)

test("items without a price, locked items and better items are skipped", function(wow)
  local w = world(wow, {
    [0] = {
      [1] = grey(1, 10),
      [2] = { id = 2, quality = 0, price = 10, noValue = true },
      [3] = { id = 3, quality = 0, price = 0 },
      [4] = { id = 4, quality = 0, price = 10, locked = true },
      [5] = { id = 5, quality = 0 }, -- the game does not know its price yet
      [6] = { id = 6, quality = 1, price = 10 },
      [9] = grey(9, 7, 3),
    },
    [5] = { [2] = grey(50, 4) }, -- reagent bag
  })
  w.size[0] = 9
  local ns = boot(wow, 0)
  eq(#ns.ScanBags(), 8, "every filled slot is read")
  w.lookups = 0
  w.visit()
  w.run()
  eq(table.concat(w.sold, " "), "0:1 0:9 5:2")
  eq(wow.chat[1], PREFIX .. "Sold 5 junk items for 35c.")
  eq(w.bags[0][4].id, 4)
  eq(w.lookups <= 12, true, "prices are only looked up for grey items")
end)

test("a slot is read again before it is sold", function(wow)
  local w = world(wow, { [0] = greys(8, 10) })
  boot(wow, 0)
  w.visit()
  w.bags[0][7] = { id = 900, quality = 4, price = 500000 } -- the player dropped an epic there
  w.bags[0][8].locked = true                                 -- and picked this one up
  w.run()
  eq(#w.sold, 6)
  eq(w.bags[0][7].id, 900)
  eq(w.bags[0][8].id, 108)
  eq(wow.chat[1], PREFIX .. "Sold 6 junk items for 60c.")
end)

test("repair: paid from the player's own gold when it reaches", function(wow)
  local w = world(wow)
  w.repairCost = 20000
  boot(wow, 50000)
  w.visit()
  eq(#w.repairs, 1)
  eq(w.repairs[1].guild, nil, "never from the guild bank")
  eq(wow.money, 30000)
  eq(#w.timers, 0)
  eq(#wow.chat, 1)
  eq(wow.chat[1], PREFIX .. "Repaired your gear for 2g 00s 00c.")
end)

test("repair: not enough gold, the line says so", function(wow)
  local w = world(wow)
  w.repairCost = 20000
  boot(wow, 19999)
  w.visit()
  eq(#w.repairs, 0)
  eq(wow.money, 19999)
  eq(wow.chat[1], PREFIX .. "Not enough gold to repair your gear (2g 00s 00c).")
end)

test("repair: the sale can pay for it", function(wow)
  local w = world(wow, { [0] = greys(2, 6000) })
  w.repairCost = 20000
  boot(wow, 10000)
  w.visit()
  eq(#w.repairs, 0, "too poor before the sale")
  w.run()
  eq(#w.repairs, 1)
  eq(wow.money, 2000)
  eq(#wow.chat, 1)
  eq(wow.chat[1], PREFIX .. "Sold 2 junk items for 1g 20s 00c. Repaired your gear for 2g 00s 00c.")
end)

test("repair: still too poor after the sale", function(wow)
  local w = world(wow, { [0] = greys(2, 10) })
  w.repairCost = 20000
  boot(wow, 0)
  w.visit()
  w.run()
  eq(#w.repairs, 0)
  eq(wow.chat[1], PREFIX .. "Sold 2 junk items for 20c. Not enough gold to repair your gear (2g 00s 00c).")
end)

test("repair: a vendor that cannot repair, or gear without damage", function(wow)
  local w = world(wow)
  w.repairCost = 20000
  w.canRepair = false
  boot(wow, 50000)
  w.visit()
  w.run()
  w.leave()
  eq(#w.repairs, 0)
  w.canRepair = true
  w.repairCost = 0
  w.visit()
  w.run()
  w.leave()
  eq(#w.repairs, 0)
  eq(#wow.chat, 0, "nothing happened, nothing is printed")
end)

test("holding Shift skips selling and repairing for that visit", function(wow)
  local w = world(wow, { [0] = greys(3, 10) })
  w.repairCost = 500
  boot(wow, 1000)
  w.shift = true
  w.visit()
  w.run()
  w.leave()
  eq(#w.sold, 0)
  eq(#w.repairs, 0)
  eq(#wow.chat, 0)
  w.shift = false
  w.visit()
  w.run()
  eq(#w.sold, 3)
  eq(#w.repairs, 1)
  eq(wow.chat[1], PREFIX .. "Sold 3 junk items for 30c. Repaired your gear for 5s 00c.")
end)

test("a second MERCHANT_SHOW during a visit does not start a second run", function(wow)
  local w = world(wow, { [0] = greys(8, 10) })
  boot(wow, 0)
  w.visit()
  w.visit()
  eq(#w.sold, 6)
  eq(#w.timers, 1)
  w.run()
  eq(#w.sold, 8)
  eq(#wow.chat, 1)
  eq(wow.chat[1], PREFIX .. "Sold 8 junk items for 80c.")
end)

test("slash commands show the state and switch each half", function(wow)
  local w = world(wow, { [0] = greys(2, 10) })
  w.repairCost = 500
  boot(wow, 1000)
  wow.slash("/jb")
  eq(wow.chat[1], PREFIX .. "Selling junk is on. Repairing is on.")
  wow.slash("/jb sell")
  eq(wow.chat[2], PREFIX .. "Selling junk is off.")
  eq(JunkButlerDB.settings.sell, false)
  w.visit()
  w.run()
  w.leave()
  eq(#w.sold, 0)
  eq(#w.repairs, 1)
  eq(wow.chat[3], PREFIX .. "Repaired your gear for 5s 00c.")
  wow.slash("/junkbutler  SELL ")
  eq(wow.chat[4], PREFIX .. "Selling junk is on.")
  wow.slash("/jb repair")
  eq(wow.chat[5], PREFIX .. "Repairing is off.")
  eq(JunkButlerDB.settings.repair, false)
  w.repairCost = 500
  w.visit()
  w.run()
  w.leave()
  eq(#w.sold, 2)
  eq(#w.repairs, 1)
  eq(wow.chat[6], PREFIX .. "Sold 2 junk items for 20c.")
  wow.slash("/jb")
  eq(wow.chat[7], PREFIX .. "Selling junk is on. Repairing is off.")
  wow.slash("/jb help")
  eq(wow.chat[8]:match("/jb sell and /jb repair switch each half") ~= nil, true)
  eq(wow.chat[9]:match("/jb unkeep takes it off again") ~= nil, true)
  eq(#wow.chat, 9)
end)

test("settings survive: saved values are kept, new ones start switched on", function(wow)
  local w = world(wow, { [0] = greys(2, 10) })
  boot(wow, 0)
  eq(JunkButlerDB.version, 2)
  eq(JunkButlerDB.settings.sell, true)
  eq(JunkButlerDB.settings.repair, true)

  JunkButlerDB = { settings = { sell = false }, later = "kept" } -- as the game loads it at the next login
  wow.load(ADDON_DIR, ADDON_NAME)
  wow.frames[1].events = {} -- the first copy of the addon no longer listens
  wow.fire("PLAYER_LOGIN")
  eq(JunkButlerDB.settings.sell, false)
  eq(JunkButlerDB.settings.repair, true)
  eq(JunkButlerDB.later, "kept")
  w.visit()
  w.run()
  eq(#w.sold, 0)

  JunkButlerDB = "broken"
  wow.fire("PLAYER_LOGIN")
  eq(JunkButlerDB.settings.sell, true)
end)

test("secret values are never used for decisions", function(wow)
  local w = world(wow, { [0] = { [1] = grey(1, 10), [2] = grey(2, 10), [3] = grey(3, 10) } })
  local secret = { secret = true }
  w.bags[0][2].count = secret
  w.bags[0][3].price = secret
  w.repairCost = 500
  GetRepairAllCost = function() return secret, true end
  boot(wow, 1000)
  w.visit()
  w.run()
  w.leave()
  eq(table.concat(w.sold, " "), "0:1")
  eq(#w.repairs, 0)
  eq(wow.chat[1], PREFIX .. "Sold 1 junk item for 10c.")

  GetRepairAllCost = function() return 500, true end
  wow.money = secret
  w.visit()
  w.run()
  eq(#w.repairs, 0, "gold unknown, no repair")
  eq(#wow.chat, 1, "and no claim that the gold is short")
end)

test("missing parts of the game are no error", function(wow)
  local w = world(wow, { [0] = greys(2, 10) })
  local lookup = C_Item.GetItemInfo
  C_Item = nil
  GetItemInfo = lookup -- older name of the same function
  NUM_TOTAL_EQUIPPED_BAG_SLOTS = nil
  IsShiftKeyDown = nil
  CanMerchantRepair = nil
  w.repairCost = 500
  boot(wow, 1000)
  w.visit()
  w.run()
  w.leave()
  eq(#w.sold, 2)
  eq(#w.repairs, 0)
  eq(wow.chat[1], PREFIX .. "Sold 2 junk items for 20c.")

  C_Container = nil
  w.visit()
  w.leave()
  eq(#wow.chat, 1)
end)

test("a slash command before login does nothing", function(wow)
  world(wow)
  wow.load(ADDON_DIR, ADDON_NAME)
  wow.slash("/jb sell")
  wow.fire("MERCHANT_SHOW")
  eq(#wow.chat, 0)
  eq(JunkButlerDB, nil)
end)

-- 1.1: keep list ---------------------------------------------------------------------------------

local TORN = "|cff9d9d9d|Hitem:2211::::::::80:::::|h[Torn Wristband]|h|r"
local FANG = "|cnIQ0:|Hitem:2212::::::::80:::::|h[Broken Fang]|h|r" -- the newer colour code in links

-- Logs in again with the saved data, the way the game loads it.
local function relog(wow)
  for _, f in ipairs(wow.frames) do f.events = {} end -- the old copy of the addon no longer listens
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("PLAYER_LOGIN")
  return ns
end

test("core: kept items are held back from the sale and counted in pieces", function(wow)
  local ns = boot(wow)
  local items = {
    { bag = 0, slot = 1, id = 1, quality = 0, price = 10, count = 1, locked = false },
    { bag = 0, slot = 2, id = 2, quality = 0, price = 10, count = 5, locked = false },
    { bag = 0, slot = 3, id = 2, quality = 0, price = 10, count = 2, locked = false },
    { bag = 0, slot = 4, id = 3, quality = 0, price = 0, count = 4, locked = false }, -- unsellable anyway
    { bag = 0, slot = 5, id = 4, quality = 2, price = 99, count = 1, locked = false },
  }
  local plan, kept = ns.SellPlan(items, { [2] = TORN, [3] = true, [4] = true })
  eq(#plan, 1)
  eq(plan[1].id, 1)
  eq(kept, 7, "only items that would have been sold count as kept")
  plan, kept = ns.SellPlan(items)
  eq(#plan, 3, "without a keep list everything sellable goes")
  eq(kept, 0)
  eq(ns.IsKept({ [5] = false }, 5), false)
  eq(ns.IsKept(nil, 5), false)
  eq(ns.IsKept({ [5] = true }, nil), false)
end)

test("core: item IDs from links and typed numbers", function(wow)
  local ns = boot(wow)
  local ids, links = ns.ParseItems(TORN)
  eq(#ids, 1)
  eq(ids[1], 2211)
  eq(links[2211], TORN)
  ids, links = ns.ParseItems(FANG .. " " .. TORN .. FANG)
  eq(table.concat(ids, ","), "2212,2211", "in order, without repeats")
  eq(links[2212], FANG)
  ids = ns.ParseItems("12345 678")
  eq(table.concat(ids, ","), "12345,678")
  ids = ns.ParseItems("item:4242")
  eq(table.concat(ids, ","), "4242")
  ids, links = ns.ParseItems("|Hitem:77::::|h[No colour]|h")
  eq(table.concat(ids, ","), "77", "a link without colour still names the item")
  eq(links[77], nil)
  eq(#ns.ParseItems("Ragged Leather"), 0)
  eq(#ns.ParseItems("0 -5 3x"), 0)
  eq(#ns.ParseItems(""), 0)
end)

test("core: the saved keep list is cleaned, the summary counts kept items", function(wow)
  local ns = boot(wow)
  local keep = ns.CleanKeepList({ [10] = TORN, [11] = true, ["12"] = true, [13] = false, [-1] = true, [14] = 5 })
  eq(keep[10], TORN)
  eq(keep[11], true)
  eq(keep[14], true)
  eq(keep["12"], nil)
  eq(keep[13], nil)
  eq(keep[-1], nil)
  eq(table.concat(ns.KeptIDs(keep), ","), "10,11,14")
  eq(next(ns.CleanKeepList("broken")), nil)
  eq(ns.Summary({ items = 3, earned = 30, kept = 1 }), "Sold 3 junk items for 30c. Kept 1 item on your keep list.")
  eq(ns.Summary({ items = 3, earned = 30, kept = 4, repaired = 100 }), "Sold 3 junk items for 30c. Repaired your gear for 1s 00c. Kept 4 items on your keep list.")
  eq(ns.Summary({ items = 0, earned = 0, kept = 4 }), nil, "kept items alone are no reason to speak")
end)

test("a vendor visit never sells kept items and says how many were kept", function(wow)
  local w = world(wow, { [0] = { [1] = grey(2211, 10), [2] = grey(2212, 7, 3), [3] = grey(300, 5) } })
  boot(wow, 0)
  wow.slash("/jb keep " .. TORN .. FANG)
  wow.chat = {}
  w.visit()
  w.run()
  eq(table.concat(w.sold, " "), "0:3")
  eq(w.bags[0][1].id, 2211)
  eq(w.bags[0][2].id, 2212)
  eq(#wow.chat, 1)
  eq(wow.chat[1], PREFIX .. "Sold 1 junk item for 5c. Kept 4 items on your keep list.")
  w.leave()
  w.visit() -- only kept items are left
  w.run()
  w.leave()
  eq(#wow.chat, 1, "nothing sold, nothing said")
end)

test("an item put on the keep list during a visit is not sold", function(wow)
  local w = world(wow, { [0] = greys(8, 10) })
  boot(wow, 0)
  w.visit()
  eq(#w.sold, 6)
  wow.slash("/jb keep 108")
  w.run()
  eq(#w.sold, 7)
  eq(w.bags[0][8].id, 108)
  eq(wow.chat[#wow.chat], PREFIX .. "Sold 7 junk items for 70c. Kept 1 item on your keep list.")
end)

test("/jb keep and /jb unkeep by link or item ID, /jb keep lists", function(wow)
  world(wow)
  local known = { [5000] = "|cff9d9d9d|Hitem:5000::::|h[Cracked Bone]|h|r" }
  C_Item.GetItemInfo = function(id) if known[id] then return "Cracked Bone", known[id] end end
  boot(wow)
  wow.slash("/jb keep")
  eq(wow.chat[1], PREFIX .. "Your keep list is empty. Add a grey item with /jb keep and its link or item ID.")
  wow.slash("/jb KEEP " .. TORN)
  eq(wow.chat[2], PREFIX .. TORN .. " is on your keep list and will never be sold.")
  wow.slash("/jb keep 5000 777")
  eq(wow.chat[3], PREFIX .. known[5000] .. " is on your keep list and will never be sold.", "the game's link for a typed ID")
  eq(wow.chat[4], PREFIX .. "item 777 is on your keep list and will never be sold.", "the game does not know the item yet")
  eq(JunkButlerDB.keep[2211], TORN)
  eq(JunkButlerDB.keep[5000], known[5000])
  eq(JunkButlerDB.keep[777], true)
  wow.chat = {}
  known[777] = "|cff9d9d9d|Hitem:777::::|h[Late Loader]|h|r"
  wow.slash("/junkbutler keep")
  eq(#wow.chat, 4)
  eq(wow.chat[1], PREFIX .. "Never sold (3):")
  eq(wow.chat[2], "  " .. known[777], "looked up again when listed")
  eq(wow.chat[3], "  " .. TORN)
  eq(wow.chat[4], "  " .. known[5000])
  wow.chat = {}
  wow.slash("/jb unkeep " .. TORN)
  eq(wow.chat[1], PREFIX .. TORN .. " is off your keep list.")
  eq(JunkButlerDB.keep[2211], nil)
  wow.slash("/jb unkeep 2211")
  eq(wow.chat[2], PREFIX .. "item 2211 is not on your keep list.")
  wow.slash("/jb unkeep")
  eq(wow.chat[3], PREFIX .. "Name the item after /jb unkeep: shift-click it into the chat or type its item ID.")
  wow.slash("/jb keep Ragged Leather")
  eq(wow.chat[4], PREFIX .. "Name the item after /jb keep: shift-click it into the chat or type its item ID.")
end)

test("the keep list is shared by all characters of the account", function(wow)
  local w = world(wow, { [0] = { [1] = grey(2211, 10), [2] = grey(300, 5) } })
  boot(wow, 0)
  wow.slash("/jb keep 2211")
  wow.player = "Brakk" -- another character logs in
  relog(wow)
  w.visit()
  w.run()
  eq(table.concat(w.sold, " "), "0:2")
  eq(JunkButlerDB.keep[2211], true)
end)

test("1.0 data moves over: settings stay, the keep list starts empty", function(wow)
  local w = world(wow, { [0] = greys(2, 10) })
  JunkButlerDB = { version = 1, settings = { sell = true, repair = false } }
  boot(wow, 0)
  eq(JunkButlerDB.version, 2)
  eq(JunkButlerDB.settings.repair, false)
  eq(type(JunkButlerDB.keep), "table")
  eq(next(JunkButlerDB.keep), nil)
  w.visit()
  w.run()
  eq(#w.sold, 2)
  JunkButlerDB = { version = 2, settings = {}, keep = { [101] = true, ["x"] = true } }
  relog(wow)
  eq(JunkButlerDB.keep.x, nil)
  eq(JunkButlerDB.keep[101], true)
end)

test("a keep command before login does nothing", function(wow)
  world(wow)
  wow.load(ADDON_DIR, ADDON_NAME)
  wow.slash("/jb keep 2211")
  wow.slash("/jb unkeep 2211")
  wow.slash("/jb keep")
  eq(#wow.chat, 0)
  eq(JunkButlerDB, nil)
end)
