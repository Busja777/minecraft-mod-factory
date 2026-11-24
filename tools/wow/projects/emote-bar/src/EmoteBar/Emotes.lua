local _, ns = ...
local L = ns.L

-- The game side: reads the game's emote list, runs an emote and loads the saved settings at login.
--
-- Running an emote: C_ChatInfo.PerformEmote(token) is the Retail 12.x API (the chat box and the chat
-- menu's emote list call it). The old global DoEmote is only a deprecated wrapper around it that exists
-- while the "loadDeprecationFallbacks" setting is on, so it is used only when PerformEmote is missing.
-- Emotes are not protected: an addon may run them from a plain button, also in combat. The game may
-- still refuse one at times (chat lockdown in encounters, Mythic+ and rated PvP), so the call is guarded.

function ns.Print(msg)
  DEFAULT_CHAT_FRAME:AddMessage("|cffffd100" .. L["Emote Bar"] .. ":|r " .. msg)
end

-- The game's emote list, read once it has entries (the constants are there before any addon loads).
function ns.Index()
  if ns.index and ns.index.count > 0 then return ns.index end
  local max = ns.MIN_SCAN
  if type(MAXEMOTEINDEX) == "number" and MAXEMOTEINDEX > max then max = MAXEMOTEINDEX end
  ns.index = ns.BuildIndex(function(name) return _G[name] end, max)
  return ns.index
end

-- Runs one emote at your target (or at nobody without a target), like typing its command in chat.
-- Returns true when the game took the call.
function ns.Perform(token)
  if type(token) ~= "string" then return false end
  local api = C_ChatInfo and C_ChatInfo.PerformEmote
  if type(api) ~= "function" then api = DoEmote end
  if type(api) ~= "function" then return false end
  local ok = pcall(api, token)
  return ok
end

-- Button i of the bar was clicked.
function ns.Click(i)
  if not ns.db then return end
  local token = ns.db.emotes[i]
  if not token then return end
  if not ns.Perform(token) then
    ns.Print(string.format(L["The game did not run %s right now."], ns.Command(ns.Index(), token)))
  end
end

local function onLogin()
  if type(EmoteBarDB) ~= "table" then EmoteBarDB = {} end
  local db = EmoteBarDB
  db.version = 1
  db.emotes = ns.CleanList(db.emotes, ns.Index())
  db.locked = db.locked == true
  db.hidden = db.hidden == true
  if type(db.point) ~= "table" then db.point = nil end
  ns.db = db
  if ns.CreateBar then ns.CreateBar() end
  if ns.Refresh then ns.Refresh() end
end

local frame = CreateFrame("Frame")
ns.eventFrame = frame
frame:SetScript("OnEvent", function(_, event)
  if event == "PLAYER_LOGIN" then onLogin() end
end)
frame:RegisterEvent("PLAYER_LOGIN")
