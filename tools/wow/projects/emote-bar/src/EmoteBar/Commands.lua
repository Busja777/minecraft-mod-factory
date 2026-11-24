local _, ns = ...
local L = ns.L

-- /emotebar (alias /eb): shows or hides the bar; add, remove, list and lock manage it.
-- Emotes are typed as their chat command in the client's language, with or without the slash.

local function help()
  ns.Print(L["/emotebar shows or hides the bar, /emotebar add <emote> adds a button (for example /emotebar add wave), /emotebar remove <emote or number> removes one, /emotebar list lists them, /emotebar lock locks or unlocks the bar. Short form: /eb."])
end

local function add(rest)
  if rest == "" then
    ns.Print(L["Name the emote, for example /emotebar add wave."])
    return
  end
  local index = ns.Index()
  if index.count == 0 then
    ns.Print(L["The game's emote list could not be read, so no emote can be added right now."])
    return
  end
  local token = ns.Resolve(index, rest)
  if not token then
    ns.Print(string.format(L["%s is not an emote of the game. Use its chat command, for example /emotebar add wave."], rest))
    return
  end
  local result, at = ns.Add(ns.db.emotes, token)
  if result == "full" then
    ns.Print(string.format(L["The bar is full with %d emotes. Remove one first with /emotebar remove <emote or number>."], ns.MAX_BUTTONS))
    return
  end
  if result == "already" then
    ns.Print(string.format(L["%s is on the bar already, as button %d."], ns.Command(index, token), at))
    return
  end
  ns.Refresh()
  ns.Print(string.format(L["%s added as button %d."], ns.Command(index, token), at))
end

local function remove(rest)
  if rest == "" then
    ns.Print(L["Name the emote or its button number, for example /emotebar remove wave or /emotebar remove 2."])
    return
  end
  local index = ns.Index()
  local token, reason, detail = ns.Remove(ns.db.emotes, rest, index)
  if token then
    ns.Refresh()
    ns.Print(string.format(L["%s removed."], ns.Command(index, token)))
  elseif reason == "number" then
    ns.Print(string.format(L["There is no button %d. The bar has %d."], detail, #ns.db.emotes))
  elseif reason == "missing" then
    ns.Print(string.format(L["%s is not on the bar."], ns.Command(index, detail)))
  else
    ns.Print(string.format(L["%s is not an emote of the game."], rest))
  end
end

local function list()
  if #ns.db.emotes == 0 then
    ns.Print(L["The bar is empty. Add an emote with /emotebar add wave."])
    return
  end
  ns.Print(string.format(L["On the bar: %s."], ns.ListText(ns.db.emotes, ns.Index())))
end

SLASH_EMOTEBAR1 = "/emotebar"
SLASH_EMOTEBAR2 = "/eb"
SlashCmdList.EMOTEBAR = function(msg)
  if not ns.db then return end
  local cmd, rest = strtrim(msg or ""):match("^(%S*)%s*(.-)$")
  cmd = cmd:lower()
  if cmd == "" then
    ns.db.hidden = not ns.db.hidden
    ns.Refresh()
    ns.Print(ns.db.hidden and L["The bar is hidden. /emotebar shows it again."] or L["The bar is shown."])
  elseif cmd == "add" then
    add(rest)
  elseif cmd == "remove" then
    remove(rest)
  elseif cmd == "list" then
    list()
  elseif cmd == "lock" then
    ns.db.locked = not ns.db.locked
    ns.Print(ns.db.locked and L["The bar is locked."] or L["The bar can be dragged."])
  else
    help()
  end
end
