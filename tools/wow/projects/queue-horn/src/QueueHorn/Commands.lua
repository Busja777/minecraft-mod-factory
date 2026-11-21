local _, ns = ...
local L = ns.L

-- /qh shows the state and the help, /qh test plays the alert, /qh <alert> on|off and /qh flash on|off switch,
-- /qh sound lists and picks the sounds, /qh test <alert> plays the sound of one alert,
-- /qh flash lists the screen flash and /qh flash <alert> <colour or off> picks one.
-- No "|" in chat texts: the chat reads it as the start of a colour code.

local function help()
  return L["/qh shows this, /qh test plays the alert once. /qh lfg, ready, pvp or pet with on or off switches one alert, /qh flash on or off switches the icon flash."]
    .. " " .. L["/qh sound lists the sounds, /qh sound lfg alarm picks one for an alert, /qh test lfg plays it."]
    .. " " .. L["/qh flash lists the screen flash, /qh flash lfg red gives an alert a coloured flash at the screen edges (red, gold, blue, green or off)."]
end

local function backgroundSound()
  if C_CVar and C_CVar.GetCVar then return C_CVar.GetCVar("Sound_EnableSoundWhenGameIsInBG") end
  if GetCVar then return GetCVar("Sound_EnableSoundWhenGameIsInBG") end
  return nil
end

local function showState()
  ns.Print(ns.StateText(ns.settings))
  ns.Print(ns.SoundText(ns.settings))
  ns.Print(ns.ScreenText(ns.settings))
  if ns.BackgroundSoundOff(backgroundSound()) then
    ns.Print(L["Sound in Background is off in the game's sound options, so you hear nothing while tabbed out."])
  end
  ns.Print(help())
end

local function chooseSound(kind, name)
  if not ns.ChooseSound(ns.settings, kind, name) then return ns.Print(help()) end
  ns.Print(string.format(L["%s now plays %s."], L[ns.KIND_LABEL[kind]], name))
  ns.PlayAlertSound(kind) -- a preview of the new choice
end

local function chooseScreen(kind, name)
  if not ns.ChooseScreen(ns.settings, kind, name) then return ns.Print(help()) end
  if name == ns.SCREEN_OFF then
    ns.Print(string.format(L["%s: no screen flash."], L[ns.KIND_LABEL[kind]]))
    return
  end
  ns.Print(string.format(L["%s now flashes the screen %s."], L[ns.KIND_LABEL[kind]], name))
  ns.ShowScreenFlash(name) -- a preview of the new choice
end

SLASH_QUEUEHORN1 = "/queuehorn"
SLASH_QUEUEHORN2 = "/qh"
SlashCmdList.QUEUEHORN = function(msg)
  if not ns.settings then return end
  local words = strtrim(msg or ""):lower():gsub("%s+", " ")
  local testKind = words:match("^test (%a+)$")
  local soundKind, soundName = words:match("^sound (%a+) (%a+)$")
  local screenKind, screenName = words:match("^flash (%a+) (%a+)$")
  if words == "" then
    showState()
  elseif words == "test" then
    ns.Play(nil)
  elseif testKind and ns.KIND_LABEL[testKind] then
    ns.Play(testKind, true)
  elseif words == "sound" or words == "sounds" then
    ns.Print(ns.SoundText(ns.settings))
  elseif soundKind then
    chooseSound(soundKind, soundName)
  elseif words == "flash" then
    ns.Print(ns.ScreenText(ns.settings))
  elseif screenKind then
    chooseScreen(screenKind, screenName)
  elseif ns.Apply(ns.settings, words) then
    ns.Print(ns.StateText(ns.settings))
  else
    ns.Print(help())
  end
end
