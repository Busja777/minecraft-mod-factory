local _, ns = ...
local L = ns.L

-- A small movable window with the two countdowns and the timer, refreshed every second.

local GREY = "|cff9d9d9d"
local NOTHING = GREY .. "-|r"
local SIZE = { 220, 100 }

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
  local ok, f = pcall(CreateFrame, "Frame", "ResetClockFrame", UIParent, "BasicFrameTemplateWithInset")
  if not ok then f = CreateFrame("Frame", "ResetClockFrame", UIParent) end
  f:SetSize(SIZE[1], SIZE[2])
  f:SetFrameStrata("MEDIUM")
  f:SetClampedToScreen(true)
  f:SetMovable(true)
  f:EnableMouse(true)
  f:RegisterForDrag("LeftButton")
  f:SetScript("OnDragStart", function(self) self:StartMoving() end)
  f:SetScript("OnDragStop", function(self)
    self:StopMovingOrSizing()
    savePosition(self)
  end)
  local p = ns.db.settings.point
  if p then f:SetPoint(p[1], UIParent, p[2], p[3], p[4]) else f:SetPoint("CENTER") end
  f:Hide()
  table.insert(UISpecialFrames, "ResetClockFrame") -- Escape closes the window

  f.title = text(f, "GameFontHighlight", "CENTER")
  f.title:SetPoint("TOP", 0, -5)
  f.title:SetText(L["Reset Clock"])

  f.lines = {}
  for i = 1, 3 do
    local y = -32 - (i - 1) * 18
    local left = text(f, "GameFontNormalSmall")
    left:SetPoint("TOPLEFT", 16, y)
    left:SetWidth(120) -- a long timer label ends in "..." instead of running into the time
    left:SetWordWrap(false)
    local right = text(f, "GameFontHighlightSmall", "RIGHT")
    right:SetPoint("TOPRIGHT", -16, y)
    f.lines[i] = { left = left, right = right }
  end

  f:SetScript("OnShow", function() ns.Refresh() end)
  -- The player closed it (close button, Escape): it stays closed at the next login. When only the
  -- whole interface is hidden (Alt+Z, a cinematic), the window itself still counts as shown.
  f:SetScript("OnHide", function(self)
    if not self:IsShown() then ns.db.settings.shown = false end
  end)
  return f
end

-- The rows of the window as { label, value }.
function ns.WindowLines(now)
  now = now or ns.Now()
  local daily, weekly = ns.DailySeconds(), ns.WeeklySeconds()
  local timer = ns.Timer()
  local left = ns.Remaining(timer, now)
  return {
    { L["Daily reset"], daily and ns.FormatDuration(daily) or NOTHING },
    { L["Weekly reset"], weekly and ns.FormatDuration(weekly) or NOTHING },
    { timer and timer.label or L["Timer"], left and ns.FormatDuration(left) or NOTHING },
  }
end

function ns.Refresh()
  if not ui or not ui:IsShown() then return end
  local lines = ns.WindowLines()
  for i, line in ipairs(ui.lines) do
    line.left:SetText(lines[i][1])
    line.right:SetText(lines[i][2])
  end
end

function ns.Toggle()
  if not ns.db then return end
  ui = ui or create()
  if ui:IsShown() then ui:Hide() else ui:Show() end
  ns.db.settings.shown = ui:IsShown() and true or false
end

-- At login the window opens again when the player left it open.
function ns.WindowAtLogin()
  if ns.db.settings.shown then
    ui = ui or create()
    ui:Show()
  end
end
