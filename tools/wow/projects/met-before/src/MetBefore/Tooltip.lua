local _, ns = ...

-- Adds "Met before: 3 times, last 2 days ago" and your note to the tooltip of a player.
-- Nothing is added when the unit, its name or realm is secret, or when it is not a player.

local MET_COLOR = { 0.6, 0.8, 1 }
local NOTE_COLOR = { 1, 0.82, 0 }

function ns.OnUnitTooltip(tooltip)
  if not ns.db or type(tooltip) ~= "table" or not tooltip.GetUnit or not tooltip.AddLine then return end
  local ok, _, unit = pcall(tooltip.GetUnit, tooltip)
  if not ok then return end
  local name, realm = ns.UnitPlayer(unit)
  if not name then return end
  local key = ns.Key(name, realm, ns.HomeRealm())
  local p = key and ns.db.people[key]
  if not p then return end
  local now = ns.Read(time)
  if type(now) ~= "number" then return end
  local met, note = ns.TooltipLines(p, now)
  if not met and not note then return end
  if met then tooltip:AddLine(met, MET_COLOR[1], MET_COLOR[2], MET_COLOR[3]) end
  if note then tooltip:AddLine(note, NOTE_COLOR[1], NOTE_COLOR[2], NOTE_COLOR[3], true) end
  if tooltip.Show then tooltip:Show() end -- resizes the tooltip to the new lines
end

if TooltipDataProcessor and TooltipDataProcessor.AddTooltipPostCall and Enum and Enum.TooltipDataType
    and Enum.TooltipDataType.Unit then
  TooltipDataProcessor.AddTooltipPostCall(Enum.TooltipDataType.Unit, function(tooltip)
    pcall(ns.OnUnitTooltip, tooltip)
  end)
end
