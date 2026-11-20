local _, ns = ...
local L = ns.L

-- Pure decisions: no frames, no events. Everything here runs outside the game in the tests.

ns.KINDS = { duel = true, invite = true }

function ns.IsSecret(value)
  return issecretvalue ~= nil and issecretvalue(value) and true or false
end

local function trim(s)
  return (s:gsub("^%s+", ""):gsub("%s+$", ""))
end

-- "Argent Dawn", "ArgentDawn" and "argent-dawn" are the same realm: "argentdawn".
function ns.NormalizeRealm(realm)
  if type(realm) ~= "string" or ns.IsSecret(realm) then return nil end
  realm = realm:gsub("[%s%-']", ""):lower()
  if realm == "" then return nil end
  return realm
end

-- "Grumbash-Argent Dawn" -> "grumbash", "argentdawn". The realm is nil when the name has none.
function ns.SplitName(name)
  if type(name) ~= "string" or ns.IsSecret(name) then return nil end
  name = trim(name)
  local base, realm = name:match("^([^%-]+)%-(.+)$")
  base = trim(base or name)
  if base == "" or base:find("[%s%-]") then return nil end
  return base:lower(), ns.NormalizeRealm(realm)
end

-- The allow list key: "grumbash" (any realm) or "grumbash-argentdawn" (that realm only).
function ns.NameKey(name)
  local base, realm = ns.SplitName(name)
  if not base then return nil end
  return realm and (base .. "-" .. realm) or base
end

-- Two names of the same character. A name without a realm is on the player's own realm.
function ns.SameName(a, b, homeRealm)
  local baseA, realmA = ns.SplitName(a)
  local baseB, realmB = ns.SplitName(b)
  if not baseA or baseA ~= baseB then return false end
  local home = ns.NormalizeRealm(homeRealm)
  return (realmA or home) == (realmB or home)
end

-- allow = { [key] = name as typed }
function ns.IsAllowed(allow, name, homeRealm)
  if type(allow) ~= "table" then return false end
  local base, realm = ns.SplitName(name)
  if not base then return false end
  if allow[base] then return true end
  realm = realm or ns.NormalizeRealm(homeRealm)
  return realm ~= nil and allow[base .. "-" .. realm] ~= nil
end

-- kind: "duel" or "invite"
-- settings: { duels = true, invites = true } (true = requests from strangers are declined)
-- person: { name, friend, bnet, guild, unsure } as the game lookups found it
-- Returns true when the request is declined, and the reason either way.
function ns.Decide(kind, settings, person, allow, homeRealm)
  if not ns.KINDS[kind] or type(settings) ~= "table" then return false, "unknown" end
  if kind == "duel" and not settings.duels then return false, "off" end
  if kind == "invite" and not settings.invites then return false, "off" end
  if type(person) ~= "table" or person.unsure then return false, "unsure" end
  local name = person.name
  if ns.IsSecret(name) or type(name) ~= "string" or not ns.SplitName(name) then return false, "unsure" end
  if person.friend then return false, "friend" end
  if person.bnet then return false, "bnet" end
  if person.guild then return false, "guild" end
  if ns.IsAllowed(allow, name, homeRealm) then return false, "allowed" end
  return true, "stranger"
end

function ns.DeclineLine(kind, name, count)
  if kind == "duel" then
    return string.format(L["Declined a duel from %s (%d this session)."], name, count)
  end
  return string.format(L["Declined a group invite from %s (%d this session)."], name, count)
end

-- The names on the allow list as typed, sorted.
function ns.AllowNames(allow)
  local names = {}
  for _, shown in pairs(allow or {}) do names[#names + 1] = shown end
  table.sort(names, function(a, b) return a:lower() < b:lower() end)
  return names
end
