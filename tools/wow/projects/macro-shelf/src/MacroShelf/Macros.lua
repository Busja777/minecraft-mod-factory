local _, ns = ...
local L = ns.L

-- Reads the game's macros, keeps the backup in MacroShelfDB and creates macros.
-- MacroShelfDB = { version = 1, account = { at = t, macros = {...} },
--                  chars = { ["Name-Realm"] = { at = t, macros = {...} } } }
-- Existing macros are never edited or deleted; creating is refused in combat.

function ns.Print(msg)
  DEFAULT_CHAT_FRAME:AddMessage("|cffffd100" .. L["Macro Shelf"] .. ":|r " .. msg)
end

function ns.CharKey()
  return (ns.String(UnitName("player")) or "?") .. "-" .. (ns.String(GetRealmName()) or "?")
end

-- Slots per place. The game's constants when it has them, Retail's numbers otherwise.
function ns.Limits()
  local account = ns.Number(MAX_ACCOUNT_MACROS) or ns.FALLBACK_ACCOUNT
  local character = ns.Number(MAX_CHARACTER_MACROS) or ns.FALLBACK_CHARACTER
  return account, character
end

function ns.CanRead()
  return GetNumMacros ~= nil and GetMacroInfo ~= nil
end

-- The player's macros right now: { account = {...}, character = {...} } plus the counts.
function ns.ReadMacros()
  local out = { account = {}, character = {} }
  if not ns.CanRead() then return out, 0, 0 end
  local okCount, numAccount, numCharacter = pcall(GetNumMacros)
  numAccount = okCount and ns.Number(numAccount) or 0
  numCharacter = okCount and ns.Number(numCharacter) or 0
  local maxAccount = ns.Limits()
  local function read(index, scope)
    local ok, name, icon, body = pcall(GetMacroInfo, index)
    name, body = ok and ns.String(name), ok and ns.String(body)
    if not name then return end
    if ns.IsSecret(icon) then icon = nil end
    out[scope][#out[scope] + 1] = { scope = scope, name = name, icon = ns.CleanIcon(icon) or ns.DEFAULT_ICON, body = body or "" }
  end
  for i = 1, numAccount do read(i, "account") end
  for i = maxAccount + 1, maxAccount + numCharacter do read(i, "character") end
  return out, numAccount, numCharacter
end

function ns.FreeSlots(numAccount, numCharacter)
  local maxAccount, maxCharacter = ns.Limits()
  return {
    account = math.max(0, maxAccount - numAccount),
    character = math.max(0, maxCharacter - numCharacter),
  }
end

function ns.CurrentList()
  local now = ns.ReadMacros()
  local list = {}
  for _, scope in ipairs(ns.SCOPES) do
    for _, m in ipairs(now[scope]) do list[#list + 1] = m end
  end
  return list
end

-- Saves the macros of the account and of this character. An empty place never replaces a
-- backup that holds macros (the game may not have loaded them yet). Returns the report lines.
function ns.Backup()
  local now = ns.ReadMacros()
  local at = time()
  local lines = {}
  -- 1.1: one whole sentence per place instead of "account"/"character" spliced into one, so each
  -- language can word it its own way (German: allgemeine Makros, Charaktermakros). English is unchanged.
  local function save(old, list, keptText, savedText)
    if #list == 0 and old and #(old.macros or {}) > 0 then
      lines[#lines + 1] = string.format(keptText, #old.macros)
      return old
    end
    lines[#lines + 1] = string.format(savedText, #list)
    return { at = at, macros = ns.CopyList(list) }
  end
  ns.db.account = save(ns.db.account, now.account,
    L["No account macros found right now, the older backup of %d was kept."], L["Saved %d account macros."])
  ns.db.chars[ns.CharKey()] = save(ns.db.chars[ns.CharKey()], now.character,
    L["No character macros found right now, the older backup of %d was kept."], L["Saved %d character macros."])
  return lines
end

-- Creates the given macros where nothing is in the way. nil and a reason when nothing may happen.
function ns.Create(macros)
  if InCombatLockdown and InCombatLockdown() then
    return nil, L["Macros cannot be created in combat. Try again after the fight."]
  end
  if not CreateMacro or not ns.CanRead() then
    return nil, L["This game client does not let addons create macros."]
  end
  local existing, numAccount, numCharacter = ns.ReadMacros()
  local plan = ns.Plan(macros, existing, ns.FreeSlots(numAccount, numCharacter))
  local made = {}
  plan.failed = {}
  for _, m in ipairs(plan.create) do
    local ok, id = pcall(CreateMacro, m.name, ns.CleanIcon(m.icon), m.body, m.scope == "character")
    if ok and id then made[#made + 1] = m else plan.failed[#plan.failed + 1] = m end
  end
  plan.create = made
  return plan
end

-- The backed-up macros of the account and of this character.
function ns.BackupList()
  local list = {}
  for _, m in ipairs(ns.db.account and ns.db.account.macros or {}) do
    list[#list + 1] = { scope = "account", name = m.name, icon = m.icon, body = m.body }
  end
  local mine = ns.db.chars[ns.CharKey()]
  for _, m in ipairs(mine and mine.macros or {}) do
    list[#list + 1] = { scope = "character", name = m.name, icon = m.icon, body = m.body }
  end
  return list
end

-- Report lines of a restore or an import.
function ns.Restore()
  local list = ns.BackupList()
  if #list == 0 then return { L["There is no backup yet. Type /macroshelf backup first."] } end
  local plan, why = ns.Create(list)
  if not plan then return { why } end
  return ns.Report(plan)
end

function ns.Import(text)
  local macros, errors = ns.Parse(text)
  if not macros then
    local lines = { L["Nothing was imported:"] }
    for i, e in ipairs(errors) do
      if i > 5 then
        lines[#lines + 1] = string.format(L["and %d more"], #errors - 5)
        break
      end
      lines[#lines + 1] = e
    end
    return lines, false
  end
  local plan, why = ns.Create(macros)
  if not plan then return { why }, false end
  return ns.Report(plan), true
end

-- "12 account macros from 2026-11-20 18:00" for the help and the window.
-- 1.1: one text per place, and the date written the way the player's language writes it.
function ns.BackupStatus()
  local function one(b, noneText, fromText)
    if not b or not b.at then return noneText end
    return string.format(fromText, #(b.macros or {}), date(L["%Y-%m-%d %H:%M"], b.at))
  end
  return string.format(L["Backup: %s, %s."],
    one(ns.db.account, L["no account backup"], L["%d account macros from %s"]),
    one(ns.db.chars[ns.CharKey()], L["no character backup"], L["%d character macros from %s"]))
end

local function onLogin()
  MacroShelfDB = type(MacroShelfDB) == "table" and MacroShelfDB or {}
  local db = MacroShelfDB
  db.version = 1
  if type(db.chars) ~= "table" then db.chars = {} end
  if db.account ~= nil and type(db.account) ~= "table" then db.account = nil end
  ns.db = db
end

local frame = CreateFrame("Frame")
frame:SetScript("OnEvent", function(_, event)
  if event == "PLAYER_LOGIN" then onLogin() end
end)
frame:RegisterEvent("PLAYER_LOGIN")
