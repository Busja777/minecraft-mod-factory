local _, ns = ...

-- Pure decisions: no frames, no events. Everything here runs outside the game in the tests.

-- The factions that can use a mailbox. A neutral Pandaren (still on the Wandering Isle) cannot.
-- Mail between your own characters of Alliance and Horde is allowed on the same or a connected
-- realm (since patch 9.2.5), so both factions are listed, your own faction first.
ns.FACTIONS = { Alliance = true, Horde = true }
ns.FACTION_TEXT = { Alliance = { "FACTION_ALLIANCE", "Alliance" }, Horde = { "FACTION_HORDE", "Horde" } }

function ns.IsSecret(value)
  return issecretvalue ~= nil and issecretvalue(value) and true or false
end

-- A text the game gave us, or nil when it is missing, secret or empty.
function ns.PlainText(value)
  if ns.IsSecret(value) or type(value) ~= "string" or value == "" then return nil end
  return value
end

local function plainNumber(value)
  if ns.IsSecret(value) or type(value) ~= "number" or value ~= value then return nil end
  return value
end

-- A text of the game in the player's language (GlobalStrings), English when the client lacks it.
function ns.GameText(global, english)
  local text = _G[global]
  if type(text) ~= "string" or text == "" then return english end
  return text
end

-- "Argent Dawn" and "ArgentDawn" both become "ArgentDawn": the form the game uses after the hyphen
-- of a recipient (GetNormalizedRealmName, C_AutoComplete.GetAutoCompleteRealms).
function ns.RealmKey(realm)
  realm = ns.PlainText(realm)
  if not realm then return nil end
  local key = realm:gsub("[%s%-]", "")
  if key == "" then return nil end
  return key
end

local function sameRealm(a, b)
  return a ~= nil and b ~= nil and a:lower() == b:lower()
end

-- Notes one character of the account. info = { name, realm, realmKey, class, level, faction } as the
-- game told it; a missing or secret value keeps what was saved before. Returns the key "Name-Realm"
-- and the saved entry, or nil when the name or the realm is unknown.
function ns.Record(chars, info, now)
  if type(chars) ~= "table" or type(info) ~= "table" then return nil end
  local name, realm = ns.PlainText(info.name), ns.PlainText(info.realm)
  if not name or not realm then return nil end
  local key = name .. "-" .. realm
  local c = type(chars[key]) == "table" and chars[key] or {}
  c.name = name
  c.realm = realm
  c.realmKey = ns.RealmKey(info.realmKey) or c.realmKey or ns.RealmKey(realm)
  c.class = ns.PlainText(info.class) or c.class
  local level = plainNumber(info.level)
  if level and level > 0 then c.level = math.floor(level) end
  c.faction = ns.PlainText(info.faction) or c.faction
  if plainNumber(now) then c.seen = now end
  chars[key] = c
  return key, c
end

-- Makes the saved table usable: a character without a name or realm is dropped, nothing else lost.
function ns.PrepareDB(db)
  if type(db) ~= "table" then db = {} end
  db.version = 1
  if type(db.chars) ~= "table" then db.chars = {} end
  for key, c in pairs(db.chars) do
    if type(c) ~= "table" or type(c.name) ~= "string" or c.name == "" or type(c.realm) ~= "string" or c.realm == "" then
      db.chars[key] = nil
    else
      c.realmKey = ns.RealmKey(c.realmKey) or ns.RealmKey(c.realm)
      if type(c.level) ~= "number" then c.level = nil end
      if type(c.class) ~= "string" then c.class = nil end
      if type(c.faction) ~= "string" then c.faction = nil end
    end
  end
  return db
end

-- The realms a letter can go to from here: the player's realm and its connected realms.
-- Returns a set of lower-case realm keys.
function ns.RealmSet(myRealmKey, connected)
  local set = {}
  local mine = ns.RealmKey(myRealmKey)
  if mine then set[mine:lower()] = true end
  if type(connected) == "table" then
    for _, realm in ipairs(connected) do
      local key = ns.RealmKey(realm)
      if key then set[key:lower()] = true end
    end
  end
  return set
end

-- What goes into the recipient box: "Name" on the player's realm, "Name-Realm" on a connected realm.
function ns.Recipient(c, myRealmKey)
  if sameRealm(c.realmKey, myRealmKey) then return c.name end
  return c.name .. "-" .. c.realmKey
end

-- The characters the player can send mail to from here: of this account, on this realm or a
-- connected one, Alliance or Horde, not the character being played. Own faction first, then by name.
-- An empty list when the player's own faction cannot use mail (or is unknown).
function ns.Candidates(chars, me, myRealmKey, connected, myFaction)
  local list = {}
  if type(chars) ~= "table" or not ns.FACTIONS[myFaction or ""] then return list end
  local realms = ns.RealmSet(myRealmKey, connected)
  for key, c in pairs(chars) do
    if key ~= me and type(c) == "table" and type(c.name) == "string" and c.realmKey
      and realms[c.realmKey:lower()] and ns.FACTIONS[c.faction or ""] then
      list[#list + 1] = {
        key = key, name = c.name, realm = c.realm, realmKey = c.realmKey, class = c.class,
        level = c.level, faction = c.faction,
        sameFaction = c.faction == myFaction, sameRealm = sameRealm(c.realmKey, myRealmKey),
        recipient = ns.Recipient(c, myRealmKey),
      }
    end
  end
  table.sort(list, function(a, b)
    if a.sameFaction ~= b.sameFaction then return a.sameFaction end
    if a.name ~= b.name then return a.name < b.name end
    return a.key < b.key
  end)
  return list
end

-- The name in the class colour of the game (C_ClassColor, else RAID_CLASS_COLORS); plain otherwise.
function ns.ClassColored(name, classFile)
  if type(classFile) ~= "string" then return name end
  if C_ClassColor and C_ClassColor.GetClassColor then
    local ok, color = pcall(C_ClassColor.GetClassColor, classFile)
    if ok and type(color) == "table" and color.WrapTextInColorCode then
      local okWrap, text = pcall(color.WrapTextInColorCode, color, name)
      if okWrap and type(text) == "string" then return text end
    end
  end
  local color = RAID_CLASS_COLORS and RAID_CLASS_COLORS[classFile]
  if color and type(color.colorStr) == "string" then return "|c" .. color.colorStr .. name .. "|r" end
  return name
end

-- "Level 70" the way the game writes it (UNIT_LEVEL_TEMPLATE); nil when the level is unknown.
function ns.LevelText(level)
  if type(level) ~= "number" then return nil end
  local fmt = ns.GameText("UNIT_LEVEL_TEMPLATE", "Level %d")
  if not fmt:find("%d", 1, true) then fmt = "Level %d" end
  return string.format(fmt, level)
end

function ns.FactionName(faction)
  local t = ns.FACTION_TEXT[faction or ""]
  if not t then return nil end
  return ns.GameText(t[1], t[2])
end

-- One line of the menu or the chat list: the name in its class colour, then in grey the level, the
-- realm when it is not the player's own and the faction when it is not the player's own.
function ns.Label(c, myRealmKey, myFaction)
  local extra = {}
  extra[#extra + 1] = ns.LevelText(c.level)
  if not sameRealm(c.realmKey, myRealmKey) then extra[#extra + 1] = c.realm end
  if myFaction == nil or c.faction ~= myFaction then extra[#extra + 1] = ns.FactionName(c.faction) end
  local text = ns.ClassColored(c.name, c.class)
  if #extra > 0 then text = text .. "  |cff9d9d9d" .. table.concat(extra, ", ") .. "|r" end
  return text
end

-- Every saved character for /twinkpost, sorted by realm and name.
function ns.AllCharacters(chars)
  local list = {}
  for key, c in pairs(chars or {}) do
    if type(c) == "table" and type(c.name) == "string" then list[#list + 1] = { key = key, c = c } end
  end
  table.sort(list, function(a, b)
    if a.c.realm ~= b.c.realm then return tostring(a.c.realm) < tostring(b.c.realm) end
    return a.key < b.key
  end)
  return list
end

-- The saved characters a typed name means, ignoring case: "Name-Realm" (realm with or without
-- spaces) finds one, "Name" alone finds every character of that name.
function ns.FindChars(chars, wanted)
  local found = {}
  wanted = ns.PlainText(wanted)
  if not wanted or type(chars) ~= "table" then return found end
  local lower = wanted:lower()
  local squeezed = (lower:gsub("%s", ""))
  for key, c in pairs(chars) do
    if type(c) == "table" then
      local full = (c.name or "") .. "-" .. (c.realmKey or "")
      if key:lower() == lower or full:lower() == squeezed then return { key } end
      if type(c.name) == "string" and c.name:lower() == lower then found[#found + 1] = key end
    end
  end
  table.sort(found)
  return found
end

-- Removes a character. Returns "forgotten" and its key, "self", "several" or "missing".
function ns.Forget(chars, wanted, me)
  local found = ns.FindChars(chars, wanted)
  if #found == 0 then return "missing" end
  if #found > 1 then return "several" end
  if found[1] == me then return "self", found[1] end
  chars[found[1]] = nil
  return "forgotten", found[1]
end
