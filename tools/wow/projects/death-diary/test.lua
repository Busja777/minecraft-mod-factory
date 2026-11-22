-- Tests for Death Diary, run by tools/wow/client/run.lua.

-- The stand-in client has no zones, levels or death state; these are the game functions the addon reads.
local STAND_IN = { "GetRealZoneText", "GetSubZoneText", "UnitLevel", "UnitFullName", "UnitIsDeadOrGhost" }
local game

local function client(g)
  game = { zone = "Elwynn Forest", sub = "Goldshire", level = 12, dead = false, fullName = "Yubi", fullRealm = "Silvermoon" }
  for k, v in pairs(g or {}) do game[k] = v end
  GetRealZoneText = function() return game.zone end
  GetSubZoneText = function() return game.sub end
  UnitLevel = function() return game.level end
  UnitFullName = function() return game.fullName, game.fullRealm end
  UnitIsDeadOrGhost = function() return game.dead end
end

local function boot(wow, g, saved)
  client(g)
  DeathDiaryDB = saved
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("ADDON_LOADED", "DeathDiary")
  wow.fire("PLAYER_LOGIN")
  return ns
end

-- One death the way the game reports it: dead, then alive again after a release or a resurrection.
local function die(wow, g, alive)
  for k, v in pairs(g or {}) do game[k] = v end
  wow.fire("PLAYER_DEAD")
  wow.clock = wow.clock + 30
  wow.fire(alive or "PLAYER_ALIVE")
end

local function deaths() return DeathDiaryDB.chars["Yubi-Silvermoon"].deaths end
local function lastChat(wow) return wow.chat[#wow.chat] end
local function chatSince(wow, from)
  local out = {}
  for i = from + 1, #wow.chat do out[#out + 1] = wow.chat[i] end
  return table.concat(out, "\n")
end
local function has(text, part) return text:find(part, 1, true) ~= nil end

local SECRET = { secret = true }

test("addon defines only its own globals", function(wow, installed, before)
  boot(wow)
  die(wow)
  wow.slash("/dd")
  wow.slash("/dd last")
  wow.slash("/dd window")
  wow.slash("/dd quiet on")
  wow.slash("/dd reset")
  wow.slash("/dd reset confirm")
  local allowed = { DeathDiaryDB = true, DeathDiaryFrame = true, SLASH_DEATHDIARY1 = true, SLASH_DEATHDIARY2 = true }
  for _, name in ipairs(STAND_IN) do installed[name] = true end
  for k in pairs(_G) do
    if not before[k] and not installed[k] and not allowed[k] then error("unexpected global " .. tostring(k)) end
  end
end)

test("login creates the diary of the character and the settings", function(wow)
  local ns = boot(wow)
  eq(DeathDiaryDB.version, 1)
  eq(#deaths(), 0)
  eq(DeathDiaryDB.settings.quiet, false)
  eq(ns.char, DeathDiaryDB.chars["Yubi-Silvermoon"])
  eq(ns.charKey, "Yubi-Silvermoon")
end)

test("a death is noted with zone, sub-zone, level and time, plus one chat line", function(wow)
  boot(wow)
  wow.fire("PLAYER_DEAD")
  local e = deaths()[1]
  eq(#deaths(), 1)
  eq(e.zone, "Elwynn Forest")
  eq(e.sub, "Goldshire")
  eq(e.level, 12)
  eq(e.t, wow.now)
  eq(lastChat(wow), "|cffffd100Death Diary:|r Death 1 noted: Elwynn Forest, Goldshire, level 12.")
end)

test("a second death event for the same death is ignored", function(wow)
  boot(wow)
  wow.fire("PLAYER_DEAD")
  wow.clock = wow.clock + 1
  wow.fire("PLAYER_DEAD")
  eq(#deaths(), 1, "same death")
  wow.clock = wow.clock + 10
  wow.fire("PLAYER_DEAD")
  eq(#deaths(), 2, "a death long after the first one counts even without an alive event")
end)

test("after the player is alive again the next death counts at once", function(wow)
  boot(wow)
  wow.fire("PLAYER_DEAD")
  wow.fire("PLAYER_ALIVE")
  wow.fire("PLAYER_DEAD")
  eq(#deaths(), 2, "after PLAYER_ALIVE")
  wow.fire("PLAYER_UNGHOST")
  wow.fire("PLAYER_DEAD")
  eq(#deaths(), 3, "after PLAYER_UNGHOST")
end)

test("the sub-zone is left out when it is empty or the zone itself", function(wow)
  boot(wow)
  die(wow, { sub = "" })
  die(wow, { sub = "   " })
  die(wow, { sub = "Elwynn Forest" })
  die(wow, { sub = nil })
  for i = 1, 4 do eq(deaths()[i].sub, nil, "death " .. i) end
  eq(lastChat(wow), "|cffffd100Death Diary:|r Death 4 noted: Elwynn Forest, level 12.")
end)

test("secret or missing values are not stored", function(wow)
  local ns = boot(wow)
  die(wow, { zone = SECRET, sub = SECRET, level = SECRET })
  local e = deaths()[1]
  eq(e.zone, nil)
  eq(e.sub, nil)
  eq(e.level, nil)
  eq(lastChat(wow), "|cffffd100Death Diary:|r Death 1 noted: Unknown zone, unknown level.")
  die(wow, { zone = "", sub = "Goldshire", level = 0 })
  eq(deaths()[2].zone, nil)
  eq(deaths()[2].level, nil)
  eq(ns.PlaceText(deaths()[2]), "Unknown zone, Goldshire")
  eq(ns.CleanLevel(-3), nil)
  eq(ns.CleanLevel(0 / 0), nil, "not a number")
  eq(ns.CleanLevel(80.0), 80)
  eq(ns.CleanText(42), nil)
end)

test("missing game functions do not break a death", function(wow)
  boot(wow)
  GetSubZoneText = nil
  UnitLevel = function() error("not available") end
  die(wow)
  eq(deaths()[1].zone, "Elwynn Forest")
  eq(deaths()[1].sub, nil)
  eq(deaths()[1].level, nil)
end)

test("no diary while the name is secret, it starts once the name is known", function(wow)
  wow.player = SECRET
  local ns = boot(wow, { fullName = SECRET })
  eq(ns.char, nil)
  wow.fire("PLAYER_DEAD")
  eq(DeathDiaryDB.chars["Yubi-Silvermoon"], nil)
  eq(#wow.chat, 0)
  wow.player = "Yubi"
  wow.clock = wow.clock + 30
  wow.fire("PLAYER_DEAD")
  eq(#deaths(), 1)
end)

test("the realm comes from UnitFullName when GetRealmName has none", function(wow)
  wow.realm = ""
  local ns = boot(wow, { fullRealm = "ArgentDawn" })
  eq(ns.charKey, "Yubi-ArgentDawn")
  eq(ns.MakeCharKey("Yubi", nil), nil)
  eq(ns.MakeCharKey("", "Silvermoon"), nil)
  eq(ns.MakeCharKey(SECRET, "Silvermoon"), nil)
end)

test("each character has its own diary in the one saved table", function(wow)
  local saved = { chars = { ["Ohm-Silvermoon"] = { deaths = { { zone = "Durotar", level = 5, t = 1 } } } } }
  local ns = boot(wow, nil, saved)
  die(wow)
  eq(#deaths(), 1)
  eq(#DeathDiaryDB.chars["Ohm-Silvermoon"].deaths, 1, "the other character is untouched")
  eq(ns.SummaryLines(ns.Deaths())[1], "Deaths noted for this character: 1.")
end)

test("only the newest 500 deaths are kept", function(wow)
  local ns = boot(wow)
  local list = {}
  for i = 1, 503 do ns.Push(list, { t = i }) end
  eq(#list, 500)
  eq(list[1].t, 4, "the oldest go first")
  eq(list[500].t, 503)
  local small = {}
  for i = 1, 4 do ns.Push(small, { t = i }, 3) end
  eq(#small, 3)
  eq(small[1].t, 2)
end)

test("deaths per zone: most first, then by name, unknown zones together", function(wow)
  local ns = boot(wow)
  local rows = ns.ByZone({ { zone = "B" }, { zone = "A" }, { zone = "C" }, { zone = "C" }, {}, { zone = "A" } })
  eq(#rows, 4)
  eq(rows[1].name, "A"); eq(rows[1].count, 2)
  eq(rows[2].name, "C"); eq(rows[2].count, 2)
  eq(rows[3].name, "B")
  eq(rows[4].name, "Unknown zone"); eq(rows[4].count, 1)
  eq(#ns.ByZone({}), 0)
end)

test("deaths per level bracket of 10", function(wow)
  local ns = boot(wow)
  eq(ns.BracketStart(1), 1)
  eq(ns.BracketStart(10), 1)
  eq(ns.BracketStart(11), 11)
  eq(ns.BracketStart(80), 71)
  eq(ns.BracketStart(90), 81)
  local rows, unknown = ns.ByBracket({ { level = 45 }, { level = 3 }, { level = 10 }, { level = 41 }, {}, { level = 90 } })
  eq(#rows, 3)
  eq(rows[1].from, 1); eq(rows[1].to, 10); eq(rows[1].count, 2)
  eq(rows[2].from, 41); eq(rows[2].to, 50); eq(rows[2].count, 2)
  eq(rows[3].from, 81); eq(rows[3].count, 1)
  eq(unknown, 1)
end)

test("/dd shows the summary of this character and the commands", function(wow)
  boot(wow)
  local from = #wow.chat
  wow.slash("/dd")
  eq(has(chatSince(wow, from), "No deaths noted for this character yet."), true)
  die(wow, { level = 12 })
  die(wow, { level = 15, zone = "Westfall", sub = "Sentinel Hill" })
  die(wow, { level = 21, zone = "Westfall", sub = "" })
  die(wow, { level = SECRET, zone = "Duskwood" })
  from = #wow.chat
  wow.slash("/deathdiary")
  local out = chatSince(wow, from)
  eq(has(out, "Deaths noted for this character: 4."), true, out)
  eq(has(out, "Top zones: Westfall (2), Duskwood (1), Elwynn Forest (1)."), true, out)
  eq(has(out, "By level: Levels 1-10: 0"), false, "empty brackets are not listed")
  eq(has(out, "By level: Levels 11-20: 2, Levels 21-30: 1, unknown level: 1."), true, out)
  eq(has(out, "/dd last lists your last 10 deaths"), true)
end)

test("the summary lists at most five zones", function(wow)
  local ns = boot(wow)
  local list = {}
  for i = 1, 7 do list[i] = { zone = "Zone " .. i, level = 1 } end
  local lines = ns.SummaryLines(list)
  eq(lines[2], "Top zones: Zone 1 (1), Zone 2 (1), Zone 3 (1), Zone 4 (1), Zone 5 (1).")
end)

test("/dd last lists the last 10 deaths, newest first", function(wow)
  local ns = boot(wow)
  local from = #wow.chat
  wow.slash("/dd last")
  eq(lastChat(wow), "|cffffd100Death Diary:|r No deaths noted for this character yet.")
  for i = 1, 12 do
    wow.now = wow.now + 60
    die(wow, { level = i })
  end
  from = #wow.chat
  wow.slash("/dd LAST")
  eq(#wow.chat - from, 11, "header and ten deaths")
  eq(wow.chat[from + 1], "|cffffd100Death Diary:|r Your last 10 deaths, newest first:")
  eq(has(wow.chat[from + 2], "level 12"), true, wow.chat[from + 2])
  eq(has(wow.chat[from + 11], "level 3"), true, wow.chat[from + 11])
  eq(ns.EntryText(deaths()[1]), date("%b %d %H:%M", deaths()[1].t) .. ": Elwynn Forest, Goldshire, level 1")
  eq(ns.WhenText(nil), "unknown time")
  eq(#ns.Last({ 1, 2, 3 }, 10), 3)
  eq(ns.Last({ 1, 2, 3 }, 2)[1], 3)
end)

test("/dd reset needs confirm and clears only this character", function(wow)
  local saved = { chars = { ["Ohm-Silvermoon"] = { deaths = { { zone = "Durotar" } } } } }
  boot(wow, nil, saved)
  die(wow)
  die(wow)
  wow.slash("/dd reset")
  eq(#deaths(), 2, "not without confirm")
  eq(lastChat(wow), "|cffffd100Death Diary:|r This clears all 2 deaths of this character. Type /dd reset confirm to do it.")
  wow.slash("/dd reset now")
  eq(#deaths(), 2)
  wow.slash("/dd reset confirm")
  eq(#deaths(), 0)
  eq(#DeathDiaryDB.chars["Ohm-Silvermoon"].deaths, 1)
  die(wow)
  eq(#deaths(), 1, "the diary keeps noting after a reset")
end)

test("/dd quiet switches the chat note off and on and is saved", function(wow)
  boot(wow)
  wow.slash("/dd quiet on")
  eq(DeathDiaryDB.settings.quiet, true)
  eq(lastChat(wow), "|cffffd100Death Diary:|r No note in chat after a death.")
  local from = #wow.chat
  die(wow)
  eq(#wow.chat, from, "no chat line")
  eq(#deaths(), 1, "still noted")
  wow.slash("/dd quiet maybe")
  eq(lastChat(wow), "|cffffd100Death Diary:|r Use /dd quiet on or /dd quiet off.")
  eq(DeathDiaryDB.settings.quiet, true)
  wow.slash("/dd quiet")
  eq(lastChat(wow), "|cffffd100Death Diary:|r No note in chat after a death.")
  wow.slash("/dd quiet off")
  eq(DeathDiaryDB.settings.quiet, false)
  die(wow)
  eq(has(lastChat(wow), "Death 2 noted"), true)
end)

test("saved settings and deaths survive a reload", function(wow)
  local saved = { version = 1, settings = { quiet = true }, chars = { ["Yubi-Silvermoon"] = { deaths = { { zone = "Durotar", level = 5, t = 1 } } } } }
  boot(wow, nil, saved)
  local from = #wow.chat
  die(wow)
  eq(#wow.chat, from, "still quiet")
  eq(#deaths(), 2)
  eq(deaths()[1].zone, "Durotar")
end)

test("logging in while dead does not note the same death again", function(wow)
  boot(wow, { dead = true })
  wow.fire("PLAYER_DEAD")
  eq(#deaths(), 0)
  wow.fire("PLAYER_UNGHOST")
  die(wow)
  eq(#deaths(), 1)
end)

test("a secret dead state at login is ignored", function(wow)
  boot(wow, { dead = SECRET })
  wow.fire("PLAYER_DEAD")
  eq(#deaths(), 1)
end)

test("events before login change nothing", function(wow)
  client()
  wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("PLAYER_DEAD")
  wow.slash("/dd")
  eq(DeathDiaryDB, nil)
  eq(#wow.chat, 0)
end)

test("the window shows zones, level brackets and the last death", function(wow)
  local ns = boot(wow)
  die(wow, { level = 12 })
  die(wow, { level = 25, zone = "Westfall", sub = "" })
  wow.slash("/dd window")
  local f = DeathDiaryFrame
  eq(f:IsShown(), true)
  eq(f.zones.rows[1].left:GetText(), "Elwynn Forest")
  eq(f.zones.rows[1].right:GetText(), "1")
  eq(f.zones.rows[3].left:GetText(), "")
  eq(f.levels.rows[1].left:GetText(), "11-20")
  eq(f.levels.rows[2].left:GetText(), "21-30")
  eq(f.total:GetText(), "Deaths: 2")
  eq(has(f.last:GetText(), "Last: "), true)
  eq(has(f.last:GetText(), "Westfall, level 25"), true, f.last:GetText())
  die(wow, { level = 26, zone = "Westfall" })
  eq(f.zones.rows[1].left:GetText(), "Westfall", "refreshed after a death")
  eq(f.zones.rows[1].right:GetText(), "2")
  wow.slash("/dd window")
  eq(f:IsShown(), false)
  wow.slash("/dd reset confirm")
  wow.slash("/dd window")
  eq(f.last:GetText(), "No deaths noted for this character yet.")
  eq(ns.WindowData({}).total, 0)
end)

test("the window folds zones beyond its rows into one line", function(wow)
  local ns = boot(wow)
  local list = {}
  for i = 1, 12 do list[i] = { zone = string.format("Zone %02d", i) } end
  local data = ns.WindowData(list)
  eq(#data.zones, 10)
  eq(data.zones[9][1], "Zone 09")
  eq(data.zones[10][1], "3 other zones")
  eq(data.zones[10][2], 3)
  eq(data.levels[1][1], "Unknown")
  eq(data.levels[1][2], 12)
end)

-- 1.1: German ------------------------------------------------------------------------------------------

local P = "|cffffd100Death Diary:|r "

-- Every placeholder of a text, in order: "%d", "%s", "%%".
local function placeholders(text)
  local out = {}
  for p in text:gmatch("%%[%d%.]*[%a%%]") do out[#out + 1] = p end
  return table.concat(out, " ")
end

-- A German client: its language and the words it has for the window (GlobalStrings). The stand-in
-- client has none; zone names come from GetRealZoneText in the client's language.
local function germanClient(wow)
  wow.locale = "deDE"
  ZONE, LEVEL, UNKNOWN = "Zone", "Stufe", "Unbekannt"
end

local GERMAN = { zone = "Wald von Elwynn", sub = "Goldhain" }

test("window headings and the unknown row come from the game, English when the client has none", function(wow)
  local ns = boot(wow)
  eq(ns.GameText("LEVEL", "Level"), "Level")
  eq(ns.WindowData({ {} }).levels[1][1], "Unknown")
  germanClient(wow)
  eq(ns.GameText("LEVEL", "Level"), "Stufe")
  eq(ns.WindowData({ {} }).levels[1][1], "Unbekannt")
  UNKNOWN = ""
  eq(ns.WindowData({ {} }).levels[1][1], "Unknown", "an empty one stays English")
  LEVEL = { secret = true }
  eq(ns.GameText("LEVEL", "Level"), "Level", "so does anything that is not a text")
end)

test("German client: the note after a death, the summary and the help in German", function(wow)
  germanClient(wow)
  boot(wow, GERMAN)
  wow.slash("/dd")
  eq(wow.chat[1], P .. "Für diesen Charakter sind noch keine Tode notiert.")
  eq(wow.chat[2], P .. "/dd last zeigt deine letzten 10 Tode, /dd window öffnet das Fenster, /dd quiet on oder off schaltet die Notiz nach einem Tod aus oder ein, /dd reset confirm leert das Tagebuch dieses Charakters.")
  die(wow)
  eq(wow.chat[3], P .. "Tod 1 notiert: Wald von Elwynn, Goldhain, Stufe 12.")
  die(wow, { level = 15, zone = "Westfall", sub = "Späherkuppe" })
  die(wow, { level = 21, zone = "Westfall", sub = "" })
  die(wow, { level = SECRET, zone = "", sub = "" })
  eq(wow.chat[6], P .. "Tod 4 notiert: Unbekannte Zone, Stufe unbekannt.")
  wow.chat = {}
  wow.slash("/dd")
  eq(wow.chat[1], P .. "Notierte Tode dieses Charakters: 4.")
  eq(wow.chat[2], P .. "Häufigste Zonen: Westfall (2), Unbekannte Zone (1), Wald von Elwynn (1).")
  eq(wow.chat[3], P .. "Nach Stufe: Stufe 11-20: 2, Stufe 21-30: 1, Stufe unbekannt: 1.")
end)

test("German client: last deaths, quiet and reset in German, the command words stay English", function(wow)
  germanClient(wow)
  local ns = boot(wow, GERMAN)
  wow.slash("/dd last")
  eq(wow.chat[1], P .. "Für diesen Charakter sind noch keine Tode notiert.")
  die(wow)
  wow.chat = {}
  wow.slash("/dd last")
  eq(wow.chat[1], P .. "Deine letzten 1 Tode, neueste zuerst:")
  eq(wow.chat[2], P .. date("%d.%m. %H:%M", deaths()[1].t) .. ": Wald von Elwynn, Goldhain, Stufe 12")
  eq(ns.WhenText(nil), "Zeit unbekannt")
  eq(ns.WhenText(0), date("%d.%m. %H:%M", 0), "dates the German way")
  wow.slash("/dd quiet on")
  eq(wow.chat[3], P .. "Keine Notiz im Chat nach einem Tod.")
  eq(DeathDiaryDB.settings.quiet, true)
  wow.slash("/dd quiet an")
  eq(wow.chat[4], P .. "Nutze /dd quiet on oder /dd quiet off.", "German command words are not commands")
  wow.slash("/dd quiet off")
  eq(wow.chat[5], P .. "Eine Notiz im Chat nach jedem Tod.")
  wow.slash("/dd reset")
  eq(wow.chat[6], P .. "Damit löschst du alle 1 Tode dieses Charakters. Gib /dd reset confirm ein, um es zu tun.")
  wow.slash("/dd reset bestätigen")
  eq(#deaths(), 1)
  wow.slash("/dd reset confirm")
  eq(wow.chat[8], P .. "Das Tagebuch dieses Charakters ist jetzt leer.")
  eq(#deaths(), 0)
end)

test("German client: the window in German with the game's words", function(wow)
  germanClient(wow)
  local ns = boot(wow, GERMAN)
  wow.slash("/dd window")
  local f = DeathDiaryFrame
  eq(f.title:GetText(), "Death Diary")
  eq(f.zones.head:GetText(), "Zone")
  eq(f.levels.head:GetText(), "Stufe")
  eq(f.total:GetText(), "Tode: 0")
  eq(f.last:GetText(), "Für diesen Charakter sind noch keine Tode notiert.")
  die(wow, { level = SECRET })
  die(wow, { level = 25, zone = "Westfall", sub = "" })
  eq(f.levels.rows[1].left:GetText(), "21-30")
  eq(f.levels.rows[2].left:GetText(), "Unbekannt")
  eq(f.total:GetText(), "Tode: 2")
  eq(f.last:GetText(), "Zuletzt: " .. date("%d.%m. %H:%M", deaths()[2].t) .. ": Westfall, Stufe 25")
  local list = {}
  for i = 1, 12 do list[i] = { zone = string.format("Zone %02d", i) } end
  eq(ns.WindowData(list).zones[10][1], "3 weitere Zonen")
end)

test("German texts keep every placeholder of the English text, in order", function(wow)
  wow.locale = "deDE"
  local ns = boot(wow)
  local n = 0
  for key, text in pairs(ns.L) do
    n = n + 1
    if not key:find("%H", 1, true) then eq(placeholders(text), placeholders(key), key) end
  end
  eq(n, 27, "every text on screen has its German one")
  eq(ns.L["%b %d %H:%M"], "%d.%m. %H:%M", "dates the German way")
end)

test("an English client keeps the English texts and the game's English words", function(wow)
  wow.locale = "enUS"
  ZONE, LEVEL, UNKNOWN = "Zone", "Level", "Unknown"
  local ns = boot(wow)
  eq(next(ns.L), nil)
  die(wow, { level = SECRET })
  eq(wow.chat[1], P .. "Death 1 noted: Elwynn Forest, Goldshire, unknown level.")
  wow.slash("/dd window")
  eq(DeathDiaryFrame.zones.head:GetText(), "Zone")
  eq(DeathDiaryFrame.levels.head:GetText(), "Level")
  eq(DeathDiaryFrame.levels.rows[1].left:GetText(), "Unknown")
  eq(DeathDiaryFrame.total:GetText(), "Deaths: 1")
end)
