-- Tests for Durability Watch, run by tools/wow/client/run.lua.

-- The parts of the game the stand-in client lacks: equipped gear, a vendor and the error frame.
-- items[slot] = { cur, max, link }; a slot without an entry has no durability.
local STAND_IN = { "GetInventoryItemDurability", "GetInventoryItemLink", "CanMerchantRepair", "GetRepairAllCost", "RepairAllItems", "UIErrorsFrame" }

local function world(items)
  local w = { items = items or {}, read = {}, canRepair = true, repairCost = 0, errors = {}, repairs = 0 }
  GetInventoryItemDurability = function(slot)
    w.read[slot] = true
    local it = w.items[slot]
    if not it then return nil, nil end
    return it[1], it[2]
  end
  GetInventoryItemLink = function(unit, slot)
    local it = unit == "player" and w.items[slot]
    return it and it[3] or nil
  end
  CanMerchantRepair = function() return w.canRepair end
  GetRepairAllCost = function() return w.repairCost, w.repairCost > 0 end
  RepairAllItems = function() w.repairs = w.repairs + 1 end
  UIErrorsFrame = { AddMessage = function(_, msg, r, g, b) w.errors[#w.errors + 1] = msg end }
  return w
end

local function boot(wow, items)
  local w = world(items)
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("ADDON_LOADED", "DurabilityWatch")
  wow.fire("PLAYER_LOGIN")
  return ns, w
end

-- Changes one item and tells the addon, the way the game does.
local function wear(wow, w, slot, cur, max)
  local it = w.items[slot] or {}
  w.items[slot] = { cur, max or it[2], it[3] }
  wow.fire("UPDATE_INVENTORY_DURABILITY")
end

local function lines() return DurabilityWatchFrame.gear:GetText(), DurabilityWatchFrame.lowest:GetText() end

local PREFIX = "|cffffd100Durability Watch:|r "
local GREEN, YELLOW, RED, GREY = "|cff40ff40", "|cffffff00", "|cffff4040", "|cff9d9d9d"

-- A full set: 87 % overall, the main hand lowest at 40 %.
local function set()
  return {
    [1] = { 100, 100, "[Helm]" }, [3] = { 80, 80 }, [5] = { 165, 165 }, [6] = { 50, 50 },
    [7] = { 120, 120 }, [8] = { 70, 70 }, [9] = { 40, 40 }, [10] = { 40, 40 },
    [16] = { 40, 100, "[Blade]" }, [17] = { 50, 100 },
  }
end

test("addon defines only its own globals", function(wow, installed, before)
  local ns, w = boot(wow, set())
  wear(wow, w, 16, 10)
  w.repairCost = 500
  wow.fire("MERCHANT_SHOW")
  wow.fire("PLAYER_EQUIPMENT_CHANGED", 16, true)
  DurabilityWatchFrame.scripts.OnEnter(DurabilityWatchFrame)
  wow.slash("/dw")
  wow.slash("/dw warn 30")
  wow.slash("/dw lock")
  wow.slash("/dw hide")
  wow.slash("/durabilitywatch show")
  local allowed = { DurabilityWatchDB = true, DurabilityWatchFrame = true, SLASH_DURABILITYWATCH1 = true, SLASH_DURABILITYWATCH2 = true }
  for _, name in ipairs(STAND_IN) do installed[name] = true end
  for k in pairs(_G) do
    if not before[k] and not installed[k] and not allowed[k] then error("unexpected global " .. tostring(k)) end
  end
end)

test("core: percent is rounded down and stays between 0 and 100", function(wow)
  local ns = boot(wow)
  eq(ns.Percent(100, 100), 100)
  eq(ns.Percent(99, 100), 99)
  eq(ns.Percent(119, 120), 99, "a worn item never shows 100")
  eq(ns.Percent(1, 3), 33)
  eq(ns.Percent(0, 80), 0)
  eq(ns.Percent(-5, 80), 0)
  eq(ns.Percent(120, 100), 100)
  eq(ns.Percent(10, 0), nil, "no maximum, no percent")
  eq(ns.Percent(nil, 100), nil)
  eq(ns.Percent(10, nil), nil)
end)

test("core: overall percent, lowest item and damaged list from plain slot data", function(wow)
  local ns = boot(wow)
  local cond = ns.Condition({
    { slot = 1, cur = 100, max = 100 },
    { slot = 5, cur = 30, max = 120 },
    { slot = 16, cur = 25, max = 100 },
    { slot = 3, cur = 70, max = 80 },
    { slot = 7, cur = 5, max = 0 },     -- no durability
    { slot = 8, cur = nil, max = 60 },  -- unreadable
  })
  eq(cond.count, 4)
  eq(cond.overall, 56, "225 of 400")
  eq(cond.lowest, 25)
  eq(cond.lowestSlot, 5, "two items at 25 %: the lower slot number wins")
  eq(#cond.damaged, 3)
  eq(cond.damaged[1].slot, 5)
  eq(cond.damaged[2].slot, 16)
  eq(cond.damaged[3].slot, 3)
  eq(cond.damaged[3].percent, 87)
  local none = ns.Condition({})
  eq(none.overall, nil)
  eq(none.lowest, nil)
  eq(#none.damaged, 0)
  eq(#ns.Condition({ { slot = 1, cur = 60, max = 60 } }).damaged, 0)
end)

test("core: colours switch at 50 % and 20 %", function(wow)
  local ns = boot(wow)
  eq(ns.ColorState(100), "green")
  eq(ns.ColorState(51), "green")
  eq(ns.ColorState(50), "yellow")
  eq(ns.ColorState(21), "yellow")
  eq(ns.ColorState(20), "red")
  eq(ns.ColorState(0), "red")
  eq(ns.ColorState(nil), nil)
  eq(ns.Colored(87), GREEN .. "87%|r")
  eq(ns.Colored(50), YELLOW .. "50%|r")
  eq(ns.Colored(3), RED .. "3%|r")
  eq(ns.Colored(nil), GREY .. "-|r")
end)

test("core: the warning fires once and re-arms only above the level", function(wow)
  local ns = boot(wow)
  local s = { armed = true }
  eq(ns.Warning(s, 60, 25), false)
  eq(ns.Warning(s, 26, 25), false)
  eq(ns.Warning(s, 25, 25), true, "at the level counts")
  eq(s.armed, false)
  eq(ns.Warning(s, 20, 25), false, "dropping further stays quiet")
  eq(ns.Warning(s, 25, 25), false, "back to the level is not a repair")
  eq(ns.Warning(s, nil, 25), false, "no gear says nothing")
  eq(s.armed, false)
  eq(ns.Warning(s, 26, 25), false, "above the level arms it again")
  eq(s.armed, true)
  eq(ns.Warning(s, 0, 25), true)
end)

test("core: warning level from the chat and the saved settings", function(wow)
  local ns = boot(wow)
  eq(ns.ParseWarn("30"), 30)
  eq(ns.ParseWarn(" 5 "), 5)
  eq(ns.ParseWarn("90%"), 90)
  eq(ns.ParseWarn("4"), nil)
  eq(ns.ParseWarn("91"), nil)
  eq(ns.ParseWarn("12.5"), nil)
  eq(ns.ParseWarn("-10"), nil)
  eq(ns.ParseWarn("thirty"), nil)
  eq(ns.ParseWarn(""), nil)
  eq(ns.ParseWarn(nil), nil)
  eq(ns.ValidWarn(25), 25)
  eq(ns.ValidWarn(25.5), nil)
  eq(ns.ValidWarn("25"), nil)
end)

test("core: money as plain text and through the game's own format", function(wow)
  local ns = boot(wow)
  eq(ns.PlainMoney(0), "0c")
  eq(ns.PlainMoney(7), "7c")
  eq(ns.PlainMoney(1507), "15s 07c")
  eq(ns.PlainMoney(123456), "12g 34s 56c")
  eq(ns.PlainMoney(12345678900), "1,234,567g 89s 00c")
  eq(ns.FormatMoney(1507), "15s 07c")
  GetMoneyString = function(copper, separate) return "M" .. copper .. tostring(separate) end
  eq(ns.FormatMoney(1507), "M1507true")
end)

test("login reads the gear, saves the defaults and shows the display", function(wow)
  local ns = boot(wow, set())
  eq(DurabilityWatchDB.version, 1)
  eq(DurabilityWatchDB.settings.warn, 25)
  eq(DurabilityWatchDB.settings.locked, false)
  eq(DurabilityWatchDB.settings.hidden, false)
  eq(ns.condition.overall, 87, "755 of 865")
  eq(ns.condition.count, 10)
  local gear, lowest = lines()
  eq(gear, "Gear " .. GREEN .. "87%|r")
  eq(lowest, "Main Hand " .. YELLOW .. "40%|r")
  eq(DurabilityWatchFrame:IsShown(), true)
  eq(DurabilityWatchFrame.point[1], "TOP")
  eq(#wow.chat, 0, "nothing to say at 40 %")
end)

test("only slots that can wear out are read: no shirt, no tabard", function(wow)
  local ns, w = boot(wow, { [4] = { 1, 100 }, [19] = { 1, 100 }, [2] = { 10, 10 } })
  eq(w.read[4], nil)
  eq(w.read[19], nil)
  eq(w.read[1], true)
  eq(w.read[18], true)
  eq(ns.condition.count, 1)
  eq(ns.condition.overall, 100)
  eq(select(2, lines()), GREY .. "No damage|r")
end)

test("without gear that has durability the display says so", function(wow)
  local ns = boot(wow, {})
  local gear, lowest = lines()
  eq(gear, "Gear " .. GREY .. "-|r")
  eq(lowest, GREY .. "Nothing to wear out|r")
  wow.slash("/dw")
  eq(wow.chat[1]:match("Nothing you wear has durability%.") ~= nil, true)
end)

test("durability and equipment events recount and recolour", function(wow)
  local ns, w = boot(wow, { [1] = { 100, 100 }, [16] = { 100, 100 } })
  eq(lines(), "Gear " .. GREEN .. "100%|r")
  wear(wow, w, 16, 45)
  eq(lines(), "Gear " .. GREEN .. "72%|r")
  eq(select(2, lines()), "Main Hand " .. YELLOW .. "45%|r")
  wear(wow, w, 1, 30)
  eq(lines(), "Gear " .. YELLOW .. "37%|r")
  w.items[16] = { 100, 100 } -- a new weapon equipped
  wow.fire("PLAYER_EQUIPMENT_CHANGED", 16, true)
  eq(lines(), "Gear " .. GREEN .. "65%|r")
  eq(select(2, lines()), "Head " .. YELLOW .. "30%|r")
  w.items[1] = nil -- the helm taken off
  wow.fire("PLAYER_EQUIPMENT_CHANGED", 1, false)
  eq(ns.condition.count, 1)
  eq(select(2, lines()), GREY .. "No damage|r")
end)

test("the warning: one centred message and one chat line, again only after a repair", function(wow)
  local ns, w = boot(wow, set())
  wear(wow, w, 16, 26)
  eq(#w.errors, 0)
  wear(wow, w, 16, 25)
  eq(#w.errors, 1)
  eq(w.errors[1], "Main Hand is at 25% durability")
  eq(#wow.chat, 1)
  eq(wow.chat[1], PREFIX .. "Main Hand: [Blade] is at 25% durability. Time to repair.")
  wear(wow, w, 16, 3)
  wear(wow, w, 17, 1)
  wow.fire("PLAYER_EQUIPMENT_CHANGED", 13, true)
  eq(#w.errors, 1, "no repeat while it stays low")
  eq(#wow.chat, 1)
  eq(select(2, lines()), "Off Hand " .. RED .. "1%|r")
  -- repaired at a vendor: everything is full again
  w.items[16] = { 100, 100, "[Blade]" }
  w.items[17] = { 100, 100 }
  wow.fire("UPDATE_INVENTORY_DURABILITY")
  eq(ns.warning.armed, true)
  wear(wow, w, 17, 20)
  eq(#w.errors, 2)
  eq(w.errors[2], "Off Hand is at 20% durability")
  eq(wow.chat[2], PREFIX .. "Off Hand is at 20% durability. Time to repair.", "no link, slot name only")
end)

test("gear that is already low at login warns once", function(wow)
  local items = set()
  items[8] = { 7, 70 }
  local ns, w = boot(wow, items)
  eq(#w.errors, 1)
  eq(w.errors[1], "Feet is at 10% durability")
  wow.fire("UPDATE_INVENTORY_DURABILITY")
  eq(#w.errors, 1)
end)

test("secret values are skipped", function(wow)
  local items = set()
  items[16] = { { secret = true }, 100, "[Blade]" }
  items[17] = { 5, { secret = true } }
  local ns, w = boot(wow, items)
  eq(ns.condition.count, 8)
  eq(ns.condition.overall, 100)
  eq(#w.errors, 0)
  w.items[16] = { 10, 100, { secret = true } }
  wow.fire("UPDATE_INVENTORY_DURABILITY")
  eq(ns.condition.lowest, 10)
  eq(wow.chat[1], PREFIX .. "Main Hand is at 10% durability. Time to repair.", "a secret link is left out")
  w.canRepair = { secret = true }
  w.repairCost = 900
  wow.fire("MERCHANT_SHOW")
  eq(#wow.chat, 1)
end)

test("at a vendor the repair cost is told in one line, nothing is repaired", function(wow)
  local ns, w = boot(wow, set())
  w.repairCost = 123456
  wow.fire("MERCHANT_SHOW")
  eq(#wow.chat, 1)
  eq(wow.chat[1], PREFIX .. "Repairing all your gear here costs 12g 34s 56c.")
  eq(w.repairs, 0)
  w.canRepair = false
  wow.fire("MERCHANT_SHOW")
  eq(#wow.chat, 1, "this vendor cannot repair")
  w.canRepair = true
  w.repairCost = 0
  wow.fire("MERCHANT_SHOW")
  eq(#wow.chat, 1, "nothing to pay")
end)

test("at a vendor nothing is said when no item is damaged", function(wow)
  local ns, w = boot(wow, { [1] = { 100, 100 } })
  w.repairCost = 50 -- a damaged item in the bags only
  wow.fire("MERCHANT_SHOW")
  eq(#wow.chat, 0)
  CanMerchantRepair = nil
  wear(wow, w, 1, 50)
  wow.fire("MERCHANT_SHOW")
  eq(#wow.chat, 0, "a client without the repair functions")
end)

test("the tooltip lists every damaged item with its slot, lowest first", function(wow)
  local ns, w = boot(wow, set())
  wear(wow, w, 3, 60)
  local f = DurabilityWatchFrame
  f.scripts.OnEnter(f)
  local tip = wow.tooltip
  eq(tip.owner, f)
  eq(tip.shown, true)
  eq(tip.lines[1], "Durability Watch")
  eq(tip.lines[2], "Main Hand: [Blade] = " .. YELLOW .. "40%|r")
  eq(tip.lines[3], "Off Hand = " .. YELLOW .. "50%|r")
  eq(tip.lines[4], "Shoulders = " .. GREEN .. "75%|r")
  eq(tip.lines[5], "Warning at 25%.")
  eq(tip.lines[6], "Drag to move. /dw lock locks it.")
  eq(#tip.lines, 6)
  f.scripts.OnLeave(f)
  eq(tip.shown, false)
end)

test("the tooltip says when nothing is damaged", function(wow)
  local ns = boot(wow, { [1] = { 100, 100 } })
  wow.slash("/dw lock")
  local f = DurabilityWatchFrame
  f.scripts.OnEnter(f)
  eq(wow.tooltip.lines[2], "Nothing is damaged.")
  eq(wow.tooltip.lines[4], "Locked. /dw lock unlocks it.")
end)

test("/dw and /durabilitywatch print the state and the commands", function(wow)
  local ns = boot(wow, set())
  wow.slash("/dw")
  eq(#wow.chat, 2)
  eq(wow.chat[1], PREFIX .. "Gear 87%, lowest Main Hand 40%. Warning at 25%. The display can be dragged.")
  eq(wow.chat[2]:match("/dw warn <percent> sets the warning level") ~= nil, true)
  wow.slash("/durabilitywatch help")
  eq(#wow.chat, 4)
  wow.slash("/dw lock")
  wow.slash("/dw")
  eq(wow.chat[6], PREFIX .. "Gear 87%, lowest Main Hand 40%. Warning at 25%. The display is locked.")
  wow.slash("/dw hide")
  wow.slash("/dw")
  eq(wow.chat[9]:match("The display is hidden%.$") ~= nil, true)
end)

test("/dw warn sets the level, checks it and saves it", function(wow)
  local ns, w = boot(wow, set())
  wow.slash("/dw warn 3")
  eq(wow.chat[1], PREFIX .. "Use a whole number from 5 to 90, for example /dw warn 30.")
  wow.slash("/dw warn")
  eq(#wow.chat, 2)
  eq(DurabilityWatchDB.settings.warn, 25)
  wow.slash("/dw WARN 45")
  eq(DurabilityWatchDB.settings.warn, 45)
  eq(wow.chat[3], PREFIX .. "Warning at 45%.")
  eq(#w.errors, 1, "the main hand at 40 % is now below the new level")
  eq(wow.chat[4], PREFIX .. "Main Hand: [Blade] is at 40% durability. Time to repair.")
  wow.slash("/dw warn 30")
  eq(ns.warning.armed, true, "40 % is above the new level")
  eq(#w.errors, 1)
end)

test("the display can be dragged, locked and comes back where it was left", function(wow)
  DurabilityWatchDB = { settings = { point = { "TOPLEFT", "TOPLEFT", 40, -200 } } }
  local ns = boot(wow, set())
  local f = DurabilityWatchFrame
  eq(f.point[1], "TOPLEFT")
  eq(f.point[2], UIParent)
  eq(f.point[4], 40)
  eq(f.point[5], -200)
  f.scripts.OnDragStart(f)
  f:SetPoint("BOTTOMRIGHT", UIParent, "BOTTOMRIGHT", -12, 34) -- dragged
  f.scripts.OnDragStop(f)
  local p = DurabilityWatchDB.settings.point
  eq(p[1], "BOTTOMRIGHT")
  eq(p[3], -12)
  eq(p[4], 34)
  wow.slash("/dw lock")
  eq(wow.chat[1], PREFIX .. "The display is locked.")
  eq(DurabilityWatchDB.settings.locked, true)
  f.scripts.OnDragStart(f)
  f:SetPoint("CENTER", UIParent, "CENTER", 0, 0)
  f.scripts.OnDragStop(f)
  eq(DurabilityWatchDB.settings.point[1], "BOTTOMRIGHT", "a locked display does not move")
  wow.slash("/dw lock")
  eq(wow.chat[2], PREFIX .. "The display can be dragged.")
  eq(DurabilityWatchDB.settings.locked, false)
end)

test("/dw hide and /dw show, kept for the next login", function(wow)
  local ns, w = boot(wow, set())
  local f = DurabilityWatchFrame
  wow.slash("/dw hide")
  eq(f:IsShown(), false)
  eq(DurabilityWatchDB.settings.hidden, true)
  eq(wow.chat[1], PREFIX .. "The display is hidden. /dw show brings it back.")
  wear(wow, w, 16, 10)
  eq(f:IsShown(), false, "a recount does not bring it back")
  eq(#w.errors, 1, "the warning still works while hidden")
  wow.slash("/dw show")
  eq(f:IsShown(), true)
  eq(DurabilityWatchDB.settings.hidden, false)
  eq(wow.chat[3], PREFIX .. "The display is shown.")
end)

test("saved settings are checked at login", function(wow)
  DurabilityWatchDB = { settings = { warn = 95, locked = "yes", hidden = true } }
  local ns = boot(wow, set())
  eq(DurabilityWatchDB.settings.warn, 25)
  eq(DurabilityWatchDB.settings.locked, false)
  eq(DurabilityWatchDB.settings.hidden, true)
  eq(DurabilityWatchFrame:IsShown(), false)
end)

test("saved settings of an older file that is not a table are replaced", function(wow)
  DurabilityWatchDB = "broken"
  local ns = boot(wow, set())
  eq(type(DurabilityWatchDB), "table")
  eq(DurabilityWatchDB.settings.warn, 25)
end)

test("nothing happens before login", function(wow)
  local w = world(set())
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  w.items[16] = { 1, 100 }
  w.repairCost = 500
  wow.fire("UPDATE_INVENTORY_DURABILITY")
  wow.fire("PLAYER_EQUIPMENT_CHANGED", 16, true)
  wow.fire("MERCHANT_SHOW")
  wow.slash("/dw")
  wow.slash("/dw warn 40")
  eq(DurabilityWatchFrame, nil)
  eq(DurabilityWatchDB, nil)
  eq(#wow.chat, 0)
  eq(#w.errors, 0)
end)
