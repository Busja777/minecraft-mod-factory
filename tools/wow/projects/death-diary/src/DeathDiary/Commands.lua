local _, ns = ...
local L = ns.L

-- /dd shows the summary of this character; last, window, quiet and reset do the rest.

local function help()
  ns.Print(L["/dd last lists your last 10 deaths, /dd window opens the window, /dd quiet on or off switches the note after a death, /dd reset confirm clears this character's diary."])
end

local function summary()
  for _, line in ipairs(ns.SummaryLines(ns.Deaths())) do ns.Print(line) end
end

local function last()
  local list = ns.Deaths()
  if #list == 0 then
    ns.Print(L["No deaths noted for this character yet."])
    return
  end
  local entries = ns.Last(list, ns.LAST)
  ns.Print(string.format(L["Your last %d deaths, newest first:"], #entries))
  for _, e in ipairs(entries) do ns.Print(ns.EntryText(e)) end
end

local function quiet(rest)
  local s = ns.db.settings
  if rest == "on" then
    s.quiet = true
  elseif rest == "off" then
    s.quiet = false
  elseif rest ~= "" then
    ns.Print(L["Use /dd quiet on or /dd quiet off."])
    return
  end
  ns.Print(s.quiet and L["No note in chat after a death."] or L["A note in chat after each death."])
end

local function reset(rest)
  local char = ns.Char()
  if not char then return end
  if rest ~= "confirm" then
    ns.Print(string.format(L["This clears all %d deaths of this character. Type /dd reset confirm to do it."], #char.deaths))
    return
  end
  char.deaths = {}
  ns.Print(L["The diary of this character is empty now."])
  ns.Refresh()
end

SLASH_DEATHDIARY1 = "/deathdiary"
SLASH_DEATHDIARY2 = "/dd"
SlashCmdList.DEATHDIARY = function(msg)
  if not ns.db then return end
  local cmd, rest = strtrim(msg or ""):lower():match("^(%S*)%s*(.-)$")
  if cmd == "last" then
    last()
  elseif cmd == "window" then
    ns.Toggle()
  elseif cmd == "quiet" then
    quiet(rest)
  elseif cmd == "reset" then
    reset(rest)
  else
    summary()
    help()
  end
end
