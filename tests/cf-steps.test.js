import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { buildSteps, gameVersionsFor } from '../scripts/lib/cf-browser/steps.js';
import { listTasks } from '../scripts/lib/cf-browser/tasks.js';
import { recordProjectId, recordUpload, urlTemplate } from '../scripts/lib/cf-browser/record.js';
import { TARGETS, FORBIDDEN_CLICK, FORBIDDEN_AFTER_EDIT, PROJECT_ID_IN_URL } from '../scripts/lib/cf-browser/selectors.js';

const config = { mcVersion: '1.21.1', updateIntervalDays: [22, 25], bedrock: { galleryTitle: 'MCPEDL', versionPrefix: '26.' } };
const makePack = () => ({
  slug: 'glowing-samurai', name: 'Glowing Samurai', summary: 'Glowing samurai.', legend: 'Long ago...', cfProjectId: 1498885,
  lastGameVersions: ['1.21.81', '26.3', '26.10', '26.3'],
  versions: [
    { version: '1.0', status: 'published', fileId: 1, mcpack: 'A.mcpack', skins: [{ name: 'RAIJIN — Thunder' }], media: ['media/v1.0-skins.png'], note: 'Base.' },
    { version: '1.1', status: 'published', fileId: null, manual: true, mcpack: 'B.mcpack', skins: [{ name: 'KAZE-KI — Wind' }], media: [], note: 'More.', changelog: '## V1.1\n' },
    { version: '1.2', status: 'due', mcpack: 'C.mcpack', skins: [{ name: 'RAIKAGE — Storm' }], media: [], note: 'Storm.' }
  ]
});
const pack = makePack();
const meta = { name: 'AutoSort', description: 'Sorts chests.', cfCategory: 'Storage', legend: 'A tale.', pageDescription: '## Features', changelog: [{ version: '1.0.0' }] };
const step = (plan, target, arg) => plan.steps.find(s => s.target === target && (arg === undefined || s.arg === arg));
const allPlans = () => [
  buildSteps({ cmd: 'publish', kind: 'skinpack', id: 'glowing-samurai' }, { config, pack }),
  buildSteps({ cmd: 'new', kind: 'skinpack', id: 'glowing-samurai' }, { config, pack }),
  buildSteps({ cmd: 'media', kind: 'skinpack', id: 'glowing-samurai' }, { config, pack }),
  buildSteps({ cmd: 'update', kind: 'skinpack', id: 'glowing-samurai' }, { config, pack }),
  buildSteps({ cmd: 'publish', kind: 'mod', id: 'autosort' }, { config, meta })
];

test('publish follows the Anleitung: Create wizard → wait for Create → id → Media → File', () => {
  const plan = buildSteps({ cmd: 'publish', kind: 'skinpack', id: 'glowing-samurai' }, { config, pack });
  const order = plan.steps.map(s => s.target ? `${s.target}${s.arg ? `:${s.arg}` : ''}` : s.action);
  const at = k => order.indexOf(k);
  assert.ok(at('startProject') < at('game:Minecraft Bedrock'));
  assert.ok(at('projectName') < at('wizardTab:Description') && at('wizardTab:Description') < at('description'));
  assert.ok(at('description') < at('wizardTab:License') && at('wizardTab:License') < at('license'));
  assert.ok(at('distribution') < at('waitFor') && at('waitFor') < at('captureProjectId'));
  assert.ok(at('captureProjectId') < at('projectTab:Media') && at('projectTab:Media') < at('projectTab:Files'));
  assert.equal(plan.steps.filter(s => s.action === 'waitFor').length, 3, 'waits for Create, Apply and Add File');
  assert.deepEqual(plan.record, { version: '1.0' });
});

test('form values come from the kit: class, categories, license, MCPEDL title, files by absolute path', () => {
  const plan = buildSteps({ cmd: 'publish', kind: 'skinpack', id: 'glowing-samurai' }, { config, pack });
  assert.equal(step(plan, 'projectClass').value, 'Skins');
  assert.equal(step(plan, 'mainCategory').value, 'Players');
  assert.deepEqual(step(plan, 'additionalCategories').value, ['Skin Packs']);
  assert.equal(step(plan, 'license').value, 'All Rights Reserved');
  assert.equal(step(plan, 'mediaTitle').value, 'MCPEDL');
  assert.equal(step(plan, 'logoFile').value, path.resolve('data/skins/glowing-samurai/Glowing Samurai.png'));
  assert.equal(step(plan, 'mediaFile').value, path.resolve('data/skins/glowing-samurai/Glowing Samurai Cover.png'));
  assert.equal(step(plan, 'projectFile').value, path.resolve('data/skins/glowing-samurai/mcpack/A.mcpack'));
  assert.deepEqual(step(plan, 'gameVersions').value, ['26.3', '26.10']);
  assert.match(step(plan, 'changelog').value, /!\[V1\.0 skins\]/);
});

test('update uploads the waiting version and copies the description section', () => {
  const plan = buildSteps({ cmd: 'update', kind: 'skinpack', id: 'glowing-samurai' }, { config, pack });
  assert.ok(step(plan, 'projectFile').value.endsWith(path.join('mcpack', 'B.mcpack')));
  assert.equal(step(plan, 'changelog').value, '## V1.1');
  assert.match(plan.clipboard, /^## Added in V1\.1: KAZE-KI/);
  assert.equal(plan.steps[0].action, 'manual', 'without a learned URL the user opens the project page');
});

test('mods: Minecraft / Mods / MIT, gallery title = name, no file step (jar goes through the API)', () => {
  const plan = buildSteps({ cmd: 'publish', kind: 'mod', id: 'autosort' }, { config, meta });
  assert.equal(step(plan, 'game').arg, 'Minecraft');
  assert.equal(step(plan, 'projectClass').value, 'Mods');
  assert.equal(step(plan, 'license').value, 'MIT');
  assert.equal(step(plan, 'mediaTitle').value, 'AutoSort');
  assert.ok(!step(plan, 'projectFile'));
  assert.ok(!step(plan, 'additionalCategories'));
  assert.throws(() => buildSteps({ cmd: 'update', kind: 'mod', id: 'autosort' }, { config, meta }), /per API/);
});

test('every step target exists and no click step targets a final button', () => {
  for (const plan of allPlans()) {
    for (const s of plan.steps) {
      if (s.target) assert.ok(TARGETS[s.target], `unknown target ${s.target}`);
      if (s.trigger) assert.ok(TARGETS[s.trigger], `unknown trigger ${s.trigger}`);
      if (s.action === 'click') assert.doesNotMatch(s.title, FORBIDDEN_CLICK, s.title);
    }
  }
});

test('forbidden lists: final buttons blocked, openers allowed, "Add File" only before editing', () => {
  for (const name of ['Create', 'Create Project', 'Save', 'Apply', 'Upload', 'Submit', 'Delete image']) assert.match(name, FORBIDDEN_CLICK, name);
  for (const name of ['+ Create A Project', 'Create A Project', 'Upload image', '+ Add File', '+ Add Media', 'Media', 'Files', 'Previous']) assert.doesNotMatch(name, FORBIDDEN_CLICK, name);
  for (const name of ['Add File', '+ Add File', 'Add Media']) assert.match(name, FORBIDDEN_AFTER_EDIT, name);
  assert.doesNotMatch('Add related project', FORBIDDEN_AFTER_EDIT);
});

test('project id is read from the edit page URL and the URL pattern is learned', () => {
  assert.equal(PROJECT_ID_IN_URL.exec('https://authors.curseforge.com/#/projects/1498885/files')[1], '1498885');
  assert.equal(PROJECT_ID_IN_URL.exec('https://authors.curseforge.com/#/projects'), null);
  assert.equal(urlTemplate('https://authors.curseforge.com/#/projects/1498885/files', 1498885), 'https://authors.curseforge.com/#/projects/{id}/files');
  assert.deepEqual(gameVersionsFor({ lastGameVersions: ['1.21', '26.3', '26.3'] }, '26.'), ['26.3']);
});

test('recording: new project id goes to cf-projects + pack, upload schedules the next update', () => {
  const p = makePack();
  delete p.cfProjectId;
  p.versions = p.versions.map(v => ({ ...v, status: 'due', fileId: null, manual: undefined }));
  const projects = [];
  recordProjectId({ projects, pack: p, task: { kind: 'skinpack', id: 'glowing-samurai' }, name: p.name, projectId: 4242 });
  assert.equal(projects[0].projectId, 4242);
  assert.equal(projects[0].kind, 'skinpack');
  assert.equal(p.cfProjectId, 4242);
  const now = new Date('2026-11-14T10:00:00Z');
  recordUpload({ projects, pack: p, task: { kind: 'skinpack', id: 'glowing-samurai' }, version: '1.0', intervalDays: [22, 25], now, rng: () => 0 });
  assert.equal(p.versions[0].status, 'published');
  assert.equal(p.versions[0].manual, true);
  assert.equal(projects[0].status, 'published');
  assert.equal(projects[0].nextUpdateDue, '2026-12-06T10:00:00.000Z');
  assert.equal(recordUpload({ projects, pack: p, task: { kind: 'skinpack', id: 'glowing-samurai' }, version: '1.0', intervalDays: [22, 25], now }), null, 'second time is a no-op');
});

test('menu: new projects are published in one run, waiting uploads and media chores are listed', () => {
  const projects = [
    { modId: 'autosort', kind: 'mod', name: 'AutoSort', status: 'pending', projectId: null },
    { modId: 'quickstack', kind: 'mod', name: 'QuickStack', status: 'published', projectId: 7 },
    { modId: 'glowing-samurai', kind: 'skinpack', name: 'Glowing Samurai', status: 'published', projectId: 1498885 }
  ];
  const fresh = { ...makePack(), slug: 'neon-ninja', name: 'Neon Ninja', cfProjectId: undefined };
  const { todo, more } = listTasks({ projects, packs: [pack, fresh] });
  assert.deepEqual(todo.map(t => `${t.cmd}:${t.id}`), ['publish:autosort', 'update:glowing-samurai', 'publish:neon-ninja']);
  assert.equal(todo[1].version, '1.1');
  assert.deepEqual(more.map(t => `${t.cmd}:${t.id}`), ['media:glowing-samurai', 'media:quickstack']);
});
