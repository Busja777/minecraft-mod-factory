local _, ns = ...
local L = ns.L

-- /qa and /questautopilot: show the state, switch everything or one half, keep quests manual.

local function help()
  ns.Say(L["/qa shows the state, /qa on and /qa off switch everything, /qa accept and /qa turnin switch one half. Hold Shift while talking to pause."])
  ns.Say(L["/qa manual keeps the quest you just saw manual, /qa manual <ID, name or quest link> adds one, /qa auto <ID or name> hands it back, /qa list shows them."])
  ns.Say(L["/qa dailies leaves all daily and weekly quests to you, type it again to undo."])
end

local function title(id)
  local log = C_QuestLog
  if not (log and log.GetTitleForQuestID) then return nil end
  local name = log.GetTitleForQuestID(id)
  if ns.IsSecret(name) or type(name) ~= "string" or name == "" then return nil end
  return name
end

-- /qa manual [quest]: without a quest, the one of the open quest window or the last one seen.
local function addManual(rest)
  local id, name
  if rest == "" then
    local quest = ns.lastQuest
    if not quest then
      ns.Say(L["No quest seen yet. Open one while holding Shift and type /qa manual, or use /qa manual <ID or name>."])
      return
    end
    id, name = quest.id, quest.title
  else
    id, name = ns.ParseQuest(rest)
    if id and not name then name = title(id) end
  end
  local label, isNew = ns.AddManual(ns.manual, id, name)
  if not label then return help() end
  if isNew then
    ns.Say(string.format(L["%s stays manual from now on."], label))
  else
    ns.Say(string.format(L["%s is already kept manual."], label))
  end
end

-- /qa auto <quest>
local function removeManual(rest)
  local id, name = ns.ParseQuest(rest)
  if not id and not name then return help() end
  local label = ns.RemoveManual(ns.manual, id, name)
  if label then
    ns.Say(string.format(L["%s is handled by the autopilot again."], label))
  else
    ns.Say(string.format(L["%s is not on your list. /qa list shows it."], ns.QuestLabel(id, name)))
  end
end

local function list()
  local labels = ns.ManualLabels(ns.manual)
  if #labels == 0 then
    ns.Say(L["You keep no quests manual. /qa manual adds the quest you just saw."])
    return
  end
  ns.Say(string.format(L["Quests you keep manual: %d"], #labels))
  for _, label in ipairs(labels) do ns.Say("  " .. label) end
end

SLASH_QUESTAUTOPILOT1 = "/questautopilot"
SLASH_QUESTAUTOPILOT2 = "/qa"
SlashCmdList.QUESTAUTOPILOT = function(msg)
  if not ns.settings then return end
  msg = strtrim(msg or "")
  local word, rest = msg:match("^(%S+)%s*(.-)$")
  word, rest = (word or ""):lower(), rest or ""
  if word == "manual" then
    addManual(rest)
  elseif word == "auto" then
    removeManual(rest)
  elseif word == "list" and rest == "" then
    list()
  elseif word == "" or (rest == "" and ns.Apply(ns.settings, word)) then
    ns.Say(ns.StateText(ns.settings, ns.ManualCount(ns.manual)))
  else
    help()
  end
end
