local _, ns = ...

-- English text is the key itself; other languages override single keys (none yet in 1.0).
-- The loot lines in chat are read with the client's own GlobalStrings (Core.lua ns.SELF_LOOT:
-- LOOT_ITEM_SELF and LOOT_ITEM_SELF_MULTIPLE), so a German client's "Ihr erhaltet Beute: %s" is
-- understood as well. Item links and achievement names come from the game in the client's language.
ns.L = setmetatable({}, { __index = function(_, key) return key end })
