local _, ns = ...

-- English text is the key itself. Version 1.0 is English only.
ns.L = setmetatable({}, { __index = function(_, key) return key end })
