-- Tests for Rep Session, run by tools/wow/client/run.lua.

-- The game's reputation state, modelled per test: rep.watched is what C_Reputation.GetWatchedFactionData
-- returns, rep.major / rep.friends / rep.ranks hold renown and friendship factions by factionID.
local rep

local function model()
  rep = { watched = nil, major = {}, maxRenown = {}, friends = {}, ranks = {}, calls = {} }
  C_Reputation = {
    GetWatchedFactionData = function() return rep.watched end,
    IsMajorFaction = function(id) return rep.major[id] ~= nil end,
  }
  C_MajorFactions = {
    GetMajorFactionData = function(id) return rep.major[id] end,
    HasMaximumRenown = function(id) return rep.maxRenown[id] == true end,
  }
  C_GossipInfo = {
    GetFriendshipReputation = function(id)
      return rep.friends[id] or { friendshipFactionID = 0, standing = 0, reactionThreshold = 0 }
    end,
    GetFriendshipReputationRanks = function(id) return rep.ranks[id] or { currentLevel = 0, maxLevel = 0 } end,
  }
end

local function standard(id, name, reaction, value, min, max)
  return { factionID = id, name = name, reaction = reaction, currentStanding = value, currentReactionThreshold = min, nextReactionThreshold = max }
end

local function boot(wow)
  model()
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("ADDON_LOADED", "RepSession")
  wow.fire("PLAYER_LOGIN")
  wow.fire("PLAYER_ENTERING_WORLD", true, false)
  return ns
end

-- Changes the watched faction's standing and lets the game report it.
local function gain(wow, value, reaction, min, max)
  local w = rep.watched
  w.currentStanding = value
  if reaction then w.reaction, w.currentReactionThreshold, w.nextReactionThreshold = reaction, min, max end
  wow.fire("UPDATE_FACTION")
end

test("addon defines only its own globals", function(wow, installed, before)
  local ns = boot(wow)
  wow.slash("/rs show") -- creates the window
  local allowed = { RepSessionDB = true, RepSessionFrame = true, SLASH_REPSESSION1 = true, SLASH_REPSESSION2 = true,
    C_Reputation = true, C_MajorFactions = true, C_GossipInfo = true } -- the last three are the test's model
  for k in pairs(_G) do
    if not before[k] and not installed[k] and not allowed[k] then error("unexpected global " .. tostring(k)) end
  end
end)

test("rate only after five minutes", function(wow)
  local ns = boot(wow)
  eq(ns.PerHour(1000, 60), nil)
  eq(ns.PerHour(1000, 299), nil)
  eq(ns.PerHour(1000, 300), 12000)
  eq(ns.PerHour(-500, 1800), -1000)
  eq(ns.TimeToNext(3000, 1000, 299), nil, "too early")
  eq(ns.TimeToNext(3000, 0, 3600), nil, "nothing gained")
  eq(ns.TimeToNext(3000, -100, 3600), nil, "lost reputation")
  eq(ns.TimeToNext(3000, 1000, 600), 1800)
  eq(ns.TimeToNext(nil, 1000, 600), nil, "at the top")
end)

test("durations and numbers", function(wow)
  local ns = boot(wow)
  eq(ns.FormatDuration(nil), "...")
  eq(ns.FormatDuration(30), "under a minute")
  eq(ns.FormatDuration(45 * 60), "45m")
  eq(ns.FormatDuration(72 * 60 + 30), "1h 12m")
  eq(ns.FormatDuration(3600 * 3 + 5 * 60), "3h 05m")
  eq(ns.FormatDuration(3600 * 27), "1d 3h")
  eq(ns.FormatNumber(0), "0")
  eq(ns.FormatNumber(1234567), "1,234,567")
  eq(ns.FormatNumber(-2500), "-2,500")
  eq(ns.Signed(250), "+250")
  eq(ns.Signed(-250), "-250")
  LARGE_NUMBER_SEPERATOR = "."
  eq(ns.FormatNumber(12345), "12.345")
end)

test("threshold math: standing grows across a standing, renown starts over", function(wow)
  local ns = boot(wow)
  local a = { kind = "standard", level = 5, value = 8500, min = 3000, max = 9000 }
  local b = { kind = "standard", level = 6, value = 9400, min = 9000, max = 21000 }
  local gained, levels = ns.Step(a, b)
  eq(gained, 900)
  eq(levels, 1)
  local r1 = { kind = "renown", level = 11, value = 2300, min = 0, max = 2500 }
  local r2 = { kind = "renown", level = 12, value = 400, min = 0, max = 2500 }
  gained, levels = ns.Step(r1, r2)
  eq(gained, 600, "200 to finish level 11 and 400 into 12")
  eq(levels, 1)
  gained, levels = ns.Step(r1, { kind = "renown", level = 14, value = 100, min = 0, max = 2500 })
  eq(gained, 200 + 2 * 2500 + 100, "two full levels in between")
  eq(levels, 3)
  gained = ns.Step(r1, { kind = "renown", level = 11, value = 2450, min = 0, max = 2500 })
  eq(gained, 150)
  gained, levels = ns.Step(r2, r1)
  eq(gained, 0, "renown never goes back")
  eq(ns.Needed(a), 500)
  eq(ns.Needed(r1), 200)
  eq(ns.Needed({ kind = "standard", maxed = true, value = 42000, max = 42000 }), nil)
end)

test("login sets the baseline, UPDATE_FACTION books the gain", function(wow)
  local ns = boot(wow)
  eq(ns.watched, nil, "nothing watched yet")
  rep.watched = standard(2600, "The Severed Threads", 5, 4000, 3000, 9000)
  wow.fire("UPDATE_FACTION")
  eq(ns.watched, 2600)
  eq(ns.session.factions[2600].gained, 0, "first sight is the baseline")
  wow.clock = wow.clock + 600
  gain(wow, 4250)
  gain(wow, 4500)
  local v = ns.Current()
  eq(v.gained, 500)
  eq(v.seconds, 600)
  eq(v.perHour, 3000)
  eq(v.needed, 4500)
  eq(v.eta, 4500 * 600 / 500)
  eq(v.standing, "Friendly")
end)

test("PLAYER_ENTERING_WORLD after a loading screen does not count twice", function(wow)
  local ns = boot(wow)
  rep.watched = standard(2600, "The Severed Threads", 5, 4000, 3000, 9000)
  wow.fire("PLAYER_ENTERING_WORLD", false, false)
  gain(wow, 4300)
  wow.fire("PLAYER_ENTERING_WORLD", false, false)
  wow.fire("PLAYER_ENTERING_WORLD", false, false)
  eq(ns.Current().gained, 300)
end)

test("a new standing: gain keeps counting, the next goal moves on", function(wow)
  local ns = boot(wow)
  rep.watched = standard(2600, "The Severed Threads", 5, 8800, 3000, 9000)
  wow.fire("PLAYER_ENTERING_WORLD")
  gain(wow, 9300, 6, 9000, 21000)
  local v = ns.Current()
  eq(v.gained, 500)
  eq(v.standing, "Honored")
  eq(v.needed, 11700)
  eq(ns.session.factions[2600].levels, 1)
end)

test("renown faction: earned starts over on a level-up", function(wow)
  local ns = boot(wow)
  rep.watched = standard(2590, "Council of Dornogal", 8, 0, 0, 0)
  rep.major[2590] = { name = "Council of Dornogal", renownLevel = 11, renownReputationEarned = 2300, renownLevelThreshold = 2500 }
  wow.fire("UPDATE_FACTION")
  wow.clock = wow.clock + 1800
  rep.major[2590] = { name = "Council of Dornogal", renownLevel = 12, renownReputationEarned = 400, renownLevelThreshold = 2500 }
  wow.fire("UPDATE_FACTION")
  local v = ns.Current()
  eq(v.gained, 600)
  eq(v.standing, "Renown 12")
  eq(v.perHour, 1200)
  eq(v.needed, 2100)
  eq(ns.FormatDuration(v.eta), "1h 45m")
end)

test("renown at its maximum shows max and no time", function(wow)
  local ns = boot(wow)
  rep.watched = standard(2590, "Council of Dornogal", 8, 0, 0, 0)
  rep.major[2590] = { renownLevel = 25, renownReputationEarned = 0, renownLevelThreshold = 2500 }
  rep.maxRenown[2590] = true
  wow.fire("UPDATE_FACTION")
  local v = ns.Current()
  eq(v.maxed, true)
  eq(v.needed, nil)
  eq(v.eta, nil)
  eq(ns.Lines(v)[4][2], "|cff9d9d9dmax|r")
end)

test("Exalted is the top: max instead of a time", function(wow)
  local ns = boot(wow)
  rep.watched = standard(1, "Old Friends", 8, 42000, 42000, 42000)
  wow.fire("UPDATE_FACTION")
  wow.clock = wow.clock + 3600
  local v = ns.Current()
  eq(v.maxed, true)
  eq(v.eta, nil)
  eq(ns.Lines(v)[4][2], "|cff9d9d9dmax|r")
end)

test("friendship faction: ranks by the friendship numbers, top rank is max", function(wow)
  local ns = boot(wow)
  rep.watched = standard(2640, "Brann Bronzebeard", 4, 0, 0, 3000)
  rep.friends[2640] = { friendshipFactionID = 2640, standing = 7000, reactionThreshold = 6000, nextThreshold = 9000, reaction = "Level 7" }
  rep.ranks[2640] = { currentLevel = 7, maxLevel = 60 }
  wow.fire("UPDATE_FACTION")
  wow.clock = wow.clock + 900
  rep.friends[2640] = { friendshipFactionID = 2640, standing = 9600, reactionThreshold = 9000, nextThreshold = 12000, reaction = "Level 8" }
  rep.ranks[2640] = { currentLevel = 8, maxLevel = 60 }
  wow.fire("UPDATE_FACTION")
  local v = ns.Current()
  eq(v.gained, 2600)
  eq(v.standing, "Level 8")
  eq(v.needed, 2400)
  eq(ns.session.factions[2640].levels, 1)
  rep.friends[2640] = { friendshipFactionID = 2640, standing = 99000, reactionThreshold = 99000, reaction = "Best Friend" }
  wow.fire("UPDATE_FACTION")
  eq(ns.Current().maxed, true)
  eq(ns.Current().needed, nil)
end)

test("switching the watched faction keeps every faction's own baseline", function(wow)
  local ns = boot(wow)
  local a = standard(2600, "The Severed Threads", 5, 4000, 3000, 9000)
  local b = standard(2570, "Hallowfall Arathi", 6, 10000, 9000, 21000)
  rep.watched = a
  wow.fire("UPDATE_FACTION")
  gain(wow, 4500)
  rep.watched = b
  wow.fire("UPDATE_FACTION")
  eq(ns.watched, 2570)
  eq(ns.Current().gained, 0, "the new faction starts at 0")
  gain(wow, 10750)
  eq(ns.Current().gained, 750)
  a.currentStanding = 5000 -- earned while another faction was on the bar
  rep.watched = a
  wow.fire("UPDATE_FACTION")
  eq(ns.Current().gained, 1000, "500 before and 500 while not watched")
  eq(ns.session.factions[2570].gained, 750)
end)

test("secret values are skipped, a secret faction keeps the last one shown", function(wow)
  local ns = boot(wow)
  rep.watched = standard(2600, "The Severed Threads", 5, 4000, 3000, 9000)
  wow.fire("UPDATE_FACTION")
  rep.watched = standard(2600, "The Severed Threads", 5, { secret = true }, 3000, 9000)
  wow.fire("UPDATE_FACTION")
  eq(ns.Current().gained, 0)
  rep.watched = standard({ secret = true }, "?", 5, 4000, 3000, 9000)
  wow.fire("UPDATE_FACTION")
  eq(ns.watched, 2600)
  rep.watched = standard(2600, "The Severed Threads", 5, 4400, 3000, 9000)
  wow.fire("UPDATE_FACTION")
  eq(ns.Current().gained, 400)
  eq(ns.StandardReading({ factionID = 5, reaction = { secret = true }, currentStanding = 1, currentReactionThreshold = 0, nextReactionThreshold = 3 }), nil)
  eq(ns.RenownReading(5, "x", { renownLevel = 3, renownReputationEarned = { secret = true }, renownLevelThreshold = 2500 }), nil)
  eq(ns.FriendReading(5, "x", { friendshipFactionID = 5, standing = 1, reactionThreshold = 0, nextThreshold = { secret = true } }), nil)
end)

test("unwatching the faction clears it, missing APIs do no harm", function(wow)
  local ns = boot(wow)
  rep.watched = standard(2600, "The Severed Threads", 5, 4000, 3000, 9000)
  wow.fire("UPDATE_FACTION")
  rep.watched = nil
  wow.fire("UPDATE_FACTION")
  eq(ns.watched, nil)
  eq(ns.Current(), nil)
  rep.watched = { factionID = 0 }
  wow.fire("UPDATE_FACTION")
  eq(ns.watched, nil)
  C_MajorFactions, C_GossipInfo = nil, nil
  rep.watched = standard(2600, "The Severed Threads", 5, 4100, 3000, 9000)
  wow.fire("UPDATE_FACTION")
  eq(ns.Current().gained, 100)
  C_Reputation = nil
  wow.fire("UPDATE_FACTION")
  eq(ns.watched, 2600)
end)

test("/rs prints the watched faction, the gain, the rate and the time", function(wow)
  local ns = boot(wow)
  wow.slash("/rs")
  eq(#wow.chat, 1)
  eq(wow.chat[1]:match("No faction is watched") ~= nil, true)
  rep.watched = standard(2600, "The Severed Threads", 5, 4000, 3000, 9000)
  wow.fire("UPDATE_FACTION")
  wow.clock = wow.clock + 60
  gain(wow, 4250)
  wow.chat = {}
  wow.slash("/rs")
  eq(#wow.chat, 4)
  eq(wow.chat[1]:match("Faction: The Severed Threads .*%(Friendly%)") ~= nil, true)
  eq(wow.chat[2]:match("This session: |cff40ff40%+250|r .*in 1m") ~= nil, true)
  eq(wow.chat[3]:match("Per hour: .*after 5 minutes") ~= nil, true, "too early for a rate")
  eq(wow.chat[4], "|cffffd100Rep Session:|r Next standing: 4,750 to go")
  wow.clock = wow.clock + 540
  wow.chat = {}
  wow.slash("/repsession")
  eq(wow.chat[3], "|cffffd100Rep Session:|r Per hour: +1,500")
  eq(wow.chat[4], "|cffffd100Rep Session:|r Next standing: 4,750 to go, about 3h 10m")
end)

test("/rs reset starts over from the current standing", function(wow)
  local ns = boot(wow)
  rep.watched = standard(2600, "The Severed Threads", 5, 4000, 3000, 9000)
  wow.fire("UPDATE_FACTION")
  wow.clock = wow.clock + 600
  gain(wow, 5000)
  wow.slash("/rs reset")
  eq(wow.chat[1]:match("Session started again%.") ~= nil, true)
  local v = ns.Current()
  eq(v.gained, 0)
  eq(v.seconds, 0)
  gain(wow, 5100)
  eq(ns.Current().gained, 100)
  wow.slash("/rs help")
  eq(wow.chat[2]:match("/rs reset starts a new session") ~= nil, true)
end)

test("the window shows the lines, refreshes, resets and remembers its place", function(wow)
  local ns = boot(wow)
  rep.watched = standard(2600, "The Severed Threads", 5, 4000, 3000, 9000)
  wow.fire("UPDATE_FACTION")
  wow.slash("/rs show")
  local f = RepSessionFrame
  eq(f:IsShown(), true)
  eq(UISpecialFrames[1], "RepSessionFrame")
  eq(f.lines[1].left:GetText(), "Faction")
  eq(f.lines[2].right:GetText(), "|cff9d9d9d0|r |cff9d9d9din under a minute|r")
  gain(wow, 4400)
  eq(f.lines[2].right:GetText():match("%+400") ~= nil, true, "UPDATE_FACTION refreshes the window")
  wow.clock = wow.clock + 1200
  f.scripts.OnUpdate(f, 5)
  eq(f.lines[3].right:GetText(), "+1,200")
  f.reset:Click()
  eq(f.lines[2].right:GetText():match("^|cff9d9d9d0|r") ~= nil, true)
  f.point = { "TOPLEFT", UIParent, "TOPLEFT", 40, -80 }
  f.scripts.OnDragStop(f)
  eq(RepSessionDB.point[1], "TOPLEFT")
  eq(RepSessionDB.point[4], -80)
  wow.slash("/rs show")
  eq(f:IsShown(), false)
end)

test("without a watched faction the window shows the hint across the whole line", function(wow)
  local ns = boot(wow)
  wow.slash("/rs show")
  local f = RepSessionFrame
  eq(f.lines[1].left:GetText():match("No faction is watched") ~= nil, true, "the hint sits on the left, where it can wrap")
  eq(f.lines[1].right:GetText(), "", "nothing right-aligned that could run over it")
  eq(f.lines[2].left:GetText(), "")
  rep.watched = standard(2600, "The Severed Threads", 5, 4000, 3000, 9000)
  wow.fire("UPDATE_FACTION")
  eq(f.lines[1].left:GetText(), "Faction", "with a faction the label is back")
  eq(f.lines[1].right:GetText():match("The Severed Threads") ~= nil, true)
  wow.slash("/rs")
  eq(wow.chat[#wow.chat - 3]:match("Faction: The Severed Threads") ~= nil, true)
end)

test("the saved window position is used after a reload", function(wow)
  RepSessionDB = { point = { "TOPLEFT", "TOPLEFT", 40, -80 } }
  local ns = boot(wow)
  wow.slash("/rs show")
  local p = RepSessionFrame.point
  eq(p[1], "TOPLEFT")
  eq(p[5], -80)
end)

test("a broken saved variable is replaced", function(wow)
  RepSessionDB = "broken"
  local ns = boot(wow)
  eq(type(RepSessionDB), "table")
  wow.slash("/rs show")
  eq(RepSessionFrame:IsShown(), true)
end)

test("the client's standing names are used when it has them", function(wow)
  local ns = boot(wow)
  FACTION_STANDING_LABEL6 = "Wohlwollend"
  eq(ns.StandingName(6), "Wohlwollend")
  eq(ns.StandingName(7), "Revered")
  eq(ns.StandingName(9), "?")
end)

-- 1.1: German ------------------------------------------------------------------------------------------

local P = "|cffffd100Rep Session:|r "
local GREY = "|cff9d9d9d"

-- Every placeholder of a text, in order: "%d", "%s", "%%".
local function placeholders(text)
  local out = {}
  for p in text:gmatch("%%[%d%.]*[%a%%]") do out[#out + 1] = p end
  return table.concat(out, " ")
end

-- A German client: its language and the words it has (GlobalStrings). The stand-in client has none.
local function germanClient(wow)
  wow.locale = "deDE"
  FACTION, RESET, RENOWN_LEVEL_LABEL, LARGE_NUMBER_SEPERATOR = "Fraktion", "Rücksetzen", "Ruhmstufe %d", "."
  FACTION_STANDING_LABEL5, FACTION_STANDING_LABEL6, FACTION_STANDING_LABEL8 = "Freundlich", "Wohlwollend", "Ehrfürchtig"
end

test("renown, faction and the reset button come from the game, English when the client has none", function(wow)
  local ns = boot(wow)
  eq(ns.RenownText(12), "Renown 12")
  germanClient(wow)
  eq(ns.RenownText(12), "Ruhmstufe 12")
  RENOWN_LEVEL_LABEL = "Ruhmstufe"
  eq(ns.RenownText(3), "Renown 3", "a text without its number is not used")
  RENOWN_LEVEL_LABEL = ""
  eq(ns.RenownText(3), "Renown 3", "an empty one stays English")
  FACTION = { secret = true }
  eq(ns.Lines(nil)[1][1], "Faction", "so does anything that is not a text")
end)

test("German client: the report in German with the game's names", function(wow)
  germanClient(wow)
  local ns = boot(wow)
  wow.slash("/rs")
  eq(wow.chat[1], P .. "Fraktion: " .. GREY .. "Du beobachtest keine Fraktion. Wähle eine im Ruffenster aus.|r")
  rep.watched = standard(2600, "Die Durchtrennten Fäden", 5, 4000, 3000, 9000)
  wow.fire("UPDATE_FACTION")
  wow.clock = wow.clock + 60
  gain(wow, 4250)
  wow.chat = {}
  wow.slash("/rs")
  eq(#wow.chat, 4)
  eq(wow.chat[1], P .. "Fraktion: Die Durchtrennten Fäden " .. GREY .. "(Freundlich)|r")
  eq(wow.chat[2], P .. "Diese Sitzung: |cff40ff40+250|r " .. GREY .. "in 1m|r")
  eq(wow.chat[3], P .. "Pro Stunde: " .. GREY .. "nach 5 Minuten|r")
  eq(wow.chat[4], P .. "Nächster Rang: noch 4.750")
  wow.clock = wow.clock + 540
  gain(wow, 9300, 6, 9000, 21000)
  wow.chat = {}
  wow.slash("/rs")
  eq(wow.chat[1], P .. "Fraktion: Die Durchtrennten Fäden " .. GREY .. "(Wohlwollend)|r")
  eq(wow.chat[2], P .. "Diese Sitzung: |cff40ff40+5.300|r " .. GREY .. "in 10m|r")
  eq(wow.chat[3], P .. "Pro Stunde: +31.800")
  eq(wow.chat[4], P .. "Nächster Rang: noch 11.700, etwa 22m")
  wow.slash("/rs reset")
  eq(wow.chat[5], P .. "Neue Sitzung gestartet.")
  wow.slash("/rs zeigen")
  eq(wow.chat[6], P .. "/rs zeigt die beobachtete Fraktion im Chat, /rs show öffnet das Fenster, /rs reset startet eine neue Sitzung.",
    "German command words are not commands")
end)

test("German client: renown, the top standing and the window in German", function(wow)
  germanClient(wow)
  local ns = boot(wow)
  rep.watched = standard(2590, "Rat von Dornogal", 8, 0, 0, 0)
  rep.major[2590] = { name = "Rat von Dornogal", renownLevel = 11, renownReputationEarned = 2300, renownLevelThreshold = 2500 }
  wow.fire("UPDATE_FACTION")
  wow.clock = wow.clock + 1800
  rep.major[2590] = { name = "Rat von Dornogal", renownLevel = 12, renownReputationEarned = 400, renownLevelThreshold = 2500 }
  wow.fire("UPDATE_FACTION")
  wow.slash("/rs show")
  local f = RepSessionFrame
  eq(f.lines[1].left:GetText(), "Fraktion")
  eq(f.lines[1].right:GetText(), "Rat von Dornogal " .. GREY .. "(Ruhmstufe 12)|r")
  eq(f.lines[2].left:GetText(), "Diese Sitzung")
  eq(f.lines[2].right:GetText(), "|cff40ff40+600|r " .. GREY .. "in 30m|r")
  eq(f.lines[3].left:GetText(), "Pro Stunde")
  eq(f.lines[4].left:GetText(), "Nächster Rang")
  eq(f.lines[4].right:GetText(), "noch 2.100, etwa 1h 45m")
  eq(f.reset:GetText(), "Rücksetzen")
  f.reset:Click()
  eq(f.lines[2].right:GetText(), GREY .. "0|r " .. GREY .. "in unter einer Minute|r")
  rep.maxRenown[2590] = true
  wow.fire("UPDATE_FACTION")
  eq(f.lines[4].right:GetText(), GREY .. "max.|r")
  eq(ns.FormatDuration(3600 * 27), "1d 3h")
end)

test("German texts keep every placeholder of the English text, in order", function(wow)
  wow.locale = "deDE"
  local ns = boot(wow)
  local n = 0
  for key, text in pairs(ns.L) do
    n = n + 1
    eq(placeholders(text), placeholders(key), key)
  end
  eq(n, 16, "every text on screen has its German one")
end)

test("an English client keeps the English texts and the game's English names", function(wow)
  wow.locale = "enUS"
  FACTION, RESET, RENOWN_LEVEL_LABEL = "Faction", "Reset", "Renown %d"
  local ns = boot(wow)
  eq(next(ns.L), nil)
  rep.watched = standard(2590, "Council of Dornogal", 8, 0, 0, 0)
  rep.major[2590] = { name = "Council of Dornogal", renownLevel = 12, renownReputationEarned = 400, renownLevelThreshold = 2500 }
  wow.fire("UPDATE_FACTION")
  wow.slash("/rs")
  eq(wow.chat[1], P .. "Faction: Council of Dornogal " .. GREY .. "(Renown 12)|r")
  eq(wow.chat[4], P .. "Next standing: 2,100 to go")
  wow.slash("/rs show")
  eq(RepSessionFrame.reset:GetText(), "Reset")
end)
