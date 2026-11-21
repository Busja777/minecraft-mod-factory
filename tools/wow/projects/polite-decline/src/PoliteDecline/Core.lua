local _, ns = ...
local L = ns.L

-- Pure decisions: no frames, no events. Everything here runs outside the game in the tests.

ns.KINDS = { duel = true, invite = true }

-- The reply whisper (1.1): at most one per name in 30 minutes, and never two within 10 seconds.
ns.WHISPER_GAP = 1800
ns.WHISPER_SPACING = 10
ns.WHISPER_MAX = 200 -- characters of a custom reply; a whisper takes 255
ns.DEFAULT_WHISPER = "Thanks, but I don't take duels or group invites from people I don't know. Have a good day!"

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

-- A reply text the player typed, made safe to send: no "|" (the chat would read it as a code),
-- single spaces, trimmed. Returns the text, or nil and "empty" or "long".
function ns.CleanWhisper(text)
  if type(text) ~= "string" or ns.IsSecret(text) then return nil, "empty" end
  text = trim((text:gsub("|", ""):gsub("%s+", " ")))
  if text == "" then return nil, "empty" end
  if #text > ns.WHISPER_MAX then return nil, "long" end
  return text
end

-- One key per character for the whisper limit: "grumbash-argentdawn". A name without a realm is on
-- the player's own realm. nil when the name cannot be read.
function ns.WhisperKey(name, homeRealm)
  local base, realm = ns.SplitName(name)
  if not base then return nil end
  realm = realm or ns.NormalizeRealm(homeRealm) or ""
  return base .. "-" .. realm
end

function ns.NewWhisperState()
  return { last = {}, lastAny = nil }
end

-- true when a reply whisper to this key may go out now, and notes the time.
function ns.MayWhisper(state, key, now)
  if type(key) ~= "string" or type(now) ~= "number" then return false end
  if state.lastAny and now - state.lastAny < ns.WHISPER_SPACING then return false end
  local before = state.last[key]
  if before and now - before < ns.WHISPER_GAP then return false end
  state.last[key] = now
  state.lastAny = now
  return true
end

-- Whispers only go out in the open world, read from IsInInstance() (inInstance, instanceType) and
-- C_ChatInfo.InChatMessagingLockdown(). Inside a dungeon, raid, battleground, arena or scenario, while
-- the game has chat locked, or when a value is secret, no whisper goes out.
function ns.SafeToWhisper(inInstance, instanceType, lockdown)
  if ns.IsSecret(inInstance) or ns.IsSecret(instanceType) or ns.IsSecret(lockdown) then return false end
  if inInstance then return false end
  if instanceType ~= nil and instanceType ~= "none" then return false end
  if lockdown then return false end
  return true
end
