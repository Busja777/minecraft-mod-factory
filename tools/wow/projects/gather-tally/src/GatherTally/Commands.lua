local _, ns = ...
local L = ns.L

-- /gt prints the session, reset starts a new one, hide and show switch the small display.

function ns.Report(now)
  now = now or GetTime()
  local s = ns.session
  ns.Print(ns.KindLine(s, "herb", now) .. ", " .. ns.KindLine(s, "ore", now) .. ".")
  local top = ns.Top(s, nil, ns.TOP)
  if #top > 0 then
    local parts = {}
    for i, item in ipairs(top) do parts[i] = ns.ItemText(item) end
    ns.Print(L["Most gathered:"] .. " " .. table.concat(parts, ", "))
  end
end

SLASH_GATHERTALLY1 = "/gathertally"
SLASH_GATHERTALLY2 = "/gt"
SlashCmdList.GATHERTALLY = function(msg)
  if not ns.settings then return end
  local cmd = strtrim(msg or ""):lower()
  if cmd == "" then
    ns.Report()
    ns.Print(L["/gt reset starts a new session, /gt hide and /gt show hide or show the display."])
  elseif cmd == "reset" then
    ns.Reset()
    ns.Print(L["New session started."])
  elseif cmd == "hide" then
    ns.settings.hidden = true
    ns.Refresh()
    ns.Print(L["The display is hidden. /gt show brings it back."])
  elseif cmd == "show" then
    ns.settings.hidden = false
    ns.Refresh()
    ns.Print(L["The display is shown while you have gathered something this session."])
  else
    ns.Print(L["/gt shows this session, /gt reset starts a new one, /gt hide and /gt show hide or show the display."])
  end
end
