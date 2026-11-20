import './lib/load-secrets.js';
import fs from 'fs';
import path from 'path';
import { listReleaseProjects, loadReleaseProject, saveReleaseProject, newReleaseProject, addVersion, releaseFile, syncReleasesWithFiles } from './lib/releases.js';
import { nextDueVersion } from './lib/skinpacks.js';
import { gameOf, tokenFor } from './lib/games.js';
import { loadProjects, saveProjects, findProject, newEntry, effectiveDue, DEFAULT_INTERVAL_DAYS } from './lib/cf-projects.js';
import { getProject, listFiles } from './platforms/curseforge-core.js';
import { slugify } from './lib/naming.js';
import { arg } from './lib/github-output.js';

// Projekte anderer Spiele, die einmal von Hand auf CurseForge angelegt wurden und danach
// von selbst über die Upload-API weiterlaufen (Vorrat in data/projects/<slug>/).
//   npm run projekt -- neu --game <spiel> --id <projectId> --name "<Name>" [--slug <slug>]
//   npm run projekt -- version --project <slug> --version 1.1 --file <Pfad> --changelog <Pfad zur .md> [--game-versions "1.6.14,1.6.15"] [--anzeige "<Dateititel>"]
//   npm run projekt -- liste
const argv = process.argv.slice(2);
const cmd = argv[0];
const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
const fail = msg => { console.error(`✗ ${msg}`); process.exit(1); };
const date = iso => (iso ? iso.slice(0, 10) : '—');

async function neu() {
  const gameKey = arg(argv, '--game');
  const projectId = Number(arg(argv, '--id'));
  const name = arg(argv, '--name');
  if (!gameKey || !name || !Number.isInteger(projectId)) fail('Aufruf: npm run projekt -- neu --game <spiel> --id <projectId> --name "<Name>"');
  let game;
  try { game = gameOf(config, gameKey); } catch { fail(`Unbekanntes Spiel "${gameKey}". Bekannt: ${Object.keys(config.games || {}).join(', ')}`); }
  const slug = arg(argv, '--slug', slugify(name));
  const projects = loadProjects();
  if (findProject(projects, slug) || listReleaseProjects().includes(slug)) fail(`"${slug}" gibt es schon. Anderen Namen mit --slug wählen.`);
  if (projects.some(p => p.projectId === projectId)) fail(`Die Projekt-ID ${projectId} ist schon eingetragen.`);

  const project = newReleaseProject({ slug, game: gameKey, name, projectId });
  const entry = { ...newEntry({ modId: slug, name, kind: 'file', version: '1.0' }), game: gameKey, cfName: name, projectId };

  // Nur lesend: gehört die ID wirklich zu diesem Spiel, und liegt schon eine Datei dort?
  const key = process.env.CF_CORE_API_KEY;
  if (key) {
    const cf = await getProject(projectId, { key }).catch(e => fail(`CurseForge kennt die Projekt-ID ${projectId} nicht (${e.message}).`));
    if (game.gameId && cf.gameId !== game.gameId) fail(`Projekt ${projectId} („${cf.name}“) gehört nicht zu ${game.name}.`);
    entry.cfName = cf.name;
    const files = await listFiles(projectId, { key });
    syncReleasesWithFiles(project, files);
    if (files[0]) Object.assign(entry, { status: 'published', lastPublishedAt: new Date(files[0].fileDate).toISOString() });
  } else {
    console.log('Hinweis: kein CF_CORE_API_KEY, die Projekt-ID wurde nicht gegen CurseForge geprüft.');
  }

  projects.push(entry);
  saveProjects(projects);
  const dir = saveReleaseProject(project);
  console.log(`✓ ${name} (${game.name}) eingetragen: ${dir}/project.json`);
  console.log(entry.status === 'published'
    ? `  Letzte Datei auf CurseForge: ${date(entry.lastPublishedAt)}. Updates laufen ab jetzt abends von selbst, sobald eine Version vorbereitet ist.`
    : '  Auf CurseForge liegt noch keine Datei. Die erste Datei startest du selbst (Abend-Lauf mit force und modId), danach laufen Updates von selbst.');
  if (!tokenFor(game)) console.log(`  Es fehlt noch das Upload-Token des Kontos: ${game.tokenEnv} in secrets.env eintragen, dann npm run secrets:push.`);
}

function version() {
  const slug = arg(argv, '--project');
  const src = arg(argv, '--file');
  const changelogArg = arg(argv, '--changelog');
  const ver = arg(argv, '--version');
  if (!slug || !src || !changelogArg || !ver) fail('Aufruf: npm run projekt -- version --project <slug> --version <x.y> --file <Pfad> --changelog <Pfad zur .md>');
  if (!fs.existsSync(src)) fail(`Datei fehlt: ${src}`);
  if (!fs.existsSync(changelogArg)) fail(`Changelog-Datei fehlt: ${changelogArg}`);
  const project = loadReleaseProject(slug);
  const gameVersions = (arg(argv, '--game-versions', '') || '').split(',').map(s => s.trim()).filter(Boolean);
  let v;
  try {
    v = addVersion(project, { version: ver, file: path.basename(src), changelog: fs.readFileSync(changelogArg, 'utf-8'), displayName: arg(argv, '--anzeige'), gameVersions });
  } catch (e) { fail(e.message); }
  saveReleaseProject(project);
  fs.copyFileSync(src, releaseFile(slug, v.file));
  const due = project.versions.filter(x => x.status === 'due').length;
  console.log(`✓ ${project.name} V${ver} vorbereitet (${v.file}). Wartende Versionen: ${due}.`);
}

function liste() {
  const slugs = listReleaseProjects();
  if (!slugs.length) { console.log('Noch keine Projekte. Anlegen: npm run projekt -- neu --game <spiel> --id <projectId> --name "<Name>"'); return; }
  const projects = loadProjects();
  const minIntervalDays = (config.updateIntervalDays || DEFAULT_INTERVAL_DAYS)[0];
  for (const slug of slugs) {
    const p = loadReleaseProject(slug);
    const game = gameOf(config, p.game);
    const entry = findProject(projects, slug);
    const due = p.versions.filter(v => v.status === 'due');
    const next = nextDueVersion(p);
    const when = entry?.lastPublishedAt ? date(effectiveDue(entry, { minIntervalDays }).toISOString()) : 'erste Datei startest du selbst';
    console.log(`■ ${p.name} (${game.name}, ${slug}, Projekt ${p.cfProjectId})`);
    console.log(`  Token ${game.tokenEnv}: ${tokenFor(game) ? 'vorhanden' : 'FEHLT'} · veröffentlicht: ${p.versions.length - due.length} · vorbereitet: ${due.length}`);
    console.log(next ? `  Nächstes Update: V${next.version} (${next.file}), frühestens ${when}` : '  Kein Update vorbereitet, es passiert nichts.');
  }
}

if (cmd === 'neu') await neu();
else if (cmd === 'version') version();
else if (cmd === 'liste') liste();
else fail('Aufruf: npm run projekt -- neu | version | liste');
