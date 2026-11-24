local _, ns = ...
local L = ns.L

-- Pure decisions: no frames, no events. Everything here runs outside the game in the tests.

ns.DELAY = 1  -- seconds between the moment and the screenshot, so the game's toast is in the picture
ns.GAP = 10   -- at most one screenshot in this many seconds
ns.EPIC = 4   -- Enum.ItemQuality.Epic; Legendary, Artifact and Heirloom are higher

-- Game texts of a loot chat line about the player, each with the English text as fallback for a
-- client without it. The longer one ("... x2") comes first.
ns.SELF_LOOT = {
  { "LOOT_ITEM_SELF_MULTIPLE", "You receive loot: %sx%d" },
  { "LOOT_ITEM_SELF", "You receive loot: %s" },
}

function ns.IsSecret(value)
  return issecretvalue ~= nil and issecretvalue(value) and true or false
end

-- A text the game has in the player's language (a GlobalStrings constant); the English one otherwise.
function ns.GameText(global, english)
  local text = _G[global]
  if type(text) ~= "string" or text == "" or ns.IsSecret(text) then return english end
  return text
end

-- A text read from the game; nil when it is secret, missing or empty.
function ns.CleanText(value)
  if value == nil or ns.IsSecret(value) or type(value) ~= "string" then return nil end
  local s = value:gsub("^%s+", ""):gsub("%s+$", "")
  if s == "" then return nil end
  return s
end

-- A level read from the game; nil when it is secret, missing or not a positive whole number.
function ns.CleanLevel(value)
  if value == nil or ns.IsSecret(value) or type(value) ~= "number" then return nil end
  if value ~= value or value < 1 or value > 1000 then return nil end
  return math.floor(value)
end

-- A format string of the game ("You receive loot: %s", also "%1$s") as an anchored Lua pattern.
-- A full stop at the end is optional: some clients write one, others do not.
function ns.FormatPattern(fmt)
  local s = fmt:gsub("%.$", "")
  s = s:gsub("%%%%", "\3"):gsub("%%%d*%$?s", "\1"):gsub("%%%d*%$?d", "\2")
  s = s:gsub("[%^%$%(%)%%%.%[%]%*%+%-%?]", "%%%0")
  s = s:gsub("\1", "(.+)"):gsub("\2", "(%%d+)"):gsub("\3", "%%%%")
  return "^" .. s .. "%.?$"
end

-- The patterns of the loot lines about the player, in the client's language.
function ns.LootPatterns()
  local out = {}
  for _, t in ipairs(ns.SELF_LOOT) do out[#out + 1] = ns.FormatPattern(ns.GameText(t[1], t[2])) end
  return out
end

-- The first item link in a text, or nil.
function ns.FirstLink(text)
  return text:match("(|c[^|]*|Hitem:[^|]*|h.-|h|r)") or text:match("(|Hitem:[^|]*|h.-|h)")
end

-- The item link of a loot line about the player; nil for other players' loot, other lines and
-- secret texts.
function ns.SelfLootLink(text, patterns)
  if type(text) ~= "string" or ns.IsSecret(text) then return nil end
  for _, pattern in ipairs(patterns) do
    if text:find(pattern) then return ns.FirstLink(text) end
  end
  return nil
end

-- True for an item quality of Epic or better; false for anything unknown or secret.
function ns.IsEpic(quality)
  if type(quality) ~= "number" or ns.IsSecret(quality) then return false end
  return quality >= ns.EPIC
end

-- What the chat line says about one moment.
function ns.LevelOccasion(level)
  level = ns.CleanLevel(level)
  if level then return string.format(L["level %d"], level) end
  return L["new level"]
end

function ns.AchievementOccasion(name)
  name = ns.CleanText(name)
  if name then return string.format(L["achievement %s"], name) end
  return L["achievement"]
end

function ns.LootOccasion(link)
  return string.format(L["epic loot %s"], link)
end

-- state = { last = time of the last screenshot planned, pending = { occasions } while one is
--           waiting for its delay, loading = true during a loading screen }
-- Decides about one moment at `now`:
--   "shoot"   a new screenshot is planned, take it after ns.DELAY;
--   "join"    a screenshot is already waiting, the moment is named in its chat line;
--   "wait"    the last screenshot is less than ns.GAP seconds ago;
--   "loading" a loading screen is up.
function ns.Offer(state, now, occasion)
  if state.loading then return "loading" end
  if state.pending then
    for _, o in ipairs(state.pending) do
      if o == occasion then return "join" end
    end
    state.pending[#state.pending + 1] = occasion
    return "join"
  end
  if state.last and now >= state.last and now - state.last < ns.GAP then return "wait" end
  state.last = now
  state.pending = { occasion }
  return "shoot"
end

-- Seconds until the next screenshot may be planned.
function ns.WaitLeft(state, now)
  if not state.last or now < state.last then return 0 end
  return math.max(0, math.ceil(ns.GAP - (now - state.last)))
end

-- The waiting moments, taken off the state; nil when there are none or a loading screen came up.
function ns.Take(state)
  local occasions = state.pending
  state.pending = nil
  if not occasions or state.loading then return nil end
  return occasions
end

function ns.SavedText(occasions)
  return string.format(L["Screenshot saved: %s."], table.concat(occasions, ", "))
end

function ns.FailedText(occasions)
  return string.format(L["The screenshot did not work: %s."], table.concat(occasions, ", "))
end
