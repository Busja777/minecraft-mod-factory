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
local hiding = false -- true while the addon itself closes the window (not the player)

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
  f:SetScale(ns.db.settings.scale)
  f:SetFrameStrata("MEDIUM")
  f:SetClampedToScreen(true)
  f:SetMovable(true)
  f:EnableMouse(true)
  f:RegisterForDrag("LeftButton")
  f:SetScript("OnDragStart", function(self)
    if ns.db.settings.locked then return end -- 1.2: /lc lock
    self:StartMoving()
  end)
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
  -- The player closed it (close button, Escape): it stays closed at the next login. When only the
  -- whole interface is hidden (Alt+Z, a cinematic), the window itself still counts as shown.
  f:SetScript("OnHide", function(self)
    if not hiding and not self:IsShown() then ns.db.settings.shown = false end
  end)
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
  ns.db.settings.shown = ui:IsShown() and true or false
end

-- 1.2 ----------------------------------------------------------------------------------------------

-- The addon closes the window on its own; the player's choice to keep it open stays saved.
local function autoHide()
  if not (ui and ui:IsShown()) then return end
  hiding = true
  ui:Hide()
  hiding = false
end

-- At login the window opens again when the player left it open, unless it hides at maximum level.
function ns.WindowAtLogin()
  if ns.ShowAtLogin(ns.db.settings, ns.AtMaxLevel()) then
    ui = ui or create()
    ui:Show()
  end
end

function ns.ReachedMaxLevel()
  if ns.db and ns.db.settings.hideAtMax then autoHide() end
end

-- A new size; the window's anchor stays in the same place on the screen.
local function applyScale(new)
  local settings = ns.db.settings
  local old = settings.scale
  settings.scale = new
  if not ui then return end
  local point, _, relativePoint, x, y = ui:GetPoint()
  ui:SetScale(new)
  if point and type(x) == "number" and type(y) == "number" then
    x, y = ns.ScaledOffsets(x, y, old, new)
    ui:ClearAllPoints()
    ui:SetPoint(point, UIParent, relativePoint, x, y)
    savePosition(ui)
  end
end

local function print(msg)
  DEFAULT_CHAT_FRAME:AddMessage("|cffffd100" .. L["Level Clock"] .. ":|r " .. msg)
end

local function optionsText()
  local s = ns.db.settings
  return string.format(L["Window: %s, size %s, %s at maximum level."],
    s.locked and L["locked"] or L["movable"], ns.ScaleText(s.scale), s.hideAtMax and L["hidden"] or L["shown"])
end

local function scale(args)
  if args == "" then
    print(string.format(L["The window size is %s. /lc scale followed by a number from 0.8 to 1.5 changes it."], ns.ScaleText(ns.db.settings.scale)))
    return
  end
  local new = ns.ParseScale(args)
  if not new then
    print(L["Choose a size from 0.8 to 1.5, for example /lc scale 1.2."])
    return
  end
  applyScale(new)
  print(string.format(L["The window size is %s."], ns.ScaleText(new)))
end

local function help()
  print(L["/lc opens or closes the clock, /lc history lists your last sessions, /lc levels lists your last levels, /lc reset starts a new session."])
  print(L["/lc lock and /lc unlock fix the window in place, /lc scale 0.8 to 1.5 sets its size, /lc hidemax hides it at maximum level, /lc options shows these settings."])
end

SLASH_LEVELCLOCK1 = "/levelclock"
SLASH_LEVELCLOCK2 = "/lc"
SlashCmdList.LEVELCLOCK = function(msg)
  local cmd = strtrim(msg or ""):lower()
  local word, args = cmd:match("^(%S*)%s*(.-)$")
  if cmd == "" then
    ns.Toggle()
  elseif not ns.db then
    return
  elseif cmd == "reset" then
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
  elseif cmd == "levels" then
    if not ns.char then return end
    local levels = ns.char.levels
    if #levels == 0 then
      print(L["No level-ups noted yet. Level Clock notes every level from now on."])
      return
    end
    print(L["Your last levels on this character, newest first:"])
    for i = #levels, math.max(1, #levels - ns.LEVELS_SHOWN + 1), -1 do
      DEFAULT_CHAT_FRAME:AddMessage("  " .. ns.LevelText(levels, i))
    end
  elseif cmd == "lock" then
    ns.db.settings.locked = true
    print(L["The window is locked in place. /lc unlock lets you move it again."])
  elseif cmd == "unlock" then
    ns.db.settings.locked = false
    print(L["The window can be moved again: drag it with the left mouse button."])
  elseif word == "scale" then
    scale(args)
  elseif cmd == "hidemax" then
    local settings = ns.db.settings
    settings.hideAtMax = not settings.hideAtMax
    if settings.hideAtMax then
      print(L["The window now stays closed at maximum level. /lc still opens it."])
      if ns.AtMaxLevel() then autoHide() end
    else
      print(L["The window now also opens at maximum level."])
    end
  elseif cmd == "options" then
    print(optionsText())
  else
    help()
  end
end
