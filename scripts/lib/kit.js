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
  return renderDescription({ kind: 'skinpack', name: pack.name, legend: pack.legend, versions: packVersionsForDescription(pack, opts) });
}

export function modDescription(meta) {
  const versions = [{ version: '1.0.0', images: (meta.screenshots || []).map(s => rawUrl(`${repoPath(modDir(meta.modId))}/${s}`)) },
    ...(meta.changelog || []).slice(1).map(c => ({ version: c.version, title: c.title || '', note: c.note || '' }))];
  return renderDescription({ kind: 'mod', name: meta.name, legend: meta.legend || meta.description, body: meta.pageDescription, versions });
}

function table(rows) {
  return ['| Feld | Wert |', '|---|---|', ...rows.map(([k, v]) => `| ${k} | ${String(v).replace(/\|/g, '\\|').replace(/\n/g, ' ')} |`)].join('\n');
}

// mode 'new' → create the project; 'refresh' → existing project, replace logo/cover/description.
export function skinpackKit(pack, config, { mode = 'new' } = {}) {
  const b = config.bedrock || {};
  const dir = repoPath(packDir(pack.slug));
  const logo = logoFileName(pack.name), cover = coverFileName(pack.name);
  const base = pack.versions.find(v => v.status === 'published') || pack.versions[0];
  const rows = [
    ['Project name', `**${pack.name}**${pack.altNames?.length ? ` (Ausweichnamen: ${pack.altNames.join(' · ')})` : ''}`],
    ['Slug', slugify(pack.name)],
    ['Logo', `[${logo}](${rawUrl(`${dir}/${logo}`)})`],
    ['Summary', pack.summary],
    ['Class', b.class || 'Skins'],
    ['Main category', b.mainCategory || 'Players'],
    ['Additional categories', (b.additionalCategories || ['Skin Packs']).join(', ')],
    ['Allow Comments', '✓'], ['Unlisted project', '✗'], ['Enable Project Pages', '✗'],
    ['Project License', b.license || 'All Rights Reserved'],
    ['Project distribution', b.distribution || 'Allow distribution to 3rd party'],
    ['Source Code', b.source || 'The source code is not publicly available'],
    ['Media → Bild', `[${cover}](${rawUrl(`${dir}/${cover}`)})`],
    ['Media → Title', `**${b.galleryTitle || 'MCPEDL'}** (genau so, sonst übernimmt MCPEDL das Cover nicht)`],
    ['Media → Description', cover],
    ['Media → Feature Media', '★ aktivieren'],
    ...(mode === 'new' ? [['Erste Datei', `${base.mcpack || `${pack.slug}.mcpack`} · Release Type R · alle aktuellen Bedrock-Versionen (${b.versionPrefix || '26.'}x)`]] : [])
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

${packDescription(pack)}`;
}

// Issue body for a skin pack update: new description section + changelog (+ manual upload if needed).
export function skinpackUpdateKit(pack, v, config, { uploaded, fileUrl } = {}) {
  const b = config.bedrock || {};
  const dir = repoPath(packDir(pack.slug));
  const section = renderUpdateSection({ ...v, images: (v.media || []).map(m => rawUrl(`${dir}/${m}`)) }, 'skinpack');
  const upload = uploaded
    ? `Die Datei wurde automatisch hochgeladen: ${fileUrl || '(siehe Actions-Log)'}`
    : `1. **Files → Add File**: [${v.mcpack}](${rawUrl(`${dir}/mcpack/${v.mcpack}`)}) hochladen, Release Type **R**, alle aktuellen Bedrock-Versionen (${b.versionPrefix || '26.'}x), Changelog unten einfügen.`;
  return `# Update V${v.version}: ${pack.name}

## Schritte
${upload}
${uploaded ? '1.' : '2.'} **Description**: Abschnitt unten **ans Ende vor "How to install"** einfügen.
${uploaded ? '2.' : '3.'} Issue schließen.

## Neuer Beschreibungsabschnitt

${section}

## Changelog

${v.changelog || ''}`;
}

export function modKit(meta, config, { modId }) {
  const dir = repoPath(modDir(modId));
  const logo = meta.logoFile || logoFileName(meta.name), cover = meta.coverFile || coverFileName(meta.name);
  const rows = [
    ['Project name', `**${meta.name}**${meta.altNames?.length ? ` (Ausweichnamen: ${meta.altNames.join(' · ')})` : ''}`],
    ['Slug', slugify(meta.name)],
    ['Logo', `[${logo}](${rawUrl(`${dir}/${logo}`)})`],
    ['Summary', meta.description],
    ['Class', 'Mods'], ['Main category', meta.cfCategory],
    ['Allow Comments', '✓'], ['Unlisted project', '✗'], ['Enable Project Pages', '✗'],
    ['Project License', 'MIT'], ['Project distribution', 'Allow distribution to 3rd party'],
    ['Source Code', `https://github.com/${process.env.GITHUB_REPOSITORY || 'Busja777/minecraft-mod-factory'}/tree/main/${dir}`],
    ['Media → Bild', `[${cover}](${rawUrl(`${dir}/${cover}`)})`],
    ['Media → Title', meta.name], ['Media → Description', cover], ['Media → Feature Media', '★ aktivieren'],
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

${modDescription({ ...meta, modId })}`;
}
