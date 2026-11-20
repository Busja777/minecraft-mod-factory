local _, ns = ...
local L = ns.L

-- Counts the bag slots after every bag change and warns when the bags are about to be full.

ns.warner = ns.NewWarner()
ns.counts = nil -- the last count: { free, total, reagentFree, reagentTotal }

function ns.Print(msg)
  DEFAULT_CHAT_FRAME:AddMessage("|cffffd100" .. L["Bag Lookout"] .. ":|r " .. msg)
end

-- A value read from the game; nil when it is missing or must not be used.
local function plain(value)
  if value == nil or ns.IsSecret(value) then return nil end
  return value
end

-- First and last normal bag (backpack and the equipped bags) and the reagent bag, if there is one.
function ns.BagIndexes()
  local index = Enum and Enum.BagIndex
  local first = index and index.Backpack or 0
  local last = first + (NUM_BAG_SLOTS or 4)
  local reagent
  if index and index.ReagentBag then
    reagent = index.ReagentBag
  elseif (NUM_REAGENTBAG_SLOTS or 0) > 0 then
    reagent = 5
  end
  return first, last, reagent
end

local function readBag(bag)
  local total = plain(C_Container.GetContainerNumSlots(bag))
  local free, family = C_Container.GetContainerNumFreeSlots(bag)
  return { free = plain(free), total = total, family = plain(family) }
end

-- The slots right now, or nil when the game offers no way to read them.
function ns.Count()
  if not (C_Container and C_Container.GetContainerNumSlots and C_Container.GetContainerNumFreeSlots) then return nil end
  local first, last, reagent = ns.BagIndexes()
  local bags = {}
  for bag = first, last do bags[#bags + 1] = readBag(bag) end
  local counts = ns.Totals(bags)
  if reagent then
    local r = readBag(reagent)
    r.family = nil -- the reagent bag only holds reagents by design; it is counted on its own
    local t = ns.Totals({ r })
    if t.total > 0 then counts.reagentFree, counts.reagentTotal = t.free, t.total end
  end
  return counts
end

local function alert(kind, free)
  local rgb = ns.RGB[kind]
  if UIErrorsFrame and UIErrorsFrame.AddMessage then
    UIErrorsFrame:AddMessage(ns.WarningText(kind, free), rgb[1], rgb[2], rgb[3])
  end
  if ns.settings.sound and PlaySound and SOUNDKIT and SOUNDKIT.RAID_WARNING then
    PlaySound(SOUNDKIT.RAID_WARNING)
  end
end

function ns.Recount()
  if not ns.settings then return end
  local c = ns.Count()
  ns.counts = c
  local free, total = c and c.free, c and c.total
  local kind = ns.Warn(ns.warner, free, total, ns.settings.threshold)
  if kind then alert(kind, free) end
  if ns.Render then ns.Render() end
end

local function flag(value, default)
  if type(value) == "boolean" then return value end
  return default
end

local function onLogin()
  if type(BagLookoutDB) ~= "table" then BagLookoutDB = {} end
  local db = BagLookoutDB
  db.version = 1
  if type(db.settings) ~= "table" then db.settings = {} end
  local s = db.settings
  s.threshold = ns.ValidThreshold(s.threshold) or ns.DEFAULT_THRESHOLD
  s.sound = flag(s.sound, true)
  s.locked = flag(s.locked, false)
  s.hidden = flag(s.hidden, false)
  s.details = flag(s.details, false)
  ns.db = db
  ns.settings = s
  ns.ResetWarner(ns.warner) -- no warning for what the bags already were at login
  if ns.CreateCounter then ns.CreateCounter() end
  ns.Recount()
end

local frame = CreateFrame("Frame")
ns.eventFrame = frame

frame:SetScript("OnEvent", function(_, event)
  if event == "PLAYER_LOGIN" then
    onLogin()
  elseif event == "BAG_UPDATE_DELAYED" then
    ns.Recount()
  end
end)

-- Registered one by one: an event a client does not know is skipped.
-- Only BAG_UPDATE_DELAYED: it comes once after a batch of bag changes, BAG_UPDATE once per bag.
local function listen(event)
  pcall(frame.RegisterEvent, frame, event)
end

listen("PLAYER_LOGIN")
listen("BAG_UPDATE_DELAYED")
