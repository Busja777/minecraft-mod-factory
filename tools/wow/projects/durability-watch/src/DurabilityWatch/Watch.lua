local _, ns = ...
local L = ns.L

-- Reads the durability of the equipped gear, warns when an item is about to break and
-- tells the repair cost at a vendor. It never repairs by itself. On the way into a dungeon or
-- raid it tells you to repair first when the gear is worn. Since 1.2 it notes the repair cost of
-- every vendor visit with damaged gear, and whether you repaired with your gold or guild money.

ns.warning = { armed = true }
ns.instanceState = { warnedFor = nil }
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

-- The level of the check before instances, nil when it is switched off.
function ns.InstanceLevel()
  local s = ns.settings
  if not s or not s.instanceWarn then return nil end
  return s.instanceLevel
end

-- 1.2: the vendor visit going on right now: { entry, missing, max, how }. A repair shows as less
-- missing durability with the same gear; how is "guild" when Repair All was clicked for guild money.
ns.visit = nil

local function checkRepair(items)
  local v = ns.visit
  if not v then return end
  local missing, max = ns.Wear(items)
  if max == v.max and missing < v.missing then
    ns.MarkPaid(v.entry, v.how or "gold")
    v.missing = missing
  end
end

function ns.Recount()
  if not ns.settings then return end
  local items = ns.ReadGear()
  checkRepair(items)
  local cond = ns.Condition(items)
  ns.items = items
  ns.condition = cond
  if ns.Warning(ns.warning, cond.lowest, ns.settings.warn) then warn(cond) end
  ns.InstanceRearm(ns.instanceState, cond.lowest, ns.InstanceLevel())
  if ns.Refresh then ns.Refresh() end
end

-- The dungeon or raid you are in as { kind, name, key }, nil outside an instance or when the
-- game does not tell. The key tells instances apart: the instance ID, else the name.
function ns.ReadPlace()
  if not IsInInstance then return nil end
  local inside, kind = IsInInstance()
  if ns.IsSecret(inside) or ns.IsSecret(kind) or not inside or type(kind) ~= "string" then return nil end
  local place = { kind = kind }
  if GetInstanceInfo then
    local name, _, _, _, _, _, _, id = GetInstanceInfo()
    name, id = plain(name), plain(id)
    if type(name) == "string" and name ~= "" then place.name = name end
    if type(id) == "number" and id > 0 then place.key = id end
  end
  place.key = place.key or place.name or kind
  return place
end

local function warnInstance(place, cond)
  local name = L[ns.SLOT_LABEL[cond.lowestSlot] or "Other"]
  if UIErrorsFrame and UIErrorsFrame.AddMessage then
    UIErrorsFrame:AddMessage(string.format(L["Repair first: %s is at %d%% durability"], name, cond.lowest), 1, 0.25, 0.25)
  end
  local item = ns.ItemText(cond.lowestSlot)
  local text
  if place.name then
    text = string.format(L["You are entering %s with %s at %d%% durability. Repair first."], place.name, item, cond.lowest)
  elseif place.kind == "raid" then
    text = string.format(L["You are entering a raid with %s at %d%% durability. Repair first."], item, cond.lowest)
  else
    text = string.format(L["You are entering a dungeon with %s at %d%% durability. Repair first."], item, cond.lowest)
  end
  ns.Print(text)
end

-- After a loading screen or a new zone: one warning when this is a dungeon or raid and the gear
-- is worn. After /reload inside an instance you have been told already, so it only takes note.
function ns.CheckInstance(reloading)
  if not ns.settings then return end
  local place = ns.ReadPlace()
  if ns.InstanceWarning(ns.instanceState, place, ns.condition.lowest, ns.InstanceLevel()) and not reloading then
    warnInstance(place, ns.condition)
  end
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
  local entry = ns.AddVisit(ns.History(), time(), cost)
  if entry then
    local missing, max = ns.Wear(ns.items)
    ns.visit = { entry = entry, missing = missing, max = max }
  end
end

local function onMerchantClosed()
  if not ns.settings then return end
  ns.Recount() -- a repair the game reported only now still counts
  ns.visit = nil
end

-- The Repair All button of the vendor window: RepairAllItems(true) pays with guild money.
local function onRepairAll(guildBankRepair)
  if ns.visit then ns.visit.how = guildBankRepair and "guild" or "gold" end
end

if hooksecurefunc and RepairAllItems then hooksecurefunc("RepairAllItems", onRepairAll) end

-- The character the history belongs to: "Name-Realm".
function ns.CharKey()
  local name = UnitName and plain(UnitName("player"))
  local realm = GetRealmName and plain(GetRealmName())
  if type(name) ~= "string" or name == "" then name = "?" end
  if type(realm) ~= "string" or realm == "" then realm = "?" end
  return name .. "-" .. realm
end

-- The repair visits of the character you are playing, oldest first.
function ns.History()
  local key = ns.CharKey()
  local list = ns.db.history[key]
  if type(list) ~= "table" then
    list = {}
    ns.db.history[key] = list
  end
  return list
end

local function onLogin()
  if type(DurabilityWatchDB) ~= "table" then DurabilityWatchDB = {} end
  local db = DurabilityWatchDB
  -- 2: the check before instances (1.1); 3: the repair cost history (1.2). Older settings are kept.
  db.version = 3
  if type(db.settings) ~= "table" then db.settings = {} end
  if type(db.history) ~= "table" then db.history = {} end
  for key, list in pairs(db.history) do
    local clean = ns.CleanHistory(list)
    db.history[key] = #clean > 0 and clean or nil
  end
  local s = db.settings
  s.warn = ns.ValidWarn(s.warn) or ns.DEFAULT_WARN
  s.locked = s.locked == true
  s.hidden = s.hidden == true
  s.instanceWarn = s.instanceWarn ~= false -- on unless switched off
  s.instanceLevel = ns.ValidWarn(s.instanceLevel) or ns.DEFAULT_INSTANCE
  ns.db = db
  ns.settings = s
  if ns.CreateDisplay then ns.CreateDisplay() end
  ns.Recount()
end

local frame = CreateFrame("Frame")
ns.eventFrame = frame

frame:SetScript("OnEvent", function(_, event, ...)
  if event == "PLAYER_LOGIN" then
    onLogin()
  elseif event == "MERCHANT_SHOW" then
    onMerchantShow()
  elseif event == "MERCHANT_CLOSED" then
    onMerchantClosed()
  elseif event == "PLAYER_ENTERING_WORLD" or event == "ZONE_CHANGED_NEW_AREA" then
    if not ns.settings then return end
    local reloading = false
    if event == "PLAYER_ENTERING_WORLD" then reloading = select(2, ...) == true end
    ns.Recount()
    ns.CheckInstance(reloading)
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
listen("MERCHANT_CLOSED")
listen("PLAYER_ENTERING_WORLD")
listen("ZONE_CHANGED_NEW_AREA")
