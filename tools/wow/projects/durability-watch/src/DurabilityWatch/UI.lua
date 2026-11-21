local _, ns = ...
local L = ns.L

-- A small display with the overall condition and the lowest item. Drag it anywhere unless it is
-- locked; the mouse-over tooltip lists every damaged item and, since 1.2, what repairs cost this week.

local display

local function savePosition(f)
  local point, _, relativePoint, x, y = f:GetPoint()
  ns.settings.point = { point, relativePoint, x, y }
end

function ns.ShowTooltip(owner)
  GameTooltip:SetOwner(owner, "ANCHOR_BOTTOM")
  GameTooltip:AddLine(L["Durability Watch"])
  local damaged = ns.condition and ns.condition.damaged or {}
  if #damaged == 0 then
    GameTooltip:AddLine(L["Nothing is damaged."], 1, 1, 1)
  end
  for _, it in ipairs(damaged) do
    GameTooltip:AddDoubleLine(ns.ItemText(it.slot), ns.Colored(it.percent), 1, 1, 1)
  end
  local history = ns.History()
  if #history > 0 then
    GameTooltip:AddLine(ns.WeekText(history, time()), 1, 0.82, 0)
    GameTooltip:AddLine(L["/dw history lists your last repair costs."], 0.6, 0.6, 0.6)
  end
  GameTooltip:AddLine(string.format(L["Warning at %d%%."], ns.settings.warn), 0.6, 0.6, 0.6)
  GameTooltip:AddLine(ns.settings.locked and L["Locked. /dw lock unlocks it."] or L["Drag to move. /dw lock locks it."], 0.6, 0.6, 0.6)
  GameTooltip:Show()
end

function ns.CreateDisplay()
  if display then return display end
  local f = CreateFrame("Frame", "DurabilityWatchFrame", UIParent)
  f:SetSize(130, 38)
  f:SetFrameStrata("MEDIUM")
  f:SetClampedToScreen(true)
  f:SetMovable(true)
  f:EnableMouse(true)
  f:RegisterForDrag("LeftButton")
  local dragging = false
  f:SetScript("OnDragStart", function(self)
    if ns.settings.locked then return end
    dragging = true
    self:StartMoving()
  end)
  f:SetScript("OnDragStop", function(self)
    if not dragging then return end
    dragging = false
    self:StopMovingOrSizing()
    savePosition(self)
  end)
  f:SetScript("OnEnter", function(self) ns.ShowTooltip(self) end)
  f:SetScript("OnLeave", function() GameTooltip:Hide() end)

  local p = ns.settings.point
  if type(p) == "table" and p[1] then
    f:SetPoint(p[1], UIParent, p[2] or p[1], p[3] or 0, p[4] or 0)
  else
    f:SetPoint("TOP", UIParent, "TOP", 0, -180)
  end

  local bg = f:CreateTexture(nil, "BACKGROUND")
  bg:SetAllPoints(f)
  bg:SetColorTexture(0, 0, 0, 0.5)

  f.gear = f:CreateFontString(nil, "OVERLAY", "GameFontHighlight")
  f.gear:SetPoint("TOP", 0, -5)
  f.lowest = f:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
  f.lowest:SetPoint("BOTTOM", 0, 6)

  display = f
  return f
end

function ns.Refresh()
  if not display then return end
  display:SetShown(not ns.settings.hidden)
  local gear, lowest = ns.DisplayLines(ns.condition)
  display.gear:SetText(gear)
  display.lowest:SetText(lowest)
end
