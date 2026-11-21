local _, ns = ...

-- 1.1: hovering a destination on the flight map shows how long the flight from here takes.
-- The game has two flight maps: the older one (TaxiFrame, buttons with the node's slot as ID)
-- and the newer one (FlightMapFrame, pins that carry taxiNodeData). Both are handled, each guarded.

-- Adds the line for the node at `index` (or named `name`). Returns true when a line was added.
local function addLine(tip, index, name)
  if not ns.routes then return false end
  local key = ns.RouteToNode(index, name)
  if not key then return false end
  local known = ns.Seconds(ns.routes, key)
  if not known then
    -- "not timed yet" only for places the player can fly to from here
    local kind = TaxiNodeGetType and type(index) == "number" and TaxiNodeGetType(index)
    if ns.IsSecret(kind) or kind ~= "REACHABLE" then return false end
    tip:AddLine(ns.TooltipText(nil), 0.6, 0.6, 0.6)
  else
    tip:AddLine(ns.TooltipText(known), 1, 1, 1)
  end
  return true
end

-- Older flight map: the game builds the tooltip in TaxiNodeOnButtonEnter(button).
local oldMapHooked = false
local function hookOldMap()
  if oldMapHooked or not TaxiNodeOnButtonEnter or not GameTooltip then return end
  oldMapHooked = true
  hooksecurefunc("TaxiNodeOnButtonEnter", function(button)
    if type(button) ~= "table" or not button.GetID then return end
    if addLine(GameTooltip, button:GetID()) then GameTooltip:Show() end
  end)
end

-- Newer flight map: its pins fill the tooltip themselves, so the line is added when the tooltip
-- shows while the flight map is open and its owner is a flight point pin.
local added -- { owner, lines } of the tooltip that already has the line, until it is cleared
local busy = false
local function onTooltipShow(tip)
  if busy or not ns.FlightMapOpen() then return end -- every other tooltip of the game is left alone
  local owner = tip.GetOwner and tip:GetOwner()
  local node = type(owner) == "table" and owner.taxiNodeData
  if type(node) ~= "table" then return end
  local lines = tip.NumLines and tip:NumLines()
  if added and added.owner == owner and added.lines == lines then return end -- shown again, line is there
  if not addLine(tip, node.slotIndex, node.name) then return end
  added = { owner = owner, lines = tip.NumLines and tip:NumLines() }
  busy = true
  tip:Show() -- fits the tooltip around the new line
  busy = false
end

if GameTooltip then
  hooksecurefunc(GameTooltip, "Show", onTooltipShow)
  if GameTooltip.HookScript then
    pcall(GameTooltip.HookScript, GameTooltip, "OnTooltipCleared", function() added = nil end)
  end
end
hookOldMap()

-- The older flight map may come in a part of the game that loads later.
local loader = CreateFrame("Frame")
loader:SetScript("OnEvent", hookOldMap)
pcall(loader.RegisterEvent, loader, "ADDON_LOADED")
