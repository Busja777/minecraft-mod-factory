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
| **Updates** | Nur zur Info, brauchen kein Go (abends, alle 22–25 Tage). |

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
2. Im Menü **`l`** tippen und Enter drücken. Es öffnet sich ein eigenes Chrome-Fenster.
3. Dort **bei CurseForge einloggen**, ganz normal. Danach im Terminal Enter drücken.
   Das Fenster merkt sich den Login. Es ist ein eigenes Profil, dein normales Chrome bleibt unberührt.
4. **Probelauf** (das Tool ist anhand der Screenshots aus deiner `Anleitung_CF.docx` eingestellt):
   `CurseForge.command` starten, „Cover & Media: Glowing Samurai“ wählen und zuschauen. Am Ende **nicht** auf Apply klicken, sondern Fenster schließen.
   Steht in der Zusammenfassung „⚠ … nicht gefunden“, dann im Menü **`i`** wählen, genau diese Seite öffnen, Enter drücken, `q` tippen und Claude Bescheid geben. Claude trägt die echten Namen ein.

---

## Im Alltag

1. GitHub-Issue kommt (neues Projekt oder Skinpack-Update).
2. **Doppelklick auf `CurseForge.command`.** Das Tool holt die neuesten Daten (`git pull`, nur wenn gerade keine lokalen Änderungen offen sind) und zeigt die offenen Aufgaben:
   ```
   Offene Aufgaben:
     1) Skinpack-Update hochladen: Glowing Samurai V1.3
   Weitere:
     2) Cover & Media: Glowing Samurai
   ```
3. Nummer eintippen und Enter drücken. Chrome öffnet sich und füllt alles aus. **Nicht ins Fenster klicken, solange es arbeitet.**
4. Im Terminal steht die Zusammenfassung:
   ```
   ✓ 6 Schritte erledigt, ⚠ 1 bitte selbst prüfen:
      ⚠ Release Type R: Feld nicht gefunden → Release
   Noch zu tun:
      • Game Versions: alle aktuellen 26.x anhaken.
   🛑 Bitte alles im Browser prüfen und SELBST auf Create / Save / Upload klicken.
   ```
5. Prüfen, Rest erledigen und **selbst abschicken**. Danach das Fenster schließen.

**Bei Skinpack-Updates** liegt der neue Beschreibungsabschnitt schon in der **Zwischenablage**. Unter *Description* fügst du ihn **vor „How to install“** mit ⌘V ein.

**Bei neuen Projekten** („Neues Projekt veröffentlichen“) läuft alles in **einem** Durchgang, in der Reihenfolge deiner Anleitung:
1. Das Tool füllt **General → Description → License** aus. Du prüfst und klickst **Create**.
2. Es erkennt die neue **Projekt-ID** selbst und trägt sie ein.
3. **Media:** Es lädt das Cover hoch und setzt den Titel **MCPEDL**. Du klickst **Apply**.
4. **File:** Es lädt die `.mcpack` hoch, setzt Game-Versionen, Release und den Changelog mit Screenshots. Du klickst **Add File**.
5. Es fragt „Hochgeladen? (j/n)“ und plant danach das nächste Update (22–25 Tage).

Danach im Terminal des Repos committen und pushen. Die Bilder in Beschreibung und Changelog werden erst nach dem Push sichtbar.

### Für Terminal-Fans
```bash
cd ~/Desktop/minecraft-mod-factory
npm run cf                                         # Menü
npm run cf -- publish --skinpack <slug>            # neues Projekt komplett (Create → Media → File)
npm run cf -- new    --skinpack <slug>             # oder --mod <id>
npm run cf -- media  --skinpack <slug>             # oder --mod <id>
npm run cf -- update --skinpack <slug> [--version 1.3]
npm run cf -- login                                # neu einloggen
npm run cf -- inspect                              # Seiten für die Kalibrierung speichern
```

---

## Sicherheit: was das Tool tut und was nicht

- Es läuft **sichtbar** in Google Chrome, in normalem Tempo, ein Projekt pro Lauf.
- Es klickt **nie** auf *Create*, *Save*, *Upload*, *Submit*, *Delete* usw. Das ist fest eingebaut und getestet.
- Kommt eine **Login- oder „Bist du ein Mensch?“-Prüfung**, hält es an. Du löst sie selbst im Browser und drückst Enter. Prüfungen werden nie umgangen.
- Login-Daten liegen nur auf deinem Mac (`~/Library/Application Support/cf-uploader/`) und nie im Git-Repo.

---

## Wenn's hakt

| Problem | Lösung |
|---|---|
| „⚠ … Feld nicht gefunden“ | Dieses Feld selbst ausfüllen. Wenn es immer wieder passiert, hat CurseForge die Seite geändert: Kalibrierung (Menü `i`) für diese Seite wiederholen und Claude Bescheid geben. Angepasst wird nur `scripts/lib/cf-browser/selectors.js`. |
| „👉 … nicht gefunden. Bitte selbst klicken“ | Den Knopf selbst klicken und Enter drücken. Danach macht das Tool weiter. |
| „Das CurseForge-Fenster ist schon offen“ | Das alte Fenster schließen und neu starten. |
| Ausgeloggt | Menü `l` und neu einloggen. |
| Keine offenen Aufgaben, obwohl ein Issue da ist | Der Abend-Workflow hat die Version vielleicht noch nicht freigegeben. Gezielt geht es mit `npm run cf -- update --skinpack <slug> --version 1.3`. |
| `git pull` meldet Fehler | Das Tool arbeitet mit dem lokalen Stand weiter. Den Fehler später in Ruhe klären oder Claude fragen. |

---

Die frühere Variante mit Keyboard Maestro steht in `ANLEITUNG-keyboard-maestro.md`, falls du später andere Mac-Apps automatisieren willst.
