-- Tests for Roll Call, run by tools/wow/client/run.lua.

-- The parts of the game the stand-in client lacks: the roll line of the client's language and the
-- ways to send chat to other players (recorded, they must never be used).
local STAND_IN = { "RANDOM_ROLL_RESULT", "SendChatMessage", "C_ChatInfo" }
local SECRET = { secret = true }
local EN = "%s rolls %d (%d-%d)"                               -- enUS GlobalStrings
local DE = "%1$s w\195\188rfelt. Ergebnis: %2$d (%3$d-%4$d)"  -- deDE GlobalStrings
local game

-- g = { text = roll line of the client (false: the client has none), locale = "deDE" }
local function client(wow, g)
  game = { sent = {} }
  g = g or {}
  if g.text == nil then RANDOM_ROLL_RESULT = EN elseif g.text == false then RANDOM_ROLL_RESULT = nil else RANDOM_ROLL_RESULT = g.text end
  wow.locale = g.locale
  SendChatMessage = function(...) table.insert(game.sent, { ... }) end
  C_ChatInfo = { SendChatMessage = function(...) table.insert(game.sent, { ... }) end }
end

local function boot(wow, g, saved)
  client(wow, g)
  RollCallDB = saved
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("ADDON_LOADED", "RollCall")
  wow.fire("PLAYER_LOGIN")
  return ns
end

-- The game's system line for a roll, in the client's language.
local function roll(wow, name, value, low, high, later)
  wow.clock = wow.clock + (later or 0)
  local fmt = RANDOM_ROLL_RESULT or EN
  local line
  if fmt:find("%$") then -- numbered values (%2$d): Lua's string.format does not know them
    local values = { name, value, low or 1, high or 100 }
    line = fmt:gsub("%%(%d)%$[sd]", function(n) return tostring(values[tonumber(n)]) end)
  else
    line = string.format(fmt, name, value, low or 1, high or 100)
  end
  wow.fire("CHAT_MSG_SYSTEM", line, "", "", "", "", "", "", 0, "", "", 0, 0)
  return line
end

-- Lets the game draw a frame: the timer of the round runs in OnUpdate.
local function tick(ns, later, wow)
  wow.clock = wow.clock + (later or 0)
  local fn = ns.eventFrame.scripts.OnUpdate
  if fn then fn(ns.eventFrame, 0.1) end
end

local function chatSince(wow, from)
  local out = {}
  for i = from + 1, #wow.chat do out[#out + 1] = wow.chat[i] end
  return table.concat(out, "\n")
end
local function has(text, part) return text ~= nil and text:find(part, 1, true) ~= nil end
local function lastChat(wow) return wow.chat[#wow.chat] or "" end
local P = "|cffffd100Roll Call:|r "

local function texts(list)
  local out = {}
  for i, fs in ipairs(list) do out[i] = fs.text or "" end
  return out
end

test("addon defines only its own globals", function(wow, installed, before)
  local ns = boot(wow)
  wow.slash("/rollcall start 10")
  roll(wow, "Ohm", 50)
  tick(ns, 11, wow)
  wow.slash("/rolls")
  wow.slash("/rollcall help")
  local allowed = { RollCallDB = true, RollCallFrame = true, SLASH_ROLLCALL1 = true, SLASH_ROLLCALL2 = true }
  for _, name in ipairs(STAND_IN) do installed[name] = true end
  for k in pairs(_G) do
    if not before[k] and not installed[k] and not allowed[k] then error("unexpected global " .. tostring(k)) end
  end
  eq(SlashCmdList.ROLLCALL ~= nil, true)
end)

test("the English roll line of the game becomes a pattern", function(wow)
  local ns = boot(wow)
  local rp = ns.RollPattern()
  eq(rp.pattern, "^(.+) rolls (%-?%d+) %((%-?%d+)%-(%-?%d+)%)$")
  local name, value, low, high = ns.ParseRoll("Ohm rolls 87 (1-100)", rp)
  eq(name, "Ohm") eq(value, 87) eq(low, 1) eq(high, 100)
  name, value, low, high = ns.ParseRoll("Ohm-Argent Dawn rolls 1000 (1-1000)", rp)
  eq(name, "Ohm-Argent Dawn", "a player from another realm") eq(value, 1000) eq(high, 1000)
  name, value, low, high = ns.ParseRoll("Ohm rolls 7 (5-10)", rp)
  eq(value, 7) eq(low, 5) eq(high, 10)
  eq(ns.ParseRoll("Ohm rolls 87", rp), nil, "no range")
  eq(ns.ParseRoll("Ohm has come online.", rp), nil, "another system line")
  eq(ns.ParseRoll("You receive loot: [Ohm rolls 87 (1-100)] x2", rp), nil, "only whole lines")
  eq(ns.ParseRoll(SECRET, rp), nil, "secret text")
  eq(ns.ParseRoll(nil, rp), nil)
  eq(ns.ParseRoll(42, rp), nil)
end)

test("the German roll line with numbered values", function(wow)
  local ns = boot(wow, { text = DE, locale = "deDE" })
  local rp = ns.RollPattern()
  eq(rp.pattern, "^(.+) w\195\188rfelt%. Ergebnis: (%-?%d+) %((%-?%d+)%-(%-?%d+)%)$")
  local name, value, low, high = ns.ParseRoll("Ohm w\195\188rfelt. Ergebnis: 42 (1-100)", rp)
  eq(name, "Ohm") eq(value, 42) eq(low, 1) eq(high, 100)
  eq(ns.ParseRoll("Ohm rolls 42 (1-100)", rp), nil, "the English line is not the German client's")
end)

test("a language that puts the values in another order", function(wow)
  local ns = boot(wow, { text = "(%3$d-%4$d) %2$d: %1$s" })
  local name, value, low, high = ns.ParseRoll("(1-100) 99: Ohm", ns.RollPattern())
  eq(name, "Ohm") eq(value, 99) eq(low, 1) eq(high, 100)
  local p, order = ns.FormatPattern("100%% %s")
  eq(p, "^100%% (.+)$") eq(order[1], 1)
  eq(ns.FormatPattern("%.1f done"), nil, "a format the addon does not know")
  eq(ns.FormatPattern(nil), nil)
end)

test("a missing, secret or unusable roll text falls back to English", function(wow)
  local ns = boot(wow, { text = false })
  local english = "^(.+) rolls (%-?%d+) %((%-?%d+)%-(%-?%d+)%)$"
  eq(ns.RollPattern().pattern, english, "missing")
  RANDOM_ROLL_RESULT = SECRET
  eq(ns.RollPattern().pattern, english, "secret")
  RANDOM_ROLL_RESULT = "%s rolls %d"
  eq(ns.RollPattern().pattern, english, "too few values")
  RANDOM_ROLL_RESULT = "%1$s %1$d %3$d %4$d"
  eq(ns.RollPattern().pattern, english, "value 2 missing")
  RANDOM_ROLL_RESULT = "%5.1f"
  eq(ns.RollPattern().pattern, english, "unknown format")
end)

test("seconds: default 30, kept between 5 and 120", function(wow)
  local ns = boot(wow)
  eq(ns.Seconds(""), 30)
  eq(ns.Seconds(nil), 30)
  eq(ns.Seconds("45"), 45)
  local s, changed = ns.Seconds("2")
  eq(s, 5) eq(changed, true)
  s, changed = ns.Seconds("600")
  eq(s, 120) eq(changed, true)
  s, changed = ns.Seconds("120")
  eq(s, 120) eq(changed, false)
  eq(ns.Seconds("7.6"), 8)
  eq(ns.Seconds("-3"), 5)
  eq(ns.Seconds("abc"), nil)
  eq(ns.Seconds("30 seconds"), nil)
  eq(ns.Seconds("nan"), nil)
end)

test("only the first roll of each player counts", function(wow)
  local ns = boot(wow)
  local r = ns.NewRound(100, 30)
  eq(ns.AddRoll(r, "Ohm", 20, 1, 100), "added")
  eq(ns.AddRoll(r, "Ohm", 99, 1, 100), "repeat")
  eq(ns.AddRoll(r, "Yubi", 50, 1, 100), "added")
  eq(ns.AddRoll(r, "Ohm", 100, 1, 100), "repeat")
  eq(#r.rolls, 2)
  eq(r.repeats, 2)
  eq(ns.Standings(r)[2].roll, 20, "Ohm keeps the first roll")
  ns.Close(r, 130)
  eq(ns.AddRoll(r, "Kel", 70, 1, 100), "closed")
  eq(#r.rolls, 2)
  eq(ns.Close(r, 131), false, "already closed")
end)

test("highest first, ties marked and sharing a rank", function(wow)
  local ns = boot(wow)
  local r = ns.NewRound(100, 30)
  ns.AddRoll(r, "A", 40, 1, 100)
  ns.AddRoll(r, "B", 87, 1, 100)
  ns.AddRoll(r, "C", 40, 1, 100)
  ns.AddRoll(r, "D", 12, 1, 100)
  ns.AddRoll(r, "E", 87, 1, 100)
  local rows = ns.Standings(r)
  local names, ranks, ties = {}, {}, {}
  for i, row in ipairs(rows) do names[i], ranks[i], ties[i] = row.name, row.rank, tostring(row.tie) end
  eq(table.concat(names, " "), "B E A C D", "equal rolls keep the order they arrived in")
  eq(table.concat(ranks, " "), "1 1 3 3 5")
  eq(table.concat(ties, " "), "true true true true false")
  eq(#ns.Winners(r), 2)
  eq(ns.ResultText(r), "Tie at 87: B, E.")
end)

test("rolls that are not 1-100 are flagged, not filtered", function(wow)
  local ns = boot(wow)
  local r = ns.NewRound(100, 30)
  ns.AddRoll(r, "Ohm", 870, 1, 1000)
  ns.AddRoll(r, "Yubi", 99, 1, 100)
  ns.AddRoll(r, "Kel", 60, 50, 100)
  local rows = ns.Standings(r)
  eq(#rows, 3)
  eq(rows[1].name, "Ohm") eq(rows[1].odd, true)
  eq(rows[2].odd, false)
  eq(rows[3].odd, true, "a different low end")
  eq(ns.ResultText(r), "Winner: Ohm with 870 (1-1000, not 1-100).")
  local w = ns.WindowRows(r)
  eq(w[1].range, "|cffff99331-1000|r", "orange range")
  eq(w[2].range, "|cff9d9d9d1-100|r")
  eq(has(table.concat(ns.Notes(r), "\n"), "Orange ranges are not 1-100."), true)
end)

test("result texts: a winner, nobody and a single roll", function(wow)
  local ns = boot(wow)
  local r = ns.NewRound(100, 30)
  eq(ns.ResultText(r), "No rolls were seen.")
  eq(#ns.Winners(r), 0)
  ns.AddRoll(r, "Ohm", 3, 1, 100)
  eq(ns.ResultText(r), "Winner: Ohm with 3 (1-100).")
  ns.AddRoll(r, "Yubi", 0, 0, 100)
  eq(ns.ResultText(r), "Winner: Ohm with 3 (1-100).", "zero is a roll too")
end)

test("a full round: start, rolls in chat, the timer ends it and names the winner", function(wow)
  local ns = boot(wow)
  local from = #wow.chat
  wow.slash("/rollcall start 20")
  eq(lastChat(wow), P .. "Roll call started for 20 seconds. Everyone can /roll now.")
  eq(ns.eventFrame.events.CHAT_MSG_SYSTEM, true, "listens while collecting")
  eq(RollCallFrame:IsShown(), true, "the window opens")
  roll(wow, "Ohm", 64, 1, 100, 2)
  roll(wow, "Yubi", 91, 1, 100, 3)
  wow.fire("CHAT_MSG_SYSTEM", "Kel has come online.")
  roll(wow, "Ohm", 100, 1, 100, 1)
  tick(ns, 5, wow)
  eq(ns.Running(), true)
  eq(has(RollCallFrame.status.text, "9 seconds left"), true, RollCallFrame.status.text)
  eq(RollCallFrame.rows[1].name.text, "Yubi")
  eq(RollCallFrame.rows[1].roll.text, "91")
  eq(RollCallFrame.rows[2].name.text, "Ohm")
  eq(RollCallFrame.rows[2].roll.text, "64", "the first roll, not the 100")
  eq(RollCallFrame.rows[3].name.text, "")
  eq(RollCallFrame.button.text, "Stop")
  tick(ns, 9, wow)
  eq(ns.Running(), false, "the time is up")
  eq(lastChat(wow), P .. "Winner: Yubi with 91 (1-100).")
  eq(ns.eventFrame.events.CHAT_MSG_SYSTEM, nil, "stops listening")
  eq(ns.eventFrame.scripts.OnUpdate, nil, "the timer is gone")
  eq(RollCallFrame.status.text, "Winner: Yubi with 91 (1-100).")
  eq(RollCallFrame.button.text, "Start (30 s)")
  eq(has(table.concat(texts(RollCallFrame.notes), "\n"), "1 more ignored"), true)
  roll(wow, "Late", 100)
  eq(#ns.round.rolls, 2, "a roll after the end is not counted")
  eq(has(chatSince(wow, from), "Late"), false)
end)

test("a roll in the moment the time runs out ends the round first", function(wow)
  local ns = boot(wow)
  roll(wow, "Early", 99)
  wow.slash("/rollcall start")
  eq(ns.round.ends - ns.round.started, 30, "default 30 seconds")
  eq(#ns.round.rolls, 0, "a roll before the start is not counted")
  roll(wow, "Ohm", 10, 1, 100, 10)
  roll(wow, "Yubi", 90, 1, 100, 20) -- exactly at the end, before the next OnUpdate
  eq(ns.Running(), false)
  eq(#ns.round.rolls, 1)
  eq(lastChat(wow), P .. "Winner: Ohm with 10 (1-100).")
end)

test("the German client collects German roll lines", function(wow)
  local ns = boot(wow, { text = DE, locale = "deDE" })
  wow.slash("/rollcall start 15")
  eq(roll(wow, "Ohm", 12, 1, 100, 1), "Ohm w\195\188rfelt. Ergebnis: 12 (1-100)")
  roll(wow, "Yubi", 77, 1, 100, 1)
  wow.fire("CHAT_MSG_SYSTEM", "Kel rolls 99 (1-100)") -- an English line cannot come from a German client
  tick(ns, 20, wow)
  eq(lastChat(wow), P .. "Gewinner: Yubi mit 77 (1-100).", "1.1: the result in German")
  eq(#ns.round.rolls, 2)
end)

test("secret chat text is skipped and the window says rolls may be missing", function(wow)
  local ns = boot(wow)
  wow.slash("/rollcall start 30")
  roll(wow, "Ohm", 50, 1, 100, 1)
  wow.fire("CHAT_MSG_SYSTEM", SECRET, "", "", "", "", "", "", 0, "", "", 0, 0)
  wow.fire("CHAT_MSG_SYSTEM", SECRET)
  eq(ns.round.unreadable, 2)
  eq(#ns.round.rolls, 1)
  eq(RollCallFrame.notes[1].text, "|cffff6060Some lines could not be read here, rolls may be missing.|r")
  local from = #wow.chat
  wow.slash("/rollcall stop")
  local said = chatSince(wow, from)
  eq(has(said, "Winner: Ohm with 50 (1-100)."), true)
  eq(has(said, "Some lines could not be read here, rolls may be missing."), true)
  wow.fire("CHAT_MSG_SYSTEM", SECRET)
  eq(ns.round.unreadable, 2, "nothing is counted after the end")
end)

test("/rollcall stop ends early, start while running is refused", function(wow)
  local ns = boot(wow)
  wow.slash("/rollcall stop")
  eq(lastChat(wow), P .. "No roll call is running.")
  wow.slash("/rollcall start 60")
  local ends = ns.round.ends
  roll(wow, "Ohm", 33, 1, 100, 1)
  wow.slash("/rollcall start 10")
  eq(lastChat(wow), P .. "A roll call is already running. /rollcall stop ends it.")
  eq(ns.round.ends, ends, "the running round keeps its time")
  eq(#ns.round.rolls, 1, "and its rolls")
  wow.slash("/rollcall stop")
  eq(ns.Running(), false)
  eq(lastChat(wow), P .. "Winner: Ohm with 33 (1-100).")
  wow.slash("/rollcall stop")
  eq(lastChat(wow), P .. "No roll call is running.")
end)

test("start with a time out of range, or no number", function(wow)
  local ns = boot(wow)
  wow.slash("/rollcall start 500")
  eq(lastChat(wow), P .. "Roll call started for 120 seconds (between 5 and 120). Everyone can /roll now.")
  eq(ns.round.ends - ns.round.started, 120)
  wow.slash("/rollcall stop")
  wow.slash("/rollcall start soon")
  eq(ns.Running(), false)
  eq(has(lastChat(wow), "/rollcall start 30 collects rolls"), true)
end)

test("/rollcall shows the last result, also after a reload", function(wow)
  local ns = boot(wow)
  wow.slash("/rollcall")
  eq(lastChat(wow), P .. "No roll call yet. Type /rollcall start to begin one.")
  eq(RollCallFrame:IsShown(), true)
  eq(RollCallFrame.status.text, "|cff9d9d9dNo roll call yet.|r")
  wow.slash("/rollcall start 10")
  roll(wow, "Ohm", 70, 1, 100, 1)
  wow.slash("/rollcall")
  eq(lastChat(wow), P .. "Collecting rolls: 9 seconds left")
  tick(ns, 10, wow)
  wow.slash("/rolls")
  eq(lastChat(wow), P .. "Winner: Ohm with 70 (1-100).")
  local saved = RollCallDB
  eq(saved.last.open, false)

  -- A reload: the saved variables come back, the last result is still there.
  ns = boot(wow, nil, saved)
  wow.slash("/rollcall")
  eq(lastChat(wow), P .. "Winner: Ohm with 70 (1-100).")
  eq(RollCallFrame.rows[1].name.text, "Ohm")
end)

test("saved variables: broken or unfinished rounds are dropped", function(wow)
  local ns = boot(wow, nil, { last = { rolls = "x" } })
  eq(ns.round, nil)
  eq(RollCallDB.last, nil)
  ns = boot(wow, nil, { last = { open = true, rolls = {}, seen = {}, ends = 5 } })
  eq(ns.round, nil, "a round cut off by a reload is not kept")
  ns = boot(wow, nil, "garbage")
  eq(type(RollCallDB), "table")
  ns = boot(wow, nil, { last = { open = false, rolls = { { name = "Ohm", roll = 5, low = 1, high = 100, n = 1 } }, seen = {} } })
  eq(ns.round.unreadable, 0, "an older save without the counter")
  eq(ns.ResultText(ns.round), "Winner: Ohm with 5 (1-100).")
end)

test("nothing is ever sent to other players", function(wow)
  local ns = boot(wow)
  wow.slash("/rollcall start 5")
  roll(wow, "Ohm", 1, 1, 100, 1)
  roll(wow, "Yubi", 1, 1, 100, 1)
  tick(ns, 5, wow)
  wow.slash("/rollcall")
  wow.slash("/rollcall stop")
  eq(#game.sent, 0)
  eq(lastChat(wow), P .. "No roll call is running.")
end)

test("help texts use / and the window button starts and stops", function(wow)
  local ns = boot(wow)
  wow.slash("/rollcall help")
  local help = lastChat(wow)
  eq(help:sub(1, #P), P)
  eq(help:sub(#P + 1):find("|", 1, true), nil, "no | in the help text")
  eq(has(help, "/rollcall stop"), true)
  wow.slash("/rollcall")
  RollCallFrame.button:Click()
  eq(ns.Running(), true)
  eq(ns.round.ends - ns.round.started, 30)
  RollCallFrame.button:Click()
  eq(ns.Running(), false)
  eq(lastChat(wow), P .. "No rolls were seen.")
end)

test("a long list shows ten rows and how many more", function(wow)
  local ns = boot(wow)
  wow.slash("/rollcall start 60")
  for i = 1, 13 do roll(wow, "P" .. i, i) end
  eq(RollCallFrame.rows[1].name.text, "P13")
  eq(RollCallFrame.rows[9].name.text, "P5")
  eq(RollCallFrame.rows[10].name.text, "|cff9d9d9dand 4 more|r")
  eq(RollCallFrame.rows[10].roll.text, "")
  eq(RollCallFrame.rows[1].mark.text, "")
end)

test("the window remembers where it was moved and closes with Escape", function(wow)
  local ns = boot(wow)
  wow.slash("/rollcall")
  RollCallFrame.point = { "TOPLEFT", UIParent, "TOPLEFT", 120, -80 }
  RollCallFrame.scripts.OnDragStop(RollCallFrame)
  eq(RollCallDB.point[1], "TOPLEFT")
  eq(RollCallDB.point[3], 120)
  eq(UISpecialFrames[1], "RollCallFrame")
  local saved = RollCallDB
  boot(wow, nil, saved)
  wow.slash("/rollcall")
  eq(RollCallFrame.point[1], "TOPLEFT")
  eq(RollCallFrame.point[4], 120)
end)

-- 1.1: German ------------------------------------------------------------------------------------------

-- Every placeholder of a text, in order: "%d", "%s", "%%".
local function placeholders(text)
  local out = {}
  for p in text:gmatch("%%[%d%.]*[%a%%]") do out[#out + 1] = p end
  return table.concat(out, " ")
end

-- Every command in a text with its words: "/rollcall start, /rollcall stop, /roll".
local WORDS = { start = true, stop = true }
local function commands(text)
  local out = {}
  for cmd, rest in text:gmatch("(/r%a*)([^,%.%(%)]*)") do
    if cmd == "/rollcall" or cmd == "/rolls" or cmd == "/roll" then
      local word = rest:match("^ (%a+)")
      out[#out + 1] = (word and WORDS[word]) and (cmd .. " " .. word) or cmd
    end
  end
  return table.concat(out, ", ")
end

local function german(wow, saved)
  return boot(wow, { text = DE, locale = "deDE" }, saved)
end

test("German client: every answer to a command in German", function(wow)
  local ns = german(wow)
  wow.slash("/rollcall")
  eq(lastChat(wow), P .. "Noch keine Würfelrunde. Mit /rollcall start beginnst du eine.")
  eq(RollCallFrame.status.text, "|cff9d9d9dNoch keine Würfelrunde.|r")
  eq(RollCallFrame.button.text, "Starten (30 s)")
  wow.slash("/rollcall stop")
  eq(lastChat(wow), P .. "Es läuft keine Würfelrunde.")
  wow.slash("/rollcall start 20")
  eq(lastChat(wow), P .. "Würfelrunde für 20 Sekunden gestartet. Jetzt kann jeder mit /roll würfeln.")
  eq(RollCallFrame.notes[1].text, "|cff9d9d9dWarte auf /roll ...|r")
  eq(RollCallFrame.button.text, "Beenden")
  wow.slash("/rollcall start 10")
  eq(lastChat(wow), P .. "Es läuft schon eine Würfelrunde. /rollcall stop beendet sie.")
  roll(wow, "Ohm", 64, 1, 100, 1)
  roll(wow, "Ohm", 99, 1, 100, 1)
  tick(ns, 3, wow)
  wow.slash("/rollcall")
  eq(lastChat(wow), P .. "Würfe werden gesammelt: noch 15 Sekunden")
  eq(RollCallFrame.notes[1].text, "|cff9d9d9dNur der erste Wurf zählt: 1 weitere ignoriert.|r")
  wow.slash("/rollcall stop")
  eq(lastChat(wow), P .. "Gewinner: Ohm mit 64 (1-100).")
  wow.slash("/rollcall start 500")
  eq(lastChat(wow), P .. "Würfelrunde für 120 Sekunden gestartet (zwischen 5 und 120). Jetzt kann jeder mit /roll würfeln.")
  wow.slash("/rollcall stop")
  eq(lastChat(wow), P .. "Es wurden keine Würfe gesehen.")
  wow.slash("/rollcall help")
  eq(lastChat(wow), P .. "/rollcall start 30 sammelt 30 Sekunden lang Würfe (5 bis 120), /rollcall stop beendet die Runde vorzeitig, /rollcall zeigt das letzte Ergebnis.")
end)

test("German client: ties, odd ranges, a long list and secret lines in German", function(wow)
  local ns = german(wow)
  wow.slash("/rollcall start 60")
  roll(wow, "Ohm", 870, 1, 1000)
  roll(wow, "Yubi", 870, 1, 1000)
  for i = 1, 11 do roll(wow, "P" .. i, i) end
  wow.fire("CHAT_MSG_SYSTEM", SECRET)
  eq(RollCallFrame.rows[1].mark.text, "|cffffd100gleich|r")
  eq(RollCallFrame.rows[10].name.text, "|cff9d9d9dund 4 weitere|r")
  local notes = table.concat(texts(RollCallFrame.notes), "\n")
  eq(has(notes, "Einige Zeilen ließen sich hier nicht lesen, es können Würfe fehlen."), true, notes)
  eq(has(notes, "Orange Bereiche sind nicht 1-100."), true, notes)
  local from = #wow.chat
  wow.slash("/rollcall stop")
  local said = chatSince(wow, from)
  eq(has(said, "Gleichstand bei 870: Ohm, Yubi."), true, said)
  eq(has(said, "Einige Zeilen ließen sich hier nicht lesen"), true)
  local r = ns.NewRound(0, 30)
  ns.AddRoll(r, "Kel", 870, 1, 1000)
  eq(ns.ResultText(r), "Gewinner: Kel mit 870 (1-1000, nicht 1-100).")
end)

test("German client: the last result saved in 1.0 is kept", function(wow)
  local ns = german(wow, { version = 1, last = { open = false, rolls = { { name = "Ohm", roll = 5, low = 1, high = 100, n = 1 } }, seen = { Ohm = true }, repeats = 0, unreadable = 0 } })
  wow.slash("/rolls")
  eq(lastChat(wow), P .. "Gewinner: Ohm mit 5 (1-100).")
  eq(RollCallFrame.rows[1].name.text, "Ohm")
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
  eq(n, 21, "every text on screen has its German one")
  eq(commands("/rollcall start 30 collects, /rollcall stop ends, /roll now, /rolls."), "/rollcall start, /rollcall stop, /roll, /rolls")
end)

test("an English client keeps the English texts", function(wow)
  local ns = boot(wow, { locale = "enUS" })
  eq(next(ns.L), nil)
  wow.slash("/rollcall start 20")
  eq(lastChat(wow), P .. "Roll call started for 20 seconds. Everyone can /roll now.")
  eq(RollCallFrame.button.text, "Stop")
  roll(wow, "Ohm", 64)
  wow.slash("/rollcall stop")
  eq(lastChat(wow), P .. "Winner: Ohm with 64 (1-100).")
end)
