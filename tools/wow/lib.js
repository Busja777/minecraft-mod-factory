import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

// Shared build and check code for every World of Warcraft addon of the series.
// Layout: tools/wow/projects/<slug>/src/<AddonName>/<AddonName>.toc + Lua files, test.lua, changelogs/.
export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PROJECTS = path.join(HERE, 'projects');

// The game runs Lua 5.1 without os/io/require; LuaJIT on the Mac knows more than the game.
const FORBIDDEN = [
  [/\bos\./, 'os.* does not exist in the game'],
  [/\bio\./, 'io.* does not exist in the game'],
  [/\brequire\s*\(/, 'require does not exist in the game'],
  [/\bgoto\b/, 'goto is not Lua 5.1'],
  [/[^/]\/\/[^/]/, '// is not Lua 5.1'],
];

export function listAddons(root = PROJECTS) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root).filter(slug => fs.existsSync(path.join(root, slug, 'src'))).sort();
}

export function addonOf(slug, root = PROJECTS) {
  const dir = path.join(root, slug);
  const srcRoot = path.join(dir, 'src');
  if (!fs.existsSync(srcRoot)) throw new Error(`No addon "${slug}" under ${root}`);
  const folders = fs.readdirSync(srcRoot).filter(f => fs.statSync(path.join(srcRoot, f)).isDirectory());
  if (folders.length !== 1) throw new Error(`${slug}: src/ must hold exactly one addon folder, found ${folders.length}`);
  const name = folders[0];
  return { slug, dir, name, src: path.join(srcRoot, name), test: path.join(dir, 'test.lua') };
}

const tocText = a => fs.readFileSync(path.join(a.src, `${a.name}.toc`), 'utf-8');

export function tocFiles(a) {
  return tocText(a).split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
}

// Interface numbers of the TOC, e.g. [120105, 120107].
export function interfaces(a) {
  const m = /^## Interface:\s*(.+)$/m.exec(tocText(a));
  return m ? m[1].split(',').map(s => Number(s.trim())) : [];
}

export function staticProblems(a) {
  const problems = [];
  if (!fs.existsSync(path.join(a.src, `${a.name}.toc`))) return [`${a.name}.toc is missing`];
  const toc = tocText(a);
  if (toc.startsWith('# ')) problems.push('TOC must not start with a single-# comment (the client then skips every directive)');
  if (!interfaces(a).length || interfaces(a).some(n => !Number.isInteger(n) || n < 10000)) problems.push('TOC has no valid ## Interface line');
  if (!/^## Title: \S/m.test(toc)) problems.push('TOC has no ## Title');
  if (!/^## Notes: \S/m.test(toc)) problems.push('TOC has no ## Notes');
  if (!/^## Version: @version@$/m.test(toc)) problems.push('TOC needs "## Version: @version@"');
  const listed = tocFiles(a);
  for (const f of listed) if (!fs.existsSync(path.join(a.src, f))) problems.push(`TOC lists ${f}, which is missing`);
  for (const f of fs.readdirSync(a.src).filter(f => f.endsWith('.lua'))) {
    if (!listed.includes(f)) problems.push(`${f} is not listed in the TOC`);
    const code = fs.readFileSync(path.join(a.src, f), 'utf-8').split('\n').map(l => l.replace(/--.*$/, '')).join('\n');
    for (const [re, why] of FORBIDDEN) if (re.test(code)) problems.push(`${f}: ${why}`);
  }
  if (!fs.existsSync(a.test)) problems.push('test.lua is missing');
  return problems;
}

// Texts on screen (L["..."] and label tables) that a language block of Locale.lua misses or no longer needs.
// Returns [] for addons without a Locale.lua.
export function translationProblems(a) {
  const file = path.join(a.src, 'Locale.lua');
  if (!fs.existsSync(file)) return [];
  const locale = fs.readFileSync(file, 'utf-8');
  const code = fs.readdirSync(a.src).filter(f => f.endsWith('.lua') && f !== 'Locale.lua').map(f => fs.readFileSync(path.join(a.src, f), 'utf-8')).join('\n');
  const used = new Set([...code.matchAll(/L\["((?:[^"\\]|\\.)*)"\]/g)].map(m => m[1]));
  for (const m of code.matchAll(/[A-Z_]+_LABEL = \{([\s\S]*?)\}/g)) for (const s of m[1].matchAll(/= "([^"]+)"/g)) used.add(s[1]);
  const problems = [];
  for (const m of locale.matchAll(/^T\.([a-z]{2}[A-Z]{2}) = \{([\s\S]*?)\n\}/gm)) {
    const keys = new Set([...m[2].matchAll(/\["((?:[^"\\]|\\.)*)"\]\s*=/g)].map(k => k[1]));
    for (const k of used) if (!keys.has(k)) problems.push(`${m[1]} misses "${k}"`);
    for (const k of keys) if (!used.has(k)) problems.push(`${m[1]} has unused "${k}"`);
  }
  return problems;
}

export function hasLuajit() {
  return spawnSync('luajit', ['-v']).status === 0;
}

// Runs the addon's test.lua against the stand-in client (client/wow.lua). Returns { ok, output }.
export function runLuaTests(a) {
  const r = spawnSync('luajit', [path.join(HERE, 'client', 'run.lua'), a.src, a.test], { encoding: 'utf-8' });
  return { ok: r.status === 0, output: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

export const zipName = (a, version) => `${a.name}-${version}.zip`;

export function buildZip(a, version, outDir) {
  if (!/^\d+\.\d+(\.\d+)?$/.test(version)) throw new Error(`Invalid version "${version}"`);
  const zip = new AdmZip();
  for (const f of fs.readdirSync(a.src).sort()) {
    let content = fs.readFileSync(path.join(a.src, f));
    if (f.endsWith('.toc')) content = Buffer.from(content.toString('utf-8').replace('@version@', version), 'utf-8');
    zip.addFile(`${a.name}/${f}`, content);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, zipName(a, version));
  zip.writeZip(file);
  return file;
}
