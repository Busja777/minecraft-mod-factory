import path from 'path';
import { reiheStand, outDir } from '../serie.js';
import { gameOf } from '../games.js';
import { PROJECT_ID_IN_URL } from './selectors.js';
import { URLS } from './selectors.js';

// The series in the browser helper: the "Create Project" form of every built project, filled from
// its page in Output/serie/<reihe>/<nr>-<slug>/ (written by `npm run serie -- seite`). The helper
// stops before "Create" and before every "Apply"; the operator clicks them. After "Create" the
// project id is entered like `npm run serie -- id` would (cf.js), which is the operator's Go for
// the first file. The file itself goes up by API in the evening, never through this form.

// The game as the wizard's "Choose Game" step names it.
export const WIZARD_GAME = { java: 'Minecraft', bedrockaddons: 'Minecraft Bedrock', bedrock: 'Minecraft Bedrock', wow: 'World of Warcraft', stardewvalley: 'Stardew Valley' };

// Chrome profile (= CurseForge login) of a game: the Minecraft legs share the operator's main
// account and its default profile; every other account has its own profile (`--account <name>`).
export function profileFor(config, gameKey) {
  const account = gameOf(config, gameKey).account;
  return /^minecraft/.test(account) ? '' : account;
}

// Built projects whose page waits for "Create", the next `limit` per row in plan order.
// → [{ cmd: 'serie', kind: 'serie', id, reihe, game, nr, name, label }]
export function serieTasks({ reihen, cfProjects, releaseRoot, limit = 7 }) {
  const out = [];
  for (const reihe of reihen) {
    const rows = reiheStand(reihe, { cfProjects, releaseRoot }).rows.filter(r => r.state === 'gebaut').slice(0, limit);
    for (const r of rows) out.push({ cmd: 'serie', kind: 'serie', id: r.slug, reihe: reihe.reihe, game: reihe.game, nr: r.nr, name: r.name, label: `Serien-Projekt anlegen: ${r.name} (${reihe.title} ${r.nr}/33)` });
  }
  return out;
}

// What goes into the form, from the page and the images in the project's Output folder.
export function serieFields({ reihe, project, page, files = [], license = 'All Rights Reserved' }) {
  const dir = outDir(reihe.reihe, project);
  const description = Array.isArray(page.description) ? page.description.join('\n') : String(page.description);
  // Gallery: the banner first (it becomes the main image), then the title image and screenshots.
  const images = [...(reihe.banner === false ? [] : ['banner.png']), 'cover.png', ...files.filter(f => /^shot-\d+\.png$/.test(f)).sort()];
  return { dir, name: page.name, summary: page.summary, class: page.class || null, mainCategory: page.category, description, license, logo: 'logo.png', images };
}

const abs = (dir, f) => path.resolve(dir, f);

// → { title, steps, notes }
export function buildSerieSteps(task, f) {
  const game = WIZARD_GAME[task.game];
  if (!game) throw new Error(`Für das Spiel "${task.game}" kennt der Helfer den Namen im Assistenten nicht.`);
  const steps = [
    { title: 'Projects öffnen', action: 'goto', value: URLS.projects },
    { title: 'Create A Project', action: 'click', target: 'startProject' },
    { title: `Spiel: ${game}`, action: 'click', target: 'game', arg: game },
    { title: 'Reiter General', action: 'click', target: 'wizardTab', arg: 'General', optional: true },
    { title: 'Project name', action: 'fill', target: 'projectName', value: f.name },
    { title: 'Logo (logo.png)', action: 'upload', target: 'logoFile', trigger: 'uploadLogo', value: abs(f.dir, f.logo) },
    { title: 'Summary', action: 'fill', target: 'summary', value: f.summary },
    ...(f.class ? [{ title: `Class: ${f.class}`, action: 'select', target: 'projectClass', value: f.class }] : []),
    { title: `Main category: ${f.mainCategory}`, action: 'select', target: 'mainCategory', value: f.mainCategory },
    { title: 'Reiter Description', action: 'click', target: 'wizardTab', arg: 'Description' },
    { title: 'Editor auf Markdown', action: 'select', target: 'descriptionEditorType', value: 'Markdown', optional: true },
    { title: 'Beschreibung', action: 'fill', target: 'description', value: f.description.trimEnd() },
    { title: 'Reiter License', action: 'click', target: 'wizardTab', arg: 'License' },
    { title: `Project License: ${f.license}`, action: 'select', target: 'license', value: f.license },
    { title: 'Warten auf „Create“', action: 'waitFor', value: 'Bitte alles prüfen und selbst auf „Create“ klicken. Ich warte, bis die Projektseite offen ist …', until: { url: PROJECT_ID_IN_URL } },
    { title: 'Projekt-ID merken', action: 'captureProjectId' }
  ];
  for (const image of f.images) {
    steps.push(
      { title: 'Reiter Media', action: 'click', target: 'projectTab', arg: 'Media' },
      { title: 'Add Media', action: 'click', target: 'addMedia' },
      { title: `Bild ${image}`, action: 'upload', target: 'mediaFile', trigger: 'uploadImageChoice', value: abs(f.dir, image) },
      { title: 'Bild bearbeiten (Stift)', action: 'click', target: 'editMedia' },
      { title: `Titel: ${f.name}`, action: 'fill', target: 'mediaTitle', value: f.name },
      { title: 'Warten auf „Apply“', action: 'waitFor', value: `Bitte ${image} prüfen${image === 'banner.png' ? ' und als Hauptbild markieren' : ''}, dann selbst auf „Apply“ klicken …`, until: { gone: 'mediaTitle' } }
    );
  }
  return {
    title: `Serien-Projekt: ${f.name}`,
    steps,
    notes: [
      'Keine Datei hochladen: die erste Datei geht am Abend per API hoch, sobald die Projekt-ID eingetragen ist.',
      'Der erste Lauf je Spiel ist ein Probelauf: weicht das Formular ab, die Seite mit `npm run cf -- inspect` speichern und Claude Bescheid geben.'
    ]
  };
}
