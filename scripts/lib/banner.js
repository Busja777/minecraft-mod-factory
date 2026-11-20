import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { assertNotFlat, fitUnderLimit } from './images.js';
import { BANNER_SIZE } from './page-check.js';

// The banner (720×340) of a series project comes from two sides that compete: Claude renders one
// from the project's logo and texts (tools/serie/cover.js), ChatGPT paints one in the operator's own
// window from a fixed brief. This module writes that brief (Output/chatgpt-bilder/), imports what
// ChatGPT painted, and builds the page that shows both side by side.

export const CHATGPT_ROOT = './Output/chatgpt-bilder';
export const CHATGPT_FILE = /^chatgpt-banner\.(png|jpe?g|webp)$/i;

// What ChatGPT is told about the look of each row; it matches the logos of the row.
export const STYLES = {
  wow: 'Hand-painted high fantasy, warm gold and amber light, deep dark brown shadows, rich saturated colours, painterly texture, cosy tavern-and-adventure mood.',
  java: 'Blocky voxel world with crisp pixel edges, bright saturated colours, soft glow and a calm dark green night sky, playful and clean.',
  stardew: 'Cosy pixel art in a warm farm palette, chunky pixels with soft outlines, sunny golden afternoon light, gentle and friendly.',
  sims4: 'Clean glossy 3D illustration, soft studio light, friendly rounded shapes, fresh pastel mint and sky colours, bright and cheerful.'
};

const GAME = { wow: 'World of Warcraft', java: 'Minecraft: Java Edition', stardew: 'Stardew Valley', sims4: 'The Sims 4' };
const KIND = { wow: 'addon', stardew: 'mod', sims4: 'mod' };
const JAVA_KIND = { D: 'data pack', R: 'resource pack', DR: 'data pack', M: 'mod' };
const FORBIDDEN = 'game logos or title lettering (World of Warcraft, Minecraft, Stardew Valley, The Sims), official characters or creatures from these games, brand names or marks (Blizzard, Mojang, Microsoft, ConcernedApe, EA, Maxis, CurseForge), screenshots of the game interface, and anything the project does not actually do';

export const chatgptDir = (reiheKey, project, root = CHATGPT_ROOT) => path.join(root, `${reiheKey}-${String(project.nr).padStart(2, '0')}-${project.slug}`);

export function kindOf(reiheKey, project) {
  return reiheKey === 'java' ? JAVA_KIND[project.art] || 'mod' : KIND[reiheKey] || 'mod';
}

// The text the operator pastes into ChatGPT, together with the logo.
export function chatgptPrompt(reiheKey, project, page) {
  const [w, h] = BANNER_SIZE;
  return [
    `Create a wide banner image for "${page.name}", a ${GAME[reiheKey]} ${kindOf(reiheKey, project)}.`,
    '',
    `What it does: ${page.summary}`,
    '',
    `The attached image is the project's logo (${page.logoPrompt.replace(/\.$/, '')}). Build the banner around that motif so logo and banner clearly belong together. You may show it larger, in a scene, or from a new angle, but keep it recognisable.`,
    '',
    `Style: ${STYLES[reiheKey]}`,
    '',
    `Text in the image, in English and spelled exactly like this, nothing else:`,
    `- the title "${page.name}", large and easy to read`,
    `- the line "${page.cover.tagline}", smaller, below the title`,
    '',
    `Format: landscape, 1536 × 1024. It will be cut to ${w} × ${h}: the top and bottom 150 pixels are removed. Keep the title, the line and the main motif inside the middle band, with some air to its edges.`,
    '',
    `Do not show: ${FORBIDDEN}.`
  ].join('\n');
}

export function styleGuide() {
  const [w, h] = BANNER_SIZE;
  return [
    '# Banner brief for ChatGPT',
    '',
    `Every project of the series gets a wide banner of ${w} × ${h} pixels for its CurseForge page. You paint it from the project's logo; it competes with a designed banner, and the better one is used.`,
    '',
    '## For every banner',
    '',
    '- Landscape 1536 × 1024. The top and bottom 150 pixels are cut away, so everything that matters sits in the middle band.',
    '- The logo of the project is attached. The banner continues its motif, colours and lighting, so both read as one product.',
    '- Text: only the project title and its one short line, in English, spelled exactly as given. Large, high contrast, readable when the banner is shown small.',
    '- One clear focal point, calm background, no clutter, no frames or borders, no watermark.',
    `- Never show ${FORBIDDEN}.`,
    '',
    '## Look per game (the series of each game shares one look)',
    '',
    ...Object.entries(STYLES).map(([k, v]) => `- **${GAME[k]}:** ${v}`),
    ''
  ].join('\n');
}

export function readme(entries) {
  return [
    '# Banner von ChatGPT',
    '',
    'Hier liegt für jedes Projekt ein Auftrag an ChatGPT. Das Banner von ChatGPT tritt gegen mein Banner an, und du entscheidest, welches auf die Seite kommt.',
    '',
    '## So geht es, pro Projekt',
    '',
    '1. In ChatGPT ein neues Gespräch öffnen.',
    '2. Die `logo.png` aus dem Projektordner anhängen.',
    '3. Den ganzen Text aus `auftrag.md` einfügen und abschicken. Beim ersten Bild des Tages zusätzlich `STIL.md` mitgeben.',
    '4. Gefällt dir das Bild, speichere es im selben Projektordner als `chatgpt-banner.png` (jpg oder webp gehen auch). Sonst ChatGPT um eine neue Fassung bitten.',
    '5. Wenn alle fertig sind: „Go Banner“ an mich. Ich schneide die Bilder auf 720 × 340 zu, prüfe sie und zeige dir beide Banner nebeneinander. Du sagst pro Projekt „Claude“ oder „ChatGPT“.',
    '',
    'Ein Projekt ohne ChatGPT-Bild bekommt mein Banner, wenn du es so wählst.',
    '',
    '## Offene Aufträge',
    '',
    ...entries.map(e => `- \`${path.basename(e.dir)}/\` ${e.name}${e.done ? ' (ChatGPT-Bild liegt schon da)' : ''}`),
    ''
  ].join('\n');
}

// Writes STIL.md, LIES-MICH.md and one folder per project with auftrag.md and logo.png.
// entries: [{ reiheKey, project, page, logo (path) }] → [{ dir, name, done }]
export function writeChatgptFolder(entries, root = CHATGPT_ROOT) {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'STIL.md'), styleGuide());
  const written = [];
  for (const { reiheKey, project, page, logo } of entries) {
    const dir = chatgptDir(reiheKey, project, root);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'auftrag.md'), chatgptPrompt(reiheKey, project, page) + '\n');
    fs.copyFileSync(logo, path.join(dir, 'logo.png'));
    written.push({ dir, name: page.name, done: !!findChatgptBanner(dir) });
  }
  fs.writeFileSync(path.join(root, 'LIES-MICH.md'), readme(written));
  return written;
}

export function findChatgptBanner(dir) {
  if (!fs.existsSync(dir)) return null;
  const f = fs.readdirSync(dir).find(n => CHATGPT_FILE.test(n));
  return f ? path.join(dir, f) : null;
}

// Any picture ChatGPT made → exactly 720×340 PNG, cut from the middle as the brief says.
export async function cropBanner(buf) {
  const [w, h] = BANNER_SIZE;
  const meta = await sharp(buf).metadata();
  if (!meta.width || meta.width < w || meta.height < h) throw new Error(`Bild ist ${meta.width}×${meta.height}, mindestens ${w}×${h} nötig`);
  const out = await fitUnderLimit(await sharp(buf).resize(w, h, { fit: 'cover', position: 'centre' }).png().toBuffer());
  await assertNotFlat(out);
  return out;
}

const dataUri = async file => `data:image/jpeg;base64,${(await sharp(file).jpeg({ quality: 88 }).toBuffer()).toString('base64')}`;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// rows: [{ title, reihe, name, claude (path), chatgpt (path | null), problem }] → HTML page
export async function comparisonHtml(rows) {
  const items = [];
  for (const r of rows) {
    const cell = async (who, file, note) => `<figure><figcaption>${who}</figcaption>${file ? `<img alt="${esc(`${who}: ${r.name}`)}" src="${await dataUri(file)}">` : `<div class="none">${esc(note)}</div>`}</figure>`;
    items.push(`<section><h2>${esc(r.name)} <small>${esc(r.title)}</small></h2><div class="pair">${await cell('Claude', r.claude, 'fehlt')}${await cell('ChatGPT', r.chatgpt, r.problem || 'noch kein Bild im Ordner')}</div></section>`);
  }
  return `<title>Banner-Vergleich</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* Layout: one section per project, the two banners side by side, stacked on phones. */
:root{--bg:#f3f2f6;--panel:#fff;--fg:#1e1c25;--muted:#66626f;--line:#e0dde8;--accent:#5b4bd6}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#16151b;--panel:#211f28;--fg:#efedf5;--muted:#a7a2b6;--line:#34313f;--accent:#a49bff;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#16151b;--panel:#211f28;--fg:#efedf5;--muted:#a7a2b6;--line:#34313f;--accent:#a49bff;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,sans-serif;padding-block:28px 48px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
main{max-width:1520px;margin:0 auto;display:grid;gap:28px}
h1{font-size:26px;margin:0}
p{margin:0;color:var(--muted)}
section{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;display:grid;gap:12px}
h2{font-size:19px;margin:0;display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
h2 small{font-size:13px;color:var(--muted);font-weight:500}
.pair{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:16px}
figure{margin:0;display:grid;gap:6px;min-width:0}
figcaption{font-weight:600;color:var(--accent)}
img{width:100%;max-width:720px;aspect-ratio:720/340;border-radius:6px;border:1px solid var(--line)}
.none{aspect-ratio:720/340;max-width:720px;display:grid;place-items:center;border:1px dashed var(--line);border-radius:6px;color:var(--muted);padding:12px;text-align:center}
</style>
<main>
<h1>Banner-Vergleich</h1>
<p>Beide Banner in der echten Größe von 720 × 340. Sag mir pro Projekt „Claude“ oder „ChatGPT“.</p>
${items.join('\n')}
</main>`;
}
