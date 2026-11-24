local _, ns = ...
local L = ns.L

-- /lw add, /lw remove, /lw list, /lw sound and /lw help.

local function help()
  ns.Print(L["/lw add <item> puts an item on your wish list (shift-click the item into the chat line, or type its item ID), /lw remove <item or number> takes it off, /lw list shows the list, /lw sound on or off switches the alert sound."])
end

local function add(rest)
  local items = ns.ParseItems(rest)
  if #items == 0 then
    ns.Print(L["Shift-click an item into the chat line after /lw add, or type its item ID: /lw add 19019."])
    return
  end
  for _, item in ipairs(items) do
    local name, link = ns.ItemInfo(item.id)
    local result, w = ns.AddWish(ns.db.wishes, item.id, name, item.link or link, ns.Read(time) or 0)
    if result == "full" then
      ns.Print(string.format(L["Your wish list is full (%d items). Remove one with /lw remove first."], ns.MAX_WISHES))
      return
    elseif result == "known" then
      ns.Print(string.format(L["%s is already on your wish list."], ns.WishText(w)))
    elseif w.name or w.link or not ns.RequestItem(item.id) then
      ns.Print(string.format(L["Added to your wish list: %s"], ns.WishText(w)))
    end
    -- otherwise reported once the game has loaded the item, and taken off again if it does not exist
  end
end

local function remove(rest)
  local found = ns.FindWishes(ns.db.wishes, rest)
  if #found == 0 then
    ns.Print(L["That item is not on your wish list. See /lw list for the numbers."])
    return
  end
  for _, w in ipairs(found) do
    ns.db.wishes[w.id] = nil
    ns.Print(string.format(L["Removed from your wish list: %s"], ns.WishText(w)))
  end
end

local function list()
  local rows = ns.Sorted(ns.db.wishes)
  if #rows == 0 then
    ns.Print(L["Your wish list is empty. Add an item with /lw add and shift-click it into the chat line."])
    return
  end
  local now = ns.Read(time) or 0
  ns.Print(string.format(L["Your wish list (%d items):"], #rows))
  for i, w in ipairs(rows) do ns.Print(ns.ListText(i, w, now)) end
end

local function sound(rest)
  local word = strtrim(rest):lower()
  if word == "on" then
    ns.db.settings.sound = true
    ns.Print(L["An alert sound plays when a wished item shows up."])
  elseif word == "off" then
    ns.db.settings.sound = false
    ns.Print(L["No sound, only the chat line."])
  else
    ns.Print(L["Use /lw sound on or /lw sound off."])
  end
end

SLASH_LOOTWISHES1 = "/lootwishes"
SLASH_LOOTWISHES2 = "/lw"
SlashCmdList.LOOTWISHES = function(msg)
  if not ns.db then return end
  msg = msg or ""
  local cmd, rest = strtrim(msg):match("^(%S*)%s*(.-)$")
  cmd = cmd:lower()
  if cmd == "add" then
    add(rest)
  elseif cmd == "remove" or cmd == "rem" or cmd == "del" then
    remove(rest)
  elseif cmd == "list" or cmd == "" then
    list()
    if cmd == "" then help() end
  elseif cmd == "sound" then
    sound(rest)
  elseif msg:find("|Hitem:", 1, true) then
    add(msg) -- /lw [item] works like /lw add [item]
  else
    help()
  end
end
