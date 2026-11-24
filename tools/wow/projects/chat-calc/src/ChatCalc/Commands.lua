local _, ns = ...
local L = ns.L

-- /calc <expression> answers in your own chat window. Nothing is ever sent to other players.

function ns.Print(msg)
  DEFAULT_CHAT_FRAME:AddMessage("|cffffd100" .. L["Chat Calc"] .. ":|r " .. msg)
end

local function help()
  local sym = ns.CoinSymbols()
  ns.Print(string.format(L["/calc 12%s 50%s * 3 counts in gold, silver and copper, /calc (5 + 3) ^ 2 works with plain numbers. You can use + - * / %% ^ and parentheses."], sym.g, sym.s))
end

function ns.Calculate(msg)
  local input = strtrim(msg or "")
  local lower = input:lower()
  if input == "" or lower == "help" or lower == "?" then
    help()
    return
  end
  local result, problem = ns.Evaluate(input)
  if result then
    ns.Print(ns.ResultText(input, result))
  else
    if #input > ns.MAX_INPUT then input = input:sub(1, 40) .. "..." end
    ns.Print(ns.Escape(input) .. ": |cffff6060" .. problem .. "|r")
  end
  return result
end

SLASH_CHATCALC1 = "/calc"
SLASH_CHATCALC2 = "/chatcalc"
SlashCmdList.CHATCALC = function(msg)
  ns.Calculate(msg)
end
