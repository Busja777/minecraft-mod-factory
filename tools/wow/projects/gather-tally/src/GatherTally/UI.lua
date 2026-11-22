local _, ns = ...
local L = ns.L

-- A small display with herbs and ores of the session and their rate per hour. It appears with the
-- first herb or ore of a session and can be dragged anywhere; the tooltip lists the top items.

local display

local function savePosition(f)
  local point, _, relativePoint, x, y = f:GetPoint()
  ns.settings.point = { point, relativePoint, x, y }
end

function ns.ShowTooltip(owner)
  local now = GetTime()
  GameTooltip:SetOwner(owner, "ANCHOR_BOTTOM")
  GameTooltip:AddLine(L["Gather Tally"])
  for _, kind in ipairs(ns.KINDS) do
    GameTooltip:AddLine(ns.KindLine(ns.session, kind, now), 1, 0.82, 0)
    for _, item in ipairs(ns.Top(ns.session, kind, ns.TOP)) do
      GameTooltip:AddDoubleLine(item.link or item.name, tostring(item.count), 1, 1, 1, 1, 1, 1)
    end
  end
  GameTooltip:AddLine(L["Drag to move. /gt reset starts a new session."], 0.6, 0.6, 0.6)
  GameTooltip:Show()
end

function ns.CreateDisplay()
  if display then return display end
  local f = CreateFrame("Frame", "GatherTallyFrame", UIParent)
  f:SetSize(150, 38)
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
  f:SetScript("OnEnter", function(self) ns.ShowTooltip(self) end)
  f:SetScript("OnLeave", function() GameTooltip:Hide() end)

  local p = ns.settings.point
  if type(p) == "table" and p[1] then
    f:SetPoint(p[1], UIParent, p[2] or p[1], p[3] or 0, p[4] or 0)
  else
    f:SetPoint("TOP", UIParent, "TOP", 0, -220)
  end

  local bg = f:CreateTexture(nil, "BACKGROUND")
  bg:SetAllPoints(f)
  bg:SetColorTexture(0, 0, 0, 0.5)

  f.herb = f:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
  f.herb:SetPoint("TOP", 0, -6)
  f.ore = f:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
  f.ore:SetPoint("BOTTOM", 0, 6)

  local elapsed = 0
  f:SetScript("OnUpdate", function(_, dt) -- the rate keeps changing while you travel
    elapsed = elapsed + dt
    if elapsed >= 5 then
      elapsed = 0
      ns.Refresh()
    end
  end)

  display = f
  return f
end

function ns.Refresh()
  if not display or not ns.settings then return end
  local show = not ns.settings.hidden and ns.Total(ns.session) > 0
  display:SetShown(show)
  if not show then return end
  local now = GetTime()
  display.herb:SetText(ns.ShortLine(ns.session, "herb", now))
  display.ore:SetText(ns.ShortLine(ns.session, "ore", now))
end
