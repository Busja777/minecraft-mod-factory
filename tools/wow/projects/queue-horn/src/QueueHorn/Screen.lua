local _, ns = ...

-- 1.2: the screen flash. A plain frame over the whole screen with a coloured glow at its four edges,
-- which fades in and out a few times and hides again. It takes no clicks and is no protected frame,
-- so it works in combat too. It is made the first time a flash is shown.

local EDGE = 140 -- how far the glow reaches into the screen

local flash -- the frame; nil until the first flash
local elapsed = 0

local function edge(f, a, b)
  local t = f:CreateTexture(nil, "BACKGROUND")
  t:SetPoint(a)
  t:SetPoint(b)
  return t
end

-- Colours one edge: full colour at the screen's edge, nothing towards the middle. Without the
-- gradient functions the edge gets a plain, lighter colour.
local function paint(t, r, g, b, outerFirst, orientation)
  local strong = CreateColor and CreateColor(r, g, b, 1)
  local clear = CreateColor and CreateColor(r, g, b, 0)
  if strong and clear and t.SetGradient and t.SetColorTexture then
    t:SetColorTexture(1, 1, 1, 1)
    if outerFirst then
      t:SetGradient(orientation, strong, clear)
    else
      t:SetGradient(orientation, clear, strong)
    end
  elseif t.SetColorTexture then
    t:SetColorTexture(r, g, b, 0.35)
  end
end

local function make()
  if not CreateFrame or not UIParent then return nil end
  local f = CreateFrame("Frame", nil, UIParent)
  f:SetAllPoints(UIParent)
  if f.SetFrameStrata then f:SetFrameStrata("FULLSCREEN_DIALOG") end
  if f.EnableMouse then f:EnableMouse(false) end
  f:Hide()
  f.top = edge(f, "TOPLEFT", "TOPRIGHT")
  f.top:SetHeight(EDGE)
  f.bottom = edge(f, "BOTTOMLEFT", "BOTTOMRIGHT")
  f.bottom:SetHeight(EDGE)
  f.left = edge(f, "TOPLEFT", "BOTTOMLEFT")
  f.left:SetWidth(EDGE)
  f.right = edge(f, "TOPRIGHT", "BOTTOMRIGHT")
  f.right:SetWidth(EDGE)
  f:SetScript("OnUpdate", function(self, dt)
    elapsed = elapsed + (type(dt) == "number" and dt or 0)
    local alpha = ns.FlashAlpha(elapsed)
    if alpha then
      self:SetAlpha(alpha)
    else
      self:SetAlpha(0)
      self:Hide()
    end
  end)
  return f
end

-- Shows the flash in one colour from ns.SCREEN_RGB; nil or an unknown colour shows nothing.
-- A flash that is still running starts again in the new colour.
function ns.ShowScreenFlash(name)
  local rgb = ns.SCREEN_RGB[name or ""]
  if not rgb then return end
  flash = flash or make()
  if not flash then return end
  ns.screenFlash = flash
  local r, g, b = rgb[1], rgb[2], rgb[3]
  -- Vertical gradients run from the bottom up, horizontal ones from left to right.
  paint(flash.top, r, g, b, false, "VERTICAL")
  paint(flash.bottom, r, g, b, true, "VERTICAL")
  paint(flash.left, r, g, b, true, "HORIZONTAL")
  paint(flash.right, r, g, b, false, "HORIZONTAL")
  flash.color = name
  elapsed = 0
  flash:SetAlpha(0)
  flash:Show()
end
