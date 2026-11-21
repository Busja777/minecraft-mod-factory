local _, ns = ...

-- English text is the key itself; other languages override single keys.
--
-- Terms the game already has in the player's language come from the client itself, not from this file:
--   senders and subjects of letters (GetInboxHeaderInfo, e.g. the auction house's own letters),
--   character and realm names.
-- No GlobalStrings constant is spliced into a sentence: every game term here sits inside one, and the
-- German sentence needs its own article and case. They are written as the German client names them:
-- Post (mail), Brief (letter), Briefkasten (mailbox), Gegenstände (items), Gold, Charakter.
-- The day texts (less than a day, 1 day, %d days) only ever follow "in" or "within" (innerhalb von),
-- so in German they are in the dative: "weniger als einem Tag", "1 Tag", "%d Tagen".
-- Slash commands and their words stay English: players type them as they are (/mb expire off).
-- The bell names (bell, chime, horn, warning, whisper) are command words too and stay English.
local L = setmetatable({}, { __index = function(_, key) return key end })
ns.L = L

local T = {}

T.deDE = {
  ["Mail Bell"] = "Mail Bell",
  ["You have new mail."] = "Du hast neue Post.",
  ["Mail waiting on: %s"] = "Post liegt bereit bei: %s",
  ["No mail waiting on your other characters."] = "Bei deinen anderen Charakteren liegt keine Post bereit.",
  ["Sound is off."] = "Der Ton ist aus.", ["Sound is on: %s."] = "Der Ton ist an: %s.",
  ["Login list is on."] = "Die Liste beim Einloggen ist an.", ["Login list is off."] = "Die Liste beim Einloggen ist aus.",
  ["No character called %s. Use Name-Realm."] = "Kein Charakter namens %s. Schreibweise: Name-Realm.",
  ["You cannot forget the character you are playing."] = "Den Charakter, den du gerade spielst, kannst du nicht entfernen.",
  ["%s forgotten."] = "%s entfernt.",
  ["/mb sound on/off plays the bell or not, /mb login on/off names your characters with mail at login, /mb forget Name-Realm removes a character."] =
    "/mb sound on/off schaltet die Glocke an oder aus, /mb login on/off nennt beim Einloggen deine Charaktere mit Post, /mb forget Name-Realm entfernt einen Charakter.",
  -- 1.1: the expiry warning
  ["less than a day"] = "weniger als einem Tag", ["1 day"] = "1 Tag", ["%d days"] = "%d Tagen",
  ["Expiry warning is off."] = "Die Ablaufwarnung ist aus.",
  ["Expiry warning: mail with items or gold that runs out within %s."] =
    "Ablaufwarnung: Post mit Gegenständen oder Gold, die innerhalb von %s abläuft.",
  ["/mb expire followed by 1 to 30 days, or off, sets the warning for mail with items or gold that runs out soon."] =
    "/mb expire mit 1 bis 30 Tagen oder off stellt die Warnung für Post mit Gegenständen oder Gold ein, die bald abläuft.",
  ["A letter with items or gold runs out in %s. Take it out before it is returned or deleted."] =
    "Ein Brief mit Gegenständen oder Gold läuft in %s ab. Hol den Inhalt heraus, bevor der Brief zurückgeht oder gelöscht wird.",
  ["%d letters with items or gold run out within %s, the first in %s. Take them out before they are returned or deleted."] =
    "%d Briefe mit Gegenständen oder Gold laufen innerhalb von %s ab, der erste in %s. Hol den Inhalt heraus, bevor die Briefe zurückgehen oder gelöscht werden.",
  ["%s in %s"] = "%s in %s",
  ["Mail with items or gold runs out soon on: %s"] = "Post mit Gegenständen oder Gold läuft bald ab bei: %s",
  -- 1.2: the choice of bell
  ["%s or %s"] = "%s oder %s",
  ["/mb sound followed by %s picks the bell and plays it once."] = "/mb sound mit %s wählt die Glocke und spielt sie einmal ab.",
  -- 1.3: letters named by sender and subject
  ["%s \"%s\""] = "%s „%s“", ["\"%s\""] = "„%s“", ["a letter"] = "ein Brief",
  ["%s and %d more"] = "%s und %d weitere",
  ["A letter with items or gold runs out in %s: %s. Take it out before it is returned or deleted."] =
    "Ein Brief mit Gegenständen oder Gold läuft in %s ab: %s. Hol den Inhalt heraus, bevor der Brief zurückgeht oder gelöscht wird.",
  ["%d letters with items or gold run out within %s, the first in %s: %s. Take them out before they are returned or deleted."] =
    "%d Briefe mit Gegenständen oder Gold laufen innerhalb von %s ab, der erste in %s: %s. Hol den Inhalt heraus, bevor die Briefe zurückgehen oder gelöscht werden.",
  ["From your last mailbox visit: a letter with items or gold on this character runs out in %s: %s. Open a mailbox to take it out."] =
    "Laut deinem letzten Briefkastenbesuch läuft auf diesem Charakter ein Brief mit Gegenständen oder Gold in %s ab: %s. Öffne einen Briefkasten, um den Inhalt herauszuholen.",
  ["From your last mailbox visit: %d letters with items or gold on this character run out within %s, the first in %s: %s. Open a mailbox to take them out."] =
    "Laut deinem letzten Briefkastenbesuch laufen auf diesem Charakter %d Briefe mit Gegenständen oder Gold innerhalb von %s ab, der erste in %s: %s. Öffne einen Briefkasten, um den Inhalt herauszuholen.",
  ["From your last mailbox visit: mail with items or gold on this character runs out in %s. Open a mailbox to take it out."] =
    "Laut deinem letzten Briefkastenbesuch läuft auf diesem Charakter Post mit Gegenständen oder Gold in %s ab. Öffne einen Briefkasten, um den Inhalt herauszuholen.",
  ["the first in %s"] = "der erste in %s",
  ["%s: %s"] = "%s: %s",
  ["/mb letters lists the letters with items or gold on all your characters, as of each one's last mailbox visit."] =
    "/mb letters zeigt die Briefe mit Gegenständen oder Gold auf allen deinen Charakteren, jeweils vom letzten Briefkastenbesuch.",
  ["No letters with items or gold noted. Mail Bell notes them when you open a mailbox."] =
    "Keine Briefe mit Gegenständen oder Gold notiert. Mail Bell notiert sie, wenn du einen Briefkasten öffnest.",
  ["Letters with items or gold, as of each character's last mailbox visit:"] =
    "Briefe mit Gegenständen oder Gold, jeweils vom letzten Briefkastenbesuch des Charakters:",
}

local own = GetLocale and T[GetLocale()]
if own then
  for key, text in pairs(own) do rawset(L, key, text) end
end
