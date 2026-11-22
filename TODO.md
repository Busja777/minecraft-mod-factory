# To-dos

Stand: 21.11.2026 mittags. Ganz oben steht, was als Nächstes dran ist. Grundsatz: Du legst ein Projekt einmal an, alles andere läuft ohne dich.

## Auf einen Blick (21.11.)

**Fertig gebaut:**
- auf `main`: Java 12 (davon 11 im Vorrat; Ice Cave Advancements wartet auf 26.4), Stardew 5, WoW 12;
- in offenen PRs: Bedrock 7 (#29), Stardew 6 (#33, #39).

**Online ist noch nichts:** Der Engpass ist das Anlegen, nicht das Bauen.

**Was gut läuft**
- Helfer bauen nach `BRIEF.md`, Claude liest gegen, prüft die Bilder und baut. Die Helfer haben vier echte Fehler in Claudes Prüfungen gefunden.
- Inhalte gehen über `serie/auto-…` von `main` ohne dich durch (#25, #32, #35, #36, #38). Die Sperre hält dicht: Ein Inhalts-PR auf einem Werkzeug-Stand bleibt offen.
- Für Minecraft 26.x lädt das Spiel unsere Data Packs selbst und meldet jeden Fehler. Trigger Homes wurde im Testserver sogar durchgespielt.
- Ehrlichkeit vor Menge: „Faster Fruit Trees“ ist ersetzt, weil die Wachstumszeit im Spiel fest eingebaut ist; „Gentle Ghasts“ geht in Calm Creepers auf (Fair Play).

**Was nicht gut läuft**
- **Zu viele Werkzeug-PRs warten:** #27 Bilder, #28 WoW-Seiten, #29 Bedrock, #30 Anlegen, #31 Saison, #33 Stardew-Post, #34 Trend-Radar, #37 Trank-IDs. Ohne #29, #30 und #28 kommen Bedrock, das Anlegen in einer Minute und neue WoW-Addons nicht voran. Neue Werkzeug-PRs gibt es nur noch für Fehler, die beim Bauen auftauchen.
- **Die Nacht-Sitzung lief noch nie:** Diese Sitzung und sie teilen sich ein Ausgabe-Limit. Claude baut tagsüber mit höchstens zwei Helfern und abends nichts Großes. Besser wäre ein höheres Limit (deine Entscheidung).
- **Blind bleibt blind:** Stardew, Bedrock und 1.21.1 sind ungetestet im Spiel; die Seiten sagen nichts anderes.

**Empfohlene Reihenfolge für deine Merges:** **#89 zuerst** (Java-Dateien für die Zwischenversionen, behebt kaputte Packs auf 1.21.5 bis 26.2) → #29 → #30 (Anlegen) → #28 → #27 → #33 → #37 → #75 → #84 → #31 → #34. Danach `npm run cf -- serie` für die 18 Minecraft-Projekte, die schon warten.

## Abend 21.11.: Java-Packs auf den Zwischenversionen

- Ein Ladetest über alle Minecraft-Versionen von 1.21.5 bis 26.2 hat gezeigt: Unsere Zwei-Versionen-Dateien nehmen jede Version dazwischen an. Drei Packs funktionierten dort nicht richtig, bei Hush wären auf 1.21.2 bis 1.21.4 die Wölfe stumm.
- **#89** ordnet jeder Zwischenversion den Dateisatz zu, der bei ihr nachweislich lädt (`alsoLoads`). Offen bleiben Anglers Loot und Farmers Advancements auf 26.2 sowie das Rezeptbuch von Uncraft Basics auf 1.21.2 bis 26.2; dafür bräuchte es einen dritten Dateisatz (deine Entscheidung).
- **Bis #89 gemergt ist, baut Claude keine Java-Updates**, sonst wären sie gleich wieder veraltet.
- **Später möglich:** Die sieben Packs, die überall laden, könnten auf CurseForge auch 1.21.5 bis 26.2 angeben. Das bringt mehr Reichweite, braucht aber einen eigenen Schritt im Upload.
- **Speicherplatz:** Auf deinem Mac sind nur noch etwa 14 GB frei. Der Zwischenspeicher `~/.cache/mod-factory/minecraft/` enthält jetzt 14 weitere Versionen (3,4 GB). Die Ordner 1.21.2 bis 26.2 dürfen jederzeit weg; `--zwischen` lädt sie bei Bedarf neu.

## Nacht-Sitzung läuft (22.11.)

- Erster Lauf erfolgreich (#102, von selbst gemergt). Claude hat den Code gegengelesen: keine Kampfdaten (Death Diary nutzt nur `PLAYER_DEAD`).
- **#101 braucht dich:** (1) Neue Projekte landen nachts nur mit `page.draft.json`, weil der Test für jede `page.json` ein Logo verlangt und die Nacht keine Bilder macht. Lösung: Logo-Prüfung als Warnung, solange ein Projekt nicht angelegt ist, oder der Bilder-Workflow (#27). (2) Die Cloud-Umgebung sperrt `maven.fabricmc.net`, daher keine Fabric-Mods nachts; Freigabe in den Netzwerk-Einstellungen der Umgebung oder Test ohne Netz überspringen.
- Die vier neuen Addons sind englisch; Deutsch nach dem Muster von heute kann als erstes Update folgen.

## WoW auf Deutsch (21.11. abends)

- Alle 12 WoW-Addons sprechen jetzt Deutsch (#96 bis #99). Spielbegriffe wie Slot-Namen, Taschenarten, „Schlachtfeld“ oder „Rückkauf“ kommen aus den Textkonstanten des Spiels (GlobalStrings), mit englischem Rückfall. Sie sind gegen die echten enUS- und deDE-Texte geprüft. Befehle bleiben englisch.
- Einige Addons zeigen dadurch auch englischen Spielern die Begriffe des Spiels, zum Beispiel „Herb Bag“ statt „Herbs“. Das steht jeweils im Changelog.
- Offen: ob das deutsche Spiel „Shift“ oder „Umschalt“ schreibt; verwendet ist „Shift“. Spaltenbreiten in Alt Almanac sind geschätzt, nicht im Spiel gemessen.

## Deutsche Spielnamen (21.11. abends)

- Die deutschen Texte der Stardew-Packs hatten über 20 Spielnamen, die das deutsche Spiel anders nennt (zum Beispiel Saloon statt „Kneipe zum Sternenfall“, Ton statt „Lehm“, Volksfest statt „Sterntautaler Volksfest“). Korrigiert in #92, #93 und #94, belegt über die `[[de:]]`-Verweise des Wikis. Hochgeladen war nichts davon.
- **Regel ab jetzt:** Deutsche Namen von Gegenständen, Festen und Orten nur aus dem `[[de:]]`-Verweis der englischen Wiki-Seite oder vom deutschen Wiki, mit Revision im Kommentar. Die deutschen Seiten liegen in `~/.cache/mod-factory/stardew/wiki-de/`.
- **Für später (Werkzeug, braucht dein Wort):** Diese Regel in `tools/stardew/BRIEF.md` aufnehmen und eine Namensliste `tools/stardew/data/de-names.json` aus dem Wiki erzeugen, gegen die die Stardew-Prüfung jeden deutschen Text abgleicht.

## Nachmittag 21.11.: Updates statt neuer Projekte

**Gebaut (alles nur Inhalte, von selbst übernommen oder unterwegs):**
- WoW: alle 12 Addons haben jetzt V1.2 (Gold Diary V1.3).
- Java: Trigger Homes, Actionbar Coords, Ore Abundance, Owner Safe Pets, AFK Tag, Replant Click, Fast Leaf Fall V1.2, Uncraft Basics V1.3, Hush V1.4. Die Fabric-Mods jeweils mit Gradle- und GameTests.
- Stardew: More to Say (Pam und Gus), Joja Junk Mail (Fest-Briefe), Villager Birthday Reminders (Leo), Fish Pond Bounty (Stufen), Festival Stalls Plus (Preis-Stufen), Stocked Shelves V1.2, Pierre's Year-Round Seeds V1.1 (Sandy).

**Abgelehnt oder zurückgestellt, mit Grund im Plan:**
- Enchanting Extras in Beute und Handel: Die Seite verspricht „nur vom Verzauberungstisch“.
- Machine Tempo Kristallarium: Maschinendaten nicht im Zwischenspeicher, nicht raten.
- Sandys Fischtheke: Gekaufter Fisch ließe sich räuchern und mit Gewinn verkaufen.
- Platzhalter-Rezepte für 1.21.1: Das Spiel kann sie hier nicht prüfen.

**Gefunden und korrigiert:** Stocked Shelves 1.1 ließ Krobus jeden Tag Leerenlachs verkaufen. Mit Räucherofen und Berufen (bis 630g aus 300g) war das eine kleine Gelddruck-Schleife. 1.2 verkauft ihn nur mittwochs, wie Krobus' eigenen Fisch.

**Was gut lief:** Gegenlesen vor dem Bau. Bei fünf Updates habe ich etwas zurückgeschickt oder gestrichen, unter anderem Claim-Schutz bei der 3×3-Ernte, `/vr off` auch für die Bank und zwei erfundene Details in Pams Sätzen.

**Was nicht gut lief:** Zweimal stand im Plan ein Update, das schon gebaut war. Ein Abgleich aller 126 Pläne mit dem Code hat das aufgeräumt (#76). Ab jetzt lese ich vor jedem Auftrag die Changelogs des Projekts.

**Neuer Werkzeug-PR #75 (wartet auf dich):** Die Stardew-Prüfung lässt jetzt übersetzte Einstellungstexte zu. Danach können sieben Stardew-Projekte ein Update „Deutsch“ bekommen.

**Der Vorrat ist weit voraus:** WoW und viele Java-Packs haben 3 bis 5 Versionen, bei einem Update pro Bein und Tag reicht das für Monate. Neue Projekte bremsen die fehlenden Logos (OpenAI-Guthaben) und das Anlegen.

## Für dich (einmalig)

- [ ] WoW-Konto auf CurseForge, Token als `CF_API_TOKEN_WOW` in `secrets.env`, dann `npm run secrets:push`.
- [ ] Stardew-Konto auf CurseForge, Token als `CF_API_TOKEN_STARDEWVALLEY`, dann `npm run secrets:push`.
- [ ] **Entscheidung Minecraft-EULA:** Darf Claude Minecraft auf deinem Mac im Entwickler-Modus starten (Client für Screenshots)? Ohne dein Ja fallen die optischen Resource Packs weg.
- [ ] **Entscheidung Ladetest für 1.21.1:** Für Minecraft 26.x lädt das Spiel unsere Data Packs schon selbst (Mojangs eingebauter Testserver, ohne EULA-Schritt). Für 1.21.1 ginge das nur über den Fabric-Testserver, der schon die Mod-Tests fährt. Er überspringt die EULA-Abfrage des Servers. Einmal habe ich so geprüft, dass die Zwei-Versionen-Datei auf 1.21.1 lädt. Soll das fester Teil von Bau und Tests werden?
- [ ] **Entscheidung:** Herz des Meeres in Anglers Loot (etwa einmal in 120 Würfen) so lassen?
- [ ] **Entscheidung:** Amethyst-Block zu 4 Scherben in Uncraft Basics in Ordnung?

## Für dich (laufend)

- [ ] Projekte anlegen. Bis der Browser-Helfer erweitert ist: von Hand nach `Output/serie/<reihe>/<nr>-<slug>/curseforge.md`, dann `npm run serie -- id <slug> <Projekt-ID>`. Danach: `npm run cf -- serie`, nur noch auf Create klicken.

## Für Claude, in dieser Reihenfolge

1. [x] Seiten, Banner und Vorrat für Villages Nearby, Uncraft Basics, Anglers Loot, Replant Click und Villager Birthday Reminders.
2. [x] Tests auf GitHub (`ci.yml`), automatisches Übernehmen für Inhalts-PRs (`serie-merge.yml`), nächtliche Cloud-Sitzung („Serie Nachtbau“, täglich 01:30).
3. Tag-eins-Maschine:
   - [x] Radar für Java (`npm run radar`, `radar.yml`), echter Ladetest für 26.x, eine Datei für mehrere Minecraft-Versionen.
   - [ ] Die vier Packs, die laut `data/radar/java.json` auf 26.3 noch nicht laden, anpassen (Stonecutter Woodworks, Farmers Advancements, Uncraft Basics, Anglers Loot). Hush und Villages Nearby sind bereit.
   - [x] Vorab-Projekt für Minecraft 26.4: Ice Cave Advancements (18 Fortschritte, Java-Platz 25, wartet auf 26.4). Die Steinsäger-Rezepte für die neuen Ziegel bringt das Spiel selbst mit; Beute für den Frost-Zombie ist zu dünn für ein eigenes Projekt (gehört in Mob Drops Plus).
   - [ ] Vorab anlegen: Projekt-ID schon eintragen können, bevor die Datei im Vorrat liegt (heute verlangt `serie id` eine Datei). Dann geht ein Vorab-Projekt am Erscheinungstag abends hoch. Berührt den Upload-Ablauf, braucht eigene Tests.
   - [ ] Ladetest gegen jede Minecraft-Version zwischen 1.21.5 und 26.2, damit klar ist, welche davon unsere Zwei-Versionen-Dateien lesen (das Spiel überspringt unbekannte Felder still, zum Beispiel bei der Angel-Beute).
   - [ ] Radar auch für die Versionslisten von CurseForge (WoW, Stardew) und für Bedrock-Packs.
4. [ ] Bilder ohne dich (`serie-bilder.yml`), Fenster-Vorschauen für WoW, längere WoW-Beschreibungen (Stichwortzeile, Abschnitt pro Funktion, Befehlstabelle, bis etwa 450 Wörter).
5. [ ] Browser-Helfer füllt das Anlegen-Formular für alle Spiele (`npm run cf -- serie`).
6. [ ] Bedrock-Reihe statt Sims: `tools/bedrock/`, die ersten sieben Packs, Sims aus `data/serie/` entfernen.
7. [ ] Saisonkalender mit Winter-Updates, danach der wöchentliche Trend-Radar.
8. [ ] An einem echten Abend prüfen, ob der Abend-Lauf zwischen 18 und 21 Uhr startet.
9. [x] Ersten Lauf der Nacht-Sitzung lesen: am 22.11. um 1:54 Uhr gelaufen, vier neue WoW-Addons (Fishing Log, Gather Tally, Rep Session, Death Diary) mit Tests und V1.0 im Vorrat, PR #102 von selbst gemergt. Offene Punkte in #101 (siehe oben).

## Freiwillig: WoW-Screenshots (braucht deinen PC)

Echte Bilder aus dem Spiel für die WoW-Addons. Nachgebaute Spielszenen oder Standbilder aus fremden Videos verwenden wir nicht: Sie zeigen unser Addon dort, wo es nie gelaufen ist, und das wertet CurseForge als irreführend.

- [ ] **Du:** PC anschließen, Battle.net installieren, die kostenlose WoW-Testversion laden (über 100 GB), einen Charakter erstellen und in eine schöne Stadt stellen.
- [ ] **Claude:** Foto-Addon bauen (nur für uns, wird nie hochgeladen). `/shots` öffnet jedes unserer Addons nacheinander mit Beispieldaten und macht je 2 bis 3 Bilder über die Screenshot-Funktion des Spiels.
- [ ] **Claude:** Jedes Addon bekommt einen Vorführ-Modus (zum Beispiel `/gd demo`), der das Fenster mit Beispieldaten füllt.
- [ ] **Du, pro Runde (ca. 5 Minuten):** Addons in den AddOns-Ordner legen, einloggen, `/shots` tippen, den Screenshots-Ordner zurück auf den Mac legen.
