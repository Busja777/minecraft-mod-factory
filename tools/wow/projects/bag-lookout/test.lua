-- Tests for Bag Lookout, run by tools/wow/client/run.lua.

-- The parts of the game the stand-in client lacks: bags, the error frame in the middle of the screen
-- and sounds. bags[bag] = { total, free, family }; bag 5 is the reagent bag.
local SIZES = { [0] = 20, [1] = 18, [2] = 18, [3] = 18, [4] = 18 } -- 92 slots in the normal bags
local STAND_IN = { "C_Container", "UIErrorsFrame", "SOUNDKIT", "PlaySound", "NUM_BAG_SLOTS", "NUM_REAGENTBAG_SLOTS" }

local function world(wow)
  local w = { bags = {}, reads = 0, errors = {}, sounds = {} }
  for bag, size in pairs(SIZES) do w.bags[bag] = { total = size, free = size, family = 0 } end
  w.bags[5] = { total = 36, free = 36, family = 4096 }

  NUM_BAG_SLOTS = 4
  NUM_REAGENTBAG_SLOTS = 1
  Enum.BagIndex = { Backpack = 0, ReagentBag = 5 }
  C_Container = {
    GetContainerNumSlots = function(bag)
      w.reads = w.reads + 1
      local b = w.bags[bag]
      return b and b.total or 0
    end,
    GetContainerNumFreeSlots = function(bag)
      local b = w.bags[bag]
      if not b then return 0, 0 end
      return b.free, b.family
    end,
  }
  UIErrorsFrame = { AddMessage = function(_, msg, r, g, b) w.errors[#w.errors + 1] = { msg = msg, r = r, g = g, b = b } end }
  SOUNDKIT = { RAID_WARNING = 8959 }
  PlaySound = function(id) w.sounds[#w.sounds + 1] = id end

  -- Sets the free slots of the normal bags to n, filled from the backpack on.
  function w.free(n)
    for bag = 0, 4 do
      local take = math.min(n, SIZES[bag])
      w.bags[bag].free = take
      n = n - take
    end
  end
  -- Loot or a sale: the bags change and the game reports it once after the batch.
  function w.loot(n)
    w.free(n)
    wow.fire("BAG_UPDATE", 0)
    wow.fire("BAG_UPDATE_DELAYED")
  end
  return w
end

local function boot(wow)
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("ADDON_LOADED", "BagLookout")
  wow.fire("PLAYER_LOGIN")
  return ns
end

local PREFIX = "|cffffd100Bag Lookout:|r "
local WHITE, YELLOW, RED, GREY = "|cffffffff", "|cffffd100", "|cffff2020", "|cff9d9d9d"
local function counter() return BagLookoutFrame.label:GetText() end
local function detail() return BagLookoutFrame.detail:GetText() end

test("addon defines only its own globals", function(wow, installed, before)
  local w = world(wow)
  for _, name in ipairs(STAND_IN) do installed[name] = true end
  boot(wow)
  w.loot(3)
  w.loot(0)
  BagLookoutFrame:Click()
  BagLookoutFrame.scripts.OnDragStart(BagLookoutFrame)
  BagLookoutFrame.scripts.OnDragStop(BagLookoutFrame)
  BagLookoutFrame.scripts.OnEnter(BagLookoutFrame)
  wow.slash("/bl")
  wow.slash("/bl threshold 8")
  wow.slash("/baglookout lock")
  w.bags[4].family = 32
  wow.slash("/bl view split")
  wow.fire("BAG_UPDATE_DELAYED")
  wow.slash("/bl view")
  local allowed = { BagLookoutDB = true, BagLookoutFrame = true, SLASH_BAGLOOKOUT1 = true, SLASH_BAGLOOKOUT2 = true }
  for k in pairs(_G) do
    if not before[k] and not installed[k] and not allowed[k] then error("unexpected global " .. tostring(k)) end
  end
end)

test("core: totals add up the normal bags and leave out special and unreadable ones", function(wow)
  local ns = boot(wow)
  local t = ns.Totals({
    { free = 4, total = 20, family = 0 },
    { free = 10, total = 18 },               -- family unknown counts as a normal bag
    { free = 30, total = 30, family = 32 },  -- a herb bag only holds herbs
    { free = nil, total = 18, family = 0 },  -- could not be read
    { free = 2, total = nil, family = 0 },
    { free = { secret = true }, total = 18, family = 0 },
    { free = -1, total = 18, family = 0 },
    { free = 40, total = 16, family = 0 },   -- never more free than there are slots
    { free = 0, total = 0, family = 0 },     -- empty bag slot
  })
  eq(t.free, 30)
  eq(t.total, 54)
  local empty = ns.Totals({})
  eq(empty.free, 0)
  eq(empty.total, 0)
end)

test("core: state and colour of the counter", function(wow)
  local ns = boot(wow)
  eq(ns.State(12, 92, 5), "ok")
  eq(ns.State(6, 92, 5), "ok")
  eq(ns.State(5, 92, 5), "low", "at the threshold")
  eq(ns.State(1, 92, 5), "low")
  eq(ns.State(0, 92, 5), "full")
  eq(ns.State(0, 92, 0), "full")
  eq(ns.State(1, 92, 0), "ok", "threshold 0 only knows full")
  eq(ns.State(nil, 92, 5), "unknown")
  eq(ns.State(3, 0, 5), "unknown", "no slots read yet")
  eq(ns.State(3, 92), "low", "default threshold")
  eq(ns.CounterText(12, 92, 5), WHITE .. "Bags 12/92|r")
  eq(ns.CounterText(5, 92, 5), YELLOW .. "Bags 5/92|r")
  eq(ns.CounterText(0, 92, 5), RED .. "Bags 0/92|r")
  eq(ns.CounterText(nil, nil, 5), GREY .. "Bags ...|r")
  eq(ns.ReagentText(30, 36, 5), WHITE .. "Reagents 30/36|r")
  eq(ns.ReagentText(0, 36, 5), RED .. "Reagents 0/36|r")
  eq(ns.ReagentText(nil, nil, 5), GREY .. "No reagent bag|r")
end)

test("core: the warning comes once on the way down, once at 0, and again only after rising above", function(wow)
  local ns = boot(wow)
  local w = ns.NewWarner()
  local function at(free, threshold) return ns.Warn(w, free, 92, threshold or 5) end
  eq(at(20), nil, "the first count only sets the state")
  eq(at(6), nil)
  eq(at(5), "low")
  eq(at(4), nil, "no spam while looting")
  eq(at(5), nil)
  eq(at(1), nil)
  eq(at(0), "full")
  eq(at(0), nil)
  eq(at(2), nil, "a slot freed up, still at or below the threshold")
  eq(at(0), nil, "not armed again yet")
  eq(at(6), nil, "above the threshold: armed again")
  eq(at(3), "low")
  eq(at(0), "full")
  eq(at(10), nil)
  eq(at(0), "full", "straight down to 0 says full, not low")
  eq(at(3), nil)
  eq(at(nil), nil, "unknown counts change nothing")
  eq(ns.Warn(w, 3, 0, 5), nil)
  eq(at(9), nil)
  eq(at(4), "low", "still armed after the unknown counts")
end)

test("core: the first count never warns, and a reset warner starts silent again", function(wow)
  local ns = boot(wow)
  local w = ns.NewWarner()
  eq(ns.Warn(w, nil, nil, 5), nil)
  eq(w.primed, false, "an unknown count is not the first count")
  eq(ns.Warn(w, 3, 92, 5), nil, "already low at login")
  eq(ns.Warn(w, 2, 92, 5), nil)
  eq(ns.Warn(w, 0, 92, 5), "full", "but reaching 0 later still warns")
  w = ns.NewWarner()
  eq(ns.Warn(w, 0, 92, 5), nil, "already full at login")
  eq(ns.Warn(w, 0, 92, 5), nil)
  ns.ResetWarner(w)
  eq(ns.Warn(w, 10, 92, 5), nil)
  eq(ns.Warn(w, 10, 92, 12), "low", "without a reset a higher threshold warns at once")
  w = ns.NewWarner()
  eq(ns.Warn(w, 10, 92, 5), nil)
  ns.ResetWarner(w)
  eq(ns.Warn(w, 10, 92, 12), nil, "after a reset a new threshold above the count does not warn at once")
  eq(ns.Warn(w, 0, 92, 12), "full")
  local zero = ns.NewWarner()
  eq(ns.Warn(zero, 5, 92, 0), nil)
  eq(ns.Warn(zero, 1, 92, 0), nil, "threshold 0 never says almost full")
  eq(ns.Warn(zero, 0, 92, 0), "full")
end)

test("core: threshold input and warning texts", function(wow)
  local ns = boot(wow)
  eq(ns.ParseThreshold("7"), 7)
  eq(ns.ParseThreshold("0"), 0)
  eq(ns.ParseThreshold("50"), 50)
  eq(ns.ParseThreshold("51"), nil)
  eq(ns.ParseThreshold("-1"), nil)
  eq(ns.ParseThreshold("2.5"), nil)
  eq(ns.ParseThreshold("five"), nil)
  eq(ns.ParseThreshold(""), nil)
  eq(ns.ParseThreshold(nil), nil)
  eq(ns.ValidThreshold(0 / 0), nil, "not a number")
  eq(ns.ValidThreshold("5"), nil, "only numbers are kept from saved settings")
  eq(ns.WarningText("low", 5), "Bags almost full: 5 free slots left.")
  eq(ns.WarningText("low", 1), "Bags almost full: 1 free slot left.")
  eq(ns.WarningText("full", 0), "Your bags are full!")
end)

test("login counts the bags and shows the counter without a warning", function(wow)
  local w = world(wow)
  w.free(3)
  local ns = boot(wow)
  eq(ns.counts.free, 3)
  eq(ns.counts.total, 92)
  eq(ns.counts.reagentFree, 36)
  eq(ns.counts.reagentTotal, 36)
  eq(counter(), YELLOW .. "Bags 3/92|r")
  eq(BagLookoutFrame:IsShown(), true)
  eq(BagLookoutFrame.detail:IsShown(), false)
  eq(#w.errors, 0, "nothing to say about the bags as they were at login")
  eq(#w.sounds, 0)
  local p = { BagLookoutFrame:GetPoint() }
  eq(p[1], "CENTER")
  eq(p[2], UIParent)
end)

test("only BAG_UPDATE_DELAYED recounts, not every BAG_UPDATE", function(wow)
  local w = world(wow)
  boot(wow)
  for _, f in ipairs(wow.frames) do eq(f.events.BAG_UPDATE, nil, "BAG_UPDATE is not even registered") end
  local reads = w.reads
  w.free(40)
  for bag = 0, 4 do wow.fire("BAG_UPDATE", bag) end
  eq(w.reads, reads)
  eq(counter(), WHITE .. "Bags 92/92|r")
  wow.fire("BAG_UPDATE_DELAYED")
  eq(w.reads, reads + 6, "five normal bags and the reagent bag, read once each")
  eq(counter(), WHITE .. "Bags 40/92|r")
end)

test("warnings: one message and one sound on the way down, one more at 0, re-armed above the threshold", function(wow)
  local w = world(wow)
  boot(wow)
  w.loot(6)
  eq(#w.errors, 0)
  w.loot(5)
  eq(#w.errors, 1)
  eq(w.errors[1].msg, "Bags almost full: 5 free slots left.")
  eq(w.errors[1].r, 1)
  eq(w.errors[1].g, 0.82)
  eq(w.errors[1].b, 0)
  eq(#w.sounds, 1)
  eq(w.sounds[1], SOUNDKIT.RAID_WARNING)
  eq(counter(), YELLOW .. "Bags 5/92|r")
  for n = 4, 1, -1 do w.loot(n) end
  eq(#w.errors, 1, "no spam while looting")
  w.loot(0)
  eq(#w.errors, 2)
  eq(w.errors[2].msg, "Your bags are full!")
  eq(w.errors[2].g, 0.13)
  eq(#w.sounds, 2)
  eq(counter(), RED .. "Bags 0/92|r")
  w.loot(0)
  w.loot(2)
  w.loot(0)
  eq(#w.errors, 2, "freeing one slot below the threshold does not re-arm")
  w.loot(30) -- sold at a vendor
  eq(counter(), WHITE .. "Bags 30/92|r")
  w.loot(1)
  eq(#w.errors, 3)
  eq(w.errors[3].msg, "Bags almost full: 1 free slot left.")
  eq(#w.sounds, 3)
end)

test("the reagent bag is counted on its own and shown in the split view by a click", function(wow)
  local w = world(wow)
  w.bags[5].free = 2
  w.free(50)
  local ns = boot(wow)
  eq(ns.counts.free, 50, "reagent slots are not in the main count")
  eq(ns.counts.total, 92)
  BagLookoutFrame:Click()
  eq(BagLookoutDB.settings.view, "split")
  eq(BagLookoutFrame.detail:IsShown(), true)
  eq(detail(), YELLOW .. "Reagents 2/36|r")
  w.bags[5].free = 0
  wow.fire("BAG_UPDATE_DELAYED")
  eq(detail(), RED .. "Reagents 0/36|r")
  eq(#w.errors, 0, "a full reagent bag does not warn")
  w.bags[5] = nil -- the reagent bag was taken off
  wow.fire("BAG_UPDATE_DELAYED")
  eq(ns.counts.reagentTotal, nil)
  eq(detail(), GREY .. "No reagent bag|r")
  BagLookoutFrame:Click()
  eq(BagLookoutDB.settings.view, "total")
  eq(BagLookoutFrame.detail:IsShown(), false)
end)

test("bag numbers without Enum.BagIndex: bag 5 only when there is a reagent bag slot", function(wow)
  local w = world(wow)
  Enum.BagIndex = nil
  local ns = boot(wow)
  local first, last, reagent = ns.BagIndexes()
  eq(first, 0)
  eq(last, 4)
  eq(reagent, 5)
  eq(ns.counts.reagentTotal, 36)
  NUM_REAGENTBAG_SLOTS = 0
  first, last, reagent = ns.BagIndexes()
  eq(reagent, nil)
  wow.fire("BAG_UPDATE_DELAYED")
  eq(ns.counts.reagentTotal, nil)
  eq(ns.counts.total, 92)
  NUM_BAG_SLOTS = nil
  first, last = ns.BagIndexes()
  eq(last, 4, "four equipped bags when the game does not say")
  w.bags[1].family = 8 -- a profession bag
  wow.fire("BAG_UPDATE_DELAYED")
  eq(ns.counts.total, 74, "a bag that holds only one kind of item is left out")
end)

test("the counter moves only when unlocked and keeps its place", function(wow)
  world(wow)
  boot(wow)
  local f = BagLookoutFrame
  f.scripts.OnDragStart(f)
  f:SetPoint("TOPLEFT", UIParent, "TOPLEFT", 40, -60) -- where the mouse left it
  f.scripts.OnDragStop(f)
  local p = BagLookoutDB.settings.point
  eq(p[1], "TOPLEFT")
  eq(p[2], "TOPLEFT")
  eq(p[3], 40)
  eq(p[4], -60)

  wow.slash("/bl lock")
  eq(BagLookoutDB.settings.locked, true)
  f.scripts.OnDragStart(f)
  f:SetPoint("CENTER", UIParent, "CENTER", 0, 0)
  f.scripts.OnDragStop(f)
  eq(BagLookoutDB.settings.point[3], 40, "locked: a drag does not move or save it")

  -- the next login puts the counter back where it was
  local saved = BagLookoutDB
  for k in pairs(_G) do if k:match("^BagLookout") or k:match("^SLASH_BAGLOOKOUT") then _G[k] = nil end end
  BagLookoutDB = saved
  wow.load(ADDON_DIR, ADDON_NAME)
  wow.frames[1].events = {} -- the first copy of the addon no longer listens
  wow.fire("PLAYER_LOGIN")
  local q = { BagLookoutFrame:GetPoint() }
  eq(q[1], "TOPLEFT")
  eq(q[2], UIParent)
  eq(q[4], 40)
  eq(q[5], -60)
end)

test("the tooltip explains the click and the drag", function(wow)
  world(wow)
  boot(wow)
  local f = BagLookoutFrame
  f.scripts.OnEnter(f)
  eq(wow.tooltip.owner, f)
  eq(wow.tooltip.shown, true)
  eq(wow.tooltip.lines[1], "Bag Lookout")
  eq(wow.tooltip.lines[2], "Click to switch between the total and one line per bag type.")
  eq(wow.tooltip.lines[3], "Drag to move it.")
  f.scripts.OnLeave(f)
  eq(wow.tooltip.shown, false)
  wow.slash("/bl lock")
  f.scripts.OnEnter(f)
  eq(wow.tooltip.lines[3], "Locked. Type /bl lock to move it.")
end)

test("/bl shows the state and the commands", function(wow)
  local w = world(wow)
  w.free(12)
  boot(wow)
  wow.slash("/bl")
  eq(#wow.chat, 2)
  eq(wow.chat[1], PREFIX .. "12 of 92 bag slots free. Warning at 5 free slots or fewer. Sound is on. The counter is unlocked. View: total.")
  eq(wow.chat[2], PREFIX .. "Commands: /bl threshold <0-50>, /bl view total or split, /bl lock, /bl hide, /bl show, /bl sound on or off.")
  wow.slash("/baglookout help")
  eq(#wow.chat, 4)
  eq(wow.chat[3], wow.chat[1])
  wow.slash("/bl nonsense")
  eq(wow.chat[6], wow.chat[2])
end)

test("/bl threshold sets the warning point and checks the input", function(wow)
  local w = world(wow)
  w.free(8)
  boot(wow)
  eq(counter(), WHITE .. "Bags 8/92|r")
  wow.slash("/bl threshold 10")
  eq(wow.chat[1], PREFIX .. "Warning at 10 free slots or fewer.")
  eq(BagLookoutDB.settings.threshold, 10)
  eq(counter(), YELLOW .. "Bags 8/92|r", "the colour follows at once")
  eq(#w.errors, 0, "a new threshold does not warn about the bags as they are")
  w.loot(7)
  eq(#w.errors, 0)
  w.loot(0)
  eq(#w.errors, 1)
  eq(w.errors[1].msg, "Your bags are full!")

  for _, bad in ipairs({ "51", "-2", "3.5", "lots", "" }) do
    wow.slash("/bl threshold " .. bad)
    eq(wow.chat[#wow.chat], PREFIX .. "The threshold must be a whole number from 0 to 50.", bad)
  end
  eq(BagLookoutDB.settings.threshold, 10)
  wow.slash("/bl  THRESHOLD   0 ")
  eq(BagLookoutDB.settings.threshold, 0)
  w.loot(1)
  eq(counter(), WHITE .. "Bags 1/92|r")
  w.loot(0)
  eq(#w.errors, 2, "threshold 0: only the full warning")
end)

test("/bl lock, /bl hide and /bl show", function(wow)
  local w = world(wow)
  boot(wow)
  wow.slash("/bl lock")
  eq(wow.chat[1], PREFIX .. "The counter is locked.")
  wow.slash("/bl lock")
  eq(wow.chat[2], PREFIX .. "The counter is unlocked.")
  eq(BagLookoutDB.settings.locked, false)
  wow.slash("/bl hide")
  eq(wow.chat[3], PREFIX .. "The counter is hidden. Warnings stay on. /bl show brings it back.")
  eq(BagLookoutFrame:IsShown(), false)
  eq(BagLookoutDB.settings.hidden, true)
  w.loot(4)
  eq(BagLookoutFrame:IsShown(), false, "a recount does not bring it back")
  eq(#w.errors, 1, "warnings stay on while hidden")
  wow.slash("/bl")
  eq(wow.chat[4], PREFIX .. "4 of 92 bag slots free. Warning at 5 free slots or fewer. Sound is on. The counter is hidden. View: total.")
  wow.slash("/bl show")
  eq(wow.chat[6], PREFIX .. "The counter is shown.")
  eq(BagLookoutFrame:IsShown(), true)
  eq(counter(), YELLOW .. "Bags 4/92|r")
end)

test("/bl sound on and off", function(wow)
  local w = world(wow)
  boot(wow)
  wow.slash("/bl sound off")
  eq(wow.chat[1], PREFIX .. "Sound is off.")
  eq(BagLookoutDB.settings.sound, false)
  w.loot(5)
  eq(#w.errors, 1, "the message still comes")
  eq(#w.sounds, 0)
  wow.slash("/bl sound")
  eq(wow.chat[2], PREFIX .. "Sound is off.", "without on or off it only tells")
  wow.slash("/bl sound ON")
  eq(wow.chat[3], PREFIX .. "Sound is on.")
  w.loot(0)
  eq(#w.sounds, 1)
end)

test("settings survive: saved values are kept, broken ones get the defaults", function(wow)
  local w = world(wow)
  boot(wow)
  local s = BagLookoutDB.settings
  eq(BagLookoutDB.version, 2)
  eq(s.threshold, 5)
  eq(s.sound, true)
  eq(s.locked, false)
  eq(s.hidden, false)
  eq(s.view, "total")
  eq(s.details, nil)

  -- as the game loads it at the next login
  BagLookoutDB = { settings = { threshold = 12, sound = false, locked = true, hidden = true, details = true }, later = "kept" }
  wow.frames[1].events = {}
  local frames = #wow.frames
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("PLAYER_LOGIN")
  s = BagLookoutDB.settings
  eq(s.threshold, 12)
  eq(s.sound, false)
  eq(s.locked, true)
  eq(BagLookoutDB.later, "kept")
  eq(BagLookoutFrame:IsShown(), false)
  eq(BagLookoutFrame.detail:IsShown(), true)
  eq(#wow.frames, frames + 2, "one event frame and one counter")

  BagLookoutDB = { settings = { threshold = 99, sound = "yes", locked = 1, point = "nowhere" } }
  wow.fire("PLAYER_LOGIN")
  s = BagLookoutDB.settings
  eq(s.threshold, 5)
  eq(s.sound, true)
  eq(s.locked, false)
  eq(ns.settings, s)
  eq(#wow.frames, frames + 2, "a second login does not build a second counter")

  BagLookoutDB = "broken"
  wow.fire("PLAYER_LOGIN")
  eq(BagLookoutDB.settings.threshold, 5)
  eq(#w.errors, 0)
end)

test("secret values are never counted", function(wow)
  local w = world(wow)
  local secret = { secret = true }
  w.free(50)
  w.bags[1].free = secret
  local ns = boot(wow)
  eq(ns.counts.free, 32, "the bag that cannot be read is left out")
  eq(ns.counts.total, 74)
  w.bags[1].free = 18
  w.bags[0].total = secret
  w.bags[2].family = secret -- unknown family: still a normal bag
  wow.fire("BAG_UPDATE_DELAYED")
  eq(ns.counts.total, 72)
  for bag = 0, 4 do w.bags[bag].free = secret end
  wow.fire("BAG_UPDATE_DELAYED")
  eq(ns.counts.free, 0)
  eq(ns.counts.total, 0)
  eq(counter(), GREY .. "Bags ...|r")
  eq(#w.errors, 0, "an unreadable count is not an empty bag")
end)

test("missing parts of the game are no error", function(wow)
  local w = world(wow)
  UIErrorsFrame = nil
  SOUNDKIT = nil
  Enum.BagIndex = nil
  NUM_BAG_SLOTS = nil
  NUM_REAGENTBAG_SLOTS = nil
  local ns = boot(wow)
  eq(ns.counts.total, 92)
  eq(ns.counts.reagentTotal, nil)
  w.loot(5)
  w.loot(0)
  eq(#w.sounds, 0)
  eq(counter(), RED .. "Bags 0/92|r")
  PlaySound = nil
  SOUNDKIT = { RAID_WARNING = 1 }
  w.loot(9)
  w.loot(3)
  C_Container = nil
  wow.fire("BAG_UPDATE_DELAYED")
  eq(ns.counts, nil)
  eq(counter(), GREY .. "Bags ...|r")
  wow.slash("/bl")
  eq(wow.chat[1], PREFIX .. "Bags not counted yet. Warning at 5 free slots or fewer. Sound is on. The counter is unlocked. View: total.")
end)

test("nothing happens before login", function(wow)
  local w = world(wow)
  wow.load(ADDON_DIR, ADDON_NAME)
  wow.slash("/bl threshold 9")
  wow.slash("/bl")
  wow.fire("BAG_UPDATE_DELAYED")
  eq(#wow.chat, 0)
  eq(BagLookoutDB, nil)
  eq(BagLookoutFrame, nil)
  eq(w.reads, 0)
end)

-- 1.1: the split view by bag type.

test("core: profession bags are added up per kind, named, and sorted", function(wow)
  local ns = boot(wow)
  local list = ns.Professions({
    { free = 4, total = 20, family = 0 },     -- a normal bag: not here
    { free = 10, total = 24, family = 1024 }, -- mining
    { free = 30, total = 36, family = 32 },   -- herbs
    { free = 40, total = 28, family = 32 },   -- herbs again, never more free than slots
    { free = 5, total = 20, family = 4096 },  -- a kind without a name
    { free = 2, total = 16, family = 96 },    -- herbs and enchanting in one bag: no single name
    { free = nil, total = 20, family = 64 },  -- could not be read
    { free = 3, total = 20, family = { secret = true } },
    { free = 0, total = 0, family = 8 },      -- no slots
    { free = 6, total = 12 },                 -- family unknown: a normal bag
  })
  local parts = {}
  for _, g in ipairs(list) do parts[#parts + 1] = g.label .. " " .. g.free .. "/" .. g.total end
  eq(table.concat(parts, ", "), "Herbs 58/64, Mining 10/24, Profession 7/36")
  eq(#ns.Professions({}), 0)
  eq(ns.FamilyLabel(65536), "Cooking")
  eq(ns.FamilyLabel(32768), "Fishing")
  eq(ns.FamilyLabel(3), "Profession")
end)

test("core: the lines of the split view and the view setting", function(wow)
  local ns = boot(wow)
  eq(ns.ValidView("split"), "split")
  eq(ns.ValidView("total"), "total")
  eq(ns.ValidView("details"), nil)
  eq(ns.ValidView(true), nil)
  eq(ns.ProfessionText("Herbs", 12, 36, 5), WHITE .. "Herbs 12/36|r")
  eq(ns.ProfessionText("Mining", 3, 24, 5), YELLOW .. "Mining 3/24|r")
  eq(ns.ProfessionText("Profession", 0, 20, 5), RED .. "Profession 0/20|r")
  local lines = ns.SplitLines({ reagentFree = 30, reagentTotal = 36, professions = {
    { label = "Herbs", free = 12, total = 36 }, { label = "Mining", free = 0, total = 24 } } }, 5)
  eq(table.concat(lines, " | "), WHITE .. "Reagents 30/36|r | " .. WHITE .. "Herbs 12/36|r | " .. RED .. "Mining 0/24|r")
  lines = ns.SplitLines({}, 5)
  eq(#lines, 1)
  eq(lines[1], GREY .. "No reagent bag|r", "the reagent line is always there, as in 1.0")
  eq(#ns.SplitLines(nil, 5), 1)
end)

test("split view: one line per bag type, the warning still follows only the normal bags", function(wow)
  local w = world(wow)
  w.bags[3] = { total = 36, free = 36, family = 32 }   -- a herb bag
  w.bags[4] = { total = 24, free = 24, family = 1024 } -- a mining bag
  w.free(10)
  w.bags[3].free, w.bags[4].free = 12, 24 -- free() fills bags 3 and 4 too; set them back
  w.bags[5].free = 30
  local ns = boot(wow)
  eq(ns.counts.total, 56, "backpack and two normal bags")
  eq(counter(), WHITE .. "Bags 10/56|r")
  eq(BagLookoutFrame.detail:IsShown(), false, "1.0 view by default")
  BagLookoutFrame:Click()
  eq(BagLookoutDB.settings.view, "split")
  eq(BagLookoutFrame.detail:IsShown(), true)
  eq(counter(), WHITE .. "Bags 10/56|r", "the first line stays the same")
  eq(detail(), WHITE .. "Reagents 30/36|r\n" .. WHITE .. "Herbs 12/36|r\n" .. WHITE .. "Mining 24/24|r")
  w.bags[3].free = 0 -- the herb bag is full
  wow.fire("BAG_UPDATE_DELAYED")
  eq(detail(), WHITE .. "Reagents 30/36|r\n" .. RED .. "Herbs 0/36|r\n" .. WHITE .. "Mining 24/24|r")
  eq(#w.errors, 0, "a full profession bag does not warn")
  w.bags[0].free, w.bags[1].free, w.bags[2].free = 0, 3, 0
  wow.fire("BAG_UPDATE_DELAYED")
  eq(#w.errors, 1, "the normal bags warn as before")
  eq(w.errors[1].msg, "Bags almost full: 3 free slots left.")
  w.bags[4] = { total = 18, free = 18, family = 0 } -- the mining bag swapped for a normal one
  wow.fire("BAG_UPDATE_DELAYED")
  eq(ns.counts.total, 74)
  eq(detail(), WHITE .. "Reagents 30/36|r\n" .. RED .. "Herbs 0/36|r")
  BagLookoutFrame:Click()
  eq(BagLookoutDB.settings.view, "total")
  eq(BagLookoutFrame.detail:IsShown(), false)
end)

test("/bl view switches between the total and the split view", function(wow)
  local w = world(wow)
  w.bags[2].family = 64 -- an enchanting bag
  boot(wow)
  wow.slash("/bl view")
  eq(wow.chat[1], PREFIX .. "View: total.", "without an argument it only tells")
  wow.slash("/bl VIEW Split")
  eq(wow.chat[2], PREFIX .. "View: one line per bag type.")
  eq(BagLookoutDB.settings.view, "split")
  eq(detail(), WHITE .. "Reagents 36/36|r\n" .. WHITE .. "Enchanting 18/18|r")
  wow.slash("/bl view sideways")
  eq(wow.chat[3], PREFIX .. "Use /bl view total or /bl view split.")
  eq(BagLookoutDB.settings.view, "split")
  wow.slash("/bl")
  eq(wow.chat[4], PREFIX .. "74 of 74 bag slots free. Warning at 5 free slots or fewer. Sound is on. The counter is unlocked. View: one line per bag type.")
  wow.slash("/bl view total")
  eq(wow.chat[#wow.chat], PREFIX .. "View: total.")
  eq(BagLookoutFrame.detail:IsShown(), false)
  wow.slash("/bl hide")
  wow.slash("/bl view split")
  eq(BagLookoutFrame:IsShown(), false, "changing the view does not show a hidden counter")
end)

test("1.0 settings move on to 1.1: the reagent click becomes the split view", function(wow)
  world(wow)
  -- As 1.0 saved it: the reagent bag was shown.
  BagLookoutDB = { version = 1, settings = { threshold = 8, sound = false, locked = true, hidden = false, details = true, point = { "TOP", "TOP", 0, -100 } } }
  wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("PLAYER_LOGIN")
  local s = BagLookoutDB.settings
  eq(BagLookoutDB.version, 2)
  eq(s.view, "split")
  eq(s.details, nil, "the old key is gone")
  eq(s.threshold, 8)
  eq(s.sound, false)
  eq(s.locked, true)
  eq(s.point[1], "TOP")
  eq(BagLookoutFrame.detail:IsShown(), true)
  eq(detail(), WHITE .. "Reagents 36/36|r")

  BagLookoutDB = { version = 1, settings = { details = false } }
  wow.fire("PLAYER_LOGIN")
  eq(BagLookoutDB.settings.view, "total")
  BagLookoutDB = { settings = { view = "split", details = false } }
  wow.fire("PLAYER_LOGIN")
  eq(BagLookoutDB.settings.view, "split", "a 1.1 setting wins")
  BagLookoutDB = { settings = { view = "sideways" } }
  wow.fire("PLAYER_LOGIN")
  eq(BagLookoutDB.settings.view, "total")
end)
