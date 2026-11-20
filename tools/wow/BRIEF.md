# Brief for building one World of Warcraft addon of the series

You build one World of Warcraft (Retail, patch 12.1.x "Midnight") addon in the repo
/Users/sevinh/Desktop/minecraft-mod-factory. The game is NOT installed: everything is built and
tested from files alone with LuaJIT against a small stand-in for the WoW client.

## Read first (they are the pattern to follow)
- `tools/wow/projects/gold-diary/`: the finished reference addon (src/GoldDiary/*.lua + .toc,
  test.lua, changelogs/1.0.md, page.json). Copy its structure, coding style, Locale pattern
  (English text is the key) and test style. Level Clock, Junk Butler, Quest Autopilot and
  Flight Minutes in the same folder are further finished examples.
- `tools/wow/client/wow.lua` and `tools/wow/client/run.lua`: the stand-in client and the test
  runner (test(name, fn(wow, installed, before)), eq(a, b, msg), ADDON_DIR, ADDON_NAME).
- `tools/wow/lib.js`: static checks every addon must pass (Lua 5.1 only, no os./io./require/goto,
  every .lua in the TOC, TOC needs "## Version: @version@", "## Title", "## Notes", "## Interface").
- `scripts/lib/page-check.js`: rules for page.json. Title ≤ 30 characters, English, no game,
  class ("Addon", "Mod") or version in it. Summary: one sentence, ≤ 150 characters, not copied
  from the description. Description 100–200 words with exactly this shape: a bold first sentence,
  "## Features" with 3–5 bullets, "## How to use", "## Good to know", a bullet that says new
  features arrive with updates and to see each file's changelog, a line inviting comments, and
  the last line `*(The logo is AI-generated.)*`. No links, no filler ("must-have", "game changer",
  "take your … to the next level", "elevate your", "seamless").

## Rules for the code
- Use only real Retail API that exists in 12.x and that you are confident about. No combat-log
  data, no protected functions, nothing that needs a hardware click unless the brief says so.
  Guard optional API with `if X then`. Values read from the game can be "secret" in Midnight
  (especially in instances): use a `ns.IsSecret` guard like Gold Diary before arithmetic or
  comparisons, and skip the value when it is secret.
- Put all decisions and arithmetic in a pure `Core.lua` (no frames, no events), so it is fully
  testable with plain data. Events and frames go into other files.
- TOC: `## Interface: 120105, 120107`, `## Title`, `## Notes` (one short sentence),
  `## Version: @version@`, `## SavedVariables` if needed, optional `## IconTexture`,
  Locale.lua first, then Core.lua.
- English only for V1.0: Locale.lua is only
  `local _, ns = ...` and `ns.L = setmetatable({}, { __index = function(_, key) return key end })`.
- Only the globals your brief allows (SavedVariables, one named frame if you have a window,
  SLASH_<NAME>1/2). Test this ("addon defines only its own globals").
- Do NOT edit any shared file: nothing under tools/wow/client/, not tools/wow/lib.js,
  tools/wow/build.js, tests/, scripts/, data/, CLAUDE.md, package.json, and no other addon's
  folder. If your tests need client functions that wow.lua lacks, define them as globals inside
  your own test.lua after the client is installed and before the addon is loaded (a local helper
  called at the start of each test that models the game state and records calls); globals
  created during a test are removed automatically afterwards.
- Do not commit, push, upload anything, or generate images. Do not create a logo.

## Files to deliver (all under tools/wow/projects/<slug>/)
- `src/<AddonName>/<AddonName>.toc`, `Locale.lua`, `Core.lua` and the remaining Lua files
- `test.lua` with at least 15 meaningful tests: pure logic, every event path, edge cases named
  in your brief, slash commands, saved settings, "addon defines only its own globals"
- `changelogs/1.0.md` (English, same style as Gold Diary's)
- `page.json` with `name`, `summary`, `category` (exactly one of the CurseForge WoW categories
  listed in your brief), `logoPrompt` (one sentence describing a single centred object for an
  icon; no text, no game characters, no game logos), `cover` { `tagline` ≤ 45 characters,
  `bullets`: exactly 3, each ≤ 34 characters }, `description` (array of lines) in the shape above.
  It describes only what V1.0 does, and says "Works on Retail."

## Verify before you report
From the repo root:
- `npm run -s wow -- test <slug>` must pass.
- `node --test tests/wow-addons.test.js` must pass for your addon's three tests. Failures of other
  addons' folders are not yours. `tests/serie.test.js` reports a missing logo for every addon
  without one; that is expected and not yours to fix.
- Run `checkPage` on your page.json (see how tests/serie.test.js does it) and make every text
  check except logo and cover pass.

Then report briefly: the files, the number of Lua tests, the WoW API functions and events the
addon uses, what you added or decided beyond the brief, and everything you are not sure exists
or behaves as assumed in Retail 12.x.
