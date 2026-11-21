-- Tests for Queue Horn, run by tools/wow/client/run.lua.

-- The parts of the game the stand-in client lacks: sounds, the game icon, the raid warning frame,
-- the battleground queue slots and the sound options. Every alert is noted in g.
local function game(wow)
  local g = { sounds = {}, flashes = 0, notices = {}, errors = {}, slots = {}, cvars = {} }
  SOUNDKIT = { READY_CHECK = 8960, RAID_WARNING = 8959, ALARM_CLOCK_WARNING_3 = 12889, IG_PLAYER_INVITE = 880, TELL_MESSAGE = 3081 }
  PlaySound = function(id, channel) g.sounds[#g.sounds + 1] = tostring(id) .. "@" .. tostring(channel) end
  FlashClientIcon = function() g.flashes = g.flashes + 1 end
  RaidWarningFrame = {}
  RaidNotice_AddMessage = function(frame, text, color)
    assert(frame == RaidWarningFrame, "the raid warning frame is used")
    assert(type(color) == "table" and color.r and color.g and color.b, "a colour is given")
    g.notices[#g.notices + 1] = text
  end
  UIErrorsFrame = { AddMessage = function(_, text) g.errors[#g.errors + 1] = text end }
  GetMaxBattlefieldID = function() return #g.slots end
  GetBattlefieldStatus = function(i) return g.slots[i] or "none", "Warsong Gulch" end
  GetNormalizedRealmName = function() return "Silvermoon" end
  C_CVar = { GetCVar = function(name) return g.cvars[name] end }
  -- Sets the status of the battleground and arena queue slots and tells the addon.
  function g.pvp(...)
    g.slots = { ... }
    wow.fire("UPDATE_BATTLEFIELD_STATUS", 1)
  end
  function g.wait(seconds) wow.clock = wow.clock + seconds end
  function g.count() return #g.sounds end
  return g
end

local function boot(wow)
  local g = game(wow)
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("ADDON_LOADED", "QueueHorn")
  wow.fire("PLAYER_LOGIN")
  return ns, g
end

local PREFIX = "|cffffd100Queue Horn:|r "

test("addon defines only its own globals", function(wow)
  local g = game(wow)
  local stubs = {}
  for k in pairs(_G) do stubs[k] = true end
  wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("PLAYER_LOGIN")
  wow.fire("LFG_PROPOSAL_SHOW")
  wow.fire("READY_CHECK", "Tank", 30)
  g.pvp("confirm")
  wow.fire("PET_BATTLE_QUEUE_PROPOSE_MATCH")
  wow.slash("/qh")
  wow.slash("/qh test")
  wow.slash("/queuehorn flash off")
  local allowed = { QueueHornDB = true, SLASH_QUEUEHORN1 = true, SLASH_QUEUEHORN2 = true }
  for k in pairs(_G) do
    if not stubs[k] and not allowed[k] then error("unexpected global " .. tostring(k)) end
  end
  eq(g.count(), 5)
end)

test("core: settings get their defaults and keep what the player chose", function(wow)
  local ns = boot(wow)
  local s = ns.Settings({})
  eq(s.lfg, true)
  eq(s.ready, true)
  eq(s.pvp, true)
  eq(s.pet, true)
  eq(s.flash, true)
  s = ns.Settings({ pvp = false, flash = false, ready = "yes", later = 1 })
  eq(s.pvp, false)
  eq(s.flash, false)
  eq(s.ready, true, "a broken value is replaced")
  eq(s.later, 1, "unknown keys are kept")
end)

test("core: which event stands for which alert", function(wow)
  local ns = boot(wow)
  eq(ns.EVENT_KIND.LFG_PROPOSAL_SHOW, "lfg")
  eq(ns.EVENT_KIND.READY_CHECK, "ready")
  eq(ns.EVENT_KIND.UPDATE_BATTLEFIELD_STATUS, "pvp")
  eq(ns.EVENT_KIND.PET_BATTLE_QUEUE_PROPOSE_MATCH, "pet")
  eq(ns.EVENT_KIND.PLAYER_MONEY, nil)
  eq(ns.Message("lfg"), "Your group is ready!")
  eq(ns.Message("ready"), "Ready check!")
  eq(ns.Message("pvp"), "Your battleground or arena is ready!")
  eq(ns.Message("pet"), "Your pet battle is ready!")
  eq(ns.Message(nil), "Queue Horn test: this is how an alert looks.")
end)

test("core: the 5-second rule, per kind", function(wow)
  local ns = boot(wow)
  local on = ns.Settings({})
  local last = {}
  eq(ns.Allow(last, on, "lfg", 100), true)
  eq(ns.Allow(last, on, "lfg", 104.9), false, "too soon")
  eq(ns.Allow(last, on, "ready", 104.9), true, "another kind is not held back")
  eq(ns.Allow(last, on, "lfg", 105), true, "5 seconds later")
  eq(last.lfg, 105)
  eq(ns.Allow(last, on, "lfg", 107), false, "counted from the latest alert")
  on.pet = false
  eq(ns.Allow(last, on, "pet", 200), false, "switched off")
  eq(last.pet, nil, "a silent alert is not noted")
  on.pet = true
  eq(ns.Allow(last, on, "pet", 201), true)
  eq(ns.REPEAT, 5)
end)

test("core: who started the ready check", function(wow)
  local ns = boot(wow)
  eq(ns.IsOwnReadyCheck("Yubi", "Yubi", "Silvermoon"), true)
  eq(ns.IsOwnReadyCheck("Yubi-Silvermoon", "Yubi", "Silvermoon"), true)
  eq(ns.IsOwnReadyCheck("Yubi-Draenor", "Yubi", "Silvermoon"), false, "same name on another realm")
  eq(ns.IsOwnReadyCheck("Tank", "Yubi", "Silvermoon"), false)
  eq(ns.IsOwnReadyCheck("Yubi-Silvermoon", "Yubi", nil), false, "realm unknown")
  eq(ns.IsOwnReadyCheck(nil, "Yubi", "Silvermoon"), false, "name unknown counts as someone else")
  eq(ns.IsOwnReadyCheck({ secret = true }, "Yubi", "Silvermoon"), false, "a secret name is never compared")
  eq(ns.IsOwnReadyCheck("Yubi", { secret = true }, "Silvermoon"), false)
  eq(ns.IsOwnReadyCheck("Yubi-Silvermoon", "Yubi", { secret = true }), false)
end)

test("core: a queue slot counts once per change to confirm", function(wow)
  local ns = boot(wow)
  local seen = {}
  eq(ns.NewConfirms(seen, { "queued" }, 1), 0)
  eq(ns.NewConfirms(seen, { "confirm" }, 1), 1)
  eq(ns.NewConfirms(seen, { "confirm" }, 1), 0, "still the same pop")
  eq(ns.NewConfirms(seen, { "confirm", "confirm" }, 2), 1, "the second slot pops too")
  eq(ns.NewConfirms(seen, { "queued", "confirm" }, 2), 0, "declined, back in the queue")
  eq(ns.NewConfirms(seen, { "confirm", "confirm" }, 2), 1, "the first slot pops again")
  eq(ns.NewConfirms(seen, { "active" }, 1), 0)
  eq(seen[2], nil, "a slot that is gone is forgotten")
  eq(ns.NewConfirms(seen, { "active", "confirm" }, 2), 1, "a new slot 2 is new")
  eq(ns.NewConfirms(seen, { nil, "confirm" }, 2), 0, "a missing status counts as none")
  eq(seen[1], "none")
  local secret = { secret = true }
  eq(ns.NewConfirms(seen, { secret, secret }, 2), 0, "secret statuses are skipped")
  eq(seen[2], "confirm", "and leave what was seen before")
  eq(ns.NewConfirms(seen, { "none", "confirm" }, 2), 0)
end)

test("core: slash words, state text and the background sound option", function(wow)
  local ns = boot(wow)
  local s = ns.Settings({})
  local key, value = ns.Apply(s, "lfg off")
  eq(key, "lfg")
  eq(value, false)
  eq(s.lfg, false)
  key, value = ns.Apply(s, "flash off")
  eq(key, "flash")
  eq(s.flash, false)
  eq(ns.Apply(s, "lfg on"), "lfg")
  eq(s.lfg, true)
  eq(ns.Apply(s, "lfg"), nil)
  eq(ns.Apply(s, "lfg maybe"), nil)
  eq(ns.Apply(s, "sound on"), nil)
  eq(ns.Apply(s, ""), nil)
  eq(ns.StateText(s), "Alerts: Group finder on, Ready check on, Battleground and arena on, Pet battle on. Icon flash: off.")
  eq(ns.BackgroundSoundOff("0"), true)
  eq(ns.BackgroundSoundOff("1"), false)
  eq(ns.BackgroundSoundOff(nil), false)
  eq(ns.BackgroundSoundOff({ secret = true }), false)
end)

test("a dungeon or raid finder group: sound on Master, icon flash, message in the middle", function(wow)
  local _, g = boot(wow)
  wow.fire("LFG_PROPOSAL_SHOW")
  eq(g.count(), 1)
  eq(g.sounds[1], "8960@Master")
  eq(g.flashes, 1)
  eq(#g.notices, 1)
  eq(g.notices[1], "Your group is ready!")
  eq(#g.errors, 0)
  eq(#wow.chat, 0, "nothing in chat")
end)

test("the same alert within 5 seconds plays once", function(wow)
  local _, g = boot(wow)
  wow.fire("LFG_PROPOSAL_SHOW")
  g.wait(2)
  wow.fire("LFG_PROPOSAL_SHOW")
  eq(g.count(), 1)
  wow.fire("READY_CHECK", "Tank", 30)
  eq(g.count(), 2, "another kind plays at once")
  g.wait(3)
  wow.fire("LFG_PROPOSAL_SHOW")
  eq(g.count(), 3, "5 seconds after the first")
  eq(g.notices[3], "Your group is ready!")
end)

test("ready check: only when someone else starts it", function(wow)
  local _, g = boot(wow)
  wow.fire("READY_CHECK", "Yubi", 30)
  eq(g.count(), 0, "the player's own ready check")
  wow.fire("READY_CHECK", "Yubi-Silvermoon", 30)
  eq(g.count(), 0, "with the realm")
  wow.fire("READY_CHECK", "Tank-Draenor", 30)
  eq(g.count(), 1)
  eq(g.notices[1], "Ready check!")
  g.wait(10)
  wow.fire("READY_CHECK", { secret = true }, 30)
  eq(g.count(), 2, "a secret name cannot be compared, the alert plays")
  g.wait(10)
  wow.player = "Tank"
  wow.fire("READY_CHECK", "Tank", 30)
  eq(g.count(), 2, "the name is read at the moment of the check")
end)

test("battleground or arena: once per queue slot until its status changes", function(wow)
  local _, g = boot(wow)
  g.pvp("queued")
  eq(g.count(), 0)
  g.pvp("confirm")
  eq(g.count(), 1)
  eq(g.notices[1], "Your battleground or arena is ready!")
  g.wait(30)
  g.pvp("confirm")
  eq(g.count(), 1, "the same pop is not announced again")
  g.pvp("queued", "confirm")
  eq(g.count(), 2, "the arena in the second slot")
  g.wait(30)
  g.pvp("confirm", "confirm")
  eq(g.count(), 3, "the battleground pops again after a decline")
  g.wait(30)
  g.pvp("active", "none")
  g.pvp("active", "none")
  eq(g.count(), 3)
end)

test("battleground: two slots that pop together give one alert", function(wow)
  local _, g = boot(wow)
  g.pvp("queued", "queued")
  g.pvp("confirm", "confirm")
  eq(g.count(), 1)
  g.wait(2)
  g.pvp("confirm", "queued")
  g.pvp("confirm", "confirm")
  eq(g.count(), 1, "within 5 seconds")
end)

test("a queue that is already ready at login is not announced again", function(wow)
  local g = game(wow)
  g.slots = { "confirm" }
  wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("PLAYER_LOGIN")
  g.pvp("confirm")
  eq(g.count(), 0)
  g.pvp("queued")
  g.pvp("confirm")
  eq(g.count(), 1, "the next pop plays")
end)

test("battleground: secret statuses are skipped", function(wow)
  local _, g = boot(wow)
  local secret = { secret = true }
  g.pvp("queued")
  g.pvp(secret)
  eq(g.count(), 0)
  g.pvp("confirm")
  eq(g.count(), 1)
  GetMaxBattlefieldID = function() return secret end
  g.wait(10)
  g.pvp("queued", "queued", "confirm")
  eq(g.count(), 2, "an unknown slot count reads the usual three slots")
end)

test("a pet battle match", function(wow)
  local _, g = boot(wow)
  wow.fire("PET_BATTLE_QUEUE_PROPOSE_MATCH")
  eq(g.count(), 1)
  eq(g.notices[1], "Your pet battle is ready!")
end)

test("switched-off alerts stay silent, the others still play", function(wow)
  local _, g = boot(wow)
  wow.slash("/qh lfg off")
  wow.slash("/qh ready off")
  wow.slash("/qh pvp off")
  wow.fire("LFG_PROPOSAL_SHOW")
  wow.fire("READY_CHECK", "Tank", 30)
  g.pvp("confirm")
  eq(g.count(), 0)
  wow.fire("PET_BATTLE_QUEUE_PROPOSE_MATCH")
  eq(g.count(), 1)
  wow.slash("/qh pvp on")
  g.pvp("confirm")
  eq(g.count(), 1, "the pop seen while switched off is not new")
  g.pvp("queued")
  g.pvp("confirm")
  eq(g.count(), 2)
  wow.slash("/qh lfg on")
  wow.fire("LFG_PROPOSAL_SHOW")
  eq(g.count(), 3, "switched off before, so no 5-second wait")
end)

test("icon flash can be switched off", function(wow)
  local _, g = boot(wow)
  wow.slash("/qh flash off")
  wow.fire("LFG_PROPOSAL_SHOW")
  eq(g.count(), 1)
  eq(g.flashes, 0)
  eq(#g.notices, 1)
  wow.slash("/qh flash on")
  wow.fire("PET_BATTLE_QUEUE_PROPOSE_MATCH")
  eq(g.flashes, 1)
end)

test("without the raid warning frame the message goes to the error line", function(wow)
  local _, g = boot(wow)
  RaidNotice_AddMessage = nil
  wow.fire("LFG_PROPOSAL_SHOW")
  eq(#g.notices, 0)
  eq(g.errors[1], "Your group is ready!")
  eq(g.count(), 1)
end)

test("missing parts of the game are no error", function(wow)
  local _, g = boot(wow)
  SOUNDKIT = nil
  FlashClientIcon = nil
  RaidNotice_AddMessage = nil
  UIErrorsFrame = nil
  GetNormalizedRealmName = nil
  wow.fire("LFG_PROPOSAL_SHOW")
  wow.fire("READY_CHECK", "Yubi-Silvermoon", 30)
  eq(g.count(), 0, "no sound without SOUNDKIT")
  SOUNDKIT = { READY_CHECK = 8960, RAID_WARNING = 8959, ALARM_CLOCK_WARNING_3 = 12889, IG_PLAYER_INVITE = 880, TELL_MESSAGE = 3081 }
  PlaySound = nil
  GetBattlefieldStatus = nil
  GetMaxBattlefieldID = nil
  g.wait(10)
  wow.fire("UPDATE_BATTLEFIELD_STATUS", 1)
  wow.fire("PET_BATTLE_QUEUE_PROPOSE_MATCH")
  wow.slash("/qh test")
  C_CVar = nil
  wow.slash("/qh")
  eq(g.count(), 0)
  eq(g.flashes, 0)
end)

test("/qh test plays the alert once, also when an alert is switched off or just played", function(wow)
  local _, g = boot(wow)
  wow.slash("/qh lfg off")
  wow.slash("/qh test")
  eq(g.count(), 1)
  eq(g.sounds[1], "8960@Master")
  eq(g.flashes, 1)
  eq(g.notices[1], "Queue Horn test: this is how an alert looks.")
  wow.slash("/qh  TEST ")
  eq(g.count(), 2)
  wow.slash("/qh flash off")
  wow.slash("/qh test")
  eq(g.flashes, 2, "the test follows the flash switch")
  wow.slash("/qh pet on")
  wow.fire("PET_BATTLE_QUEUE_PROPOSE_MATCH")
  eq(g.count(), 4, "a test does not hold back a real alert")
end)

test("slash commands show the state, help and switch alerts", function(wow)
  local _, g = boot(wow)
  wow.slash("/qh")
  eq(#wow.chat, 4)
  eq(wow.chat[1], PREFIX .. "Alerts: Group finder on, Ready check on, Battleground and arena on, Pet battle on. Icon flash: on.")
  eq(wow.chat[2], PREFIX .. "Sounds: Group finder horn, Ready check horn, Battleground and arena horn, Pet battle horn. Choices: horn, warning, alarm, invite, whisper.")
  eq(wow.chat[3], PREFIX .. "Screen flash: Group finder off, Ready check off, Battleground and arena off, Pet battle off. Choices: red, gold, blue, green, off. Icon flash: on.")
  eq(wow.chat[4]:match("^" .. PREFIX:gsub("%p", "%%%0") .. "/qh shows this") ~= nil, true)
  eq(wow.chat[4]:find("/qh sound lfg alarm picks one for an alert, /qh test lfg plays it.", 1, true) ~= nil, true)
  eq(wow.chat[4]:match("/qh flash lfg red gives an alert a coloured flash at the screen edges %(red, gold, blue, green or off%)%.$") ~= nil, true)
  wow.slash("/qh pvp off")
  eq(wow.chat[5], PREFIX .. "Alerts: Group finder on, Ready check on, Battleground and arena off, Pet battle on. Icon flash: on.")
  eq(QueueHornDB.settings.pvp, false)
  wow.slash("/queuehorn  Ready   OFF ")
  eq(QueueHornDB.settings.ready, false)
  eq(wow.chat[6]:match("Ready check off") ~= nil, true)
  wow.slash("/qh flash off")
  eq(QueueHornDB.settings.flash, false)
  wow.slash("/qh sound on")
  eq(wow.chat[8]:match("/qh shows this") ~= nil, true, "unknown words show the help")
  wow.slash("/qh pvp")
  eq(wow.chat[9]:match("/qh shows this") ~= nil, true)
  eq(QueueHornDB.settings.pvp, false)
  for _, line in ipairs(wow.chat) do
    eq(line:sub(#PREFIX + 1):find("|", 1, true), nil, "no colour code by accident in: " .. line)
  end
  eq(g.count(), 0)
end)

test("/qh warns when the game is silent in the background", function(wow)
  local _, g = boot(wow)
  g.cvars.Sound_EnableSoundWhenGameIsInBG = "1"
  wow.slash("/qh")
  eq(#wow.chat, 4)
  g.cvars.Sound_EnableSoundWhenGameIsInBG = "0"
  wow.slash("/qh")
  eq(#wow.chat, 9)
  eq(wow.chat[8], PREFIX .. "Sound in Background is off in the game's sound options, so you hear nothing while tabbed out.")
  C_CVar = nil
  GetCVar = function(name) return g.cvars[name] end
  wow.slash("/qh")
  eq(#wow.chat, 14, "the older GetCVar works too")
end)

test("settings survive: saved values are kept, new ones start switched on", function(wow)
  local _, g = boot(wow)
  eq(QueueHornDB.version, 3)
  eq(QueueHornDB.settings.lfg, true)
  eq(QueueHornDB.settings.flash, true)

  QueueHornDB = { settings = { lfg = false, flash = false }, later = "kept" } -- as the game loads it at the next login
  wow.load(ADDON_DIR, ADDON_NAME)
  wow.frames[1].events = {} -- the first copy of the addon no longer listens
  wow.fire("PLAYER_LOGIN")
  eq(QueueHornDB.settings.lfg, false)
  eq(QueueHornDB.settings.flash, false)
  eq(QueueHornDB.settings.ready, true)
  eq(QueueHornDB.later, "kept")
  wow.fire("LFG_PROPOSAL_SHOW")
  eq(g.count(), 0)
  wow.fire("READY_CHECK", "Tank", 30)
  eq(g.count(), 1)
  eq(g.flashes, 0)

  QueueHornDB = "broken"
  wow.fire("PLAYER_LOGIN")
  eq(QueueHornDB.settings.lfg, true)
end)

test("events and slash commands before login do nothing", function(wow)
  local g = game(wow)
  wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("LFG_PROPOSAL_SHOW")
  wow.fire("READY_CHECK", "Tank", 30)
  g.pvp("confirm")
  wow.fire("PET_BATTLE_QUEUE_PROPOSE_MATCH")
  wow.slash("/qh test")
  wow.slash("/qh lfg off")
  eq(g.count(), 0)
  eq(#wow.chat, 0)
  eq(QueueHornDB, nil)
end)

test("an event the client does not know is skipped when registering", function(wow)
  local g = game(wow)
  local original = CreateFrame -- every frame of the addon refuses one event name
  CreateFrame = function(...)
    local f = original(...)
    local plainRegister = f.RegisterEvent
    f.RegisterEvent = function(self, event)
      if event == "PET_BATTLE_QUEUE_PROPOSE_MATCH" then error("unknown event") end
      return plainRegister(self, event)
    end
    return f
  end
  wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("PLAYER_LOGIN")
  wow.fire("PET_BATTLE_QUEUE_PROPOSE_MATCH")
  eq(g.count(), 0)
  wow.fire("LFG_PROPOSAL_SHOW")
  eq(g.count(), 1)
end)

-- Queue Horn 1.1: a sound per alert.

test("core: every alert starts with the horn, a saved choice is kept", function(wow)
  local ns = boot(wow)
  local s = ns.Settings({ lfg = false }) -- settings as 1.0 saved them
  eq(s.sounds.lfg, "horn")
  eq(s.sounds.ready, "horn")
  eq(s.sounds.pvp, "horn")
  eq(s.sounds.pet, "horn")
  eq(s.lfg, false)
  s = ns.Settings({ sounds = { lfg = "alarm", ready = "trumpet", pvp = 5, later = "x" } })
  eq(s.sounds.lfg, "alarm")
  eq(s.sounds.ready, "horn", "an unknown sound is replaced")
  eq(s.sounds.pvp, "horn")
  eq(s.sounds.later, "x", "unknown keys are kept")
  eq(ns.Settings({ sounds = "broken" }).sounds.pet, "horn")
  eq(ns.DEFAULT_SOUND, "horn")
  eq(ns.SOUND_KIT.horn, "READY_CHECK", "the default is the sound of 1.0")
end)

test("core: sound names, ids and the fallback to the horn", function(wow)
  local ns = boot(wow)
  local s = ns.Settings({ sounds = { pet = "whisper" } })
  eq(ns.SoundFor(s, "pet"), "whisper")
  eq(ns.SoundFor(s, "lfg"), "horn")
  eq(ns.SoundFor(s, nil), "horn", "the plain test")
  eq(ns.SoundFor(nil, "pet"), "horn")
  eq(ns.SoundId(SOUNDKIT, "horn"), 8960)
  eq(ns.SoundId(SOUNDKIT, "warning"), 8959)
  eq(ns.SoundId(SOUNDKIT, "alarm"), 12889)
  eq(ns.SoundId(SOUNDKIT, "invite"), 880)
  eq(ns.SoundId(SOUNDKIT, "whisper"), 3081)
  eq(ns.SoundId({ READY_CHECK = 8960 }, "alarm"), 8960, "a sound this client lacks: the horn")
  eq(ns.SoundId({ READY_CHECK = 8960, TELL_MESSAGE = "x" }, "whisper"), 8960)
  eq(ns.SoundId({ READY_CHECK = 8960 }, "nonsense"), 8960)
  eq(ns.SoundId({}, "alarm"), nil)
  eq(ns.SoundId(nil, "alarm"), nil)
  eq(ns.ChooseSound(s, "lfg", "alarm"), true)
  eq(s.sounds.lfg, "alarm")
  eq(ns.ChooseSound(s, "lfg", "trumpet"), nil)
  eq(ns.ChooseSound(s, "flash", "alarm"), nil)
  eq(ns.ChooseSound(s, "sounds", "alarm"), nil)
  eq(s.sounds.lfg, "alarm")
  eq(ns.SoundText(s), "Sounds: Group finder alarm, Ready check horn, Battleground and arena horn, Pet battle whisper. Choices: horn, warning, alarm, invite, whisper.")
  for _, name in ipairs(ns.SOUND_NAMES) do eq(type(ns.SOUND_KIT[name]), "string", name) end
end)

test("each alert plays the sound chosen for it", function(wow)
  local _, g = boot(wow)
  wow.slash("/qh sound lfg alarm")
  wow.slash("/qh sound ready warning")
  wow.slash("/qh sound pvp invite")
  wow.slash("/qh sound pet whisper")
  g.sounds = {}
  wow.fire("LFG_PROPOSAL_SHOW")
  wow.fire("READY_CHECK", "Tank", 30)
  g.pvp("confirm")
  wow.fire("PET_BATTLE_QUEUE_PROPOSE_MATCH")
  eq(table.concat(g.sounds, " "), "12889@Master 8959@Master 880@Master 3081@Master")
  eq(g.flashes, 4)
  eq(g.notices[1], "Your group is ready!")
end)

test("/qh sound lists the sounds and picks one with a preview", function(wow)
  local _, g = boot(wow)
  wow.slash("/qh sound")
  eq(wow.chat[1], PREFIX .. "Sounds: Group finder horn, Ready check horn, Battleground and arena horn, Pet battle horn. Choices: horn, warning, alarm, invite, whisper.")
  wow.slash("/qh SOUNDS")
  eq(wow.chat[2], wow.chat[1])
  wow.slash("/queuehorn  Sound  LFG  Alarm ")
  eq(wow.chat[3], PREFIX .. "Group finder now plays alarm.")
  eq(QueueHornDB.settings.sounds.lfg, "alarm")
  eq(table.concat(g.sounds, " "), "12889@Master", "the new sound plays once")
  eq(g.flashes, 0, "a preview does not flash")
  eq(#g.notices, 0, "nor show a message")
  wow.slash("/qh sound pet trumpet")
  eq(wow.chat[4]:match("/qh shows this") ~= nil, true, "an unknown sound shows the help")
  wow.slash("/qh sound flash alarm")
  eq(wow.chat[5]:match("/qh shows this") ~= nil, true)
  wow.slash("/qh sound lfg")
  eq(wow.chat[6]:match("/qh shows this") ~= nil, true)
  eq(QueueHornDB.settings.sounds.pet, "horn")
  eq(g.count(), 1)
  wow.fire("LFG_PROPOSAL_SHOW")
  eq(g.sounds[2], "12889@Master", "the preview does not hold back a real alert")
end)

test("/qh test with an alert plays its sound with the test message", function(wow)
  local _, g = boot(wow)
  wow.slash("/qh sound ready warning")
  g.sounds = {}
  wow.slash("/qh test ready")
  eq(table.concat(g.sounds, " "), "8959@Master")
  eq(g.flashes, 1)
  eq(g.notices[1], "Queue Horn test: this is how an alert looks.")
  wow.slash("/qh test")
  eq(g.sounds[2], "8960@Master", "the plain test plays the horn as in 1.0")
  wow.slash("/qh ready off")
  wow.slash("/qh test ready")
  eq(g.sounds[3], "8959@Master", "also when that alert is switched off")
  wow.slash("/qh test lfg")
  eq(g.sounds[4], "8960@Master")
  wow.slash("/qh test nonsense")
  eq(g.count(), 4)
  eq(wow.chat[#wow.chat]:match("/qh shows this") ~= nil, true)
end)

test("a sound the client does not know plays the horn, no SOUNDKIT plays nothing", function(wow)
  local _, g = boot(wow)
  wow.slash("/qh sound lfg alarm")
  SOUNDKIT = { READY_CHECK = 8960 }
  g.sounds = {}
  wow.fire("LFG_PROPOSAL_SHOW")
  eq(g.sounds[1], "8960@Master")
  SOUNDKIT = nil
  wow.slash("/qh sound pet invite")
  wow.fire("PET_BATTLE_QUEUE_PROPOSE_MATCH")
  eq(g.count(), 1)
  eq(g.flashes, 2, "the rest of the alert still works")
  PlaySound = nil
  SOUNDKIT = { READY_CHECK = 8960 }
  wow.slash("/qh test pet")
  eq(g.count(), 1)
end)

test("sound choices survive a reload and saved data of 1.0 keeps working", function(wow)
  local _, g = boot(wow)
  wow.slash("/qh sound pvp alarm")
  local saved = QueueHornDB
  QueueHornDB = saved
  wow.load(ADDON_DIR, ADDON_NAME)
  wow.frames[1].events = {}
  wow.fire("PLAYER_LOGIN")
  eq(QueueHornDB.settings.sounds.pvp, "alarm")
  g.sounds = {}
  g.pvp("confirm")
  eq(g.sounds[1], "12889@Master")

  QueueHornDB = { version = 1, settings = { lfg = true, ready = false, pvp = true, pet = true, flash = false } } -- written by 1.0
  wow.fire("PLAYER_LOGIN")
  eq(QueueHornDB.version, 3)
  eq(QueueHornDB.settings.ready, false)
  eq(QueueHornDB.settings.flash, false)
  eq(QueueHornDB.settings.sounds.lfg, "horn")
  wow.fire("LFG_PROPOSAL_SHOW")
  eq(g.sounds[2], "8960@Master", "an alert sounds as in 1.0")
end)

-- Queue Horn 1.2: the screen flash.

-- Notes what the screen flash frame does: alpha, strata, mouse, colours of its edges.
-- Call before boot(); the flash frame is made on first use.
local function screen(wow)
  local s = { colors = {}, frames = {} }
  CreateColor = function(r, g, b, a) return { r = r, g = g, b = b, a = a } end
  local original = CreateFrame
  CreateFrame = function(kind, name, parent, template)
    local f = original(kind, name, parent, template)
    f.parent = parent
    f.alpha = 1
    f.SetAlpha = function(self, a) self.alpha = a end
    f.SetFrameStrata = function(self, strata) self.strata = strata end
    f.EnableMouse = function(self, on) self.mouse = on end
    f.CreateTexture = function(self)
      local t = { solid = nil }
      t.SetPoint = function() end
      t.SetHeight = function() end
      t.SetWidth = function() end
      t.SetColorTexture = function(_, r, g, b, a) t.solid = { r, g, b, a } end
      t.SetGradient = function(_, orientation, min, max) t.gradient = { orientation = orientation, min = min, max = max } end
      table.insert(self.children, t)
      return t
    end
    s.frames[#s.frames + 1] = f
    return f
  end
  -- Runs the flash's OnUpdate for some seconds in small steps; returns the alphas seen.
  function s.run(ns, seconds, step)
    local f = ns.screenFlash
    local alphas = {}
    local t = 0
    while t < seconds - 1e-9 and f.shown do
      f.scripts.OnUpdate(f, step or 0.1)
      alphas[#alphas + 1] = f.alpha
      t = t + (step or 0.1)
    end
    return alphas
  end
  return s
end

local function near(a, b, msg) eq(math.abs(a - b) < 1e-6, true, (msg or "") .. " " .. tostring(a) .. " ~ " .. tostring(b)) end

test("core: every alert starts without a screen flash, a saved colour is kept", function(wow)
  local ns = boot(wow)
  local s = ns.Settings({ sounds = { lfg = "alarm" } }) -- as 1.1 saved them
  for _, kind in ipairs(ns.KINDS) do eq(s.screen[kind], "off", kind) end
  eq(s.sounds.lfg, "alarm")
  s = ns.Settings({ screen = { lfg = "red", ready = "purple", pvp = 3, later = "x" } })
  eq(s.screen.lfg, "red")
  eq(s.screen.ready, "off", "an unknown colour is replaced")
  eq(s.screen.pvp, "off")
  eq(s.screen.later, "x")
  eq(ns.Settings({ screen = "broken" }).screen.pet, "off")
  eq(ns.ScreenFor(s, "lfg"), "red")
  eq(ns.ScreenFor(s, "ready"), nil, "off is no colour")
  eq(ns.ScreenFor(s, nil), nil, "the plain test has none")
  eq(ns.ScreenFor(nil, "lfg"), nil)
  eq(ns.ChooseScreen(s, "pet", "green"), true)
  eq(ns.ChooseScreen(s, "lfg", "off"), true)
  eq(ns.ChooseScreen(s, "lfg", "purple"), nil)
  eq(ns.ChooseScreen(s, "flash", "red"), nil)
  eq(ns.ChooseScreen(s, "sound", "red"), nil)
  eq(s.screen.lfg, "off")
  eq(ns.ScreenText(s), "Screen flash: Group finder off, Ready check off, Battleground and arena off, Pet battle green. Choices: red, gold, blue, green, off. Icon flash: on.")
  for _, name in ipairs(ns.SCREEN_NAMES) do eq(#ns.SCREEN_RGB[name], 3, name) end
end)

test("core: the flash fades in and out three times, then it is over", function(wow)
  local ns = boot(wow)
  near(ns.FlashAlpha(0), 0, "starts invisible")
  near(ns.FlashAlpha(0.3), ns.FLASH_ALPHA, "strongest in the middle of a pulse")
  near(ns.FlashAlpha(0.15), ns.FLASH_ALPHA / 2)
  near(ns.FlashAlpha(0.6), 0, "the second pulse starts")
  near(ns.FlashAlpha(1.5), ns.FLASH_ALPHA, "the third pulse")
  eq(ns.FlashAlpha(1.8), nil, "3 pulses of 0.6 seconds")
  eq(ns.FlashAlpha(-1), nil)
  eq(ns.FlashAlpha(nil), nil)
  eq(ns.FLASH_PULSES, 3)
  eq(ns.FLASH_ALPHA <= 0.8, true, "never a full cover of the screen")
end)

test("nothing changes unless chosen: no screen flash and no frame for it", function(wow)
  local s = screen(wow)
  local ns, g = boot(wow)
  local frames = #s.frames
  wow.fire("LFG_PROPOSAL_SHOW")
  wow.fire("READY_CHECK", "Tank", 30)
  g.pvp("confirm")
  wow.fire("PET_BATTLE_QUEUE_PROPOSE_MATCH")
  wow.slash("/qh test")
  wow.slash("/qh test ready")
  eq(ns.screenFlash, nil)
  eq(#s.frames, frames, "the flash frame is only made when it is used")
  eq(g.count(), 6)
end)

test("/qh flash ready red: a preview, then every ready check flashes red", function(wow)
  local s = screen(wow)
  local ns, g = boot(wow)
  wow.slash("/qh flash ready red")
  eq(wow.chat[1], PREFIX .. "Ready check now flashes the screen red.")
  eq(QueueHornDB.settings.screen.ready, "red")
  local f = ns.screenFlash
  eq(f.shown, true, "the preview")
  eq(f.color, "red")
  eq(g.count(), 0, "the preview has no sound")
  eq(#g.notices, 0)
  s.run(ns, 5)
  eq(f.shown, false, "over after the pulses")

  wow.fire("LFG_PROPOSAL_SHOW")
  eq(f.shown, false, "the group finder has no flash")
  wow.fire("READY_CHECK", "Tank", 30)
  eq(f.shown, true)
  eq(f.color, "red")
  eq(g.count(), 2, "the sound plays as before")
  eq(g.flashes, 2, "and the icon flashes as before")
  eq(g.notices[2], "Ready check!")
end)

test("the screen flash: a plain frame over the screen with a glow at each edge", function(wow)
  local s = screen(wow)
  local ns = boot(wow)
  wow.slash("/qh flash pvp blue")
  local f = ns.screenFlash
  eq(rawget(f, "name"), nil, "no global name")
  eq(rawget(f, "template"), nil, "no template, nothing protected")
  eq(f.parent, UIParent)
  eq(f.strata, "FULLSCREEN_DIALOG")
  eq(f.mouse, false, "clicks go through")
  eq(#f.children, 4)
  local blue = ns.SCREEN_RGB.blue
  local function check(t, orientation, outer)
    eq(t.gradient.orientation, orientation)
    local strong = outer == "min" and t.gradient.min or t.gradient.max
    local clear = outer == "min" and t.gradient.max or t.gradient.min
    eq(strong.a, 1)
    eq(clear.a, 0)
    eq(strong.r .. "," .. strong.g .. "," .. strong.b, blue[1] .. "," .. blue[2] .. "," .. blue[3])
  end
  check(f.top, "VERTICAL", "max")
  check(f.bottom, "VERTICAL", "min")
  check(f.left, "HORIZONTAL", "min")
  check(f.right, "HORIZONTAL", "max")
  eq(f.alpha, 0, "starts invisible")
  local alphas = s.run(ns, 3)
  eq(#alphas, 18, "1.8 seconds")
  near(alphas[3], ns.FLASH_ALPHA, "first peak")
  near(alphas[6], 0, "first fade out")
  near(alphas[9], ns.FLASH_ALPHA, "second peak")
  eq(f.alpha, 0)
  eq(f.shown, false)
end)

test("a new alert during a flash starts it again in its own colour", function(wow)
  local s = screen(wow)
  local ns, g = boot(wow)
  wow.slash("/qh flash lfg gold")
  wow.slash("/qh flash pet green")
  local f = ns.screenFlash
  s.run(ns, 5)
  wow.fire("LFG_PROPOSAL_SHOW")
  s.run(ns, 1.2)
  eq(f.shown, true)
  wow.fire("PET_BATTLE_QUEUE_PROPOSE_MATCH")
  eq(f.color, "green")
  eq(f.top.gradient.max.g, 1)
  eq(#s.run(ns, 5), 18, "the full flash again")
  eq(g.count(), 2)
end)

test("/qh flash lists, off switches it off, wrong words show the help, the icon switch stays", function(wow)
  local s = screen(wow)
  local ns, g = boot(wow)
  wow.slash("/qh flash")
  eq(wow.chat[1], PREFIX .. "Screen flash: Group finder off, Ready check off, Battleground and arena off, Pet battle off. Choices: red, gold, blue, green, off. Icon flash: on.")
  wow.slash("/qh  Flash  LFG  Gold ")
  eq(wow.chat[2], PREFIX .. "Group finder now flashes the screen gold.")
  s.run(ns, 5)
  wow.slash("/qh flash lfg off")
  eq(wow.chat[3], PREFIX .. "Group finder: no screen flash.")
  eq(ns.screenFlash.shown, false, "no preview for off")
  eq(QueueHornDB.settings.screen.lfg, "off")
  wow.slash("/qh flash lfg purple")
  eq(wow.chat[4]:match("/qh shows this") ~= nil, true)
  wow.slash("/qh flash sound red")
  eq(wow.chat[5]:match("/qh shows this") ~= nil, true)
  wow.slash("/qh flash lfg")
  eq(wow.chat[6]:match("/qh shows this") ~= nil, true)
  eq(QueueHornDB.settings.screen.lfg, "off")
  wow.slash("/qh flash off")
  eq(QueueHornDB.settings.flash, false, "/qh flash off still switches the icon flash")
  eq(wow.chat[7], PREFIX .. "Alerts: Group finder on, Ready check on, Battleground and arena on, Pet battle on. Icon flash: off.")
  wow.slash("/qh flash ready red")
  wow.slash("/qh flash")
  eq(wow.chat[9], PREFIX .. "Screen flash: Group finder off, Ready check red, Battleground and arena off, Pet battle off. Choices: red, gold, blue, green, off. Icon flash: off.")
  wow.slash("/qh")
  eq(wow.chat[12], wow.chat[9], "/qh shows it too")
  for _, line in ipairs(wow.chat) do
    eq(line:sub(#PREFIX + 1):find("|", 1, true), nil, "no colour code by accident in: " .. line)
  end
  wow.fire("READY_CHECK", "Tank", 30)
  eq(g.flashes, 0)
  eq(ns.screenFlash.color, "red", "the screen flash does not depend on the icon flash")
end)

test("/qh test with an alert shows its screen flash, a switched-off alert shows none", function(wow)
  local s = screen(wow)
  local ns = boot(wow)
  wow.slash("/qh flash pet green")
  s.run(ns, 5)
  wow.slash("/qh test")
  eq(ns.screenFlash.shown, false, "the plain test belongs to no alert")
  wow.slash("/qh test pet")
  eq(ns.screenFlash.shown, true)
  eq(ns.screenFlash.color, "green")
  s.run(ns, 5)
  wow.slash("/qh pet off")
  wow.fire("PET_BATTLE_QUEUE_PROPOSE_MATCH")
  eq(ns.screenFlash.shown, false, "a switched-off alert stays dark")
  wow.slash("/qh test pet")
  eq(ns.screenFlash.shown, true, "the test works as for the sound")
end)

test("without the colour functions the edges get a plain colour, without a screen nothing happens", function(wow)
  local s = screen(wow)
  CreateColor = nil
  local ns, g = boot(wow)
  wow.slash("/qh flash lfg red")
  local f = ns.screenFlash
  eq(f.top.gradient, nil)
  eq(f.top.solid[1], 1)
  eq(f.top.solid[4] < 1, true, "a lighter plain colour")
  eq(f.shown, true)
  s.run(ns, 5)

  local saved = QueueHornDB
  QueueHornDB = saved
  wow.load(ADDON_DIR, ADDON_NAME) -- a fresh copy, which has not made its frame yet
  for i = 1, #wow.frames - 1 do wow.frames[i].events = {} end
  wow.fire("PLAYER_LOGIN")
  UIParent = nil
  wow.fire("LFG_PROPOSAL_SHOW")
  eq(wow.ns.screenFlash, nil)
  eq(g.count(), 1, "the rest of the alert still works")
end)

test("screen flash choices survive a reload, saved data of 1.1 keeps working", function(wow)
  local s = screen(wow)
  boot(wow)
  wow.slash("/qh flash pvp blue")
  QueueHornDB = { version = 2, settings = { lfg = true, ready = true, pvp = false, pet = true, flash = false, sounds = { lfg = "alarm", ready = "horn", pvp = "horn", pet = "whisper" } } } -- written by 1.1
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  for i = 1, #wow.frames - 1 do wow.frames[i].events = {} end
  wow.fire("PLAYER_LOGIN")
  eq(QueueHornDB.version, 3)
  eq(QueueHornDB.settings.pvp, false)
  eq(QueueHornDB.settings.flash, false)
  eq(QueueHornDB.settings.sounds.lfg, "alarm")
  eq(QueueHornDB.settings.sounds.pet, "whisper")
  eq(QueueHornDB.settings.screen.lfg, "off")
  eq(QueueHornDB.settings.screen.pvp, "off")
  wow.fire("LFG_PROPOSAL_SHOW")
  eq(ns.screenFlash, nil, "an alert looks as in 1.1")

  wow.slash("/qh flash lfg gold")
  QueueHornDB = { version = 3, settings = QueueHornDB.settings }
  wow.fire("PLAYER_LOGIN")
  eq(QueueHornDB.settings.screen.lfg, "gold")
  eq(#s.frames > 0, true)
end)

test("the screen flash defines no globals", function(wow)
  local s = screen(wow)
  local stubs = {}
  for k in pairs(_G) do stubs[k] = true end
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("PLAYER_LOGIN")
  wow.slash("/qh flash lfg red")
  wow.slash("/qh flash")
  wow.slash("/qh test lfg")
  s.run(ns, 5)
  local allowed = { QueueHornDB = true, SLASH_QUEUEHORN1 = true, SLASH_QUEUEHORN2 = true }
  for k in pairs(_G) do
    if not stubs[k] and not allowed[k] then error("unexpected global " .. tostring(k)) end
  end
  eq(ns.screenFlash.shown, false)
end)
