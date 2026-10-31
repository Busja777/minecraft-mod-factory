import fs from 'fs';
import path from 'path';
import { saveMod, metaFromGenerated, modDir, listMods } from './lib/mods.js';
import { loadProjects, saveProjects, upsertProject, newEntry } from './lib/cf-projects.js';
import { setOutputs } from './lib/github-output.js';

// Moves a fresh generation (generated-mod.json + images/icon.png) into permanent storage
// under data/mods/<modId>/ and registers a pending entry in data/cf-projects.json.
const genPath = './generated-mod.json';
const gen = JSON.parse(fs.readFileSync(genPath, 'utf-8'));

if (listMods().includes(gen.modId)) {
  const suffix = Date.now().toString(36).slice(-4);
  console.log(`modId ${gen.modId} already stored — using ${gen.modId}-${suffix}`);
  gen.modId = `${gen.modId}-${suffix}`.slice(0, 32);
  fs.writeFileSync(genPath, JSON.stringify(gen, null, 2));
}

const meta = metaFromGenerated(gen);
const dir = saveMod(gen.modId, { meta, javaCode: gen.javaCode });
if (fs.existsSync('./images/icon.png')) {
  fs.copyFileSync('./images/icon.png', path.join(dir, 'icon.png'));
  console.log('Stored: icon.png');
}

const projects = loadProjects();
upsertProject(projects, newEntry({ modId: gen.modId, name: gen.name }));
saveProjects(projects);

console.log(`Stored mod in ${modDir(gen.modId)} and registered as pending`);
setOutputs({ modId: gen.modId, name: gen.name });
