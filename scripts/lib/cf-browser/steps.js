import path from 'path';
import { skinpackKitFields, modKitFields, skinpackUpdateSection, versionImageUrls } from '../kit.js';
import { changelogFor } from '../skinpacks.js';
import { pickUpdateVersion } from '../macro-bundle.js';
import { URLS, PROJECT_ID_IN_URL } from './selectors.js';
import { pageBehind, latestPublished, galleryTitle } from '../page-state.js';

// Pure step lists for the CurseForge browser tool, in the order of Input/Anleitung_CF.docx:
//   Create Project (Choose Game → General → Description → License) → Media → File.
// A step: { title, action, target?, arg?, value?, optional?, until? }
//   actions: goto | click | fill | select | multiselect | upload | check | manual | waitFor | captureProjectId | learnProjectUrl
// No step ever clicks a final button (Create / Apply / Add File in the form): waitFor steps wait
// until YOU clicked it.

const abs = p => path.resolve(p);

function openProject(projectId, name) {
  if (URLS.project && projectId) return { title: `Projektseite ${name} öffnen`, action: 'goto', value: ctx => URLS.project.replace('{id}', ctx.projectId || projectId) };
  return { title: `Projektseite ${name} öffnen`, action: 'manual', value: `Öffne im Browser die CurseForge-Projektseite von „${name}“${projectId ? ` (ID ${projectId})` : ''}.` };
}

function createSteps(f, game) {
  return [
    { title: 'Projects öffnen', action: 'goto', value: URLS.projects },
    { title: 'Create A Project', action: 'click', target: 'startProject' },
    { title: `Spiel: ${game}`, action: 'click', target: 'game', arg: game },
    { title: 'Reiter General', action: 'click', target: 'wizardTab', arg: 'General', optional: true },
    { title: 'Project name', action: 'fill', target: 'projectName', value: f.name },
    { title: `Logo (${f.logo})`, action: 'upload', target: 'logoFile', trigger: 'uploadLogo', value: abs(`${f.dir}/${f.logo}`) },
    { title: 'Summary', action: 'fill', target: 'summary', value: f.summary },
    { title: `Class: ${f.class}`, action: 'select', target: 'projectClass', value: f.class },
    { title: `Main category: ${f.mainCategory}`, action: 'select', target: 'mainCategory', value: f.mainCategory },
    ...(f.additionalCategories.length ? [{ title: `Additional categories: ${f.additionalCategories.join(', ')}`, action: 'multiselect', target: 'additionalCategories', value: f.additionalCategories }] : []),
    { title: 'Reiter Description', action: 'click', target: 'wizardTab', arg: 'Description' },
    { title: 'Editor auf Markdown', action: 'select', target: 'descriptionEditorType', value: 'Markdown', optional: true },
    { title: 'Beschreibung (mit Screenshots + KI-Hinweis)', action: 'fill', target: 'description', value: f.description.trimEnd() },
    { title: 'Reiter License', action: 'click', target: 'wizardTab', arg: 'License' },
    { title: `Project License: ${f.license}`, action: 'select', target: 'license', value: f.license },
    { title: `Project distribution: ${f.distribution}`, action: 'select', target: 'distribution', value: f.distribution }
  ];
}

const waitCreate = [
  { title: 'Warten auf „Create“', action: 'waitFor', value: 'Bitte alles prüfen und selbst auf „Create“ klicken. Ich warte, bis die Projektseite offen ist …', until: { url: PROJECT_ID_IN_URL } },
  { title: 'Projekt-ID merken', action: 'captureProjectId' }
];

function mediaSteps(f, { wait }) {
  return [
    { title: 'Reiter Media', action: 'click', target: 'projectTab', arg: 'Media' },
    { title: 'Add Media', action: 'click', target: 'addMedia' },
    { title: `Cover (${f.cover})`, action: 'upload', target: 'mediaFile', trigger: 'uploadImageChoice', value: abs(`${f.dir}/${f.cover}`) },
    { title: 'Bild bearbeiten (Stift)', action: 'click', target: 'editMedia' },
    { title: `Titel: ${f.galleryTitle}`, action: 'fill', target: 'mediaTitle', value: f.galleryTitle },
    ...(wait ? [{ title: 'Warten auf „Apply“', action: 'waitFor', value: 'Bitte Titel prüfen und selbst auf „Apply“ klicken …', until: { gone: 'mediaTitle' } }] : [])
  ];
}

// Existing project: replace the whole description. waitFor ends when CurseForge shows the new text
// (check 'description', supplied by cf.js through the Core API) — the helper never clicks Save.
function descriptionSteps(f) {
  return [
    { title: 'Reiter Description', action: 'click', target: 'projectTab', arg: 'Description' },
    { title: 'Editor auf Markdown', action: 'select', target: 'descriptionEditorType', value: 'Markdown', optional: true },
    { title: 'Beschreibung (Legende, Skins mit Story, Updates)', action: 'fill', target: 'description', value: f.description.trimEnd() },
    { title: 'Warten auf „Save“', action: 'waitFor', value: 'Bitte die Beschreibung prüfen und selbst auf „Save“ klicken. Ich warte, bis CurseForge den neuen Text zeigt …', until: { check: 'description' }, timeout: 90 * 1000 }
  ];
}

// Existing project: one more gallery image for an update (the cover titled MCPEDL stays untouched).
function gallerySteps(file, title) {
  return [
    { title: 'Reiter Media', action: 'click', target: 'projectTab', arg: 'Media' },
    { title: 'Add Media', action: 'click', target: 'addMedia' },
    { title: `Screenshot (${path.basename(file)})`, action: 'upload', target: 'mediaFile', trigger: 'uploadImageChoice', value: abs(file) },
    { title: 'Bild bearbeiten (Stift)', action: 'click', target: 'editMedia' },
    { title: `Titel: ${title}`, action: 'fill', target: 'mediaTitle', value: title },
    { title: 'Warten auf „Apply“', action: 'waitFor', value: 'Bitte Titel prüfen und selbst auf „Apply“ klicken …', until: { gone: 'mediaTitle' } }
  ];
}

function fileSteps(file, { changelog, gameVersions, wait }) {
  return [
    { title: 'Reiter Files', action: 'click', target: 'projectTab', arg: 'Files' },
    { title: 'Add File (Formular öffnen)', action: 'click', target: 'addFile' },
    { title: `Datei ${path.basename(file)}`, action: 'upload', target: 'projectFile', trigger: 'uploadFileZone', value: abs(file) },
    ...(gameVersions.length ? [{ title: `Game: ${gameVersions.length} Versionen`, action: 'multiselect', target: 'gameVersions', value: gameVersions }] : []),
    { title: 'Release Type: Release', action: 'select', target: 'releaseType', value: 'Release' },
    { title: 'Editor auf Markdown', action: 'select', target: 'changelogEditorType', value: 'Markdown', optional: true },
    { title: 'Changelog (mit Screenshots)', action: 'fill', target: 'changelog', value: changelog },
    ...(wait ? [{ title: 'Warten auf „Add File“', action: 'waitFor', value: 'Bitte prüfen und selbst unten rechts auf „Add File“ klicken …', until: { gone: 'releaseType' } }] : [])
  ];
}

// Versions the last file was published for that belong to the current line (e.g. 26.x).
export function gameVersionsFor(pack, prefix) {
  return [...new Set((pack.lastGameVersions || []).filter(v => v.startsWith(prefix)))];
}

function skinFile(pack, config, v) {
  const f = skinpackKitFields(pack, config, { mode: 'refresh' });
  if (!v.mcpack) throw new Error(`V${v.version} hat noch keine .mcpack-Datei (erst skin-release.js laufen lassen)`);
  const prefix = config.bedrock?.versionPrefix || '26.';
  const gameVersions = gameVersionsFor(pack, prefix);
  return {
    file: `${f.dir}/mcpack/${v.mcpack}`,
    changelog: (v.changelog || changelogFor(v, { imageUrls: versionImageUrls(pack, v) })).trimEnd(),
    gameVersions,
    note: gameVersions.length ? `Game-Versionen prüfen (gewählt: ${gameVersions.join(', ')}).` : `Game-Versionen selbst wählen: die neueste ${prefix}x und ein paar ältere.`
  };
}

// task: { cmd: 'new'|'media'|'update'|'publish'|'seite', kind: 'skinpack'|'mod', id, version?, projectId?, parts?, galleryFile? }
// → { title, steps, clipboard?, notes: [], record?: { version } }
export function buildSteps(task, { config, pack, meta }) {
  const { cmd, kind } = task;
  if (kind === 'mod' && cmd === 'update') throw new Error('Mod-Dateien lädt die Pipeline per API hoch (npm run publish -- --mod <id>), dafür gibt es keinen Browser-Ablauf.');
  const f = kind === 'mod'
    ? modKitFields(meta, config, { modId: task.id })
    : skinpackKitFields(pack, config, { mode: cmd === 'new' || cmd === 'publish' ? 'new' : 'refresh' });
  const game = kind === 'mod' ? 'Minecraft' : 'Minecraft Bedrock';
  const projectId = task.projectId ?? pack?.cfProjectId;

  if (cmd === 'new') {
    return {
      title: `Neues Projekt: ${f.name}`,
      steps: [...createSteps(f, game), ...waitCreate],
      notes: [`Danach: npm run cf -- media --${kind} ${task.id}`]
    };
  }

  if (cmd === 'media') {
    return { title: `Cover & Media: ${f.name}`, steps: [openProject(projectId, f.name), ...mediaSteps(f, { wait: false })], notes: [] };
  }

  if (cmd === 'update') {
    const v = pickUpdateVersion(pack, task.version);
    const sf = skinFile(pack, config, v);
    return {
      title: `Skinpack-Update: ${pack.name} V${v.version}`,
      steps: [openProject(projectId, pack.name), ...fileSteps(sf.file, { ...sf, wait: false })],
      clipboard: skinpackUpdateSection(pack, v),
      notes: [sf.note, 'Der neue Beschreibungsabschnitt ist in der Zwischenablage: unter Description VOR „How to install“ einfügen.'],
      record: { version: v.version }
    };
  }

  if (cmd === 'seite') {
    if (kind !== 'skinpack') throw new Error('„Seite nachziehen“ gibt es nur für Skinpacks.');
    const v = task.version ? pack.versions.find(x => x.version === task.version) : latestPublished(pack);
    if (!v || v.status !== 'published') throw new Error(`${pack.name} hat keine veröffentlichte Version${task.version ? ` ${task.version}` : ''}.`);
    // parts: what is still missing on the page; default = both (an explicit call always does the full page).
    const parts = task.parts || pageBehind({ ...pack, cfProjectId: projectId }) || { description: true, gallery: true };
    const steps = [openProject(projectId, pack.name), { title: 'Projekt-Adresse merken', action: 'learnProjectUrl', projectId }];
    if (parts.description) steps.push(...descriptionSteps(f));
    const image = task.galleryFile || (v.media?.[0] ? `${f.dir}/${v.media[0]}` : null);
    if (parts.gallery && image) steps.push(...gallerySteps(image, galleryTitle(v)));
    const notes = ['Die bisherige Beschreibung wird komplett ersetzt. Erst speichern, wenn sie im Feld gut aussieht.'];
    if (parts.gallery && !image) notes.push(`V${v.version} hat kein Render-Bild für die Galerie (erst: node scripts/render-skins.js --pack ${pack.slug} --version ${v.version}).`);
    return { title: `Seite nachziehen: ${pack.name} V${v.version}`, steps, notes, page: { version: v.version, description: !!parts.description, gallery: !!(parts.gallery && image) } };
  }

  if (cmd === 'publish') {
    const steps = [...createSteps(f, game), ...waitCreate, ...mediaSteps(f, { wait: true })];
    const notes = [];
    let record;
    if (kind === 'skinpack') {
      const v = pack.versions[0];
      const sf = skinFile(pack, config, v);
      steps.push(...fileSteps(sf.file, { ...sf, wait: true }));
      notes.push(sf.note);
      record = { version: v.version };
    } else {
      notes.push(`Die .jar lädt die Pipeline per API hoch: npm run publish -- --mod ${task.id} (braucht Java 21).`);
    }
    notes.push('Approval abwarten (Glocke oben rechts). Updates frühestens nach 14 Tagen, die Pipeline wartet 22–25.');
    return { title: `Komplett veröffentlichen: ${f.name}`, steps, notes, record };
  }
  throw new Error(`Unbekannter Ablauf "${cmd}"`);
}
