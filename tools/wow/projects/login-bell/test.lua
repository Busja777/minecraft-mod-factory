-- Tests for Login Bell, run by tools/wow/client/run.lua.

-- The parts of the game the stand-in client lacks: the friend list, the guild flag, Battle.net
-- accounts, the online message and sounds.
local STAND_IN = { "C_FriendList", "IsInGuild", "C_BattleNet", "SOUNDKIT", "PlaySound", "ERR_FRIEND_ONLINE_SS" }
local SECRET = { secret = true }
local game

-- g = { friends = { "Ohm", ... }, guild = true, accounts = { [id] = { accountName = ..., battleTag = ... } } }
local function client(g)
  game = { friends = {}, guild = false, accounts = {}, sounds = {} }
  for k, v in pairs(g or {}) do game[k] = v end
  C_FriendList = {
    GetNumFriends = function() return #game.friends end,
    GetFriendInfoByIndex = function(i)
      local name = game.friends[i]
      if not name then return nil end
      return { name = name, connected = true }
    end,
  }
  IsInGuild = function() return game.guild end
  C_BattleNet = { GetAccountInfoByID = function(id) return game.accounts[id] end }
  SOUNDKIT = { UI_BNET_TOAST = 18019, TELL_MESSAGE = 3081, READY_CHECK = 8960 }
  PlaySound = function(id, channel) game.sounds[#game.sounds + 1] = { id = id, channel = channel } end
  ERR_FRIEND_ONLINE_SS = "|Hplayer:%s|h[%s]|h has come online."
end

-- The way the game starts: saved variables, login, the world. The startup quiet time is then waited out
-- unless opts.stay is set.
local function boot(wow, g, saved, opts)
  client(g)
  LoginBellDB = saved
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("ADDON_LOADED", "LoginBell")
  wow.fire("PLAYER_LOGIN")
  wow.fire("PLAYER_ENTERING_WORLD", true, false)
  if not (opts and opts.stay) then wow.clock = wow.clock + 20 end
  return ns
end

-- The game's system line when a player logs in.
local function online(wow, full, shown, later)
  wow.clock = wow.clock + (later or 0)
  wow.fire("CHAT_MSG_SYSTEM", string.format(ERR_FRIEND_ONLINE_SS, full, shown or full), "", "", "", "", "", "", 0, "", "", 0, 0)
end

local function bnet(wow, id, companion, later)
  wow.clock = wow.clock + (later or 0)
  wow.fire("BN_FRIEND_ACCOUNT_ONLINE", id, companion or false)
end

local function chatSince(wow, from)
  local out = {}
  for i = from + 1, #wow.chat do out[#out + 1] = wow.chat[i] end
  return table.concat(out, "\n")
end
local function has(text, part) return text:find(part, 1, true) ~= nil end
local function lastChat(wow) return wow.chat[#wow.chat] or "" end
local P = "|cffffd100Login Bell:|r "

test("addon defines only its own globals", function(wow, installed, before)
  boot(wow, { friends = { "Ohm" }, guild = true, accounts = { [7] = { accountName = "Mira", battleTag = "Mira#1234" } } })
  online(wow, "Ohm-Silvermoon", "Ohm")
  online(wow, "Grumbash-Silvermoon", "Grumbash")
  bnet(wow, 7)
  wow.slash("/lb")
  wow.slash("/lb sound")
  wow.slash("/lb friends off")
  wow.slash("/lb guild on")
  wow.slash("/lb test")
  wow.slash("/loginbell nonsense")
  local allowed = { LoginBellDB = true, SLASH_LOGINBELL1 = true, SLASH_LOGINBELL2 = true }
  for _, name in ipairs(STAND_IN) do installed[name] = true end
  for k in pairs(_G) do
    if not before[k] and not installed[k] and not allowed[k] then error("unexpected global " .. tostring(k)) end
  end
end)

test("login creates the saved table with every switch on and keeps what was chosen", function(wow)
  local ns = boot(wow)
  eq(LoginBellDB.version, 1)
  eq(LoginBellDB.settings.sound, true)
  eq(LoginBellDB.settings.friends, true)
  eq(LoginBellDB.settings.guild, true)
  eq(ns.db, LoginBellDB)
end)

test("saved settings survive a reload, broken values fall back to on", function(wow)
  boot(wow, nil, { version = 1, settings = { sound = false, friends = "yes", guild = false } })
  eq(LoginBellDB.settings.sound, false)
  eq(LoginBellDB.settings.friends, true, "not a boolean")
  eq(LoginBellDB.settings.guild, false)
  online(wow, "Ohm-Silvermoon", "Ohm")
  eq(#game.sounds, 0, "the saved sound switch is used")
end)

test("the online pattern comes from the game text and matches only the online line", function(wow)
  local ns = boot(wow)
  local p = ns.OnlinePattern()
  local full, shown = ns.ParseOnline("|Hplayer:Ohm-Argent Dawn|h[Ohm-Argent Dawn]|h has come online.", p)
  eq(full, "Ohm-Argent Dawn")
  eq(shown, "Ohm-Argent Dawn")
  eq(ns.ParseOnline("Ohm has gone offline.", p), nil)
  eq(ns.ParseOnline("|Hplayer:Ohm|h[Ohm]|h has come online. Hi", p), nil, "anchored at the end")
  eq(ns.ParseOnline("You have joined a group.", p), nil)
  eq(ns.ParseOnline(SECRET, p), nil, "secret text")
  eq(ns.ParseOnline(nil, p), nil)
end)

test("a German client: the German game text is used", function(wow)
  local ns = boot(wow, { friends = { "Ohm" } })
  ERR_FRIEND_ONLINE_SS = "|Hplayer:%s|h[%s]|h ist jetzt online."
  local p = ns.OnlinePattern()
  eq(ns.ParseOnline("|Hplayer:Ohm|h[Ohm]|h ist jetzt online.", p), "Ohm")
  eq(ns.ParseOnline("|Hplayer:Ohm|h[Ohm]|h has come online.", p), nil)
  local from = #wow.chat
  online(wow, "Ohm", "Ohm")
  eq(chatSince(wow, from), P .. "Friend online: |Hplayer:Ohm|h[Ohm]|h")
end)

test("numbered placeholders and a missing game text still work", function(wow)
  local ns = boot(wow)
  local p = ns.FormatPattern("%2$s (|Hplayer:%1$s|h) ist da.")
  local first, second = ns.ParseOnline("Ohm (|Hplayer:Ohm-Realm|h) ist da.", p)
  eq(first, "Ohm", "captures in the written order")
  eq(second, "Ohm-Realm")
  ERR_FRIEND_ONLINE_SS = nil
  eq(ns.ParseOnline("|Hplayer:Ohm|h[Ohm]|h has come online.", ns.OnlinePattern()), "Ohm", "English fallback")
  ERR_FRIEND_ONLINE_SS = SECRET
  eq(ns.ParseOnline("|Hplayer:Ohm|h[Ohm]|h has come online.", ns.OnlinePattern()), "Ohm", "secret constant: English fallback")
end)

test("a friend comes online: one chat line with the clickable name and the bell", function(wow)
  boot(wow, { friends = { "Ohm" }, guild = true })
  local from = #wow.chat
  online(wow, "Ohm-Silvermoon", "Ohm")
  eq(chatSince(wow, from), P .. "Friend online: |Hplayer:Ohm-Silvermoon|h[Ohm]|h")
  eq(#game.sounds, 1)
  eq(game.sounds[1].id, 18019, "the Battle.net friend toast sound")
  eq(game.sounds[1].channel, "Master")
end)

test("a guild member comes online: named as guild member", function(wow)
  boot(wow, { friends = { "Ohm" }, guild = true })
  online(wow, "Grumbash-Silvermoon", "Grumbash")
  eq(lastChat(wow), P .. "Guild member online: |Hplayer:Grumbash-Silvermoon|h[Grumbash]|h")
  eq(#game.sounds, 1)
end)

test("not on the friend list and not in a guild: still a friend (the list may be loading)", function(wow)
  boot(wow, { friends = {}, guild = false })
  online(wow, "Ohm", "Ohm")
  eq(lastChat(wow), P .. "Friend online: |Hplayer:Ohm|h[Ohm]|h")
end)

test("friend names match across realm spelling and case", function(wow)
  local ns = boot(wow)
  eq(ns.SameName("Ohm", "ohm-Silvermoon"), true, "no realm matches any realm")
  eq(ns.SameName("Ohm-Argent Dawn", "Ohm-ArgentDawn"), true, "spaces do not matter")
  eq(ns.SameName("Ohm-Argent Dawn", "Ohm-Silvermoon"), false, "two realms")
  eq(ns.SameName("Ohm", "Ohmy"), false)
  eq(ns.SameName(nil, "Ohm"), false)
  eq(ns.KindOf("Ohm-ArgentDawn", { "Grumbash", "Ohm-Argent Dawn" }, true), "friend")
  eq(ns.KindOf("Lia-ArgentDawn", { "Ohm-Argent Dawn" }, true), "guild")
end)

test("startup quiet time: nothing in the first seconds after login, then the bell rings", function(wow)
  boot(wow, { friends = { "Ohm" } }, nil, { stay = true })
  local from = #wow.chat
  online(wow, "Ohm", "Ohm", 5)
  bnet(wow, 7)
  eq(chatSince(wow, from), "", "quiet while the lists fill")
  eq(#game.sounds, 0)
  online(wow, "Ohm", "Ohm", 11)
  eq(lastChat(wow), P .. "Friend online: |Hplayer:Ohm|h[Ohm]|h", "rings after 15 seconds; the quiet line did not start a cooldown")
  eq(#game.sounds, 1)
end)

test("a reload starts the quiet time again, a loading screen does not", function(wow)
  boot(wow, { friends = { "Ohm", "Lia" } })
  wow.fire("PLAYER_ENTERING_WORLD", false, false) -- a dungeon or portal
  local from = #wow.chat
  online(wow, "Ohm", "Ohm", 1)
  eq(has(chatSince(wow, from), "Ohm"), true, "zoning keeps the bell on")
  wow.fire("PLAYER_ENTERING_WORLD", false, true) -- /reload
  from = #wow.chat
  online(wow, "Lia", "Lia", 3)
  eq(chatSince(wow, from), "", "quiet after a reload")
end)

test("cooldown: a reconnecting player rings once, other players still ring", function(wow)
  local ns = boot(wow, { friends = { "Ohm", "Lia" } })
  online(wow, "Ohm", "Ohm")
  local from = #wow.chat
  online(wow, "Ohm", "Ohm", 60)
  online(wow, "ohm", "ohm", 120)
  eq(chatSince(wow, from), "", "same person within 5 minutes")
  online(wow, "Lia", "Lia", 1)
  eq(has(chatSince(wow, from), "Lia"), true)
  from = #wow.chat
  online(wow, "Ohm", "Ohm", ns.COOLDOWN)
  eq(has(chatSince(wow, from), "Ohm"), true, "again after the cooldown")
  eq(#game.sounds, 3)
end)

test("several people at once: a line for each, one sound", function(wow)
  boot(wow, { friends = { "Ohm" }, guild = true })
  local from = #wow.chat
  online(wow, "Ohm", "Ohm")
  online(wow, "Grumbash", "Grumbash", 1)
  online(wow, "Lia", "Lia", 0.5)
  local text = chatSince(wow, from)
  eq(has(text, "Ohm") and has(text, "Grumbash") and has(text, "Lia"), true)
  eq(#game.sounds, 1, "within 2 seconds")
  online(wow, "Tok", "Tok", 3)
  eq(#game.sounds, 2)
end)

test("switches: friends off keeps guild members, guild off keeps friends, sound off keeps the line", function(wow)
  boot(wow, { friends = { "Ohm", "Lia" }, guild = true, accounts = { [7] = { accountName = "Mira" } } })
  wow.slash("/lb friends off")
  local from = #wow.chat
  online(wow, "Ohm", "Ohm")
  bnet(wow, 7)
  eq(chatSince(wow, from), "", "no friends, no Battle.net friends")
  online(wow, "Grumbash", "Grumbash")
  eq(has(lastChat(wow), "Guild member online"), true)
  wow.slash("/lb friends on")
  wow.slash("/lb guild off")
  from = #wow.chat
  online(wow, "Tok", "Tok", 10)
  eq(chatSince(wow, from), "", "no guild members")
  online(wow, "Lia", "Lia")
  eq(has(lastChat(wow), "Friend online"), true)
  local sounds = #game.sounds
  wow.slash("/lb sound off")
  online(wow, "Ohm", "Ohm", 400)
  eq(has(lastChat(wow), "Ohm"), true, "the line still comes")
  eq(#game.sounds, sounds, "but no sound")
end)

test("a Battle.net friend comes online: account name, or the BattleTag without its number", function(wow)
  boot(wow, { accounts = {
    [7] = { bnetAccountID = 7, accountName = "Mira", battleTag = "Mira#1234" },
    [8] = { bnetAccountID = 8, accountName = SECRET, battleTag = "Tok#2211" },
    [9] = { bnetAccountID = 9, accountName = "", battleTag = SECRET },
  } })
  local from = #wow.chat
  bnet(wow, 7)
  eq(chatSince(wow, from), P .. "Friend online: Mira")
  eq(#game.sounds, 1)
  bnet(wow, 8, false, 3)
  eq(lastChat(wow), P .. "Friend online: Tok")
  from = #wow.chat
  bnet(wow, 9, false, 3)
  bnet(wow, 404)
  eq(chatSince(wow, from), "", "no usable name, unknown account")
  bnet(wow, 7, false, 60)
  eq(chatSince(wow, from), "", "cooldown per account")
end)

test("Battle.net: the mobile app, secret ids and a missing C_BattleNet are skipped", function(wow)
  boot(wow, { accounts = { [7] = { accountName = "Mira" } } })
  local from = #wow.chat
  bnet(wow, 7, true)
  bnet(wow, SECRET)
  bnet(wow, 7, SECRET)
  wow.fire("BN_FRIEND_ACCOUNT_ONLINE")
  C_BattleNet = nil
  bnet(wow, 7)
  C_BattleNet = { GetAccountInfoByID = function() error("not now") end }
  bnet(wow, 7)
  eq(chatSince(wow, from), "")
  eq(#game.sounds, 0)
end)

test("secret chat text, the player's own name and other system lines are ignored", function(wow)
  boot(wow, { friends = { "Yubi", "Ohm" } })
  local from = #wow.chat
  wow.fire("CHAT_MSG_SYSTEM", SECRET)
  online(wow, "Yubi-Silvermoon", "Yubi")
  wow.fire("CHAT_MSG_SYSTEM", "Ohm has gone offline.")
  wow.fire("CHAT_MSG_SYSTEM", "|Hplayer:Ohm|h[Ohm]|h has joined the guild.")
  wow.fire("CHAT_MSG_SYSTEM")
  eq(chatSince(wow, from), "")
end)

test("events before login and a broken friend list do no harm", function(wow)
  client({ friends = { "Ohm" } })
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  online(wow, "Ohm", "Ohm")
  bnet(wow, 7)
  eq(#wow.chat, 0)
  wow.fire("PLAYER_LOGIN")
  wow.clock = wow.clock + 20
  C_FriendList = { GetNumFriends = function() return SECRET end, GetFriendInfoByIndex = function() return nil end }
  IsInGuild = function() return SECRET end
  online(wow, "Ohm", "Ohm")
  eq(lastChat(wow), P .. "Friend online: |Hplayer:Ohm|h[Ohm]|h")
  eq(#ns.FriendNames(), 0)
end)

test("/lb shows the settings and the help, the switches save", function(wow)
  boot(wow)
  local from = #wow.chat
  wow.slash("/lb")
  eq(chatSince(wow, from), P .. "Sound: on, friends: on, guild: on.\n" .. P ..
    "/lb sound, /lb friends and /lb guild switch the sound, friends and guild members on or off (add on or off to set it), /lb test plays the bell.")
  wow.slash("/lb sound")
  eq(LoginBellDB.settings.sound, false, "no word switches")
  eq(lastChat(wow), P .. "Sound: off, friends: on, guild: on.")
  wow.slash("/lb sound")
  eq(LoginBellDB.settings.sound, true)
  wow.slash("/lb guild OFF")
  eq(LoginBellDB.settings.guild, false)
  wow.slash("/lb guild off")
  eq(LoginBellDB.settings.guild, false, "off stays off")
  wow.slash("/loginbell friends off")
  eq(LoginBellDB.settings.friends, false)
  from = #wow.chat
  wow.slash("/lb friends maybe")
  eq(LoginBellDB.settings.friends, false, "an unknown word changes nothing")
  eq(has(chatSince(wow, from), "/lb test plays the bell"), true)
  wow.slash("/lb what")
  eq(has(lastChat(wow), "/lb sound, /lb friends"), true)
  eq(has(table.concat(wow.chat, "\n"), "on|off"), false, "help never uses | as separator")
end)

test("/lb test plays the bell, also with the sound switched off", function(wow)
  boot(wow)
  wow.slash("/lb test")
  eq(#game.sounds, 1)
  eq(lastChat(wow), P .. "This is the bell.")
  wow.slash("/lb sound off")
  wow.slash("/lb test")
  eq(#game.sounds, 2)
  eq(lastChat(wow), P .. "This is the bell. The sound is off, /lb sound switches it on.")
end)

test("sound: falls back to the whisper sound, and is skipped without SOUNDKIT or PlaySound", function(wow)
  local ns = boot(wow, { friends = { "Ohm", "Lia", "Tok" } })
  SOUNDKIT = { TELL_MESSAGE = 3081 }
  online(wow, "Ohm", "Ohm")
  eq(game.sounds[1].id, 3081)
  SOUNDKIT = nil
  online(wow, "Lia", "Lia", 5)
  eq(#game.sounds, 1)
  PlaySound = nil
  SOUNDKIT = { UI_BNET_TOAST = 18019 }
  online(wow, "Tok", "Tok", 5)
  eq(has(lastChat(wow), "Tok"), true, "the line still comes")
  eq(ns.SoundId({ UI_BNET_TOAST = "x" }), nil)
end)

test("core: decisions, switch words and the cooldown table stays small", function(wow)
  local ns = boot(wow)
  local s = ns.NewState()
  local on = ns.Settings({})
  ns.Quiet(s, 100)
  eq(ns.Decide(s, on, "friend", "a", 110), "quiet")
  ns.Quiet(s, 90) -- an earlier start never shortens it
  eq(ns.Decide(s, on, "friend", "a", 114), "quiet")
  local r, sound = ns.Decide(s, on, "friend", "a", 115)
  eq(r, "ring")
  eq(sound, true)
  eq(ns.Decide(s, on, "guild", "a", 116), "cooldown", "same key")
  r, sound = ns.Decide(s, on, "guild", "b", 116)
  eq(r, "ring")
  eq(sound, false, "within the sound gap")
  eq(ns.Decide(s, { sound = true, friends = true, guild = false }, "guild", "c", 200), "off")
  eq(ns.Decide(s, { sound = true, friends = false, guild = true }, "friend", "c", 200), "off")
  ns.Decide(s, on, "friend", "d", 1000)
  eq(s.last.a, nil, "old entries are pruned")
  eq(s.last.d, 1000)
  eq(ns.Switch("", true), false)
  eq(ns.Switch("ON", false), true)
  eq(ns.Switch("off", true), false)
  eq(ns.Switch("yes", true), nil)
  eq(ns.BNetName(nil), nil)
  eq(ns.BNetName({ battleTag = "NoNumber" }), "NoNumber")
end)
