-- Tests for Quiet Please, run by tools/wow/client/run.lua.

-- The stand-in client has no sound system; these are the game functions the addon calls.
-- game.muted counts mutes per file, game.calls records every call in order.
local game

local function client(g)
  game = { muted = {}, calls = {}, playable = {}, cvars = {
    Sound_EnableErrorSpeech = "1", Sound_EnableEmoteSounds = "1", Sound_EnablePetSounds = "1",
  } }
  for k, v in pairs(g or {}) do game[k] = v end
  MuteSoundFile = function(id)
    table.insert(game.calls, "mute " .. id)
    game.muted[id] = (game.muted[id] or 0) + 1
  end
  UnmuteSoundFile = function(id)
    table.insert(game.calls, "unmute " .. id)
    game.muted[id] = nil
  end
  PlaySoundFile = function(id, channel)
    table.insert(game.calls, "play " .. id .. " " .. channel)
    return game.playable[id] == true
  end
  C_CVar = {
    GetCVar = function(name) return game.cvars[name] end,
    SetCVar = function(name, value)
      if game.locked or game.cvars[name] == nil then return false end
      game.cvars[name] = value
      return true
    end,
  }
end

local function boot(wow, saved, g)
  client(g)
  QuietPleaseDB = saved
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("ADDON_LOADED", "QuietPlease")
  wow.fire("PLAYER_LOGIN")
  return ns
end

local function last(wow) return wow.chat[#wow.chat] end
local function said(wow, pattern)
  for _, line in ipairs(wow.chat) do
    if line:find(pattern, 1, true) then return true end
  end
  return false
end

test("addon defines only its own globals", function(wow, installed, before)
  boot(wow)
  wow.slash("/quiet add 1 2")
  wow.slash("/quiet list")
  local allowed = { QuietPleaseDB = true, SLASH_QUIETPLEASE1 = true, SLASH_QUIETPLEASE2 = true }
  local standIn = { MuteSoundFile = true, UnmuteSoundFile = true, PlaySoundFile = true, C_CVar = true }
  for k in pairs(_G) do
    if not before[k] and not installed[k] and not allowed[k] and not standIn[k] then error("unexpected global " .. tostring(k)) end
  end
end)

test("first login creates an empty list, switched on, shared by the account", function(wow)
  local ns = boot(wow)
  eq(type(QuietPleaseDB), "table")
  eq(QuietPleaseDB.version, 1)
  eq(QuietPleaseDB.enabled, true)
  eq(ns.Count(QuietPleaseDB.ids), 0)
  eq(#game.calls, 0)
  eq(#wow.chat, 0, "a quiet addon says nothing at login")
end)

test("every login mutes the saved list again", function(wow)
  local ns = boot(wow, { ids = { [569772] = true, [1234] = "Murloc cry" }, enabled = true })
  eq(game.muted[569772], 1)
  eq(game.muted[1234], 1)
  eq(ns.applied[1234], true)
  eq(#wow.chat, 0)
end)

test("a list switched off stays unmuted after login", function(wow)
  local ns = boot(wow, { ids = { [5] = true }, enabled = false })
  eq(game.muted[5], nil)
  eq(#game.calls, 0)
  wow.slash("/quiet on")
  eq(game.muted[5], 1)
  eq(QuietPleaseDB.enabled, true)
end)

test("parsing file IDs: positive whole numbers only", function(wow)
  local ns = boot(wow)
  local ids, bad = ns.ParseIDs("123 456,789;  123")
  eq(#ids, 3, "duplicates once")
  eq(ids[3], 789)
  eq(#bad, 0)
  ids, bad = ns.ParseIDs("0 -5 1.5 abc 12e3 0x10 99999999999 2147483647 007")
  eq(#ids, 2)
  eq(ids[1], 2147483647)
  eq(ids[2], 7)
  eq(#bad, 7)
  eq(bad[1], "0")
  eq(bad[7], "99999999999")
  eq(ns.ParseID(nil), nil)
  eq(ns.ParseID("2147483648"), nil)
  eq(#ns.ParseIDs(""), 0)
end)

test("/quiet add mutes several files at once and saves them", function(wow)
  local ns = boot(wow)
  wow.slash("/quiet add 111 222, 333")
  eq(game.muted[111], 1)
  eq(game.muted[333], 1)
  eq(QuietPleaseDB.ids[222], true)
  eq(last(wow):match("Muted: 111, 222, 333%.") ~= nil, true)
  wow.slash("/quiet add 222 444")
  eq(game.muted[222], 1, "not muted twice")
  eq(said(wow, "Muted: 444."), true)
  eq(said(wow, "Already on your list: 222."), true)
end)

test("/quiet add rejects what is not a file ID and keeps the valid ones", function(wow)
  local ns = boot(wow)
  wow.slash("/quiet add 10 abc -3 20")
  eq(said(wow, "Not a sound file ID: abc, -3."), true)
  eq(QuietPleaseDB.ids[10], true)
  eq(QuietPleaseDB.ids[20], true)
  eq(ns.Count(QuietPleaseDB.ids), 2)
  wow.chat = {}
  wow.slash("/quiet add murloc")
  eq(#wow.chat, 1, "only the error, no help")
  eq(ns.Count(QuietPleaseDB.ids), 2)
  wow.chat = {}
  wow.slash("/quiet add")
  eq(wow.chat[1]:match("/quiet add 12345 67890") ~= nil, true, "no IDs shows the help")
end)

test("/quiet remove unmutes and forgets, reports what was not listed", function(wow)
  local ns = boot(wow, { ids = { [1] = true, [2] = "Bell", [3] = true } })
  wow.slash("/quiet remove 2 3 9")
  eq(game.muted[2], nil)
  eq(game.muted[3], nil)
  eq(game.muted[1], 1)
  eq(QuietPleaseDB.ids[2], nil)
  eq(said(wow, "Removed and unmuted: 2, 3."), true)
  eq(said(wow, "Not on your list: 9."), true)
end)

test("/quiet off unmutes everything, /quiet on mutes it again, both are saved", function(wow)
  local ns = boot(wow, { ids = { [1] = true, [2] = true } })
  wow.slash("/quiet off")
  eq(game.muted[1], nil)
  eq(game.muted[2], nil)
  eq(QuietPleaseDB.enabled, false)
  wow.slash("/quiet off")
  eq(last(wow):match("already switched off") ~= nil, true)
  wow.slash("/quiet add 3")
  eq(game.muted[3], nil, "added while off: saved, not muted")
  eq(said(wow, "They are muted when you type /quiet on."), true)
  wow.slash("/quiet remove 1")
  eq(game.calls[#game.calls], "unmute 2", "nothing to unmute for a file that is not muted")
  wow.slash("/quiet on")
  eq(game.muted[2], 1)
  eq(game.muted[3], 1)
  eq(game.muted[1], nil)
  eq(last(wow), "|cffffd100Quiet Please:|r Muted 2 sound files again.")
  wow.slash("/quiet on")
  eq(last(wow):match("already muted") ~= nil, true)
end)

test("/quiet list: labelled files on their own line, the rest grouped", function(wow)
  local ns = boot(wow, { ids = { [30] = true, [10] = true, [20] = "Bell" } })
  wow.slash("/quiet list")
  eq(wow.chat[1]:match("3 sound files on your list, muted%.") ~= nil, true)
  eq(wow.chat[2]:match("Error speech: on, Emote sounds: on, Pet sounds: on") ~= nil, true)
  eq(wow.chat[3]:match("10$") ~= nil, true)
  eq(wow.chat[4]:match("20 %- Bell$") ~= nil, true)
  eq(wow.chat[5]:match("30$") ~= nil, true)
  local many = {}
  for i = 1, 20 do many[i] = true end
  local lines = ns.ListLines(many, 8)
  eq(#lines, 3)
  eq(lines[1], "1, 2, 3, 4, 5, 6, 7, 8")
  eq(lines[3], "17, 18, 19, 20")
end)

test("/quiet list on an empty list explains how to start", function(wow)
  boot(wow)
  wow.slash("/quiet list")
  eq(#wow.chat, 1)
  eq(wow.chat[1]:match("Your list is empty") ~= nil, true)
end)

test("/quiet label names a file, no text removes the label", function(wow)
  local ns = boot(wow, { ids = { [42] = true } })
  wow.slash("/quiet label 42   Loud   |cffff0000guild|r bell  ")
  eq(QuietPleaseDB.ids[42], "Loud guild bell")
  wow.slash("/quiet label 42")
  eq(QuietPleaseDB.ids[42], true)
  eq(last(wow):match("Label of 42 removed%.") ~= nil, true)
  wow.slash("/quiet label 43 nope")
  eq(last(wow):match("Not on your list: 43%.") ~= nil, true)
  eq(QuietPleaseDB.ids[43], nil)
  eq(#ns.CleanLabel(string.rep("x", 100)), ns.MAX_LABEL)
end)

test("/quiet play plays an unlisted file once and says when it cannot", function(wow)
  local ns = boot(wow, { ids = { [7] = true } }, { playable = { [8] = true } })
  wow.slash("/quiet play 8")
  eq(game.calls[#game.calls], "play 8 Master")
  eq(last(wow):match("Playing 8%.") ~= nil, true)
  wow.slash("/quiet play 9")
  eq(last(wow):match("could not play 9") ~= nil, true)
  local before = #game.calls
  wow.slash("/quiet play 7")
  eq(#game.calls, before, "a muted file is not played")
  eq(last(wow):match("7 is muted") ~= nil, true)
end)

test("sound categories: toggle, on and off through the game's settings", function(wow)
  local ns = boot(wow)
  wow.slash("/quiet errors")
  eq(game.cvars.Sound_EnableErrorSpeech, "0")
  eq(last(wow), "|cffffd100Quiet Please:|r Error speech: off")
  wow.slash("/quiet errors")
  eq(game.cvars.Sound_EnableErrorSpeech, "1")
  wow.slash("/quiet emotes off")
  wow.slash("/quiet emotes off")
  eq(game.cvars.Sound_EnableEmoteSounds, "0")
  wow.slash("/quiet pets on")
  eq(game.cvars.Sound_EnablePetSounds, "1")
  eq(QuietPleaseDB.cvars, nil, "the game keeps these settings itself")
end)

test("sound categories the client does not know or will not change", function(wow)
  local ns = boot(wow, nil, { cvars = { Sound_EnableErrorSpeech = "1" } })
  wow.slash("/quiet pets")
  eq(last(wow):match("Pet sounds cannot be switched on this client") ~= nil, true)
  wow.slash("/quiet list")
  eq(said(wow, "Pet sounds"), true)
  wow.chat = {}
  wow.slash("/quiet")
  eq(wow.chat[3], "|cffffd100Quiet Please:|r Error speech: on", "status lists only known categories")
  game.locked = true
  wow.slash("/quiet errors")
  eq(last(wow):match("could not be changed right now") ~= nil, true)
  eq(game.cvars.Sound_EnableErrorSpeech, "1")
end)

test("a damaged saved list is cleaned at login", function(wow)
  local ns = boot(wow, { ids = { [5] = true, ["17"] = "Old", [-1] = true, [1.5] = true, x = true, [6] = 3 }, enabled = true })
  eq(ns.Count(QuietPleaseDB.ids), 3)
  eq(QuietPleaseDB.ids[17], "Old")
  eq(QuietPleaseDB.ids[6], true)
  eq(game.muted[17], 1)
  QuietPleaseDB = nil
  local ns2 = boot(wow, "garbage")
  eq(type(QuietPleaseDB), "table")
end)

test("a client without MuteSoundFile keeps the list and says so", function(wow)
  client()
  MuteSoundFile = nil
  UnmuteSoundFile = nil
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("PLAYER_LOGIN")
  wow.slash("/quiet add 5")
  eq(QuietPleaseDB.ids[5], true)
  eq(said(wow, "cannot mute sound files"), true)
  wow.slash("/quiet off")
  wow.slash("/quiet on")
end)

test("commands before login do nothing, unknown words show the help", function(wow)
  client()
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.slash("/quiet add 5")
  eq(#wow.chat, 0)
  eq(#game.calls, 0)
  wow.fire("PLAYER_LOGIN")
  wow.slash("/quietplease whatever")
  eq(wow.chat[1]:match("^|cffffd100Quiet Please:|r /quiet add 12345 67890") ~= nil, true)
  eq(wow.chat[2]:match("0 sound files on your list, muted%.") ~= nil, true)
  wow.slash("/quiet ADD 77")
  eq(game.muted[77], 1, "command words ignore case")
end)

test("a reload in the same session mutes the list again without errors", function(wow)
  local ns = boot(wow, { ids = { [9] = true } })
  local saved = QuietPleaseDB
  local ns2 = boot(wow, saved)
  eq(QuietPleaseDB.ids[9], true)
  eq(ns2.applied[9], true)
end)
