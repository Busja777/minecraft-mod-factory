import { loadUnits } from './lib/review-items.js';
import { openNotes, resolveNote, saveReview, STATUS } from './lib/review.js';

// Claudes Eingang aus dem Studio (Vorbild: scripts/pruef-vermerke.mjs in Projekt A).
//   npm run notes                              offene „Ändern“-Notizen, gruppiert nach Pack, mit Datei + Befehl
//   npm run notes -- --erledigt <key>:<teil>   Notiz abhaken; sind alle erledigt, liegt das Pack wieder beim Betreiber
// Das Studio setzt selbst nie etwas um – es sammelt nur, was geändert werden soll.

const argv = process.argv.slice(2);

// Wo der Teil liegt und wie man ihn neu erzeugt.
function howTo(u, part) {
  const d = u.dir.replace(/^\.\//, '');
  const meta = u.kind === 'skinpack' ? `${d}/pack.json` : `${d}/mod.json`;
  const flag = u.kind === 'skinpack' ? `--skinpack ${u.key}` : `--mod ${u.key}`;
  if (part === 'name' || part === 'summary') return `Feld in ${meta} ändern (Name: auch logoFile/coverFile und Bilddateinamen prüfen)`;
  if (part === 'logo') return `logoPrompt in ${meta} anpassen → node scripts/build-images.js ${flag} --force`;
  if (part === 'cover') return `coverPrompt in ${meta} anpassen → node scripts/build-images.js ${flag} --force`;
  if (part === 'beschreibung') return `Legende/Notizen in ${meta} anpassen (Beschreibung wird aus scripts/lib/description.js erzeugt)`;
  if (part === 'changelog') return `title/note der Version in ${meta} anpassen (changelogFor in scripts/lib/skinpacks.js)`;
  if (part === 'datei') return `.mcpack in ${d}/mcpack/ neu bauen (buildMcpack in scripts/lib/mcpack.js)`;
  if (part.startsWith('skin:')) {
    const file = part.slice(5);
    return `Textur ${d}/skins/1.0/${file} ändern → node scripts/render-skins.js --pack ${u.key} --all, dann .mcpack neu bauen`;
  }
  return meta;
}

const units = loadUnits({ persist: false });
const target = argv[argv.indexOf('--erledigt') + 1];

if (argv.includes('--erledigt')) {
  const m = /^([a-z0-9-]+):(.+)$/.exec(target || '');
  if (!m) { console.error('Aufruf: npm run notes -- --erledigt <key>:<teil>   (z. B. glowing-samurai:logo)'); process.exit(1); }
  const u = units.find(x => x.key === m[1]);
  if (!u) { console.error(`Unbekanntes Pack/Mod: ${m[1]}`); process.exit(1); }
  try {
    resolveNote(u.review, m[2]);
  } catch (e) { console.error(`✗ ${e.message}`); process.exit(1); }
  saveReview(u.dir, u.review);
  console.log(u.review.status === STATUS.PRUEFUNG
    ? `✓ ${m[1]}:${m[2]} erledigt – alle Notizen fertig, das Pack liegt wieder im Studio zur Prüfung (Runde ${u.review.round}).`
    : `✓ ${m[1]}:${m[2]} erledigt – noch ${openNotes(u.review).length} offen.`);
} else {
  const waiting = units.filter(u => u.review.status === STATUS.CLAUDE);
  if (!waiting.length) {
    console.log('Keine offenen Studio-Notizen.');
  } else {
    console.log(`Offene Studio-Notizen (${waiting.length} Pack${waiting.length === 1 ? '' : 's'}):\n`);
    for (const u of waiting) {
      console.log(`■ ${u.kind === 'skinpack' ? u.pack.name : u.meta.name} (${u.kind} ${u.key}, Runde ${u.review.round})`);
      for (const n of openNotes(u.review)) {
        console.log(`  • ${n.part}: „${n.note}“`);
        console.log(`      wo/wie: ${howTo(u, n.part)}`);
        console.log(`      danach: npm run notes -- --erledigt ${u.key}:${n.part}`);
      }
      console.log('');
    }
  }
}
