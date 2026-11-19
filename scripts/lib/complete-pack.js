import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { readMcpack, buildMcpack } from './mcpack.js';

// Every uploaded skin pack file must contain ALL skins up to that version: CurseForge offers new
// players the latest file, and they should get the whole collection, not just the newest skins.

const sha = buf => crypto.createHash('sha1').update(buf).digest('hex');
const minor = version => Number(String(version).split('.')[1]);

// Skins of version `version` and every earlier version, newest version first.
export function skinsUpTo(pack, version) {
  return pack.versions
    .filter(x => minor(x.version) <= minor(version))
    .sort((a, b) => minor(b.version) - minor(a.version))
    .flatMap(x => x.skins.map(s => ({ ...s, version: x.version })));
}

// Deterministic UUID (version-5 layout) per pack, so each complete build replaces the previous one in game.
export function stableUuid(seed) {
  const h = sha(seed);
  const variant = ((parseInt(h[16], 16) & 3) | 8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

// expected: [{ name, png }] → the ones whose texture is not in the .mcpack
export function missingSkins(mcpack, expected) {
  const have = new Set(readMcpack(mcpack).skins.filter(s => s.png).map(s => sha(s.png)));
  return expected.filter(s => !have.has(sha(s.png)));
}

export const completeFileName = (pack, v) => `${pack.packName.replace(/[^A-Za-z0-9]+/g, '_')}_V${v.version.replace('.', '_')}_Complete.mcpack`;

// Keeps v.mcpack when it already holds every skin up to v; otherwise builds
// <Pack>_V1_3_Complete.mcpack, points v.mcpack at it and remembers the original as v.sourceMcpack.
export function ensureCompletePack(pack, v, dir) {
  const all = skinsUpTo(pack, v.version).map(s => ({ ...s, png: fs.readFileSync(path.join(dir, 'skins', s.version, s.file)) }));
  const current = v.mcpack && path.join(dir, 'mcpack', v.mcpack);
  if (current && fs.existsSync(current) && !missingSkins(fs.readFileSync(current), all).length) {
    return { file: v.mcpack, built: false, total: all.length };
  }
  const missing = current && fs.existsSync(current) ? missingSkins(fs.readFileSync(current), all).length : all.length;
  const fileName = completeFileName(pack, v);
  fs.mkdirSync(path.join(dir, 'mcpack'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'mcpack', fileName), buildMcpack({
    packName: pack.packName,
    description: `${pack.name} — all ${all.length} skins (V${v.version})`,
    serializeName: pack.packName.replace(/[^A-Za-z0-9]/g, ''),
    skins: all,
    version: [1, minor(v.version), 0],
    uuids: { header: stableUuid(`${pack.slug}:header`), module: stableUuid(`${pack.slug}:module`) }
  }));
  if (v.mcpack && v.mcpack !== fileName) v.sourceMcpack = v.mcpack;
  v.mcpack = fileName;
  return { file: fileName, built: true, total: all.length, missing };
}
