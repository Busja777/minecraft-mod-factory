import { test } from 'node:test';
import assert from 'node:assert/strict';
import AdmZip from 'adm-zip';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { staticProblems, tocFiles, hasLuajit, runLuaTests, buildZip, SRC } from '../tools/wow/gold-diary/lib.js';

test('Gold Diary: only Lua the game knows, every file in the TOC', () => {
  assert.deepEqual(staticProblems(), []);
  assert.deepEqual(tocFiles().slice(0, 2), ['Locale.lua', 'Core.lua'], 'locale and core load first');
});

test('Gold Diary: static check catches what the game does not have', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-'));
  for (const f of fs.readdirSync(SRC)) fs.copyFileSync(path.join(SRC, f), path.join(dir, f));
  fs.appendFileSync(path.join(dir, 'Core.lua'), '\nlocal t = os.time()\n');
  fs.writeFileSync(path.join(dir, 'Extra.lua'), 'goto done\n');
  const problems = staticProblems(dir);
  assert.ok(problems.some(p => /Core.lua: os/.test(p)));
  assert.ok(problems.some(p => /Extra.lua is not listed/.test(p)));
  assert.ok(problems.some(p => /Extra.lua: goto/.test(p)));
});

test('Gold Diary: Lua tests against the stand-in client', { skip: !hasLuajit() && 'LuaJIT not installed (brew install luajit)' }, () => {
  const r = runLuaTests();
  assert.ok(r.ok, r.output);
  assert.match(r.output, /\d+ passed, 0 failed/);
});

test('Gold Diary: the zip holds one addon folder with the version in the TOC', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-zip-'));
  const file = buildZip('1.2', out);
  assert.equal(path.basename(file), 'GoldDiary-1.2.zip');
  const entries = new AdmZip(file).getEntries().map(e => e.entryName);
  assert.ok(entries.every(e => e.startsWith('GoldDiary/')));
  assert.ok(entries.includes('GoldDiary/GoldDiary.toc'));
  const toc = new AdmZip(file).readAsText('GoldDiary/GoldDiary.toc');
  assert.match(toc, /^## Version: 1\.2$/m);
  assert.throws(() => buildZip('v1', out), /Invalid version/);
});

test('Gold Diary: every text on screen is translated, no translation is left over', () => {
  const code = fs.readdirSync(SRC).filter(f => f.endsWith('.lua') && f !== 'Locale.lua').map(f => fs.readFileSync(path.join(SRC, f), 'utf-8')).join('\n');
  const used = new Set([...code.matchAll(/L\["((?:[^"\\]|\\.)*)"\]/g)].map(m => m[1]));
  for (const block of [/CATEGORY_LABEL = \{([\s\S]*?)\n\}/, /PERIOD_LABEL = \{([^}]*)\}/]) {
    for (const m of block.exec(code)[1].matchAll(/= "([^"]+)"/g)) used.add(m[1]);
  }
  const locale = fs.readFileSync(path.join(SRC, 'Locale.lua'), 'utf-8');
  for (const lang of ['deDE', 'frFR', 'esES']) {
    const body = new RegExp(`T\\.${lang} = \\{([\\s\\S]*?)\\n\\}`).exec(locale)[1];
    const keys = new Set([...body.matchAll(/\["((?:[^"\\]|\\.)*)"\]\s*=/g)].map(m => m[1]));
    assert.deepEqual([...used].filter(k => !keys.has(k)), [], `${lang} misses texts`);
    assert.deepEqual([...keys].filter(k => !used.has(k)), [], `${lang} has unused texts`);
  }
});
