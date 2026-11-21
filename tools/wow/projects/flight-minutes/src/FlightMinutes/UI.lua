local _, ns = ...
local L = ns.L

local LIST_MAX = 40 -- chat lines of /fm list

local ui

local function savePosition(f)
  local point, _, relativePoint, x, y = f:GetPoint()
  ns.db.settings.point = { point, relativePoint, x, y }
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
  elseif cmd == "list" then
    listRoutes()
  elseif cmd == "forget" then
    forgetRoutes()
  elseif word == "sound" then
    sound(arg)
  else
    ns.Print(L["/fm shows how many routes are known, /fm list shows them with their times, /fm forget clears all routes."])
    soundHelp()
  end
end
