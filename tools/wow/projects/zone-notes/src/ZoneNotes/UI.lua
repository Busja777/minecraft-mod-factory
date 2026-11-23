local _, ns = ...
local L = ns.L

-- A small window with the notes of one zone. It opens on arrival in a zone with notes (unless
-- switched off with /zn popup off) and closes with its close button, a right-click or Escape.

local WIDTH = 300
local LINE = 14

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
  local ok, f = pcall(CreateFrame, "Frame", "ZoneNotesFrame", UIParent, "BasicFrameTemplateWithInset")
  if not ok then f = CreateFrame("Frame", "ZoneNotesFrame", UIParent) end
  f:SetSize(WIDTH, 80)
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
  f:SetScript("OnMouseUp", function(self, button)
    if button == "RightButton" then self:Hide() end
  end)
  local p = ns.db.settings.point
  if type(p) == "table" and p[1] then f:SetPoint(p[1], UIParent, p[2], p[3], p[4]) else f:SetPoint("TOP", 0, -120) end
  f:Hide()
  table.insert(UISpecialFrames, "ZoneNotesFrame") -- Escape closes the window

  f.title = text(f, "GameFontHighlight", "CENTER")
  f.title:SetPoint("TOP", 0, -5)
  f.title:SetWidth(WIDTH - 60)
  f.title:SetWordWrap(false)

  f.body = text(f, "GameFontHighlightSmall")
  f.body:SetPoint("TOPLEFT", 14, -32)
  f.body:SetWidth(WIDTH - 28)
  f.body:SetWordWrap(true)
  return f
end

-- What the window shows, as plain data: { title, body, lines }.
function ns.WindowData(key, name)
  local zones = ns.Zones()
  local notes = ns.NotesOf(zones, key, name)
  local entry = ns.Entry(zones, key, name, false)
  local label = entry and entry.name or name or ns.ZoneName(nil, key)
  local data = { title = label, lines = #notes }
  if #notes == 0 then
    data.body = L["No notes for this zone yet. Add one with /zn add <text>."]
  else
    data.body = table.concat(ns.NumberedLines(notes), "\n")
  end
  return data
end

local function fill(key, name)
  local data = ns.WindowData(key, name)
  ui.key, ui.name = key, name
  ui.title:SetText(data.title)
  ui.body:SetText(data.body)
  local height = ui.body.GetStringHeight and ui.body:GetStringHeight()
  if type(height) ~= "number" or height <= 0 then height = math.max(1, data.lines) * LINE end
  ui:SetHeight(math.floor(height + 48))
end

function ns.ShowWindow(key, name)
  if not ns.db then return end
  ui = ui or create()
  fill(key, name)
  ui:Show()
end

function ns.HideWindow()
  if ui then ui:Hide() end
end

-- Shows the window again with fresh notes when it shows the zone (key) that just changed.
function ns.Refresh(key)
  if not ui or not ui:IsShown() then return end
  if key ~= nil and ui.key ~= key then return end
  fill(ui.key, ui.name)
end

-- /zn window: the notes of the zone you are in; a second time closes it.
function ns.Toggle(key, name)
  if not ns.db then return end
  if ui and ui:IsShown() then
    ui:Hide()
    return
  end
  ns.ShowWindow(key, name)
end
