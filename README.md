# Minecraft Mod Factory

Automated pipeline that generates small Fabric 1.21.1 QoL mods with Claude, builds them with Gradle and publishes them to **CurseForge** (Modrinth is kept as an optional platform).

## How it works

Two scheduled workflows, both in **Europe/Berlin** time with a randomized daily slot:

| Workflow | Window | What happens |
|---|---|---|
| `morning.yml` | 06:00–12:00, once per day at a random minute | 1) Uploads every pending mod whose CurseForge project ID you entered. 2) On `newModDays` (default Mon/Wed/Fri/Sat): Claude designs a new mod (incl. a short legend) → ChatGPT logo `<Name>.png` (400×400) and cover `<Name> Cover.png` (720×340) → source stored in `data/mods/<modId>/` → Gradle build (one auto-fix retry) → **project kit** committed and a GitHub issue (`cf-project-needed`) asks you to create the CurseForge project. |
| `evening.yml` | 19:00–22:00, once per day at a random minute | Picks the published project whose per-project due date (random **22–25 days** after its last upload, never under 22) has passed, lets Claude implement one real improvement, bumps the minor version and uploads the new file with a changelog. Nothing due → nothing happens. |

**Your part:** create the project on https://authors.curseforge.com from the kit (name, summary, category, icon, description), put the numeric project ID into `data/cf-projects.json` (`"projectId": 123456`), commit, push. The next morning run uploads it. For an immediate upload run *Actions → Morning → Run workflow* with `force = true`.

**How the random slot works:** the cron fires every 30 minutes inside each window. A light `gate` job derives today's slot from a hash of the date, checks via the GitHub API whether the heavy job already ran today, and only then starts the heavy job (sleeping up to 30 min to hit the exact minute). Late or dropped cron fires are caught up later in the same window. Scheduled workflows only run on the default branch, and GitHub disables them after 60 days without repository activity.

## Skin packs (CurseForge Bedrock)

Old packs from the local folder (`V1/`, `U1…Un/`) are imported once; afterwards the evening window releases one prepared version (`Un`) per pack every 22–25 days, mixed with mod updates (one update per evening in total).

```bash
# 1. Import (reads every .mcpack, syncs the upload state from CurseForge via CF_CORE_API_KEY)
node scripts/import-skinpack.js "/path/to/MCPE/Glowing Samurai" --project 1498885
# 2. Refresh the project page: Actions → "Skin pack — refresh project page" (pack = slug)
#    → 3D renders, legend/summary/notes (Claude), logo + cover (ChatGPT), issue with the full kit
```

- **Cover:** upload `<Name> Cover.png` under *Media* with the title **MCPEDL** (MCPEDL takes the cover from there), description `<Name> Cover.png`, ★ Feature Media.
- **Description order:** legend → AI note → skins of V1.0 → one section per update (`Added in V1.2: …` with renders) → install notes. Description and gallery have no API: every update opens an issue with the new section to paste.
- **Upload:** `config.bedrock.uploadApi` stays `false` until a test upload with the UUID upload token worked on a Bedrock project; until then the issue contains the file link for a manual upload. A manual upload is detected on the next run (file name = `.mcpack` name).
- Renders: `node scripts/render-skins.js --pack <slug> --all` (three.js in headless Chromium; 4D/custom geometry is not supported).

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
- `CF_API_TOKEN` – CurseForge **upload token** (UUID format, from *Account → My API Tokens*). The Studios key (`$2a$…`) does not work.
- `MODRINTH_API_TOKEN` – only used when `PLATFORMS` includes `modrinth`

## Local development

```bash
npm ci
npm test                                   # unit tests (no network)
MODE=update node scripts/select-mode.js    # or new | scheduled-new | auto
NOW=2026-11-03T18:40:00Z node scripts/schedule-gate.js --window evening --dry-run
node scripts/publish.js --mod <id> --dry-run
```

Gradle builds need Java 21. The CurseForge upload can be smoke-tested against a test project with `--release-type alpha`.

## Policy notes

CurseForge forbids file updates made only to gain visibility and "multiple similar / low-effort projects". The update path therefore requires a real code change (hash check), a specific changelog and a per-project interval of 22–25 days (hard floor 22). Keep the volume of new projects moderate.
