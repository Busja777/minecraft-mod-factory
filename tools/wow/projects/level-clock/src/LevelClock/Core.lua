local _, ns = ...

-- Pure arithmetic: no frames, no events. Everything here runs outside the game in the tests.
-- A reading is the XP bar at one moment: { xp, max, level, rested }.

ns.MIN_SECONDS = 60 -- a rate from less playing time than this jumps around too much to show
ns.HISTORY = 10     -- finished sessions kept per character
ns.MERGE_GAP = 300  -- seconds between logout and login that still count as one session (a reload, a quick relog)
ns.SCALE_MIN, ns.SCALE_MAX = 0.8, 1.5 -- window size (1.2)
ns.LEVELS = 100     -- level-ups kept per character (1.3)
ns.LEVELS_SHOWN = 10 -- level-ups /lc levels prints

function ns.IsSecret(value)
  return issecretvalue ~= nil and issecretvalue(value) and true or false
end

-- 1.4: a word the game itself has (a GlobalStrings constant such as XP), in the client's language;
-- the English word when the client lacks it.
function ns.GameText(global, english)
  local text = _G[global]
  if type(text) ~= "string" or text == "" then return english end
  return text
end

-- startedAt is the clock time (time()) the session began; login is true for a session begun at login.
function ns.NewSession(now, reading, startedAt, login)
  return { start = now, gained = 0, levels = 0, last = reading, startedAt = startedAt, login = login }
end

-- XP gained between two readings, and the levels gained on the way.
-- On a level-up the bar wraps: the rest of the old level counts, plus what is already in the new one.
function ns.Step(prev, cur)
  local levels = cur.level - prev.level
  if levels <= 0 then
    if cur.xp >= prev.xp then return cur.xp - prev.xp, 0 end
    levels = 1 -- the bar wrapped before the level reading caught up
  end
  -- When several levels pass at once, the size of the levels in between is unknown; they are left out.
  return (prev.max - prev.xp) + cur.xp, levels
end

-- Books a new reading into the session and returns the XP it added.
function ns.Advance(session, reading)
  local prev = session.last
  local gained, levels, level = 0, 0, reading.level
  if prev then
    gained, levels = ns.Step(prev, reading)
    -- The level never goes back: a level-up seen on the bar alone must not be counted again
    -- once the level reading follows.
    level = math.max(level, prev.level + levels)
  end
  session.gained = session.gained + gained
  session.levels = session.levels + levels
  session.last = { xp = reading.xp, max = reading.max, level = level, rested = reading.rested }
  return gained
end

function ns.PerHour(gained, seconds)
  if not seconds or seconds < ns.MIN_SECONDS then return nil end
  return math.floor(gained * 3600 / seconds)
end

-- Seconds until the bar is full at the pace of the session so far.
function ns.TimeToLevel(needed, gained, seconds)
  if not seconds or seconds < ns.MIN_SECONDS or gained <= 0 then return nil end
  return needed * seconds / gained
end

-- Rested XP as a percentage of the whole level (the game allows up to 150).
function ns.RestedPercent(rested, max)
  if not rested or not max or max <= 0 then return nil end
  return math.floor(rested * 100 / max + 0.5)
end

function ns.FormatDuration(seconds)
  if not seconds then return "..." end
  if seconds < 60 then return ns.L["under a minute"] end
  local minutes = math.floor(seconds / 60)
  local hours = math.floor(minutes / 60)
  if hours == 0 then return string.format(ns.L["%dm"], minutes) end
  if hours < 24 then return string.format(ns.L["%dh %02dm"], hours, minutes % 60) end
  return string.format(ns.L["%dd %dh"], math.floor(hours / 24), hours % 24)
end

-- 1.4: thousands are parted the way the client does it (LARGE_NUMBER_SEPERATOR): 12,345 or 12.345.
function ns.FormatNumber(n)
  local s = tostring(math.floor(n))
  local out = s:reverse():gsub("(%d%d%d)", "%1,"):reverse()
  out = out:gsub("^,", "")
  local sep = ns.GameText("LARGE_NUMBER_SEPERATOR", ",")
  if sep ~= "," then out = out:gsub(",", function() return sep end) end
  return out
end

-- Everything the window shows, as numbers. A missing field means "not known yet".
function ns.View(session, now)
  local seconds = now - session.start
  local view = { gained = session.gained, seconds = seconds, levels = session.levels, perHour = ns.PerHour(session.gained, seconds) }
  local r = session.last
  if r then
    view.level = r.level
    view.needed = math.max(r.max - r.xp, 0)
    view.timeToLevel = ns.TimeToLevel(view.needed, session.gained, seconds)
    view.rested = ns.RestedPercent(r.rested, r.max)
  end
  return view
end

-- What is kept of a session once it is over. at and from are clock times (time()): its end and its start.
function ns.SessionSummary(session, now, at)
  local seconds = math.floor(now - session.start)
  return {
    xp = session.gained,
    seconds = seconds,
    levels = session.levels,
    level = session.last and session.last.level or nil,
    at = at,
    from = session.startedAt or (at and at - seconds),
  }
end

-- A saved session that can be shown; anything else (broken or empty) is dropped.
function ns.ValidEntry(e)
  return type(e) == "table" and type(e.xp) == "number" and e.xp > 0
    and type(e.seconds) == "number" and e.seconds >= 0
end

local function copy(e)
  local c = {}
  for k, v in pairs(e) do c[k] = v end
  return c
end

-- Puts a finished session at the top of the history (newest first) and keeps the newest ns.HISTORY.
-- With merge, a session that began within ns.MERGE_GAP of the end of the newest entry continues
-- that entry: a UI reload or a quick relog does not split one evening into pieces.
function ns.AddToHistory(history, entry, merge)
  local top = history[1]
  local gap = top and top.at and entry.from and entry.from - top.at
  if merge and gap and gap >= 0 and gap <= ns.MERGE_GAP then
    top.xp = top.xp + entry.xp
    top.seconds = top.seconds + entry.seconds
    top.levels = (top.levels or 0) + (entry.levels or 0)
    top.level = entry.level or top.level
    top.at = entry.at
  else
    table.insert(history, 1, copy(entry))
  end
  while #history > ns.HISTORY do table.remove(history) end
end

-- Brings the saved data of one character to the current shape. Version 1.0 kept only the
-- last session (char.last); it becomes the first entry of the history. Broken rows are dropped.
function ns.MigrateChar(char)
  if type(char.history) ~= "table" then
    char.history = {}
    local last = char.last
    if ns.ValidEntry(last) then
      local e = copy(last)
      if e.from == nil and type(e.at) == "number" then e.from = e.at - e.seconds end
      char.history[1] = e
    end
  end
  local clean = {}
  for _, e in ipairs(char.history) do
    if ns.ValidEntry(e) and #clean < ns.HISTORY then clean[#clean + 1] = e end
  end
  char.history = clean
  char.levels = ns.CleanLevels(char.levels) -- 1.3: new, empty for data of 1.2 and before
end

-- One history entry as texts: when it started, how long, XP, XP per hour, levels gained.
function ns.HistoryRow(e)
  local when = type(e.from) == "number" and date and date(ns.L["%b %d %H:%M"], e.from) or "-"
  local perHour = ns.PerHour(e.xp, e.seconds)
  local levels = e.levels or 0
  return {
    when = when,
    duration = ns.FormatDuration(e.seconds),
    xp = ns.FormatNumber(e.xp),
    perHour = perHour and ns.FormatNumber(perHour) or "-",
    levels = levels > 0 and string.format(ns.L["+%d"], levels) or "",
  }
end

-- One history entry as a chat line.
function ns.HistoryText(e)
  local r = ns.HistoryRow(e)
  local L = ns.L
  local text
  if r.perHour ~= "-" then
    text = string.format(L["%s: %s XP in %s, %s XP per hour"], r.when, r.xp, r.duration, r.perHour)
  else
    text = string.format(L["%s: %s XP in %s"], r.when, r.xp, r.duration)
  end
  local levels = e.levels or 0
  if levels == 1 then
    text = text .. L[", 1 level up"]
  elseif levels > 1 then
    text = text .. string.format(L[", %d levels up"], levels)
  end
  return text
end

-- 1.2: window options -----------------------------------------------------------------------------
-- settings.locked: the window cannot be dragged; settings.scale: its size (SCALE_MIN to SCALE_MAX);
-- settings.hideAtMax: it stays closed at maximum level; settings.shown: the player left it open,
-- so it opens again at the next login.

local function round2(n)
  return math.floor(n * 100 + 0.5) / 100
end

-- A size the player typed: "1.2", "1,2", "120" or "120%". → the size, or nil when it is no number
-- or outside SCALE_MIN to SCALE_MAX.
function ns.ParseScale(text)
  if type(text) ~= "string" then return nil end
  local number, percent = text:match("^%s*(%d+[.,]?%d*)%s*(%%?)%s*$")
  number = number and tonumber((number:gsub(",", ".")))
  if not number then return nil end
  if percent == "%" or number >= 10 then number = number / 100 end
  number = round2(number)
  if number < ns.SCALE_MIN or number > ns.SCALE_MAX then return nil end
  return number
end

function ns.ScaleText(scale)
  return string.format(ns.L["%d%%"], math.floor(scale * 100 + 0.5))
end

-- Fills in the window options that are missing or broken and keeps what the player chose.
function ns.WindowSettings(settings)
  if type(settings.locked) ~= "boolean" then settings.locked = false end
  if type(settings.hideAtMax) ~= "boolean" then settings.hideAtMax = false end
  if type(settings.shown) ~= "boolean" then settings.shown = false end
  local scale = settings.scale
  if type(scale) ~= "number" or scale ~= scale or round2(scale) < ns.SCALE_MIN or round2(scale) > ns.SCALE_MAX then
    settings.scale = 1
  end
  return settings
end

-- Whether the window opens by itself at login.
function ns.ShowAtLogin(settings, atMax)
  return settings.shown == true and not (settings.hideAtMax == true and atMax == true)
end

-- The offsets of the window's anchor after a change of size, so the anchor stays where it is on
-- the screen (offsets are counted in the window's own, scaled units).
function ns.ScaledOffsets(x, y, old, new)
  return x * old / new, y * old / new
end

-- 1.3: level history ------------------------------------------------------------------------------
-- char.levels lists the level-ups seen from 1.3 on, oldest first:
--   { level, at = clock time (time()) it was reached, played = /played seconds at that moment,
--     took = /played seconds the level before it took }
-- played and took are only known when the game told the played time in this session
-- (TIME_PLAYED_MSG, sent when the player types /played or another addon asks for it).

local function number(v)
  return type(v) == "number" and v == v
end

-- A saved level-up that can be shown.
function ns.ValidLevel(e)
  return type(e) == "table" and number(e.level) and e.level >= 1 and number(e.at)
    and (e.played == nil or number(e.played)) and (e.took == nil or (number(e.took) and e.took >= 0))
end

-- Keeps the good entries of a saved list, the newest ns.LEVELS.
function ns.CleanLevels(list)
  local clean = {}
  if type(list) ~= "table" then return clean end
  for _, e in ipairs(list) do
    if ns.ValidLevel(e) then clean[#clean + 1] = e end
  end
  while #clean > ns.LEVELS do table.remove(clean, 1) end
  return clean
end

-- The played time from what the game told: total and time in the current level at moment at
-- (GetTime()). level is the level then.
function ns.PlayedAnchor(total, thisLevel, at, level)
  if not (number(total) and number(thisLevel) and number(at) and number(level)) then return nil end
  if total < 0 or thisLevel < 0 or thisLevel > total then return nil end
  return { total = total, thisLevel = thisLevel, at = at, level = level }
end

-- The played time now, worked out from the anchor and the time since.
function ns.PlayedNow(anchor, now)
  if not anchor or not number(now) or now < anchor.at then return nil end
  return anchor.total + (now - anchor.at)
end

-- A level-up to newLevel at now (GetTime()). → played time now, the played time the level before
-- took (nil when the anchor is from another level), and the anchor for the new level.
function ns.LevelUpPlayed(anchor, newLevel, now)
  local played = ns.PlayedNow(anchor, now)
  if not played then return nil, nil, nil end
  local took
  if anchor.level == newLevel - 1 then took = anchor.thisLevel + (now - anchor.at) end
  return played, took, { total = played, thisLevel = 0, at = now, level = newLevel }
end

-- Notes a level-up. The same level twice in a row (an event sent again) is noted once.
-- Returns the entry, or nil when nothing was added.
function ns.AddLevel(list, level, at, played, took)
  if not number(level) or level < 1 or not number(at) then return nil end
  local last = list[#list]
  if last and last.level == level then return nil end
  local e = { level = level, at = at, played = number(played) and math.floor(played) or nil,
    took = number(took) and took >= 0 and math.floor(took) or nil }
  list[#list + 1] = e
  while #list > ns.LEVELS do table.remove(list, 1) end
  return e
end

-- The played time told later fills in the entry of the level the character is at, when it lacks it:
-- the level was reached at total minus the time spent in it so far.
function ns.FillPlayed(list, anchor)
  local last = list[#list]
  if not anchor or not last or last.level ~= anchor.level or last.played ~= nil then return end
  last.played = anchor.total - anchor.thisLevel
end

-- How long the level before entry i took: in played time when it is known, otherwise the real
-- time between two level-ups in a row (which includes the time spent offline).
-- → seconds, "played" or "real"; nil when it cannot be told.
function ns.LevelTook(list, i)
  local e = list[i]
  if not e then return nil end
  if number(e.took) then return e.took, "played" end
  local prev = list[i - 1]
  if not prev or prev.level ~= e.level - 1 then return nil end
  if number(e.played) and number(prev.played) and e.played >= prev.played then return e.played - prev.played, "played" end
  if e.at >= prev.at then return e.at - prev.at, "real" end
  return nil
end

-- One level-up as a chat line.
function ns.LevelText(list, i)
  local L = ns.L
  local e = list[i]
  local when = date and date(L["%b %d %H:%M"], e.at) or "-"
  local text = string.format(L["Level %d on %s"], e.level, when)
  local seconds, kind = ns.LevelTook(list, i)
  if kind == "played" then
    text = text .. string.format(L[", took %s played"], ns.FormatDuration(seconds))
  elseif kind == "real" then
    text = text .. string.format(L[", took %s real time"], ns.FormatDuration(seconds))
  end
  if number(e.played) then
    text = text .. string.format(L[" (/played %s)"], ns.FormatDuration(e.played))
  end
  return text
end
