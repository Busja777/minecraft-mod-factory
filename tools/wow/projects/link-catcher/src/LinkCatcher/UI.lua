local _, ns = ...
local L = ns.L

-- One small window with a text box: it shows a web address or chat text, already selected,
-- so Ctrl+C copies it. Typing into the box does not change the text.
local ui

local function create()
  local ok, f = pcall(CreateFrame, "Frame", "LinkCatcherFrame", UIParent, "BasicFrameTemplateWithInset")
  if not ok then f = CreateFrame("Frame", "LinkCatcherFrame", UIParent) end
  f:SetSize(480, 280)
  f:SetPoint("CENTER")
  f:SetFrameStrata("DIALOG")
  f:SetClampedToScreen(true)
  f:SetMovable(true)
  f:EnableMouse(true)
  f:RegisterForDrag("LeftButton")
  f:SetScript("OnDragStart", f.StartMoving)
  f:SetScript("OnDragStop", f.StopMovingOrSizing)
  f:Hide()
  table.insert(UISpecialFrames, "LinkCatcherFrame") -- Escape closes the window

  f.title = f:CreateFontString(nil, "OVERLAY", "GameFontHighlight")
  f.title:SetPoint("TOP", 0, -5)

  f.hint = f:CreateFontString(nil, "OVERLAY", "GameFontNormalSmall")
  f.hint:SetPoint("BOTTOM", 0, 12)

  local scroll = CreateFrame("ScrollFrame", nil, f, "UIPanelScrollFrameTemplate")
  scroll:SetPoint("TOPLEFT", 16, -34)
  scroll:SetPoint("BOTTOMRIGHT", -34, 34)
  f.scroll = scroll

  local box = CreateFrame("EditBox", nil, scroll)
  box:SetMultiLine(true)
  box:SetAutoFocus(false)
  box:SetMaxLetters(0)
  if ChatFontNormal then box:SetFontObject(ChatFontNormal) end
  box:SetWidth(420)
  box:SetScript("OnEscapePressed", function() f:Hide() end)
  box:SetScript("OnTextChanged", function(self, userInput)
    if userInput then -- read only: put the text back and select it again
      self:SetText(f.content or "")
      self:HighlightText()
    end
  end)
  scroll:SetScrollChild(box)
  f.box = box

  f:SetScript("OnHide", function() box:ClearFocus() end)
  return f
end

-- Opens the window with text selected. hint says what to do with it.
function ns.ShowText(title, text, hint)
  ui = ui or create()
  ui.content = text
  ui.title:SetText(title)
  ui.hint:SetText(hint or "")
  ui.box:SetText(text)
  ui:Show()
  ui.box:SetFocus()
  ui.box:SetCursorPosition(0)
  ui.box:HighlightText()
end

function ns.Window() return ui end

function ns.ShowUrl(url)
  ns.ShowText(L["Link Catcher"], url, L["Press Ctrl+C (Cmd+C on a Mac) to copy, Escape to close."])
end
