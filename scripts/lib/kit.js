import { renderDescription, renderUpdateSection } from './description.js';
import { logoFileName, coverFileName, rawUrl, slugify } from './naming.js';
import { packDir } from './skinpacks.js';
import { modDir } from './mods.js';

// Builds the "project kit": every CurseForge field to fill in by hand (no API exists for project
// creation, description or gallery), plus the ready-to-paste description.

const repoPath = p => p.replace(/^\.\//, '');

export function packVersionsForDescription(pack, { through } = {}) {
  const dir = repoPath(packDir(pack.slug));
  return pack.versions
    .filter(v => v.status === 'published' || (through && v.version === through))
    .map(v => ({ ...v, images: (v.media || []).map(m => rawUrl(`${dir}/${m}`)) }));
}

export function packDescription(pack, opts) {
  const collection = pack.collection ? rawUrl(`${repoPath(packDir(pack.slug))}/${pack.collection}`) : undefined;
  return renderDescription({ kind: 'skinpack', name: pack.name, legend: pack.legend, versions: packVersionsForDescription(pack, opts), collection });
}

export function modDescription(meta) {
  const versions = [{ version: '1.0.0', images: (meta.screenshots || []).map(s => rawUrl(`${repoPath(modDir(meta.modId))}/${s}`)) },
    ...(meta.changelog || []).slice(1).map(c => ({ version: c.version, title: c.title || '', note: c.note || '' }))];
  return renderDescription({ kind: 'mod', name: meta.name, legend: meta.legend || meta.description, body: meta.pageDescription, versions });
}

function table(rows) {
  return ['| Feld | Wert |', '|---|---|', ...rows.map(([k, v]) => `| ${k} | ${String(v).replace(/\|/g, '\\|').replace(/\n/g, ' ')} |`)].join('\n');
}

// Raw values of every CurseForge field for a skin pack. skinpackKit renders them as a table;
// the macro bundle (macro-bundle.js) writes them to plain files for Keyboard Maestro.
export function skinpackKitFields(pack, config, { mode = 'new' } = {}) {
  const b = config.bedrock || {};
  const dir = repoPath(packDir(pack.slug));
  const base = pack.versions.find(v => v.status === 'published') || pack.versions[0];
  return {
    kind: 'skinpack', mode, dir,
    name: pack.name, altNames: pack.altNames || [], slug: slugify(pack.name),
    logo: logoFileName(pack.name), cover: coverFileName(pack.name),
    summary: pack.summary,
    class: b.class || 'Skins',
    mainCategory: b.mainCategory || 'Players',
    additionalCategories: b.additionalCategories || ['Skin Packs'],
    license: b.license || 'All Rights Reserved',
    distribution: b.distribution || 'Allow distribution to 3rd party',
    source: b.source || 'The source code is not publicly available',
    galleryTitle: b.galleryTitle || 'MCPEDL',
    firstFile: mode === 'new' ? (base.mcpack || `${pack.slug}.mcpack`) : null,
    versionPrefix: b.versionPrefix || '26.',
    // Neues Projekt: die erste Version geht mit hoch, also gehört sie schon in die Beschreibung.
    description: packDescription(pack, mode === 'new' ? { through: base.version } : undefined)
  };
}

// mode 'new' → create the project; 'refresh' → existing project, replace logo/cover/description.
export function skinpackKit(pack, config, { mode = 'new' } = {}) {
  const f = skinpackKitFields(pack, config, { mode });
  const rows = [
    ['Project name', `**${f.name}**${f.altNames.length ? ` (Ausweichnamen: ${f.altNames.join(' · ')})` : ''}`],
    ['Slug', f.slug],
    ['Logo', `[${f.logo}](${rawUrl(`${f.dir}/${f.logo}`)})`],
    ['Summary', f.summary],
    ['Class', f.class],
    ['Main category', f.mainCategory],
    ['Additional categories', f.additionalCategories.join(', ')],
    ['Allow Comments', '✓'], ['Unlisted project', '✗'], ['Enable Project Pages', '✗'],
    ['Project License', f.license],
    ['Project distribution', f.distribution],
    ['Source Code', f.source],
    ['Media → Bild', `[${f.cover}](${rawUrl(`${f.dir}/${f.cover}`)})`],
    ['Media → Title', `**${f.galleryTitle}** (genau so, sonst übernimmt MCPEDL das Cover nicht)`],
    ['Media → Description', f.cover],
    ['Media → Feature Media', '★ aktivieren'],
    ...(mode === 'new' ? [['Erste Datei', `${f.firstFile} · Release Type R · alle aktuellen Bedrock-Versionen (${f.versionPrefix}x)`]] : [])
  ];
  const steps = mode === 'new'
    ? ['https://authors.curseforge.com → **Start Project** → Minecraft Bedrock → **Skins**', 'Felder laut Tabelle ausfüllen, Logo hochladen', 'Unter **Media** das Cover mit Title **MCPEDL** hochladen und als Feature markieren', 'Beschreibung unten einfügen', `Projekt-ID in \`data/cf-projects.json\` beim Eintrag \`"modId": "${pack.slug}"\` eintragen`]
    : ['Projekt **Edit** → **General**: Logo und Summary ersetzen', '**Media**: altes Cover löschen, neues Cover mit Title **MCPEDL** hochladen, ★ Feature Media', '**Description**: Text unten komplett ersetzen'];
  return `# ${mode === 'new' ? 'Projekt-Kit' : 'Auffrisch-Kit'}: ${pack.name}

## Schritte
${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

## Felder
${table(rows)}

## Beschreibung (Markdown, komplett einfügen)

${f.description}`;
}

// Public URLs of a version's renders (raw.githubusercontent: visible once the repo is pushed).
export function versionImageUrls(pack, v) {
  const dir = repoPath(packDir(pack.slug));
  return (v.media || []).map(m => rawUrl(`${dir}/${m}`));
}

// The description section a skin pack update adds (pasted before "How to install").
export function skinpackUpdateSection(pack, v) {
  return renderUpdateSection({ ...v, images: versionImageUrls(pack, v) }, 'skinpack');
}

// Issue body for a skin pack update: new description section + changelog (+ manual upload if needed).
export function skinpackUpdateKit(pack, v, config, { uploaded, fileUrl } = {}) {
  const b = config.bedrock || {};
  const dir = repoPath(packDir(pack.slug));
  const section = skinpackUpdateSection(pack, v);
  const upload = uploaded
    ? `Die Datei wurde automatisch hochgeladen: ${fileUrl || '(siehe Actions-Log)'}`
    : `1. **Files → Add File**: [${v.mcpack}](${rawUrl(`${dir}/mcpack/${v.mcpack}`)}) hochladen, Release Type **R**, alle aktuellen Bedrock-Versionen (${b.versionPrefix || '26.'}x), Changelog unten einfügen.`;
  return `# Update V${v.version}: ${pack.name}

## Schritte
${upload}
${uploaded ? '1.' : '2.'} **Beschreibung und Galerie**: \`Macros/CurseForge.command\` starten und „Seite nachziehen: ${pack.name}“ wählen (oder \`npm run cf -- seite\`). Der Helfer füllt beides aus, du klickst Save und Apply.
${uploaded ? '2.' : '3.'} Issue schließen.

Von Hand geht es auch: den Abschnitt unten unter Description **vor "How to install"** einfügen.

## Neuer Beschreibungsabschnitt

${section}

## Changelog

${v.changelog || ''}`;
}

// Raw values of every CurseForge field for a mod (see skinpackKitFields).
export function modKitFields(meta, config, { modId }) {
  const dir = repoPath(modDir(modId));
  return {
    kind: 'mod', mode: 'new', dir,
    name: meta.name, altNames: meta.altNames || [], slug: slugify(meta.name),
    logo: meta.logoFile || logoFileName(meta.name), cover: meta.coverFile || coverFileName(meta.name),
    summary: meta.description,
    class: 'Mods',
    mainCategory: meta.cfCategory,
    additionalCategories: [],
    license: 'MIT',
    distribution: 'Allow distribution to 3rd party',
    source: `https://github.com/${process.env.GITHUB_REPOSITORY || 'Busja777/minecraft-mod-factory'}/tree/main/${dir}`,
    galleryTitle: meta.name,
    firstFile: null,
    description: modDescription({ ...meta, modId })
  };
}

export function modKit(meta, config, { modId }) {
  const f = modKitFields(meta, config, { modId });
  const rows = [
    ['Project name', `**${f.name}**${f.altNames.length ? ` (Ausweichnamen: ${f.altNames.join(' · ')})` : ''}`],
    ['Slug', f.slug],
    ['Logo', `[${f.logo}](${rawUrl(`${f.dir}/${f.logo}`)})`],
    ['Summary', f.summary],
    ['Class', f.class], ['Main category', f.mainCategory],
    ['Allow Comments', '✓'], ['Unlisted project', '✗'], ['Enable Project Pages', '✗'],
    ['Project License', f.license], ['Project distribution', f.distribution],
    ['Source Code', f.source],
    ['Media → Bild', `[${f.cover}](${rawUrl(`${f.dir}/${f.cover}`)})`],
    ['Media → Title', f.galleryTitle], ['Media → Description', f.cover], ['Media → Feature Media', '★ aktivieren'],
    ['Erste Datei', `wird automatisch hochgeladen (Fabric, ${config.mcVersion})`]
  ];
  return `# Projekt-Kit: ${meta.name}

## Schritte
1. https://authors.curseforge.com → **Start Project** → Minecraft → **Mods**
2. Felder laut Tabelle ausfüllen, Logo und Cover hochladen
3. Beschreibung unten einfügen und speichern
4. In \`data/cf-projects.json\` beim Eintrag \`"modId": "${modId}"\` die numerische \`"projectId"\` eintragen, committen, pushen. Der Upload läuft dann automatisch im nächsten Morgenfenster.

## Felder
${table(rows)}

## Beschreibung (Markdown, komplett einfügen)

${f.description}`;
}
