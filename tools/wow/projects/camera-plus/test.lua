-- Tests for Camera Plus, run by tools/wow/client/run.lua.

-- The stand-in client has no CVars, combat or camera views; these model the game functions the addon calls.
local game

local function client(g)
  game = { cvars = { cameraDistanceMaxZoomFactor = "1.9" }, defaults = { cameraDistanceMaxZoomFactor = "1.9" },
    combat = false, saved = {}, loaded = {}, sets = {}, refuse = false, events = nil }
  for k, v in pairs(g or {}) do game[k] = v end
  C_CVar = {
    GetCVar = function(name) return game.cvars[name] end,
    GetCVarDefault = function(name) return game.defaults[name] end,
    SetCVar = function(name, value)
      if game.combat then error("blocked in combat") end
      if game.refuse then return false end
      table.insert(game.sets, value)
      game.cvars[name] = string.format("%.6f", tonumber(value)) -- the game answers with more decimals
      if game.fire then game.fire("CVAR_UPDATE", name, game.cvars[name]) end
      return true
    end,
  }
  InCombatLockdown = function() return game.combat end
  SaveView = function(view) table.insert(game.saved, view) end
  SetView = function(view) table.insert(game.loaded, view) end
end

local function boot(wow, g, saved)
  client(g)
  game.fire = wow.fire
  CameraPlusDB = saved
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("ADDON_LOADED", "CameraPlus")
  wow.fire("PLAYER_LOGIN")
  wow.fire("PLAYER_ENTERING_WORLD", true, false)
  return ns
end

local function cvar() return tonumber(game.cvars.cameraDistanceMaxZoomFactor) end
local function lastChat(wow) return wow.chat[#wow.chat] or "" end
local function said(wow, pattern)
  for _, line in ipairs(wow.chat) do if line:find(pattern, 1, true) then return true end end
  return false
end

test("addon defines only its own globals", function(wow, installed, before)
  boot(wow)
  wow.slash("/cplus far")
  wow.slash("/cplus save 1")
  wow.slash("/cplus")
  local allowed = { CameraPlusDB = true, SLASH_CAMERAPLUS1 = true, SLASH_CAMERAPLUS2 = true,
    C_CVar = true, InCombatLockdown = true, SaveView = true, SetView = true } -- the last four come from the test
  for k in pairs(_G) do
    if not before[k] and not installed[k] and not allowed[k] then error("unexpected global " .. tostring(k)) end
  end
end)

test("factors are parsed, clamped to the game's limit and printed short", function(wow)
  local ns = boot(wow)
  eq(ns.ParseFactor(""), 2.6)
  eq(ns.ParseFactor("max"), 2.6)
  eq(ns.ParseFactor("2.2"), 2.2)
  eq(ns.ParseFactor("2,4"), 2.4, "comma as decimal mark")
  eq(ns.ParseFactor("4"), 2.6, "above the limit")
  eq(ns.ParseFactor("0.2"), 1, "below the minimum")
  eq(ns.ParseFactor("1.234"), 1.23)
  eq(ns.ParseFactor("far"), nil)
  eq(ns.ParseFactor("nan"), nil)
  eq(ns.FormatFactor(2.6), "2.6")
  eq(ns.FormatFactor(2), "2")
  eq(ns.FormatFactor(1.95), "1.95")
  eq(ns.Same("2.600000", "2.6"), true)
  eq(ns.Same("2.5", "2.6"), false)
  eq(ns.Same(nil, "2.6"), false)
end)

test("slots 1 to 3 are the game's views 2 to 4, never 1 or 5", function(wow)
  local ns = boot(wow)
  eq(ns.ViewFor("1"), 2)
  eq(ns.ViewFor("2"), 3)
  eq(ns.ViewFor("3"), 4)
  eq(ns.ViewFor("0"), nil)
  eq(ns.ViewFor("4"), nil)
  eq(ns.ViewFor("1.5"), nil)
  eq(ns.ViewFor("x"), nil)
  for _, view in ipairs(ns.VIEWS) do
    if view == 1 or view == 5 then error("view " .. view .. " belongs to the game") end
  end
  eq(ns.SlotList({ [3] = true, [1] = true }), "1, 3")
  eq(ns.SlotList({}), nil)
end)

test("restore value: the old value, else the game's default, else 1.9", function(wow)
  local ns = boot(wow)
  eq(ns.RestoreValue("1.5", "1.9"), "1.5")
  eq(ns.RestoreValue(nil, "2.0"), "2.0")
  eq(ns.RestoreValue(nil, nil), "1.9")
  eq(ns.RestoreValue({ secret = true }, nil), "1.9")
end)

test("/cplus far sets the CVar to 2.6 and remembers the old value", function(wow)
  local ns = boot(wow, { cvars = { cameraDistanceMaxZoomFactor = "1.5" } })
  wow.slash("/cplus far")
  eq(cvar(), 2.6)
  eq(CameraPlusDB.on, true)
  eq(CameraPlusDB.factor, 2.6)
  eq(CameraPlusDB.previous, "1.5")
  eq(said(wow, "Maximum camera distance is on (factor 2.6)"), true)
end)

test("/cplus far with a number clamps it; changing it keeps the first old value", function(wow)
  local ns = boot(wow, { cvars = { cameraDistanceMaxZoomFactor = "1.7" } })
  wow.slash("/cplus far 2.2")
  eq(cvar(), 2.2)
  wow.slash("/cplus far 9")
  eq(cvar(), 2.6)
  eq(CameraPlusDB.previous, "1.7")
  wow.slash("/cplus far wide")
  eq(lastChat(wow):find("Use a number from 1 to 2.6", 1, true) ~= nil, true)
  eq(cvar(), 2.6)
end)

test("/cplus off restores the previous value, a second off says so", function(wow)
  local ns = boot(wow, { cvars = { cameraDistanceMaxZoomFactor = "1.5" } })
  wow.slash("/cplus far")
  wow.slash("/cplus off")
  eq(cvar(), 1.5)
  eq(CameraPlusDB.on, false)
  eq(CameraPlusDB.previous, nil)
  eq(said(wow, "The game's value 1.5 is back"), true)
  wow.slash("/cplus off")
  eq(lastChat(wow):find("already off", 1, true) ~= nil, true)
end)

test("/cplus off without a remembered value falls back to the game's default", function(wow)
  local ns = boot(wow, { cvars = { cameraDistanceMaxZoomFactor = "2.6" }, defaults = { cameraDistanceMaxZoomFactor = "1.9" } },
    { on = true, factor = 2.6 })
  wow.slash("/cplus off")
  eq(cvar(), 1.9)
end)

test("in combat the change waits for PLAYER_REGEN_ENABLED", function(wow)
  local ns = boot(wow, { cvars = { cameraDistanceMaxZoomFactor = "1.9" } })
  game.combat = true
  wow.slash("/cplus far")
  eq(cvar(), 1.9, "nothing written in combat")
  eq(#game.sets, 0)
  eq(said(wow, "You are in combat"), true)
  wow.slash("/cplus")
  eq(said(wow, "waits for the end of combat"), true)
  game.combat = false
  wow.fire("PLAYER_REGEN_ENABLED")
  eq(cvar(), 2.6)
  eq(ns.pending, nil)
  eq(lastChat(wow):find("Combat is over", 1, true) ~= nil, true)
  wow.fire("PLAYER_REGEN_ENABLED")
  eq(#game.sets, 1, "nothing left to write")
end)

test("on and off again inside one fight ends with the old value", function(wow)
  local ns = boot(wow, { cvars = { cameraDistanceMaxZoomFactor = "1.4" } })
  game.combat = true
  wow.slash("/cplus far")
  wow.slash("/cplus off")
  wow.slash("/cplus far 2")
  eq(CameraPlusDB.previous, "1.4", "the waiting restore is the real old value")
  wow.slash("/cplus off")
  game.combat = false
  wow.fire("PLAYER_REGEN_ENABLED")
  eq(cvar(), 1.4)
  eq(#game.sets, 0, "the CVar already had that value")
end)

test("a refused write is reported and not retried silently", function(wow)
  local ns = boot(wow, { refuse = true })
  wow.slash("/cplus far")
  eq(lastChat(wow):find("did not accept", 1, true) ~= nil, true)
  eq(cvar(), 1.9)
end)

test("settings are reapplied on login", function(wow)
  local ns = boot(wow, { cvars = { cameraDistanceMaxZoomFactor = "1.9" } }, { on = true, factor = 2.4, previous = "1.6" })
  eq(cvar(), 2.4)
  eq(CameraPlusDB.previous, "1.6", "the old value survives the login")
  eq(#wow.chat, 0, "login is quiet")
end)

test("login in combat (reload in a fight) applies after combat", function(wow)
  client({ combat = true })
  game.fire = wow.fire
  CameraPlusDB = { on = true, factor = 2.6 }
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("PLAYER_LOGIN")
  wow.fire("PLAYER_ENTERING_WORLD", false, true)
  eq(cvar(), 1.9)
  game.combat = false
  wow.fire("PLAYER_REGEN_ENABLED")
  eq(cvar(), 2.6)
end)

test("damaged or old saved settings are repaired", function(wow)
  local ns = boot(wow, nil, { on = "yes", factor = 4, previous = "abc", views = 3 })
  eq(CameraPlusDB.version, 1)
  eq(CameraPlusDB.on, false)
  eq(CameraPlusDB.factor, 2.6)
  eq(CameraPlusDB.previous, nil)
  eq(type(CameraPlusDB.views), "table")
  local ns2 = ns.CleanSettings(nil)
  eq(ns2.factor, 2.6)
  eq(ns.CleanSettings({ on = true, factor = 0.5 }).factor, 1)
end)

test("moving the game's own slider while on switches Camera Plus off and keeps that value", function(wow)
  local ns = boot(wow, { cvars = { cameraDistanceMaxZoomFactor = "1.9" } })
  wow.slash("/cplus far")
  eq(CameraPlusDB.on, true, "its own write does not count as the player's change")
  game.cvars.cameraDistanceMaxZoomFactor = "1.300000"
  wow.fire("CVAR_UPDATE", "cameraDistanceMaxZoomFactor", "1.300000")
  eq(CameraPlusDB.on, false)
  eq(cvar(), 1.3)
  eq(said(wow, "changed in the game's settings"), true)
  wow.fire("CVAR_UPDATE", "cameraDistanceMaxZoomFactor", "1.300000")
  eq(#wow.chat, 2, "said once")
end)

test("other CVars and changes before the login settled are ignored", function(wow)
  client({ cvars = { cameraDistanceMaxZoomFactor = "1.9" } })
  game.fire = wow.fire
  CameraPlusDB = { on = true, factor = 2.6, previous = "1.9" }
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("PLAYER_LOGIN")
  game.cvars.cameraDistanceMaxZoomFactor = "1.9" -- the game loads its settings late
  wow.fire("CVAR_UPDATE", "cameraDistanceMaxZoomFactor", "1.9")
  eq(CameraPlusDB.on, true)
  wow.fire("PLAYER_ENTERING_WORLD", true, false)
  eq(cvar(), 2.6, "set again after the loading screen")
  wow.fire("CVAR_UPDATE", "cameraFov", "90")
  eq(CameraPlusDB.on, true)
end)

test("save and load camera positions in slots 1 to 3", function(wow)
  local ns = boot(wow)
  wow.slash("/cplus save 1")
  wow.slash("/cplus save 3")
  eq(game.saved[1], 2)
  eq(game.saved[2], 4)
  eq(lastChat(wow), "|cff66ccffCamera Plus:|r Camera position 3 saved. /cplus 3 brings it back.")
  wow.slash("/cplus 1")
  wow.slash("/cplus view 3")
  eq(game.loaded[1], 2)
  eq(game.loaded[2], 4)
  eq(CameraPlusDB.views["Yubi-Silvermoon"][1], true)
  wow.slash("/cplus 2")
  eq(#game.loaded, 2, "an empty slot is not loaded")
  eq(lastChat(wow):find("Slot 2 is empty", 1, true) ~= nil, true)
  wow.slash("/cplus save 5")
  wow.slash("/cplus 4")
  eq(#game.saved, 2)
  eq(#game.loaded, 2)
  eq(lastChat(wow):find("from 1 to 3", 1, true) ~= nil, true)
end)

test("saved slots belong to the character; forget empties one", function(wow)
  local ns = boot(wow, nil, { views = { ["Brakk-Silvermoon"] = { [2] = true } } })
  wow.slash("/cplus 2")
  eq(#game.loaded, 0, "another character's slot")
  wow.slash("/cplus save 2")
  wow.slash("/cplus forget 2")
  eq(CameraPlusDB.views["Yubi-Silvermoon"][2], nil)
  eq(CameraPlusDB.views["Brakk-Silvermoon"][2], true)
  eq(lastChat(wow):find("Slot 2 is empty again", 1, true) ~= nil, true)
  wow.slash("/cplus forget x")
  eq(lastChat(wow):find("from 1 to 3", 1, true) ~= nil, true)
end)

test("a client without SaveView or SetView answers instead of failing", function(wow)
  local ns = boot(wow)
  SaveView = nil
  wow.slash("/cplus save 1")
  eq(lastChat(wow):find("cannot save", 1, true) ~= nil, true)
  CameraPlusDB.views["Yubi-Silvermoon"] = { [1] = true }
  SetView = nil
  wow.slash("/cplus 1")
  eq(lastChat(wow):find("cannot load", 1, true) ~= nil, true)
end)

test("older clients with only GetCVar and SetCVar work too", function(wow)
  client({ cvars = { cameraDistanceMaxZoomFactor = "1.9" } })
  local cvars = game.cvars
  C_CVar = nil
  GetCVar = function(name) return cvars[name] end
  SetCVar = function(name, value) cvars[name] = value end
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("PLAYER_LOGIN")
  wow.slash("/cplus far")
  eq(cvars.cameraDistanceMaxZoomFactor, "2.6")
  wow.slash("/cplus off")
  eq(cvars.cameraDistanceMaxZoomFactor, "1.9")
end)

test("a secret CVar value is not used as the old value", function(wow)
  local ns = boot(wow, { cvars = { cameraDistanceMaxZoomFactor = { secret = true } } })
  wow.slash("/cplus far")
  eq(CameraPlusDB.previous, nil)
  game.cvars.cameraDistanceMaxZoomFactor = "2.6"
  wow.slash("/cplus off")
  eq(cvar(), 1.9, "the game's default instead")
end)

test("/cplus and /cameraplus show status and help", function(wow)
  local ns = boot(wow, { cvars = { cameraDistanceMaxZoomFactor = "1.9" } })
  wow.slash("/cameraplus")
  eq(wow.chat[1], "|cff66ccffCamera Plus:|r Maximum camera distance: off, the game's value is 1.9.")
  eq(wow.chat[2], "|cff66ccffCamera Plus:|r Saved camera positions: none yet.")
  eq(wow.chat[3]:find("/cplus far zooms out", 1, true) ~= nil, true)
  wow.slash("/cplus save 2")
  wow.slash("/cplus FAR 2.2")
  wow.chat = {}
  wow.slash("/cplus help")
  eq(wow.chat[1], "|cff66ccffCamera Plus:|r Maximum camera distance: on, factor 2.2.")
  eq(wow.chat[2], "|cff66ccffCamera Plus:|r Saved camera positions: 2.")
end)

test("slash commands before the login do nothing", function(wow)
  client()
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.slash("/cplus far")
  eq(cvar(), 1.9)
  eq(#wow.chat, 0)
end)
