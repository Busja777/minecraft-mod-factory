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
ns.LETTERS = 5        -- letters with items or gold remembered per character (1.3)
ns.NAMED = 3          -- letters named in one chat line (1.3)
ns.SUBJECT_SIZE = 32  -- longer subjects are shortened in chat (1.3)

-- 1.2: the bell can be picked. The word typed in /mb sound and the game's SOUNDKIT name behind it.
-- "bell" is the sound of 1.0 and 1.1; a client without it falls back to the whisper sound, as before.
ns.SOUND_NAMES = { "bell", "chime", "horn", "warning", "whisper" }
ns.SOUND_KIT = {
  bell = "ALARM_CLOCK_WARNING_3",
  chime = "MAP_PING",
  horn = "READY_CHECK",
  warning = "RAID_WARNING",
  whisper = "TELL_MESSAGE",
}
ns.DEFAULT_SOUND = "bell"
ns.FALLBACK_SOUNDS = { "ALARM_CLOCK_WARNING_3", "TELL_MESSAGE" }

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
-- Version 2 (1.1) had no choice of bell; it starts with the bell it always played.
-- Version 3 (1.2) had no remembered letters; they come with the next visit to a mailbox.
function ns.PrepareDB(db)
  if type(db) ~= "table" then db = {} end
  db.version = 4
  if type(db.settings) ~= "table" then db.settings = {} end
  for _, name in ipairs(ns.SETTINGS) do
    if type(db.settings[name]) ~= "boolean" then db.settings[name] = ns.DEFAULTS[name] end
  end
  if not ns.ValidDays(db.settings.expire) then db.settings.expire = ns.EXPIRE_DEFAULT end
  db.settings.bell = ns.ValidSound(db.settings.bell) or ns.DEFAULT_SOUND
  if type(db.chars) ~= "table" then db.chars = {} end
  for _, c in pairs(db.chars) do
    if type(c) == "table" and c.letters ~= nil then c.letters = ns.CleanLetters(c.letters) end
  end
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
  local counted = ns.CountedLetters(letters)
  local count = 0
  for _, m in ipairs(counted) do
    if ns.Within(m.days, warnDays) then count = count + 1 end
  end
  return counted[1] and counted[1].days or nil, count
end

-- Whether a letter with days left is named by a warning for warnDays (0: the warning is off).
function ns.Within(days, warnDays)
  return type(warnDays) == "number" and warnDays > 0 and math.floor(days) <= warnDays
end

-- A text from the game for a chat line, or nil when it is missing, secret or empty.
local function plainText(value)
  if ns.IsSecret(value) or type(value) ~= "string" or value == "" then return nil end
  return value
end

-- 1.3: the letters that count (items or gold, no cash on delivery, see ScanExpiry) as
-- { days, sender, subject }, the one that runs out first at the top.
function ns.CountedLetters(letters)
  local list = {}
  for i, m in ipairs(letters) do
    local days, money, cod, items = m.daysLeft, m.money, m.cod, m.hasItem
    local usable = not (ns.IsSecret(days) or ns.IsSecret(money) or ns.IsSecret(cod) or ns.IsSecret(items))
    if usable and type(days) == "number" and days >= 0 then
      local hasGold = type(money) == "number" and money > 0
      local hasItems = (type(items) == "number" and items > 0) or items == true
      local isCod = type(cod) == "number" and cod > 0
      if (hasGold or hasItems) and not isCod then
        list[#list + 1] = { days = days, sender = plainText(m.sender), subject = plainText(m.subject), order = i }
      end
    end
  end
  table.sort(list, function(a, b)
    if a.days ~= b.days then return a.days < b.days end
    return a.order < b.order
  end)
  return list
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

-- 1.3: remembers the letters with items or gold that run out first (up to ns.LETTERS), each with
-- its sender, subject and the time() it runs out; nothing when there are none.
function ns.NoteLetters(chars, key, counted, now)
  local c = chars[key]
  if type(c) ~= "table" then
    c = {}
    chars[key] = c
  end
  local letters = {}
  if type(now) == "number" and type(counted) == "table" then
    for _, m in ipairs(counted) do
      if #letters >= ns.LETTERS then break end
      letters[#letters + 1] = { sender = m.sender, subject = m.subject, expires = math.floor(now + m.days * ns.DAY) }
    end
  end
  c.letters = #letters > 0 and letters or nil
  return c
end

-- Saved letters that can be used; nil when none is left.
function ns.CleanLetters(list)
  if type(list) ~= "table" then return nil end
  local clean = {}
  for _, m in ipairs(list) do
    if type(m) == "table" and type(m.expires) == "number" and m.expires == m.expires and #clean < ns.LETTERS then
      clean[#clean + 1] = {
        expires = m.expires,
        sender = type(m.sender) == "string" and m.sender ~= "" and m.sender or nil,
        subject = type(m.subject) == "string" and m.subject ~= "" and m.subject or nil,
      }
    end
  end
  return #clean > 0 and clean or nil
end

-- A text other players wrote, safe for the chat: shortened, and "|" cannot start a link or a colour.
local function chatSafe(text, size)
  if size and #text > size then
    text = text:sub(1, size - 3):gsub("[\192-\255][\128-\191]*$", "") .. "..."
  end
  return (text:gsub("|", "||"))
end

-- How a letter is named in chat: Brakk "Herbs", Brakk, "Herbs" or "a letter".
function ns.LetterLabel(sender, subject)
  local L = ns.L
  sender = type(sender) == "string" and sender ~= "" and chatSafe(sender) or nil
  subject = type(subject) == "string" and subject ~= "" and chatSafe(subject, ns.SUBJECT_SIZE) or nil
  if sender and subject then return string.format(L["%s \"%s\""], sender, subject) end
  if sender then return sender end
  if subject then return string.format(L["\"%s\""], subject) end
  return L["a letter"]
end

-- The first ns.NAMED names, then "and 2 more".
function ns.NameList(names)
  local shown = {}
  for i = 1, math.min(#names, ns.NAMED) do shown[i] = names[i] end
  local text = table.concat(shown, ", ")
  if #names > ns.NAMED then text = string.format(ns.L["%s and %d more"], text, #names - ns.NAMED) end
  return text
end

-- "less than a day", "1 day", "4 days": whole days, as the mailbox shows them.
function ns.DaysText(days)
  local L = ns.L
  local whole = math.floor(days)
  if whole < 1 then return L["less than a day"] end
  if whole == 1 then return L["1 day"] end
  return string.format(L["%d days"], whole)
end

-- The chat line when the mailbox is open; nil when nothing runs out soon. names (1.3, optional)
-- are the labels of the letters that run out soon, the first one first.
function ns.ExpiryWarning(count, soonest, warnDays, names)
  local L = ns.L
  if type(count) ~= "number" or count < 1 or type(soonest) ~= "number" then return nil end
  if type(names) == "table" and #names > 0 then
    if count == 1 then
      return string.format(L["A letter with items or gold runs out in %s: %s. Take it out before it is returned or deleted."],
        ns.DaysText(soonest), ns.NameList(names))
    end
    return string.format(L["%d letters with items or gold run out within %s, the first in %s: %s. Take them out before they are returned or deleted."],
      count, ns.DaysText(warnDays), ns.DaysText(soonest), ns.NameList(names))
  end
  if count == 1 then
    return string.format(L["A letter with items or gold runs out in %s. Take it out before it is returned or deleted."], ns.DaysText(soonest))
  end
  return string.format(L["%d letters with items or gold run out within %s, the first in %s. Take them out before they are returned or deleted."],
    count, ns.DaysText(warnDays), ns.DaysText(soonest))
end

-- 1.3: the line at login for the character being played, from what its last mailbox visit showed
-- (the inbox cannot be read at login). nil when nothing it saw runs out within warnDays from now.
function ns.OwnExpiryText(c, now, warnDays)
  local L = ns.L
  if type(c) ~= "table" or type(now) ~= "number" or not ns.ValidDays(warnDays) or warnDays == 0 then return nil end
  local names, soonest = {}, nil
  for _, m in ipairs(type(c.letters) == "table" and c.letters or {}) do
    local left = (m.expires - now) / ns.DAY
    if left > 0 and ns.Within(left, warnDays) then
      names[#names + 1] = ns.LetterLabel(m.sender, m.subject)
      soonest = soonest or left
    end
  end
  if #names == 1 then
    return string.format(L["From your last mailbox visit: a letter with items or gold on this character runs out in %s: %s. Open a mailbox to take it out."],
      ns.DaysText(soonest), names[1])
  elseif #names > 1 then
    return string.format(L["From your last mailbox visit: %d letters with items or gold on this character run out within %s, the first in %s: %s. Open a mailbox to take them out."],
      #names, ns.DaysText(warnDays), ns.DaysText(soonest), ns.NameList(names))
  end
  -- Saved by 1.1 or 1.2: only the date of the first letter is known.
  if c.letters == nil and type(c.expires) == "number" then
    local left = (c.expires - now) / ns.DAY
    if left > 0 and ns.Within(left, warnDays) then
      return string.format(L["From your last mailbox visit: mail with items or gold on this character runs out in %s. Open a mailbox to take it out."], ns.DaysText(left))
    end
  end
  return nil
end

-- 1.3: /mb letters. One line per character with the letters it still has, as of its last mailbox
-- visit, the character whose first letter runs out soonest first. An empty list when none.
function ns.LetterLines(chars, now, myRealm)
  local L = ns.L
  local rows = {}
  for key, c in pairs(chars) do
    if type(c) == "table" then
      local parts, first = {}, nil
      if type(c.letters) == "table" then
        for _, m in ipairs(c.letters) do
          local left = (m.expires - now) / ns.DAY
          if left > 0 then
            parts[#parts + 1] = string.format(L["%s in %s"], ns.LetterLabel(m.sender, m.subject), ns.DaysText(left))
            first = first or left
          end
        end
      elseif type(c.expires) == "number" and c.expires > now then
        first = (c.expires - now) / ns.DAY
        parts[1] = string.format(L["the first in %s"], ns.DaysText(first))
      end
      if first then rows[#rows + 1] = { key = key, first = first, text = table.concat(parts, ", ") } end
    end
  end
  table.sort(rows, function(a, b)
    if a.first ~= b.first then return a.first < b.first end
    return a.key < b.key
  end)
  local lines = {}
  for i, row in ipairs(rows) do
    lines[i] = string.format(L["%s: %s"], ns.DisplayName(row.key, myRealm), row.text)
  end
  return lines
end

-- The characters whose first letter with items or gold runs out within warnDays from now, soonest
-- first, the player's own character included. A time that has passed is skipped: that mail is gone.
-- except (1.3, optional) leaves out one character: the one being played gets its own line at login.
function ns.Expiring(chars, now, warnDays, except)
  local list = {}
  if type(now) ~= "number" or not ns.ValidDays(warnDays) or warnDays == 0 then return list end
  for key, c in pairs(chars) do
    if key ~= except and type(c) == "table" and type(c.expires) == "number" then
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
function ns.ExpiringText(chars, now, warnDays, myRealm, except)
  local list = ns.Expiring(chars, now, warnDays, except)
  if #list == 0 then return nil end
  local parts = {}
  for i, entry in ipairs(list) do
    parts[i] = string.format(ns.L["%s in %s"], ns.DisplayName(entry.key, myRealm), ns.DaysText(entry.left))
  end
  return string.format(ns.L["Mail with items or gold runs out soon on: %s"], table.concat(parts, ", "))
end

function ns.ValidSound(value)
  if type(value) == "string" and ns.SOUND_KIT[value] then return value end
  return nil
end

-- The sound id for a name from the game's SOUNDKIT table. A sound this client does not know falls
-- back to the sounds of 1.0 (the bell, then the whisper sound); nil when it knows none of them.
function ns.SoundId(kit, name)
  if type(kit) ~= "table" then return nil end
  local id = kit[ns.SOUND_KIT[name] or ""]
  if type(id) == "number" then return id end
  for _, fallback in ipairs(ns.FALLBACK_SOUNDS) do
    if type(kit[fallback]) == "number" then return kit[fallback] end
  end
  return nil
end

-- Picks the bell from a word and switches the sound on. Returns true, or nil for an unknown word.
function ns.ChooseBell(settings, word)
  local name = ns.ValidSound((word or ""):lower())
  if not name then return nil end
  settings.bell = name
  settings.sound = true
  return true
end

-- "a, b or c"
function ns.OrList(words)
  if #words < 2 then return words[1] or "" end
  local head = {}
  for i = 1, #words - 1 do head[i] = words[i] end
  return string.format(ns.L["%s or %s"], table.concat(head, ", "), words[#words])
end

-- "Sound is on: bell." or "Sound is off."
function ns.SoundText(settings)
  if not settings.sound then return ns.L["Sound is off."] end
  return string.format(ns.L["Sound is on: %s."], ns.ValidSound(settings.bell) or ns.DEFAULT_SOUND)
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
