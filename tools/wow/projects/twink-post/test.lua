-- Tests for Twink Post, run by tools/wow/client/run.lua.

-- The parts of the game the stand-in client lacks: level, faction, the normalized realm, the
-- connected realms, class colours, the Send Mail tab with its recipient and subject boxes, the
-- game's menu system and SendMail (which must never be called).
local function world(wow, opts)
  opts = opts or {}
  local w = { level = opts.level or 80, faction = opts.faction or "Alliance", realms = opts.realms, menus = {}, sent = {}, focus = 0 }
  UnitLevel = function() return w.level end
  UnitFactionGroup = function() return w.faction, w.faction end
  GetNormalizedRealmName = function() return ((wow.realm or "Silvermoon"):gsub("[%s%-]", "")) end
  if opts.realms ~= false then
    C_AutoComplete = { GetAutoCompleteRealms = function() return w.realms or {} end }
  end
  UNIT_LEVEL_TEMPLATE = opts.levelTemplate or "Level %d"
  FACTION_ALLIANCE = "Alliance"
  FACTION_HORDE = "Horde"
  SendMail = function(...) w.sent[#w.sent + 1] = { ... } end
  if opts.mailFrame ~= false then
    w.makeMailFrame = nil
    SendMailFrame = CreateFrame("Frame", "SendMailFrame", UIParent)
    SendMailNameEditBox = CreateFrame("EditBox", "SendMailNameEditBox", SendMailFrame)
    SendMailSubjectEditBox = CreateFrame("EditBox", "SendMailSubjectEditBox", SendMailFrame)
    SendMailSubjectEditBox.SetFocus = function() w.focus = w.focus + 1 end
  end
  if opts.menu ~= false then
    MenuUtil = {
      CreateContextMenu = function(owner, generator)
        local root = { owner = owner, items = {} }
        function root:CreateTitle(text) self.items[#self.items + 1] = { title = text } end
        function root:CreateButton(text, callback)
          local item = { text = text, callback = callback, enabled = true }
          function item:SetEnabled(v) self.enabled = v end
          self.items[#self.items + 1] = item
          return item
        end
        generator(owner, root)
        w.menus[#w.menus + 1] = root
        return root
      end,
    }
  end
  -- The buttons of the last menu (the title left out).
  function w.lastMenu()
    local root = w.menus[#w.menus]
    local items = {}
    for i = 2, #root.items do items[#items + 1] = root.items[i] end
    return items, root
  end
  return w
end

-- The way the game starts: saved variables, login, then the mailbox opens.
local function boot(wow, opts)
  opts = opts or {}
  wow.player = opts.player
  wow.realm = opts.realm
  wow.class = opts.class
  if opts.locale then wow.locale = opts.locale end
  local w = world(wow, opts)
  if opts.saved then TwinkPostDB = opts.saved end
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("ADDON_LOADED", "TwinkPost")
  wow.fire("PLAYER_LOGIN")
  return ns, w
end

local function char(name, realm, class, level, faction, realmKey)
  return { name = name, realm = realm, realmKey = realmKey or (realm:gsub("[%s%-]", "")), class = class, level = level, faction = faction }
end

-- An account with characters on Silvermoon, its connected realm Argent Dawn, a far realm and a Pandaren.
local function account()
  return {
    version = 1,
    chars = {
      ["Brakk-Silvermoon"] = char("Brakk", "Silvermoon", "WARRIOR", 70, "Alliance"),
      ["Lumi-Silvermoon"] = char("Lumi", "Silvermoon", "PRIEST", 12, "Alliance"),
      ["Grok-Silvermoon"] = char("Grok", "Silvermoon", "SHAMAN", 80, "Horde"),
      ["Ash-Argent Dawn"] = char("Ash", "Argent Dawn", "MAGE", 45, "Alliance"),
      ["Far-Kazzak"] = char("Far", "Kazzak", "ROGUE", 80, "Alliance"),
      ["Bao-Silvermoon"] = char("Bao", "Silvermoon", "MONK", 5, "Neutral"),
    },
  }
end

local PREFIX = "|cffffd100Twink Post:|r "

local function names(list)
  local out = {}
  for i, c in ipairs(list) do out[i] = c.recipient end
  return table.concat(out, ",")
end

test("addon defines only its own globals", function(wow)
  local mine = {}
  for k in pairs(_G) do mine[k] = true end
  -- the game's own globals that world() models
  for _, k in ipairs({ "UnitLevel", "UnitFactionGroup", "GetNormalizedRealmName", "C_AutoComplete", "UNIT_LEVEL_TEMPLATE",
    "FACTION_ALLIANCE", "FACTION_HORDE", "SendMail", "SendMailFrame", "SendMailNameEditBox", "SendMailSubjectEditBox", "MenuUtil" }) do
    mine[k] = true
  end
  local ns, w = boot(wow, { saved = account() })
  wow.fire("MAIL_SHOW")
  wow.fire("PLAYER_LEVEL_UP", 81)
  ns.button:Click()
  w.lastMenu()[1].callback()
  wow.slash("/twinkpost")
  wow.slash("/tp forget Lumi")
  wow.slash("/tp forget Nobody")
  wow.slash("/tp what")
  local allowed = { TwinkPostDB = true, SLASH_TWINKPOST1 = true, SLASH_TWINKPOST2 = true }
  for k in pairs(_G) do
    if not mine[k] and not allowed[k] then error("unexpected global " .. tostring(k)) end
  end
  eq(#w.sent, 0, "nothing is sent")
end)

test("login notes the character being played", function(wow)
  local ns = boot(wow, { player = "Yubi", realm = "Argent Dawn", class = "MAGE", level = 42, faction = "Horde" })
  eq(ns.me, "Yubi-Argent Dawn")
  local c = TwinkPostDB.chars["Yubi-Argent Dawn"]
  eq(c.name, "Yubi")
  eq(c.realm, "Argent Dawn")
  eq(c.realmKey, "ArgentDawn", "the realm as the game writes it after a hyphen")
  eq(c.class, "MAGE")
  eq(c.level, 42)
  eq(c.faction, "Horde")
  eq(c.seen, wow.now)
  eq(TwinkPostDB.version, 1)
end)

test("saved characters of other logins are kept and updated", function(wow)
  local saved = account()
  saved.chars["Yubi-Silvermoon"] = char("Yubi", "Silvermoon", "MAGE", 10, "Alliance")
  local ns = boot(wow, { saved = saved, level = 11 })
  local count = 0
  for _ in pairs(TwinkPostDB.chars) do count = count + 1 end
  eq(count, 7, "six others and the player")
  eq(TwinkPostDB.chars["Yubi-Silvermoon"].level, 11, "the new level")
  eq(TwinkPostDB.chars["Brakk-Silvermoon"].level, 70, "others stay as they were")
  eq(ns.db, TwinkPostDB)
end)

test("core: broken saved data is cleaned, nothing else lost", function(wow)
  local ns = boot(wow)
  local db = ns.PrepareDB({ chars = {
    ["A-Silvermoon"] = { name = "A", realm = "Silvermoon", level = "high", class = 5 },
    ["B-X"] = "nonsense",
    ["C-"] = { name = "C", realm = "" },
    ["D-Argent Dawn"] = { name = "D", realm = "Argent Dawn", faction = "Horde" },
  } })
  eq(db.chars["B-X"], nil)
  eq(db.chars["C-"], nil)
  eq(db.chars["A-Silvermoon"].realmKey, "Silvermoon")
  eq(db.chars["A-Silvermoon"].level, nil, "a level that is no number")
  eq(db.chars["A-Silvermoon"].class, nil)
  eq(db.chars["D-Argent Dawn"].realmKey, "ArgentDawn")
  eq(db.chars["D-Argent Dawn"].faction, "Horde")
  eq(type(ns.PrepareDB(nil).chars), "table")
  eq(type(ns.PrepareDB({ chars = 3 }).chars), "table")
end)

test("core: secret or missing values keep what was known", function(wow)
  local ns = boot(wow)
  local chars = {}
  local secret = { secret = true }
  eq(ns.Record(chars, { name = secret, realm = "Silvermoon" }, 1), nil, "no name, no entry")
  eq(ns.Record(chars, { name = "Yubi", realm = nil }, 1), nil, "no realm, no entry")
  ns.Record(chars, { name = "Yubi", realm = "Silvermoon", class = "MAGE", level = 30, faction = "Alliance" }, 1)
  local key, c = ns.Record(chars, { name = "Yubi", realm = "Silvermoon", class = secret, level = secret, faction = secret }, 2)
  eq(key, "Yubi-Silvermoon")
  eq(c.class, "MAGE")
  eq(c.level, 30)
  eq(c.faction, "Alliance")
  eq(c.seen, 2)
  ns.Record(chars, { name = "Yubi", realm = "Silvermoon", level = 0 }, 3)
  eq(c.level, 30, "level 0 is not a level")
end)

test("a level-up and a visit to the mailbox update the entry", function(wow)
  local ns, w = boot(wow, { level = 20, faction = "Neutral", class = "MONK" })
  local c = TwinkPostDB.chars[ns.me]
  eq(c.faction, "Neutral")
  wow.fire("PLAYER_LEVEL_UP", 21) -- UnitLevel can still say 20 at this moment
  eq(c.level, 21)
  wow.fire("PLAYER_LEVEL_UP", { secret = true })
  eq(c.level, 20, "a secret level falls back to UnitLevel")
  w.faction = "Horde" -- the Pandaren picked a side
  w.level = 22
  wow.fire("MAIL_SHOW")
  eq(c.faction, "Horde")
  eq(c.level, 22)
end)

test("events before login are ignored", function(wow)
  wow.player = nil
  world(wow)
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("MAIL_SHOW")
  wow.fire("PLAYER_LEVEL_UP", 5)
  wow.slash("/twinkpost")
  eq(ns.db, nil)
  eq(#wow.chat, 0)
end)

test("the list: own realm, own faction first, the player and other realms left out", function(wow)
  local ns = boot(wow, { saved = account(), realms = {} })
  eq(names(ns.CurrentCandidates()), "Brakk,Lumi,Grok", "Yubi, Kazzak, Argent Dawn and the neutral Pandaren are missing")
  local list = ns.CurrentCandidates()
  eq(list[1].sameFaction, true)
  eq(list[3].sameFaction, false, "Horde after Alliance")
  eq(list[3].faction, "Horde")
end)

test("the list: connected realms get Name-Realm", function(wow)
  local ns = boot(wow, { saved = account(), realms = { "Silvermoon", "ArgentDawn" } })
  eq(names(ns.CurrentCandidates()), "Ash-ArgentDawn,Brakk,Lumi,Grok")
  local ash = ns.CurrentCandidates()[1]
  eq(ash.sameRealm, false)
  eq(ash.realm, "Argent Dawn")
end)

test("the list: a player on the connected realm writes the home realm out", function(wow)
  local ns = boot(wow, { saved = account(), realm = "Argent Dawn", player = "Zed", realms = { "Silvermoon", "ArgentDawn" } })
  eq(names(ns.CurrentCandidates()), "Ash,Brakk-Silvermoon,Lumi-Silvermoon,Grok-Silvermoon")
end)

test("the list: without the realm API only the own realm counts", function(wow)
  local ns = boot(wow, { saved = account(), realms = false })
  eq(C_AutoComplete, nil)
  eq(names(ns.CurrentCandidates()), "Brakk,Lumi,Grok")
end)

test("the list: a neutral Pandaren cannot send mail", function(wow)
  local ns = boot(wow, { saved = account(), faction = "Neutral" })
  eq(#ns.CurrentCandidates(), 0)
  eq(#ns.Candidates(account().chars, nil, "Silvermoon", {}, nil), 0, "unknown faction")
end)

test("core: realm keys and recipients", function(wow)
  local ns = boot(wow)
  eq(ns.RealmKey("Argent Dawn"), "ArgentDawn")
  eq(ns.RealmKey("Azjol-Nerub"), "AzjolNerub")
  eq(ns.RealmKey(""), nil)
  eq(ns.RealmKey({ secret = true }), nil)
  eq(ns.Recipient({ name = "Ash", realmKey = "ArgentDawn" }, "argentdawn"), "Ash", "case does not matter")
  eq(ns.Recipient({ name = "Ash", realmKey = "ArgentDawn" }, "Silvermoon"), "Ash-ArgentDawn")
  local set = ns.RealmSet("Silvermoon", { "Argent Dawn", { secret = true }, 5 })
  eq(set.silvermoon, true)
  eq(set.argentdawn, true)
end)

test("the button sits next to the recipient box and fills it", function(wow)
  local ns, w = boot(wow, { saved = account() })
  local b = ns.button
  eq(b ~= nil, true, "created at login")
  eq(b.point[1], "LEFT")
  eq(b.point[2], SendMailNameEditBox)
  eq(b.point[3], "RIGHT")
  local found = false
  for _, child in ipairs(SendMailFrame.children) do if child == b then found = true end end
  eq(found, true, "a child of the Send Mail tab, so it only shows there")
  b:Click()
  local items, root = w.lastMenu()
  eq(root.items[1].title, "Twink Post")
  eq(root.owner, b)
  eq(#items, 3)
  eq(items[1].text, "|cffc69b6dBrakk|r  |cff9d9d9dLevel 70|r", "class colour and level")
  items[3].callback()
  eq(SendMailNameEditBox:GetText(), "Grok")
  eq(w.focus, 1, "on to the subject")
  eq(#w.sent, 0, "nothing is sent")
  wow.fire("MAIL_SHOW")
  eq(ns.button, b, "only one button")
end)

test("the button comes with the mailbox when the mail frame loads late", function(wow)
  local ns = boot(wow, { saved = account(), mailFrame = false })
  eq(ns.button, nil)
  SendMailFrame = CreateFrame("Frame", "SendMailFrame", UIParent)
  SendMailNameEditBox = CreateFrame("EditBox", "SendMailNameEditBox", SendMailFrame)
  wow.fire("MAIL_SHOW")
  eq(ns.button ~= nil, true)
  eq(ns.Fill({ recipient = "Brakk" }), true, "works without a subject box")
  eq(SendMailNameEditBox:GetText(), "Brakk")
  eq(ns.Fill({}), false)
end)

test("an empty menu explains how characters get on it", function(wow)
  local ns, w = boot(wow)
  ns.button:Click()
  local items = w.lastMenu()
  eq(#items, 1)
  eq(items[1].enabled, false)
  eq(items[1].text, "No other character known here yet. Log in once with each of your characters.")
end)

test("without the game's menu system the list goes to chat", function(wow)
  local ns = boot(wow, { saved = account(), menu = false })
  eq(ns.OpenMenu(ns.button), false)
  eq(#wow.chat, 3)
  eq(wow.chat[3], "  Grok  |cff9d9d9dLevel 80, Horde|r", "the other faction is named (no colour known for shamans here)")
end)

test("labels: realm and faction only when they differ, words from the game", function(wow)
  local ns = boot(wow, { levelTemplate = "Stufe %d" })
  FACTION_HORDE = "Horde (de)"
  local c = { name = "Ash", realm = "Argent Dawn", realmKey = "ArgentDawn", class = "NOPE", level = 45, faction = "Horde" }
  eq(ns.Label(c, "Silvermoon", "Alliance"), "Ash  |cff9d9d9dStufe 45, Argent Dawn, Horde (de)|r")
  eq(ns.Label(c, "ArgentDawn", "Horde"), "Ash  |cff9d9d9dStufe 45|r")
  c.level = nil
  eq(ns.Label(c, "ArgentDawn", "Horde"), "Ash")
  UNIT_LEVEL_TEMPLATE = "broken"
  eq(ns.LevelText(3), "Level 3", "a template without %d is not used")
end)

test("class colours: C_ClassColor first, then RAID_CLASS_COLORS", function(wow)
  local ns = boot(wow)
  eq(ns.ClassColored("Yubi", "MAGE"), "|cff3fc7ebYubi|r")
  eq(ns.ClassColored("Yubi", nil), "Yubi")
  C_ClassColor = { GetClassColor = function(class)
    return { WrapTextInColorCode = function(_, text) return "<" .. class .. ">" .. text end }
  end }
  eq(ns.ClassColored("Yubi", "MAGE"), "<MAGE>Yubi")
  C_ClassColor = { GetClassColor = function() error("unknown class") end }
  eq(ns.ClassColored("Yubi", "MAGE"), "|cff3fc7ebYubi|r")
end)

test("/twinkpost lists every known character and the help", function(wow)
  boot(wow, { saved = account() })
  wow.slash("/twinkpost")
  eq(wow.chat[1], PREFIX .. "Known characters: 7")
  eq(wow.chat[2], "  |cff3fc7ebAsh|r - Argent Dawn, Level 45, Alliance")
  local own
  for _, line in ipairs(wow.chat) do if line:find("Yubi", 1, true) then own = line end end
  eq(own, "  |cff3fc7ebYubi|r - Silvermoon, Level 80, Alliance (this character)")
  local help = wow.chat[#wow.chat]
  eq(help:sub(1, #PREFIX), PREFIX)
  eq(help:sub(#PREFIX + 1):find("|", 1, true), nil, "no | in the help text")
  eq(help:find("/twinkpost forget", 1, true) ~= nil, true)
  wow.chat = {}
  wow.slash("/tp list")
  eq(wow.chat[1], PREFIX .. "Known characters: 7")
end)

test("/tp forget removes a character by name or Name-Realm", function(wow)
  local saved = account()
  saved.chars["Brakk-Argent Dawn"] = char("Brakk", "Argent Dawn", "WARRIOR", 10, "Alliance")
  boot(wow, { saved = saved })
  wow.slash("/tp forget lumi")
  eq(wow.chat[1], PREFIX .. "Lumi-Silvermoon forgotten.")
  eq(TwinkPostDB.chars["Lumi-Silvermoon"], nil)
  wow.slash("/tp forget Brakk")
  eq(wow.chat[2], PREFIX .. "Several characters are called Brakk. Use Name-Realm.")
  wow.slash("/tp forget Brakk-ArgentDawn")
  eq(wow.chat[3], PREFIX .. "Brakk-Argent Dawn forgotten.")
  wow.slash("/tp forget Brakk")
  eq(wow.chat[4], PREFIX .. "Brakk-Silvermoon forgotten.", "now only one is left")
  wow.slash("/tp forget Yubi")
  eq(wow.chat[5], PREFIX .. "You cannot forget the character you are playing.")
  eq(TwinkPostDB.chars["Yubi-Silvermoon"] ~= nil, true)
  wow.slash("/tp forget Nobody")
  eq(wow.chat[6], PREFIX .. "No character called Nobody.")
  wow.slash("/tp forget")
  eq(wow.chat[7]:find("/twinkpost lists", 1, true) ~= nil, true, "forget without a name shows the help")
end)

test("a forgotten character leaves the mail menu", function(wow)
  local ns, w = boot(wow, { saved = account() })
  wow.slash("/tp forget Grok")
  ns.button:Click()
  local items = w.lastMenu()
  eq(#items, 2)
end)

-- 1.1: German ------------------------------------------------------------------------------------------

-- Every placeholder of a text, in order: "%d", "%s", "%%".
local function placeholders(text)
  local out = {}
  for p in text:gmatch("%%[%d%.]*[%a%%]") do out[#out + 1] = p end
  return table.concat(out, " ")
end

-- Every command in a text with its word: "/twinkpost, /twinkpost forget, /tp".
local function commands(text)
  local out = {}
  for cmd, rest in text:gmatch("(/t%a*)([^,%.%(%)]*)") do
    if cmd == "/twinkpost" or cmd == "/tp" then
      local word = rest:match("^ (%a+)")
      out[#out + 1] = (word == "forget" or word == "list") and (cmd .. " " .. word) or cmd
    end
  end
  return table.concat(out, ", ")
end

local function german(wow, opts)
  opts = opts or {}
  opts.locale = "deDE"
  opts.levelTemplate = opts.levelTemplate or "Stufe %d"
  return boot(wow, opts)
end

test("German client: /twinkpost and every answer to forget in German", function(wow)
  local saved = account()
  saved.chars["Brakk-Argent Dawn"] = char("Brakk", "Argent Dawn", "WARRIOR", 10, "Alliance")
  german(wow, { saved = saved })
  wow.slash("/twinkpost")
  eq(wow.chat[1], PREFIX .. "Bekannte Charaktere: 8")
  eq(wow.chat[2], "  |cff3fc7ebAsh|r - Argent Dawn, Stufe 45, Alliance", "level from the game's own template")
  local own
  for _, line in ipairs(wow.chat) do if line:find("Yubi", 1, true) then own = line end end
  eq(own, "  |cff3fc7ebYubi|r - Silvermoon, Stufe 80, Alliance (dieser Charakter)")
  eq(wow.chat[#wow.chat], PREFIX .. "/twinkpost zeigt deine Charaktere, /twinkpost forget Name oder Name-Realm entfernt einen. Am Briefkasten trägt die Schaltfläche neben dem Empfängerfeld beim Verschicken von Post einen davon ein.")
  wow.chat = {}
  wow.slash("/tp forget lumi")
  eq(wow.chat[1], PREFIX .. "Lumi-Silvermoon vergessen.")
  wow.slash("/tp forget Brakk")
  eq(wow.chat[2], PREFIX .. "Mehrere Charaktere heißen Brakk. Gib Name-Realm an.")
  wow.slash("/tp forget Brakk-ArgentDawn")
  eq(wow.chat[3], PREFIX .. "Brakk-Argent Dawn vergessen.")
  wow.slash("/tp forget Yubi")
  eq(wow.chat[4], PREFIX .. "Den Charakter, den du gerade spielst, kannst du nicht vergessen.")
  wow.slash("/tp forget Niemand")
  eq(wow.chat[5], PREFIX .. "Kein Charakter heißt Niemand.")
  wow.slash("/tp forget")
  eq(wow.chat[6]:find("/twinkpost zeigt", 1, true) ~= nil, true, "the German help")
end)

test("German client: the button, its tooltip and the menu", function(wow)
  local ns, w = german(wow, { saved = account() })
  ns.button.scripts.OnEnter(ns.button)
  eq(wow.tooltip.lines[1], "Twink Post")
  eq(wow.tooltip.lines[2], "Klicken, um einen deiner Charaktere als Empfänger zu wählen.")
  ns.button:Click()
  local items, root = w.lastMenu()
  eq(root.items[1].title, "Twink Post")
  eq(items[1].text, "|cffc69b6dBrakk|r  |cff9d9d9dStufe 70|r")
  items[1].callback()
  eq(SendMailNameEditBox:GetText(), "Brakk", "the names stay as they are")
  eq(#w.sent, 0, "nothing is sent")
end)

test("German client: the hint without other characters, in the menu and in chat", function(wow)
  local ns, w = german(wow)
  ns.button:Click()
  local items = w.lastMenu()
  eq(items[1].text, "Hier ist noch kein anderer Charakter bekannt. Melde dich einmal mit jedem deiner Charaktere an.")
  MenuUtil = nil
  ns.OpenMenu(ns.button)
  eq(wow.chat[#wow.chat], PREFIX .. "Hier ist noch kein anderer Charakter bekannt. Melde dich einmal mit jedem deiner Charaktere an.")
end)

test("German texts keep every placeholder and command of the English text, in order", function(wow)
  local ns = german(wow)
  local n = 0
  for key, text in pairs(ns.L) do
    n = n + 1
    eq(placeholders(text), placeholders(key), key)
    eq(commands(text), commands(key), "the commands stay: " .. key)
    eq(text:find("|", 1, true), nil, "no | in a German text: " .. key)
  end
  eq(n, 10, "every text on screen has its German one")
  eq(commands("/twinkpost lists, /twinkpost forget Name removes, /tp list."), "/twinkpost, /twinkpost forget, /tp list")
end)

test("an English client keeps the English texts", function(wow)
  local ns = boot(wow, { saved = account(), locale = "enUS" })
  eq(next(ns.L), nil)
  wow.slash("/tp forget Nobody")
  eq(wow.chat[1], PREFIX .. "No character called Nobody.")
  ns.button.scripts.OnEnter(ns.button)
  eq(wow.tooltip.lines[2], "Click to pick one of your characters as the recipient.")
end)
