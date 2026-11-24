-- Tests for Loot Wishes, run by tools/wow/client/run.lua.

-- The stand-in client has no items, loot, rolls, merchants, sounds or tooltip data; these are the game
-- functions the addon reads.
local STAND_IN = {
  "C_Item", "GetNumLootItems", "GetLootSlotLink", "GetLootRollItemLink", "GetMerchantNumItems",
  "GetMerchantItemLink", "GetMerchantItemID", "PlaySound", "SOUNDKIT", "TooltipDataProcessor",
  "LOOT_ITEM_SELF", "LOOT_ITEM", "LOOT_ITEM_SELF_MULTIPLE", "LOOT_ITEM_MULTIPLE",
}
local game

local SECRET = { secret = true }

local function link(id, name, quality)
  return "|cnIQ" .. (quality or 4) .. ":|Hitem:" .. id .. "::::::::80:::::|h[" .. name .. "]|h|r"
end

local SWORD = link(19019, "Thunderfury, Blessed Blade of the Windseeker", 5)
local CLOAK = link(212446, "Silken Cloak")
local BREAD = link(4540, "Tough Hunk of Bread", 1)

-- cache = { [id] = { name, link } } items the client knows; loot = { links }; rolls = { [rollID] = link };
-- merchant = { { id, link } }; missing = { [id] = true } IDs that do not exist.
local function client(g)
  game = { cache = {}, loot = {}, rolls = {}, merchant = {}, missing = {}, sounds = {}, requests = {}, posts = {} }
  for k, v in pairs(g or {}) do game[k] = v end
  game.cache[19019] = game.cache[19019] or { "Thunderfury, Blessed Blade of the Windseeker", SWORD }
  C_Item = {
    GetItemInfo = function(id)
      local c = game.cache[id]
      if not c then return nil end
      return c[1], c[2]
    end,
    RequestLoadItemDataByID = function(id) table.insert(game.requests, id) end,
  }
  GetNumLootItems = function() return game.lootCount or #game.loot end
  GetLootSlotLink = function(slot) return game.loot[slot] end
  GetLootRollItemLink = function(rollID) return game.rolls[rollID] end
  GetMerchantNumItems = function() return #game.merchant end
  GetMerchantItemLink = function(i) return game.merchant[i] and game.merchant[i][2] end
  GetMerchantItemID = function(i) return game.merchant[i] and game.merchant[i][1] end
  SOUNDKIT = { RAID_WARNING = 8959 }
  PlaySound = function(id) table.insert(game.sounds, id) end
  LOOT_ITEM_SELF = "You receive loot: %s."
  LOOT_ITEM_SELF_MULTIPLE = "You receive loot: %sx%d."
  LOOT_ITEM = "%s receives loot: %s."
  LOOT_ITEM_MULTIPLE = "%s receives loot: %sx%d."
  Enum.TooltipDataType = { Item = 0, Unit = 2 }
  TooltipDataProcessor = {
    AddTooltipPostCall = function(kind, fn) table.insert(game.posts, { kind = kind, fn = fn }) end,
  }
end

local function boot(wow, g, saved)
  client(g)
  LootWishesDB = saved
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("ADDON_LOADED", "LootWishes")
  wow.fire("PLAYER_LOGIN")
  return ns
end

local function wishes() return LootWishesDB.wishes end
local function count(t) local n = 0 for _ in pairs(t) do n = n + 1 end return n end
local function lastChat(wow) return wow.chat[#wow.chat] or "" end
local function chatSince(wow, from)
  local out = {}
  for i = from + 1, #wow.chat do out[#out + 1] = wow.chat[i] end
  return table.concat(out, "\n")
end
local function has(text, part) return text:find(part, 1, true) ~= nil end
local P = "|cffffd100Loot Wishes:|r "

-- A fake tooltip; returns its lines.
local function hover(data, itemLink)
  local tip = { lines = {} }
  function tip:AddLine(text) table.insert(self.lines, text) end
  function tip:GetItem() return "x", itemLink end
  for _, post in ipairs(game.posts) do
    if post.kind == Enum.TooltipDataType.Item then post.fn(tip, data) end
  end
  return tip.lines
end

test("addon defines only its own globals", function(wow, installed, before)
  boot(wow)
  wow.slash("/lw")
  wow.slash("/lw add " .. SWORD)
  wow.slash("/lw add 4540")
  wow.fire("GET_ITEM_INFO_RECEIVED", 4540, true)
  wow.slash("/lootwishes list")
  wow.slash("/lw sound off")
  game.loot = { SWORD }
  wow.fire("LOOT_READY")
  wow.fire("LOOT_CLOSED")
  game.rolls[1] = SWORD
  wow.fire("START_LOOT_ROLL", 1, 60000)
  wow.fire("CHAT_MSG_LOOT", "You receive loot: " .. SWORD .. ".")
  game.merchant = { { 19019, SWORD } }
  wow.fire("MERCHANT_SHOW")
  wow.fire("MERCHANT_CLOSED")
  hover({ id = 19019 })
  wow.slash("/lw remove 1")
  local allowed = { LootWishesDB = true, SLASH_LOOTWISHES1 = true, SLASH_LOOTWISHES2 = true }
  for _, name in ipairs(STAND_IN) do installed[name] = true end
  for k in pairs(_G) do
    if not before[k] and not installed[k] and not allowed[k] then error("unexpected global " .. tostring(k)) end
  end
end)

test("login creates the saved table with the sound on and keeps what was there", function(wow)
  local saved = { wishes = { [4540] = { id = 4540, name = "Tough Hunk of Bread", added = 1, hits = 2 } }, settings = { sound = false } }
  local ns = boot(wow, nil, saved)
  eq(LootWishesDB.version, 1)
  eq(wishes()[4540].hits, 2)
  eq(LootWishesDB.settings.sound, false, "a saved choice stays")
  eq(ns.db, LootWishesDB)
  boot(wow)
  eq(LootWishesDB.settings.sound, true, "new players get the sound")
  eq(count(wishes()), 0)
end)

test("items in a text: links first, else item IDs, item:ID and web addresses", function(wow)
  local ns = boot(wow)
  local items = ns.ParseItems("/lw add " .. SWORD .. " and " .. CLOAK .. SWORD)
  eq(#items, 2, "each item once")
  eq(items[1].id, 19019); eq(items[1].link, SWORD)
  eq(items[2].id, 212446); eq(items[2].link, CLOAK)
  local old = "|cffa335ee|Hitem:12345::::::::70:::::|h[Old Style]|h|r"
  eq(ns.ParseItems(old)[1].link, old, "classic colour codes")
  items = ns.ParseItems("19019 item:4540 https://www.wowhead.com/item=212446/silken-cloak #7 abc 0")
  eq(#items, 4)
  eq(items[1].id, 19019); eq(items[2].id, 4540); eq(items[3].id, 212446); eq(items[4].id, 7)
  eq(items[1].link, nil)
  eq(#ns.ParseItems("Thunderfury"), 0, "names alone are not items")
  eq(#ns.ParseItems(nil), 0)
  eq(ns.LinkID(CLOAK), 212446)
  eq(ns.LinkName(CLOAK), "Silken Cloak")
  eq(ns.LinkID(SECRET), nil)
end)

test("/lw add with a shift-clicked link puts the item on the list", function(wow)
  boot(wow)
  wow.now = wow.now + 5
  wow.slash("/lw add " .. CLOAK)
  local w = wishes()[212446]
  eq(w.link, CLOAK)
  eq(w.name, "Silken Cloak")
  eq(w.added, wow.now)
  eq(w.hits, 0)
  eq(lastChat(wow), P .. "Added to your wish list: " .. CLOAK)
  wow.slash("/lw add " .. CLOAK)
  eq(lastChat(wow), P .. CLOAK .. " is already on your wish list.")
  eq(count(wishes()), 1)
  wow.slash("/lw " .. SWORD)
  eq(wishes()[19019].link, SWORD, "/lw [item] works without the word add")
  wow.slash("/lw add")
  eq(has(lastChat(wow), "Shift-click an item"), true)
end)

test("/lw add with an item ID: known items at once, unknown ones once the game has loaded them", function(wow)
  boot(wow)
  wow.slash("/lw add 19019")
  eq(wishes()[19019].link, SWORD, "the link comes from the item cache")
  eq(lastChat(wow), P .. "Added to your wish list: " .. SWORD)
  local before = #wow.chat
  wow.slash("/lw add 4540")
  eq(wishes()[4540].name, nil)
  eq(game.requests[1], 4540, "the game is asked to load the item")
  eq(#wow.chat, before, "nothing said yet")
  wow.fire("GET_ITEM_INFO_RECEIVED", 999, true)
  eq(#wow.chat, before, "other items do not matter")
  game.cache[4540] = { "Tough Hunk of Bread", BREAD }
  wow.fire("GET_ITEM_INFO_RECEIVED", 4540, true)
  eq(wishes()[4540].link, BREAD)
  eq(wishes()[4540].name, "Tough Hunk of Bread")
  eq(lastChat(wow), P .. "Added to your wish list: " .. BREAD)
  wow.fire("GET_ITEM_INFO_RECEIVED", 4540, true)
  eq(#wow.chat, before + 1, "reported once")
end)

test("an item ID that does not exist is taken off again", function(wow)
  boot(wow)
  wow.slash("/lw add 99999999")
  eq(wishes()[99999999] ~= nil, true)
  wow.fire("GET_ITEM_INFO_RECEIVED", 99999999, false)
  eq(wishes()[99999999], nil)
  eq(lastChat(wow), P .. "There is no item with the ID 99999999, it was not added.")
end)

test("without the load request the item is added under its ID", function(wow)
  boot(wow)
  C_Item.RequestLoadItemDataByID = nil
  wow.slash("/lw add 4540")
  eq(lastChat(wow), P .. "Added to your wish list: item 4540")
  wow.slash("/lw list")
  eq(lastChat(wow), P .. "1. item 4540 (ID 4540) - not seen yet")
end)

test("/lw remove by link, by item ID and by position; /lw list in the order added", function(wow)
  boot(wow)
  wow.slash("/lw add " .. SWORD)
  wow.now = wow.now + 1
  wow.slash("/lw add " .. CLOAK)
  wow.now = wow.now + 1
  game.cache[4540] = { "Tough Hunk of Bread", BREAD }
  wow.slash("/lw add 4540")
  local from = #wow.chat
  wow.slash("/lw list")
  eq(chatSince(wow, from), table.concat({
    P .. "Your wish list (3 items):",
    P .. "1. " .. SWORD .. " (ID 19019) - not seen yet",
    P .. "2. " .. CLOAK .. " (ID 212446) - not seen yet",
    P .. "3. " .. BREAD .. " (ID 4540) - not seen yet",
  }, "\n"))
  wow.slash("/lw remove 2")
  eq(wishes()[212446], nil, "position 2")
  eq(lastChat(wow), P .. "Removed from your wish list: " .. CLOAK)
  wow.slash("/lw remove " .. SWORD)
  eq(wishes()[19019], nil, "by link")
  wow.slash("/lw remove 4540")
  eq(wishes()[4540], nil, "by item ID")
  wow.slash("/lw remove 4540")
  eq(has(lastChat(wow), "not on your wish list"), true)
  wow.slash("/lw list")
  eq(has(lastChat(wow), "Your wish list is empty"), true)
end)

test("the list holds at most 500 items", function(wow)
  local ns = boot(wow)
  for i = 1, 500 do wishes()[100000 + i] = { id = 100000 + i, added = i, hits = 0 } end
  wow.slash("/lw add " .. SWORD)
  eq(wishes()[19019], nil)
  eq(lastChat(wow), P .. "Your wish list is full (500 items). Remove one with /lw remove first.")
  eq(ns.AddWish(wishes(), 100001, "x", nil, 0), "known", "a known item is not 'full'")
end)

test("a wished item in the loot window is reported once per window, with sound", function(wow)
  boot(wow)
  wow.slash("/lw add " .. SWORD)
  local from = #wow.chat
  local dropped = link(19019, "Thunderfury, Blessed Blade of the Windseeker", 5) .. ""
  game.loot = { BREAD, dropped, CLOAK }
  wow.fire("LOOT_READY")
  wow.fire("LOOT_OPENED")
  wow.fire("LOOT_READY")
  eq(chatSince(wow, from), P .. dropped .. " is in this loot.")
  eq(#game.sounds, 1)
  eq(game.sounds[1], 8959)
  eq(wishes()[19019].hits, 1)
  eq(wishes()[19019].last, wow.now)
  wow.fire("LOOT_CLOSED")
  wow.clock = wow.clock + 10
  wow.fire("LOOT_OPENED")
  eq(wishes()[19019].hits, 2, "a new window reports again")
  eq(#game.sounds, 2)
end)

test("nothing wished, an empty or secret loot window reports nothing", function(wow)
  boot(wow)
  wow.slash("/lw add " .. SWORD)
  local from = #wow.chat
  game.loot = { BREAD, CLOAK }
  wow.fire("LOOT_READY")
  wow.fire("LOOT_CLOSED")
  game.loot = { SECRET }
  wow.fire("LOOT_READY")
  wow.fire("LOOT_CLOSED")
  game.loot, game.lootCount = { SWORD }, SECRET
  wow.fire("LOOT_READY")
  wow.fire("LOOT_CLOSED")
  game.lootCount = nil
  GetLootSlotLink = function() error("not available") end
  wow.fire("LOOT_READY")
  eq(#wow.chat, from)
  eq(#game.sounds, 0)
  eq(wishes()[19019].hits, 0)
end)

test("a loot roll on a wished item is reported once", function(wow)
  boot(wow)
  wow.slash("/lw add " .. CLOAK)
  game.rolls = { [7] = CLOAK, [8] = BREAD }
  wow.fire("START_LOOT_ROLL", 7, 60000)
  wow.fire("START_LOOT_ROLL", 7, 60000)
  wow.fire("START_LOOT_ROLL", 8, 60000)
  wow.fire("START_LOOT_ROLL", SECRET, 60000)
  game.rolls[9] = SECRET
  wow.fire("START_LOOT_ROLL", 9, 60000)
  eq(lastChat(wow), P .. CLOAK .. " is up for a roll.")
  eq(wishes()[212446].hits, 1)
end)

test("loot lines in chat: you got it, or another player got it", function(wow)
  boot(wow)
  wow.slash("/lw add " .. SWORD)
  wow.slash("/lw add " .. CLOAK)
  wow.fire("CHAT_MSG_LOOT", "You receive loot: " .. SWORD .. ".", "Yubi")
  eq(lastChat(wow), P .. "You got " .. SWORD .. ".")
  eq(wishes()[19019].got, wow.now)
  wow.fire("CHAT_MSG_LOOT", "Grumbash receives loot: " .. CLOAK .. "x2.", "Grumbash")
  eq(lastChat(wow), P .. "Grumbash got " .. CLOAK .. ".")
  eq(wishes()[212446].got, nil, "another player's loot is not yours")
  eq(wishes()[212446].hits, 1)
  local from = #wow.chat
  wow.fire("CHAT_MSG_LOOT", "You receive loot: " .. BREAD .. ".")
  wow.fire("CHAT_MSG_LOOT", "Grumbash: 19019 anyone?")
  wow.fire("CHAT_MSG_LOOT", "Someone links " .. SWORD .. " in a strange line")
  wow.fire("CHAT_MSG_LOOT", SECRET)
  eq(#wow.chat, from, "other items, typed numbers, unknown lines and secret lines say nothing")
end)

test("loot lines use the game's own texts, positional ones included, English when missing", function(wow)
  local ns = boot(wow)
  LOOT_ITEM_SELF = "Ihr erhaltet Beute: %s."
  LOOT_ITEM = "%1$s erhält Beute: %2$s."
  LOOT_ITEM_PUSHED_SELF = nil
  local p = ns.LootPatterns()
  eq(ns.Looter("Ihr erhaltet Beute: " .. SWORD .. ".", p), "self")
  eq(ns.Looter("Grumbash-Argent Dawn erhält Beute: " .. SWORD .. ".", p), "Grumbash-Argent Dawn")
  eq(ns.Looter("You receive item: " .. SWORD .. ".", p), "self", "English fallback for a missing text")
  eq(ns.Looter("You receive loot: " .. SWORD .. ".", p), nil, "the client's own text replaces the English one")
  eq(ns.FormatPattern("%s (x) [y]."), "^(.+) %(x%) %[y%]%.$")
  eq(("a (x) [y]."):find(ns.FormatPattern("%s (x) [y].")) ~= nil, true)
  eq(ns.Looter(nil, p), nil)
end)

test("a merchant selling a wished item is reported once per visit, late items too", function(wow)
  boot(wow)
  wow.slash("/lw add " .. BREAD)
  wow.slash("/lw add " .. CLOAK)
  local from = #wow.chat
  game.merchant = { { 117, link(117, "Tough Jerky", 1) }, { 4540, BREAD } }
  wow.fire("MERCHANT_SHOW")
  wow.fire("PLAYER_INTERACTION_MANAGER_FRAME_SHOW", Enum.PlayerInteractionType.Merchant)
  wow.fire("MERCHANT_UPDATE")
  eq(chatSince(wow, from), P .. "This merchant sells " .. BREAD .. ".")
  game.merchant[3] = { SECRET, CLOAK } -- the ID is secret, the link still tells
  wow.fire("MERCHANT_UPDATE")
  eq(lastChat(wow), P .. "This merchant sells " .. CLOAK .. ".")
  eq(wishes()[4540].hits, 1)
  wow.fire("MERCHANT_CLOSED")
  wow.fire("MERCHANT_UPDATE")
  eq(wishes()[4540].hits, 1, "no merchant open, no scan")
  wow.fire("PLAYER_INTERACTION_MANAGER_FRAME_SHOW", Enum.PlayerInteractionType.Merchant)
  eq(wishes()[4540].hits, 2, "the next visit reports again")
  wow.fire("PLAYER_INTERACTION_MANAGER_FRAME_HIDE", Enum.PlayerInteractionType.Merchant)
  wow.fire("PLAYER_INTERACTION_MANAGER_FRAME_SHOW", Enum.PlayerInteractionType.Banker)
  eq(wishes()[4540].hits, 2, "a bank is no merchant")
end)

test("/lw sound on and off is saved; sounds are spaced out", function(wow)
  boot(wow)
  wow.slash("/lw add " .. SWORD)
  wow.slash("/lw sound off")
  eq(LootWishesDB.settings.sound, false)
  eq(lastChat(wow), P .. "No sound, only the chat line.")
  game.loot = { SWORD }
  wow.fire("LOOT_READY")
  eq(#game.sounds, 0)
  eq(has(lastChat(wow), "is in this loot"), true, "the chat line still comes")
  wow.slash("/lw sound maybe")
  eq(lastChat(wow), P .. "Use /lw sound on or /lw sound off.")
  wow.slash("/lw sound ON")
  eq(LootWishesDB.settings.sound, true)
  wow.fire("LOOT_CLOSED")
  wow.fire("LOOT_READY")
  wow.fire("CHAT_MSG_LOOT", "You receive loot: " .. SWORD .. ".")
  eq(#game.sounds, 1, "two hits within 2 seconds, one sound")
  wow.clock = wow.clock + 3
  wow.fire("CHAT_MSG_LOOT", "You receive loot: " .. SWORD .. ".")
  eq(#game.sounds, 2)
  SOUNDKIT = nil
  wow.clock = wow.clock + 3
  wow.fire("CHAT_MSG_LOOT", "You receive loot: " .. SWORD .. ".")
  eq(#game.sounds, 2, "no sound kit, no sound, no error")
end)

test("the tooltip of a wished item says so", function(wow)
  boot(wow)
  eq(#game.posts, 1)
  eq(game.posts[1].kind, Enum.TooltipDataType.Item)
  wow.slash("/lw add " .. SWORD)
  eq(hover({ id = 19019 })[1], "On your wish list")
  eq(#hover({ id = 4540 }), 0)
  eq(hover({}, SWORD)[1], "On your wish list", "the link of the tooltip when the data has no ID")
  eq(#hover({ id = SECRET }, nil), 0)
  eq(#hover(nil, nil), 0)
end)

test("/lw list shows hits, when and whether you got it", function(wow)
  local ns = boot(wow)
  local w = { id = 19019, link = SWORD, hits = 0 }
  eq(ns.ListText(1, w, 0), "1. " .. SWORD .. " (ID 19019) - not seen yet")
  ns.Record(w, "loot", 1000)
  eq(ns.ListText(1, w, 1000 + 60), "1. " .. SWORD .. " (ID 19019) - seen once, just now")
  ns.Record(w, "merchant", 1000)
  eq(ns.ListText(2, w, 1000 + 2 * 3600), "2. " .. SWORD .. " (ID 19019) - seen 2 times, last 2 hours ago")
  ns.Record(w, "got", 1000)
  eq(w.got, 1000)
  eq(ns.ListText(2, w, 1000 + 86400), "2. " .. SWORD .. " (ID 19019) - seen 3 times, last 1 day ago, you got it")
  eq(ns.AgoText(5 * 86400), "5 days ago")
  eq(ns.AgoText(3600), "1 hour ago")
  eq(ns.WishText({ id = 5, name = "Bread" }), "[Bread]")
  eq(ns.WishText({ id = 5 }), "item 5")
end)

test("help, unknown commands and commands before login", function(wow)
  client()
  LootWishesDB = nil
  wow.load(ADDON_DIR, ADDON_NAME)
  wow.slash("/lw add " .. SWORD)
  eq(#wow.chat, 0, "nothing before login")
  wow.fire("LOOT_READY")
  wow.fire("CHAT_MSG_LOOT", "You receive loot: " .. SWORD .. ".")
  wow.fire("MERCHANT_SHOW")
  eq(#wow.chat, 0)
  wow.fire("PLAYER_LOGIN")
  wow.slash("/lw what")
  eq(has(lastChat(wow), "/lw add <item>"), true)
  wow.slash("/lw")
  eq(has(wow.chat[#wow.chat - 1], "Your wish list is empty"), true)
  eq(has(lastChat(wow), "/lw add <item>"), true, "/lw alone shows the list and the help")
end)

-- 1.1: German ------------------------------------------------------------------------------------------

-- Every placeholder of a text, in order: "%d", "%s", "%%".
local function placeholders(text)
  local out = {}
  for p in text:gmatch("%%[%d%.]*[%a%%]") do out[#out + 1] = p end
  return table.concat(out, " ")
end

-- A German client: its language and its own loot lines (deDE GlobalStrings of 12.1.5).
local function germanClient(wow)
  wow.locale = "deDE"
end
local function germanLootLines()
  LOOT_ITEM_SELF = "Ihr erhaltet Beute: %s"
  LOOT_ITEM_SELF_MULTIPLE = "Ihr erhaltet Beute: %sx%d"
  LOOT_ITEM = "%s bekommt Beute: %s."
  LOOT_ITEM_MULTIPLE = "%s erhält Beute: %sx%d."
end
local GP = "|cffffd100Loot Wishes:|r "

test("German client: adding, listing and removing wishes in German", function(wow)
  germanClient(wow)
  boot(wow)
  wow.slash("/lw add " .. SWORD)
  eq(lastChat(wow), GP .. "Auf deine Wunschliste gesetzt: " .. SWORD)
  wow.slash("/lw add " .. SWORD)
  eq(lastChat(wow), GP .. SWORD .. " steht schon auf deiner Wunschliste.")
  C_Item.RequestLoadItemDataByID = nil
  wow.now = wow.now + 1
  wow.slash("/lw add 4540")
  eq(lastChat(wow), GP .. "Auf deine Wunschliste gesetzt: Gegenstand 4540")
  wow.slash("/lw add")
  eq(lastChat(wow), GP .. "Umschalt-klicke einen Gegenstand hinter /lw add in die Chateingabe oder gib seine Gegenstands-ID ein: /lw add 19019.")
  local from = #wow.chat
  wow.slash("/lw list")
  eq(chatSince(wow, from), table.concat({
    GP .. "Deine Wunschliste (2 Gegenstände):",
    GP .. "1. " .. SWORD .. " (ID 19019) - noch nicht gesehen",
    GP .. "2. Gegenstand 4540 (ID 4540) - noch nicht gesehen",
  }, "\n"))
  wow.slash("/lw remove 2")
  eq(lastChat(wow), GP .. "Von deiner Wunschliste genommen: Gegenstand 4540")
  wow.slash("/lw remove 2")
  eq(lastChat(wow), GP .. "Dieser Gegenstand steht nicht auf deiner Wunschliste. Die Nummern zeigt /lw list.")
  wow.slash("/lw remove 1")
  wow.slash("/lw list")
  eq(lastChat(wow), GP .. "Deine Wunschliste ist leer. Füge einen Gegenstand mit /lw add hinzu und umschalt-klicke ihn in die Chateingabe.")
  for i = 1, 500 do wishes()[100000 + i] = { id = 100000 + i, added = i, hits = 0 } end
  wow.slash("/lw add " .. CLOAK)
  eq(lastChat(wow), GP .. "Deine Wunschliste ist voll (500 Gegenstände). Nimm zuerst einen mit /lw remove herunter.")
end)

test("German client: hits in the loot window, rolls, German loot lines and at the merchant", function(wow)
  germanClient(wow)
  boot(wow)
  germanLootLines()
  wow.slash("/lw add " .. SWORD)
  wow.slash("/lw add " .. CLOAK)
  game.loot = { SWORD }
  wow.fire("LOOT_READY")
  eq(lastChat(wow), GP .. SWORD .. " ist in dieser Beute.")
  game.rolls[3] = CLOAK
  wow.fire("START_LOOT_ROLL", 3, 60000)
  eq(lastChat(wow), GP .. "Um " .. CLOAK .. " wird gewürfelt.")
  wow.fire("CHAT_MSG_LOOT", "Ihr erhaltet Beute: " .. SWORD)
  eq(lastChat(wow), GP .. "Du hast " .. SWORD .. " bekommen.", "the German client's own loot line")
  eq(wishes()[19019].got, wow.now)
  wow.fire("CHAT_MSG_LOOT", "Grumbash bekommt Beute: " .. CLOAK .. ".")
  eq(lastChat(wow), GP .. "Grumbash hat " .. CLOAK .. " bekommen.")
  wow.fire("CHAT_MSG_LOOT", "Grumbash erhält Beute: " .. CLOAK .. "x2.")
  eq(lastChat(wow), GP .. "Grumbash hat " .. CLOAK .. " bekommen.", "the German line with a count")
  eq(wishes()[212446].got, nil)
  game.merchant = { { 212446, CLOAK } }
  wow.fire("MERCHANT_SHOW")
  eq(lastChat(wow), GP .. "Dieser Händler verkauft " .. CLOAK .. ".")
  wow.slash("/lw sound off")
  eq(lastChat(wow), GP .. "Kein Ton, nur die Zeile im Chat.")
  wow.slash("/lw sound aus")
  eq(lastChat(wow), GP .. "Nutze /lw sound on oder /lw sound off.", "German command words are not commands")
  eq(LootWishesDB.settings.sound, false)
  wow.slash("/lw sound on")
  eq(lastChat(wow), GP .. "Ein Alarmton erklingt, wenn ein gewünschter Gegenstand auftaucht.")
  eq(hover({ id = 19019 })[1], "Auf deiner Wunschliste")
end)

test("German client: the list with hits and times, unknown IDs and the help", function(wow)
  germanClient(wow)
  local ns = boot(wow)
  local w = { id = 19019, link = SWORD, hits = 0 }
  ns.Record(w, "loot", 1000)
  eq(ns.ListText(1, w, 1000 + 60), "1. " .. SWORD .. " (ID 19019) - einmal gesehen, gerade eben")
  ns.Record(w, "merchant", 1000)
  eq(ns.ListText(1, w, 1000 + 3600), "1. " .. SWORD .. " (ID 19019) - 2-mal gesehen, zuletzt vor 1 Stunde")
  eq(ns.ListText(1, w, 1000 + 5 * 3600), "1. " .. SWORD .. " (ID 19019) - 2-mal gesehen, zuletzt vor 5 Stunden")
  ns.Record(w, "got", 1000)
  eq(ns.ListText(1, w, 1000 + 86400), "1. " .. SWORD .. " (ID 19019) - 3-mal gesehen, zuletzt vor 1 Tag, du hast ihn bekommen")
  eq(ns.AgoText(3 * 86400), "vor 3 Tagen")
  wow.slash("/lw add 99999999")
  wow.fire("GET_ITEM_INFO_RECEIVED", 99999999, false)
  eq(lastChat(wow), GP .. "Es gibt keinen Gegenstand mit der ID 99999999, er wurde nicht hinzugefügt.")
  wow.slash("/lw hinzufügen 19019")
  eq(lastChat(wow), GP .. "/lw add <Gegenstand> setzt einen Gegenstand auf deine Wunschliste (umschalt-klicke ihn in die Chateingabe oder gib seine Gegenstands-ID ein), /lw remove <Gegenstand oder Nummer> nimmt ihn herunter, /lw list zeigt die Liste, /lw sound on oder off schaltet den Alarmton ein oder aus.")
  eq(wishes()[19019], nil, "a German command word adds nothing")
end)

test("German texts keep every placeholder of the English text, in order", function(wow)
  wow.locale = "deDE"
  local ns = boot(wow)
  local n = 0
  for key, text in pairs(ns.L) do
    n = n + 1
    eq(placeholders(text), placeholders(key), key)
    eq(select(2, key:gsub("<", "")), select(2, text:gsub("<", "")), "the hints in brackets stay: " .. key)
    eq(text:find("|", 1, true), nil, "no | in a German text: " .. key)
  end
  eq(n, 31, "every text on screen has its German one")
end)

test("an English client keeps the English texts", function(wow)
  wow.locale = "enUS"
  local ns = boot(wow)
  eq(next(ns.L), nil)
  wow.slash("/lw add " .. SWORD)
  eq(lastChat(wow), P .. "Added to your wish list: " .. SWORD)
  game.loot = { SWORD }
  wow.fire("LOOT_READY")
  eq(lastChat(wow), P .. SWORD .. " is in this loot.")
  eq(hover({ id = 19019 })[1], "On your wish list")
  eq(ns.AgoText(2 * 86400), "2 days ago")
end)
