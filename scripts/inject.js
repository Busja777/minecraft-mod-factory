import fs from 'fs';

const mod = JSON.parse(fs.readFileSync('./generated-mod.json', 'utf-8'));

fs.writeFileSync('./template/src/main/java/com/factory/mod/ModMain.java', mod.javaCode);
console.log('Injected: ModMain.java');

const fabricMod = {
  schemaVersion: 1,
  id: mod.modId,
  version: '1.0.0',
  name: mod.name,
  description: mod.description,
  authors: ['SevFactory'],
  contact: {},
  license: 'MIT',
  environment: '*',
  entrypoints: { main: ['com.factory.mod.ModMain'] },
  depends: {
    fabricloader: '>=0.14.0',
    minecraft: '~1.21',
    java: '>=21',
    'fabric-api': '*'
  }
};
fs.writeFileSync('./template/src/main/resources/fabric.mod.json', JSON.stringify(fabricMod, null, 2));
console.log('Injected: fabric.mod.json');

let props = fs.readFileSync('./template/gradle.properties', 'utf-8');
props = props.replace(/^archives_base_name=.*/m, `archives_base_name=${mod.modId}`);
fs.writeFileSync('./template/gradle.properties', props);
console.log(`Injected: gradle.properties (archives_base_name=${mod.modId})`);
