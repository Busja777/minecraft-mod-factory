local _, ns = ...
local L = ns.L

local DEFAULT_POINT = { "TOP", "TOP", 0, -100 }

local ui

local function place(f)
  local p = type(ns.db.point) == "table" and ns.db.point[1] and ns.db.point or DEFAULT_POINT
  f:ClearAllPoints()
  f:SetPoint(p[1], UIParent, p[2], p[3], p[4])
end

local function fillTooltip(owner)
  GameTooltip:SetOwner(owner, "ANCHOR_BOTTOM")
  GameTooltip:AddLine(L["Perf Meter"])
  local lines = ns.TooltipLines(ns.reading or ns.Read(), ns.scan, GetTime(), ns.InCombat(), ns.db.locked)
  for _, line in ipairs(lines) do GameTooltip:AddLine(line, 1, 1, 1) end
  GameTooltip:Show()
end

local function create()
  local f = CreateFrame("Frame", "PerfMeterFrame", UIParent)
  f:SetSize(220, 20)
  f:SetFrameStrata("MEDIUM")
  f:SetClampedToScreen(true)
  f:SetMovable(true)
  f:EnableMouse(true) -- also when locked: the tooltip needs the mouse
  f:RegisterForDrag("LeftButton")
  f:SetScript("OnDragStart", function(self)
    if not ns.db.locked then self:StartMoving() end
  end)
  f:SetScript("OnDragStop", function(self)
    self:StopMovingOrSizing()
    local point, _, relativePoint, x, y = self:GetPoint()
    ns.db.point = { point, relativePoint, x, y }
  end)
  place(f)

  local bg = f:CreateTexture(nil, "BACKGROUND")
  bg:SetAllPoints()
  bg:SetColorTexture(0, 0, 0, 0.5)

  local text = f:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
  text:SetPoint("CENTER")
  f.text = text

  local elapsed = 0
  f:SetScript("OnUpdate", function(_, dt) -- runs only while the meter is shown
    elapsed = elapsed + dt
    if elapsed >= ns.TICK then
      elapsed = 0
      ns.Tick(GetTime())
    end
  end)
  f:SetScript("OnShow", function() ns.Tick(GetTime()) end)
  f:SetScript("OnEnter", function(self)
    ns.tooltipOwner = self
    fillTooltip(self)
  end)
  f:SetScript("OnLeave", function()
    ns.tooltipOwner = nil
    GameTooltip:Hide()
  end)
  return f
end

function ns.Refresh()
  if not ui or not ui:IsShown() then return end
  ui.text:SetText(ns.MeterText(ns.reading or ns.Read()))
  local width = ui.text:GetStringWidth()
  if type(width) == "number" and width > 0 then ui:SetWidth(width + 16) end
  if ns.tooltipOwner == ui then fillTooltip(ui) end
end

function ns.SetShown(show)
  if not ns.db then return end
  ns.db.hidden = not show
  if show then
    if ui then
      ui:Show() -- OnShow fills it at once
    else
      ui = create() -- a new frame is already shown, so no OnShow: fill it here
      ns.Tick(GetTime())
    end
  elseif ui then
    ui:Hide()
    if ns.tooltipOwner == ui then
      ns.tooltipOwner = nil
      GameTooltip:Hide()
    end
  end
end

function ns.IsShown()
  return ui ~= nil and ui:IsShown()
end

function ns.Frame()
  return ui
end

-- After login: the meter comes back the way it was left (shown unless it was hidden).
function ns.Setup()
  if not ns.db.hidden then ns.SetShown(true) end
end

function ns.ResetPosition()
  ns.db.point = nil
  if ui then place(ui) end
end

local function print(msg)
  DEFAULT_CHAT_FRAME:AddMessage("|cffffd100" .. L["Perf Meter"] .. ":|r " .. msg)
end

SLASH_PERFMETER1 = "/perfmeter"
SLASH_PERFMETER2 = "/pm"
SlashCmdList.PERFMETER = function(msg)
  if not ns.db then return end
  local cmd = strtrim(msg or ""):lower()
  if cmd == "" then
    ns.SetShown(not ns.IsShown())
  elseif cmd == "show" then
    ns.SetShown(true)
  elseif cmd == "hide" then
    ns.SetShown(false)
  elseif cmd == "lock" then
    ns.db.locked = true
    print(L["The meter is locked."])
  elseif cmd == "unlock" then
    ns.db.locked = false
    print(L["The meter is unlocked. Drag it to move it."])
  elseif cmd == "reset" then
    ns.ResetPosition()
    print(L["The meter is back at the top of the screen."])
  else
    print(L["/perfmeter shows or hides the meter, /perfmeter lock or unlock fixes or frees it, /perfmeter reset puts it back at the top."])
  end
end
