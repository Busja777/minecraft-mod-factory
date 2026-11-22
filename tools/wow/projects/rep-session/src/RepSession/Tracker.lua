local _, ns = ...

-- Reads the watched faction (the reputation bar) whenever the game reports a change.

ns.session = { factions = {} }
ns.watched = nil -- factionID of the faction on the reputation bar, nil when none is watched

-- The watched faction right now as a reading, or nil when none is watched or the game keeps the numbers
-- to itself. The second value is true only when the game clearly says no faction is watched.
function ns.ReadWatched()
  if not C_Reputation or not C_Reputation.GetWatchedFactionData then return nil, false end
  local data = C_Reputation.GetWatchedFactionData()
  if type(data) ~= "table" then return nil, true end
  if ns.IsSecret(data.factionID) then return nil, false end
  local id = ns.Plain(data.factionID)
  if not id or id == 0 then return nil, true end
  local name = ns.PlainText(data.name) or "?"

  if C_Reputation.IsMajorFaction and C_MajorFactions and C_MajorFactions.GetMajorFactionData then
    local isMajor = C_Reputation.IsMajorFaction(id)
    if not ns.IsSecret(isMajor) and isMajor then
      local hasMax = false
      if C_MajorFactions.HasMaximumRenown then
        local v = C_MajorFactions.HasMaximumRenown(id)
        hasMax = not ns.IsSecret(v) and v == true
      end
      return ns.RenownReading(id, name, C_MajorFactions.GetMajorFactionData(id), hasMax)
    end
  end

  if C_GossipInfo and C_GossipInfo.GetFriendshipReputation then
    local friend = C_GossipInfo.GetFriendshipReputation(id)
    local ranks = C_GossipInfo.GetFriendshipReputationRanks and C_GossipInfo.GetFriendshipReputationRanks(id) or nil
    local reading = ns.FriendReading(id, name, friend, ranks)
    if reading then return reading end
  end

  return ns.StandardReading(data, MAX_REPUTATION_REACTION)
end

function ns.Sample()
  local reading, none = ns.ReadWatched()
  if not reading then
    -- A secret or missing value keeps the faction shown so far; only "nothing watched" clears it.
    if none then ns.watched = nil end
  else
    ns.watched = reading.id
    ns.Record(ns.session, reading, GetTime())
  end
  if ns.Refresh then ns.Refresh() end
end

-- The view of the watched faction, or nil.
function ns.Current(now)
  local track = ns.watched and ns.session.factions[ns.watched]
  if not track then return nil end
  return ns.View(track, now or GetTime())
end

-- Starts the session again: every faction is measured from now on.
function ns.Reset()
  ns.session = { factions = {} }
  ns.Sample()
end

local frame = CreateFrame("Frame")
ns.eventFrame = frame

frame:SetScript("OnEvent", function(_, event)
  if event == "PLAYER_LOGIN" then
    RepSessionDB = type(RepSessionDB) == "table" and RepSessionDB or {}
    ns.db = RepSessionDB
  else -- PLAYER_ENTERING_WORLD sets the baseline, UPDATE_FACTION books the gains
    ns.Sample()
  end
end)

frame:RegisterEvent("PLAYER_LOGIN")
frame:RegisterEvent("PLAYER_ENTERING_WORLD")
frame:RegisterEvent("UPDATE_FACTION")
