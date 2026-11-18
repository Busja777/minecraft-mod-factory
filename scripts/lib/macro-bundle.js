import path from 'path';
import { skinpackKitFields, modKitFields, skinpackKit, modKit, skinpackUpdateKit, skinpackUpdateSection, versionImageUrls } from './kit.js';
import { changelogFor } from './skinpacks.js';

// The "macro bundle": every value a Keyboard Maestro macro needs to fill in a CurseForge form,
// written as plain files with FIXED names into one folder (default <repo>/Macros/aktuell/, git-ignored).
// The macro always reads the same paths; only the folder contents change per project.
//
// Entries are { name, text } (written as-is) or { name, from } (repo file copied unchanged).
// Text files carry no trailing newline: the macro pastes them verbatim, and a trailing newline
// would press Enter inside a form field.
// Uploads keep their original file names (logo/, cover/, upload/ subfolders) because the next
// skin-release run detects a manual upload by its .mcpack name; *-pfad.txt holds the absolute
// path for the macOS "Go to folder" dialog (⌘⇧G).

export const MARKER = '.macro-bundle';

const text = (name, value) => ({ name, text: String(value ?? '') });

function fileEntries(key, sourcePath, outDir, sub) {
  const base = path.basename(sourcePath);
  return [
    { name: `${sub}/${base}`, from: sourcePath },
    text(`${key}-pfad.txt`, path.join(outDir, sub, base))
  ];
}

function projectEntries(f, outDir, typ, kitMd) {
  return [
    text('typ.txt', typ),
    text('name.txt', f.name),
    text('slug.txt', f.slug),
    text('summary.txt', f.summary),
    text('klasse.txt', f.class),
    text('kategorie.txt', f.mainCategory),
    text('zusatz-kategorien.txt', f.additionalCategories.join(', ')),
    text('lizenz.txt', f.license),
    text('verbreitung.txt', f.distribution),
    text('quellcode.txt', f.source),
    text('beschreibung.md', f.description.trimEnd()),
    text('media-titel.txt', f.galleryTitle),
    text('media-beschreibung.txt', f.cover),
    ...fileEntries('logo', `${f.dir}/${f.logo}`, outDir, 'logo'),
    ...fileEntries('cover', `${f.dir}/${f.cover}`, outDir, 'cover'),
    text('CHECKLISTE.md', kitMd)
  ];
}

// The version the macro should upload by hand. CI (skin-release.js) marks a version as published
// with manual=true and no fileId when the upload API is off, so that is the one waiting for us.
export function pickUpdateVersion(pack, version) {
  if (version) {
    const v = pack.versions.find(x => x.version === version);
    if (!v) throw new Error(`${pack.name} hat keine Version ${version} (vorhanden: ${pack.versions.map(x => x.version).join(', ')})`);
    return v;
  }
  const waiting = pack.versions.filter(v => v.status === 'published' && v.manual && !v.fileId);
  if (waiting.length) return waiting[waiting.length - 1];
  const due = pack.versions.find(v => v.status === 'due');
  throw new Error(`Bei ${pack.name} wartet keine Version auf einen manuellen Upload.`
    + (due ? ` Die nächste (V${due.version}) gibt erst der Abend-Workflow frei.` : '')
    + ' Mit --version <x> kannst du eine bestimmte Version wählen.');
}

// kind 'mod'      → { meta, modId }
// kind 'skinpack' → { pack, mode: 'new' | 'refresh' | 'update', version? }
export function buildMacroBundle({ kind, mode = 'new', pack, meta, modId, version, config, outDir }) {
  if (kind === 'mod') {
    const f = modKitFields(meta, config, { modId });
    return { title: `Neues Mod-Projekt: ${f.name}`, entries: projectEntries(f, outDir, 'mod', modKit(meta, config, { modId })) };
  }
  if (kind !== 'skinpack') throw new Error(`Unbekannte Art "${kind}"`);

  if (mode === 'update') {
    const v = pickUpdateVersion(pack, version);
    if (!v.mcpack) throw new Error(`V${v.version} hat noch keine .mcpack-Datei (erst skin-release.js laufen lassen)`);
    const changelog = v.changelog || changelogFor(v, { imageUrls: versionImageUrls(pack, v) });
    const dir = skinpackKitFields(pack, config, { mode: 'refresh' }).dir;
    return {
      title: `Skinpack-Update: ${pack.name} V${v.version}`,
      entries: [
        text('typ.txt', 'skinpack-update'),
        text('name.txt', pack.name),
        text('version.txt', v.version),
        ...fileEntries('datei', `${dir}/mcpack/${v.mcpack}`, outDir, 'upload'),
        text('datei-name.txt', v.mcpack),
        text('changelog.md', changelog.trimEnd()),
        text('beschreibungs-abschnitt.md', skinpackUpdateSection(pack, v)),
        text('CHECKLISTE.md', skinpackUpdateKit(pack, { ...v, changelog }, config, { uploaded: false }))
      ]
    };
  }

  if (!['new', 'refresh'].includes(mode)) throw new Error(`Unbekannter Modus "${mode}"`);
  const f = skinpackKitFields(pack, config, { mode });
  const entries = projectEntries(f, outDir, mode === 'new' ? 'skinpack-neu' : 'skinpack-auffrischen', skinpackKit(pack, config, { mode }));
  if (f.firstFile) entries.push(...fileEntries('datei', `${f.dir}/mcpack/${f.firstFile}`, outDir, 'upload'), text('datei-name.txt', f.firstFile));
  return { title: `${mode === 'new' ? 'Neues Skinpack-Projekt' : 'Projektseite auffrischen'}: ${f.name}`, entries };
}

export const missingSources = (bundle, exists) => bundle.entries.filter(e => e.from && !exists(e.from)).map(e => e.from);
