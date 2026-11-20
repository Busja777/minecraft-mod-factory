local _, ns = ...
local L = ns.L

-- /qh shows the state and the help, /qh test plays the alert, /qh <alert> on|off and /qh flash on|off switch.
-- No "|" in chat texts: the chat reads it as the start of a colour code.

local function help()
  return L["/qh shows this, /qh test plays the alert once. /qh lfg, ready, pvp or pet with on or off switches one alert, /qh flash on or off switches the icon flash."]
end

local function backgroundSound()
  if C_CVar and C_CVar.GetCVar then return C_CVar.GetCVar("Sound_EnableSoundWhenGameIsInBG") end
  if GetCVar then return GetCVar("Sound_EnableSoundWhenGameIsInBG") end
  return nil
end

local function showState()
  ns.Print(ns.StateText(ns.settings))
  if ns.BackgroundSoundOff(backgroundSound()) then
    ns.Print(L["Sound in Background is off in the game's sound options, so you hear nothing while tabbed out."])
  end
  ns.Print(help())
end

SLASH_QUEUEHORN1 = "/queuehorn"
SLASH_QUEUEHORN2 = "/qh"
SlashCmdList.QUEUEHORN = function(msg)
  if not ns.settings then return end
  local words = strtrim(msg or ""):lower():gsub("%s+", " ")
  if words == "" then
    showState()
  elseif words == "test" then
    ns.Play(nil)
  elseif ns.Apply(ns.settings, words) then
    ns.Print(ns.StateText(ns.settings))
  else
    ns.Print(help())
  end
end
