local _, ns = ...
local L = ns.L

-- Pure logic: no frames, no events. Everything here runs outside the game in the tests.
--
-- A macro is { scope = "account" | "character", name = "...", icon = 134400 | "TEXTURE_NAME", body = "..." }.
--
-- The text format of an export (and of an import):
--   # Macro Shelf export          comment lines start with #, blank lines between macros are ignored
--   [macro] account 134400 Pull   scope, icon and name of one macro
--   >/cast Fireball               every line of the macro text starts with >
--   >/say Pulling!
--   [end]                         closes the macro
-- In names and macro lines, \! stands for | and \\ for \ (a text box in the game turns | into codes).
--
-- Rules an import never breaks:
--   * text with any mistake creates nothing at all; the mistakes are listed with their line numbers.
--   * a name has 1 to 16 characters, a macro text at most 255 characters (the game's limits).
--   * an existing macro is never changed: a macro whose name already exists in the same place
--     (account or character) is skipped and named in the report, the identical macro counts as "already there".
--   * only as many macros are created as free slots allow; the rest is named in the report.

ns.MAX_NAME = 16
ns.MAX_BODY = 255
ns.DEFAULT_ICON = 134400 -- the question mark icon (the game then shows the spell's own icon)
ns.FALLBACK_ACCOUNT = 120 -- MAX_ACCOUNT_MACROS of Retail, used only when the client lacks the constant
ns.FALLBACK_CHARACTER = 18 -- MAX_CHARACTER_MACROS of Retail
ns.SCOPES = { "account", "character" }

function ns.IsSecret(value)
  return issecretvalue ~= nil and issecretvalue(value) and true or false
end

-- A plain number from the game, or nil when it is secret or missing.
function ns.Number(value)
  if value == nil or ns.IsSecret(value) or type(value) ~= "number" then return nil end
  return value
end

-- A plain string from the game, or nil when it is secret or missing.
function ns.String(value)
  if value == nil or ns.IsSecret(value) or type(value) ~= "string" then return nil end
  return value
end

-- Characters, not bytes: "Ängste" is 6 characters.
function ns.Length(s)
  local _, n = s:gsub("[^\128-\191]", "")
  return n
end

function ns.Trim(s)
  return (s:gsub("^%s+", ""):gsub("%s+$", ""))
end

function ns.Escape(s)
  return (s:gsub("\\", "\\\\"):gsub("|", "\\!"))
end

-- The text back, or nil and a reason.
function ns.Unescape(s)
  if s:find("|", 1, true) then return nil, L["write \\! instead of |"] end
  local bad
  local out = s:gsub("\\(.?)", function(c)
    if c == "\\" then return "\\" end
    if c == "!" then return "|" end
    bad = true
    return ""
  end)
  if bad then return nil, L["a \\ must be followed by \\ or !"] end
  return out
end

-- An icon the text format can carry: a file number or a texture name without spaces.
function ns.CleanIcon(icon)
  if type(icon) == "number" and icon > 0 and icon == math.floor(icon) then return icon end
  if type(icon) == "string" then
    if icon:match("^%d+$") then
      local n = tonumber(icon)
      if n > 0 then return n end
      return nil
    end
    if #icon <= 200 and icon:match("^%a[%w_%.\\/%-]*$") then return icon end
  end
  return nil
end

-- nil when the macro can be created as it is, otherwise the reason.
function ns.Problem(m)
  if type(m) ~= "table" then return L["not a macro"] end
  if m.scope ~= "account" and m.scope ~= "character" then return L["the place must be account or character"] end
  if type(m.name) ~= "string" or ns.Trim(m.name) == "" then return L["the name is empty"] end
  if m.name:find("[\r\n]") then return L["the name has a line break"] end
  if ns.Length(m.name) > ns.MAX_NAME then return string.format(L["the name is longer than %d characters"], ns.MAX_NAME) end
  if type(m.body) ~= "string" then return L["the macro text is missing"] end
  if m.body:find("\r", 1, true) then return L["the macro text has a stray line break"] end
  if ns.Length(m.body) > ns.MAX_BODY then return string.format(L["the macro text is longer than %d characters"], ns.MAX_BODY) end
  if not ns.CleanIcon(m.icon) then return L["the icon is not valid"] end
  return nil
end

local function countOf(macros)
  local n = 0
  for _ in ipairs(macros) do n = n + 1 end
  return n
end

function ns.ExportText(macros)
  local lines = { string.format(L["# Macro Shelf export, %d macros. Paste it into /macroshelf import."], countOf(macros)) }
  for _, m in ipairs(macros) do
    lines[#lines + 1] = ""
    lines[#lines + 1] = string.format("[macro] %s %s %s", m.scope, tostring(ns.CleanIcon(m.icon) or ns.DEFAULT_ICON), ns.Escape(m.name))
    for line in ((m.body or "") .. "\n"):gmatch("(.-)\n") do
      lines[#lines + 1] = ">" .. ns.Escape(line)
    end
    lines[#lines + 1] = "[end]"
  end
  return table.concat(lines, "\n")
end

-- The macros in an export text, or nil and a list of mistakes ("Line 4: ...").
-- Nothing half-read is ever returned: one mistake and the whole text is refused.
function ns.Parse(text)
  if type(text) ~= "string" or ns.IsSecret(text) then return nil, { L["There is no text to read."] } end
  text = text:gsub("\r\n", "\n"):gsub("\r", "\n")
  local macros, errors = {}, {}
  local function fail(n, why) errors[#errors + 1] = string.format(L["Line %d: %s."], n, why) end
  local cur
  local n = 0
  for line in (text .. "\n"):gmatch("(.-)\n") do
    n = n + 1
    if cur then
      local rest = line:match("^%s*>(.*)$")
      if rest then
        local plain, why = ns.Unescape(rest)
        if plain then cur.lines[#cur.lines + 1] = plain else fail(n, why); cur.broken = true end
      elseif ns.Trim(line) == "[end]" then
        local m = { scope = cur.scope, icon = cur.icon, name = cur.name, body = table.concat(cur.lines, "\n") }
        if not cur.broken then
          local why = ns.Problem(m)
          if why then fail(cur.at, why) else macros[#macros + 1] = m end
        end
        cur = nil
      else
        fail(n, L["every line of a macro starts with >, and [end] closes the macro"])
        cur.broken = true
      end
    else
      local trimmed = ns.Trim(line)
      if trimmed == "" or trimmed:sub(1, 1) == "#" then
        -- blank line or comment
      elseif trimmed:match("^%[macro%]") then
        local scope, icon, name = trimmed:match("^%[macro%]%s+(%S+)%s+(%S+)%s+(.+)$")
        cur = { at = n, lines = {} }
        if not scope then
          fail(n, L["a macro starts with [macro], the place, the icon and the name"])
          cur.broken = true
        else
          cur.scope = scope:lower()
          cur.icon = ns.CleanIcon(icon)
          local plain, why = ns.Unescape(name)
          cur.name = plain
          if not plain then fail(n, why); cur.broken = true end
          if not cur.icon then fail(n, L["the icon is not valid"]); cur.broken = true end
          if cur.scope ~= "account" and cur.scope ~= "character" then
            fail(n, L["the place must be account or character"])
            cur.broken = true
          end
        end
      else
        fail(n, L["this line is not part of a macro"])
      end
    end
  end
  if cur then fail(cur.at, L["the macro is not closed with [end]"]) end
  if #errors > 0 then return nil, errors end
  if #macros == 0 then return nil, { L["The text holds no macros."] } end
  return macros
end

-- What would happen when these macros are created next to the existing ones.
--   existing = { account = { macro, ... }, character = { macro, ... } }
--   free     = { account = n, character = n }
-- → { create = {...}, same = {...}, clash = {...}, full = {...}, bad = { { macro, why }, ... } }
function ns.Plan(macros, existing, free)
  local names = { account = {}, character = {} }
  for _, scope in ipairs(ns.SCOPES) do
    for _, m in ipairs(existing and existing[scope] or {}) do
      if type(m.name) == "string" then
        local bodies = names[scope][m.name] or {}
        bodies[#bodies + 1] = m.body
        names[scope][m.name] = bodies
      end
    end
  end
  local left = { account = free and free.account or 0, character = free and free.character or 0 }
  local plan = { create = {}, same = {}, clash = {}, full = {}, bad = {} }
  for _, m in ipairs(macros) do
    local why = ns.Problem(m)
    if why then
      plan.bad[#plan.bad + 1] = { macro = m, why = why }
    else
      local bodies = names[m.scope][m.name]
      if bodies then
        local same = false
        for _, body in ipairs(bodies) do if body == m.body then same = true end end
        local list = same and plan.same or plan.clash
        list[#list + 1] = m
      elseif left[m.scope] <= 0 then
        plan.full[#plan.full + 1] = m
      else
        left[m.scope] = left[m.scope] - 1
        names[m.scope][m.name] = { m.body }
        plan.create[#plan.create + 1] = m
      end
    end
  end
  return plan
end

local function nameList(list)
  local names = {}
  for i, m in ipairs(list) do
    if i > 10 then
      names[#names + 1] = string.format(L["and %d more"], #list - 10)
      break
    end
    names[#names + 1] = (m.macro or m).name
  end
  return table.concat(names, ", ")
end

-- The lines that tell the player what a plan did.
function ns.Report(plan)
  local lines = {}
  local made = #plan.create
  if made == 1 then
    lines[#lines + 1] = L["Created 1 macro."]
  else
    lines[#lines + 1] = string.format(L["Created %d macros."], made)
  end
  if #plan.same > 0 then
    lines[#lines + 1] = string.format(L["Already there: %s."], nameList(plan.same))
  end
  if #plan.clash > 0 then
    lines[#lines + 1] = string.format(L["Skipped, a different macro with this name exists (rename one to keep both): %s."], nameList(plan.clash))
  end
  if #plan.full > 0 then
    lines[#lines + 1] = string.format(L["No free macro slot left for: %s."], nameList(plan.full))
  end
  if #plan.bad > 0 then
    lines[#lines + 1] = string.format(L["Not valid: %s (%s)."], nameList(plan.bad), plan.bad[1].why)
  end
  if plan.failed and #plan.failed > 0 then
    lines[#lines + 1] = string.format(L["The game refused: %s."], nameList(plan.failed))
  end
  return lines
end

-- Copy of a macro list as plain tables for the saved backup.
function ns.CopyList(list, scope)
  local out = {}
  for _, m in ipairs(list or {}) do
    out[#out + 1] = { scope = scope or m.scope, name = m.name, icon = m.icon, body = m.body }
  end
  return out
end
