# To-dos

Stand: 20.11.2026. Ganz oben steht, was als Nächstes dran ist. Grundsatz seit heute: Du legst ein Projekt einmal an, alles andere läuft ohne dich.

## Für dich (einmalig)

- [ ] WoW-Konto auf CurseForge, Token als `CF_API_TOKEN_WOW` in `secrets.env`, dann `npm run secrets:push`.
- [ ] Stardew-Konto auf CurseForge, Token als `CF_API_TOKEN_STARDEWVALLEY`, dann `npm run secrets:push`.
- [ ] **Entscheidung Minecraft-EULA:** Darf Claude Minecraft auf deinem Mac im Entwickler-Modus starten (Client für Screenshots)? Ohne dein Ja fallen die optischen Resource Packs weg.
- [ ] **Entscheidung Ladetest für 1.21.1:** Für Minecraft 26.x lädt das Spiel unsere Data Packs schon selbst (Mojangs eingebauter Testserver, ohne EULA-Schritt). Für 1.21.1 ginge das nur über den Fabric-Testserver, der schon die Mod-Tests fährt. Er überspringt die EULA-Abfrage des Servers. Einmal habe ich so geprüft, dass die Zwei-Versionen-Datei auf 1.21.1 lädt. Soll das fester Teil von Bau und Tests werden?
- [ ] **Entscheidung:** Herz des Meeres in Anglers Loot (etwa einmal in 120 Würfen) so lassen?
- [ ] **Entscheidung:** Amethyst-Block zu 4 Scherben in Uncraft Basics in Ordnung?
- [ ] PR für `feat/radar` freigeben (enthält Werkzeuge, wird deshalb nicht von selbst gemergt).

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
6. Bedrock-Reihe statt Sims:
   - [x] Rahmen `tools/bedrock/`, Plan der 33 (`data/serie/bedrock.json`, Namen geprüft), eigenes Bein, Sims entfernt, Nr. 1 Plank Cutter im Vorrat.
   - [x] Nr. 2 bis 7 gebaut und im Vorrat (Hushed World, Calm Creepers, Anglers Haul, Fair Villager Trades, Tidy Endermen, Uncraft Kit). Gentle Ghasts geht als Update in Calm Creepers auf (Fair Play), Platz 26 ist jetzt Gentle Nights.
   - [ ] Nr. 8 bis 14 bauen (Vorsprung halten: unter 5 gebauten Projekten braucht die Reihe eine Bau-Nacht).
   - [ ] Radar: neue `bedrock-samples`-Version → alle Bedrock-Packs dagegen prüfen.
7. [ ] Saisonkalender mit Winter-Updates, danach der wöchentliche Trend-Radar.
8. [ ] An einem echten Abend prüfen, ob der Abend-Lauf zwischen 18 und 21 Uhr startet.
9. [ ] Ersten Lauf der Nacht-Sitzung lesen (PR da, Tests grün, von selbst gemergt?).

## Freiwillig: WoW-Screenshots (braucht deinen PC)

Echte Bilder aus dem Spiel für die WoW-Addons. Nachgebaute Spielszenen oder Standbilder aus fremden Videos verwenden wir nicht: Sie zeigen unser Addon dort, wo es nie gelaufen ist, und das wertet CurseForge als irreführend.

- [ ] **Du:** PC anschließen, Battle.net installieren, die kostenlose WoW-Testversion laden (über 100 GB), einen Charakter erstellen und in eine schöne Stadt stellen.
- [ ] **Claude:** Foto-Addon bauen (nur für uns, wird nie hochgeladen). `/shots` öffnet jedes unserer Addons nacheinander mit Beispieldaten und macht je 2 bis 3 Bilder über die Screenshot-Funktion des Spiels.
- [ ] **Claude:** Jedes Addon bekommt einen Vorführ-Modus (zum Beispiel `/gd demo`), der das Fenster mit Beispieldaten füllt.
- [ ] **Du, pro Runde (ca. 5 Minuten):** Addons in den AddOns-Ordner legen, einloggen, `/shots` tippen, den Screenshots-Ordner zurück auf den Mac legen.
