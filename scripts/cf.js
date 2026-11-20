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
import { loadReview, saveReview, markReviewPublished, markDue, APPROVED } from './lib/review.js';
import { listMods, modDir } from './lib/mods.js';
import { packDir } from './lib/skinpacks.js';
import { buildSteps } from './lib/cf-browser/steps.js';
import { listTasks, dayPlan } from './lib/cf-browser/tasks.js';
import { pullIfClean, commitData, closeUpdateIssue } from './lib/cf-browser/tidy.js';
import { runSteps, formatSummary } from './lib/cf-browser/runner.js';
import { URLS } from './lib/cf-browser/selectors.js';
import { arg } from './lib/github-output.js';
import { getDescription } from './platforms/curseforge-core.js';
import { pageState, pageBehind, tracksPage } from './lib/page-state.js';

// CurseForge browser helper: fills in the forms that have no API and stops before the final click.
//   npm run cf                                   menu with open tasks
//   npm run cf -- heute [--dry-run] [--ohne-enter] [--melden]
//                                                the day's list: everything that waits for you, worked through in
//                                                one window after one Go. --ohne-enter: started from the chat, no
//                                                terminal input (the helper watches the browser instead);
//                                                --melden: only a Mac notification (for the launchd schedule)
//   npm run cf -- publish --skinpack <slug> | --mod <id>   new project: Create → Media → File in one run
//   npm run cf -- new    --skinpack <slug> | --mod <id>
//   npm run cf -- media  --skinpack <slug> | --mod <id>
//   npm run cf -- update --skinpack <slug> [--version x]
//   npm run cf -- seite  [--skinpack <slug>]     description after an update (all open ones, or one); the gallery is left alone
//   npm run cf -- login                          log in once (the profile remembers it)
//   npm run cf -- inspect                        save the structure of open pages (to calibrate selectors.js)
//   --account <name>                             a separate Chrome profile (login) per CurseForge account
// Runs your installed Google Chrome, visibly, with its own profile in ~/Library/Application Support/cf-uploader.

const argv = process.argv.slice(2);
const HOME = path.join(os.homedir(), 'Library', 'Application Support', 'cf-uploader');
// One Chrome profile per CurseForge account, so logins never mix. Default account: "profile".
const account = (arg(argv, '--account') || '').replace(/[^a-z0-9_-]/gi, '');
const PROFILE = path.join(HOME, account ? `profile-${account}` : 'profile');
const INSPECT_DIR = path.join(HOME, 'inspect');
const LEARNED = path.join(HOME, 'learned.json'); // e.g. the project page URL pattern seen after "Create"
const PAGES = path.join(HOME, 'pages.json'); // what each project page shows (read from CurseForge); kept out of git so the repo stays clean
const learned = fs.existsSync(LEARNED) ? JSON.parse(fs.readFileSync(LEARNED, 'utf-8')) : {};
const pages = fs.existsSync(PAGES) ? JSON.parse(fs.readFileSync(PAGES, 'utf-8')) : {};
URLS.project = learned.projectUrl || URLS.projectGuess; // the guess is replaced once the real address was seen
const command = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'menu';
const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));

// --ohne-enter: nobody sits at this terminal (started from the chat). Questions are only shown;
// the runner watches the browser instead of waiting for Enter.
const handsFree = argv.includes('--ohne-enter');
const rl = handsFree ? null : readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = handsFree ? async q => { console.log(`\n${q}`); return ''; } : q => rl.question(`\n${q} `);
const closeInput = () => rl?.close();
const sleep = ms => new Promise(r => setTimeout(r, ms));

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

// ── Description state (no API; the gallery only changes for new projects) ─────────────────────────────────────────────
const savePages = () => { fs.mkdirSync(HOME, { recursive: true }); fs.writeFileSync(PAGES, JSON.stringify(pages, null, 2)); };
const projectIdOf = pack => { const e = findProject(loadProjects(), pack.slug); return Number.isInteger(e?.projectId) ? e.projectId : pack.cfProjectId; };
const withPage = pack => ({ ...pack, cfProjectId: projectIdOf(pack), page: pages[pack.slug] });

// Reads the description from CurseForge and remembers how far it is. Returns the state
// or null when it could not be read (no key, offline): then the last known state stays.
async function syncPage(pack) {
  const key = process.env.CF_CORE_API_KEY, projectId = projectIdOf(pack);
  if (!key || !Number.isInteger(projectId)) return null;
  try {
    const state = pageState(pack, { html: await getDescription(projectId, { key }) });
    pages[pack.slug] = { ...state, filled: pages[pack.slug]?.filled, checkedAt: new Date().toISOString() };
    savePages();
    return state;
  } catch (e) {
    console.log(`  (Seite von ${pack.name} nicht lesbar: ${e.message.split('\n')[0]})`);
    return null;
  }
}

// Only projects whose newest release came from the pipeline can be behind; the others are not asked.
async function syncPages(packs) {
  for (const pack of packs) if (tracksPage(pack)) await syncPage(pack);
}

function rememberProjectUrl(found) {
  const template = urlTemplate(found.projectUrl, found.projectId);
  if (template && template !== learned.projectUrl) {
    learned.projectUrl = template;
    URLS.project = template;
    fs.mkdirSync(HOME, { recursive: true });
    fs.writeFileSync(LEARNED, JSON.stringify(learned, null, 2));
  }
}

// Ends a run. With a person at the terminal the window stays open until they close it; a
// hands-free run closes it itself so the command returns.
async function finish(context) {
  closeInput();
  if (handsFree) {
    console.log('\nFertig. Das Chrome-Fenster schließt sich gleich.');
    await sleep(8000);
    await context.close().catch(() => {});
    return;
  }
  console.log('\nFertig. Du kannst das Chrome-Fenster schließen.');
  await waitForClose(context);
}

// "Beschreibung nachziehen" for one project: the helper fills the description, the operator clicks
// Save, and the result is read back from CurseForge. → true when CurseForge shows the new text.
async function pageTask(page, task) {
  const pack = loadPack(task.id);
  const plan = buildSteps(task, { config, pack: withPage(pack) });
  console.log(`\n── ${plan.title} ──`);
  const checks = { description: async () => (await syncPage(pack))?.descriptionThrough === plan.page.version };
  const { results, context: found } = await runSteps(page, plan.steps, { ask, checks, handsFree });
  rememberProjectUrl(found);
  console.log(formatSummary(results, plan.notes));

  const state = await syncPage(pack);
  const behind = pageBehind(withPage(pack));
  if (!state) console.log('  Ich konnte die Seite nicht zurücklesen (kein CF_CORE_API_KEY?). Beim nächsten Start prüfe ich wieder.');
  else if (!behind) { delete pages[pack.slug].filled; console.log(`✓ ${pack.name}: Die Beschreibung zeigt V${plan.page.version}.`); }
  else { pages[pack.slug].filled = { version: plan.page.version, at: new Date().toISOString() }; console.log(`  ${pack.name}: CurseForge zeigt die Beschreibung V${behind.version} noch nicht. Falls du gespeichert hast, erscheint sie gleich; ich prüfe beim nächsten Start wieder.`); }
  savePages();
  const shown = !!state && state.descriptionThrough === plan.page.version;
  if (shown) {
    console.log(state.externalImages
      ? `  Bilder der Beschreibung: ${state.externalImages} werden weiter von GitHub geladen${state.hostedImages ? `, ${state.hostedImages} liegen bei CurseForge` : ''}. Neue Renders erscheinen dort also ohne erneutes Speichern.`
      : `  Bilder der Beschreibung: CurseForge hat alle ${state.hostedImages} Bilder auf den eigenen Server kopiert. Für neue Bilder muss die Seite jedes Mal neu gespeichert werden.`);
    const issue = closeUpdateIssue({ slug: pack.slug, version: plan.page.version, note: `Die Beschreibung auf CurseForge zeigt V${plan.page.version} (vom Helfer zurückgelesen).` });
    if (issue) console.log(`  ✓ GitHub-Issue #${issue} geschlossen.`);
  }
  return shown;
}

async function runPages(tasks) {
  if (!tasks.length) { console.log('\nAlle Beschreibungen sind auf dem Stand der letzten Uploads. 🎉\n'); closeInput(); return; }
  console.log(`\n▶ Beschreibung nachziehen: ${tasks.map(t => t.label.replace(/^Beschreibung nachziehen: /, '')).join(' · ')}\n  Chrome öffnet sich gleich. Bitte nicht in das Fenster klicken, solange Schritte laufen.\n`);
  const context = await openBrowser();
  const page = await pageOf(context);
  for (const task of tasks) {
    try { await pageTask(page, task); } catch (e) { console.log(`✗ ${task.label}: ${e.message.split('\n')[0]}`); }
  }
  await finish(context);
}

function pageTasks(packs, slug) {
  const { todo, more } = listTasks({ projects: loadProjects(), packs: packs.map(withPage) });
  const open = [...todo, ...more].filter(t => t.cmd === 'seite');
  if (!slug) return open.filter(t => todo.includes(t));
  const pack = packs.find(p => p.slug === slug);
  if (!pack) fail(`Kein Skinpack "${slug}" in data/skins/.`);
  const hit = open.find(t => t.id === slug);
  if (hit) return [hit];
  // Explicit request for an up-to-date page: do the whole page again for the newest published version.
  const latest = pack.versions.filter(v => v.status === 'published').at(-1);
  if (!latest) fail(`${pack.name} hat noch keine veröffentlichte Version.`);
  return [{ cmd: 'seite', kind: 'skinpack', id: slug, projectId: projectIdOf(pack), version: latest.version, label: `Beschreibung nachziehen: ${pack.name} (neu einsetzen, V${latest.version})` }];
}

async function chooseTask() {
  const reviews = Object.fromEntries([
    ...listPacks().map(s => [s, loadReview(packDir(s))]),
    ...listMods().map(m => [m, loadReview(modDir(m))])
  ].filter(([, r]) => r));
  const packs = listPacks().map(s => loadPack(s));
  await syncPages(packs);
  const { todo, more, waitingForGo } = listTasks({ projects: loadProjects(), packs: packs.map(withPage), reviews });
  const all = [...todo, ...more];
  console.log('\nCurseForge-Helfer\n');
  if (todo.length) { console.log('Offene Aufgaben:'); todo.forEach((t, i) => console.log(`  ${i + 1}) ${t.label}`)); }
  else console.log('Keine offenen Aufgaben. 🎉');
  if (waitingForGo) console.log(`\n(${waitingForGo} neue${waitingForGo === 1 ? 's Projekt wartet' : ' Projekte warten'} im Studio auf dein Go: npm run studio)`);
  if (more.length) { console.log('\nWeitere:'); more.forEach((t, i) => console.log(`  ${todo.length + i + 1}) ${t.label}`)); }
  const openPages = todo.filter(t => t.cmd === 'seite').length;
  if (openPages > 1) console.log(`\n  s) Alle ${openPages} offenen Beschreibungen nacheinander nachziehen`);
  console.log('\n  l) Einloggen   i) Seiten für die Kalibrierung speichern   q) Beenden');
  const answer = (await ask('Auswahl:')).trim().toLowerCase();
  if (answer === 's' && openPages > 1) return 'seite';
  if (answer === 'l') return 'login';
  if (answer === 'i') return 'inspect';
  const task = all[Number(answer) - 1];
  if (!task) process.exit(0);
  return task;
}

// A form flow (new project, cover, file) in the given page. Throws when it cannot start.
async function formTask(page, task) {
  let data;
  try {
    data = task.kind === 'mod' ? { config, meta: loadMod(task.id).meta } : { config, pack: loadPack(task.id) };
  } catch (e) {
    throw new Error(`${e.message}\n  Tipp: erst "git pull", damit die Daten aus GitHub Actions lokal da sind.`);
  }
  if (task.cmd === 'publish' && !argv.includes('--ohne-freigabe')) {
    const review = loadReview(reviewDir(task));
    if (review && !APPROVED.includes(review.status)) throw new Error(`${task.id} hat im Studio noch kein Go (Status: ${review.status}). Erst freigeben: npm run studio`);
  }
  const plan = buildSteps(task, data);
  console.log(`\n── ${plan.title} ──`);
  const { results, context: found } = await runSteps(page, plan.steps, { ask, handsFree });
  if (plan.clipboard) spawnSync('pbcopy', { input: plan.clipboard });
  console.log(formatSummary(results, plan.notes));
  await recordResults(task, data, plan, found, results);
}

async function runTask(task) {
  if (task.cmd === 'seite') return runPages([task]);
  console.log('\n  Chrome öffnet sich gleich. Bitte nicht in das Fenster klicken, solange Schritte laufen.');
  const context = await openBrowser();
  const page = await pageOf(context);
  try { await formTask(page, task); } catch (e) { await context.close().catch(() => {}); fail(e.message); }
  await finish(context);
}

// The day's list: pull, look at everything that waits for the operator, and after one Go work
// through it in one window. → 'menu' when the operator asked for the menu instead.
async function today() {
  const pulled = pullIfClean();
  if (pulled === 'failed') console.log('⚠ git pull hat nicht geklappt, ich arbeite mit dem lokalen Stand.');
  const reviewDirs = [...listPacks().map(s => [s, packDir(s)]), ...listMods().map(m => [m, modDir(m)])];
  const reviews = {};
  for (const [key, dir] of reviewDirs) {
    const r = loadReview(dir);
    if (!r) continue;
    if (markDue(r)) saveReview(dir, r);
    reviews[key] = r;
  }
  const packs = listPacks().map(s => loadPack(s));
  await syncPages(packs);
  const { todo, waitingForGo } = listTasks({ projects: loadProjects(), packs: packs.map(withPage), reviews });
  const plan = dayPlan({ todo, waitingForGo, reviews });

  if (argv.includes('--melden')) { remind(plan); closeInput(); return; }
  console.log(`\n${plan.summary}`);
  plan.tasks.forEach((t, i) => console.log(`  ${i + 1}) ${t.label}`));
  if (argv.includes('--dry-run') || !plan.tasks.length) { closeInput(); return; }
  if (!handsFree) {
    const a = (await ask('Enter = Go (alles nacheinander) · m = Menü · q = Beenden:')).trim().toLowerCase();
    if (a === 'q') process.exit(0);
    if (a === 'm') return 'menu';
  }
  console.log('\n▶ Go. Chrome öffnet sich gleich. Der Helfer füllt aus; Save, Create, Apply und Add File klickst du.\n  Bitte nicht in das Fenster klicken, solange Schritte laufen.');
  const context = await openBrowser();
  const page = await pageOf(context);
  const done = [];
  for (const task of plan.tasks) {
    try {
      const ok = task.cmd === 'seite' ? await pageTask(page, task) : (await formTask(page, task), true);
      done.push(`${ok ? '✓' : '…'} ${task.label}${ok ? '' : ' (noch nicht bestätigt)'}`);
    } catch (e) {
      done.push(`✗ ${task.label}: ${e.message.split('\n')[0]}`);
      console.log(`✗ ${e.message.split('\n')[0]}`);
    }
  }
  console.log(`\nHeute erledigt:\n${done.map(d => `  ${d}`).join('\n')}`);
  await finish(context);
}

// Mac notification for the launchd schedule: once per day, after the evening window, when something
// waits. The stamp lives next to the profile, outside git.
function remind(plan) {
  const stampFile = path.join(HOME, 'reminded.json');
  const now = new Date();
  const local = new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone || 'Europe/Berlin', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(now);
  const part = t => local.find(x => x.type === t).value;
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  const minutes = Number(part('hour')) * 60 + Number(part('minute'));
  const [h, m] = (config.windows?.evening?.[1] || '21:00').split(':').map(Number);
  const stamp = fs.existsSync(stampFile) ? JSON.parse(fs.readFileSync(stampFile, 'utf-8')) : {};
  const due = plan.tasks.length > 0 && minutes >= h * 60 + m + 15 && stamp.date !== today;
  console.log(`${now.toISOString()} heute: ${plan.summary}${due ? ' → Mitteilung' : ''}`);
  if (!due) return;
  const text = `${plan.summary}. Sag Claude „Go“ oder starte CurseForge.command.`;
  if (process.env.STUDIO_NOTIFY === 'log') console.log(`[Mitteilung] CurseForge-Helfer: ${text}`);
  else spawnSync('osascript', ['-e', `display notification ${JSON.stringify(text)} with title "CurseForge-Helfer" sound name "Glass"`]);
  fs.mkdirSync(HOME, { recursive: true });
  fs.writeFileSync(stampFile, JSON.stringify({ date: today }));
}

// Writes the learned project id / the upload back into data/ so the pipeline knows about them.
const reviewDir = task => (task.kind === 'mod' ? modDir(task.id) : packDir(task.id));

async function recordResults(task, data, plan, found, results = []) {
  const projects = loadProjects();
  const changes = [];
  if (found.projectId) {
    recordProjectId({ projects, pack: data.pack, task, name: data.pack?.name || data.meta?.name, projectId: found.projectId });
    rememberProjectUrl(found);
    console.log(`\n✓ Projekt-ID ${found.projectId} in data/cf-projects.json eingetragen.`);
    changes.push(`project ${found.projectId}`);
  }
  if (plan.record && data.pack) {
    const v = data.pack.versions.find(x => x.version === plan.record.version);
    if (v && v.status !== 'published') {
      // The form closing after the operator's "Add File" click is the proof; without that the
      // operator is asked. A hands-free run records nothing it did not see (the evening run finds
      // the file on CurseForge by its name and records it then).
      let uploaded = results.some(r => r.title === 'Warten auf „Add File“' && r.status === 'ok');
      if (!uploaded && !handsFree) {
        const a = (await ask(`Hast du V${v.version} mit „Add File“ hochgeladen? (j/n)`)).trim().toLowerCase();
        uploaded = a === 'j' || a === 'y';
      }
      if (uploaded) {
        recordUpload({ projects, pack: data.pack, task, version: v.version, intervalDays: config.updateIntervalDays });
        console.log(`✓ V${v.version} als veröffentlicht markiert, nächstes Update frühestens in 23 Tagen.`);
        changes.push(`V${v.version}`);
      } else if (handsFree) {
        console.log(`  V${v.version}: Ich habe „Add File“ nicht gesehen und trage nichts ein. Liegt die Datei bei CurseForge, erkennt der Abend-Lauf sie.`);
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
    changes.push('published');
  }
  if (changes.length) {
    saveProjects(projects);
    if (data.pack) savePack(data.pack);
    const result = commitData(`chore(cf): ${task.id} ${changes.join(', ')}`);
    console.log({
      pushed: '✓ Daten committet und gepusht, die Pipeline weiß Bescheid.',
      committed: '⚠ Daten committet, aber der Push hat nicht geklappt. Bitte „git push“ nachholen.',
      'not-main': '  Daten gespeichert. Nicht auf main, deshalb nicht committet: bitte selbst committen und pushen.',
      nothing: '  Keine Änderung an data/.'
    }[result]);
  }
}

async function login() {
  const context = await openBrowser();
  const page = await pageOf(context);
  await page.goto(URLS.home);
  if (handsFree) {
    console.log('\nBitte im Chrome-Fenster bei CurseForge einloggen und das Fenster danach schließen. Ich warte so lange.');
    await waitForClose(context);
  } else {
    await ask('Bitte im Browser bei CurseForge einloggen. Wenn du eingeloggt bist, hier Enter drücken.');
    await context.close();
  }
  console.log('✓ Login gespeichert. Ab jetzt bist du im CurseForge-Fenster automatisch eingeloggt.');
  closeInput();
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
  closeInput();
}

let choice = command;
if (command === 'heute') choice = (await today()) || 'done';
if (choice === 'menu') choice = await chooseTask();
if (choice === 'done') { /* the day's list ran */ }
else if (choice === 'login') await login();
else if (choice === 'inspect') await inspect();
else if (typeof choice === 'object') await runTask(choice);
else if (choice === 'seite') {
  const packs = listPacks().map(s => loadPack(s));
  await syncPages(packs);
  await runPages(pageTasks(packs, arg(argv, '--skinpack')));
}
else if (['publish', 'new', 'media', 'update'].includes(choice)) await runTask(taskFromArgs());
else fail(`Unbekannter Befehl "${choice}". Möglich: heute, publish, new, media, update, seite, login, inspect (oder ohne Befehl für das Menü).`);
