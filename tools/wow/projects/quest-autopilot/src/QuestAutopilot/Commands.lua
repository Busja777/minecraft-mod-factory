local _, ns = ...
local L = ns.L

-- /qa and /questautopilot: show the state, switch everything or one half.

SLASH_QUESTAUTOPILOT1 = "/questautopilot"
SLASH_QUESTAUTOPILOT2 = "/qa"
SlashCmdList.QUESTAUTOPILOT = function(msg)
  if not ns.settings then return end
  local cmd = strtrim(msg or ""):lower()
  if cmd == "" or ns.Apply(ns.settings, cmd) then
    ns.Say(ns.StateText(ns.settings))
  else
    ns.Say(L["/qa shows the state, /qa on and /qa off switch everything, /qa accept and /qa turnin switch one half. Hold Shift while talking to pause."])
  end
end
