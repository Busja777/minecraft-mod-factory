local _, ns = ...

-- English text is the key itself. Version 1.0 is English only; other languages follow with updates.
-- The roll lines themselves are read with the game's own text (RANDOM_ROLL_RESULT, Core.lua), so
-- they are recognised in every client language already.
ns.L = setmetatable({}, { __index = function(_, key) return key end })
