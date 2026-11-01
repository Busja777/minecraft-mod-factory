import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { matchGameVersionIds, buildMetadata, uploadFile, resolveGameVersions } from '../scripts/platforms/curseforge.js';

const catalog = {
  types: [
    { id: 1, name: 'Minecraft 1.12', slug: 'minecraft-1-12' },
    { id: 2, name: 'Minecraft 1.21', slug: 'minecraft-1-21' },
    { id: 3, name: 'Java', slug: 'java' },
    { id: 4, name: 'Modloader', slug: 'modloader' },
    { id: 5, name: 'Environment', slug: 'environment' }
  ],
  versions: [
    { id: 101, gameVersionTypeID: 1, name: '1.12' },
    { id: 102, gameVersionTypeID: 2, name: '1.21' },
    { id: 103, gameVersionTypeID: 2, name: '1.21.1' },
    { id: 201, gameVersionTypeID: 3, name: 'Java 21' },
    { id: 301, gameVersionTypeID: 4, name: 'Fabric' },
    { id: 302, gameVersionTypeID: 4, name: 'Forge' },
    { id: 401, gameVersionTypeID: 5, name: 'Server' },
    { id: 402, gameVersionTypeID: 5, name: 'Client' }
  ]
};

test('matchGameVersionIds resolves mc, loader, java and environments', () => {
  const r = matchGameVersionIds(catalog, { mcVersion: '1.21.1' });
  assert.deepEqual(r.ids, [103, 301, 201, 401, 402]);
  assert.deepEqual(r.warnings, []);
});

test('matchGameVersionIds throws when mc version or loader missing, warns on optional', () => {
  assert.throws(() => matchGameVersionIds(catalog, { mcVersion: '1.20.1' }), /"1.20.1" not found/);
  assert.throws(() => matchGameVersionIds(catalog, { mcVersion: '1.21.1', loader: 'Quilt' }), /"Quilt" not found/);
  const r = matchGameVersionIds(catalog, { mcVersion: '1.21.1', java: 'Java 25' });
  assert.deepEqual(r.ids, [103, 301, 401, 402]);
  assert.match(r.warnings[0], /Java 25/);
});

test('buildMetadata validates inputs', () => {
  const md = buildMetadata({ changelog: '## 1.0.0\n- x', displayName: 'X v1.0.0', releaseType: 'release', gameVersionIds: [1, 2] });
  assert.equal(md.changelogType, 'markdown');
  assert.throws(() => buildMetadata({ changelog: ' ', displayName: 'X', gameVersionIds: [1] }), /changelog/);
  assert.throws(() => buildMetadata({ changelog: 'x', displayName: 'X', releaseType: 'final', gameVersionIds: [1] }), /releaseType/);
  assert.throws(() => buildMetadata({ changelog: 'x', displayName: 'X', gameVersionIds: [] }), /gameVersionIds/);
});

function fakeFetch(handler) {
  const calls = [];
  const fn = async (url, init) => { calls.push({ url, init }); return handler(url, init); };
  fn.calls = calls;
  return fn;
}
const okJson = body => ({ ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body });

test('uploadFile posts multipart with token header and returns fileId', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-'));
  const jar = path.join(dir, 'demo-1.0.0.jar');
  fs.writeFileSync(jar, 'JARBYTES');
  const f = fakeFetch(() => okJson({ id: 987 }));
  const r = await uploadFile({ token: 'tok', projectId: 123, jarPath: jar, metadata: { changelog: 'c', releaseType: 'alpha', gameVersions: [1] }, fetchImpl: f });
  assert.equal(r.fileId, 987);
  const { url, init } = f.calls[0];
  assert.equal(url, 'https://minecraft.curseforge.com/api/projects/123/upload-file');
  assert.equal(init.headers['X-Api-Token'], 'tok');
  assert.match(init.headers['content-type'], /multipart\/form-data/);
  assert.ok(Buffer.isBuffer(init.body));
  const body = init.body.toString();
  assert.match(body, /name="metadata"/);
  assert.match(body, /"releaseType":"alpha"/);
  assert.match(body, /filename="demo-1.0.0.jar"/);
  assert.match(body, /JARBYTES/);
});

test('uploadFile formats CurseForge error payloads', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-'));
  const jar = path.join(dir, 'x.jar'); fs.writeFileSync(jar, 'x');
  const f = fakeFetch(() => ({ ok: false, status: 400, text: async () => JSON.stringify({ errorCode: 1009, errorMessage: 'Invalid game version ID' }) }));
  await assert.rejects(uploadFile({ token: 't', projectId: 1, jarPath: jar, metadata: {}, fetchImpl: f }), /code 1009.*Invalid game version ID/);
  await assert.rejects(uploadFile({ token: '', projectId: 1, jarPath: jar, metadata: {} }), /CF_API_TOKEN/);
  await assert.rejects(uploadFile({ token: 't', projectId: 'abc', jarPath: jar, metadata: {} }), /projectId/);
});

test('resolveGameVersions fetches once and then serves from cache', async () => {
  const cachePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cf-')), 'cache.json');
  const f = fakeFetch(url => okJson(url.endsWith('version-types') ? catalog.types : catalog.versions));
  const first = await resolveGameVersions({ token: 't', mcVersion: '1.21.1', cachePath, fetchImpl: f });
  assert.deepEqual(first.ids, [103, 301, 201, 401, 402]);
  assert.equal(first.fromCache, false);
  assert.equal(f.calls.length, 2);
  const second = await resolveGameVersions({ token: 't', mcVersion: '1.21.1', cachePath, fetchImpl: f });
  assert.equal(second.fromCache, true);
  assert.equal(f.calls.length, 2);
});

import { matchBedrockVersionIds } from '../scripts/platforms/curseforge.js';

test('matchBedrockVersionIds picks every 26.x release version and skips previews', () => {
  const catalog = {
    types: [{ id: 1, name: 'Minecraft Bedrock', slug: 'bedrock' }, { id: 2, name: 'Bedrock Preview', slug: 'bedrock-preview' }],
    versions: [
      { id: 10, gameVersionTypeID: 1, name: '26.0' }, { id: 11, gameVersionTypeID: 1, name: '26.0.02' },
      { id: 12, gameVersionTypeID: 1, name: '26.3' }, { id: 13, gameVersionTypeID: 1, name: '26.10' },
      { id: 14, gameVersionTypeID: 1, name: '1.21.130' }, { id: 15, gameVersionTypeID: 2, name: '26.20' }
    ]
  };
  assert.deepEqual(matchBedrockVersionIds(catalog, { prefix: '26.' }), [10, 11, 12, 13]);
  assert.deepEqual(matchBedrockVersionIds(catalog, { prefix: '26.', include: ['1.21.130'] }), [10, 11, 12, 13, 14]);
  assert.throws(() => matchBedrockVersionIds(catalog, { prefix: '27.' }), /No CurseForge Bedrock/);
});

import { redact } from '../scripts/platforms/curseforge.js';

test('redact removes token fragments echoed by CurseForge', () => {
  assert.equal(redact('API token is malformed. Token provided: abc.DEF123.'), 'API token is malformed. Token provided: [redacted]');
});
