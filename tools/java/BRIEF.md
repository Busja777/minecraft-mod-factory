# Brief for building one Minecraft: Java Edition pack of the series

You build one data pack or resource pack for Minecraft: Java Edition 1.21.1 in the repo
/Users/sevinh/Desktop/minecraft-mod-factory. The game is not played; the pack is generated from
code and checked against the vanilla data of 1.21.1, which `tools/java/vanilla.js` takes from
Mojang's official jars into `~/.cache/mod-factory/minecraft/1.21.1/` (already downloaded:
`data/` = vanilla data pack, `reports/registries.json` = every registry id, `assets/` = client
assets, `sounds.json` = the vanilla sound definitions, `asset-index.json` = every sound file).

## Read first
- `tools/java/projects/stonecutter-woodworks/`: the finished reference (pack.json, pack.js,
  page.json, changelogs/1.0.md). Copy its structure.
- `tools/java/lib.js`: layout, generation and `checkPack` (folder names of 1.21, recipe types,
  item/block ids, advancement triggers and parents, sound events and sound files).
- `tools/java/vanilla.js`: `registry(vanilla, name)` and the cache layout.
- The vanilla files themselves: copy their exact JSON format (for example
  `data/minecraft/advancement/husbandry/*.json`, `data/minecraft/recipe/*.json`). 1.21.1 uses
  singular folder names (`recipe`, `advancement`, `loot_table`, `tags/item`) and `"id"` in
  results and icons.
- `scripts/lib/page-check.js`: rules for page.json. Title ≤ 30 characters, English, no game,
  class ("Data Pack", "Resource Pack", "Mod") or version in it. Summary: one sentence,
  ≤ 150 characters, not copied from the description. Description 100–200 words with exactly
  this shape: a bold first sentence, "## Features" with 3–5 bullets, "## How to use",
  "## Good to know", a bullet that says new features arrive with updates and to see each file's
  changelog, a line inviting comments, and the last line `*(The logo is AI-generated.)*`. No
  links, no filler ("must-have", "game changer", "take your … to the next level", "elevate your",
  "seamless").

## Rules
- `pack.js` builds every file from code (loops and tables, not hundreds of hand-written files)
  and only uses ids that exist in 1.21.1. Use your own namespace (the slug with underscores) for
  new files; override vanilla files only where the pack's purpose needs it.
- Fair values: nothing that makes the game trivially easy unless the pack's brief says so.
- Do NOT edit shared files: nothing in `tools/java/lib.js`, `vanilla.js`, `build.js`, `tests/`,
  `scripts/`, `data/`, `CLAUDE.md`, `package.json`, or another project's folder. If the check in
  `lib.js` cannot express something your pack needs, say so in your report instead.
- Do not commit, push, upload, generate images or create a logo. Do not download anything else
  from the internet; everything you need is in the cache.

## More than one Minecraft version
A pack can serve newer Minecraft versions in the same zip: `"also": ["26.3"]` in `pack.json`
(and the release names in `"gameVersions"`). `pack.js` is then called once per version with
`{ vanilla, version, format, registry }`; `format` is that version's data (or resource) pack
format (1.21.1: 48, 26.3: 121). Write each file the way the version reads it, for example a
recipe ingredient is `{ "item": "minecraft:oak_planks" }` up to format 56 and the plain string
`"minecraft:oak_planks"` from format 57 on. Always copy the format from that version's own
vanilla files. Every file of the newest version must also exist for the older one (an overlay
can replace files, not hide them). `npm run java -- test <slug>` checks each version against its
data and lets Minecraft itself load the finished data pack where the version can do that without
a window (1.21.5 and newer); the game's error messages name the file.

## Files to deliver (all under tools/java/projects/<slug>/)
- `pack.json`: `{ kind, name, description (short, shown in the game's pack list), mc: "1.21.1", gameVersions: ["1.21", "1.21.1"] }`
- `pack.js`
- `changelogs/1.0.md` (English, same style as Stonecutter Woodworks')
- `page.json` with `name`, `summary`, `category` (one of the CurseForge categories given in your
  brief), `logoPrompt` (one sentence describing a single centred object for an icon in blocky
  voxel style; no text, no Mojang logos, no copied mob faces), `cover` { `tagline` ≤ 45
  characters, `bullets`: exactly 3, each ≤ 34 characters }, `description` (array of lines). It
  describes only what V1.0 does and says it is made for Java Edition 1.21 and 1.21.1.

## Verify before you report
From the repo root:
- `npm run -s java -- test <slug>` must pass.
- `node --test tests/java.test.js` must pass.
- Run `checkPage` on your page.json (see tests/serie.test.js) and make every text check except
  logo, cover and shots pass.

Then report briefly: the files, how many files the pack generates, what you decided beyond the
brief, and everything you are not sure behaves as assumed in 1.21.1.
