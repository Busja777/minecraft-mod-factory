// The weekly trend radar, pure parts: which new projects of a game and class grow fastest, and
// which categories they are in. scripts/trends.js fetches; this ranks.

// What the series watches: per row the CurseForge game and the classes its projects belong to.
export const WATCH = [
  { reihe: 'wow', gameId: 1, classes: [{ id: 1, name: 'Addons' }] },
  { reihe: 'java', gameId: 432, classes: [{ id: 6945, name: 'Data Packs' }, { id: 12, name: 'Resource Packs' }, { id: 6, name: 'Mods' }] },
  { reihe: 'bedrock', gameId: 78022, classes: [{ id: 4984, name: 'Addons' }] },
  { reihe: 'stardew', gameId: 669, classes: [{ id: 4643, name: 'Mods' }] }
];

const DAY = 24 * 60 * 60 * 1000;

// Downloads per day since the project was created (at least one day, so a project of a few hours
// does not top the list with a handful of downloads).
export function perDay(mod, now = new Date()) {
  const created = new Date(mod.dateCreated || mod.dateReleased);
  const days = Math.max(1, (now - created) / DAY);
  return mod.downloadCount / days;
}

// mods: the newest projects of one class. → { top: [...], categories: [...] } for projects created in
// the last `days` days, ranked by downloads per day. Our own projects are left out (`ownAuthors`).
export function rank(mods, { now = new Date(), days = 30, top = 15, ownAuthors = [] } = {}) {
  const since = now.getTime() - days * DAY;
  const own = new Set(ownAuthors.map(a => a.toLowerCase()));
  const fresh = mods
    .filter(m => new Date(m.dateCreated || m.dateReleased).getTime() >= since)
    .filter(m => !(m.authors || []).some(a => own.has(String(a.name).toLowerCase())))
    .map(m => ({
      name: m.name,
      slug: m.slug,
      created: String(m.dateCreated || m.dateReleased).slice(0, 10),
      downloads: m.downloadCount,
      perDay: Math.round(perDay(m, now) * 10) / 10,
      categories: (m.categories || []).map(c => c.name).sort()
    }))
    .sort((a, b) => b.perDay - a.perDay || a.name.localeCompare(b.name));
  const byCategory = new Map();
  for (const m of fresh) {
    for (const c of m.categories) {
      const e = byCategory.get(c) || { name: c, projects: 0, perDay: 0 };
      e.projects++;
      e.perDay += m.perDay;
      byCategory.set(c, e);
    }
  }
  const categories = [...byCategory.values()].map(e => ({ ...e, perDay: Math.round(e.perDay * 10) / 10 })).sort((a, b) => b.perDay - a.perDay || a.name.localeCompare(b.name));
  return { newProjects: fresh.length, top: fresh.slice(0, top), categories: categories.slice(0, 10) };
}

// Words that show up in many of the fastest names (for example "Forever" after WoW Forever's
// launch): a hint at what players look for right now. → [{ word, count }]
export function hotWords(top, { min = 3 } = {}) {
  const stop = new Set(['the', 'a', 'of', 'and', 'for', 'to', 'in', 'on', 'with', 'my', 'your', 'mod', 'mods', 'addon', 'addons', 'pack', 'plus']);
  const counts = new Map();
  for (const m of top) {
    for (const w of new Set(m.name.toLowerCase().match(/[a-z][a-z']{2,}/g) || [])) if (!stop.has(w)) counts.set(w, (counts.get(w) || 0) + 1);
  }
  return [...counts].filter(([, n]) => n >= min).map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}
