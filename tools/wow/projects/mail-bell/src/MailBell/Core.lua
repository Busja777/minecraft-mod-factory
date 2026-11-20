local _, ns = ...

-- Pure decisions: no frames, no events. Everything here runs outside the game in the tests.

ns.RING_GAP = 30     -- seconds between two rings at least
ns.SETTLE = 10       -- seconds after entering the world in which readings only set the state
ns.LOGIN_DELAY = 5   -- seconds after login before the list of characters with mail is printed

ns.SETTINGS = { "sound", "login" }
ns.DEFAULTS = { sound = true, login = true }

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

-- Makes the saved table usable: settings with their defaults, the character list, nothing lost.
function ns.PrepareDB(db)
  if type(db) ~= "table" then db = {} end
  db.version = 1
  if type(db.settings) ~= "table" then db.settings = {} end
  for _, name in ipairs(ns.SETTINGS) do
    if type(db.settings[name]) ~= "boolean" then db.settings[name] = ns.DEFAULTS[name] end
  end
  if type(db.chars) ~= "table" then db.chars = {} end
  return db
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
