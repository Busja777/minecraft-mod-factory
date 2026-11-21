local _, ns = ...
local L = ns.L

-- 1.2: while the bank is open (and refilling and its bank part are switched on), items of the list move from the bank (character bank and Warband bank)
-- into the bags until the bags hold the count you want. One move at a time, nothing else is touched,
-- nothing happens in combat or while the cursor holds an item. A client without the functions for it
-- simply does nothing here.

local run -- the running bank visit; nil when the bank is closed or the work is done
ns.bankOpen = false -- the bank window is open: no low stock warnings then

local CHARACTER_TABS = { "CharacterBankTab_1", "CharacterBankTab_2", "CharacterBankTab_3", "CharacterBankTab_4", "CharacterBankTab_5", "CharacterBankTab_6" }
local ACCOUNT_TABS = { "AccountBankTab_1", "AccountBankTab_2", "AccountBankTab_3", "AccountBankTab_4", "AccountBankTab_5" }

-- A value read from the game; nil when it is missing or must not be used.
local function plain(value)
  if value == nil or ns.IsSecret(value) then return nil end
  return value
end

-- Every game function a move needs. Without one of them the bank is left alone.
local function ready()
  return C_Container and C_Container.GetContainerNumSlots and C_Container.GetContainerItemInfo
    and C_Container.PickupContainerItem and C_Container.SplitContainerItem
    and CursorHasItem and ClearCursor and InCombatLockdown and C_Timer and C_Timer.After
    and Enum and Enum.BagIndex and true or false
end

-- The cursor holds an item. A value that cannot be read counts as yes.
local function holding()
  local h = CursorHasItem()
  return h ~= false and h ~= nil
end

-- In combat, or the player holds an item: no move now.
local function busy()
  local combat = InCombatLockdown()
  return (combat ~= false and combat ~= nil) or holding()
end

-- true unless the game says this kind of bank cannot be used here.
local function canUse(kind)
  if not (C_Bank and C_Bank.CanUseBank and Enum.BankType and Enum.BankType[kind] ~= nil) then return true end
  local ok, yes = pcall(C_Bank.CanUseBank, Enum.BankType[kind])
  return ok and yes == true
end

-- The bank's containers this client knows: the character bank tabs, then the Warband bank tabs.
local function bankBags()
  local bags, seen = {}, {}
  local function add(names)
    for _, name in ipairs(names) do
      local id = Enum.BagIndex[name]
      if type(id) == "number" and not seen[id] then
        seen[id] = true
        bags[#bags + 1] = id
      end
    end
  end
  if canUse("Character") then add(CHARACTER_TABS) end
  if canUse("Account") then add(ACCOUNT_TABS) end
  return bags
end

-- The slots of some containers as plain records { bag, slot, itemID (nil = empty), count, locked, name }.
-- A slot that cannot be read is kept as occupied (itemID false), so it is neither taken nor filled.
local function readSlots(bags)
  local slots = {}
  for _, bag in ipairs(bags) do
    local n = plain(C_Container.GetContainerNumSlots(bag))
    for slot = 1, type(n) == "number" and n or 0 do
      local info = C_Container.GetContainerItemInfo(bag, slot)
      if info == nil then
        slots[#slots + 1] = { bag = bag, slot = slot }
      elseif type(info) == "table" and not ns.IsSecret(info) then
        local id, count = plain(info.itemID), plain(info.stackCount)
        local locked = info.isLocked
        if type(id) ~= "number" or type(count) ~= "number" then id, count = false, 0 end
        slots[#slots + 1] = { bag = bag, slot = slot, itemID = id, count = count, locked = locked ~= false and locked ~= nil, name = plain(info.hyperlink) }
      else
        slots[#slots + 1] = { bag = bag, slot = slot, itemID = false, count = 0, locked = true }
      end
    end
  end
  return slots
end

-- The backpack and the four normal bags; bags for one profession only are left out.
local function bagSlots()
  local bags = {}
  for bag = 0, (type(NUM_BAG_SLOTS) == "number" and NUM_BAG_SLOTS or 4) do
    local family
    if C_Container.GetContainerNumFreeSlots then family = select(2, C_Container.GetContainerNumFreeSlots(bag)) end
    family = plain(family)
    if family == nil or family == 0 then bags[#bags + 1] = bag end
  end
  return readSlots(bags)
end

-- The most of an item one bag slot holds; nil when the game does not say.
local function maxStack(itemID)
  local n
  if C_Item and C_Item.GetItemMaxStackSizeByID then
    n = C_Item.GetItemMaxStackSizeByID(itemID)
  elseif GetItemInfo then
    n = select(8, GetItemInfo(itemID))
  end
  n = plain(n)
  return type(n) == "number" and n or nil
end

-- The chat lines. What arrived is counted again in the bags, so a move the game took back is not
-- reported; the own tally of the moves is only the upper limit.
local function report(r)
  if r.reported then return end
  r.reported = true
  if run == r then run = nil end
  local now = {}
  for id in pairs(r.before or {}) do now[id] = ns.Owned(id) end
  local taken = ns.TakenLine(ns.Arrived(r.taken, r.before, now))
  if taken then ns.Print(taken) end
  if r.full then ns.Print(L["Your bags are full, the rest stays in the bank."]) end
end

-- No more moves. The bags are counted a moment later (or when the bank closes, if that comes first).
local function finish(r)
  if r ~= run or r.done then return end
  r.done = true
  if #r.taken == 0 then return report(r) end
  C_Timer.After(ns.BANK_REPORT_DELAY, function() report(r) end)
end

-- Refilling as a whole and the bank part both switched on.
local function allowed()
  return ns.db and ns.db.enabled and ns.db.bank and true or false
end

-- One move: the next stack (or part of a stack) out of the bank into a bag slot.
local function step(r)
  if r ~= run or r.done then return end -- the bank was closed in the meantime
  if busy() or not allowed() then return finish(r) end
  local move = ns.NextBankMove(readSlots(r.bags), r.need)
  if not move then return finish(r) end
  local bag, slot = ns.BagTarget(bagSlots(), move.itemID, move.count, maxStack(move.itemID))
  if not bag then
    r.full = true
    return finish(r)
  end
  if move.whole then
    C_Container.PickupContainerItem(move.bag, move.slot)
  else
    C_Container.SplitContainerItem(move.bag, move.slot, move.count)
  end
  if not holding() then return finish(r) end -- the game did not hand the item over
  C_Container.PickupContainerItem(bag, slot)
  if holding() then
    -- The bag did not take it: it goes back where it came from, and the visit ends here.
    ClearCursor()
    return finish(r)
  end
  r.need[move.itemID] = r.need[move.itemID] - move.count
  ns.Note(r.taken, move.itemID, ns.ItemName(move.itemID) or move.name, move.count)
  C_Timer.After(ns.BANK_DELAY, function() step(r) end)
end

-- What the bags miss is counted once, when the bank has had a moment to fill in.
local function begin(r)
  if r ~= run then return end
  if busy() or not allowed() then return finish(r) end
  local wanted = ns.CleanList(ns.list)
  local owned = {}
  for id in pairs(wanted) do owned[id] = ns.Owned(id) end
  r.need = ns.BankNeed(owned, wanted)
  r.before = {}
  for id in pairs(r.need) do r.before[id] = owned[id] end
  r.bags = bankBags()
  if not next(r.need) or #r.bags == 0 then return finish(r) end
  step(r)
end

local function onOpen()
  if ns.bankOpen then return end -- the bank tells it twice: the old and the new event
  ns.bankOpen = true
  if run or not allowed() then return end
  if IsShiftKeyDown and IsShiftKeyDown() then return end
  if not ready() then return end
  if not next(ns.CleanList(ns.list)) then return end
  local r = { taken = {} }
  run = r
  C_Timer.After(ns.BANK_DELAY, function() begin(r) end)
end

local function onClose()
  if not ns.bankOpen then return end
  ns.bankOpen = false
  if run then
    run.done = true -- no more moves after the bank is closed
    report(run)
  end
end

local function isBank(kind)
  local types = Enum and Enum.PlayerInteractionType
  if type(types) ~= "table" or kind == nil or ns.IsSecret(kind) then return false end
  return kind == types.Banker or kind == types.AccountBanker
end

local frame = CreateFrame("Frame")
ns.bankFrame = frame

frame:SetScript("OnEvent", function(_, event, kind)
  if event == "BANKFRAME_OPENED" then
    onOpen()
  elseif event == "BANKFRAME_CLOSED" then
    onClose()
  elseif event == "PLAYER_INTERACTION_MANAGER_FRAME_SHOW" then
    if isBank(kind) then onOpen() end
  elseif event == "PLAYER_INTERACTION_MANAGER_FRAME_HIDE" then
    if isBank(kind) then onClose() end
  end
end)

local function listen(event)
  pcall(frame.RegisterEvent, frame, event)
end

listen("BANKFRAME_OPENED")
listen("BANKFRAME_CLOSED")
listen("PLAYER_INTERACTION_MANAGER_FRAME_SHOW") -- the Warband bank opens through this one
listen("PLAYER_INTERACTION_MANAGER_FRAME_HIDE")
