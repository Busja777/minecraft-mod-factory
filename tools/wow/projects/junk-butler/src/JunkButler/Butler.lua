local _, ns = ...
local L = ns.L

-- One vendor visit: repair, sell the grey items step by step, then one line in chat.

local visit -- the running visit; nil when no vendor is open or the work is done

function ns.Print(msg)
  DEFAULT_CHAT_FRAME:AddMessage("|cffffd100" .. L["Junk Butler"] .. ":|r " .. msg)
end

-- A value read from the game; nil when it is missing or must not be used.
local function plain(value)
  if value == nil or ns.IsSecret(value) then return nil end
  return value
end

local function lastBag()
  return NUM_TOTAL_EQUIPPED_BAG_SLOTS or ((NUM_BAG_SLOTS or 4) + (NUM_REAGENTBAG_SLOTS or 0))
end

local function vendorPrice(item)
  local getInfo = C_Item and C_Item.GetItemInfo or GetItemInfo
  if not getInfo or not item then return nil end
  return plain((select(11, getInfo(item))))
end

-- One bag slot as the plain record Core.lua works with; nil for an empty or unreadable slot.
function ns.ReadSlot(bag, slot)
  local info = C_Container.GetContainerItemInfo(bag, slot)
  if not info then return nil end
  local id, quality, count = info.itemID, info.quality, info.stackCount
  local locked, noValue = info.isLocked, info.hasNoValue
  if ns.IsSecret(id) or ns.IsSecret(quality) or ns.IsSecret(count) or ns.IsSecret(locked) or ns.IsSecret(noValue) then return nil end
  local price = 0
  if quality == ns.POOR and not noValue then price = vendorPrice(plain(info.hyperlink) or id) or 0 end
  return { bag = bag, slot = slot, id = id, quality = quality, count = count or 1, locked = locked and true or false, price = price }
end

function ns.ScanBags()
  local items = {}
  if not (C_Container and C_Container.GetContainerNumSlots and C_Container.GetContainerItemInfo) then return items end
  for bag = 0, lastBag() do
    for slot = 1, plain(C_Container.GetContainerNumSlots(bag)) or 0 do
      local item = ns.ReadSlot(bag, slot)
      if item then items[#items + 1] = item end
    end
  end
  return items
end

-- Repairs from the player's own gold. Notes the cost paid, or the cost the gold did not reach for.
local function repair(v)
  if v.repaired or not ns.settings.repair then return end
  if not (CanMerchantRepair and GetRepairAllCost and RepairAllItems) then return end
  if not plain(CanMerchantRepair()) then return end
  local cost, possible = GetRepairAllCost()
  cost = plain(cost)
  local ok, why = ns.ShouldRepair(cost, plain(GetMoney()), plain(possible))
  v.short = nil
  if ok then
    RepairAllItems()
    v.repaired = cost
  elseif why == "poor" then
    v.short = cost
  end
end

local function finish(v, closed)
  visit = nil
  -- The gold was short before the sale; now it may reach.
  if not closed and v.short and v.items > 0 then repair(v) end
  local line = ns.Summary(v)
  if line then ns.Print(line) end
end

local function sellStep(v)
  if v ~= visit then return end -- the vendor was closed in the meantime
  if v.index > #v.plan then return finish(v) end
  local step, nextIndex = ns.Step(v.plan, v.index, ns.STEP)
  for _, planned in ipairs(step) do
    -- The slot is read again: something may have moved since the bags were scanned.
    local item = ns.ReadSlot(planned.bag, planned.slot)
    if item and item.id == planned.id and ns.Sellable(item) then
      C_Container.UseContainerItem(planned.bag, planned.slot)
      v.items = v.items + item.count
      v.earned = v.earned + item.price * item.count
    end
  end
  v.index = nextIndex
  -- Also after the last step, so the gold of the sale has arrived before the repair is tried again.
  C_Timer.After(ns.DELAY, function() sellStep(v) end)
end

local function onMerchantShow()
  if visit or not ns.settings then return end
  if IsShiftKeyDown and IsShiftKeyDown() then return end
  local v = { items = 0, earned = 0, index = 1, plan = {} }
  visit = v
  repair(v)
  if ns.settings.sell and C_Container and C_Container.UseContainerItem then v.plan = ns.SellPlan(ns.ScanBags()) end
  sellStep(v)
end

local function onMerchantClosed()
  if visit then finish(visit, true) end
end

local function onLogin()
  if type(JunkButlerDB) ~= "table" then JunkButlerDB = {} end
  local db = JunkButlerDB
  db.version = 1
  if type(db.settings) ~= "table" then db.settings = {} end
  if db.settings.sell == nil then db.settings.sell = true end
  if db.settings.repair == nil then db.settings.repair = true end
  ns.db = db
  ns.settings = db.settings
end

local frame = CreateFrame("Frame")
ns.eventFrame = frame

frame:SetScript("OnEvent", function(_, event)
  if event == "PLAYER_LOGIN" then
    onLogin()
  elseif event == "MERCHANT_SHOW" then
    onMerchantShow()
  elseif event == "MERCHANT_CLOSED" then
    onMerchantClosed()
  end
end)

-- Registered one by one: an event a client does not know is skipped.
local function listen(event)
  pcall(frame.RegisterEvent, frame, event)
end

listen("PLAYER_LOGIN")
listen("MERCHANT_SHOW")
listen("MERCHANT_CLOSED")
