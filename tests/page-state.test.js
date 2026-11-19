import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plainText, pageState, pageBehind, tracksPage } from '../scripts/lib/page-state.js';
import { getDescription } from '../scripts/platforms/curseforge-core.js';

const pack = (over = {}) => ({
  slug: 'ninjas', name: 'The Last Ninjas', cfProjectId: 1503504,
  legend: "When the last dojo burned, its students didn't die. They faded into the dark.",
  versions: [
    { version: '1.0', status: 'published', fileId: 1, skins: [{ name: 'Shadow Ninja' }] },
    { version: '1.1', status: 'published', fileId: 2, skins: [{ name: 'Kitsune Ninja' }] },
    { version: '1.2', status: 'published', fileId: 3, manual: false, skins: [{ name: 'Neon Shogun' }, { name: 'Cursed Marionette' }] },
    { version: '1.3', status: 'due', skins: [{ name: 'Later' }] }
  ],
  ...over
});
const ours = `<h1>The Last Ninjas</h1><p>When the last dojo burned, its students didn&#x27;t die.&nbsp;They faded</p>
  <img src="https://raw.githubusercontent.com/o/r/main/data/skins/ninjas/media/collection.png">
  <h2>Added in V1.1: Kitsune Ninja</h2><img src="https://media.forgecdn.net/attachments/description/1/a.png">`;

test('plainText strips tags and entities so the legend can be found in CurseForge HTML', () => {
  assert.equal(plainText('<p>Its&nbsp;students didn&#x27;t <b>die</b>.</p>'), "its students didn't die.");
});

test('pageState: how far the description is, and where its images come from', () => {
  assert.deepEqual(pageState(pack(), { html: '<p>They fast, they strong.</p><img src="https://media.forgecdn.net/x.png">' }),
    { descriptionThrough: null, externalImages: 0, hostedImages: 1 });
  assert.deepEqual(pageState(pack(), { html: ours }), { descriptionThrough: '1.1', externalImages: 1, hostedImages: 1 });
  assert.equal(pageState(pack(), { html: `${ours}<h2>Added in V1.2: Neon Shogun, Cursed Marionette</h2>` }).descriptionThrough, '1.2');
  assert.equal(pageState(pack(), {}).descriptionThrough, null, 'an unreadable page counts as nothing shown');
  assert.equal(pageState(pack(), { html: '<h2>Added in V1.20: x</h2>' }).descriptionThrough, null, 'V1.20 is not V1.2');
  assert.equal(pageState(pack(), { html: '<p><strong>When</strong> the last dojo burned , its students didn’t die.</p>' }).descriptionThrough, '1.0', 'legend found despite markup and typography');
});

test('pageBehind: follow-up only for pipeline releases whose file is on CurseForge, description only', () => {
  assert.deepEqual(pageBehind(pack()), { version: '1.2', filled: false });
  assert.equal(pageBehind(pack({ page: { descriptionThrough: '1.2' } })), null, 'no gallery check: the description alone completes an update');
  assert.equal(pageBehind(pack({ page: { filled: { version: '1.2' } } })).filled, true);
  assert.equal(pageBehind(pack({ page: { filled: { version: '1.1' } } })).filled, false, 'an older fill does not hide a newer release');

  const handMade = pack();
  delete handMade.versions[2].manual;
  assert.equal(tracksPage(handMade), false, 'a version only found on CurseForge keeps its hand-written page');
  assert.equal(pageBehind(handMade), null);
  const waiting = pack();
  Object.assign(waiting.versions[2], { manual: true, fileId: null });
  assert.equal(pageBehind(waiting), null, 'the file still waits for a manual upload');
  assert.equal(pageBehind(pack({ cfProjectId: null })), null);
});

test('Core API reader: description HTML', async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => { calls.push([url, opts.headers['x-api-key']]); return { ok: true, json: async () => ({ data: '<p>Hi</p>' }) }; };
  assert.equal(await getDescription(1503504, { key: 'k', fetchImpl }), '<p>Hi</p>');
  assert.deepEqual(calls, [['https://api.curseforge.com/v1/mods/1503504/description', 'k']]);
  await assert.rejects(getDescription(1, { fetchImpl }), /CF_CORE_API_KEY/);
});
