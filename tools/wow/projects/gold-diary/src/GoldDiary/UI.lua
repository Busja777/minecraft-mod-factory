local _, ns = ...
local L = ns.L

local PERIODS = { "session", "today", "week", "history", "chars" }
local PERIOD_LABEL = { session = "Session", today = "Today", week = "7 days", history = "History", chars = "Characters" }
local MAX_ROWS = #ns.CATEGORIES
local GREEN, RED, GREY = "|cff40ff40", "|cffff6060", "|cff9d9d9d"

local ui
local period = "session"

function ns.BucketFor(which, now)
  if which == "session" then return ns.session.bucket end
  local days = ns.char and ns.char.days or {}
  return ns.LastDays(days, which == "today" and 1 or 7, now or time())
end

local function colored(color, copper)
  if copper == 0 then return GREY .. "-|r" end
  return color .. ns.FormatMoney(copper) .. "|r"
end

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
  local ok, f = pcall(CreateFrame, "Frame", "GoldDiaryFrame", UIParent, "BasicFrameTemplateWithInset")
  if not ok then f = CreateFrame("Frame", "GoldDiaryFrame", UIParent) end
  f:SetSize(420, 420)
  f:SetFrameStrata("DIALOG")
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
  table.insert(UISpecialFrames, "GoldDiaryFrame") -- Escape closes the window

  local title = text(f, "GameFontHighlight", "CENTER")
  title:SetPoint("TOP", 0, -5)
  title:SetText(L["Gold Diary"])

  f.tabs = {}
  for i, which in ipairs(PERIODS) do
    local b = CreateFrame("Button", nil, f, "UIPanelButtonTemplate")
    b:SetSize(76, 22)
    b:SetPoint("TOPLEFT", 14 + (i - 1) * 79, -30)
    b:SetText(L[PERIOD_LABEL[which]])
    b:SetScript("OnClick", function()
      period = which
      ns.Refresh()
    end)
    f.tabs[which] = b
  end

  f.head = text(f, "GameFontNormal")
  f.head:SetPoint("TOPLEFT", 18, -64)
  f.headIn = text(f, "GameFontNormal", "RIGHT")
  f.headIn:SetPoint("TOPRIGHT", -138, -64)
  f.headOut = text(f, "GameFontNormal", "RIGHT")
  f.headOut:SetPoint("TOPRIGHT", -18, -64)

  f.rows = {}
  for i = 1, MAX_ROWS do
    local y = -66 - i * 18
    local row = {
      label = text(f, "GameFontHighlightSmall"),
      inc = text(f, "GameFontHighlightSmall", "RIGHT"),
      out = text(f, "GameFontHighlightSmall", "RIGHT"),
    }
    row.label:SetPoint("TOPLEFT", 18, y)
    row.inc:SetPoint("TOPRIGHT", -138, y)
    row.out:SetPoint("TOPRIGHT", -18, y)
    f.rows[i] = row
  end

  f.empty = text(f, "GameFontDisableSmall", "CENTER")
  f.empty:SetPoint("TOP", 0, -100)
  f.empty:SetText(L["No gold has moved yet."])

  f.summary = {}
  for i = 1, 5 do
    local y = -322 - (i - 1) * 17
    local left = text(f, "GameFontNormalSmall")
    left:SetPoint("TOPLEFT", 18, y)
    local right = text(f, "GameFontHighlightSmall", "RIGHT")
    right:SetPoint("TOPRIGHT", -18, y)
    f.summary[i] = { left = left, right = right }
  end

  local elapsed = 0
  f:SetScript("OnUpdate", function(_, dt) -- gold per hour keeps changing while the window is open
    elapsed = elapsed + dt
    if elapsed >= 5 then
      elapsed = 0
      ns.Refresh()
    end
  end)
  f:SetScript("OnShow", function() ns.Refresh() end)
  return f
end

function ns.SummaryLines(which, bucket, now)
  local t = ns.Totals(bucket)
  local lines = {
    { L["Total earned"], colored(GREEN, t.income) },
    { L["Total spent"], colored(RED, t.expense) },
    { L["Net"], colored(t.net >= 0 and GREEN or RED, t.net) },
  }
  if t.moved ~= 0 then
    lines[#lines + 1] = { L["Moved to/from banks"], colored(GREY, t.moved) }
  end
  if which == "session" and ns.session.start then
    local perHour = ns.PerHour(t.net, (now or GetTime()) - ns.session.start)
    lines[#lines + 1] = { L["Net per hour"], perHour and colored(perHour >= 0 and GREEN or RED, perHour) or (GREY .. "...|r") }
  end
  return lines
end

local function setLines(lines)
  for i, s in ipairs(ui.summary) do
    local line = lines[i]
    s.left:SetText(line and line[1] or "")
    s.right:SetText(line and line[2] or "")
  end
end

local function showCharacters()
  ui.head:SetText(L["Character"])
  ui.headIn:SetText(L["Realm"])
  ui.headOut:SetText(L["Gold"])
  local list, total = ns.CharacterList(ns.db.chars)
  local shown = #list > MAX_ROWS and MAX_ROWS - 1 or #list
  for i, row in ipairs(ui.rows) do
    local c = i <= shown and list[i]
    if c then
      local name = ns.ClassColored(c.name, c.class)
      row.label:SetText(c.key == ns.CharKey() and (name .. " *") or name)
      row.inc:SetText(GREY .. c.realm .. "|r")
      row.out:SetText(ns.FormatMoney(c.money))
    elseif i == shown + 1 and #list > shown then
      row.label:SetText(GREY .. string.format(L["and %d more"], #list - shown) .. "|r")
      row.inc:SetText("")
      row.out:SetText("")
    else
      row.label:SetText("")
      row.inc:SetText("")
      row.out:SetText("")
    end
  end
  ui.empty:Hide()
  setLines({
    { L["All characters"], ns.FormatMoney(total) },
    { L["Characters"], tostring(#list) },
  })
end

local function showHistory()
  ui.head:SetText(L["Day"])
  ui.headIn:SetText(L["Earned"])
  ui.headOut:SetText(L["Spent"])
  local list, totals, best, active = ns.History(ns.char.days, MAX_ROWS, time())
  for i, row in ipairs(ui.rows) do
    local d = list[i]
    row.label:SetText(i == 1 and L["Today"] or date(L["%a, %b %d"], d.time))
    row.inc:SetText(colored(GREEN, d.income))
    row.out:SetText(colored(RED, d.expense))
  end
  ui.empty:Hide()
  setLines({
    { L["Net"], colored(totals.net >= 0 and GREEN or RED, totals.net) },
    { L["Average per active day"], active > 0 and colored(totals.net >= 0 and GREEN or RED, math.floor(totals.net / active)) or (GREY .. "-|r") },
    { L["Best day"], best and (date(L["%a, %b %d"], best.time) .. "  " .. colored(best.net >= 0 and GREEN or RED, best.net)) or (GREY .. "-|r") },
  })
end

function ns.Refresh()
  if not ui or not ui:IsShown() then return end
  for which, b in pairs(ui.tabs) do
    if which == period then b:Disable() else b:Enable() end
  end
  if period == "chars" then return showCharacters() end
  if period == "history" then return showHistory() end
  ui.head:SetText(L["Source"])
  ui.headIn:SetText(L["Earned"])
  ui.headOut:SetText(L["Spent"])
  local bucket = ns.BucketFor(period)
  local rows = ns.Rows(bucket)
  for i, row in ipairs(ui.rows) do
    local r = rows[i]
    row.label:SetText(r and r.label or "")
    row.inc:SetText(r and colored(GREEN, r.inc) or "")
    row.out:SetText(r and colored(RED, r.out) or "")
  end
  if #rows == 0 then ui.empty:Show() else ui.empty:Hide() end
  setLines(ns.SummaryLines(period, bucket))
end

function ns.Toggle()
  if not ns.db then return end
  ui = ui or create()
  if ui:IsShown() then ui:Hide() else ui:Show() end
end

-- Entry in the addon menu next to the minimap (the TOC names these functions).
function GoldDiary_OnAddonCompartmentClick()
  ns.Toggle()
end

function GoldDiary_OnAddonCompartmentEnter(_, button)
  if not ns.char then return end
  local t = ns.Totals(ns.BucketFor("today"))
  GameTooltip:SetOwner(button, "ANCHOR_LEFT")
  GameTooltip:AddLine(L["Gold Diary"])
  GameTooltip:AddDoubleLine(L["Today"], colored(t.net >= 0 and GREEN or RED, t.net), 1, 1, 1)
  GameTooltip:AddLine(L["Click to open the diary."], 0.6, 0.6, 0.6)
  GameTooltip:Show()
end

function GoldDiary_OnAddonCompartmentLeave()
  GameTooltip:Hide()
end

local function print(msg)
  DEFAULT_CHAT_FRAME:AddMessage("|cffffd100" .. L["Gold Diary"] .. ":|r " .. msg)
end

SLASH_GOLDDIARY1 = "/golddiary"
SLASH_GOLDDIARY2 = "/gd"
SlashCmdList.GOLDDIARY = function(msg)
  local cmd = strtrim(msg or ""):lower()
  if cmd == "" then
    ns.Toggle()
  elseif cmd == "reset" then
    ns.session.bucket = ns.NewBucket()
    ns.session.start = GetTime()
    print(L["Session started again."])
    ns.Refresh()
  elseif cmd == "report" then
    if not ns.char then return end
    local t = ns.Totals(ns.BucketFor("today"))
    print(string.format(L["Today: earned %s, spent %s, net %s."], ns.FormatMoney(t.income), ns.FormatMoney(t.expense), ns.FormatMoney(t.net)))
    print(string.format(L["This session: net %s."], ns.FormatMoney(ns.Totals(ns.session.bucket).net)))
  elseif cmd:match("^forget ") then
    local wanted = strtrim(msg):match("^%S+%s+(.+)$")
    local key
    for k in pairs(ns.db.chars) do
      if k:lower() == wanted:lower() then key = k end
    end
    if not key then
      print(string.format(L["No character called %s. Use Name-Realm."], wanted))
    elseif key == ns.CharKey() then
      print(L["You cannot forget the character you are playing."])
    else
      ns.db.chars[key] = nil
      print(string.format(L["%s forgotten."], key))
      ns.Refresh()
    end
  else
    print(L["/gd opens the diary, /gd report shows today in chat, /gd reset starts a new session, /gd forget Name-Realm removes a character."])
  end
end
