# Nightly build session

You are the nightly build session of this repository. Nobody is watching; the operator only
creates CurseForge projects once and reads a weekly report. Read `CLAUDE.md` (section "Die Serie")
first, then this file. Work on a fresh branch `serie/auto-<YYYY-MM-DD>` from `main` and finish
with one pull request. It is merged without the operator when the tests are green and it only
changes content (`scripts/lib/serie-guard.js`).

## What you may change

Only content: `tools/<reihe>/projects/<slug>/**`, `data/projects/<slug>/project.json` and
`data/projects/<slug>/files/*` (through `npm run serie -- vorrat`), `data/serie/<reihe>.json`,
`data/radar/*.json`.

Never change tooling, tests, workflows, `config.json`, `CLAUDE.md`, `package.json`,
`data/cf-projects.json` or anything under `data/skins/`. If the work needs such a change, do not
make it: open an issue titled "Nacht-Sitzung: braucht den Betreiber" that says what and why, and
go on with the next item. Never upload anything, never touch tokens or `secrets.env`, never start
a workflow by hand.

## What to do, in this order

1. `npm ci`, then `npm test`. If main is red, stop and open the issue above.
2. `npm run serie -- stand`. A row with fewer than 5 built projects ahead comes first.
3. **Fixes before features:** read the newest files in `data/radar/` (versions, comments, trends).
   A project that a new game version breaks gets its fix first. `data/radar/java.json` lists
   every Java pack against the newest Minecraft release and test version with the game's own
   error messages. To make a pack serve a new release as well: let `pack.js` write each file the
   way that version reads it (it gets `format`, compare the vanilla files of both versions in
   `~/.cache/mod-factory/minecraft/<version>/data/`), add the release to `"also"` and to
   `"gameVersions"` in `pack.json`, and build a new version (`tools/java/BRIEF.md`, "More than
   one Minecraft version"). Only released versions go into `"also"`, never a test version. New
   game version support is a real change and gets its own changelog line.
4. **New projects** of the row that needs them most, in plan order (`data/serie/<reihe>.json`),
   at most 4 per night. Follow `tools/<reihe>/BRIEF.md`. For each one: source, tests,
   `changelogs/1.0.md`, `page.json`; build with `npm run <reihe> -- bau <slug> --version 1.0`;
   put the file into the stock with `npm run serie -- vorrat …`. Images (logo, painted banner)
   are made by the workflow `serie-bilder.yml` every morning; do not create them.
5. **Images of the pages:** for each project that has `logo.png` and `banner-painted.png` in its
   folder but no `banner` choice in `data/serie/<reihe>.json`, look at both images (read the
   PNG files). Choose with `npm run serie -- banner-wahl <slug> chatgpt` when the painted banner
   spells the name and the line correctly, reads well and shows nothing forbidden (game logos,
   official characters, brand names, a game interface); otherwise `… claude` (the designed
   banner). Compare each new logo with the other logos of its row: when two are too alike,
   change the `logoPrompt` in `page.json` to a different motif and delete the new `logo.png`
   and its `banner-painted.png`, so the workflow paints new ones.
6. **Updates** for projects that are online and have fewer than 2 versions waiting, at most 6
   per night. One real change per version, taken from the project's planned updates in
   `data/serie/<reihe>.json` (or from a reported problem). Source, tests, `changelogs/<version>.md`,
   build, `npm run serie -- vorrat`. Never a version without a change a player would notice.
7. Run `npm test` again. Everything green: commit, push, open the pull request with a short
   list of what was built. Something red that you cannot fix: leave that project out of the
   commit and say so in the pull request.

## Projects prepared ahead of a game version

A project with `"waitsFor": "<version>"` (in its `pack.json` and in `data/serie/<reihe>.json`) is
built against a test version of that game version and must not go into the stock before the
version is released. Each night: if `data/radar/versions.json` shows the release, set `"mc"` to
the release in `pack.json`, remove `"waitsFor"` in both files, build V1.0 against the release
(the game loads it in the build), check its page and put it into the stock. Until then, keep it
building against the newest test version: when the radar reports a problem for it, fix it like
any other project.

## Rules that keep the series alive

- Nothing unchecked goes into the stock. A project you could not check stays out.
- Every name is checked with `npm run serie -- namen` before it is built; a taken name gets a new
  one in `data/serie/<reihe>.json`.
- Similar content belongs in one project, not in several. Do not split a project to fill slots.
- Page texts follow `scripts/lib/page-check.js`. They describe what the first version does.
- When a game is not available to test in (Stardew, Bedrock, WoW Forever), say so nowhere as
  "tested"; keep to documented formats and guard every optional call.
- Review what you built before you commit it: read the code once more, weigh every uncertainty,
  and drop what you would not put your name on.
