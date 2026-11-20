# CurseForge-Makros mit Keyboard Maestro

Ziel: Die Handarbeit auf CurseForge (neues Projekt anlegen, Skinpack-Update hochladen) macht ein Makro.
Du drückst einen Hotkey, das Makro füllt alles aus und **hält vor „Create“ / „Save“ an**. Du schaust kurz drüber und klickst selbst.

Die `.jar`-Uploads der Mods laufen schon automatisch über die CurseForge-API (GitHub Actions). Dafür brauchst du kein Makro.

---

## So läuft es im Alltag

```bash
cd ~/Desktop/minecraft-mod-factory
git pull                                                    # Daten aus GitHub Actions holen
npm run macro -- --skinpack glowing-samurai --update        # oder eine der Varianten unten
```
Danach Chrome öffnen und den Hotkey drücken.

| Situation (GitHub-Issue) | Befehl | Makro |
|---|---|---|
| `cf-project-needed`, Mod | `npm run macro -- --mod <modId>` | ⌃⌥N „CF: Neues Projekt“ |
| `cf-project-needed`, Skinpack | `npm run macro -- --skinpack <slug>` | ⌃⌥N „CF: Neues Projekt“ |
| `cf-page-refresh` | `npm run macro -- --skinpack <slug> --refresh` | ⌃⌥M „CF: Cover & Media“ |
| `cf-skin-update` | `npm run macro -- --skinpack <slug> --update` | ⌃⌥U „CF: Skinpack-Update“ |

Der Befehl schreibt alles in **`~/Desktop/minecraft-mod-factory/Macros/aktuell/`**, immer unter denselben Dateinamen:

| Datei | Inhalt |
|---|---|
| `name.txt`, `slug.txt`, `summary.txt` | Projektname, Slug, Kurzbeschreibung |
| `klasse.txt`, `kategorie.txt`, `zusatz-kategorien.txt` | z. B. Skins / Players / Skin Packs |
| `lizenz.txt`, `verbreitung.txt`, `quellcode.txt` | Lizenz, Distribution, Source Code |
| `beschreibung.md` | die komplette Projektbeschreibung |
| `logo-pfad.txt`, `cover-pfad.txt` | voller Pfad zu Logo und Cover (Ordner `logo/`, `cover/`) |
| `media-titel.txt`, `media-beschreibung.txt` | „MCPEDL“ (Skinpacks) bzw. Mod-Name und der Cover-Dateiname |
| `datei-pfad.txt`, `datei-name.txt` | die `.mcpack`-Datei (Ordner `upload/`), nur bei Skinpacks |
| `changelog.md`, `beschreibungs-abschnitt.md`, `version.txt` | nur bei `--update` |
| `typ.txt` | `mod`, `skinpack-neu`, `skinpack-auffrischen` oder `skinpack-update` |
| `CHECKLISTE.md` | das normale Kit zum Nachlesen |

Weil die Pfade fest sind, musst du die Makros **nie** anpassen. Es ändert sich nur der Ordnerinhalt.
Die Dateien haben am Ende keinen Zeilenumbruch, damit beim Einfügen nicht versehentlich Enter gedrückt wird.

---

## 1. Einmalig: Keyboard Maestro einrichten (≈ 10 Min.)

1. Download auf **keyboardmaestro.com**. Die App ist 30 Tage gratis und kostet danach einmalig.
2. Beim ersten Start fragt macOS nach Rechten: **Systemeinstellungen → Datenschutz & Sicherheit**
   - **Bedienungshilfen**: „Keyboard Maestro“ **und** „Keyboard Maestro Engine“ erlauben
   - **Bildschirmaufnahme**: „Keyboard Maestro Engine“ erlauben. Das braucht die Bildsuche („Found Image“).
3. In Keyboard Maestro links unten **+** → neue **Makro-Gruppe** mit dem Namen `CurseForge`.
   - Rechts bei der Gruppe: **„Available in these applications“ → Google Chrome**. Die Hotkeys gelten dann nur in Chrome.
4. In Chrome bei CurseForge **eingeloggt bleiben**. Das Makro loggt sich nie selbst ein.

### Bausteine, die du immer wieder brauchst
Aktionen fügst du rechts über **„New Action“** (oder ⌘K) hinzu und suchst sie per Namen:

| Baustein | Aktion in KM | Einstellung |
|---|---|---|
| Wert laden | **Read a File** | „Read text file `~/Desktop/minecraft-mod-factory/Macros/aktuell/name.txt` to Variable `CF_Name`“ |
| Wert einfügen | **Insert Text by Pasting** | Text: `%Variable%CF_Name%` |
| In ein Feld klicken | **Move or Click Mouse** | „Click at (x, y) from the **found image**“. Screenshot vom Feld-Label reinziehen, Offset so wählen, dass der Klick im Eingabefeld landet. |
| Warten | **Pause** | 0,5–1 Sekunde zwischen den Schritten |
| Warten bis geladen | **Pause Until** | Bedingung „Found Image“: Screenshot eines Elements, das erst nach dem Laden erscheint |
| Taste drücken | **Type a Keystroke** | z. B. ⇥ (Tab), ↩ (Enter) |
| Stopp-Hinweis | **Alert** | Text: „Bitte prüfen und selbst auf Create klicken.“ |

**Warum „Found Image“ statt fester Mauskoordinaten?** Das Makro sucht das Label „Project name“ auf dem Bildschirm und klickt daneben. Dadurch ist egal, wo das Chrome-Fenster liegt, wie groß es ist und wie weit gescrollt ist. Feste Koordinaten (wie beim „Record“-Knopf) brechen beim ersten verschobenen Fenster.

Screenshot fürs Image-Feld: **⌃⇧⌘4**, dann einen Rahmen um das Label ziehen. Der Screenshot landet in der Zwischenablage, und du fügst ihn mit ⌘V ins Image-Feld der Aktion ein. Nimm nur das Label, nicht das leere Feld daneben.

---

## 2. Unter-Makro „Datei wählen“ (das Herzstück)

Damit lädt jedes Makro Dateien hoch. Browser-Erweiterungen dürfen das macOS-Dateifenster nicht bedienen, Keyboard Maestro schon.

1. Neues Makro in der Gruppe `CurseForge`, Name: **`Datei wählen`**
2. Trigger: **„This macro is triggered by: Subroutine“**, Parameter: `Local_Pfad`
3. Aktionen:
   1. **Pause** 1 s (das Dateifenster öffnet sich)
   2. **Type a Keystroke** ⌘⇧G („Gehe zu Ordner“)
   3. **Pause** 0,5 s
   4. **Insert Text by Pasting** `%Variable%Local_Pfad%`
   5. **Pause** 0,5 s
   6. **Type a Keystroke** ↩ (springt zur Datei und markiert sie)
   7. **Pause** 0,5 s
   8. **Type a Keystroke** ↩ (öffnet bzw. lädt hoch)

Aufruf aus anderen Makros: Aktion **Execute a Subroutine** → `Datei wählen`, Parameter z. B. `%Variable%CF_LogoPfad%`.
Vorher muss das Makro auf den Upload-Knopf der Seite geklickt haben, damit das Dateifenster aufgeht.

---

## 3. Makro „CF: Neues Projekt“ (⌃⌥N)

Trigger: **Hot Key ⌃⌥N**

**Gruppe „Werte laden“** (Aktion **Group**, damit es übersichtlich bleibt). Darin je eine **Read a File**:
`name.txt → CF_Name`, `summary.txt → CF_Summary`, `kategorie.txt → CF_Kategorie`, `zusatz-kategorien.txt → CF_Zusatz`,
`lizenz.txt → CF_Lizenz`, `verbreitung.txt → CF_Verbreitung`, `quellcode.txt → CF_Quellcode`, `beschreibung.md → CF_Beschreibung`,
`logo-pfad.txt → CF_LogoPfad`, `cover-pfad.txt → CF_CoverPfad`, `media-titel.txt → CF_MediaTitel`, `media-beschreibung.txt → CF_MediaBeschreibung`.

**Ablauf.** Das baust du einmal, während du das Formular selbst offen hast:
1. **Open URL** `https://authors.curseforge.com`, dann **Pause Until** (Found Image: der „Start Project“-Knopf)
2. Klick auf „Start Project“, dann das Spiel (Minecraft bzw. Minecraft Bedrock), dann die Klasse (Mods bzw. Skins). Je ein **Move or Click Mouse** mit Found Image und dazwischen **Pause** 1 s.
3. Pro Textfeld zwei Aktionen, nämlich **Klick neben das Label** und **Insert Text by Pasting**:
   - Project name → `%Variable%CF_Name%`
   - Summary → `%Variable%CF_Summary%`
   - Source Code → `%Variable%CF_Quellcode%`
4. **Dropdowns** (Main category, License, Distribution): ins Dropdown klicken, den Wert einfügen (`%Variable%CF_Kategorie%` usw.) und **↩** drücken. Die meisten Dropdowns springen beim Tippen zum passenden Eintrag. Wenn ein Dropdown zickt, lass es weg und wähl es beim Prüfen am Ende selbst. Halbautomatisch ist völlig okay.
5. **Häkchen**: Allow Comments an, Unlisted aus, Project Pages aus. Das sind meistens schon die Standardwerte, dann brauchst du dafür keine Aktion.
6. **Logo**: Klick auf den Logo-Upload, danach **Execute a Subroutine** `Datei wählen` mit `%Variable%CF_LogoPfad%`.
7. **Beschreibung**: ins Description-Feld klicken, `%Variable%CF_Beschreibung%` einfügen.
8. **Alert**: „Alles ausgefüllt. Bitte prüfen und selbst auf **Create** klicken. Danach Cover über ⌃⌥M hochladen.“

> Das Makro klickt **nie** selbst auf Create. Das ist Absicht.

Danach wie bisher die Projekt-ID in `data/cf-projects.json` eintragen, committen und pushen.
Bei neuen Skinpacks lädst du die erste Datei mit ⌃⌥U hoch. Der Ordner enthält dafür schon `datei-pfad.txt`.

---

## 4. Makro „CF: Cover & Media“ (⌃⌥M)

Für neue Projekte (nach Create) und für `cf-page-refresh`. Du startest es, wenn die Projektseite offen ist.

1. Werte laden: `cover-pfad.txt → CF_CoverPfad`, `media-titel.txt → CF_MediaTitel`, `media-beschreibung.txt → CF_MediaBeschreibung`
2. Klick auf den Reiter **Media** und dann auf **Upload / Add Image**
3. **Execute a Subroutine** `Datei wählen` mit `%Variable%CF_CoverPfad%`
4. Title-Feld: `%Variable%CF_MediaTitel%`. Bei Skinpacks muss das genau **MCPEDL** sein, sonst übernimmt MCPEDL das Cover nicht.
5. Description-Feld: `%Variable%CF_MediaBeschreibung%`
6. Klick auf den Stern **Feature Media**
7. **Alert**: „Prüfen und selbst speichern.“

Beim Auffrischen (`--refresh`) zusätzlich: altes Cover vorher selbst löschen, Logo und Summary unter *General* ersetzen und die Beschreibung komplett ersetzen. Das geht mit denselben Bausteinen wie in Makro 3.

---

## 5. Makro „CF: Skinpack-Update“ (⌃⌥U)

Du startest es, wenn die Projektseite des Skinpacks offen ist.

1. Werte laden: `datei-pfad.txt → CF_DateiPfad`, `changelog.md → CF_Changelog`, `beschreibungs-abschnitt.md → CF_Abschnitt`
2. Reiter **Files**, dann **Add File** anklicken und **Pause Until** Found Image (Upload-Bereich)
3. Klick auf den Upload-Bereich, dann **Execute a Subroutine** `Datei wählen` mit `%Variable%CF_DateiPfad%`
4. Changelog-Feld: `%Variable%CF_Changelog%`
5. Release Type **R** anklicken
6. Game Versions: alle aktuellen **26.x** anhaken. Wenn die Liste sich oft ändert, mach das beim Prüfen selbst.
7. **Alert**: „Datei bereit. Bitte prüfen und selbst hochladen.“
8. Danach **Set Clipboard to Text** `%Variable%CF_Abschnitt%` und dann **Alert**: „Der neue Beschreibungsabschnitt ist in der Zwischenablage. In *Description* **vor ‚How to install‘** einfügen.“

Die `.mcpack` behält ihren Originalnamen. Daran erkennt der nächste Lauf von `skin-release.js` deinen Upload, also bitte nicht umbenennen.

---

## Nicht blockiert werden

CurseForge (und jede andere Seite) blockt Dinge, die nach **Spam oder Bot-Netz** aussehen. Du automatisierst dagegen nur deine eigene Arbeit in deinem eigenen Account. So bleibt das unauffällig:

- **Dein echtes Chrome mit deinem Login.** Keine separaten Browser, keine Logins per Makro.
- **Menschliches Tempo.** Zwischen den Schritten 0,5–1 s Pause. Das Makro ist trotzdem viel schneller als du, weil es nicht suchen, kopieren und tippen muss.
- **Kein Massenbetrieb.** Ein Projekt, ein Lauf. Die Pipeline hält sich schon an die CurseForge-Regeln (mindestens 23 Tage Abstand, echte Änderungen), und das Makro ändert daran nichts.
- **Captcha, 2FA und Login machst immer du.** Wenn so etwas auftaucht, brich das Makro ab (Menüleisten-Icon von KM → „Cancel All Macros“), erledige es und starte das Makro neu. Captchas automatisch zu umgehen verstößt gegen die Regeln und ist der sichere Weg zur Sperre.
- **Den letzten Klick machst du.** So geht nie etwas Falsches raus.

---

## Wenn's hakt

| Problem | Lösung |
|---|---|
| Makro klickt daneben oder findet ein Bild nicht | CurseForge hat das Layout geändert. Für **diesen einen Schritt** den Screenshot neu aufnehmen (⌃⇧⌘4 und ins Image-Feld einfügen). Der Rest bleibt. |
| „Found Image“ findet nie etwas | Rechte unter **Bildschirmaufnahme** für die Keyboard Maestro Engine prüfen. Chrome-Zoom auf 100 % stellen. |
| Text wird nicht eingefügt | Vor dem Einfügen ist die Pause zu kurz, auf 1 s erhöhen. |
| Dateifenster bleibt offen | In „Datei wählen“ die erste Pause auf 1,5 s erhöhen. |
| `npm run macro` meldet fehlende Dateien | Erst `git pull`, weil die Daten aus GitHub Actions kommen. |
| `--update` meldet „wartet keine Version“ | Der Abend-Workflow hat noch nichts freigegeben. Mit `--version 1.3` wählst du gezielt eine Version. |
| Makro läuft Amok | Menüleisten-Icon von KM → **Cancel All Macros** (oder Hotkey dafür in den KM-Einstellungen festlegen). |

**Tipp zum Bauen:** Bau jedes Makro, während das CurseForge-Formular daneben offen ist, und teste nach jedem zweiten Schritt mit dem **Try**-Knopf in KM. Und ein Projekt anlegen, ohne auf Create zu klicken, kostet nichts. Damit kannst du gefahrlos üben.

**Später vielleicht ganz ohne Makro:** Wenn ein Test-Upload mit `"uploadApi": true` (in `config.json` → `bedrock`) auf einem Bedrock-Projekt funktioniert (siehe README), lädt die Pipeline Skinpack-Dateien selbst hoch. Dann bleibt beim Update nur noch der Beschreibungsabschnitt.
