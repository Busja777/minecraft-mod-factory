local _, ns = ...
local L = ns.L

-- Counts the bag slots after every bag change and warns when the bags are about to be full.

ns.warner = ns.NewWarner()
ns.shown = {} -- the warnings shown in this session (1.2, for "once per session")
ns.counts = nil -- the last count: { free, total, reagentFree, reagentTotal, professions }

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
  counts.professions = ns.Professions(bags) -- profession bags sit in the normal bag slots
  if reagent then
    local r = readBag(reagent)
    r.family = nil -- the reagent bag only holds reagents by design; it is counted on its own
    local t = ns.Totals({ r })
    if t.total > 0 then counts.reagentFree, counts.reagentTotal = t.free, t.total end
  end
  return counts
end

-- 1.3: the items of the normal bags, for /bl cheap and the "bags full" warning.
local QUEST_CLASS = 12 -- the item class of quest items (Enum.ItemClass.Questitem)

local function itemInfo()
  return C_Item and C_Item.GetItemInfo or GetItemInfo
end

local function questClass()
  local class = Enum and Enum.ItemClass and Enum.ItemClass.Questitem
  return type(class) == "number" and class or QUEST_CLASS
end

-- Whether the game marks the item in this slot as a quest item or one that starts a quest.
local function isQuestSlot(bag, slot)
  if not (C_Container and C_Container.GetContainerItemQuestInfo) then return false end
  local ok, q = pcall(C_Container.GetContainerItemQuestInfo, bag, slot)
  if not ok or type(q) ~= "table" then return false end
  return plain(q.isQuestItem) == true or type(plain(q.questID)) == "number"
end

-- One bag slot as the plain record Core.lua works with. Returns nil for an empty or unreadable
-- slot, and nil, true for an item whose details the game has not loaded yet.
function ns.ReadItem(bag, slot)
  local info = C_Container.GetContainerItemInfo(bag, slot)
  if type(info) ~= "table" then return nil end
  local id, count, quality = plain(info.itemID), plain(info.stackCount), plain(info.quality)
  local link, noValue = plain(info.hyperlink), plain(info.hasNoValue)
  if type(id) ~= "number" then return nil end
  if type(link) ~= "string" then link = nil end
  local getInfo = itemInfo()
  if not getInfo then return nil, true end
  local ok, _, _, infoQuality, _, _, _, _, _, _, _, price, class = pcall(getInfo, link or id)
  if not ok then return nil, true end
  price, class, infoQuality = plain(price), plain(class), plain(infoQuality)
  if type(price) ~= "number" then return nil, true end -- not loaded yet
  if type(quality) ~= "number" then quality = infoQuality end
  return {
    bag = bag, slot = slot, id = id, link = link, quality = quality,
    count = type(count) == "number" and count or 1, price = price,
    noValue = noValue == true, quest = class == questClass() or isQuestSlot(bag, slot),
  }
end

-- Every item of the normal bags (no reagent or profession bags: the warnings follow the normal
-- bags only), and how many items were skipped because the game has not loaded them yet.
function ns.ScanItems()
  local items, skipped = {}, 0
  if not (C_Container and C_Container.GetContainerNumSlots and C_Container.GetContainerItemInfo) then return items, skipped end
  local first, last = ns.BagIndexes()
  for bag = first, last do
    local family
    if C_Container.GetContainerNumFreeSlots then family = plain(select(2, C_Container.GetContainerNumFreeSlots(bag))) end
    if not (type(family) == "number" and family ~= 0) then
      for slot = 1, plain(C_Container.GetContainerNumSlots(bag)) or 0 do
        local item, notLoaded = ns.ReadItem(bag, slot)
        if item then
          items[#items + 1] = item
        elseif notLoaded then
          skipped = skipped + 1
        end
      end
    end
  end
  return items, skipped
end

-- Plays the chosen warning sound once (also the preview of /bl sound <name>).
function ns.PlayWarningSound()
  if not PlaySound then return end
  local id = ns.SoundId(SOUNDKIT, ns.settings.soundName)
  if id then pcall(PlaySound, id) end
end

local function alert(kind, free)
  local rgb = ns.RGB[kind]
  if UIErrorsFrame and UIErrorsFrame.AddMessage then
    UIErrorsFrame:AddMessage(ns.WarningText(kind, free), rgb[1], rgb[2], rgb[3])
    -- 1.3: what to throw out first
    local cheapest = kind == "full" and ns.Cheapest((ns.ScanItems()), 1)[1]
    if cheapest then UIErrorsFrame:AddMessage(ns.CheapWarning(cheapest), rgb[1], rgb[2], rgb[3]) end
  end
  if ns.settings.sound then ns.PlayWarningSound() end
end

function ns.Recount()
  if not ns.settings then return end
  local c = ns.Count()
  ns.counts = c
  local free, total = c and c.free, c and c.total
  local kind = ns.Warn(ns.warner, free, total, ns.settings.threshold)
  if ns.AllowWarning(ns.shown, kind, ns.settings.repeatWarn) then alert(kind, free) end
  if ns.Render then ns.Render() end
end

local function flag(value, default)
  if type(value) == "boolean" then return value end
  return default
end

local function onLogin()
  if type(BagLookoutDB) ~= "table" then BagLookoutDB = {} end
  local db = BagLookoutDB
  db.version = 3 -- 2: settings.view (1.1) replaces settings.details; 3: soundName and repeatWarn (1.2)
  if type(db.settings) ~= "table" then db.settings = {} end
  local s = db.settings
  s.threshold = ns.ValidThreshold(s.threshold) or ns.DEFAULT_THRESHOLD
  s.sound = flag(s.sound, true)
  s.soundName = ns.ValidSound(s.soundName) or ns.DEFAULT_SOUND
  s.repeatWarn = ns.ValidRepeat(s.repeatWarn) or "always"
  s.locked = flag(s.locked, false)
  s.hidden = flag(s.hidden, false)
  -- 1.0 showed the reagent bag on a click (details); 1.1 shows it in the split view instead.
  s.view = ns.ValidView(s.view) or (s.details == true and "split" or "total")
  s.details = nil
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
