local _, ns = ...
local L = ns.L

-- Reads the durability of the equipped gear, warns when an item is about to break and
-- tells the repair cost at a vendor. It never repairs by itself.

ns.warning = { armed = true }
ns.condition = ns.Condition({})

function ns.Print(msg)
  DEFAULT_CHAT_FRAME:AddMessage("|cffffd100" .. L["Durability Watch"] .. ":|r " .. msg)
end

-- A value read from the game; nil when it is missing or must not be used.
local function plain(value)
  if value == nil or ns.IsSecret(value) then return nil end
  return value
end

-- Every equipped item that has durability, as the plain records Core.lua works with.
function ns.ReadGear()
  local items = {}
  if not GetInventoryItemDurability then return items end
  for _, slot in ipairs(ns.SLOTS) do
    local cur, max = GetInventoryItemDurability(slot)
    cur, max = plain(cur), plain(max)
    if type(cur) == "number" and type(max) == "number" and max > 0 then
      items[#items + 1] = { slot = slot, cur = cur, max = max }
    end
  end
  return items
end

-- The slot name, followed by the item link when the game gives one.
function ns.ItemText(slot)
  local name = L[ns.SLOT_LABEL[slot] or "Other"]
  local link = GetInventoryItemLink and plain(GetInventoryItemLink("player", slot))
  if type(link) == "string" and link ~= "" then return name .. ": " .. link end
  return name
end

local function warn(cond)
  local name = L[ns.SLOT_LABEL[cond.lowestSlot] or "Other"]
  if UIErrorsFrame and UIErrorsFrame.AddMessage then
    UIErrorsFrame:AddMessage(string.format(L["%s is at %d%% durability"], name, cond.lowest), 1, 0.25, 0.25)
  end
  ns.Print(string.format(L["%s is at %d%% durability. Time to repair."], ns.ItemText(cond.lowestSlot), cond.lowest))
end

function ns.Recount()
  if not ns.settings then return end
  local cond = ns.Condition(ns.ReadGear())
  ns.condition = cond
  if ns.Warning(ns.warning, cond.lowest, ns.settings.warn) then warn(cond) end
  if ns.Refresh then ns.Refresh() end
end

-- One line with the price of a full repair, only when something is damaged.
local function onMerchantShow()
  if not ns.settings then return end
  ns.Recount()
  if #ns.condition.damaged == 0 then return end
  if not (CanMerchantRepair and GetRepairAllCost) then return end
  if not plain(CanMerchantRepair()) then return end
  local cost = plain((GetRepairAllCost()))
  if type(cost) ~= "number" or cost <= 0 then return end
  ns.Print(string.format(L["Repairing all your gear here costs %s."], ns.FormatMoney(cost)))
end

local function onLogin()
  if type(DurabilityWatchDB) ~= "table" then DurabilityWatchDB = {} end
  local db = DurabilityWatchDB
  db.version = 1
  if type(db.settings) ~= "table" then db.settings = {} end
  local s = db.settings
  s.warn = ns.ValidWarn(s.warn) or ns.DEFAULT_WARN
  s.locked = s.locked == true
  s.hidden = s.hidden == true
  ns.db = db
  ns.settings = s
  if ns.CreateDisplay then ns.CreateDisplay() end
  ns.Recount()
end

local frame = CreateFrame("Frame")
ns.eventFrame = frame

frame:SetScript("OnEvent", function(_, event)
  if event == "PLAYER_LOGIN" then
    onLogin()
  elseif event == "MERCHANT_SHOW" then
    onMerchantShow()
  else
    ns.Recount()
  end
end)

-- Registered one by one: an event a client does not know is skipped.
local function listen(event)
  pcall(frame.RegisterEvent, frame, event)
end

listen("PLAYER_LOGIN")
listen("UPDATE_INVENTORY_DURABILITY")
listen("PLAYER_EQUIPMENT_CHANGED")
listen("MERCHANT_SHOW")
