local _, ns = ...
local L = ns.L

-- Pure logic: no frames, no events. Everything here runs outside the game in the tests.

ns.KINDS = { "daily", "weekly" }
-- 1.1: the window's headings are words the game itself has (GlobalStrings), in the client's language:
-- { global, English }.
ns.KIND_HEADING = { daily = { "DAILY", "Daily" }, weekly = { "WEEKLY", "Weekly" } }
ns.MAX_TASKS = 30  -- tasks per kind
ns.MAX_TEXT = 100  -- characters of one task
-- Two readings of the same reset can differ by a moment. A next reset closer than this to the one
-- that just happened is the same reset, read a second late, and never clears the list twice.
ns.SAME_RESET = 60

function ns.IsSecret(value)
  return issecretvalue ~= nil and issecretvalue(value) and true or false
end

-- 1.1: a word the game itself has (a GlobalStrings constant such as DAILY), in the client's language;
-- the English word when the client lacks it.
function ns.GameText(global, english)
  local text = _G[global]
  if ns.IsSecret(text) or type(text) ~= "string" or text == "" then return english end
  return text
end

-- The heading of a list in the window: "Daily" or "Weekly", as the client writes it.
function ns.Heading(kind)
  local g = ns.KIND_HEADING[kind]
  return ns.GameText(g[1], g[2])
end

-- "daily"/"weekly" (also "day"/"week"), any case; nil for anything else.
function ns.ParseKind(word)
  local w = tostring(word or ""):lower()
  if w == "daily" or w == "day" then return "daily" end
  if w == "weekly" or w == "week" then return "weekly" end
  return nil
end

-- A task is plain text: no chat escape codes, no line breaks, at most MAX_TEXT characters.
function ns.CleanText(text)
  local s = tostring(text or ""):gsub("|", ""):gsub("[%c]", " "):gsub("%s+", " ")
  s = s:gsub("^ ", ""):gsub(" $", "")
  if #s > ns.MAX_TEXT then
    -- Cut on a whole character: never inside the bytes of a UTF-8 letter.
    local cut = ns.MAX_TEXT
    while cut > 0 and (s:byte(cut + 1) or 0) >= 128 and s:byte(cut + 1) < 192 do cut = cut - 1 end
    s = s:sub(1, cut):gsub(" $", "")
  end
  if s == "" then return nil end
  return s
end

-- Saved data as the addon expects it; anything broken or beyond the limits is dropped.
-- db = { version, daily = { { text, done } }, weekly = { ... }, due = { daily, weekly }, last = { ... }, point }
function ns.Normalize(db)
  if type(db) ~= "table" then db = {} end
  db.version = 1
  for _, kind in ipairs(ns.KINDS) do
    local clean = {}
    if type(db[kind]) == "table" then
      for _, task in ipairs(db[kind]) do
        local text = type(task) == "table" and type(task.text) == "string" and ns.CleanText(task.text)
        if text and #clean < ns.MAX_TASKS then clean[#clean + 1] = { text = text, done = task.done == true } end
      end
    end
    db[kind] = clean
  end
  for _, field in ipairs({ "due", "last" }) do
    local t = type(db[field]) == "table" and db[field] or {}
    for _, kind in ipairs(ns.KINDS) do
      if type(t[kind]) ~= "number" then t[kind] = nil end
    end
    db[field] = t
  end
  if type(db.point) ~= "table" then db.point = nil end
  return db
end

-- Adds a task to the end of a list. Returns the task, or nil and why: "empty", "full", "duplicate".
function ns.AddTask(list, text)
  local clean = ns.CleanText(text)
  if not clean then return nil, "empty" end
  if #list >= ns.MAX_TASKS then return nil, "full" end
  for _, task in ipairs(list) do
    if task.text:lower() == clean:lower() then return nil, "duplicate" end
  end
  local task = { text = clean, done = false }
  list[#list + 1] = task
  return task
end

-- index may be a number or the text of a number; returns the removed task or nil.
function ns.RemoveTask(list, index)
  index = tonumber(index)
  if not index or index ~= math.floor(index) or not list[index] then return nil end
  return table.remove(list, index)
end

-- Ticks a task off, or back on. Returns the task or nil.
function ns.ToggleTask(list, index)
  index = tonumber(index)
  local task = index and list[index]
  if not task then return nil end
  task.done = not task.done
  return task
end

-- Unchecks every task of a list; returns how many were ticked off.
function ns.Uncheck(list)
  local n = 0
  for _, task in ipairs(list) do
    if task.done then n = n + 1 end
    task.done = false
  end
  return n
end

function ns.Counts(list)
  local done = 0
  for _, task in ipairs(list) do
    if task.done then done = done + 1 end
  end
  return done, #list
end

-- Seconds until a reset, read through the given game function. nil when the function is missing,
-- fails, or answers with something that is not a usable number (a secret value included).
function ns.ResetSeconds(fn)
  if type(fn) ~= "function" then return nil end
  local ok, value = pcall(fn)
  if not ok or ns.IsSecret(value) or type(value) ~= "number" or value ~= value or value < 0 then return nil end
  return value
end

-- The reset check for one kind. now is the server time, left the game's seconds until the next
-- reset (nil when unknown). db.due[kind] is the next reset as last read, so a reset that passed
-- while the player was offline is found at the next login. Returns true when the reset is due:
-- the caller then unchecks the list.
function ns.CheckReset(db, kind, now, left)
  local due, fired = db.due[kind], false
  if due and now >= due then
    fired = true
    db.last[kind] = due
    db.due[kind] = nil
  end
  if left and left > 0 then
    local nextDue = now + left
    local last = db.last[kind]
    if not last or nextDue > last + ns.SAME_RESET then db.due[kind] = nextDue end
  end
  return fired
end

-- "2d 5h", "3h 12m", "12m"; below one minute reads "1m". nil stays nil.
function ns.FormatLeft(seconds)
  if not seconds then return nil end
  seconds = math.floor(seconds)
  local d = math.floor(seconds / 86400)
  local h = math.floor(seconds / 3600) % 24
  local m = math.floor(seconds / 60) % 60
  if d > 0 then return string.format(L["%dd %dh"], d, h) end
  if h > 0 then return string.format(L["%dh %dm"], h, m) end
  return string.format(L["%dm"], m > 0 and m or 1)
end

function ns.AddFailText(why, kind)
  if why == "full" then
    local text = kind == "weekly" and L["Your weekly list is full (%d tasks)."] or L["Your daily list is full (%d tasks)."]
    return string.format(text, ns.MAX_TASKS)
  end
  if why == "duplicate" then return L["That task is already on the list."] end
  return L["Write the task after the list, for example /chores add daily Feed the pet."]
end
