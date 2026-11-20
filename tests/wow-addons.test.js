import { test } from 'node:test';
import assert from 'node:assert/strict';
import AdmZip from 'adm-zip';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { listAddons, addonOf, staticProblems, translationProblems, tocFiles, interfaces, hasLuajit, runLuaTests, buildZip, PROJECTS } from '../tools/wow/lib.js';

const addons = listAddons();

test('WoW: Gold Diary is there and every addon folder is complete', () => {
  assert.ok(addons.includes('gold-diary'));
  for (const slug of addons) {
    const a = addonOf(slug);
    assert.ok(fs.existsSync(path.join(a.dir, 'changelogs', '1.0.md')), `${slug}: changelogs/1.0.md is missing`);
    assert.ok(interfaces(a).length >= 1, `${slug}: no interface number`);
  }
});

for (const slug of addons) {
  const a = addonOf(slug);

  test(`WoW ${slug}: only Lua the game knows, every file in the TOC, every text translated`, () => {
    assert.deepEqual(staticProblems(a), []);
    assert.deepEqual(translationProblems(a), []);
  });

  test(`WoW ${slug}: Lua tests against the stand-in client`, { skip: !hasLuajit() && 'LuaJIT not installed (brew install luajit)' }, () => {
    const r = runLuaTests(a);
    assert.ok(r.ok, r.output);
    assert.match(r.output, /\d+ passed, 0 failed/);
  });

  test(`WoW ${slug}: the zip holds one addon folder with the version in the TOC`, () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'wow-zip-'));
    const file = buildZip(a, '1.2', out);
    assert.equal(path.basename(file), `${a.name}-1.2.zip`);
    const zip = new AdmZip(file);
    const entries = zip.getEntries().map(e => e.entryName);
    assert.ok(entries.every(e => e.startsWith(`${a.name}/`)));
    assert.match(zip.readAsText(`${a.name}/${a.name}.toc`), /^## Version: 1\.2$/m);
    assert.throws(() => buildZip(a, 'v1', out), /Invalid version/);
  });
}

test('WoW: the static check catches what the game does not have', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wow-bad-'));
  const src = addonOf('gold-diary');
  const dst = path.join(root, 'bad', 'src', src.name);
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src.src)) fs.copyFileSync(path.join(src.src, f), path.join(dst, f));
  fs.appendFileSync(path.join(dst, 'Core.lua'), '\nlocal t = os.time()\nlocal x = L["Never translated"]\n');
  fs.writeFileSync(path.join(dst, 'Extra.lua'), 'goto done\n');
  const bad = addonOf('bad', root);
  const problems = staticProblems(bad);
  assert.ok(problems.some(p => /Core.lua: os/.test(p)));
  assert.ok(problems.some(p => /Extra.lua is not listed/.test(p)));
  assert.ok(problems.some(p => /Extra.lua: goto/.test(p)));
  assert.ok(problems.some(p => /test.lua is missing/.test(p)));
  assert.ok(translationProblems(bad).some(p => /deDE misses "Never translated"/.test(p)));
  assert.deepEqual(tocFiles(src).slice(0, 2), ['Locale.lua', 'Core.lua'], 'locale and core load first');
  assert.equal(PROJECTS.endsWith(path.join('tools', 'wow', 'projects')), true);
});
