local _, ns = ...

-- Pure arithmetic: no frames, no events. Everything here runs outside the game in the tests.
-- A reading is the XP bar at one moment: { xp, max, level, rested }.

ns.MIN_SECONDS = 60 -- a rate from less playing time than this jumps around too much to show
ns.HISTORY = 10     -- finished sessions kept per character
ns.MERGE_GAP = 300  -- seconds between logout and login that still count as one session (a reload, a quick relog)
ns.SCALE_MIN, ns.SCALE_MAX = 0.8, 1.5 -- window size (1.2)

function ns.IsSecret(value)
  return issecretvalue ~= nil and issecretvalue(value) and true or false
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

function ns.FormatNumber(n)
  local s = tostring(math.floor(n))
  local out = s:reverse():gsub("(%d%d%d)", "%1,"):reverse()
  return (out:gsub("^,", ""))
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
