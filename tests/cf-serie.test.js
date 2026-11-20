import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright-core';
import { runSteps } from '../scripts/lib/cf-browser/runner.js';
import { serieTasks, serieFields, buildSerieSteps, profileFor, WIZARD_GAME } from '../scripts/lib/cf-browser/serie.js';
import { FORBIDDEN_CLICK, FORBIDDEN_AFTER_EDIT } from '../scripts/lib/cf-browser/selectors.js';
import { loadReihen, findSerieProject } from '../scripts/lib/serie.js';

const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
const pageOf = (reiheKey, slug) => JSON.parse(fs.readFileSync(path.join('tools', reiheKey, 'projects', slug, 'page.json'), 'utf-8'));

test('series in the browser helper: one Chrome profile per CurseForge account, Minecraft shares the main one', () => {
  assert.equal(profileFor(config, 'java'), '');
  assert.equal(profileFor(config, 'bedrockaddons'), '');
  assert.equal(profileFor(config, 'wow'), 'wow');
  assert.equal(profileFor(config, 'stardewvalley'), 'stardewvalley');
  for (const reihe of loadReihen()) assert.ok(WIZARD_GAME[reihe.game], `${reihe.reihe}: the wizard name of ${reihe.game} is missing`);
});

test('series tasks: built projects without an id, at most `limit` per row, in plan order', () => {
  const reihen = loadReihen();
  const tasks = serieTasks({ reihen, cfProjects: [], limit: 3 });
  const java = tasks.filter(t => t.reihe === 'java');
  assert.deepEqual(java.map(t => t.id), ['stonecutter-woodworks', 'hush', 'farmers-advancements']);
  assert.match(java[0].label, /Stonecutter Woodworks \(Minecraft Java 1\/33\)/);
  // a project with an id is no longer offered
  const entered = serieTasks({ reihen, cfProjects: [{ modId: 'stonecutter-woodworks', kind: 'file', projectId: 1234567, status: 'pending' }], limit: 3 });
  assert.ok(!entered.some(t => t.id === 'stonecutter-woodworks'));
});

test('series form: no step ever targets a final button, Create and every Apply are waited for, no file is uploaded', () => {
  const { reihe, project } = findSerieProject(loadReihen(), 'tidy-endermen');
  const f = serieFields({ reihe, project, page: pageOf('bedrock', 'tidy-endermen'), files: ['banner.png', 'cover.png', 'logo.png'] });
  assert.deepEqual(f.images, ['banner.png', 'cover.png']);
  const plan = buildSerieSteps({ game: reihe.game }, f);
  for (const s of plan.steps.filter(s => s.action === 'click')) {
    assert.ok(!FORBIDDEN_CLICK.test(String(s.arg || '')) && !FORBIDDEN_AFTER_EDIT.test(String(s.arg || '')), `${s.title} would click a final button`);
  }
  const at = title => plan.steps.findIndex(s => s.title === title);
  assert.ok(at('Warten auf „Create“') > at('Beschreibung') && at('Warten auf „Create“') < at('Projekt-ID merken'));
  assert.equal(plan.steps.filter(s => s.title === 'Warten auf „Apply“').length, 2, 'one Apply per image, clicked by the operator');
  assert.ok(!plan.steps.some(s => s.target === 'projectFile' || s.target === 'addFile'), 'the first file goes up by API');
  // WoW pages have no banner, only the title image
  const wow = findSerieProject(loadReihen(), 'gold-diary');
  assert.deepEqual(serieFields({ ...wow, page: pageOf('wow', 'gold-diary'), files: ['cover.png'] }).images, ['cover.png']);
  assert.throws(() => buildSerieSteps({ game: 'tetris' }, f), /kennt der Helfer den Namen/);
});

// End-to-end against the stand-in of the CurseForge pages, like the skin pack flow.
let browser, skip = false;
before(async () => {
  try { browser = await chromium.launch(); }
  catch { try { browser = await chromium.launch({ channel: 'chrome' }); } catch { skip = 'no browser'; } }
});
after(() => browser?.close());

test('series form against the stand-in page: filled from the page, Create and Apply left to the user', async t => {
  if (skip) return t.skip(skip);
  const page = await browser.newPage();
  await page.setContent(fs.readFileSync(new URL('./fixtures/cf-flow.html', import.meta.url), 'utf-8'));
  const { reihe, project } = findSerieProject(loadReihen(), 'tidy-endermen');
  const pageJson = pageOf('bedrock', 'tidy-endermen');
  // The images only need to exist for the file inputs; the stand-in does not look at them.
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR || '/tmp'), 'cf-serie-'));
  for (const f of ['logo.png', 'banner.png', 'cover.png']) fs.writeFileSync(path.join(dir, f), 'PNG');
  const f = { ...serieFields({ reihe, project, page: pageJson, files: ['banner.png', 'cover.png'] }), dir };
  const steps = buildSerieSteps({ game: reihe.game }, f).steps.filter(s => s.action !== 'goto').map(s => (s.action === 'waitFor' ? { ...s, timeout: 15000 } : s));
  let stop = false, waiting = false;
  const user = (async () => {
    while (!stop) {
      if (waiting) {
        const clicked = await page.evaluate(name => {
          const visible = id => { const el = document.getElementById(id); return el && el.offsetParent !== null; };
          if (visible('create') && document.getElementById('desc').value && !window.log.includes('create')) { document.getElementById('create').click(); return true; }
          if (visible('apply') && document.getElementById('media-title').value === name) { document.getElementById('apply').click(); return true; }
          return false;
        }, pageJson.name).catch(() => false);
        if (clicked) waiting = false;
      }
      await new Promise(r => setTimeout(r, 100));
    }
  })();
  const asked = [];
  const { results, context } = await runSteps(page, steps, { timeout: 1500, pause: 0, log: line => { if (String(line).startsWith('⏸')) waiting = true; }, ask: async q => { asked.push(q); return ''; } });
  stop = true; await user;
  assert.deepEqual(results.filter(r => r.status !== 'ok'), []);
  assert.deepEqual(asked, []);
  assert.equal(context.projectId, 1234567);
  const state = await page.evaluate(() => ({ log: window.log, name: document.getElementById('name').value, cls: document.getElementById('class-value').textContent, main: document.getElementById('main').value, desc: document.getElementById('desc').value, license: document.getElementById('lic-value').textContent }));
  assert.deepEqual(state.log, ['create', 'apply', 'apply'], 'Create once, Apply per image, all by the user');
  assert.equal(state.name, 'Tidy Endermen');
  assert.equal(state.cls, 'Addons');
  assert.equal(state.main, pageJson.category);
  assert.match(state.desc, /^\*\*Tidy Endermen[\s\S]*AI-generated\.\)\*$/);
  assert.equal(state.license, 'All Rights Reserved');
});
