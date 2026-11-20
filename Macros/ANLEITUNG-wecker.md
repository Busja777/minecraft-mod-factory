# Abend-Wecker einrichten (cron-job.org)

**Warum:** GitHubs eigener Zeitplan verschiebt oder verschluckt viele Starts. Bis zum 20.11.2026 lief der Abend-Lauf meist nur nachts um 2 Uhr, also außerhalb des Fensters, und es ging kein Update raus. Ab jetzt startet **cron-job.org** (kostenlos) den Abend-Lauf zwischen 17 und 21 Uhr alle 10 Minuten. Der Upload selbst läuft weiter bei GitHub, genau wie bisher.

Doppelte Starts sind harmlos: Pro Abend und Konto geht höchstens **ein** Update raus. Die Startfreigabe lässt nur zur Tageszeit des Kontos durch. Kurz vor dem Upload prüft der Lauf noch einmal, ob heute schon ein anderer fertig wurde. GitHubs eigener Zeitplan bleibt als Reserve an.

Das Einrichten dauert etwa 10 Minuten und ist nur einmal nötig.

---

## 1. Schlüssel bei GitHub anlegen

Der Schlüssel darf nur eines: in diesem einen Repo Läufe starten.

1. Öffne <https://github.com/settings/personal-access-tokens/new> (Fine-grained token).
2. **Token name:** `Abend-Wecker`
3. **Expiration:** 1 Jahr. Trag dir das Ablaufdatum in den Kalender, dann musst du den Schlüssel erneuern (siehe unten).
4. **Repository access:** *Only select repositories* → `Busja777/minecraft-mod-factory`
5. **Permissions → Repository permissions → Actions:** *Read and write*. Alles andere bleibt auf *No access*. *Metadata: Read* setzt GitHub selbst.
6. **Generate token** → den Schlüssel (`github_pat_…`) kopieren. Er wird nur einmal angezeigt.

## 2. Wecker bei cron-job.org anlegen

1. Konto anlegen auf <https://cron-job.org> (kostenlos) und einloggen.
2. **Dashboard → Cronjobs → Create cronjob**
3. Reiter **Common**:
   - **Title:** `Abend-Lauf Mod Factory`
   - **URL:** `https://api.github.com/repos/Busja777/minecraft-mod-factory/actions/workflows/evening.yml/dispatches`
   - **Execution schedule:** *Custom*
     - Days of month: *Every day*, Days of week: *Every day*, Months: *Every month*
     - Hours: **17, 18, 19, 20**
     - Minutes: **4, 14, 24, 34, 44, 54**
   - **Time zone:** *Europe/Berlin*. Steht oben rechts im Konto oder unter *Advanced*. Bitte prüfen, sonst läuft alles eine Stunde falsch.
   - **Notify me when:** *execution of the cronjob fails* einschalten.
4. Reiter **Advanced**:
   - **Request method:** `POST`
   - **Headers** (vier Stück, je *Add*):
     | Key | Value |
     |---|---|
     | `Authorization` | `Bearer github_pat_…` (dein Schlüssel aus Schritt 1) |
     | `Accept` | `application/vnd.github+json` |
     | `X-GitHub-Api-Version` | `2022-11-28` |
     | `Content-Type` | `application/json` |
   - **Request body:** `{"ref":"main"}`
5. **Create** klicken.

## 3. Testen

1. Beim neuen Cronjob auf **Test run** klicken. Die Antwort muss **204** sein, das heißt „angenommen, kein Inhalt“.
   - **401:** Der Schlüssel ist falsch oder abgelaufen.
   - **403 / 404:** Beim Schlüssel fehlt *Actions: Read and write* oder das Repo.
   - **422:** Im Body steht nicht genau `{"ref":"main"}`.
2. Auf <https://github.com/Busja777/minecraft-mod-factory/actions/workflows/evening.yml> erscheint ein neuer Lauf mit dem Auslöser *workflow_dispatch*. Außerhalb des Fensters endet er nach einigen Sekunden mit „before-slot“ oder „window-over“. Das ist richtig so, es geht dabei nichts hoch.

Am Abend darauf solltest du dort alle 10 Minuten einen Lauf sehen. Genau einer davon hat einen grünen Schritt **update-minecraft**, der das Pack hochlädt.

## Schlüssel erneuern (einmal im Jahr)

GitHub schickt vor dem Ablauf eine Mail. Dann bei GitHub unter *Settings → Developer settings → Fine-grained tokens → Abend-Wecker → Regenerate token* einen neuen Schlüssel erzeugen. Bei cron-job.org im Header `Authorization` den alten Wert durch `Bearer <neuer Schlüssel>` ersetzen. Läuft der Schlüssel unbemerkt ab, meldet cron-job.org per Mail Fehler 401. GitHubs eigener Zeitplan läuft als Reserve weiter.

## Abschalten

Bei cron-job.org den Cronjob deaktivieren und bei GitHub den Schlüssel löschen. Dann gilt wieder nur GitHubs eigener Zeitplan.
