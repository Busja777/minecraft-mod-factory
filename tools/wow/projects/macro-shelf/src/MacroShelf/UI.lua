local _, ns = ...
local L = ns.L

-- One window: "Export" shows all macros as text, already selected for copying (read only);
-- "Import" is an empty box to paste such a text into, and "Create macros" creates them.
local ui

-- 1.1: wider window and buttons, room for the German texts ("Wiederherstellen", the hints).
local WIDTH, HEIGHT = 600, 420 -- 1.0: 520 x 420
local BUTTON = 120             -- 1.0: 90
local GAP = 4

local function button(parent, label, width, onClick)
  local b = CreateFrame("Button", nil, parent, "UIPanelButtonTemplate")
  b:SetSize(width, 22)
  b:SetText(label)
  b:SetScript("OnClick", onClick)
  return b
end

local function create()
  local ok, f = pcall(CreateFrame, "Frame", "MacroShelfFrame", UIParent, "BasicFrameTemplateWithInset")
  if not ok then f = CreateFrame("Frame", "MacroShelfFrame", UIParent) end
  f:SetSize(WIDTH, HEIGHT)
  f:SetPoint("CENTER")
  f:SetFrameStrata("DIALOG")
  f:SetClampedToScreen(true)
  f:SetMovable(true)
  f:EnableMouse(true)
  f:RegisterForDrag("LeftButton")
  f:SetScript("OnDragStart", f.StartMoving)
  f:SetScript("OnDragStop", f.StopMovingOrSizing)
  f:Hide()
  table.insert(UISpecialFrames, "MacroShelfFrame") -- Escape closes the window

  f.title = f:CreateFontString(nil, "OVERLAY", "GameFontHighlight")
  f.title:SetPoint("TOP", 0, -5)
  f.title:SetText(L["Macro Shelf"])

  f.exportButton = button(f, L["Export"], BUTTON, function() ns.ShowExport() end)
  f.exportButton:SetPoint("TOPLEFT", 14, -30)
  f.importButton = button(f, L["Import"], BUTTON, function() ns.ShowImport() end)
  f.importButton:SetPoint("TOPLEFT", 14 + (BUTTON + GAP), -30)
  f.backupButton = button(f, L["Back up"], BUTTON, function() ns.SetStatus(ns.Backup()) end)
  f.backupButton:SetPoint("TOPLEFT", 14 + 2 * (BUTTON + GAP), -30)
  f.restoreButton = button(f, L["Restore"], BUTTON, function() ns.SetStatus(ns.Restore()) end)
  f.restoreButton:SetPoint("TOPLEFT", 14 + 3 * (BUTTON + GAP), -30)

  f.hint = f:CreateFontString(nil, "OVERLAY", "GameFontNormalSmall")
  f.hint:SetPoint("TOPLEFT", 16, -58)
  f.hint:SetPoint("TOPRIGHT", -16, -58)
  f.hint:SetJustifyH("LEFT")

  local scroll = CreateFrame("ScrollFrame", nil, f, "UIPanelScrollFrameTemplate")
  scroll:SetPoint("TOPLEFT", 16, -76)
  scroll:SetPoint("BOTTOMRIGHT", -34, 84)
  f.scroll = scroll

  local box = CreateFrame("EditBox", nil, scroll)
  box:SetMultiLine(true)
  box:SetAutoFocus(false)
  box:SetMaxLetters(0)
  if ChatFontNormal then box:SetFontObject(ChatFontNormal) end
  box:SetWidth(WIDTH - 60) -- the scroll area is WIDTH - 50 wide
  box:SetScript("OnEscapePressed", function() f:Hide() end)
  box:SetScript("OnTextChanged", function(self, userInput)
    if userInput and f.mode == "export" then -- the export is read only: put it back and select it
      self:SetText(f.content or "")
      self:HighlightText()
    end
  end)
  scroll:SetScrollChild(box)
  f.box = box

  f.create = button(f, L["Create macros"], 150, function() ns.ImportFromBox() end)
  f.create:SetPoint("BOTTOMRIGHT", -16, 52)

  f.status = f:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
  f.status:SetPoint("BOTTOMLEFT", 16, 12)
  f.status:SetPoint("BOTTOMRIGHT", -16, 12)
  f.status:SetJustifyH("LEFT")

  f:SetScript("OnHide", function() box:ClearFocus() end)
  return f
end

local function open(mode)
  if not ns.db then return end
  ui = ui or create()
  ui.mode = mode
  ui:Show()
  ui.exportButton:SetEnabled(mode ~= "export")
  ui.importButton:SetEnabled(mode ~= "import")
  ui.create:SetShown(mode == "import")
  ui.status:SetText(ns.BackupStatus())
end

function ns.ShowExport()
  local list = ns.CurrentList()
  local text = ns.ExportText(list)
  open("export")
  ui.content = text
  ui.box:SetText(text)
  ui.hint:SetText(#list > 0 and L["Press Ctrl+C (Cmd+C on a Mac) to copy, then paste it into Import on another character."]
    or L["You have no macros to export yet."])
  ui.box:SetFocus()
  ui.box:SetCursorPosition(0)
  ui.box:HighlightText()
end

function ns.ShowImport()
  open("import")
  ui.content = nil
  ui.box:SetText("")
  ui.hint:SetText(L["Paste an export here and press Create macros. Existing macros are never changed."])
  ui.box:SetFocus()
end

-- Shows report lines in the window (when open) and in chat.
function ns.SetStatus(lines)
  for _, line in ipairs(lines) do ns.Print(line) end
  if ui and ui:IsShown() then ui.status:SetText(table.concat(lines, " ")) end
end

function ns.ImportFromBox()
  if not ui then return end
  ns.SetStatus((ns.Import(ui.box:GetText()))) -- the text stays, so a second press only reports "already there"
end

function ns.Window() return ui end
