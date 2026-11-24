local _, ns = ...
local L = ns.L

-- Pure bookkeeping: no frames, no events. Everything here runs outside the game in the tests.
--
-- wishes = { [itemID] = { id = 12345, name = "...", link = "|c...|Hitem:12345:...|h[...]|h|r",
--                         added = t, hits = n, last = t, got = t } }
-- An item matches by its item ID alone: every difficulty, upgrade level and bonus of it counts.

ns.MAX_WISHES = 500

-- Game texts of a loot chat line, each with the English text as fallback for a client without it.
-- Lines about the player: "You receive loot: %s." and its kin.
ns.SELF_LOOT = {
  { "LOOT_ITEM_SELF_MULTIPLE", "You receive loot: %sx%d." },
  { "LOOT_ITEM_SELF", "You receive loot: %s." },
  { "LOOT_ITEM_PUSHED_SELF_MULTIPLE", "You receive item: %sx%d." },
  { "LOOT_ITEM_PUSHED_SELF", "You receive item: %s." },
  { "LOOT_ITEM_BONUS_ROLL_SELF_MULTIPLE", "You receive bonus loot: %sx%d." },
  { "LOOT_ITEM_BONUS_ROLL_SELF", "You receive bonus loot: %s." },
  { "LOOT_ITEM_CREATED_SELF_MULTIPLE", "You create: %sx%d." },
  { "LOOT_ITEM_CREATED_SELF", "You create: %s." },
}
-- Lines about another player: "%s receives loot: %s." and its kin; the name is the capture without a link.
ns.OTHER_LOOT = {
  { "LOOT_ITEM_MULTIPLE", "%s receives loot: %sx%d." },
  { "LOOT_ITEM", "%s receives loot: %s." },
  { "LOOT_ITEM_PUSHED_MULTIPLE", "%s receives item: %sx%d." },
  { "LOOT_ITEM_PUSHED", "%s receives item: %s." },
  { "LOOT_ITEM_BONUS_ROLL_MULTIPLE", "%s receives bonus loot: %sx%d." },
  { "LOOT_ITEM_BONUS_ROLL", "%s receives bonus loot: %s." },
}

function ns.IsSecret(value)
  return issecretvalue ~= nil and issecretvalue(value) and true or false
end

-- A value read from the game, or nil when it is secret.
function ns.Plain(value)
  if ns.IsSecret(value) then return nil end
  return value
end

-- A text the game has in the player's language (a GlobalStrings constant); the English one otherwise.
function ns.GameText(global, english)
  local text = _G[global]
  if type(text) ~= "string" or text == "" or ns.IsSecret(text) then return english end
  return text
end

-- A format string of the game ("%s receives loot: %s.", also "%1$s") as an anchored Lua pattern.
function ns.FormatPattern(fmt)
  local s = fmt:gsub("%%%d*%$?s", "\1"):gsub("%%%d*%$?d", "\2")
  s = s:gsub("[%^%$%(%)%%%.%[%]%*%+%-%?]", "%%%0")
  s = s:gsub("\1", "(.+)"):gsub("\2", "(%%d+)")
  return "^" .. s .. "$"
end

-- { self = { patterns }, other = { patterns } } from the game texts above.
function ns.LootPatterns()
  local p = { self = {}, other = {} }
  for _, t in ipairs(ns.SELF_LOOT) do p.self[#p.self + 1] = ns.FormatPattern(ns.GameText(t[1], t[2])) end
  for _, t in ipairs(ns.OTHER_LOOT) do p.other[#p.other + 1] = ns.FormatPattern(ns.GameText(t[1], t[2])) end
  return p
end

-- Who a loot chat line is about: "self", the other player's name, or nil when it is no loot line.
function ns.Looter(text, patterns)
  if type(text) ~= "string" then return nil end
  for _, pattern in ipairs(patterns.self) do
    if text:find(pattern) then return "self" end
  end
  for _, pattern in ipairs(patterns.other) do
    local caps = { text:match(pattern) }
    for _, c in ipairs(caps) do
      if not c:find("|H", 1, true) and not c:match("^%d+$") then return c end
    end
  end
  return nil
end

-- Every item in a text, links first: { { id = 12345, link = "..." or nil } }, each item once.
-- Without a link the text may hold item IDs: "12345", "item:12345" or "item=12345" (as in web addresses).
function ns.ParseItems(text)
  local items, seen = {}, {}
  local function add(id, link)
    id = tonumber(id)
    if not id or id <= 0 or seen[id] then return end
    seen[id] = true
    items[#items + 1] = { id = id, link = link }
  end
  if type(text) ~= "string" then return items end
  if text:find("|Hitem:", 1, true) then
    local links = {}
    for link, id in text:gmatch("(|c[^|]*|Hitem:(%d+)[^|]*|h.-|h|r)") do links[tonumber(id)] = link end
    for id in text:gmatch("|Hitem:(%d+)") do add(id, links[tonumber(id)]) end
    return items
  end
  for word in text:gmatch("%S+") do
    local id = word:match("^item[:=](%d+)") or word:match("[?&/]item=(%d+)") or word:match("^#?(%d+)$")
    if id then add(id) end
  end
  return items
end

-- The item ID of one link, or nil.
function ns.LinkID(link)
  if type(link) ~= "string" then return nil end
  return tonumber(link:match("|Hitem:(%d+)"))
end

-- The item name inside a link: "|c...|Hitem:1|h[Thunderfury]|h|r" -> "Thunderfury".
function ns.LinkName(link)
  if type(link) ~= "string" then return nil end
  return link:match("|h%[(.-)%]|h")
end

function ns.Count(wishes)
  local n = 0
  for _ in pairs(wishes) do n = n + 1 end
  return n
end

-- Adds an item. → "added", "known" (already wished; a missing name or link is filled in) or "full".
function ns.AddWish(wishes, id, name, link, now)
  local w = wishes[id]
  if w then
    w.name = w.name or name
    w.link = w.link or link
    return "known", w
  end
  if ns.Count(wishes) >= ns.MAX_WISHES then return "full" end
  w = { id = id, name = name or ns.LinkName(link), link = link, added = now, hits = 0 }
  wishes[id] = w
  return "added", w
end

-- The wish list in the order the items were added.
function ns.Sorted(wishes)
  local list = {}
  for _, w in pairs(wishes) do list[#list + 1] = w end
  table.sort(list, function(a, b)
    local x, y = a.added or 0, b.added or 0
    if x ~= y then return x < y end
    return a.id < b.id
  end)
  return list
end

-- The wishes a /lw remove text means: links and item IDs, or a position on the list (/lw remove 3).
function ns.FindWishes(wishes, text)
  local found = {}
  local list = ns.Sorted(wishes)
  for _, item in ipairs(ns.ParseItems(text)) do
    local w = wishes[item.id]
    if not w and not item.link and item.id <= #list then w = list[item.id] end
    if w then found[#found + 1] = w end
  end
  return found
end

-- The wished items among a list of item IDs, each once.
function ns.Matches(wishes, ids)
  local hits, seen = {}, {}
  for _, id in ipairs(ids) do
    local w = type(id) == "number" and wishes[id]
    if w and not seen[id] then
      seen[id] = true
      hits[#hits + 1] = w
    end
  end
  return hits
end

-- Notes a hit on a wish. kind: "loot", "roll", "got", "other", "merchant".
function ns.Record(w, kind, now)
  w.hits = (w.hits or 0) + 1
  w.last = now
  if kind == "got" then w.got = now end
end

-- How a wish shows in chat: the link of the hit, the saved link, the name or the item ID.
function ns.WishText(w, link)
  if link then return link end
  if w.link then return w.link end
  if w.name then return "[" .. w.name .. "]" end
  return string.format(L["item %d"], w.id)
end

function ns.HitText(kind, text, who)
  if kind == "loot" then return string.format(L["%s is in this loot."], text) end
  if kind == "roll" then return string.format(L["%s is up for a roll."], text) end
  if kind == "got" then return string.format(L["You got %s."], text) end
  if kind == "other" then return string.format(L["%s got %s."], who or "?", text) end
  if kind == "merchant" then return string.format(L["This merchant sells %s."], text) end
  return text
end

function ns.AgoText(seconds)
  if type(seconds) ~= "number" or seconds < 3600 then return L["just now"] end
  local days = math.floor(seconds / 86400)
  if days == 1 then return L["1 day ago"] end
  if days > 1 then return string.format(L["%d days ago"], days) end
  local hours = math.floor(seconds / 3600)
  if hours == 1 then return L["1 hour ago"] end
  return string.format(L["%d hours ago"], hours)
end

-- One line of /lw list: "3. [Thunderfury] (ID 19019) - seen 2 times, last 1 day ago, you got it".
function ns.ListText(i, w, now)
  local text = string.format(L["%d. %s (ID %d)"], i, ns.WishText(w), w.id)
  local hits = w.hits or 0
  if hits == 1 then
    text = text .. string.format(L[" - seen once, %s"], ns.AgoText(now - (w.last or now)))
  elseif hits > 1 then
    text = text .. string.format(L[" - seen %d times, last %s"], hits, ns.AgoText(now - (w.last or now)))
  else
    text = text .. L[" - not seen yet"]
  end
  if w.got then text = text .. L[", you got it"] end
  return text
end
