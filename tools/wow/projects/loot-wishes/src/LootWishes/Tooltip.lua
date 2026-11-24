local _, ns = ...
local L = ns.L

-- Adds "On your wish list" to the tooltip of a wished item, wherever the game shows one.

local COLOR = { 1, 0.5, 1 }

-- The item ID of a tooltip: from the tooltip data the game passes, else from the tooltip itself.
local function tooltipItemID(tooltip, data)
  local id = type(data) == "table" and ns.Plain(data.id)
  if type(id) == "number" then return id end
  if type(tooltip) == "table" and tooltip.GetItem then
    local ok, _, link = pcall(tooltip.GetItem, tooltip)
    if ok then return ns.LinkID(ns.Plain(link)) end
  end
  return nil
end

function ns.OnItemTooltip(tooltip, data)
  if not ns.db or type(tooltip) ~= "table" or not tooltip.AddLine then return end
  local id = tooltipItemID(tooltip, data)
  if not id or not ns.db.wishes[id] then return end
  tooltip:AddLine(L["On your wish list"], COLOR[1], COLOR[2], COLOR[3])
end

if TooltipDataProcessor and TooltipDataProcessor.AddTooltipPostCall and Enum and Enum.TooltipDataType
    and Enum.TooltipDataType.Item then
  TooltipDataProcessor.AddTooltipPostCall(Enum.TooltipDataType.Item, function(tooltip, data)
    pcall(ns.OnItemTooltip, tooltip, data)
  end)
end
