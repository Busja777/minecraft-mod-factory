local _, ns = ...

-- Watches the player's money and the windows that explain a change (vendor, mail, quests ...).

ns.ctx = { open = {}, closedAt = {} }
ns.session = { bucket = ns.NewBucket(), start = nil }

local lastMoney
local lastChange -- { cat, diff, at, day } of the latest booking, so a late event can re-book it

-- Classic window events. Registered one by one: an event a client does not know is skipped.
local WINDOW_EVENTS = {
  MERCHANT_SHOW = { "vendor", true }, MERCHANT_CLOSED = { "vendor", false },
  MAIL_SHOW = { "mail", true }, MAIL_CLOSED = { "mail", false },
  AUCTION_HOUSE_SHOW = { "auction", true }, AUCTION_HOUSE_CLOSED = { "auction", false },
  TAXIMAP_OPENED = { "travel", true }, TAXIMAP_CLOSED = { "travel", false },
  TRAINER_SHOW = { "trainer", true }, TRAINER_CLOSED = { "trainer", false },
  TRADE_SHOW = { "trade", true }, TRADE_CLOSED = { "trade", false },
  BANKFRAME_OPENED = { "bank", true }, BANKFRAME_CLOSED = { "bank", false },
  GUILDBANKFRAME_OPENED = { "guildbank", true }, GUILDBANKFRAME_CLOSED = { "guildbank", false },
  BARBER_SHOP_OPEN = { "appearance", true }, BARBER_SHOP_CLOSE = { "appearance", false },
  TRANSMOGRIFY_OPEN = { "appearance", true }, TRANSMOGRIFY_CLOSE = { "appearance", false },
  QUEST_COMPLETE = { "quests", true }, QUEST_FINISHED = { "quests", false },
  LOOT_OPENED = { "loot", true }, LOOT_CLOSED = { "loot", false },
}

-- Newer clients report most NPC windows through one pair of events with an interaction type.
local INTERACTION = {}
if Enum and Enum.PlayerInteractionType then
  local names = {
    Merchant = "vendor", MailInfo = "mail", Auctioneer = "auction", TaxiNode = "travel",
    Trainer = "trainer", TradePartner = "trade", Banker = "bank", AccountBanker = "bank",
    CharacterBanker = "bank", GuildBanker = "guildbank", BarbersChoice = "appearance",
    Transmogrifier = "appearance",
  }
  for name, cat in pairs(names) do
    local id = Enum.PlayerInteractionType[name]
    if id then INTERACTION[id] = cat end
  end
end

local function setOpen(cat, isOpen)
  if isOpen then
    ns.ctx.open[cat] = true
  else
    ns.ctx.open[cat] = nil
    ns.ctx.closedAt[cat] = GetTime()
  end
end

function ns.CharKey()
  return (UnitName("player") or "?") .. "-" .. (GetRealmName() or "?")
end

local function today()
  local key = ns.DayKey(time())
  local day = ns.char.days[key]
  if not day then
    day = ns.NewBucket()
    ns.char.days[key] = day
  end
  return day, key
end

function ns.Book(cat, diff)
  ns.Add(ns.session.bucket, cat, diff)
  local day, key = today()
  ns.Add(day, cat, diff)
  lastChange = { cat = cat, diff = diff, at = GetTime(), day = key }
end

local function onMoney()
  if not ns.char then return end
  local money = GetMoney()
  if ns.IsSecret(money) then return end
  ns.char.money = money
  if not lastMoney then lastMoney = money return end
  local diff = money - lastMoney
  lastMoney = money
  if diff == 0 then return end
  ns.Book(ns.Classify(ns.ctx, diff, GetTime()), diff)
  if ns.Refresh then ns.Refresh() end
end

-- The reward of a quest can arrive just before or just after this event.
local function onQuestTurnedIn(_, _, moneyReward)
  if not moneyReward or ns.IsSecret(moneyReward) or moneyReward <= 0 then return end
  local now = GetTime()
  local c = lastChange
  if c and c.cat ~= "quests" and c.diff == moneyReward and now - c.at <= ns.GRACE then
    ns.Move(ns.session.bucket, c.cat, "quests", c.diff)
    local day = ns.char.days[c.day]
    if day then ns.Move(day, c.cat, "quests", c.diff) end
    c.cat = "quests"
    if ns.Refresh then ns.Refresh() end
  else
    ns.ctx.forced = { cat = "quests", at = now, sign = 1, amount = moneyReward }
  end
end

local function forceNext(cat, sign)
  return function() ns.ctx.forced = { cat = cat, at = GetTime(), sign = sign } end
end

local function onLogin()
  GoldDiaryDB = GoldDiaryDB or {}
  local db = GoldDiaryDB
  db.version = 1
  db.chars = db.chars or {}
  db.settings = db.settings or {}
  ns.db = db

  local key = ns.CharKey()
  local char = db.chars[key] or { days = {} }
  db.chars[key] = char
  local _, classFile = UnitClass("player")
  char.class = classFile
  ns.char = char
  ns.Prune(char.days, time())

  lastMoney = GetMoney()
  if ns.IsSecret(lastMoney) then lastMoney = nil else char.money = lastMoney end
  ns.session.start = GetTime()
  ns.session.startMoney = lastMoney
  if ns.OnLogin then ns.OnLogin() end
end

local frame = CreateFrame("Frame")
ns.eventFrame = frame

frame:SetScript("OnEvent", function(_, event, ...)
  if event == "PLAYER_LOGIN" then
    onLogin()
  elseif event == "PLAYER_MONEY" then
    onMoney()
  elseif event == "QUEST_TURNED_IN" then
    onQuestTurnedIn(...)
  elseif event == "PLAYER_INTERACTION_MANAGER_FRAME_SHOW" or event == "PLAYER_INTERACTION_MANAGER_FRAME_HIDE" then
    local cat = INTERACTION[(...)]
    if cat then setOpen(cat, event == "PLAYER_INTERACTION_MANAGER_FRAME_SHOW") end
  else
    local w = WINDOW_EVENTS[event]
    if w then setOpen(w[1], w[2]) end
  end
end)

local function listen(event)
  pcall(frame.RegisterEvent, frame, event)
end

listen("PLAYER_LOGIN")
listen("PLAYER_MONEY")
listen("QUEST_TURNED_IN")
listen("PLAYER_INTERACTION_MANAGER_FRAME_SHOW")
listen("PLAYER_INTERACTION_MANAGER_FRAME_HIDE")
for event in pairs(WINDOW_EVENTS) do listen(event) end

local forceRepair = forceNext("repairs", -1)
if RepairAllItems then
  hooksecurefunc("RepairAllItems", function(fromGuildBank)
    if not fromGuildBank then forceRepair() end -- the guild pays, the player's money stays
  end)
end
if C_Bank and C_Bank.PurchaseBankTab then hooksecurefunc(C_Bank, "PurchaseBankTab", forceNext("other", -1)) end
