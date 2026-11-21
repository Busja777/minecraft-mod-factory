local _, ns = ...
local L = ns.L

local LIST_MAX = 40 -- chat lines of /fm list

local ui

local function savePosition(f)
  local point, _, relativePoint, x, y = f:GetPoint()
  ns.db.settings.point = { point, relativePoint, x, y }
end

-- 1.3: hovering the flight frame shows the flight totals.
local function showTooltip(self)
  if not GameTooltip then return end
  GameTooltip:SetOwner(self, "ANCHOR_BOTTOM")
  GameTooltip:AddLine(L["Flight Minutes"])
  GameTooltip:AddLine(ns.SessionText(ns.session), 1, 1, 1)
  GameTooltip:AddLine(ns.AllTimeText(ns.allTime), 1, 1, 1)
  GameTooltip:AddLine(L["Drag to move it."], 0.6, 0.6, 0.6)
  GameTooltip:Show()
end

local function create()
  local f = CreateFrame("Frame", "FlightMinutesFrame", UIParent)
  f:SetSize(220, 44)
  f:SetFrameStrata("MEDIUM")
  f:SetClampedToScreen(true)
  f:SetMovable(true)
  f:EnableMouse(true)
  f:RegisterForDrag("LeftButton")
  f:SetScript("OnDragStart", f.StartMoving)
  f:SetScript("OnDragStop", function(self)
    self:StopMovingOrSizing()
    savePosition(self)
  end)
  f:SetScript("OnEnter", showTooltip)
  f:SetScript("OnLeave", function() if GameTooltip then GameTooltip:Hide() end end)
  local p = ns.db.settings.point
  if type(p) == "table" and p[1] then
    f:SetPoint(p[1], UIParent, p[2] or p[1], p[3] or 0, p[4] or 0)
  else
    f:SetPoint("TOP", UIParent, "TOP", 0, -140)
  end
  f:Hide()

  local bg = f:CreateTexture(nil, "BACKGROUND")
  bg:SetAllPoints(f)
  bg:SetColorTexture(0, 0, 0, 0.55)

  f.title = f:CreateFontString(nil, "OVERLAY", "GameFontNormal")
  f.title:SetPoint("TOPLEFT", 8, -7)
  f.title:SetPoint("TOPRIGHT", -8, -7)
  f.title:SetJustifyH("CENTER")
  f.title:SetWordWrap(false)

  f.text = f:CreateFontString(nil, "OVERLAY", "GameFontHighlight")
  f.text:SetPoint("BOTTOMLEFT", 8, 8)
  f.text:SetPoint("BOTTOMRIGHT", -8, 8)
  f.text:SetJustifyH("CENTER")
  return f
end

-- Shows the flight frame while in the air and hides it after landing.
function ns.Refresh()
  local flight = ns.flight
  if not flight or not ns.db then
    if ui then ui:Hide() end
    return
  end
  ui = ui or create()
  ui.title:SetText(flight.to)
  if flight.early then
    ui.text:SetText(L["Landing early, not timed"])
  else
    ui.text:SetText(ns.CountdownText(flight.known, GetTime() - flight.start))
  end
  ui:Show()
end

local function listRoutes()
  local list = ns.RouteList(ns.routes)
  if #list == 0 then
    ns.Print(L["No routes known yet. Every flight you take is timed."])
    return
  end
  for i, route in ipairs(list) do
    if i > LIST_MAX then
      ns.Print(string.format(L["and %d more"], #list - LIST_MAX))
      break
    end
    ns.Print(string.format("%s  |cffffffff%s|r", route.key, ns.FormatTime(route.seconds)))
  end
end

local function forgetRoutes()
  for _, routes in pairs(ns.db.factions) do
    for key in pairs(routes) do routes[key] = nil end
  end
  if ns.flight then ns.flight.known = nil end
  ns.Print(L["All routes forgotten, for both factions."])
  ns.Refresh()
end

-- 1.2: /fm sound tells the setting, /fm sound before, landing, both or off sets when it plays,
-- /fm sound bell (or another name) picks the sound and plays it once.
local function soundHelp()
  ns.Print(string.format(L["/fm sound before, landing, both or off sets when it plays; /fm sound followed by %s picks the sound."],
    ns.OrList(ns.SOUND_NAMES)))
end

local function sound(word)
  local s = ns.db.settings
  if word == "" then
    ns.Print(ns.SoundText(s.soundWhen, s.soundName))
    soundHelp()
    return
  end
  local changed = ns.ChooseSound(s, word)
  if not changed then return soundHelp() end
  ns.Print(ns.SoundText(s.soundWhen, s.soundName))
  if changed == "sound" then
    ns.PlayArrivalSound() -- a preview of the new choice
    if s.soundWhen == "off" then ns.Print(L["/fm sound both switches it on."]) end
  end
end

-- 1.3: /fm stats prints the totals, /fm stats reset clears the all-time total of this character.
local function stats(word)
  if word == "reset" then
    ns.allTime.flights, ns.allTime.seconds = 0, 0
    ns.Print(L["The all-time flight total of this character is cleared. Your routes and this session's total stay."])
    return
  elseif word ~= "" then
    ns.Print(L["/fm stats shows your flight totals, /fm stats reset clears the all-time total of this character."])
    return
  end
  ns.Print(ns.SessionText(ns.session))
  ns.Print(ns.AllTimeText(ns.allTime))
end

SLASH_FLIGHTMINUTES1 = "/flightminutes"
SLASH_FLIGHTMINUTES2 = "/fm"
SlashCmdList.FLIGHTMINUTES = function(msg)
  if not ns.db then return end
  local cmd = strtrim(msg or ""):lower()
  local word, arg = cmd:match("^(%S*)%s*(.-)$")
  if cmd == "" then
    local count = ns.Count(ns.routes)
    if count == 0 then
      ns.Print(L["No routes known yet. Every flight you take is timed."])
    else
      ns.Print(string.format(L["Routes known for %s: %d. /fm list shows them, /fm forget clears all."], ns.factionName, count))
    end
    ns.Print(ns.SessionText(ns.session) .. " " .. ns.AllTimeText(ns.allTime))
  elseif cmd == "list" then
    listRoutes()
  elseif cmd == "forget" then
    forgetRoutes()
  elseif word == "sound" then
    sound(arg)
  elseif word == "stats" then
    stats(arg)
  else
    ns.Print(L["/fm shows how many routes are known, /fm list shows them with their times, /fm forget clears all routes."])
    soundHelp()
    ns.Print(L["/fm stats shows your flight totals, /fm stats reset clears the all-time total of this character."])
  end
end
