local _, ns = ...
local L = ns.L

-- Pure logic: no frames, no events. Everything here runs outside the game in the tests.

ns.MIN_TIMER = 1          -- seconds
ns.MAX_TIMER = 24 * 3600  -- a timer runs at most one day
ns.MAX_LABEL = 40         -- characters of a timer's label

local UNIT = { h = 3600, m = 60, s = 1 }

function ns.IsSecret(value)
  return issecretvalue ~= nil and issecretvalue(value) and true or false
end

-- "2d 5h", "3h 12m", "9m 30s", "45s". Below zero counts as zero; fractions are cut off.
function ns.FormatDuration(seconds)
  seconds = math.floor(seconds or 0)
  if seconds < 0 then seconds = 0 end
  local d = math.floor(seconds / 86400)
  local h = math.floor(seconds / 3600) % 24
  local m = math.floor(seconds / 60) % 60
  local s = seconds % 60
  if d > 0 then return string.format(L["%dd %dh"], d, h) end
  if h > 0 then return string.format(L["%dh %dm"], h, m) end
  if m > 0 then return string.format(L["%dm %ds"], m, s) end
  return string.format(L["%ds"], s)
end

-- "10m", "1h30m", "90s", "1h 30m"; a plain number means minutes.
-- Returns seconds, or nil and the reason: "invalid", "short" or "long".
function ns.ParseDuration(text)
  local s = tostring(text or ""):lower():gsub("%s+", "")
  if s == "" then return nil, "invalid" end
  local total
  if s:match("^%d+$") then
    total = tonumber(s) * 60
  else
    local seen, rest = {}, s
    total = 0
    while rest ~= "" do
      local n, unit, after = rest:match("^(%d+)([hms])(.*)$")
      if not n or seen[unit] then return nil, "invalid" end
      seen[unit] = true
      total = total + tonumber(n) * UNIT[unit]
      rest = after
    end
  end
  if total < ns.MIN_TIMER then return nil, "short" end
  if total > ns.MAX_TIMER then return nil, "long" end
  return total
end

-- A label is plain text: no chat escape codes, no line breaks, at most MAX_LABEL characters.
function ns.CleanLabel(text)
  local label = tostring(text or ""):gsub("|", ""):gsub("[%c]", " "):gsub("%s+", " ")
  label = label:gsub("^ ", ""):gsub(" $", "")
  if #label > ns.MAX_LABEL then
    -- Cut on a whole character: never inside the bytes of a UTF-8 letter.
    local cut = ns.MAX_LABEL
    while cut > 0 and (label:byte(cut + 1) or 0) >= 128 and label:byte(cut + 1) < 192 do cut = cut - 1 end
    label = label:sub(1, cut):gsub(" $", "")
  end
  if label == "" then return nil end
  return label
end

-- "1h 30m tea break" -> 5400, "tea break". The leading words made of digits and h/m/s are the
-- duration, the rest is the label. Returns nil and the reason when the duration is not valid.
function ns.ParseTimerArgs(text)
  local words = {}
  for w in tostring(text or ""):gmatch("%S+") do words[#words + 1] = w end
  local n = 0
  if words[1] and words[1]:match("^%d+$") then
    n = 1 -- a plain number of minutes stands alone
  else
    while words[n + 1] and words[n + 1]:lower():match("^%d+[hms][%dhms]*$") do n = n + 1 end
  end
  if n == 0 then return nil, "invalid" end
  local seconds, why = ns.ParseDuration(table.concat(words, "", 1, n))
  if not seconds then return nil, why end
  return seconds, ns.CleanLabel(table.concat(words, " ", n + 1))
end

-- A timer is { endsAt = time() when it runs out, seconds = its length, label = text or nil }.
function ns.NewTimer(seconds, label, now)
  return { endsAt = now + seconds, seconds = seconds, label = label }
end

function ns.Remaining(timer, now)
  if not timer or type(timer.endsAt) ~= "number" then return nil end
  local left = timer.endsAt - now
  return left > 0 and left or 0
end

function ns.Expired(timer, now)
  local left = ns.Remaining(timer, now)
  return left ~= nil and left <= 0
end

-- Seconds until a reset, read through the given game function. nil when the function is missing,
-- fails, or answers with something that is not a usable number (a secret value included).
function ns.ResetSeconds(fn)
  if type(fn) ~= "function" then return nil end
  local ok, value = pcall(fn)
  if not ok or ns.IsSecret(value) or type(value) ~= "number" or value ~= value or value < 0 then return nil end
  return value
end

local function named(timer)
  return timer.label and string.format(L["Timer \"%s\""], timer.label) or L["Timer"]
end

function ns.ResetText(label, seconds)
  if not seconds then return string.format(L["%s: not available."], label) end
  return string.format(L["%s in %s."], label, ns.FormatDuration(seconds))
end

function ns.TimerText(timer, now)
  local left = ns.Remaining(timer, now)
  if not left then return L["No timer running. /rc timer 10m starts one."] end
  return string.format(L["%s: %s left of %s."], named(timer), ns.FormatDuration(left), ns.FormatDuration(timer.seconds))
end

function ns.DoneText(timer, offline)
  if offline then return string.format(L["%s ran out while you were away."], named(timer)) end
  return string.format(L["%s is up!"], named(timer))
end

function ns.StartedText(timer, replaced)
  local text = string.format(L["%s started: %s."], named(timer), ns.FormatDuration(timer.seconds))
  if replaced then text = text .. " " .. L["It replaces the timer that was running."] end
  return text
end

function ns.InvalidText(why)
  if why == "short" then return L["A timer needs at least one second."] end
  if why == "long" then return L["A timer can run at most 24 hours."] end
  return L["Give the time like 10m, 1h30m, 90s or 15 (minutes), for example /rc timer 10m tea."]
end
