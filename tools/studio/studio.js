// Minecraft Studio – Oberfläche (Vanilla-JS, keine Abhängigkeiten).
// Ansichten:  #/                      Übersicht in Abschnitten (wie Projekt A /admin/ueberpruefen)
//             #/pruefen/<art>/<key>   Prüf-Modus: jeder Teil mit „Ändern“, feste Leiste mit Go / An Claude zurückgeben
// Daten kommen vom lokalen Server (scripts/lib/studio-server.js).

const app = document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = iso => new Date(iso).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
const STATUS_TEXT = { 'zur-pruefung': 'wartet auf dein Go', ueberarbeiten: 'wartet auf Claude', geplant: 'eingeplant', faellig: 'jetzt fällig', veroeffentlicht: 'veröffentlicht' };

async function api(path, body) {
  const res = await fetch(path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`);
  return data;
}

// Bilder der Beschreibung zeigen auf raw.githubusercontent (erst nach dem Push online) → lokal ausliefern.
const localImg = url => url.replace(/^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\//, '/files/');

// Kleiner Markdown-Renderer für Beschreibung und Changelog (Überschriften, Absätze, Listen, fett/kursiv, Bilder, Links).
function markdown(src) {
  const inline = t => esc(t)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, url) => `<img src="${esc(localImg(url.replace(/&amp;/g, '&')))}" alt="${alt}" loading="lazy">`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, url) => (/^https?:\/\//i.test(url) ? `<a href="${url}" target="_blank" rel="noopener">${text}</a>` : text))
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  const out = [];
  for (const block of String(src || '').split(/\n{2,}/)) {
    const lines = block.split('\n');
    if (lines.every(l => /^\s*([-*]|\d+\.)\s+/.test(l))) {
      const tag = /^\s*\d+\./.test(lines[0]) ? 'ol' : 'ul';
      out.push(`<${tag}>${lines.map(l => `<li>${inline(l.replace(/^\s*([-*]|\d+\.)\s+/, ''))}</li>`).join('')}</${tag}>`);
      continue;
    }
    // Überschriften der Vorschau zwei Stufen tiefer, damit die Seite nur eine Hauptüberschrift hat.
    const h = /^(#{1,3})\s+(.*)$/.exec(lines[0]);
    const tag = h ? `h${Math.min(h[1].length + 2, 6)}` : '';
    if (h && lines.length === 1) { out.push(`<${tag}>${inline(h[2])}</${tag}>`); continue; }
    if (h) { out.push(`<${tag}>${inline(h[2])}</${tag}>`); lines.shift(); }
    // Absatz mit angehängter Aufzählung („New skins:\n- A\n- B“): Text als Absatz, Rest als Liste.
    const firstItem = lines.findIndex(l => /^\s*[-*]\s+/.test(l));
    if (firstItem > 0 && lines.slice(firstItem).every(l => /^\s*[-*]\s+/.test(l))) {
      out.push(`<p>${lines.slice(0, firstItem).map(inline).join('<br>')}</p>`);
      out.push(`<ul>${lines.slice(firstItem).map(l => `<li>${inline(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')}</ul>`);
      continue;
    }
    out.push(`<p>${lines.map(inline).join('<br>')}</p>`);
  }
  return out.join('\n');
}

// ---------- Übersicht ----------

function card(c, actions = '') {
  const meta = [STATUS_TEXT[c.status], c.kind === 'mod' ? 'Mod' : 'Skinpack', c.round > 1 ? `Runde ${c.round}` : '', c.notes ? `${c.notes} Notiz${c.notes === 1 ? '' : 'en'}` : '', c.slot ? fmt(c.slot) : ''].filter(Boolean).join(' · ');
  return `<div class="karte">
    ${c.logo ? `<img src="${esc(c.logo)}" alt="">` : '<img alt="">'}
    <div class="mitte"><div class="titel">${esc(c.name)}</div><div class="meta">${esc(meta)}</div></div>
    ${actions}
  </div>`;
}

const link = (c, text, cls = 'knopf') => `<a class="${cls}" href="#/pruefen/${c.kind}/${c.key}">${text}</a>`;

async function showOverview() {
  const o = await api('/api/overview');
  const section = (title, items, render, hint = '') => `<h2>${title} <span class="zahl">${items.length}</span></h2>${hint ? `<p class="hinweis">${hint}</p>` : ''}${items.length ? `<div class="karten">${items.map(render).join('')}</div>` : '<p class="leer">Nichts.</p>'}`;
  const nothing = !o.faellig.length && !o.go.length && !o.claude.length;
  app.innerHTML = `
    <h1>Überblick</h1>
    ${o.go.length ? `<p><a class="knopf primaer" href="#/pruefen/${o.go[0].kind}/${o.go[0].key}?reihe=1">Packs nacheinander prüfen (${o.go.length})</a></p>` : ''}
    ${nothing ? '<p class="leer">Zurzeit wartet nichts auf eine Entscheidung.</p>' : ''}
    ${o.faellig.length ? section('Jetzt fällig', o.faellig, c => card(c, `<button class="knopf primaer" data-publish="${c.kind}/${c.key}">Jetzt veröffentlichen</button>`), 'Der Termin ist erreicht. Chrome öffnet sich, du klickst nur Create, Apply und Add File.') : ''}
    ${section('Wartet auf dein Go', o.go, c => card(c, link(c, 'Prüfen', 'knopf primaer')))}
    ${section('Wartet auf Claude', o.claude, c => card(c, link(c, 'Ansehen')), 'Claude holt die Notizen mit <code>npm run notes</code> ab. Danach liegt das Pack wieder hier bei dir.')}
    ${section('Eingeplant', o.geplant, c => card(c, link(c, 'Ansehen')), 'Neue Projekte gehen morgens (06–12 Uhr) an Upload-Tagen raus, höchstens eins pro Tag. Zum Termin meldet sich dein Mac.')}
    <h2>Updates bestehender Projekte <span class="zahl">${o.updates.length}</span></h2>
    <p class="hinweis">Brauchen kein Go. 1 Update pro Abend zur Zufallszeit zwischen 18 und 21 Uhr, reihum, jedes Pack frühestens nach 23 Tagen.</p>
    ${o.updates.length ? `<div class="karten">${o.updates.map(u => `<div class="karte"><div class="mitte"><div class="titel">${esc(u.name)}</div><div class="meta">${esc(`aktuell V${u.version} · nächstes Update ab ${fmt(u.nextUpdateDue)}${u.waiting ? ` · V${u.waiting} wartet auf Upload` : ''}`)}</div></div></div>`).join('')}</div>` : '<p class="leer">Keine.</p>'}
    ${o.live.length ? section('Veröffentlicht', o.live, c => card(c)) : ''}
  `;
  app.querySelectorAll('[data-publish]').forEach(b => b.addEventListener('click', () => publish(...b.dataset.publish.split('/'), b)));
}

async function publish(kind, key, button) {
  button.disabled = true;
  try {
    await api(`/api/item/${kind}/${key}/publish`, {});
    button.textContent = 'Läuft im Terminal …';
  } catch (e) { alert(e.message); button.disabled = false; }
}

// ---------- Prüf-Modus ----------

let queue = null; // Reihenfolge beim „nacheinander prüfen“

function partView(item, p) {
  const editable = item.status === 'zur-pruefung';
  let body = '';
  if (p.type === 'text') body = `<div class="wert">${esc(p.value)}</div>`;
  if (p.type === 'image') body = `<img class="bild ${p.id === 'logo' ? 'logo' : ''}" src="${esc(p.src)}" alt="${esc(p.label)}">`;
  if (p.type === 'skin') body = `<img class="bild" src="${esc(p.src)}" alt="${esc(p.label)}"><img class="textur" src="${esc(p.texture)}" alt="Textur ${esc(p.label)}" title="Original-Textur 64×64">`;
  if (p.type === 'markdown') body = `<div class="md">${markdown(p.value)}</div>`;
  return `<section class="teil ${p.note ? 'markiert' : ''}" data-part="${esc(p.id)}">
    <div class="teil-kopf">
      <div class="teil-name">${esc(p.label)}${p.changed ? `<span class="abzeichen">neu seit Runde ${item.round}</span>` : ''}</div>
      ${editable && !p.note ? '<button class="knopf klein" data-aendern>Ändern</button>' : ''}
    </div>
    ${body}
    ${p.changed && p.lastNote ? `<div class="alt">Deine Notiz war: „${esc(p.lastNote)}“</div>` : ''}
    ${p.note ? `<div class="notiz"><strong>Für Claude:</strong> ${esc(p.note)}${editable ? ' <button class="knopf klein" data-zuruecknehmen>Zurücknehmen</button>' : ''}</div>` : ''}
    <div class="editor" hidden>
      <label>Was soll Claude ändern?<textarea maxlength="2000" placeholder="z. B. Hintergrund dunkler, Schrift größer, Skin 3 bekommt rote statt blaue Augen"></textarea></label>
      <div class="reihe"><button class="knopf primaer klein" data-speichern>Notiz speichern</button><button class="knopf klein" data-abbrechen>Abbrechen</button></div>
    </div>
  </section>`;
}

function goBlocker(item) {
  const open = item.parts.filter(p => p.note).length;
  const red = item.checks.filter(c => c.level === 'error');
  if (item.status !== 'zur-pruefung') return 'nicht im Status „wartet auf dein Go“';
  if (open) return `${open} Notiz${open === 1 ? '' : 'en'} offen – erst an Claude zurückgeben oder zurücknehmen`;
  if (red.length) return `Prüfung nicht bestanden: ${red.map(c => c.label).join(', ')}`;
  return '';
}

function bar(item) {
  const open = item.parts.filter(p => p.note).length;
  const pos = queue ? `Pack ${queue.indexOf(`${item.kind}/${item.key}`) + 1} von ${queue.length} · ` : '';
  let buttons = '';
  if (item.status === 'zur-pruefung') {
    const blocker = goBlocker(item);
    buttons = `<button class="knopf go" data-go ${blocker ? 'disabled' : ''}>Go – fertig</button>
      <button class="knopf" data-return ${open ? '' : 'disabled'}>An Claude zurückgeben${open ? ` (${open})` : ''}</button>
      ${queue ? '<button class="knopf" data-weiter>Überspringen</button>' : ''}
      <a class="knopf" href="#/">Beenden</a>
      ${blocker ? `<div class="grund">Go gesperrt: ${esc(blocker)}</div>` : ''}`;
  } else if (['geplant', 'faellig'].includes(item.status)) {
    buttons = `${item.status === 'faellig' ? '<button class="knopf primaer" data-publish>Jetzt veröffentlichen</button>' : ''}
      <button class="knopf" data-withdraw>Go zurücknehmen</button><a class="knopf" href="#/">Zurück</a>`;
  } else {
    buttons = `${queue ? '<button class="knopf" data-weiter>Weiter</button>' : ''}<a class="knopf" href="#/">Zurück</a>`;
  }
  return `<div class="leiste"><div class="innen"><span class="stand">${pos}${esc(item.name)} – ${esc(STATUS_TEXT[item.status])}${item.slot ? ` (${fmt(item.slot)})` : ''}</span>${buttons}</div></div>`;
}

async function showItem(kind, key, inQueue) {
  if (inQueue && !queue) {
    const o = await api('/api/overview');
    queue = o.go.map(c => `${c.kind}/${c.key}`);
  }
  if (!inQueue) queue = null;
  const item = await api(`/api/item/${kind}/${key}`);
  render(item);
}

function render(item, error = '') {
  const skins = item.parts.filter(p => p.type === 'skin');
  const others = item.parts.filter(p => p.type !== 'skin');
  const before = others.filter(p => ['name', 'summary', 'logo', 'cover'].includes(p.id));
  const after = others.filter(p => !before.includes(p));
  app.innerHTML = `
    <h1>${esc(item.name)}</h1>
    ${error ? `<div class="fehler">${esc(error)}</div>` : ''}
    <h2>Automatische Prüfungen</h2>
    <ul class="pruefungen">${item.checks.map(c => `<li class="${c.level}">${c.level === 'ok' ? '✓' : c.level === 'warn' ? '!' : '✗'} ${esc(c.label)}${c.detail ? ` – ${esc(c.detail)}` : ''}</li>`).join('')}</ul>
    ${item.threeD ? `<p><a class="knopf klein" href="${esc(item.threeD)}" target="_blank" rel="noopener">Skins in 3D ansehen</a></p>` : ''}
    <h2>Projekt</h2>${before.map(p => partView(item, p)).join('')}
    ${skins.length ? `<h2>Skins <span class="zahl">${skins.length}</span></h2><div class="skins">${skins.map(p => partView(item, p)).join('')}</div>` : ''}
    <h2>Texte & Datei</h2>${after.map(p => partView(item, p)).join('')}
    <h2>Verlauf</h2><ul class="verlauf">${item.history.slice().reverse().map(h => `<li>${esc(fmt(h.at))}: ${esc(h.event)}</li>`).join('')}</ul>
    ${bar(item)}`;
  wire(item);
}

function wire(item) {
  const base = `/api/item/${item.kind}/${item.key}`;
  const act = async (path, body = {}) => {
    app.querySelectorAll('button').forEach(b => { b.disabled = true; });
    try { const r = await api(`${base}/${path}`, body); render(r.item); return r; }
    catch (e) { render(item, e.message); return null; }
  };
  app.querySelectorAll('[data-part]').forEach(sec => {
    const part = sec.dataset.part;
    const editor = sec.querySelector('.editor');
    sec.querySelector('[data-aendern]')?.addEventListener('click', () => { editor.hidden = false; editor.querySelector('textarea').focus(); });
    sec.querySelector('[data-abbrechen]')?.addEventListener('click', () => { editor.hidden = true; });
    sec.querySelector('[data-speichern]')?.addEventListener('click', () => act('part', { part, note: editor.querySelector('textarea').value }));
    sec.querySelector('[data-zuruecknehmen]')?.addEventListener('click', () => act('part', { part, note: null }));
  });
  const next = () => {
    const i = queue.indexOf(`${item.kind}/${item.key}`);
    const n = queue[i + 1];
    location.hash = n ? `#/pruefen/${n}?reihe=1` : '#/';
  };
  app.querySelector('[data-go]')?.addEventListener('click', async () => { if (await act('go')) { if (queue) next(); } });
  app.querySelector('[data-return]')?.addEventListener('click', async () => { if (await act('return')) { if (queue) next(); } });
  app.querySelector('[data-weiter]')?.addEventListener('click', next);
  app.querySelector('[data-withdraw]')?.addEventListener('click', () => act('withdraw'));
  app.querySelector('[data-publish]')?.addEventListener('click', e => publish(item.kind, item.key, e.target));
}

// ---------- Router ----------

async function route() {
  const m = /^#\/pruefen\/(skinpack|mod)\/([a-z0-9-]+)(\?reihe=1)?$/.exec(location.hash);
  try {
    if (m) await showItem(m[1], m[2], !!m[3]);
    else { queue = null; await showOverview(); }
    window.scrollTo(0, 0);
  } catch (e) {
    app.innerHTML = `<div class="fehler">${esc(e.message)}</div><p><a href="#/">Zur Übersicht</a></p>`;
  }
}
window.addEventListener('hashchange', route);
route();
