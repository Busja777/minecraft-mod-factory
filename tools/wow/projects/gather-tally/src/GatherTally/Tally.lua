local _, ns = ...
local L = ns.L

-- Reads each loot window once (autoloot included) and counts the herbs and ores in it.
-- No combat log: only the loot window the game shows the player.

ns.session = ns.NewSession(GetTime())

local counted = false -- the current loot window has been counted

function ns.Print(msg)
  DEFAULT_CHAT_FRAME:AddMessage("|cffffd100" .. L["Gather Tally"] .. ":|r " .. msg)
end

-- itemID, classID, subclassID of an item link, from the client's item cache.
local function itemInfo(link)
  local fn = (C_Item and C_Item.GetItemInfoInstant) or GetItemInfoInstant
  if not fn or type(link) ~= "string" then return nil end
  local itemID, _, _, _, _, classID, subclassID = fn(link)
  return itemID, classID, subclassID
end

-- Every herb and ore in the open loot window, as plain records.
function ns.ReadLoot()
  local entries = {}
  if not GetNumLootItems or not GetLootSlotInfo or not GetLootSlotLink then return entries end
  local n = ns.Plain(GetNumLootItems())
  if type(n) ~= "number" then return entries end
  for slot = 1, n do
    local slotType = GetLootSlotType and GetLootSlotType(slot) or ns.LOOT_SLOT_ITEM
    if ns.Plain(slotType) == ns.LOOT_SLOT_ITEM then
      local _, name, quantity = GetLootSlotInfo(slot)
      local link = ns.Plain(GetLootSlotLink(slot))
      local itemID, classID, subclassID = itemInfo(link)
      local entry = ns.LootEntry(slotType, link, name, quantity, itemID, classID, subclassID)
      if entry then entries[#entries + 1] = entry end
    end
  end
  return entries
end

local function onLootReady()
  if counted then return end
  local n = GetNumLootItems and ns.Plain(GetNumLootItems())
  if type(n) ~= "number" or n < 1 then return end -- not ready yet: a later event may count it
  counted = true
  local now = GetTime()
  local any = false
  for _, entry in ipairs(ns.ReadLoot()) do
    ns.Add(ns.session, entry, now)
    any = true
  end
  if any and ns.Refresh then ns.Refresh() end
end

function ns.Reset()
  ns.session = ns.NewSession(GetTime())
  if ns.Refresh then ns.Refresh() end
end

local function onLogin()
  GatherTallyDB = GatherTallyDB or {}
  local db = GatherTallyDB
  db.version = 1
  db.settings = db.settings or {}
  ns.db = db
  ns.settings = db.settings
  ns.session = ns.NewSession(GetTime())
  counted = false
  if ns.CreateDisplay then ns.CreateDisplay() end
  if ns.Refresh then ns.Refresh() end
end

local frame = CreateFrame("Frame")
ns.eventFrame = frame

frame:SetScript("OnEvent", function(_, event)
  if event == "PLAYER_LOGIN" then
    onLogin()
  elseif event == "LOOT_READY" or event == "LOOT_OPENED" then
    onLootReady()
  elseif event == "LOOT_CLOSED" then
    counted = false
  end
end)

frame:RegisterEvent("PLAYER_LOGIN")
frame:RegisterEvent("LOOT_READY")
frame:RegisterEvent("LOOT_OPENED") -- fallback, the window is still counted only once
frame:RegisterEvent("LOOT_CLOSED")
