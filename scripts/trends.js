import './lib/load-secrets.js';
// The weekly trend radar: which new projects grow fastest per game and class, read through
// CurseForge's read-only API (CF_CORE_API_KEY). Writes data/radar/trends.json; the nightly session
// takes ideas for free slots and the reserve from it (tools/serie/NACHT.md). No upload, no AI.
//
//   npm run trends                 read and write data/radar/trends.json
//   npm run trends -- --dry-run    print only
import fs from 'fs';
import { WATCH, rank, hotWords } from './lib/trends.js';

const argv = process.argv.slice(2);
const key = process.env.CF_CORE_API_KEY;
if (!key) { console.error('✗ CF_CORE_API_KEY fehlt.'); process.exit(1); }
const now = process.env.NOW ? new Date(process.env.NOW) : new Date();
const OUT = 'data/radar/trends.json';
// Our own author names on CurseForge, so the radar does not rank our projects.
const OWN = (process.env.CF_OWN_AUTHORS || 'SevEvolution,Busja777').split(',');

// The newest projects of a class: sorted by release date, pages of 50 until they are older than
// the window (at most 400 per class).
async function newest(gameId, classId, days) {
  const since = now.getTime() - days * 24 * 60 * 60 * 1000;
  const out = [];
  for (let index = 0; index < 400; index += 50) {
    const url = `https://api.curseforge.com/v1/mods/search?gameId=${gameId}&classId=${classId}&sortField=11&sortOrder=desc&pageSize=50&index=${index}`;
    const res = await fetch(url, { headers: { 'x-api-key': key, Accept: 'application/json' } });
    if (!res.ok) throw new Error(`${res.status} for game ${gameId}, class ${classId}`);
    const { data } = await res.json();
    out.push(...data);
    if (data.length < 50 || data.every(m => new Date(m.dateCreated || m.dateReleased).getTime() < since)) break;
  }
  return out;
}

const report = { checked: now.toISOString().slice(0, 10), window: '30 days', note: 'New projects per row and class, ranked by downloads per day since they were created. Ideas, not orders: a trend only becomes a project when it fits the series and is not a copy of someone else\'s project.', rows: {} };
for (const watch of WATCH) {
  report.rows[watch.reihe] = {};
  for (const cls of watch.classes) {
    try {
      const ranked = rank(await newest(watch.gameId, cls.id, 30), { now, ownAuthors: OWN });
      report.rows[watch.reihe][cls.name] = { ...ranked, hotWords: hotWords(ranked.top) };
      const best = ranked.top.slice(0, 3).map(m => `${m.name} (${m.perDay}/Tag)`).join(', ');
      console.log(`${watch.reihe} · ${cls.name}: ${ranked.newProjects} neue Projekte; vorn: ${best || '—'}; Kategorien: ${ranked.categories.slice(0, 3).map(c => c.name).join(', ') || '—'}`);
    } catch (e) {
      console.log(`! ${watch.reihe} · ${cls.name}: ${e.message}`);
    }
  }
}
if (argv.includes('--dry-run')) console.log('Probelauf: nichts geschrieben.');
else { fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n'); console.log(`✓ ${OUT}`); }
