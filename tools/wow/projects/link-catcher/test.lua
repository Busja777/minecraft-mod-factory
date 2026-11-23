-- Tests for Link Catcher, run by tools/wow/client/run.lua.

-- The stand-in client has no chat filters, no link clicks and no chat history; this models them
-- the way the game's chat frame code calls them.
local game

local function client(opts)
  opts = opts or {}
  game = { filters = {}, callbacks = {}, lines = {}, itemRefs = 0 }
  local function add(event, fn)
    game.filters[event] = game.filters[event] or {}
    table.insert(game.filters[event], fn)
  end
  if opts.util then
    ChatFrameUtil = { AddMessageEventFilter = add }
  elseif not opts.noFilters then
    ChatFrame_AddMessageEventFilter = add
  end
  if not opts.noRegistry then
    EventRegistry = {
      RegisterCallback = function(_, event, fn, owner)
        game.callbacks[event] = game.callbacks[event] or {}
        table.insert(game.callbacks[event], { fn = fn, owner = owner })
      end,
    }
  end
  if not opts.noItemRef then
    SetItemRef = function(link, text, button, chatFrame)
      game.itemRefs = game.itemRefs + 1
      if link:sub(1, 6) == "addon:" and EventRegistry then
        for _, cb in ipairs(game.callbacks.SetItemRef or {}) do cb.fn(cb.owner, link, text, button, chatFrame) end
      end
    end
  end
  DEFAULT_CHAT_FRAME.GetNumMessages = function() return #game.lines end
  DEFAULT_CHAT_FRAME.GetMessageInfo = function(_, i) return game.lines[i], 1, 1, 1 end
end

local function boot(wow, opts, saved)
  client(opts)
  LinkCatcherDB = saved
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("ADDON_LOADED", "LinkCatcher")
  return ns
end

-- A chat message through every filter of its event, like the chat frame does it.
-- Returns the text that would be shown and the other arguments.
local function say(event, msg, author)
  local args = { msg, author or "Mira-Silvermoon", "", "", "", "", "", 0 }
  for _, fn in ipairs(game.filters[event] or {}) do
    local res = { fn({}, event, unpack(args)) }
    if res[1] then return nil end
    if res[2] ~= nil then args = { unpack(res, 2) } end
  end
  return args[1], args
end

-- The link of the n-th clickable address in a shown text.
local function linkOf(text, n)
  if type(n) ~= "number" then n = 1 end -- say() also returns its arguments
  local i = 0
  for data in text:gmatch("|H(addon:LinkCatcher:%d+)|h") do
    i = i + 1
    if i == n then return data end
  end
end

local function lastChat(wow) return wow.chat[#wow.chat] end

test("addon defines only its own globals", function(wow, installed, before)
  client()
  local mine = {}
  for k in pairs(_G) do mine[k] = true end
  wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("ADDON_LOADED", "LinkCatcher")
  game.lines = { "hello" }
  wow.slash("/lc copy") -- creates the window
  local allowed = { LinkCatcherDB = true, LinkCatcherFrame = true, SLASH_LINKCATCHER1 = true, SLASH_LINKCATCHER2 = true }
  for k in pairs(_G) do
    if not before[k] and not installed[k] and not mine[k] and not allowed[k] then error("unexpected global " .. tostring(k)) end
  end
  eq(LinkCatcherFrame ~= nil, true, "the window exists")
end)

test("finds addresses with a scheme, with www. and bare ones with a known ending", function(wow)
  local ns = boot(wow)
  local function urls(text)
    local out = {}
    for _, hit in ipairs(ns.FindUrls(text)) do out[#out + 1] = hit[3] end
    return table.concat(out, " ")
  end
  eq(urls("see https://example.com/guide?a=1&b=2#top now"), "https://example.com/guide?a=1&b=2#top")
  eq(urls("HTTP://Example.COM"), "HTTP://Example.COM")
  eq(urls("www.wowhead.com/item=19019"), "www.wowhead.com/item=19019")
  eq(urls("join discord.gg/abc123 or raider.io"), "discord.gg/abc123 raider.io")
  eq(urls("two: a.com and https://b.org/x"), "a.com https://b.org/x")
  eq(urls("(see www.example.com/wiki/Foo_(bar))."), "www.example.com/wiki/Foo_(bar)")
  eq(urls("check example.com, then example.net!"), "example.com example.net")
end)

test("numbers, abbreviations, e-mails and odd words stay plain", function(wow)
  local ns = boot(wow)
  for _, text in ipairs({ "patch 1.5", "12.0.5 is out", "e.g. this", "lol.wtf", "mail me at someone@mail.com",
    "3.com", "https://", "www.", "http://localhost", "...", "word.x", "a..com", "ftp.example" }) do
    eq(#ns.FindUrls(text), 0, text)
  end
end)

test("a message becomes clickable, the rest of it stays as it was", function(wow)
  boot(wow)
  local shown = say("CHAT_MSG_SAY", "guide at www.example.com/guide, enjoy")
  eq(shown, "guide at |cff3fa9f5|Haddon:LinkCatcher:1|h[www.example.com/guide]|h|r, enjoy")
end)

test("item links, colours and textures in a message are not broken", function(wow)
  local ns = boot(wow)
  local item = "|cffa335ee|Hitem:19019::::::::60:::::|h[Thunderfury, www.fake.com]|h|r"
  local msg = item .. " |TInterface\\Icons\\x.com:0|t |cffff0000red.com|r"
  local out = ns.Linkify(msg, ns.NewStore())
  eq(out:sub(1, #item), item, "item link untouched")
  eq(out:find("|TInterface\\Icons\\x.com:0|t", 1, true) ~= nil, true, "texture untouched")
  eq(out:find("|cffff0000|cff3fa9f5|Haddon:LinkCatcher:1|h[red.com]|h|r|r", 1, true) ~= nil, true, "address inside colour")
  eq(select(2, ns.Linkify("|Haddon:LinkCatcher:7|h[www.example.com]|h", ns.NewStore())), 0, "own links are not wrapped again")
end)

test("a message without an address is passed on untouched", function(wow)
  boot(wow)
  local msg, args = say("CHAT_MSG_GUILD", "lfg 1.5k gold", "Mira")
  eq(msg, "lfg 1.5k gold")
  eq(args[2], "Mira")
end)

test("the filter keeps the author and every other argument", function(wow)
  boot(wow)
  local msg, args = say("CHAT_MSG_WHISPER", "raider.io", "Mira-Silvermoon")
  eq(linkOf(msg) ~= nil, true)
  eq(args[2], "Mira-Silvermoon")
  eq(#args, 8)
end)

test("secret messages are never read or changed", function(wow)
  local ns = boot(wow)
  local secret = { secret = true }
  local calls = 0
  setmetatable(secret, { __index = function() calls = calls + 1 end, __eq = function() error("compared a secret") end })
  local res = { ns.Filter({}, "CHAT_MSG_INSTANCE_CHAT", secret, "Mira") }
  eq(#res, 1)
  eq(res[1], false)
  eq(calls, 0)
  local msg = say("CHAT_MSG_PARTY", secret)
  eq(msg, secret)
end)

test("every player chat event is filtered", function(wow)
  local ns = boot(wow)
  for _, event in ipairs(ns.EVENTS) do
    eq(#(game.filters[event] or {}), 1, event)
  end
  eq(game.filters.CHAT_MSG_SYSTEM, nil, "system messages are left alone")
  eq(linkOf(say("CHAT_MSG_BN_WHISPER", "www.example.com")) ~= nil, true)
end)

test("ChatFrameUtil is used when the client has it", function(wow)
  local ns = boot(wow, { util = true })
  eq(#game.filters.CHAT_MSG_SAY, 1)
  eq(ns.filters, true)
  eq(linkOf(say("CHAT_MSG_SAY", "example.com")) ~= nil, true)
end)

test("without a chat filter function nothing breaks and help says why", function(wow)
  local ns = boot(wow, { noFilters = true })
  eq(ns.filters, false)
  wow.slash("/lc")
  eq(lastChat(wow):find("does not let addons change chat lines", 1, true) ~= nil, true)
end)

test("the same message in several chat windows gets the same link", function(wow)
  boot(wow)
  local a = say("CHAT_MSG_CHANNEL", "www.example.com")
  local b = say("CHAT_MSG_CHANNEL", "www.example.com")
  eq(a, b)
  local c = say("CHAT_MSG_CHANNEL", "now raider.io")
  eq(linkOf(c), "addon:LinkCatcher:2")
end)

test("clicking a link opens the box with the address selected", function(wow)
  local ns = boot(wow)
  local msg = say("CHAT_MSG_SAY", "go https://example.com/a")
  local link = linkOf(msg)
  SetItemRef(link, msg, "LeftButton", DEFAULT_CHAT_FRAME)
  local f = ns.Window()
  eq(f:IsShown(), true)
  eq(f.box:GetText(), "https://example.com/a")
  eq(f.title:GetText(), "Link Catcher")
  eq(f.hint:GetText():find("Ctrl+C", 1, true) ~= nil, true)
end)

test("a click reported by both paths opens once; other links are ignored", function(wow)
  local ns = boot(wow)
  local opened = 0
  local show = ns.ShowUrl
  ns.ShowUrl = function(url) opened = opened + 1; show(url) end
  local link = linkOf(say("CHAT_MSG_SAY", "www.example.com"))
  SetItemRef(link, "", "LeftButton") -- the EventRegistry callback and the SetItemRef hook both run
  eq(opened, 1)
  wow.clock = wow.clock + 2
  SetItemRef(link, "", "LeftButton")
  eq(opened, 2, "a second click later opens again")
  SetItemRef("item:19019", "[Thunderfury]", "LeftButton")
  SetItemRef("addon:OtherAddon:1", "[x]", "LeftButton")
  eq(opened, 2)
end)

test("works with only the SetItemRef hook or only EventRegistry", function(wow)
  local ns = boot(wow, { noRegistry = true })
  local link = linkOf(say("CHAT_MSG_SAY", "www.example.com"))
  SetItemRef(link, "", "LeftButton")
  eq(ns.Window().box:GetText(), "www.example.com")
end)

test("only EventRegistry: the callback finds the link whatever comes first", function(wow)
  local ns = boot(wow, { noItemRef = true })
  local link = linkOf(say("CHAT_MSG_SAY", "www.example.com"))
  local cb = game.callbacks.SetItemRef[1]
  cb.fn(cb.owner, link, "", "LeftButton")
  eq(ns.Window().box:GetText(), "www.example.com")
  wow.clock = wow.clock + 1
  ns.Window():Hide()
  cb.fn(link, "", "LeftButton") -- without the owner in front
  eq(ns.Window():IsShown(), true)
end)

test("old links fall back to the address in the link text", function(wow)
  local ns = boot(wow)
  for i = 1, ns.MAX_URLS + 5 do say("CHAT_MSG_SAY", "site" .. i .. ".com") end
  eq(ns.store.urls[1], nil, "oldest forgotten")
  eq(ns.store.urls[ns.MAX_URLS + 5], "site505.com")
  SetItemRef("addon:LinkCatcher:1", "|cff3fa9f5|Haddon:LinkCatcher:1|h[site1.com]|h|r", "LeftButton")
  eq(ns.Window().box:GetText(), "site1.com")
  wow.clock = wow.clock + 1
  ns.Window():Hide()
  SetItemRef("addon:LinkCatcher:2", nil, "LeftButton")
  eq(ns.Window():IsShown(), false)
  eq(lastChat(wow):find("too old", 1, true) ~= nil, true)
end)

test("the box stays read only and Escape closes it", function(wow)
  local ns = boot(wow)
  ns.ShowUrl("www.example.com")
  local box = ns.Window().box
  box:SetText("typed")
  box.scripts.OnTextChanged(box, true)
  eq(box:GetText(), "www.example.com")
  box.scripts.OnEscapePressed(box)
  eq(ns.Window():IsShown(), false)
  eq(UISpecialFrames[1], "LinkCatcherFrame")
end)

test("codes are stripped for copying", function(wow)
  local ns = boot(wow)
  eq(ns.StripCodes("|cffa335ee|Hitem:19019|h[Thunderfury]|h|r drops"), "[Thunderfury] drops")
  eq(ns.StripCodes("go |cff3fa9f5|Haddon:LinkCatcher:3|h[www.example.com]|h|r now"), "go www.example.com now")
  eq(ns.StripCodes("|TInterface\\Icons\\x:0|t|A:raidicon:0:0|ahi|nthere"), "hi\nthere")
  eq(ns.StripCodes("a || b |cnIQ4:epic|r"), "a || b epic")
  eq(ns.StripCodes("[|Kq12|k]: hey"), "[(name)]: hey")
  eq(ns.StripCodes("plain 1.5"), "plain 1.5")
end)

test("/lc copy shows the last lines without codes and skips secret ones", function(wow)
  local ns = boot(wow)
  game.lines = { "one", "|cffff0000two|r", { secret = true }, "[Mira]: www.example.com" }
  wow.slash("/lc copy")
  local f = ns.Window()
  eq(f:IsShown(), true)
  eq(f.title:GetText(), "Copy chat")
  eq(f.box:GetText(), "one\ntwo\n[Mira]: www.example.com")
  eq(f.hint:GetText():find("1 hidden lines left out", 1, true) ~= nil, true)
  wow.slash("/lc copy 2")
  eq(f.box:GetText(), "[Mira]: www.example.com")
end)

test("line counts are clamped", function(wow)
  local ns = boot(wow)
  eq(ns.LineCount(""), 100)
  eq(ns.LineCount("abc"), 100)
  eq(ns.LineCount("0"), 1)
  eq(ns.LineCount("20.7"), 20)
  eq(ns.LineCount("9999"), 500)
end)

test("/lc copy with an empty or unreadable chat window", function(wow)
  local ns = boot(wow)
  wow.slash("/lc copy")
  eq(lastChat(wow):find("nothing to copy", 1, true) ~= nil, true)
  DEFAULT_CHAT_FRAME.GetMessageInfo = nil
  wow.slash("/linkcatcher copy")
  eq(lastChat(wow):find("cannot be read", 1, true) ~= nil, true)
  eq(ns.Window(), nil, "no window opened")
end)

test("/lc off and on switch the links and are saved", function(wow)
  boot(wow)
  eq(LinkCatcherDB.enabled, true)
  wow.slash("/lc OFF")
  eq(LinkCatcherDB.enabled, false)
  eq(say("CHAT_MSG_SAY", "www.example.com"), "www.example.com")
  wow.slash("/lc")
  eq(lastChat(wow):find("off right now", 1, true) ~= nil, true)
  wow.slash("/lc on")
  eq(LinkCatcherDB.enabled, true)
  eq(linkOf(say("CHAT_MSG_SAY", "www.example.com")) ~= nil, true)
end)

test("saved settings are kept, broken ones replaced", function(wow)
  local ns = boot(wow, nil, { enabled = false })
  eq(ns.Enabled(), false)
  eq(say("CHAT_MSG_SAY", "www.example.com"), "www.example.com")
  local ns2 = boot(wow, nil, "garbage")
  eq(type(LinkCatcherDB), "table")
  eq(ns2.Enabled(), true)
end)

test("help lists the commands", function(wow)
  boot(wow)
  wow.slash("/lc help")
  eq(lastChat(wow):find("/lc copy", 1, true) ~= nil, true)
  eq(lastChat(wow):find("/lc off", 1, true) ~= nil, true)
end)
