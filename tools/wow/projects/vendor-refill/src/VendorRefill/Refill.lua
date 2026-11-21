local _, ns = ...
local L = ns.L

-- One vendor visit: read what the vendor sells, buy what the list misses step by step, then tell the result.

local visit -- the running visit; nil when no vendor is open or the work is done
local atVendor = false -- a vendor window is open: no low stock warnings then
local readyAt -- GetTime() from which on low stock is checked; nil before login
ns.warned = {} -- itemID → true: already warned about this session

function ns.Print(msg)
  DEFAULT_CHAT_FRAME:AddMessage("|cffffd100" .. L["Vendor Refill"] .. ":|r " .. msg)
end

-- A value read from the game; nil when it is missing or must not be used.
local function plain(value)
  if value == nil or ns.IsSecret(value) then return nil end
  return value
end

function ns.CharKey()
  return (UnitName("player") or "?") .. "-" .. (GetRealmName() or "?")
end

-- How many of an item are in the bags (not the bank); nil when the game does not say.
function ns.Owned(itemID)
  local count
  if C_Item and C_Item.GetItemCount then
    count = C_Item.GetItemCount(itemID)
  elseif GetItemCount then
    count = GetItemCount(itemID)
  end
  count = plain(count)
  return type(count) == "number" and count or nil
end

-- The item's name if the game knows it already.
function ns.ItemName(itemID)
  local name
  if C_Item and C_Item.GetItemNameByID then
    name = C_Item.GetItemNameByID(itemID)
  elseif GetItemInfo then
    name = GetItemInfo(itemID)
  end
  name = plain(name)
  return type(name) == "string" and name ~= "" and name or nil
end

local function merchantItemID(index)
  if not GetMerchantItemID then return nil end
  local id = plain(GetMerchantItemID(index))
  return type(id) == "number" and id or nil
end

-- One vendor slot as the plain record Core.lua works with; nil when it cannot be read.
function ns.ReadMerchantSlot(index)
  local id = merchantItemID(index)
  if not id then return nil end
  local name, price, stackCount, numAvailable, purchasable, extended
  if C_MerchantFrame and C_MerchantFrame.GetItemInfo then
    local info = C_MerchantFrame.GetItemInfo(index)
    if type(info) ~= "table" then return nil end
    name, price, stackCount, numAvailable = info.name, info.price, info.stackCount, info.numAvailable
    purchasable, extended = info.isPurchasable, info.hasExtendedCost
  elseif GetMerchantItemInfo then
    local _
    name, _, price, stackCount, numAvailable, purchasable, _, extended = GetMerchantItemInfo(index)
  else
    return nil
  end
  for _, v in ipairs({ name or false, price or false, stackCount or false, numAvailable or false, purchasable or false, extended or false }) do
    if ns.IsSecret(v) then return nil end
  end
  local maxStack = GetMerchantItemMaxStack and plain(GetMerchantItemMaxStack(index)) or nil
  local link = GetMerchantItemLink and plain(GetMerchantItemLink(index)) or nil
  return {
    index = index, itemID = id, name = link or name, price = price, stackCount = stackCount,
    maxStack = maxStack, numAvailable = numAvailable, extendedCost = extended and true or false, purchasable = purchasable,
  }
end

-- The vendor slots that sell an item of the list.
function ns.ScanMerchant(wanted)
  local slots = {}
  if not GetMerchantNumItems then return slots end
  for index = 1, plain(GetMerchantNumItems()) or 0 do
    local id = merchantItemID(index)
    if id and wanted[id] then
      local slot = ns.ReadMerchantSlot(index)
      if slot then slots[#slots + 1] = slot end
    end
  end
  return slots
end

local function finish(v)
  visit = nil
  local bought = ns.BoughtLine(v.bought, v.spent)
  if bought then ns.Print(bought) end
  local short = ns.ShortLine(v.short)
  if short then ns.Print(short) end
end

local function buyStep(v)
  if v ~= visit then return end -- the vendor was closed in the meantime
  local step, nextIndex = ns.Step(v.buys, v.index, ns.STEP)
  for _, buy in ipairs(step) do
    -- The slot is checked again: the vendor's list may have changed since it was read.
    if merchantItemID(buy.index) == buy.itemID then
      local money = plain(GetMoney())
      if type(money) == "number" and money >= buy.cost then
        BuyMerchantItem(buy.index, buy.quantity)
        ns.Note(v.bought, buy.itemID, buy.name, buy.quantity, buy.cost)
        v.spent = v.spent + buy.cost
      elseif type(money) == "number" then
        ns.Note(v.short, buy.itemID, buy.name, buy.quantity)
      end
    end
  end
  v.index = nextIndex
  if v.index > #v.buys then return finish(v) end
  C_Timer.After(ns.DELAY, function() buyStep(v) end)
end

-- Away from vendors: one chat line for each listed item that dropped below the warning share.
-- force skips the wait after login (a command the player typed).
function ns.CheckStock(force)
  if not ns.db or atVendor or ns.bankOpen or not readyAt then return end
  local share = ns.ValidShare(ns.db.warnShare) or 0
  if share == 0 then return end
  if not force and GetTime then
    local now = plain(GetTime())
    if type(now) ~= "number" or now < readyAt then return end
  end
  local wanted = ns.CleanList(ns.list)
  if not next(wanted) then return end
  local owned = {}
  for id in pairs(wanted) do owned[id] = ns.Owned(id) end
  for _, entry in ipairs(ns.LowStock(owned, wanted, share, ns.warned)) do
    ns.Print(ns.LowLine(entry, ns.ItemName(entry.itemID)))
  end
end

local function onMerchantShow()
  atVendor = true
  if visit or not ns.db or not ns.db.enabled then return end
  if IsShiftKeyDown and IsShiftKeyDown() then return end
  if not (BuyMerchantItem and C_Timer and C_Timer.After) then return end
  local wanted = ns.CleanList(ns.list)
  if not next(wanted) then return end
  local slots = ns.ScanMerchant(wanted)
  if #slots == 0 then return end
  local owned = {}
  for _, slot in ipairs(slots) do
    if owned[slot.itemID] == nil then owned[slot.itemID] = ns.Owned(slot.itemID) or false end
  end
  for id, have in pairs(owned) do if have == false then owned[id] = nil end end
  local plan = ns.Plan(slots, owned, wanted, plain(GetMoney()))
  local v = { buys = plan.buys, index = 1, bought = {}, spent = 0, short = plan.short }
  visit = v
  if #v.buys == 0 then return finish(v) end
  buyStep(v)
end

local function onMerchantClosed()
  atVendor = false
  if visit then finish(visit) end
end

local function onLogin()
  if type(VendorRefillDB) ~= "table" then VendorRefillDB = {} end
  local db = VendorRefillDB
  db.version = 3 -- 2: warnShare (1.1), 3: bank (1.2); a list from 1.0 is kept as it is
  if type(db.enabled) ~= "boolean" then db.enabled = true end
  if type(db.bank) ~= "boolean" then db.bank = true end
  db.warnShare = ns.ValidShare(db.warnShare) or ns.DEFAULT_SHARE
  ns.warned = {}
  local now = GetTime and plain(GetTime()) or nil
  readyAt = (type(now) == "number" and now or 0) + ns.WARN_DELAY
  if type(db.lists) ~= "table" then db.lists = {} end
  local key = ns.CharKey()
  if type(db.lists[key]) ~= "table" then db.lists[key] = {} end
  ns.db = db
  ns.list = db.lists[key]
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
  elseif event == "BAG_UPDATE_DELAYED" then
    ns.CheckStock()
  end
end)

-- Registered one by one: an event a client does not know is skipped.
local function listen(event)
  pcall(frame.RegisterEvent, frame, event)
end

listen("PLAYER_LOGIN")
listen("MERCHANT_SHOW")
listen("MERCHANT_CLOSED")
listen("BAG_UPDATE_DELAYED") -- once after a batch of bag changes: eating, drinking, using an item
