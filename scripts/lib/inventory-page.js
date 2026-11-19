// HTML version of the stock overview (npm run bestand → Output/bestand/bestand.html). Written as an
// artifact page body: <title> + <style> + content, no <html>/<head> (the publisher adds the skeleton,
// a browser renders it as is). Pure: takes the rows from lib/inventory.js.

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const de = iso => { const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${d}.${m}.${y}`; };
const short = iso => { const [, m, d] = String(iso).slice(0, 10).split('-'); return `${d}.${m}.`; };
const num = n => Number(n || 0).toLocaleString('de-DE');
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

// Why a pack without stock has none: three cases with their own chip.
function reason(r) {
  if (/kein lokaler Ordner/.test(r.next)) return ['none', 'kein Ordner'];
  if (/U-Ordner leer/.test(r.next)) return ['empty', 'U-Ordner leer'];
  return ['done', 'alles oben'];
}

export function renderPage({ rows, schedule, localOnly = [], decisions = [], now = new Date() }) {
  const A = rows.filter(r => r.group === 'A').sort((a, b) => b.downloads - a.downloads);
  const B = rows.filter(r => r.group === 'B').sort((a, b) => b.downloads - a.downloads);
  const RP = rows.filter(r => r.group === 'RP').sort((a, b) => b.downloads - a.downloads);
  const J = rows.filter(r => r.group === 'Java');
  const ready = A.reduce((n, r) => n + r.ready, 0);
  const firstDate = {};
  const planned = {};
  for (const s of schedule) { const k = s.name; (planned[k] ||= []).push(s); firstDate[k] ||= s.date; }
  const last = schedule.at(-1);
  const today = now.toISOString().slice(0, 10);

  const tiles = [
    [num(rows.length), 'Projekte auf CurseForge', `${rows.filter(r => r.kind === 'Skinpack').length} Skinpacks · ${RP.length} Resource Packs · ${J.length} Java`],
    [num(ready), 'Updates vorbereitet', `in ${A.length} Skinpacks`],
    [last ? de(last.date) : '–', 'Vorrat reicht bis', 'bei einem Update pro Abend'],
    [num(B.length), 'Skinpacks ohne Vorrat', 'brauchen neue Skins']
  ].map(([v, l, s]) => `<div class="tile"><div class="tv">${esc(v)}</div><div class="tl">${esc(l)}</div><div class="ts">${esc(s)}</div></div>`).join('');

  const decide = decisions.length ? `<section class="decide" aria-labelledby="h-decide">
  <h2 id="h-decide">Offen bei dir</h2>
  <ol>${decisions.map(d => `<li><b>${esc(d.title)}</b> ${esc(d.text)}</li>`).join('')}</ol>
</section>` : '';

  const packCards = A.map(r => {
    const plan = planned[r.name] || [];
    const chips = r.readyVersions.length
      ? r.readyVersions.map(v => { const p = plan.find(x => x.version === v); return `<span class="chip${p?.date === today ? ' now' : ''}" title="${p ? `geplant ${de(p.date)}` : 'nicht im Fahrplan'}">V${esc(v)}<small>${p ? short(p.date) : '–'}</small></span>`; }).join('')
      : `<span class="chip">${r.ready} geschätzt</span>`;
    return `<article class="pack">
  <header><h3>${esc(r.name)}</h3><span class="dl">${num(r.downloads)} Downloads</span></header>
  <p class="meta">Zuletzt hochgeladen ${r.lastUpload ? `${de(r.lastUpload)} <span class="muted">(vor ${r.daysSince} Tagen)</span>` : '–'} · ${r.files} Datei${r.files === 1 ? '' : 'en'} oben</p>
  <div class="chips" aria-label="Vorbereitete Versionen mit geplantem Abend">${chips}</div>
  ${r.note ? `<p class="note">${esc(r.note)}</p>` : ''}
</article>`;
  }).join('\n');

  const months = [];
  for (const s of schedule) {
    const key = s.date.slice(0, 7);
    let m = months.at(-1);
    if (!m || m.key !== key) months.push(m = { key, label: `${MONTHS[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`, items: [] });
    m.items.push(s);
  }
  const timeline = months.map(m => `<div class="month"><h3>${esc(m.label)} <span class="muted">${m.items.length}</span></h3><ul>${m.items.map(s =>
    `<li${s.date === today ? ' class="today"' : ''}><time datetime="${s.date}">${short(s.date)}</time><span>${esc(s.name)}</span><b>V${esc(s.version)}</b></li>`).join('')}</ul></div>`).join('');

  const bRows = B.map(r => { const [cls, label] = reason(r); return `<tr><td>${esc(r.name)}</td><td class="n">${num(r.downloads)}</td><td>${r.lastUpload ? de(r.lastUpload) : '–'}</td><td><span class="pill ${cls}">${label}</span></td><td class="muted">${esc(r.note)}</td></tr>`; }).join('');
  const smallRows = list => list.map(r => `<tr><td>${esc(r.name)}</td><td class="n">${num(r.downloads)}</td><td>${r.lastUpload ? de(r.lastUpload) : '–'}</td><td class="muted">${esc(r.note.replace(/^Resource Pack,?\s*/, ''))}</td></tr>`).join('');
  const cRows = localOnly.map(l => `<tr><td>${esc(l.folder)}</td><td>${esc(l.stages.filter(s => s.skins).map(s => s.stage).join(', ') || '–')}</td><td class="n">${esc(l.stages.find(s => s.stage === 'V1')?.skins ?? '–')}</td></tr>`).join('');

  return `<title>Bestand Yubi_Mods</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=IBM+Plex+Sans:wght@400;600&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
/* Layout: summary first, then what needs you, then the packs that run on their own, the calendar, and the rest. */
:root{
  --bg:#f2f4f1; --surface:#ffffff; --ink:#1c2420; --muted:#5e6a64; --line:#d9dfda;
  --accent:#2f7d5b; --accent-soft:#e1efe7; --warn:#a2650c; --warn-soft:#f8ecd8; --stop:#b2453a; --stop-soft:#f7e3e0;
  --display:'Space Grotesk',ui-sans-serif,system-ui,sans-serif; --body:'IBM Plex Sans',ui-sans-serif,system-ui,sans-serif; --mono:'IBM Plex Mono',ui-monospace,Menlo,monospace;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --bg:#141916; --surface:#1d2420; --ink:#e6ece8; --muted:#9aa8a0; --line:#2f3833;
  --accent:#6cc497; --accent-soft:#1f3529; --warn:#e2a64a; --warn-soft:#3a2d17; --stop:#e48a7f; --stop-soft:#3d2320; color-scheme:dark}}
:root[data-theme="dark"]{
  --bg:#141916; --surface:#1d2420; --ink:#e6ece8; --muted:#9aa8a0; --line:#2f3833;
  --accent:#6cc497; --accent-soft:#1f3529; --warn:#e2a64a; --warn-soft:#3a2d17; --stop:#e48a7f; --stop-soft:#3d2320; color-scheme:dark}
body{background:var(--bg);color:var(--ink);font:15px/1.55 var(--body)}
.wrap{max-width:1080px;margin:0 auto;padding-block:24px 56px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));display:grid;grid-template-columns:minmax(0,1fr);gap:36px}
.wrap>*{min-width:0}
h1,h2,h3{font-family:var(--display);text-wrap:balance;margin:0}
h1{font-size:30px;letter-spacing:-.01em}
h2{font-size:20px;display:flex;align-items:baseline;gap:10px}
h2 small{font:400 13px var(--body);color:var(--muted)}
h3{font-size:16px}
.muted{color:var(--muted)}
.lead{color:var(--muted);margin:4px 0 0}
.n,time,.chip,.tv,.dl{font-variant-numeric:tabular-nums}
.tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.tile{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:14px 16px}
.tv{font:700 28px var(--display)}
.tl{font-weight:600;margin-top:2px}
.ts{color:var(--muted);font-size:13px}
.decide{background:var(--warn-soft);border:1px solid var(--warn);border-radius:8px;padding:16px 18px}
.decide h2{color:var(--warn)}
.decide ol{margin:10px 0 0;padding-left:20px;display:grid;gap:6px}
.packs{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
.pack{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:14px 16px;display:grid;gap:8px;align-content:start;min-width:0}
.pack header{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap}
.dl{font-size:13px;color:var(--muted);white-space:nowrap}
.meta{margin:0;font-size:13px}
.note{margin:0;font-size:13px;color:var(--warn);background:var(--warn-soft);border-radius:6px;padding:6px 9px}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{display:inline-flex;flex-direction:column;align-items:center;font:500 13px var(--mono);background:var(--accent-soft);color:var(--accent);border-radius:6px;padding:4px 9px;line-height:1.25}
.chip small{font:400 11px var(--body);color:var(--muted)}
.chip.now{background:var(--accent);color:var(--surface)}
.chip.now small{color:var(--surface)}
.calendar{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}
.month{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:12px 14px;min-width:0}
.month h3{display:flex;justify-content:space-between;margin-bottom:6px}
.month ul{list-style:none;margin:0;padding:0;display:grid;gap:2px}
.month li{display:grid;grid-template-columns:52px minmax(0,1fr) auto;gap:8px;font-size:13.5px;padding:2px 4px;border-radius:4px}
.month li span{overflow-wrap:anywhere}
.month li b{font:500 12.5px var(--mono);color:var(--accent)}
.month li.today{background:var(--accent-soft)}
time{color:var(--muted);font-family:var(--mono);font-size:12.5px}
.tablebox{overflow-x:auto;background:var(--surface);border:1px solid var(--line);border-radius:8px}
table{border-collapse:collapse;width:100%;font-size:14px}
th,td{text-align:left;padding:8px 12px;border-bottom:1px solid var(--line);vertical-align:top}
th{font:600 12px var(--body);text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
tr:last-child td{border-bottom:0}
td.n,th.n{text-align:right}
td.muted{font-size:13px}
.pill{display:inline-block;font-size:12px;font-weight:600;border-radius:999px;padding:2px 9px;white-space:nowrap}
.pill.done{background:var(--accent-soft);color:var(--accent)}
.pill.empty{background:var(--warn-soft);color:var(--warn)}
.pill.none{background:var(--stop-soft);color:var(--stop)}
.split{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:start}
.split>div{display:grid;gap:10px;align-content:start;min-width:0}
footer{color:var(--muted);font-size:13px}
@media (max-width:760px){.tiles{grid-template-columns:repeat(2,minmax(0,1fr))}.split{grid-template-columns:1fr}}
</style>
<div class="wrap">
<header>
  <h1>Bestand Yubi_Mods</h1>
  <p class="lead">Stand ${de(today)} · alle CurseForge-Projekte gegen deine Ordner unter Alles/MCPE</p>
</header>

<div class="tiles">${tiles}</div>

${decide}

<section aria-labelledby="h-a">
  <h2 id="h-a">Laufen automatisch <small>${A.length} Skinpacks · ${ready} Updates · jedes Kästchen = eine Version mit geplantem Abend</small></h2>
  <div class="packs">${packCards}</div>
</section>

<section aria-labelledby="h-cal">
  <h2 id="h-cal">Fahrplan <small>ein Update pro Abend, pro Projekt im Schnitt alle 23,5 Tage (echt: 22–25)</small></h2>
  <div class="calendar">${timeline}</div>
</section>

<section aria-labelledby="h-b">
  <h2 id="h-b">Ohne Vorrat <small>${B.length} Skinpacks, nach Downloads · hier helfen nur neue Skins</small></h2>
  <div class="tablebox"><table>
    <thead><tr><th>Projekt</th><th class="n">Downloads</th><th>Letzter Upload</th><th>Grund</th><th>Hinweis</th></tr></thead>
    <tbody>${bRows}</tbody>
  </table></div>
</section>

<div class="split">
  <div>
    <h2>Resource Packs <small>Updates nur von Hand</small></h2>
    <div class="tablebox"><table><thead><tr><th>Projekt</th><th class="n">Downloads</th><th>Zuletzt</th><th>Hinweis</th></tr></thead><tbody>${smallRows(RP)}</tbody></table></div>
    <h2>Java-Mods</h2>
    <div class="tablebox"><table><thead><tr><th>Projekt</th><th class="n">Downloads</th><th>Zuletzt</th><th>Hinweis</th></tr></thead><tbody>${smallRows(J)}</tbody></table></div>
  </div>
  <div>
    <h2>Lokal, nicht auf CurseForge <small>mögliche neue Projekte, brauchen dein Go</small></h2>
    <div class="tablebox"><table><thead><tr><th>Ordner</th><th>Stufen mit Skins</th><th class="n">Skins V1</th></tr></thead><tbody>${cRows}</tbody></table></div>
  </div>
</div>

<footer>Erzeugt mit <code>npm run bestand</code>. Die Termine sind simuliert; der Abend-Lauf entscheidet jeden Abend neu und lädt nur hoch, was fällig ist.</footer>
</div>
`;
}
