local _, ns = ...
local L = ns.L

-- /vr shows the help and the state; add, remove, list, on, off and warn change the list or the settings.

local function warnText()
  local share = ns.ValidShare(ns.db.warnShare) or 0
  if share == 0 then return L["The low stock warning is off."] end
  return string.format(L["Low stock warning below %d%% of your count."], share)
end

local function stateText()
  local n = ns.CountList(ns.list)
  local state = ns.db.enabled and L["Refilling is on."] or L["Refilling is off."]
  if n == 0 then return state .. " " .. L["Your list is empty."] .. " " .. warnText() end
  if n == 1 then return state .. " " .. L["1 item is on your list."] .. " " .. warnText() end
  return state .. " " .. string.format(L["%d items are on your list."], n) .. " " .. warnText()
end

local function helpText()
  return L["/vr add <item> <count> keeps an item stocked, /vr remove <item> takes it off, /vr list shows your list, /vr on and /vr off switch refilling, /vr warn <percent> or /vr warn off sets the low stock warning. Use an item link (Shift-click the item) or an item ID. Hold Shift while you open a vendor to skip one visit."]
end

-- The item as the player named it: the link they gave, else its name, else its ID.
local function label(id, text)
  if type(text) == "string" and text:find("|H", 1, true) then return text end
  return ns.ItemName(id) or string.format(L["item %d"], id)
end

local function add(rest)
  local id, count = ns.ParseAdd(rest)
  if not id then
    if count == "count" then
      ns.Print(string.format(L["The count must be a whole number from 1 to %d."], ns.MAX_WANTED))
    else
      ns.Print(L["Use /vr add <item link or item ID> <count>."])
    end
    return
  end
  ns.list[id] = count
  local itemText = strtrim(rest):match("^(.-)%s+%d+$")
  ns.Print(string.format(L["%s: keeping %d in your bags."], label(id, itemText), count))
end

local function remove(rest)
  local id = ns.ParseItem(rest)
  if not id then
    ns.Print(L["Use /vr remove <item link or item ID>."])
  elseif ns.list[id] == nil then
    ns.Print(string.format(L["%s is not on your list."], label(id, rest)))
  else
    ns.list[id] = nil
    ns.warned[id] = nil
    ns.Print(string.format(L["%s is off your list."], label(id, rest)))
  end
end

local function warn(rest)
  if strtrim(rest) == "" then
    ns.Print(warnText())
    return
  end
  local share = ns.ParseShare(rest)
  if not share then
    ns.Print(string.format(L["The warning must be a whole percent from 1 to %d, or off."], ns.MAX_SHARE))
    return
  end
  ns.db.warnShare = share
  ns.warned = {} -- the new share counts from now on
  ns.Print(warnText())
  ns.CheckStock(true)
end

local function list()
  local lines = ns.ListLines(ns.list, ns.ItemName)
  if #lines == 0 then
    ns.Print(L["Your list is empty. Add an item with /vr add <item> <count>."])
    return
  end
  ns.Print(L["Your list:"])
  for _, line in ipairs(lines) do ns.Print("  " .. line) end
end

SLASH_VENDORREFILL1 = "/vendorrefill"
SLASH_VENDORREFILL2 = "/vr"
SlashCmdList.VENDORREFILL = function(msg)
  if not ns.db then return end
  local cmd, rest = strtrim(msg or ""):match("^(%S*)%s*(.-)$")
  cmd = cmd:lower()
  if cmd == "" then
    ns.Print(stateText())
    ns.Print(helpText())
  elseif cmd == "add" then
    add(rest)
  elseif cmd == "remove" then
    remove(rest)
  elseif cmd == "list" then
    list()
  elseif cmd == "warn" then
    warn(rest)
  elseif cmd == "on" or cmd == "off" then
    ns.db.enabled = cmd == "on"
    ns.Print(ns.db.enabled and L["Refilling is on."] or L["Refilling is off."])
  else
    ns.Print(helpText())
  end
end
