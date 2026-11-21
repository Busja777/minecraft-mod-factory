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

local function infoFunction()
  return C_Item and C_Item.GetItemInfo or GetItemInfo
end

local function vendorPrice(item)
  local getInfo = infoFunction()
  if not getInfo or not item then return nil end
  return plain((select(11, getInfo(item))))
end

-- The item's link as the game knows it; nil while the game has not loaded the item yet.
function ns.ItemLink(id)
  local getInfo = infoFunction()
  if not getInfo then return nil end
  local link = plain((select(2, getInfo(id))))
  return type(link) == "string" and link or nil
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

-- Whether the gear is still damaged, as far as the game tells.
local function stillDamaged()
  if not GetRepairAllCost then return false end
  local cost = plain((GetRepairAllCost()))
  return type(cost) == "number" and cost > 0
end

-- 1.2: true when the guild bank may and can pay this repair now. Every answer the game does not
-- give, or gives as a secret, counts as "no": then the player's own gold pays, as in 1.0 and 1.1.
local function guildPays(v, cost)
  if not ns.settings.guild or v.noGuild then return false end
  if not (CanGuildBankRepair and GetGuildBankWithdrawMoney and GetGuildBankMoney) then return false end
  if IsInGuild and not plain(IsInGuild()) then return false end
  if not plain(CanGuildBankRepair()) then return false end
  return ns.GuildCanPay(cost, plain(GetGuildBankWithdrawMoney()), plain(GetGuildBankMoney()))
end

-- Repairs, from the guild bank when that is switched on and it can pay, otherwise from the player's
-- own gold. Notes the cost paid, or the cost the gold did not reach for.
local function repair(v)
  if v.repaired or not ns.settings.repair then return end
  if not (CanMerchantRepair and GetRepairAllCost and RepairAllItems) then return end
  if not plain(CanMerchantRepair()) then return end
  local cost, possible = GetRepairAllCost()
  cost, possible = plain(cost), plain(possible)
  v.short = nil
  if possible and guildPays(v, cost) then
    RepairAllItems(true)
    v.repaired, v.guild = cost, true
    return
  end
  local ok, why = ns.ShouldRepair(cost, plain(GetMoney()), possible)
  if ok then
    RepairAllItems()
    v.repaired = cost
  elseif why == "poor" then
    v.short = cost
  end
end

local function finish(v, closed)
  visit = nil
  if not closed and v.guild and stillDamaged() then
    -- The guild bank did not pay after all (less gold or a smaller daily limit than the game
    -- told before): the player's own gold pays, as without the guild setting.
    v.repaired, v.guild, v.noGuild = nil, nil, true
    repair(v)
  elseif not closed and v.short and v.items > 0 then
    -- The gold was short before the sale; now it may reach.
    repair(v)
  end
  local line = ns.Summary(v)
  if line then ns.Print(line) end
end

local function sellStep(v)
  if v ~= visit then return end -- the vendor was closed in the meantime
  if v.index > #v.plan then
    -- A guild bank repair is checked once the game had time to answer it.
    if v.guild and not v.waited then
      v.waited = true
      return C_Timer.After(ns.GUILD_WAIT, function() sellStep(v) end)
    end
    return finish(v)
  end
  local step, nextIndex = ns.Step(v.plan, v.index, ns.STEP)
  for _, planned in ipairs(step) do
    -- The slot is read again: something may have moved since the bags were scanned.
    local item = ns.ReadSlot(planned.bag, planned.slot)
    if item and item.id == planned.id and ns.Sellable(item) and ns.IsKept(ns.db.keep, item.id) then
      v.kept = v.kept + item.count -- put on the keep list during the visit
    elseif item and item.id == planned.id and ns.Sellable(item) then
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
  local v = { items = 0, earned = 0, kept = 0, index = 1, plan = {} }
  visit = v
  repair(v)
  if ns.settings.sell and C_Container and C_Container.UseContainerItem then v.plan, v.kept = ns.SellPlan(ns.ScanBags(), ns.db.keep) end
  sellStep(v)
end

local function onMerchantClosed()
  if visit then finish(visit, true) end
end

local function onLogin()
  if type(JunkButlerDB) ~= "table" then JunkButlerDB = {} end
  local db = JunkButlerDB
  db.version = 3 -- 3 (1.2): the guild bank setting, off until the player switches it on
  if type(db.settings) ~= "table" then db.settings = {} end
  db.keep = ns.CleanKeepList(db.keep) -- new in 1.1; 1.0 data has none and starts with an empty list
  if db.settings.sell == nil then db.settings.sell = true end
  if db.settings.repair == nil then db.settings.repair = true end
  if type(db.settings.guild) ~= "boolean" then db.settings.guild = false end
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
