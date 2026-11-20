local _, ns = ...
local L = ns.L

local GREY = "|cff9d9d9d"
local WAITING = GREY .. "...|r"
local LINES = 6
local REFRESH = 1 -- seconds between two refreshes while the window is open

local ui

local function text(parent, template, justify)
  local fs = parent:CreateFontString(nil, "OVERLAY", template)
  fs:SetJustifyH(justify or "LEFT")
  return fs
end

local function savePosition(f)
  local point, _, relativePoint, x, y = f:GetPoint()
  ns.db.settings.point = { point, relativePoint, x, y }
end

local function create()
  local ok, f = pcall(CreateFrame, "Frame", "LevelClockFrame", UIParent, "BasicFrameTemplateWithInset")
  if not ok then f = CreateFrame("Frame", "LevelClockFrame", UIParent) end
  f:SetSize(230, 146)
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
  if p then f:SetPoint(p[1], UIParent, p[2], p[3], p[4]) else f:SetPoint("CENTER") end
  f:Hide()
  table.insert(UISpecialFrames, "LevelClockFrame") -- Escape closes the window

  local title = text(f, "GameFontHighlight", "CENTER")
  title:SetPoint("TOP", 0, -5)
  title:SetText(L["Level Clock"])

  f.lines = {}
  for i = 1, LINES do
    local y = -32 - (i - 1) * 17
    local left = text(f, "GameFontNormalSmall")
    left:SetPoint("TOPLEFT", 16, y)
    local right = text(f, "GameFontHighlightSmall", "RIGHT")
    right:SetPoint("TOPRIGHT", -16, y)
    f.lines[i] = { left = left, right = right }
  end

  f.note = text(f, "GameFontHighlight", "CENTER")
  f.note:SetPoint("CENTER", 0, -10)
  f.note:SetText(L["You have reached the maximum level."])
  f.note:Hide()

  local elapsed = 0
  f:SetScript("OnUpdate", function(_, dt) -- the rate and the time to level keep changing while the window is open
    elapsed = elapsed + dt
    if elapsed >= REFRESH then
      elapsed = 0
      ns.Refresh()
    end
  end)
  f:SetScript("OnShow", function() ns.Refresh() end)
  return f
end

-- The rows of the window as { label, value }.
function ns.WindowLines(now)
  local v = ns.View(ns.session, now or GetTime())
  return {
    { L["XP per hour"], v.perHour and ns.FormatNumber(v.perHour) or WAITING },
    { L["Time to level"], v.timeToLevel and ns.FormatDuration(v.timeToLevel) or WAITING },
    { L["XP to level"], v.needed and ns.FormatNumber(v.needed) or WAITING },
    { L["Rested"], v.rested and string.format(L["%d%%"], v.rested) or WAITING },
    { L["Session XP"], ns.FormatNumber(v.gained) },
    { L["Session time"], ns.FormatDuration(v.seconds) },
  }
end

function ns.Refresh()
  if not ui or not ui:IsShown() then return end
  local lines = not ns.AtMaxLevel() and ns.WindowLines() or {}
  for i, line in ipairs(ui.lines) do
    line.left:SetText(lines[i] and lines[i][1] or "")
    line.right:SetText(lines[i] and lines[i][2] or "")
  end
  if #lines == 0 then ui.note:Show() else ui.note:Hide() end
end

function ns.Toggle()
  if not ns.db then return end
  ui = ui or create()
  if ui:IsShown() then ui:Hide() else ui:Show() end
end

local function print(msg)
  DEFAULT_CHAT_FRAME:AddMessage("|cffffd100" .. L["Level Clock"] .. ":|r " .. msg)
end

SLASH_LEVELCLOCK1 = "/levelclock"
SLASH_LEVELCLOCK2 = "/lc"
SlashCmdList.LEVELCLOCK = function(msg)
  local cmd = strtrim(msg or ""):lower()
  if cmd == "" then
    ns.Toggle()
  elseif cmd == "reset" then
    if not ns.db then return end
    ns.Reset()
    print(L["New session started."])
  else
    print(L["/lc opens or closes the clock, /lc reset starts a new session."])
  end
end
