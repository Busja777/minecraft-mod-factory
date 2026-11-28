-- Tests for Perf Meter, run by tools/wow/client/run.lua.

-- The game's performance state, modelled per test: pc.fps, pc.home and pc.world are what GetFramerate and
-- GetNetStats return, pc.addons the installed addons ({ name, kb, loaded, security }), pc.combat the combat
-- lockdown. pc.updates counts UpdateAddOnMemoryUsage calls, pc.asked the addons GetAddOnMemoryUsage was asked for.
local pc

local function model()
  pc = { fps = 60, home = 40, world = 55, combat = false, addons = {}, updates = 0, asked = {} }
  GetFramerate = function() return pc.fps end
  GetNetStats = function() return 12.5, 3.1, pc.home, pc.world end
  InCombatLockdown = function() return pc.combat end
  UpdateAddOnMemoryUsage = function()
    if pc.combat then error("UpdateAddOnMemoryUsage called in combat") end
    pc.updates = pc.updates + 1
  end
  GetAddOnMemoryUsage = function(index)
    table.insert(pc.asked, index)
    local a = pc.addons[index]
    if a.security and a.security ~= "INSECURE" then error("Cannot query secure addon") end
    return a.kb
  end
  C_AddOns = {
    GetNumAddOns = function() return #pc.addons end,
    GetAddOnInfo = function(index)
      local a = pc.addons[index]
      return a.name, a.name .. " Title", "Notes", true, nil, a.security or "INSECURE"
    end,
    IsAddOnLoaded = function(index)
      local loaded = pc.addons[index].loaded ~= false
      return loaded, loaded
    end,
  }
end

local function addons(list)
  pc.addons = {}
  for _, a in ipairs(list) do table.insert(pc.addons, { name = a[1], kb = a[2], loaded = a.loaded, security = a.security }) end
end

local function boot(wow, saved, locale)
  model()
  if locale then wow.locale = locale end
  addons({ { "Details", 40960 }, { "WeakAuras", 81920 }, { "BigWigs", 20480 }, { "PerfMeter", 120 } })
  PerfMeterDB = saved
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("ADDON_LOADED", "PerfMeter")
  wow.fire("PLAYER_LOGIN")
  return ns
end

-- Lets time pass in steps the way the client calls OnUpdate (every frame, dt seconds apart).
local function run(wow, seconds, dt)
  dt = dt or 0.25
  local f = PerfMeterFrame
  local steps = math.floor(seconds / dt + 0.5)
  for _ = 1, steps do
    wow.clock = wow.clock + dt
    if f.shown and f.scripts.OnUpdate then f.scripts.OnUpdate(f, dt) end
  end
end

local function plain(text) return (text:gsub("|c%x%x%x%x%x%x%x%x", ""):gsub("|r", "")) end

local function lastChat(wow) return wow.chat[#wow.chat] end

test("addon defines only its own globals", function(wow, installed, before)
  boot(wow)
  wow.slash("/perfmeter lock")
  local allowed = { PerfMeterDB = true, PerfMeterFrame = true, SLASH_PERFMETER1 = true, SLASH_PERFMETER2 = true,
    GetFramerate = true, GetNetStats = true, InCombatLockdown = true, UpdateAddOnMemoryUsage = true,
    GetAddOnMemoryUsage = true, C_AddOns = true } -- all but the first four are the test's model of the game
  for k in pairs(_G) do
    if not before[k] and not installed[k] and not allowed[k] then error("unexpected global " .. tostring(k)) end
  end
end)

test("colour thresholds: framerate, latency and memory", function(wow)
  local ns = boot(wow)
  eq(ns.Grade("fps", 144), "good")
  eq(ns.Grade("fps", 45), "good", "45 fps is green")
  eq(ns.Grade("fps", 44.9), "ok")
  eq(ns.Grade("fps", 25), "ok", "25 fps is yellow")
  eq(ns.Grade("fps", 24), "bad")
  eq(ns.Grade("latency", 99), "good")
  eq(ns.Grade("latency", 100), "ok", "100 ms is yellow")
  eq(ns.Grade("latency", 249), "ok")
  eq(ns.Grade("latency", 250), "bad", "250 ms is red")
  eq(ns.Grade("memory", 199 * 1024), "good")
  eq(ns.Grade("memory", 200 * 1024), "ok", "200 MB is yellow")
  eq(ns.Grade("memory", 500 * 1024), "bad", "500 MB is red")
  eq(ns.Grade("fps", nil), nil, "unknown")
  eq(ns.Grade("other", 10), nil)
end)

test("formatting: memory, the meter line and its colours", function(wow)
  local ns = boot(wow)
  eq(ns.FormatMemory(512.4), "512 KB")
  eq(ns.FormatMemory(1023.6), "1024 KB")
  eq(ns.FormatMemory(1024), "1.0 MB")
  eq(ns.FormatMemory(31.26 * 1024), "31.3 MB")
  local text = ns.MeterText({ fps = 59.6, home = 42.4, world = 120, memory = 600 * 1024 })
  eq(plain(text), "60 fps  42/120 ms  AddOns 600.0 MB")
  eq(text:find(ns.COLORS.good .. "60 fps|r", 1, true) ~= nil, true, "fps green")
  eq(text:find(ns.COLORS.ok .. "120|r", 1, true) ~= nil, true, "world latency yellow")
  eq(text:find(ns.COLORS.bad .. "600.0 MB|r", 1, true) ~= nil, true, "memory red")
  eq(plain(ns.MeterText({})), "...  .../... ms  AddOns ...", "nothing known yet")
  ADDONS, MILLISECONDS_ABBR = "Addons", "ms"
  eq(plain(ns.MeterText({ fps = 20, home = 30, world = 30, memory = 100 })), "20 fps  30/30 ms  Addons 100 KB")
end)

test("the game's own words, with English when a constant is missing or changed", function(wow)
  local ns = boot(wow)
  eq(ns.GameFormat("MAINMENUBAR_FPS_LABEL", "Framerate: %.0f fps", 59.7), "Framerate: 60 fps", "no constant")
  MAINMENUBAR_LATENCY_LABEL = "Latenz:\n%.0f ms (Standort)\n%.0f ms (Welt)"
  eq(ns.GameFormat("MAINMENUBAR_LATENCY_LABEL", "Latency:\n%.0f ms (home)\n%.0f ms (world)", 40, 55), "Latenz:\n40 ms (Standort)\n55 ms (Welt)")
  MAINMENUBAR_FPS_LABEL = "Framerate: %s %s"
  eq(ns.GameFormat("MAINMENUBAR_FPS_LABEL", "Framerate: %.0f fps", 30), "Framerate: 30 fps", "other values: English")
  TOTAL_MEM_MB_ABBR = "Speicher für Addons: %.2f MB"
  eq(ns.TotalMemoryLine(2048), "Speicher für Addons: 2.00 MB")
  eq(ns.TotalMemoryLine(500), "AddOn Memory: 500 KB")
  eq(ns.AddonMemoryLine({ name = "Details", kb = 1536 }), "(1.50 MB) Details")
  eq(ns.AddonMemoryLine({ name = "Tiny", kb = 12.4 }), "(12 KB) Tiny")
  eq(ns.Conversions("100%% %.0f %s"), "f,s")
end)

test("top list: heaviest first, ties by name, fewer than five", function(wow)
  local ns = boot(wow)
  local entries = { { name = "B", kb = 10 }, { name = "A", kb = 10 }, { name = "C", kb = 30 } }
  local top = ns.Top(entries, 5)
  eq(#top, 3)
  eq(top[1].name, "C")
  eq(top[2].name, "A", "same size: by name")
  eq(entries[1].name, "B", "the scan itself stays unsorted")
  eq(#ns.Top(entries, 2), 2)
  eq(ns.Total(entries), 50)
  eq(ns.Total({}), 0)
end)

test("login shows the meter at once with all three numbers", function(wow)
  local ns = boot(wow)
  local f = PerfMeterFrame
  eq(f.shown, true)
  eq(pc.updates, 1, "one memory scan at login")
  eq(plain(f.text.text), "60 fps  40/55 ms  AddOns 140.1 MB")
  eq(PerfMeterDB.hidden, false)
  eq(f.point[1], "TOP", "default place")
  eq(f.point[5], -100)
end)

test("the numbers update once per second, not every frame", function(wow)
  local ns = boot(wow)
  local f = PerfMeterFrame
  pc.fps = 30
  run(wow, 0.75)
  eq(plain(f.text.text):sub(1, 6), "60 fps", "not yet")
  run(wow, 0.25)
  eq(plain(f.text.text):sub(1, 6), "30 fps", "after one second")
  local reads = 0
  GetFramerate = function() reads = reads + 1 return 30 end
  run(wow, 10, 1 / 64)
  eq(reads, 10, "ten reads in ten seconds at 64 frames per second")
end)

test("memory scan at most every 15 seconds", function(wow)
  local ns = boot(wow)
  eq(pc.updates, 1)
  run(wow, 14)
  eq(pc.updates, 1, "not before 15 seconds")
  run(wow, 1)
  eq(pc.updates, 2)
  pc.addons[1].kb = 102400
  run(wow, 15)
  eq(pc.updates, 3)
  eq(ns.scan.total, 102400 + 81920 + 20480 + 120)
  run(wow, 60)
  eq(pc.updates, 7, "four more in a minute")
  eq(ns.ShouldScan(nil, 0, false), true, "first scan")
  eq(ns.ShouldScan(100, 114.9, false), false)
  eq(ns.ShouldScan(100, 115, false), true)
  eq(ns.ShouldScan(100, 500, true), false, "never in combat")
end)

test("no memory scan in combat: the last total stays, the scan follows after combat", function(wow)
  local ns = boot(wow)
  local f = PerfMeterFrame
  pc.combat = true
  pc.fps = 20
  pc.addons[2].kb = 1
  run(wow, 60)
  eq(pc.updates, 1, "nothing measured in combat")
  eq(plain(f.text.text), "20 fps  40/55 ms  AddOns 140.1 MB", "framerate goes on, memory keeps the last total")
  eq(ns.ScanMemory(wow.clock), false, "a direct call refuses as well")
  pc.combat = false
  run(wow, 1)
  eq(pc.updates, 2, "right after combat")
  eq(ns.scan.total, 40960 + 1 + 20480 + 120)
end)

test("login in combat: no memory yet, the tooltip says why", function(wow)
  model()
  addons({ { "Details", 4096 } })
  pc.combat = true
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("PLAYER_LOGIN")
  local f = PerfMeterFrame
  eq(pc.updates, 0)
  eq(plain(f.text.text), "60 fps  40/55 ms  AddOns ...")
  f.scripts.OnEnter(f)
  local tip = table.concat(wow.tooltip.lines, "\n")
  eq(plain(tip):find("Addon memory is measured outside of combat.", 1, true) ~= nil, true)
  eq(plain(tip):find("Memory is not measured during combat.", 1, true) ~= nil, true)
end)

test("only loaded addons of players are measured; an error is skipped", function(wow)
  local ns = boot(wow)
  addons({ { "Details", 2048 }, { "Off", 999, loaded = false }, { "Blizzard_Thing", 5000, security = "SECURE" },
    { "Guarded", 5000, security = "SECURE_PROTECTED" }, { "Weird", -1 }, { "Hidden", { secret = true } } })
  GetAddOnMemoryUsage = function(index)
    table.insert(pc.asked, index)
    if pc.addons[index].name == "Weird" then error("boom") end
    return pc.addons[index].kb
  end
  pc.asked = {}
  ns.ScanMemory(wow.clock)
  eq(table.concat(pc.asked, ","), "1,5,6", "not the unloaded and not the secure ones")
  eq(#ns.scan.entries, 1)
  eq(ns.scan.entries[1].name, "Details", "folder name, not the title")
  eq(ns.scan.total, 2048)
end)

test("secret or missing values show as unknown, never as numbers", function(wow)
  local ns = boot(wow)
  local f = PerfMeterFrame
  pc.fps = { secret = true }
  pc.home, pc.world = 0, { secret = true }
  run(wow, 1)
  eq(plain(f.text.text), "...  .../... ms  AddOns 140.1 MB")
  eq(ns.Latency(0), nil, "0 ms means not measured yet")
  eq(ns.Latency(35), 35)
  eq(ns.Plain(0 / 0), nil, "not a number")
end)

test("a client without these functions: no error, nothing shown", function(wow)
  model()
  GetFramerate, GetNetStats, UpdateAddOnMemoryUsage, GetAddOnMemoryUsage, C_AddOns, InCombatLockdown = nil, nil, nil, nil, nil, nil
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("PLAYER_LOGIN")
  run(wow, 20)
  eq(plain(PerfMeterFrame.text.text), "...  .../... ms  AddOns ...")
  eq(ns.ScanMemory(1), false)
  PerfMeterFrame.scripts.OnEnter(PerfMeterFrame)
  eq(wow.tooltip.shown, true)
end)

test("tooltip: the game's own lines and the five heaviest addons", function(wow)
  local ns = boot(wow)
  addons({ { "A", 1024 }, { "B", 2048 }, { "C", 3072 }, { "D", 4096 }, { "E", 5120 }, { "F", 6144 }, { "Small", 100 } })
  run(wow, 15)
  local f = PerfMeterFrame
  f.scripts.OnEnter(f)
  local lines = wow.tooltip.lines
  eq(wow.tooltip.owner, f)
  eq(lines[1], "Perf Meter")
  eq(lines[2], "Framerate: 60 fps")
  eq(lines[3], "Latency:\n40 ms (home)\n55 ms (world)")
  eq(lines[5], "AddOn Memory: 21.10 MB")
  eq(lines[6], "(6.00 MB) F")
  eq(lines[10], "(2.00 MB) B", "five addons")
  eq(plain(lines[11]), "Memory scan: 0 s ago.")
  eq(plain(lines[12]), "Drag to move. /perfmeter lock keeps it in place.")
  eq(#lines, 12)
  wow.slash("/pm lock")
  run(wow, 1)
  eq(wow.tooltip.shown, true, "refreshed while the mouse is on the meter")
  eq(plain(wow.tooltip.lines[11]), "Memory scan: 1 s ago.")
  eq(#wow.tooltip.lines, 11, "no drag hint when locked")
  f.scripts.OnLeave(f)
  eq(wow.tooltip.shown, false)
  local shown = 0
  GameTooltip.Show = function() shown = shown + 1 end
  run(wow, 3)
  eq(shown, 0, "not refreshed after the mouse left")
end)

test("position: saved per account, locked meter does not move, reset", function(wow)
  local ns = boot(wow)
  local f = PerfMeterFrame
  local moving = false
  f.StartMoving = function() moving = true end
  f.scripts.OnDragStart(f)
  eq(moving, true)
  f.point = { "BOTTOMLEFT", UIParent, "BOTTOMLEFT", 300, 40 }
  f.scripts.OnDragStop(f)
  eq(PerfMeterDB.point[1], "BOTTOMLEFT")
  eq(PerfMeterDB.point[3], 300)
  eq(PerfMeterDB.point[4], 40)
  wow.slash("/perfmeter lock")
  eq(PerfMeterDB.locked, true)
  moving = false
  f.scripts.OnDragStart(f)
  eq(moving, false, "locked")
  wow.slash("/perfmeter unlock")
  f.scripts.OnDragStart(f)
  eq(moving, true)
  wow.slash("/perfmeter reset")
  eq(PerfMeterDB.point, nil)
  eq(f.point[1], "TOP")
end)

test("saved settings come back after a reload", function(wow)
  local ns = boot(wow, { point = { "BOTTOMLEFT", "BOTTOMLEFT", 300, 40 }, locked = true, hidden = false })
  local f = PerfMeterFrame
  eq(f.point[1], "BOTTOMLEFT")
  eq(f.point[2], UIParent)
  eq(f.point[4], 300)
  eq(f.point[5], 40)
  local moving = false
  f.StartMoving = function() moving = true end
  f.scripts.OnDragStart(f)
  eq(moving, false, "still locked")
end)

test("a hidden meter stays hidden after a reload and measures nothing", function(wow)
  local ns = boot(wow, { hidden = true })
  eq(PerfMeterFrame, nil, "not even created")
  eq(pc.updates, 0, "no memory scan while hidden")
  wow.slash("/pm")
  eq(PerfMeterFrame.shown, true)
  eq(PerfMeterDB.hidden, false)
  eq(pc.updates, 1)
end)

test("slash commands: show, hide, toggle, lock, unlock, reset, help", function(wow)
  local ns = boot(wow)
  local f = PerfMeterFrame
  wow.slash("/perfmeter")
  eq(f.shown, false, "toggle hides")
  eq(PerfMeterDB.hidden, true)
  wow.slash("/pm")
  eq(f.shown, true, "toggle shows")
  wow.slash("/perfmeter hide")
  eq(f.shown, false)
  wow.slash("/perfmeter HIDE")
  eq(f.shown, false, "hide twice stays hidden")
  local before = pc.updates
  wow.clock = wow.clock + 30
  wow.slash("/perfmeter show")
  eq(f.shown, true)
  eq(pc.updates, before + 1, "showing again fills it at once")
  wow.slash("/pm lock")
  eq(plain(lastChat(wow)), "Perf Meter: The meter is locked.")
  wow.slash("/pm unlock")
  eq(plain(lastChat(wow)), "Perf Meter: The meter is unlocked. Drag it to move it.")
  wow.slash("/pm reset")
  eq(plain(lastChat(wow)), "Perf Meter: The meter is back at the top of the screen.")
  wow.slash("/pm help")
  local help = lastChat(wow)
  eq(help:find("/perfmeter shows or hides the meter", 1, true) ~= nil, true)
  eq(help:gsub("|c%x+", ""):gsub("|r", ""):find("|", 1, true), nil, "help text uses / and never |")
end)

test("hiding the meter while the mouse is on it closes the tooltip", function(wow)
  local ns = boot(wow)
  local f = PerfMeterFrame
  f.scripts.OnEnter(f)
  eq(wow.tooltip.shown, true)
  wow.slash("/pm hide")
  eq(wow.tooltip.shown, false)
  wow.slash("/pm show")
  eq(wow.tooltip.shown, false, "not reopened without the mouse")
end)

test("slash before login does nothing", function(wow)
  model()
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.slash("/perfmeter lock")
  eq(PerfMeterFrame, nil)
  eq(#wow.chat, 0)
end)

-- 1.1: German ------------------------------------------------------------------------------------------

-- Every placeholder of a text, in order: "%d", "%s", "%%".
local function placeholders(text)
  local out = {}
  for p in text:gmatch("%%[%d%.]*[%a%%]") do out[#out + 1] = p end
  return table.concat(out, " ")
end

-- Every command in a text with its words: "/perfmeter lock, /perfmeter reset, /pm".
local WORDS = { show = true, hide = true, lock = true, unlock = true, reset = true }
local function commands(text)
  local out = {}
  for cmd, rest in text:gmatch("(/p[em]%a*)([^,%.%(%)]*)") do
    if cmd == "/perfmeter" or cmd == "/pm" then
      local word = rest:match("^ (%a+)")
      out[#out + 1] = (word and WORDS[word]) and (cmd .. " " .. word) or cmd
    end
  end
  return table.concat(out, ", ")
end

test("German client: the meter, the tooltip and every answer to a command in German", function(wow)
  MAINMENUBAR_FPS_LABEL = "Framerate: %.0f FPS"
  local ns = boot(wow, nil, "deDE")
  local f = PerfMeterFrame
  eq(plain(f.text.text), "60 FPS  40/55 ms  AddOns 140.1 MB", "unit and values as in 1.0, ADDONS from the client")
  f.scripts.OnEnter(f)
  local lines = wow.tooltip.lines
  eq(lines[1], "Perf Meter")
  eq(lines[2], "Framerate: 60 FPS", "the game's own line")
  eq(plain(lines[#lines - 1]), "Speichermessung: vor 0 s.")
  eq(plain(lines[#lines]), "Zum Verschieben ziehen. /perfmeter lock hält die Anzeige fest.")
  f.scripts.OnLeave(f)
  wow.slash("/pm lock")
  eq(plain(lastChat(wow)), "Perf Meter: Die Anzeige ist gesperrt.")
  wow.slash("/pm unlock")
  eq(plain(lastChat(wow)), "Perf Meter: Die Anzeige ist entsperrt. Zieh sie, um sie zu verschieben.")
  wow.slash("/pm reset")
  eq(plain(lastChat(wow)), "Perf Meter: Die Anzeige ist wieder oben am Bildschirm.")
  wow.slash("/pm help")
  eq(plain(lastChat(wow)), "Perf Meter: /perfmeter blendet die Anzeige ein oder aus, /perfmeter lock oder unlock sperrt oder entsperrt sie, /perfmeter reset setzt sie wieder nach oben.")
end)

test("German client in combat: the tooltip says in German why memory is missing", function(wow)
  model()
  wow.locale = "deDE"
  addons({ { "Details", 4096 } })
  pc.combat = true
  wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("PLAYER_LOGIN")
  local f = PerfMeterFrame
  f.scripts.OnEnter(f)
  local tip = plain(table.concat(wow.tooltip.lines, "\n"))
  eq(tip:find("Der Speicher der Addons wird außerhalb des Kampfes gemessen.", 1, true) ~= nil, true)
  eq(tip:find("Im Kampf wird kein Speicher gemessen.", 1, true) ~= nil, true)
end)

test("German client: place, lock and hidden state saved in 1.0 are kept", function(wow)
  local ns = boot(wow, { point = { "BOTTOMLEFT", "BOTTOMLEFT", 300, 40 }, locked = true, hidden = false }, "deDE")
  local f = PerfMeterFrame
  eq(f.point[1], "BOTTOMLEFT")
  eq(f.point[4], 300)
  eq(PerfMeterDB.locked, true)
  local moving = false
  f.StartMoving = function() moving = true end
  f.scripts.OnDragStart(f)
  eq(moving, false, "still locked")
  ns = boot(wow, { hidden = true }, "deDE")
  eq(pc.updates, 0, "a hidden meter stays hidden")
end)

test("German texts keep every placeholder and command of the English text, in order", function(wow)
  local ns = boot(wow, nil, "deDE")
  local n = 0
  for key, text in pairs(ns.L) do
    n = n + 1
    eq(placeholders(text), placeholders(key), key)
    eq(commands(text), commands(key), "the commands stay: " .. key)
    eq(text:find("|", 1, true), nil, "no | in a German text: " .. key)
  end
  eq(n, 10, "every text on screen has its German one")
  eq(commands("/perfmeter lock or unlock fixes it, /perfmeter reset puts it back. Short form: /pm."), "/perfmeter lock, /perfmeter reset, /pm")
end)

test("an English client keeps the English texts", function(wow)
  local ns = boot(wow, nil, "enUS")
  eq(next(ns.L), nil)
  eq(plain(PerfMeterFrame.text.text), "60 fps  40/55 ms  AddOns 140.1 MB")
  wow.slash("/pm lock")
  eq(plain(lastChat(wow)), "Perf Meter: The meter is locked.")
  wow.slash("/pm help")
  eq(plain(lastChat(wow)), "Perf Meter: /perfmeter shows or hides the meter, /perfmeter lock or unlock fixes or frees it, /perfmeter reset puts it back at the top.")
end)
