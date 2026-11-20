-- Tests for Queue Horn, run by tools/wow/client/run.lua.

-- The parts of the game the stand-in client lacks: sounds, the game icon, the raid warning frame,
-- the battleground queue slots and the sound options. Every alert is noted in g.
local function game(wow)
  local g = { sounds = {}, flashes = 0, notices = {}, errors = {}, slots = {}, cvars = {} }
  SOUNDKIT = { READY_CHECK = 8960 }
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
  SOUNDKIT = { READY_CHECK = 8960 }
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
  eq(#wow.chat, 2)
  eq(wow.chat[1], PREFIX .. "Alerts: Group finder on, Ready check on, Battleground and arena on, Pet battle on. Icon flash: on.")
  eq(wow.chat[2]:match("^" .. PREFIX:gsub("%p", "%%%0") .. "/qh shows this") ~= nil, true)
  wow.slash("/qh pvp off")
  eq(wow.chat[3], PREFIX .. "Alerts: Group finder on, Ready check on, Battleground and arena off, Pet battle on. Icon flash: on.")
  eq(QueueHornDB.settings.pvp, false)
  wow.slash("/queuehorn  Ready   OFF ")
  eq(QueueHornDB.settings.ready, false)
  eq(wow.chat[4]:match("Ready check off") ~= nil, true)
  wow.slash("/qh flash off")
  eq(QueueHornDB.settings.flash, false)
  wow.slash("/qh sound on")
  eq(wow.chat[6]:match("/qh shows this") ~= nil, true, "unknown words show the help")
  wow.slash("/qh pvp")
  eq(wow.chat[7]:match("/qh shows this") ~= nil, true)
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
  eq(#wow.chat, 2)
  g.cvars.Sound_EnableSoundWhenGameIsInBG = "0"
  wow.slash("/qh")
  eq(#wow.chat, 5)
  eq(wow.chat[4], PREFIX .. "Sound in Background is off in the game's sound options, so you hear nothing while tabbed out.")
  C_CVar = nil
  GetCVar = function(name) return g.cvars[name] end
  wow.slash("/qh")
  eq(#wow.chat, 8, "the older GetCVar works too")
end)

test("settings survive: saved values are kept, new ones start switched on", function(wow)
  local _, g = boot(wow)
  eq(QueueHornDB.version, 1)
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
