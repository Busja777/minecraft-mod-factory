local _, ns = ...
local L = ns.L

-- A small movable window: the daily and the weekly list, each task with a checkbox and a remove
-- button. The list scrolls when it is longer than the window.

local GREY = "|cff9d9d9d"
local SIZE = { 320, 380 }
local WIDTH = 262  -- width of the scrolling content
local ROW = 22     -- height of one task row
local HEAD = 20    -- height of a list heading

local ui

local function text(parent, template, justify)
  local fs = parent:CreateFontString(nil, "OVERLAY", template)
  fs:SetJustifyH(justify or "LEFT")
  return fs
end

-- A frame from a Blizzard template, or a plain one when the template is missing.
local function frameFrom(kind, name, parent, template)
  local ok, f = pcall(CreateFrame, kind, name, parent, template)
  if ok and f then return f end
  return CreateFrame(kind, name, parent)
end

local function savePosition(f)
  local point, _, relativePoint, x, y = f:GetPoint()
  ns.db.point = { point, relativePoint, x, y }
end

-- "2/5, resets in 3h 12m": how far the list is, and when it opens again.
function ns.HeadingInfo(kind)
  local done, total = ns.Counts(ns.List(kind) or {})
  local left = ns.FormatLeft(ns.SecondsLeft(kind))
  local count = total > 0 and string.format("%d/%d", done, total) or nil
  if left then
    local resets = string.format(L["resets in %s"], left)
    return count and (count .. ", " .. resets) or resets
  end
  return count or ""
end

local function newRow(content)
  local row = {}
  row.check = frameFrom("CheckButton", nil, content, "UICheckButtonTemplate")
  row.check:SetSize(22, 22)
  row.check:SetScript("OnClick", function()
    ns.ToggleTask(ns.List(row.kind), row.index)
    ns.Refresh()
  end)
  row.label = text(content, "GameFontHighlight")
  row.label:SetWidth(WIDTH - 54) -- a long task ends in "..." instead of running under the button
  row.label:SetWordWrap(false)
  row.remove = frameFrom("Button", nil, content, "UIPanelButtonTemplate")
  row.remove:SetSize(22, 20)
  row.remove:SetText("x")
  row.remove:SetScript("OnClick", function()
    ns.RemoveTask(ns.List(row.kind), row.index)
    ns.Refresh()
  end)
  return row
end

local function showRow(row, shown)
  row.check:SetShown(shown)
  row.label:SetShown(shown)
  row.remove:SetShown(shown)
end

local function create()
  local f = frameFrom("Frame", "ChoreListFrame", UIParent, "BasicFrameTemplateWithInset")
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
  local p = ns.db.point
  if p then f:SetPoint(p[1], UIParent, p[2], p[3], p[4]) else f:SetPoint("CENTER") end
  f:Hide()
  table.insert(UISpecialFrames, "ChoreListFrame") -- Escape closes the window

  f.title = text(f, "GameFontHighlight", "CENTER")
  f.title:SetPoint("TOP", 0, -5)
  f.title:SetText(L["Chore List"])

  local scroll = frameFrom("ScrollFrame", nil, f, "UIPanelScrollFrameTemplate")
  scroll:SetPoint("TOPLEFT", 12, -32)
  scroll:SetPoint("BOTTOMRIGHT", -32, 34)
  local content = CreateFrame("Frame", nil, scroll)
  content:SetSize(WIDTH, 1)
  scroll:SetScrollChild(content)
  f.content = content

  f.headings = {}
  for _, kind in ipairs(ns.KINDS) do
    local h = { label = text(content, "GameFontNormal"), info = text(content, "GameFontDisableSmall", "RIGHT"), empty = text(content, "GameFontDisableSmall") }
    h.label:SetText(L[ns.KIND_LABEL[kind]])
    h.empty:SetText(L["Nothing on this list yet."])
    f.headings[kind] = h
  end
  f.rows = {}

  f.hint = text(f, "GameFontDisableSmall", "CENTER")
  f.hint:SetPoint("BOTTOM", 0, 14)
  f.hint:SetText(L["Add with /chores add daily or weekly, then the task."])

  f:SetScript("OnShow", function() ns.Refresh() end)
  return f
end

function ns.Refresh()
  if not ui or not ui:IsShown() or not ns.db then return end
  local content, y, n = ui.content, -2, 0
  for _, kind in ipairs(ns.KINDS) do
    local h, list = ui.headings[kind], ns.List(kind)
    h.label:SetPoint("TOPLEFT", content, "TOPLEFT", 4, y)
    h.info:SetPoint("TOPRIGHT", content, "TOPRIGHT", -4, y - 2)
    h.info:SetText(GREY .. ns.HeadingInfo(kind) .. "|r")
    y = y - HEAD
    h.empty:SetShown(#list == 0)
    if #list == 0 then
      h.empty:SetPoint("TOPLEFT", content, "TOPLEFT", 8, y - 2)
      y = y - ROW
    end
    for i, task in ipairs(list) do
      n = n + 1
      local row = ui.rows[n] or newRow(content)
      ui.rows[n] = row
      row.kind, row.index = kind, i
      row.check:SetPoint("TOPLEFT", content, "TOPLEFT", 0, y)
      row.check:SetChecked(task.done)
      row.label:SetPoint("TOPLEFT", content, "TOPLEFT", 26, y - 5)
      row.label:SetText(task.done and (GREY .. task.text .. "|r") or task.text)
      row.remove:SetPoint("TOPRIGHT", content, "TOPRIGHT", -2, y - 1)
      showRow(row, true)
      y = y - ROW
    end
    y = y - 10
  end
  for i = n + 1, #ui.rows do showRow(ui.rows[i], false) end
  content:SetHeight(-y)
end

function ns.Toggle()
  if not ns.db then return end
  ui = ui or create()
  if ui:IsShown() then ui:Hide() else ui:Show() end
end

function ns.Window()
  return ui
end
