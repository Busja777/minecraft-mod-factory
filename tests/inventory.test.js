import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { classify, simulateSchedule, renderMarkdown, toCsv } from '../scripts/lib/inventory.js';
import { renderPage } from '../scripts/lib/inventory-page.js';

const now = new Date('2026-11-19T18:00:00Z');
const skin = (id, name, downloads = 100) => ({ id, name, classId: 6925, gameId: 78022, downloadCount: downloads });
const file = (fileName, fileDate) => ({ fileName, fileDate });
const pack = (slug, versions) => ({ slug, name: slug, cfProjectId: 1, versions: versions.map(([version, status]) => ({ version, status, skins: [] })) });

test('classify: imported packs with due versions run automatically, the rest needs new skins', () => {
  const p = pack('arabic', [['1.0', 'published'], ['1.1', 'due'], ['1.2', 'due']]);
  const entry = { modId: 'arabic', status: 'published', projectId: 1, lastPublishedAt: '2026-04-12T00:00:00Z', nextUpdateDue: '2026-05-06T00:00:00Z' };
  const a = classify({ project: skin(1, 'Arabic Knights'), files: [file('A.mcpack', '2026-04-12T10:00:00Z')], pack: p, entry, now });
  assert.equal(a.group, 'A');
  assert.deepEqual([a.ready, a.readyVersions, a.daysSince], [2, ['1.1', '1.2'], 221]);
  assert.match(a.next, /läuft automatisch: V1\.1 ist fällig/);

  const soon = classify({ project: skin(1, 'X'), files: [], pack: p, entry: { ...entry, lastPublishedAt: '2026-11-01T00:00:00Z', nextUpdateDue: '2026-11-26T01:00:00Z' }, now });
  assert.match(soon.next, /ab 26\.11\.2026/);

  const estimated = classify({ project: skin(2, 'Not imported'), files: [file('a', '2026-04-01')], stages: [{ stage: 'V1', skins: 3 }, { stage: 'U1', skins: 5 }, { stage: 'U2', skins: 7 }], now });
  assert.deepEqual([estimated.group, estimated.ready], ['A', 2]);
  assert.match(estimated.next, /importieren/);

  const override = classify({ project: skin(3, 'Crusaders'), files: [file('a', '2026-04-01'), file('b', '2026-04-28')], stages: [{ stage: 'V1', skins: 2 }, { stage: 'U1', skins: 5 }, { stage: 'U2', skins: 8 }], map: { folder: 'MCPE/Crusaders Pack', ready: 0 }, now });
  assert.deepEqual([override.group, override.ready], ['B', 0], 'map.ready wins over the estimate');

  const empty = classify({ project: skin(4, 'Cyber'), files: [file('a', '2026-04-23')], stages: [{ stage: 'V1', skins: 10 }, { stage: 'U1', skins: 0 }, { stage: 'U2', skins: 0 }], map: { folder: 'MCPE/Cyber Runners' }, now });
  assert.match(empty.next, /U-Ordner leer \(U1, U2\)/);
  assert.match(classify({ project: skin(5, 'Demon'), map: { folder: null }, now }).next, /kein lokaler Ordner/);
});

test('classify: resource packs and Java mods are listed, never counted as prepared', () => {
  const rp = classify({ project: { id: 6, name: 'Fullbright', classId: 6929, gameId: 78022, downloadCount: 1 }, stages: [{ stage: 'V1', skins: 0 }, { stage: 'U1', skins: 3 }], now });
  assert.deepEqual([rp.kind, rp.group, rp.ready], ['Resource Pack', 'RP', 0]);
  const java = classify({ project: { id: 7, name: 'Frozen Spider', classId: 6, gameId: 432, downloadCount: 1 }, now });
  assert.deepEqual([java.kind, java.group], ['Java', 'Java']);
});

test('simulateSchedule: one upload per evening, earliest due first, then the project waits', () => {
  const entries = [
    { modId: 'old', kind: 'skinpack', status: 'published', projectId: 1, lastPublishedAt: '2026-03-28T00:00:00Z', nextUpdateDue: '2026-04-20T00:00:00Z' },
    { modId: 'mid', kind: 'skinpack', status: 'published', projectId: 2, lastPublishedAt: '2026-04-12T00:00:00Z', nextUpdateDue: '2026-05-06T00:00:00Z' },
    { modId: 'fresh', kind: 'skinpack', status: 'published', projectId: 3, lastPublishedAt: '2026-11-19T18:05:00Z', nextUpdateDue: '2026-12-14T00:00:00Z' },
    { modId: 'mod', kind: 'mod', status: 'published', projectId: 4, lastPublishedAt: '2026-01-01T00:00:00Z' }
  ];
  const packs = {
    old: pack('old', [['1.0', 'published'], ['1.1', 'due']]),
    mid: pack('mid', [['1.0', 'published'], ['1.1', 'due'], ['1.2', 'due']]),
    fresh: pack('fresh', [['1.0', 'published'], ['1.1', 'due']])
  };
  const plan = simulateSchedule({ entries, packs, now, evenings: 60, intervalDays: [22, 25] });
  assert.deepEqual(plan.slice(0, 2).map(p => `${p.date} ${p.modId} ${p.version}`), ['2026-11-19 old 1.1', '2026-11-20 mid 1.1']);
  assert.deepEqual(plan.map(p => p.modId), ['old', 'mid', 'fresh', 'mid']);
  assert.equal(new Set(plan.map(p => p.date)).size, plan.length, 'never two uploads on one evening');
  const mid2 = plan.find(p => p.modId === 'mid' && p.version === '1.2');
  assert.ok((Date.parse(mid2.date) - Date.parse('2026-11-20')) / 864e5 >= 22, 'at least 22 days between two updates of one project');
  assert.equal(entries[0].nextUpdateDue, '2026-04-20T00:00:00Z', 'the real entries are not touched');
});

test('markdown and CSV list every project with its next step', () => {
  const rows = [
    classify({ project: skin(1, 'Ready', 500), files: [file('a', '2026-04-01')], stages: [{ stage: 'V1', skins: 2 }, { stage: 'U1', skins: 3 }], now }),
    classify({ project: skin(2, 'Empty "Pack"', 900), files: [file('a', '2026-04-01')], map: { folder: null }, now })
  ];
  const md = renderMarkdown({ rows, schedule: [{ date: '2026-11-19', name: 'Ready', version: '1.1' }], localOnly: [{ folder: 'Ottoman Warriors', stages: [{ stage: 'V1', skins: 10 }, { stage: 'U1', skins: 12 }] }], now });
  assert.match(md, /Vorbereitete Updates: \*\*1\*\* in 1 Skinpacks, reichen bei einem Update pro Abend bis etwa 19\.11\.2026/);
  assert.match(md, /## B\) Skinpacks ohne Vorrat[\s\S]*Empty "Pack"/);
  assert.match(md, /\| Ottoman Warriors \| V1, U1 \| 10 \|/);
  const csv = toCsv(rows).trim().split('\n');
  assert.equal(csv.length, 3);
  assert.match(csv[2], /"Empty ""Pack"""/);
});

test('bestand.json names a folder (or null) for every project id and only known keys', () => {
  const map = JSON.parse(fs.readFileSync('./data/bestand.json', 'utf-8'));
  for (const [id, m] of Object.entries(map.projects)) {
    assert.match(id, /^\d{7}$/);
    assert.ok('folder' in m, id);
    for (const k of Object.keys(m)) assert.ok(['folder', 'note', 'ready'].includes(k), `${id}: ${k}`);
  }
  for (const d of map.decisions || []) assert.ok(d.title && d.text);
});

test('overview page: open decisions first, every pack with its planned evenings, names escaped', () => {
  const now = new Date('2026-11-19T18:00:00Z');
  const rows = [
    { ...classify({ project: skin(1, 'Black & White PVP', 9328), files: [file('a', '2026-04-14')], now }), group: 'A', ready: 2, readyVersions: ['1.1', '1.2'] },
    classify({ project: skin(2, '<Ninja>', 10681), files: [file('a', '2026-11-19')], map: { folder: 'MCPE/Glowing Ninja' }, now })
  ];
  const html = renderPage({ rows, schedule: [{ date: '2026-11-19', name: 'Black & White PVP', version: '1.1' }, { date: '2026-12-13', name: 'Black & White PVP', version: '1.2' }], decisions: [{ title: 'Merge', text: 'bitte' }], now });
  assert.match(html, /^<title>Bestand Yubi_Mods<\/title>/);
  assert.doesNotMatch(html, /<html|<body|<!doctype/i, 'the publisher adds the skeleton');
  assert.ok(html.indexOf('Offen bei dir') < html.indexOf('Laufen automatisch'));
  assert.match(html, /Black &amp; White PVP/);
  assert.match(html, /class="chip now"[^>]*>V1\.1<small>19\.11\.<\/small>/, 'tonight is highlighted');
  assert.match(html, /V1\.2<small>13\.12\.<\/small>/);
  assert.match(html, /&lt;Ninja&gt;[\s\S]*alles oben/);
  assert.match(html, /<h3>Dezember 2026/);
});
