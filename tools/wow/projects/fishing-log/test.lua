-- Tests for Fishing Log, run by tools/wow/client/run.lua.

-- The stand-in client has no loot window or zones; these are the game functions the addon reads.
local game

local function client(g)
  game = { fishing = true, zone = "Hallowfall", slots = {} }
  for k, v in pairs(g or {}) do game[k] = v end
  IsFishingLoot = function() return game.fishing end
  GetRealZoneText = function() return game.zone end
  GetNumLootItems = function() if game.count ~= nil then return game.count end return #game.slots end
  -- slot = { kind = "item"|"money"|"currency", quantity = n }
  local KIND = { item = 1, money = 2, currency = 3 }
  GetLootSlotType = function(i)
    local s = game.slots[i]
    if not s then return 0 end
    if s.kindValue ~= nil then return s.kindValue end
    return KIND[s.kind]
  end
  GetLootSlotInfo = function(i)
    local s = game.slots[i]
    if not s then return nil end
    local currencyID = s.kind == "currency" and 3008 or nil
    local quantity = s.kind == "money" and 0 or s.quantity
    return 132291, "Something", quantity, currencyID, 1, false, false, nil, false, s.kind == "money"
  end
  Enum.LootSlotType = { None = 0, Item = 1, Money = 2, Currency = 3 }
end

local function boot(wow, g)
  client(g)
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("ADDON_LOADED", "FishingLog")
  wow.fire("PLAYER_LOGIN")
  return ns
end

local function fish(name, n) return { kind = "item", quantity = n or 1, name = name } end

-- One loot window from start to end, the way the game reports it without autoloot.
local function catch(wow, slots, zone)
  game.slots = slots or { fish("Bloody Perch") }
  if zone then game.zone = zone end
  wow.fire("LOOT_READY", false)
  wow.fire("LOOT_OPENED", false)
  wow.fire("LOOT_CLOSED")
end

local function chatSince(wow, from)
  local out = {}
  for i = from + 1, #wow.chat do out[#out + 1] = wow.chat[i] end
  return table.concat(out, "\n")
end

local function has(text, plain) return text:find(plain, 1, true) ~= nil end

test("addon defines only its own globals", function(wow, installed, before)
  local stand = { IsFishingLoot = true, GetRealZoneText = true, GetNumLootItems = true, GetLootSlotType = true, GetLootSlotInfo = true }
  boot(wow)
  catch(wow)
  wow.slash("/fl")
  wow.slash("/fl zones")
  local allowed = { FishingLogDB = true, SLASH_FISHINGLOG1 = true, SLASH_FISHINGLOG2 = true }
  for k in pairs(_G) do
    if not before[k] and not installed[k] and not allowed[k] and not stand[k] then error("unexpected global " .. tostring(k)) end
  end
end)

test("login creates the saved data and keeps what is there", function(wow)
  FishingLogDB = { zones = { ["Azj-Kahet"] = { catches = 7, items = 9 } } }
  local ns = boot(wow)
  eq(FishingLogDB.version, 1)
  eq(FishingLogDB.zones["Azj-Kahet"].catches, 7)
  eq(ns.db, FishingLogDB)
  eq(ns.session.catches, 0)
  eq(ns.session.start, wow.clock)
end)

test("a fishing loot window is one catch in the current zone with its item count", function(wow)
  local ns = boot(wow)
  catch(wow, { fish("Bloody Perch", 2), fish("Shiny Pebble", 1) })
  eq(ns.session.catches, 1)
  eq(ns.session.items, 3)
  eq(ns.session.zones.Hallowfall.catches, 1)
  eq(FishingLogDB.zones.Hallowfall.catches, 1)
  eq(FishingLogDB.zones.Hallowfall.items, 3)
  eq(ns.session.first, wow.clock)
end)

test("LOOT_READY twice and LOOT_OPENED count once, the next window counts again", function(wow)
  local ns = boot(wow)
  game.slots = { fish("Bloody Perch") }
  wow.fire("LOOT_READY", false)
  wow.fire("LOOT_READY", false)
  wow.fire("LOOT_OPENED", false)
  eq(ns.session.catches, 1)
  wow.fire("LOOT_CLOSED")
  catch(wow)
  eq(ns.session.catches, 2)
  eq(FishingLogDB.zones.Hallowfall.catches, 2)
end)

test("autoloot: the slots count at the first event, before they empty", function(wow)
  local ns = boot(wow)
  game.slots = { fish("Bloody Perch", 3) }
  wow.fire("LOOT_READY", true)
  game.slots = {} -- autoloot took everything
  wow.fire("LOOT_OPENED", true)
  wow.fire("LOOT_CLOSED")
  eq(ns.session.catches, 1)
  eq(ns.session.items, 3)
end)

test("loot that is not from fishing is not counted", function(wow)
  local ns = boot(wow, { fishing = false })
  catch(wow, { fish("Linen Cloth", 4) })
  eq(ns.session.catches, 0)
  eq(next(FishingLogDB.zones), nil)
  game.fishing = nil
  catch(wow)
  eq(ns.session.catches, 0)
end)

test("money, currency and empty slots add no items, the catch still counts", function(wow)
  local ns = boot(wow)
  catch(wow, { { kind = "money" }, { kind = "currency", quantity = 5 }, fish("Bloody Perch", 0), fish("Shiny Pebble", 1) })
  eq(ns.session.catches, 1)
  eq(ns.session.items, 1)
  catch(wow, { { kind = "money" } })
  eq(ns.session.catches, 2)
  eq(ns.session.items, 1)
end)

test("without the slot type enum the old LOOT_SLOT_ITEM constant is used", function(wow)
  client()
  Enum.LootSlotType = nil
  LOOT_SLOT_ITEM = 1
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("PLAYER_LOGIN")
  catch(wow, { fish("Bloody Perch", 2), { kind = "currency", quantity = 4 } })
  eq(ns.session.items, 2)
end)

test("without GetLootSlotType a slot without currency counts as an item", function(wow)
  local ns = boot(wow)
  GetLootSlotType = nil
  catch(wow, { fish("Bloody Perch", 2), { kind = "currency", quantity = 4 }, { kind = "money" } })
  eq(ns.session.catches, 1)
  eq(ns.session.items, 2)
end)

test("secret values are skipped", function(wow)
  local ns = boot(wow)
  local secret = { secret = true }
  game.fishing = secret
  catch(wow)
  eq(ns.session.catches, 0, "secret fishing flag")
  game.fishing = true
  catch(wow, { fish("Bloody Perch", secret), fish("Shiny Pebble", 2), { kind = "item", quantity = 5, kindValue = secret } })
  eq(ns.session.catches, 1)
  eq(ns.session.items, 2, "secret quantity and secret slot type skipped")
  game.zone = secret
  catch(wow)
  eq(FishingLogDB.zones.Unknown.catches, 1, "secret zone")
  game.zone = "Hallowfall"
  game.count = secret
  catch(wow)
  eq(ns.session.catches, 3, "secret slot count: the catch counts")
  eq(ns.session.items, 3)
end)

test("no zone name or an empty one is Unknown", function(wow)
  local ns = boot(wow)
  game.zone = nil
  catch(wow)
  game.zone = ""
  catch(wow)
  eq(FishingLogDB.zones.Unknown.catches, 2)
  eq(ns.ZoneName(42), "Unknown")
  eq(ns.ZoneName("Dornogal"), "Dornogal")
end)

test("loot before login and a client without IsFishingLoot do nothing", function(wow)
  client()
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  catch(wow)
  eq(ns.session.catches, 0)
  wow.fire("PLAYER_LOGIN")
  IsFishingLoot = nil
  catch(wow)
  eq(ns.session.catches, 0)
  eq(next(FishingLogDB.zones), nil)
end)

test("per hour: a dash until two catches and five minutes, then catches per hour", function(wow)
  local ns = boot(wow)
  local s = ns.NewSession(0)
  eq(ns.PerHour(s, 1000), nil, "no catch")
  ns.AddCatch(s, nil, "A", 1, 100)
  eq(ns.PerHour(s, 100 + 3600), nil, "one catch, however long")
  ns.AddCatch(s, nil, "A", 1, 110)
  eq(ns.PerHour(s, 110), nil, "two quick catches")
  eq(ns.PerHour(s, 100 + 299), nil, "under five minutes")
  eq(ns.PerHour(s, 100 + 300), 24, "two catches in five minutes")
  for i = 1, 28 do ns.AddCatch(s, nil, "A", 1, 110 + i * 20) end
  eq(ns.PerHour(s, 100 + 1800), 60, "30 catches in half an hour")
  eq(ns.PerHour(s, 100 + 7 * 3600), 4, "rounded, falls while you do something else")
  eq(ns.RateText(nil), "–")
  eq(ns.RateText(24), "24")
end)

test("zones sort by catches, ties by name, and add up", function(wow)
  local ns = boot(wow)
  local zones = {
    Hallowfall = { catches = 5, items = 6 }, Dornogal = { catches = 5, items = 5 },
    ["The Ringing Deeps"] = { catches = 9, items = 12 }, Stormwind = { catches = 1, items = 1 },
  }
  local list = ns.SortedZones(zones)
  eq(#list, 4)
  eq(list[1].zone, "The Ringing Deeps")
  eq(list[2].zone, "Dornogal")
  eq(list[3].zone, "Hallowfall")
  eq(#ns.SortedZones(zones, 2), 2)
  local catches, items = ns.Totals(zones)
  eq(catches, 20)
  eq(items, 24)
  eq(#ns.SortedZones({}), 0)
end)

test("/fl prints the session: catches, items, rate and top zones", function(wow)
  local ns = boot(wow)
  wow.slash("/fl")
  eq(chatSince(wow, 0), "|cffffd100Fishing Log:|r No catches yet this session.")
  catch(wow, { fish("A", 2) }, "Hallowfall")
  wow.clock = wow.clock + 20
  catch(wow, nil, "Dornogal")
  local n = #wow.chat
  wow.slash("/fl")
  local text = chatSince(wow, n)
  eq(has(text, "This session: 2 catches, 3 items, – per hour."), true, text)
  eq(has(text, "Top zones: Dornogal 1, Hallowfall 1."), true, text)
  eq(has(text, "The rate shows after two catches"), true, text)
  wow.clock = wow.clock + 580 -- ten minutes after the first catch
  n = #wow.chat
  wow.slash("/fishinglog")
  text = chatSince(wow, n)
  eq(has(text, "This session: 2 catches, 3 items, 12 per hour."), true, text)
  eq(has(text, "The rate shows"), false, text)
end)

test("the summary names only the top three zones", function(wow)
  local ns = boot(wow)
  for i, zone in ipairs({ "A", "B", "B", "C", "C", "C", "D", "D", "D", "D" }) do catch(wow, nil, zone) end
  local n = #wow.chat
  wow.slash("/fl")
  eq(has(chatSince(wow, n), "Top zones: D 4, C 3, B 2."), true)
end)

test("/fl reset starts a new session and keeps the all-time totals", function(wow)
  local ns = boot(wow)
  catch(wow)
  catch(wow)
  wow.clock = wow.clock + 100
  wow.slash("/fl reset")
  eq(has(wow.chat[#wow.chat], "Session started again."), true)
  eq(ns.session.catches, 0)
  eq(ns.session.first, nil)
  eq(ns.session.start, wow.clock)
  eq(next(ns.session.zones), nil)
  eq(FishingLogDB.zones.Hallowfall.catches, 2)
  catch(wow)
  eq(ns.session.first, wow.clock)
end)

test("/fl zones lists all-time catches per zone, most first", function(wow)
  FishingLogDB = { zones = { Dornogal = { catches = 3, items = 4 } } }
  local ns = boot(wow)
  catch(wow, { fish("A", 2) }, "Hallowfall")
  wow.slash("/fl Zones")
  local text = chatSince(wow, 0)
  eq(has(text, "All-time catches per zone (4 catches, 6 items):"), true, text)
  local first = text:find("Dornogal: 3 catches, 4 items", 1, true)
  local second = text:find("Hallowfall: 1 catches, 2 items", 1, true)
  eq(first ~= nil and second ~= nil and first < second, true, text)
end)

test("/fl zones without catches, unknown words print the help", function(wow)
  boot(wow)
  wow.slash("/fl zones")
  eq(has(wow.chat[1], "No catches recorded yet."), true)
  wow.slash("/fl what")
  eq(has(wow.chat[2], "/fl zones lists all catches per zone"), true)
  eq(#wow.chat, 2)
end)

test("a reload keeps the all-time totals and starts a new session", function(wow)
  local ns = boot(wow)
  catch(wow)
  catch(wow, nil, "Dornogal")
  local saved = FishingLogDB
  -- the game saves the variables, reloads the UI and hands them back
  ns = wow.load(ADDON_DIR, ADDON_NAME)
  FishingLogDB = saved
  wow.fire("PLAYER_LOGIN")
  eq(ns.session.catches, 0)
  eq(FishingLogDB.zones.Hallowfall.catches, 1)
  eq(FishingLogDB.zones.Dornogal.catches, 1)
end)

-- 1.1: German ------------------------------------------------------------------------------------------

local P = "|cffffd100Fishing Log:|r "

-- Every placeholder of a text, in order: "%d", "%s", "%%".
local function placeholders(text)
  local out = {}
  for p in text:gmatch("%%[%d%.]*[%a%%]") do out[#out + 1] = p end
  return table.concat(out, " ")
end

-- A German client: its language and its word for an unknown zone (GlobalStrings). The stand-in client
-- has none; zone names come from GetRealZoneText in the client's language.
local function germanClient(wow)
  wow.locale = "deDE"
  UNKNOWN = "Unbekannt"
end

test("an unknown zone reads like the game's word for it, the saved key stays Unknown", function(wow)
  local ns = boot(wow)
  eq(ns.ZoneLabel("Unknown"), "Unknown")
  eq(ns.ZoneLabel("Dornogal"), "Dornogal")
  germanClient(wow)
  eq(ns.ZoneLabel("Unknown"), "Unbekannt")
  eq(ns.ZoneLabel("Dornogal"), "Dornogal")
  UNKNOWN = ""
  eq(ns.ZoneLabel("Unknown"), "Unknown", "an empty one stays English")
  UNKNOWN = { secret = true }
  eq(ns.ZoneLabel("Unknown"), "Unknown", "so does anything that is not a text")
end)

test("German client: the session, the help and a reset in German", function(wow)
  germanClient(wow)
  local ns = boot(wow, { zone = "Heilsturz" })
  wow.slash("/fl")
  eq(wow.chat[1], P .. "In dieser Sitzung noch keine Fänge.")
  catch(wow, { fish("A", 2) })
  wow.clock = wow.clock + 20
  game.zone = nil
  catch(wow)
  wow.slash("/fl")
  eq(wow.chat[2], P .. "Diese Sitzung: 2 Fänge, 3 Gegenstände, – pro Stunde.")
  eq(wow.chat[3], P .. "Häufigste Zonen: Heilsturz 1, Unbekannt 1.")
  eq(wow.chat[4], P .. "|cff9d9d9dDie Fänge pro Stunde erscheinen nach zwei Fängen und fünf Minuten Angeln.|r")
  eq(FishingLogDB.zones.Unknown.catches, 1, "saved under the same key as before")
  wow.clock = wow.clock + 580
  wow.slash("/fl")
  eq(wow.chat[5], P .. "Diese Sitzung: 2 Fänge, 3 Gegenstände, 12 pro Stunde.")
  eq(#wow.chat, 6, "no hint once the rate shows")
  wow.slash("/fl reset")
  eq(wow.chat[7], P .. "Neue Sitzung gestartet.")
  wow.slash("/fl zonen")
  eq(wow.chat[8], P .. "/fl zeigt diese Sitzung, /fl zones listet alle Fänge pro Zone auf, /fl reset startet eine neue Sitzung.",
    "German command words are not commands")
end)

test("German client: all catches per zone in German, the command words stay English", function(wow)
  germanClient(wow)
  local ns = boot(wow)
  wow.slash("/fl zones")
  eq(wow.chat[1], P .. "Noch keine Fänge notiert.")
  FishingLogDB.zones.Unknown = { catches = 1, items = 1 }
  catch(wow, { fish("A", 2) }, "Heilsturz")
  catch(wow, nil, "Heilsturz")
  wow.slash("/fl zones")
  eq(wow.chat[2], P .. "Alle bisherigen Fänge pro Zone (3 Fänge, 4 Gegenstände):")
  eq(wow.chat[3], P .. "  Heilsturz: 2 Fänge, 3 Gegenstände")
  eq(wow.chat[4], P .. "  Unbekannt: 1 Fänge, 1 Gegenstände")
  eq(#wow.chat, 4)
end)

test("German texts keep every placeholder of the English text, in order", function(wow)
  wow.locale = "deDE"
  local ns = boot(wow)
  local n = 0
  for key, text in pairs(ns.L) do
    n = n + 1
    eq(placeholders(text), placeholders(key), key)
  end
  eq(n, 10, "every text on screen has its German one")
end)

test("an English client keeps the English texts and the game's English word", function(wow)
  wow.locale = "enUS"
  UNKNOWN = "Unknown"
  local ns = boot(wow, { zone = "" })
  eq(next(ns.L), nil)
  catch(wow)
  wow.slash("/fl")
  eq(wow.chat[1], P .. "This session: 1 catches, 1 items, – per hour.")
  eq(wow.chat[2], P .. "Top zones: Unknown 1.")
  wow.slash("/fl zones")
  eq(wow.chat[5], P .. "  Unknown: 1 catches, 1 items")
end)
