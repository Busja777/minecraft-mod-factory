import './lib/load-secrets.js';
import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline/promises';
import { spawnSync } from 'child_process';
import { chromium } from 'playwright-core';
import { loadMod } from './lib/mods.js';
import { listPacks, loadPack } from './lib/skinpacks.js';
import { loadProjects, saveProjects, findProject } from './lib/cf-projects.js';
import { savePack } from './lib/skinpacks.js';
import { recordProjectId, recordUpload, urlTemplate } from './lib/cf-browser/record.js';
import { loadReview, saveReview, markReviewPublished, APPROVED } from './lib/review.js';
import { listMods, modDir } from './lib/mods.js';
import { packDir } from './lib/skinpacks.js';
import { buildSteps } from './lib/cf-browser/steps.js';
import { listTasks } from './lib/cf-browser/tasks.js';
import { runSteps, formatSummary } from './lib/cf-browser/runner.js';
import { URLS } from './lib/cf-browser/selectors.js';
import { arg } from './lib/github-output.js';

// CurseForge browser helper: fills in the forms that have no API and stops before the final click.
//   npm run cf                                   menu with open tasks
//   npm run cf -- publish --skinpack <slug> | --mod <id>   new project: Create → Media → File in one run
//   npm run cf -- new    --skinpack <slug> | --mod <id>
//   npm run cf -- media  --skinpack <slug> | --mod <id>
//   npm run cf -- update --skinpack <slug> [--version x]
//   npm run cf -- login                          log in once (the profile remembers it)
//   npm run cf -- inspect                        save the structure of open pages (to calibrate selectors.js)
// Runs your installed Google Chrome, visibly, with its own profile in ~/Library/Application Support/cf-uploader.

const HOME = path.join(os.homedir(), 'Library', 'Application Support', 'cf-uploader');
const PROFILE = path.join(HOME, 'profile');
const INSPECT_DIR = path.join(HOME, 'inspect');
const LEARNED = path.join(HOME, 'learned.json'); // e.g. the project page URL pattern seen after "Create"
const learned = fs.existsSync(LEARNED) ? JSON.parse(fs.readFileSync(LEARNED, 'utf-8')) : {};
if (learned.projectUrl) URLS.project = learned.projectUrl;
const argv = process.argv.slice(2);
const command = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'menu';
const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = q => rl.question(`\n${q} `);

function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

async function openBrowser() {
  fs.mkdirSync(PROFILE, { recursive: true });
  try {
    return await chromium.launchPersistentContext(PROFILE, { channel: 'chrome', headless: false, slowMo: 250, viewport: null });
  } catch (e) {
    if (/ProcessSingleton|already in use|SingletonLock/i.test(e.message)) fail('Das CurseForge-Fenster ist schon offen. Erst schließen, dann neu starten.');
    fail(`Google Chrome ließ sich nicht starten.\n  ${e.message.split('\n')[0]}`);
  }
}

const pageOf = async context => context.pages()[0] || context.newPage();
const waitForClose = context => new Promise(resolve => context.on('close', resolve));

function taskFromArgs() {
  const slug = arg(argv, '--skinpack'), modId = arg(argv, '--mod');
  if (!slug && !modId) fail(`Aufruf: npm run cf -- ${command} --skinpack <slug> | --mod <id>`);
  const projects = loadProjects();
  const entry = findProject(projects, slug || modId);
  return { cmd: command, kind: slug ? 'skinpack' : 'mod', id: slug || modId, version: arg(argv, '--version'), projectId: Number.isInteger(entry?.projectId) ? entry.projectId : undefined };
}

async function chooseTask() {
  const reviews = Object.fromEntries([
    ...listPacks().map(s => [s, loadReview(packDir(s))]),
    ...listMods().map(m => [m, loadReview(modDir(m))])
  ].filter(([, r]) => r));
  const { todo, more, waitingForGo } = listTasks({ projects: loadProjects(), packs: listPacks().map(s => loadPack(s)), reviews });
  const all = [...todo, ...more];
  console.log('\nCurseForge-Helfer\n');
  if (todo.length) { console.log('Offene Aufgaben:'); todo.forEach((t, i) => console.log(`  ${i + 1}) ${t.label}`)); }
  else console.log('Keine offenen Aufgaben. 🎉');
  if (waitingForGo) console.log(`\n(${waitingForGo} neue${waitingForGo === 1 ? 's Projekt wartet' : ' Projekte warten'} im Studio auf dein Go: npm run studio)`);
  if (more.length) { console.log('\nWeitere:'); more.forEach((t, i) => console.log(`  ${todo.length + i + 1}) ${t.label}`)); }
  console.log('\n  l) Einloggen   i) Seiten für die Kalibrierung speichern   q) Beenden');
  const answer = (await ask('Auswahl:')).trim().toLowerCase();
  if (answer === 'l') return 'login';
  if (answer === 'i') return 'inspect';
  const task = all[Number(answer) - 1];
  if (!task) process.exit(0);
  return task;
}

async function runTask(task) {
  let data;
  try {
    data = task.kind === 'mod' ? { config, meta: loadMod(task.id).meta } : { config, pack: loadPack(task.id) };
  } catch (e) {
    fail(`${e.message}\n  Tipp: erst "git pull", damit die Daten aus GitHub Actions lokal da sind.`);
  }
  if (task.cmd === 'publish' && !argv.includes('--ohne-freigabe')) {
    const review = loadReview(reviewDir(task));
    if (review && !APPROVED.includes(review.status)) fail(`${task.id} hat im Studio noch kein Go (Status: ${review.status}). Erst freigeben: npm run studio`);
  }
  let plan;
  try { plan = buildSteps(task, data); } catch (e) { fail(e.message); }

  console.log(`\n▶ ${plan.title}\n  Chrome öffnet sich gleich. Bitte nicht in das Fenster klicken, solange Schritte laufen.\n`);
  const context = await openBrowser();
  const page = await pageOf(context);
  const { results, context: found } = await runSteps(page, plan.steps, { ask });
  if (plan.clipboard) spawnSync('pbcopy', { input: plan.clipboard });
  console.log(formatSummary(results, plan.notes));
  await recordResults(task, data, plan, found);
  rl.close();
  await waitForClose(context);
}

// Writes the learned project id / the upload back into data/ so the pipeline knows about them.
const reviewDir = task => (task.kind === 'mod' ? modDir(task.id) : packDir(task.id));

async function recordResults(task, data, plan, found) {
  const projects = loadProjects();
  let changed = false;
  if (found.projectId) {
    recordProjectId({ projects, pack: data.pack, task, name: data.pack?.name || data.meta?.name, projectId: found.projectId });
    const template = urlTemplate(found.projectUrl, found.projectId);
    if (template && template !== learned.projectUrl) {
      fs.writeFileSync(LEARNED, JSON.stringify({ ...learned, projectUrl: template }, null, 2));
    }
    console.log(`\n✓ Projekt-ID ${found.projectId} in data/cf-projects.json eingetragen.`);
    changed = true;
  }
  if (plan.record && data.pack) {
    const v = data.pack.versions.find(x => x.version === plan.record.version);
    if (v && v.status !== 'published') {
      const a = (await ask(`Hast du V${v.version} mit „Add File“ hochgeladen? (j/n)`)).trim().toLowerCase();
      if (a === 'j' || a === 'y') {
        recordUpload({ projects, pack: data.pack, task, version: v.version, intervalDays: config.updateIntervalDays });
        console.log(`✓ V${v.version} als veröffentlicht markiert, nächstes Update frühestens in 23 Tagen.`);
        changed = true;
      }
    }
  }
  // Studio: Skinpack gilt als veröffentlicht, sobald die erste Datei oben ist; ein Mod, sobald das Projekt steht
  // (seine .jar lädt die API hoch).
  const review = loadReview(reviewDir(task));
  const done = task.kind === 'mod' ? !!found.projectId : data.pack?.versions?.[0]?.status === 'published';
  if (task.cmd === 'publish' && review && APPROVED.includes(review.status) && done) {
    saveReview(reviewDir(task), markReviewPublished(review));
    console.log('✓ Im Studio als veröffentlicht markiert.');
  }
  if (changed) {
    saveProjects(projects);
    if (data.pack) savePack(data.pack);
    console.log('  Bitte committen und pushen, damit die Pipeline es auch weiß (Bilder-Links brauchen den Push ohnehin).');
  }
}

async function login() {
  const context = await openBrowser();
  const page = await pageOf(context);
  await page.goto(URLS.home);
  await ask('Bitte im Browser bei CurseForge einloggen. Wenn du eingeloggt bist, hier Enter drücken.');
  await context.close();
  console.log('✓ Login gespeichert. Ab jetzt bist du im CurseForge-Fenster automatisch eingeloggt.');
  rl.close();
}

async function inspect() {
  fs.mkdirSync(INSPECT_DIR, { recursive: true });
  const context = await openBrowser();
  const page = await pageOf(context);
  await page.goto(URLS.home);
  console.log('\nKalibrier-Modus: Öffne im Browser eine CurseForge-Seite (z. B. das Start-Project-Formular),');
  console.log('dann hier Enter drücken. Der Aufbau der Seite wird gespeichert. Nichts wird ausgefüllt.');
  for (let n = 1; ; n++) {
    const a = (await ask(`[${n}] Enter = Seite speichern, q = fertig:`)).trim().toLowerCase();
    if (a === 'q') break;
    const p = context.pages().at(-1);
    const fields = await p.evaluate(() => [...document.querySelectorAll('input, select, textarea, [contenteditable=true], button, [role=button], [role=tab], [role=combobox], a')]
      .filter(el => el.offsetParent !== null || el.type === 'file')
      .slice(0, 400)
      .map(el => {
        const label = (el.labels?.[0]?.innerText || el.getAttribute('aria-label') || el.closest('label')?.innerText || '').trim();
        return [el.tagName.toLowerCase(), el.type && `type=${el.type}`, el.getAttribute('role') && `role=${el.getAttribute('role')}`, el.name && `name=${el.name}`, el.id && `id=${el.id}`, el.placeholder && `placeholder="${el.placeholder}"`, el.accept && `accept=${el.accept}`, label && `label="${label.slice(0, 60)}"`, ['A', 'BUTTON'].includes(el.tagName) || el.getAttribute('role') ? `text="${(el.innerText || '').trim().slice(0, 60)}"` : '']
          .filter(Boolean).join(' ');
      }));
    const aria = await p.locator('body').ariaSnapshot().catch(e => `(ariaSnapshot nicht verfügbar: ${e.message})`);
    const file = path.join(INSPECT_DIR, `${new Date().toISOString().replace(/[:.]/g, '-')}-${n}.txt`);
    fs.writeFileSync(file, `URL: ${p.url()}\nTITLE: ${await p.title()}\n\n== FELDER ==\n${fields.join('\n')}\n\n== ARIA ==\n${aria}\n`);
    console.log(`  ✓ gespeichert: ${file}`);
  }
  await context.close();
  console.log(`\nAlle Seiten liegen in: ${INSPECT_DIR}\nGib Claude Bescheid, dann werden die echten Feldnamen in selectors.js eingetragen.`);
  rl.close();
}

let choice = command;
if (command === 'menu') choice = await chooseTask();
if (choice === 'login') await login();
else if (choice === 'inspect') await inspect();
else if (typeof choice === 'object') await runTask(choice);
else if (['publish', 'new', 'media', 'update'].includes(choice)) await runTask(taskFromArgs());
else fail(`Unbekannter Befehl "${choice}". Möglich: publish, new, media, update, login, inspect (oder ohne Befehl für das Menü).`);
