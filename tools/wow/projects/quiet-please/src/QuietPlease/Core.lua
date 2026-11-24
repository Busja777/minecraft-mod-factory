local _, ns = ...

-- Pure list keeping: no frames, no events. Everything here runs outside the game in the tests.
--
-- ids = { [fileID] = true | "label" }: the sound files the player wants muted, shared by all
--       characters of the account. A label is the player's own reminder of what the file is.

ns.MAX_ID = 2147483647 -- file IDs are positive 32-bit numbers
ns.MAX_LABEL = 60      -- characters of a label
ns.PER_LINE = 8        -- file IDs per chat line in /quiet list

-- Sound categories the game itself can switch off (settings saved by the game, not by the addon).
-- key is the word after /quiet; TOGGLE_LABEL is the text shown in chat.
ns.TOGGLES = {
  { key = "errors", cvar = "Sound_EnableErrorSpeech" },
  { key = "emotes", cvar = "Sound_EnableEmoteSounds" },
  { key = "pets", cvar = "Sound_EnablePetSounds" },
}
ns.TOGGLE_LABEL = {
  errors = "Error speech", emotes = "Emote sounds", pets = "Pet sounds",
}

function ns.FindToggle(key)
  for _, t in ipairs(ns.TOGGLES) do
    if t.key == key then return t end
  end
  return nil
end

-- One file ID from typed text: digits only, greater than zero, not larger than MAX_ID.
function ns.ParseID(token)
  if type(token) ~= "string" or not token:match("^%d+$") or #token > 10 then return nil end
  local n = tonumber(token)
  if not n or n < 1 or n > ns.MAX_ID then return nil end
  return n
end

-- "123 456, 789" -> { 123, 456, 789 }, { bad tokens }. Duplicates are listed once, in typed order.
function ns.ParseIDs(text)
  local ids, bad, seen = {}, {}, {}
  for token in tostring(text or ""):gmatch("[^%s,;]+") do
    local id = ns.ParseID(token)
    if not id then
      bad[#bad + 1] = token
    elseif not seen[id] then
      seen[id] = true
      ids[#ids + 1] = id
    end
  end
  return ids, bad
end

-- Adds file IDs to the list. Returns the new ones and the ones already on it.
function ns.AddIDs(list, ids)
  local added, known = {}, {}
  for _, id in ipairs(ids) do
    if list[id] then
      known[#known + 1] = id
    else
      list[id] = true
      added[#added + 1] = id
    end
  end
  return added, known
end

-- Removes file IDs from the list. Returns the removed ones and the ones that were not on it.
function ns.RemoveIDs(list, ids)
  local removed, missing = {}, {}
  for _, id in ipairs(ids) do
    if list[id] then
      list[id] = nil
      removed[#removed + 1] = id
    else
      missing[#missing + 1] = id
    end
  end
  return removed, missing
end

-- A label as it is stored: trimmed, no colour or link codes, at most MAX_LABEL characters; nil when empty.
function ns.CleanLabel(text)
  if type(text) ~= "string" then return nil end
  local s = text:gsub("|c%x%x%x%x%x%x%x%x", ""):gsub("|r", ""):gsub("|", ""):gsub("%s+", " "):gsub("^ ", ""):gsub(" $", "")
  if s == "" then return nil end
  if #s > ns.MAX_LABEL then s = s:sub(1, ns.MAX_LABEL):gsub(" $", "") end
  return s
end

-- Sets or (without text) clears the label of a file ID on the list. Returns the stored label, or false
-- when the ID is not on the list.
function ns.SetLabel(list, id, text)
  if not list[id] then return false end
  local label = ns.CleanLabel(text)
  list[id] = label or true
  return label
end

function ns.Count(list)
  local n = 0
  for _ in pairs(list) do n = n + 1 end
  return n
end

-- File IDs of the list in ascending order.
function ns.Sorted(list)
  local out = {}
  for id in pairs(list) do
    if type(id) == "number" then out[#out + 1] = id end
  end
  table.sort(out)
  return out
end

-- Chat lines for /quiet list: every labelled ID on its own line ("123 - label"), the others
-- grouped PER_LINE to a line ("1, 2, 3").
function ns.ListLines(list, perLine)
  perLine = perLine or ns.PER_LINE
  local lines, group = {}, {}
  local function flush()
    if #group > 0 then
      lines[#lines + 1] = table.concat(group, ", ")
      group = {}
    end
  end
  for _, id in ipairs(ns.Sorted(list)) do
    local label = list[id]
    if type(label) == "string" then
      flush()
      lines[#lines + 1] = id .. " - " .. label
    else
      group[#group + 1] = tostring(id)
      if #group >= perLine then flush() end
    end
  end
  flush()
  return lines
end

-- Keeps only valid entries of a saved list (a hand-edited or damaged file must not break the login).
function ns.CleanList(list)
  local clean = {}
  if type(list) ~= "table" then return clean end
  for id, value in pairs(list) do
    local n = type(id) == "number" and id or ns.ParseID(id)
    if n and n == math.floor(n) and n >= 1 and n <= ns.MAX_ID then
      clean[n] = type(value) == "string" and ns.CleanLabel(value) or true
    end
  end
  return clean
end

function ns.Join(ids)
  local parts = {}
  for i, id in ipairs(ids) do parts[i] = tostring(id) end
  return table.concat(parts, ", ")
end
