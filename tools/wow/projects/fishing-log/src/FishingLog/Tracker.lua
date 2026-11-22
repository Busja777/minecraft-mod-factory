local _, ns = ...

-- Watches loot windows. A loot window the game marks as fishing loot is one catch.
-- LOOT_READY and LOOT_OPENED can both fire for one window (and LOOT_READY sometimes twice), so each
-- window counts once until LOOT_CLOSED. With autoloot the slots empty quickly: the first event counts.

ns.session = ns.NewSession(0)

local counted = false

local ITEM_SLOT = (Enum and Enum.LootSlotType and Enum.LootSlotType.Item) or LOOT_SLOT_ITEM or 1

local function isItemSlot(i, currencyID)
  if GetLootSlotType then
    local kind = GetLootSlotType(i)
    if kind == nil or ns.IsSecret(kind) then return false end
    return kind == ITEM_SLOT
  end
  return currencyID == nil -- money slots report a quantity of 0 and add nothing anyway
end

-- The loot window as plain data for ns.CountItems.
function ns.ReadSlots()
  local slots = {}
  local n = GetNumLootItems and ns.Number(GetNumLootItems()) or 0
  for i = 1, n do
    local _, _, quantity, currencyID = GetLootSlotInfo(i)
    slots[#slots + 1] = { item = isItemSlot(i, currencyID), quantity = quantity }
  end
  return slots
end

local function isFishing()
  if not IsFishingLoot then return false end
  local fishing = IsFishingLoot()
  if ns.IsSecret(fishing) then return false end
  return fishing and true or false
end

local function onLoot()
  if counted or not ns.db then return end
  counted = true
  if not isFishing() then return end
  local zone = ns.ZoneName(GetRealZoneText and GetRealZoneText())
  ns.AddCatch(ns.session, ns.db.zones, zone, ns.CountItems(ns.ReadSlots()), GetTime())
end

function ns.NewSessionNow()
  ns.session = ns.NewSession(GetTime())
end

local function onLogin()
  FishingLogDB = FishingLogDB or {}
  local db = FishingLogDB
  db.version = 1
  db.zones = db.zones or {}
  ns.db = db
  ns.NewSessionNow()
end

local frame = CreateFrame("Frame")
ns.eventFrame = frame

frame:SetScript("OnEvent", function(_, event)
  if event == "PLAYER_LOGIN" then
    onLogin()
  elseif event == "LOOT_READY" or event == "LOOT_OPENED" then
    onLoot()
  elseif event == "LOOT_CLOSED" then
    counted = false
  end
end)

local function listen(event)
  pcall(frame.RegisterEvent, frame, event)
end

listen("PLAYER_LOGIN")
listen("LOOT_READY")
listen("LOOT_OPENED")
listen("LOOT_CLOSED")
