local _, ns = ...

-- Pure logic: no frames, no events. Everything here runs outside the game in the tests.
--
-- An emote is stored by its token, the name the game itself uses for it in every language ("WAVE").
-- The game defines the tokens as EMOTE<i>_TOKEN (Blizzard_ChatFrameBase, ChatEmoteConstants.lua) and the
-- chat commands that run them as EMOTE<i>_CMD<j> (GlobalStrings, in the client's language): EMOTE102_TOKEN
-- is "WAVE", EMOTE102_CMD1 is "/wave" on an English client and "/winken" on a German one, where
-- EMOTE102_CMD2 is still "/wave". The chat box maps every command to its token the same way
-- (ChatFrameUtil.ImportEmoteTokensToHash), so whatever the player can type in chat, the bar accepts.

ns.MAX_BUTTONS = 12
ns.DEFAULTS = { "WAVE", "HELLO", "THANK", "CHEER", "DANCE", "LAUGH" }
ns.MIN_SCAN = 1000 -- emote indices looked at even when MAXEMOTEINDEX is smaller or missing (628 in 12.1.5)

-- The bar: buttons in rows of PER_ROW.
ns.PER_ROW = 6
ns.BUTTON_WIDTH = 72
ns.BUTTON_HEIGHT = 22
ns.GAP = 2
ns.PADDING = 4

function ns.IsSecret(value)
  return issecretvalue ~= nil and issecretvalue(value) and true or false
end

-- A plain, non-empty string from the game, or nil.
function ns.String(value)
  if value == nil or ns.IsSecret(value) or type(value) ~= "string" or value == "" then return nil end
  return value
end

function ns.Trim(s)
  return (s:gsub("^%s+", ""):gsub("%s+$", ""))
end

-- The key a command is looked up by: without the slash, lower case, one word. "/Wave " -> "wave".
-- Letters outside A-Z (the ü in /tschüss) stay as they are, the same in the game's list and in what is typed.
function ns.CommandKey(text)
  if type(text) ~= "string" then return nil end
  local key = ns.Trim(text):gsub("^/", ""):lower()
  if key == "" or key:find("[%s/]") then return nil end
  return key
end

-- The emote list of the game. get(name) returns the value of a global, maxIndex is the highest index.
-- index.byCommand["wave"] = "WAVE"; index.label["WAVE"] = "wave" (the first command, without the slash);
-- index.count = number of emotes. A later command overwrites an earlier one, as in the game's chat box.
function ns.BuildIndex(get, maxIndex)
  local index = { byCommand = {}, label = {}, count = 0 }
  if type(get) ~= "function" or type(maxIndex) ~= "number" then return index end
  for i = 1, maxIndex do
    local token = ns.String(get("EMOTE" .. i .. "_TOKEN"))
    if token then
      local j = 1
      local cmd = get("EMOTE" .. i .. "_CMD" .. j)
      while cmd ~= nil do
        local key = ns.CommandKey(ns.String(cmd))
        if key then
          index.byCommand[key] = token
          if not index.label[token] then
            index.label[token] = ns.Trim(cmd):gsub("^/", "")
            index.count = index.count + 1
          end
        end
        j = j + 1
        cmd = get("EMOTE" .. i .. "_CMD" .. j)
      end
    end
  end
  return index
end

-- The token for what the player typed: a chat command with or without the slash ("wave", "/winken")
-- or the token itself ("WAVE"). nil when the game has no such emote.
function ns.Resolve(index, text)
  local key = ns.CommandKey(text)
  if not key or type(index) ~= "table" then return nil end
  local token = index.byCommand[key]
  if token then return token end
  local upper = key:upper()
  if index.label[upper] then return upper end
  return nil
end

-- The text on a button: the emote's first chat command without the slash ("wave"), else the token.
function ns.Label(index, token)
  local label = type(index) == "table" and index.label[token]
  if label then return label end
  return tostring(token):lower()
end

-- How an emote is named in chat messages: "/wave".
function ns.Command(index, token)
  return "/" .. ns.Label(index, token)
end

-- The saved list, cleaned: tokens only (upper case, no doubles), at most MAX_BUTTONS. A list that was
-- never saved starts with the defaults; an empty saved list stays empty. When the game's emote list is
-- known, tokens the game no longer has are dropped (and defaults it lacks are left out).
function ns.CleanList(list, index)
  local known = type(index) == "table" and index.count > 0 and index.label or nil
  local source = list
  if type(source) ~= "table" then source = ns.DEFAULTS end
  local out, seen = {}, {}
  for _, token in ipairs(source) do
    if type(token) == "string" and #out < ns.MAX_BUTTONS then
      token = token:upper()
      if token:match("^[%w_]+$") and not seen[token] and (not known or known[token]) then
        seen[token] = true
        out[#out + 1] = token
      end
    end
  end
  return out
end

function ns.Position(list, token)
  for i, t in ipairs(list) do
    if t == token then return i end
  end
  return nil
end

-- Adds a token at the end. Returns "added" and its position, "already" and its position, or "full".
function ns.Add(list, token)
  local at = ns.Position(list, token)
  if at then return "already", at end
  if #list >= ns.MAX_BUTTONS then return "full" end
  list[#list + 1] = token
  return "added", #list
end

-- Removes by button number ("3") or by emote (any command, or the token). Returns the removed token,
-- or nil and the reason: "number" (no such button), "unknown" (not an emote), "missing" (not on the bar).
function ns.Remove(list, text, index)
  if type(text) ~= "string" then return nil, "unknown" end
  local trimmed = ns.Trim(text)
  if trimmed:match("^%d+$") then
    local n = tonumber(trimmed)
    if n < 1 or n > #list then return nil, "number", n end
    return table.remove(list, n)
  end
  local token = ns.Resolve(index, trimmed)
  if not token then
    -- a token that is on the bar but no longer in the game's list can still be removed
    local upper = (ns.CommandKey(trimmed) or ""):upper()
    if ns.Position(list, upper) then token = upper else return nil, "unknown" end
  end
  local at = ns.Position(list, token)
  if not at then return nil, "missing", token end
  return table.remove(list, at)
end

-- Columns and rows for count buttons; an empty bar keeps the size of one button.
function ns.Grid(count)
  local n = math.max(count or 0, 1)
  local cols = math.min(n, ns.PER_ROW)
  local rows = math.ceil(n / ns.PER_ROW)
  return cols, rows
end

function ns.BarSize(count)
  local cols, rows = ns.Grid(count)
  local w = ns.PADDING * 2 + cols * ns.BUTTON_WIDTH + (cols - 1) * ns.GAP
  local h = ns.PADDING * 2 + rows * ns.BUTTON_HEIGHT + (rows - 1) * ns.GAP
  return w, h
end

-- Offset of button i from the bar's top left corner (x to the right, y downwards as negative).
function ns.ButtonOffset(i)
  local col = (i - 1) % ns.PER_ROW
  local row = math.floor((i - 1) / ns.PER_ROW)
  return ns.PADDING + col * (ns.BUTTON_WIDTH + ns.GAP), -(ns.PADDING + row * (ns.BUTTON_HEIGHT + ns.GAP))
end

-- "1 /wave, 2 /hello"
function ns.ListText(list, index)
  local parts = {}
  for i, token in ipairs(list) do parts[#parts + 1] = i .. " " .. ns.Command(index, token) end
  return table.concat(parts, ", ")
end
