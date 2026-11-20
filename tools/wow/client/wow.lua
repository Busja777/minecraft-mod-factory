-- A small stand-in for the World of Warcraft client, so the addon runs outside the game.
-- Only what the addon touches is modelled; any other widget method is accepted and does nothing.
local M = {}

local frames = {}
M.frames = frames
M.clock = 1000        -- GetTime()
M.now = os.time({ year = 2026, month = 11, day = 20, hour = 18 }) -- time()
M.money = 0
M.chat = {}

local widget
local function newWidget(kind, name)
  local w = { kind = kind, name = name, scripts = {}, events = {}, shown = true, enabled = true, text = nil, children = {} }
  return setmetatable(w, { __index = function(_, key) return widget[key] or function() end end })
end

widget = {
  SetScript = function(self, script, fn) self.scripts[script] = fn end,
  GetScript = function(self, script) return self.scripts[script] end,
  RegisterEvent = function(self, event) self.events[event] = true end,
  UnregisterEvent = function(self, event) self.events[event] = nil end,
  Show = function(self)
    local was = self.shown
    self.shown = true
    if not was and self.scripts.OnShow then self.scripts.OnShow(self) end
  end,
  Hide = function(self) self.shown = false end,
  IsShown = function(self) return self.shown end,
  SetShown = function(self, v) if v then self:Show() else self:Hide() end end,
  Enable = function(self) self.enabled = true end,
  Disable = function(self) self.enabled = false end,
  IsEnabled = function(self) return self.enabled end,
  SetText = function(self, t) self.text = t end,
  GetText = function(self) return self.text end,
  SetPoint = function(self, ...) self.point = { ... } end,
  GetPoint = function(self)
    local p = self.point or { "CENTER" }
    if type(p[2]) == "table" then return p[1], p[2], p[3], p[4], p[5] end
    return p[1], nil, p[1], p[2] or 0, p[3] or 0
  end,
  CreateFontString = function(self)
    local fs = newWidget("FontString")
    table.insert(self.children, fs)
    return fs
  end,
  CreateTexture = function(self)
    local t = newWidget("Texture")
    table.insert(self.children, t)
    return t
  end,
  Click = function(self) if self.scripts.OnClick then self.scripts.OnClick(self, "LeftButton") end end,
}

function M.install(env)
  env = env or _G
  env.CreateFrame = function(kind, name, parent, template)
    local f = newWidget(kind, name)
    f.template = template
    table.insert(frames, f)
    if name then env[name] = f end
    if parent and parent.children then table.insert(parent.children, f) end
    return f
  end
  env.UIParent = newWidget("Frame", "UIParent")
  env.UISpecialFrames = {}
  env.DEFAULT_CHAT_FRAME = { AddMessage = function(_, msg) table.insert(M.chat, msg) end }
  env.SlashCmdList = {}
  M.tooltip = {}
  env.GameTooltip = {
    SetOwner = function(_, owner) M.tooltip = { owner = owner, lines = {}, shown = false } end,
    AddLine = function(_, t) table.insert(M.tooltip.lines, t) end,
    AddDoubleLine = function(_, a, b) table.insert(M.tooltip.lines, a .. " = " .. b) end,
    Show = function() M.tooltip.shown = true end,
    Hide = function() M.tooltip.shown = false end,
  }
  env.GetTime = function() return M.clock end
  env.time = function(t) if t then return os.time(t) end return M.now end
  env.date = os.date
  env.GetMoney = function() return M.money end
  env.UnitName = function() return M.player or "Yubi" end
  env.GetRealmName = function() return M.realm or "Silvermoon" end
  env.UnitClass = function() return "Mage", M.class or "MAGE" end
  env.GetLocale = function() return M.locale or "enUS" end
  env.strtrim = function(s) return (s:gsub("^%s+", ""):gsub("%s+$", "")) end
  env.issecretvalue = function(v) return type(v) == "table" and v.secret == true end
  env.Enum = { PlayerInteractionType = { Merchant = 5, TaxiNode = 6, Trainer = 7, Banker = 8, GuildBanker = 10, MailInfo = 17, Auctioneer = 21, TradePartner = 1, AccountBanker = 68 } }
  env.RAID_CLASS_COLORS = { MAGE = { colorStr = "ff3fc7eb" }, WARRIOR = { colorStr = "ffc69b6d" } }
  local hooks = {}
  M.hooks = hooks
  env.RepairAllItems = function() end
  env.C_Bank = { PurchaseBankTab = function() end }
  env.hooksecurefunc = function(a, b, c)
    local tbl, name, fn = env, a, b
    if type(a) == "table" then tbl, name, fn = a, b, c end
    local original = tbl[name]
    tbl[name] = function(...)
      local r = { original(...) }
      fn(...)
      return unpack(r)
    end
    hooks[name] = true
  end
end

-- Loads the addon the way the client does: every file of the TOC gets (addonName, namespace).
function M.load(dir, name)
  local ns = {}
  local files = {}
  for line in io.lines(dir .. "/" .. name .. ".toc") do
    if line:match("^[^#%s].*%.lua%s*$") then files[#files + 1] = line:gsub("%s+$", "") end
  end
  for _, file in ipairs(files) do
    local chunk = assert(loadfile(dir .. "/" .. file))
    chunk(name, ns)
  end
  M.ns = ns
  return ns, files
end

function M.fire(event, ...)
  for _, f in ipairs(frames) do
    if f.events[event] and f.scripts.OnEvent then f.scripts.OnEvent(f, event, ...) end
  end
end

function M.setMoney(copper)
  M.money = copper
  M.fire("PLAYER_MONEY")
end

function M.slash(text)
  local cmd, rest = text:match("^(/%S+)%s*(.*)$")
  for key, fn in pairs(_G.SlashCmdList) do
    for i = 1, 9 do
      local alias = _G["SLASH_" .. key .. i]
      if not alias then break end
      if alias == cmd then return fn(rest) end
    end
  end
  error("unknown slash command " .. cmd)
end

return M
