# Brief for building one Minecraft Bedrock add-on of the series

You build one add-on for Minecraft: Bedrock Edition in the repo
/Users/sevinh/Desktop/minecraft-mod-factory. The game is not played and cannot be started: the
pack is generated from code and checked against Mojang's official bedrock-samples of release
1.26.60.5, which `tools/bedrock/samples.js` keeps in
`~/.cache/mod-factory/bedrock/v1.26.60.5/bedrock-samples-1.26.60.5/` (already downloaded):
`behavior_pack/` (recipes, loot_tables, trading, entities, spawn_rules …), `resource_pack/`
(sounds/sound_definitions.json, texts …) and `metadata/vanilladata_modules/mojang-*.json`
(every item, block, entity, effect, enchantment and biome id).

## Read first
- `tools/bedrock/projects/plank-cutter/`: the finished reference (pack.json, pack.js, page.json,
  changelogs/1.0.md). Copy its structure.
- `tools/bedrock/lib.js`: layout, generation, `checkPack` and the build (manifest, UUIDs).
- `tools/bedrock/samples.js`: `ids(samples, kind)`, `vanilla(samples, side, rel)`,
  `vanillaFiles(samples, side, folder)`; pack.js gets these as `ids`, `vanilla`, `vanillaFiles`.
- The vanilla files themselves: copy their exact JSON shape and `format_version`.
- `scripts/lib/page-check.js`: rules for page.json. Title ≤ 30 characters, English, no game
  ("Minecraft", "Bedrock", "BE", "MCPE"), class ("Addon", "Mod", "Pack") or version in it.
  Summary one sentence, ≤ 150 characters, not copied from the description. Description 100–200
  words: a bold first sentence, "## Features" with 3–5 bullets, "## How to use",
  "## Good to know", a bullet "New features arrive with updates, see each file's changelog.",
  a line inviting comments, last line `*(The logo is AI-generated.)*`. No links, no filler.

## Rules
- `pack.js` builds every file from code (tables and loops) and only uses ids from the samples.
- Changing vanilla behaviour means replacing a vanilla file (entities/creeper.json,
  loot_tables/gameplay/fishing.json, trading/…): always start from the vanilla file of the
  samples (`vanilla('bp', 'entities/creeper.json')`), change only what the pack is about, and
  check in code that the part you change still looks the way you expect (throw otherwise), so
  a new release with a different file stops the build instead of shipping a wrong pack.
- New files (recipes, own loot tables) use the pack's own namespace (slug with underscores) in
  identifiers and in file names, and lie flat in `recipes/` like vanilla's.
- Recipes need `unlock` (copy a vanilla recipe of the same kind).
- No scripts (`scripts/`, Script API), no custom entities, items or blocks, no textures, no
  experimental toggles: only data that vanilla itself uses, so the pack runs on every platform.
- Fair values: nothing that makes the game trivially easy unless the pack's brief says so.
- Every behavior pack turns off achievements in its world; the page says so in "Good to know".
- Do NOT edit shared files: nothing in `tools/bedrock/lib.js`, `samples.js`, `build.js`,
  `tests/`, `scripts/`, `data/`, `CLAUDE.md`, `package.json`, or another project's folder. If
  the check cannot express something your pack needs, say so in your report instead.
- Do not commit, push, upload, generate images or create a logo. Do not download anything.

## Files to deliver (all under tools/bedrock/projects/<slug>/)
- `pack.json`: `{ "kind": "behavior" | "resource" | "addon", "name", "description" (short),
  "minEngine": [1, 26, 60], "gameVersions": ["26.60"] }`
- `pack.js`, `page.json` (name, summary, `"class": "Addons"`, category from: Utility, Vanilla+,
  Survival, Mobs, Food, Tools and Weapons, Miscellaneous; `logoPrompt` in blocky voxel style
  without text; `cover` with tagline and exactly three bullets), `changelogs/1.0.md`.

## Check
`npm run bedrock -- test <slug>` must pass, then `node --test tests/bedrock.test.js`.
Report: what the pack changes, which vanilla files it starts from, every assumption the game
might not share (the pack cannot be loaded in the game here), and anything you left out.
