-- Tests for Chat Calc, run by tools/wow/client/run.lua.

-- The stand-in client has no money formatting and no coin letters; these model them.
local STAND_IN = { "GetMoneyString", "GetCoinTextureString", "GOLD_AMOUNT_SYMBOL", "SILVER_AMOUNT_SYMBOL", "COPPER_AMOUNT_SYMBOL", "SendChatMessage", "RunScript", "loadstring" }
local game

-- g = { money = false } leaves GetMoneyString out, { symbols = {...} } sets the client's coin letters.
local function client(g)
  game = { money = true, coin = false, sent = {}, formatted = {} }
  GetMoneyString, GetCoinTextureString = nil, nil
  for k, v in pairs(g or {}) do game[k] = v end
  if game.money then
    GetMoneyString = function(copper, separate)
      table.insert(game.formatted, { copper, separate })
      if game.money == "broken" then error("broken") end
      return "<" .. copper .. (separate and ",sep" or "") .. ">"
    end
  end
  if game.coin then
    GetCoinTextureString = function(copper) return "[" .. copper .. "]" end
  end
  local symbols = game.symbols or { g = "g", s = "s", c = "c" }
  GOLD_AMOUNT_SYMBOL, SILVER_AMOUNT_SYMBOL, COPPER_AMOUNT_SYMBOL = symbols.g, symbols.s, symbols.c
  -- results must stay in the player's own chat window
  SendChatMessage = function(...) table.insert(game.sent, { ... }) end
end

local function boot(wow, g)
  client(g)
  local ns = wow.load(ADDON_DIR, ADDON_NAME)
  wow.fire("ADDON_LOADED", "ChatCalc")
  wow.fire("PLAYER_LOGIN")
  return ns
end

local function last(wow) return wow.chat[#wow.chat] end
local function has(text, pattern) return text ~= nil and text:find(pattern, 1, true) ~= nil end

-- value of an expression, failing the test when it is not calculated
local function calc(ns, text)
  local r, problem = ns.Evaluate(text)
  if not r then error("\"" .. text .. "\" failed: " .. tostring(problem), 2) end
  return r.v, r.gold
end

local function near(a, b, msg)
  if math.abs(a - b) > 1e-9 then error((msg or "") .. " expected " .. tostring(b) .. ", got " .. tostring(a), 2) end
end

-- the message of an expression that must not be calculated
local function problem(ns, text)
  local r, message = ns.Evaluate(text)
  if r then error("\"" .. text .. "\" should fail, gave " .. tostring(r.v), 2) end
  return message
end

test("addon defines only its own globals", function(wow, installed, before)
  boot(wow)
  wow.slash("/calc 12g 50s * 3")
  wow.slash("/calc 1/0")
  wow.slash("/chatcalc")
  local allowed = { SLASH_CHATCALC1 = true, SLASH_CHATCALC2 = true, SLASH_CHATCALC3 = true }
  for _, name in ipairs(STAND_IN) do installed[name] = true end
  for k in pairs(_G) do
    if not before[k] and not installed[k] and not allowed[k] then error("unexpected global " .. tostring(k)) end
  end
  eq(SlashCmdList.CHATCALC ~= nil, true)
end)

test("the four basic operations and the order of operations", function(wow)
  local ns = boot(wow)
  eq(calc(ns, "1 + 2"), 3)
  eq(calc(ns, "7 - 10"), -3)
  eq(calc(ns, "6 * 7"), 42)
  eq(calc(ns, "1 / 4"), 0.25)
  eq(calc(ns, "2 + 3 * 4"), 14)
  eq(calc(ns, "(2 + 3) * 4"), 20)
  eq(calc(ns, "10 - 4 - 3"), 3, "left to right")
  eq(calc(ns, "100 / 10 / 5"), 2, "left to right")
  eq(calc(ns, "2*3+4*5"), 26, "without spaces")
  eq(calc(ns, "  42  "), 42)
  eq(calc(ns, "((((7))))"), 7)
  eq(calc(ns, "3 x 4"), 12, "x means times")
  eq(calc(ns, "3X4"), 12)
  eq(calc(ns, "3 \195\151 4"), 12, "the multiplication sign")
  eq(calc(ns, "12 \195\183 4"), 3, "the division sign")
  eq(calc(ns, "5 + 5 ="), 10, "a trailing = is ignored")
end)

test("powers, signs and remainders", function(wow)
  local ns = boot(wow)
  eq(calc(ns, "2 ^ 10"), 1024)
  eq(calc(ns, "2 ^ 3 ^ 2"), 512, "right to left")
  eq(calc(ns, "-2 ^ 2"), -4, "the power binds tighter than the sign")
  eq(calc(ns, "(-2) ^ 2"), 4)
  eq(calc(ns, "2 ^ -1"), 0.5)
  eq(calc(ns, "9 ^ 0.5"), 3)
  eq(calc(ns, "2 * 3 ^ 2"), 18)
  eq(calc(ns, "-5"), -5)
  eq(calc(ns, "--5"), 5)
  eq(calc(ns, "+5"), 5)
  eq(calc(ns, "3 - -2"), 5)
  eq(calc(ns, "-(2 + 3)"), -5)
  eq(calc(ns, "17 % 5"), 2)
  eq(calc(ns, "-7 % 3"), 2, "the rest keeps the sign of the divisor")
  eq(calc(ns, "7 % -3"), -2)
  eq(calc(ns, "5.5 % 2"), 1.5)
  eq(calc(ns, "2 + 17 % 5 * 2"), 6, "% ranks with * and /")
end)

test("numbers: decimals and thousands separators", function(wow)
  local ns = boot(wow)
  eq(calc(ns, "1.5 * 2"), 3)
  eq(calc(ns, ".5 + .25"), 0.75)
  eq(calc(ns, "1,250,000 + 1"), 1250001)
  eq(calc(ns, "1,250.5 * 2"), 2501)
  eq(calc(ns, "007"), 7)
  eq(ns.ParseNumber("12"), 12)
  eq(ns.ParseNumber("0.125"), 0.125)
  eq(ns.ParseNumber("1,5"), nil, "a comma is no decimal point")
  eq(ns.ParseNumber("1,2345"), nil)
  eq(ns.ParseNumber(",500"), nil)
  eq(ns.ParseNumber("1234,567"), nil)
  eq(ns.ParseNumber("1.2.3"), nil)
  eq(ns.ParseNumber("5."), nil)
  eq(ns.ParseNumber("."), nil)
  eq(ns.ParseNumber("1.000,5"), nil)
  eq(has(problem(ns, "1,5 + 1"), "\"1,5\" is not a number"), true)
  eq(has(problem(ns, "1.2.3"), "\"1.2.3\" is not a number"), true)
end)

test("gold amounts are read as copper", function(wow)
  local ns = boot(wow)
  local v, gold = calc(ns, "12g 50s 3c")
  eq(v, 125003)
  eq(gold, true)
  eq(calc(ns, "1250000c"), 1250000)
  eq(calc(ns, "12g"), 120000)
  eq(calc(ns, "50s"), 5000)
  eq(calc(ns, "12g 3c"), 120003, "a coin may be left out")
  eq(calc(ns, "12g50s3c"), 125003, "without spaces")
  eq(calc(ns, "12 g 50 s"), 125000, "space before the letter")
  eq(calc(ns, "12G 50S 3C"), 125003, "capital letters")
  eq(calc(ns, "2 gold 5 silver 1 copper"), 20501, "whole words")
  eq(calc(ns, "1.5g"), 15000)
  eq(calc(ns, "1.1g"), 11000, "no binary crumbs")
  eq(calc(ns, "1,234g"), 12340000)
  eq(calc(ns, "0g 0s 0c"), 0)
  local _, plain = calc(ns, "12 + 3")
  eq(plain, nil, "plain numbers carry no unit")
end)

test("gold arithmetic follows sensible rules", function(wow)
  local ns = boot(wow)
  local v, gold = calc(ns, "12g 50s * 3")
  eq(v, 375000)
  eq(gold, true)
  eq(calc(ns, "3 * 12g 50s"), 375000, "the number may come first")
  eq(calc(ns, "100g - 37g 50s"), 625000)
  eq(calc(ns, "12g -50s"), 115000, "a minus between coins subtracts")
  eq(calc(ns, "100g / 4"), 250000)
  v, gold = calc(ns, "100g / 12g 50s")
  eq(v, 8)
  eq(gold, nil, "gold divided by gold is a plain ratio")
  v, gold = calc(ns, "10g % 3")
  eq(v, 1, "the copper left over when 10g is split three ways")
  eq(gold, true)
  eq(calc(ns, "10g % 3g"), 10000)
  eq(calc(ns, "-(5g)"), -50000)
  eq(calc(ns, "-12g 50s"), -125000, "the sign belongs to the whole amount")
  eq(calc(ns, "12g 50s / 2"), 62500)
  eq(calc(ns, "12g 50s x 2"), 250000)
  eq(calc(ns, "(1g + 1s) * 2"), 20200)
  eq(has(problem(ns, "12g + 5"), "Gold and plain numbers cannot be added"), true)
  eq(has(problem(ns, "5 - 12g"), "Gold and plain numbers cannot be added"), true)
  eq(has(problem(ns, "2g * 3g"), "Gold cannot be multiplied by gold"), true)
  eq(has(problem(ns, "10 / 2g"), "A plain number cannot be divided by gold"), true)
  eq(has(problem(ns, "10 % 2g"), "A plain number cannot be divided by gold"), true)
  eq(has(problem(ns, "2g ^ 2"), "Powers only work with plain numbers"), true)
  eq(has(problem(ns, "2 ^ 1g"), "Powers only work with plain numbers"), true)
end)

test("coins go from gold to copper, each once", function(wow)
  local ns = boot(wow)
  eq(has(problem(ns, "50s 12g"), "Coins go from gold to copper"), true)
  eq(has(problem(ns, "1g 2g"), "Coins go from gold to copper"), true)
  eq(has(problem(ns, "3c 3c"), "Coins go from gold to copper"), true)
  eq(has(problem(ns, "12g 50"), "Add g, s or c after 50."), true)
  eq(has(problem(ns, "g"), "\"g\" needs a number in front of it, like 12g."), true)
  eq(has(problem(ns, "5 * s"), "\"s\" needs a number in front of it"), true)
  eq(has(problem(ns, "(5)g"), "\"g\" needs a number in front of it"), true)
end)

test("the client's own coin letters work too", function(wow)
  local ns = boot(wow, { symbols = { g = "G", s = "S", c = "K" } })
  eq(calc(ns, "12g 50s 3k"), 125003, "the German copper letter")
  eq(calc(ns, "3c"), 3, "the English letters stay")
  ns = boot(wow, { symbols = { g = "po", s = "pa", c = "pc" } })
  eq(calc(ns, "2po 3pa 4pc"), 20304)
  ns = boot(wow, { symbols = { g = "x", s = "5", c = "|" } })
  eq(calc(ns, "2 x 3"), 6, "a letter that clashes is not taken")
  eq(ns.CoinWords()["|"], nil)
  eq(ns.CoinWords()["5"], nil)
end)

test("parentheses must be balanced", function(wow)
  local ns = boot(wow)
  eq(has(problem(ns, "(1 + 2"), "Unbalanced parentheses: 1 \")\" missing."), true)
  eq(has(problem(ns, "((1 + 2"), "Unbalanced parentheses: 2 \")\" missing."), true)
  eq(has(problem(ns, "1 + 2)"), "there is a \")\" without a \"(\""), true)
  eq(has(problem(ns, ")1 + 2("), "there is a \")\" without a \"(\""), true)
  eq(has(problem(ns, "()"), "Something is missing before \")\""), true)
  eq(calc(ns, string.rep("(", 30) .. "1" .. string.rep(")", 30)), 1)
  eq(has(problem(ns, string.rep("(", 31) .. "1" .. string.rep(")", 31)), "Too many parentheses inside each other (at most 30)."), true)
end)

test("broken expressions get a clear message", function(wow)
  local ns = boot(wow)
  eq(has(problem(ns, "5 +"), "Something is missing at the end."), true)
  eq(has(problem(ns, "5 * * 3"), "Something is missing before \"*\""), true)
  eq(has(problem(ns, "* 3"), "Something is missing before \"*\""), true)
  eq(has(problem(ns, "5 5"), "An operator is missing before \"5\""), true)
  eq(has(problem(ns, "2(3 + 4)"), "An operator is missing before \"(\""), true)
  eq(has(problem(ns, "(1)(2)"), "An operator is missing before \"(\""), true)
  eq(has(problem(ns, "5 + abc"), "Unknown \"abc\""), true)
  eq(has(problem(ns, "2 = 2"), "Unknown \"=\""), true)
  eq(has(problem(ns, "x"), "Something is missing before \"x\""), true)
  eq(has(problem(ns, ""), "Type something to calculate"), true)
  eq(has(problem(ns, "   "), "Type something to calculate"), true)
  eq(has(problem(ns, "="), "Type something to calculate"), true)
end)

test("division by zero, overflow and results that are no number", function(wow)
  local ns = boot(wow)
  eq(problem(ns, "1 / 0"), "Division by zero.")
  eq(problem(ns, "5 % 0"), "Division by zero.")
  eq(problem(ns, "1 / (2 - 2)"), "Division by zero.")
  eq(problem(ns, "10g / 0"), "Division by zero.")
  eq(problem(ns, "0 ^ -1"), "Division by zero.")
  eq(problem(ns, "10 ^ 16"), "The number is too large.")
  eq(problem(ns, "2 ^ 99999"), "The number is too large.")
  eq(problem(ns, "-(10 ^ 15) * 2"), "The number is too large.")
  eq(problem(ns, "99999999999999999999"), "The number is too large.")
  eq(problem(ns, "999999999999g"), "The number is too large.")
  eq(problem(ns, "(-8) ^ 0.5"), "This has no real result.")
  eq(calc(ns, "10 ^ 15"), 1e15, "the limit itself is fine")
  eq(calc(ns, "9999999g 99s 99c"), 99999999999, "the gold cap")
  eq(calc(ns, "0 ^ 0"), 1)
end)

test("long input is refused before it is read", function(wow)
  local ns = boot(wow)
  local long = string.rep("1+", 100) .. "1"
  eq(problem(ns, long), "That is too long: at most 200 characters.")
  eq(calc(ns, string.rep("1+", 99) .. "1"), 100, "199 characters are fine")
  eq(calc(ns, string.rep("-", 150) .. "1"), 1, "a long chain of signs does not overflow the stack")
end)

test("nothing typed is ever run as Lua code", function(wow)
  local ns = boot(wow)
  local ran = false
  RunScript = function() ran = true end
  local realLoadstring = loadstring
  loadstring = function(...) ran = true; return realLoadstring(...) end
  for _, text in ipairs({ "os.exit()", "print(1)", "1 + a", "_G", "1; 2", "[[1]]", "function() end", "#x", "1 .. 2" }) do
    eq(ns.Evaluate(text), nil, text)
  end
  eq(ran, false, "neither loadstring nor RunScript is called")
  loadstring = realLoadstring
end)

test("number texts", function(wow)
  local ns = boot(wow)
  eq(ns.FormatNumber(0), "0")
  eq(ns.FormatNumber(-0), "0")
  eq(ns.FormatNumber(42), "42")
  eq(ns.FormatNumber(1024), "1,024")
  eq(ns.FormatNumber(-1234567), "-1,234,567")
  eq(ns.FormatNumber(0.1 + 0.2), "0.3", "no binary crumbs")
  eq(ns.FormatNumber(1 / 3), "0.333333")
  eq(ns.FormatNumber(2 / 3), "0.666667")
  eq(ns.FormatNumber(1234.5), "1,234.5")
  eq(ns.FormatNumber(-0.0000001), "-1e-07")
  eq(ns.FormatNumber(-0.0000004999), "-5e-07")
  eq(ns.FormatNumber(1e15), "1,000,000,000,000,000")
end)

test("gold texts", function(wow)
  local ns = boot(wow)
  eq(ns.PlainMoney(0), "0c")
  eq(ns.PlainMoney(5), "5c")
  eq(ns.PlainMoney(105), "1s 5c")
  eq(ns.PlainMoney(375000), "37g 50s")
  eq(ns.PlainMoney(120003), "12g 3c")
  eq(ns.PlainMoney(123456789), "12,345g 67s 89c")
  eq(ns.PlainMoney(99999999999), "9,999,999g 99s 99c")
  eq(ns.PlainMoney(-10000), "-1g")
  eq(ns.RoundCopper(33333.5), 33334)
  eq(ns.RoundCopper(-2.5), -3, "rounded away from zero")
  eq(select(2, ns.RoundCopper(7)), false)
  eq(select(2, ns.RoundCopper(7.2)), true)
  eq(ns.RoundCopper(-0.2), 0)
end)

test("the game formats gold with coin icons, with a fallback", function(wow)
  local ns = boot(wow)
  eq(ns.FormatMoney(375000), "<375000,sep>", "GetMoneyString with thousands separators")
  eq(ns.FormatMoney(-375000), "-<375000,sep>", "the sign stays outside")
  eq(ns.FormatMoney(0), "0c", "zero is written out")
  ns = boot(wow, { money = false, coin = true })
  eq(ns.FormatMoney(120), "[120]", "GetCoinTextureString when GetMoneyString is missing")
  ns = boot(wow, { money = "broken", coin = true })
  eq(ns.FormatMoney(120), "[120]", "a failing GetMoneyString is skipped")
  ns = boot(wow, { money = false })
  eq(ns.FormatMoney(120003), "12g 3c", "plain text without the game's formatting")
end)

test("answers in chat: plain numbers and gold", function(wow)
  local ns = boot(wow, { money = false })
  wow.slash("/calc 2 ^ 10")
  eq(last(wow), "|cffffd100Chat Calc:|r 2 ^ 10 = 1,024")
  wow.slash("/calc 12g 50s * 3")
  eq(last(wow), "|cffffd100Chat Calc:|r 12g 50s * 3 = 37g 50s (37.5g, 375,000c)")
  wow.slash("/calc 10g / 3")
  eq(last(wow), "|cffffd100Chat Calc:|r 10g / 3 = ~3g 33s 33c (3.333333g, ~33,333c)", "rounded to whole copper")
  wow.slash("/chatcalc 100g / 12g 50s")
  eq(last(wow), "|cffffd100Chat Calc:|r 100g / 12g 50s = 8")
  wow.slash("/calc 5g - 7g =")
  eq(last(wow), "|cffffd100Chat Calc:|r 5g - 7g = -2g (-2g, -20,000c)")
  wow.slash("/calc 1250000c")
  eq(last(wow), "|cffffd100Chat Calc:|r 1250000c = 125g (125g, 1,250,000c)")
  ns = boot(wow)
  wow.slash("/calc 12g 50s * 3")
  eq(last(wow), "|cffffd100Chat Calc:|r 12g 50s * 3 = <375000,sep> (37.5g, 375,000c)", "with the game's coin icons")
end)

test("errors in chat show the input and the reason", function(wow)
  boot(wow)
  wow.slash("/calc 1 / 0")
  eq(last(wow), "|cffffd100Chat Calc:|r 1 / 0: |cffff6060Division by zero.|r")
  wow.slash("/calc (2 + 3")
  eq(has(last(wow), "(2 + 3: |cffff6060Unbalanced parentheses"), true)
  wow.slash("/calc " .. string.rep("9", 250))
  eq(has(last(wow), string.rep("9", 40) .. "...: |cffff6060That is too long"), true, "a long input is shortened")
end)

test("chat escape codes in the input are shown, never run", function(wow)
  boot(wow)
  wow.slash("/calc 5 + |cffff0000red")
  eq(has(last(wow), "5 + ||cffff0000red: "), true, "the input is escaped")
  eq(has(last(wow), "Unknown \"||cffff\""), true, "the word in the message too")
  wow.slash("/calc |Hitem:1234|h[Sword]|h")
  eq(has(last(wow), "||Hitem"), true)
  eq(last(wow):find("[^|]|H") == nil, true, "no single | left before H")
end)

test("help, and results only in the player's own chat window", function(wow)
  boot(wow)
  wow.slash("/calc")
  eq(has(last(wow), "/calc 12g 50s * 3 counts in gold, silver and copper"), true)
  eq(has(last(wow), "|cffffd100Chat Calc:|r /calc"), true)
  local count = #wow.chat
  wow.slash("/calc help")
  wow.slash("/calc ?")
  wow.slash("/calc HELP")
  eq(#wow.chat, count + 3)
  eq(has(last(wow), "/cc"), false)
  eq(last(wow):gsub("|c%x%x%x%x%x%x%x%x", ""):gsub("|r", ""):find("|", 1, true), nil, "help uses no | as a separator")
  wow.slash("/calc 12g * 3")
  wow.slash("/calc 1/0")
  eq(#game.sent, 0, "SendChatMessage is never called")
end)

test("the slash command works with every alias and odd spacing", function(wow)
  local ns = boot(wow, { money = false })
  eq(SLASH_CHATCALC1, "/calc")
  eq(SLASH_CHATCALC2, "/chatcalc")
  eq(SLASH_CHATCALC3, nil) -- /cc is the game's click casting command
  SlashCmdList.CHATCALC("   7*6   ")
  eq(last(wow), "|cffffd100Chat Calc:|r 7*6 = 42")
  SlashCmdList.CHATCALC(nil)
  eq(has(last(wow), "counts in gold"), true, "nil message shows the help")
  local r = ns.Calculate("2+2")
  eq(r.v, 4)
end)
