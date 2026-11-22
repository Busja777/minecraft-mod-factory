local _, ns = ...

-- English text is the key itself; other languages can override single keys in a later version.
ns.L = setmetatable({}, { __index = function(_, key) return key end })
