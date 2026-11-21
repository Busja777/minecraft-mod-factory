-- Tests for Junk Butler, run by tools/wow/client/run.lua.

-- The parts of the game the stand-in client lacks: a few bags, a vendor and a timer.
-- bags[bag][slot] = { id, quality, count, price (one piece), locked, noValue }
local function world(wow, bags)
  local w = { bags = bags or {}, size = {}, open = false, shift = false, canRepair = true, repairCost = 0, sold = {}, repairs = {}, timers = {}, lookups = 0 }

  NUM_BAG_SLOTS = 4
  NUM_REAGENTBAG_SLOTS = 1
  NUM_TOTAL_EQUIPPED_BAG_SLOTS = 5

  -- The link the game gives a bag slot (1.3 logs it), and the item lookup by link or ID.
  function w.link(id) return "|cff9d9d9d|Hitem:" .. id .. "::::::::80:::::|h[Item " .. id .. "]|h|r" end
  local function itemInfo(link)
    w.lookups = w.lookups + 1
    local id = type(link) == "number" and link or tonumber(tostring(link):match("item:(%d+)") or "")
    for _, bag in pairs(w.bags) do
      for _, it in pairs(bag) do
        if id == it.id then
          return "Item " .. it.id, w.link(it.id), it.quality, 1, 1, "Junk", "Junk", 20, "", 134400, it.price
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
      return { itemID = it.id, quality = it.quality, stackCount = it.count or 1, isLocked = it.locked or false, hasNoValue = it.noValue or false, hyperlink = not it.noLink and w.link(it.id) or nil }
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
  -- 1.3: the vendor's name for the sale log.
  w.vendor = "Grumbold"
  UnitName = function(unit)
    if unit == "npc" then return w.vendor end
    return wow.player or "Yubi"
  end
  IsShiftKeyDown = function() return w.shift end
  CanMerchantRepair = function() return w.canRepair end
  GetRepairAllCost = function() return w.repairCost, w.repairCost > 0 end
  -- 1.2: the guild. Off by default: no guild rank that may repair, an empty guild bank.
  w.inGuild, w.guildRepair, w.withdraw, w.guildMoney, w.guildRefuses = true, false, 0, 0, false
  IsInGuild = function() return w.inGuild end
  CanGuildBankRepair = function() return w.guildRepair end
  GetGuildBankWithdrawMoney = function() return w.withdraw end
  GetGuildBankMoney = function() return w.guildMoney end
  RepairAllItems = function(fromGuildBank)
    w.repairs[#w.repairs + 1] = { cost = w.repairCost, guild = fromGuildBank }
    if fromGuildBank then
      if w.guildRefuses then return end -- the server says no: nothing is repaired
      w.guildMoney = w.guildMoney - w.repairCost
    else
      wow.money = wow.money - w.repairCost
    end
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
  wow.slash("/jb guild on")
  wow.slash("/jb log")
  wow.slash("/jb log 1")
  wow.slash("/jb log clear")
  w.guildRepair, w.withdraw, w.guildMoney, w.repairCost = true, -1, 100000, 50
  w.visit()
  w.run()
  w.leave()
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
  eq(wow.chat[1], PREFIX .. "Selling junk is on. Repairing is on. Guild bank repairs are off.")
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
  eq(wow.chat[7], PREFIX .. "Selling junk is on. Repairing is off. Guild bank repairs are off.")
  wow.slash("/jb help")
  eq(wow.chat[8]:match("/jb sell and /jb repair switch each half") ~= nil, true)
  eq(wow.chat[9]:match("/jb unkeep takes it off again") ~= nil, true)
  eq(wow.chat[10], PREFIX .. "/jb guild on/off lets the guild bank pay your repairs first when your guild rank allows it.")
  eq(wow.chat[11]:match("/jb log lists your last vendor visits") ~= nil, true)
  eq(#wow.chat, 11)
end)

test("settings survive: saved values are kept, new ones start switched on", function(wow)
  local w = world(wow, { [0] = greys(2, 10) })
  boot(wow, 0)
  eq(JunkButlerDB.version, 4)
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
  eq(JunkButlerDB.keep[2211], w.link(2211), "stored with the link the game knows")
end)

test("1.0 data moves over: settings stay, the keep list starts empty", function(wow)
  local w = world(wow, { [0] = greys(2, 10) })
  JunkButlerDB = { version = 1, settings = { sell = true, repair = false } }
  boot(wow, 0)
  eq(JunkButlerDB.version, 4)
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

-- 1.2: guild bank repairs --------------------------------------------------------------------------

-- A guild whose bank may pay: the player's rank may repair from it, withdraw = what is left of the
-- day's limit (-1: no limit), bank = the gold in the guild bank.
local function guildBank(w, withdraw, bank)
  w.guildRepair, w.withdraw, w.guildMoney = true, withdraw, bank
end

local function guildBoot(wow, w, money)
  boot(wow, money)
  wow.slash("/jb guild on")
  wow.chat = {}
end

test("core: whether the guild bank can pay", function(wow)
  local ns = boot(wow)
  eq(ns.GuildCanPay(500, 1000, 5000), true)
  eq(ns.GuildCanPay(500, 500, 5000), true, "exactly the daily limit")
  eq(ns.GuildCanPay(500, 499, 5000), false, "the daily limit is too small")
  eq(ns.GuildCanPay(500, 1000, 499), false, "the bank has too little gold")
  eq(ns.GuildCanPay(500, -1, 500), true, "no limit: the bank's gold counts")
  eq(ns.GuildCanPay(500, -1, 499), false)
  eq(ns.GuildCanPay(0, -1, 5000), false, "nothing to repair")
  eq(ns.GuildCanPay(nil, -1, 5000), false, "cost unknown")
  eq(ns.GuildCanPay(500, nil, 5000), false, "limit unknown")
  eq(ns.GuildCanPay(500, 1000, nil), false, "bank gold unknown")
  eq(ns.Summary({ items = 0, earned = 0, repaired = 20000, guild = true }), "Repaired your gear for 2g 00s 00c from the guild bank.")
  eq(ns.Summary({ items = 2, earned = 20, repaired = 100, guild = true, kept = 1 }), "Sold 2 junk items for 20c. Repaired your gear for 1s 00c from the guild bank. Kept 1 item on your keep list.")
end)

test("guild repairs are off by default: the player's own gold pays", function(wow)
  local w = world(wow)
  guildBank(w, -1, 1000000)
  w.repairCost = 20000
  boot(wow, 50000)
  eq(JunkButlerDB.settings.guild, false)
  w.visit()
  w.run()
  eq(#w.repairs, 1)
  eq(w.repairs[1].guild, nil)
  eq(wow.money, 30000)
  eq(w.guildMoney, 1000000)
  eq(wow.chat[1], PREFIX .. "Repaired your gear for 2g 00s 00c.")
end)

test("guild on: the guild bank pays, the chat line says so once the game had time to answer", function(wow)
  local w = world(wow, { [0] = greys(2, 10) })
  guildBank(w, 30000, 1000000)
  w.repairCost = 20000
  local ns = guildBoot(wow, w, 50000)
  w.visit()
  eq(#w.repairs, 1)
  eq(w.repairs[1].guild, true, "RepairAllItems(true)")
  eq(w.guildMoney, 980000)
  w.tick() -- the sale's last step
  eq(#wow.chat, 0, "not yet: the repair is checked first")
  eq(w.timers[1].seconds, 1, "GUILD_WAIT")
  w.run()
  eq(#w.repairs, 1)
  eq(wow.money, 50000 + 20, "the player's own gold is untouched")
  eq(wow.chat[1], PREFIX .. "Sold 2 junk items for 20c. Repaired your gear for 2g 00s 00c from the guild bank.")
end)

test("guild on: a rank that may not repair, a too small limit or a poor bank fall back to own gold", function(wow)
  local w = world(wow)
  guildBoot(wow, w, 100000)
  local cases = {
    { false, -1, 1000000, "the rank may not repair from the guild bank" },
    { true, 19999, 1000000, "the day's limit is too small" },
    { true, -1, 19999, "the guild bank is too poor" },
    { true, 0, 1000000, "the limit is used up" },
  }
  for i, case in ipairs(cases) do
    w.guildRepair, w.withdraw, w.guildMoney = case[1], case[2], case[3]
    w.repairCost = 20000
    w.visit()
    w.run()
    w.leave()
    eq(w.repairs[i].guild, nil, case[4])
    eq(wow.chat[i], PREFIX .. "Repaired your gear for 2g 00s 00c.", case[4])
  end
  eq(wow.money, 100000 - 4 * 20000)
end)

test("guild on: no guild at all, the player's own gold pays", function(wow)
  local w = world(wow)
  guildBank(w, -1, 1000000)
  w.inGuild = false
  w.repairCost = 500
  guildBoot(wow, w, 1000)
  w.visit()
  w.run()
  eq(w.repairs[1].guild, nil)
  eq(wow.money, 500)
end)

test("guild on: the guild bank turns the repair down, own gold pays instead", function(wow)
  local w = world(wow)
  guildBank(w, -1, 1000000) -- the game's numbers were out of date
  w.guildRefuses = true
  w.repairCost = 20000
  guildBoot(wow, w, 50000)
  w.visit()
  eq(#w.repairs, 1)
  eq(w.repairs[1].guild, true)
  w.run()
  eq(#w.repairs, 2)
  eq(w.repairs[2].guild, nil, "the second try is from the player's gold")
  eq(wow.money, 30000)
  eq(#wow.chat, 1)
  eq(wow.chat[1], PREFIX .. "Repaired your gear for 2g 00s 00c.")
end)

test("guild on: turned down and too poor, the sale still pays for it", function(wow)
  local w = world(wow, { [0] = greys(2, 6000) })
  guildBank(w, -1, 1000000)
  w.guildRefuses = true
  w.repairCost = 20000
  guildBoot(wow, w, 10000)
  w.visit()
  w.run()
  eq(#w.repairs, 2)
  eq(w.repairs[2].guild, nil)
  eq(wow.money, 2000)
  eq(wow.chat[1], PREFIX .. "Sold 2 junk items for 1g 20s 00c. Repaired your gear for 2g 00s 00c.")

  w.repairCost, wow.money = 20000, 0 -- and when even the sale is not enough
  w.bags[0] = greys(1, 10)
  w.leave()
  w.visit()
  w.run()
  eq(#w.repairs, 3)
  eq(wow.chat[2], PREFIX .. "Sold 1 junk item for 10c. Not enough gold to repair your gear (2g 00s 00c).")
end)

test("guild on: the guild bank pays when the player's own gold is short", function(wow)
  local w = world(wow)
  guildBank(w, -1, 1000000)
  w.repairCost = 20000
  guildBoot(wow, w, 0)
  w.visit()
  w.run()
  eq(#w.repairs, 1)
  eq(w.repairs[1].guild, true)
  eq(wow.chat[1], PREFIX .. "Repaired your gear for 2g 00s 00c from the guild bank.")
end)

test("guild on: repairing switched off or Shift held means no guild repair either", function(wow)
  local w = world(wow)
  guildBank(w, -1, 1000000)
  w.repairCost = 500
  guildBoot(wow, w, 1000)
  w.shift = true
  w.visit()
  w.run()
  w.leave()
  w.shift = false
  wow.slash("/jb repair")
  w.visit()
  w.run()
  w.leave()
  eq(#w.repairs, 0)
end)

test("guild on: secret or missing guild answers fall back to own gold", function(wow)
  local w = world(wow)
  local secret = { secret = true }
  guildBank(w, -1, 1000000)
  guildBoot(wow, w, 100000)
  local function visit(why)
    w.repairCost = 500
    w.visit()
    w.run()
    w.leave()
    eq(w.repairs[#w.repairs].guild, nil, why)
  end
  w.guildRepair = secret
  visit("rank answer secret")
  w.guildRepair, w.withdraw = true, secret
  visit("limit secret")
  w.withdraw, w.guildMoney = -1, secret
  visit("bank gold secret")
  w.guildMoney, w.inGuild = 1000000, secret
  visit("guild membership secret")
  w.inGuild = true
  GetGuildBankMoney = nil
  visit("a client without the guild bank gold")
  IsInGuild = nil
  CanGuildBankRepair = nil
  visit("a client without guild repairs")
  eq(#w.repairs, 6)
  eq(wow.money, 100000 - 6 * 500)
end)

test("the vendor closes before the guild repair is checked: the visit ends at once", function(wow)
  local w = world(wow)
  guildBank(w, -1, 1000000)
  w.repairCost = 500
  guildBoot(wow, w, 1000)
  w.visit()
  w.leave()
  eq(#wow.chat, 1)
  eq(wow.chat[1], PREFIX .. "Repaired your gear for 5s 00c from the guild bank.")
  w.run()
  eq(#wow.chat, 1, "the waiting check does nothing after the visit")
  eq(#w.repairs, 1)
end)

test("/jb guild on, off and alone; other words print the help", function(wow)
  local w = world(wow)
  boot(wow)
  wow.slash("/jb guild on")
  eq(wow.chat[1], PREFIX .. "Guild bank repairs are on.")
  eq(JunkButlerDB.settings.guild, true)
  wow.slash("/jb")
  eq(wow.chat[2], PREFIX .. "Selling junk is on. Repairing is on. Guild bank repairs are on.")
  wow.slash("/jb GUILD Off")
  eq(wow.chat[3], PREFIX .. "Guild bank repairs are off.")
  eq(JunkButlerDB.settings.guild, false)
  wow.slash("/junkbutler guild")
  eq(wow.chat[4], PREFIX .. "Guild bank repairs are on.", "alone it switches")
  wow.slash("/jb guild maybe")
  eq(wow.chat[5]:match("^" .. PREFIX:gsub("%p", "%%%0") .. "/jb guild on lets the guild bank pay") ~= nil, true)
  eq(JunkButlerDB.settings.guild, true, "a wrong word changes nothing")
  for _, line in ipairs(wow.chat) do
    eq(line:sub(#PREFIX + 1):find("|", 1, true), nil, "no | in the text: it would start an escape code")
  end
end)

test("1.1 data moves over: settings and keep list stay, guild repairs start off", function(wow)
  local w = world(wow)
  guildBank(w, -1, 1000000)
  JunkButlerDB = { version = 2, settings = { sell = false, repair = true }, keep = { [2211] = true } }
  boot(wow, 1000)
  eq(JunkButlerDB.version, 4)
  eq(JunkButlerDB.settings.sell, false)
  eq(JunkButlerDB.settings.guild, false)
  eq(JunkButlerDB.keep[2211], true)
  JunkButlerDB.settings.guild = "broken"
  relog(wow)
  eq(JunkButlerDB.settings.guild, false)
  JunkButlerDB.settings.guild = true
  relog(wow)
  eq(JunkButlerDB.settings.guild, true, "a saved choice is kept")
  w.repairCost = 500
  w.visit()
  w.run()
  eq(w.repairs[1].guild, true)
end)

test("a guild command before login does nothing", function(wow)
  world(wow)
  wow.load(ADDON_DIR, ADDON_NAME)
  wow.slash("/jb guild on")
  eq(#wow.chat, 0)
  eq(JunkButlerDB, nil)
end)

-- 1.3: sale log -----------------------------------------------------------------------------------

local function sale(id, count, earned, link) return { id = id, count = count, earned = earned, link = link } end

test("core: sold stacks of one item are added up, the log keeps the newest 20 visits", function(wow)
  local ns = boot(wow)
  local items = {}
  ns.AddSale(items, 7, nil, 2, 20)
  ns.AddSale(items, 8, TORN, 1, 5)
  ns.AddSale(items, 7, FANG, 3, 30)
  eq(#items, 2)
  eq(items[1].count, 5)
  eq(items[1].earned, 50)
  eq(items[1].link, FANG, "a link learned later is kept")
  eq(items[2].link, TORN)
  ns.AddSale(items, 9, nil, 1, 2, "Cracked Bone")
  eq(items[3].name, "Cracked Bone", "no link: the name is kept")
  ns.AddSale(items, 9, FANG, 1, 2, "Cracked Bone")
  eq(items[3].link, FANG)
  eq(items[3].name, nil, "a link makes the name unneeded")
  eq(items[3].count, 2)
  local log = {}
  for i = 1, 23 do ns.AddVisit(log, { count = i, earned = i, items = {} }) end
  eq(#log, 20)
  eq(log[1].count, 23, "newest first")
  eq(log[20].count, 4, "the oldest fell off")
  eq(ns.LOG_KEEP, 20)
  local count, earned = ns.LogTotals({ { count = 3, earned = 100 }, { count = 2, earned = 5 } })
  eq(count, 5)
  eq(earned, 105)
  eq(ns.LogTotals({}), 0)
end)

test("core: recent sales and the lines of /jb log", function(wow)
  local ns = boot(wow)
  local now = wow.now
  eq(ns.RecentMinutes(now, now), 0)
  eq(ns.RecentMinutes(now - 59, now), 0)
  eq(ns.RecentMinutes(now - 8 * 60 - 30, now), 8)
  eq(ns.RecentMinutes(now - 15 * 60 + 1, now), 14)
  eq(ns.RecentMinutes(now - 15 * 60, now), nil, "15 minutes is no longer recent")
  eq(ns.RecentMinutes(now + 60, now), nil, "a clock that went back")
  eq(ns.RecentMinutes(nil, now), nil)
  eq(ns.RecentMinutes(now, nil), nil)
  local v = { at = now - 8 * 60, vendor = "Grumbold", count = 12, earned = 12000, items = {} }
  eq(ns.VisitLine(2, v, now), "2. Nov 20 17:52, Grumbold: 12 items for 1g 20s 00c (8 min ago)")
  v.at, v.vendor, v.count = now - 3600, nil, 1
  eq(ns.VisitLine(1, v, now), "1. Nov 20 17:00: 1 item for 1g 20s 00c")
  v.at = now - 10
  eq(ns.VisitLine(1, v, now), "1. Nov 20 17:59: 1 item for 1g 20s 00c (less than a minute ago)")
  v.at = nil
  eq(ns.VisitLine(3, v, now), "3. ?: 1 item for 1g 20s 00c", "a visit without a time")
  eq(ns.SaleLine(sale(2211, 5, 50, TORN)), TORN .. " x5: 50c")
  eq(ns.SaleLine(sale(777, 1, 3)), "item 777 x1: 3c")
  eq(ns.AnyRecent({ { at = now - 3600 }, { at = now - 60 } }, now), true)
  eq(ns.AnyRecent({ { at = now - 3600 } }, now), false)
  eq(ns.AnyRecent({}, now), false)
end)

test("core: saved logs are cleaned", function(wow)
  local ns = boot(wow)
  local long = {}
  for i = 1, 25 do long[i] = { at = i, count = 1, earned = 1, items = {} } end
  local logs = ns.CleanLogs({
    ["Yubi-Silvermoon"] = {
      { at = 5, vendor = "Grumbold", count = 3, earned = 30, items = { sale(1, 3, 30, TORN), { id = "x", count = 1, earned = 1 }, "junk" } },
      { count = -1, earned = 5 }, -- broken
      "broken",
      { at = "soon", vendor = 7, count = 1, earned = 2 }, -- no items, odd time and vendor
    },
    ["Brakk-Silvermoon"] = long,
    [42] = {},
    ["Odd-Realm"] = "broken",
  })
  local yubi = logs["Yubi-Silvermoon"]
  eq(#yubi, 2)
  eq(yubi[1].vendor, "Grumbold")
  eq(#yubi[1].items, 1)
  eq(yubi[1].items[1].link, TORN)
  eq(yubi[2].at, nil)
  eq(yubi[2].vendor, nil)
  eq(#yubi[2].items, 0)
  eq(#logs["Brakk-Silvermoon"], 20)
  eq(logs["Brakk-Silvermoon"][1].at, 1, "the order is kept")
  eq(logs[42], nil)
  eq(logs["Odd-Realm"], nil)
  eq(next(ns.CleanLogs(nil)), nil)
end)

test("a vendor visit that sells goes into the log, with vendor, time and items", function(wow)
  local w = world(wow, { [0] = { [1] = grey(2211, 10), [2] = grey(300, 5, 4), [3] = grey(2211, 10, 2), [4] = { id = 9, quality = 2, price = 500 } } })
  boot(wow, 0)
  w.visit()
  w.run()
  w.leave()
  local log = JunkButlerDB.log["Yubi-Silvermoon"]
  eq(#log, 1)
  local v = log[1]
  eq(v.at, wow.now)
  eq(v.vendor, "Grumbold")
  eq(v.count, 7)
  eq(v.earned, 50)
  eq(#v.items, 2, "both stacks of 2211 are one line")
  eq(v.items[1].id, 2211)
  eq(v.items[1].count, 3)
  eq(v.items[1].earned, 30)
  eq(v.items[1].link, w.link(2211))
  eq(v.items[2].id, 300)
  eq(v.items[2].earned, 20)

  w.repairCost = 500 -- a visit that only repairs is not a sale
  wow.money = 1000
  w.visit()
  w.run()
  w.leave()
  w.bags[0][5] = grey(301, 10)
  w.shift = true -- a skipped visit neither
  w.visit()
  w.run()
  w.leave()
  eq(#JunkButlerDB.log["Yubi-Silvermoon"], 1)
end)

test("the log is kept per character", function(wow)
  local w = world(wow, { [0] = greys(2, 10) })
  boot(wow, 0)
  w.visit()
  w.run()
  w.leave()
  wow.player = "Brakk"
  relog(wow)
  wow.slash("/jb log")
  eq(wow.chat[#wow.chat], PREFIX .. "No sales logged yet on this character. Every vendor visit that sells something is noted here.")
  w.bags[0] = greys(3, 10)
  w.visit()
  w.run()
  w.leave()
  eq(#JunkButlerDB.log["Yubi-Silvermoon"], 1)
  eq(JunkButlerDB.log["Yubi-Silvermoon"][1].count, 2)
  eq(#JunkButlerDB.log["Brakk-Silvermoon"], 1)
  eq(JunkButlerDB.log["Brakk-Silvermoon"][1].count, 3)
  wow.slash("/jb log clear")
  eq(#JunkButlerDB.log["Brakk-Silvermoon"], 0)
  eq(#JunkButlerDB.log["Yubi-Silvermoon"], 1, "clearing only touches this character")
end)

test("/jb log lists the visits newest first with totals and marks recent ones", function(wow)
  local w = world(wow, { [0] = greys(2, 10) })
  boot(wow, 0)
  wow.now = wow.now - 3600 -- an hour ago
  w.visit()
  w.run()
  w.leave()
  wow.now = wow.now + 3600 - 5 * 60 -- five minutes ago
  w.vendor = "Tilda"
  w.bags[0] = { [1] = grey(400, 125, 4) }
  w.visit()
  w.run()
  w.leave()
  wow.now = wow.now + 5 * 60
  wow.chat = {}
  wow.slash("/jb log")
  eq(#wow.chat, 5)
  eq(wow.chat[1], PREFIX .. "Your last 2 vendor visits with sales, newest first:")
  eq(wow.chat[2], "  1. Nov 20 17:55, Tilda: 4 items for 5s 00c (5 min ago)")
  eq(wow.chat[3], "  2. Nov 20 17:00, Grumbold: 2 items for 20c")
  eq(wow.chat[4], PREFIX .. "Together: 6 items for 5s 20c. /jb log followed by a number shows the items of that visit.")
  eq(wow.chat[5], PREFIX .. "Sales from the last 15 minutes are marked. The vendor's Buyback tab may still have them, but it keeps only your latest sold items and empties when you log out.")

  wow.now = wow.now + 20 * 60 -- nothing recent any more: no mark, no word about the Buyback tab
  wow.chat = {}
  wow.slash("/jb LOG")
  eq(#wow.chat, 4)
  eq(wow.chat[2], "  1. Nov 20 17:55, Tilda: 4 items for 5s 00c")
  for _, line in ipairs(wow.chat) do
    eq(line:find("Buyback", 1, true), nil)
  end
end)

test("/jb log <n> shows the items of one visit, /jb log clear empties the log", function(wow)
  local w = world(wow, { [0] = { [1] = grey(2211, 10, 5), [2] = { id = 777, quality = 0, price = 3, noLink = true }, [3] = { id = 778, quality = 0, price = 1, noLink = true } } })
  -- 777 comes without a link but with its name, 778 without either: named by its ID.
  C_Item.GetItemInfo = function(item)
    local id = type(item) == "number" and item or tonumber(tostring(item):match("item:(%d+)") or "")
    if id == 2211 then return "Torn Wristband", TORN, 0, 1, 1, "Junk", "Junk", 20, "", 134400, 10 end
    if id == 777 then return "Late Loader", nil, 0, 1, 1, "Junk", "Junk", 20, "", 134400, 3 end
    if id == 778 then return nil, nil, 0, 1, 1, "Junk", "Junk", 20, "", 134400, 1 end
  end
  boot(wow, 0)
  w.visit()
  w.run()
  w.leave()
  wow.chat = {}
  wow.slash("/jb log 1")
  eq(#wow.chat, 4)
  eq(wow.chat[1], PREFIX .. "1. Nov 20 18:00, Grumbold: 7 items for 54c (less than a minute ago)")
  eq(wow.chat[2], "  " .. w.link(2211) .. " x5: 50c", "the link from the bag")
  eq(wow.chat[3], "  Late Loader x1: 3c", "no link: the name")
  eq(wow.chat[4], "  item 778 x1: 1c", "neither: the item ID")
  wow.slash("/jb log 2")
  eq(wow.chat[5], PREFIX .. "There is no visit 2. /jb log lists visits 1 to 1.")
  wow.slash("/jb log soon")
  eq(wow.chat[6], PREFIX .. "/jb log lists your last vendor visits, /jb log followed by a number shows what was sold in that visit, /jb log clear empties the log of this character.")
  wow.slash("/jb log 0")
  eq(wow.chat[7], wow.chat[6])
  wow.slash("/jb log Clear")
  eq(wow.chat[8], PREFIX .. "The sale log of this character is empty now.")
  eq(#JunkButlerDB.log["Yubi-Silvermoon"], 0)
  wow.slash("/jb log 1")
  eq(wow.chat[9], PREFIX .. "No sales logged yet on this character. Every vendor visit that sells something is noted here.")
  for _, line in ipairs(wow.chat) do
    local text = line:sub(1, #PREFIX) == PREFIX and line:sub(#PREFIX + 1) or line
    eq((text:gsub("|c%x+|H.-|h|r", "")):find("|", 1, true), nil, "no | in the text apart from item links")
  end
end)

test("a visit cut short by closing the vendor logs what was sold", function(wow)
  local w = world(wow, { [0] = greys(14, 10) })
  boot(wow, 0)
  w.visit()
  w.leave()
  w.run()
  local log = JunkButlerDB.log["Yubi-Silvermoon"]
  eq(#log, 1)
  eq(log[1].count, 6)
  eq(#log[1].items, 6)
end)

test("the log keeps the last 20 visits across logins", function(wow)
  local w = world(wow)
  boot(wow, 0)
  for i = 1, 22 do
    w.bags[0] = { [1] = grey(1000 + i, i) }
    w.visit()
    w.run()
    w.leave()
    if i == 10 then relog(wow) end
  end
  local log = JunkButlerDB.log["Yubi-Silvermoon"]
  eq(#log, 20)
  eq(log[1].items[1].id, 1022)
  eq(log[20].items[1].id, 1003)
end)

test("a secret vendor name, a secret link or no clock still log the sale", function(wow)
  local w = world(wow, { [0] = greys(2, 10) })
  local secret = { secret = true }
  w.vendor = secret
  local container = C_Container.GetContainerItemInfo
  C_Container.GetContainerItemInfo = function(bag, slot)
    local info = container(bag, slot)
    if info then info.hyperlink = secret end
    return info
  end
  boot(wow, 0)
  time = function() return secret end
  w.visit()
  w.run()
  w.leave()
  local v = JunkButlerDB.log["Yubi-Silvermoon"][1]
  eq(v.vendor, nil)
  eq(v.at, nil)
  eq(v.count, 2)
  eq(v.items[1].link, w.link(101), "the link the game knows by ID")
  wow.chat = {}
  wow.slash("/jb log")
  eq(wow.chat[2], "  1. ?: 2 items for 20c")
  time = nil
  UnitName = nil
  w.visit()
  w.run()
  w.leave()
  wow.slash("/jb log")
  eq(#JunkButlerDB.log["Yubi-Silvermoon"], 1, "nothing left to sell")
end)

test("1.2 data moves over: settings, keep list and guild choice stay, the log starts empty", function(wow)
  local w = world(wow, { [0] = greys(2, 10) })
  JunkButlerDB = { version = 3, settings = { sell = true, repair = false, guild = true }, keep = { [2211] = TORN, [101] = true } }
  boot(wow, 0)
  eq(JunkButlerDB.version, 4)
  eq(JunkButlerDB.settings.repair, false)
  eq(JunkButlerDB.settings.guild, true)
  eq(JunkButlerDB.keep[2211], TORN)
  eq(type(JunkButlerDB.log), "table")
  eq(#JunkButlerDB.log["Yubi-Silvermoon"], 0)
  w.visit()
  w.run()
  w.leave()
  eq(table.concat(w.sold, " "), "0:2", "the kept item stays")
  eq(#JunkButlerDB.log["Yubi-Silvermoon"], 1)
  JunkButlerDB.log = "broken"
  relog(wow)
  eq(#JunkButlerDB.log["Yubi-Silvermoon"], 0)
end)

test("a log command before login does nothing", function(wow)
  world(wow)
  wow.load(ADDON_DIR, ADDON_NAME)
  wow.slash("/jb log")
  wow.slash("/jb log 1")
  wow.slash("/jb log clear")
  eq(#wow.chat, 0)
  eq(JunkButlerDB, nil)
end)

-- 1.4: German

-- Every placeholder of a text, in order: "%d", "%s", "%%".
local function placeholders(text)
  local out = {}
  for p in text:gmatch("%%[%d%.]*[%a%%]") do out[#out + 1] = p end
  return table.concat(out, " ")
end

test("German client: sale, repair, keep list, settings and help in German", function(wow)
  wow.locale = "deDE"
  local w = world(wow, { [0] = { [1] = grey(2211, 10), [2] = grey(2212, 7, 3), [3] = grey(300, 5) } })
  w.repairCost = 20000
  boot(wow, 100000)
  wow.slash("/jb keep " .. TORN)
  eq(wow.chat[1], PREFIX .. TORN .. " steht auf deiner Behalteliste und wird nie verkauft.")
  wow.chat = {}
  w.visit()
  w.run()
  w.leave()
  eq(#wow.chat, 1)
  eq(wow.chat[1], PREFIX .. "4 Stück Plunder für 26c verkauft. Ausrüstung für 2g 00s 00c repariert. Wegen deiner Behalteliste 1 Gegenstand behalten.")
  wow.slash("/jb")
  eq(wow.chat[2], PREFIX .. "Plunder verkaufen ist an. Reparieren ist an. Reparieren aus der Gildenbank ist aus.")
  wow.slash("/jb sell")
  eq(wow.chat[3], PREFIX .. "Plunder verkaufen ist aus.")
  wow.slash("/jb unkeep 999")
  eq(wow.chat[4], PREFIX .. "Gegenstand 999 steht nicht auf deiner Behalteliste.")
  wow.slash("/jb keep")
  eq(wow.chat[5], PREFIX .. "Wird nie verkauft (1):")
  eq(wow.chat[6], "  " .. TORN)
  wow.slash("/jb unkeep")
  eq(wow.chat[7], PREFIX .. "Nenne den Gegenstand nach /jb unkeep: per Shift-Klick in den Chat oder mit seiner Gegenstands-ID.")
  wow.slash("/jb hilfe")
  eq(#wow.chat, 11)
  eq(wow.chat[8], PREFIX .. "/jb zeigt die Einstellungen, /jb sell und /jb repair schalten das Verkaufen und das Reparieren einzeln an oder aus. Halte Shift gedrückt, während du einen Händler ansprichst, um diesen Besuch auszulassen.")
  eq(wow.chat[10], PREFIX .. "/jb guild on/off lässt zuerst die Gildenbank deine Reparaturen bezahlen, wenn dein Gildenrang es erlaubt.")
end)

test("German client: guild bank repairs in German", function(wow)
  wow.locale = "deDE"
  local w = world(wow, { [0] = greys(2, 10) })
  guildBank(w, 30000, 1000000)
  w.repairCost = 20000
  guildBoot(wow, w, 50000)
  w.visit()
  w.run()
  eq(wow.chat[1], PREFIX .. "2 Stück Plunder für 20c verkauft. Ausrüstung für 2g 00s 00c aus der Gildenbank repariert.")
  wow.slash("/jb guild off")
  eq(wow.chat[2], PREFIX .. "Reparieren aus der Gildenbank ist aus.")
  wow.slash("/jb guild maybe")
  eq(wow.chat[3]:match("^.-/jb guild on lässt zuerst die Gildenbank deine Reparaturen bezahlen") ~= nil, true)
end)

test("German client: /jb log in German, the Buyback tab named the way the game names it", function(wow)
  wow.locale = "deDE"
  BUYBACK = "Rückkauf" -- the German client's own name of the tab
  local w = world(wow, { [0] = greys(2, 10) })
  boot(wow, 0)
  wow.now = wow.now - 3600
  w.visit()
  w.run()
  w.leave()
  wow.now = wow.now + 3600 - 5 * 60
  w.vendor = "Tilda"
  w.bags[0] = { [1] = grey(400, 125, 4) }
  w.visit()
  w.run()
  w.leave()
  wow.now = wow.now + 5 * 60
  wow.chat = {}
  wow.slash("/jb log")
  eq(#wow.chat, 5)
  eq(wow.chat[1], PREFIX .. "Deine letzten 2 Händlerbesuche mit Verkäufen, neueste zuerst:")
  eq(wow.chat[2], "  1. 20.11. 17:55, Tilda: 4 Gegenstände für 5s 00c (vor 5 Min.)")
  eq(wow.chat[3], "  2. 20.11. 17:00, Grumbold: 2 Gegenstände für 20c")
  eq(wow.chat[4], PREFIX .. "Zusammen: 6 Gegenstände für 5s 20c. /jb log mit einer Nummer zeigt die Gegenstände dieses Besuchs.")
  eq(wow.chat[5], PREFIX .. "Verkäufe der letzten 15 Minuten sind markiert. Der Reiter „Rückkauf“ des Händlers hat sie vielleicht noch, er behält aber nur deine zuletzt verkauften Gegenstände und wird beim Ausloggen geleert.")
  wow.slash("/jb log 7")
  eq(wow.chat[6], PREFIX .. "Es gibt keinen Besuch 7. /jb log zeigt die Besuche 1 bis 2.")
  wow.slash("/jb log clear")
  eq(wow.chat[7], PREFIX .. "Das Verkaufsprotokoll dieses Charakters ist jetzt leer.")
  wow.slash("/jb log")
  eq(wow.chat[8], PREFIX .. "Mit diesem Charakter wurde noch nichts verkauft. Jeder Händlerbesuch mit Verkäufen wird hier notiert.")
end)

test("an English client names the Buyback tab the way the game names it too", function(wow)
  BUYBACK = "Buyback"
  local w = world(wow, { [0] = greys(1, 10) })
  boot(wow, 0)
  w.visit()
  w.run()
  w.leave()
  wow.chat = {}
  wow.slash("/jb log")
  eq(wow.chat[#wow.chat], PREFIX .. "Sales from the last 15 minutes are marked. The vendor's Buyback tab may still have them, but it keeps only your latest sold items and empties when you log out.")
end)

test("German texts keep every placeholder of the English text, in order", function(wow)
  wow.locale = "deDE"
  world(wow)
  local ns = boot(wow, 0)
  local n = 0
  for key, text in pairs(ns.L) do
    n = n + 1
    if not key:find("%H", 1, true) then eq(placeholders(text), placeholders(key), key) end
  end
  eq(n, 37, "every text on screen has its German one")
  eq(ns.L["%b %d %H:%M"], "%d.%m. %H:%M", "dates the German way")
end)

test("an English client keeps the English texts", function(wow)
  wow.locale = "enUS"
  world(wow)
  local ns = boot(wow, 0)
  eq(next(ns.L), nil)
  eq(ns.Summary({ items = 1, earned = 5 }), "Sold 1 junk item for 5c.")
end)
