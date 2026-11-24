local _, ns = ...

-- Pure decisions: no frames, no events. Everything here runs outside the game in the tests.
--
-- A round is one roll call:
--   { started, ends, seconds, open, ended, rolls = { entry, ... }, seen = { [name] = true },
--     repeats = number of later rolls of a player already listed, unreadable = number of secret lines }
-- An entry is one player's first roll: { name, roll, low, high, n = arrival order }.

ns.DEFAULT_SECONDS = 30
ns.MIN_SECONDS = 5
ns.MAX_SECONDS = 120

-- The system line of a /roll, as a GlobalStrings constant (in the player's language) with the
-- English text as fallback: "%s rolls %d (%d-%d)", German "%1$s würfelt. Ergebnis: %2$d (%3$d-%4$d)".
ns.ROLL_TEXT = { "RANDOM_ROLL_RESULT", "%s rolls %d (%d-%d)" }

function ns.IsSecret(value)
  return issecretvalue ~= nil and issecretvalue(value) and true or false
end

-- A text the game has in the player's language (a GlobalStrings constant); the English one otherwise.
function ns.GameText(global, english)
  local text = _G[global]
  if type(text) ~= "string" or text == "" or ns.IsSecret(text) then return english end
  return text
end

local MAGIC = "[%^%$%(%)%%%.%[%]%*%+%-%?]"

-- A format string of the game as an anchored Lua pattern. Handles %s, %d, %% and the numbered
-- form %2$d some languages use to change the order of the values. Returns the pattern and, for
-- every capture, the number of the format value it holds; nil for anything else (%.1f, %5d ...).
function ns.FormatPattern(fmt)
  if type(fmt) ~= "string" then return nil end
  local out, order = {}, {}
  local i, len, nextArg = 1, #fmt, 0
  while i <= len do
    local c = fmt:sub(i, i)
    if c == "%" then
      local pos, kind, after = fmt:match("^(%d+)%$([sd])()", i + 1)
      if not pos then
        kind, after = fmt:match("^([sd%%])()", i + 1)
      end
      if not kind then return nil end
      if kind == "%" then
        out[#out + 1] = "%%"
      else
        if pos then
          order[#order + 1] = tonumber(pos)
        else
          nextArg = nextArg + 1
          order[#order + 1] = nextArg
        end
        out[#out + 1] = kind == "s" and "(.+)" or "(%-?%d+)"
      end
      i = after
    else
      out[#out + 1] = c:find(MAGIC) and ("%" .. c) or c
      i = i + 1
    end
  end
  return "^" .. table.concat(out) .. "$", order
end

-- The roll line as { pattern, order }: the game's own text when it has the four expected values
-- (name, roll, low, high), the English text otherwise.
function ns.RollPattern()
  local pattern, order = ns.FormatPattern(ns.GameText(ns.ROLL_TEXT[1], ns.ROLL_TEXT[2]))
  local ok = pattern and #order == 4
  if ok then
    local have = {}
    for _, n in ipairs(order) do have[n] = true end
    ok = have[1] and have[2] and have[3] and have[4]
  end
  if not ok then pattern, order = ns.FormatPattern(ns.ROLL_TEXT[2]) end
  return { pattern = pattern, order = order }
end

-- The roll in a system line: name, roll, low, high. nil for every other line and for secret text.
function ns.ParseRoll(text, rp)
  if type(text) ~= "string" or ns.IsSecret(text) or not rp then return nil end
  local caps = { text:match(rp.pattern) }
  if #caps ~= 4 then return nil end
  local values = {}
  for k, n in ipairs(rp.order) do values[n] = caps[k] end
  local name = values[1]
  local roll, low, high = tonumber(values[2]), tonumber(values[3]), tonumber(values[4])
  if not name or name == "" or not roll or not low or not high then return nil end
  return name, roll, low, high
end

-- The number after /rollcall start: seconds of the round. Empty gives the default, numbers are
-- kept between MIN and MAX. The second value is true when the number had to be changed.
-- nil for anything that is no number.
function ns.Seconds(word)
  word = word or ""
  if word == "" then return ns.DEFAULT_SECONDS, false end
  local n = tonumber(word)
  if not n or n ~= n then return nil end
  n = math.floor(n + 0.5)
  if n < ns.MIN_SECONDS then return ns.MIN_SECONDS, true end
  if n > ns.MAX_SECONDS then return ns.MAX_SECONDS, true end
  return n, false
end

function ns.NewRound(now, seconds)
  return {
    started = now, ends = now + seconds, seconds = seconds, open = true,
    rolls = {}, seen = {}, repeats = 0, unreadable = 0,
  }
end

-- Books a roll. → "added", "repeat" (the player already rolled in this round) or "closed".
function ns.AddRoll(round, name, roll, low, high)
  if not round or not round.open then return "closed" end
  if round.seen[name] then
    round.repeats = round.repeats + 1
    return "repeat"
  end
  round.seen[name] = true
  round.rolls[#round.rolls + 1] = { name = name, roll = roll, low = low, high = high, n = #round.rolls + 1 }
  return "added"
end

-- A line the game would not show to addons (a secret value): it may have been a roll.
function ns.AddUnreadable(round)
  if not round or not round.open then return end
  round.unreadable = round.unreadable + 1
end

-- Closes a round. false when it was not open.
function ns.Close(round, now)
  if not round or not round.open then return false end
  round.open = false
  round.ended = now
  return true
end

function ns.Remaining(round, now)
  if not round or not round.open then return 0 end
  local left = round.ends - now
  return left > 0 and left or 0
end

-- A roll that is not the usual /roll (1-100), for example /roll 1000 or /roll 50 100.
function ns.IsOdd(entry)
  return entry.low ~= 1 or entry.high ~= 100
end

-- The rolls, highest first; equal rolls keep the order they arrived in. Each row has rank (equal
-- rolls share it: 1, 2, 2, 4), tie (another player rolled the same) and odd (not 1-100).
function ns.Standings(round)
  local list = {}
  if not round then return list end
  for _, e in ipairs(round.rolls) do list[#list + 1] = e end
  table.sort(list, function(a, b)
    if a.roll ~= b.roll then return a.roll > b.roll end
    return a.n < b.n
  end)
  local count = {}
  for _, e in ipairs(list) do count[e.roll] = (count[e.roll] or 0) + 1 end
  local rows = {}
  for i, e in ipairs(list) do
    local prev = rows[i - 1]
    local rank = (prev and prev.roll == e.roll) and prev.rank or i
    rows[i] = { name = e.name, roll = e.roll, low = e.low, high = e.high, rank = rank, tie = count[e.roll] > 1, odd = ns.IsOdd(e) }
  end
  return rows
end

-- The highest rolls: one row for a clear winner, several for a tie, none without rolls.
function ns.Winners(round)
  local rows = ns.Standings(round)
  local top = {}
  for _, r in ipairs(rows) do
    if r.roll ~= rows[1].roll then break end
    top[#top + 1] = r
  end
  return top
end

function ns.RangeText(row)
  return string.format("%d-%d", row.low, row.high)
end

-- The result as one chat line.
function ns.ResultText(round)
  local L = ns.L
  local top = ns.Winners(round)
  if #top == 0 then return L["No rolls were seen."] end
  if #top == 1 then
    local w = top[1]
    if ns.IsOdd(w) then
      return string.format(L["Winner: %s with %d (%s, not 1-100)."], w.name, w.roll, ns.RangeText(w))
    end
    return string.format(L["Winner: %s with %d (%s)."], w.name, w.roll, ns.RangeText(w))
  end
  local names = {}
  for _, r in ipairs(top) do names[#names + 1] = r.name end
  return string.format(L["Tie at %d: %s."], top[1].roll, table.concat(names, ", "))
end
