local _, ns = ...

-- Asks the game who someone is: WoW friend, Battle.net friend, guild mate.
-- Each lookup answers true, false, or nil when it cannot tell (missing function, secret value,
-- roster not loaded). One nil makes the person "unsure", and an unsure person is never declined.

local function plain(value)
  if ns.IsSecret(value) then return nil end
  return value
end

function ns.HomeRealm()
  local realm = GetNormalizedRealmName and plain(GetNormalizedRealmName())
  if not realm or realm == "" then realm = GetRealmName and plain(GetRealmName()) end
  return realm
end

-- WoW friend list, by name. Works with and without a GUID.
local function friendByName(name)
  if not (C_FriendList and C_FriendList.GetFriendInfo) then return nil end
  local info = C_FriendList.GetFriendInfo(name)
  if ns.IsSecret(info) then return nil end
  return info ~= nil
end

local function friendByGUID(guid)
  if not (C_FriendList and C_FriendList.IsFriend) then return nil end
  local is = C_FriendList.IsFriend(guid)
  if ns.IsSecret(is) then return nil end
  return is and true or false
end

local function bnetByGUID(guid)
  if not (C_BattleNet and C_BattleNet.GetAccountInfoByGUID) then return nil end
  local info = C_BattleNet.GetAccountInfoByGUID(guid)
  if ns.IsSecret(info) then return nil end
  return info ~= nil
end

local function guildByGUID(guid)
  if not IsGuildMember then return nil end
  local is = IsGuildMember(guid)
  if ns.IsSecret(is) then return nil end
  return is and true or false
end

-- Battle.net friends, by the characters they are playing right now.
local function bnetByName(name, home)
  local bn = C_BattleNet
  if not (BNGetNumFriends and bn and bn.GetFriendNumGameAccounts and bn.GetFriendGameAccountInfo) then return nil end
  local total = plain(BNGetNumFriends())
  if type(total) ~= "number" then return nil end
  for i = 1, total do
    local accounts = plain(bn.GetFriendNumGameAccounts(i))
    if type(accounts) ~= "number" then return nil end
    for j = 1, accounts do
      local game = bn.GetFriendGameAccountInfo(i, j)
      if ns.IsSecret(game) then return nil end
      if type(game) == "table" then
        local char, realm = game.characterName, game.realmName
        if ns.IsSecret(char) or ns.IsSecret(realm) then return nil end
        if type(char) == "string" and char ~= "" then
          local full = (type(realm) == "string" and realm ~= "") and (char .. "-" .. realm) or char
          if ns.SameName(full, name, home) then return true end
        end
      end
    end
  end
  return false
end

-- The guild roster, by name. An empty roster means it has not arrived yet: unsure.
local function guildByName(name, home)
  if not IsInGuild then return nil end
  local inGuild = IsInGuild()
  if ns.IsSecret(inGuild) then return nil end
  if not inGuild then return false end
  if not (GetNumGuildMembers and GetGuildRosterInfo) then return nil end
  local total = plain(GetNumGuildMembers())
  if type(total) ~= "number" or total <= 0 then return nil end
  for i = 1, total do
    local member = GetGuildRosterInfo(i)
    if ns.IsSecret(member) then return nil end
    if type(member) == "string" and ns.SameName(member, name, home) then return true end
  end
  return false
end

-- kind "invite" brings a GUID; a duel request only brings a name.
-- → { name, friend, bnet, guild, unsure }
function ns.Identify(kind, name, guid)
  local person = { name = name }
  if name == nil or ns.IsSecret(name) or type(name) ~= "string" or name == "" or ns.IsSecret(guid) then
    person.unsure = true
    return person
  end
  local home = ns.HomeRealm()
  local friend, bnet, guild
  if guid ~= nil and guid ~= "" then
    friend = friendByGUID(guid)
    if not friend then
      local byName = friendByName(name)
      if byName or friend == nil then friend = byName end
    end
    bnet = bnetByGUID(guid)
    guild = guildByGUID(guid)
  elseif kind == "duel" then
    friend = friendByName(name)
    bnet = bnetByName(name, home)
    guild = guildByName(name, home)
  else
    person.unsure = true -- an invite without a GUID: the game sent less than expected
    return person
  end
  person.friend, person.bnet, person.guild = friend, bnet, guild
  -- Someone who is known counts, even if another lookup could not tell.
  if not (friend or bnet or guild) and (friend == nil or bnet == nil or guild == nil) then
    person.unsure = true
  end
  return person
end
