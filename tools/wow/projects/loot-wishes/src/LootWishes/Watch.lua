local _, ns = ...
local L = ns.L

-- Watches what the game shows the player: the loot window, loot rolls, loot lines in chat and the
-- merchant window. No combat log. Anything the game hands out as a secret value is skipped.

ns.SOUND_GAP = 2 -- seconds between two alert sounds

local lootSeen = {}      -- item IDs already reported for the open loot window
local merchantSeen = nil -- item IDs already reported for the open merchant window (nil: closed)
local rollsSeen = {}     -- roll IDs already reported
local pending = {}       -- item IDs added by number whose name the game has not sent yet
local lastSound
local patterns

function ns.Print(msg)
  DEFAULT_CHAT_FRAME:AddMessage("|cffffd100" .. L["Loot Wishes"] .. ":|r " .. msg)
end

-- A value read from the game; nil when the function is missing, fails or the value is secret.
local function read(fn, ...)
  if not fn then return nil end
  local ok, a = pcall(fn, ...)
  if not ok then return nil end
  return ns.Plain(a)
end
ns.Read = read

local function now()
  return read(time) or 0
end

local function alert()
  if not ns.db or not ns.db.settings.sound then return end
  local t = read(GetTime)
  if t and lastSound and t - lastSound < ns.SOUND_GAP then return end
  lastSound = t
  if PlaySound and SOUNDKIT and SOUNDKIT.RAID_WARNING then pcall(PlaySound, SOUNDKIT.RAID_WARNING) end
end

-- Reports a hit on a wish in chat (with the link the game showed) and plays the alert.
function ns.Report(kind, w, link, who)
  ns.Record(w, kind, now())
  ns.Print(ns.HitText(kind, ns.WishText(w, link), who))
  alert()
end

-- Name and link of an item from the client's cache; nil while the game has not loaded it.
function ns.ItemInfo(id)
  local fn = (C_Item and C_Item.GetItemInfo) or GetItemInfo
  if not fn then return nil end
  local ok, name, link = pcall(fn, id)
  if not ok then return nil end
  name, link = ns.Plain(name), ns.Plain(link)
  if type(name) ~= "string" then name = nil end
  if type(link) ~= "string" then link = nil end
  return name, link
end

-- Asks the game to load an item it has not cached; GET_ITEM_INFO_RECEIVED follows.
-- → false when the game offers no way to ask.
function ns.RequestItem(id)
  local fn = C_Item and C_Item.RequestLoadItemDataByID
  if not fn then return false end
  pending[id] = true
  pcall(fn, id)
  return true
end

-- ── loot window ───────────────────────────────────────────────────────────────────────────────
local function scanLoot()
  if not ns.db then return end
  local n = read(GetNumLootItems)
  if type(n) ~= "number" then return end
  for slot = 1, n do
    local link = read(GetLootSlotLink, slot)
    local id = ns.LinkID(link)
    local w = id and ns.db.wishes[id]
    if w and not lootSeen[id] then
      lootSeen[id] = true
      ns.Report("loot", w, link)
    end
  end
end

-- ── loot rolls ────────────────────────────────────────────────────────────────────────────────
local function onRoll(rollID)
  if not ns.db or rollID == nil or ns.IsSecret(rollID) or rollsSeen[rollID] then return end
  local link = read(GetLootRollItemLink, rollID)
  local id = ns.LinkID(link)
  if not id then return end
  rollsSeen[rollID] = true
  local w = ns.db.wishes[id]
  if w then ns.Report("roll", w, link) end
end

-- ── loot lines in chat ────────────────────────────────────────────────────────────────────────
local function onLootLine(text)
  if not ns.db or type(text) ~= "string" or ns.IsSecret(text) then return end
  patterns = patterns or ns.LootPatterns()
  local who = ns.Looter(text, patterns)
  if not who or not text:find("|Hitem:", 1, true) then return end -- only linked items, never typed numbers
  for _, item in ipairs(ns.ParseItems(text)) do
    local w = ns.db.wishes[item.id]
    if w then
      if who == "self" then ns.Report("got", w, item.link) else ns.Report("other", w, item.link, who) end
    end
  end
end

-- ── merchant ──────────────────────────────────────────────────────────────────────────────────
local function scanMerchant()
  if not ns.db or not merchantSeen then return end
  local n = read(GetMerchantNumItems)
  if type(n) ~= "number" then return end
  for i = 1, n do
    local link = read(GetMerchantItemLink, i)
    local id = read(GetMerchantItemID, i)
    if type(id) ~= "number" then id = ns.LinkID(link) end
    local w = id and ns.db.wishes[id]
    if w and not merchantSeen[id] then
      merchantSeen[id] = true
      ns.Report("merchant", w, link)
    end
  end
end

local function merchantOpened()
  if not ns.db or merchantSeen then return end -- MERCHANT_SHOW and the interaction event both arrive
  merchantSeen = {}
  scanMerchant()
end

-- ── item data ─────────────────────────────────────────────────────────────────────────────────
local function onItemInfo(id, success)
  if not ns.db or type(id) ~= "number" or not pending[id] then return end
  pending[id] = nil
  local w = ns.db.wishes[id]
  if not w then return end
  if success == false then
    ns.db.wishes[id] = nil
    ns.Print(string.format(L["There is no item with the ID %d, it was not added."], id))
    return
  end
  local name, link = ns.ItemInfo(id)
  w.name = w.name or name
  w.link = w.link or link
  ns.Print(string.format(L["Added to your wish list: %s"], ns.WishText(w)))
end

local function onLogin()
  LootWishesDB = LootWishesDB or {}
  local db = LootWishesDB
  db.version = 1
  db.wishes = db.wishes or {}
  db.settings = db.settings or {}
  if db.settings.sound == nil then db.settings.sound = true end
  ns.db = db
end

local MERCHANT = Enum and Enum.PlayerInteractionType and Enum.PlayerInteractionType.Merchant

local frame = CreateFrame("Frame")
ns.eventFrame = frame

frame:SetScript("OnEvent", function(_, event, ...)
  if event == "PLAYER_LOGIN" then
    onLogin()
  elseif event == "LOOT_READY" or event == "LOOT_OPENED" then
    scanLoot()
  elseif event == "LOOT_CLOSED" then
    lootSeen = {}
  elseif event == "START_LOOT_ROLL" then
    onRoll((...))
  elseif event == "CHAT_MSG_LOOT" then
    onLootLine((...))
  elseif event == "MERCHANT_SHOW" then
    merchantOpened()
  elseif event == "MERCHANT_UPDATE" then
    scanMerchant()
  elseif event == "MERCHANT_CLOSED" then
    merchantSeen = nil
  elseif event == "PLAYER_INTERACTION_MANAGER_FRAME_SHOW" then
    if MERCHANT and (...) == MERCHANT then merchantOpened() end
  elseif event == "PLAYER_INTERACTION_MANAGER_FRAME_HIDE" then
    if MERCHANT and (...) == MERCHANT then merchantSeen = nil end
  elseif event == "GET_ITEM_INFO_RECEIVED" then
    onItemInfo(...)
  end
end)

for _, event in ipairs({
  "PLAYER_LOGIN", "LOOT_READY", "LOOT_OPENED", "LOOT_CLOSED", "START_LOOT_ROLL", "CHAT_MSG_LOOT",
  "MERCHANT_SHOW", "MERCHANT_UPDATE", "MERCHANT_CLOSED",
  "PLAYER_INTERACTION_MANAGER_FRAME_SHOW", "PLAYER_INTERACTION_MANAGER_FRAME_HIDE", "GET_ITEM_INFO_RECEIVED",
}) do
  pcall(frame.RegisterEvent, frame, event)
end
