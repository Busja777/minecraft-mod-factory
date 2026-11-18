import fs from 'fs';
import path from 'path';

// Persistent storage of generated mods: data/mods/<modId>/{mod.json, ModMain.java, <Name>.png, <Name> Cover.png, kit.md}
// mod.json: { name, modId, description, pageDescription, features, version, imagePrompt,
//             altNames, cfCategory, changelog: [{ version, date, text }], createdAt }

export const MODS_ROOT = './data/mods';

export function modDir(modId, root = MODS_ROOT) {
  return path.join(root, modId);
}

export function listMods(root = MODS_ROOT) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root).filter(d => fs.existsSync(path.join(root, d, 'mod.json'))).sort();
}

export function loadMod(modId, root = MODS_ROOT) {
  const dir = modDir(modId, root);
  const metaPath = path.join(dir, 'mod.json');
  if (!fs.existsSync(metaPath)) throw new Error(`No stored mod at ${metaPath}`);
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  const javaCode = fs.readFileSync(path.join(dir, 'ModMain.java'), 'utf-8');
  return { meta, javaCode };
}

export function saveMod(modId, { meta, javaCode }, root = MODS_ROOT) {
  const dir = modDir(modId, root);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'mod.json'), JSON.stringify(meta, null, 2) + '\n');
  if (javaCode !== undefined) fs.writeFileSync(path.join(dir, 'ModMain.java'), javaCode);
  return dir;
}

export function loadAllMeta(root = MODS_ROOT) {
  return listMods(root).map(id => loadMod(id, root).meta);
}

// Converts the output of generate.js (generated-mod.json) into a mod.json record.
export function metaFromGenerated(gen, { now = new Date() } = {}) {
  return {
    name: gen.name,
    modId: gen.modId,
    description: gen.description,
    pageDescription: gen.pageDescription || gen.description,
    features: gen.features || [],
    altNames: gen.altNames || [],
    cfCategory: gen.cfCategory || 'Utility & QoL',
    imagePrompt: gen.imagePrompt || '',
    coverPrompt: gen.coverPrompt || '',
    legend: gen.legend || '',
    version: '1.0.0',
    createdAt: now.toISOString(),
    changelog: [{ version: '1.0.0', date: now.toISOString().slice(0, 10), text: gen.changelog || '## v1.0.0\n- Initial release' }]
  };
}

export function bumpMinor(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!m) throw new Error(`Not a semver version: ${version}`);
  return `${m[1]}.${Number(m[2]) + 1}.0`;
}

export function latestChangelog(meta) {
  const entries = meta.changelog || [];
  return entries.length ? entries[entries.length - 1].text : '';
}

// Resolves which mod source the build steps should use.
// With --mod <id>: the stored mod in data/mods. Without: ./generated-mod.json (fresh generation).
export function resolveWorkingMod(argv = process.argv.slice(2), { root = MODS_ROOT, generatedPath = './generated-mod.json' } = {}) {
  const idx = argv.indexOf('--mod');
  if (idx !== -1) {
    const modId = argv[idx + 1];
    if (!modId) throw new Error('--mod requires a modId');
    const { meta, javaCode } = loadMod(modId, root);
    return {
      source: 'stored', modId, meta, javaCode,
      saveJava: code => saveMod(modId, { meta, javaCode: code }, root)
    };
  }
  const gen = JSON.parse(fs.readFileSync(generatedPath, 'utf-8'));
  return {
    source: 'generated', modId: gen.modId, meta: { ...metaFromGenerated(gen), version: '1.0.0' }, javaCode: gen.javaCode,
    saveJava: code => { gen.javaCode = code; fs.writeFileSync(generatedPath, JSON.stringify(gen, null, 2)); }
  };
}
