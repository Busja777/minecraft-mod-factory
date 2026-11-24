local _, ns = ...
local L = ns.L

local GREEN, RED, GREY = "|cff40ff40", "|cffff6060", "|cff9d9d9d"

local ui

-- The four lines the window and the chat report show: { label, value } each.
function ns.Lines(view)
  if not view then
    return { { ns.GameText("FACTION", "Faction"), GREY .. L["No faction is watched. Pick one in the reputation panel."] .. "|r" } }
  end
  local gained = view.gained == 0 and (GREY .. "0|r") or ((view.gained > 0 and GREEN or RED) .. ns.Signed(view.gained) .. "|r")
  local perHour = view.perHour and ns.Signed(view.perHour)
    or (GREY .. string.format(L["after %d minutes"], ns.MIN_SECONDS / 60) .. "|r")
  local nextText
  if view.maxed then
    nextText = GREY .. L["max"] .. "|r"
  elseif view.eta then
    nextText = string.format(L["%s to go, about %s"], ns.FormatNumber(view.needed), ns.FormatDuration(view.eta))
  else
    nextText = string.format(L["%s to go"], ns.FormatNumber(view.needed))
  end
  return {
    { ns.GameText("FACTION", "Faction"), view.name .. " " .. GREY .. "(" .. view.standing .. ")|r" },
    { L["This session"], gained .. " " .. GREY .. string.format(L["in %s"], ns.FormatDuration(view.seconds)) .. "|r" },
    { L["Per hour"], perHour },
    { L["Next standing"], nextText },
  }
end

local function text(parent, template, justify)
  local fs = parent:CreateFontString(nil, "OVERLAY", template)
  fs:SetJustifyH(justify or "LEFT")
  return fs
end

local function create()
  local ok, f = pcall(CreateFrame, "Frame", "RepSessionFrame", UIParent, "BasicFrameTemplateWithInset")
  if not ok then f = CreateFrame("Frame", "RepSessionFrame", UIParent) end
  f:SetSize(320, 142)
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
  table.insert(UISpecialFrames, "RepSessionFrame") -- Escape closes the window

  local title = text(f, "GameFontHighlight", "CENTER")
  title:SetPoint("TOP", 0, -5)
  title:SetText(L["Rep Session"])

  f.lines = {}
  for i = 1, 4 do
    local y = -32 - (i - 1) * 18
    local left = text(f, "GameFontNormalSmall")
    left:SetPoint("TOPLEFT", 14, y)
    left:SetWidth(292) -- the whole line, so the hint without a watched faction wraps instead of running into the value
    left:SetWordWrap(true)
    local right = text(f, "GameFontHighlightSmall", "RIGHT")
    right:SetPoint("TOPRIGHT", -14, y)
    f.lines[i] = { left = left, right = right }
  end

  local reset = CreateFrame("Button", nil, f, "UIPanelButtonTemplate")
  reset:SetSize(80, 22)
  reset:SetPoint("BOTTOM", 0, 10)
  reset:SetText(ns.GameText("RESET", "Reset"))
  reset:SetScript("OnClick", function() ns.Reset() end)
  f.reset = reset

  local elapsed = 0
  f:SetScript("OnUpdate", function(_, dt) -- the rate keeps changing while the window is open
    elapsed = elapsed + dt
    if elapsed >= 5 then
      elapsed = 0
      ns.Refresh()
    end
  end)
  f:SetScript("OnShow", function() ns.Refresh() end)
  return f
end

function ns.Refresh()
  if not ui or not ui:IsShown() then return end
  local view = ns.Current()
  local lines = ns.Lines(view)
  -- Without a watched faction the hint is a sentence, not a value: it takes the whole first line
  -- (before, it stood right-aligned as the value and ran over the label "Faction").
  if not view then lines = { { lines[1][2], "" } } end
  for i, row in ipairs(ui.lines) do
    local line = lines[i]
    row.left:SetText(line and line[1] or "")
    row.right:SetText(line and line[2] or "")
  end
end

function ns.Toggle()
  if not ns.db then return end
  ui = ui or create()
  if ui:IsShown() then ui:Hide() else ui:Show() end
end

local function print(msg)
  DEFAULT_CHAT_FRAME:AddMessage("|cffffd100" .. L["Rep Session"] .. ":|r " .. msg)
end

function ns.Report()
  for _, line in ipairs(ns.Lines(ns.Current())) do
    print(line[1] .. ": " .. line[2])
  end
end

SLASH_REPSESSION1 = "/repsession"
SLASH_REPSESSION2 = "/rs"
SlashCmdList.REPSESSION = function(msg)
  local cmd = strtrim(msg or ""):lower()
  if cmd == "" then
    ns.Report()
  elseif cmd == "reset" then
    ns.Reset()
    print(L["Session started again."])
  elseif cmd == "show" then
    ns.Toggle()
  else
    print(L["/rs shows the watched faction in chat, /rs show opens the window, /rs reset starts a new session."])
  end
end
