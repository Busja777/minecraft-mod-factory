import fs from 'fs';
import { resolveWorkingMod } from './lib/mods.js';

// Writes the working mod (stored via --mod <id>, or fresh generated-mod.json) into template/.
const { modId, meta, javaCode, source } = resolveWorkingMod(process.argv.slice(2));
const version = meta.version || '1.0.0';

fs.writeFileSync('./template/src/main/java/com/factory/mod/ModMain.java', javaCode);
console.log(`Injected: ModMain.java (${source} ${modId} v${version})`);

const fabricMod = {
  schemaVersion: 1,
  id: modId.replace(/-/g, '_'),
  version,
  name: meta.name,
  description: meta.description,
  authors: ['SevFactory'],
  contact: { issues: 'https://github.com/Busja777/minecraft-mod-factory/issues' },
  license: 'MIT',
  environment: '*',
  entrypoints: { main: ['com.factory.mod.ModMain'] },
  depends: { fabricloader: '>=0.14.0', minecraft: '~1.21', java: '>=21', 'fabric-api': '*' }
};
fs.writeFileSync('./template/src/main/resources/fabric.mod.json', JSON.stringify(fabricMod, null, 2));
console.log('Injected: fabric.mod.json');

let props = fs.readFileSync('./template/gradle.properties', 'utf-8');
props = props.replace(/^archives_base_name=.*/m, `archives_base_name=${modId}`);
props = props.replace(/^mod_version=.*/m, `mod_version=${version}`);
fs.writeFileSync('./template/gradle.properties', props);
console.log(`Injected: gradle.properties (archives_base_name=${modId}, mod_version=${version})`);
