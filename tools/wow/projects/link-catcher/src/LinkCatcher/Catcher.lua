local addonName, ns = ...
local L = ns.L

-- Chat events whose text players write themselves. System and combat messages are left alone.
ns.EVENTS = {
  "CHAT_MSG_SAY", "CHAT_MSG_YELL", "CHAT_MSG_EMOTE",
  "CHAT_MSG_WHISPER", "CHAT_MSG_WHISPER_INFORM",
  "CHAT_MSG_PARTY", "CHAT_MSG_PARTY_LEADER",
  "CHAT_MSG_RAID", "CHAT_MSG_RAID_LEADER", "CHAT_MSG_RAID_WARNING",
  "CHAT_MSG_INSTANCE_CHAT", "CHAT_MSG_INSTANCE_CHAT_LEADER",
  "CHAT_MSG_GUILD", "CHAT_MSG_OFFICER", "CHAT_MSG_CHANNEL",
  "CHAT_MSG_BN_WHISPER", "CHAT_MSG_BN_WHISPER_INFORM",
  "CHAT_MSG_COMMUNITIES_CHANNEL",
}

ns.store = ns.NewStore()

local PREFIX = "|c" .. ns.COLOR .. L["Link Catcher"] .. ":|r "
function ns.Print(text)
  DEFAULT_CHAT_FRAME:AddMessage(PREFIX .. text)
end

function ns.Enabled()
  return ns.db ~= nil and ns.db.enabled ~= false
end

-- Every chat window runs the filter for the same message; the last result is reused.
local lastIn, lastOut
function ns.Filter(_, _, msg, ...)
  if not ns.Enabled() then return false end
  -- In instances the text can be secret: it is never read or changed, only passed on.
  if ns.IsSecret(msg) or type(msg) ~= "string" then return false end
  if msg ~= lastIn then
    lastIn = msg
    lastOut = ns.Linkify(msg, ns.store)
  end
  if lastOut == msg then return false end
  return false, lastOut, ...
end

-- The chat filter moved into ChatFrameUtil in newer clients; the old global may still be there.
local function addFilter(event, fn)
  if ChatFrameUtil and ChatFrameUtil.AddMessageEventFilter then
    ChatFrameUtil.AddMessageEventFilter(event, fn)
    return true
  elseif ChatFrame_AddMessageEventFilter then
    ChatFrame_AddMessageEventFilter(event, fn)
    return true
  end
  return false
end

-- A click on one of our links. Both click paths below may report the same click; it opens once.
local lastLink, lastTime
function ns.OnClick(link, text)
  local id = ns.LinkId(link)
  if not id then return end
  local now = GetTime()
  if link == lastLink and now == lastTime then return end
  lastLink, lastTime = link, now
  local url = ns.store.urls[id] or ns.UrlFromText(text)
  if url then ns.ShowUrl(url) else ns.Print(L["This link is too old, it cannot be opened any more."]) end
end

local installed = false
function ns.Install()
  if installed then return end
  installed = true
  ns.filters = true
  for _, event in ipairs(ns.EVENTS) do
    if not addFilter(event, ns.Filter) then ns.filters = false end
  end
  -- Links of the type "addon" are reported through EventRegistry; SetItemRef is the older path.
  if EventRegistry and EventRegistry.RegisterCallback then
    EventRegistry:RegisterCallback("SetItemRef", function(...) ns.OnClick(ns.PickLink(...)) end, ns)
  end
  if SetItemRef and hooksecurefunc then
    hooksecurefunc("SetItemRef", function(...) ns.OnClick(ns.PickLink(...)) end)
  end
end

local HELP = L["/linkcatcher copy shows the last lines of your main chat window to copy (/linkcatcher copy 50 for 50 lines), /linkcatcher on and /linkcatcher off switch the clickable links on and off. Click a link in chat to copy it."]

function ns.Copy(arg)
  local lines, skipped = ns.CollectLines(DEFAULT_CHAT_FRAME, ns.LineCount(arg))
  if not lines then return ns.Print(L["The chat window cannot be read."]) end
  if #lines == 0 then return ns.Print(L["There is nothing to copy."]) end
  local hint = L["Press Ctrl+C (Cmd+C on a Mac) to copy, Escape to close."]
  if skipped > 0 then hint = string.format(L["%d hidden lines left out. "], skipped) .. hint end
  ns.ShowText(L["Copy chat"], table.concat(lines, "\n"), hint)
end

function ns.Command(input)
  local cmd, rest = strtrim(input or ""):match("^(%S*)%s*(.-)$")
  cmd = cmd:lower()
  if cmd == "copy" then
    ns.Copy(rest)
  elseif cmd == "on" or cmd == "off" then
    ns.db.enabled = cmd == "on"
    ns.Print(cmd == "on" and L["Web links in chat are clickable."] or L["Web links in chat stay plain text."])
  else
    ns.Print(HELP)
    if not ns.Enabled() then ns.Print(L["Clickable links are off right now."]) end
    if ns.filters == false then ns.Print(L["This game version does not let addons change chat lines, so links stay plain text."]) end
  end
end

SLASH_LINKCATCHER1 = "/linkcatcher"
SlashCmdList.LINKCATCHER = function(input) ns.Command(input) end

local events = CreateFrame("Frame")
events:RegisterEvent("ADDON_LOADED")
events:SetScript("OnEvent", function(self, _, name)
  if name ~= addonName then return end
  self:UnregisterEvent("ADDON_LOADED")
  if type(LinkCatcherDB) ~= "table" then LinkCatcherDB = {} end
  if LinkCatcherDB.enabled == nil then LinkCatcherDB.enabled = true end
  ns.db = LinkCatcherDB
  ns.Install()
end)
