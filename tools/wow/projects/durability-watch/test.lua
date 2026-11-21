-- Tests for Durability Watch, run by tools/wow/client/run.lua.

-- The parts of the game the stand-in client lacks: equipped gear, a vendor, the error frame and instances.
-- items[slot] = { cur, max, link }; a slot without an entry has no durability.
-- instance = { kind, name, id } of the instance the player is in, nil outside.
local STAND_IN = { "GetInventoryItemDurability", "GetInventoryItemLink", "CanMerchantRepair", "GetRepairAllCost", "RepairAllItems", "UIErrorsFrame", "IsInInstance", "GetInstanceInfo" }

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
  IsInInstance = function()
    if w.instance then return true, w.instance.kind end
    return false, "none"
  end
  GetInstanceInfo = function()
    local i = w.instance
    if not i then return "Isle of Dorn", "none", 0, "", 0, 0, false, 2552 end
    return i.name, i.kind, 1, "Normal", 5, 0, false, i.id
  end
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

-- A loading screen into (or out of) an instance, the way the game reports it.
local function enter(wow, w, instance, reloading)
  w.instance = instance
  wow.fire("PLAYER_ENTERING_WORLD", false, reloading == true)
end

local STONEVAULT = { kind = "party", name = "The Stonevault", id = 2652 }
local NERUBAR = { kind = "raid", name = "Nerub-ar Palace", id = 2657 }

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
  RepairAllItems(true)
  wow.fire("MERCHANT_CLOSED")
  wow.fire("PLAYER_EQUIPMENT_CHANGED", 16, true)
  DurabilityWatchFrame.scripts.OnEnter(DurabilityWatchFrame)
  wow.slash("/dw history")
  wow.slash("/dw history clear")
  wow.slash("/dw")
  wow.slash("/dw warn 30")
  wow.slash("/dw lock")
  wow.slash("/dw hide")
  wow.slash("/durabilitywatch show")
  wow.slash("/dw instance 40")
  wow.slash("/dw instance off")
  enter(wow, w, STONEVAULT)
  wow.fire("ZONE_CHANGED_NEW_AREA")
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
  eq(DurabilityWatchDB.version, 3)
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
  eq(#wow.chat, 4)
  eq(wow.chat[1], PREFIX .. "Gear 87%, lowest Main Hand 40%. Warning at 25%. Warning before dungeons and raids at 50%. The display can be dragged.")
  eq(wow.chat[2]:match("/dw warn <percent> sets the warning level") ~= nil, true)
  eq(wow.chat[3]:match("/dw instance <percent> warns you before dungeons and raids") ~= nil, true)
  eq(wow.chat[4], PREFIX .. "/dw history lists the repair costs of your last 20 vendor visits, /dw history clear empties the list.")
  wow.slash("/durabilitywatch help")
  eq(#wow.chat, 8)
  wow.slash("/dw lock")
  wow.slash("/dw")
  eq(wow.chat[10], PREFIX .. "Gear 87%, lowest Main Hand 40%. Warning at 25%. Warning before dungeons and raids at 50%. The display is locked.")
  wow.slash("/dw hide")
  wow.slash("/dw instance off")
  wow.slash("/dw")
  eq(wow.chat[16], PREFIX .. "Gear 87%, lowest Main Hand 40%. Warning at 25%. No warning before dungeons and raids. The display is hidden.")
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
  w.instance = STONEVAULT
  wow.fire("PLAYER_ENTERING_WORLD", true, false)
  wow.fire("ZONE_CHANGED_NEW_AREA")
  wow.slash("/dw")
  wow.slash("/dw warn 40")
  wow.slash("/dw instance 30")
  eq(DurabilityWatchFrame, nil)
  eq(DurabilityWatchDB, nil)
  eq(#wow.chat, 0)
  eq(#w.errors, 0)
end)

-- 1.1: the warning before dungeons and raids

test("core: the instance warning fires once per instance and only for dungeons and raids", function(wow)
  local ns = boot(wow)
  local s = {}
  local vault = { kind = "party", key = 1 }
  eq(ns.InstanceWarning(s, vault, 60, 50), false, "gear above the level")
  eq(ns.InstanceWarning(s, vault, 50, 50), true, "at the level counts")
  eq(s.warnedFor, 1)
  eq(ns.InstanceWarning(s, vault, 30, 50), false, "the run back after a wipe stays quiet")
  eq(ns.InstanceWarning(s, { kind = "raid", key = 2 }, 30, 50), true, "a different instance warns")
  eq(ns.InstanceWarning(s, { kind = "raid", key = 2 }, 30, nil), false, "switched off")
  eq(ns.InstanceWarning(s, nil, 30, 50), false, "outside an instance")
  eq(s.warnedFor, 2, "being outside alone is no repair")
  eq(ns.InstanceWarning(s, { kind = "pvp", key = 3 }, 10, 50), false, "battleground")
  eq(ns.InstanceWarning(s, { kind = "arena", key = 4 }, 10, 50), false)
  eq(ns.InstanceWarning(s, { kind = "scenario", key = 5 }, 10, 50), false, "delves and scenarios")
  eq(ns.InstanceWarning(s, { kind = "party" }, 10, 50), false, "no key, no warning")
  eq(ns.InstanceWarning(s, vault, nil, 50), false, "no gear with durability")
  ns.InstanceRearm(s, 51, 50)
  eq(s.warnedFor, nil, "above the level again")
  ns.InstanceRearm(s, 30, 50)
  eq(s.warnedFor, nil)
  eq(ns.InstanceWarning(s, { kind = "raid", key = 2 }, 30, 50), true, "after a repair the same raid warns again")
end)

test("entering a dungeon with worn gear: one centred message and one chat line", function(wow)
  local ns, w = boot(wow, set())
  enter(wow, w, STONEVAULT)
  eq(#w.errors, 1)
  eq(w.errors[1], "Repair first: Main Hand is at 40% durability")
  eq(#wow.chat, 1)
  eq(wow.chat[1], PREFIX .. "You are entering The Stonevault with Main Hand: [Blade] at 40% durability. Repair first.")
  wow.fire("ZONE_CHANGED_NEW_AREA")
  enter(wow, w, STONEVAULT)
  eq(#w.errors, 1, "a new area inside or the run back after a wipe say nothing")
  eq(#wow.chat, 1)
end)

test("entering a raid, and instances the game does not name", function(wow)
  local ns, w = boot(wow, set())
  enter(wow, w, NERUBAR)
  eq(wow.chat[1], PREFIX .. "You are entering Nerub-ar Palace with Main Hand: [Blade] at 40% durability. Repair first.")
  enter(wow, w, { kind = "party", name = "", id = 0 })
  eq(wow.chat[2], PREFIX .. "You are entering a dungeon with Main Hand: [Blade] at 40% durability. Repair first.")
  GetInstanceInfo = nil
  enter(wow, w, { kind = "raid" })
  eq(wow.chat[3], PREFIX .. "You are entering a raid with Main Hand: [Blade] at 40% durability. Repair first.")
  eq(#w.errors, 3)
end)

test("no instance warning with gear above the level, in the open world, battlegrounds or delves", function(wow)
  local items = set()
  items[16] = { 60, 100, "[Blade]" }
  items[17] = { 100, 100 }
  local ns, w = boot(wow, items)
  enter(wow, w, STONEVAULT)
  eq(#wow.chat, 0, "60 % is above 50 %")
  wear(wow, w, 16, 45)
  enter(wow, w, nil)
  enter(wow, w, { kind = "pvp", name = "Warsong Gulch", id = 489 })
  enter(wow, w, { kind = "arena", name = "Nagrand Arena", id = 1505 })
  enter(wow, w, { kind = "scenario", name = "Fungal Folly", id = 2664 })
  w.instance = nil
  wow.fire("ZONE_CHANGED_NEW_AREA")
  eq(#wow.chat, 0)
  eq(#w.errors, 0)
end)

test("after a repair the same dungeon warns again, a different one warns at once", function(wow)
  local ns, w = boot(wow, set())
  enter(wow, w, STONEVAULT)
  enter(wow, w, NERUBAR)
  eq(#wow.chat, 2, "a different instance")
  enter(wow, w, nil)
  w.items[16] = { 100, 100, "[Blade]" }
  w.items[17] = { 100, 100 }
  wow.fire("UPDATE_INVENTORY_DURABILITY")
  eq(ns.instanceState.warnedFor, nil)
  enter(wow, w, NERUBAR)
  eq(#wow.chat, 2, "repaired")
  w.items[16] = { 30, 100, "[Blade]" }
  wow.fire("UPDATE_INVENTORY_DURABILITY")
  enter(wow, w, nil)
  enter(wow, w, NERUBAR)
  eq(#wow.chat, 3, "worn again on the next visit")
  eq(wow.chat[3], PREFIX .. "You are entering Nerub-ar Palace with Main Hand: [Blade] at 30% durability. Repair first.")
end)

test("a reload inside an instance stays quiet, a login inside one warns", function(wow)
  local ns, w = boot(wow, set())
  enter(wow, w, STONEVAULT, true)
  eq(#wow.chat, 0)
  eq(ns.instanceState.warnedFor, 2652, "the reload takes note")
  enter(wow, w, STONEVAULT)
  eq(#wow.chat, 0, "and the run back after a wipe stays quiet too")
end)

test("logging in inside a raid with worn gear warns", function(wow)
  local ns, w = boot(wow, set())
  w.instance = NERUBAR
  wow.fire("PLAYER_ENTERING_WORLD", true, false) -- the first login, inside the raid
  eq(#wow.chat, 1)
  eq(wow.chat[1], PREFIX .. "You are entering Nerub-ar Palace with Main Hand: [Blade] at 40% durability. Repair first.")
end)

test("/dw instance switches the check off and on and sets its level", function(wow)
  local ns, w = boot(wow, set())
  wow.slash("/dw instance off")
  eq(DurabilityWatchDB.settings.instanceWarn, false)
  eq(wow.chat[1], PREFIX .. "No warning before dungeons and raids.")
  enter(wow, w, STONEVAULT)
  eq(#wow.chat, 1, "switched off")
  eq(#w.errors, 0)
  enter(wow, w, nil)
  wow.slash("/dw instance on")
  eq(DurabilityWatchDB.settings.instanceWarn, true)
  eq(DurabilityWatchDB.settings.instanceLevel, 50)
  eq(wow.chat[2], PREFIX .. "Warning before dungeons and raids at 50%.")
  wow.slash("/dw instance 30")
  eq(DurabilityWatchDB.settings.instanceLevel, 30)
  eq(wow.chat[3], PREFIX .. "Warning before dungeons and raids at 30%.")
  enter(wow, w, STONEVAULT)
  eq(#wow.chat, 3, "40 % is above 30 %")
  enter(wow, w, nil)
  wow.slash("/dw instance off")
  wow.slash("/dw INSTANCE 45%")
  eq(DurabilityWatchDB.settings.instanceWarn, true, "a level switches it on")
  eq(DurabilityWatchDB.settings.instanceLevel, 45)
  enter(wow, w, STONEVAULT)
  eq(wow.chat[#wow.chat]:match("^" .. PREFIX:gsub("%p", "%%%0") .. "You are entering The Stonevault") ~= nil, true)
end)

test("/dw instance with a wrong value explains itself and changes nothing", function(wow)
  local ns = boot(wow, set())
  wow.slash("/dw instance 95")
  eq(wow.chat[1], PREFIX .. "Use /dw instance on, /dw instance off or a whole number from 5 to 90, for example /dw instance 40.")
  wow.slash("/dw instance maybe")
  eq(#wow.chat, 2)
  eq(DurabilityWatchDB.settings.instanceLevel, 50)
  eq(DurabilityWatchDB.settings.instanceWarn, true)
  wow.slash("/dw instance")
  eq(wow.chat[3], PREFIX .. "Warning before dungeons and raids at 50%.", "alone it tells the state")
end)

test("saved settings of 1.0 are kept and get the instance check switched on", function(wow)
  DurabilityWatchDB = { version = 1, settings = { warn = 35, locked = true, hidden = false, point = { "LEFT", "LEFT", 10, 20 } } }
  local ns, w = boot(wow, set())
  local s = DurabilityWatchDB.settings
  eq(DurabilityWatchDB.version, 3)
  eq(s.warn, 35)
  eq(s.locked, true)
  eq(s.point[1], "LEFT")
  eq(s.instanceWarn, true)
  eq(s.instanceLevel, 50)
end)

test("saved instance settings are checked at login", function(wow)
  DurabilityWatchDB = { version = 2, settings = { instanceWarn = false, instanceLevel = 30 } }
  boot(wow, set())
  eq(DurabilityWatchDB.settings.instanceWarn, false, "switched off stays off")
  eq(DurabilityWatchDB.settings.instanceLevel, 30)
  DurabilityWatchDB = { version = 2, settings = { instanceWarn = "yes", instanceLevel = 120 } }
  boot(wow, set())
  eq(DurabilityWatchDB.settings.instanceWarn, true)
  eq(DurabilityWatchDB.settings.instanceLevel, 50)
end)

test("a client without the instance functions, or with secret answers, stays quiet", function(wow)
  local ns, w = boot(wow, set())
  local secret = { secret = true }
  IsInInstance = function() return secret, "party" end
  enter(wow, w, STONEVAULT)
  IsInInstance = function() return true, secret end
  enter(wow, w, STONEVAULT)
  eq(#wow.chat, 0)
  IsInInstance = nil
  enter(wow, w, STONEVAULT)
  eq(#wow.chat, 0)
  eq(ns.ReadPlace(), nil)
  IsInInstance = function() return true, "party" end
  GetInstanceInfo = function() return secret, "party", 1, "Normal", 5, 0, false, secret end
  local place = ns.ReadPlace()
  eq(place.kind, "party")
  eq(place.name, nil)
  eq(place.key, "party", "without a name or ID the kind tells it apart")
  enter(wow, w, STONEVAULT)
  eq(wow.chat[1], PREFIX .. "You are entering a dungeon with Main Hand: [Blade] at 40% durability. Repair first.")
end)

-- 1.2: the repair cost history

local HOUR, DAY = 3600, 86400

-- Clicking Repair All at the vendor: the button calls RepairAllItems, then the game reports the
-- repaired gear. ok = false: the game refused (not enough money), nothing changes.
local function repairAll(wow, w, guild, ok)
  RepairAllItems(guild)
  if ok == false then return end
  for _, it in pairs(w.items) do it[1] = it[2] end
  w.repairCost = 0
  wow.fire("UPDATE_INVENTORY_DURABILITY")
end

-- A visit to a vendor who can repair: the window opens, something happens, the window closes.
local function visit(wow, w, cost, action)
  w.repairCost = cost
  wow.fire("MERCHANT_SHOW")
  if action then action() end
  wow.fire("MERCHANT_CLOSED")
end

local function mine() return DurabilityWatchDB.history["Yubi-Silvermoon"] end

test("core: visits are noted, the same price soon after is the same visit, 20 are kept", function(wow)
  local ns = boot(wow)
  local list = {}
  local now = 1000000
  local v = ns.AddVisit(list, now, 5000)
  eq(#list, 1)
  eq(v.t, now)
  eq(v.cost, 5000)
  eq(v.paid, nil)
  eq(ns.AddVisit(list, now + 60, 5000), v, "the window opened again")
  eq(#list, 1)
  eq(v.t, now + 60)
  ns.AddVisit(list, now + 120, 5200)
  eq(#list, 2, "more wear: a new price")
  ns.AddVisit(list, now + 120 + 600, 5200)
  eq(#list, 3, "ten minutes later it is a new visit")
  eq(ns.MarkPaid(list[3], "gold"), true)
  ns.AddVisit(list, now + 721, 5200)
  eq(#list, 4, "after a repair the same price is a new visit")
  eq(ns.AddVisit(list, now, 0), nil)
  eq(ns.AddVisit(list, now, -5), nil)
  eq(ns.AddVisit(list, now, 12.5), nil)
  eq(ns.AddVisit(list, now, { secret = true }), nil)
  eq(ns.AddVisit(nil, now, 100), nil)
  eq(#list, 4)
  for i = 1, 30 do ns.AddVisit(list, now + 1000 * i, i) end
  eq(#list, 20)
  eq(list[1].cost, 11, "the oldest go first")
  eq(list[20].cost, 30)
end)

test("core: how a visit was paid, the total of the last 7 days and the wear", function(wow)
  local ns = boot(wow)
  local v = { t = 1, cost = 10 }
  eq(ns.MarkPaid(v, "cash"), false)
  eq(ns.MarkPaid(v, "guild"), true)
  eq(ns.MarkPaid(v, "gold"), false, "the first answer counts")
  eq(v.paid, "guild")
  local now = wow.now
  local list = {
    { t = now - 8 * DAY, cost = 1000, paid = "gold" },  -- too old
    { t = now - 6 * DAY, cost = 2000, paid = "gold" },
    { t = now - 3 * DAY, cost = 4000 },                 -- not repaired
    { t = now - HOUR, cost = 500, paid = "guild" },
    { t = now + HOUR, cost = 9999, paid = "gold" },     -- a clock that went back
  }
  local total, guild, count = ns.WeekTotal(list, now)
  eq(total, 2500)
  eq(guild, 500)
  eq(count, 2)
  eq(ns.WeekTotal({}, now), 0)
  eq(ns.WeekTotal(nil, now), 0)
  local missing, max = ns.Wear({ { slot = 1, cur = 40, max = 100 }, { slot = 5, cur = 165, max = 165 }, { slot = 7, cur = -3, max = 50 } })
  eq(missing, 110)
  eq(max, 315)
  eq(ns.Wear({}), 0)
end)

test("core: saved visits are checked and kept in order", function(wow)
  local ns = boot(wow)
  eq(ns.ValidVisit({ t = 5, cost = 10, paid = "gold" }).paid, "gold")
  eq(ns.ValidVisit({ t = 5, cost = 10, paid = "cash" }).paid, nil, "an unknown way of paying is forgotten")
  eq(ns.ValidVisit({ t = 5, cost = 0 }), nil)
  eq(ns.ValidVisit({ t = "yesterday", cost = 10 }), nil)
  eq(ns.ValidVisit({ cost = 10 }), nil)
  eq(ns.ValidVisit("broken"), nil)
  local clean = ns.CleanHistory({ { t = 30, cost = 3 }, "x", { t = 10, cost = 1 }, { t = 20, cost = 2.5 }, { t = 20, cost = 2 } })
  eq(#clean, 3)
  eq(clean[1].cost, 1)
  eq(clean[3].cost, 3)
  eq(#ns.CleanHistory("broken"), 0)
  local long = {}
  for i = 1, 25 do long[i] = { t = i, cost = i } end
  clean = ns.CleanHistory(long)
  eq(#clean, 20)
  eq(clean[1].cost, 6)
end)

test("core: the texts of a visit and of the week", function(wow)
  local ns = boot(wow)
  local t = os.time({ year = 2026, month = 11, day = 20, hour = 18, min = 5 })
  eq(ns.VisitText({ t = t, cost = 123456, paid = "gold" }), "Nov 20 18:05: 12g 34s 56c, repaired with your gold.")
  eq(ns.VisitText({ t = t, cost = 1507, paid = "guild" }), "Nov 20 18:05: 15s 07c, repaired with guild money.")
  eq(ns.VisitText({ t = t, cost = 7 }), "Nov 20 18:05: 7c, not repaired.")
  eq(ns.WeekText({ { t = t, cost = 30000, paid = "gold" } }, t), "Repairs in the last 7 days: 3g 00s 00c.")
  eq(ns.WeekText({ { t = t, cost = 30000, paid = "gold" }, { t = t, cost = 10000, paid = "guild" } }, t), "Repairs in the last 7 days: 4g 00s 00c (1g 00s 00c from the guild).")
  eq(ns.WeekText({ { t = t, cost = 30000 } }, t), "No repairs in the last 7 days.")
end)

test("a vendor visit with damaged gear notes the cost, Repair All with your gold marks it", function(wow)
  local ns, w = boot(wow, set())
  w.repairCost = 123456
  wow.fire("MERCHANT_SHOW")
  eq(#mine(), 1)
  eq(mine()[1].t, wow.now)
  eq(mine()[1].cost, 123456)
  eq(mine()[1].paid, nil)
  repairAll(wow, w, false)
  eq(mine()[1].paid, "gold")
  eq(w.repairs, 1, "the game's own function still runs")
  wow.fire("MERCHANT_CLOSED")
  eq(ns.visit, nil)
  eq(ns.condition.overall, 100)
  wow.fire("MERCHANT_SHOW")
  eq(#mine(), 1, "nothing damaged any more: nothing to note")
end)

test("Repair All with guild money is noted as guild money", function(wow)
  local ns, w = boot(wow, set())
  visit(wow, w, 50000, function() repairAll(wow, w, true) end)
  eq(mine()[1].paid, "guild")
  eq(ns.WeekText(mine(), wow.now), "Repairs in the last 7 days: 5g 00s 00c (5g 00s 00c from the guild).")
end)

test("a refused guild repair is not noted, your own gold afterwards is", function(wow)
  local ns, w = boot(wow, set())
  w.repairCost = 50000
  wow.fire("MERCHANT_SHOW")
  repairAll(wow, w, true, false) -- the guild bank cannot pay
  wow.fire("UPDATE_INVENTORY_DURABILITY")
  eq(mine()[1].paid, nil)
  repairAll(wow, w, false)
  eq(mine()[1].paid, "gold")
end)

test("repairing single items counts as your gold, a change of gear at the vendor does not", function(wow)
  local ns, w = boot(wow, set())
  w.repairCost = 6000
  wow.fire("MERCHANT_SHOW")
  w.items[16] = { 100, 100, "[Blade]" } -- the swap to another weapon
  w.items[17] = { 50, 120 }
  wow.fire("PLAYER_EQUIPMENT_CHANGED", 16, true)
  wow.fire("UPDATE_INVENTORY_DURABILITY")
  eq(mine()[1].paid, nil, "other gear is no repair")
  wow.fire("MERCHANT_CLOSED")
  w.repairCost = 6000
  wow.fire("MERCHANT_SHOW")
  eq(#mine(), 1, "the same price again: the same visit")
  w.items[17] = { 120, 120 } -- the repair hammer on the off hand
  wow.fire("UPDATE_INVENTORY_DURABILITY")
  eq(mine()[1].paid, "gold")
  wow.fire("MERCHANT_CLOSED")
end)

test("leaving without a repair is noted as not repaired, after closing nothing is marked", function(wow)
  local ns, w = boot(wow, set())
  visit(wow, w, 7000)
  visit(wow, w, 7000)
  eq(#mine(), 1, "opened twice in a row")
  eq(mine()[1].paid, nil)
  for _, it in pairs(w.items) do it[1] = it[2] end -- repaired somewhere the addon did not see
  wow.fire("UPDATE_INVENTORY_DURABILITY")
  eq(mine()[1].paid, nil)
  wear(wow, w, 16, 40)
  wow.now = wow.now + HOUR
  visit(wow, w, 7000)
  eq(#mine(), 2, "an hour later it is a new visit")
end)

test("no history for vendors who cannot repair, nothing to pay or secret prices", function(wow)
  local ns, w = boot(wow, set())
  w.canRepair = false
  visit(wow, w, 500)
  w.canRepair = true
  visit(wow, w, 0)
  GetRepairAllCost = function() return { secret = true }, true end
  wow.fire("MERCHANT_SHOW")
  RepairAllItems()
  wow.fire("MERCHANT_CLOSED")
  eq(mine(), nil)
  eq(ns.visit, nil)
end)

test("every character has its own history", function(wow)
  local ns, w = boot(wow, set())
  visit(wow, w, 1000, function() repairAll(wow, w, false) end)
  wow.player = "Brakk"
  wow.fire("PLAYER_LOGIN")
  eq(DurabilityWatchDB.history["Brakk-Silvermoon"], nil)
  wear(wow, w, 16, 10)
  visit(wow, w, 2000)
  eq(#DurabilityWatchDB.history["Brakk-Silvermoon"], 1)
  eq(DurabilityWatchDB.history["Brakk-Silvermoon"][1].cost, 2000)
  eq(#mine(), 1)
  eq(mine()[1].cost, 1000)
end)

test("the tooltip adds the repairs of the last 7 days once there is a history", function(wow)
  local ns, w = boot(wow, set())
  visit(wow, w, 30000, function() repairAll(wow, w, false) end)
  wear(wow, w, 16, 40)
  visit(wow, w, 10000, function() repairAll(wow, w, true) end)
  wear(wow, w, 16, 40)
  local f = DurabilityWatchFrame
  f.scripts.OnEnter(f)
  local tip = wow.tooltip.lines
  eq(tip[2], "Main Hand: [Blade] = " .. YELLOW .. "40%|r")
  eq(tip[3], "Repairs in the last 7 days: 4g 00s 00c (1g 00s 00c from the guild).")
  eq(tip[4], "/dw history lists your last repair costs.")
  eq(tip[5], "Warning at 25%.")
  eq(#tip, 6)
end)

test("/dw history lists the visits newest first with the total, /dw history clear empties it", function(wow)
  local ns, w = boot(wow, set())
  wow.slash("/dw history")
  eq(wow.chat[1], PREFIX .. "No repair costs noted yet. They are noted at a vendor who can repair while your gear is damaged.")
  wow.now = wow.now - 8 * DAY
  visit(wow, w, 90000, function() repairAll(wow, w, false) end)
  wear(wow, w, 16, 40)
  wow.now = wow.now + 8 * DAY
  visit(wow, w, 30000)
  wow.now = wow.now + 5 * 60
  visit(wow, w, 30000, function() repairAll(wow, w, true) end)
  wear(wow, w, 16, 40)
  wow.now = wow.now + DAY
  visit(wow, w, 20000, function() repairAll(wow, w, false) end)
  local before = #wow.chat
  wow.slash("/dw HISTORY")
  eq(#wow.chat - before, 5)
  eq(wow.chat[before + 1], PREFIX .. "Repair costs of your last 3 vendor visits, newest first:")
  eq(wow.chat[before + 2], PREFIX .. "Nov 21 18:05: 2g 00s 00c, repaired with your gold.")
  eq(wow.chat[before + 3], PREFIX .. "Nov 20 18:05: 3g 00s 00c, repaired with guild money.", "two looks at the same price are one visit")
  eq(wow.chat[before + 4], PREFIX .. "Nov 12 18:00: 9g 00s 00c, repaired with your gold.")
  eq(wow.chat[before + 5], PREFIX .. "Repairs in the last 7 days: 5g 00s 00c (3g 00s 00c from the guild).")
  wow.slash("/dw history all")
  eq(wow.chat[#wow.chat], PREFIX .. "Use /dw history to list your repair costs, /dw history clear to empty the list.")
  wow.slash("/dw history clear")
  eq(wow.chat[#wow.chat], PREFIX .. "The repair cost history of this character is empty now.")
  eq(#mine(), 0)
end)

test("only the last 20 visits are kept", function(wow)
  local ns, w = boot(wow, set())
  for i = 1, 23 do
    wow.now = wow.now + HOUR
    visit(wow, w, 1000 + i)
  end
  eq(#mine(), 20)
  eq(mine()[1].cost, 1004)
  eq(mine()[20].cost, 1023)
end)

test("saved data of 1.1 is kept and gets an empty history, broken history is cleaned", function(wow)
  DurabilityWatchDB = { version = 2, settings = { warn = 35, locked = true, hidden = false, instanceWarn = false, instanceLevel = 40, point = { "LEFT", "LEFT", 10, 20 } } }
  local ns, w = boot(wow, set())
  local db = DurabilityWatchDB
  eq(db.version, 3)
  eq(db.settings.warn, 35)
  eq(db.settings.locked, true)
  eq(db.settings.instanceWarn, false)
  eq(db.settings.instanceLevel, 40)
  eq(db.settings.point[1], "LEFT")
  eq(type(db.history), "table")
  eq(next(db.history), nil)
  visit(wow, w, 500)
  eq(#mine(), 1)

  DurabilityWatchDB = { version = 3, settings = {}, history = {
    ["Yubi-Silvermoon"] = { { t = 20, cost = 2, paid = "gold" }, "x", { t = 10, cost = 1, paid = "cash" } },
    ["Old-Silvermoon"] = { "broken" },
    ["Odd-Silvermoon"] = "broken",
  } }
  wow.fire("PLAYER_LOGIN")
  eq(#mine(), 2)
  eq(mine()[1].cost, 1)
  eq(mine()[1].paid, nil)
  eq(mine()[2].paid, "gold")
  eq(DurabilityWatchDB.history["Old-Silvermoon"], nil)
  eq(DurabilityWatchDB.history["Odd-Silvermoon"], nil)
  DurabilityWatchDB = { version = 3, history = "broken" }
  wow.fire("PLAYER_LOGIN")
  eq(type(DurabilityWatchDB.history), "table")
end)
