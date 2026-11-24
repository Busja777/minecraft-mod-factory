local _, ns = ...

-- Pure logic: no frames, no events. Everything here runs outside the game in the tests.
-- A reading is what the meter shows at one moment:
--   { fps, home, world, memory } -- numbers, each nil when not known (yet)
-- fps from GetFramerate(), home and world latency in ms from GetNetStats(), memory in KB: the total of all
-- loaded addons from the last memory scan.

ns.TICK = 1           -- the meter reads framerate and latency once per second, not every frame
ns.SCAN_INTERVAL = 15 -- UpdateAddOnMemoryUsage is expensive: at most one memory scan every 15 seconds
ns.TOP = 5            -- addons listed in the tooltip

-- Colour thresholds (documented on the page):
--   framerate: green from 45 fps, yellow from 25 fps, red below 25 fps
--   latency:   green below 100 ms, yellow below 250 ms, red from 250 ms (home and world each)
--   memory:    green below 200 MB, yellow below 500 MB, red from 500 MB (all addons together)
ns.FPS_GOOD, ns.FPS_OK = 45, 25
ns.LATENCY_GOOD, ns.LATENCY_OK = 100, 250
ns.MEMORY_GOOD, ns.MEMORY_OK = 200 * 1024, 500 * 1024 -- KB

ns.COLORS = { good = "|cff40ff40", ok = "|cffffd100", bad = "|cffff4040" }
ns.GREY = "|cff9d9d9d"

function ns.IsSecret(value)
  return issecretvalue ~= nil and issecretvalue(value) and true or false
end

-- A number read from the game, or nil when it is missing or secret.
function ns.Plain(value)
  if ns.IsSecret(value) or type(value) ~= "number" or value ~= value then return nil end
  return value
end

-- A text read from the game, or nil when it is missing or secret.
function ns.PlainText(value)
  if ns.IsSecret(value) or type(value) ~= "string" then return nil end
  return value
end

-- A word the game itself has (a GlobalStrings constant), in the client's language; the English word otherwise.
function ns.GameText(global, english)
  local text = _G[global]
  if type(text) ~= "string" or text == "" then return english end
  return text
end

-- The conversions of a format string in order ("f,f" for "%.0f ms / %.0f ms"), "%%" left out.
local function conversions(fmt)
  local out = {}
  for c in fmt:gsub("%%%%", ""):gmatch("%%[-+ #0]*%d*%.?%d*(%a)") do out[#out + 1] = c end
  return table.concat(out, ",")
end
ns.Conversions = conversions

-- A format string of the game (e.g. MAINMENUBAR_FPS_LABEL) filled in. The game's text is used only when it
-- takes the same values in the same order as the English one, so a changed constant can never break the meter.
function ns.GameFormat(global, english, ...)
  local fmt = ns.GameText(global, english)
  if fmt ~= english and conversions(fmt) == conversions(english) then
    local ok, text = pcall(string.format, fmt, ...)
    if ok then return text end
  end
  return string.format(english, ...)
end

-- "good", "ok" or "bad" for a value of the meter, nil when the value is not known.
function ns.Grade(kind, value)
  if type(value) ~= "number" then return nil end
  if kind == "fps" then
    if value >= ns.FPS_GOOD then return "good" end
    if value >= ns.FPS_OK then return "ok" end
    return "bad"
  elseif kind == "latency" then
    if value < ns.LATENCY_GOOD then return "good" end
    if value < ns.LATENCY_OK then return "ok" end
    return "bad"
  elseif kind == "memory" then
    if value < ns.MEMORY_GOOD then return "good" end
    if value < ns.MEMORY_OK then return "ok" end
    return "bad"
  end
  return nil
end

function ns.Colored(kind, value, text)
  local grade = ns.Grade(kind, value)
  if not grade then return ns.GREY .. "...|r" end
  return ns.COLORS[grade] .. text .. "|r"
end

-- Latency is 0 until the game has measured it (it does so every 30 seconds): 0 counts as not known.
function ns.Latency(value)
  value = ns.Plain(value)
  if not value or value <= 0 then return nil end
  return value
end

function ns.Round(n)
  return math.floor(n + 0.5)
end

-- "512 KB" below one megabyte, "31.2 MB" above.
function ns.FormatMemory(kb)
  if kb < 1024 then return string.format("%d KB", ns.Round(kb)) end
  return string.format("%.1f MB", kb / 1024)
end

-- The one line on the meter: "60 fps  42/58 ms  AddOns 31.2 MB", each value in its colour.
function ns.MeterText(reading)
  local fps = ns.Colored("fps", reading.fps, reading.fps and string.format(ns.L["%d fps"], ns.Round(reading.fps)))
  local home = ns.Colored("latency", reading.home, reading.home and tostring(ns.Round(reading.home)))
  local world = ns.Colored("latency", reading.world, reading.world and tostring(ns.Round(reading.world)))
  local memory = ns.Colored("memory", reading.memory, reading.memory and ns.FormatMemory(reading.memory))
  return fps .. "  " .. home .. "/" .. world .. " " .. ns.GameText("MILLISECONDS_ABBR", "ms")
    .. "  " .. ns.GameText("ADDONS", "AddOns") .. " " .. memory
end

-- Whether a memory scan may run now: never in combat, otherwise at most once per SCAN_INTERVAL.
function ns.ShouldScan(lastScan, now, inCombat)
  if inCombat then return false end
  if not lastScan then return true end
  return now - lastScan >= ns.SCAN_INTERVAL
end

-- entries: { { name, kb }, ... } of one scan. Returns the total in KB.
function ns.Total(entries)
  local total = 0
  for _, e in ipairs(entries) do total = total + e.kb end
  return total
end

-- The n heaviest addons of a scan, heaviest first (same size: by name).
function ns.Top(entries, n)
  local sorted = {}
  for i, e in ipairs(entries) do sorted[i] = e end
  table.sort(sorted, function(a, b)
    if a.kb ~= b.kb then return a.kb > b.kb end
    return a.name < b.name
  end)
  local top = {}
  for i = 1, math.min(n, #sorted) do top[i] = sorted[i] end
  return top
end

-- "AddOn Memory: 31.25 MB" the way the game's own performance tooltip writes it.
function ns.TotalMemoryLine(kb)
  if kb >= 1024 then return ns.GameFormat("TOTAL_MEM_MB_ABBR", "AddOn Memory: %.2f MB", kb / 1024) end
  return ns.GameFormat("TOTAL_MEM_KB_ABBR", "AddOn Memory: %.0f KB", kb)
end

-- "(12.50 MB) Details" the way the game's own performance tooltip writes it.
function ns.AddonMemoryLine(entry)
  if entry.kb >= 1024 then return ns.GameFormat("ADDON_MEM_MB_ABBR", "(%.2f MB) %s", entry.kb / 1024, entry.name) end
  return ns.GameFormat("ADDON_MEM_KB_ABBR", "(%.0f KB) %s", entry.kb, entry.name)
end

-- Every line of the tooltip. scan: { total, entries, at } or nil before the first scan.
function ns.TooltipLines(reading, scan, now, inCombat, locked)
  local lines = {}
  if reading.fps then lines[#lines + 1] = ns.GameFormat("MAINMENUBAR_FPS_LABEL", "Framerate: %.0f fps", reading.fps) end
  if reading.home and reading.world then
    lines[#lines + 1] = ns.GameFormat("MAINMENUBAR_LATENCY_LABEL", "Latency:\n%.0f ms (home)\n%.0f ms (world)", reading.home, reading.world)
  end
  lines[#lines + 1] = " "
  if scan then
    lines[#lines + 1] = ns.TotalMemoryLine(scan.total)
    for _, e in ipairs(ns.Top(scan.entries, ns.TOP)) do lines[#lines + 1] = ns.AddonMemoryLine(e) end
    if now and scan.at then
      lines[#lines + 1] = ns.GREY .. string.format(ns.L["Memory scan: %d s ago."], ns.Round(now - scan.at)) .. "|r"
    end
  else
    lines[#lines + 1] = ns.GREY .. ns.L["Addon memory is measured outside of combat."] .. "|r"
  end
  if inCombat then lines[#lines + 1] = ns.GREY .. ns.L["Memory is not measured during combat."] .. "|r" end
  if not locked then lines[#lines + 1] = ns.GREY .. ns.L["Drag to move. /perfmeter lock keeps it in place."] .. "|r" end
  return lines
end
