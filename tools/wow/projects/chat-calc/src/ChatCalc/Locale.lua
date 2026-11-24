local _, ns = ...

-- English text is the key itself; other languages override single keys.
--
-- Terms the game already has in the player's language come from the client's own GlobalStrings,
-- not from this file (each with the English letter as fallback for a client without it):
--   the coin letters in answers and messages (Core.lua ns.CoinSymbols): GOLD_AMOUNT_SYMBOL,
--   SILVER_AMOUNT_SYMBOL, COPPER_AMOUNT_SYMBOL (g, s, c; German G, S, K). They fill the %s after the
--   numbers below (12%s 50%s). Gold amounts with coin icons: GetMoneyString, the client's own display.
-- Game terms inside sentences are written as the German client names them: Gold, Silber, Kupfer
-- (GOLD_AMOUNT "%d Gold", SILVER_AMOUNT "%d Silber", COPPER_AMOUNT "%d Kupfer").
-- Numbers keep the decimal point in every language (1.5, 1,250.5): the calculator reads "1,5" as no
-- number, so the German texts say so.
-- Slash commands stay English: players type them as they are (/calc, /chatcalc, /calc help).
local L = setmetatable({}, { __index = function(_, key) return key end })
ns.L = L

local T = {}

T.deDE = {
  ["Chat Calc"] = "Chat Calc",
  -- help
  ["/calc 12%s 50%s * 3 counts in gold, silver and copper, /calc (5 + 3) ^ 2 works with plain numbers. You can use + - * / %% ^ and parentheses."] =
    "/calc 12%s 50%s * 3 rechnet mit Gold, Silber und Kupfer, /calc (5 + 3) ^ 2 mit einfachen Zahlen. Du kannst + - * / %% ^ und Klammern nutzen. Kommazahlen schreibst du mit Punkt: 1.5.",
  ["Type something to calculate, like /calc 12%s 50%s * 3."] = "Gib etwas zum Rechnen ein, zum Beispiel /calc 12%s 50%s * 3.",
  -- what went wrong
  ["\"%s\" is not a number. Write 1250.5 or 1,250.5."] =
    "„%s“ ist keine Zahl. Kommazahlen schreibst du mit Punkt (1250.5), das Komma trennt nur Tausender (1,250.5).",
  ["Unknown \"%s\". Use numbers, + - * / %% ^, parentheses and %s, %s, %s."] =
    "Unbekannt: „%s“. Nutze Zahlen, + - * / %% ^, Klammern und %s, %s, %s.",
  ["Unbalanced parentheses: there is a \")\" without a \"(\"."] = "Die Klammern passen nicht: Da steht eine „)“ ohne „(“.",
  ["Unbalanced parentheses: %d \")\" missing."] = "Die Klammern passen nicht: Es fehlt %d-mal „)“.",
  ["Too many parentheses inside each other (at most %d)."] = "Zu viele Klammern ineinander (höchstens %d).",
  ["This has no real result."] = "Das hat kein reelles Ergebnis.",
  ["The number is too large."] = "Die Zahl ist zu groß.",
  ["Gold and plain numbers cannot be added or subtracted: write 5%s, 5%s or 5%s."] =
    "Gold und einfache Zahlen lassen sich nicht addieren oder subtrahieren: Schreib 5%s, 5%s oder 5%s.",
  ["Gold cannot be multiplied by gold."] = "Gold lässt sich nicht mit Gold multiplizieren.",
  ["A plain number cannot be divided by gold."] = "Eine einfache Zahl lässt sich nicht durch Gold teilen.",
  ["Division by zero."] = "Division durch null.",
  ["Powers only work with plain numbers."] = "Potenzen gehen nur mit einfachen Zahlen.",
  ["Something is missing at the end."] = "Am Ende fehlt etwas.",
  ["Coins go from gold to copper, each once, like 12%s 50%s 3%s."] =
    "Schreib die Münzen von Gold bis Kupfer, jede nur einmal, zum Beispiel 12%s 50%s 3%s.",
  ["Add %s, %s or %s after %s."] = "Schreib %s, %s oder %s hinter %s.",
  ["\"%s\" needs a number in front of it, like 12%s."] = "Vor „%s“ fehlt eine Zahl, zum Beispiel 12%s.",
  ["Something is missing before \"%s\"."] = "Vor „%s“ fehlt etwas.",
  ["An operator is missing before \"%s\"."] = "Vor „%s“ fehlt ein Rechenzeichen.",
  ["That is too long: at most %d characters."] = "Das ist zu lang: höchstens %d Zeichen.",
  ["That could not be calculated."] = "Das ließ sich nicht berechnen.",
}

local own = GetLocale and T[GetLocale()]
if own then
  for key, text in pairs(own) do rawset(L, key, text) end
end
