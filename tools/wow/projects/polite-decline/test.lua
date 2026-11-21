-- Tests for Polite Decline, run by tools/wow/client/run.lua.

-- The parts of the game the stand-in client lacks: friends, Battle.net friends, a guild,
-- the decline functions, popups and a timer. Every call is recorded.
--   friends: { guid = name }   bnet: { { guid, char, realm } }   guild: { { guid, name } } ("Name-Realm")
local function world(wow)
  local w = {
    friends = {}, bnet = {}, guild = {}, inGuild = nil, -- nil: in a guild when the roster has members
    cancelled = 0, declined = 0, hidden = {}, timers = {}, rosterRequests = 0,
    whispers = {}, instance = false, instanceType = "none", lockdown = false,
  }

  GetNormalizedRealmName = function() return "Silvermoon" end
  C_FriendList = {
    IsFriend = function(guid)
      return w.friends[guid] ~= nil
    end,
    GetFriendInfo = function(name)
      for _, friend in pairs(w.friends) do
        if friend == name then return { name = friend, connected = true } end
      end
      return nil
    end,
  }
  C_BattleNet = {
    GetAccountInfoByGUID = function(guid)
      for _, b in ipairs(w.bnet) do
        if b.guid == guid then return { battleTag = "Pal#1234" } end
      end
      return nil
    end,
    GetFriendNumGameAccounts = function(i) return w.bnet[i] and 1 or 0 end,
    GetFriendGameAccountInfo = function(i)
      local b = w.bnet[i]
      if not b then return nil end
      return { characterName = b.char, realmName = b.realm, playerGuid = b.guid, clientProgram = "WoW" }
    end,
  }
  BNGetNumFriends = function() return #w.bnet, #w.bnet end
  IsGuildMember = function(guid)
    for _, m in ipairs(w.guild) do if m.guid == guid then return true end end
    return false
  end
  IsInGuild = function() if w.inGuild == nil then return #w.guild > 0 end return w.inGuild end
  GetNumGuildMembers = function() return #w.guild, #w.guild, #w.guild end
  GetGuildRosterInfo = function(i) return w.guild[i] and w.guild[i].name end
  C_GuildInfo = { GuildRoster = function() w.rosterRequests = w.rosterRequests + 1 end }

  CancelDuel = function() w.cancelled = w.cancelled + 1 end
  DeclineGroup = function() w.declined = w.declined + 1 end
  StaticPopup_Hide = function(which) w.hidden[#w.hidden + 1] = which end
  C_Timer = { After = function(seconds, fn) w.timers[#w.timers + 1] = { seconds = seconds, fn = fn } end }
  IsInInstance = function() return w.instance, w.instanceType end
  C_ChatInfo = {
    SendChatMessage = function(text, chatType, language, target)
      w.whispers[#w.whispers + 1] = { text = text, chatType = chatType, language = language, target = target }
    end,
    InChatMessagingLockdown = function() return w.lockdown end,
  }

  function w.run()
    local due = w.timers
    w.timers = {}
    for _, t in ipairs(due) do t.fn() end
  end
  function w.duel(name) wow.fire("DUEL_REQUESTED", name) end
  function w.invite(name, guid) wow.fire("PARTY_INVITE_REQUEST", name, false, false, true, true, false, guid, false) end
  return w
end

local function boot(wow)
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("ADDON_LOADED", "PoliteDecline")
  wow.fire("PLAYER_LOGIN")
  return ns
end

local PREFIX = "|cffffd100Polite Decline:|r "
local SECRET = { secret = true }

test("addon defines only its own globals", function(wow)
  local w = world(wow)
  local mine = {}
  for k in pairs(_G) do mine[k] = true end
  boot(wow)
  w.duel("Grumbash")
  w.invite("Stranger", "Player-1-0001")
  w.run()
  wow.slash("/pd")
  wow.slash("/pd allow Thrall")
  wow.slash("/politedecline list")
  local allowed = { PoliteDeclineDB = true, SLASH_POLITEDECLINE1 = true, SLASH_POLITEDECLINE2 = true }
  for k in pairs(_G) do
    if not mine[k] and not allowed[k] then error("unexpected global " .. tostring(k)) end
  end
  eq(w.cancelled, 1)
  eq(w.declined, 1)
end)

test("core: names are compared without case, with or without realm", function(wow)
  local ns = boot(wow)
  local base, realm = ns.SplitName("  Grumbash-Argent Dawn ")
  eq(base, "grumbash")
  eq(realm, "argentdawn")
  base, realm = ns.SplitName("Thrall")
  eq(base, "thrall")
  eq(realm, nil)
  eq(ns.SplitName(""), nil)
  eq(ns.SplitName("   "), nil)
  eq(ns.SplitName("-Silvermoon"), nil)
  eq(ns.SplitName("Two Words"), nil)
  eq(ns.SplitName(nil), nil)
  eq(ns.SplitName(SECRET), nil)
  eq(ns.NameKey("GRUMBASH"), "grumbash")
  eq(ns.NameKey("Grumbash-ArgentDawn"), "grumbash-argentdawn")
  eq(ns.NameKey("Grumbash-Azjol-Nerub"), "grumbash-azjolnerub", "a realm with a hyphen")
  eq(ns.NameKey("Grumbash-Argent Dawn"), ns.NameKey("grumbash-argentdawn"))
  eq(ns.SameName("Grumbash", "grumbash-Silvermoon", "Silvermoon"), true, "own realm")
  eq(ns.SameName("Grumbash", "Grumbash-Kazzak", "Silvermoon"), false, "other realm")
  eq(ns.SameName("Grumbash-Kazzak", "GRUMBASH-kazzak", "Silvermoon"), true)
  eq(ns.SameName("Grumbash", "Grumbosh", "Silvermoon"), false)
  eq(ns.NormalizeRealm("Aggra (Português)"), "aggra(português)")
end)

test("core: the allow list matches by name, by name and realm", function(wow)
  local ns = boot(wow)
  local allow = { thrall = "Thrall", ["jaina-kazzak"] = "Jaina-Kazzak", ["anduin-silvermoon"] = "Anduin-Silvermoon" }
  eq(ns.IsAllowed(allow, "Thrall", "Silvermoon"), true)
  eq(ns.IsAllowed(allow, "thrall-Kazzak", "Silvermoon"), true, "a name without realm counts on every realm")
  eq(ns.IsAllowed(allow, "Jaina-Kazzak", "Silvermoon"), true)
  eq(ns.IsAllowed(allow, "Jaina", "Silvermoon"), false, "Jaina from the own realm is someone else")
  eq(ns.IsAllowed(allow, "Jaina", "Kazzak"), true, "unless the player is on Kazzak too")
  eq(ns.IsAllowed(allow, "Anduin", "Silvermoon"), true)
  eq(ns.IsAllowed(allow, "Anduin", nil), false, "home realm unknown")
  eq(ns.IsAllowed(allow, "Grumbash", "Silvermoon"), false)
  eq(ns.IsAllowed(nil, "Thrall", "Silvermoon"), false)
  eq(ns.IsAllowed(allow, SECRET, "Silvermoon"), false)
end)

test("core: the decision for every kind of person", function(wow)
  local ns = boot(wow)
  local on = { duels = true, invites = true }
  local function decide(kind, person, settings, allow)
    local d, why = ns.Decide(kind, settings or on, person, allow or {}, "Silvermoon")
    return tostring(d) .. " " .. why
  end
  eq(decide("duel", { name = "Grumbash", friend = false, bnet = false, guild = false }), "true stranger")
  eq(decide("invite", { name = "Grumbash" }), "true stranger")
  eq(decide("duel", { name = "Grumbash", friend = true }), "false friend")
  eq(decide("invite", { name = "Grumbash", bnet = true }), "false bnet")
  eq(decide("invite", { name = "Grumbash", guild = true }), "false guild")
  eq(decide("duel", { name = "Grumbash" }, nil, { grumbash = "Grumbash" }), "false allowed")
  eq(decide("duel", { name = "Grumbash", unsure = true }), "false unsure")
  eq(decide("duel", { name = SECRET }), "false unsure", "secret name")
  eq(decide("duel", { name = "" }), "false unsure")
  eq(decide("duel", nil), "false unsure")
  eq(decide("duel", { name = "Grumbash" }, { duels = false, invites = true }), "false off")
  eq(decide("invite", { name = "Grumbash" }, { duels = true, invites = false }), "false off")
  eq(decide("invite", { name = "Grumbash" }, { duels = false, invites = true }), "true stranger", "duels off leaves invites")
  eq(decide("trade", { name = "Grumbash" }), "false unknown")
  eq(decide("duel", { name = "Grumbash" }, "broken"), "false unknown")
end)

test("core: the chat line and the sorted allow list", function(wow)
  local ns = boot(wow)
  eq(ns.DeclineLine("duel", "Grumbash", 3), "Declined a duel from Grumbash (3 this session).")
  eq(ns.DeclineLine("invite", "Grumbash-Kazzak", 1), "Declined a group invite from Grumbash-Kazzak (1 this session).")
  eq(table.concat(ns.AllowNames({ b = "bob", a = "Anna", c = "Carl-Kazzak" }), ","), "Anna,bob,Carl-Kazzak")
  eq(#ns.AllowNames({}), 0)
  eq(#ns.AllowNames(nil), 0)
end)

test("a duel from a stranger is cancelled, its popup hidden, and one line tells it", function(wow)
  local w = world(wow)
  boot(wow)
  w.duel("Grumbash")
  eq(w.cancelled, 1)
  eq(table.concat(w.hidden, " "), "DUEL_REQUESTED")
  eq(#w.timers, 1)
  eq(w.timers[1].seconds, 0)
  w.run()
  eq(table.concat(w.hidden, " "), "DUEL_REQUESTED DUEL_REQUESTED", "hidden again on the next frame")
  eq(w.declined, 0, "a duel is not a group invite")
  eq(#wow.chat, 1)
  eq(wow.chat[1], PREFIX .. "Declined a duel from Grumbash (1 this session).")
end)

test("duels from friends, Battle.net friends and guild mates get through", function(wow)
  local w = world(wow)
  w.friends["Player-1-0001"] = "Pal"
  w.friends["Player-2-0002"] = "Farfriend-Kazzak"
  w.bnet = { { guid = "Player-3-0003", char = "Buddy", realm = "Argent Dawn" } }
  w.guild = { { guid = "Player-1-0004", name = "Mate-Silvermoon" } }
  boot(wow)
  w.duel("Pal")
  w.duel("Farfriend-Kazzak")
  w.duel("Buddy-ArgentDawn")
  w.duel("mate")
  w.run()
  eq(w.cancelled, 0)
  eq(#w.hidden, 0)
  eq(#wow.chat, 0)
  w.duel("Buddy") -- same name, but on the player's own realm: someone else
  w.duel("Mate-Kazzak")
  eq(w.cancelled, 2)
  eq(wow.chat[2], PREFIX .. "Declined a duel from Mate-Kazzak (2 this session).")
end)

test("a duel is let through when the guild roster has not arrived or a lookup is missing", function(wow)
  local w = world(wow)
  w.inGuild = true
  boot(wow)
  w.duel("Grumbash")
  eq(w.cancelled, 0, "in a guild, but the roster is empty")
  w.inGuild = false
  w.duel("Grumbash")
  eq(w.cancelled, 1, "without a guild there is nothing to wait for")
  BNGetNumFriends = nil
  w.duel("Grumbash")
  eq(w.cancelled, 1, "Battle.net friends cannot be checked")
  BNGetNumFriends = function() return 0, 0 end
  C_FriendList = nil
  w.duel("Grumbash")
  eq(w.cancelled, 1, "the friend list cannot be checked")
  eq(#wow.chat, 1)
end)

test("a group invite from a stranger is declined and its popups hidden", function(wow)
  local w = world(wow)
  boot(wow)
  w.invite("Grumbash-Kazzak", "Player-2-0099")
  eq(w.declined, 1)
  eq(w.cancelled, 0)
  eq(table.concat(w.hidden, " "), "PARTY_INVITE PARTY_INVITE_XREALM")
  w.run()
  eq(#w.hidden, 4)
  eq(wow.chat[1], PREFIX .. "Declined a group invite from Grumbash-Kazzak (1 this session).")
end)

test("group invites from friends, Battle.net friends, guild mates and allowed names get through", function(wow)
  local w = world(wow)
  w.friends["Player-1-0001"] = "Pal"
  w.bnet = { { guid = "Player-3-0003", char = "Buddy", realm = "Kazzak" } }
  w.guild = { { guid = "Player-1-0004", name = "Mate-Silvermoon" } }
  boot(wow)
  w.invite("Pal", "Player-1-0001")
  w.invite("Buddy-Kazzak", "Player-3-0003")
  w.invite("Mate", "Player-1-0004")
  eq(w.declined, 0)
  C_FriendList.IsFriend = function() return false end -- the GUID lookup misses, the name lookup finds
  w.invite("Pal", "Player-1-0001")
  eq(w.declined, 0)
  PoliteDeclineDB.allow.grumbash = "Grumbash"
  w.invite("GRUMBASH", "Player-1-0005")
  eq(w.declined, 0)
  eq(#wow.chat, 0)
end)

test("when unsure, nobody is declined: no GUID, secret GUID, secret name, secret answers", function(wow)
  local w = world(wow)
  boot(wow)
  w.invite("Grumbash", nil)
  w.invite("Grumbash", SECRET)
  w.invite(SECRET, "Player-1-0005")
  w.invite(nil, "Player-1-0005")
  w.duel(SECRET)
  w.duel(nil)
  IsGuildMember = function() return SECRET end
  w.invite("Grumbash", "Player-1-0005")
  IsGuildMember = function() return false end
  C_BattleNet.GetAccountInfoByGUID = function() return SECRET end
  w.invite("Grumbash", "Player-1-0005")
  C_BattleNet.GetAccountInfoByGUID = nil
  w.invite("Grumbash", "Player-1-0005")
  w.guild = { { name = SECRET } }
  w.duel("Grumbash")
  eq(w.declined, 0)
  eq(w.cancelled, 0)
  eq(#w.hidden, 0)
  eq(#wow.chat, 0)
end)

test("a known person counts even when another lookup cannot tell", function(wow)
  local w = world(wow)
  w.friends["Player-1-0001"] = "Pal"
  boot(wow)
  IsGuildMember = function() return SECRET end
  C_BattleNet = nil
  w.invite("Pal", "Player-1-0001")
  eq(w.declined, 0)
  local ns = wow.ns
  local person = ns.Identify("invite", "Pal", "Player-1-0001")
  eq(person.friend, true)
  eq(person.unsure, nil)
  person = ns.Identify("invite", "Grumbash", "Player-1-0009")
  eq(person.unsure, true)
end)

test("the counter runs per kind for the whole session", function(wow)
  local w = world(wow)
  boot(wow)
  w.duel("Grumbash")
  w.duel("Grumbash")
  w.invite("Spammer", "Player-1-0100")
  w.duel("Orcy")
  w.invite("Spammer", "Player-1-0100")
  eq(w.cancelled, 3)
  eq(w.declined, 2)
  eq(wow.chat[2], PREFIX .. "Declined a duel from Grumbash (2 this session).")
  eq(wow.chat[3], PREFIX .. "Declined a group invite from Spammer (1 this session).")
  eq(wow.chat[4], PREFIX .. "Declined a duel from Orcy (3 this session).")
  eq(wow.chat[5], PREFIX .. "Declined a group invite from Spammer (2 this session).")
end)

test("slash commands show the state and switch duels, invites and quiet mode", function(wow)
  local w = world(wow)
  boot(wow)
  wow.slash("/pd")
  eq(wow.chat[1], PREFIX .. "Declining duels from strangers is on. Declining group invites from strangers is on. Quiet mode is off. Reply whisper is off.")
  eq(wow.chat[2], PREFIX .. "/pd duels on/off, /pd invites on/off, /pd quiet on/off, /pd allow Name, /pd unallow Name, /pd list.")
  eq(wow.chat[3], PREFIX .. "/pd whisper on or off sends declined strangers a short polite whisper, /pd whisper text Your words sets it, /pd whisper reset brings back the default.")
  wow.slash("/pd duels off")
  eq(wow.chat[4], PREFIX .. "Declining duels from strangers is off.")
  eq(PoliteDeclineDB.settings.duels, false)
  w.duel("Grumbash")
  eq(w.cancelled, 0)
  wow.slash("/politedecline  DUELS On ")
  eq(wow.chat[5], PREFIX .. "Declining duels from strangers is on.")
  wow.slash("/pd invites off")
  eq(wow.chat[6], PREFIX .. "Declining group invites from strangers is off.")
  w.invite("Grumbash", "Player-1-0005")
  eq(w.declined, 0)
  wow.slash("/pd invites on")
  wow.slash("/pd quiet on")
  eq(wow.chat[8], PREFIX .. "Quiet mode is on: nothing is said in chat.")
  w.duel("Grumbash")
  w.invite("Grumbash", "Player-1-0005")
  eq(w.cancelled, 1, "quiet mode still declines")
  eq(w.declined, 1)
  eq(#wow.chat, 8, "but says nothing")
  wow.slash("/pd quiet off")
  w.duel("Grumbash")
  eq(wow.chat[10], PREFIX .. "Declined a duel from Grumbash (2 this session).", "quiet declines are counted too")
  wow.slash("/pd duels maybe")
  eq(wow.chat[11]:match("/pd duels on/off") ~= nil, true)
  eq(wow.chat[12]:match("/pd whisper on or off") ~= nil, true)
  wow.slash("/pd help")
  eq(wow.chat[13], wow.chat[11])
  eq(#wow.chat, 14)
  eq(#w.whispers, 0, "no whisper unless switched on")
end)

test("slash commands keep the allow list", function(wow)
  local w = world(wow)
  boot(wow)
  wow.slash("/pd list")
  eq(wow.chat[1], PREFIX .. "Your allow list is empty.")
  wow.slash("/pd allow Grumbash")
  eq(wow.chat[2], PREFIX .. "Grumbash is now on your allow list.")
  wow.slash("/pd allow grumbash")
  eq(wow.chat[3], PREFIX .. "Grumbash is already on your allow list.")
  wow.slash("/pd allow Jaina-Argent Dawn")
  eq(wow.chat[4], PREFIX .. "Jaina-Argent Dawn is now on your allow list.")
  eq(PoliteDeclineDB.allow["jaina-argentdawn"], "Jaina-Argent Dawn")
  wow.slash("/pd list")
  eq(wow.chat[5], PREFIX .. "Allow list: Grumbash, Jaina-Argent Dawn.")
  w.duel("grumbash-Kazzak")
  w.invite("Jaina-ArgentDawn", "Player-9-0001")
  eq(w.cancelled + w.declined, 0, "both get through")
  w.duel("Jaina")
  eq(w.cancelled, 1, "Jaina from the own realm is someone else")
  wow.slash("/pd unallow GRUMBASH")
  eq(wow.chat[7], PREFIX .. "Grumbash was removed from your allow list.")
  wow.slash("/pd unallow Grumbash")
  eq(wow.chat[8], PREFIX .. "Grumbash is not on your allow list.")
  w.duel("Grumbash")
  eq(w.cancelled, 2)
  wow.slash("/pd allow")
  eq(wow.chat[10], PREFIX .. "Type a name: /pd allow Name or Name-Realm.")
  wow.slash("/pd unallow  ")
  eq(wow.chat[11], PREFIX .. "Type a name: /pd unallow Name or Name-Realm.")
  wow.slash("/pd allow Two Words")
  eq(wow.chat[12], PREFIX .. "Type a name: /pd allow Name or Name-Realm.")
end)

test("settings survive: saved values are kept, new ones get their defaults", function(wow)
  local w = world(wow)
  w.inGuild = true
  boot(wow)
  eq(PoliteDeclineDB.version, 2)
  eq(PoliteDeclineDB.settings.duels, true)
  eq(PoliteDeclineDB.settings.invites, true)
  eq(PoliteDeclineDB.settings.quiet, false)
  eq(next(PoliteDeclineDB.allow), nil)
  eq(w.rosterRequests, 1, "the guild roster is asked for at login")

  PoliteDeclineDB = { settings = { duels = false }, allow = { thrall = "Thrall" }, later = "kept" } -- the next login
  wow.load(ADDON_DIR, ADDON_NAME)
  wow.frames[1].events = {} -- the first copy of the addon no longer listens
  wow.fire("PLAYER_LOGIN")
  eq(PoliteDeclineDB.settings.duels, false)
  eq(PoliteDeclineDB.settings.invites, true)
  eq(PoliteDeclineDB.later, "kept")
  w.duel("Grumbash")
  eq(w.cancelled, 0)
  w.invite("Thrall", "Player-1-0005")
  eq(w.declined, 0)

  PoliteDeclineDB = { settings = "broken", allow = 5 }
  w.inGuild = false
  wow.fire("PLAYER_LOGIN")
  eq(PoliteDeclineDB.settings.duels, true)
  eq(type(PoliteDeclineDB.allow), "table")
  eq(w.rosterRequests, 2, "no roster request without a guild")
end)

test("missing parts of the game are no error", function(wow)
  local w = world(wow)
  boot(wow)
  C_Timer = nil
  StaticPopup_Hide = nil
  GetNormalizedRealmName = nil -- the realm comes from GetRealmName instead
  w.duel("Grumbash")
  eq(w.cancelled, 1)
  eq(wow.chat[1], PREFIX .. "Declined a duel from Grumbash (1 this session).")
  CancelDuel = nil
  DeclineGroup = nil
  w.duel("Grumbash")
  w.invite("Grumbash", "Player-1-0005")
  eq(#wow.chat, 1, "nothing declined, nothing claimed")
  eq(#w.timers, 0)
  C_GuildInfo = nil
  wow.fire("PLAYER_LOGIN")
end)

test("events and slash commands before login do nothing", function(wow)
  local w = world(wow)
  wow.load(ADDON_DIR, ADDON_NAME)
  wow.slash("/pd duels off")
  w.duel("Grumbash")
  w.invite("Grumbash", "Player-1-0005")
  eq(w.cancelled + w.declined, 0)
  eq(#wow.chat, 0)
  eq(PoliteDeclineDB, nil)
end)

-- Polite Decline 1.1: the reply whisper.

local DEFAULT = "Thanks, but I don't take duels or group invites from people I don't know. Have a good day!"

test("core: a custom reply is cleaned, a name gets one key per character", function(wow)
  local ns = boot(wow)
  eq(ns.CleanWhisper("  Not   today,  friend! "), "Not today, friend!")
  eq(ns.CleanWhisper("No |cffff0000colours|r here"), "No cffff0000coloursr here", "no chat codes")
  eq(select(2, ns.CleanWhisper("   ")), "empty")
  eq(select(2, ns.CleanWhisper("||")), "empty")
  eq(select(2, ns.CleanWhisper(nil)), "empty")
  eq(select(2, ns.CleanWhisper(SECRET)), "empty")
  eq(ns.CleanWhisper(string.rep("a", 200)), string.rep("a", 200))
  eq(select(2, ns.CleanWhisper(string.rep("a", 201))), "long")
  eq(ns.WhisperKey("Grumbash", "Silvermoon"), "grumbash-silvermoon")
  eq(ns.WhisperKey("grumbash-Silvermoon", "Silvermoon"), "grumbash-silvermoon", "the same character")
  eq(ns.WhisperKey("Grumbash-Argent Dawn", "Silvermoon"), "grumbash-argentdawn")
  eq(ns.WhisperKey("Grumbash", nil), "grumbash-")
  eq(ns.WhisperKey(SECRET, "Silvermoon"), nil)
  eq(ns.WhisperKey("", "Silvermoon"), nil)
end)

test("core: one whisper per name in 30 minutes, never two within 10 seconds", function(wow)
  local ns = boot(wow)
  local st = ns.NewWhisperState()
  eq(ns.MayWhisper(st, "a-x", 100), true)
  eq(ns.MayWhisper(st, "b-x", 105), false, "too soon after the last whisper")
  eq(ns.MayWhisper(st, "b-x", 110), true, "10 seconds later")
  eq(ns.MayWhisper(st, "a-x", 1000), false, "the same name within 30 minutes")
  eq(ns.MayWhisper(st, "a-x", 100 + ns.WHISPER_GAP), true, "30 minutes later")
  eq(ns.MayWhisper(st, nil, 5000), false)
  eq(ns.MayWhisper(st, "c-x", nil), false)
  eq(ns.WHISPER_GAP, 1800)
  eq(ns.WHISPER_SPACING, 10)
end)

test("core: whispers only in the open world", function(wow)
  local ns = boot(wow)
  eq(ns.SafeToWhisper(false, "none", false), true)
  eq(ns.SafeToWhisper(false, nil, nil), true)
  eq(ns.SafeToWhisper(nil, "none", nil), true, "an old-style nil means outside")
  eq(ns.SafeToWhisper(true, "party", false), false)
  eq(ns.SafeToWhisper(true, "pvp", false), false)
  eq(ns.SafeToWhisper(false, "arena", false), false, "the type counts too")
  eq(ns.SafeToWhisper(false, "none", true), false, "chat locked")
  eq(ns.SafeToWhisper(SECRET, "none", false), false)
  eq(ns.SafeToWhisper(false, SECRET, false), false)
  eq(ns.SafeToWhisper(false, "none", SECRET), false)
end)

test("reply whisper: off by default, settings of 1.0 are kept", function(wow)
  local w = world(wow)
  PoliteDeclineDB = { version = 1, settings = { duels = true, invites = false, quiet = true }, allow = { thrall = "Thrall" } }
  boot(wow)
  eq(PoliteDeclineDB.version, 2)
  eq(PoliteDeclineDB.settings.whisper, false)
  eq(PoliteDeclineDB.settings.whisperText, nil)
  eq(PoliteDeclineDB.settings.invites, false)
  eq(PoliteDeclineDB.settings.quiet, true)
  eq(PoliteDeclineDB.allow.thrall, "Thrall")
  w.duel("Grumbash")
  eq(w.cancelled, 1)
  eq(#w.whispers, 0)
end)

test("reply whisper: a declined stranger gets one polite whisper", function(wow)
  local w = world(wow)
  w.friends["Player-1-0001"] = "Pal"
  boot(wow)
  wow.slash("/pd whisper on")
  eq(wow.chat[1], PREFIX .. "Reply whisper is on.")
  eq(wow.chat[2], PREFIX .. "Reply text: " .. DEFAULT)
  w.duel("Grumbash")
  eq(#w.whispers, 1)
  eq(w.whispers[1].text, DEFAULT)
  eq(w.whispers[1].chatType, "WHISPER")
  eq(w.whispers[1].target, "Grumbash")
  eq(wow.chat[3], PREFIX .. "Declined a duel from Grumbash (1 this session).")
  wow.clock = wow.clock + 10
  w.invite("Stranger-Kazzak", "Player-2-0099")
  eq(w.whispers[2].target, "Stranger-Kazzak", "cross-realm names keep their realm")
  wow.clock = wow.clock + 10
  w.duel("Pal")
  w.invite("Grumbash", nil) -- unsure: let through
  eq(#w.whispers, 2, "nobody who got through is whispered")
  wow.slash("/pd quiet on")
  w.duel("Orcy")
  eq(#w.whispers, 3, "quiet mode only silences the chat lines")
end)

test("reply whisper: at most once per name in 30 minutes, never two within 10 seconds", function(wow)
  local w = world(wow)
  boot(wow)
  wow.slash("/pd whisper on")
  w.duel("Grumbash")
  wow.clock = wow.clock + 60
  w.duel("Grumbash")
  w.invite("grumbash-Silvermoon", "Player-1-0005")
  eq(w.cancelled, 2, "still declined")
  eq(w.declined, 1)
  eq(#w.whispers, 1, "the same character is whispered once")
  w.duel("Orcy")
  eq(#w.whispers, 2)
  wow.clock = wow.clock + 3
  w.duel("Spammer")
  eq(#w.whispers, 2, "a second whisper within 10 seconds waits")
  wow.clock = wow.clock + 1800
  w.duel("Grumbash")
  eq(#w.whispers, 3, "30 minutes later Grumbash may get it again")
end)

test("reply whisper: never in instances, battlegrounds or while chat is locked", function(wow)
  local w = world(wow)
  boot(wow)
  wow.slash("/pd whisper on")
  w.instance, w.instanceType = true, "party"
  w.duel("Grumbash")
  w.instance, w.instanceType = true, "pvp"
  w.invite("Grumbash", "Player-1-0005")
  w.instance, w.instanceType = false, "none"
  w.lockdown = true
  w.duel("Grumbash")
  w.lockdown = SECRET
  w.duel("Grumbash")
  w.lockdown = false
  IsInInstance = function() return SECRET, "none" end
  w.duel("Grumbash")
  IsInInstance = nil
  w.duel("Grumbash")
  eq(w.cancelled, 5, "declining goes on")
  eq(w.declined, 1)
  eq(#w.whispers, 0)
  IsInInstance = function() return w.instance, w.instanceType end
  w.duel("Grumbash")
  eq(#w.whispers, 1, "outside again, and the skipped ones did not use up the limit")
  C_ChatInfo.InChatMessagingLockdown = nil
  wow.clock = wow.clock + 10
  w.duel("Orcy")
  eq(#w.whispers, 2, "a client without the lockdown check whispers outside")
end)

test("reply whisper: a custom text, its checks and the default again", function(wow)
  local w = world(wow)
  boot(wow)
  wow.slash("/pd whisper")
  eq(wow.chat[1], PREFIX .. "Reply whisper is off.")
  eq(wow.chat[2], PREFIX .. "Reply text: " .. DEFAULT)
  wow.slash("/pd whisper text   No duels today, sorry!  ")
  eq(wow.chat[3], PREFIX .. "Reply text: No duels today, sorry!")
  eq(PoliteDeclineDB.settings.whisperText, "No duels today, sorry!")
  wow.slash("/pd WHISPER Text")
  eq(wow.chat[4], PREFIX .. "Reply text: No duels today, sorry!")
  wow.slash("/pd whisper text " .. string.rep("x", 201))
  eq(wow.chat[5], PREFIX .. "That text is too long: 200 characters at most.")
  wow.slash("/pd whisper text ||")
  eq(wow.chat[6]:match("/pd duels on/off") ~= nil, true, "an empty text shows the help")
  eq(PoliteDeclineDB.settings.whisperText, "No duels today, sorry!")
  wow.slash("/pd whisper on")
  w.duel("Grumbash")
  eq(w.whispers[1].text, "No duels today, sorry!")
  wow.slash("/pd whisper reset")
  eq(wow.chat[#wow.chat], PREFIX .. "Reply text: " .. DEFAULT)
  eq(PoliteDeclineDB.settings.whisperText, nil)
  wow.slash("/pd whisper loud")
  eq(wow.chat[#wow.chat]:match("/pd whisper on or off") ~= nil, true)
  wow.slash("/pd whisper off")
  eq(wow.chat[#wow.chat], PREFIX .. "Reply whisper is off.")
  wow.clock = wow.clock + 60
  w.duel("Orcy")
  eq(#w.whispers, 1)
end)

test("reply whisper: the choice and text survive a reload, broken values are replaced", function(wow)
  local w = world(wow)
  boot(wow)
  wow.slash("/pd whisper on")
  wow.slash("/pd whisper text Busy, sorry.")
  local saved = PoliteDeclineDB
  PoliteDeclineDB = saved
  wow.load(ADDON_DIR, ADDON_NAME)
  wow.frames[1].events = {}
  wow.fire("PLAYER_LOGIN")
  eq(PoliteDeclineDB.settings.whisper, true)
  eq(PoliteDeclineDB.settings.whisperText, "Busy, sorry.")
  w.duel("Grumbash")
  eq(w.whispers[1].text, "Busy, sorry.")

  PoliteDeclineDB = { settings = { whisper = "yes", whisperText = 42 } }
  wow.fire("PLAYER_LOGIN")
  eq(PoliteDeclineDB.settings.whisper, false)
  eq(PoliteDeclineDB.settings.whisperText, nil)
  PoliteDeclineDB = { settings = { whisper = true, whisperText = "  |cffff0000Hi|r  " } }
  wow.fire("PLAYER_LOGIN")
  eq(PoliteDeclineDB.settings.whisperText, "cffff0000Hir")
end)

test("reply whisper: missing chat functions are no error, nothing declined means no whisper", function(wow)
  local w = world(wow)
  boot(wow)
  wow.slash("/pd whisper on")
  local older = {}
  C_ChatInfo = nil
  SendChatMessage = function(text, chatType, _, target) older[#older + 1] = chatType .. ":" .. target end
  w.duel("Grumbash")
  eq(table.concat(older, " "), "WHISPER:Grumbash", "the older SendChatMessage")
  SendChatMessage = function() error("blocked") end
  wow.clock = wow.clock + 10
  w.duel("Orcy")
  SendChatMessage = nil
  wow.clock = wow.clock + 10
  w.duel("Spammer")
  eq(w.cancelled, 3)
  SendChatMessage = function(text, chatType, _, target) older[#older + 1] = chatType .. ":" .. target end
  CancelDuel = nil
  wow.clock = wow.clock + 10
  w.duel("Newcomer")
  eq(#older, 1, "the duel was not declined, so no whisper")
  wow.clock = wow.clock + 10
  w.invite("Newcomer", "Player-1-0042")
  eq(older[2], "WHISPER:Newcomer", "the limit was not used up by the duel")
  eq(#w.whispers, 0)
end)
