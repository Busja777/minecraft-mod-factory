-- Tests for Mail Bell, run by tools/wow/client/run.lua.

-- The parts of the game the stand-in client lacks: the mail flag, the inbox, sounds and a timer.
-- w.letters[i] = { money, cod, days, items } describes letter i of the inbox; a letter without an
-- entry is a plain letter without items that has 30 days left.
local function world(wow)
  local w = { newMail = false, inbox = 0, letters = {}, sounds = {}, timers = {} }
  HasNewMail = function() return w.newMail end
  GetInboxNumItems = function() return w.inbox, w.inbox end
  GetInboxHeaderInfo = function(i)
    local m = w.letters[i] or {}
    -- packageIcon, stationeryIcon, sender, subject, money, CODAmount, daysLeft, hasItem, wasRead, ...
    return nil, "Interface\\Icons\\INV_Misc_Note_01", m.sender or "Someone", m.subject or "Hello", m.money or 0, m.cod or 0, m.days or 30, m.items, false
  end
  SOUNDKIT = { ALARM_CLOCK_WARNING_3 = 12889, TELL_MESSAGE = 3081, MAP_PING = 3175, READY_CHECK = 8960, RAID_WARNING = 8959 }
  PlaySound = function(id, channel) w.sounds[#w.sounds + 1] = { id = id, channel = channel } end
  C_Timer = { After = function(seconds, fn) w.timers[#w.timers + 1] = { seconds = seconds, fn = fn } end }

  function w.run()
    local due = w.timers
    w.timers = {}
    for _, t in ipairs(due) do t.fn() end
    return #due
  end
  -- New mail arrives (or the flag changes) and the game says so.
  function w.mail(flag, later)
    wow.clock = wow.clock + (later or 0)
    w.newMail = flag
    wow.fire("UPDATE_PENDING_MAIL")
  end
  function w.openMailbox(items, letters)
    w.inbox = items
    if letters then w.letters = letters end
    wow.fire("MAIL_SHOW")
    wow.fire("MAIL_INBOX_UPDATE")
  end
  function w.closeMailbox(stillNew)
    w.newMail = stillNew or false
    wow.fire("MAIL_CLOSED")
    wow.fire("MAIL_CLOSED") -- the game sends it twice
  end
  return w
end

-- The way the game starts: saved variables, login, the world, then the first mail notice.
local function boot(wow, w, opts)
  opts = opts or {}
  wow.player = opts.player
  wow.realm = opts.realm
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("ADDON_LOADED", "MailBell")
  wow.fire("PLAYER_LOGIN")
  wow.fire("PLAYER_ENTERING_WORLD", true, false)
  if opts.settle ~= false then
    wow.fire("UPDATE_PENDING_MAIL")
    wow.clock = wow.clock + 60 -- past the quiet time after login
  end
  return ns
end

local PREFIX = "|cffffd100Mail Bell:|r "

test("addon defines only its own globals", function(wow)
  local w = world(wow)
  local mine = {}
  for k in pairs(_G) do mine[k] = true end
  boot(wow, w)
  w.run()
  w.mail(true)
  w.openMailbox(0)
  w.closeMailbox()
  wow.slash("/mb")
  wow.slash("/mailbell sound off")
  wow.slash("/mb forget Nobody-Nowhere")
  wow.slash("/mb sound chime")
  w.openMailbox(1, { { money = 5, days = 1 } })
  wow.slash("/mb letters")
  local allowed = { MailBellDB = true, SLASH_MAILBELL1 = true, SLASH_MAILBELL2 = true }
  for k in pairs(_G) do
    if not mine[k] and not allowed[k] then error("unexpected global " .. tostring(k)) end
  end
  eq(#w.sounds, 2, "the bell and the preview")
end)

test("core: the first reading only sets the state", function(wow)
  local ns = boot(wow, world(wow))
  local s = ns.NewRingState()
  eq(ns.ShouldRing(s, true, 100), false, "mail that was already there")
  eq(s.known, true)
  eq(s.had, true)
  eq(ns.ShouldRing(s, true, 200), false, "still the same mail")
  eq(ns.ShouldRing(s, false, 210), false, "mail read")
  eq(ns.ShouldRing(s, true, 220), true, "new mail")
  eq(s.lastRing, 220)

  s = ns.NewRingState()
  eq(ns.ShouldRing(s, false, 100), false)
  eq(ns.ShouldRing(s, true, 101), true, "no mail at the first reading, then mail")
end)

test("core: not more than one ring per 30 seconds", function(wow)
  local ns = boot(wow, world(wow))
  local s = ns.NewRingState()
  ns.ShouldRing(s, false, 0)
  eq(ns.ShouldRing(s, true, 10), true)
  eq(ns.ShouldRing(s, false, 15), false)
  eq(ns.ShouldRing(s, true, 39), false, "29 seconds after the last ring")
  eq(s.had, true, "the state follows even when the bell stays quiet")
  eq(s.lastRing, 10)
  eq(ns.ShouldRing(s, false, 41), false)
  eq(ns.ShouldRing(s, true, 40 + ns.RING_GAP), true, "exactly 30 seconds later")
  eq(ns.RING_GAP, 30)
end)

test("core: after entering the world readings are quiet for a moment", function(wow)
  local ns = boot(wow, world(wow))
  local s = ns.NewRingState()
  ns.Settle(s, 100)
  eq(ns.ShouldRing(s, false, 100), false)
  eq(ns.ShouldRing(s, true, 100 + ns.SETTLE - 1), false, "the server's late notice of old mail")
  eq(s.had, true)
  eq(ns.ShouldRing(s, true, 100 + ns.SETTLE + 5), false)
  eq(ns.ShouldRing(s, false, 200), false)
  eq(ns.ShouldRing(s, true, 201), true)
end)

test("core: readings that are not plain true or false are ignored", function(wow)
  local ns = boot(wow, world(wow))
  local s = ns.NewRingState()
  ns.ShouldRing(s, false, 0)
  eq(ns.ShouldRing(s, nil, 50), false)
  eq(ns.ShouldRing(s, { secret = true }, 51), false)
  eq(ns.ShouldRing(s, 1, 52), false)
  eq(ns.ShouldRing(s, true, nil), false, "time unknown")
  eq(s.had, false, "nothing changed")
  eq(ns.ShouldRing(s, true, 53), true)
end)

test("core: notes per character keep the time of the first notice", function(wow)
  local ns = boot(wow, world(wow))
  local chars = {}
  ns.NoteMail(chars, "Yubi-Silvermoon", 1000)
  eq(chars["Yubi-Silvermoon"].mail, true)
  eq(chars["Yubi-Silvermoon"].since, 1000)
  ns.NoteMail(chars, "Yubi-Silvermoon", 2000)
  eq(chars["Yubi-Silvermoon"].since, 1000, "the first notice counts")
  ns.ClearMail(chars, "Yubi-Silvermoon")
  eq(chars["Yubi-Silvermoon"].mail, false)
  eq(chars["Yubi-Silvermoon"].since, nil)
  ns.NoteMail(chars, "Yubi-Silvermoon", 3000)
  eq(chars["Yubi-Silvermoon"].since, 3000, "a new round of mail starts a new time")
  ns.ClearMail(chars, "Brakk-Silvermoon")
  eq(chars["Brakk-Silvermoon"].mail, false, "a character seen without mail")
  chars.Broken = "x"
  ns.NoteMail(chars, "Broken", 5)
  eq(chars.Broken.mail, true)
end)

test("core: the list of other characters with mail", function(wow)
  local ns = boot(wow, world(wow))
  local chars = {
    ["Yubi-Silvermoon"] = { mail = true, since = 300 },
    ["Brakk-Argent Dawn"] = { mail = true, since = 100 },
    ["Me-Silvermoon"] = { mail = true, since = 50 },
    ["Quiet-Silvermoon"] = { mail = false },
    ["Zed-Azjol-Nerub"] = { mail = true, since = 300 },
    ["Odd-Silvermoon"] = "broken",
  }
  local list = ns.Waiting(chars, "Me-Silvermoon")
  eq(#list, 3)
  eq(list[1].key, "Brakk-Argent Dawn", "oldest notice first")
  eq(list[2].key, "Yubi-Silvermoon", "same time: by name")
  eq(ns.WaitingText(chars, "Me-Silvermoon", "Silvermoon"), "Mail waiting on: Brakk (Argent Dawn), Yubi, Zed (Azjol-Nerub)")
  eq(ns.DisplayName("Brakk-Silvermoon", "Argent Dawn"), "Brakk (Silvermoon)")
  eq(ns.DisplayName("Yubi-Silvermoon", "Silvermoon"), "Yubi")
  eq(ns.DisplayName("NoRealm", "Silvermoon"), "NoRealm")
  eq(ns.WaitingText({ ["Me-Silvermoon"] = { mail = true } }, "Me-Silvermoon", "Silvermoon"), nil, "only the player has mail")
  eq(ns.WaitingText({}, "Me-Silvermoon", "Silvermoon"), nil)
end)

test("core: settings, switches and names", function(wow)
  local ns = boot(wow, world(wow))
  local db = ns.PrepareDB(nil)
  eq(db.version, 4)
  eq(db.settings.sound, true)
  eq(db.settings.login, true)
  eq(type(db.chars), "table")
  db = ns.PrepareDB({ settings = { sound = false, login = "yes" }, chars = { ["A-B"] = { mail = true } }, later = 1 })
  eq(db.settings.sound, false, "saved value kept")
  eq(db.settings.login, true, "broken value replaced")
  eq(db.chars["A-B"].mail, true)
  eq(db.later, 1)
  eq(ns.PrepareDB({ settings = "x", chars = 5 }).settings.sound, true)

  eq(ns.ParseSwitch("ON"), true)
  eq(ns.ParseSwitch("off"), false)
  eq(ns.ParseSwitch("maybe"), nil)
  eq(ns.ParseSwitch(nil), nil)
  local settings = { sound = true, login = true }
  eq(ns.Switch(settings, "sound", "off"), false)
  eq(settings.sound, false)
  eq(ns.Switch(settings, "login", "loud"), nil)
  eq(settings.login, true)
  eq(ns.Switch(settings, "volume", "on"), nil)
  eq(settings.volume, nil)

  local chars = { ["Brakk-Argent Dawn"] = {} }
  eq(ns.FindChar(chars, "brakk-argent dawn"), "Brakk-Argent Dawn")
  eq(ns.FindChar(chars, "Brakk"), nil)
  eq(ns.FindChar(chars, ""), nil)
end)

test("login with mail already there: no bell", function(wow)
  local w = world(wow)
  w.newMail = true
  boot(wow, w)
  w.mail(true, 5)
  eq(#w.sounds, 0)
  eq(#wow.chat, 0)
  eq(MailBellDB.chars["Yubi-Silvermoon"].mail, true, "but the character is noted")
  eq(MailBellDB.chars["Yubi-Silvermoon"].since, wow.now)
end)

test("the server's late notice after login does not ring either", function(wow)
  local w = world(wow)
  boot(wow, w, { settle = false })
  eq(HasNewMail(), false)
  w.mail(true, 3) -- the flag only arrives a moment after entering the world
  eq(#w.sounds, 0)
  eq(#wow.chat, 0)
  w.mail(false, 60)
  w.mail(true, 1)
  eq(#w.sounds, 1)
end)

test("new mail rings once on the Master channel with one chat line", function(wow)
  local w = world(wow)
  boot(wow, w)
  w.mail(true)
  eq(#w.sounds, 1)
  eq(w.sounds[1].id, 12889)
  eq(w.sounds[1].channel, "Master")
  eq(#wow.chat, 1)
  eq(wow.chat[1], PREFIX .. "You have new mail.")
  w.mail(true, 120) -- more mail while the flag is still up
  eq(#w.sounds, 1)
  eq(#wow.chat, 1)
end)

test("a second ring within 30 seconds stays quiet", function(wow)
  local w = world(wow)
  boot(wow, w)
  w.mail(true)
  w.mail(false, 5)
  w.mail(true, 5)
  eq(#w.sounds, 1)
  eq(#wow.chat, 1)
  w.mail(false, 10)
  w.mail(true, 10)
  eq(#w.sounds, 2, "30 seconds after the first ring")
  eq(#wow.chat, 2)
end)

test("sound off: only the chat line", function(wow)
  local w = world(wow)
  boot(wow, w)
  wow.slash("/mb sound off")
  w.mail(true)
  eq(#w.sounds, 0)
  eq(wow.chat[2], PREFIX .. "You have new mail.")
end)

test("an emptied mailbox clears the character, one with letters left does not", function(wow)
  local w = world(wow)
  boot(wow, w)
  w.mail(true)
  local me = MailBellDB.chars["Yubi-Silvermoon"]
  eq(me.mail, true)
  w.inbox = 0
  wow.fire("MAIL_INBOX_UPDATE")
  eq(me.mail, true, "an inbox update without the mailbox open counts for nothing")
  w.openMailbox(3)
  eq(me.mail, true)
  w.inbox = 0
  wow.fire("MAIL_INBOX_UPDATE")
  eq(me.mail, false)
  eq(me.since, nil)
end)

test("closing the mailbox clears the character when no new mail is left", function(wow)
  local w = world(wow)
  boot(wow, w)
  w.mail(true)
  w.openMailbox(2)
  w.closeMailbox(true)
  eq(MailBellDB.chars["Yubi-Silvermoon"].mail, true, "the game still says new mail")
  w.openMailbox(2)
  w.closeMailbox(false)
  eq(MailBellDB.chars["Yubi-Silvermoon"].mail, false)
  w.mail(false, 1)
  eq(MailBellDB.chars["Yubi-Silvermoon"].mail, false)
  w.newMail = false
  wow.fire("MAIL_CLOSED") -- without a MAIL_SHOW before
  eq(MailBellDB.chars["Yubi-Silvermoon"].mail, false)
end)

test("after login the other characters with mail are named once", function(wow)
  local w = world(wow)
  MailBellDB = { chars = {
    ["Brakk-Silvermoon"] = { mail = true, since = 10 },
    ["Yubi-Argent Dawn"] = { mail = true, since = 20 },
    ["Kel-Argent Dawn"] = { mail = false },
    ["Me-Argent Dawn"] = { mail = true, since = 5 },
  } }
  local ns = boot(wow, w, { player = "Me", realm = "Argent Dawn" })
  eq(#wow.chat, 0, "not at once")
  eq(#w.timers, 1)
  eq(w.timers[1].seconds, ns.LOGIN_DELAY)
  w.run()
  eq(#wow.chat, 1)
  eq(wow.chat[1], PREFIX .. "Mail waiting on: Brakk (Silvermoon), Yubi")
end)

test("login list: nothing when no other character has mail, nothing when switched off", function(wow)
  local w = world(wow)
  MailBellDB = { chars = { ["Brakk-Silvermoon"] = { mail = false } } }
  w.newMail = true
  boot(wow, w)
  w.run()
  eq(#wow.chat, 0)

  wow.slash("/mb login off")
  eq(wow.chat[1], PREFIX .. "Login list is off.")
  MailBellDB.chars["Brakk-Silvermoon"].mail = true
  wow.fire("PLAYER_LOGIN")
  w.run()
  eq(#wow.chat, 1)
end)

test("mail that arrives during a loading screen still rings", function(wow)
  local w = world(wow)
  boot(wow, w)
  wow.clock = wow.clock + 100
  w.newMail = true
  wow.fire("PLAYER_ENTERING_WORLD", false, false)
  eq(#w.sounds, 1)
  eq(wow.chat[1], PREFIX .. "You have new mail.")
end)

test("slash commands: list, settings and help", function(wow)
  local w = world(wow)
  MailBellDB = { chars = { ["Brakk-Argent Dawn"] = { mail = true, since = 1 } } }
  boot(wow, w)
  wow.slash("/mb")
  eq(wow.chat[1], PREFIX .. "Mail waiting on: Brakk (Argent Dawn)")
  eq(wow.chat[2], PREFIX .. "Sound is on: bell. Login list is on. Expiry warning: mail with items or gold that runs out within 3 days.")
  eq(wow.chat[3]:match("/mb forget Name%-Realm removes a character") ~= nil, true)
  eq(wow.chat[4], PREFIX .. "/mb expire followed by 1 to 30 days, or off, sets the warning for mail with items or gold that runs out soon.")
  eq(wow.chat[5], PREFIX .. "/mb sound followed by bell, chime, horn, warning or whisper picks the bell and plays it once.")
  eq(wow.chat[6], PREFIX .. "/mb letters lists the letters with items or gold on all your characters, as of each one's last mailbox visit.")
  wow.slash("/mb sound off")
  eq(wow.chat[7], PREFIX .. "Sound is off.")
  eq(MailBellDB.settings.sound, false)
  wow.slash("/mailbell  SOUND  On ")
  eq(wow.chat[8], PREFIX .. "Sound is on: bell.")
  eq(MailBellDB.settings.sound, true)
  wow.slash("/mb login off")
  eq(wow.chat[9], PREFIX .. "Login list is off.")
  wow.slash("/mb login loud")
  eq(wow.chat[10]:match("^" .. PREFIX:gsub("|", "%%|") .. "/mb sound on/off") ~= nil, true, "a bad word shows the help")
  eq(MailBellDB.settings.login, false)
  MailBellDB.chars["Brakk-Argent Dawn"].mail = false
  wow.slash("/mb whatever")
  eq(wow.chat[14], PREFIX .. "No mail waiting on your other characters.")
  eq(wow.chat[15], PREFIX .. "Sound is on: bell. Login list is off. Expiry warning: mail with items or gold that runs out within 3 days.")
  eq(#wow.chat, 19)
end)

test("/mb forget removes a character, not the one you play", function(wow)
  local w = world(wow)
  MailBellDB = { chars = { ["Brakk-Argent Dawn"] = { mail = true, since = 1 } } }
  boot(wow, w)
  w.mail(true)
  wow.slash("/mb forget brakk-argent dawn")
  eq(wow.chat[2], PREFIX .. "Brakk-Argent Dawn forgotten.")
  eq(MailBellDB.chars["Brakk-Argent Dawn"], nil)
  wow.slash("/mb forget Brakk-Argent Dawn")
  eq(wow.chat[3], PREFIX .. "No character called Brakk-Argent Dawn. Use Name-Realm.")
  wow.slash("/mb forget Yubi-Silvermoon")
  eq(wow.chat[4], PREFIX .. "You cannot forget the character you are playing.")
  eq(MailBellDB.chars["Yubi-Silvermoon"].mail, true)
end)

test("settings survive a reload", function(wow)
  local w = world(wow)
  boot(wow, w)
  wow.slash("/mb sound off")
  wow.slash("/mb login off")
  w.mail(true)
  local saved = MailBellDB
  eq(saved.settings.sound, false)
  MailBellDB = saved -- as the game loads it at the next login
  wow.frames[1].events = {} -- the first copy of the addon no longer listens
  boot(wow, w)
  eq(MailBellDB.settings.sound, false)
  eq(MailBellDB.settings.login, false)
  eq(MailBellDB.chars["Yubi-Silvermoon"].mail, true)

  MailBellDB = "broken"
  wow.fire("PLAYER_LOGIN")
  eq(MailBellDB.settings.sound, true)
end)

test("secret values are never used", function(wow)
  local w = world(wow)
  local secret = { secret = true }
  boot(wow, w)
  w.mail(secret)
  eq(#w.sounds, 0)
  eq(MailBellDB.chars["Yubi-Silvermoon"], nil, "nothing noted")
  w.mail(true)
  eq(#w.sounds, 1, "the secret reading did not change the state")
  w.inbox = secret
  wow.fire("MAIL_SHOW")
  wow.fire("MAIL_INBOX_UPDATE")
  eq(MailBellDB.chars["Yubi-Silvermoon"].mail, true)
  w.newMail = secret
  wow.fire("MAIL_CLOSED")
  eq(MailBellDB.chars["Yubi-Silvermoon"].mail, true)
end)

test("missing parts of the game are no error", function(wow)
  local w = world(wow)
  MailBellDB = { chars = { ["Brakk-Argent Dawn"] = { mail = true, since = 1 } } }
  C_Timer = nil
  SOUNDKIT = nil
  boot(wow, w)
  eq(wow.chat[1], PREFIX .. "Mail waiting on: Brakk (Argent Dawn)", "without a timer the list comes at once")
  w.mail(true)
  eq(#w.sounds, 0, "no sound constant, no sound")
  eq(wow.chat[2], PREFIX .. "You have new mail.")

  SOUNDKIT = { TELL_MESSAGE = 3081 }
  w.mail(false, 1)
  w.mail(true, 60)
  eq(w.sounds[1].id, 3081, "the second choice")

  PlaySound = nil
  GetInboxNumItems = nil
  HasNewMail = nil
  wow.clock = wow.clock + 60
  wow.fire("UPDATE_PENDING_MAIL")
  wow.fire("MAIL_SHOW")
  wow.fire("MAIL_INBOX_UPDATE")
  wow.fire("MAIL_CLOSED")
  eq(#wow.chat, 3)
end)

test("events and commands before login do nothing", function(wow)
  local w = world(wow)
  wow.load(ADDON_DIR, ADDON_NAME)
  w.newMail = true
  wow.fire("UPDATE_PENDING_MAIL")
  wow.fire("PLAYER_ENTERING_WORLD", true, false)
  wow.fire("MAIL_SHOW")
  wow.fire("MAIL_CLOSED")
  wow.slash("/mb sound off")
  eq(#wow.chat, 0)
  eq(#w.sounds, 0)
  eq(MailBellDB, nil)
end)

-- Mail Bell 1.1: the expiry warning.

local DAY = 86400

test("core: which letters count for the expiry warning", function(wow)
  local ns = boot(wow, world(wow))
  local secret = { secret = true }
  local soonest, count = ns.ScanExpiry({
    { money = 5000, cod = 0, daysLeft = 2.4 },        -- gold, runs out soon
    { money = 0, cod = 0, daysLeft = 3.9, hasItem = 2 }, -- items, shown as 3 days: counts
    { money = 0, cod = 0, daysLeft = 4.0, hasItem = 1 }, -- 4 days: later
    { money = 0, cod = 0, daysLeft = 0.5 },           -- a plain letter without items or gold
    { money = 0, cod = 900, daysLeft = 0.2, hasItem = 1 }, -- cash on delivery: goes back to the sender
    { money = 100, cod = 0, daysLeft = secret },      -- secret: left out
    { money = secret, cod = 0, daysLeft = 0.1 },
    { money = 100, cod = 0, daysLeft = -1 },          -- broken
    { money = 100, cod = 0, daysLeft = "1" },
  }, 3)
  eq(soonest, 2.4)
  eq(count, 2)
  soonest, count = ns.ScanExpiry({ { money = 0, daysLeft = 9, hasItem = 1 } }, 3)
  eq(soonest, 9, "the first letter is noted even when it is not soon")
  eq(count, 0)
  soonest, count = ns.ScanExpiry({ { money = 1, daysLeft = 1 } }, 0)
  eq(soonest, 1)
  eq(count, 0, "warning off: nothing counts")
  soonest, count = ns.ScanExpiry({}, 3)
  eq(soonest, nil)
  eq(count, 0)
  eq(select(2, ns.ScanExpiry({ { money = 0, daysLeft = 1, hasItem = true } }, 3)), 1, "hasItem as a plain true")
end)

test("core: days, the warning line and the expire setting", function(wow)
  local ns = boot(wow, world(wow))
  eq(ns.DaysText(0.3), "less than a day")
  eq(ns.DaysText(1.9), "1 day")
  eq(ns.DaysText(2), "2 days")
  eq(ns.ExpiryWarning(1, 0.5, 3), "A letter with items or gold runs out in less than a day. Take it out before it is returned or deleted.")
  eq(ns.ExpiryWarning(3, 1.2, 3), "3 letters with items or gold run out within 3 days, the first in 1 day. Take them out before they are returned or deleted.")
  eq(ns.ExpiryWarning(2, 0.4, 1), "2 letters with items or gold run out within 1 day, the first in less than a day. Take them out before they are returned or deleted.")
  eq(ns.ExpiryWarning(0, 1, 3), nil)
  eq(ns.ExpiryWarning(2, nil, 3), nil)
  eq(ns.ParseDays("5"), 5)
  eq(ns.ParseDays("OFF"), 0)
  eq(ns.ParseDays("0"), 0)
  eq(ns.ParseDays("30"), 30)
  eq(ns.ParseDays("31"), nil)
  eq(ns.ParseDays("-2"), nil)
  eq(ns.ParseDays("2.5"), nil)
  eq(ns.ParseDays("soon"), nil)
  eq(ns.ParseDays(nil), nil)
  eq(ns.ValidDays(3), 3)
  eq(ns.ValidDays(0 / 0), nil)
  eq(ns.ValidDays("3"), nil)
end)

test("core: expiry per character and the login line", function(wow)
  local ns = boot(wow, world(wow))
  local now = 1000000
  local chars = { ["Brakk-Argent Dawn"] = { mail = true, since = 5 } }
  ns.NoteExpiry(chars, "Brakk-Argent Dawn", 2.5, now)
  eq(chars["Brakk-Argent Dawn"].expires, now + 2.5 * DAY)
  eq(chars["Brakk-Argent Dawn"].mail, true, "the mail note is kept")
  ns.NoteExpiry(chars, "Yubi-Silvermoon", 0.5, now)
  ns.NoteExpiry(chars, "Kel-Silvermoon", 12, now)
  ns.NoteExpiry(chars, "Gone-Silvermoon", 0.1, now - DAY)
  chars.Odd = "broken"
  eq(ns.ExpiringText(chars, now, 3, "Silvermoon"), "Mail with items or gold runs out soon on: Yubi in less than a day, Brakk (Argent Dawn) in 2 days")
  eq(ns.ExpiringText(chars, now + 9 * DAY, 3, "Silvermoon"), "Mail with items or gold runs out soon on: Kel in 3 days", "later the far letter comes near")
  eq(ns.ExpiringText(chars, now, 0, "Silvermoon"), nil, "warning off")
  eq(ns.ExpiringText({}, now, 3, "Silvermoon"), nil)
  ns.NoteExpiry(chars, "Yubi-Silvermoon", nil, now)
  eq(chars["Yubi-Silvermoon"].expires, nil, "no letter with items or gold left")
  ns.NoteExpiry(chars, "New-Silvermoon", nil, now)
  eq(type(chars["New-Silvermoon"]), "table")
end)

test("core: saved data of 1.0 gets the expiry setting, a saved choice is kept", function(wow)
  local ns = boot(wow, world(wow))
  local old = { version = 1, settings = { sound = false, login = true }, chars = { ["A-B"] = { mail = true, since = 9 } } }
  local db = ns.PrepareDB(old)
  eq(db.version, 4)
  eq(db.settings.expire, 3)
  eq(db.settings.sound, false)
  eq(db.chars["A-B"].since, 9)
  eq(ns.PrepareDB({ settings = { expire = 7 } }).settings.expire, 7)
  eq(ns.PrepareDB({ settings = { expire = 0 } }).settings.expire, 0)
  eq(ns.PrepareDB({ settings = { expire = 99 } }).settings.expire, 3)
  eq(ns.PrepareDB({ settings = { expire = "x" } }).settings.expire, 3)
end)

test("open mailbox: one warning per session for items or gold running out soon", function(wow)
  local w = world(wow)
  boot(wow, w)
  w.openMailbox(3, {
    { money = 25000, days = 1.5, sender = "Auction House", subject = "Auction successful: Linen Cloth" },
    { items = 1, days = 2.2, sender = "Brakk", subject = "Herbs" },
    { items = 1, days = 20 },
  })
  eq(#wow.chat, 1)
  eq(wow.chat[1], PREFIX .. "2 letters with items or gold run out within 3 days, the first in 1 day: Auction House \"Auction successful: Linen Cloth\", Brakk \"Herbs\". Take them out before they are returned or deleted.")
  eq(MailBellDB.chars["Yubi-Silvermoon"].expires, wow.now + 1.5 * DAY)
  wow.fire("MAIL_INBOX_UPDATE")
  w.closeMailbox()
  w.openMailbox(3)
  eq(#wow.chat, 1, "once per session")
  eq(#w.sounds, 0, "the warning does not ring")
end)

test("open mailbox: nothing runs out soon, so no line, but the date is kept for later", function(wow)
  local w = world(wow)
  boot(wow, w)
  w.openMailbox(2, { { items = 1, days = 10 }, { days = 0.2 } })
  eq(#wow.chat, 0)
  eq(MailBellDB.chars["Yubi-Silvermoon"].expires, wow.now + 10 * DAY)
  -- The player takes the item out: the inbox updates and nothing is left to run out.
  w.letters = { { days = 0.2 } }
  w.inbox = 1
  wow.fire("MAIL_INBOX_UPDATE")
  eq(MailBellDB.chars["Yubi-Silvermoon"].expires, nil)
  w.letters = { { money = 10, days = 0.5 } }
  wow.fire("MAIL_INBOX_UPDATE")
  eq(wow.chat[1], PREFIX .. "A letter with items or gold runs out in less than a day: Someone \"Hello\". Take it out before it is returned or deleted.")
  w.inbox = 0
  wow.fire("MAIL_INBOX_UPDATE")
  eq(MailBellDB.chars["Yubi-Silvermoon"].expires, nil, "an empty mailbox has nothing to run out")
end)

test("the login list names characters whose mail runs out soon, the current one too", function(wow)
  local w = world(wow)
  MailBellDB = { version = 1, settings = { sound = true, login = true }, chars = {
    ["Brakk-Silvermoon"] = { mail = true, since = 10, expires = wow.now + 2.5 * DAY },
    ["Yubi-Silvermoon"] = { mail = false, expires = wow.now + 0.5 * DAY },
    ["Kel-Silvermoon"] = { mail = false, expires = wow.now + 8 * DAY },
    ["Old-Silvermoon"] = { mail = false, expires = wow.now - 10 },
  } }
  boot(wow, w)
  w.run()
  eq(#wow.chat, 3)
  eq(wow.chat[1], PREFIX .. "Mail waiting on: Brakk")
  eq(wow.chat[2], PREFIX .. "Mail with items or gold runs out soon on: Brakk in 2 days")
  eq(wow.chat[3], PREFIX .. "From your last mailbox visit: mail with items or gold on this character runs out in less than a day. Open a mailbox to take it out.", "1.3: the current one gets its own line")
  wow.slash("/mb")
  eq(wow.chat[5], PREFIX .. "Mail with items or gold runs out soon on: Yubi in less than a day, Brakk in 2 days", "/mb shows it too")

  wow.slash("/mb login off")
  local before = #wow.chat
  wow.fire("PLAYER_LOGIN")
  w.run()
  eq(#wow.chat, before, "the login list is off")
end)

test("/mb expire sets the days or switches the warning off", function(wow)
  local w = world(wow)
  boot(wow, w)
  wow.slash("/mb expire")
  eq(wow.chat[1], PREFIX .. "Expiry warning: mail with items or gold that runs out within 3 days.")
  wow.slash("/mb expire 7")
  eq(wow.chat[2], PREFIX .. "Expiry warning: mail with items or gold that runs out within 7 days.")
  eq(MailBellDB.settings.expire, 7)
  wow.slash("/mb expire 1")
  eq(wow.chat[3], PREFIX .. "Expiry warning: mail with items or gold that runs out within 1 day.")
  wow.slash("/mb expire 45")
  eq(wow.chat[4]:match("/mb sound on/off") ~= nil, true, "too many days shows the help")
  eq(MailBellDB.settings.expire, 1)
  wow.slash("/mb EXPIRE off")
  eq(wow.chat[8], PREFIX .. "Expiry warning is off.")
  eq(MailBellDB.settings.expire, 0)
  w.openMailbox(1, { { money = 100, days = 0.5 } })
  eq(#wow.chat, 8, "no warning when it is off")
  eq(MailBellDB.chars["Yubi-Silvermoon"].expires, wow.now + 0.5 * DAY, "but the date is still noted")
  wow.fire("PLAYER_LOGIN")
  w.run()
  eq(#wow.chat, 8, "and the login list stays quiet about it")
  wow.slash("/mb expire 3")
  w.openMailbox(1)
  eq(wow.chat[10], PREFIX .. "A letter with items or gold runs out in less than a day: Someone \"Hello\". Take it out before it is returned or deleted.")
end)

test("expiry: secret or missing inbox details are no error and give no warning", function(wow)
  local w = world(wow)
  local secret = { secret = true }
  boot(wow, w)
  w.openMailbox(2, { { money = 100, days = secret }, { items = secret, days = 0.5 } })
  eq(#wow.chat, 0)
  eq(MailBellDB.chars["Yubi-Silvermoon"].expires, nil)
  GetInboxHeaderInfo = function() error("not now") end
  wow.fire("MAIL_INBOX_UPDATE")
  eq(#wow.chat, 0)
  GetInboxHeaderInfo = nil
  MailBellDB.chars["Yubi-Silvermoon"].expires = wow.now + DAY
  wow.fire("MAIL_INBOX_UPDATE")
  eq(MailBellDB.chars["Yubi-Silvermoon"].expires, wow.now + DAY, "without the details the date is left alone")
  eq(#wow.chat, 0)
end)


-- Mail Bell 1.2: the bell can be picked.

test("core: bell names, ids and the fallback of 1.0", function(wow)
  local ns = boot(wow, world(wow))
  eq(ns.DEFAULT_SOUND, "bell")
  eq(ns.ValidSound("horn"), "horn")
  eq(ns.ValidSound("on"), nil)
  eq(ns.ValidSound(nil), nil)
  local kit = { ALARM_CLOCK_WARNING_3 = 12889, TELL_MESSAGE = 3081, MAP_PING = 3175 }
  eq(ns.SoundId(kit, "bell"), 12889)
  eq(ns.SoundId(kit, "chime"), 3175)
  eq(ns.SoundId(kit, "horn"), 12889, "a sound the client does not know falls back to the bell")
  eq(ns.SoundId({ TELL_MESSAGE = 3081 }, "horn"), 3081, "then to the whisper sound, as in 1.0")
  eq(ns.SoundId({ MAP_PING = 3175 }, "bell"), nil)
  eq(ns.SoundId({ ALARM_CLOCK_WARNING_3 = "x" }, "bell"), nil)
  eq(ns.SoundId(nil, "bell"), nil)
  local settings = { sound = false, bell = "bell" }
  eq(ns.ChooseBell(settings, "Chime"), true)
  eq(settings.bell, "chime")
  eq(settings.sound, true, "picking a bell switches the sound on")
  eq(ns.ChooseBell(settings, "trumpet"), nil)
  eq(ns.ChooseBell(settings, nil), nil)
  eq(settings.bell, "chime")
  eq(ns.SoundText(settings), "Sound is on: chime.")
  eq(ns.SoundText({ sound = true, bell = "x" }), "Sound is on: bell.")
  eq(ns.SoundText({ sound = false, bell = "chime" }), "Sound is off.")
  eq(ns.OrList({ "a", "b", "c" }), "a, b or c")
  eq(ns.OrList({ "a" }), "a")
end)

test("core: saved data of 1.1 gets the bell it always played, a saved choice is kept", function(wow)
  local ns = boot(wow, world(wow))
  local old = { version = 2, settings = { sound = false, login = false, expire = 7 }, chars = { ["A-B"] = { mail = true, since = 9, expires = 99 } } }
  local db = ns.PrepareDB(old)
  eq(db.version, 4)
  eq(db.settings.bell, "bell")
  eq(db.settings.sound, false)
  eq(db.settings.login, false)
  eq(db.settings.expire, 7)
  eq(db.chars["A-B"].expires, 99)
  eq(ns.PrepareDB({ settings = { bell = "warning" } }).settings.bell, "warning")
  eq(ns.PrepareDB({ settings = { bell = "trumpet" } }).settings.bell, "bell")
  eq(ns.PrepareDB({ settings = { bell = 4 } }).settings.bell, "bell")
end)

test("/mb sound <name> picks the bell, plays it once and new mail rings with it", function(wow)
  local w = world(wow)
  boot(wow, w)
  wow.slash("/mb sound chime")
  eq(wow.chat[1], PREFIX .. "Sound is on: chime.")
  eq(MailBellDB.settings.bell, "chime")
  eq(#w.sounds, 1, "a preview")
  eq(w.sounds[1].id, 3175)
  eq(w.sounds[1].channel, "Master")
  w.mail(true)
  eq(#w.sounds, 2)
  eq(w.sounds[2].id, 3175)
  eq(wow.chat[2], PREFIX .. "You have new mail.")
  wow.slash("/mb sound HORN")
  eq(w.sounds[3].id, 8960)
  eq(MailBellDB.settings.bell, "horn")
end)

test("/mb sound on/off keeps working and keeps the chosen bell", function(wow)
  local w = world(wow)
  boot(wow, w)
  wow.slash("/mb sound warning")
  wow.slash("/mb sound off")
  eq(wow.chat[2], PREFIX .. "Sound is off.")
  eq(MailBellDB.settings.bell, "warning")
  w.mail(true)
  eq(#w.sounds, 1, "only the preview")
  wow.slash("/mb sound on")
  eq(wow.chat[4], PREFIX .. "Sound is on: warning.")
  eq(#w.sounds, 1, "switching on plays nothing")
  w.mail(false, 1)
  w.mail(true, 60)
  eq(w.sounds[2].id, 8959)
  wow.slash("/mb sound")
  eq(wow.chat[#wow.chat], PREFIX .. "Sound is on: warning.", "without a word it only tells")
  wow.slash("/mb sound off")
  wow.slash("/mb sound whisper")
  eq(MailBellDB.settings.sound, true, "picking a bell switches it on again")
  eq(w.sounds[3].id, 3081)
end)

test("/mb sound with an unknown word shows the help and changes nothing", function(wow)
  local w = world(wow)
  boot(wow, w)
  wow.slash("/mb sound trumpet")
  eq(#wow.chat, 4)
  eq(wow.chat[3], PREFIX .. "/mb sound followed by bell, chime, horn, warning or whisper picks the bell and plays it once.")
  eq(select(2, wow.chat[3]:gsub("|", "")), 2, "no escape code in the help but the prefix colour")
  eq(MailBellDB.settings.bell, "bell")
  eq(MailBellDB.settings.sound, true)
  eq(#w.sounds, 0)
end)

test("a chosen bell this client does not know rings the bell of 1.0", function(wow)
  local w = world(wow)
  MailBellDB = { version = 3, settings = { bell = "horn" } }
  SOUNDKIT = { ALARM_CLOCK_WARNING_3 = 12889 }
  boot(wow, w)
  w.mail(true)
  eq(w.sounds[1].id, 12889)
  SOUNDKIT = nil
  wow.slash("/mb sound chime")
  eq(#w.sounds, 1, "no sound table, no sound and no error")
  eq(wow.chat[2], PREFIX .. "Sound is on: chime.")
  PlaySound = function() error("sound system busy") end
  SOUNDKIT = { MAP_PING = 3175 }
  w.mail(false, 1)
  w.mail(true, 60)
  eq(wow.chat[3], PREFIX .. "You have new mail.", "a failing sound call does not stop the chat line")
end)


-- Mail Bell 1.3: letters named by sender and subject, remembered per character.

local function letter(days, sender, subject, extra)
  local m = { money = 0, cod = 0, daysLeft = days, hasItem = 1, sender = sender, subject = subject }
  for k, v in pairs(extra or {}) do m[k] = v end
  return m
end

test("core 1.3: the letters that count, soonest first, with sender and subject", function(wow)
  local ns = boot(wow, world(wow))
  local secret = { secret = true }
  local list = ns.CountedLetters({
    letter(5, "Kel", "Ore"),
    letter(1.5, "Brakk", "Herbs"),
    letter(0.5, "Plain", "Hi", { hasItem = 0 }),       -- no items, no gold
    letter(0.2, "Cod", "Pay me", { cod = 500 }),      -- cash on delivery
    letter(1.5, secret, secret),                       -- the same day as Brakk: listed after him
    letter(2, "", "Gold", { money = 100, hasItem = 0 }),
  })
  eq(#list, 4)
  eq(list[1].sender, "Brakk")
  eq(list[1].subject, "Herbs")
  eq(list[2].sender, nil, "a secret sender is left out")
  eq(list[2].subject, nil)
  eq(list[3].sender, nil, "an empty sender")
  eq(list[3].subject, "Gold")
  eq(list[4].days, 5)
  local soonest, count = ns.ScanExpiry({ letter(5, "Kel", "Ore"), letter(1.5, "Brakk", "Herbs") }, 3)
  eq(soonest, 1.5)
  eq(count, 1)
  eq(ns.Within(3.9, 3), true)
  eq(ns.Within(4, 3), false)
  eq(ns.Within(1, 0), false, "the warning is off")
end)

test("core 1.3: how letters are named in chat", function(wow)
  local ns = boot(wow, world(wow))
  eq(ns.LetterLabel("Brakk", "Herbs"), 'Brakk "Herbs"')
  eq(ns.LetterLabel("Brakk", nil), "Brakk")
  eq(ns.LetterLabel(nil, "Herbs"), '"Herbs"')
  eq(ns.LetterLabel("", ""), "a letter")
  eq(ns.LetterLabel(nil, nil), "a letter")
  eq(ns.LetterLabel("Brakk", "|cffff0000|Hitem:1|h[Gold]|h|r"), 'Brakk "||cffff0000||Hitem:1||h[Gold]||h||r"', "no links or colours from other players")
  eq(ns.LetterLabel("A|rB", nil), "A||rB")
  eq(ns.LetterLabel("Brakk", "Auction successful: Linen Cloth and more"), 'Brakk "Auction successful: Linen Clo..."')
  eq(ns.LetterLabel(nil, string.rep("a", 28) .. "\195\164\195\164\195\164"), '"' .. string.rep("a", 28) .. '..."', "a letter of two bytes is never cut in half")
  eq(ns.LetterLabel(nil, string.rep("b", 32)), '"' .. string.rep("b", 32) .. '"', "32 characters fit")
  eq(ns.NameList({ "A", "B" }), "A, B")
  eq(ns.NameList({ "A", "B", "C", "D", "E" }), "A, B, C and 2 more")
  eq(ns.NameList({}), "")
  eq(ns.ExpiryWarning(1, 0.5, 3, { 'Brakk "Herbs"' }), 'A letter with items or gold runs out in less than a day: Brakk "Herbs". Take it out before it is returned or deleted.')
  eq(ns.ExpiryWarning(2, 1.2, 3, { "A", "B" }), "2 letters with items or gold run out within 3 days, the first in 1 day: A, B. Take them out before they are returned or deleted.")
  eq(ns.ExpiryWarning(2, 1.2, 3, {}), "2 letters with items or gold run out within 3 days, the first in 1 day. Take them out before they are returned or deleted.", "no names: the line of 1.1")
end)

test("core 1.3: letters remembered per character", function(wow)
  local ns = boot(wow, world(wow))
  local now = 1000000
  local chars = { ["Yubi-Silvermoon"] = { mail = true, since = 3 } }
  local counted = ns.CountedLetters({
    letter(1, "A", "1"), letter(2, "B", "2"), letter(3, "C", "3"), letter(4, "D", "4"), letter(5, "E", "5"), letter(6, "F", "6"),
  })
  ns.NoteLetters(chars, "Yubi-Silvermoon", counted, now)
  local saved = chars["Yubi-Silvermoon"].letters
  eq(#saved, ns.LETTERS)
  eq(saved[1].sender, "A")
  eq(saved[1].expires, now + DAY)
  eq(saved[5].subject, "5")
  eq(chars["Yubi-Silvermoon"].mail, true, "the mail note is kept")
  ns.NoteLetters(chars, "Yubi-Silvermoon", {}, now)
  eq(chars["Yubi-Silvermoon"].letters, nil, "nothing left to run out")
  ns.NoteLetters(chars, "New-Silvermoon", counted, now)
  eq(#chars["New-Silvermoon"].letters, 5)
  eq(ns.CleanLetters({ { expires = 5, sender = "A", subject = 4 }, "x", { sender = "B" }, { expires = 0 / 0 } })[1].subject, nil)
  eq(#ns.CleanLetters({ { expires = 5 }, "x", { sender = "B" } }), 1)
  eq(ns.CleanLetters({ "x" }), nil)
  eq(ns.CleanLetters("broken"), nil)
end)

test("core 1.3: the login line of the character being played", function(wow)
  local ns = boot(wow, world(wow))
  local now = 2000000
  local c = { letters = {
    { sender = "Gone", subject = "Old", expires = now - 10 },
    { sender = "Brakk", subject = "Herbs", expires = now + 1.5 * DAY },
    { sender = "Auction House", expires = now + 2.5 * DAY },
    { sender = "Kel", subject = "Ore", expires = now + 9 * DAY },
  } }
  eq(ns.OwnExpiryText(c, now, 3), 'From your last mailbox visit: 2 letters with items or gold on this character run out within 3 days, the first in 1 day: Brakk "Herbs", Auction House. Open a mailbox to take them out.')
  eq(ns.OwnExpiryText(c, now, 1), 'From your last mailbox visit: a letter with items or gold on this character runs out in 1 day: Brakk "Herbs". Open a mailbox to take it out.')
  eq(ns.OwnExpiryText(c, now, 0), nil, "the warning is off")
  eq(ns.OwnExpiryText(c, now + 20 * DAY, 3), nil, "all gone by now")
  eq(ns.OwnExpiryText({ expires = now + DAY / 2 }, now, 3), "From your last mailbox visit: mail with items or gold on this character runs out in less than a day. Open a mailbox to take it out.", "saved by 1.2: only the date")
  eq(ns.OwnExpiryText({ expires = now + 5 * DAY }, now, 3), nil)
  eq(ns.OwnExpiryText(nil, now, 3), nil)
  eq(ns.OwnExpiryText({}, now, 3), nil)
end)

test("core 1.3: the lines of /mb letters", function(wow)
  local ns = boot(wow, world(wow))
  local now = 3000000
  local chars = {
    ["Yubi-Silvermoon"] = { letters = { { sender = "Brakk", subject = "Herbs", expires = now + 2.5 * DAY }, { expires = now + 20 * DAY } } },
    ["Kel-Argent Dawn"] = { letters = { { sender = "Auction House", subject = "Sold", expires = now + DAY / 2 } } },
    ["Old-Silvermoon"] = { expires = now + 4 * DAY }, -- saved by 1.2
    ["Gone-Silvermoon"] = { letters = { { sender = "X", expires = now - 1 } } },
    ["Empty-Silvermoon"] = { mail = false },
    Odd = "broken",
  }
  local lines = ns.LetterLines(chars, now, "Silvermoon")
  eq(#lines, 3)
  eq(lines[1], 'Kel (Argent Dawn): Auction House "Sold" in less than a day')
  eq(lines[2], 'Yubi: Brakk "Herbs" in 2 days, a letter in 20 days')
  eq(lines[3], "Old: the first in 4 days")
  eq(#ns.LetterLines({}, now, "Silvermoon"), 0)
end)

test("open mailbox 1.3: more than three letters, the rest are counted", function(wow)
  local w = world(wow)
  boot(wow, w)
  w.openMailbox(5, {
    { items = 1, days = 2, sender = "C" }, { items = 1, days = 0.5, sender = "A" }, { items = 1, days = 1, sender = "B", subject = "Bee" },
    { money = 9, days = 3, sender = "D" }, { money = 9, days = 3.5, sender = "E" },
  })
  eq(wow.chat[1], PREFIX .. '5 letters with items or gold run out within 3 days, the first in less than a day: A "Hello", B "Bee", C "Hello" and 2 more. Take them out before they are returned or deleted.')
  local saved = MailBellDB.chars["Yubi-Silvermoon"].letters
  eq(#saved, 5)
  eq(saved[1].sender, "A")
  eq(saved[1].expires, wow.now + DAY / 2)
end)

test("the next login names this character's letters from the last visit", function(wow)
  local w = world(wow)
  boot(wow, w)
  w.run() -- this login's list, nothing to say yet
  w.openMailbox(2, { { items = 1, days = 2.5, sender = "Brakk", subject = "Herbs" }, { items = 1, days = 12, sender = "Kel" } })
  w.closeMailbox()
  wow.now = wow.now + DAY -- a day later
  wow.chat = {}
  wow.frames[1].events = {}
  boot(wow, w)
  w.run()
  eq(#wow.chat, 1)
  eq(wow.chat[1], PREFIX .. 'From your last mailbox visit: a letter with items or gold on this character runs out in 1 day: Brakk "Herbs". Open a mailbox to take it out.')
  wow.slash("/mb login off")
  wow.fire("PLAYER_LOGIN")
  w.run()
  eq(#wow.chat, 2, "with the login list off it stays quiet")
  wow.slash("/mb login on")
  wow.slash("/mb expire off")
  wow.fire("PLAYER_LOGIN")
  w.run()
  eq(#wow.chat, 4, "and with the warning off")
end)

test("/mb letters lists the letters on every character", function(wow)
  local w = world(wow)
  boot(wow, w)
  wow.slash("/mb letters")
  eq(wow.chat[1], PREFIX .. "No letters with items or gold noted. Mail Bell notes them when you open a mailbox.")
  MailBellDB.chars["Brakk-Argent Dawn"] = { mail = true, letters = { { sender = "Auction House", subject = "Sold", expires = wow.now + 4 * DAY } } }
  w.openMailbox(1, { { money = 50, days = 1.2, sender = "Kel", subject = "Loan" } })
  wow.chat = {}
  wow.slash("/mb LETTERS ")
  eq(#wow.chat, 3)
  eq(wow.chat[1], PREFIX .. "Letters with items or gold, as of each character's last mailbox visit:")
  eq(wow.chat[2], '  Yubi: Kel "Loan" in 1 day')
  eq(wow.chat[3], '  Brakk (Argent Dawn): Auction House "Sold" in 4 days')
  wow.slash("/mb letters please")
  eq(wow.chat[4]:match("Mail waiting on: Brakk") ~= nil, true, "another word after it shows the overview")
end)

test("1.3: secret or odd senders and subjects are no error", function(wow)
  local w = world(wow)
  local secret = { secret = true }
  boot(wow, w)
  w.openMailbox(2, { { items = 1, days = 1, sender = secret, subject = secret }, { items = 1, days = 2, sender = 42, subject = "x|r|cff00ff00" } })
  eq(wow.chat[1], PREFIX .. '2 letters with items or gold run out within 3 days, the first in 1 day: a letter, "x||r||cff00ff00". Take them out before they are returned or deleted.')
  local saved = MailBellDB.chars["Yubi-Silvermoon"].letters
  eq(saved[1].sender, nil)
  eq(saved[2].subject, "x|r|cff00ff00", "kept as the game told it, made safe when shown")
end)

test("1.2 saved data is kept, letters come with the next mailbox visit, broken ones are dropped", function(wow)
  local w = world(wow)
  MailBellDB = { version = 3, settings = { sound = false, login = true, expire = 5, bell = "horn" }, chars = {
    ["Yubi-Silvermoon"] = { mail = false, expires = wow.now + 2 * DAY },
    ["Brakk-Silvermoon"] = { mail = true, since = 7, letters = { { expires = 9, sender = "A" }, "broken", { sender = "B" } } },
    ["Kel-Silvermoon"] = { letters = "broken" },
  } }
  local saved = MailBellDB
  boot(wow, w)
  eq(MailBellDB, saved)
  eq(saved.version, 4)
  eq(saved.settings.sound, false)
  eq(saved.settings.expire, 5)
  eq(saved.settings.bell, "horn")
  eq(saved.chars["Yubi-Silvermoon"].expires, wow.now + 2 * DAY)
  eq(saved.chars["Yubi-Silvermoon"].letters, nil)
  eq(#saved.chars["Brakk-Silvermoon"].letters, 1)
  eq(saved.chars["Brakk-Silvermoon"].since, 7)
  eq(saved.chars["Kel-Silvermoon"].letters, nil)
  w.run()
  eq(wow.chat[2], PREFIX .. "From your last mailbox visit: mail with items or gold on this character runs out in 2 days. Open a mailbox to take it out.")
end)

-- 1.4: German ---------------------------------------------------------------------------------------

-- Every placeholder of a text, in order: "%d", "%s".
local function placeholders(text)
  local out = {}
  for p in text:gmatch("%%[%d%.]*[%a%%]") do out[#out + 1] = p end
  return table.concat(out, " ")
end

test("German client: the bell, the login lines and the expiry warning in German", function(wow)
  local w = world(wow)
  wow.locale = "deDE"
  MailBellDB = { chars = {
    ["Brakk-Silvermoon"] = { mail = true, since = 10, expires = wow.now + 2.5 * DAY },
    ["Kel-Argent Dawn"] = { mail = true, since = 20 },
    ["Yubi-Silvermoon"] = { letters = { { sender = "Auktionshaus", subject = "Auktion erfolgreich", expires = wow.now + 1.5 * DAY } } },
  } }
  boot(wow, w)
  w.run()
  eq(#wow.chat, 3)
  eq(wow.chat[1], PREFIX .. "Post liegt bereit bei: Brakk, Kel (Argent Dawn)")
  eq(wow.chat[2], PREFIX .. "Post mit Gegenständen oder Gold läuft bald ab bei: Brakk in 2 Tagen")
  eq(wow.chat[3], PREFIX .. "Laut deinem letzten Briefkastenbesuch läuft auf diesem Charakter ein Brief mit Gegenständen oder Gold in 1 Tag ab: Auktionshaus „Auktion erfolgreich“. Öffne einen Briefkasten, um den Inhalt herauszuholen.")
  w.mail(true)
  eq(#w.sounds, 1)
  eq(wow.chat[4], PREFIX .. "Du hast neue Post.")
  w.openMailbox(3, {
    { money = 25000, days = 1.5, sender = "Auktionshaus", subject = "Auktion erfolgreich: Leinenstoff" },
    { items = 1, days = 2.2, sender = "Brakk", subject = "Kräuter" },
    { items = 1, days = 20 },
  })
  eq(wow.chat[5], PREFIX .. "2 Briefe mit Gegenständen oder Gold laufen innerhalb von 3 Tagen ab, der erste in 1 Tag: Auktionshaus „Auktion erfolgreich: Leinenstoff“, Brakk „Kräuter“. Hol den Inhalt heraus, bevor die Briefe zurückgehen oder gelöscht werden.", "senders and subjects stay as the game gives them")
end)

test("German client: every command answers in German, the command words stay English", function(wow)
  local w = world(wow)
  wow.locale = "deDE"
  MailBellDB = { chars = { ["Brakk-Argent Dawn"] = { mail = true, since = 1 }, ["Yubi-Silvermoon"] = { mail = false } } }
  boot(wow, w)
  wow.slash("/mb")
  eq(#wow.chat, 6)
  eq(wow.chat[1], PREFIX .. "Post liegt bereit bei: Brakk (Argent Dawn)")
  eq(wow.chat[2], PREFIX .. "Der Ton ist an: bell. Die Liste beim Einloggen ist an. Ablaufwarnung: Post mit Gegenständen oder Gold, die innerhalb von 3 Tagen abläuft.")
  eq(wow.chat[3], PREFIX .. "/mb sound on/off schaltet die Glocke an oder aus, /mb login on/off nennt beim Einloggen deine Charaktere mit Post, /mb forget Name-Realm entfernt einen Charakter.")
  eq(wow.chat[4], PREFIX .. "/mb expire mit 1 bis 30 Tagen oder off stellt die Warnung für Post mit Gegenständen oder Gold ein, die bald abläuft.")
  eq(wow.chat[5], PREFIX .. "/mb sound mit bell, chime, horn, warning oder whisper wählt die Glocke und spielt sie einmal ab.")
  eq(wow.chat[6], PREFIX .. "/mb letters zeigt die Briefe mit Gegenständen oder Gold auf allen deinen Charakteren, jeweils vom letzten Briefkastenbesuch.")
  wow.slash("/mb sound off")
  eq(wow.chat[7], PREFIX .. "Der Ton ist aus.")
  wow.slash("/mb sound chime")
  eq(wow.chat[8], PREFIX .. "Der Ton ist an: chime.")
  wow.slash("/mb login off")
  eq(wow.chat[9], PREFIX .. "Die Liste beim Einloggen ist aus.")
  wow.slash("/mb expire 1")
  eq(wow.chat[10], PREFIX .. "Ablaufwarnung: Post mit Gegenständen oder Gold, die innerhalb von 1 Tag abläuft.")
  wow.slash("/mb expire 7")
  eq(wow.chat[11], PREFIX .. "Ablaufwarnung: Post mit Gegenständen oder Gold, die innerhalb von 7 Tagen abläuft.")
  wow.slash("/mb expire off")
  eq(wow.chat[12], PREFIX .. "Die Ablaufwarnung ist aus.")
  wow.slash("/mb forget Nobody-Nowhere")
  eq(wow.chat[13], PREFIX .. "Kein Charakter namens Nobody-Nowhere. Schreibweise: Name-Realm.")
  wow.slash("/mb forget yubi-silvermoon")
  eq(wow.chat[14], PREFIX .. "Den Charakter, den du gerade spielst, kannst du nicht entfernen.")
  wow.slash("/mb forget brakk-argent dawn")
  eq(wow.chat[15], PREFIX .. "Brakk-Argent Dawn entfernt.")
  wow.slash("/mb letters")
  eq(wow.chat[16], PREFIX .. "Keine Briefe mit Gegenständen oder Gold notiert. Mail Bell notiert sie, wenn du einen Briefkasten öffnest.")
  wow.slash("/mb")
  eq(wow.chat[17], PREFIX .. "Bei deinen anderen Charakteren liegt keine Post bereit.")
end)

test("German client: days, letter names, /mb letters and every expiry line in German", function(wow)
  local w = world(wow)
  wow.locale = "deDE"
  local ns = boot(wow, w)
  eq(ns.DaysText(0.5), "weniger als einem Tag")
  eq(ns.DaysText(1.9), "1 Tag")
  eq(ns.DaysText(4), "4 Tagen", "always after in or innerhalb von: the dative")
  eq(ns.LetterLabel("Brakk", "Kräuter"), "Brakk „Kräuter“")
  eq(ns.LetterLabel(nil, "Kräuter"), "„Kräuter“")
  eq(ns.LetterLabel(nil, nil), "ein Brief")
  eq(ns.NameList({ "A", "B", "C", "D", "E" }), "A, B, C und 2 weitere")
  eq(ns.ExpiryWarning(1, 0.5, 3, {}), "Ein Brief mit Gegenständen oder Gold läuft in weniger als einem Tag ab. Hol den Inhalt heraus, bevor der Brief zurückgeht oder gelöscht wird.")
  eq(ns.ExpiryWarning(1, 2, 3, { "Brakk „Kräuter“" }), "Ein Brief mit Gegenständen oder Gold läuft in 2 Tagen ab: Brakk „Kräuter“. Hol den Inhalt heraus, bevor der Brief zurückgeht oder gelöscht wird.")
  eq(ns.ExpiryWarning(2, 1.2, 3, {}), "2 Briefe mit Gegenständen oder Gold laufen innerhalb von 3 Tagen ab, der erste in 1 Tag. Hol den Inhalt heraus, bevor die Briefe zurückgehen oder gelöscht werden.")
  local now = 2000000
  local c = { letters = {
    { sender = "Brakk", subject = "Kräuter", expires = now + 1.5 * DAY },
    { sender = "Auktionshaus", expires = now + 2.5 * DAY },
  } }
  eq(ns.OwnExpiryText(c, now, 3), "Laut deinem letzten Briefkastenbesuch laufen auf diesem Charakter 2 Briefe mit Gegenständen oder Gold innerhalb von 3 Tagen ab, der erste in 1 Tag: Brakk „Kräuter“, Auktionshaus. Öffne einen Briefkasten, um den Inhalt herauszuholen.")
  eq(ns.OwnExpiryText({ expires = now + DAY / 2 }, now, 3), "Laut deinem letzten Briefkastenbesuch läuft auf diesem Charakter Post mit Gegenständen oder Gold in weniger als einem Tag ab. Öffne einen Briefkasten, um den Inhalt herauszuholen.")
  MailBellDB.chars["Kel-Argent Dawn"] = { letters = { { sender = "Auktionshaus", subject = "Verkauft", expires = wow.now + DAY / 2 } } }
  MailBellDB.chars["Old-Silvermoon"] = { expires = wow.now + 4 * DAY }
  w.openMailbox(2, { { money = 50, days = 2.5, sender = "Brakk", subject = "Kräuter" }, { items = 1, days = 20 } })
  wow.chat = {}
  wow.slash("/mb letters")
  eq(#wow.chat, 4)
  eq(wow.chat[1], PREFIX .. "Briefe mit Gegenständen oder Gold, jeweils vom letzten Briefkastenbesuch des Charakters:")
  eq(wow.chat[2], "  Kel (Argent Dawn): Auktionshaus „Verkauft“ in weniger als einem Tag")
  eq(wow.chat[3], "  Yubi: Brakk „Kräuter“ in 2 Tagen, Someone „Hello“ in 20 Tagen")
  eq(wow.chat[4], "  Old: der erste in 4 Tagen")
end)

test("German texts keep every placeholder of the English text, in order", function(wow)
  wow.locale = "deDE"
  local ns = boot(wow, world(wow))
  local n = 0
  for key, text in pairs(ns.L) do
    n = n + 1
    eq(placeholders(text), placeholders(key), key)
  end
  eq(n, 38, "every text on screen has its German one")
end)

test("an English client keeps the English texts", function(wow)
  wow.locale = "enGB"
  local w = world(wow)
  local ns = boot(wow, w)
  eq(next(ns.L), nil)
  w.mail(true)
  eq(wow.chat[1], PREFIX .. "You have new mail.")
  eq(ns.DaysText(4), "4 days")
  eq(ns.LetterLabel("Brakk", "Herbs"), 'Brakk "Herbs"')
end)
