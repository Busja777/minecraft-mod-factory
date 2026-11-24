// Every slash command of a series addon is unique across the series and is not one of the game's
// own commands (English or German client). Found in the build of Chat Calc on 2026-11-24: /cc is
// the game's click casting, /rc its ready check, and two pairs of our addons shared /lc and /mb.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'tools/wow/projects';
const game = new Set(JSON.parse(fs.readFileSync('tools/wow/data/blizzard-slash.json', 'utf-8')).commands);

function luaFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? luaFiles(p) : e.name.endsWith('.lua') ? [p] : [];
  });
}

test('WoW: slash commands are unique and never the game\'s own', () => {
  const owner = new Map();
  for (const slug of fs.readdirSync(ROOT)) {
    const src = path.join(ROOT, slug, 'src');
    if (!fs.existsSync(src)) continue;
    for (const file of luaFiles(src)) {
      for (const m of fs.readFileSync(file, 'utf-8').matchAll(/^\s*SLASH_[A-Za-z0-9_]+\s*=\s*"(\/[^"]+)"/gm)) {
        const cmd = m[1].toLowerCase();
        assert.ok(!game.has(cmd), `${slug}: ${cmd} is a command of the game itself`);
        assert.ok(!owner.has(cmd) || owner.get(cmd) === slug, `${cmd} is used by ${owner.get(cmd)} and ${slug}`);
        owner.set(cmd, slug);
      }
    }
  }
  assert.ok(owner.size > 10, 'found the slash commands of the addons');
});
