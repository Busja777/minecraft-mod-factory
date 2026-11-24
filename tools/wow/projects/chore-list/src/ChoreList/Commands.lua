local _, ns = ...
local L = ns.L

-- /chores opens the window; add, done, remove and list work from chat as well.

local function help()
  ns.Print(L["/chores opens the list, /chores add daily Feed the pet adds a task (or weekly), /chores done daily 2 ticks a task off, /chores remove weekly 1 removes one, /chores list shows both lists in chat."])
end

local function add(rest)
  local word, task = rest:match("^(%S*)%s*(.-)$")
  local kind = ns.ParseKind(word)
  if not kind then return help() end
  local added, why = ns.AddTask(ns.List(kind), task)
  if not added then return ns.Print(ns.AddFailText(why, kind)) end
  ns.Print(string.format(kind == "daily" and L["Added to your daily chores: %s"] or L["Added to your weekly chores: %s"], added.text))
  ns.Refresh()
end

-- "daily 2" -> list kind and the task number, or nil when either is missing.
local function target(rest)
  local word, number = rest:match("^(%S*)%s*(.-)$")
  local kind = ns.ParseKind(word)
  local list = kind and ns.List(kind)
  local index = tonumber(number)
  if not list or not index or not list[index] then return nil end
  return kind, list, index
end

local function done(rest)
  local kind, list, index = target(rest)
  if not kind then return ns.Print(L["No such task. /chores list shows the numbers."]) end
  local task = ns.ToggleTask(list, index)
  ns.Print(string.format(task.done and L["Done: %s"] or L["Open again: %s"], task.text))
  ns.Refresh()
end

local function remove(rest)
  local kind, list, index = target(rest)
  if not kind then return ns.Print(L["No such task. /chores list shows the numbers."]) end
  local task = ns.RemoveTask(list, index)
  ns.Print(string.format(L["Removed: %s"], task.text))
  ns.Refresh()
end

local function show()
  for _, kind in ipairs(ns.KINDS) do
    local list = ns.List(kind)
    local done, total = ns.Counts(list)
    local head = kind == "daily" and L["Daily chores: %d of %d done."] or L["Weekly chores: %d of %d done."]
    ns.Print(string.format(head, done, total))
    for i, task in ipairs(list) do
      ns.Print(string.format("%d. %s%s", i, task.done and L["[done] "] or "", task.text))
    end
  end
end

SLASH_CHORELIST1 = "/chores"
SLASH_CHORELIST2 = "/chorelist"
SlashCmdList.CHORELIST = function(msg)
  if not ns.db then return end
  local word, rest = strtrim(msg or ""):match("^(%S*)%s*(.-)$")
  word = word:lower()
  if word == "" then
    ns.Toggle()
  elseif word == "add" then
    add(rest)
  elseif word == "done" then
    done(rest)
  elseif word == "remove" then
    remove(rest)
  elseif word == "list" then
    show()
  else
    help()
  end
end
