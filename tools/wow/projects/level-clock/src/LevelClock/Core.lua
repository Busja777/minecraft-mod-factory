local _, ns = ...

-- Pure arithmetic: no frames, no events. Everything here runs outside the game in the tests.
-- A reading is the XP bar at one moment: { xp, max, level, rested }.

ns.MIN_SECONDS = 60 -- a rate from less playing time than this jumps around too much to show

function ns.IsSecret(value)
  return issecretvalue ~= nil and issecretvalue(value) and true or false
end

function ns.NewSession(now, reading)
  return { start = now, gained = 0, levels = 0, last = reading }
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

-- What is kept of a session once it is over.
function ns.SessionSummary(session, now, at)
  return {
    xp = session.gained,
    seconds = math.floor(now - session.start),
    levels = session.levels,
    level = session.last and session.last.level or nil,
    at = at,
  }
end
