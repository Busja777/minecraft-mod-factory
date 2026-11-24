import fs from 'fs';
import path from 'path';

// One folder per project with everything the operator needs to create it on CurseForge by hand:
//   Output/Hochladen/<Reihe>/<NN> <Name>/
//     <Name> - Anleitung und Texte.txt   steps, name, summary, category, description, first file + changelog
//     <first file>.zip                   the first version from the stock, under its stock name
//     <slug>-<seo>-logo.png, -cover.png  and one image per in-game shot, with a descriptive file name
// Shot metadata lives next to the shots: tools/<reihe>/projects/<slug>/shots/shots.json
//   [{ file: "01.png", name: "session-gold-per-hour", title: "Caption", description: "One or two sentences", since: "1.2" }]
// title and description go into CurseForge's image fields (English).
// since: first version that has what the image shows (left out = the first file has it already).

export const UPLOAD_ROOT = './Output/Hochladen';

// Search words for file names, per series.
const SEO = { wow: 'wow-addon', java: 'minecraft', stardew: 'stardew-valley-mod', sims4: 'sims-4-mod' };

export function seoSlug(text) {
  return String(text).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/ß/g, 'ss').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export const folderName = (project, page) => `${String(project.nr).padStart(2, '0')} ${page.name.replace(/[/\\:*?"<>|]/g, '-')}`;

// Reads shots.json, or falls back to the plain image list. Every image needs exactly one entry.
export function loadShotMeta(shotDir) {
  if (!fs.existsSync(shotDir)) return [];
  const pngs = fs.readdirSync(shotDir).filter(f => f.endsWith('.png')).sort();
  const metaFile = path.join(shotDir, 'shots.json');
  if (!fs.existsSync(metaFile)) return pngs.map(file => ({ file, name: path.basename(file, '.png'), title: null, description: null, since: null }));
  const meta = JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
  const listed = meta.map(m => m.file);
  const missing = pngs.filter(f => !listed.includes(f));
  const extra = listed.filter(f => !pngs.includes(f));
  if (missing.length || extra.length) throw new Error(`${metaFile}: ${[...missing.map(f => `${f} fehlt in der Liste`), ...extra.map(f => `${f} gibt es nicht`)].join(', ')}`);
  for (const m of meta) {
    if (!m.name || seoSlug(m.name) !== m.name) throw new Error(`${metaFile}: ${m.file} braucht einen Namen aus Kleinbuchstaben und Bindestrichen`);
    if (!String(m.title || '').trim() || !String(m.description || '').trim()) throw new Error(`${metaFile}: ${m.file} braucht title und description`);
    if (/[äöüÄÖÜß]/.test(m.title + m.description)) throw new Error(`${metaFile}: ${m.file}: title und description auf Englisch`);
  }
  return [...meta].sort((a, b) => a.file.localeCompare(b.file));
}

const newer = (a, b) => {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  return false;
};

// What goes into the folder: [{ from, to, title?, since? }] plus the text file.
export function planUploadFolder({ reihe, project, page, pageDir, shotDir, release, gameVersionType }) {
  const seo = SEO[reihe.reihe] || seoSlug(reihe.title);
  const base = `${project.slug}-${seo}`;
  const first = release?.versions?.[0] || null;
  const images = [
    { from: path.join(pageDir, 'logo.png'), to: `${base}-logo.png`, role: 'logo' },
    ...(reihe.banner === false ? [] : [{ from: path.join(pageDir, 'banner.png'), to: `${base}-banner.png`, role: 'banner' }]),
    { from: path.join(pageDir, 'cover.png'), to: `${base}-cover.png`, role: 'cover' }
  ];
  const shots = loadShotMeta(shotDir).map(m => ({
    from: path.join(shotDir, m.file),
    to: `${project.slug}-${m.name}.png`,
    role: 'shot',
    title: m.title,
    description: m.description,
    since: first && m.since && newer(m.since, first.version) ? m.since : null
  }));
  const cover = images.find(i => i.role === 'cover');
  if (page.cover?.tagline) Object.assign(cover, { title: page.cover.tagline, description: page.summary });
  const files = [...images, ...shots];
  if (first) files.push({ from: path.join(release.root, 'files', first.file), to: first.file, role: 'file' });
  return { folder: folderName(project, page), files, text: uploadText({ reihe, project, page, files, first, gameVersionType }) };
}

// Title and Description for CurseForge's image fields, plus the version note for the operator.
function imageFields(img) {
  return [
    img.title && `\n      Title: ${img.title}`,
    img.description && `\n      Description: ${img.description}${img.since ? ` Shown here with version ${img.since}.` : ''}`,
    img.since && `\n      (zeigt eine Funktion ab Version ${img.since}, im Bild so beschriftet)`
  ].filter(Boolean).join('');
}

function uploadText({ reihe, project, page, files, first, gameVersionType }) {
  const by = role => files.filter(f => f.role === role);
  const main = by(reihe.banner === false ? 'cover' : 'banner')[0];
  const gallery = [...(reihe.banner === false ? [] : by('cover')), ...by('shot')];
  const later = by('shot').filter(s => s.since);
  const line = '─'.repeat(60);
  return [
    `${page.name}: Projekt auf CurseForge anlegen`,
    `Reihe ${reihe.title}, Projekt ${project.nr}. Alles, was du brauchst, liegt in diesem Ordner.`,
    '',
    'SCHRITTE',
    `1. Bei CurseForge (${reihe.title}) ein neues Projekt anlegen${page.class ? `, Projektart: ${page.class}` : ''}.`,
    '2. Name, Summary, Kategorie und Zusatzkategorien von unten eintragen. Im Beschreibungs-Editor auf Markdown stellen und die Beschreibung einfügen.',
    `3. Logo: ${by('logo')[0].to}`,
    `4. Bilder: ${main.to} hochladen und als Hauptbild markieren${imageFields(main)}`,
    ...(gallery.length ? ['   Danach die übrigen Bilder in dieser Reihenfolge, jeweils mit Title und Description:'] : []),
    ...gallery.map((g, i) => `   ${i + 1}. ${g.to}${imageFields(g)}`),
    ...(later.length ? ['', `   ${later.length === by('shot').length ? 'Alle Bilder aus dem Spiel zeigen' : `${later.length} der Bilder zeigen`} Funktionen, die erst mit einem Update kommen. Sie sind im Bild mit der Version beschriftet, du kannst sie also gleich mit hochladen.`] : []),
    first
      ? `5. Datei: ${first.file} hochladen. Release-Typ: Release. Spielversion: ${(first.gameVersions || []).join(', ') || '(die neueste)'}${gameVersionType ? ` (${gameVersionType})` : ''}. Den Changelog von unten einfügen.\n   Den Dateinamen nicht ändern, daran erkennt der Abend-Lauf, dass V${first.version} schon online ist.\n   Lizenz: All Rights Reserved.`
      : '5. Noch keine Datei im Vorrat: ohne Datei anlegen. Lizenz: All Rights Reserved.',
    `6. Projekt-ID eintragen: npm run serie -- id ${project.slug} <Projekt-ID> (oder schreib Claude die ID). Danach laufen die Updates von selbst.`,
    '',
    line, 'NAME', line, page.name, '',
    line, 'SUMMARY', line, page.summary, '',
    line, 'KATEGORIE (Main category)', line, page.class ? `${page.class} → ${page.category}` : page.category, '',
    ...(page.additionalCategories?.length ? [line, 'ZUSATZKATEGORIEN (Additional categories)', line, ...page.additionalCategories, ''] : []),
    line, 'DESCRIPTION (Markdown)', line, page.description.trim(), '',
    ...(first ? [line, `CHANGELOG V${first.version} (Markdown)`, line, first.changelog.trim(), ''] : [])
  ].join('\n');
}

// Writes the folder fresh (a removed image must not linger). Returns the folder path.
export function writeUploadFolder(plan, root) {
  const dir = path.join(root, plan.folder);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const f of plan.files) {
    if (!fs.existsSync(f.from)) throw new Error(`${f.from} fehlt`);
    fs.copyFileSync(f.from, path.join(dir, f.to));
  }
  fs.writeFileSync(path.join(dir, `${plan.folder.replace(/^\d+ /, '')} - Anleitung und Texte.txt`), plan.text + '\n');
  return dir;
}
