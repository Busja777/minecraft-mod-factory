-- Tests for Emote Bar, run by tools/wow/client/run.lua.

-- The game's emote constants, a part of the real list (Retail 12.1.5): EMOTE<i>_TOKEN from
-- Blizzard_ChatFrameBase/Mainline/ChatEmoteConstants.lua, EMOTE<i>_CMD<j> from GlobalStrings (enUS, deDE).
local ENGLISH = {
  [1] = { "AGREE", "/agree", "/agree" },
  [2] = { "AMAZE", "/amaze", "/amaze" },
  [3] = { "ANGRY", "/angry", "/mad", "/angry", "/mad" },
  [4] = { "APOLOGIZE", "/apologize", "/sorry", "/apologize", "/sorry" },
  [5] = { "APPLAUD", "/applaud", "/bravo", "/applause", "/applaud", "/bravo", "/applause" },
  [17] = { "BOW", "/bow", "/bow" },
  [19] = { "BYE", "/bye", "/goodbye", "/farewell", "/bye", "/goodbye", "/farewell" },
  [21] = { "CHEER", "/cheer", "/cheer", "/woot", "/woot" },
  [35] = { "DANCE", "/dance", "/dance" },
  [56] = { "HELLO", "/hello", "/hi", "/hello", "/hi" },
  [57] = { "HUG", "/hug", "/hug", "/hug" },
  [61] = { "LAUGH", "/laugh", "/lol", "/laugh", "/lol" },
  [98] = { "THANK", "/thank", "/thanks", "/ty", "/thank", "/thanks", "/ty" },
  [102] = { "WAVE", "/wave", "/wave" },
  [454] = { "FORTHEALLIANCE", "/forthealliance", "/forthealliance" },
  [628] = { "LEAN", "/lean", "/lean" },
}

-- The German client: the first command is German, the English ones still work.
local GERMAN = {
  [1] = { "AGREE", "/zustimmen", "/agree" },
  [17] = { "BOW", "/verbeugen", "/bow" },
  [19] = { "BYE", "/tschüss", "/lebtwohl", "/verabschieden", "/bye", "/goodbye", "/farewell" },
  [21] = { "CHEER", "/jubeln", "/cheer", "/woot", "/woot" },
  [35] = { "DANCE", "/tanzen", "/dance" },
  [56] = { "HELLO", "/hallo", "/hi", "/hello", "/hi" },
  [61] = { "LAUGH", "/lachen", "/lol", "/laugh", "/lol" },
  [98] = { "THANK", "/danken", "/Danke", "/ds", "/thank", "/thanks", "/ty" },
  [102] = { "WAVE", "/winken", "/wave" },
}

-- The parts of the game the stand-in client lacks: the emote constants, MAXEMOTEINDEX,
-- C_ChatInfo.PerformEmote and DoEmote. game.performed records every emote the addon runs.
local game

local function model(opts)
  opts = opts or {}
  game = { performed = {}, old = {} }
  local list = opts.list or ENGLISH
  if not opts.noEmotes then
    for i, e in pairs(list) do
      _G["EMOTE" .. i .. "_TOKEN"] = e[1]
      for j = 2, #e do _G["EMOTE" .. i .. "_CMD" .. (j - 1)] = e[j] end
    end
    MAXEMOTEINDEX = 628
  end
  if not opts.noPerform then
    C_ChatInfo = {
      PerformEmote = function(emote, target, suppress)
        if opts.refuse then error("restricted") end
        game.performed[#game.performed + 1] = { emote = emote, target = target, suppress = suppress }
        return true
      end,
    }
  end
  if opts.doEmote then
    DoEmote = function(emote) game.old[#game.old + 1] = emote end
  end
end

local function boot(wow, opts)
  model(opts)
  if opts and opts.saved then EmoteBarDB = opts.saved end
  if opts and opts.locale then wow.locale = opts.locale end
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("ADDON_LOADED", "EmoteBar")
  wow.fire("PLAYER_LOGIN")
  return ns
end

local PREFIX = "|cffffd100Emote Bar:|r "
local function last(wow)
  local line = wow.chat[#wow.chat] or ""
  if line:sub(1, #PREFIX) == PREFIX then return line:sub(#PREFIX + 1) end
  return line
end

-- The labels of the visible buttons, in order.
local function labels(ns)
  local out = {}
  for _, b in ipairs(ns.Buttons()) do
    if b:IsShown() then out[#out + 1] = b:GetText() end
  end
  return table.concat(out, ",")
end

local function list(ns) return table.concat(ns.db.emotes, ",") end

test("addon defines only its own globals", function(wow, installed, before)
  local ns = boot(wow, { doEmote = true })
  wow.slash("/emotebar add bow")
  wow.slash("/emotebar remove 1")
  wow.slash("/emotebar list")
  wow.slash("/emotebar lock")
  wow.slash("/eb")
  wow.slash("/eb help")
  ns.Buttons()[1]:Click()
  EmoteBarFrame.scripts.OnEnter(EmoteBarFrame)
  ns.Buttons()[1].scripts.OnEnter(ns.Buttons()[1])
  local allowed = { EmoteBarDB = true, EmoteBarFrame = true, SLASH_EMOTEBAR1 = true, SLASH_EMOTEBAR2 = true,
    C_ChatInfo = true, DoEmote = true, MAXEMOTEINDEX = true } -- the last three are the test's model
  for k in pairs(_G) do
    local fake = type(k) == "string" and k:match("^EMOTE%d+_[A-Z]+%d*$")
    if not before[k] and not installed[k] and not allowed[k] and not fake then error("unexpected global " .. tostring(k)) end
  end
end)

test("core: the emote list is read from the game's constants", function(wow)
  local ns = boot(wow)
  local index = ns.Index()
  eq(index.count, 16)
  eq(index.byCommand["wave"], "WAVE")
  eq(index.byCommand["hi"], "HELLO")
  eq(index.byCommand["ty"], "THANK")
  eq(index.byCommand["woot"], "CHEER")
  eq(index.byCommand["lean"], "LEAN", "the last index of 12.1.5 is read")
  eq(index.label["THANK"], "thank", "the label is the first command")
  eq(index.label["APPLAUD"], "applaud")
  -- holes between indices, a token without commands, a secret value and MAXEMOTEINDEX above the scan
  local g = {
    EMOTE1_TOKEN = "AGREE", EMOTE1_CMD1 = "/agree",
    EMOTE5_TOKEN = "NOCOMMAND",
    EMOTE7_TOKEN = { secret = true }, EMOTE7_CMD1 = "/secret",
    EMOTE1200_TOKEN = "LATE", EMOTE1200_CMD1 = "/late",
  }
  local small = ns.BuildIndex(function(name) return g[name] end, 1200)
  eq(small.count, 2)
  eq(small.label["NOCOMMAND"], nil, "a token without a command is not an emote you can type")
  eq(small.byCommand["secret"], nil, "a secret value is skipped")
  eq(small.byCommand["late"], "LATE")
  eq(ns.BuildIndex(nil, 10).count, 0)
end)

test("core: emotes are found by command, with or without slash, or by token", function(wow)
  local ns = boot(wow)
  local index = ns.Index()
  eq(ns.Resolve(index, "wave"), "WAVE")
  eq(ns.Resolve(index, "/wave"), "WAVE")
  eq(ns.Resolve(index, "  /Wave "), "WAVE")
  eq(ns.Resolve(index, "WAVE"), "WAVE")
  eq(ns.Resolve(index, "/hi"), "HELLO")
  eq(ns.Resolve(index, "thanks"), "THANK")
  eq(ns.Resolve(index, "forthealliance"), "FORTHEALLIANCE")
  eq(ns.Resolve(index, "fly"), nil)
  eq(ns.Resolve(index, ""), nil)
  eq(ns.Resolve(index, "/"), nil)
  eq(ns.Resolve(index, "wave hello"), nil)
  eq(ns.Resolve(index, nil), nil)
  eq(ns.Label(index, "HELLO"), "hello")
  eq(ns.Command(index, "LAUGH"), "/laugh")
  eq(ns.Label(index, "GONE"), "gone", "a token the game lacks is shown by its name")
end)

test("german client: german and english commands are accepted, the token is stored", function(wow)
  local ns = boot(wow, { list = GERMAN, locale = "deDE" })
  local index = ns.Index()
  eq(ns.Resolve(index, "/winken"), "WAVE")
  eq(ns.Resolve(index, "wave"), "WAVE")
  eq(ns.Resolve(index, "Danke"), "THANK")
  eq(ns.Resolve(index, "/danke"), "THANK")
  eq(ns.Resolve(index, "tschüss"), "BYE")
  eq(labels(ns), "winken,hallo,danken,jubeln,tanzen,lachen", "the buttons show the client's own commands")
  wow.slash("/emotebar add verbeugen")
  eq(list(ns), "WAVE,HELLO,THANK,CHEER,DANCE,LAUGH,BOW")
  eq(last(wow), "/verbeugen added as button 7.")
  wow.slash("/emotebar remove winken")
  eq(list(ns), "HELLO,THANK,CHEER,DANCE,LAUGH,BOW")
end)

test("first login: the friendly defaults, saved for the account", function(wow)
  local ns = boot(wow)
  eq(list(ns), "WAVE,HELLO,THANK,CHEER,DANCE,LAUGH")
  eq(labels(ns), "wave,hello,thank,cheer,dance,laugh")
  eq(EmoteBarDB.emotes, ns.db.emotes)
  eq(EmoteBarDB.version, 1)
  eq(EmoteBarDB.locked, false)
  eq(EmoteBarDB.hidden, false)
  eq(EmoteBarFrame:IsShown(), true)
  eq(EmoteBarFrame.empty:IsShown(), false)
  eq(EmoteBarFrame.point[1], "BOTTOM")
end)

test("core: saved lists are cleaned", function(wow)
  local ns = boot(wow)
  local index = ns.Index()
  eq(table.concat(ns.CleanList(nil, index), ","), "WAVE,HELLO,THANK,CHEER,DANCE,LAUGH")
  eq(table.concat(ns.CleanList({}, index), ","), "", "an emptied bar stays empty")
  eq(table.concat(ns.CleanList({ "wave", "WAVE", 5, "GONE", "bow", "bad token", {} }, index), ","), "WAVE,BOW")
  local many = { "AGREE", "AMAZE", "ANGRY", "APOLOGIZE", "APPLAUD", "BOW", "BYE", "CHEER", "DANCE", "HELLO", "HUG", "LAUGH", "THANK", "WAVE" }
  eq(#ns.CleanList(many, index), 12, "at most twelve")
  local unknown = ns.BuildIndex(function() return nil end, 10)
  eq(table.concat(ns.CleanList({ "GONE", "WAVE" }, unknown), ","), "GONE,WAVE", "without the game's list nothing is dropped")
  -- a client without CHEER leaves it out of the defaults
  local g = { EMOTE1_TOKEN = "WAVE", EMOTE1_CMD1 = "/wave", EMOTE2_TOKEN = "DANCE", EMOTE2_CMD1 = "/dance" }
  eq(table.concat(ns.CleanList(nil, ns.BuildIndex(function(n) return g[n] end, 5)), ","), "WAVE,DANCE")
end)

test("saved settings: list, lock, hidden state and position come back at the next login", function(wow)
  local ns = boot(wow, { saved = { emotes = { "bow", "HUG", "GONE", "HUG" }, locked = true, hidden = true, point = { "TOPLEFT", "TOPLEFT", 120, -80 } } })
  eq(list(ns), "BOW,HUG")
  eq(labels(ns), "bow,hug")
  eq(ns.db.locked, true)
  eq(EmoteBarFrame:IsShown(), false)
  local p = EmoteBarFrame.point
  eq(p[1], "TOPLEFT")
  eq(p[2], UIParent)
  eq(p[3], "TOPLEFT")
  eq(p[4], 120)
  eq(p[5], -80)
end)

test("a broken saved file starts fresh", function(wow)
  local ns = boot(wow, { saved = { emotes = "WAVE", locked = "yes", point = "here" } })
  eq(list(ns), "WAVE,HELLO,THANK,CHEER,DANCE,LAUGH")
  eq(ns.db.locked, false)
  eq(ns.db.point, nil)
  eq(EmoteBarFrame.point[1], "BOTTOM")
end)

test("a button runs its emote token through C_ChatInfo.PerformEmote", function(wow)
  local ns = boot(wow)
  ns.Buttons()[1]:Click()
  ns.Buttons()[3]:Click()
  eq(#game.performed, 2)
  eq(game.performed[1].emote, "WAVE")
  eq(game.performed[1].target, nil, "no target name: the game uses your target")
  eq(game.performed[2].emote, "THANK")
  eq(#wow.chat, 0, "nothing is printed")
end)

test("german client: the button still sends the language-independent token", function(wow)
  local ns = boot(wow, { list = GERMAN, locale = "deDE" })
  ns.Buttons()[1]:Click()
  eq(game.performed[1].emote, "WAVE")
end)

test("without PerformEmote the old DoEmote is used, without both nothing breaks", function(wow)
  local ns = boot(wow, { noPerform = true, doEmote = true })
  ns.Buttons()[2]:Click()
  eq(game.old[1], "HELLO")
  DoEmote = nil
  ns.Buttons()[2]:Click()
  eq(last(wow), "The game did not run /hello right now.")
end)

test("a refused emote is reported, not a Lua error", function(wow)
  local ns = boot(wow, { refuse = true })
  ns.Buttons()[4]:Click()
  eq(last(wow), "The game did not run /cheer right now.")
end)

test("/emotebar add: adds a valid emote once, refuses unknown ones", function(wow)
  local ns = boot(wow)
  wow.slash("/emotebar add bow")
  eq(last(wow), "/bow added as button 7.")
  eq(list(ns), "WAVE,HELLO,THANK,CHEER,DANCE,LAUGH,BOW")
  eq(labels(ns), "wave,hello,thank,cheer,dance,laugh,bow")
  eq(EmoteBarDB.emotes[7], "BOW", "saved at once")
  wow.slash("/emotebar add /hi")
  eq(last(wow), "/hello is on the bar already, as button 2.")
  wow.slash("/emotebar ADD Fly")
  eq(last(wow), "Fly is not an emote of the game. Use its chat command, for example /emotebar add wave.")
  wow.slash("/emotebar add")
  eq(last(wow), "Name the emote, for example /emotebar add wave.")
  eq(#ns.db.emotes, 7)
  ns.Buttons()[7]:Click()
  eq(game.performed[1].emote, "BOW")
end)

test("/emotebar add: at most twelve buttons", function(wow)
  local ns = boot(wow)
  for _, e in ipairs({ "agree", "amaze", "angry", "apologize", "applaud", "bow" }) do wow.slash("/emotebar add " .. e) end
  eq(#ns.db.emotes, 12)
  wow.slash("/emotebar add hug")
  eq(last(wow), "The bar is full with 12 emotes. Remove one first with /emotebar remove <emote or number>.")
  eq(#ns.db.emotes, 12)
  eq(ns.Position(ns.db.emotes, "HUG"), nil)
  local w, h = ns.BarSize(12)
  eq(w, 4 * 2 + 6 * 72 + 5 * 2)
  eq(h, 4 * 2 + 2 * 22 + 2)
  local x, y = ns.ButtonOffset(7)
  eq(x, 4)
  eq(y, -(4 + 24), "button 7 starts the second row")
end)

test("/emotebar remove: by emote, by number, in any form", function(wow)
  local ns = boot(wow)
  wow.slash("/emotebar remove /thanks")
  eq(last(wow), "/thank removed.")
  eq(list(ns), "WAVE,HELLO,CHEER,DANCE,LAUGH")
  wow.slash("/emotebar remove 1")
  eq(last(wow), "/wave removed.")
  eq(list(ns), "HELLO,CHEER,DANCE,LAUGH")
  eq(labels(ns), "hello,cheer,dance,laugh", "the buttons move up, the extra ones are hidden")
  wow.slash("/emotebar remove 9")
  eq(last(wow), "There is no button 9. The bar has 4.")
  wow.slash("/emotebar remove 0")
  eq(last(wow), "There is no button 0. The bar has 4.")
  wow.slash("/emotebar remove bow")
  eq(last(wow), "/bow is not on the bar.")
  wow.slash("/emotebar remove fly")
  eq(last(wow), "fly is not an emote of the game.")
  wow.slash("/emotebar remove")
  eq(last(wow), "Name the emote or its button number, for example /emotebar remove wave or /emotebar remove 2.")
  eq(list(ns), "HELLO,CHEER,DANCE,LAUGH")
  ns.Buttons()[1]:Click()
  eq(game.performed[1].emote, "HELLO", "button 1 runs the emote now in first place")
end)

test("core: a token the game dropped can still be removed", function(wow)
  local ns = boot(wow)
  local l = { "WAVE", "GONE" }
  eq(ns.Remove(l, "gone", ns.Index()), "GONE")
  eq(table.concat(l, ","), "WAVE")
  local r, why = ns.Remove(l, nil, ns.Index())
  eq(r, nil)
  eq(why, "unknown")
end)

test("an empty bar keeps a small handle with its name", function(wow)
  local ns = boot(wow, { saved = { emotes = { "WAVE" } } })
  wow.slash("/emotebar remove wave")
  eq(#ns.db.emotes, 0)
  eq(labels(ns), "")
  eq(EmoteBarFrame.empty:IsShown(), true)
  eq(EmoteBarFrame.empty:GetText(), "Emote Bar")
  local w, h = ns.BarSize(0)
  eq(w, 4 * 2 + 72)
  EmoteBarFrame.scripts.OnEnter(EmoteBarFrame)
  eq(wow.tooltip.lines[2], "Add an emote with /emotebar add wave.")
  wow.slash("/emotebar list")
  eq(last(wow), "The bar is empty. Add an emote with /emotebar add wave.")
  wow.slash("/emotebar add wave")
  eq(EmoteBarFrame.empty:IsShown(), false)
end)

test("/emotebar shows and hides the bar, /eb is the short form", function(wow)
  local ns = boot(wow)
  wow.slash("/emotebar")
  eq(EmoteBarFrame:IsShown(), false)
  eq(EmoteBarDB.hidden, true)
  eq(last(wow), "The bar is hidden. /emotebar shows it again.")
  wow.slash("/eb")
  eq(EmoteBarFrame:IsShown(), true)
  eq(EmoteBarDB.hidden, false)
  eq(last(wow), "The bar is shown.")
  wow.slash("/eb list")
  eq(last(wow), "On the bar: 1 /wave, 2 /hello, 3 /thank, 4 /cheer, 5 /dance, 6 /laugh.")
end)

test("lock: a locked bar does not move, an unlocked one saves where it was dropped", function(wow)
  local ns = boot(wow)
  local moved = 0
  EmoteBarFrame.StartMoving = function() moved = moved + 1 end
  local b = ns.Buttons()[2]
  b.scripts.OnEnter(b)
  eq(wow.tooltip.lines[1], "/hello")
  eq(wow.tooltip.lines[3], "Drag to move. /emotebar lock locks it.")
  b.scripts.OnDragStart(b) -- dragging a button moves the whole bar
  EmoteBarFrame:SetPoint("TOPLEFT", UIParent, "TOPLEFT", 300, -40)
  b.scripts.OnDragStop(b)
  eq(moved, 1)
  eq(table.concat(EmoteBarDB.point, ","), "TOPLEFT,TOPLEFT,300,-40")
  wow.slash("/emotebar lock")
  eq(last(wow), "The bar is locked.")
  eq(EmoteBarDB.locked, true)
  EmoteBarFrame.scripts.OnDragStart(EmoteBarFrame)
  EmoteBarFrame:SetPoint("CENTER", UIParent, "CENTER", 0, 0)
  EmoteBarFrame.scripts.OnDragStop(EmoteBarFrame)
  eq(moved, 1, "locked: no move")
  eq(EmoteBarDB.point[1], "TOPLEFT", "locked: position unchanged")
  b.scripts.OnEnter(b)
  eq(wow.tooltip.lines[3], "Locked. /emotebar lock unlocks it.")
  wow.slash("/eb lock")
  eq(last(wow), "The bar can be dragged.")
end)

test("help: unknown words show the commands, help texts never use |", function(wow)
  local ns = boot(wow)
  wow.slash("/emotebar help")
  local text = last(wow)
  assert(text:find("/emotebar add <emote>", 1, true), "help lists add")
  assert(text:find("/emotebar remove <emote or number>", 1, true), "help lists remove")
  wow.slash("/emotebar dance")
  eq(last(wow), text)
  wow.slash("/emotebar add fly")
  wow.slash("/emotebar remove 7")
  wow.slash("/emotebar remove")
  wow.slash("/emotebar add")
  wow.slash("/emotebar list")
  for i = 1, 6 do wow.slash("/emotebar add hug") end
  for _, line in ipairs(wow.chat) do
    local body = line:sub(#PREFIX + 1)
    eq(line:sub(1, #PREFIX), PREFIX)
    eq(body:find("|", 1, true), nil, "no | in: " .. body)
  end
end)

test("without the game's emote list nothing can be added and the saved list is kept", function(wow)
  local ns = boot(wow, { noEmotes = true, saved = { emotes = { "WAVE", "BOW" } } })
  eq(list(ns), "WAVE,BOW")
  eq(labels(ns), "wave,bow")
  wow.slash("/emotebar add dance")
  eq(last(wow), "The game's emote list could not be read, so no emote can be added right now.")
  eq(list(ns), "WAVE,BOW")
  ns.Buttons()[2]:Click()
  eq(game.performed[1].emote, "BOW", "a saved token still runs")
end)

test("commands before login do nothing", function(wow)
  model()
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.slash("/emotebar add bow")
  wow.slash("/emotebar")
  eq(#wow.chat, 0)
  eq(ns.db, nil)
  eq(EmoteBarFrame, nil)
end)
