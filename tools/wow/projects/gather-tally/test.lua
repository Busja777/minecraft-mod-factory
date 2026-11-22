-- Tests for Gather Tally, run by tools/wow/client/run.lua.

-- The parts of the game the stand-in client lacks: the loot window and the item cache.
-- w.slots = { { kind = "item"|"coin"|"currency", id, qty, name } }; ITEMS[id] = { name, classID, subclassID }.
local ITEMS = {
  [2447] = { "Peacebloom", 7, 9 },
  [765] = { "Silverleaf", 7, 9 },
  [2770] = { "Copper Ore", 7, 7 },
  [2589] = { "Linen Cloth", 7, 5 },
  [6948] = { "Hearthstone", 15, 0 },
}
local SLOT_TYPE = { item = 1, coin = 2, currency = 3 }

local function linkOf(id) return "|cffffffff|Hitem:" .. id .. "::::::::80:::::|h[" .. ITEMS[id][1] .. "]|h|r" end

local function world()
  local w = { slots = {}, infoCalls = 0 }
  GetNumLootItems = function() return w.num or #w.slots end
  GetLootSlotType = function(slot)
    local s = w.slots[slot]
    return s and (s.slotType or SLOT_TYPE[s.kind or "item"]) or 0
  end
  GetLootSlotInfo = function(slot)
    local s = w.slots[slot]
    if not s then return nil end
    local name = s.name or (s.id and ITEMS[s.id] and ITEMS[s.id][1]) or "Coins"
    return 133784, name, s.qty or 1, nil, 1, false, false, nil, false, s.kind == "coin"
  end
  GetLootSlotLink = function(slot)
    local s = w.slots[slot]
    if not s or (s.kind and s.kind ~= "item") then return nil end
    if s.link ~= nil then return s.link end
    return linkOf(s.id)
  end
  C_Item = {
    GetItemInfoInstant = function(link)
      w.infoCalls = w.infoCalls + 1
      local id = tonumber(tostring(link):match("item:(%d+)"))
      local it = id and ITEMS[id]
      if not it then return nil end
      local sub = w.secretSubclass and { secret = true } or it[3]
      return id, "Tradeskill", "Herb", "", 133939, it[2], sub
    end,
  }
  return w
end

local function boot(wow, db)
  local w = world()
  GatherTallyDB = db
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("PLAYER_LOGIN")
  return ns, w
end

-- One loot window with these slots; autoloot empties it and closes it right away.
local function loot(wow, w, slots, keepOpen)
  w.slots = slots
  wow.fire("LOOT_READY", true)
  wow.fire("LOOT_OPENED", true)
  if not keepOpen then
    w.slots = {}
    wow.fire("LOOT_CLOSED")
  end
end

local function lastChat(wow, back) return wow.chat[#wow.chat - (back or 0)] end

test("addon defines only its own globals", function(wow, installed, before)
  local ns, w = boot(wow)
  loot(wow, w, { { id = 2447, qty = 3 } })
  wow.slash("/gt")
  ns.ShowTooltip(GatherTallyFrame)
  local stand = { GetNumLootItems = true, GetLootSlotType = true, GetLootSlotInfo = true, GetLootSlotLink = true, C_Item = true }
  local allowed = { GatherTallyDB = true, GatherTallyFrame = true, SLASH_GATHERTALLY1 = true, SLASH_GATHERTALLY2 = true }
  for k in pairs(_G) do
    if not before[k] and not installed[k] and not allowed[k] and not stand[k] then error("unexpected global " .. tostring(k)) end
  end
end)

test("herbs and ores are told apart from other items", function(wow)
  local ns = boot(wow)
  eq(ns.KindOf(7, 9), "herb")
  eq(ns.KindOf(7, 7), "ore")
  eq(ns.KindOf(7, 5), nil, "cloth")
  eq(ns.KindOf(15, 9), nil, "another item class")
  eq(ns.KindOf(nil, 9), nil)
  eq(ns.KindOf({ secret = true }, 9), nil, "secret class")
  eq(ns.KindOf(7, { secret = true }), nil, "secret subclass")
end)

test("the client's enums are used when they exist", function(wow)
  world()
  Enum.ItemClass = { Tradegoods = 7 }
  Enum.ItemTradeGoodsSubclass = { Herb = 90, MetalAndStone = 70 }
  Enum.LootSlotType = { Item = 1 }
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  eq(ns.SUBCLASS_HERB, 90)
  eq(ns.KindOf(7, 90), "herb")
  eq(ns.KindOf(7, 9), nil)
  eq(ns.KindOf(7, 70), "ore")
end)

test("a loot slot becomes a plain record, or nothing", function(wow)
  local ns = boot(wow)
  local link = linkOf(2447)
  local e = ns.LootEntry(1, link, "Peacebloom", 4, 2447, 7, 9)
  eq(e.kind, "herb"); eq(e.itemID, 2447); eq(e.count, 4); eq(e.link, link); eq(e.name, "Peacebloom")
  eq(ns.LootEntry(2, nil, "Coins", 1, nil, nil, nil), nil, "coin slot")
  eq(ns.LootEntry(1, link, "Peacebloom", 0, 2447, 7, 9), nil, "empty slot")
  eq(ns.LootEntry(1, link, "Peacebloom", 1.5, 2447, 7, 9), nil, "odd quantity")
  eq(ns.LootEntry(1, link, "Peacebloom", { secret = true }, 2447, 7, 9), nil, "secret quantity")
  eq(ns.LootEntry({ secret = true }, link, "Peacebloom", 1, 2447, 7, 9), nil, "secret slot type")
  eq(ns.LootEntry(1, link, nil, 2, nil, 7, 7).itemID, 2447, "item id from the link")
  eq(ns.LootEntry(1, link, nil, 2, nil, 7, 7).name, "Peacebloom", "name from the link")
  eq(ns.LootEntry(1, nil, nil, 2, nil, 7, 7), nil, "no item id at all")
  eq(ns.LootEntry(1, { secret = true }, "X", 2, 2770, 7, 7).link, nil, "a secret link is dropped")
end)

test("per hour starts after 5 minutes and rounds", function(wow)
  local ns = boot(wow)
  eq(ns.PerHour(10, 299), nil)
  eq(ns.PerHour(10, nil), nil)
  eq(ns.PerHour(0, 3600), nil)
  eq(ns.PerHour(10, 300), 120)
  eq(ns.PerHour(7, 3600), 7)
  eq(ns.PerHour(1, 7200), 1, "0.5 rounds up")
  eq(ns.PerHour(25, 1800), 50)
end)

test("the rate is measured from the first herb or ore, not from login", function(wow)
  local ns, w = boot(wow)
  wow.clock = wow.clock + 3600 -- an hour of questing first
  loot(wow, w, { { id = 2447, qty = 10 } })
  eq(ns.Rate(ns.session, "herb", GetTime()), nil, "too early")
  wow.clock = wow.clock + 1800
  loot(wow, w, { { id = 2447, qty = 20 } })
  eq(ns.session.totals.herb, 30)
  eq(ns.Rate(ns.session, "herb", GetTime()), 60)
  eq(ns.Rate(ns.session, "ore", GetTime()), nil, "no ore, no rate")
end)

test("a loot window counts herbs and ores and skips everything else", function(wow)
  local ns, w = boot(wow)
  loot(wow, w, {
    { kind = "coin", qty = 1 },
    { id = 2447, qty = 3 },
    { id = 2770, qty = 2 },
    { id = 2589, qty = 5 },
    { kind = "currency", qty = 4, name = "Resonance Crystals" },
    { id = 6948, qty = 1 },
  })
  eq(ns.session.totals.herb, 3)
  eq(ns.session.totals.ore, 2)
  eq(ns.session.items[2589], nil)
  eq(ns.session.items[2447].count, 3)
  eq(ns.session.items[2770].link, linkOf(2770))
  eq(ns.session.first, GetTime())
end)

test("each loot window counts only once until it closes", function(wow)
  local ns, w = boot(wow)
  w.slots = { { id = 2770, qty = 2 } }
  wow.fire("LOOT_READY", true)
  wow.fire("LOOT_READY", true)
  wow.fire("LOOT_OPENED", true)
  eq(ns.session.totals.ore, 2)
  wow.fire("LOOT_CLOSED")
  wow.fire("LOOT_READY", false)
  eq(ns.session.totals.ore, 4, "next window")
  wow.fire("LOOT_CLOSED")
  wow.fire("LOOT_CLOSED")
  eq(ns.session.totals.ore, 4)
end)

test("an empty window does not block the count of the same window", function(wow)
  local ns, w = boot(wow)
  w.num = 0
  wow.fire("LOOT_READY", true)
  w.num = nil
  w.slots = { { id = 765, qty = 1 } }
  wow.fire("LOOT_OPENED", true)
  eq(ns.session.totals.herb, 1)
end)

test("secret values in the loot window are skipped", function(wow)
  local ns, w = boot(wow)
  loot(wow, w, { { id = 2447, qty = { secret = true } }, { id = 2770, qty = 1 } })
  eq(ns.session.totals.herb, 0)
  eq(ns.session.totals.ore, 1)
  w.secretSubclass = true
  loot(wow, w, { { id = 2770, qty = 5 } })
  eq(ns.session.totals.ore, 1, "secret subclass")
  w.secretSubclass = nil
  w.num = { secret = true }
  loot(wow, w, { { id = 2770, qty = 5 } })
  eq(ns.session.totals.ore, 1, "secret slot count")
  w.num = nil
  loot(wow, w, { { id = 2770, qty = 5, slotType = { secret = true } } })
  eq(ns.session.totals.ore, 1, "secret slot type")
end)

test("the same item in several slots adds up, the top list is sorted", function(wow)
  local ns, w = boot(wow)
  loot(wow, w, { { id = 2447, qty = 2 }, { id = 2447, qty = 3 }, { id = 765, qty = 5 }, { id = 2770, qty = 9 } })
  eq(ns.session.items[2447].count, 5)
  local top = ns.Top(ns.session)
  eq(#top, 3)
  eq(top[1].itemID, 2770)
  eq(top[2].name, "Peacebloom", "ties sorted by name")
  eq(top[3].name, "Silverleaf")
  eq(#ns.Top(ns.session, "herb"), 2)
  eq(#ns.Top(ns.session, nil, 1), 1)
  eq(ns.Total(ns.session), 19)
end)

test("without the item API or the loot API nothing is counted and nothing breaks", function(wow)
  local ns, w = boot(wow)
  C_Item = nil
  GetItemInfoInstant = function(link) return 2770, "", "", "", 0, 7, 7 end
  loot(wow, w, { { id = 2770, qty = 2 } })
  eq(ns.session.totals.ore, 2, "falls back to the old global")
  GetItemInfoInstant = nil
  loot(wow, w, { { id = 2770, qty = 2 } })
  eq(ns.session.totals.ore, 2)
  GetLootSlotLink = nil
  loot(wow, w, { { id = 2770, qty = 2 } })
  eq(ns.session.totals.ore, 2)
end)

test("/gt prints the session with rates and the top items", function(wow)
  local ns, w = boot(wow)
  wow.slash("/gt")
  eq(lastChat(wow, 1):find("Herbs: none yet, Ores: none yet.", 1, true) ~= nil, true, lastChat(wow, 1))
  loot(wow, w, { { id = 2447, qty = 4 }, { id = 2770, qty = 1 } })
  wow.slash("/gathertally")
  eq(lastChat(wow, 2):find("Herbs: 4 (per hour after 5 minutes), Ores: 1 (per hour after 5 minutes).", 1, true) ~= nil, true, lastChat(wow, 2))
  eq(lastChat(wow, 1):find("Most gathered: " .. linkOf(2447) .. " x4, " .. linkOf(2770) .. " x1", 1, true) ~= nil, true, lastChat(wow, 1))
  wow.clock = wow.clock + 600
  wow.slash("/gt ")
  eq(lastChat(wow, 2):find("Herbs: 4 (24 per hour), Ores: 1 (6 per hour).", 1, true) ~= nil, true, lastChat(wow, 2))
  eq(lastChat(wow):find("/gt reset", 1, true) ~= nil, true, "help follows")
end)

test("/gt reset starts a new session and hides the display", function(wow)
  local ns, w = boot(wow)
  loot(wow, w, { { id = 2447, qty = 4 } })
  eq(GatherTallyFrame:IsShown(), true)
  wow.clock = wow.clock + 50
  wow.slash("/gt reset")
  eq(ns.Total(ns.session), 0)
  eq(ns.session.first, nil)
  eq(ns.session.start, GetTime())
  eq(GatherTallyFrame:IsShown(), false)
  eq(lastChat(wow):find("New session started.", 1, true) ~= nil, true)
  loot(wow, w, { { id = 2770, qty = 1 } })
  eq(ns.session.first, GetTime())
  eq(GatherTallyFrame:IsShown(), true)
end)

test("the display appears with the first herb or ore and shows the rate", function(wow)
  local ns, w = boot(wow)
  eq(GatherTallyFrame:IsShown(), false, "nothing gathered yet")
  loot(wow, w, { { id = 2589, qty = 3 } })
  eq(GatherTallyFrame:IsShown(), false, "cloth does not count")
  loot(wow, w, { { id = 2447, qty = 6 } })
  eq(GatherTallyFrame:IsShown(), true)
  eq(GatherTallyFrame.herb:GetText(), "Herbs 6")
  eq(GatherTallyFrame.ore:GetText(), "Ores 0")
  wow.clock = wow.clock + 3600
  GatherTallyFrame:GetScript("OnUpdate")(GatherTallyFrame, 5)
  eq(GatherTallyFrame.herb:GetText(), "Herbs 6  |cff9d9d9d6/h|r")
end)

test("hide and show are saved, the position is remembered", function(wow)
  local ns, w = boot(wow)
  wow.slash("/gt hide")
  loot(wow, w, { { id = 2447, qty = 1 } })
  eq(GatherTallyFrame:IsShown(), false)
  eq(GatherTallyDB.settings.hidden, true)
  wow.slash("/gt show")
  eq(GatherTallyFrame:IsShown(), true)
  eq(GatherTallyDB.settings.hidden, false)
  GatherTallyFrame:SetPoint("LEFT", 40, 12)
  GatherTallyFrame:GetScript("OnDragStop")(GatherTallyFrame)
  local p = GatherTallyDB.settings.point
  eq(p[1], "LEFT"); eq(p[3], 40); eq(p[4], 12)
end)

test("a saved position and hidden setting are used after a reload", function(wow)
  local ns, w = boot(wow, { settings = { point = { "BOTTOMLEFT", "BOTTOMLEFT", 100, 200 }, hidden = true } })
  local point, rel, relPoint, x, y = GatherTallyFrame:GetPoint()
  eq(point, "BOTTOMLEFT"); eq(rel, UIParent); eq(x, 100); eq(y, 200)
  loot(wow, w, { { id = 2447, qty = 1 } })
  eq(GatherTallyFrame:IsShown(), false)
  eq(GatherTallyDB.version, 1)
end)

test("login starts a fresh session", function(wow)
  local ns, w = boot(wow)
  loot(wow, w, { { id = 2447, qty = 1 } })
  wow.clock = wow.clock + 100
  wow.fire("PLAYER_LOGIN")
  eq(ns.Total(ns.session), 0)
  eq(ns.session.start, GetTime())
end)

test("the tooltip lists the top items of each kind", function(wow)
  local ns, w = boot(wow)
  loot(wow, w, { { id = 2447, qty = 2 }, { id = 2770, qty = 8 } })
  GatherTallyFrame:GetScript("OnEnter")(GatherTallyFrame)
  local lines = wow.tooltip.lines
  eq(wow.tooltip.shown, true)
  eq(lines[1], "Gather Tally")
  eq(lines[2], "Herbs: 2 (per hour after 5 minutes)")
  eq(lines[3], linkOf(2447) .. " = 2")
  eq(lines[4], "Ores: 8 (per hour after 5 minutes)")
  eq(lines[5], linkOf(2770) .. " = 8")
  GatherTallyFrame:GetScript("OnLeave")(GatherTallyFrame)
  eq(wow.tooltip.shown, false)
end)

test("slash commands before login and unknown words", function(wow)
  world()
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.slash("/gt")
  eq(#wow.chat, 0, "nothing before login")
  wow.fire("PLAYER_LOGIN")
  wow.slash("/gt what")
  eq(lastChat(wow):find("/gt shows this session", 1, true) ~= nil, true)
end)
