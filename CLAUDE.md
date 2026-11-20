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
- Jedes CurseForge-Konto hat sein eigenes Upload-Token: `CF_API_TOKEN_<KONTO>`. Java und Bedrock liegen im selben Konto und nutzen beide `CF_API_TOKEN`, haben aber je ein eigenes Upload-Bein. Ein Token lädt nie in Projekte eines anderen Kontos hoch.
- `npm run projekt -- neu --game <spiel> --id <projectId> --name "<Name>"` trägt ein von Hand angelegtes Projekt ein (`data/projects/<slug>/project.json`, Eintrag in `data/cf-projects.json` mit `kind: "file"`). `npm run projekt -- version …` legt eine vorbereitete Version in den Vorrat, `npm run projekt -- liste` zeigt Stand und fehlende Tokens.
- Der Abend-Lauf hat ein Bein pro Reihe (`account` in `config.games`): eigene Zufallszeit 18 bis 21 Uhr, höchstens 1 Upload pro Tag **je Bein**, 23 Tage Abstand je Projekt, Versionen der Vorgänger-Datei plus alle neueren des Spiels (Minecraft Java: genau die angegebenen Versionen, `carryNewer: false`). Ohne vorbereitete Version passiert nichts.
- Die **erste Datei** eines Projekts lädt nur auf Wort des Betreibers hoch: bei Serien-Projekten ist das Eintragen der Projekt-ID das Go (`npm run serie -- id`), sonst `gh workflow run evening.yml -f force=true -f modId=<slug>`.
- Jedes Update muss eine echte Änderung sein (Moderationsregeln); `scripts/lib/releases.js` lehnt eine unveränderte Datei ab. Vorrat: mindestens 3 Versionen pro Projekt vorbereiten.
- Mods werden nur „von außen“ gebaut, ohne gekauftes Spiel (Vorgabe des Betreibers).

## Die Serie (`npm run serie`, `data/serie/`)
Vier Reihen mit je 33 Projekten (WoW, Minecraft Java, Stardew Valley, Sims 4), pro Reihe **ein Upload am Tag** bis 30.06.2027: erst 33 Tage lang täglich ein neues Projekt, danach reihum Updates. Der Plan steht in `data/serie/<reihe>.json` (Nr, Name, Art, drei geplante Updates), `npm run serie -- plan` schreibt ihn nach `Output/serie/PLAN.md`.
- Ablauf je Projekt: bauen und prüfen → `npm run serie -- vorrat` (Vorrat in `data/projects/<slug>/`, auch schon vor der Projektseite) → `npm run serie -- logo <slug>` (KI-Logo, kostet OpenAI-Guthaben) → `npm run serie -- seite <slug>` (Titelbild, Texte, Seiten-Prüfung nach `Output/serie/<reihe>/<nr>-<slug>/`) → der Betreiber legt das Projekt von Hand an → `npm run serie -- id <slug> <projectId>`. **Das Eintragen der ID ist das Go für die erste Datei**; sie geht abends im Bein der Reihe hoch, vor jedem Update.
- `npm run serie -- heute` zeigt, was anzulegen ist und was abends hochgeht, `npm run serie -- stand` den Vorsprung je Reihe (unter 5 gebauten Projekten braucht die Reihe eine Bau-Nacht), `npm run serie -- namen` prüft Namen gegen CurseForge.
- Quelle je Projekt: `tools/<reihe>/projects/<slug>/` mit `page.json` (Name, Summary, Kategorie, Beschreibung, `logoPrompt`, `cover`), `logo.png`, `changelogs/<version>.md` und dem Quellcode. Die Quelle im Repo ist immer der neueste Stand, die fertigen Dateien jeder Version liegen im Vorrat.
- **Seite** (`scripts/lib/page-check.js`, Regeln aus den CurseForge Moderation Policies): Titel höchstens 30 Zeichen, Englisch, kein Spiel-, Klassen- oder Versionsname. Summary ein Satz, höchstens 150 Zeichen, nicht aus der Beschreibung kopiert. Beschreibung 100 bis 200 Wörter (Sims bis 250): ein fetter Satz, `## Features` (3 bis 5 Punkte), `## How to use`, `## Good to know`, Hinweis auf den Changelog, am Ende `*(The logo is AI-generated.)*`. Logo 400 × 400, Titelbild 1280 × 720 (`tools/serie/cover.js`, gestaltete Grafik, kein nachgestelltes Spielbild). Echte Spielbilder gibt es nur bei Java; für Resource Packs sind sie Pflicht.
- **Nichts Ungeprüftes in den Vorrat.** Jedes Update ist eine echte Änderung mit Changelog; lieber pausiert eine Reihe, als dass Füllmaterial hochgeht. Ähnliche Inhalte gehören in ein Projekt, nicht in mehrere (Fair-Play-Regel). Abgelehnte Projekte nie löschen und neu hochladen.
- **WoW** (`npm run wow -- bau <slug> --version <x.y>` oder `-- test`): reine Lua-Addons ohne Kampfdaten (Midnight sperrt sie). `tools/wow/lib.js` prüft auf Lua 5.1 ohne `os`/`io` und auf vollständige Übersetzungen, `tools/wow/client/` ist der nachgebaute Client für die Lua-Tests (`test.lua` je Addon, braucht `brew install luajit`). „WoW Forever“ (eigener Versionstyp, braucht ein Abo) ist ungetestet; ein Addon wird dafür nur markiert, wenn es ausschließlich alte, stabile Schnittstellen nutzt.
- **Minecraft Java** (`npm run java -- bau <slug> --version <x.y>` oder `-- test`): Data Packs und Resource Packs entstehen aus `tools/java/projects/<slug>/pack.js` und werden gegen die echten Daten der Minecraft-Version geprüft (`tools/java/vanilla.js` holt sie aus Mojangs offiziellen Dateien nach `~/.cache/mod-factory/minecraft/`, über den Datengenerator, ohne Serverstart, braucht `brew install openjdk@21`). Optische Packs brauchen echte Spielbilder, bevor sie online gehen. Ein echter Ladetest im Server bräuchte die Zustimmung zur Minecraft-EULA, die gibt nur der Betreiber.
- **Helfer-Aufträge:** Neue Projekte bauen Helfer nach `tools/wow/BRIEF.md` bzw. `tools/java/BRIEF.md`. Danach Code selbst lesen, Unsicherheiten der Helfer abwägen, Logos ansehen (ähnliche Motive in einer Reihe neu erzeugen), dann `serie seite`, Bau und `serie vorrat`.
- **Banner (720 × 340):** jedes Projekt braucht eins, die Seiten-Prüfung sperrt sonst. Mein Banner rendert `tools/serie/cover.js` (`npm run serie -- banner <slug>`, `serie seite` macht es mit). ChatGPT malt im Fenster des Betreibers ein zweites nach `npm run serie -- chatgpt [<slug> …]` (Aufträge in `Output/chatgpt-bilder/`, Bild zurück als `chatgpt-banner.png` im Projektordner). Bei „Go Banner“: `npm run serie -- banner-vergleich`, die `VERGLEICH.html` als Artifact zeigen, der Betreiber wählt pro Projekt, dann `npm run serie -- banner-wahl <slug> claude|chatgpt`. Ein ChatGPT-Banner setzt den KI-Hinweis `*(The logo and banner are AI-generated.)*` in die Beschreibung; die Wahl steht in `data/serie/<reihe>.json`.

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
