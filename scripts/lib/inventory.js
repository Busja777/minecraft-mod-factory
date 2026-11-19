import { effectiveDue, DEFAULT_INTERVAL_DAYS } from './cf-projects.js';

// Stock overview of every CurseForge project (npm run bestand). Pure functions: the script feeds
// the CurseForge data, the local folder scan and the imported packs.

const DAY = 24 * 60 * 60 * 1000;
export const KIND = { 6925: 'Skinpack', 6929: 'Resource Pack' };
const day = d => new Date(d).toISOString().slice(0, 10);
const de = d => { const [y, m, dd] = day(d).split('-'); return `${dd}.${m}.${y}`; };

// project: { id, name, classId, gameId, downloadCount } · files: [{ fileName, fileDate }]
// pack: imported data/skins/<slug>/pack.json or null · stages: local folder scan [{ stage, skins }]
// entry: data/cf-projects.json entry or null · map: data/bestand.json entry or {}
export function classify({ project, files = [], pack = null, stages = [], entry = null, map = {}, now = new Date() }) {
  const kind = project.gameId === 432 ? 'Java' : KIND[project.classId] || 'Sonstiges';
  const last = files.map(f => f.fileDate).sort().at(-1) || null;
  const due = pack ? pack.versions.filter(v => v.status === 'due') : [];
  const withSkins = stages.filter(s => s.skins > 0).length;
  // Not imported: every local stage beyond the number of files on CurseForge counts as prepared.
  // map.ready overrides the estimate where folder and CurseForge do not line up (skipped stages).
  const estimated = pack ? 0 : Number.isInteger(map.ready) ? map.ready : Math.max(0, withSkins - files.length);
  const ready = pack ? due.length : kind === 'Skinpack' ? estimated : 0;
  const emptyStages = stages.filter(s => s.stage !== 'V1' && s.skins === 0).map(s => s.stage);

  let group, next;
  if (kind === 'Skinpack' && ready > 0 && pack) {
    group = 'A';
    const nextDue = entry ? effectiveDue(entry) : null;
    next = `läuft automatisch: V${due[0].version} ${nextDue && nextDue <= now ? 'ist fällig' : `ab ${de(nextDue)}`}`;
  } else if (kind === 'Skinpack' && ready > 0) {
    group = 'A';
    next = 'importieren (npm run bestand zeigt den Befehl)';
  } else if (kind === 'Skinpack') {
    group = 'B';
    next = map.folder === null ? 'kein lokaler Ordner: neue Skins zeichnen' : emptyStages.length ? `U-Ordner leer (${emptyStages.join(', ')}): neue Skins zeichnen` : 'alles oben: neue Skins zeichnen';
  } else if (kind === 'Resource Pack') {
    group = 'RP';
    next = 'Update nur von Hand mit echtem neuen Inhalt';
  } else {
    group = 'Java';
    next = 'Update braucht den Quellcode bzw. eine neu gebaute Mod';
  }
  return {
    id: project.id, name: project.name, kind, downloads: project.downloadCount, files: files.length, lastUpload: last && day(last),
    daysSince: last ? Math.floor((now - new Date(last)) / DAY) : null,
    folder: map.folder ?? null, imported: !!pack, ready, readyVersions: due.map(v => v.version), group, next, note: map.note || ''
  };
}

// Plays the evening runs forward: each evening the earliest due project with a prepared version
// uploads one version, then waits the mean interval. → [{ date, modId, name, version }]
export function simulateSchedule({ entries, packs, now = new Date(), evenings = 60, intervalDays = DEFAULT_INTERVAL_DAYS }) {
  const mean = (intervalDays[0] + intervalDays[1]) / 2;
  const state = entries
    .filter(e => e.kind === 'skinpack' && e.status === 'published' && Number.isInteger(e.projectId) && packs[e.modId])
    .map(e => ({ entry: { ...e }, queue: packs[e.modId].versions.filter(v => v.status === 'due').map(v => v.version), name: packs[e.modId].name }));
  const plan = [];
  for (let i = 0; i < evenings; i++) {
    const evening = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + i, 20));
    const pick = state
      .filter(s => s.queue.length && effectiveDue(s.entry) <= evening)
      .sort((a, b) => effectiveDue(a.entry) - effectiveDue(b.entry))[0];
    if (!pick) continue;
    plan.push({ date: day(evening), modId: pick.entry.modId, name: pick.name, version: pick.queue.shift() });
    pick.entry.lastPublishedAt = evening.toISOString();
    pick.entry.nextUpdateDue = new Date(evening.getTime() + mean * DAY).toISOString();
  }
  return plan;
}

const cell = v => String(v ?? '').replace(/\|/g, '/').replace(/\n/g, ' ');
const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map(r => `| ${r.map(cell).join(' | ')} |`)].join('\n');

export function renderMarkdown({ rows, schedule, localOnly = [], now = new Date() }) {
  const by = g => rows.filter(r => r.group === g).sort((a, b) => b.downloads - a.downloads);
  const A = by('A'), B = by('B'), RP = by('RP'), J = by('Java');
  const total = A.reduce((n, r) => n + r.ready, 0);
  const lastPlanned = schedule.at(-1);
  const out = [
    `# Bestand Yubi_Mods (Stand ${de(now)})`,
    '',
    `${rows.length} Projekte auf CurseForge: ${rows.filter(r => r.kind === 'Skinpack').length} Skinpacks, ${RP.length} Resource Packs, ${J.length} Java.`,
    `Vorbereitete Updates: **${total}** in ${A.length} Skinpacks${lastPlanned ? `, reichen bei einem Update pro Abend bis etwa ${de(lastPlanned.date)}` : ''}.`,
    '',
    '## A) Updates vorbereitet',
    table(['Projekt', 'Downloads', 'Letzter Upload', 'Bereit', 'Nächster Schritt', 'Hinweis'],
      A.map(r => [r.name, r.downloads, r.lastUpload ? `${de(r.lastUpload)} (vor ${r.daysSince} T.)` : '–', r.readyVersions.length ? `${r.ready}: V${r.readyVersions.join(', V')}` : `${r.ready} (geschätzt)`, r.next, r.note])),
    '',
    '## B) Skinpacks ohne Vorrat',
    'Sortiert nach Downloads. Hier helfen nur neue Skins (wie bei den Knights: Claude zeichnet, du gibst frei).',
    table(['Projekt', 'Downloads', 'Letzter Upload', 'Lokaler Ordner', 'Nächster Schritt', 'Hinweis'],
      B.map(r => [r.name, r.downloads, r.lastUpload ? de(r.lastUpload) : '–', r.folder || '–', r.next, r.note])),
    '',
    '## Resource Packs',
    table(['Projekt', 'Downloads', 'Letzter Upload', 'Hinweis'], RP.map(r => [r.name, r.downloads, r.lastUpload ? de(r.lastUpload) : '–', r.note])),
    '',
    '## Java-Mods',
    table(['Projekt', 'Downloads', 'Letzter Upload', 'Hinweis'], J.map(r => [r.name, r.downloads, r.lastUpload ? de(r.lastUpload) : '–', r.note])),
    '',
    '## C) Lokal vorhanden, nicht auf CurseForge',
    'Mögliche neue Projekte. Neue Projekte brauchen dein Go im Studio.',
    localOnly.length ? table(['Ordner', 'Stufen mit Skins', 'Skins (V1)'], localOnly.map(l => [l.folder, l.stages.filter(s => s.skins).map(s => s.stage).join(', ') || '–', l.stages.find(s => s.stage === 'V1')?.skins ?? '–'])) : '–',
    '',
    `## Fahrplan der nächsten Abende (${schedule.length} Updates)`,
    'Simuliert mit einem Update pro Abend und im Schnitt 23,5 Tagen Abstand je Projekt. Die echten Termine streuen um 22–25 Tage.',
    table(['Abend', 'Projekt', 'Version'], schedule.map(s => [de(s.date), s.name, `V${s.version}`]))
  ];
  return out.join('\n') + '\n';
}

export function toCsv(rows) {
  const head = ['id', 'name', 'kind', 'group', 'downloads', 'files', 'last_upload', 'days_since', 'ready', 'ready_versions', 'imported', 'folder', 'next', 'note'];
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [head.join(';'), ...rows.map(r => [r.id, r.name, r.kind, r.group, r.downloads, r.files, r.lastUpload, r.daysSince, r.ready, r.readyVersions.join(' '), r.imported, r.folder, r.next, r.note].map(q).join(';'))].join('\n') + '\n';
}
