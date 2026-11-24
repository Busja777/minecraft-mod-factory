local _, ns = ...
local L = ns.L

-- Pure arithmetic: no frames, no events. Everything here runs outside the game in the tests.
-- The input is never handed to loadstring or RunScript: it is read by the small parser below.
--
--   expression := term { ("+" | "-") term }
--   term       := unary { ("*" | "x" | "/" | "%") unary }
--   unary      := ("+" | "-") unary | power
--   power      := atom [ "^" unary ]                 (right to left: 2^3^2 = 2^9, -2^2 = -4)
--   atom       := number [ coin { number coin } ] | "(" expression ")"
--   number     := 12 | 12.5 | .5 | 1,250,000 | 1,250.75
--   coin       := g | s | c (also gold, silver, copper and the client's own coin letters)
--
-- A value is { v = number, gold = true|nil }. Amounts with coins are kept in copper; a plain number
-- has no unit. Gold and plain numbers only mix where it makes sense (12g * 3, 100g / 4, 100g / 12g).

ns.MAX_INPUT = 200        -- characters
ns.MAX_DEPTH = 30         -- parentheses inside each other
ns.MAX_VALUE = 1e15       -- far beyond the gold cap, still exact in Lua numbers

ns.COPPER = { g = 10000, gold = 10000, s = 100, silver = 100, c = 1, copper = 1 }

-- Words that mean "times" (the multiplication sign and "x").
local TIMES = { x = true, ["\195\151"] = true }
local DIVIDE = { ["\195\183"] = true }

local OPERATORS = { ["+"] = true, ["-"] = true, ["*"] = true, ["/"] = true, ["%"] = true, ["^"] = true, ["("] = true, [")"] = true }

-- The client's own coin letters (GOLD_AMOUNT_SYMBOL and friends) count as well, so "12k" works in
-- a German client. Anything that would clash with a word of the calculator is left out.
function ns.CoinWords()
  local words = {}
  for word, copper in pairs(ns.COPPER) do words[word] = copper end
  local own = { GOLD_AMOUNT_SYMBOL = 10000, SILVER_AMOUNT_SYMBOL = 100, COPPER_AMOUNT_SYMBOL = 1 }
  for name, copper in pairs(own) do
    local symbol = _G[name]
    if type(symbol) == "string" then
      symbol = symbol:lower()
      if symbol ~= "" and not TIMES[symbol] and not DIVIDE[symbol] and not words[symbol]
        and not symbol:find("[%s%d%.,%+%-%*/%%%^%(%)|]") then
        words[symbol] = copper
      end
    end
  end
  return words
end

-- Text the player typed, made safe to show in chat ("|" starts an escape sequence there).
function ns.Escape(text)
  return (tostring(text):gsub("|", "||"))
end

local function fail(message, ...)
  error({ message = select("#", ...) > 0 and string.format(message, ...) or message }, 0)
end

-- "1,250,000.5" → 1250000.5; nil for anything else ("1,5", "1.2.3", "5.", ".").
function ns.ParseNumber(text)
  local int, dot, frac = text:match("^([%d,]*)(%.?)(%d*)$")
  if not int then return nil end
  if int == "" and frac == "" then return nil end
  if dot == "." and frac == "" then return nil end
  if int:find(",", 1, true) then
    local rest = int:gsub("^%d%d?%d?", "", 1)
    if rest == int or rest == "" or rest:gsub(",%d%d%d", "") ~= "" then return nil end
    int = int:gsub(",", "")
  end
  return tonumber((int == "" and "0" or int) .. dot .. frac)
end

-- Splits the text into numbers, coins and operators.
function ns.Tokenize(text, coins)
  coins = coins or ns.CoinWords()
  local tokens, i, n = {}, 1, #text
  while i <= n do
    local ch = text:sub(i, i)
    if ch:find("%s") then
      i = i + 1
    elseif ch:find("[%d%.,]") then
      local run = text:match("^[%d%.,]+", i)
      local value = ns.ParseNumber(run)
      if not value then fail(L["\"%s\" is not a number. Write 1250.5 or 1,250.5."], ns.Escape(run)) end
      tokens[#tokens + 1] = { kind = "number", value = value, text = run }
      i = i + #run
    elseif OPERATORS[ch] then
      tokens[#tokens + 1] = { kind = "op", op = ch, text = ch }
      i = i + 1
    else
      local word = text:match("^[^%s%d%.,%+%-%*/%%%^%(%)]+", i)
      local lower = word:lower()
      if TIMES[lower] then
        tokens[#tokens + 1] = { kind = "op", op = "*", text = word }
      elseif DIVIDE[lower] then
        tokens[#tokens + 1] = { kind = "op", op = "/", text = word }
      elseif coins[lower] then
        tokens[#tokens + 1] = { kind = "coin", copper = coins[lower], text = word }
      else
        fail(L["Unknown \"%s\". Use numbers, + - * / %% ^, parentheses and g, s, c."], ns.Escape(word))
      end
      i = i + #word
    end
  end
  return tokens
end

-- Parentheses are counted before anything else, so the message names the real problem.
function ns.CheckParentheses(tokens)
  local open, deepest = 0, 0
  for _, t in ipairs(tokens) do
    if t.op == "(" then
      open = open + 1
      if open > deepest then deepest = open end
    elseif t.op == ")" then
      open = open - 1
      if open < 0 then fail(L["Unbalanced parentheses: there is a \")\" without a \"(\"."]) end
    end
  end
  if open > 0 then fail(L["Unbalanced parentheses: %d \")\" missing."], open) end
  if deepest > ns.MAX_DEPTH then fail(L["Too many parentheses inside each other (at most %d)."], ns.MAX_DEPTH) end
end

local function checked(v)
  if v ~= v then fail(L["This has no real result."]) end
  if v > ns.MAX_VALUE or v < -ns.MAX_VALUE then fail(L["The number is too large."]) end
  return v
end

local function value(v, gold)
  return { v = checked(v), gold = gold or nil }
end

-- The arithmetic, with the rules for gold.
function ns.Apply(op, a, b)
  if op == "+" or op == "-" then
    if a.gold ~= b.gold then fail(L["Gold and plain numbers cannot be added or subtracted: write 5g, 5s or 5c."]) end
    return value(op == "+" and a.v + b.v or a.v - b.v, a.gold)
  elseif op == "*" then
    if a.gold and b.gold then fail(L["Gold cannot be multiplied by gold."]) end
    return value(a.v * b.v, a.gold or b.gold)
  elseif op == "/" or op == "%" then
    if b.gold and not a.gold then fail(L["A plain number cannot be divided by gold."]) end
    if b.v == 0 then fail(L["Division by zero."]) end
    if op == "/" then
      -- gold / gold is a plain ratio, gold / number stays gold
      return value(a.v / b.v, a.gold and not b.gold)
    end
    -- the rest keeps the sign of the divisor, like Lua's own %
    return value(a.v - math.floor(a.v / b.v) * b.v, a.gold)
  elseif op == "^" then
    if a.gold or b.gold then fail(L["Powers only work with plain numbers."]) end
    if a.v == 0 and b.v < 0 then fail(L["Division by zero."]) end
    return value(a.v ^ b.v)
  end
end

-- Recursive descent over the tokens; every rule of the grammar above is one function.
local function Parser(tokens)
  local p = { pos = 1 }

  local function peek() return tokens[p.pos] end
  local function nextToken()
    local t = tokens[p.pos]
    p.pos = p.pos + 1
    return t
  end
  local function isOp(t, ops) return t and t.kind == "op" and ops[t.op] end

  local expression

  local function atom()
    local t = nextToken()
    if not t then fail(L["Something is missing at the end."]) end
    if t.kind == "number" then
      if not (peek() and peek().kind == "coin") then return value(t.value) end
      -- 12g 50s 3c: coins from gold to copper, each once
      local copper, last = 0, nil
      while true do
        local coin = nextToken()
        if last and coin.copper >= last then fail(L["Coins go from gold to copper, each once, like 12g 50s 3c."]) end
        copper = checked(copper + t.value * coin.copper)
        last = coin.copper
        local after, second = peek(), tokens[p.pos + 1]
        if not (after and after.kind == "number") then break end
        if not (second and second.kind == "coin") then
          fail(L["Add g, s or c after %s."], ns.Escape(after.text))
        end
        t = nextToken()
      end
      -- 1.1g is 11000.000000000002 in binary; amounts typed by a player are whole hundredths of copper
      local whole = math.floor(copper * 100 + 0.5) / 100
      if math.abs(copper - whole) < 1e-6 then copper = whole end
      return value(copper, true)
    elseif t.kind == "coin" then
      fail(L["\"%s\" needs a number in front of it, like 12%s."], ns.Escape(t.text), ns.Escape(t.text))
    elseif t.op == "(" then
      local inner = expression()
      nextToken() -- the ")" (CheckParentheses made sure it is there)
      return inner
    end
    fail(L["Something is missing before \"%s\"."], ns.Escape(t.text))
  end

  local unary

  local function power()
    local base = atom()
    if isOp(peek(), { ["^"] = true }) then
      nextToken()
      return ns.Apply("^", base, unary())
    end
    return base
  end

  function unary()
    local t = peek()
    if isOp(t, { ["+"] = true, ["-"] = true }) then
      nextToken()
      local v = unary()
      return t.op == "-" and value(-v.v, v.gold) or v
    end
    return power()
  end

  local function term()
    local left = unary()
    while isOp(peek(), { ["*"] = true, ["/"] = true, ["%"] = true }) do
      local op = nextToken().op
      left = ns.Apply(op, left, unary())
    end
    return left
  end

  function expression()
    local left = term()
    while isOp(peek(), { ["+"] = true, ["-"] = true }) do
      local op = nextToken().op
      left = ns.Apply(op, left, term())
    end
    return left
  end

  function p.run()
    local result = expression()
    local rest = peek()
    if rest then
      if rest.kind == "coin" then
        fail(L["\"%s\" needs a number in front of it, like 12%s."], ns.Escape(rest.text), ns.Escape(rest.text))
      end
      if rest.kind == "op" and rest.op ~= "(" then fail(L["Something is missing before \"%s\"."], ns.Escape(rest.text)) end
      fail(L["An operator is missing before \"%s\"."], ns.Escape(rest.text))
    end
    return result
  end

  return p
end

-- Text → value table, or nil and a message for the player.
function ns.Evaluate(text, coins)
  text = strtrim(text or "")
  text = text:gsub("=%s*$", "")
  if text == "" then return nil, L["Type something to calculate, like /calc 12g 50s * 3."] end
  if #text > ns.MAX_INPUT then return nil, string.format(L["That is too long: at most %d characters."], ns.MAX_INPUT) end
  local ok, result = pcall(function()
    local tokens = ns.Tokenize(text, coins)
    if #tokens == 0 then fail(L["Type something to calculate, like /calc 12g 50s * 3."]) end
    ns.CheckParentheses(tokens)
    return Parser(tokens).run()
  end)
  if ok then
    if result.v == 0 then result.v = 0 end -- no "-0"
    return result
  end
  if type(result) == "table" and result.message then return nil, result.message end
  -- a stack overflow or anything unforeseen must not throw a Lua error at the player
  return nil, L["That could not be calculated."]
end

local function thousands(digits)
  local out = digits:reverse():gsub("(%d%d%d)", "%1,"):reverse()
  return (out:gsub("^,", ""))
end

-- 1234567.5 → "1,234,567.5"; up to six decimals, trailing zeros dropped.
function ns.FormatNumber(n)
  if n ~= n then return "?" end
  local a = math.abs(n)
  if a ~= 0 and a < 0.0000005 then return string.format("%.3g", n) end
  local text = string.format("%.6f", a)
  local int, frac = text:match("^(%d+)%.(%d+)$")
  frac = frac:gsub("0+$", "")
  local out = thousands(int) .. (frac ~= "" and ("." .. frac) or "")
  if n < 0 and out ~= "0" then out = "-" .. out end
  return out
end

-- Copper rounded to a whole coin, away from zero; the second value says whether it was rounded.
function ns.RoundCopper(copper)
  local a = math.floor(math.abs(copper) + 0.5)
  local rounded = copper < 0 and -a or a
  if rounded == 0 then rounded = 0 end
  return rounded, rounded ~= copper
end

-- 375003 → "37g 50s 3c": zero coins are left out, 0 is "0c".
function ns.PlainMoney(copper)
  local sign = copper < 0 and "-" or ""
  copper = math.abs(copper)
  local g = math.floor(copper / 10000)
  local s = math.floor(copper / 100) % 100
  local c = copper % 100
  local parts = {}
  if g > 0 then parts[#parts + 1] = thousands(string.format("%.0f", g)) .. "g" end
  if s > 0 then parts[#parts + 1] = s .. "s" end
  if c > 0 or #parts == 0 then parts[#parts + 1] = c .. "c" end
  return sign .. table.concat(parts, " ")
end

-- Whole copper as the game shows money (coin icons), with the plain text as fallback.
function ns.FormatMoney(copper)
  local abs = math.abs(copper)
  if abs > 0 then
    local ok, text = false, nil
    if GetMoneyString then
      ok, text = pcall(GetMoneyString, abs, true) -- true: thousands separators
    end
    if not (ok and type(text) == "string" and text ~= "") and GetCoinTextureString then
      ok, text = pcall(GetCoinTextureString, abs)
    end
    if ok and type(text) == "string" and text ~= "" then
      return copper < 0 and ("-" .. text) or text
    end
  end
  return ns.PlainMoney(copper)
end

-- The answer line: "12g 50s * 3 = 37g 50s (37.5g, 375,000c)" or "2 ^ 10 = 1,024".
function ns.ResultText(input, result)
  local shown = ns.Escape(strtrim((strtrim(input or ""):gsub("=%s*$", ""))))
  if not result.gold then
    return string.format("%s = %s", shown, ns.FormatNumber(result.v))
  end
  local copper, rounded = ns.RoundCopper(result.v)
  local money = ns.FormatMoney(copper)
  if rounded then money = "~" .. money end
  return string.format("%s = %s (%sg, %sc)", shown, money, ns.FormatNumber(result.v / 10000),
    (rounded and "~" or "") .. ns.FormatNumber(copper))
end
