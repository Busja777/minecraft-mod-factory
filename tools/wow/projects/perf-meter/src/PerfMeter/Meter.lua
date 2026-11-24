local _, ns = ...

-- Reads the game's numbers. Framerate and latency are cheap and read once per second;
-- the addon memory needs UpdateAddOnMemoryUsage, which is expensive, so it runs at most every
-- SCAN_INTERVAL seconds and never in combat. Nothing runs while the meter is hidden.

ns.scan = nil     -- { total, entries = { { name, kb } }, at } of the last memory scan
ns.lastScan = nil -- GetTime() of the last memory scan

function ns.InCombat()
  return InCombatLockdown ~= nil and InCombatLockdown() and true or false
end

-- Framerate and latency right now, plus the memory total of the last scan.
function ns.Read()
  local reading = {}
  if GetFramerate then reading.fps = ns.Plain(GetFramerate()) end
  if GetNetStats then
    local _, _, home, world = GetNetStats()
    reading.home, reading.world = ns.Latency(home), ns.Latency(world)
  end
  reading.memory = ns.scan and ns.scan.total or nil
  return reading
end

-- One addon's memory in KB, or nil. GetAddOnMemoryUsage raises an error for the game's own (secure)
-- addons, so only loaded, insecure addons are asked, and the call is wrapped in pcall as well.
local function addonMemory(api, index)
  local name, _, _, _, _, security = api.GetAddOnInfo(index)
  name = ns.PlainText(name)
  if not name then return nil end
  if security ~= nil and security ~= "INSECURE" then return nil end
  if api.IsAddOnLoaded then
    local loaded = api.IsAddOnLoaded(index)
    if ns.IsSecret(loaded) or not loaded then return nil end
  end
  local ok, kb = pcall(GetAddOnMemoryUsage, index)
  kb = ok and ns.Plain(kb) or nil
  if not kb or kb < 0 then return nil end
  return name, kb
end

-- Measures the memory of every loaded addon. Returns true when it measured.
function ns.ScanMemory(now)
  if ns.InCombat() then return false end
  local api = C_AddOns
  if not UpdateAddOnMemoryUsage or not GetAddOnMemoryUsage or not api or not api.GetNumAddOns or not api.GetAddOnInfo then
    return false
  end
  UpdateAddOnMemoryUsage()
  local count = ns.Plain(api.GetNumAddOns()) or 0
  local entries = {}
  for i = 1, count do
    local name, kb = addonMemory(api, i)
    if name then entries[#entries + 1] = { name = name, kb = kb } end
  end
  ns.scan = { total = ns.Total(entries), entries = entries, at = now }
  ns.lastScan = now
  return true
end

-- One second of the meter: maybe a memory scan, then the new numbers on screen.
function ns.Tick(now)
  if ns.ShouldScan(ns.lastScan, now, ns.InCombat()) then ns.ScanMemory(now) end
  ns.reading = ns.Read()
  if ns.Refresh then ns.Refresh() end
end

local frame = CreateFrame("Frame")
ns.eventFrame = frame

frame:SetScript("OnEvent", function(_, event)
  if event == "PLAYER_LOGIN" then
    PerfMeterDB = type(PerfMeterDB) == "table" and PerfMeterDB or {}
    ns.db = PerfMeterDB
    if ns.Setup then ns.Setup() end
  end
end)

frame:RegisterEvent("PLAYER_LOGIN")
