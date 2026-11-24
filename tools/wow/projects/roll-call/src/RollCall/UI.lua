local _, ns = ...
local L = ns.L

local GREY, ORANGE, YELLOW, RED = "|cff9d9d9d", "|cffff9933", "|cffffd100", "|cffff6060"
ns.MAX_ROWS = 10

local ui

local function text(parent, template, justify)
  local fs = parent:CreateFontString(nil, "OVERLAY", template)
  fs:SetJustifyH(justify or "LEFT")
  return fs
end

-- The line under the title: time left while collecting, the result afterwards.
function ns.StatusText(round, now)
  if not round then return GREY .. L["No roll call yet."] .. "|r" end
  if round.open then
    return string.format(L["Collecting rolls: %d seconds left"], math.ceil(ns.Remaining(round, now)))
  end
  return ns.ResultText(round)
end

-- The rows the window shows: { rank, name, roll, range, mark } as display texts, at most MAX_ROWS;
-- the last one says how many more there are when the list is longer.
function ns.WindowRows(round)
  local rows = ns.Standings(round)
  local out = {}
  local shown = #rows > ns.MAX_ROWS and ns.MAX_ROWS - 1 or #rows
  for i = 1, shown do
    local r = rows[i]
    out[i] = {
      rank = r.rank .. ".",
      name = r.name,
      roll = tostring(r.roll),
      range = (r.odd and ORANGE or GREY) .. ns.RangeText(r) .. "|r",
      mark = r.tie and (YELLOW .. L["tie"] .. "|r") or "",
    }
  end
  if #rows > shown then
    out[shown + 1] = { rank = "", name = GREY .. string.format(L["and %d more"], #rows - shown) .. "|r", roll = "", range = "", mark = "" }
  end
  return out
end

-- Notes at the bottom of the window.
function ns.Notes(round)
  local notes = {}
  if not round then return notes end
  if round.unreadable > 0 then notes[#notes + 1] = RED .. L["Some lines could not be read here, rolls may be missing."] .. "|r" end
  for _, r in ipairs(ns.Standings(round)) do
    if r.odd then
      notes[#notes + 1] = ORANGE .. L["Orange ranges are not 1-100."] .. "|r"
      break
    end
  end
  if round.repeats > 0 then notes[#notes + 1] = GREY .. string.format(L["Only the first roll counts: %d more ignored."], round.repeats) .. "|r" end
  if #round.rolls == 0 and round.open then notes[#notes + 1] = GREY .. L["Waiting for /roll ..."] .. "|r" end
  return notes
end

local function create()
  local ok, f = pcall(CreateFrame, "Frame", "RollCallFrame", UIParent, "BasicFrameTemplateWithInset")
  if not ok then f = CreateFrame("Frame", "RollCallFrame", UIParent) end
  f:SetSize(280, 330)
  f:SetFrameStrata("DIALOG")
  f:SetClampedToScreen(true)
  f:SetMovable(true)
  f:EnableMouse(true)
  f:RegisterForDrag("LeftButton")
  f:SetScript("OnDragStart", f.StartMoving)
  f:SetScript("OnDragStop", function(self)
    self:StopMovingOrSizing()
    local point, _, relativePoint, x, y = self:GetPoint()
    ns.db.point = { point, relativePoint, x, y }
  end)
  local p = ns.db.point
  if type(p) == "table" and p[1] then f:SetPoint(p[1], UIParent, p[2], p[3], p[4]) else f:SetPoint("CENTER") end
  f:Hide()
  table.insert(UISpecialFrames, "RollCallFrame") -- Escape closes the window

  local title = text(f, "GameFontHighlight", "CENTER")
  title:SetPoint("TOP", 0, -5)
  title:SetText(L["Roll Call"])

  f.status = text(f, "GameFontNormal")
  f.status:SetPoint("TOPLEFT", 14, -32)
  f.status:SetPoint("TOPRIGHT", -14, -32)

  f.rows = {}
  for i = 1, ns.MAX_ROWS do
    local y = -54 - (i - 1) * 17
    local row = {
      rank = text(f, "GameFontNormalSmall", "RIGHT"),
      name = text(f, "GameFontHighlightSmall"),
      roll = text(f, "GameFontHighlight", "RIGHT"),
      range = text(f, "GameFontHighlightSmall", "RIGHT"),
      mark = text(f, "GameFontHighlightSmall"),
    }
    row.rank:SetPoint("TOPRIGHT", f, "TOPLEFT", 36, y)
    row.name:SetPoint("TOPLEFT", 42, y)
    row.roll:SetPoint("TOPRIGHT", -112, y)
    row.range:SetPoint("TOPRIGHT", -50, y)
    row.mark:SetPoint("TOPLEFT", f, "TOPRIGHT", -44, y)
    f.rows[i] = row
  end

  f.notes = {}
  for i = 1, 4 do
    local note = text(f, "GameFontHighlightSmall")
    note:SetPoint("TOPLEFT", 14, -230 - (i - 1) * 15)
    note:SetPoint("TOPRIGHT", -14, -230 - (i - 1) * 15)
    f.notes[i] = note
  end

  local button = CreateFrame("Button", nil, f, "UIPanelButtonTemplate")
  button:SetSize(100, 22)
  button:SetPoint("BOTTOM", 0, 10)
  button:SetScript("OnClick", function()
    if ns.Running() then ns.Finish() else ns.Start(ns.DEFAULT_SECONDS) end
  end)
  f.button = button

  f:SetScript("OnShow", function() ns.Refresh() end)
  return f
end

function ns.Refresh()
  if not ui or not ui:IsShown() then return end
  local round = ns.round
  ui.status:SetText(ns.StatusText(round, GetTime()))
  local rows = ns.WindowRows(round)
  for i, row in ipairs(ui.rows) do
    local r = rows[i]
    row.rank:SetText(r and r.rank or "")
    row.name:SetText(r and r.name or "")
    row.roll:SetText(r and r.roll or "")
    row.range:SetText(r and r.range or "")
    row.mark:SetText(r and r.mark or "")
  end
  local notes = ns.Notes(round)
  for i, note in ipairs(ui.notes) do note:SetText(notes[i] or "") end
  ui.button:SetText(ns.Running() and L["Stop"] or string.format(L["Start (%d s)"], ns.DEFAULT_SECONDS))
end

function ns.ShowWindow()
  if not ns.db then return end
  ui = ui or create()
  ui:Show()
  ns.Refresh()
end

local function help()
  ns.Print(L["/rollcall start 30 collects rolls for 30 seconds (5 to 120), /rollcall stop ends it early, /rollcall shows the last result."])
end

SLASH_ROLLCALL1 = "/rollcall"
SLASH_ROLLCALL2 = "/rolls"
SlashCmdList.ROLLCALL = function(msg)
  if not ns.db then return end
  local input = strtrim(msg or ""):lower()
  local cmd, rest = input:match("^(%S*)%s*(.-)$")
  if cmd == "" then
    ns.ShowWindow()
    if ns.Running() then
      ns.Print(ns.StatusText(ns.round, GetTime()))
    else
      ns.Report()
    end
  elseif cmd == "start" then
    local seconds, changed = ns.Seconds(rest)
    if not seconds then
      help()
    elseif ns.Running() then
      ns.Print(L["A roll call is already running. /rollcall stop ends it."])
      ns.ShowWindow()
    else
      ns.Start(seconds)
      if changed then
        ns.Print(string.format(L["Roll call started for %d seconds (between 5 and 120). Everyone can /roll now."], seconds))
      else
        ns.Print(string.format(L["Roll call started for %d seconds. Everyone can /roll now."], seconds))
      end
    end
  elseif cmd == "stop" then
    if not ns.Finish() then ns.Print(L["No roll call is running."]) end
  else
    help()
  end
end
