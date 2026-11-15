# Arbeitsregeln für dieses Repo

## Zu Beginn jeder Sitzung
`npm run notes` ausführen. Das listet die „Ändern“-Notizen, die der Betreiber im **Minecraft Studio** an neuen Skinpacks/Mods hinterlassen hat (pro Teil: Name, Summary, Logo, Cover, einzelner Skin, Beschreibung, Changelog, Datei), samt Datei und Befehl.
- Jede Notiz umsetzen, Ergebnis prüfen, dann `npm run notes -- --erledigt <key>:<teil>`.
- Sind alle Notizen eines Packs erledigt, liegt es automatisch wieder im Studio zur Prüfung (neue Runde, geänderte Teile sind markiert).
- Das Studio setzt selbst nichts um und gibt nie selbst „Go“. Go gibt nur der Betreiber.

## Freigabe-Ablauf (Studio, `scripts/lib/review.js`)
`zur-pruefung` → (Notizen) → `ueberarbeiten` → (Claude erledigt) → `zur-pruefung` → **Go** → `geplant` (Termin im Morgenfenster an einem Upload-Tag, max. 1 neues Projekt pro Tag) → `faellig` → Komplettlauf `npm run cf -- publish` → `veroeffentlicht`.
- Nur **neue** Projekte brauchen Go. Updates bestehender Projekte laufen ohne Freigabe (Abendfenster, alle 22–25 Tage).
- Go ist gesperrt bei offenen Notizen oder roten Prüfungen (`scripts/lib/checks.js`: Bildgrößen, < 2 MB, Name/Summary-Regeln, KI-Hinweis, Screenshots, MCPEDL, .mcpack).
- Zustand pro Projekt in `data/skins/<slug>/review.json` bzw. `data/mods/<id>/review.json` (in Git).

## CurseForge-Helfer (`npm run cf`)
- Klickt nie selbst auf Create / Save / Apply / Upload / Add File im Formular (`FORBIDDEN_CLICK`, `FORBIDDEN_AFTER_EDIT` in `scripts/lib/cf-browser/selectors.js`). Daran nichts lockern.
- Alle Seiten-Ziele stehen in `selectors.js`. Wenn CurseForge seine Seiten ändert, nur dort anpassen (`npm run cf -- inspect` speichert die echte Seitenstruktur).
- Keine Umgehung von Login-, Captcha- oder Cloudflare-Prüfungen. Der Helfer wartet, bis der Betreiber sie selbst löst.

## Allgemein
- Texte für den Betreiber auf Deutsch, Du-Form. CurseForge-Texte (Name, Summary, Beschreibung, Changelog) auf Englisch.
- `npm test` muss grün bleiben. Neue Logik bekommt Tests (`node:test`), Browser-Abläufe einen Fixture-Test (`tests/fixtures/`).
- Secrets nur in `secrets.env` (wird automatisch geladen, nie ausgeben, nie committen).
