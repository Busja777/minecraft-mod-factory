local _, ns = ...
local L = ns.L

local GREY, BLUE = "|cff9d9d9d", "|cff4da6ff"
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

local function create()
  local ok, f = pcall(CreateFrame, "Frame", "AltAlmanacFrame", UIParent, "BasicFrameTemplateWithInset")
  if not ok then f = CreateFrame("Frame", "AltAlmanacFrame", UIParent) end
  f:SetSize(720, 346)
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

  f.head = line(f, "GameFontNormal", -34)
  for field, label in pairs(HEADINGS) do f.head[field]:SetText(L[label]) end

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

function ns.Refresh()
  if not ui or not ui:IsShown() or not ns.db then return end
  local rows, total, played = ns.BuildRows(ns.db.chars, ns.CharKey(), time())
  local shown, more = ns.Visible(rows, #ui.rows)
  local realm = GetRealmName()
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
end

function ns.Toggle()
  if not ns.db then return end
  ui = ui or create()
  if ui:IsShown() then ui:Hide() else ui:Show() end
end

local function print(msg)
  DEFAULT_CHAT_FRAME:AddMessage("|cffffd100" .. L["Alt Almanac"] .. ":|r " .. msg)
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

SLASH_ALTALMANAC1 = "/altalmanac"
SLASH_ALTALMANAC2 = "/aa"
SlashCmdList.ALTALMANAC = function(msg)
  local cmd = strtrim(msg or "")
  local wanted = cmd:match("^[Ff][Oo][Rr][Gg][Ee][Tt]%s+(.+)$")
  if cmd == "" then
    ns.Toggle()
  elseif wanted then
    forget(wanted)
  else
    print(L["/aa opens or closes the almanac, /aa forget Name-Realm removes a character."])
  end
end
