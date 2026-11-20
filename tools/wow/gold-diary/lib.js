import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ADDON = 'GoldDiary';
export const SRC = path.join(HERE, 'src', ADDON);

// The game runs Lua 5.1 without os/io/require; LuaJIT on the Mac knows more than the game.
const FORBIDDEN = [
  [/\bos\./, 'os.* does not exist in the game'],
  [/\bio\./, 'io.* does not exist in the game'],
  [/\brequire\s*\(/, 'require does not exist in the game'],
  [/\bgoto\b/, 'goto is not Lua 5.1'],
  [/[^/]\/\/[^/]/, '// is not Lua 5.1'],
];

export function tocFiles(dir = SRC) {
  const toc = fs.readFileSync(path.join(dir, `${ADDON}.toc`), 'utf-8');
  return toc.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
}

export function staticProblems(dir = SRC) {
  const problems = [];
  const toc = fs.readFileSync(path.join(dir, `${ADDON}.toc`), 'utf-8');
  if (toc.startsWith('# ')) problems.push('TOC must not start with a single-# comment (the client then skips every directive)');
  if (!/^## Interface: \d{6}/m.test(toc)) problems.push('TOC has no ## Interface line');
  if (!/^## Version: @version@$/m.test(toc)) problems.push('TOC needs "## Version: @version@"');
  const listed = tocFiles(dir);
  for (const f of listed) if (!fs.existsSync(path.join(dir, f))) problems.push(`TOC lists ${f}, which is missing`);
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.lua'))) {
    if (!listed.includes(f)) problems.push(`${f} is not listed in the TOC`);
    const code = fs.readFileSync(path.join(dir, f), 'utf-8').split('\n').map(l => l.replace(/--.*$/, '')).join('\n');
    for (const [re, why] of FORBIDDEN) if (re.test(code)) problems.push(`${f}: ${why}`);
  }
  return problems;
}

export function hasLuajit() {
  return spawnSync('luajit', ['-v']).status === 0;
}

// Runs the Lua tests against the stand-in client (test/wow.lua). Returns { ok, output }.
export function runLuaTests(dir = SRC) {
  const r = spawnSync('luajit', [path.join(HERE, 'test', 'run.lua'), dir], { encoding: 'utf-8' });
  return { ok: r.status === 0, output: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

export function buildZip(version, outDir, dir = SRC) {
  if (!/^\d+\.\d+(\.\d+)?$/.test(version)) throw new Error(`Invalid version "${version}"`);
  const zip = new AdmZip();
  for (const f of fs.readdirSync(dir).sort()) {
    let content = fs.readFileSync(path.join(dir, f));
    if (f.endsWith('.toc')) content = Buffer.from(content.toString('utf-8').replace('@version@', version), 'utf-8');
    zip.addFile(`${ADDON}/${f}`, content);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${ADDON}-${version}.zip`);
  zip.writeZip(file);
  return file;
}
