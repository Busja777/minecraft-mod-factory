local _, ns = ...

-- English text is the key itself; other languages override single keys.
local L = setmetatable({}, { __index = function(_, key) return key end })
ns.L = L

local T = {}

T.deDE = {
  ["Gold Diary"] = "Gold-Tagebuch",
  ["Session"] = "Sitzung", ["Today"] = "Heute", ["7 days"] = "7 Tage", ["History"] = "Verlauf", ["Characters"] = "Charaktere",
  ["Loot"] = "Beute", ["Quests"] = "Quests", ["Vendor"] = "Händler", ["Repairs"] = "Reparaturen",
  ["Auction House"] = "Auktionshaus", ["Mail"] = "Post", ["Trainer"] = "Lehrer", ["Flight paths"] = "Flugrouten",
  ["Trade"] = "Handel", ["Barber & transmog"] = "Barbier & Transmog", ["Warband bank"] = "Kriegsmeutenbank",
  ["Guild bank"] = "Gildenbank", ["Other"] = "Sonstiges",
  ["Source"] = "Quelle", ["Earned"] = "Eingenommen", ["Spent"] = "Ausgegeben",
  ["Total earned"] = "Eingenommen gesamt", ["Total spent"] = "Ausgegeben gesamt", ["Net"] = "Bilanz",
  ["Moved to/from banks"] = "Bankbewegungen", ["Net per hour"] = "Bilanz pro Stunde",
  ["No gold has moved yet."] = "Noch keine Goldbewegung.",
  ["Character"] = "Charakter", ["Realm"] = "Realm", ["Gold"] = "Gold", ["All characters"] = "Alle Charaktere",
  ["and %d more"] = "und %d weitere",
  ["Day"] = "Tag", ["%a, %b %d"] = "%d.%m.", ["Average per active day"] = "Schnitt pro aktivem Tag", ["Best day"] = "Bester Tag",
  ["Click to open the diary."] = "Klicken, um das Tagebuch zu öffnen.",
  ["Session started again."] = "Neue Sitzung gestartet.",
  ["%s forgotten."] = "%s entfernt.",
  ["No character called %s. Use Name-Realm."] = "Kein Charakter namens %s. Schreibweise: Name-Realm.",
  ["You cannot forget the character you are playing."] = "Den Charakter, den du gerade spielst, kannst du nicht entfernen.",
  ["/gd opens the diary, /gd report shows today in chat, /gd reset starts a new session, /gd forget Name-Realm removes a character."] =
    "/gd öffnet das Tagebuch, /gd report zeigt die Bilanz im Chat, /gd reset startet eine neue Sitzung, /gd forget Name-Realm entfernt einen Charakter.",
  ["Today: earned %s, spent %s, net %s."] = "Heute: eingenommen %s, ausgegeben %s, Bilanz %s.",
  ["This session: net %s."] = "Diese Sitzung: Bilanz %s.",
}

T.frFR = {
  ["Gold Diary"] = "Journal d'or",
  ["Session"] = "Session", ["Today"] = "Aujourd'hui", ["7 days"] = "7 jours", ["History"] = "Historique", ["Characters"] = "Personnages",
  ["Loot"] = "Butin", ["Quests"] = "Quêtes", ["Vendor"] = "Marchand", ["Repairs"] = "Réparations",
  ["Auction House"] = "Hôtel des ventes", ["Mail"] = "Courrier", ["Trainer"] = "Entraîneur", ["Flight paths"] = "Trajets aériens",
  ["Trade"] = "Échange", ["Barber & transmog"] = "Barbier & transmo", ["Warband bank"] = "Banque de bataillon",
  ["Guild bank"] = "Banque de guilde", ["Other"] = "Autre",
  ["Source"] = "Source", ["Earned"] = "Gagné", ["Spent"] = "Dépensé",
  ["Total earned"] = "Total gagné", ["Total spent"] = "Total dépensé", ["Net"] = "Bilan",
  ["Moved to/from banks"] = "Mouvements de banque", ["Net per hour"] = "Bilan par heure",
  ["No gold has moved yet."] = "Aucun mouvement d'or pour l'instant.",
  ["Character"] = "Personnage", ["Realm"] = "Royaume", ["Gold"] = "Or", ["All characters"] = "Tous les personnages",
  ["and %d more"] = "et %d autres",
  ["Day"] = "Jour", ["%a, %b %d"] = "%d/%m", ["Average per active day"] = "Moyenne par jour actif", ["Best day"] = "Meilleur jour",
  ["Click to open the diary."] = "Cliquez pour ouvrir le journal.",
  ["Session started again."] = "Nouvelle session commencée.",
  ["%s forgotten."] = "%s retiré.",
  ["No character called %s. Use Name-Realm."] = "Aucun personnage nommé %s. Utilisez Nom-Royaume.",
  ["You cannot forget the character you are playing."] = "Vous ne pouvez pas retirer le personnage que vous jouez.",
  ["/gd opens the diary, /gd report shows today in chat, /gd reset starts a new session, /gd forget Name-Realm removes a character."] =
    "/gd ouvre le journal, /gd report affiche le bilan dans le chat, /gd reset commence une nouvelle session, /gd forget Nom-Royaume retire un personnage.",
  ["Today: earned %s, spent %s, net %s."] = "Aujourd'hui : gagné %s, dépensé %s, bilan %s.",
  ["This session: net %s."] = "Cette session : bilan %s.",
}

T.esES = {
  ["Gold Diary"] = "Diario de oro",
  ["Session"] = "Sesión", ["Today"] = "Hoy", ["7 days"] = "7 días", ["History"] = "Historial", ["Characters"] = "Personajes",
  ["Loot"] = "Botín", ["Quests"] = "Misiones", ["Vendor"] = "Vendedor", ["Repairs"] = "Reparaciones",
  ["Auction House"] = "Casa de subastas", ["Mail"] = "Correo", ["Trainer"] = "Instructor", ["Flight paths"] = "Rutas de vuelo",
  ["Trade"] = "Comercio", ["Barber & transmog"] = "Barbero y transfiguración", ["Warband bank"] = "Banco de la banda",
  ["Guild bank"] = "Banco de hermandad", ["Other"] = "Otros",
  ["Source"] = "Origen", ["Earned"] = "Ganado", ["Spent"] = "Gastado",
  ["Total earned"] = "Total ganado", ["Total spent"] = "Total gastado", ["Net"] = "Balance",
  ["Moved to/from banks"] = "Movimientos de banco", ["Net per hour"] = "Balance por hora",
  ["No gold has moved yet."] = "Todavía no se ha movido oro.",
  ["Character"] = "Personaje", ["Realm"] = "Reino", ["Gold"] = "Oro", ["All characters"] = "Todos los personajes",
  ["and %d more"] = "y %d más",
  ["Day"] = "Día", ["%a, %b %d"] = "%d/%m", ["Average per active day"] = "Media por día activo", ["Best day"] = "Mejor día",
  ["Click to open the diary."] = "Haz clic para abrir el diario.",
  ["Session started again."] = "Nueva sesión iniciada.",
  ["%s forgotten."] = "%s eliminado.",
  ["No character called %s. Use Name-Realm."] = "No hay ningún personaje llamado %s. Usa Nombre-Reino.",
  ["You cannot forget the character you are playing."] = "No puedes eliminar el personaje con el que juegas.",
  ["/gd opens the diary, /gd report shows today in chat, /gd reset starts a new session, /gd forget Name-Realm removes a character."] =
    "/gd abre el diario, /gd report muestra el balance en el chat, /gd reset inicia una nueva sesión, /gd forget Nombre-Reino elimina un personaje.",
  ["Today: earned %s, spent %s, net %s."] = "Hoy: ganado %s, gastado %s, balance %s.",
  ["This session: net %s."] = "Esta sesión: balance %s.",
}
T.esMX = T.esES

local own = GetLocale and T[GetLocale()]
if own then
  for key, text in pairs(own) do rawset(L, key, text) end
end
