# Minecraft Mod Factory

Automated pipeline that generates small Fabric 1.21.1 QoL mods with Claude, builds them with Gradle and publishes them to **CurseForge** (Modrinth is kept as an optional platform).

## How it works

Two scheduled workflows, both in **Europe/Berlin** time with a randomized daily slot:

| Workflow | Window | What happens |
|---|---|---|
| `morning.yml` | 06:00–12:00, once per day at a random minute | 1) Uploads every pending mod whose CurseForge project ID you entered. 2) On `newModDays` (default Mon/Wed/Fri/Sat): Claude designs a new mod → fal.ai icon (400×400) → source stored in `data/mods/<modId>/` → Gradle build (one auto-fix retry) → **project kit** committed and a GitHub issue (`cf-project-needed`) asks you to create the CurseForge project. |
| `evening.yml` | 19:00–22:00, once per day at a random minute | Picks the published project whose per-project due date (random **22–25 days** after its last upload, never under 22) has passed, lets Claude implement one real improvement, bumps the minor version and uploads the new file with a changelog. Nothing due → nothing happens. |

**Your part:** create the project on https://authors.curseforge.com from the kit (name, summary, category, icon, description), put the numeric project ID into `data/cf-projects.json` (`"projectId": 123456`), commit, push. The next morning run uploads it. For an immediate upload run *Actions → Morning → Run workflow* with `force = true`.

**How the random slot works:** the cron fires every 30 minutes inside each window. A light `gate` job derives today's slot from a hash of the date, checks via the GitHub API whether the heavy job already ran today, and only then starts the heavy job (sleeping up to 30 min to hit the exact minute). Late or dropped cron fires are caught up later in the same window. Scheduled workflows only run on the default branch, and GitHub disables them after 60 days without repository activity.

## Files

- `data/cf-projects.json` – tracking: `modId, name, cfName, projectId, status (pending|published|rejected), version, lastPublishedAt, nextUpdateDue, updateCount, files[]`
- `data/mods/<modId>/` – `mod.json` (metadata, changelog history), `ModMain.java`, `icon.png`, `kit.md`
- `data/cf-game-versions.json` – cached CurseForge game-version IDs
- `data/published-mods.json` – legacy list, fed to Claude to avoid duplicate concepts
- `scripts/` – `schedule-gate`, `select-mode`, `generate`, `build-images`, `persist`, `inject`, `build.sh`, `fix`, `kit`, `improve`, `publish`, `list-pending`; platform clients in `scripts/platforms/`, helpers in `scripts/lib/` (`schedule.js` holds the pure slot/decision logic)
- `config.json` – `niche`, `style`, `mcVersion`, `platforms`, `releaseType`, `timezone`, `windows`, `newModDays`, `updateIntervalDays` (`[min, max]`), `maxPendingKits`, optional `model`

## Required secrets

- `ANTHROPIC_API_KEY`
- `FAL_API_KEY`
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
