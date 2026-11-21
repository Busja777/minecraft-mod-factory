local _, ns = ...
local L = ns.L

local GREY = "|cff9d9d9d"
local WAITING = GREY .. "...|r"
local LINES = 6
local REFRESH = 1 -- seconds between two refreshes while the window is open
local CLOCK_SIZE = { 230, 172 }
local HISTORY_SIZE = { 350, 250 }
-- History columns: field, header, justify, x offset (from the left for LEFT, from the right for RIGHT).
local COLUMNS = {
  { "when", L["Started"], "LEFT", 16 },
  { "duration", L["Time"], "RIGHT", -205 },
  { "xp", L["XP"], "RIGHT", -135 },
  { "perHour", L["XP/hour"], "RIGHT", -62 },
  { "levels", L["Levels"], "RIGHT", -16 },
}

local ui
local view = "clock" -- or "history"

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
  local ok, f = pcall(CreateFrame, "Frame", "LevelClockFrame", UIParent, "BasicFrameTemplateWithInset")
  if not ok then f = CreateFrame("Frame", "LevelClockFrame", UIParent) end
  f:SetSize(CLOCK_SIZE[1], CLOCK_SIZE[2])
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
  local p = ns.db.settings.point
  if p then f:SetPoint(p[1], UIParent, p[2], p[3], p[4]) else f:SetPoint("CENTER") end
  f:Hide()
  table.insert(UISpecialFrames, "LevelClockFrame") -- Escape closes the window

  f.title = text(f, "GameFontHighlight", "CENTER")
  f.title:SetPoint("TOP", 0, -5)
  f.title:SetText(L["Level Clock"])

  f.lines = {}
  for i = 1, LINES do
    local y = -32 - (i - 1) * 17
    local left = text(f, "GameFontNormalSmall")
    left:SetPoint("TOPLEFT", 16, y)
    local right = text(f, "GameFontHighlightSmall", "RIGHT")
    right:SetPoint("TOPRIGHT", -16, y)
    f.lines[i] = { left = left, right = right }
  end

  f.note = text(f, "GameFontHighlight", "CENTER")
  f.note:SetPoint("CENTER", 0, -10)
  f.note:SetText(L["You have reached the maximum level."])
  f.note:Hide()

  -- The history view: a header and one row per finished session.
  f.history = { head = {}, rows = {} }
  for c, col in ipairs(COLUMNS) do
    local fs = text(f, "GameFontNormalSmall", col[3])
    fs:SetPoint(col[3] == "LEFT" and "TOPLEFT" or "TOPRIGHT", col[4], -32)
    fs:SetText(col[2])
    f.history.head[c] = fs
  end
  for i = 1, ns.HISTORY do
    local row = {}
    for c, col in ipairs(COLUMNS) do
      local fs = text(f, "GameFontHighlightSmall", col[3])
      fs:SetPoint(col[3] == "LEFT" and "TOPLEFT" or "TOPRIGHT", col[4], -34 - i * 16)
      row[c] = fs
    end
    f.history.rows[i] = row
  end
  f.empty = text(f, "GameFontDisableSmall", "CENTER")
  f.empty:SetPoint("TOP", 0, -60)
  f.empty:SetText(L["No finished sessions with XP yet."])

  f.switch = CreateFrame("Button", nil, f, "UIPanelButtonTemplate")
  f.switch:SetSize(100, 22)
  f.switch:SetPoint("BOTTOM", 0, 10)
  f.switch:SetScript("OnClick", function()
    view = view == "clock" and "history" or "clock"
    ns.Refresh()
  end)

  local elapsed = 0
  f:SetScript("OnUpdate", function(_, dt) -- the rate and the time to level keep changing while the window is open
    elapsed = elapsed + dt
    if elapsed >= REFRESH then
      elapsed = 0
      ns.Refresh()
    end
  end)
  f:SetScript("OnShow", function() ns.Refresh() end)
  return f
end

-- The rows of the window as { label, value }.
function ns.WindowLines(now)
  local v = ns.View(ns.session, now or GetTime())
  return {
    { L["XP per hour"], v.perHour and ns.FormatNumber(v.perHour) or WAITING },
    { L["Time to level"], v.timeToLevel and ns.FormatDuration(v.timeToLevel) or WAITING },
    { L["XP to level"], v.needed and ns.FormatNumber(v.needed) or WAITING },
    { L["Rested"], v.rested and string.format(L["%d%%"], v.rested) or WAITING },
    { L["Session XP"], ns.FormatNumber(v.gained) },
    { L["Session time"], ns.FormatDuration(v.seconds) },
  }
end

local function setShown(list, shown)
  for _, w in ipairs(list) do
    if shown then w:Show() else w:Hide() end
  end
end

local function showClock()
  ui:SetSize(CLOCK_SIZE[1], CLOCK_SIZE[2])
  ui.title:SetText(L["Level Clock"])
  ui.switch:SetText(L["History"])
  local lines = not ns.AtMaxLevel() and ns.WindowLines() or {}
  for i, line in ipairs(ui.lines) do
    line.left:SetText(lines[i] and lines[i][1] or "")
    line.right:SetText(lines[i] and lines[i][2] or "")
  end
  if #lines == 0 then ui.note:Show() else ui.note:Hide() end
end

local function showHistory()
  ui:SetSize(HISTORY_SIZE[1], HISTORY_SIZE[2])
  ui.title:SetText(L["Session history"])
  ui.switch:SetText(L["Back"])
  ui.note:Hide()
  local history = ns.char and ns.char.history or {}
  for i, row in ipairs(ui.history.rows) do
    local r = history[i] and ns.HistoryRow(history[i])
    for c, col in ipairs(COLUMNS) do
      row[c]:SetText(r and r[col[1]] or "")
    end
  end
  setShown(ui.history.head, #history > 0)
  if #history == 0 then ui.empty:Show() else ui.empty:Hide() end
end

function ns.Refresh()
  if not ui or not ui:IsShown() then return end
  local clock = view == "clock"
  for _, line in ipairs(ui.lines) do
    setShown({ line.left, line.right }, clock)
  end
  for _, row in ipairs(ui.history.rows) do setShown(row, not clock) end
  if clock then
    setShown(ui.history.head, false)
    ui.empty:Hide()
    return showClock()
  end
  return showHistory()
end

function ns.Toggle()
  if not ns.db then return end
  ui = ui or create()
  if ui:IsShown() then ui:Hide() else ui:Show() end
end

local function print(msg)
  DEFAULT_CHAT_FRAME:AddMessage("|cffffd100" .. L["Level Clock"] .. ":|r " .. msg)
end

SLASH_LEVELCLOCK1 = "/levelclock"
SLASH_LEVELCLOCK2 = "/lc"
SlashCmdList.LEVELCLOCK = function(msg)
  local cmd = strtrim(msg or ""):lower()
  if cmd == "" then
    ns.Toggle()
  elseif cmd == "reset" then
    if not ns.db then return end
    ns.Reset()
    print(L["New session started."])
  elseif cmd == "history" then
    if not ns.char then return end
    local history = ns.char.history
    if #history == 0 then
      print(L["No finished sessions with XP yet."])
      return
    end
    print(L["Your last sessions with XP, newest first:"])
    for _, e in ipairs(history) do DEFAULT_CHAT_FRAME:AddMessage("  " .. ns.HistoryText(e)) end
  else
    print(L["/lc opens or closes the clock, /lc history lists your last sessions, /lc reset starts a new session."])
  end
end
