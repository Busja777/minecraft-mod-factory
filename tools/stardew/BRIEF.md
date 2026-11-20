# Brief for building one Stardew Valley pack of the series

You build one Content Patcher pack for Stardew Valley 1.6 in the repo
/Users/sevinh/Desktop/minecraft-mod-factory. **The series is blind:** the game is not owned and must
not be bought or downloaded. Nothing is ever started or tested in the game. Every pack is built
only from the documented 1.6 and Content Patcher formats and checked as strictly as that allows.
Every pack must be checked against those documented formats; if a detail is not documented, pick
what the official docs show and name the uncertainty in your report.

## What is there
- `tools/stardew/projects/villager-birthday-reminders/`: the finished reference (pack.json,
  pack.js, page.json, changelogs/1.0.md). Copy its structure and its comment style: the comment at
  the top of `pack.js` cites the wiki/author-guide pages for every mechanism the pack relies on.
- `tools/stardew/lib.js`: layout, `manifest.json`, the zip and `checkPack`:
  - `manifest.json` and `content.json` are validated against the official schemas
    (smapi.io/schemas/manifest.json and content-patcher.json, cached in
    `~/.cache/mod-factory/stardew/`) with the small validator in `tools/stardew/schema.js`;
  - every `Target` must be in `TARGETS` (1.6 asset names with their wiki source) or be
    `Characters/Dialogue/<NPC>`;
  - qualified item IDs like `(O)24` anywhere must be in `tools/stardew/data/items.json`; fields
    named `…ItemId` must be qualified; mail uses `%item id (O)<id> <count> %%` (the 1.6 form);
  - every `{{i18n:key}}` exists in `i18n/default.json`, no unused keys, translations only use
    keys of `default.json`;
  - NPC names (dialogue targets, gift tastes, `PLAYER_HAS_MET` and other NPC queries,
    `AddFriendshipPoints` …) must be in `tools/stardew/data/npcs.json`;
  - `Format` has the major.minor of the Content Patcher version in pack.json and is not newer;
  - mail keys and trigger action IDs start with `{{ModId}}_`; letters have exactly one `[#]`;
    triggers, actions and game state queries come from the lists in `lib.js`; `AddMail` only
    sends letters the pack defines.
- `tools/stardew/data/items.json` (vanilla object IDs → English names, from
  Modding:Objects/Object sprites) and `npcs.json` (34 giftable villagers: birthday, loved gift IDs
  from the raw Data/NPCGiftTastes 1.6.15 dump, favourites from each villager page). Both name their
  source and date. `npm run stardew -- daten` downloads them again (wiki API via curl; check the
  git diff afterwards).
- Wiki pages to read (cached as `~/.cache/mod-factory/stardew/wiki/*.json` once fetched; fetch new
  ones through `https://stardewvalleywiki.com/mediawiki/api.php?action=parse&page=<Title>&prop=wikitext|revid&format=json&formatversion=2`
  with curl. The article URLs answer with a Cloudflare check: never try to get past it):
  Modding:Mail data, Modding:Trigger actions, Modding:Game state queries, Modding:Items,
  Modding:NPC data, Modding:Dialogue, Modding:Shops, Modding:Machines … and the Content Patcher
  author guide (github.com/Pathoschild/StardewMods, ContentPatcher/docs/author-guide.md, tokens.md,
  translations.md, action-editdata.md).

## Rules
- `pack.js` builds every file from tables (loops, not hand-written JSON) and returns
  `{ 'content.json': {…}, 'i18n/default.json': {…} }`; `manifest.json` comes from `lib.js`.
- `Format` is the current Content Patcher format (`2.9.0`, the schema accepts only `2.9.x`);
  pack.json: `contentPatcher: "2.9.0"`, `minimumApiVersion: "4.4.0"` (Content Patcher 2.9 needs
  SMAPI 4.4.0, which needs Stardew Valley 1.6.14), `gameVersions: ["1.6.14", "1.6.15"]`.
- All player-facing text goes through `i18n/default.json` (English). IDs use `{{ModId}}_…`.
- Use only 1.6 item IDs that are in `items.json`; if you need one that is missing, add it with its
  wiki source instead of guessing. Same for NPCs and asset names (`TARGETS` with a source link).
- Fair values, nothing that makes the game trivially easy unless the pack's brief says so.
- No new npm dependencies. Do not edit shared files (`tools/stardew/lib.js`, `schema.js`,
  `wiki.js`, `build.js`, `tests/`, `scripts/`, `data/`, `CLAUDE.md`, `package.json`) or another
  project's folder. If the checks cannot express something your pack needs, say so in the report.
- Do not commit, push, upload, generate images or create a logo.

## Files to deliver (all under tools/stardew/projects/<slug>/)
- `pack.json`: `{ name, description (one sentence, shown in the SMAPI log), uniqueId: "SevEvolution.<PascalName>", minimumApiVersion, contentPatcher, gameVersions }`
- `pack.js`
- `changelogs/1.0.md` (English, same style as Villager Birthday Reminders')
- `page.json` with `name`, `summary`, `"class": "Mods"`, `category` (one of Gameplay Basics,
  Events, Visuals, Food, Items, UI, Miscellaneous), `logoPrompt` (one sentence, a single centred
  object, no text, no game characters), `cover` { `tagline` ≤ 45 characters, `bullets`: exactly 3,
  each ≤ 34 characters }, `description` (array of lines).
- Page rules (`scripts/lib/page-check.js`): title ≤ 30 characters, English, no game name, no
  "mod"/"content pack", no version. Summary one sentence, ≤ 150 characters, not copied from the
  description. Description 100–200 words: a bold first sentence, `## Features` with 3–5 bullets,
  `## How to use`, `## Good to know` (must say: needs SMAPI and Content Patcher, made for Stardew
  Valley 1.6, built from the documented formats — never promise in-game testing), a bullet that
  says new features arrive with updates and to see each file's changelog, a line inviting
  comments, and the last line `*(The logo is AI-generated.)*`. No links, no filler.

## Verify before you report
From the repo root:
- `npm run -s stardew -- test <slug>` must pass.
- `node --test tests/stardew.test.js` must pass.
- Run `checkPage` on your page.json (see tests/stardew.test.js) and make every text check except
  logo, cover and shots pass.

Then report briefly: the files, what the pack generates, which documented mechanism each part
relies on (with the page), what you decided beyond the brief, and everything you are not sure
Stardew Valley 1.6 or Content Patcher will treat as assumed.
