-- Runs one addon's tests against the stand-in client.
--   luajit tools/wow/client/run.lua <addon folder> <test file>
-- The test file gets: test(name, fn(wow, installed, before)), eq(a, b, msg), ADDON_DIR, ADDON_NAME.
-- Every test starts with a fresh client; globals an addon creates are removed afterwards.
local here = arg[0]:match("^(.*)/[^/]*$") or "."
ADDON_DIR = arg[1]
ADDON_NAME = ADDON_DIR:match("([^/]+)/?$")

local passed, failed = 0, 0

function test(name, fn)
  local wow = dofile(here .. "/wow.lua")
  local before = {}
  for k in pairs(_G) do before[k] = true end
  wow.install()
  local installed = {}
  for k in pairs(_G) do if not before[k] then installed[k] = true end end
  local ok, err = pcall(fn, wow, installed, before)
  for k in pairs(_G) do if not before[k] then _G[k] = nil end end
  if ok then passed = passed + 1 else failed = failed + 1; print("FAIL " .. name .. "\n  " .. tostring(err)) end
end

function eq(a, b, msg)
  if a ~= b then error((msg or "") .. " expected " .. tostring(b) .. ", got " .. tostring(a), 2) end
end

dofile(arg[2])

print(string.format("%d passed, %d failed", passed, failed))
os.exit(failed == 0 and 0 or 1)
