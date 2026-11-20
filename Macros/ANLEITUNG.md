# Minecraft Studio & CurseForge-Helfer: Anleitung

Alles liegt in **einem** Ordner: `~/Desktop/minecraft-mod-factory`. Die Starter und Anleitungen findest du darin unter `Macros/`.

Diese Anleitung und die Makro-Anleitung gibt es zusammen als PDF: `Macros/ANLEITUNG.pdf` (neu erzeugen mit `npm run guide`).

## Das Studio (dein Startpunkt)

**Doppelklick auf `Macros/Studio.command`** (im Projektordner). Dein Browser öffnet das Dashboard (http://127.0.0.1:4747, läuft nur auf deinem Mac).

| Abschnitt | Was du tust |
|---|---|
| **Jetzt fällig** | Der Termin ist da: „Jetzt veröffentlichen“ öffnet den Komplettlauf. Du klickst nur Create, Apply, Add File. |
| **Wartet auf dein Go** | „Packs nacheinander prüfen“. Passt alles → **Go – fertig**. Passt ein Teil nicht → dort **Ändern**, kurz schreiben was, am Ende **An Claude zurückgeben**. |
| **Wartet auf Claude** | Nichts. Sag Claude in der nächsten Sitzung „bearbeite die Studio-Notizen“. Danach liegt das Pack wieder bei dir, geänderte Teile sind markiert. |
| **Eingeplant** | Nichts. Termin steht dran (Mo/Mi/Fr/Sa, 06–12 Uhr, max. 1 neues Projekt pro Tag). „Go zurücknehmen“ geht jederzeit. |
| **Updates** | Nur zur Info, brauchen kein Go (1 pro Abend zwischen 18 und 21 Uhr, reihum, jedes Pack frühestens nach 23 Tagen). |

**Go ist gesperrt**, solange Notizen offen sind oder eine automatische Prüfung rot ist (falsche Bildgröße, ≥ 2 MB, fehlender KI-Hinweis, keine Screenshots, falscher MCPEDL-Titel, kaputte .mcpack). Der Grund steht direkt unter dem Knopf.

**Erinnerung zum Termin:** Einmal im Terminal `npm run studio -- zeitplan-installieren` ausführen. Dann prüft dein Mac alle 30 Minuten die Termine und meldet sich mit einer Mitteilung, wenn etwas fällig ist. Entfernen: `npm run studio -- zeitplan-entfernen`.

---

## Der CurseForge-Helfer

Das Tool füllt die CurseForge-Formulare aus, für die es keine API gibt: **neues Projekt anlegen**, **Cover/Media** und **Skinpack-Datei hochladen**.
Am Ende **hält es an**, und du klickst selbst auf *Create* / *Save* / *Upload*.

Die `.jar`-Uploads der Mods laufen weiterhin automatisch über die API. Dafür brauchst du das Tool nicht.

---

## Einmalig einrichten (≈ 15 Min.)

1. **Doppelklick auf `Macros/CurseForge.command`** im Projektordner.
   - Beim allerersten Mal meldet macOS eventuell „nicht verifizierter Entwickler“. Dann **Rechtsklick → Öffnen → Öffnen**. Das ist nur einmal nötig.
2. Im Menü **`l`** tippen und Enter drücken (oder im Terminal `npm run cf -- login`). Es öffnet sich ein **normales** Chrome-Fenster mit dem eigenen Profil des Helfers.
3. Dort **bei CurseForge einloggen**, auch „Mit Google anmelden“ geht hier. Danach dieses Chrome mit **⌘Q** beenden.
   Das Profil merkt sich den Login, dein normales Chrome bleibt unberührt. Fragt macOS nach dem Schlüsselbund („Chrome Safe Storage“), „Immer erlauben“ klicken.
   Warum ein normales Fenster? Im ferngesteuerten Helfer-Fenster lehnt Google jede Anmeldung ab („Anmeldung nicht möglich“). Das wird nicht umgangen.
4. **Probelauf** (das Tool ist anhand der Screenshots aus deiner `Anleitung_CF.docx` eingestellt):
   `CurseForge.command` starten, „Cover & Media: Glowing Samurai“ wählen und zuschauen. Am Ende **nicht** auf Apply klicken, sondern Fenster schließen.
   Steht in der Zusammenfassung „⚠ … nicht gefunden“, dann im Menü **`i`** wählen, genau diese Seite öffnen, Enter drücken, `q` tippen und Claude Bescheid geben. Claude trägt die echten Namen ein.

---

## Im Alltag: einmal am Tag „Go“

Die Dateien der Updates lädt der Abend-Lauf selbst hoch (ein Pack pro Abend zwischen 18 und 21 Uhr). Auf dich wartet nur, was keine Schnittstelle hat: die **Beschreibung** nach jedem Update und **neue Projekte** nach deinem Go im Studio. Gegen 21:15 Uhr kommt eine Mac-Mitteilung, wenn etwas offen ist (einmalig einrichten: `npm run studio -- zeitplan-installieren`).

1. **Doppelklick auf `CurseForge.command`**, wann immer du Zeit hast. Das Tool holt die neuesten Daten (`git pull`, nur wenn gerade keine lokalen Änderungen offen sind) und zeigt die Liste des Tages:
   ```
   Heute: 1 Beschreibung
     1) Beschreibung nachziehen: Yubi's Easter Skins V1.1
   Enter = Go (alles nacheinander) · m = Menü · q = Beenden
   ```
2. **Enter drücken.** Chrome öffnet sich und arbeitet alle Punkte nacheinander im selben Fenster ab. Du klickst pro Punkt nur **Save**, **Create**, **Apply** oder **Add File**. **Nicht ins Fenster klicken, solange es arbeitet.**
   - Danach räumt der Helfer selbst auf: Er trägt Projekt-ID und Upload ein, committet und pusht die Daten und schließt das GitHub-Issue, sobald CurseForge die neue Beschreibung zeigt.
   - **Oder du schreibst Claude „Go“.** Claude startet denselben Ablauf (`npm run cf -- heute --ohne-enter`). Chrome öffnet sich bei dir, der Helfer erkennt deine Klicks selbst, eine Enter-Taste braucht es nicht. Login und Sicherheitsprüfungen löst weiter nur du.
3. Mit `m` kommst du ins Menü für einzelne Aufgaben (z. B. „Cover & Media“). Nummer eintippen und Enter drücken.
4. Im Terminal steht die Zusammenfassung:
   ```
   ✓ 6 Schritte erledigt, ⚠ 1 bitte selbst prüfen:
      ⚠ Release Type R: Feld nicht gefunden → Release
   Noch zu tun:
      • Game Versions: alle aktuellen 26.x anhaken.
   🛑 Bitte alles im Browser prüfen und SELBST auf Create / Save / Upload klicken.
   ```
5. Prüfen, Rest erledigen und **selbst abschicken**. Danach das Fenster schließen.

**Nach einem automatischen Upload** (die Datei lädt der Abend-Lauf selbst hoch) steht im Menü „Beschreibung nachziehen: <Pack> V1.x“. Der Helfer setzt die komplette neue Beschreibung ein: Legende, alle Skins mit Story und die „Added in V1.x“-Abschnitte mit den Screenshots der neuen Skins. Du klickst **Save**. Ob es online ist, liest der Helfer selbst bei CurseForge nach; die Aufgabe verschwindet dann aus dem Menü. Mehrere offene Beschreibungen erledigt `s` im Menü oder `npm run cf -- seite` in einem Rutsch.

**Galerie:** Bei Skinpacks kommen Bilder nur bei einem **neuen Projekt** in die Galerie (Cover, Titel MCPEDL). Screenshots von Updates stehen in der Beschreibung, die Galerie bleibt bei Updates unverändert.

**Bei Updates, die du von Hand hochlädst,** liegt der neue Beschreibungsabschnitt zusätzlich in der **Zwischenablage**. Unter *Description* fügst du ihn **vor „How to install“** mit ⌘V ein, oder du nimmst danach „Beschreibung nachziehen“.

**Bei neuen Projekten** („Neues Projekt veröffentlichen“) läuft alles in **einem** Durchgang, in der Reihenfolge deiner Anleitung:
1. Das Tool füllt **General → Description → License** aus. Du prüfst und klickst **Create**.
2. Es erkennt die neue **Projekt-ID** selbst und trägt sie ein.
3. **Media:** Es lädt das Cover hoch und setzt den Titel **MCPEDL**. Du klickst **Apply**.
4. **File:** Es lädt die `.mcpack` hoch, setzt Game-Versionen, Release und den Changelog mit Screenshots. Du klickst **Add File**.
5. Es erkennt deinen Klick auf **Add File**, trägt den Upload ein und plant das nächste Update (frühestens nach 23 Tagen).

Committen und pushen erledigt der Helfer danach selbst. Die Bilder in Beschreibung und Changelog werden erst nach dem Push sichtbar.

### Für Terminal-Fans
```bash
cd ~/Desktop/minecraft-mod-factory
npm run cf -- heute                                # Liste des Tages, ein Go für alles (--dry-run: nur zeigen)
npm run cf                                         # Menü
npm run cf -- publish --skinpack <slug>            # neues Projekt komplett (Create → Media → File)
npm run cf -- new    --skinpack <slug>             # oder --mod <id>
npm run cf -- media  --skinpack <slug>             # oder --mod <id>
npm run cf -- update --skinpack <slug> [--version 1.3]
npm run cf -- seite  [--skinpack <slug>]           # Beschreibung nach einem Upload (ohne Angabe: alle offenen)
npm run cf -- login                                # neu einloggen
npm run cf -- inspect                              # Seiten für die Kalibrierung speichern
# --account <name>   eigenes Chrome-Profil (Login) pro CurseForge-Account
```

---

## Weitere Spiele: einmal anlegen, danach läuft es von selbst

Für Stardew Valley, World of Warcraft und The Sims 4 gibt es keinen Helfer im Browser. Du legst ein Projekt **einmal von Hand** an, danach kommen die Updates abends von selbst (Datei + Changelog). Beschreibung und Bilder bleiben so, wie du sie angelegt hast.

1. **Projekt anlegen:** auf https://authors.curseforge.com im Konto des Spiels, mit Name, Beschreibung, Logo und Bildern. Die Projekt-ID steht rechts auf der Projektseite.
2. **Token des Kontos (einmal pro Konto):** im Konto unter *My API Tokens* ein Token erzeugen, in `secrets.env` als `CF_API_TOKEN_STARDEWVALLEY` (bzw. `_WOW`, `_SIMS4`) eintragen, dann `npm run secrets:push`.
3. **Claude die Projekt-ID geben.** Claude trägt das Projekt ein und legt den Vorrat an Versionen an.
4. **Erste Datei:** Liegt auf CurseForge noch keine Datei, startet die erste nur auf dein Wort. Danach läuft alles allein.

Stand ansehen: `npm run projekt -- liste` zeigt pro Projekt, ob das Token da ist, wie viele Versionen vorbereitet sind und wann das nächste Update frühestens kommt.

Regeln wie bei den Skinpacks: pro Konto höchstens 1 Update am Tag zu einer Zufallszeit zwischen 18 und 21 Uhr, jedes Projekt frühestens 23 Tage nach seiner letzten Datei. Ist nichts vorbereitet, passiert nichts.

---

## Die Serie: jeden Tag ein Projekt pro Spiel

Vier Reihen mit je 33 Projekten: World of Warcraft, Minecraft Java, Stardew Valley und The Sims 4. Jede Reihe lädt abends genau eine Datei hoch. In den ersten 33 Tagen ist das jeden Tag ein neues Projekt, danach kommt reihum ein Update. Der ganze Plan steht in `Output/serie/PLAN.md` (`npm run serie -- plan` schreibt ihn neu).

**Dein Tag (pro Projekt etwa 10 Minuten):**

1. `npm run serie -- heute` zeigt pro Reihe, welches Projekt du anlegst und in welchem Ordner alles liegt.
2. Ordner öffnen, zum Beispiel `Output/serie/wow/01-gold-diary/`. Darin liegen `curseforge.md` (Name, Summary, Kategorie, Beschreibung), `logo.png` und `cover.png`.
3. Auf https://authors.curseforge.com im Konto des Spiels ein neues Projekt anlegen: Texte einfügen (im Editor auf **Markdown** stellen), Logo hochladen, das Titelbild unter **Images** hochladen und als Hauptbild markieren. **Keine Datei hochladen.**
4. Die Projekt-ID eintragen: `npm run serie -- id gold-diary 123456`. **Das ist dein Go.** Die erste Datei geht am selben Abend von selbst hoch.

Du kannst Projekte auch auf Vorrat anlegen, zum Beispiel sieben am Sonntag. Hochgeladen wird trotzdem nur eines pro Reihe und Tag. Fehlt abends die ID, lädt die Reihe an dem Tag nichts hoch und rutscht um einen Tag.

**Einmal pro Konto:** unter *My API Tokens* ein Token erzeugen und in `secrets.env` eintragen (`CF_API_TOKEN_WOW`, `CF_API_TOKEN_STARDEWVALLEY`, `CF_API_TOKEN_SIMS4`; Java nutzt das Minecraft-Token), dann `npm run secrets:push`.

**Stand ansehen:** `npm run serie -- stand` zeigt je Reihe, wie viele Projekte online, angelegt und fertig gebaut sind. Liegt der Vorsprung unter 5 fertigen Projekten, braucht die Reihe eine Bau-Nacht mit Claude.

**Was nie passiert:** Es geht nichts Ungeprüftes hoch. Ist der Vorrat einer Reihe leer, pausiert sie.

---

## Sicherheit: was das Tool tut und was nicht

- Es läuft **sichtbar** in Google Chrome, in normalem Tempo, ein Projekt pro Lauf.
- Es klickt **nie** auf *Create*, *Save*, *Upload*, *Submit*, *Delete* usw. Das ist fest eingebaut und getestet.
- Kommt eine **„Bist du ein Mensch?“-Prüfung**, hält es an. Du löst sie selbst im Browser (und drückst Enter, wenn du am Terminal sitzt). Landet der Helfer auf einer **Login-Seite**, bricht er ab und sagt dir, dass du `npm run cf -- login` ausführen sollst. Prüfungen werden nie umgangen.
- Login-Daten liegen nur auf deinem Mac (`~/Library/Application Support/cf-uploader/`) und nie im Git-Repo.

---

## Wenn's hakt

| Problem | Lösung |
|---|---|
| „⚠ … Feld nicht gefunden“ | Dieses Feld selbst ausfüllen. Wenn es immer wieder passiert, hat CurseForge die Seite geändert: Kalibrierung (Menü `i`) für diese Seite wiederholen und Claude Bescheid geben. Angepasst wird nur `scripts/lib/cf-browser/selectors.js`. |
| „👉 … nicht gefunden. Bitte selbst klicken“ | Den Knopf selbst klicken und Enter drücken. Danach macht das Tool weiter. |
| „Das CurseForge-Fenster ist schon offen“ | Das alte Fenster schließen und neu starten. |
| Ausgeloggt / Google: „Anmeldung nicht möglich“ | Helfer-Fenster mit ⌘Q beenden, `npm run cf -- login`, im normalen Chrome einloggen, ⌘Q. |
| Keine offenen Aufgaben, obwohl ein Issue da ist | Der Abend-Workflow hat die Version vielleicht noch nicht freigegeben. Gezielt geht es mit `npm run cf -- update --skinpack <slug> --version 1.3`. |
| Abends geht kein Update raus | Den Abend-Lauf startet der Wecker bei cron-job.org (`ANLEITUNG-wecker.md`). Dort nach Fehlern schauen (meist ist der Schlüssel abgelaufen: 401). Ein Update von Hand: `gh workflow run evening.yml -f force=true -f modId=<slug>`. |
| `git pull` meldet Fehler | Das Tool arbeitet mit dem lokalen Stand weiter. Den Fehler später in Ruhe klären oder Claude fragen. |

---

Die frühere Variante mit Keyboard Maestro steht in `ANLEITUNG-keyboard-maestro.md`, falls du später andere Mac-Apps automatisieren willst.
