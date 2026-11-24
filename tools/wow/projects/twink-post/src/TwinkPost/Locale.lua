local _, ns = ...

-- English text is the key itself. Version 1.0 is English only; game terms (level, faction names)
-- come from the client's own GlobalStrings, see ns.GameText in Core.lua.
ns.L = setmetatable({}, { __index = function(_, key) return key end })
