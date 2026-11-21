local _, ns = ...
local L = ns.L

-- /jb shows the settings, /jb sell and /jb repair switch each half on or off.
-- /jb guild on and /jb guild off let the guild bank pay repairs first (1.2), /jb guild switches it.
-- /jb keep <item> puts grey items on the keep list, /jb unkeep <item> takes them off, /jb keep lists them.
-- /jb log lists the last vendor visits of this character, /jb log <n> the items of one, /jb log clear (1.3).

local function sellText()
  return ns.settings.sell and L["Selling junk is on."] or L["Selling junk is off."]
end

local function repairText()
  return ns.settings.repair and L["Repairing is on."] or L["Repairing is off."]
end

local function guildText()
  return ns.settings.guild and L["Guild bank repairs are on."] or L["Guild bank repairs are off."]
end

-- /jb guild [on|off]
local function guild(args)
  args = args:lower()
  if args == "on" then
    ns.settings.guild = true
  elseif args == "off" then
    ns.settings.guild = false
  elseif args == "" then
    ns.settings.guild = not ns.settings.guild
  else
    return ns.Print(L["/jb guild on lets the guild bank pay your repairs first when your guild rank allows it and the bank has the gold. /jb guild off pays from your own gold again."])
  end
  ns.Print(guildText())
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

-- 1.3: the sale log -----------------------------------------------------------------------------

local function now()
  local t = time and time()
  if ns.IsSecret(t) or type(t) ~= "number" then return nil end
  return t
end

local function logHelp()
  ns.Print(L["/jb log lists your last vendor visits, /jb log followed by a number shows what was sold in that visit, /jb log clear empties the log of this character."])
end

local function listVisits()
  local log = ns.log
  if #log == 0 then
    return ns.Print(L["No sales logged yet on this character. Every vendor visit that sells something is noted here."])
  end
  local t = now()
  ns.Print(string.format(L["Your last %d vendor visits with sales, newest first:"], #log))
  for i, v in ipairs(log) do
    DEFAULT_CHAT_FRAME:AddMessage("  " .. ns.VisitLine(i, v, t))
  end
  local count, earned = ns.LogTotals(log)
  ns.Print(string.format(L["Together: %d items for %s. /jb log followed by a number shows the items of that visit."], count, ns.FormatMoney(earned)))
  if ns.AnyRecent(log, t) then
    ns.Print(L["Sales from the last 15 minutes are marked. The vendor's Buyback tab may still have them, but it keeps only your latest sold items and empties when you log out."])
  end
end

local function showVisit(n)
  local v = ns.log[n]
  if not v then
    if #ns.log == 0 then return listVisits() end
    return ns.Print(string.format(L["There is no visit %d. /jb log lists visits 1 to %d."], n, #ns.log))
  end
  ns.Print(ns.VisitLine(n, v, now()))
  for _, it in ipairs(v.items) do
    DEFAULT_CHAT_FRAME:AddMessage("  " .. ns.SaleLine(it))
  end
end

-- /jb log, /jb log <n>, /jb log clear
local function log(args)
  args = args:lower()
  if args == "" then return listVisits() end
  if args == "clear" then
    for i = #ns.log, 1, -1 do ns.log[i] = nil end
    return ns.Print(L["The sale log of this character is empty now."])
  end
  local n = args:match("^%d+$") and tonumber(args)
  if n and n >= 1 then return showVisit(n) end
  logHelp()
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
    ns.Print(sellText() .. " " .. repairText() .. " " .. guildText())
  elseif cmd == "sell" then
    ns.settings.sell = not ns.settings.sell
    ns.Print(sellText())
  elseif cmd == "repair" then
    ns.settings.repair = not ns.settings.repair
    ns.Print(repairText())
  elseif word == "guild" then
    guild(args)
  elseif word == "keep" then
    keep(args)
  elseif word == "unkeep" then
    unkeep(args)
  elseif word == "log" then
    log(args)
  else
    ns.Print(L["/jb shows the settings, /jb sell and /jb repair switch each half on or off. Hold Shift while you open a vendor to skip one visit."])
    ns.Print(L["/jb keep followed by an item link or ID never sells that item, /jb unkeep takes it off again, /jb keep alone lists your keep list."])
    ns.Print(L["/jb guild on/off lets the guild bank pay your repairs first when your guild rank allows it."])
    logHelp()
  end
end
