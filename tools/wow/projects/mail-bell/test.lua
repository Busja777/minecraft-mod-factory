-- Tests for Mail Bell, run by tools/wow/client/run.lua.

-- The parts of the game the stand-in client lacks: the mail flag, the inbox, sounds and a timer.
local function world(wow)
  local w = { newMail = false, inbox = 0, sounds = {}, timers = {} }
  HasNewMail = function() return w.newMail end
  GetInboxNumItems = function() return w.inbox, w.inbox end
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
  function w.openMailbox(items)
    w.inbox = items
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
  eq(db.version, 1)
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
  eq(wow.chat[2], PREFIX .. "Sound is on. Login list is on.")
  eq(wow.chat[3]:match("/mb forget Name%-Realm removes a character") ~= nil, true)
  wow.slash("/mb sound off")
  eq(wow.chat[4], PREFIX .. "Sound is off.")
  eq(MailBellDB.settings.sound, false)
  wow.slash("/mailbell  SOUND  On ")
  eq(wow.chat[5], PREFIX .. "Sound is on.")
  eq(MailBellDB.settings.sound, true)
  wow.slash("/mb login off")
  eq(wow.chat[6], PREFIX .. "Login list is off.")
  wow.slash("/mb login loud")
  eq(wow.chat[7]:match("^" .. PREFIX:gsub("|", "%%|") .. "/mb sound on|off") ~= nil, true, "a bad word shows the help")
  eq(MailBellDB.settings.login, false)
  MailBellDB.chars["Brakk-Argent Dawn"].mail = false
  wow.slash("/mb whatever")
  eq(wow.chat[8], PREFIX .. "No mail waiting on your other characters.")
  eq(wow.chat[9], PREFIX .. "Sound is on. Login list is off.")
  eq(#wow.chat, 10)
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
