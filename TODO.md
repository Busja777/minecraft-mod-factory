# To-dos

Stand: 20.11.2026. Ganz oben steht, was als Nächstes dran ist.

## 1. WoW-Screenshots (wartet auf deinen PC)

Echte Bilder aus dem Spiel für die WoW-Addons. Nachgebaute Spielszenen oder Standbilder aus fremden Videos verwenden wir nicht: Sie zeigen unser Addon dort, wo es nie gelaufen ist, und das wertet CurseForge als irreführend.

- [ ] **Du:** PC anschließen, Battle.net installieren, die kostenlose WoW-Testversion laden (über 100 GB), einen Charakter erstellen und in eine schöne Stadt stellen.
- [ ] **Claude:** Foto-Addon bauen (nur für uns, wird nie hochgeladen). `/shots` öffnet jedes unserer Addons nacheinander mit Beispieldaten und macht je 2 bis 3 Bilder über die Screenshot-Funktion des Spiels.
- [ ] **Claude:** Jedes Addon bekommt einen Vorführ-Modus (zum Beispiel `/gd demo`), der das Fenster mit Beispieldaten füllt.
- [ ] **Du, pro Bau-Runde (ca. 5 Minuten):** Addons in den AddOns-Ordner legen (ich gebe dir einen Ordner zum Kopieren), einloggen, `/shots` tippen, den Screenshots-Ordner zurück auf den Mac legen.
- [ ] **Claude:** Bilder zuschneiden, dem Projekt zuordnen, in die Übergabe aufnehmen.
- [ ] **Bis dahin, Claude:** ehrliche Fenster-Vorschau pro Addon (das echte Fenster mit Beispieldaten auf neutralem Hintergrund, beschriftet mit „Window preview“, keine Spielszene).
- [ ] **Claude:** Banner für WoW abschalten (Banner pro Reihe ein- oder ausschaltbar). Hauptbild der Galerie wird bei WoW der beste Screenshot.
- [ ] **Claude:** WoW-Beschreibungen auf „kurz oben, ausführlich unten“ umstellen: Stichwortzeile mit Spielbegriffen, ein Abschnitt pro Funktion, Befehlstabelle, bis etwa 450 Wörter. Spenden- und Social-Links nur ganz unten (Regel von CurseForge).

## 2. Banner (Java, Stardew)

- [ ] **Du:** In `Output/chatgpt-bilder/` die drei Aufträge in ChatGPT ausführen, Bilder als `chatgpt-banner.png` ablegen, dann „Go Banner“.
- [ ] **Du:** Pro Projekt „Claude“ oder „ChatGPT“ wählen.
- [ ] **Claude:** Danach Aufträge für alle übrigen Projekte anlegen (`npm run serie -- chatgpt`).

## 3. Java-Screenshots (macht Claude selbst, ohne dich)

- [ ] **Claude:** Foto-Werkzeug für den Entwickler-Client von Minecraft bauen (läuft ohne gekauftes Spiel). Pflicht für die optischen Resource Packs, für alle anderen Java-Projekte empfohlen.

## 4. Offen aus Bau-Nacht 2

- [ ] **Claude:** Seite, Titelbild, Bau und Vorrat für Villages Nearby, Uncraft Basics, Anglers Loot, Replant Click und Villager Birthday Reminders.
- [ ] **Du, Entscheidung:** Herz des Meeres in Anglers Loot (etwa einmal in 120 Würfen) so großzügig lassen?
- [ ] **Du, Entscheidung:** Amethyst-Block zu 4 Scherben in Uncraft Basics in Ordnung?
- [ ] **Du, Entscheidung:** Darf ich für einen echten Ladetest der Java-Packs einen Minecraft-Server starten? Das heißt: der Minecraft-EULA zustimmen.
- [ ] **Du:** PR für `feat/bau-nacht-2` freigeben (noch nicht gepusht).

## 5. Für den Start der Serie

- [ ] **Du:** WoW-Konto auf CurseForge, Token als `CF_API_TOKEN_WOW` in `secrets.env`, dann `npm run secrets:push`.
- [ ] **Du:** Gold Diary anlegen und `npm run serie -- id gold-diary <Projekt-ID>` eintragen.
- [ ] **Claude:** Am Abend nach dem Merge von PR #16 prüfen, ob der Abend-Lauf jetzt zwischen 18 und 21 Uhr startet.
