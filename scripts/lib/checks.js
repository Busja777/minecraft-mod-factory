import fs from 'fs';
import sharp from 'sharp';
import { AI_NOTE } from './description.js';
import { readMcpack } from './mcpack.js';
import { CF_MAX_IMAGE_BYTES } from './images.js';

// Automatische Prüfungen vor dem Go (Regeln aus Input/Anleitung_CF.docx + CurseForge-Formular).
// Jede Prüfung: { id, label, level: 'ok' | 'warn' | 'error', detail }
//   error → blockiert Go (das würde CurseForge ablehnen oder MCPEDL nicht übernehmen)
//   warn  → nur Hinweis (CurseForge empfiehlt es, lehnt aber nicht automatisch ab)

const ok = (id, label, detail = '') => ({ id, label, level: 'ok', detail });
const warn = (id, label, detail) => ({ id, label, level: 'warn', detail });
const error = (id, label, detail) => ({ id, label, level: 'error', detail });

async function imageCheck(id, label, file, [w, h]) {
  if (!file || !fs.existsSync(file)) return error(id, label, `Datei fehlt: ${file}`);
  const bytes = fs.statSync(file).size;
  const meta = await sharp(file).metadata();
  if (bytes >= CF_MAX_IMAGE_BYTES) return error(id, label, `${(bytes / 1e6).toFixed(2)} MB – CurseForge erlaubt unter 2 MB`);
  if (meta.width !== w || meta.height !== h) return error(id, label, `${meta.width}×${meta.height} statt ${w}×${h} px`);
  return ok(id, label, `${w}×${h} px, ${(bytes / 1000).toFixed(0)} KB`);
}

// CF-Hinweis im Formular: „Avoid including the project class, category, version, or the game's name in the title“.
const NAME_AVOID = /\b(minecraft|bedrock|java edition|mcpe|skin ?packs?|texture ?packs?|addons?|mods?|v?\d+\.\d+(\.\d+)?)\b/i;

// f: Felder aus skinpackKitFields / modKitFields; files: { logo, cover, mcpack? } als Pfade.
export async function runChecks(f, files) {
  const out = [];
  const name = String(f.name || '').trim();
  if (!name) out.push(error('name', 'Projektname', 'fehlt'));
  else if (name.length > 128) out.push(error('name', 'Projektname', `${name.length} Zeichen (max. 128)`));
  else if (NAME_AVOID.test(name)) out.push(warn('name', 'Projektname', `enthält „${name.match(NAME_AVOID)[0]}“ – CurseForge rät von Spiel-, Klassen- und Versionsnamen im Titel ab`));
  else out.push(ok('name', 'Projektname', `${name.length}/128 Zeichen`));

  const summary = String(f.summary || '');
  if (!summary.trim()) out.push(error('summary', 'Summary', 'fehlt'));
  else if (summary.length > 256) out.push(error('summary', 'Summary', `${summary.length} Zeichen (max. 256)`));
  else if (/\n/.test(summary.trim())) out.push(error('summary', 'Summary', 'muss eine einzige Zeile sein'));
  else if (/[äöüÄÖÜß]/.test(summary)) out.push(warn('summary', 'Summary', 'sieht deutsch aus – CurseForge verlangt Englisch'));
  else out.push(ok('summary', 'Summary', `${summary.length}/256 Zeichen`));

  out.push(await imageCheck('logo', 'Logo', files.logo, [400, 400]));
  out.push(await imageCheck('cover', 'Cover', files.cover, [720, 340]));

  const desc = String(f.description || '');
  out.push(desc.includes(AI_NOTE) ? ok('ai', 'KI-Hinweis in der Beschreibung') : error('ai', 'KI-Hinweis in der Beschreibung', 'fehlt – Logo/Cover sind KI-generiert'));
  const images = (desc.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length;
  out.push(images ? ok('screens', 'Screenshots in der Beschreibung', `${images} Bild${images === 1 ? '' : 'er'}`) : error('screens', 'Screenshots in der Beschreibung', 'keine – ohne Screenshots lehnen die Moderatoren ab'));

  if (f.kind === 'skinpack') {
    out.push(f.galleryTitle === 'MCPEDL' ? ok('mcpedl', 'Media-Titel MCPEDL') : error('mcpedl', 'Media-Titel MCPEDL', `ist „${f.galleryTitle}“ – sonst übernimmt MCPEDL das Cover nicht`));
    if (!files.mcpack || !fs.existsSync(files.mcpack)) out.push(error('mcpack', '.mcpack-Datei', `fehlt: ${files.mcpack}`));
    else {
      try {
        const { issues, skins } = readMcpack(files.mcpack);
        out.push(issues.length ? error('mcpack', '.mcpack-Datei', issues.join('; ')) : ok('mcpack', '.mcpack-Datei', `${skins.length} Skins`));
      } catch (e) {
        out.push(error('mcpack', '.mcpack-Datei', e.message));
      }
    }
  }
  return out;
}
