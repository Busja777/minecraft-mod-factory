import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { REIHEN, loadReihe, loadReihen, findSerieProject, plannedDate, outDir, projectDir, addStock, stateOf, reiheStand, registerProject } from '../scripts/lib/serie.js';
import { checkPage, pageOk, section, AI_LOGO_NOTE } from '../scripts/lib/page-check.js';
import { coverHtml, renderCover, THEMES, SIZE } from '../tools/serie/cover.js';
import { loadReleaseProject } from '../scripts/lib/releases.js';
import { awaitsFirstFile, activeAccounts } from '../scripts/lib/games.js';

const REPO = path.resolve('.');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'serie-'));
const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));

test('the plan: four rows of 33 projects with unique slugs and known kinds', () => {
  const reihen = loadReihen();
  assert.deepEqual(reihen.map(r => r.reihe), REIHEN);
  const slugs = new Set();
  for (const r of reihen) {
    assert.equal(r.projects.length, 33, r.reihe);
    assert.ok(config.games[r.game], `${r.reihe}: game ${r.game} is not in config.games`);
    assert.ok(THEMES[r.reihe], `${r.reihe}: no cover theme`);
    assert.ok(r.logoStyle);
    r.projects.forEach((p, i) => {
      assert.equal(p.nr, i + 1);
      assert.ok(!slugs.has(p.slug), `slug ${p.slug} twice`);
      slugs.add(p.slug);
      assert.ok(r.arts[p.art], `${p.slug}: unknown kind ${p.art}`);
      assert.ok(p.name.length <= 30, `${p.name} is longer than 30 characters`);
      assert.equal(p.updates.length, 3, `${p.slug}: three planned updates`);
      assert.ok(p.was);
    });
  }
  assert.equal(slugs.size, 132);
});

test('planned days: one project per day from the row\'s start', () => {
  const by = Object.fromEntries(loadReihen().map(r => [r.reihe, r]));
  assert.equal(plannedDate(by.wow, 1), '2026-11-20');
  assert.equal(plannedDate(by.wow, 12), '2026-12-01');
  assert.equal(plannedDate(by.wow, 33), '2026-12-22');
  assert.equal(plannedDate(by.java, 33), '2026-12-25');
  assert.equal(plannedDate(by.stardew, 33), '2026-12-27');
  assert.equal(plannedDate(by.sims4, 33), '2026-12-29');
  assert.equal(outDir('wow', by.wow.projects[0]), path.join('Output', 'serie', 'wow', '01-gold-diary'));
  assert.equal(projectDir('wow', 'gold-diary'), path.join('tools', 'wow', 'projects', 'gold-diary'));
  assert.throws(() => findSerieProject(loadReihen(), 'nope'), /Kein Serien-Projekt/);
  assert.throws(() => loadReihe('tetris'), /Unbekannte Reihe/);
});

test('stock before the page exists, then ID = Go for the first file', () => {
  const root = tmp();
  const reihe = loadReihe('wow');
  const project = reihe.projects[1];
  const zip = path.join(root, 'LevelClock-1.0.zip');
  fs.writeFileSync(zip, 'ZIP');
  const ctx = { cfProjects: [], releaseRoot: path.join(root, 'projects') };
  assert.equal(stateOf(project, ctx), 'geplant');
  assert.throws(() => registerProject(reihe, project, 111, ctx), /noch keine gebaute Version/);

  const v = addStock(reihe, project, { version: '1.0', file: zip, changelog: '## 1.0\n\nFirst release.', gameVersions: ['12.1.5'], versionTypes: ['WoW Retail', 'WoW Forever'] }, ctx.releaseRoot);
  assert.equal(v.status, 'due');
  const rp = loadReleaseProject(project.slug, ctx.releaseRoot);
  assert.equal(rp.cfProjectId, null);
  assert.equal(rp.game, 'wow');
  assert.deepEqual(rp.versionTypes, ['WoW Retail', 'WoW Forever']);
  assert.equal(stateOf(project, ctx), 'gebaut');
  assert.throws(() => addStock(reihe, project, { version: '1.0', file: zip, changelog: 'x' }, ctx.releaseRoot), /already has a version/);

  assert.throws(() => registerProject(reihe, project, 0, ctx), /Ungültige Projekt-ID/);
  const entry = registerProject(reihe, project, 4711, ctx);
  assert.equal(entry.kind, 'file');
  assert.equal(entry.status, 'pending');
  assert.equal(entry.autoStart, true);
  assert.deepEqual(entry.serie, { reihe: 'wow', nr: 2 });
  assert.ok(awaitsFirstFile(entry));
  assert.equal(loadReleaseProject(project.slug, ctx.releaseRoot).cfProjectId, 4711);
  assert.equal(stateOf(project, ctx), 'angelegt');
  assert.throws(() => registerProject(reihe, reihe.projects[2], 4711, ctx), /schon eingetragen/);

  entry.status = 'published';
  assert.equal(stateOf(project, ctx), 'online');
  const s = reiheStand(reihe, ctx);
  assert.equal(s.online, 1);
  assert.equal(s.geplant, 32);
  assert.equal(s.next.nr, 1);
});

test('a project that waits for its first file makes its account an evening leg', () => {
  const waiting = { modId: 'level-clock', kind: 'file', game: 'wow', status: 'pending', autoStart: true, projectId: 5 };
  assert.deepEqual(activeAccounts(config, [waiting]), [{ account: 'wow', tokenEnv: 'CF_API_TOKEN_WOW' }]);
  assert.deepEqual(activeAccounts(config, [{ ...waiting, autoStart: undefined }]), [], 'without the ID step nothing starts by itself');
  assert.deepEqual(activeAccounts(config, [{ ...waiting, projectId: null }]), []);
});

// ── page check ────────────────────────────────────────────────────────────────────────────────
const goodPage = () => ({
  name: 'Gold Diary',
  summary: 'See where your gold comes from and where it goes, by source, for your session and the week.',
  category: 'Auction & Economy',
  description: [
    '**Gold Diary keeps a simple diary of your gold, so you see what a session was worth.**', '',
    '## Features',
    '- Sorts every gold change by source: loot, quests, vendor, repairs, mail and more.',
    '- Three views: this session, today and the last seven days, with earned, spent and net gold.',
    '- Net gold per hour for the current session.', '',
    '## How to use',
    'Type `/gd` to open or close the diary. `/gd reset` starts a new session. Escape closes the window too.', '',
    '## Good to know',
    '- Works on Retail. It uses no combat data and reads no chat, so it behaves the same everywhere.',
    '- A change is sorted by the window that is open at that moment. The rest is listed as Other.',
    '- It records only while you are logged in, and history is kept for sixty days per character.',
    '- New features arrive with updates, see each file\'s changelog.', '',
    'Found a bug or have an idea? Leave a comment.', '',
    AI_LOGO_NOTE
  ].join('\n')
});

async function images(dir, { logo = [400, 400], cover = [1280, 720], flat = false } = {}) {
  const noise = (w, h) => sharp(Buffer.from(Array.from({ length: w * h * 3 }, (_, i) => (i * 37 + (i >> 3) * 11) % 256)), { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
  const plain = (w, h) => sharp({ create: { width: w, height: h, channels: 3, background: '#224466' } }).png().toBuffer();
  fs.writeFileSync(path.join(dir, 'logo.png'), flat ? await plain(...logo) : await noise(...logo));
  fs.writeFileSync(path.join(dir, 'cover.png'), await noise(...cover));
  return { logo: path.join(dir, 'logo.png'), cover: path.join(dir, 'cover.png'), shots: [] };
}
const level = (results, id) => results.find(r => r.id === id).level;

test('page check: a short page in the house style passes', async () => {
  const results = await checkPage(goodPage(), await images(tmp()));
  assert.deepEqual(results.filter(r => r.level !== 'ok'), []);
  assert.ok(pageOk(results));
  assert.match(section(goodPage().description, 'How to use'), /^Type `\/gd`/);
  assert.equal(section(goodPage().description, 'Nope'), null);
});

test('page check: title, summary and description rules', async () => {
  const files = await images(tmp());
  const check = async change => checkPage({ ...goodPage(), ...change }, files);
  assert.equal(level(await check({ name: 'Gold Diary for World of Warcraft' }), 'name'), 'error');
  assert.equal(level(await check({ name: 'Gold Diary Addon' }), 'name'), 'error');
  assert.equal(level(await check({ name: 'Gold Diary 1.2' }), 'name'), 'error');
  assert.equal(level(await check({ name: 'Gold-Tagebuch für Händler' }), 'name'), 'error');
  assert.equal(level(await check({ summary: 'Tracks gold. Shows sources.' }), 'summary'), 'error', 'two sentences');
  assert.equal(level(await check({ summary: 'x'.repeat(151) }), 'summary'), 'error');
  assert.equal(level(await check({ summary: 'Gold Diary keeps a simple diary of your gold, so you see what a session was worth.' }), 'summary'), 'error', 'copied from the description');
  assert.equal(level(await check({ summary: 'Tracks 13 sources of gold for your session.' }), 'summary'), 'warn');

  const d = goodPage().description;
  const detail = async description => (await check({ description })).find(r => r.id === 'description').detail;
  assert.match(await detail(d.replace('## How to use', '## Usage')), /Abschnitt „How to use“ fehlt/);
  assert.match(await detail(d.replace(AI_LOGO_NOTE, '')), /KI-Hinweis/);
  assert.match(await detail(d.replace('- Net gold per hour for the current session.\n', '')), /2 Stichpunkte/);
  assert.match(await detail(`${d.replace(AI_LOGO_NOTE, '')}${'More words here. '.repeat(40)}\n\n${AI_LOGO_NOTE}`), /Wörter/);
  assert.match(await detail(d.replace('**Gold Diary keeps', 'Gold Diary keeps').replace('worth.**', 'worth.')), /fetten Satz/);
  assert.match(await detail(d.replace('Type `/gd`', 'A must-have: type `/gd`')), /Floskel/);
  assert.match(await detail(d.replace('Leave a comment.', 'See https://example.com.')), /Link/);
  assert.match(await detail(d.replace(/- New features.*\n/, '')), /Changelog/);
  assert.equal(level(await check({ category: '' }), 'category'), 'error');
});

test('page check: images', async () => {
  assert.equal(level(await checkPage(goodPage(), await images(tmp(), { flat: true })), 'logo'), 'error', 'flat colour');
  assert.equal(level(await checkPage(goodPage(), await images(tmp(), { logo: [512, 512] })), 'logo'), 'error');
  assert.equal(level(await checkPage(goodPage(), await images(tmp(), { cover: [720, 340] })), 'cover'), 'error');
  assert.equal(level(await checkPage(goodPage(), {}), 'logo'), 'error', 'missing');
  const files = await images(tmp());
  assert.equal(level(await checkPage(goodPage(), files, { needsShot: true }), 'shots'), 'error', 'visual packs need a real in-game image');
  assert.equal(level(await checkPage(goodPage(), { ...files, shots: [files.cover] }, { needsShot: true }), 'shots'), 'ok');
});

test('cover: one theme per row, text is escaped, three bullets are required', async () => {
  const logo = fs.readFileSync((await images(tmp())).logo);
  const html = coverHtml({ reihe: 'wow', name: 'Gold <Diary>', tagline: 'Know & see.', bullets: ['a', 'b', 'c'], logo });
  assert.match(html, /Gold &lt;Diary&gt;/);
  assert.match(html, /Know &amp; see\./);
  assert.match(html, /World of Warcraft addon/);
  assert.throws(() => coverHtml({ reihe: 'wow', name: 'x', tagline: 't', bullets: ['a', 'b'], logo }), /three bullets/);
  assert.throws(() => coverHtml({ reihe: 'tetris', name: 'x', tagline: 't', bullets: ['a', 'b', 'c'], logo }), /No cover theme/);
  const png = await renderCover({ reihe: 'stardew', name: 'Welcome Kit', tagline: 'A starter parcel on day one.', bullets: ['a', 'b', 'c'], logo });
  const meta = await sharp(png).metadata();
  assert.deepEqual([meta.width, meta.height, meta.format], [...SIZE, 'png']);
});

test('every project with a page in the repo passes the text checks and has its logo', async () => {
  for (const reihe of loadReihen()) {
    for (const project of reihe.projects) {
      const dir = projectDir(reihe.reihe, project.slug);
      const file = path.join(dir, 'page.json');
      if (!fs.existsSync(file)) continue;
      const page = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (Array.isArray(page.description)) page.description = page.description.join('\n');
      assert.equal(page.name, project.name, `${project.slug}: page name and plan name differ`);
      assert.ok(page.logoPrompt && page.cover?.tagline && page.cover?.bullets?.length === 3, `${project.slug}: logoPrompt and cover are needed`);
      const results = await checkPage(page, { logo: path.join(dir, 'logo.png') }, { maxWords: reihe.reihe === 'sims4' ? 250 : 200 });
      const failed = results.filter(r => r.level === 'error' && !['cover', 'shots'].includes(r.id));
      assert.deepEqual(failed, [], `${project.slug}: ${failed.map(r => `${r.label}: ${r.detail}`).join(' | ')}`);
    }
  }
});

// ── the command in a throw-away repo ──────────────────────────────────────────────────────────
test('npm run serie: stock, status, plan and the ID step', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(config));
  fs.mkdirSync(path.join(dir, 'data', 'serie'), { recursive: true });
  for (const k of REIHEN) fs.copyFileSync(path.join(REPO, 'data', 'serie', `${k}.json`), path.join(dir, 'data', 'serie', `${k}.json`));
  fs.writeFileSync(path.join(dir, 'data', 'cf-projects.json'), '[]');
  fs.writeFileSync(path.join(dir, 'a.zip'), 'ZIP');
  fs.writeFileSync(path.join(dir, '1.0.md'), '## Level Clock 1.0\n\nFirst release.');
  const run = (...args) => execFileSync(process.execPath, [path.join(REPO, 'scripts', 'serie.js'), ...args], { cwd: dir, env: { PATH: process.env.PATH, HOME: process.env.HOME, NOW: '2026-11-21T10:00:00Z' }, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });

  assert.match(run('vorrat', 'level-clock', '--version', '1.0', '--file', 'a.zip', '--changelog', '1.0.md', '--game-versions', '12.1.5'), /Level Clock V1.0 liegt im Vorrat/);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'data', 'projects', 'level-clock', 'project.json'), 'utf-8')).versions[0].gameVersions, ['12.1.5']);
  assert.match(run('stand'), /World of Warcraft: 0 online · 0 angelegt · 1 gebaut · 32 offen/);
  assert.match(run('heute'), /Anlegen: Level Clock – Seite fehlt noch/);
  assert.match(run('heute'), /Minecraft Java\n {2}Startet am 23\.11\./);

  assert.match(run('id', 'level-clock', '4711'), /Level Clock \(World of Warcraft\) ist eingetragen/);
  const entry = JSON.parse(fs.readFileSync(path.join(dir, 'data', 'cf-projects.json'), 'utf-8'))[0];
  assert.equal(entry.projectId, 4711);
  assert.equal(entry.autoStart, true);
  assert.match(run('heute'), /Geht heute Abend hoch: Level Clock V1.0/);
  assert.throws(() => run('id', 'level-clock', '4712'), /schon eingetragen/);
  assert.throws(() => run('id', 'gold-diary', '4713'), /noch keine gebaute Version/);

  run('plan');
  const plan = fs.readFileSync(path.join(dir, 'Output', 'serie', 'PLAN.md'), 'utf-8');
  assert.match(plan, /\| 2 \| 21\.11\. \| Level Clock \| Addon \(Retail \+ Forever\) \|.*\| angelegt \|/);
  assert.match(plan, /## The Sims 4 \(Start 27\.11\.\)/);
});
