local _, ns = ...

-- Pure arithmetic: no frames, no events. Everything here runs outside the game in the tests.
-- A reading is one faction's bar at one moment:
--   { id, name, kind = "standard" | "friend" | "renown", level, value, min, max, maxed }
-- For "standard" and "friend" the value is the faction's total standing, so it keeps growing across
-- standings. For "renown" the value is the reputation inside the current renown level (it starts at 0
-- again on every level), min is 0 and max is the size of the level.

ns.MIN_SECONDS = 300 -- reputation arrives in lumps (a quest, a world quest): a rate needs 5 minutes first
ns.MAX_REACTION = 8  -- Exalted

-- English names of the eight standings, used when the client has no text of its own.
ns.STANDING_NAMES = { "Hated", "Hostile", "Unfriendly", "Neutral", "Friendly", "Honored", "Revered", "Exalted" }

function ns.IsSecret(value)
  return issecretvalue ~= nil and issecretvalue(value) and true or false
end

-- A number read from the game, or nil when it is missing or secret.
function ns.Plain(value)
  if ns.IsSecret(value) or type(value) ~= "number" then return nil end
  return value
end

-- A text read from the game, or nil when it is missing or secret.
function ns.PlainText(value)
  if ns.IsSecret(value) or type(value) ~= "string" then return nil end
  return value
end

-- A word the game itself has (a GlobalStrings constant), in the client's language; the English word otherwise.
function ns.GameText(global, english)
  local text = _G[global]
  if type(text) ~= "string" or text == "" then return english end
  return text
end

-- 1.1: "Renown 12" the way the game writes it (RENOWN_LEVEL_LABEL), in the client's language.
function ns.RenownText(level)
  local fmt = ns.GameText("RENOWN_LEVEL_LABEL", "Renown %d")
  if not fmt:find("%d", 1, true) then fmt = "Renown %d" end
  return string.format(fmt, level)
end

function ns.StandingName(reaction)
  local english = ns.STANDING_NAMES[reaction]
  if not english then return "?" end
  return ns.GameText("FACTION_STANDING_LABEL" .. reaction, english)
end

-- Builders: turn what the game returns into a reading. Each returns nil when a needed value is
-- missing or secret, so the caller simply skips the update.

-- data: the table of C_Reputation.GetWatchedFactionData(). maxReaction: MAX_REPUTATION_REACTION or nil.
function ns.StandardReading(data, maxReaction)
  if type(data) ~= "table" then return nil end
  local id, reaction = ns.Plain(data.factionID), ns.Plain(data.reaction)
  local value, min, max = ns.Plain(data.currentStanding), ns.Plain(data.currentReactionThreshold), ns.Plain(data.nextReactionThreshold)
  if not id or id == 0 or not reaction or not value or not min or not max then return nil end
  local top = ns.Plain(maxReaction) or ns.MAX_REACTION
  return {
    id = id, name = ns.PlainText(data.name) or "?", kind = "standard", level = reaction,
    value = value, min = min, max = max, maxed = reaction >= top or max <= min,
    standing = ns.StandingName(reaction),
  }
end

-- friend: the table of C_GossipInfo.GetFriendshipReputation(id). ranks: C_GossipInfo.GetFriendshipReputationRanks(id) or nil.
function ns.FriendReading(id, name, friend, ranks)
  if type(friend) ~= "table" then return nil end
  local friendID = ns.Plain(friend.friendshipFactionID)
  if not friendID or friendID == 0 then return nil end
  local value, min = ns.Plain(friend.standing), ns.Plain(friend.reactionThreshold)
  if not value or not min then return nil end
  local nextThreshold = friend.nextThreshold
  if ns.IsSecret(nextThreshold) then return nil end
  local level = type(ranks) == "table" and ns.Plain(ranks.currentLevel) or nil
  local reading = {
    id = id, name = name, kind = "friend", level = level or 0,
    value = value, min = min, max = ns.Plain(nextThreshold) or value, maxed = nextThreshold == nil,
    standing = ns.PlainText(friend.reaction) or "?",
  }
  local maxLevel = type(ranks) == "table" and ns.Plain(ranks.maxLevel) or nil
  if level and maxLevel and maxLevel > 0 and level >= maxLevel then reading.maxed = true end
  if reading.max <= reading.min then reading.maxed = true end
  return reading
end

-- major: the table of C_MajorFactions.GetMajorFactionData(id). hasMax: C_MajorFactions.HasMaximumRenown(id).
function ns.RenownReading(id, name, major, hasMax)
  if type(major) ~= "table" then return nil end
  local level, earned, size = ns.Plain(major.renownLevel), ns.Plain(major.renownReputationEarned), ns.Plain(major.renownLevelThreshold)
  if not level or not earned or not size then return nil end
  return {
    id = id, name = ns.PlainText(major.name) or name, kind = "renown", level = level,
    value = earned, min = 0, max = size, maxed = (hasMax == true) or size <= 0,
    standing = ns.RenownText(level),
  }
end

-- Reputation gained between two readings of the same faction, and the standings gained on the way.
function ns.Step(prev, cur)
  if cur.kind ~= "renown" then
    local levels = cur.level - prev.level
    return cur.value - prev.value, levels > 0 and levels or 0
  end
  local levels = cur.level - prev.level
  if levels < 0 then return 0, 0 end
  if levels == 0 then return cur.value - prev.value, 0 end
  -- The bar starts over on every renown level: the rest of the old level counts, every full level
  -- in between (renown levels of a faction have the same size), and what is already in the new one.
  local rest = prev.max - prev.value
  if rest < 0 then rest = 0 end
  return rest + (levels - 1) * cur.max + cur.value, levels
end

-- One faction's part of the session: when it was first seen, what it gained since, its latest reading.
function ns.NewTrack(now, reading)
  return { start = now, gained = 0, levels = 0, last = reading }
end

-- Books a new reading into a track and returns the reputation it added.
-- A reading of another kind (the game changed how the faction is shown) only becomes the new base.
function ns.Advance(track, reading)
  local prev = track.last
  local gained, levels = 0, 0
  if prev and prev.kind == reading.kind then
    gained, levels = ns.Step(prev, reading)
  end
  track.gained = track.gained + gained
  track.levels = track.levels + levels
  track.last = reading
  return gained
end

-- Keeps one track per faction, so switching the watched faction back and forth loses nothing.
function ns.Record(session, reading, now)
  local track = session.factions[reading.id]
  if not track then
    track = ns.NewTrack(now, reading)
    session.factions[reading.id] = track
    return track, 0
  end
  return track, ns.Advance(track, reading)
end

function ns.PerHour(gained, seconds)
  if not seconds or seconds < ns.MIN_SECONDS then return nil end
  return math.floor(gained * 3600 / seconds)
end

-- Reputation still missing to the next standing, or nil at the top.
function ns.Needed(reading)
  if reading.maxed then return nil end
  local needed = reading.max - reading.value
  return needed > 0 and needed or 0
end

-- Seconds until the next standing at the pace of the session so far.
function ns.TimeToNext(needed, gained, seconds)
  if not needed or not seconds or seconds < ns.MIN_SECONDS or gained <= 0 then return nil end
  return needed * seconds / gained
end

function ns.FormatDuration(seconds)
  if not seconds then return "..." end
  if seconds < 60 then return ns.L["under a minute"] end
  local minutes = math.floor(seconds / 60)
  local hours = math.floor(minutes / 60)
  if hours == 0 then return string.format(ns.L["%dm"], minutes) end
  if hours < 24 then return string.format(ns.L["%dh %02dm"], hours, minutes % 60) end
  return string.format(ns.L["%dd %dh"], math.floor(hours / 24), hours % 24)
end

function ns.FormatNumber(n)
  local sign = n < 0 and "-" or ""
  local s = tostring(math.floor(math.abs(n)))
  local out = s:reverse():gsub("(%d%d%d)", "%1,"):reverse()
  out = out:gsub("^,", "")
  local sep = ns.GameText("LARGE_NUMBER_SEPERATOR", ",")
  if sep ~= "," then out = out:gsub(",", function() return sep end) end
  return sign .. out
end

function ns.Signed(n)
  if n > 0 then return "+" .. ns.FormatNumber(n) end
  return ns.FormatNumber(n)
end

-- Everything a track shows, as numbers. A missing field means "not known yet" (or, for needed, "at the top").
function ns.View(track, now)
  local r = track.last
  local seconds = now - track.start
  local needed = ns.Needed(r)
  return {
    name = r.name, standing = r.standing, maxed = r.maxed,
    gained = track.gained, levels = track.levels, seconds = seconds,
    perHour = ns.PerHour(track.gained, seconds),
    needed = needed,
    eta = ns.TimeToNext(needed, track.gained, seconds),
  }
end
