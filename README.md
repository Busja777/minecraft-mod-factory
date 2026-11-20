# Minecraft Mod Factory

Automated pipeline that generates small Fabric 1.21.1 QoL mods with Claude, builds them with Gradle and publishes them to **CurseForge** (Modrinth is kept as an optional platform).

## How it works

Two workflows in **Europe/Berlin** time with a randomized daily slot. Only `evening.yml` runs on a schedule; `morning.yml` is manual-start for now (new projects go through the local Studio):

| Workflow | Window | What happens |
|---|---|---|
| `morning.yml` | 06:00–12:00, once per day at a random minute | 1) Uploads every pending mod whose CurseForge project ID you entered. 2) On `newModDays` (default Mon/Wed/Fri/Sat): Claude designs a new mod (incl. a short legend) → ChatGPT logo `<Name>.png` (400×400) and cover `<Name> Cover.png` (720×340) → source stored in `data/mods/<modId>/` → Gradle build (one auto-fix retry) → **project kit** committed and a GitHub issue (`cf-project-needed`) asks you to create the CurseForge project. |
| `evening.yml` | 18:00–21:00, once per day and CurseForge account at a random minute | Picks the next published project in the cycle (longest without an update first, at least **23 days** after its last upload as CurseForge reports it), lets Claude implement one real improvement, bumps the minor version and uploads the new file with a changelog. Nothing due → nothing happens. |

**Your part:** create the project on https://authors.curseforge.com from the kit (name, summary, category, icon, description), put the numeric project ID into `data/cf-projects.json` (`"projectId": 123456`), commit, push. The next morning run uploads it. For an immediate upload run *Actions → Morning → Run workflow* with `force = true`.

**Minecraft Studio (local review dashboard):** `npm run studio` opens http://127.0.0.1:4747. New projects (skin packs without a CurseForge id, pending mods) wait there for your **Go**. Every part (name, summary, logo, cover, each skin, description, changelog, file) has its own "Ändern" note; notes go to Claude (`npm run notes`, then `npm run notes -- --erledigt <key>:<part>`), and the pack comes back for the next round. Go is blocked while notes are open or automatic checks (`scripts/lib/checks.js`) are red, and plans the upload into the morning window of the next free upload day (`config.newModDays`, one new project per day). `npm run studio -- tick` marks reached slots as due and sends a macOS notification; `npm run studio -- zeitplan-installieren` runs it every 30 minutes via launchd. Updates of existing projects need no Go. State: `review.json` next to `pack.json` / `mod.json`. Double-click launcher: `Macros/Studio.command`.

**Browser helper for the forms without API:** `npm run cf` shows a menu of open chores (new project, cover/media, skin pack file). It fills the CurseForge forms in your installed Chrome (own profile in `~/Library/Application Support/cf-uploader/`, log in once via `npm run cf -- login`), pauses for login or security checks, and **never clicks Create/Save/Upload**. After an API upload the menu offers "Beschreibung nachziehen" (`npm run cf -- seite`): it fills the full description (update screenshots included), then reads it back through the Core API to see whether the operator saved it. Skin pack galleries only get images for new projects (cover titled MCPEDL), never for updates (state in `~/Library/Application Support/cf-uploader/pages.json`, not in git). All page targets live in `scripts/lib/cf-browser/selectors.js` (`npm run cf -- inspect` saves page structures to recalibrate). Double-click launcher and guide: `Macros/CurseForge.command`, `Macros/ANLEITUNG.md`.

**Keyboard Maestro hand-over:** `npm run macro -- --mod <id>` / `--skinpack <slug> [--refresh | --update [--version x]]` writes every form value, image and file under fixed names to `Macros/aktuell/` in this repo (git-ignored, `--out` to change). The macros (guide: `Macros/ANLEITUNG-keyboard-maestro.md`) fill in the CurseForge forms and stop before *Create*.

**How the random slot works:** the cron fires every 30 minutes inside each window. A light `gate` job derives today's slot from a hash of the date, checks via the GitHub API whether the heavy job already ran today, and only then starts the heavy job (sleeping up to 30 min to hit the exact minute). Late or dropped cron fires are caught up later in the same window. Scheduled workflows only run on the default branch, and GitHub disables them after 60 days without repository activity.

## Other games: create once, updates by API

A project of another game is created **once by hand** on CurseForge; from then on the evening run uploads its prepared versions through the upload API (file + changelog only, the page stays as created).

- **Games** live in `config.json` → `games` (`gameEndpoint`, Core `gameId`, `urlSection`, optional `versionTypes`). Registered: Minecraft Java, Minecraft Bedrock, Stardew Valley, World of Warcraft, The Sims 4. A game only belongs there if `https://<slug>.curseforge.com/api/game/versions` returns its own version list with a token (an unknown slug answers with the placeholder list `1.0`; Hytale and inZOI have no upload API).
- **Accounts:** every game is its own CurseForge account with its own upload token `CF_API_TOKEN_<ACCOUNT>` (e.g. `CF_API_TOKEN_STARDEWVALLEY`); Java and Bedrock are in the same account and share `CF_API_TOKEN`. `npm run secrets:push` uploads every `CF_API_TOKEN_*` from `secrets.env`.
- **Evening run:** one leg per `account` in `config.games` that has something to upload (job `update-<account>`; Java and Bedrock are two legs), each with its own random slot between 18:00 and 21:00 and at most one upload per day. A file gets every game version of the previous file plus all newer releases of the game; a Minecraft Java file gets exactly the versions it was built for (`carryNewer: false`).
- **First file** of a project only uploads on the operator's word: for a series project that is entering its project ID (`npm run serie -- id`), otherwise `gh workflow run evening.yml -f force=true -f modId=<slug>`. A forced run needs `modId` or `account` and starts exactly one account.

```bash
npm run projekt -- neu --game stardewvalley --id 123456 --name "Cozy Farm"      # register a project created by hand
npm run projekt -- version --project cozy-farm --version 1.1 --file Output/cozy-farm/CozyFarm-1.1.zip --changelog Output/cozy-farm/v1.1.md
npm run projekt -- liste                                                        # tokens, prepared versions, next date
node scripts/release.js --project cozy-farm --dry-run                           # show the upload, change nothing
```

Storage: `data/projects/<slug>/project.json` and `data/projects/<slug>/files/`; the queue entry in `data/cf-projects.json` has `kind: "file"` and `game`.

## The series: 33 projects per game, one upload per game and day

`data/serie/<reihe>.json` holds four rows of 33 projects (World of Warcraft, Minecraft Java, Stardew Valley, The Sims 4) with their planned updates. Each row uploads one file per evening: a new project per day for 33 days, then updates in turns.

- **Source** of a project: `tools/<reihe>/projects/<slug>/` (`page.json`, `logo.png`, `changelogs/`, code). Built, checked files go into the stock under `data/projects/<slug>/`, also before the CurseForge page exists.
- **Page:** `npm run serie -- logo <slug>` makes the AI logo, `npm run serie -- seite <slug>` renders the title image (`tools/serie/cover.js`), writes the texts to `Output/serie/<reihe>/<nr>-<slug>/` and runs the page check (`scripts/lib/page-check.js`: title, one-sentence summary, short description in four fixed parts, image sizes).
- **Go:** the operator creates the page by hand and runs `npm run serie -- id <slug> <projectId>`. That entry is `pending` with `autoStart`, so the row's evening leg uploads V1.0 before any update.
- `npm run serie -- heute | stand | plan | namen` show the day, the head start per row, the calendar and free names.
- **World of Warcraft:** `npm run wow -- bau <slug> --version 1.0` checks the addon (Lua 5.1 only, complete TOC, translations) and runs its Lua tests against a stand-in client (`tools/wow/client/`, needs LuaJIT) before it writes the zip.

## Skin packs (CurseForge Bedrock)

Old packs from the local folder (`V1/`, `U1…Un/`) are imported once; afterwards the evening window releases one prepared version (`Un`) per pack in turn, each pack at least 23 days apart, mixed with mod updates (one update per evening in total). Every upload ticks the game versions of the previous file plus the newest Minecraft releases.

```bash
# 0. Overview of all projects: what is on CurseForge, what is prepared, the evening schedule
npm run bestand          # → Output/bestand/BESTAND.md + bestand.csv (folder mapping: data/bestand.json)
# 1. Import (reads every .mcpack, syncs the upload state from CurseForge via CF_CORE_API_KEY)
node scripts/import-skinpack.js "/path/to/MCPE/Glowing Samurai" --project 1498885
#    --skip U3,U4   leave out stage folders that need a check · --renumber   close gaps (U2 without U1)
#    a V1 missing locally is taken from CurseForge; stages sharing one .mcpack name are stored as <name>_V1_x.mcpack
# 2. Refresh the project page: Actions → "Skin pack — refresh project page" (pack = slug)
#    → 3D renders, legend/summary/notes (Claude), logo + cover (ChatGPT), issue with the full kit
```

- **Cover:** upload `<Name> Cover.png` under *Media* with the title **MCPEDL** (MCPEDL takes the cover from there), description `<Name> Cover.png`, ★ Feature Media.
- **Description order:** legend → AI note → skins of V1.0 → one section per update (`Added in V1.2: …` with renders) → install notes. Description and gallery have no API: every update opens an issue with the new section to paste.
- **Upload:** `config.bedrock.uploadApi` is `true` since the first API upload on 2026-11-19 (The Last Ninjas V1.2). Every uploaded file contains all skins so far (`scripts/lib/complete-pack.js`). A manual upload is detected on the next run (file name = `.mcpack` name).
- Renders look like the 3D preview of the skin editor (`Input/minecraft-skin-editor`): same lights, poses and background `#252538`. 4D/custom geometry is not supported.
- Positions: `node scripts/skin-views.js --pack <slug>` renders every skin in all positions of `tools/skin-render/views.json` and writes `previews/<slug>/index.html` (← → position, ↑ ↓ skin). Apply one with `node scripts/render-skins.js --pack <slug> --view walk --all` (or `--version 1.3 --view fight` for one version); the choice is stored in `pack.json`, default `editor`.

## Files

- `data/cf-projects.json` – tracking: `modId, name, cfName, projectId, status (pending|published|rejected), version, lastPublishedAt, nextUpdateDue, updateCount, files[]`
- `data/mods/<modId>/` – `mod.json` (metadata, legend, changelog history), `ModMain.java`, `<Name>.png`, `<Name> Cover.png`, `kit.md`
- `data/skins/<slug>/` – `pack.json` (versions V1.0…, notes, legend, summary), `skins/<version>/`, `mcpack/`, `media/` (3D renders), `<Name>.png`, `<Name> Cover.png`, `refresh-kit.md`
- `data/cf-game-versions.json` – cached CurseForge game-version IDs
- `data/published-mods.json` – legacy list, fed to Claude to avoid duplicate concepts
- `scripts/` – `schedule-gate`, `select-mode`, `generate`, `build-images`, `persist`, `inject`, `build.sh`, `fix`, `kit`, `improve`, `publish`, `list-pending`; platform clients in `scripts/platforms/`, helpers in `scripts/lib/` (`schedule.js` holds the pure slot/decision logic)
- `config.json` – `niche`, `style`, `mcVersion`, `platforms`, `releaseType`, `timezone`, `windows`, `newModDays`, `updateIntervalDays` (`[min, max]`), `maxPendingKits`, optional `model`

## Required secrets

- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY` – ChatGPT logo and cover (`gpt-image-2.5-flare`)
- `CF_CORE_API_KEY` – Studios key (`$2a$…`), read-only Core API: detects files already on CurseForge and their game versions
- `CF_API_TOKEN` – CurseForge **upload token** of the Minecraft account (UUID format, from *Account → My API Tokens*). The Studios key (`$2a$…`) does not work.
- `CF_API_TOKEN_<ACCOUNT>` – upload token of each further account (one per game, see *Other games*)
- `MODRINTH_API_TOKEN` – only used when `PLATFORMS` includes `modrinth`

## Local development

```bash
npm ci
npm test                                   # unit tests (no network)
MODE=update node scripts/select-mode.js    # or new | scheduled-new | auto
NOW=2026-11-03T18:40:00Z node scripts/schedule-gate.js --window evening --per-account   # which accounts would start now
node scripts/publish.js --mod <id> --dry-run
```

Gradle builds need Java 21. The CurseForge upload can be smoke-tested against a test project with `--release-type alpha`.

## Policy notes

CurseForge forbids file updates made only to gain visibility and "multiple similar / low-effort projects". The update path therefore requires a real code change (hash check), a specific changelog and a per-project interval of at least 23 days (23–26). Keep the volume of new projects moderate.
