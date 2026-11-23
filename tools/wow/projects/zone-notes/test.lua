-- Tests for Zone Notes, run by tools/wow/client/run.lua.

-- The stand-in client has no maps or zones; these are the game functions the addon reads.
local STAND_IN = { "C_Map", "GetRealZoneText" }
local game

-- Maps of the test world: 37 Elwynn Forest (a zone), 1429 a small cave inside it, 52 Westfall,
-- 125 and 627 two maps called Dalaran.
local MAPS = {
  [37] = { name = "Elwynn Forest", mapType = 3, parentMapID = 13 },
  [1429] = { name = "Fargodeep Mine", mapType = 5, parentMapID = 37 },
  [52] = { name = "Westfall", mapType = 3, parentMapID = 13 },
  [125] = { name = "Dalaran", mapType = 3, parentMapID = 113 },
  [627] = { name = "Dalaran", mapType = 3, parentMapID = 619 },
}

local function client(g)
  game = { map = 37, zone = "Elwynn Forest", calls = 0 }
  for k, v in pairs(g or {}) do game[k] = v end
  C_Map = {
    GetBestMapForUnit = function(unit)
      game.calls = game.calls + 1
      if unit ~= "player" then return nil end
      return game.map
    end,
    GetMapInfo = function(id)
      local m = MAPS[id]
      if not m then return nil end
      return { mapID = id, name = m.name, mapType = m.mapType, parentMapID = m.parentMapID }
    end,
  }
  GetRealZoneText = function() return game.zone end
end

local function boot(wow, g, saved)
  client(g)
  ZoneNotesDB = saved
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("ADDON_LOADED", "ZoneNotes")
  wow.fire("PLAYER_LOGIN")
  return ns
end

-- Travel: the game state changes, then the event the game sends on arrival.
local function go(wow, g, event)
  for k, v in pairs(g or {}) do game[k] = v end
  wow.fire(event or "ZONE_CHANGED_NEW_AREA")
end

local P = "|cffffd100Zone Notes:|r "
local SECRET = { secret = true }
local function lastChat(wow) return wow.chat[#wow.chat] end
local function chatSince(wow, from)
  local out = {}
  for i = from + 1, #wow.chat do out[#out + 1] = wow.chat[i] end
  return out
end
local function has(text, part) return text:find(part, 1, true) ~= nil end
local function notes(key) return ZoneNotesDB.zones[key] and ZoneNotesDB.zones[key].notes end

local ELWYNN = { zones = { [37] = { name = "Elwynn Forest", notes = { { text = "Herbs behind the inn", t = 1 }, { text = "Kobolds in the mine", t = 2 } } } } }
local function copy(t)
  if type(t) ~= "table" then return t end
  local out = {}
  for k, v in pairs(t) do out[k] = copy(v) end
  return out
end

test("addon defines only its own globals", function(wow, installed, before)
  boot(wow)
  wow.fire("PLAYER_ENTERING_WORLD")
  wow.slash("/zn add Herbs behind the inn")
  wow.slash("/zn")
  wow.slash("/zn list")
  wow.slash("/zn all")
  wow.slash("/zn window")
  wow.slash("/zn popup off")
  wow.slash("/zn quiet on")
  wow.slash("/zn remove 1")
  wow.slash("/zonenotes help")
  go(wow, { map = 52, zone = "Westfall" })
  local allowed = { ZoneNotesDB = true, ZoneNotesFrame = true, SLASH_ZONENOTES1 = true, SLASH_ZONENOTES2 = true }
  for _, name in ipairs(STAND_IN) do installed[name] = true end
  for k in pairs(_G) do
    if not before[k] and not installed[k] and not allowed[k] then error("unexpected global " .. tostring(k)) end
  end
end)

test("login creates the saved table with its settings", function(wow)
  local ns = boot(wow)
  eq(ZoneNotesDB.version, 1)
  eq(next(ZoneNotesDB.zones), nil)
  eq(ZoneNotesDB.settings.quiet, false)
  eq(ZoneNotesDB.settings.popup, true)
  eq(ns.db, ZoneNotesDB)
end)

test("a broken saved table is repaired at login", function(wow)
  boot(wow, nil, { zones = "nonsense", settings = 5 })
  eq(type(ZoneNotesDB.zones), "table")
  eq(ZoneNotesDB.settings.popup, true)
end)

test("/zn add saves a note for the zone under its map ID", function(wow)
  boot(wow)
  wow.slash("/zn add Herbs behind the inn")
  eq(lastChat(wow), P .. "Note 1 for Elwynn Forest saved.")
  eq(ZoneNotesDB.zones[37].name, "Elwynn Forest")
  eq(notes(37)[1].text, "Herbs behind the inn")
  eq(notes(37)[1].t, wow.now)
  wow.slash("/zn ADD   Keep   the   Case  ")
  eq(notes(37)[2].text, "Keep the Case", "only the command word is lower-cased, spaces are folded")
end)

test("arrival in a zone with notes prints them and opens the window", function(wow)
  boot(wow, { map = 52, zone = "Westfall" }, copy(ELWYNN))
  wow.fire("PLAYER_ENTERING_WORLD")
  eq(#wow.chat, 0, "Westfall has no notes")
  go(wow, { map = 37, zone = "Elwynn Forest" })
  eq(wow.chat[1], P .. "Your notes for Elwynn Forest:")
  eq(wow.chat[2], P .. "1. Herbs behind the inn")
  eq(wow.chat[3], P .. "2. Kobolds in the mine")
  eq(ZoneNotesFrame:IsShown(), true)
  eq(ZoneNotesFrame.title:GetText(), "Elwynn Forest")
  eq(ZoneNotesFrame.body:GetText(), "1. Herbs behind the inn\n2. Kobolds in the mine")
  go(wow, { map = 52, zone = "Westfall" })
  eq(ZoneNotesFrame:IsShown(), false, "the window closes in a zone without notes")
  eq(#wow.chat, 3)
end)

test("login in a zone with notes shows them once, even when both events fire", function(wow)
  boot(wow, nil, copy(ELWYNN))
  wow.fire("PLAYER_ENTERING_WORLD")
  wow.fire("ZONE_CHANGED_NEW_AREA")
  wow.fire("PLAYER_ENTERING_WORLD")
  eq(#wow.chat, 3, "heading and two notes, once")
  go(wow, { map = 52, zone = "Westfall" })
  go(wow, { map = 37, zone = "Elwynn Forest" })
  eq(#wow.chat, 6, "coming back shows them again")
end)

test("a small map inside a zone counts as the zone", function(wow)
  local ns = boot(wow, { map = 1429, zone = "Elwynn Forest" }, copy(ELWYNN))
  wow.fire("PLAYER_ENTERING_WORLD")
  eq(wow.chat[1], P .. "Your notes for Elwynn Forest:")
  wow.slash("/zn add Cave entrance north")
  eq(#notes(37), 3)
  eq(ZoneNotesDB.zones[1429], nil)
  local info = function(id) return MAPS[id] end
  eq(ns.ZoneOf(37, info, "x"), 37)
  local key, name = ns.ZoneOf(1429, info, "x")
  eq(key, 37); eq(name, "Elwynn Forest")
  local loop = { [1] = { name = "A", mapType = 5, parentMapID = 2 }, [2] = { name = "B", mapType = 5, parentMapID = 1 } }
  key = ns.ZoneOf(1, function(id) return loop[id] end)
  eq(type(key), "number", "a loop of small maps stops")
  key, name = ns.ZoneOf(999, info, "Somewhere")
  eq(key, 999); eq(name, "Somewhere", "unknown map: the game's zone text names it")
end)

test("without a map the zone name is the key, and it moves to the map ID later", function(wow)
  local ns = boot(wow, { map = false, zone = "Stormwind City" })
  wow.slash("/zn add Bank is north")
  eq(notes("Stormwind City")[1].text, "Bank is north")
  game.map = 84
  MAPS[84] = { name = "Stormwind City", mapType = 3, parentMapID = 13 }
  wow.slash("/zn add Auction House east")
  MAPS[84] = nil
  eq(ZoneNotesDB.zones["Stormwind City"], nil, "moved")
  eq(#notes(84), 2)
  eq(notes(84)[1].text, "Bank is north")
  eq(ns.ZoneList(ZoneNotesDB.zones)[1].name, "Stormwind City")
end)

test("a map that turns up after the name does not show the notes twice", function(wow)
  boot(wow, { map = false, zone = "Elwynn Forest" }, copy(ELWYNN))
  ZoneNotesDB.zones["Elwynn Forest"] = ZoneNotesDB.zones[37]
  ZoneNotesDB.zones[37] = nil
  wow.fire("PLAYER_ENTERING_WORLD")
  eq(#wow.chat, 3)
  go(wow, { map = 37 })
  eq(#wow.chat, 3, "same place")
end)

test("two zones with the same name but different maps each show their notes", function(wow)
  local saved = { zones = { [125] = { name = "Dalaran", notes = { { text = "Old one" } } }, [627] = { name = "Dalaran", notes = { { text = "New one" } } } } }
  boot(wow, { map = 125, zone = "Dalaran" }, saved)
  wow.fire("PLAYER_ENTERING_WORLD")
  go(wow, { map = 627 })
  eq(wow.chat[2], P .. "1. Old one")
  eq(wow.chat[4], P .. "1. New one")
end)

test("secret or missing map IDs and names are skipped", function(wow)
  local ns = boot(wow, { map = SECRET, zone = SECRET }, copy(ELWYNN))
  wow.fire("PLAYER_ENTERING_WORLD")
  eq(#wow.chat, 0, "nothing known, nothing shown")
  wow.slash("/zn add Something")
  eq(lastChat(wow), P .. "The game does not tell which zone you are in right now. Try again in a moment.")
  go(wow, { map = SECRET, zone = "Elwynn Forest" })
  eq(#wow.chat, 1, "the name alone does not find notes saved under a map ID")
  game.zone = nil
  wow.slash("/zn list")
  eq(lastChat(wow), P .. "The game does not tell which zone you are in right now. Try again in a moment.")
  eq(ns.CleanMapID(-1), nil)
  eq(ns.CleanMapID(1.5), nil)
  eq(ns.CleanMapID(0 / 0), nil)
  eq(ns.CleanMapID("37"), nil)
  eq(ns.CleanMapID(37), 37)
  MAPS[38] = { name = SECRET, mapType = SECRET, parentMapID = SECRET }
  local key, name = ns.ZoneOf(38, function(id) return MAPS[id] end, "Fallback")
  MAPS[38] = nil
  eq(key, 38); eq(name, "Fallback", "a secret map name falls back to the zone text")
end)

test("missing or failing map functions fall back to the zone text", function(wow)
  boot(wow, { zone = "Westfall" })
  C_Map = nil
  wow.slash("/zn add Farm is safe")
  eq(notes("Westfall")[1].text, "Farm is safe")
  C_Map = { GetBestMapForUnit = function() error("not now") end }
  wow.slash("/zn add Second")
  eq(#notes("Westfall"), 2)
end)

test("notes are cleaned and cut to 200 characters without splitting a letter", function(wow)
  local ns = boot(wow)
  wow.slash("/zn add " .. string.rep("a", 250))
  eq(#notes(37)[1].text, 200)
  eq(lastChat(wow), P .. "Notes are kept to 200 characters, the rest was cut.")
  local s, cut = ns.CleanNote(string.rep("a", 199) .. "ä" .. "bc")
  eq(s, string.rep("a", 199), "the two-byte letter at the edge goes as a whole")
  eq(cut, true)
  eq(ns.CleanNote("|cffff0000red|r and ||pipes"), "cffff0000redr and pipes", "no escape sequences reach the chat")
  eq(ns.CleanNote("   "), nil)
  eq(ns.CleanNote(nil), nil)
  eq(select(2, ns.CleanNote(string.rep("b", 200))), false)
end)

test("/zn add without text and a full zone are refused", function(wow)
  local ns = boot(wow)
  wow.slash("/zn add")
  eq(lastChat(wow), P .. "Type the note after the command: /zn add <text>.")
  eq(ZoneNotesDB.zones[37], nil, "no empty zone is made")
  for i = 1, 10 do wow.slash("/zn add Note " .. i) end
  eq(#notes(37), 10)
  wow.slash("/zn add Eleven")
  eq(#notes(37), 10)
  eq(lastChat(wow), P .. "This zone already has 10 notes. Remove one with /zn remove <number> first.")
  eq(ns.AddNote(ZoneNotesDB.zones, nil, nil, "x"), nil)
end)

test("/zn list and /zn show the notes of this zone, /zn also the commands", function(wow)
  boot(wow, nil, copy(ELWYNN))
  local from = #wow.chat
  wow.slash("/zn list")
  local out = chatSince(wow, from)
  eq(#out, 3)
  eq(out[3], P .. "2. Kobolds in the mine")
  go(wow, { map = 52, zone = "Westfall" })
  from = #wow.chat
  wow.slash("/zn")
  out = chatSince(wow, from)
  eq(out[1], P .. "No notes for Westfall yet. Add one with /zn add <text>.")
  eq(has(out[2], "/zn add <text> notes something for this zone"), true, out[2])
  wow.slash("/zn help")
  eq(has(lastChat(wow), "/zn quiet on or off"), true)
end)

test("/zn remove deletes one note by its number and drops an empty zone", function(wow)
  boot(wow, nil, copy(ELWYNN))
  wow.slash("/zn remove 1")
  eq(lastChat(wow), P .. "Removed: Herbs behind the inn")
  eq(#notes(37), 1)
  eq(notes(37)[1].text, "Kobolds in the mine")
  wow.slash("/zn remove 5")
  eq(lastChat(wow), P .. "Use /zn remove <number> with a number from 1 to 1, see /zn list.")
  wow.slash("/zn remove one")
  wow.slash("/zn remove 0.5")
  eq(#notes(37), 1)
  wow.slash("/zn remove 1")
  eq(ZoneNotesDB.zones[37], nil)
  wow.slash("/zn remove 1")
  eq(lastChat(wow), P .. "No notes for Elwynn Forest yet. Add one with /zn add <text>.")
end)

test("/zn all lists every zone with notes by name", function(wow)
  boot(wow)
  wow.slash("/zn all")
  eq(lastChat(wow), P .. "You have no notes yet. Add one with /zn add <text>.")
  wow.slash("/zn add One")
  wow.slash("/zn add Two")
  go(wow, { map = 52, zone = "Westfall" })
  wow.slash("/zn add Three")
  go(wow, { map = false, zone = "Deeprun Tram" })
  wow.slash("/zn add Four")
  local from = #wow.chat
  wow.slash("/zn all")
  local out = chatSince(wow, from)
  eq(out[1], P .. "Zones with notes: 3")
  eq(out[2], P .. "Deeprun Tram: 1")
  eq(out[3], P .. "Elwynn Forest: 2")
  eq(out[4], P .. "Westfall: 1")
end)

test("/zn quiet switches the chat lines on arrival and is saved", function(wow)
  boot(wow, { map = 52, zone = "Westfall" }, copy(ELWYNN))
  wow.slash("/zn quiet on")
  eq(ZoneNotesDB.settings.quiet, true)
  eq(lastChat(wow), P .. "No chat lines when you enter a zone.")
  local from = #wow.chat
  go(wow, { map = 37, zone = "Elwynn Forest" })
  eq(#wow.chat, from, "no chat lines")
  eq(ZoneNotesFrame:IsShown(), true, "the window still opens")
  wow.slash("/zn quiet maybe")
  eq(lastChat(wow), P .. "Use /zn quiet on or /zn quiet off.")
  wow.slash("/zn quiet")
  eq(lastChat(wow), P .. "No chat lines when you enter a zone.")
  wow.slash("/zn quiet OFF")
  eq(ZoneNotesDB.settings.quiet, false)
  eq(lastChat(wow), P .. "Your notes show in chat when you enter a zone.")
end)

test("/zn popup switches the window on arrival and is saved", function(wow)
  boot(wow, { map = 52, zone = "Westfall" }, copy(ELWYNN))
  wow.slash("/zn popup off")
  eq(ZoneNotesDB.settings.popup, false)
  eq(lastChat(wow), P .. "The notes window stays closed when you enter a zone.")
  go(wow, { map = 37, zone = "Elwynn Forest" })
  eq(ZoneNotesFrame, nil, "no window made")
  eq(has(lastChat(wow), "2. Kobolds"), true, "chat lines still come")
  wow.slash("/zn popup sometimes")
  eq(lastChat(wow), P .. "Use /zn popup on or /zn popup off.")
  wow.slash("/zn popup on")
  eq(lastChat(wow), P .. "The notes window opens when you enter a zone with notes.")
end)

test("/zn window toggles the window, which follows new and removed notes", function(wow)
  local ns = boot(wow, { map = 52, zone = "Westfall" })
  wow.slash("/zn window")
  local f = ZoneNotesFrame
  eq(f:IsShown(), true)
  eq(f.title:GetText(), "Westfall")
  eq(f.body:GetText(), "No notes for this zone yet. Add one with /zn add <text>.")
  wow.slash("/zn add Farm is safe")
  eq(f.body:GetText(), "1. Farm is safe")
  wow.slash("/zn add Gnolls at the mill")
  eq(f.body:GetText(), "1. Farm is safe\n2. Gnolls at the mill")
  wow.slash("/zn remove 1")
  eq(f.body:GetText(), "1. Gnolls at the mill")
  wow.slash("/zn window")
  eq(f:IsShown(), false)
  eq(UISpecialFrames[1], "ZoneNotesFrame", "Escape closes it")
  wow.slash("/zn window")
  f.scripts.OnMouseUp(f, "RightButton")
  eq(f:IsShown(), false, "a right-click dismisses it")
  eq(ns.WindowData(nil, nil).title, "Unknown zone")
end)

test("the window shows only the zone it was opened for", function(wow)
  boot(wow, nil, copy(ELWYNN))
  wow.fire("PLAYER_ENTERING_WORLD")
  local f = ZoneNotesFrame
  ZoneNotesDB.zones[52] = { name = "Westfall", notes = {} }
  game.map, game.zone = 52, "Westfall"
  wow.slash("/zn add Elsewhere")
  eq(f.body:GetText(), "1. Herbs behind the inn\n2. Kobolds in the mine", "a note for another zone does not change it")
end)

test("the window position is saved after dragging", function(wow)
  boot(wow, nil, copy(ELWYNN))
  wow.fire("PLAYER_ENTERING_WORLD")
  local f = ZoneNotesFrame
  f:SetPoint("TOPLEFT", UIParent, "TOPLEFT", 40, -60)
  f.scripts.OnDragStop(f)
  local p = ZoneNotesDB.settings.point
  eq(p[1], "TOPLEFT"); eq(p[2], "TOPLEFT"); eq(p[3], 40); eq(p[4], -60)
end)

test("notes and settings survive a reload and are shared by all characters", function(wow)
  local saved = copy(ELWYNN)
  saved.version, saved.settings = 1, { quiet = true, popup = false }
  wow.player = "Ohm"
  boot(wow, nil, saved)
  wow.fire("PLAYER_ENTERING_WORLD")
  eq(#wow.chat, 0, "still quiet")
  eq(ZoneNotesFrame, nil, "popup still off")
  wow.slash("/zn add From another character")
  eq(#notes(37), 3)
  eq(notes(37)[1].text, "Herbs behind the inn")
end)

test("events and commands before login change nothing", function(wow)
  client()
  wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("PLAYER_ENTERING_WORLD")
  wow.fire("ZONE_CHANGED_NEW_AREA")
  wow.slash("/zn add Too early")
  eq(ZoneNotesDB, nil)
  eq(#wow.chat, 0)
end)

test("the same zone twice in a row is one arrival, the SamePlace rule", function(wow)
  local ns = boot(wow)
  eq(ns.SamePlace(nil, 37, "Elwynn Forest"), false)
  eq(ns.SamePlace({ key = 37, name = "Elwynn Forest" }, 37, nil), true)
  eq(ns.SamePlace({ key = "Elwynn Forest", name = "Elwynn Forest" }, 37, "Elwynn Forest"), true)
  eq(ns.SamePlace({ key = 125, name = "Dalaran" }, 627, "Dalaran"), false)
  eq(ns.SamePlace({ key = 37, name = "Elwynn Forest" }, 52, "Westfall"), false)
end)

-- 1.1: German ------------------------------------------------------------------------------------------

-- Every placeholder of a text, in order: "%d", "%s", "%%".
local function placeholders(text)
  local out = {}
  for p in text:gmatch("%%[%d%.]*[%a%%]") do out[#out + 1] = p end
  return table.concat(out, " ")
end

-- A German client: its language. Zone names come from the game in German.
local GERMAN = { ["Elwynn Forest"] = "Wald von Elwynn" }
local function germanClient(wow)
  wow.locale = "deDE"
end
-- After boot: the maps of the test world answer with their German names.
local function germanMaps()
  local info = C_Map.GetMapInfo
  C_Map.GetMapInfo = function(id)
    local m = info(id)
    if m then m.name = GERMAN[m.name] or m.name end
    return m
  end
end

test("German client: adding, listing and removing notes in German", function(wow)
  germanClient(wow)
  boot(wow, { zone = "Wald von Elwynn" })
  germanMaps()
  wow.slash("/zn add Kräuter hinter dem Gasthaus")
  eq(lastChat(wow), P .. "Notiz 1 für Wald von Elwynn gespeichert.")
  eq(ZoneNotesDB.zones[37].name, "Wald von Elwynn", "the zone name as the game gives it")
  wow.slash("/zn add")
  eq(lastChat(wow), P .. "Schreib die Notiz hinter den Befehl: /zn add <Text>.")
  wow.slash("/zn add " .. string.rep("a", 250))
  eq(lastChat(wow), P .. "Notizen haben höchstens 200 Zeichen, der Rest wurde abgeschnitten.")
  for i = 3, 10 do wow.slash("/zn add Notiz " .. i) end
  wow.slash("/zn add Elf")
  eq(lastChat(wow), P .. "Diese Zone hat schon 10 Notizen. Lösche zuerst eine mit /zn remove <Nummer>.")
  wow.slash("/zn remove 11")
  eq(lastChat(wow), P .. "Nutze /zn remove <Nummer> mit einer Zahl von 1 bis 10, siehe /zn list.")
  wow.slash("/zn remove 1")
  eq(lastChat(wow), P .. "Gelöscht: Kräuter hinter dem Gasthaus")
  local from = #wow.chat
  wow.slash("/zn list")
  local out = chatSince(wow, from)
  eq(out[1], P .. "Deine Notizen für Wald von Elwynn:")
  eq(out[3], P .. "2. Notiz 3")
  from = #wow.chat
  wow.slash("/zn all")
  out = chatSince(wow, from)
  eq(out[1], P .. "Zonen mit Notizen: 1")
  eq(out[2], P .. "Wald von Elwynn: 9")
end)

test("German client: help, settings and messages in German, the command words stay English", function(wow)
  germanClient(wow)
  boot(wow, { map = 52, zone = "Westfall" })
  germanMaps()
  local from = #wow.chat
  wow.slash("/zn")
  local out = chatSince(wow, from)
  eq(out[1], P .. "Noch keine Notizen für Westfall. Füge eine mit /zn add <Text> hinzu.")
  eq(out[2], P .. "/zn add <Text> notiert etwas für diese Zone, /zn list zeigt ihre Notizen, /zn remove <Nummer> löscht eine, /zn all zeigt alle Zonen mit Notizen, /zn window öffnet das Notizfenster, /zn popup on oder off schaltet das Fenster beim Betreten einer Zone ein oder aus, /zn quiet on oder off schaltet die Chatzeilen beim Betreten aus oder ein.")
  wow.slash("/zn all")
  eq(lastChat(wow), P .. "Du hast noch keine Notizen. Füge eine mit /zn add <Text> hinzu.")
  wow.slash("/zn popup aus")
  eq(lastChat(wow), P .. "Nutze /zn popup on oder /zn popup off.", "German command words are not commands")
  eq(ZoneNotesDB.settings.popup, true)
  wow.slash("/zn popup off")
  eq(lastChat(wow), P .. "Das Notizfenster bleibt geschlossen, wenn du eine Zone betrittst.")
  wow.slash("/zn popup on")
  eq(lastChat(wow), P .. "Das Notizfenster öffnet sich, wenn du eine Zone mit Notizen betrittst.")
  wow.slash("/zn quiet an")
  eq(lastChat(wow), P .. "Nutze /zn quiet on oder /zn quiet off.")
  wow.slash("/zn quiet on")
  eq(lastChat(wow), P .. "Keine Chatzeilen, wenn du eine Zone betrittst.")
  wow.slash("/zn quiet off")
  eq(lastChat(wow), P .. "Deine Notizen erscheinen im Chat, wenn du eine Zone betrittst.")
  from = #wow.chat
  wow.slash("/zn hinzufügen Bauernhof")
  eq(ZoneNotesDB.zones[52], nil, "a German command word adds nothing")
  eq(chatSince(wow, from)[1], P .. "Noch keine Notizen für Westfall. Füge eine mit /zn add <Text> hinzu.")
  game.map, game.zone = SECRET, SECRET
  wow.slash("/zn add Etwas")
  eq(lastChat(wow), P .. "Das Spiel verrät gerade nicht, in welcher Zone du bist. Versuch es gleich noch einmal.")
end)

test("German client: arrival and the window in German", function(wow)
  germanClient(wow)
  local saved = { zones = { [37] = { name = "Elwynn Forest", notes = { { text = "Kräuter hinter dem Gasthaus", t = 1 } } } } }
  local ns = boot(wow, { map = 52, zone = "Westfall" }, saved)
  germanMaps()
  wow.fire("PLAYER_ENTERING_WORLD")
  go(wow, { map = 37, zone = "Wald von Elwynn" })
  eq(wow.chat[1], P .. "Deine Notizen für Wald von Elwynn:", "a name saved in English follows the game's German name")
  eq(wow.chat[2], P .. "1. Kräuter hinter dem Gasthaus")
  local f = ZoneNotesFrame
  eq(f.title:GetText(), "Wald von Elwynn")
  eq(f.body:GetText(), "1. Kräuter hinter dem Gasthaus")
  wow.slash("/zn window")
  go(wow, { map = 52, zone = "Westfall" })
  wow.slash("/zn window")
  eq(f.body:GetText(), "Noch keine Notizen für diese Zone. Füge eine mit /zn add <Text> hinzu.")
  eq(ns.WindowData(nil, nil).title, "Unbekannte Zone")
end)

test("German texts keep every placeholder of the English text, in order", function(wow)
  wow.locale = "deDE"
  local ns = boot(wow)
  local n = 0
  for key, text in pairs(ns.L) do
    n = n + 1
    eq(placeholders(text), placeholders(key), key)
    eq(select(2, key:gsub("<", "")), select(2, text:gsub("<", "")), "the hints in brackets stay: " .. key)
  end
  eq(n, 23, "every text on screen has its German one")
end)

test("an English client keeps the English texts", function(wow)
  wow.locale = "enUS"
  local ns = boot(wow, nil, copy(ELWYNN))
  eq(next(ns.L), nil)
  wow.fire("PLAYER_ENTERING_WORLD")
  eq(wow.chat[1], P .. "Your notes for Elwynn Forest:")
  wow.slash("/zn add Third")
  eq(lastChat(wow), P .. "Note 3 for Elwynn Forest saved.")
  wow.slash("/zn quiet on")
  eq(lastChat(wow), P .. "No chat lines when you enter a zone.")
  eq(ns.WindowData(nil, nil).title, "Unknown zone")
end)
