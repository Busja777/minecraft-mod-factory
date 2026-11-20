local _, ns = ...

-- English text is the key itself; other languages override single keys.
ns.L = setmetatable({}, { __index = function(_, key) return key end })
