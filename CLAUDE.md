# Arbeitsregeln für dieses Repo

## Zu Beginn jeder Sitzung
`npm run notes` ausführen. Das listet die „Ändern“-Notizen, die der Betreiber im **Minecraft Studio** an neuen Skinpacks/Mods hinterlassen hat (pro Teil: Name, Summary, Logo, Cover, einzelner Skin, Beschreibung, Changelog, Datei), samt Datei und Befehl.
- Jede Notiz umsetzen, Ergebnis prüfen, dann `npm run notes -- --erledigt <key>:<teil>`.
- Sind alle Notizen eines Packs erledigt, liegt es automatisch wieder im Studio zur Prüfung (neue Runde, geänderte Teile sind markiert).
- Das Studio setzt selbst nichts um und gibt nie selbst „Go“. Go gibt nur der Betreiber.

## Freigabe-Ablauf (Studio, `scripts/lib/review.js`)
`zur-pruefung` → (Notizen) → `ueberarbeiten` → (Claude erledigt) → `zur-pruefung` → **Go** → `geplant` (Termin im Morgenfenster an einem Upload-Tag, max. 1 neues Projekt pro Tag) → `faellig` → Komplettlauf `npm run cf -- publish` → `veroeffentlicht`.
- Nur **neue** Projekte brauchen Go. Updates bestehender Projekte laufen ohne Freigabe: höchstens 1 Update pro Tag, abends zur Zufallszeit zwischen 18 und 21 Uhr; die Packs kommen reihum dran (am längsten ohne Update zuerst), jedes frühestens 23 Tage nach seinem letzten Upload (echtes Datum von CurseForge). Jede Datei bekommt alle Game-Versionen der Vorgänger-Datei plus die neuesten Minecraft-Versionen.
- Go ist gesperrt bei offenen Notizen oder roten Prüfungen (`scripts/lib/checks.js`: Bildgrößen, < 2 MB, Name/Summary-Regeln, KI-Hinweis, Screenshots, MCPEDL, .mcpack).
- Zustand pro Projekt in `data/skins/<slug>/review.json` bzw. `data/mods/<id>/review.json` (in Git).

## Weitere Spiele (`npm run projekt`, `scripts/release.js`)
Grundsatz: Ein Projekt wird **einmal von Hand** auf CurseForge angelegt, danach laufen Updates von selbst über die Upload-API (nur Datei + Changelog; Beschreibung und Galerie bleiben, wie sie angelegt wurden). Für diese Spiele gibt es keinen Browser-Ablauf.
- Spiele-Register: `config.json` → `games`. Ein Spiel kommt nur hinein, wenn die Upload-API seine eigene Versionsliste liefert (geprüft am 2026-11-20: Java, Bedrock, Stardew Valley, WoW, Sims 4, Palworld; Hytale und inZOI haben keine API; Subnautica 2, ARK SA, Hogwarts Legacy, Windrose liefern nur den Platzhalter „1.0“ und sind ungeprüft).
- Jedes CurseForge-Konto hat sein eigenes Upload-Token: `CF_API_TOKEN_<KONTO>` (Konto = Spiel-Schlüssel; Java und Bedrock teilen sich das Konto `minecraft` mit `CF_API_TOKEN`). Ein Token lädt nie in Projekte eines anderen Kontos hoch.
- `npm run projekt -- neu --game <spiel> --id <projectId> --name "<Name>"` trägt ein von Hand angelegtes Projekt ein (`data/projects/<slug>/project.json`, Eintrag in `data/cf-projects.json` mit `kind: "file"`). `npm run projekt -- version …` legt eine vorbereitete Version in den Vorrat, `npm run projekt -- liste` zeigt Stand und fehlende Tokens.
- Der Abend-Lauf hat ein Bein pro Konto: eigene Zufallszeit 18 bis 21 Uhr, höchstens 1 Update pro Tag **je Konto**, 23 Tage Abstand je Projekt, Versionen der Vorgänger-Datei plus alle neueren des Spiels. Ohne vorbereitete Version passiert nichts.
- Die **erste Datei** eines Projekts ohne Datei lädt nie von selbst hoch, nur auf Wort des Betreibers: `gh workflow run evening.yml -f force=true -f modId=<slug>`.
- Jedes Update muss eine echte Änderung sein (Moderationsregeln); `scripts/lib/releases.js` lehnt eine unveränderte Datei ab. Vorrat: mindestens 3 Versionen pro Projekt vorbereiten.
- Mods werden nur „von außen“ gebaut, ohne gekauftes Spiel (Vorgabe des Betreibers). Reihenfolge: WoW, Java, Sims 4 (Script-Mods), Stardew zuletzt.
- WoW-Addon **Gold Diary**: Quelle in `tools/wow/gold-diary/` (`src/GoldDiary/`, Changelogs in `changelogs/`, Logo in `art/`). `npm run gold-diary -- --version <x.y>` prüft auf Lua 5.1 ohne `os`/`io`, lässt die Lua-Tests gegen den nachgebauten Client laufen (`test/wow.lua`, braucht `brew install luajit`) und baut `Output/gold-diary/GoldDiary-<x.y>.zip`. Kein Kampf-API (Midnight sperrt Kampfdaten), getestet wird in der kostenlosen Testversion bis Level 20.

## CurseForge-Helfer (`npm run cf`)
- **Tages-Go:** Schreibt der Betreiber „Go“ (für den Tag, die Uploads, die Beschreibungen), dann `npm run cf -- heute --ohne-enter` im Hintergrund starten und die Ausgabe berichten. Vorher mit `npm run cf -- heute --dry-run` zeigen, was ansteht. Der Helfer füllt aus und erkennt die Klicks selbst; Save / Create / Apply / Add File klickt immer der Betreiber. Danach committet und pusht der Helfer `data/` selbst und schließt das Update-Issue.
- Klickt nie selbst auf Create / Save / Apply / Upload / Add File im Formular (`FORBIDDEN_CLICK`, `FORBIDDEN_AFTER_EDIT` in `scripts/lib/cf-browser/selectors.js`). Daran nichts lockern.
- Alle Seiten-Ziele stehen in `selectors.js`. Wenn CurseForge seine Seiten ändert, nur dort anpassen (`npm run cf -- inspect` speichert die echte Seitenstruktur).
- Keine Umgehung von Login-, Captcha- oder Cloudflare-Prüfungen. Der Helfer wartet, bis der Betreiber sie selbst löst.

## Ein Arbeitsordner
Alles liegt in diesem Repo; es gibt keinen zweiten Ordner mehr (früher `~/Desktop/Macros`).
- `Macros/`: Doppelklick-Starter (`Studio.command`, `CurseForge.command`) und Anleitungen. Die Starter finden das Repo selbst und pullen nur bei sauberem Arbeitsstand.
- `Macros/aktuell/`: Übergabe für Keyboard Maestro, schreibt nur `npm run macro` (Standard-Ziel). Nie von Hand befüllen, nie committen.
- Lokale Arbeits-/Erzeugnisordner sind git-ignoriert und werden nie committet: `Macros/aktuell/`, `Output/` (gebaute Packs, Screenshots), `Input/` (Referenzen), `previews/`.
- Neue Ausgaben gehören in `Output/` (oder den Downloads-Ordner, wenn der Betreiber es so will), nicht verstreut ins Repo oder auf den Schreibtisch.

## Allgemein
- Skinpacks: Galerie-Bilder nur beim neuen Projekt (Cover, Titel MCPEDL). Screenshots von Updates gehören in die Beschreibung (und in den Changelog), nie in die Galerie.
- Texte für den Betreiber auf Deutsch, Du-Form. CurseForge-Texte (Name, Summary, Beschreibung, Changelog) auf Englisch.
- `npm test` muss grün bleiben. Neue Logik bekommt Tests (`node:test`), Browser-Abläufe einen Fixture-Test (`tests/fixtures/`).
- Secrets nur in `secrets.env` (wird automatisch geladen, nie ausgeben, nie committen).
