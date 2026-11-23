local _, ns = ...
local L = ns.L

-- Pure bookkeeping: no frames, no events. Everything here runs outside the game in the tests.
--
-- people = { [key] = { name = "Grumbash-Argent Dawn", first = t, last = t, times = n, zone = "...", note = "..." } }
-- key    = "grumbash-argentdawn": lower case, realm without spaces, hyphens or apostrophes, so
--          "Argent Dawn" (UnitName) and "ArgentDawn" (typed) are the same player.
-- session = { seen = { [key] = true }, skip = { [key] = true }, at = t }: the players already counted in
--           the current group, and the ones forgotten during it (they stay out until the group ends).

ns.MAX_PEOPLE = 2000   -- players kept; the ones met longest ago go first, players with a note last
ns.SESSION_GAP = 3600  -- seconds offline after which a saved group session counts as over
ns.LIST = 10           -- players shown by /mb list
ns.MAX_NOTE = 200      -- characters of a note

function ns.IsSecret(value)
  return issecretvalue ~= nil and issecretvalue(value) and true or false
end

-- A text read from the game; nil when it is secret, missing or empty.
function ns.CleanText(value)
  if value == nil or ns.IsSecret(value) or type(value) ~= "string" then return nil end
  local s = value:gsub("^%s+", ""):gsub("%s+$", "")
  if s == "" then return nil end
  return s
end

function ns.NormalizeRealm(realm)
  realm = ns.CleanText(realm)
  if not realm then return nil end
  realm = realm:gsub("[%s%-']", ""):lower()
  if realm == "" then return nil end
  return realm
end

-- The key of a player, or nil when the name is unusable. A missing realm is the home realm.
function ns.Key(name, realm, home)
  name = ns.CleanText(name)
  if not name or name:find("[%s%-]") then return nil end
  local r = ns.NormalizeRealm(realm) or ns.NormalizeRealm(home)
  if not r then return nil end
  return name:lower() .. "-" .. r
end

-- "Name-Realm" as shown in chat; the realm as the game or the player wrote it.
function ns.DisplayName(name, realm, home)
  name = ns.CleanText(name)
  realm = ns.CleanText(realm) or ns.CleanText(home)
  if not name then return nil end
  if not realm then return name end
  return name .. "-" .. realm
end

-- "Grumbash-Argent Dawn" -> "Grumbash", "Argent Dawn"; "Grumbash" -> "Grumbash", nil.
function ns.SplitTyped(text)
  text = ns.CleanText(text)
  if not text then return nil end
  local name, realm = text:match("^([^%-]+)%-(.+)$")
  if not name then return text, nil end
  return ns.CleanText(name), ns.CleanText(realm)
end

-- Whether a saved group session still counts after a login or a reload.
function ns.ContinueSession(session, now, inGroup)
  if not inGroup or type(session) ~= "table" or type(session.seen) ~= "table" then return false end
  if type(session.at) ~= "number" or type(now) ~= "number" then return false end
  return now >= session.at and now - session.at < ns.SESSION_GAP
end

function ns.NewSession(now)
  return { seen = {}, skip = {}, at = now }
end

local function count(people)
  local n = 0
  for _ in pairs(people) do n = n + 1 end
  return n
end

-- Removes the players met longest ago until at most `max` are left. Players with a note go last.
function ns.Prune(people, max)
  max = max or ns.MAX_PEOPLE
  local n = count(people)
  if n <= max then return 0 end
  local rows = {}
  for key, p in pairs(people) do rows[#rows + 1] = { key = key, note = p.note ~= nil, last = p.last or 0 } end
  table.sort(rows, function(a, b)
    if a.note ~= b.note then return not a.note end
    if a.last ~= b.last then return a.last < b.last end
    return a.key < b.key
  end)
  local removed = n - max
  for i = 1, removed do people[rows[i].key] = nil end
  return removed
end

-- members = { { name = , realm = }, ... } as read from the group; secret or broken names are skipped.
-- Updates last seen and zone for everyone, counts a meeting once per group session.
-- Returns the number of players counted as a new meeting.
function ns.Record(people, session, members, now, zone, home, selfKey)
  local counted = 0
  zone = ns.CleanText(zone)
  for _, m in ipairs(members) do
    local key = ns.Key(m.name, m.realm, home)
    if key and key ~= selfKey and not (session.skip and session.skip[key]) then
      local p = people[key]
      if not p then
        p = { times = 0 }
        people[key] = p
      end
      p.name = ns.DisplayName(m.name, m.realm, home)
      if not session.seen[key] then
        session.seen[key] = true
        p.times = (p.times or 0) + 1
        p.first = p.first or now
        counted = counted + 1
      end
      p.last = now
      if zone then p.zone = zone end
    end
  end
  session.at = now
  if counted > 0 then ns.Prune(people) end
  return counted
end

-- The key of a typed name. Without a realm: the home realm, else the only player of that name.
-- → key, or nil and a list of the matching display names when the name is not unique.
function ns.Find(people, typed, home)
  local name, realm = ns.SplitTyped(typed)
  if not name then return nil end
  local key = ns.Key(name, realm, home)
  if not key then return nil end
  if people[key] or realm then return people[key] and key or nil end
  local prefix = name:lower() .. "-"
  local found, names = nil, {}
  for k, p in pairs(people) do
    if k:sub(1, #prefix) == prefix then
      found = k
      names[#names + 1] = p.name or k
    end
  end
  if #names == 1 then return found end
  table.sort(names)
  return nil, names
end

-- "Grumbash-Argent Dawn great tank" -> "Grumbash-Argent Dawn", "great tank" when that player is known
-- (realm names can have spaces); otherwise the first word is the name.
function ns.SplitNameAndText(people, rest, home)
  local words = {}
  for w in rest:gmatch("%S+") do words[#words + 1] = w end
  if #words == 0 then return nil end
  if words[1]:find("-", 1, true) then
    for k = #words, 2, -1 do
      local candidate = table.concat(words, " ", 1, k)
      if ns.Find(people, candidate, home) then
        return candidate, table.concat(words, " ", k + 1)
      end
    end
  end
  return words[1], table.concat(words, " ", 2)
end

-- A note as stored: trimmed, shortened, and with "|" escaped so it cannot become a colour code.
function ns.CleanNote(text)
  text = ns.CleanText(text)
  if not text then return nil end
  if #text > ns.MAX_NOTE then text = text:sub(1, ns.MAX_NOTE) end
  return (text:gsub("|", "||"))
end

-- Sets or (with an empty text) removes the note on a player; a player never met is added.
-- → the entry and its key; nil when the name is unusable; nil, nil, names when it is not unique.
function ns.SetNote(people, typed, text, home)
  local key, names = ns.Find(people, typed, home)
  if not key then
    if names and #names > 1 then return nil, nil, names end
    local name, realm = ns.SplitTyped(typed)
    key = ns.Key(name, realm, home)
    if not key then return nil end
    if not ns.CleanNote(text) then return nil end
    people[key] = { times = 0, name = ns.DisplayName(name, realm, home) }
  end
  local p = people[key]
  p.note = ns.CleanNote(text)
  return p, key
end

-- The players met most recently, newest first.
function ns.Recent(people, n)
  local rows = {}
  for key, p in pairs(people) do rows[#rows + 1] = { key = key, p = p } end
  table.sort(rows, function(a, b)
    local la, lb = a.p.last or 0, b.p.last or 0
    if la ~= lb then return la > lb end
    return a.key < b.key
  end)
  local out = {}
  for i = 1, math.min(n or ns.LIST, #rows) do out[i] = rows[i].p end
  return out
end

function ns.AgoText(seconds)
  if type(seconds) ~= "number" or seconds < 0 then return L["just now"] end
  local days = math.floor(seconds / 86400)
  if days == 1 then return L["1 day ago"] end
  if days > 1 then return string.format(L["%d days ago"], days) end
  local hours = math.floor(seconds / 3600)
  if hours == 1 then return L["1 hour ago"] end
  if hours > 1 then return string.format(L["%d hours ago"], hours) end
  return L["just now"]
end

function ns.TimesText(times)
  if times == 1 then return L["1 time"] end
  return string.format(L["%d times"], times or 0)
end

-- "Met before: 3 times, last 2 days ago" or nil for a player you only noted.
function ns.MetText(p, now)
  if not p or not p.times or p.times < 1 then return nil end
  local text = string.format(L["Met before: %s"], ns.TimesText(p.times))
  if p.last then text = text .. string.format(L[", last %s"], ns.AgoText(now - p.last)) end
  return text
end

-- The tooltip lines of a player: { met line or nil, note line or nil }.
function ns.TooltipLines(p, now)
  if not p then return nil, nil end
  local note = p.note and string.format(L["Note: %s"], p.note) or nil
  return ns.MetText(p, now), note
end

-- One line of /mb list: "Grumbash-Argent Dawn: 3 times, last 2 days ago, Silvermoon City - note"
function ns.ListText(p, now)
  local parts = { p.name or "?" }
  local text
  if p.times and p.times > 0 then
    text = string.format(L["%s: %s, last %s"], parts[1], ns.TimesText(p.times), ns.AgoText(now - (p.last or now)))
    if p.zone then text = text .. string.format(L[" in %s"], p.zone) end
  else
    text = string.format(L["%s: not met yet"], parts[1])
  end
  if p.note then text = text .. string.format(L[" - %s"], p.note) end
  return text
end
