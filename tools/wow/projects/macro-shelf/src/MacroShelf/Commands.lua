local _, ns = ...
local L = ns.L

-- /macroshelf (alias /mshelf): window, export, import, backup, restore and help.

local function help()
  ns.Print(L["/macroshelf opens the window, /macroshelf export shows your macros as text, /macroshelf import opens the paste box, /macroshelf backup saves your macros, /macroshelf restore creates the missing ones from the backup. Short form: /mshelf."])
  ns.Print(ns.BackupStatus())
end

SLASH_MACROSHELF1 = "/macroshelf"
SLASH_MACROSHELF2 = "/mshelf"
SlashCmdList.MACROSHELF = function(msg)
  if not ns.db then return end
  local cmd = strtrim(msg or ""):lower()
  if cmd == "" or cmd == "export" then
    ns.ShowExport()
  elseif cmd == "import" then
    ns.ShowImport()
  elseif cmd == "backup" then
    ns.SetStatus(ns.Backup())
  elseif cmd == "restore" then
    ns.SetStatus(ns.Restore())
  else
    help()
  end
end
