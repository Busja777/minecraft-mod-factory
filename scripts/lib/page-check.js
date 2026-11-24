import fs from 'fs';
import sharp from 'sharp';
import { assertNotFlat, CF_MAX_IMAGE_BYTES } from './images.js';

// Checks the page of a series project before the operator creates it on CurseForge.
// Rules: CurseForge Moderation Policies (name in English without game, class or version; summary
// "like a tldr", one sentence, not copied from the description; avatar 400x400, not a solid colour;
// visual packs need a real in-game image) plus the house style: short, always the same four parts.
//   page:  { name, summary, category, description (Markdown), logoPrompt, cover: { tagline, bullets } }
//   files: { logo, cover, banner, shots: [paths] }
//   opts:  { maxWords, needsShot, needsBanner (false for rows without a banner, e.g. WoW),
//            bannerFrom: 'claude' | 'chatgpt' }  (chatgpt = painted by the image model → AI art too)
// → [{ id, level: 'ok'|'warn'|'error', label, detail }]

export const AI_LOGO_NOTE = '*(The logo is AI-generated.)*';
export const AI_LOGO_BANNER_NOTE = '*(The logo and banner are AI-generated.)*';
// The note a description ends with, depending on where the chosen banner comes from.
export const aiNote = bannerFrom => (bannerFrom === 'chatgpt' ? AI_LOGO_BANNER_NOTE : AI_LOGO_NOTE);
export const SECTIONS = ['Features', 'How to use', 'Good to know'];
export const COVER_SIZE = [1280, 720];
export const BANNER_SIZE = [720, 340];

const NAME_AVOID = /\b(minecraft|bedrock|java edition|world of warcraft|warcraft|wow|the sims|sims 4|stardew|addons?|mods?|plugins?|data ?packs?|resource ?packs?|texture ?packs?|content ?packs?|v?\d+\.\d+(\.\d+)?)\b/i;
const FILLER = /\b(adds items to the game|changes the vanilla game|must[- ]have|game[- ]changer|best .{0,20} ever|take your .{0,30} to the next level|look no further|unleash|elevate your|seamless(ly)? integrat)/i;

const res = (id, level, label, detail = '') => ({ id, level, label, detail });
const words = text => text.replace(/[#*`>|_-]/g, ' ').split(/\s+/).filter(Boolean);
const norm = s => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Markdown text under "## <title>" up to the next heading.
export function section(description, title) {
  const m = new RegExp(`^## ${title}\\s*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm').exec(description);
  return m ? m[1].trim() : null;
}

async function imageCheck(id, label, file, [w, h], { flat = false } = {}) {
  if (!file || !fs.existsSync(file)) return res(id, 'error', label, 'fehlt');
  const buf = fs.readFileSync(file);
  const meta = await sharp(buf).metadata();
  if (meta.format !== 'png') return res(id, 'error', label, `${meta.format} statt PNG`);
  if (buf.length >= CF_MAX_IMAGE_BYTES) return res(id, 'error', label, `${(buf.length / 1e6).toFixed(2)} MB – CurseForge erlaubt unter 2 MB`);
  if (meta.width !== w || meta.height !== h) return res(id, 'error', label, `${meta.width}×${meta.height} statt ${w}×${h} px`);
  if (flat) {
    try { await assertNotFlat(buf); } catch (e) { return res(id, 'error', label, 'sieht nach Flächenfarbe oder Verlauf aus'); }
  }
  return res(id, 'ok', label, `${w}×${h} px, ${(buf.length / 1000).toFixed(0)} KB`);
}

// Main category plus additional ones (page.additionalCategories, optional, at most MAX_EXTRA_CATEGORIES).
// categories: the CurseForge names of the game, if known (tools/<reihe>/categories.json).
export const MAX_EXTRA_CATEGORIES = 3;
export function categoryCheck(page, categories = null) {
  const main = String(page.category || '').trim();
  const extra = page.additionalCategories || [];
  if (!main) return res('category', 'error', 'Kategorie', 'fehlt');
  const problems = [];
  if (!Array.isArray(extra)) problems.push('additionalCategories muss eine Liste sein');
  else {
    if (extra.length > MAX_EXTRA_CATEGORIES) problems.push(`${extra.length} Zusatzkategorien (höchstens ${MAX_EXTRA_CATEGORIES}, nur was wirklich passt)`);
    if (extra.includes(main)) problems.push(`„${main}“ ist schon die Hauptkategorie`);
    if (new Set(extra).size !== extra.length) problems.push('doppelte Zusatzkategorie');
  }
  if (categories) for (const c of [main, ...(Array.isArray(extra) ? extra : [])]) if (!categories.includes(c)) problems.push(`„${c}“ gibt es auf CurseForge nicht`);
  if (problems.length) return res('category', 'error', 'Kategorie', problems.join('; '));
  return res('category', 'ok', 'Kategorie', Array.isArray(extra) && extra.length ? `${main} + ${extra.join(', ')}` : main);
}

export async function checkPage(page, files = {}, { maxWords = 200, minWords = 100, needsShot = false, bannerFrom = null, needsBanner = true, categories = null } = {}) {
  const out = [];
  const name = String(page.name || '').trim();
  if (!name) out.push(res('name', 'error', 'Titel', 'fehlt'));
  else if (name.length > 30) out.push(res('name', 'error', 'Titel', `${name.length} Zeichen (höchstens 30)`));
  else if (/[^\x20-\x7E]/.test(name)) out.push(res('name', 'error', 'Titel', 'nur englische Zeichen'));
  else if (NAME_AVOID.test(name)) out.push(res('name', 'error', 'Titel', `enthält „${name.match(NAME_AVOID)[0]}“ – kein Spiel-, Klassen- oder Versionsname im Titel`));
  else if (name.split(/\s+/).length > 4) out.push(res('name', 'warn', 'Titel', `${name.split(/\s+/).length} Wörter – zwei bis drei sind besser`));
  else out.push(res('name', 'ok', 'Titel', `${name.length}/30 Zeichen`));

  const description = String(page.description || '').trim();
  const summary = String(page.summary || '').trim();
  if (!summary) out.push(res('summary', 'error', 'Summary', 'fehlt'));
  else if (/\n/.test(summary)) out.push(res('summary', 'error', 'Summary', 'muss eine einzige Zeile sein'));
  else if (summary.length > 150) out.push(res('summary', 'error', 'Summary', `${summary.length} Zeichen (höchstens 150)`));
  else if (/[äöüÄÖÜß]/.test(summary)) out.push(res('summary', 'error', 'Summary', 'sieht deutsch aus – CurseForge verlangt Englisch'));
  else if ((summary.match(/[.!?](\s|$)/g) || []).length > 1) out.push(res('summary', 'error', 'Summary', 'mehr als ein Satz'));
  else if (norm(description).includes(norm(summary))) out.push(res('summary', 'error', 'Summary', 'steht wortgleich in der Beschreibung – CurseForge will das nicht kopiert'));
  else if (/\d/.test(summary)) out.push(res('summary', 'warn', 'Summary', 'enthält eine Zahl – veraltet sie mit Updates?'));
  else out.push(res('summary', 'ok', 'Summary', `${summary.length}/150 Zeichen`));

  const problems = [];
  const note = aiNote(bannerFrom);
  const count = words(description.replace(AI_LOGO_BANNER_NOTE, '').replace(AI_LOGO_NOTE, '')).length;
  if (!description) problems.push('fehlt');
  else {
    if (count < minWords || count > maxWords) problems.push(`${count} Wörter (${minWords} bis ${maxWords})`);
    const first = description.split('\n').find(l => l.trim()) || '';
    if (!/^\*\*[^*]+\*\*$/.test(first.trim())) problems.push('beginnt nicht mit einem fetten Satz');
    for (const title of SECTIONS) if (section(description, title) === null) problems.push(`Abschnitt „${title}“ fehlt`);
    const bullets = (section(description, 'Features') || '').split('\n').filter(l => /^- \S/.test(l)).length;
    if (section(description, 'Features') !== null && (bullets < 3 || bullets > 5)) problems.push(`${bullets} Stichpunkte unter Features (3 bis 5)`);
    if (FILLER.test(description)) problems.push(`Floskel: „${description.match(FILLER)[0]}“`);
    if (/https?:\/\//.test(description)) problems.push('enthält einen Link');
    if (/[äöüÄÖÜß]/.test(description)) problems.push('sieht deutsch aus');
    if (!/changelog/i.test(description)) problems.push('Hinweis auf den Changelog für spätere Funktionen fehlt');
    if (!description.endsWith(note)) problems.push(`endet nicht mit dem KI-Hinweis ${note}`);
  }
  out.push(problems.length ? res('description', 'error', 'Beschreibung', problems.join('; ')) : res('description', 'ok', 'Beschreibung', `${count} Wörter, ${SECTIONS.length} Abschnitte`));

  out.push(categoryCheck(page, categories));

  out.push(await imageCheck('logo', 'Logo', files.logo, [400, 400], { flat: true }));
  out.push(await imageCheck('cover', 'Titelbild', files.cover, COVER_SIZE));
  if (needsBanner) {
    const banner = await imageCheck('banner', 'Banner', files.banner, BANNER_SIZE, { flat: true });
    if (banner.level === 'error' && banner.detail === 'fehlt') banner.detail = 'noch nicht gewählt (npm run serie -- banner-wahl <slug> claude|chatgpt)';
    out.push(banner);
  } else {
    out.push(res('banner', 'ok', 'Banner', 'für diese Reihe nicht nötig'));
  }
  const shots = (files.shots || []).filter(f => fs.existsSync(f));
  if (needsShot && !shots.length) out.push(res('shots', 'error', 'Bild aus dem Spiel', 'fehlt – für optische Pakete Pflicht'));
  else out.push(res('shots', 'ok', 'Bilder aus dem Spiel', shots.length ? `${shots.length}` : 'keine (nicht Pflicht)'));
  return out;
}

export const pageOk = results => !results.some(r => r.level === 'error');
