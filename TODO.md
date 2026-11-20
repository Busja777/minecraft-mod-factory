# To-dos

Stand: 20.11.2026. Ganz oben steht, was als Nächstes dran ist. Grundsatz seit heute: Du legst ein Projekt einmal an, alles andere läuft ohne dich.

## Für dich (einmalig)

- [ ] WoW-Konto auf CurseForge, Token als `CF_API_TOKEN_WOW` in `secrets.env`, dann `npm run secrets:push`.
- [ ] Stardew-Konto auf CurseForge, Token als `CF_API_TOKEN_STARDEWVALLEY`, dann `npm run secrets:push`.
- [ ] **Entscheidung Minecraft-EULA:** Darf Claude Minecraft auf deinem Mac im Entwickler-Modus starten (Client für Screenshots, Server für Ladetests)? Ohne dein Ja fallen die optischen Resource Packs weg.
- [ ] **Entscheidung:** Herz des Meeres in Anglers Loot (etwa einmal in 120 Würfen) so lassen?
- [ ] **Entscheidung:** Amethyst-Block zu 4 Scherben in Uncraft Basics in Ordnung?
- [ ] PR für `feat/bau-nacht-2` freigeben (enthält Werkzeuge, wird deshalb nicht von selbst gemergt).

## Für dich (laufend)

- [ ] Projekte anlegen. Bis der Browser-Helfer erweitert ist: von Hand nach `Output/serie/<reihe>/<nr>-<slug>/curseforge.md`, dann `npm run serie -- id <slug> <Projekt-ID>`. Danach: `npm run cf -- serie`, nur noch auf Create klicken.

## Für Claude, in dieser Reihenfolge

1. [x] Seiten, Banner und Vorrat für Villages Nearby, Uncraft Basics, Anglers Loot, Replant Click und Villager Birthday Reminders.
2. [ ] Tests auf GitHub (`ci.yml`), automatisches Übernehmen für Inhalts-PRs (`serie-merge.yml`), nächtliche Cloud-Sitzung.
3. [ ] Tag-eins-Maschine (`scripts/radar.js`, `radar.yml`), zuerst für Java. Dazu drei Vorab-Projekte für Minecraft 26.4 „Deep Freeze“ (voraussichtlich Mitte Dezember).
4. [ ] Bilder ohne dich (`serie-bilder.yml`), Fenster-Vorschauen für WoW, längere WoW-Beschreibungen (Stichwortzeile, Abschnitt pro Funktion, Befehlstabelle, bis etwa 450 Wörter).
5. [ ] Browser-Helfer füllt das Anlegen-Formular für alle Spiele (`npm run cf -- serie`).
6. [ ] Bedrock-Reihe statt Sims: `tools/bedrock/`, die ersten sieben Packs, Sims aus `data/serie/` entfernen.
7. [ ] Saisonkalender mit Winter-Updates, danach der wöchentliche Trend-Radar.
8. [ ] Nach dem Merge von PR #16 prüfen, ob der Abend-Lauf zwischen 18 und 21 Uhr startet.

## Freiwillig: WoW-Screenshots (braucht deinen PC)

Echte Bilder aus dem Spiel für die WoW-Addons. Nachgebaute Spielszenen oder Standbilder aus fremden Videos verwenden wir nicht: Sie zeigen unser Addon dort, wo es nie gelaufen ist, und das wertet CurseForge als irreführend.

- [ ] **Du:** PC anschließen, Battle.net installieren, die kostenlose WoW-Testversion laden (über 100 GB), einen Charakter erstellen und in eine schöne Stadt stellen.
- [ ] **Claude:** Foto-Addon bauen (nur für uns, wird nie hochgeladen). `/shots` öffnet jedes unserer Addons nacheinander mit Beispieldaten und macht je 2 bis 3 Bilder über die Screenshot-Funktion des Spiels.
- [ ] **Claude:** Jedes Addon bekommt einen Vorführ-Modus (zum Beispiel `/gd demo`), der das Fenster mit Beispieldaten füllt.
- [ ] **Du, pro Runde (ca. 5 Minuten):** Addons in den AddOns-Ordner legen, einloggen, `/shots` tippen, den Screenshots-Ordner zurück auf den Mac legen.
