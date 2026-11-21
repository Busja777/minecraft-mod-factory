local _, ns = ...
local L = ns.L

-- /jb shows the settings, /jb sell and /jb repair switch each half on or off.
-- /jb keep <item> puts grey items on the keep list, /jb unkeep <item> takes them off, /jb keep lists them.

local function sellText()
  return ns.settings.sell and L["Selling junk is on."] or L["Selling junk is off."]
end

local function repairText()
  return ns.settings.repair and L["Repairing is on."] or L["Repairing is off."]
end

-- How an item is named in chat: its link when known, otherwise its ID.
local function itemName(id, link)
  link = link or (type(ns.db.keep[id]) == "string" and ns.db.keep[id]) or ns.ItemLink(id)
  return link or string.format(L["item %d"], id)
end

local function listKept()
  local ids = ns.KeptIDs(ns.db.keep)
  if #ids == 0 then
    ns.Print(L["Your keep list is empty. Add a grey item with /jb keep and its link or item ID."])
    return
  end
  ns.Print(string.format(L["Never sold (%d):"], #ids))
  for _, id in ipairs(ids) do
    DEFAULT_CHAT_FRAME:AddMessage("  " .. itemName(id))
  end
end

local function askForItem(command)
  ns.Print(string.format(L["Name the item after %s: shift-click it into the chat or type its item ID."], command))
end

local function keep(args)
  if args == "" then return listKept() end
  local ids, links = ns.ParseItems(args)
  if #ids == 0 then return askForItem("/jb keep") end
  for _, id in ipairs(ids) do
    local link = links[id] or ns.ItemLink(id)
    ns.db.keep[id] = link or true
    ns.Print(string.format(L["%s is on your keep list and will never be sold."], itemName(id, link)))
  end
end

local function unkeep(args)
  local ids = ns.ParseItems(args)
  if #ids == 0 then return askForItem("/jb unkeep") end
  for _, id in ipairs(ids) do
    if ns.db.keep[id] then
      local name = itemName(id)
      ns.db.keep[id] = nil
      ns.Print(string.format(L["%s is off your keep list."], name))
    else
      ns.Print(string.format(L["%s is not on your keep list."], itemName(id)))
    end
  end
end

SLASH_JUNKBUTLER1 = "/junkbutler"
SLASH_JUNKBUTLER2 = "/jb"
SlashCmdList.JUNKBUTLER = function(msg)
  if not ns.settings then return end
  msg = strtrim(msg or "")
  local cmd = msg:lower()
  -- The first word is the command; the rest keeps its case, item links need it.
  local word, args = msg:match("^(%S+)%s*(.-)$")
  word = word and word:lower()
  if cmd == "" then
    ns.Print(sellText() .. " " .. repairText())
  elseif cmd == "sell" then
    ns.settings.sell = not ns.settings.sell
    ns.Print(sellText())
  elseif cmd == "repair" then
    ns.settings.repair = not ns.settings.repair
    ns.Print(repairText())
  elseif word == "keep" then
    keep(args)
  elseif word == "unkeep" then
    unkeep(args)
  else
    ns.Print(L["/jb shows the settings, /jb sell and /jb repair switch each half on or off. Hold Shift while you open a vendor to skip one visit."])
    ns.Print(L["/jb keep followed by an item link or ID never sells that item, /jb unkeep takes it off again, /jb keep alone lists your keep list."])
  end
end
