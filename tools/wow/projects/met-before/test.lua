-- Tests for Met Before, run by tools/wow/client/run.lua.

-- The stand-in client has no group, units, zones or tooltip data; these are the game functions the addon reads.
local STAND_IN = { "GetNumGroupMembers", "IsInRaid", "UnitIsPlayer", "GetRealZoneText", "GetNormalizedRealmName", "TooltipDataProcessor" }
local game

local SECRET = { secret = true }

-- units = { party1 = { "Grumbash", "Argent Dawn" }, target = { "Ohm" }, ... }; a unit without an entry does not exist.
local function client(g)
  game = { size = 0, raid = false, zone = "Silvermoon City", realm = "Silvermoon", units = {}, npc = {}, posts = {} }
  for k, v in pairs(g or {}) do game[k] = v end
  game.units.player = game.units.player or { "Yubi" }
  GetNumGroupMembers = function() return game.size end
  IsInRaid = function() return game.raid end
  UnitIsPlayer = function(unit)
    if game.isPlayer ~= nil then return game.isPlayer end
    return game.units[unit] ~= nil and not game.npc[unit]
  end
  UnitName = function(unit)
    local u = game.units[unit]
    if not u then return nil end
    return u[1], u[2]
  end
  GetRealZoneText = function() return game.zone end
  GetNormalizedRealmName = function() return game.realm end
  Enum.TooltipDataType = { Unit = 2 }
  TooltipDataProcessor = {
    AddTooltipPostCall = function(kind, fn) table.insert(game.posts, { kind = kind, fn = fn }) end,
  }
end

local function boot(wow, g, saved)
  client(g)
  MetBeforeDB = saved
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("ADDON_LOADED", "MetBefore")
  wow.fire("PLAYER_LOGIN")
  wow.fire("PLAYER_ENTERING_WORLD")
  return ns
end

-- A party of the player plus the given members (party1..partyN).
local function party(wow, members)
  for k in pairs(game.units) do if k:match("^party") or k:match("^raid") then game.units[k] = nil end end
  for i, m in ipairs(members) do game.units["party" .. i] = m end
  game.raid = false
  game.size = #members > 0 and #members + 1 or 0
  wow.fire("GROUP_ROSTER_UPDATE")
end

local function leave(wow)
  party(wow, {})
  wow.fire("GROUP_LEFT")
end

-- A fake tooltip that shows a unit; returns its lines.
local function hover(unit)
  local tip = { lines = {}, shown = 0 }
  function tip:GetUnit() return "?", unit end
  function tip:AddLine(text) table.insert(self.lines, text) end
  function tip:Show() self.shown = self.shown + 1 end
  for _, post in ipairs(game.posts) do post.fn(tip, {}) end
  return tip.lines, tip
end

local function people() return MetBeforeDB.people end
local function lastChat(wow) return wow.chat[#wow.chat] end
local function chatSince(wow, from)
  local out = {}
  for i = from + 1, #wow.chat do out[#out + 1] = wow.chat[i] end
  return table.concat(out, "\n")
end
local function has(text, part) return text:find(part, 1, true) ~= nil end
local P = "|cffffd100Met Before:|r "

test("addon defines only its own globals", function(wow, installed, before)
  boot(wow)
  party(wow, { { "Grumbash", "Argent Dawn" } })
  game.units.target = { "Ohm" }
  hover("party1")
  wow.slash("/mb")
  wow.slash("/mb list")
  wow.slash("/mb note Grumbash nice tank")
  wow.slash("/mb note target healer")
  wow.slash("/mb forget Ohm")
  leave(wow)
  local allowed = { MetBeforeDB = true, SLASH_METBEFORE1 = true, SLASH_METBEFORE2 = true }
  for _, name in ipairs(STAND_IN) do installed[name] = true end
  for k in pairs(_G) do
    if not before[k] and not installed[k] and not allowed[k] then error("unexpected global " .. tostring(k)) end
  end
end)

test("login creates the saved table and keeps what was there", function(wow)
  local saved = { people = { ["ohm-silvermoon"] = { name = "Ohm-Silvermoon", times = 2, last = 5 } } }
  local ns = boot(wow, nil, saved)
  eq(MetBeforeDB.version, 1)
  eq(people()["ohm-silvermoon"].times, 2)
  eq(type(MetBeforeDB.session.seen), "table")
  eq(ns.db, MetBeforeDB)
end)

test("joining a group records each member with first seen, last seen, times and zone", function(wow)
  boot(wow)
  party(wow, { { "Grumbash", "Argent Dawn" }, { "Ohm" } })
  local g = people()["grumbash-argentdawn"]
  eq(g.name, "Grumbash-Argent Dawn")
  eq(g.times, 1)
  eq(g.first, wow.now)
  eq(g.last, wow.now)
  eq(g.zone, "Silvermoon City")
  local o = people()["ohm-silvermoon"]
  eq(o.name, "Ohm-Silvermoon", "a member without a realm is on the home realm")
  eq(o.times, 1)
  eq(people()["yubi-silvermoon"], nil, "the player is never recorded")
end)

test("a meeting counts once per group session, not on every roster update", function(wow)
  boot(wow)
  party(wow, { { "Grumbash", "Argent Dawn" } })
  wow.now = wow.now + 600
  game.zone = "The Rookery"
  party(wow, { { "Grumbash", "Argent Dawn" }, { "Ohm" } })
  wow.fire("GROUP_ROSTER_UPDATE")
  wow.fire("PLAYER_ENTERING_WORLD")
  local g = people()["grumbash-argentdawn"]
  eq(g.times, 1)
  eq(g.last, wow.now, "last seen moves on")
  eq(g.first, wow.now - 600, "first seen stays")
  eq(g.zone, "The Rookery")
  party(wow, { { "Ohm" } })
  party(wow, { { "Ohm" }, { "Grumbash", "Argent Dawn" } })
  eq(g.times, 1, "leaving and rejoining the same group is the same session")
  leave(wow)
  party(wow, { { "Grumbash", "Argent Dawn" } })
  eq(g.times, 2, "a new group is a new meeting")
end)

test("raid members are read from raid units, the player's own slot is skipped", function(wow)
  boot(wow)
  game.units.raid1 = { "Yubi" }
  game.units.raid2 = { "Grumbash", "Argent Dawn" }
  game.units.raid3 = { "Ohm" }
  game.raid, game.size = true, 3
  wow.fire("GROUP_ROSTER_UPDATE")
  eq(people()["grumbash-argentdawn"].times, 1)
  eq(people()["ohm-silvermoon"].times, 1)
  eq(people()["yubi-silvermoon"], nil)
end)

test("secret names and realms inside instances are skipped entirely", function(wow)
  boot(wow)
  party(wow, { { SECRET }, { "Grumbash", SECRET }, { "Ohm" } })
  local n = 0
  for _ in pairs(people()) do n = n + 1 end
  eq(n, 1, "only the plain name is recorded")
  eq(people()["ohm-silvermoon"].times, 1)
  game.zone = SECRET
  wow.now = wow.now + 60
  party(wow, { { "Ohm" } })
  eq(people()["ohm-silvermoon"].zone, "Silvermoon City", "a secret zone keeps the old one")
  game.size = SECRET
  wow.fire("GROUP_ROSTER_UPDATE")
  eq(people()["ohm-silvermoon"].times, 1, "a secret group size changes nothing")
  game.size, game.raid = 2, SECRET
  wow.fire("GROUP_ROSTER_UPDATE")
  eq(people()["ohm-silvermoon"].times, 1)
end)

test("non-players, unknown units and missing game functions are skipped", function(wow)
  local ns = boot(wow)
  game.npc.party1 = true
  party(wow, { { "Brann" }, { "Ohm" } })
  eq(people()["brann-silvermoon"], nil, "a follower NPC is not a player")
  eq(people()["ohm-silvermoon"].times, 1)
  game.units.party3 = nil
  game.size = 4
  wow.fire("GROUP_ROSTER_UPDATE")
  UnitIsPlayer = function() error("not available") end
  wow.fire("GROUP_ROSTER_UPDATE")
  GetNumGroupMembers = nil
  wow.fire("GROUP_ROSTER_UPDATE")
  eq(ns.UnitPlayer(SECRET), nil)
  eq(ns.UnitPlayer(nil), nil)
end)

test("a reload inside the group continues the session, a long break starts a new one", function(wow)
  boot(wow)
  party(wow, { { "Grumbash", "Argent Dawn" } })
  local saved = MetBeforeDB
  wow.now = wow.now + 120
  boot(wow, { size = 2, units = { party1 = { "Grumbash", "Argent Dawn" } } }, saved)
  eq(people()["grumbash-argentdawn"].times, 1, "reload: same session")
  saved = MetBeforeDB
  wow.now = wow.now + 7200
  boot(wow, { size = 2, units = { party1 = { "Grumbash", "Argent Dawn" } } }, saved)
  eq(people()["grumbash-argentdawn"].times, 2, "two hours later: new session")
end)

test("session rules in Core", function(wow)
  local ns = boot(wow)
  local s = { seen = {}, at = 1000 }
  eq(ns.ContinueSession(s, 1100, true), true)
  eq(ns.ContinueSession(s, 1100, false), false, "not in a group")
  eq(ns.ContinueSession(s, 1000 + 3600, true), false, "too long ago")
  eq(ns.ContinueSession(s, 900, true), false, "clock went back")
  eq(ns.ContinueSession(nil, 1100, true), false)
  eq(ns.ContinueSession({ at = 1000 }, 1100, true), false)
end)

test("keys: case, spaces and hyphens in realms do not matter", function(wow)
  local ns = boot(wow)
  eq(ns.Key("Grumbash", "Argent Dawn"), "grumbash-argentdawn")
  eq(ns.Key("grumbash", "ArgentDawn"), "grumbash-argentdawn")
  eq(ns.Key("Grumbash", "Azjol-Nerub"), "grumbash-azjolnerub")
  eq(ns.Key("Ohm", nil, "Silvermoon"), "ohm-silvermoon")
  eq(ns.Key("Ohm", "", "Silvermoon"), "ohm-silvermoon")
  eq(ns.Key("Ohm", nil, nil), nil)
  eq(ns.Key("", "Silvermoon"), nil)
  eq(ns.Key("Two Words", "Silvermoon"), nil)
  eq(ns.Key(SECRET, "Silvermoon"), nil)
  local a, b = ns.SplitTyped(" Grumbash-Argent Dawn ")
  eq(a, "Grumbash"); eq(b, "Argent Dawn")
  a, b = ns.SplitTyped("Ohm")
  eq(a, "Ohm"); eq(b, nil)
end)

test("only the newest 2000 players are kept, players with a note last", function(wow)
  local ns = boot(wow)
  local list = {}
  for i = 1, 6 do list["p" .. i] = { last = i } end
  list.p1.note = "keep"
  eq(ns.Prune(list, 4), 2)
  eq(list.p1 ~= nil, true, "the note keeps the oldest player")
  eq(list.p2, nil); eq(list.p3, nil)
  eq(list.p4 ~= nil, true)
  eq(ns.Prune(list, 4), 0)
  eq(ns.MAX_PEOPLE, 2000)
  for i = 1, 2001 do MetBeforeDB.people["x" .. i .. "-silvermoon"] = { last = i, times = 1 } end
  party(wow, { { "Grumbash", "Argent Dawn" } })
  local n = 0
  for _ in pairs(people()) do n = n + 1 end
  eq(n, 2000)
  eq(people()["grumbash-argentdawn"].times, 1, "the newest stays")
  eq(people()["x1-silvermoon"], nil)
  eq(people()["x2-silvermoon"], nil)
end)

test("the tooltip shows how often and when you met, and your note", function(wow)
  boot(wow)
  eq(#game.posts, 1)
  eq(game.posts[1].kind, 2, "unit tooltips")
  party(wow, { { "Grumbash", "Argent Dawn" } })
  leave(wow)
  wow.now = wow.now + 2 * 86400 + 100
  party(wow, { { "Grumbash", "Argent Dawn" } })
  leave(wow)
  wow.now = wow.now + 2 * 86400
  party(wow, { { "Grumbash", "Argent Dawn" } })
  leave(wow)
  wow.now = wow.now + 2 * 86400 + 5
  wow.slash("/mb note Grumbash-ArgentDawn Great tank, knows every route")
  game.units.mouseover = { "Grumbash", "Argent Dawn" }
  local lines, tip = hover("mouseover")
  eq(lines[1], "Met before: 3 times, last 2 days ago")
  eq(lines[2], "Note: Great tank, knows every route")
  eq(tip.shown, 1, "resized")
  game.units.mouseover = { "Stranger" }
  eq(#hover("mouseover"), 0, "someone never met gets nothing")
end)

test("no tooltip lines for secret units or names, non-players, or before login", function(wow)
  boot(wow)
  party(wow, { { "Ohm" } })
  game.units.mouseover = { "Ohm" }
  eq(#hover("mouseover"), 1)
  eq(#hover(SECRET), 0, "secret unit")
  game.units.mouseover = { SECRET }
  eq(#hover("mouseover"), 0, "secret name")
  game.units.mouseover = { "Ohm", SECRET }
  eq(#hover("mouseover"), 0, "secret realm")
  game.units.mouseover = { "Ohm" }
  game.isPlayer = SECRET
  eq(#hover("mouseover"), 0, "secret player flag")
  game.isPlayer = false
  eq(#hover("mouseover"), 0, "not a player")
  game.isPlayer = nil
  local tip = { lines = {} }
  function tip:GetUnit() error("broken") end
  function tip:AddLine(t) table.insert(self.lines, t) end
  game.posts[1].fn(tip, {})
  eq(#tip.lines, 0)
end)

test("without TooltipDataProcessor the addon still loads", function(wow)
  client()
  TooltipDataProcessor = nil
  MetBeforeDB = nil
  wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("PLAYER_LOGIN")
  eq(MetBeforeDB.version, 1)
end)

test("time texts", function(wow)
  local ns = boot(wow)
  eq(ns.AgoText(10), "just now")
  eq(ns.AgoText(3600), "1 hour ago")
  eq(ns.AgoText(5 * 3600 + 5), "5 hours ago")
  eq(ns.AgoText(86400), "1 day ago")
  eq(ns.AgoText(40 * 86400), "40 days ago")
  eq(ns.AgoText(-5), "just now")
  eq(ns.TimesText(1), "1 time")
  eq(ns.TimesText(4), "4 times")
  eq(ns.MetText({ times = 0, note = "x" }, 0), nil)
end)

test("/mb note sets, changes and removes a note, also on players never met", function(wow)
  boot(wow)
  party(wow, { { "Grumbash", "Argent Dawn" } })
  wow.slash("/mb note grumbash Great tank")
  eq(people()["grumbash-argentdawn"].note, "Great tank", "the only Grumbash, found without the realm")
  eq(lastChat(wow), P .. "Note on Grumbash-Argent Dawn: Great tank")
  wow.slash("/mb NOTE Grumbash-Argent Dawn Keeps Pulling")
  eq(people()["grumbash-argentdawn"].note, "Keeps Pulling", "a realm with a space, and the case of the note is kept")
  eq(people()["grumbash-argent"], nil)
  wow.slash("/mb note Grumbash-ArgentDawn Pulls well")
  eq(people()["grumbash-argentdawn"].note, "Pulls well")
  wow.slash("/mb note Grumbash")
  eq(people()["grumbash-argentdawn"].note, nil)
  eq(lastChat(wow), P .. "Note on Grumbash-Argent Dawn removed.")
  wow.slash("/mb note Ohm sold me a pet")
  eq(people()["ohm-silvermoon"].note, "sold me a pet")
  eq(people()["ohm-silvermoon"].times, 0)
  game.units.mouseover = { "Ohm" }
  local lines = hover("mouseover")
  eq(#lines, 1)
  eq(lines[1], "Note: sold me a pet")
  wow.slash("/mb note Nobody")
  eq(lastChat(wow), P .. "No note on Nobody to remove.")
  eq(people()["nobody-silvermoon"], nil)
  wow.slash("/mb note Ohm a |cffff0000red|r note " .. string.rep("x", 300))
  eq(people()["ohm-silvermoon"].note:sub(1, 16), "a ||cffff0000red", "pipes are escaped")
end)

test("/mb note target notes the current target, not an NPC or a secret one", function(wow)
  boot(wow)
  game.units.target = { "Grumbash", "Argent Dawn" }
  wow.slash("/mb note target Funny guy")
  eq(people()["grumbash-argentdawn"].note, "Funny guy")
  eq(people()["grumbash-argentdawn"].name, "Grumbash-Argent Dawn")
  game.npc.target = true
  wow.slash("/mb note TARGET x")
  eq(lastChat(wow), P .. "Your target is not a player whose name the game shows right now.")
  game.npc.target = nil
  game.units.target = { SECRET }
  wow.slash("/mb note target x")
  eq(lastChat(wow), P .. "Your target is not a player whose name the game shows right now.")
  game.units.target = nil
  wow.slash("/mb note target x")
  eq(people()["grumbash-argentdawn"].note, "Funny guy")
end)

test("a name on several realms needs the realm", function(wow)
  boot(wow)
  party(wow, { { "Ohm", "Argent Dawn" }, { "Ohm", "Kazzak" } })
  wow.slash("/mb note Ohm hi")
  eq(lastChat(wow), P .. "Several players are called Ohm, add the realm: Ohm-Argent Dawn, Ohm-Kazzak.")
  eq(people()["ohm-silvermoon"], nil, "no note on a third Ohm")
  wow.slash("/mb forget Ohm")
  eq(lastChat(wow), P .. "Several players are called Ohm, add the realm: Ohm-Argent Dawn, Ohm-Kazzak.")
  wow.slash("/mb forget Ohm-Kazzak")
  eq(people()["ohm-kazzak"], nil)
  eq(lastChat(wow), P .. "Ohm-Kazzak forgotten.")
  wow.slash("/mb note Ohm hi")
  eq(people()["ohm-argentdawn"].note, "hi", "now unique")
end)

test("/mb forget removes a player and keeps them out for the rest of the group", function(wow)
  boot(wow)
  party(wow, { { "Grumbash", "Argent Dawn" } })
  wow.slash("/mb forget Grumbash-Argent Dawn")
  eq(people()["grumbash-argentdawn"], nil)
  wow.fire("GROUP_ROSTER_UPDATE")
  eq(people()["grumbash-argentdawn"], nil, "not back on the next roster update")
  leave(wow)
  party(wow, { { "Grumbash", "Argent Dawn" } })
  eq(people()["grumbash-argentdawn"].times, 1, "a new group remembers them again")
  wow.slash("/mb forget Nobody")
  eq(lastChat(wow), P .. "No player called Nobody is remembered.")
  local from = #wow.chat
  wow.slash("/mb forget")
  eq(has(chatSince(wow, from), "/mb list shows"), true)
end)

test("/mb list shows the last 10 players, newest first", function(wow)
  boot(wow)
  wow.slash("/mb list")
  eq(lastChat(wow), P .. "No players remembered yet. Join a group and they appear here.")
  for i = 1, 12 do
    wow.now = wow.now + 60
    party(wow, { { "P" .. i, "Kazzak" } })
    leave(wow)
  end
  game.zone = "Dornogal"
  wow.now = wow.now + 3 * 3600
  party(wow, { { "P5", "Kazzak" } })
  leave(wow)
  wow.slash("/mb note P5-Kazzak good healer")
  local from = #wow.chat
  wow.slash("/metbefore list")
  eq(#wow.chat - from, 11, "header and ten players")
  eq(wow.chat[from + 1], P .. "The last 10 players you grouped with, newest first:")
  eq(wow.chat[from + 2], P .. "P5-Kazzak: 2 times, last just now in Dornogal - good healer")
  eq(wow.chat[from + 3], P .. "P12-Kazzak: 1 time, last 3 hours ago in Silvermoon City")
  eq(has(chatSince(wow, from), "P3-Kazzak"), true)
  eq(has(chatSince(wow, from), "P2-Kazzak"), false, "older players are not listed")
end)

test("/mb and /mb help show the commands, nothing runs before login", function(wow)
  client()
  wow.load(ADDON_DIR, ADDON_NAME)
  wow.slash("/mb list")
  eq(#wow.chat, 0)
  wow.fire("PLAYER_LOGIN")
  wow.slash("/mb")
  eq(has(lastChat(wow), "/mb note Name-Realm text"), true)
  wow.slash("/mb help")
  eq(has(lastChat(wow), "/mb forget Name-Realm"), true)
  wow.slash("/mb whatever")
  eq(has(lastChat(wow), "/mb list shows the last 10 players"), true)
end)

-- 1.1: German ------------------------------------------------------------------------------------------

-- Every placeholder of a text, in order: "%d", "%s", "%%".
local function placeholders(text)
  local out = {}
  for p in text:gmatch("%%[%d%.]*[%a%%]") do out[#out + 1] = p end
  return table.concat(out, " ")
end

-- A German client: its language and the words it has (GlobalStrings). The stand-in client has none.
local function germanClient(wow)
  wow.locale = "deDE"
  NOTE_COLON = "Notiz:"
end

test("the note label comes from the game, English when the client has none", function(wow)
  local ns = boot(wow)
  eq(select(2, ns.TooltipLines({ note = "x" }, 0)), "Note: x")
  germanClient(wow)
  eq(select(2, ns.TooltipLines({ note = "x" }, 0)), "Notiz: x")
  NOTE_COLON = ""
  eq(select(2, ns.TooltipLines({ note = "x" }, 0)), "Note: x", "an empty one stays English")
  NOTE_COLON = SECRET
  eq(select(2, ns.TooltipLines({ note = "100% sure" }, 0)), "Note: 100% sure", "so does anything that is not a text")
end)

test("German client: the tooltip and the time texts in German", function(wow)
  germanClient(wow)
  local ns = boot(wow, { zone = "Silbermond" })
  party(wow, { { "Grumbash", "Argent Dawn" } })
  leave(wow)
  wow.now = wow.now + 2 * 86400 + 100
  party(wow, { { "Grumbash", "Argent Dawn" } })
  leave(wow)
  wow.now = wow.now + 2 * 86400 + 5
  wow.slash("/mb note Grumbash Guter Tank, kennt jeden Weg")
  game.units.mouseover = { "Grumbash", "Argent Dawn" }
  local lines = hover("mouseover")
  eq(lines[1], "Schon getroffen: 2-mal, zuletzt vor 2 Tagen")
  eq(lines[2], "Notiz: Guter Tank, kennt jeden Weg")
  eq(ns.AgoText(10), "gerade eben")
  eq(ns.AgoText(3600), "vor 1 Stunde")
  eq(ns.AgoText(5 * 3600), "vor 5 Stunden")
  eq(ns.AgoText(86400), "vor 1 Tag")
  eq(ns.TimesText(1), "1-mal")
  eq(ns.MetText({ times = 1, last = 0 }, 3600), "Schon getroffen: 1-mal, zuletzt vor 1 Stunde")
end)

test("German client: notes, forget and list in German, the command words stay English", function(wow)
  germanClient(wow)
  boot(wow, { zone = "Silbermond" })
  wow.slash("/mb list")
  eq(lastChat(wow), P .. "Noch keine Spieler gemerkt. Tritt einer Gruppe bei, dann erscheinen sie hier.")
  party(wow, { { "Ohm", "Argent Dawn" }, { "Ohm", "Kazzak" }, { "Grumbash", "Argent Dawn" } })
  wow.slash("/mb note Ohm hallo")
  eq(lastChat(wow), P .. "Mehrere Spieler heißen Ohm, gib den Realm mit an: Ohm-Argent Dawn, Ohm-Kazzak.")
  wow.slash("/mb note Grumbash Guter Tank")
  eq(lastChat(wow), P .. "Notiz zu Grumbash-Argent Dawn: Guter Tank")
  wow.slash("/mb note Grumbash")
  eq(lastChat(wow), P .. "Notiz zu Grumbash-Argent Dawn gelöscht.")
  wow.slash("/mb note Niemand")
  eq(lastChat(wow), P .. "Zu Niemand gibt es keine Notiz zum Löschen.")
  wow.slash("/mb note -Kazzak x")
  eq(lastChat(wow), P .. "-Kazzak ist kein Name, den das Addon verwenden kann.")
  wow.slash("/mb note target x")
  eq(lastChat(wow), P .. "Dein Ziel ist kein Spieler, dessen Namen das Spiel gerade zeigt.")
  wow.slash("/mb vergessen Ohm-Kazzak")
  eq(people()["ohm-kazzak"] ~= nil, true, "German command words are not commands")
  eq(lastChat(wow), P .. "/mb list zeigt die letzten 10 Spieler aus deinen Gruppen, /mb note Name-Realm Text setzt deine Notiz (ohne Text wird sie gelöscht), /mb note target Text notiert etwas zu deinem Ziel, /mb forget Name-Realm entfernt einen Spieler.")
  wow.slash("/mb forget Ohm-Kazzak")
  eq(lastChat(wow), P .. "Ohm-Kazzak vergessen.")
  wow.slash("/mb forget Niemand")
  eq(lastChat(wow), P .. "Kein gemerkter Spieler heißt Niemand.")
  wow.slash("/mb note Mira-Kazzak hat mir ein Haustier verkauft")
  leave(wow)
  wow.now = wow.now + 3 * 3600
  local from = #wow.chat
  wow.slash("/mb list")
  eq(wow.chat[from + 1], P .. "Die letzten 3 Spieler aus deinen Gruppen, neueste zuerst:")
  eq(wow.chat[from + 2], P .. "Grumbash-Argent Dawn: 1-mal, zuletzt vor 3 Stunden in Silbermond")
  eq(wow.chat[from + 4], P .. "Mira-Kazzak: noch nicht getroffen - hat mir ein Haustier verkauft")
end)

test("German texts keep every placeholder of the English text, in order", function(wow)
  wow.locale = "deDE"
  local ns = boot(wow)
  local n = 0
  for key, text in pairs(ns.L) do
    n = n + 1
    eq(placeholders(text), placeholders(key), key)
  end
  eq(n, 25, "every text on screen has its German one")
end)

test("an English client keeps the English texts and the game's English words", function(wow)
  wow.locale = "enUS"
  NOTE_COLON = "Note:"
  local ns = boot(wow)
  eq(next(ns.L), nil)
  party(wow, { { "Grumbash", "Argent Dawn" } })
  wow.slash("/mb note Grumbash Great tank")
  eq(lastChat(wow), P .. "Note on Grumbash-Argent Dawn: Great tank")
  game.units.mouseover = { "Grumbash", "Argent Dawn" }
  local lines = hover("mouseover")
  eq(lines[1], "Met before: 1 time, last just now")
  eq(lines[2], "Note: Great tank")
end)
