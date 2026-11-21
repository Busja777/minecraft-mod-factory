local _, ns = ...
local L = ns.L

local GREY, BLUE, WHITE = "|cff9d9d9d", "|cff4da6ff", "|cffffffff"
local UNKNOWN = GREY .. "?|r"
local NOT_YET = GREY .. "\226\128\148|r" -- an em dash: played time not read yet

-- Columns of the window: field, x offset, width, alignment.
local COLUMNS = {
  { "name", 16, 130, "LEFT" },
  { "level", 150, 34, "RIGHT" },
  { "gold", 190, 130, "RIGHT" },
  { "zone", 334, 190, "LEFT" },
  { "rested", 528, 50, "RIGHT" },
  { "played", 582, 76, "RIGHT" },
  { "seen", 662, 40, "RIGHT" },
}
local HEADINGS = { name = "Character", level = "Level", gold = "Gold", zone = "Zone", rested = "Rested", played = "Played", seen = "Seen" }

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

local function line(parent, template, y)
  local cells = {}
  for _, col in ipairs(COLUMNS) do
    local fs = text(parent, template, col[4])
    fs:SetPoint("TOPLEFT", col[2], y)
    fs:SetWidth(col[3])
    fs:SetWordWrap(false)
    cells[col[1]] = fs
  end
  return cells
end

-- A frame from a Blizzard template, or a plain one when the template is missing.
local function frameFrom(kind, parent, template)
  local ok, f = pcall(CreateFrame, kind, nil, parent, template)
  if ok and f then return f end
  return CreateFrame(kind, nil, parent)
end

-- 1.2: a click on a heading sorts by that column, another click turns the order around.
function ns.SortBy(field)
  local s = ns.db and ns.db.settings
  if not s or not ns.ValidSort(field) then return end
  if s.sortBy == field then
    s.sortReverse = not s.sortReverse
  else
    s.sortBy, s.sortReverse = field, false
  end
  ns.Refresh()
end

local function headings(f)
  f.head, f.headButtons = {}, {}
  for _, col in ipairs(COLUMNS) do
    local field = col[1]
    local b = CreateFrame("Button", nil, f)
    b:SetPoint("TOPLEFT", col[2], -34)
    b:SetSize(col[3], 16)
    local fs = text(b, "GameFontNormal", col[4])
    fs:SetAllPoints(b)
    fs:SetWordWrap(false)
    b:SetScript("OnClick", function() ns.SortBy(field) end)
    b:SetScript("OnEnter", function(self)
      GameTooltip:SetOwner(self, "ANCHOR_TOP")
      GameTooltip:AddLine(L["Click to sort by this column, click again to reverse the order."], 1, 1, 1)
      GameTooltip:Show()
    end)
    b:SetScript("OnLeave", function() GameTooltip:Hide() end)
    f.head[field], f.headButtons[field] = fs, b
  end
end

-- The filter row under the total: this realm only, and the lowest level shown.
local function filters(f)
  local realm = frameFrom("CheckButton", f, "UICheckButtonTemplate")
  realm:SetPoint("TOPLEFT", 12, -338)
  realm:SetSize(24, 24)
  realm:SetScript("OnClick", function() ns.SetRealmOnly(not ns.db.settings.realmOnly) end)
  f.realmCheck = realm
  f.realmLabel = text(f, "GameFontHighlightSmall")
  f.realmLabel:SetPoint("TOPLEFT", 38, -344)
  f.realmLabel:SetText(L["This realm only"])

  f.levelLabel = text(f, "GameFontHighlightSmall")
  f.levelLabel:SetPoint("TOPLEFT", 190, -344)
  f.levelLabel:SetText(L["Hide below level"])
  local box = frameFrom("EditBox", f, "InputBoxTemplate")
  box:SetPoint("TOPLEFT", 300, -340)
  box:SetSize(36, 20)
  box:SetAutoFocus(false)
  box:SetNumeric(true)
  box:SetMaxLetters(3)
  -- An empty box or 0 shows every level; a number the filter cannot take puts the old one back.
  local function apply(self)
    local value = strtrim(self:GetText() or "")
    if value == "" or tonumber(value) == 0 then return ns.SetMinLevel(nil, true) end
    local level = ns.ParseLevel(value)
    if level then ns.SetMinLevel(level, true) else ns.Refresh() end
  end
  box:SetScript("OnEnterPressed", function(self) apply(self) self:ClearFocus() end)
  box:SetScript("OnEditFocusLost", apply)
  box:SetScript("OnEscapePressed", function(self)
    self:SetText(ns.db.settings.minLevel and tostring(ns.db.settings.minLevel) or "")
    self:ClearFocus()
  end)
  f.levelBox = box

  f.filterInfo = text(f, "GameFontDisableSmall", "RIGHT")
  f.filterInfo:SetPoint("TOPLEFT", 420, -344)
  f.filterInfo:SetWidth(282)
end

local function create()
  local ok, f = pcall(CreateFrame, "Frame", "AltAlmanacFrame", UIParent, "BasicFrameTemplateWithInset")
  if not ok then f = CreateFrame("Frame", "AltAlmanacFrame", UIParent) end
  f:SetSize(720, 372)
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
  table.insert(UISpecialFrames, "AltAlmanacFrame") -- Escape closes the window

  local title = text(f, "GameFontHighlight", "CENTER")
  title:SetPoint("TOP", 0, -5)
  title:SetText(L["Alt Almanac"])

  headings(f)

  f.rows = {}
  for i = 1, ns.MAX_ROWS do
    f.rows[i] = line(f, "GameFontHighlightSmall", -38 - i * 17)
  end

  f.totalLabel = text(f, "GameFontNormal")
  f.totalLabel:SetPoint("TOPLEFT", 16, -318)
  f.totalLabel:SetText(L["Total"])
  f.total = text(f, "GameFontHighlight", "RIGHT")
  f.total:SetPoint("TOPLEFT", 190, -318)
  f.total:SetWidth(130)
  f.totalPlayed = text(f, "GameFontHighlight", "RIGHT")
  f.totalPlayed:SetPoint("TOPLEFT", 582, -318)
  f.totalPlayed:SetWidth(76)

  filters(f)

  f:SetScript("OnShow", function() ns.Refresh() end)
  return f
end

-- The texts of one character row, by column.
function ns.RowTexts(row, currentRealm)
  local name = ns.ClassColored(row.name, row.class)
  if row.realm ~= "" and row.realm ~= currentRealm then name = name .. GREY .. "-" .. row.realm .. "|r" end
  local rested
  if row.maxLevel then
    rested = GREY .. "-|r"
  elseif row.rested then
    rested = string.format(L["%d%%"], math.floor(row.rested))
    if row.resting then rested = BLUE .. rested .. "|r" end
  else
    rested = UNKNOWN
  end
  return {
    name = name,
    level = row.level and tostring(row.level) or UNKNOWN,
    gold = row.money and ns.FormatMoney(row.money) or UNKNOWN,
    zone = row.place or UNKNOWN,
    rested = rested,
    played = ns.PlayedText(row.played) or NOT_YET,
    seen = row.current and L["now"] or ns.RelativeTime(row.ago),
  }
end

-- The heading of a column: the column you sort by is white, with "v" for highest first, "^" else.
function ns.HeadingText(field, sortBy, reverse)
  local label = L[HEADINGS[field]]
  if field ~= sortBy then return label end
  local desc = ns.SORT_DESC[field]
  if reverse then desc = not desc end
  return WHITE .. label .. (desc and " v" or " ^") .. "|r"
end

function ns.Refresh()
  if not ui or not ui:IsShown() or not ns.db then return end
  local s = ns.db.settings
  local realm = GetRealmName()
  local rows = ns.BuildRows(ns.db.chars, ns.CharKey(), time())
  ns.SortRows(rows, s.sortBy, s.sortReverse)
  local kept, hidden = ns.FilterRows(rows, s, realm)
  local total, played = ns.Totals(kept)
  local shown, more = ns.Visible(kept, #ui.rows)
  for _, col in ipairs(COLUMNS) do ui.head[col[1]]:SetText(ns.HeadingText(col[1], s.sortBy, s.sortReverse)) end
  for i, cells in ipairs(ui.rows) do
    local values
    if shown[i] then
      values = ns.RowTexts(shown[i], realm)
    elseif i == #shown + 1 and more > 0 then
      values = { name = GREY .. string.format(L["and %d more"], more) .. "|r" }
    else
      values = {}
    end
    for _, col in ipairs(COLUMNS) do cells[col[1]]:SetText(values[col[1]] or "") end
  end
  ui.total:SetText(ns.FormatMoney(total))
  ui.totalPlayed:SetText(ns.PlayedText(played) or NOT_YET)
  ui.realmCheck:SetChecked(s.realmOnly)
  if not (ui.levelBox.HasFocus and ui.levelBox:HasFocus()) then
    ui.levelBox:SetText(s.minLevel and tostring(s.minLevel) or "")
  end
  ui.filterInfo:SetText(hidden > 0 and string.format(L["%d hidden by the filter"], hidden) or "")
end

function ns.Toggle()
  if not ns.db then return end
  ui = ui or create()
  if ui:IsShown() then ui:Hide() else ui:Show() end
end

local function print(msg)
  DEFAULT_CHAT_FRAME:AddMessage("|cffffd100" .. L["Alt Almanac"] .. ":|r " .. msg)
end

function ns.SetRealmOnly(on)
  if not ns.db then return end
  ns.db.settings.realmOnly = on and true or false
  print(on and L["Showing the characters of this realm only."] or L["Showing the characters of all realms."])
  ns.Refresh()
end

-- level nil shows every level. quietIfSame: say nothing when nothing changes (the level box).
function ns.SetMinLevel(level, quietIfSame)
  if not ns.db then return end
  level = ns.ValidMinLevel(level)
  if level == 1 then level = nil end
  if quietIfSame and level == ns.db.settings.minLevel then
    ns.Refresh()
    return
  end
  ns.db.settings.minLevel = level
  if level then
    print(string.format(L["Hiding characters below level %d."], level))
  else
    print(L["Showing characters of every level."])
  end
  ns.Refresh()
end

local function forget(wanted)
  if not ns.db then return end
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
end

-- /aa level 70, /aa level off
local function levelCommand(value)
  if value == "off" or value == "0" or value == "1" then return ns.SetMinLevel(nil) end
  local level = ns.ParseLevel(value)
  if not level then
    return print(string.format(L["Use a whole number from 1 to %d, for example /aa level 70, or /aa level off."], ns.MIN_LEVEL_LIMIT))
  end
  ns.SetMinLevel(level)
end

SLASH_ALTALMANAC1 = "/altalmanac"
SLASH_ALTALMANAC2 = "/aa"
SlashCmdList.ALTALMANAC = function(msg)
  local cmd = strtrim(msg or "")
  local wanted = cmd:match("^[Ff][Oo][Rr][Gg][Ee][Tt]%s+(.+)$")
  local word, rest = cmd:match("^(%S+)%s*(.-)$")
  word, rest = (word or ""):lower(), (rest or ""):lower()
  if cmd == "" then
    ns.Toggle()
  elseif wanted then
    forget(wanted)
  elseif ns.db and word == "realm" and (rest == "this" or rest == "all") then
    ns.SetRealmOnly(rest == "this")
  elseif ns.db and word == "level" and rest ~= "" then
    levelCommand(rest)
  else
    print(L["/aa opens or closes the almanac, /aa forget Name-Realm removes a character."])
    print(L["Click a heading to sort. /aa realm this or /aa realm all filters by realm, /aa level 70 hides characters below level 70, /aa level off shows them again."])
  end
end
