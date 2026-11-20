import './lib/load-secrets.js';
import fs from 'fs';
import path from 'path';
import { REIHEN, loadReihe, loadReihen, saveReihe, findSerieProject, projectDir, outDir, plannedDate, addStock, reiheStand, registerProject } from './lib/serie.js';
import { checkPage, pageOk, aiNote, AI_LOGO_NOTE, AI_LOGO_BANNER_NOTE, wordsFor, longPage } from './lib/page-check.js';
import { CHATGPT_ROOT, chatgptDir, writeChatgptFolder, findChatgptBanner, cropBanner, comparisonHtml, paintBanner } from './lib/banner.js';
import { loadProjects, saveProjects } from './lib/cf-projects.js';
import { loadReleaseProject, listReleaseProjects, releaseFile } from './lib/releases.js';
import { gameOf, tokenFor } from './lib/games.js';
import { getProject } from './platforms/curseforge-core.js';
import { arg, flag } from './lib/github-output.js';

// Die Serie: pro Spiel eine Reihe mit 33 Projekten, ein Upload pro Reihe und Tag.
//   npm run serie -- heute                       was heute anzulegen ist und was abends hochgeht
//   npm run serie -- stand                       Vorsprung und Stand je Reihe
//   npm run serie -- plan                        Kalender nach Output/serie/PLAN.md
//   npm run serie -- logo <slug> [--force]       KI-Logo erzeugen (kostet OpenAI-Guthaben)
//   npm run serie -- seite <slug>                Titelbild, Texte und Prüfung nach Output/serie/<reihe>/<nr>-<slug>/
//   npm run serie -- banner <slug>               mein Banner (720×340) nach Output/serie/<reihe>/<nr>-<slug>/banner-claude.png
//   npm run serie -- banner-gemalt <slug>        gemaltes Banner über die OpenAI-Schnittstelle (kostet Guthaben)
//   npm run serie -- chatgpt [<slug> …]          Aufträge für ChatGPT nach Output/chatgpt-bilder/ (ohne Slug: alle ohne gewähltes Banner)
//   npm run serie -- banner-vergleich            ChatGPT-Bilder zuschneiden, beide Banner nebeneinander (VERGLEICH.html)
//   npm run serie -- banner-wahl <slug> claude|chatgpt   Banner übernehmen, KI-Hinweis setzen, Seite neu bauen
//   npm run serie -- id <slug> <projectId>       Projekt eintragen = Go für die erste Datei
//   npm run serie -- vorrat <slug> --version 1.0 --file <Pfad> --changelog <Pfad .md> [--game-versions "a,b"] [--version-types "a,b"]
//   npm run serie -- namen [<reihe>] [--alle]    Namen gegen CurseForge prüfen
const argv = process.argv.slice(2);
const cmd = argv[0];
const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
const fail = msg => { console.error(`✗ ${msg}`); process.exit(1); };
const de = iso => `${Number(iso.slice(8, 10))}.${Number(iso.slice(5, 7))}.`;
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: config.timezone || 'Europe/Berlin' }).format(process.env.NOW ? new Date(process.env.NOW) : new Date());
const MARK = { ok: '✓', warn: '!', error: '✗' };

function loadPage(reihe, project) {
  const file = path.join(projectDir(reihe.reihe, project.slug), 'page.json');
  if (!fs.existsSync(file)) return null;
  const page = JSON.parse(fs.readFileSync(file, 'utf-8'));
  if (Array.isArray(page.description)) page.description = page.description.join('\n');
  return page;
}

const pageOptions = (reihe, project) => ({
  minWords: wordsFor(reihe.reihe)[0],
  maxWords: wordsFor(reihe.reihe)[1],
  detail: longPage(reihe.reihe),
  // visual packs need a real in-game image; a pack without visuals (sounds only) says shot: false
  needsShot: reihe.reihe === 'java' && /R/.test(project.art) && project.shot !== false,
  bannerFrom: project.banner?.from || null,
  needsBanner: reihe.banner !== false
});

function pageFiles(reihe, project) {
  const dir = outDir(reihe.reihe, project);
  const shots = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /^shot-\d+\.png$/.test(f)).map(f => path.join(dir, f)) : [];
  return { logo: path.join(dir, 'logo.png'), cover: path.join(dir, 'cover.png'), banner: path.join(dir, 'banner.png'), shots };
}

async function pageResults(reihe, project) {
  const page = loadPage(reihe, project);
  if (!page) return null;
  return checkPage(page, pageFiles(reihe, project), pageOptions(reihe, project));
}

async function logo() {
  const { reihe, project } = findSerieProject(loadReihen(), argv[1] || '');
  const page = loadPage(reihe, project);
  if (!page?.logoPrompt) fail(`${project.slug}: page.json mit logoPrompt fehlt.`);
  const file = path.join(projectDir(reihe.reihe, project.slug), 'logo.png');
  if (fs.existsSync(file) && !flag(argv, '--force')) { console.log(`Logo gibt es schon: ${file} (neu mit --force)`); return; }
  const { generateImage, toLogo } = await import('./lib/images.js');
  const prompt = `${page.logoPrompt}. ${reihe.logoStyle}. Square icon, one centred subject that fills the frame, absolutely no text, letters or numbers, no game logos, no characters from any game.`;
  const raw = await generateImage({ model: config.images?.model, size: '1024x1024', prompt });
  fs.writeFileSync(file, await toLogo(raw, config.images?.logoSize || 400));
  console.log(`✓ ${file}`);
}

function handover(reihe, project, page, zips) {
  const game = gameOf(config, reihe.game);
  return [
    `# ${page.name}: Projekt auf CurseForge anlegen`,
    '',
    `Reihe ${reihe.title}, Projekt ${project.nr} von 33, geplant für den ${de(plannedDate(reihe, project.nr))}`,
    '',
    `1. Im CurseForge-Konto für **${game.name}** ein neues Projekt anlegen${page.class ? ` (Projektart: **${page.class}**)` : ''}.`,
    '2. Name, Summary und Kategorie von unten eintragen. Im Beschreibungs-Editor auf **Markdown** stellen und die Beschreibung einfügen.',
    '3. `logo.png` als Logo hochladen.',
    reihe.banner === false
      ? '4. Unter **Images** `cover.png` hochladen und als Hauptbild markieren.'
      : `4. Unter **Images** \`banner.png\` hochladen und als Hauptbild markieren, dazu \`cover.png\`${fs.existsSync(path.join(outDir(reihe.reihe, project), 'shot-1.png')) ? ' und die `shot-*.png`' : ''}.`,
    '5. **Keine Datei hochladen.** Lizenz: All Rights Reserved.',
    `6. Projekt-ID eintragen: \`npm run serie -- id ${project.slug} <Projekt-ID>\`. Das ist dein Go, die erste Datei geht abends von selbst hoch.`,
    '',
    '## Name',
    '',
    page.name,
    '',
    '## Summary',
    '',
    page.summary,
    '',
    '## Kategorie',
    '',
    page.class ? `${page.class} → ${page.category}` : page.category,
    '',
    '## Description',
    '',
    page.description.trim(),
    '',
    '## Dateien im Vorrat',
    '',
    ...(zips.length ? zips.map(z => `- ${z}`) : ['- noch keine'])
  ].join('\n') + '\n';
}

async function seite() {
  const { reihe, project } = findSerieProject(loadReihen(), argv[1] || '');
  const page = loadPage(reihe, project);
  if (!page) fail(`${project.slug}: ${path.join(projectDir(reihe.reihe, project.slug), 'page.json')} fehlt.`);
  const src = projectDir(reihe.reihe, project.slug);
  const dir = outDir(reihe.reihe, project);
  fs.mkdirSync(dir, { recursive: true });
  const logoFile = path.join(src, 'logo.png');
  if (!fs.existsSync(logoFile)) fail(`${project.slug}: Logo fehlt. Erst: npm run serie -- logo ${project.slug}`);
  fs.copyFileSync(logoFile, path.join(dir, 'logo.png'));
  const { writeCover } = await import('../tools/serie/cover.js');
  await writeCover({ reihe: reihe.reihe, name: page.name, tagline: page.cover?.tagline, bullets: page.cover?.bullets, kicker: page.cover?.kicker, logo: fs.readFileSync(logoFile) }, path.join(dir, 'cover.png'));
  if (reihe.banner !== false) {
    const { writeBanner } = await import('../tools/serie/cover.js');
    await writeBanner({ reihe: reihe.reihe, name: page.name, tagline: page.cover?.tagline, kicker: page.cover?.kicker, logo: fs.readFileSync(logoFile) }, path.join(dir, 'banner-claude.png'));
    const chosen = project.banner?.from && path.join(dir, `banner-${project.banner.from}.png`);
    if (chosen && fs.existsSync(chosen)) fs.copyFileSync(chosen, path.join(dir, 'banner.png'));
    else if (fs.existsSync(path.join(dir, 'banner.png'))) fs.rmSync(path.join(dir, 'banner.png'));
  }
  const shotDir = path.join(src, 'shots');
  if (fs.existsSync(shotDir)) fs.readdirSync(shotDir).filter(f => f.endsWith('.png')).sort().forEach((f, i) => fs.copyFileSync(path.join(shotDir, f), path.join(dir, `shot-${i + 1}.png`)));
  const zips = listReleaseProjects().includes(project.slug) ? loadReleaseProject(project.slug).versions.map(v => `V${v.version}: ${v.file} (${v.status === 'due' ? 'wartet' : 'online'})`) : [];
  fs.writeFileSync(path.join(dir, 'curseforge.md'), handover(reihe, project, page, zips));
  const results = await checkPage(page, pageFiles(reihe, project), pageOptions(reihe, project));
  console.log(`${page.name} (${reihe.title} ${project.nr}/33) → ${dir}`);
  for (const r of results) console.log(`  ${MARK[r.level]} ${r.label}${r.detail ? `: ${r.detail}` : ''}`);
  if (!pageOk(results)) process.exit(1);
}

// Projects whose banner is not chosen yet and that have a page and a logo (or the slugs given).
function bannerCandidates(slugs) {
  const out = [];
  for (const reihe of loadReihen()) {
    if (reihe.banner === false && !slugs.length) continue; // rows without a banner (WoW)
    for (const project of reihe.projects) {
      if (slugs.length ? !slugs.includes(project.slug) : project.banner) continue;
      const page = loadPage(reihe, project);
      const logo = path.join(projectDir(reihe.reihe, project.slug), 'logo.png');
      if (page && fs.existsSync(logo)) out.push({ reihe, project, page, logo });
    }
  }
  const missing = slugs.filter(s => !out.some(e => e.project.slug === s));
  if (missing.length) fail(`Ohne page.json oder Logo: ${missing.join(', ')}`);
  return out;
}

async function renderClaudeBanner({ reihe, project, page, logo }) {
  const { writeBanner } = await import('../tools/serie/cover.js');
  const dir = outDir(reihe.reihe, project);
  fs.mkdirSync(dir, { recursive: true });
  return writeBanner({ reihe: reihe.reihe, name: page.name, tagline: page.cover?.tagline, kicker: page.cover?.kicker, logo: fs.readFileSync(logo) }, path.join(dir, 'banner-claude.png'));
}

async function banner() {
  const slugs = argv.slice(1).filter(a => !a.startsWith('--'));
  if (!slugs.length) fail('Aufruf: npm run serie -- banner <slug> [<slug> …]');
  for (const e of bannerCandidates(slugs)) console.log(`✓ ${await renderClaudeBanner(e)}`);
}

function chatgpt() {
  const entries = bannerCandidates(argv.slice(1).filter(a => !a.startsWith('--')));
  if (!entries.length) { console.log('Kein Projekt wartet auf ein Banner.'); return; }
  const written = writeChatgptFolder(entries.map(e => ({ reiheKey: e.reihe.reihe, project: e.project, page: e.page, logo: e.logo })));
  console.log(`✓ ${CHATGPT_ROOT}/ mit LIES-MICH.md, STIL.md und ${written.length} ${written.length === 1 ? 'Auftrag' : 'Aufträgen'}:`);
  for (const w of written) console.log(`  ${w.dir}${w.done ? ' (ChatGPT-Bild liegt schon da)' : ''}`);
}

async function bannerVergleich() {
  const rows = [];
  for (const e of bannerCandidates(argv.slice(1).filter(a => !a.startsWith('--')))) {
    const dir = outDir(e.reihe.reihe, e.project);
    const claude = await renderClaudeBanner(e);
    const source = findChatgptBanner(chatgptDir(e.reihe.reihe, e.project));
    const painted = path.join(dir, 'banner-chatgpt.png');
    let chatgpt = fs.existsSync(painted) ? painted : null; // painted through the API earlier
    let problem = null;
    if (source) {
      try {
        fs.writeFileSync(painted, await cropBanner(fs.readFileSync(source)));
        chatgpt = painted;
      } catch (err) { chatgpt = null; problem = `Bild unbrauchbar: ${err.message}`; }
    }
    console.log(`${chatgpt ? '✓' : '·'} ${e.page.name}: ${chatgpt ? 'beide Banner da' : problem || 'nur das gestaltete Banner (noch kein gemaltes)'}`);
    rows.push({ title: `${e.reihe.title} ${e.project.nr}/33`, reihe: e.reihe.reihe, name: e.page.name, claude, chatgpt, problem });
  }
  if (!rows.length) { console.log('Kein Projekt wartet auf ein Banner.'); return; }
  fs.mkdirSync(CHATGPT_ROOT, { recursive: true });
  const file = path.join(CHATGPT_ROOT, 'VERGLEICH.html');
  fs.writeFileSync(file, await comparisonHtml(rows));
  console.log(`✓ ${file}`);
}

// The painted banner through the image API (costs OpenAI credit), saved next to the designed one.
async function bannerGemalt() {
  const slugs = argv.slice(1).filter(a => !a.startsWith('--'));
  if (!slugs.length) fail('Aufruf: npm run serie -- banner-gemalt <slug> [<slug> …] [--force]');
  const { generateImage } = await import('./lib/images.js');
  await Promise.all(bannerCandidates(slugs).map(async e => {
    if (e.reihe.banner === false) { console.log(`· ${e.page.name}: diese Reihe hat kein Banner`); return; }
    const dir = outDir(e.reihe.reihe, e.project);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'banner-chatgpt.png');
    if (fs.existsSync(file) && !flag(argv, '--force')) { console.log(`· ${e.page.name}: gemaltes Banner gibt es schon (neu mit --force)`); return; }
    try {
      const { raw, banner } = await paintBanner({ reiheKey: e.reihe.reihe, project: e.project, page: e.page, logo: fs.readFileSync(e.logo), model: config.images?.model, generate: generateImage });
      fs.writeFileSync(path.join(dir, 'banner-gemalt-roh.png'), raw);
      fs.writeFileSync(file, banner);
      console.log(`✓ ${file}`);
    } catch (err) { console.log(`✗ ${e.page.name}: ${err.message}`); }
  }));
}

async function bannerWahl() {
  const [slug, from] = [argv[1], argv[2]];
  if (!slug || !['claude', 'chatgpt'].includes(from)) fail('Aufruf: npm run serie -- banner-wahl <slug> claude|chatgpt');
  const reihen = loadReihen();
  const { reihe, project } = findSerieProject(reihen, slug);
  const dir = outDir(reihe.reihe, project);
  if (!fs.existsSync(path.join(dir, `banner-${from}.png`))) fail(`banner-${from}.png fehlt in ${dir}. Erst: npm run serie -- banner-vergleich`);
  // The description names what is AI art; the API cannot change it later, so it is set now.
  const pageFile = path.join(projectDir(reihe.reihe, project.slug), 'page.json');
  const page = JSON.parse(fs.readFileSync(pageFile, 'utf-8'));
  const lines = Array.isArray(page.description) ? page.description : page.description.split('\n');
  const last = lines.length - 1;
  if (![AI_LOGO_NOTE, AI_LOGO_BANNER_NOTE].includes(lines[last])) fail(`${slug}: die Beschreibung endet nicht mit dem KI-Hinweis.`);
  lines[last] = aiNote(from);
  page.description = Array.isArray(page.description) ? lines : lines.join('\n');
  fs.writeFileSync(pageFile, JSON.stringify(page, null, 2) + '\n');
  project.banner = { from, at: today() };
  saveReihe(reihe);
  console.log(`✓ ${project.name}: Banner von ${from === 'claude' ? 'Claude' : 'ChatGPT'} gewählt.`);
  argv[1] = slug;
  await seite();
}

async function id() {
  const slug = argv[1];
  const projectId = Number(argv[2]);
  if (!slug || !Number.isInteger(projectId)) fail('Aufruf: npm run serie -- id <slug> <Projekt-ID>');
  const { reihe, project } = findSerieProject(loadReihen(), slug);
  const game = gameOf(config, reihe.game);
  let cfName = null;
  const key = process.env.CF_CORE_API_KEY;
  if (key) {
    const cf = await getProject(projectId, { key }).catch(e => fail(`CurseForge kennt die Projekt-ID ${projectId} nicht (${e.message}).`));
    if (game.gameId && cf.gameId !== game.gameId) fail(`Projekt ${projectId} („${cf.name}“) gehört nicht zu ${game.name}.`);
    cfName = cf.name;
  } else {
    console.log('Hinweis: kein CF_CORE_API_KEY, die Projekt-ID wurde nicht gegen CurseForge geprüft.');
  }
  const cfProjects = loadProjects();
  try { registerProject(reihe, project, projectId, { cfProjects, cfName }); } catch (e) { fail(e.message); }
  saveProjects(cfProjects);
  console.log(`✓ ${project.name} (${reihe.title}) ist eingetragen. V${loadReleaseProject(slug).versions[0].version} geht am Abend von selbst hoch.`);
  if (!tokenFor(game)) console.log(`  Es fehlt noch das Upload-Token: ${game.tokenEnv} in secrets.env eintragen, dann npm run secrets:push.`);
  console.log('  Danach committen und pushen, sonst sieht der Abend-Lauf auf GitHub das Projekt nicht.');
}

function vorrat() {
  const slug = argv[1];
  const version = arg(argv, '--version');
  const file = arg(argv, '--file');
  const changelog = arg(argv, '--changelog');
  if (!slug || !version || !file || !changelog) fail('Aufruf: npm run serie -- vorrat <slug> --version 1.0 --file <Pfad> --changelog <Pfad .md>');
  if (!fs.existsSync(changelog)) fail(`Changelog-Datei fehlt: ${changelog}`);
  const list = name => (arg(argv, name, '') || '').split(',').map(s => s.trim()).filter(Boolean);
  const { reihe, project } = findSerieProject(loadReihen(), slug);
  try {
    const v = addStock(reihe, project, { version, file, changelog: fs.readFileSync(changelog, 'utf-8'), gameVersions: list('--game-versions'), versionTypes: list('--version-types') });
    console.log(`✓ ${project.name} V${v.version} liegt im Vorrat (${releaseFile(slug, v.file)}).`);
  } catch (e) { fail(e.message); }
}

function stand() {
  const cfProjects = loadProjects();
  for (const reihe of loadReihen()) {
    const s = reiheStand(reihe, { cfProjects });
    console.log(`■ ${s.title}: ${s.online} online · ${s.angelegt} angelegt · ${s.gebaut} gebaut · ${s.geplant} offen`);
    if (s.next) console.log(`  Nächstes: Nr. ${s.next.nr} ${s.next.name} (${s.next.state}, geplant ${de(s.next.planned)})`);
    const started = today() >= reihe.start;
    if (s.geplant && s.vorsprung < 5) console.log(`  ${started ? '!' : '·'} Vorsprung: ${s.vorsprung}${started ? ' – unter 5, die Reihe braucht eine Bau-Nacht' : ` (Start ${de(reihe.start)})`}`);
    const updates = s.rows.filter(r => r.state === 'online').reduce((n, r) => n + r.stock, 0);
    if (s.online) console.log(`  Updates im Vorrat: ${updates}`);
  }
}

async function heute() {
  const cfProjects = loadProjects();
  const day = today();
  console.log(`Serie am ${de(day)}`);
  for (const reihe of loadReihen()) {
    const s = reiheStand(reihe, { cfProjects });
    const lines = [];
    const waiting = s.rows.filter(r => r.state === 'angelegt');
    if (waiting[0]) lines.push(`Geht heute Abend hoch: ${waiting[0].name} V1.0${waiting.length > 1 ? ` (danach warten noch ${waiting.length - 1})` : ''}`);
    else if (!s.next) lines.push('Alle 33 sind online, abends läuft reihum ein Update.');
    if (day < reihe.start) lines.push(`Startet am ${de(reihe.start)}`);
    const create = s.rows.find(r => r.state === 'gebaut');
    if (create && day >= reihe.start) {
      const results = await pageResults(reihe, create);
      const dir = outDir(reihe.reihe, create);
      if (!results) lines.push(`Anlegen: ${create.name} – Seite fehlt noch (page.json)`);
      else if (!pageOk(results) || !fs.existsSync(path.join(dir, 'curseforge.md'))) lines.push(`Anlegen: ${create.name} – Seite noch nicht grün (npm run serie -- seite ${create.slug})`);
      else lines.push(`Anlegen: ${create.name} → ${dir}/curseforge.md, danach npm run serie -- id ${create.slug} <Projekt-ID>`);
    } else if (s.next?.state === 'geplant' && day >= reihe.start && !waiting.length) {
      lines.push(`! Nr. ${s.next.nr} ${s.next.name} ist noch nicht gebaut.`);
    }
    if (!tokenFor(gameOf(config, reihe.game)) && day >= reihe.start) lines.push(`! Upload-Token ${gameOf(config, reihe.game).tokenEnv} fehlt in secrets.env.`);
    console.log(`■ ${reihe.title}`);
    for (const l of lines) console.log(`  ${l}`);
  }
}

function plan() {
  const cfProjects = loadProjects();
  const out = ['# Serienplan', '', `Stand ${de(today())}. Quelle: data/serie/*.json. Geplanter Tag = Starttag der Reihe + Nr − 1; fehlt abends die Projekt-ID, rutscht die Reihe.`, ''];
  for (const reihe of loadReihen()) {
    const s = reiheStand(reihe, { cfProjects });
    out.push(`## ${reihe.title} (Start ${de(reihe.start)})`, '', `${s.online} online · ${s.angelegt} angelegt · ${s.gebaut} gebaut · ${s.geplant} offen`, '', '| Nr | Tag | Name | Art | Was es macht | V1.1 · V1.2 · V1.3 | Stand |', '|---|---|---|---|---|---|---|');
    for (const r of s.rows) out.push(`| ${r.nr} | ${de(r.planned)} | ${r.name}${r.nameChecked === false ? ' °' : ''} | ${reihe.arts[r.art] || r.art} | ${r.was} | ${r.updates.join(' · ')} | ${r.state} |`);
    if (reihe.reserve?.length) out.push('', `Reserve: ${reihe.reserve.join(', ')}`);
    out.push('');
  }
  out.push('° = Name noch nicht gegen CurseForge geprüft (`npm run serie -- namen`).', '');
  const file = path.join('Output', 'serie', 'PLAN.md');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, out.join('\n'));
  console.log(`✓ ${file}`);
}

async function namen() {
  const key = process.env.CF_CORE_API_KEY;
  if (!key) fail('CF_CORE_API_KEY fehlt.');
  const only = argv[1] && !argv[1].startsWith('--') ? [argv[1]] : REIHEN;
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const k of only) {
    const reihe = loadReihe(k);
    const gameId = gameOf(config, reihe.game).gameId;
    for (const p of reihe.projects) {
      if (p.nameChecked !== false && !flag(argv, '--alle')) continue;
      const get = async q => (await (await fetch(`https://api.curseforge.com/v1/mods/search?gameId=${gameId}&${q}`, { headers: { 'x-api-key': key } })).json()).data || [];
      const hits = [...await get(`slug=${p.slug}`), ...await get(`searchFilter=${encodeURIComponent(p.name)}&pageSize=10&sortField=6&sortOrder=desc`)];
      const taken = hits.find(m => norm(m.name) === norm(p.name) || m.slug === p.slug);
      if (taken) { p.nameChecked = false; console.log(`✗ ${reihe.title}: „${p.name}“ ist vergeben (${taken.name})`); }
      else { delete p.nameChecked; console.log(`✓ ${reihe.title}: „${p.name}“ ist frei`); }
    }
    saveReihe(reihe);
  }
}

if (cmd === 'heute') await heute();
else if (cmd === 'stand') stand();
else if (cmd === 'plan') plan();
else if (cmd === 'logo') await logo();
else if (cmd === 'seite') await seite();
else if (cmd === 'id') await id();
else if (cmd === 'vorrat') vorrat();
else if (cmd === 'namen') await namen();
else if (cmd === 'banner') await banner();
else if (cmd === 'chatgpt') chatgpt();
else if (cmd === 'banner-vergleich') await bannerVergleich();
else if (cmd === 'banner-gemalt') await bannerGemalt();
else if (cmd === 'banner-wahl') await bannerWahl();
else fail('Aufruf: npm run serie -- heute | stand | plan | logo <slug> | seite <slug> | banner <slug> | banner-gemalt <slug> | chatgpt [<slug> …] | banner-vergleich | banner-wahl <slug> claude|chatgpt | id <slug> <Projekt-ID> | vorrat <slug> … | namen');
