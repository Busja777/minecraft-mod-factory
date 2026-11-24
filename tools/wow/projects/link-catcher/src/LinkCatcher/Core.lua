local _, ns = ...

-- Pure text work: no frames, no events. Everything here runs outside the game in the tests.

ns.MAX_URLS = 500        -- links remembered for clicking; older ones fall back to the link text
ns.DEFAULT_LINES = 100   -- lines /linkcatcher copy takes from the chat window
ns.MAX_LINES = 500
ns.COLOR = "ff3fa9f5"    -- light blue, readable on the dark chat background
ns.LINK_TYPE = "addon:LinkCatcher:"

-- Top-level domains a web address without "www." or a scheme may end in. Kept short on purpose:
-- "1.5", "e.g." or "lol.wtf" must stay plain text.
ns.TLDS = {
  com = true, net = true, org = true, io = true, gg = true, tv = true,
  eu = true, de = true, fr = true, uk = true, co = true, info = true,
}

function ns.IsSecret(value)
  return issecretvalue ~= nil and issecretvalue(value) and true or false
end

-- End of the escape sequence that starts with "|" at position i of s.
local function codeEnd(s, i)
  local c = s:sub(i + 1, i + 1)
  if c == "H" then -- |H<data>|h<text>|h
    local a = s:find("|h", i + 2, true)
    if not a then return #s end
    local b = s:find("|h", a + 2, true)
    return b and b + 1 or #s
  elseif c == "T" or c == "A" or c == "K" then -- textures, atlases, protected names
    local a = s:find("|" .. c:lower(), i + 2, true)
    return a and a + 1 or #s
  elseif c == "c" then
    if s:sub(i + 2, i + 2) == "n" then -- |cn<colour name>:
      return s:find(":", i + 3, true) or #s
    end
    return math.min(i + 9, #s) -- |cAARRGGBB
  elseif c == "" then
    return i
  end
  return i + 1 -- |r, |n, || and anything else of two characters
end

-- Splits a chat text into plain parts and escape sequences (links, colours, textures).
function ns.Split(s)
  local parts, start = {}, 1
  while true do
    local p = s:find("|", start, true)
    if not p then break end
    if p > start then parts[#parts + 1] = { plain = true, text = s:sub(start, p - 1) } end
    local e = codeEnd(s, p)
    parts[#parts + 1] = { plain = false, text = s:sub(p, e) }
    start = e + 1
  end
  if start <= #s then parts[#parts + 1] = { plain = true, text = s:sub(start) } end
  return parts
end

-- Characters a web address may hold. No spaces, no "|", no brackets.
local RUN = "()([%w%-%._~:/%?#@!%$&%*%+,;=%%'%(%)]+)"

-- Drops punctuation at the end ("see example.com.") and an unbalanced closing parenthesis.
local function trimEnd(tok)
  while #tok > 0 do
    local last = tok:sub(-1)
    if last:find("[%.,;:!%?'%*]") then
      tok = tok:sub(1, -2)
    elseif last == ")" then
      local _, opens = tok:gsub("%(", "")
      local _, closes = tok:gsub("%)", "")
      if closes > opens then tok = tok:sub(1, -2) else break end
    else
      break
    end
  end
  return tok
end

-- "www.example.com", "example.co.uk": labels of letters, digits and hyphens, a letter-only ending.
local function hostOk(host)
  if not host:find("^[%w][%w%-%.]*$") or host:find("%.%.") or host:find("%-%.") then return false end
  local tld = host:match("%.(%a+)$")
  return tld ~= nil and #tld >= 2, tld and tld:lower()
end

-- A character before a web address must not be part of a word, a path or an e-mail address.
local function boundary(tok, at)
  return at == 1 or not tok:sub(at - 1, at - 1):find("[%w@%.%-_/]")
end

-- Position (within tok) and text of the web address in one run of address characters, or nil.
local function urlIn(tok)
  local lower = tok:lower()
  local from = 1
  while true do
    local a = lower:find("https?:%/%/", from)
    local w = lower:find("www%.", from)
    local at = (a and w) and math.min(a, w) or a or w
    if not at then break end
    if boundary(tok, at) then
      local url = trimEnd(tok:sub(at))
      local scheme = url:lower():match("^https?:%/%/()")
      local host = url:sub(scheme or 1):match("^[^/%?#:]*")
      if scheme and host:find("^[%w][%w%-%.]*%.[%w]") and not host:find("%.%.") then return at, url end
      if not scheme and hostOk(host) then return at, url end
    end
    from = at + 1
  end
  -- A bare address like "example.com/guide": whole run, known ending, nothing before the path.
  local lead = tok:find("[%w]")
  if not lead or tok:find("@", 1, true) then return nil end
  local url = trimEnd(tok:sub(lead))
  local host, rest = url:match("^([%w%-%.]+)(.*)$")
  if not host or (rest ~= "" and rest:sub(1, 1) ~= "/") then return nil end
  local ok, tld = hostOk(host)
  if ok and ns.TLDS[tld] and host:match("^[^%.]*"):find("%a") then return lead, url end
  return nil
end

-- Every web address in a plain text: list of { first, last, url } positions.
function ns.FindUrls(text)
  local found = {}
  for pos, tok in text:gmatch(RUN) do
    local at, url = urlIn(tok)
    if at then
      local first = pos + at - 1
      found[#found + 1] = { first, first + #url - 1, url }
    end
  end
  return found
end

function ns.NewStore()
  return { last = 0, urls = {} }
end

-- Keeps a web address for clicking and returns its number; only the newest MAX_URLS stay.
function ns.Remember(store, url)
  store.last = store.last + 1
  store.urls[store.last] = url
  store.urls[store.last - ns.MAX_URLS] = nil
  return store.last
end

function ns.Link(id, url)
  return "|c" .. ns.COLOR .. "|H" .. ns.LINK_TYPE .. id .. "|h[" .. url .. "]|h|r"
end

-- Turns every web address of a chat text into a clickable link. Links, colours and textures
-- already in the text are left alone. Returns the text unchanged (the same string) without addresses.
function ns.Linkify(msg, store)
  local out, count = {}, 0
  for _, part in ipairs(ns.Split(msg)) do
    if part.plain then
      local text, pos = part.text, 1
      for _, hit in ipairs(ns.FindUrls(text)) do
        out[#out + 1] = text:sub(pos, hit[1] - 1)
        out[#out + 1] = ns.Link(ns.Remember(store, hit[3]), hit[3])
        pos = hit[2] + 1
        count = count + 1
      end
      out[#out + 1] = text:sub(pos)
    else
      out[#out + 1] = part.text
    end
  end
  if count == 0 then return msg, 0 end
  return table.concat(out), count
end

-- The number in "addon:LinkCatcher:<n>", or nil for any other link.
function ns.LinkId(link)
  if type(link) ~= "string" then return nil end
  local n = link:match("^addon:LinkCatcher:(%d+)$")
  return n and tonumber(n)
end

-- The address shown in a whole link text "|H...|h[address]|h".
function ns.UrlFromText(text)
  if type(text) ~= "string" then return nil end
  local url = text:match("|h%[(.-)%]|h")
  return url ~= "" and url or nil
end

-- Finds our link among the arguments of a click callback: the first text that is one of our links
-- and the argument after it (the whole link text). Secret values are never looked at.
function ns.PickLink(...)
  for i = 1, select("#", ...) do
    local v = select(i, ...)
    if not ns.IsSecret(v) and type(v) == "string" and ns.LinkId(v) then
      local text = select(i + 1, ...)
      if ns.IsSecret(text) then text = nil end
      return v, text
    end
  end
  return nil
end

-- Chat text without colours, textures and link codes: what the player reads, ready to copy.
-- Item and spell links keep their [name], our own links become the bare address.
function ns.StripCodes(s)
  local out = {}
  for _, part in ipairs(ns.Split(s)) do
    local t = part.text
    if part.plain then
      out[#out + 1] = t
    elseif t:sub(2, 2) == "H" then
      local data, shown = t:match("^|H(.-)|h(.-)|h$")
      if data and data:find("^addon:LinkCatcher:") then shown = shown:match("^%[(.*)%]$") or shown end
      out[#out + 1] = shown or ""
    elseif t == "|n" then
      out[#out + 1] = "\n"
    elseif t == "||" then
      out[#out + 1] = "||" -- stays escaped, so the copy box shows one "|"
    elseif t:sub(2, 2) == "K" then
      out[#out + 1] = ns.L["(name)"] -- Battle.net names are protected and cannot be read
    end
  end
  return table.concat(out)
end

-- The last count lines of a chat window as plain text. Lines the game keeps secret are skipped.
-- Returns nil when the window cannot be read, else lines and the number of skipped lines.
function ns.CollectLines(frame, count)
  if type(frame) ~= "table" or not frame.GetNumMessages or not frame.GetMessageInfo then return nil end
  local total = frame:GetNumMessages()
  if ns.IsSecret(total) or type(total) ~= "number" then return nil end
  local lines, skipped = {}, 0
  for i = math.max(1, total - count + 1), total do
    local text = frame:GetMessageInfo(i)
    if not ns.IsSecret(text) and type(text) == "string" then
      lines[#lines + 1] = ns.StripCodes(text)
    else
      skipped = skipped + 1
    end
  end
  return lines, skipped
end

-- "/linkcatcher copy 50" → 50, clamped; nothing or garbage → the default.
function ns.LineCount(arg)
  local n = tonumber(arg)
  if not n then return ns.DEFAULT_LINES end
  n = math.floor(n)
  if n < 1 then return 1 end
  if n > ns.MAX_LINES then return ns.MAX_LINES end
  return n
end
