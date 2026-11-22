local _, ns = ...
local L = ns.L

-- A small window: deaths per zone on the left, per level bracket on the right, the last death below.

local ROWS = 10
local SIZE = { 380, 272 }

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

local function column(f, x, header)
  local col = { head = text(f, "GameFontNormal"), rows = {} }
  col.head:SetPoint("TOPLEFT", x, -32)
  col.head:SetText(header)
  for i = 1, ROWS do
    local left = text(f, "GameFontHighlightSmall")
    left:SetPoint("TOPLEFT", x, -36 - i * 16)
    left:SetWidth(130)
    left:SetWordWrap(false) -- long zone names are cut, not wrapped
    local right = text(f, "GameFontHighlightSmall", "RIGHT")
    right:SetPoint("TOPRIGHT", f, "TOPLEFT", x + 165, -36 - i * 16)
    col.rows[i] = { left = left, right = right }
  end
  return col
end

local function create()
  local ok, f = pcall(CreateFrame, "Frame", "DeathDiaryFrame", UIParent, "BasicFrameTemplateWithInset")
  if not ok then f = CreateFrame("Frame", "DeathDiaryFrame", UIParent) end
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
  table.insert(UISpecialFrames, "DeathDiaryFrame") -- Escape closes the window

  f.title = text(f, "GameFontHighlight", "CENTER")
  f.title:SetPoint("TOP", 0, -5)
  f.title:SetText(L["Death Diary"])

  f.zones = column(f, 16, ns.GameText("ZONE", "Zone"))
  f.levels = column(f, 200, ns.GameText("LEVEL", "Level"))
  f.total = text(f, "GameFontNormalSmall")
  f.total:SetPoint("BOTTOMLEFT", 16, 30)
  f.last = text(f, "GameFontHighlightSmall")
  f.last:SetPoint("BOTTOMLEFT", 16, 14)
  f:SetScript("OnShow", function() ns.Refresh() end)
  return f
end

local function fill(col, rows)
  for i, row in ipairs(col.rows) do
    local r = rows[i]
    row.left:SetText(r and r[1] or "")
    row.right:SetText(r and tostring(r[2]) or "")
  end
end

-- What the window shows, as plain data: { zones = { {name, count} }, levels = { {label, count} }, total, last }.
function ns.WindowData(list)
  local data = { zones = {}, levels = {}, total = #list }
  local zones = ns.ByZone(list)
  for i, z in ipairs(zones) do
    if i == ROWS and #zones > ROWS then
      local rest = 0
      for j = ROWS, #zones do rest = rest + zones[j].count end
      data.zones[i] = { string.format(L["%d other zones"], #zones - ROWS + 1), rest }
      break
    end
    data.zones[i] = { z.name, z.count }
  end
  local brackets, unknown = ns.ByBracket(list)
  for _, b in ipairs(brackets) do
    data.levels[#data.levels + 1] = { string.format(L["%d-%d"], b.from, b.to), b.count }
  end
  if unknown > 0 then data.levels[#data.levels + 1] = { ns.GameText("UNKNOWN", "Unknown"), unknown } end
  while #data.levels > ROWS do table.remove(data.levels, 1) end -- the lowest brackets go first
  data.last = list[#list] and ns.EntryText(list[#list]) or nil
  return data
end

function ns.Refresh()
  if not ui or not ui:IsShown() then return end
  local data = ns.WindowData(ns.Deaths())
  fill(ui.zones, data.zones)
  fill(ui.levels, data.levels)
  ui.total:SetText(string.format(L["Deaths: %d"], data.total))
  ui.last:SetText(data.last and (L["Last: "] .. data.last) or L["No deaths noted for this character yet."])
end

function ns.Toggle()
  if not ns.db then return end
  ui = ui or create()
  if ui:IsShown() then ui:Hide() else ui:Show() end
end
