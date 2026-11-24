local _, ns = ...

-- Pure decisions: no frames, no events, no game calls. Everything here runs outside the game in the tests.
--
-- CameraPlusDB = {
--   version = 1,
--   on = true,          -- maximum camera distance switched on
--   factor = 2.6,       -- the value Camera Plus keeps in the CVar while on
--   previous = "1.9",   -- the CVar as it was before switching on, restored when switched off
--   views = { ["Name-Realm"] = { [1] = true, [3] = true } }, -- slots this character has saved
-- }

-- The game's own setting for the maximum camera distance. Its settings slider ends at the game's
-- default; the game itself accepts values up to 2.6 in Retail.
ns.CVAR = "cameraDistanceMaxZoomFactor"
ns.MIN_FACTOR = 1
ns.MAX_FACTOR = 2.6
ns.GAME_DEFAULT = 1.9 -- used only when the game cannot tell its own default

-- The three slots the player sees and the game's view numbers behind them (SaveView / SetView know 1 to 5).
-- View 1 is the game's first-person view and is left alone. View 5 is left alone too: the game falls
-- back to it as its normal third-person view, and players often have it on the default key bindings.
-- That leaves views 2, 3 and 4 for the player's own positions.
ns.VIEWS = { 2, 3, 4 }

function ns.IsSecret(value)
  return issecretvalue ~= nil and issecretvalue(value) and true or false
end

-- A number from the game or from the player; nil when it is secret, missing or not a number.
function ns.ToNumber(value)
  if value == nil or ns.IsSecret(value) then return nil end
  local n = tonumber(value)
  if not n or n ~= n or n == math.huge or n == -math.huge then return nil end
  return n
end

-- Keeps a factor inside what the game accepts, rounded to two decimals.
function ns.Clamp(n)
  if n < ns.MIN_FACTOR then n = ns.MIN_FACTOR end
  if n > ns.MAX_FACTOR then n = ns.MAX_FACTOR end
  return math.floor(n * 100 + 0.5) / 100
end

-- "" or "max" means the highest factor; a number is clamped; anything else is nil.
function ns.ParseFactor(text)
  text = (text or ""):lower()
  if text == "" or text == "max" then return ns.MAX_FACTOR end
  local n = ns.ToNumber(text:gsub(",", "."))
  if not n then return nil end
  return ns.Clamp(n)
end

-- 2.6 -> "2.6", 2 -> "2", 1.95 -> "1.95"
function ns.FormatFactor(n)
  local s = string.format("%.2f", n):gsub("0+$", ""):gsub("%.$", "")
  return s
end

-- Two CVar values are the same setting (the game may answer "2.600000" for "2.6").
function ns.Same(a, b)
  local x, y = ns.ToNumber(a), ns.ToNumber(b)
  return x ~= nil and y ~= nil and math.abs(x - y) < 0.005
end

-- The value to put back when switching off: what was there before, else the game's default.
function ns.RestoreValue(previous, default)
  if ns.ToNumber(previous) then return tostring(previous) end
  if ns.ToNumber(default) then return tostring(default) end
  return ns.FormatFactor(ns.GAME_DEFAULT)
end

-- "1" -> 2, 1 (the game's view number and the slot); nil for anything that is not slot 1 to 3.
function ns.ViewFor(text)
  local slot = ns.ToNumber(text)
  if not slot or slot ~= math.floor(slot) then return nil end
  local view = ns.VIEWS[slot]
  if not view then return nil end
  return view, slot
end

-- "Save 2" -> "save", "2"
function ns.SplitCommand(msg)
  local cmd, rest = (msg or ""):match("^%s*(%S*)%s*(.-)%s*$")
  return (cmd or ""):lower(), rest or ""
end

-- Saved slots as text: { [3] = true, [1] = true } -> "1, 3"; nil when there are none.
function ns.SlotList(saved)
  local list = {}
  for slot = 1, #ns.VIEWS do
    if saved and saved[slot] then list[#list + 1] = tostring(slot) end
  end
  if #list == 0 then return nil end
  return table.concat(list, ", ")
end

-- Repairs saved settings from an older or damaged file.
function ns.CleanSettings(db)
  if type(db) ~= "table" then db = {} end
  db.version = 1
  db.on = db.on == true
  local factor = ns.ToNumber(db.factor)
  db.factor = factor and ns.Clamp(factor) or ns.MAX_FACTOR
  if not ns.ToNumber(db.previous) then db.previous = nil end
  if type(db.views) ~= "table" then db.views = {} end
  return db
end
