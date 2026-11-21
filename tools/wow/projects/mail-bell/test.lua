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
    return nil, "Interface\\Icons\\INV_Misc_Note_01", "Someone", "Hello", m.money or 0, m.cod or 0, m.days or 30, m.items, false
  end
  SOUNDKIT = { ALARM_CLOCK_WARNING_3 = 12889, TELL_MESSAGE = 3081 }
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
  local allowed = { MailBellDB = true, SLASH_MAILBELL1 = true, SLASH_MAILBELL2 = true }
  for k in pairs(_G) do
    if not mine[k] and not allowed[k] then error("unexpected global " .. tostring(k)) end
  end
  eq(#w.sounds, 1)
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
  eq(db.version, 2)
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
  eq(wow.chat[2], PREFIX .. "Sound is on. Login list is on. Expiry warning: mail with items or gold that runs out within 3 days.")
  eq(wow.chat[3]:match("/mb forget Name%-Realm removes a character") ~= nil, true)
  eq(wow.chat[4], PREFIX .. "/mb expire followed by 1 to 30 days, or off, sets the warning for mail with items or gold that runs out soon.")
  wow.slash("/mb sound off")
  eq(wow.chat[5], PREFIX .. "Sound is off.")
  eq(MailBellDB.settings.sound, false)
  wow.slash("/mailbell  SOUND  On ")
  eq(wow.chat[6], PREFIX .. "Sound is on.")
  eq(MailBellDB.settings.sound, true)
  wow.slash("/mb login off")
  eq(wow.chat[7], PREFIX .. "Login list is off.")
  wow.slash("/mb login loud")
  eq(wow.chat[8]:match("^" .. PREFIX:gsub("|", "%%|") .. "/mb sound on/off") ~= nil, true, "a bad word shows the help")
  eq(MailBellDB.settings.login, false)
  MailBellDB.chars["Brakk-Argent Dawn"].mail = false
  wow.slash("/mb whatever")
  eq(wow.chat[10], PREFIX .. "No mail waiting on your other characters.")
  eq(wow.chat[11], PREFIX .. "Sound is on. Login list is off. Expiry warning: mail with items or gold that runs out within 3 days.")
  eq(#wow.chat, 13)
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
  eq(db.version, 2)
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
    { money = 25000, days = 1.5 },
    { items = 1, days = 2.2 },
    { items = 1, days = 20 },
  })
  eq(#wow.chat, 1)
  eq(wow.chat[1], PREFIX .. "2 letters with items or gold run out within 3 days, the first in 1 day. Take them out before they are returned or deleted.")
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
  eq(wow.chat[1], PREFIX .. "A letter with items or gold runs out in less than a day. Take it out before it is returned or deleted.")
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
  eq(#wow.chat, 2)
  eq(wow.chat[1], PREFIX .. "Mail waiting on: Brakk")
  eq(wow.chat[2], PREFIX .. "Mail with items or gold runs out soon on: Yubi in less than a day, Brakk in 2 days")
  wow.slash("/mb")
  eq(wow.chat[4], PREFIX .. "Mail with items or gold runs out soon on: Yubi in less than a day, Brakk in 2 days", "/mb shows it too")

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
  eq(wow.chat[6], PREFIX .. "Expiry warning is off.")
  eq(MailBellDB.settings.expire, 0)
  w.openMailbox(1, { { money = 100, days = 0.5 } })
  eq(#wow.chat, 6, "no warning when it is off")
  eq(MailBellDB.chars["Yubi-Silvermoon"].expires, wow.now + 0.5 * DAY, "but the date is still noted")
  wow.fire("PLAYER_LOGIN")
  w.run()
  eq(#wow.chat, 6, "and the login list stays quiet about it")
  wow.slash("/mb expire 3")
  w.openMailbox(1)
  eq(wow.chat[8], PREFIX .. "A letter with items or gold runs out in less than a day. Take it out before it is returned or deleted.")
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
