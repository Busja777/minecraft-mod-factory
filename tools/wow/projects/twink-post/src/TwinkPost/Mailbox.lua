local _, ns = ...
local L = ns.L

-- A small button right of the recipient box on the Send Mail tab (SendMailFrame,
-- SendMailNameEditBox from Blizzard_MailFrame). It opens a menu of your own characters; a click on
-- one writes its name into the recipient box. Nothing is ever sent by the addon.

local button

-- Writes the recipient into the box and moves on to the subject, as Enter in the box does.
function ns.Fill(entry)
  local box = SendMailNameEditBox
  if type(entry) ~= "table" or type(entry.recipient) ~= "string" then return false end
  if not box or type(box.SetText) ~= "function" then return false end
  box:SetText(entry.recipient)
  local subject = SendMailSubjectEditBox
  if subject and type(subject.SetFocus) == "function" then pcall(subject.SetFocus, subject) end
  return true
end

-- The menu: a title, then one line per character; a hint when there is none yet.
function ns.BuildMenu(_, root)
  local me = ns.Me()
  root:CreateTitle(L["Twink Post"])
  local list = ns.CurrentCandidates()
  if #list == 0 then
    local hint = root:CreateButton(L["No other character known here yet. Log in once with each of your characters."])
    if hint and hint.SetEnabled then hint:SetEnabled(false) end
    return
  end
  for _, entry in ipairs(list) do
    root:CreateButton(ns.Label(entry, me.realmKey, me.faction), function() ns.Fill(entry) end)
  end
end

-- Without the game's menu system the characters are listed in chat instead.
function ns.OpenMenu(owner)
  if MenuUtil and MenuUtil.CreateContextMenu then
    local ok = pcall(MenuUtil.CreateContextMenu, owner, ns.BuildMenu)
    if ok then return true end
  end
  if ns.PrintCandidates then ns.PrintCandidates() end
  return false
end

local function onEnter(self)
  if not GameTooltip then return end
  GameTooltip:SetOwner(self, "ANCHOR_RIGHT")
  GameTooltip:AddLine(L["Twink Post"])
  GameTooltip:AddLine(L["Click to pick one of your characters as the recipient."], 1, 1, 1)
  GameTooltip:Show()
end

local function onLeave()
  if GameTooltip then GameTooltip:Hide() end
end

-- Creates the button once the mail frame exists (it is part of the game's own mail addon).
function ns.AttachButton()
  if button then return button end
  local box, parent = SendMailNameEditBox, SendMailFrame
  if not box or not parent then return nil end
  local ok, b = pcall(CreateFrame, "Button", nil, parent)
  if not ok or not b then return nil end
  b:SetSize(22, 22)
  b:SetPoint("LEFT", box, "RIGHT", 2, 0)
  b:SetNormalTexture("Interface\\ChatFrame\\UI-ChatIcon-ScrollDown-Up")
  b:SetPushedTexture("Interface\\ChatFrame\\UI-ChatIcon-ScrollDown-Down")
  b:SetHighlightTexture("Interface\\Buttons\\UI-Common-MouseHilight", "ADD")
  b:SetScript("OnClick", function(self) ns.OpenMenu(self) end)
  b:SetScript("OnEnter", onEnter)
  b:SetScript("OnLeave", onLeave)
  button = b
  ns.button = b
  return b
end
