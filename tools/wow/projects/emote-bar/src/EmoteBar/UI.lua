local _, ns = ...
local L = ns.L

-- The bar: one button per emote, in rows of six. Drag it (on a button or the frame) anywhere unless it
-- is locked. It is a plain frame with plain buttons, no secure templates: an emote is not a protected
-- action, so the bar works the same in and out of combat and never needs to wait for combat to end.

local bar
local buttons = {}

local function savePosition(f)
  local point, _, relativePoint, x, y = f:GetPoint()
  ns.db.point = { point, relativePoint, x, y }
end

local dragging = false

local function startDrag()
  if not bar or ns.db.locked then return end
  dragging = true
  bar:StartMoving()
end

local function stopDrag()
  if not dragging then return end
  dragging = false
  bar:StopMovingOrSizing()
  savePosition(bar)
end

local function hint()
  return ns.db.locked and L["Locked. /emotebar lock unlocks it."] or L["Drag to move. /emotebar lock locks it."]
end

function ns.ShowButtonTooltip(button)
  local token = ns.db and ns.db.emotes[button.index]
  if not token then return end
  GameTooltip:SetOwner(button, "ANCHOR_TOP")
  GameTooltip:AddLine(ns.Command(ns.Index(), token))
  GameTooltip:AddLine(L["Click to use this emote on your target."], 1, 1, 1)
  GameTooltip:AddLine(hint(), 0.6, 0.6, 0.6)
  GameTooltip:Show()
end

function ns.ShowBarTooltip(owner)
  GameTooltip:SetOwner(owner, "ANCHOR_TOP")
  GameTooltip:AddLine(L["Emote Bar"])
  if #ns.db.emotes == 0 then
    GameTooltip:AddLine(L["Add an emote with /emotebar add wave."], 1, 1, 1)
  end
  GameTooltip:AddLine(hint(), 0.6, 0.6, 0.6)
  GameTooltip:Show()
end

local function createButton(i)
  local b = CreateFrame("Button", nil, bar, "UIPanelButtonTemplate")
  b.index = i
  b:SetSize(ns.BUTTON_WIDTH, ns.BUTTON_HEIGHT)
  b:SetPoint("TOPLEFT", bar, "TOPLEFT", ns.ButtonOffset(i))
  b:RegisterForDrag("LeftButton")
  b:SetScript("OnClick", function(self) ns.Click(self.index) end)
  b:SetScript("OnDragStart", startDrag)
  b:SetScript("OnDragStop", stopDrag)
  b:SetScript("OnEnter", function(self) ns.ShowButtonTooltip(self) end)
  b:SetScript("OnLeave", function() GameTooltip:Hide() end)
  local text = b.GetFontString and b:GetFontString()
  if text then
    text:SetWidth(ns.BUTTON_WIDTH - 8) -- a long command is cut off with "..." instead of running over
    if text.SetWordWrap then text:SetWordWrap(false) end
  end
  buttons[i] = b
  return b
end

function ns.CreateBar()
  if bar then return bar end
  local f = CreateFrame("Frame", "EmoteBarFrame", UIParent)
  f:SetFrameStrata("MEDIUM")
  f:SetClampedToScreen(true)
  f:SetMovable(true)
  f:EnableMouse(true)
  f:RegisterForDrag("LeftButton")
  f:SetScript("OnDragStart", startDrag)
  f:SetScript("OnDragStop", stopDrag)
  f:SetScript("OnEnter", function(self) ns.ShowBarTooltip(self) end)
  f:SetScript("OnLeave", function() GameTooltip:Hide() end)

  local p = ns.db.point
  if type(p) == "table" and type(p[1]) == "string" then
    f:SetPoint(p[1], UIParent, p[2] or p[1], tonumber(p[3]) or 0, tonumber(p[4]) or 0)
  else
    f:SetPoint("BOTTOM", UIParent, "BOTTOM", 0, 220)
  end

  local bg = f:CreateTexture(nil, "BACKGROUND")
  bg:SetAllPoints(f)
  bg:SetColorTexture(0, 0, 0, 0.4)

  f.empty = f:CreateFontString(nil, "OVERLAY", "GameFontNormalSmall")
  f.empty:SetPoint("CENTER")
  f.empty:SetText(L["Emote Bar"])

  bar = f
  return f
end

-- Builds the buttons from the saved list and shows or hides the bar.
function ns.Refresh()
  if not bar then return end
  local list, index = ns.db.emotes, ns.Index()
  bar:SetSize(ns.BarSize(#list))
  for i = 1, math.max(#list, #buttons) do
    local token = list[i]
    if token then
      local b = buttons[i] or createButton(i)
      b:SetText(ns.Label(index, token))
      b:Show()
    elseif buttons[i] then
      buttons[i]:Hide()
    end
  end
  bar.empty:SetShown(#list == 0)
  bar:SetShown(not ns.db.hidden)
end

function ns.Bar() return bar end
function ns.Buttons() return buttons end
