import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { listPacks, packOf, isMod, PACK_FORMAT } from '../tools/java/lib.js';
import { FABRIC, javaHome, gradle } from '../tools/java/fabric/gradle.js';

// Fabric mods of the Java series (tools/java/projects/<slug>/ with "kind": "mod").
// The fast checks need no Gradle; the last test runs the JUnit tests of every mod and is skipped
// without Java 21. Game tests (src/gametest) only run with `npm run java -- test <slug>`.
const mods = () => listPacks().map(slug => packOf(slug)).filter(isMod);
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf-8'));
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const ENVIRONMENT = { '*': ['Client', 'Server'], server: ['Server'], client: ['Client'] };

test('Fabric: the shared Gradle build is complete', () => {
  for (const f of ['settings.gradle', 'build.gradle', 'gradle.properties', 'gradlew', path.join('gradle', 'wrapper', 'gradle-wrapper.jar'), path.join('gradle', 'wrapper', 'gradle-wrapper.properties')]) {
    assert.ok(fs.existsSync(path.join(FABRIC, f)), `tools/java/fabric/${f} is missing`);
  }
  assert.ok(fs.statSync(path.join(FABRIC, 'gradlew')).mode & 0o111, 'gradlew must be executable');
  const props = fs.readFileSync(path.join(FABRIC, 'gradle.properties'), 'utf-8');
  assert.match(props, /^minecraft_version=1\.21\.1$/m);
  // the build finds mods by their pack.json, so adding a mod needs no edit in settings.gradle
  assert.match(fs.readFileSync(path.join(FABRIC, 'settings.gradle'), 'utf-8'), /pack\.kind != 'mod'/);
});

test('Fabric: every mod folder is complete', () => {
  const ids = new Set();
  for (const mod of mods()) {
    const at = rel => path.join(mod.dir, rel);
    assert.ok(PACK_FORMAT[mod.mc], `${mod.slug}: unknown Minecraft version`);
    assert.ok(mod.name && mod.description, `${mod.slug}: pack.json needs name and description`);
    assert.ok(!ids.has(mod.modId), `${mod.slug}: modId ${mod.modId} twice`);
    ids.add(mod.modId);

    const gv = mod.gameVersions;
    assert.ok(gv.includes(mod.mc), `${mod.slug}: gameVersions must include ${mod.mc}`);
    for (const v of ['Fabric', 'Java 21']) assert.ok(gv.includes(v), `${mod.slug}: gameVersions must include "${v}"`);
    assert.ok(!gv.includes('Forge') && !gv.includes('NeoForge'), `${mod.slug}: the shared build only makes Fabric jars`);

    const fmj = readJson(at('src/main/resources/fabric.mod.json'));
    assert.equal(fmj.schemaVersion, 1, `${mod.slug}: fabric.mod.json schemaVersion`);
    assert.equal(fmj.id, mod.modId, `${mod.slug}: fabric.mod.json id must be the modId`);
    assert.equal(fmj.version, '${version}', `${mod.slug}: fabric.mod.json version must be \${version} (set by the build)`);
    assert.equal(fmj.name, mod.name, `${mod.slug}: fabric.mod.json name must be the pack name`);
    assert.ok(fmj.depends?.['fabric-api'], `${mod.slug}: depends on fabric-api`);
    assert.ok(String(fmj.depends?.minecraft || '').includes(mod.mc), `${mod.slug}: depends.minecraft must name ${mod.mc}`);
    const sides = ENVIRONMENT[fmj.environment ?? '*'];
    assert.ok(sides, `${mod.slug}: unknown environment ${fmj.environment}`);
    assert.deepEqual(['Client', 'Server'].filter(s => gv.includes(s)), sides, `${mod.slug}: environment "${fmj.environment}" needs exactly ${sides.join(' and ')} in gameVersions`);

    // every entrypoint class exists as a source file
    for (const list of Object.values(fmj.entrypoints || {})) {
      for (const entry of list) {
        const cls = typeof entry === 'string' ? entry : entry.value;
        const file = at(path.join('src/main/java', ...cls.split('::')[0].split('.')) + '.java');
        assert.ok(fs.existsSync(file), `${mod.slug}: entrypoint ${cls} has no source file`);
      }
    }
    const tests = fs.existsSync(at('src/test/java')) ? walk(at('src/test/java')).filter(f => f.endsWith('Test.java')) : [];
    assert.ok(tests.length, `${mod.slug}: JUnit tests in src/test/java are missing`);
    for (const f of tests) assert.doesNotMatch(fs.readFileSync(f, 'utf-8'), /import net\.minecraft\./, `${path.basename(f)}: JUnit tests cover pure logic without Minecraft classes`);

    // a mod built before its logo exists keeps its page as page.draft.json (like the nightly WoW
    // addons); the draft gets the same checks
    const page = readJson(at(fs.existsSync(at('page.json')) ? 'page.json' : 'page.draft.json'));
    assert.equal(page.name, mod.name, `${mod.slug}: page name and pack name differ`);
    assert.equal(page.class, 'Mods', `${mod.slug}: page class must be "Mods"`);
    assert.ok(['Utility & QoL', 'Farming', 'Server Utility', 'Miscellaneous'].includes(page.category), `${mod.slug}: unknown category ${page.category}`);
    assert.ok(Array.isArray(page.description) && page.summary && page.logoPrompt && page.cover?.bullets?.length === 3, `${mod.slug}: page.json is incomplete`);
    const changelog = at(path.join('changelogs', '1.0.md'));
    assert.ok(fs.existsSync(changelog), `${mod.slug}: changelogs/1.0.md is missing`);
    assert.match(fs.readFileSync(changelog, 'utf-8'), new RegExp(`^## ${mod.name} 1\\.0$`, 'm'));
  }
});

const noJava = !javaHome() && 'Java 21 is missing (brew install openjdk@21)';
test('Fabric: the JUnit tests of every mod pass (gradle test)', { skip: noJava, timeout: 30 * 60 * 1000 }, () => {
  const list = mods();
  if (!list.length) return;
  const { status, output } = gradle([...list.map(m => `:${m.slug}:test`), '--quiet'], { quiet: true });
  assert.equal(status, 0, output.slice(-4000));
});
