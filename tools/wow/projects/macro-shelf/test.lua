-- Tests for Macro Shelf, run by tools/wow/client/run.lua.

-- The stand-in client has no macros; these are the game functions and constants the addon reads.
local STAND_IN = {
  "GetNumMacros", "GetMacroInfo", "CreateMacro", "EditMacro", "DeleteMacro", "InCombatLockdown",
  "MAX_ACCOUNT_MACROS", "MAX_CHARACTER_MACROS",
}
local game

local SECRET = { secret = true }

-- The macros of the game: account = { { name, icon, body }, ... }, character = { ... }.
-- Character macros sit behind the account slots (index MAX_ACCOUNT_MACROS + 1 and up), as in Retail.
local function client(g)
  game = { account = {}, character = {}, combat = false, created = {}, edited = 0, maxAccount = 120, maxCharacter = 18 }
  for k, v in pairs(g or {}) do game[k] = v end
  MAX_ACCOUNT_MACROS = game.maxAccount
  MAX_CHARACTER_MACROS = game.maxCharacter
  local function base() return MAX_ACCOUNT_MACROS or 120 end
  GetNumMacros = function()
    if game.secretCount then return SECRET, SECRET end
    return #game.account, #game.character
  end
  GetMacroInfo = function(i)
    local m
    if i <= base() then m = game.account[i] else m = game.character[i - base()] end
    if not m then return nil end
    return m[1], m[2], m[3]
  end
  CreateMacro = function(name, icon, body, perCharacter)
    table.insert(game.created, { name = name, icon = icon, body = body, perCharacter = perCharacter })
    if game.refuse then error("refused") end
    local list = perCharacter and game.character or game.account
    local max = perCharacter and game.maxCharacter or game.maxAccount
    if #list >= max then error("too many macros") end
    table.insert(list, { name, icon, body })
    return perCharacter and base() + #list or #list
  end
  EditMacro = function() game.edited = game.edited + 1 end
  DeleteMacro = function() game.edited = game.edited + 1 end
  InCombatLockdown = function() return game.combat end
end

local function boot(wow, g, saved)
  client(g)
  MacroShelfDB = saved
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("PLAYER_LOGIN")
  return ns
end

local function chatSince(wow, from)
  local out = {}
  for i = from + 1, #wow.chat do out[#out + 1] = wow.chat[i] end
  return table.concat(out, "\n")
end
local function has(text, part) return text:find(part, 1, true) ~= nil end
local function rep(s, n) return string.rep(s, n) end

local EXAMPLE = table.concat({
  "# Macro Shelf export, 2 macros.",
  "",
  "[macro] account 135808 Pull",
  ">/cast Fireball",
  ">/say Pulling!",
  "[end]",
  "",
  "[macro] character 134400 Mount",
  ">#showtooltip",
  ">/cast [flyable] Swift Gryphon; Brown Horse",
  "[end]",
}, "\n")

test("addon defines only its own globals", function(wow, installed, before)
  local ns = boot(wow, { account = { { "Pull", 1, "/cast Fireball" } }, character = { { "Mount", 2, "/mount" } } })
  wow.slash("/macroshelf")
  wow.slash("/mshelf export")
  wow.slash("/mshelf import")
  wow.slash("/mshelf backup")
  wow.slash("/mshelf restore")
  wow.slash("/mshelf help")
  ns.Window().box:SetText(EXAMPLE)
  ns.Window().create:Click()
  local allowed = { MacroShelfDB = true, MacroShelfFrame = true, SLASH_MACROSHELF1 = true, SLASH_MACROSHELF2 = true }
  for _, name in ipairs(STAND_IN) do installed[name] = true end
  for k in pairs(_G) do
    if not before[k] and not installed[k] and not allowed[k] then error("unexpected global " .. tostring(k)) end
  end
end)

test("login creates the saved table, keeps a backup and repairs broken parts", function(wow)
  local saved = { account = { at = 5, macros = { { name = "A", icon = 1, body = "x" } } }, chars = { ["Yubi-Silvermoon"] = { at = 5, macros = {} } } }
  local ns = boot(wow, nil, saved)
  eq(MacroShelfDB.version, 1)
  eq(ns.db, MacroShelfDB)
  eq(MacroShelfDB.account.macros[1].name, "A")
  eq(type(MacroShelfDB.chars["Yubi-Silvermoon"]), "table")
  boot(wow, nil, { chars = "broken", account = 7 })
  eq(type(MacroShelfDB.chars), "table")
  eq(MacroShelfDB.account, nil)
  boot(wow, nil, "nonsense")
  eq(type(MacroShelfDB), "table")
end)

test("export writes every account and character macro, escaping | and \\", function(wow)
  local ns = boot(wow, {
    account = { { "Pull", 135808, "/cast Fireball\n/say Pulling!" }, { "Pipe|Name", 134400, "/run print(1 or 2)|\\n" } },
    character = { { "Mount", 134400, "" } },
  })
  local text = ns.ExportText(ns.CurrentList())
  local lines = {}
  for line in (text .. "\n"):gmatch("(.-)\n") do lines[#lines + 1] = line end
  eq(lines[1], "# Macro Shelf export, 3 macros. Paste it into /macroshelf import.")
  eq(lines[3], "[macro] account 135808 Pull")
  eq(lines[4], ">/cast Fireball")
  eq(lines[5], ">/say Pulling!")
  eq(lines[6], "[end]")
  eq(lines[8], "[macro] account 134400 Pipe\\!Name")
  eq(lines[9], ">/run print(1 or 2)\\!\\\\n")
  eq(lines[12], "[macro] character 134400 Mount")
  eq(lines[13], ">", "an empty macro keeps one empty line")
  eq(text:find("|", 1, true), nil, "the export never holds a |")
end)

test("an export reads back to exactly the same macros", function(wow)
  local ns = boot(wow, {
    account = { { "Pull", 135808, "/cast Fireball\n\n/say  two spaces " }, { "Wéird\\|", "INV_Misc_QuestionMark", "a|b\\c\\\\d" } },
    character = { { "Mount", 134400, "" }, { rep("x", 16), 7, rep("y", 255) } },
  })
  local list = ns.CurrentList()
  local back, errors = ns.Parse(ns.ExportText(list))
  eq(errors, nil)
  eq(#back, #list)
  for i, m in ipairs(list) do
    eq(back[i].scope, m.scope); eq(back[i].name, m.name); eq(back[i].icon, m.icon); eq(back[i].body, m.body)
  end
end)

test("the parser accepts Windows line breaks, comments, indented lines and texture names", function(wow)
  local ns = boot(wow)
  local text = "\r\n  # my macros\r\n[macro] ACCOUNT inv_misc_bag_08 Bag  \r\n   >/click ContainerFrame1\r\n  [end]  \r\n"
  local list, errors = ns.Parse(text)
  eq(errors, nil)
  eq(#list, 1)
  eq(list[1].scope, "account")
  eq(list[1].icon, "inv_misc_bag_08")
  eq(list[1].name, "Bag")
  eq(list[1].body, "/click ContainerFrame1")
  list = ns.Parse(EXAMPLE)
  eq(#list, 2)
  eq(list[2].scope, "character")
  eq(list[2].icon, 134400)
  eq(list[2].body, "#showtooltip\n/cast [flyable] Swift Gryphon; Brown Horse")
end)

test("malformed text is refused as a whole, with line numbers", function(wow)
  local ns = boot(wow)
  local cases = {
    { "[macro] account 1 A\n>/x", "Line 1: the macro is not closed with [end]." },
    { "[macro] account 1 A\n/x\n[end]", "Line 2: every line of a macro starts with >" },
    { "[macro] guild 1 A\n>x\n[end]", "Line 1: the place must be account or character." },
    { "[macro] account -5 A\n>x\n[end]", "Line 1: the icon is not valid." },
    { "[macro] account 0 A\n>x\n[end]", "Line 1: the icon is not valid." },
    { "[macro] account 1\n>x\n[end]", "Line 1: a macro starts with [macro]" },
    { "[macro] account 1 " .. rep("n", 17) .. "\n>x\n[end]", "Line 1: the name is longer than 16 characters." },
    { "[macro] account 1 A\n>" .. rep("b", 256) .. "\n[end]", "Line 1: the macro text is longer than 255 characters." },
    { "[macro] account 1 A\n>" .. rep("b", 200) .. "\n>" .. rep("b", 55) .. "\n[end]", "Line 1: the macro text is longer than 255 characters." },
    { "[macro] account 1 A\n>a|b\n[end]", "Line 2: write \\! instead of |." },
    { "[macro] account 1 A\n>a\\nb\n[end]", "Line 2: a \\ must be followed by \\ or !." },
    { "[macro] account 1 A|B\n>x\n[end]", "Line 1: write \\! instead of |." },
    { "/cast Fireball", "Line 1: this line is not part of a macro." },
    { "", "The text holds no macros." },
    { "# only a comment\n\n", "The text holds no macros." },
  }
  for _, c in ipairs(cases) do
    local list, errors = ns.Parse(c[1])
    eq(list, nil, c[1])
    eq(has(errors[1], c[2]), true, "got " .. tostring(errors[1]) .. " for " .. c[1])
  end
  local list, errors = ns.Parse(EXAMPLE .. "\n[macro] account 1 Bad\n>x")
  eq(list, nil, "one broken macro refuses the good ones too")
  eq(#errors, 1)
  eq(ns.Parse(nil), nil)
  eq(ns.Parse(SECRET), nil)
end)

test("names count characters, not bytes", function(wow)
  local ns = boot(wow)
  eq(ns.Length("Ängste"), 6)
  local name = rep("ä", 16)
  local list = ns.Parse("[macro] account 1 " .. name .. "\n>" .. rep("ü", 255) .. "\n[end]")
  eq(#list, 1, "16 umlauts and 255 umlauts fit")
  eq(ns.Parse("[macro] account 1 " .. name .. "ä\n>x\n[end]"), nil)
  eq(ns.Escape("a|b\\c"), "a\\!b\\\\c")
  eq(ns.Unescape("a\\!b\\\\c"), "a|b\\c")
  eq(ns.Unescape("end\\"), nil, "a lone \\ at the end")
end)

test("import creates the macros in the right place with icon and text", function(wow)
  local ns = boot(wow)
  local lines, done = ns.Import(EXAMPLE)
  eq(done, true)
  eq(lines[1], "Created 2 macros.")
  eq(#game.created, 2)
  eq(game.created[1].name, "Pull")
  eq(game.created[1].icon, 135808)
  eq(game.created[1].body, "/cast Fireball\n/say Pulling!")
  eq(game.created[1].perCharacter, false)
  eq(game.created[2].name, "Mount")
  eq(game.created[2].perCharacter, true)
  eq(#game.account, 1); eq(#game.character, 1)
end)

test("an existing macro is never changed: same text counts as there, other text is skipped", function(wow)
  local ns = boot(wow, {
    account = { { "Pull", 135808, "/cast Fireball\n/say Pulling!" } },
    character = { { "Mount", 134400, "/mount" } },
  })
  local lines = ns.Import(EXAMPLE)
  eq(#game.created, 0)
  eq(game.edited, 0, "EditMacro and DeleteMacro are never called")
  eq(lines[1], "Created 0 macros.")
  eq(lines[2], "Already there: Pull.")
  eq(lines[3], "Skipped, a different macro with this name exists (rename one to keep both): Mount.")
  eq(game.character[1][3], "/mount")
  ns.Import("[macro] account 1 Pull\n>other\n[end]\n[macro] character 1 Pull\n>other\n[end]")
  eq(#game.created, 1, "the same name in the other place is a different macro")
  eq(game.created[1].perCharacter, true)
end)

test("a name twice in one import creates it once", function(wow)
  local ns = boot(wow)
  local lines = ns.Import("[macro] account 1 A\n>x\n[end]\n[macro] account 1 A\n>x\n[end]\n[macro] account 1 A\n>y\n[end]")
  eq(#game.created, 1)
  eq(lines[2], "Already there: A.")
  eq(has(lines[3], "rename one to keep both): A."), true)
end)

test("only as many macros as there are free slots are created", function(wow)
  local account = {}
  for i = 1, 119 do account[i] = { "acc" .. i, 1, "" } end
  local character = {}
  for i = 1, 18 do character[i] = { "chr" .. i, 1, "" } end
  local ns = boot(wow, { account = account, character = character })
  local lines = ns.Import("[macro] account 1 A\n>x\n[end]\n[macro] account 1 B\n>x\n[end]\n[macro] character 1 C\n>x\n[end]")
  eq(#game.created, 1)
  eq(game.created[1].name, "A")
  eq(lines[1], "Created 1 macro.")
  eq(lines[2], "No free macro slot left for: B, C.")
  local free = ns.FreeSlots(130, 20)
  eq(free.account, 0); eq(free.character, 0)
end)

test("in combat nothing is created", function(wow)
  local ns = boot(wow, nil, { chars = {}, account = { at = 1, macros = { { name = "A", icon = 1, body = "x" } } } })
  game.combat = true
  local lines, done = ns.Import(EXAMPLE)
  eq(done, false)
  eq(lines[1], "Macros cannot be created in combat. Try again after the fight.")
  local from = #wow.chat
  wow.slash("/mshelf restore")
  eq(has(chatSince(wow, from), "cannot be created in combat"), true)
  eq(#game.created, 0)
  game.combat = false
  wow.slash("/mshelf restore")
  eq(#game.created, 1)
end)

test("missing slot constants fall back to Retail's 120 and 18", function(wow)
  local ns = boot(wow, { maxAccount = false, maxCharacter = false, character = { { "Mine", 5, "/wave" } } })
  MAX_ACCOUNT_MACROS, MAX_CHARACTER_MACROS = nil, nil
  local a, c = ns.Limits()
  eq(a, 120); eq(c, 18)
  local now = ns.ReadMacros()
  eq(now.character[1].name, "Mine", "character macros are read from slot 121 on")
  MAX_ACCOUNT_MACROS = SECRET
  eq((ns.Limits()), 120, "a secret constant is not used")
  MAX_ACCOUNT_MACROS = 36
  eq((ns.Limits()), 36)
end)

test("backup keeps account macros and each character's macros apart", function(wow)
  local ns = boot(wow, { account = { { "Pull", 135808, "/cast Fireball" } }, character = { { "Mount", 134400, "/mount" } } })
  local from = #wow.chat
  wow.slash("/macroshelf backup")
  local out = chatSince(wow, from)
  eq(has(out, "Saved 1 account macros."), true)
  eq(has(out, "Saved 1 character macros."), true)
  eq(MacroShelfDB.account.at, wow.now)
  eq(MacroShelfDB.account.macros[1].body, "/cast Fireball")
  eq(MacroShelfDB.chars["Yubi-Silvermoon"].macros[1].name, "Mount")
  local saved = MacroShelfDB
  wow.player = "Ohm"
  boot(wow, { account = { { "Pull", 135808, "/cast Fireball" } }, character = { { "Heal", 1, "/cast Heal" } } }, saved)
  wow.slash("/mshelf backup")
  eq(MacroShelfDB.chars["Ohm-Silvermoon"].macros[1].name, "Heal")
  eq(MacroShelfDB.chars["Yubi-Silvermoon"].macros[1].name, "Mount", "another character's backup stays")
  wow.player = nil
end)

test("a place without macros right now never wipes its backup", function(wow)
  local saved = { chars = { ["Yubi-Silvermoon"] = { at = 1, macros = { { name = "Mount", icon = 1, body = "/mount" } } } },
    account = { at = 1, macros = { { name = "Pull", icon = 1, body = "x" } } } }
  local ns = boot(wow, { account = { { "New", 1, "y" } } }, saved)
  local lines = ns.Backup()
  eq(lines[1], "Saved 1 account macros.")
  eq(lines[2], "No character macros found right now, the older backup of 1 was kept.")
  eq(MacroShelfDB.account.macros[1].name, "New")
  eq(MacroShelfDB.chars["Yubi-Silvermoon"].macros[1].name, "Mount")
  eq(MacroShelfDB.chars["Yubi-Silvermoon"].at, 1)
end)

test("restore creates only the missing macros from the backup", function(wow)
  local ns = boot(wow, { account = { { "Pull", 135808, "/cast Fireball" }, { "Taunt", 1, "/cast Taunt" } }, character = { { "Mount", 134400, "/mount" } } })
  ns.Backup()
  table.remove(game.account, 2)
  game.character[1] = { "Mount", 134400, "/mount changed" }
  local lines = ns.Restore()
  eq(#game.created, 1)
  eq(game.created[1].name, "Taunt")
  eq(game.created[1].perCharacter, false)
  eq(lines[1], "Created 1 macro.")
  eq(lines[2], "Already there: Pull.")
  eq(has(lines[3], "Mount"), true, "the changed macro is skipped, not overwritten")
  eq(game.character[1][3], "/mount changed")
  eq(game.edited, 0)
end)

test("restore without a backup says what to do", function(wow)
  local ns = boot(wow)
  eq(ns.Restore()[1], "There is no backup yet. Type /macroshelf backup first.")
  eq(#game.created, 0)
  eq(has(ns.BackupStatus(), "no account backup, no character backup"), true)
end)

test("a backup with a broken entry restores the rest and names the broken one", function(wow)
  local ns = boot(wow, nil, { chars = {}, account = { at = 1, macros = {
    { name = "Good", icon = 1, body = "x" }, { name = rep("z", 20), icon = 1, body = "x" }, { name = "NoIcon", icon = "bad icon", body = "x" },
  } } })
  local lines = ns.Restore()
  eq(#game.created, 1)
  eq(lines[1], "Created 1 macro.")
  eq(has(lines[2], "Not valid: " .. rep("z", 20) .. ", NoIcon (the name is longer than 16 characters)."), true)
end)

test("secret or missing values from the game are skipped", function(wow)
  local ns = boot(wow, { account = { { SECRET, 1, "x" }, { "Plain", SECRET, SECRET } } })
  local now = ns.ReadMacros()
  eq(#now.account, 1)
  eq(now.account[1].name, "Plain")
  eq(now.account[1].icon, 134400, "a secret icon becomes the question mark")
  eq(now.account[1].body, "")
  game.secretCount = true
  local _, a, c = ns.ReadMacros()
  eq(a, 0); eq(c, 0)
  GetMacroInfo = function() error("not available") end
  game.secretCount = false
  eq(#ns.ReadMacros().account, 0)
  GetNumMacros = nil
  eq(#ns.CurrentList(), 0)
end)

test("when the game refuses a macro or cannot create macros, the report says so", function(wow)
  local ns = boot(wow)
  game.refuse = true
  local lines = ns.Import(EXAMPLE)
  eq(lines[1], "Created 0 macros.")
  eq(lines[2], "The game refused: Pull, Mount.")
  CreateMacro = nil
  eq(ns.Import(EXAMPLE)[1], "This game client does not let addons create macros.")
end)

test("slash commands: both names, the window modes and the help", function(wow)
  local ns = boot(wow, { account = { { "Pull", 135808, "/cast Fireball" } } })
  wow.slash("/macroshelf")
  local ui = ns.Window()
  eq(ui:IsShown(), true)
  eq(ui.mode, "export")
  eq(has(ui.box:GetText(), "[macro] account 135808 Pull"), true)
  eq(ui.create:IsShown(), false)
  eq(has(ui.status:GetText(), "Backup: no account backup"), true)
  wow.slash("/mshelf import")
  eq(ui.mode, "import")
  eq(ui.box:GetText(), "")
  eq(ui.create:IsShown(), true)
  wow.slash("/mshelf EXPORT")
  eq(ui.mode, "export")
  local from = #wow.chat
  wow.slash("/mshelf what")
  local out = chatSince(wow, from)
  eq(has(out, "|cffffd100Macro Shelf:|r /macroshelf opens the window"), true)
  eq(has(out, "Short form: /mshelf."), true)
  eq(has(out, "Backup: no account backup, no character backup."), true)
  eq(SLASH_MACROSHELF1, "/macroshelf")
  eq(SLASH_MACROSHELF2, "/mshelf")
  for _, f in ipairs(UISpecialFrames) do eq(f, "MacroShelfFrame") end
end)

test("the export box is read only, the import box creates macros from pasted text", function(wow)
  local ns = boot(wow, { account = { { "Pull", 135808, "/cast Fireball" } } })
  ns.ShowExport()
  local ui = ns.Window()
  local text = ui.box:GetText()
  ui.box:SetText("typed over")
  ui.box.scripts.OnTextChanged(ui.box, true)
  eq(ui.box:GetText(), text, "typing puts the export back")
  ns.ShowImport()
  ui.box:SetText("[macro] character 1 Wave\n>/wave\n[end]")
  ui.box.scripts.OnTextChanged(ui.box, true)
  local from = #wow.chat
  ui.create:Click()
  eq(#game.created, 1)
  eq(game.created[1].name, "Wave")
  eq(has(chatSince(wow, from), "Created 1 macro."), true)
  eq(ui.status:GetText(), "Created 1 macro.")
  ui.create:Click()
  eq(#game.created, 1, "a second press creates nothing new")
  eq(ui.status:GetText(), "Created 0 macros. Already there: Wave.")
  ui.box:SetText("garbage")
  ui.create:Click()
  eq(ui.status:GetText(), "Nothing was imported: Line 1: this line is not part of a macro.")
end)

test("the backup button saves and the status line shows the date", function(wow)
  local ns = boot(wow, { account = { { "Pull", 135808, "/cast Fireball" } } })
  ns.ShowExport()
  local ui = ns.Window()
  ui.backupButton:Click()
  eq(MacroShelfDB.account.macros[1].name, "Pull")
  eq(has(ui.status:GetText(), "Saved 1 account macros."), true)
  eq(has(ns.BackupStatus(), "1 account macros from " .. date("%Y-%m-%d %H:%M", wow.now)), true)
  ui.restoreButton:Click()
  eq(#game.created, 0, "everything is still there")
end)

test("nothing happens before login", function(wow)
  client()
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.slash("/macroshelf")
  wow.slash("/mshelf restore")
  eq(ns.Window(), nil)
  eq(#game.created, 0)
end)

-- 1.1: German ------------------------------------------------------------------------------------------

-- Every placeholder of a text, in order: "%d", "%s", "%%".
local function placeholders(text)
  local out = {}
  for p in text:gmatch("%%[%d%.]*[%a%%]") do out[#out + 1] = p end
  return table.concat(out, " ")
end

local function count(text, plain)
  local n, at = 0, 1
  while true do
    local i = text:find(plain, at, true)
    if not i then return n end
    n, at = n + 1, i + #plain
  end
end

local GP = "|cffffd100Macro Shelf:|r "

test("German client: the window, its buttons and hints in German", function(wow)
  wow.locale = "deDE"
  local ns = boot(wow, { account = { { "Pull", 135808, "/cast Fireball" } } })
  wow.slash("/macroshelf")
  local ui = ns.Window()
  eq(ui.title:GetText(), "Macro Shelf")
  eq(ui.exportButton:GetText(), "Exportieren")
  eq(ui.importButton:GetText(), "Importieren")
  eq(ui.backupButton:GetText(), "Sichern")
  eq(ui.restoreButton:GetText(), "Wiederherstellen")
  eq(ui.create:GetText(), "Makros erstellen")
  eq(ui.hint:GetText(), "Kopiere mit Strg+C (Mac: Cmd+C) und füge es bei einem anderen Charakter unter Importieren ein.")
  eq(ui.status:GetText(), "Sicherung: keine Sicherung der allgemeinen Makros, keine Sicherung der Charaktermakros.")
  wow.slash("/mshelf import")
  eq(ui.hint:GetText(), "Füge hier einen Export ein und klicke auf Makros erstellen. Vorhandene Makros bleiben unverändert.")
  ns = boot(wow)
  ns.ShowExport()
  eq(ns.Window().hint:GetText(), "Du hast noch keine Makros zum Exportieren.")
end)

test("German client: the export keeps its English words and reads back on any client", function(wow)
  wow.locale = "deDE"
  local ns = boot(wow, {
    account = { { "Pull", 135808, "/cast Fireball\n/say Pulling!" } },
    character = { { "Reittier", 134400, "/cast Schneller Greif" } },
  })
  local text = ns.ExportText(ns.CurrentList())
  local lines = {}
  for line in (text .. "\n"):gmatch("(.-)\n") do lines[#lines + 1] = line end
  eq(lines[1], "# Macro-Shelf-Export, 2 Makros. Füge ihn mit /macroshelf import ein.")
  eq(lines[3], "[macro] account 135808 Pull")
  eq(lines[8], "[macro] character 134400 Reittier")
  eq(lines[10], "[end]")
  local back = ns.Parse(text)
  eq(#back, 2, "a German export reads back")
  eq(back[2].name, "Reittier")
  eq(#ns.Parse(EXAMPLE), 2, "an export from an English client reads too")
  wow.locale = "enUS"
  local en = boot(wow)
  eq(#en.Parse(text), 2, "and a German export on an English client")
end)

test("German client: mistakes in the text, with line numbers, in German", function(wow)
  wow.locale = "deDE"
  local ns = boot(wow)
  local _, errors = ns.Parse(table.concat({
    "[macro] konto 1 Name",
    ">/wave",
    "[end]",
    "Hallo",
    "[macro] account 1 Pipe|Name",
    ">/x \\q",
    "/say ohne Zeichen",
    "[end]",
    "[macro] account 1 " .. rep("z", 17),
    ">x",
    "[end]",
    "[macro] account",
    "[macro] account kein-symbol? Name",
  }, "\n"))
  eq(errors[1], "Zeile 1: der Ort muss account oder character sein.")
  eq(errors[2], "Zeile 4: diese Zeile gehört zu keinem Makro.")
  eq(errors[3], "Zeile 5: schreib \\! statt |.")
  eq(errors[4], "Zeile 6: auf ein \\ muss \\ oder ! folgen.")
  eq(errors[5], "Zeile 7: jede Zeile eines Makros beginnt mit >, und [end] schließt das Makro ab.")
  eq(errors[6], "Zeile 9: der Name ist länger als 16 Zeichen.")
  eq(errors[7], "Zeile 12: ein Makro beginnt mit [macro], dem Ort, dem Symbol und dem Namen.")
  eq(errors[8], "Zeile 13: jede Zeile eines Makros beginnt mit >, und [end] schließt das Makro ab.")
  eq(errors[9], "Zeile 12: das Makro wird nicht mit [end] abgeschlossen.", "the open macro of line 12 is never closed")
  local lines = ns.Import("[macro] account 1 A\n>" .. rep("x", 256) .. "\n[end]")
  eq(lines[1], "Nichts wurde importiert:")
  eq(lines[2], "Zeile 1: der Makrotext ist länger als 255 Zeichen.")
  eq(ns.Import("# nur ein Kommentar")[2], "Der Text enthält keine Makros.")
  eq(ns.Import(SECRET)[2], "Es gibt keinen Text zum Lesen.")
end)

test("German client: import, restore and backup report in German", function(wow)
  wow.locale = "deDE"
  local ns = boot(wow, { account = { { "Pull", 135808, "/cast Frostblitz" } }, maxCharacter = 0 })
  local lines = ns.Import(EXAMPLE)
  eq(lines[1], "0 Makros erstellt.")
  eq(lines[2], "Übersprungen, es gibt schon ein anderes Makro mit diesem Namen (benenne eins um, um beide zu behalten): Pull.")
  eq(lines[3], "Kein freier Makroplatz mehr für: Mount.")
  eq(ns.Restore()[1], "Es gibt noch keine Sicherung. Gib zuerst /macroshelf backup ein.")
  local from = #wow.chat
  wow.slash("/mshelf backup")
  eq(chatSince(wow, from), GP .. "Allgemeine Makros gesichert: 1.\n" .. GP .. "Charaktermakros gesichert: 0.")
  eq(ns.BackupStatus(), "Sicherung: allgemeine Makros (1) vom " .. date("%d.%m.%Y %H:%M", wow.now)
    .. ", Charaktermakros (0) vom " .. date("%d.%m.%Y %H:%M", wow.now) .. ".")
  eq(date("%d.%m.%Y %H:%M", wow.now), "20.11.2026 18:00")
  game.account = {}
  eq(ns.Backup()[1], "Gerade keine allgemeinen Makros gefunden, die ältere Sicherung mit 1 bleibt erhalten.")
  game.account = { { "Pull", 135808, "/cast Frostblitz" } }
  game.character = { { "Heal", 1, "/cast Heilen" } }
  ns.Backup()
  game.character = {}
  eq(ns.Backup()[2], "Gerade keine Charaktermakros gefunden, die ältere Sicherung mit 1 bleibt erhalten.")
  game.maxCharacter = 18
  MAX_CHARACTER_MACROS = 18
  table.remove(game.account, 1)
  lines = ns.Restore()
  eq(lines[1], "2 Makros erstellt.")
  lines = ns.Restore()
  eq(lines[1], "0 Makros erstellt.")
  eq(lines[2], "Schon vorhanden: Pull, Heal.")
  game.combat = true
  eq(ns.Restore()[1], "Im Kampf lassen sich keine Makros erstellen. Versuch es nach dem Kampf noch einmal.")
  game.combat = false
  game.refuse = true
  game.account, game.character = {}, {}
  eq(ns.Restore()[2], "Das Spiel hat abgelehnt: Pull, Heal.")
  CreateMacro = nil
  eq(ns.Restore()[1], "Dieser Spielclient lässt Addons keine Makros erstellen.")
end)

test("German client: long lists, broken backups and the help", function(wow)
  wow.locale = "deDE"
  local list = {}
  for i = 1, 12 do list[i] = { name = "M" .. i, icon = 1, body = "x" } end
  list[13] = { name = rep("z", 20), icon = 1, body = "x" }
  local ns = boot(wow, { maxAccount = 0 }, { chars = {}, account = { at = 1, macros = list } })
  local lines = ns.Restore()
  eq(lines[2], "Kein freier Makroplatz mehr für: M1, M2, M3, M4, M5, M6, M7, M8, M9, M10, und 2 weitere.")
  eq(lines[3], "Ungültig: " .. rep("z", 20) .. " (der Name ist länger als 16 Zeichen).")
  local from = #wow.chat
  wow.slash("/mshelf hilfe")
  eq(chatSince(wow, from), GP .. "/macroshelf öffnet das Fenster, /macroshelf export zeigt deine Makros als Text, /macroshelf import öffnet das Feld zum Einfügen, /macroshelf backup sichert deine Makros, /macroshelf restore erstellt die fehlenden aus der Sicherung. Kurzform: /mshelf.\n"
    .. GP .. "Sicherung: allgemeine Makros (13) vom " .. date("%d.%m.%Y %H:%M", 1) .. ", keine Sicherung der Charaktermakros.")
  wow.slash("/mshelf sichern")
  eq(#MacroShelfDB.account.macros, 13, "a German command word does not back up")
  eq(ns.Window(), nil, "nor open the window")
end)

test("German texts keep every placeholder of the English text, in order", function(wow)
  wow.locale = "deDE"
  local ns = boot(wow)
  local n = 0
  for key, text in pairs(ns.L) do
    n = n + 1
    if key == "%Y-%m-%d %H:%M" then
      eq(placeholders(text), "%d %m %Y %H %M", "the German date: day, month, year")
    else
      eq(placeholders(text), placeholders(key), key)
    end
    for _, mark in ipairs({ "<", "[macro]", "[end]", ">", "|", "\\", "/macroshelf", "/mshelf" }) do
      eq(count(text, mark), count(key, mark), "the same " .. mark .. " in: " .. key)
    end
  end
  eq(n, 51, "every text on screen has its German one")
end)

test("an English client keeps the English texts", function(wow)
  wow.locale = "enUS"
  local ns = boot(wow, { account = { { "Pull", 135808, "/cast Fireball" } } })
  eq(next(ns.L), nil)
  wow.slash("/macroshelf")
  local ui = ns.Window()
  eq(ui.restoreButton:GetText(), "Restore")
  eq(ui.create:GetText(), "Create macros")
  eq(ns.Backup()[1], "Saved 1 account macros.")
  eq(ns.BackupStatus(), "Backup: 1 account macros from 2026-11-20 18:00, 0 character macros from 2026-11-20 18:00.")
end)
