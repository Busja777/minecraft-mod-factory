local _, ns = ...

-- English only for 1.0: the English text is the key itself.
ns.L = setmetatable({}, { __index = function(_, key) return key end })
