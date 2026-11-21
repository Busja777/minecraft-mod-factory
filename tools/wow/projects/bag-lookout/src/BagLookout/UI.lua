local _, ns = ...
local L = ns.L

-- The small counter: "Bags 12/98", movable unless locked. A click switches to the split view:
-- one more line for the reagent bag and one for each kind of profession bag.

local WIDTH, SPLIT_WIDTH = 120, 140
local SHORT, LINE = 24, 16 -- the counter alone, and every line below it

local ui
local dragging = false

local function savePosition(f)
  local point, _, relativePoint, x, y = f:GetPoint()
  ns.settings.point = { point, relativePoint, x, y }
end

local function place(f)
  local p = ns.settings.point
  f:ClearAllPoints()
  if type(p) == "table" and type(p[1]) == "string" then
    f:SetPoint(p[1], UIParent, type(p[2]) == "string" and p[2] or p[1], tonumber(p[3]) or 0, tonumber(p[4]) or 0)
  else
    f:SetPoint("CENTER", UIParent, "CENTER", 300, -200)
  end
end

local function showTooltip(self)
  GameTooltip:SetOwner(self, "ANCHOR_TOP")
  GameTooltip:AddLine(L["Bag Lookout"])
  GameTooltip:AddLine(L["Click to switch between the total and one line per bag type."])
  if ns.settings.locked then
    GameTooltip:AddLine(L["Locked. Type /bl lock to move it."])
  else
    GameTooltip:AddLine(L["Drag to move it."])
  end
  GameTooltip:Show()
end

local function create()
  local f = CreateFrame("Button", "BagLookoutFrame", UIParent)
  f:SetSize(WIDTH, SHORT)
  f:SetFrameStrata("MEDIUM")
  f:SetClampedToScreen(true)
  f:SetMovable(true)
  f:EnableMouse(true)
  f:RegisterForClicks("LeftButtonUp")
  f:RegisterForDrag("LeftButton")

  local bg = f:CreateTexture(nil, "BACKGROUND")
  bg:SetAllPoints()
  bg:SetColorTexture(0, 0, 0, 0.5)

  f.label = f:CreateFontString(nil, "OVERLAY", "GameFontHighlight")
  f.label:SetPoint("TOP", f, "TOP", 0, -5)
  f.detail = f:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
  f.detail:SetPoint("TOP", f.label, "BOTTOM", 0, -3)

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
  f:SetScript("OnClick", function()
    ns.settings.view = ns.settings.view == "split" and "total" or "split"
    ns.Render()
  end)
  f:SetScript("OnEnter", showTooltip)
  f:SetScript("OnLeave", function() GameTooltip:Hide() end)

  place(f)
  return f
end

function ns.CreateCounter()
  ui = ui or create()
  ns.Render()
end

function ns.Render()
  if not ui or not ns.settings then return end
  local s, c = ns.settings, ns.counts or {}
  ui.label:SetText(ns.CounterText(c.free, c.total, s.threshold))
  if s.view == "split" then
    local lines = ns.SplitLines(c, s.threshold)
    ui.detail:SetText(table.concat(lines, "\n"))
    ui.detail:Show()
    ui:SetSize(SPLIT_WIDTH, SHORT + LINE * #lines)
  else
    ui.detail:Hide()
    ui:SetSize(WIDTH, SHORT)
  end
  ui:SetShown(not s.hidden)
end
