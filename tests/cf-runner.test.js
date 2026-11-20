import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { chromium } from 'playwright-core';
import { runSteps, formatSummary } from '../scripts/lib/cf-browser/runner.js';
import { buildSteps } from '../scripts/lib/cf-browser/steps.js';
import { TARGETS } from '../scripts/lib/cf-browser/selectors.js';

// End-to-end against a stand-in of the CurseForge pages (tests/fixtures/cf-flow.html), headless.
// Skipped when no Chromium/Chrome is available.

let browser, skip = false;
before(async () => {
  try { browser = await chromium.launch(); }
  catch { try { browser = await chromium.launch({ channel: 'chrome' }); } catch { skip = 'no browser'; } }
});
after(() => browser?.close());

const html = fs.readFileSync(new URL('./fixtures/cf-flow.html', import.meta.url), 'utf-8');
const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
const realPack = () => ({ ...JSON.parse(fs.readFileSync('./data/skins/glowing-samurai/pack.json', 'utf-8')), lastGameVersions: ['1.21', '26.3', '26.10'] });
const quiet = { log: () => {}, timeout: 1500, pause: 0 };

// Plays the user: clicks Create / Apply / Add File once the tool has filled the form.
function simulateUser(page) {
  let stop = false;
  const loop = (async () => {
    while (!stop) {
      await page.evaluate(() => {
        const visible = id => { const el = document.getElementById(id); return el && el.offsetParent !== null; };
        if (visible('create') && document.getElementById('desc').value && !window.log.includes('create')) document.getElementById('create').click();
        if (visible('apply') && document.getElementById('media-title').value === 'MCPEDL') document.getElementById('apply').click();
        if (visible('submit-file') && document.getElementById('changelog').value) document.getElementById('submit-file').click();
      }).catch(() => {});
      await new Promise(r => setTimeout(r, 300));
    }
  })();
  return () => { stop = true; return loop; };
}

test('publish flow: Create → Media → File, filled in the Anleitung order, final clicks left to the user', async t => {
  if (skip) return t.skip(skip);
  const page = await browser.newPage();
  await page.setContent(html);
  const plan = buildSteps({ cmd: 'publish', kind: 'skinpack', id: 'glowing-samurai' }, { config, pack: realPack() });
  const steps = plan.steps.filter(s => s.action !== 'goto').map(s => (s.action === 'waitFor' ? { ...s, timeout: 15000 } : s));
  const stopUser = simulateUser(page);
  const asked = [];
  const { results, context } = await runSteps(page, steps, { ...quiet, ask: async q => { asked.push(q); return ''; } });
  await stopUser();

  const notOk = results.filter(r => r.status !== 'ok');
  assert.deepEqual(notOk, [], `not ok: ${JSON.stringify(notOk)}`);
  assert.deepEqual(asked, [], 'nothing needed the user except the final clicks');
  assert.equal(context.projectId, 1234567);

  const state = await page.evaluate(() => ({
    log: window.log,
    name: document.getElementById('name').value, summary: document.getElementById('summary').value,
    logo: document.getElementById('logo').files[0]?.name, cls: document.getElementById('class-value').textContent,
    main: document.getElementById('main').value, mobs: document.getElementById('add-mobs').checked, skinPacks: document.getElementById('add-skinpacks').checked,
    descEditor: document.getElementById('desc-editor').value, desc: document.getElementById('desc').value,
    license: document.getElementById('lic-value').textContent, dist: document.getElementById('dist-value').textContent,
    cover: document.getElementById('cover').files[0]?.name, title: document.getElementById('media-title').value,
    file: document.getElementById('pack-file').files[0]?.name, v263: document.getElementById('v263').checked, v2610: document.getElementById('v2610').checked,
    release: document.getElementById('rel-value').textContent, clEditor: document.getElementById('cl-editor').value, changelog: document.getElementById('changelog').value
  }));
  assert.deepEqual(state.log, ['create', 'apply', 'add-file'], 'each final button clicked exactly once — by the user');
  assert.equal(state.name, 'Glowing Samurai');
  assert.match(state.summary, /glowing samurai/i);
  assert.equal(state.logo, 'Glowing Samurai.png');
  assert.equal(state.cls, 'Skins');
  assert.equal(state.main, 'Players');
  assert.equal(state.skinPacks, true, 'pre-ticked category must stay ticked');
  assert.equal(state.mobs, false);
  assert.equal(state.descEditor, 'Markdown');
  assert.match(state.desc, /^# Glowing Samurai[\s\S]*AI-generated/);
  assert.equal(state.license, 'All Rights Reserved');
  assert.equal(state.dist, 'Allow distribution to 3rd party');
  assert.equal(state.cover, 'Glowing Samurai Cover.png');
  assert.equal(state.title, 'MCPEDL');
  assert.equal(state.file, 'SamuraiSaga_GlowPack.mcpack');
  assert.deepEqual([state.v263, state.v2610], [true, true]);
  assert.equal(state.release, 'Release');
  assert.equal(state.clEditor, 'Markdown');
  assert.match(state.changelog, /## V1\.0[\s\S]*!\[V1\.0 skins\]\(https:\/\/raw\.githubusercontent\.com\//);
});

test('description follow-up: the description is filled, Save stays with the user, Media is never opened', async t => {
  if (skip) return t.skip(skip);
  const page = await browser.newPage();
  await page.setContent(html);
  await page.evaluate(() => show('edit'));
  const pack = JSON.parse(fs.readFileSync('./data/skins/the-last-ninjas/pack.json', 'utf-8'));
  const plan = buildSteps({ cmd: 'seite', kind: 'skinpack', id: pack.slug, projectId: pack.cfProjectId, version: '1.2' }, { config, pack });
  const steps = plan.steps.filter(s => s.action !== 'manual').map(s => (s.action === 'waitFor' ? { ...s, timeout: 15000, checkEvery: 200 } : s));
  // The user: saves once the description is in the field.
  let stop = false;
  const user = (async () => {
    while (!stop) {
      await page.evaluate(() => {
        const visible = id => { const el = document.getElementById(id); return el && el.offsetParent !== null; };
        if (visible('save-desc') && document.getElementById('desc').value && !window.log.includes('save')) document.getElementById('save-desc').click();
      }).catch(() => {});
      await new Promise(r => setTimeout(r, 200));
    }
  })();
  const asked = [];
  // Stand-in for the Core API read-back: true once the saved description contains the new section.
  const checks = { description: () => page.evaluate(() => /Added in V1\.2/.test(window.savedDescription || '')) };
  const { results } = await runSteps(page, steps, { ...quiet, checks, ask: async q => { asked.push(q); return ''; } });
  stop = true; await user;

  const notOk = results.filter(r => r.status !== 'ok');
  assert.deepEqual(notOk, [], `not ok: ${JSON.stringify(notOk)}`);
  assert.deepEqual(asked, [], 'the saved description was recognised without asking');
  const state = await page.evaluate(() => ({ log: window.log, editor: document.getElementById('desc-editor').value, saved: window.savedDescription, mediaShown: document.querySelector('[data-panel=media]').offsetParent !== null, upload: document.getElementById('cover').files.length }));
  assert.deepEqual(state.log, ['save'], 'Save clicked exactly once — by the user');
  assert.equal(state.editor, 'Markdown');
  assert.match(state.saved, /^# The Last Ninjas[\s\S]*- \*\*Neon Shogun\*\* — [\s\S]*## How to install/);
  assert.match(state.saved, /!\[All The Last Ninjas skins\]\(https:\/\/raw\.githubusercontent\.com\/[^)]+\/media\/collection\.png\)/);
  assert.match(state.saved, /## Added in V1\.2[\s\S]*!\[V1\.2 preview\]\([^)]+v1\.2-skins\.png\)/, 'the update screenshot is in the description');
  assert.equal(state.mediaShown, false, 'the Media tab was never opened');
  assert.equal(state.upload, 0, 'nothing uploaded to the gallery');
});

test('without a read-back the helper asks instead of guessing that Save was clicked', async t => {
  if (skip) return t.skip(skip);
  const page = await browser.newPage();
  await page.setContent(html);
  const asked = [];
  const { results } = await runSteps(page, [{ title: 'Warten auf „Save“', action: 'waitFor', value: 'Bitte speichern', until: { check: 'description' } }], { ...quiet, ask: async q => { asked.push(q); return ''; } });
  assert.equal(results[0].status, 'ok');
  assert.match(asked[0], /Wenn du gespeichert hast/);
  assert.deepEqual(await page.evaluate(() => window.log), []);
});

test('never clicks Create or Apply, and no second "Add File" once the form is filled', async t => {
  if (skip) return t.skip(skip);
  const page = await browser.newPage();
  await page.setContent(html);
  await page.evaluate(() => { show('edit files'); document.getElementById('file-form').hidden = false; document.getElementById('media-edit').hidden = false; show('edit files license media'); });
  const targets = { ...TARGETS, createBtn: [{ css: '#create' }], applyBtn: [{ css: '#apply' }] };
  const { results } = await runSteps(page, [
    { title: 'Create', action: 'click', target: 'createBtn' },
    { title: 'Apply', action: 'click', target: 'applyBtn' },
    { title: 'Changelog', action: 'fill', target: 'changelog', value: 'x' },
    { title: 'Add File again', action: 'click', target: 'addFile' }
  ], { ...quiet, ask: async () => '', targets });
  assert.deepEqual(results.map(r => r.status), ['manual', 'manual', 'ok', 'manual']);
  assert.match(results[0].detail, /klickst du selbst/);
  assert.match(results[3].detail, /würde jetzt das Formular abschicken/);
  assert.deepEqual(await page.evaluate(() => window.log), []);
  assert.match(formatSummary(results), /⚠ 3 bitte selbst prüfen[\s\S]*SELBST/);
});

test('a missing field is reported instead of crashing, missing navigation asks the user', async t => {
  if (skip) return t.skip(skip);
  const page = await browser.newPage();
  await page.setContent(html);
  const asked = [];
  const targets = { ...TARGETS, nope: [{ css: '#does-not-exist' }] };
  const { results } = await runSteps(page, [
    { title: 'Optional', action: 'fill', target: 'nope', value: 'a', optional: true },
    { title: 'Field', action: 'fill', target: 'nope', value: 'b' },
    { title: 'Nav', action: 'click', target: 'nope' }
  ], { ...quiet, timeout: 300, ask: async q => { asked.push(q); return ''; }, targets });
  assert.deepEqual(results.map(r => r.status), ['skipped', 'manual', 'manual']);
  assert.match(results[1].detail, /Feld nicht gefunden → b/);
  assert.equal(asked.length, 1);
});

test('waits for the user while a security check page is shown', async t => {
  if (skip) return t.skip(skip);
  const page = await browser.newPage();
  await page.setContent('<title>Just a moment...</title><p>Checking</p>');
  let asks = 0;
  const { results } = await runSteps(page, [{ title: 'Create A Project', action: 'click', target: 'startProject' }], {
    ...quiet, ask: async () => { asks++; await page.setContent(html); return ''; }
  });
  assert.equal(asks, 1);
  assert.equal(results[0].status, 'ok');
});

// ── Hands-free (started from the chat, nobody at the terminal) ────────────────────────────────────

test('hands-free: the description run waits for the operator\'s Save by watching, never by asking', async t => {
  if (skip) return t.skip(skip);
  const page = await browser.newPage();
  await page.setContent(html);
  await page.evaluate(() => show('edit'));
  const pack = JSON.parse(fs.readFileSync('./data/skins/the-last-ninjas/pack.json', 'utf-8'));
  const plan = buildSteps({ cmd: 'seite', kind: 'skinpack', id: pack.slug, projectId: pack.cfProjectId, version: '1.2' }, { config, pack });
  const steps = plan.steps.filter(s => s.action !== 'manual').map(s => (s.action === 'waitFor' ? { ...s, checkEvery: 200 } : s));
  // The operator saves two seconds after the field was filled.
  let stop = false, filledAt = 0;
  const user = (async () => {
    while (!stop) {
      const filled = await page.evaluate(() => !!document.getElementById('desc').value).catch(() => false);
      if (filled && !filledAt) filledAt = Date.now();
      if (filledAt && Date.now() - filledAt > 2000) await page.evaluate(() => { if (!window.log.includes('save')) document.getElementById('save-desc').click(); }).catch(() => {});
      await new Promise(r => setTimeout(r, 200));
    }
  })();
  const checks = { description: () => page.evaluate(() => /Added in V1\.2/.test(window.savedDescription || '')) };
  const { results } = await runSteps(page, steps, { ...quiet, checks, handsFree: true, ask: async () => { throw new Error('asked in a hands-free run'); } });
  stop = true; await user;
  assert.deepEqual(results.filter(r => r.status !== 'ok'), []);
  assert.deepEqual(await page.evaluate(() => window.log), ['save'], 'Save clicked once, by the operator');
});

test('hands-free: an unseen click is reported, a missing page stops the task, nothing blocks on Enter', async t => {
  if (skip) return t.skip(skip);
  const page = await browser.newPage();
  await page.setContent(html);
  const ask = async () => { throw new Error('asked in a hands-free run'); };
  const targets = { ...TARGETS, nope: [{ css: '#does-not-exist' }] };
  const { results } = await runSteps(page, [
    { title: 'Projektseite öffnen', action: 'manual', value: 'Öffne die Projektseite.' },
    { title: 'Nav', action: 'click', target: 'nope' },
    { title: 'Warten auf „Save“', action: 'waitFor', value: 'Bitte speichern', until: { check: 'description' } }
  ], { ...quiet, timeout: 300, handsFree: true, ask, targets });
  assert.deepEqual(results.map(r => r.status), ['manual', 'manual', 'manual']);
  assert.match(results[2].detail, /nicht erkannt/);
  assert.deepEqual(await page.evaluate(() => window.log), [], 'no final button was clicked');
});

test('hands-free: a login or security check is never automated, the run waits and then gives up', async t => {
  if (skip) return t.skip(skip);
  const page = await browser.newPage();
  await page.setContent('<title>Just a moment...</title><p>Checking</p>');
  const logs = [];
  // The operator solves the check after a moment.
  setTimeout(() => page.setContent(html).catch(() => {}), 600);
  const { results } = await runSteps(page, [{ title: 'Create A Project', action: 'click', target: 'startProject' }], {
    ...quiet, log: l => logs.push(l), handsFree: true, humanWait: 5000, ask: async () => { throw new Error('asked'); }
  });
  assert.equal(results[0].status, 'ok');
  assert.equal(logs.filter(l => /Sicherheitsprüfung/.test(l)).length, 1, 'said once, then waited');

  const stuck = await browser.newPage();
  await stuck.setContent('<title>Just a moment...</title>');
  await assert.rejects(runSteps(stuck, [{ title: 'x', action: 'click', target: 'startProject' }], { ...quiet, handsFree: true, humanWait: 400, ask: async () => '' }), /Abgebrochen/);
});
