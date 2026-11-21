local _, ns = ...

-- Pure decisions: no frames, no events. Everything here runs outside the game in the tests.

ns.RING_GAP = 30     -- seconds between two rings at least
ns.SETTLE = 10       -- seconds after entering the world in which readings only set the state
ns.LOGIN_DELAY = 5   -- seconds after login before the list of characters with mail is printed

ns.SETTINGS = { "sound", "login" }
ns.DEFAULTS = { sound = true, login = true }

ns.EXPIRE_DEFAULT = 3 -- days: mail with items or gold that runs out within this many days is named
ns.EXPIRE_MAX = 30    -- the game keeps mail for 30 days at most
ns.DAY = 86400        -- seconds

function ns.IsSecret(value)
  return issecretvalue ~= nil and issecretvalue(value) and true or false
end

-- The bell's memory for this session: has the first reading been taken, was there new mail at the
-- last reading, when did it last ring, until when do readings only set the state.
function ns.NewRingState()
  return { known = false, had = false, lastRing = nil, quietUntil = nil }
end

-- After entering the world: the next readings tell what was already there, they do not ring.
function ns.Settle(state, now)
  state.known = false
  state.quietUntil = now + ns.SETTLE
end

-- One reading of "is there new mail". Returns true when the bell should ring now.
-- hasNew must be a plain boolean; anything else (missing, secret) is ignored.
function ns.ShouldRing(state, hasNew, now)
  if type(hasNew) ~= "boolean" or type(now) ~= "number" then return false end
  if not state.known or (state.quietUntil and now < state.quietUntil) then
    state.known = true
    state.had = hasNew
    return false
  end
  local arrived = hasNew and not state.had
  state.had = hasNew
  if not arrived then return false end
  if state.lastRing and now - state.lastRing < ns.RING_GAP then return false end
  state.lastRing = now
  return true
end

-- chars["Name-Realm"] = { mail = true|false, since = time of the first mail notice }
function ns.NoteMail(chars, key, now)
  local c = chars[key]
  if type(c) ~= "table" then
    c = {}
    chars[key] = c
  end
  if not c.mail then
    c.mail = true
    c.since = now
  elseif not c.since then
    c.since = now
  end
  return c
end

-- The player looked into the mailbox: nothing is waiting any more.
function ns.ClearMail(chars, key)
  local c = chars[key]
  if type(c) ~= "table" then
    c = {}
    chars[key] = c
  end
  c.mail = false
  c.since = nil
  return c
end

function ns.SplitKey(key)
  local name, realm = key:match("^(.-)%-(.+)$")
  if not name or name == "" then return key, nil end
  return name, realm
end

-- The other characters with mail waiting, the oldest notice first.
function ns.Waiting(chars, me)
  local list = {}
  for key, c in pairs(chars) do
    if key ~= me and type(c) == "table" and c.mail then list[#list + 1] = { key = key, since = c.since } end
  end
  table.sort(list, function(a, b)
    local sa, sb = tonumber(a.since) or 0, tonumber(b.since) or 0
    if sa ~= sb then return sa < sb end
    return a.key < b.key
  end)
  return list
end

-- "Brakk (Silvermoon)" for a character on another realm, "Yubi" for one on the player's realm.
function ns.DisplayName(key, myRealm)
  local name, realm = ns.SplitKey(key)
  if realm and realm ~= myRealm then return string.format("%s (%s)", name, realm) end
  return name
end

-- "Mail waiting on: Brakk (Silvermoon), Yubi"; nil when no other character has mail.
function ns.WaitingText(chars, me, myRealm)
  local list = ns.Waiting(chars, me)
  if #list == 0 then return nil end
  local names = {}
  for i, entry in ipairs(list) do names[i] = ns.DisplayName(entry.key, myRealm) end
  return string.format(ns.L["Mail waiting on: %s"], table.concat(names, ", "))
end

-- A number of days the expiry warning can use: a whole number from 0 (off) to 30, else nil.
function ns.ValidDays(value)
  if type(value) ~= "number" or value ~= value or value < 0 or value > ns.EXPIRE_MAX then return nil end
  if value ~= math.floor(value) then return nil end
  return value
end

-- Makes the saved table usable: settings with their defaults, the character list, nothing lost.
-- Version 1 (Mail Bell 1.0) had no expiry setting; it starts at 3 days.
function ns.PrepareDB(db)
  if type(db) ~= "table" then db = {} end
  db.version = 2
  if type(db.settings) ~= "table" then db.settings = {} end
  for _, name in ipairs(ns.SETTINGS) do
    if type(db.settings[name]) ~= "boolean" then db.settings[name] = ns.DEFAULTS[name] end
  end
  if not ns.ValidDays(db.settings.expire) then db.settings.expire = ns.EXPIRE_DEFAULT end
  if type(db.chars) ~= "table" then db.chars = {} end
  return db
end

-- "5" → 5, "off" or "0" → 0; anything else (also more than 30 days) → nil.
function ns.ParseDays(word)
  word = (word or ""):lower()
  if word == "off" then return 0 end
  if not word:match("^%d+$") then return nil end
  return ns.ValidDays(tonumber(word))
end

-- Looks at the letters of the inbox. Each letter is { money, cod, daysLeft, hasItem } as the game
-- told it; a letter with a secret or missing value is left out. Only letters with items or gold
-- count, and not cash-on-delivery letters (they go back to the sender, nothing of yours is lost).
-- Returns the days left of the letter that runs out first (nil when there is none), how many run
-- out within warnDays, and the days left of the first of those.
function ns.ScanExpiry(letters, warnDays)
  local soonest, count = nil, 0
  for _, m in ipairs(letters) do
    local days, money, cod, items = m.daysLeft, m.money, m.cod, m.hasItem
    local usable = not (ns.IsSecret(days) or ns.IsSecret(money) or ns.IsSecret(cod) or ns.IsSecret(items))
    if usable and type(days) == "number" and days >= 0 then
      local hasGold = type(money) == "number" and money > 0
      local hasItems = (type(items) == "number" and items > 0) or items == true
      local isCod = type(cod) == "number" and cod > 0
      if (hasGold or hasItems) and not isCod then
        if not soonest or days < soonest then soonest = days end
        if warnDays and warnDays > 0 and math.floor(days) <= warnDays then count = count + 1 end
      end
    end
  end
  return soonest, count
end

-- Remembers when the first letter with items or gold of a character runs out (a time() value),
-- or forgets it when there is none.
function ns.NoteExpiry(chars, key, soonestDays, now)
  local c = chars[key]
  if type(c) ~= "table" then
    c = {}
    chars[key] = c
  end
  if type(soonestDays) == "number" and type(now) == "number" then
    c.expires = math.floor(now + soonestDays * ns.DAY)
  else
    c.expires = nil
  end
  return c
end

-- "less than a day", "1 day", "4 days": whole days, as the mailbox shows them.
function ns.DaysText(days)
  local L = ns.L
  local whole = math.floor(days)
  if whole < 1 then return L["less than a day"] end
  if whole == 1 then return L["1 day"] end
  return string.format(L["%d days"], whole)
end

-- The chat line when the mailbox is open; nil when nothing runs out soon.
function ns.ExpiryWarning(count, soonest, warnDays)
  local L = ns.L
  if type(count) ~= "number" or count < 1 or type(soonest) ~= "number" then return nil end
  if count == 1 then
    return string.format(L["A letter with items or gold runs out in %s. Take it out before it is returned or deleted."], ns.DaysText(soonest))
  end
  return string.format(L["%d letters with items or gold run out within %s, the first in %s. Take them out before they are returned or deleted."],
    count, ns.DaysText(warnDays), ns.DaysText(soonest))
end

-- The characters whose first letter with items or gold runs out within warnDays from now, soonest
-- first, the player's own character included. A time that has passed is skipped: that mail is gone.
function ns.Expiring(chars, now, warnDays)
  local list = {}
  if type(now) ~= "number" or not ns.ValidDays(warnDays) or warnDays == 0 then return list end
  for key, c in pairs(chars) do
    if type(c) == "table" and type(c.expires) == "number" then
      local left = (c.expires - now) / ns.DAY
      if left > 0 and math.floor(left) <= warnDays then list[#list + 1] = { key = key, left = left } end
    end
  end
  table.sort(list, function(a, b)
    if a.left ~= b.left then return a.left < b.left end
    return a.key < b.key
  end)
  return list
end

-- "Mail with items or gold runs out soon on: Yubi in 1 day, Brakk (Silvermoon) in 2 days"; nil when none.
function ns.ExpiringText(chars, now, warnDays, myRealm)
  local list = ns.Expiring(chars, now, warnDays)
  if #list == 0 then return nil end
  local parts = {}
  for i, entry in ipairs(list) do
    parts[i] = string.format(ns.L["%s in %s"], ns.DisplayName(entry.key, myRealm), ns.DaysText(entry.left))
  end
  return string.format(ns.L["Mail with items or gold runs out soon on: %s"], table.concat(parts, ", "))
end

-- "on" / "off" → true / false; anything else → nil.
function ns.ParseSwitch(word)
  word = (word or ""):lower()
  if word == "on" then return true end
  if word == "off" then return false end
  return nil
end

-- Sets one setting from a word. Returns the new value, or nil when the name or word is unknown.
function ns.Switch(settings, name, word)
  if ns.DEFAULTS[name] == nil then return nil end
  local value = ns.ParseSwitch(word)
  if value == nil then return nil end
  settings[name] = value
  return value
end

-- The saved character a typed name means, ignoring case. Returns the key or nil.
function ns.FindChar(chars, wanted)
  if not wanted or wanted == "" then return nil end
  local lower = wanted:lower()
  for key in pairs(chars) do
    if key:lower() == lower then return key end
  end
  return nil
end
