import { test } from 'node:test';
import assert from 'node:assert/strict';
import AdmZip from 'adm-zip';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadReihen } from '../scripts/lib/serie.js';
import { listReleaseProjects, loadReleaseProject, releaseFile } from '../scripts/lib/releases.js';
import * as wow from '../tools/wow/lib.js';
import * as java from '../tools/java/lib.js';
import * as stardew from '../tools/stardew/lib.js';
import * as bedrock from '../tools/bedrock/lib.js';
import { samplesReady, samplesOf } from '../tools/bedrock/samples.js';
import { versionDir } from '../tools/java/vanilla.js';

// What goes online is the file in the stock, not the source. For the newest version of every
// project the stock file must hold exactly what a fresh build of the source gives, so a stock
// file can never carry something the checks did not see. (Older versions cannot be rebuilt, the
// source has moved on; mod jars are compiled and are compared by their mod id and version only.)
const entries = file => Object.fromEntries(new AdmZip(file).getEntries().filter(e => !e.isDirectory).map(e => [e.entryName, e.getData()]));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vorrat-'));
const vanillaReady = v => fs.existsSync(path.join(versionDir(v), '.complete'));
const vanillaOf = v => { const dir = versionDir(v); return { dir, data: path.join(dir, 'data'), reports: path.join(dir, 'reports'), assets: path.join(dir, 'assets'), sounds: path.join(dir, 'sounds.json') }; };

function same(a, b, label) {
  assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort(), `${label}: different files`);
  for (const k of Object.keys(a)) assert.ok(a[k].equals(b[k]), `${label}: ${k} differs from a fresh build`);
}

const stocked = new Set(listReleaseProjects());
for (const reihe of loadReihen()) {
  for (const project of reihe.projects) {
    if (!stocked.has(project.slug)) continue;
    const newest = loadReleaseProject(project.slug).versions.at(-1);
    if (!newest) continue;
    const file = releaseFile(project.slug, newest.file);
    const label = `${project.slug} V${newest.version}`;

    if (reihe.reihe === 'wow') {
      test(`stock = source: ${label}`, () => {
        const a = wow.addonOf(project.slug);
        same(entries(file), entries(wow.buildZip(a, newest.version, tmp())), label);
      });
    } else if (reihe.reihe === 'java') {
      const pack = java.packOf(project.slug);
      if (java.isMod(pack)) {
        test(`stock = source: ${label} (mod id and version)`, () => {
          const mod = JSON.parse(entries(file)['fabric.mod.json'].toString('utf-8'));
          assert.equal(mod.id, pack.modId);
          assert.equal(mod.version, newest.version);
        });
      } else {
        test(`stock = source: ${label}`, { skip: !java.versionsOf(pack).every(vanillaReady) && 'vanilla data not downloaded yet' }, async () => {
          const files = await java.generate(pack, vanillaOf(pack.mc));
          const more = [];
          for (const mc of pack.also || []) more.push({ mc, files: await java.generate(pack, vanillaOf(mc), mc) });
          same(entries(file), entries(await java.buildZip(pack, files, newest.version, tmp(), more)), label);
        });
      }
    } else if (reihe.reihe === 'bedrock') {
      const pack = bedrock.packOf(project.slug);
      test(`stock = source: ${label}`, { skip: !samplesReady(pack.samples) && 'bedrock-samples not downloaded yet' }, async () => {
        const files = await bedrock.generate(pack, samplesOf(pack.samples));
        same(entries(file), entries(await bedrock.buildPack(pack, files, newest.version, tmp())), label);
      });
    } else if (reihe.reihe === 'stardew') {
      test(`stock = source: ${label}`, async () => {
        const pack = stardew.packOf(project.slug);
        const files = await stardew.generate(pack, stardew.loadRef(), newest.version);
        same(entries(file), entries(stardew.buildZip(pack, files, newest.version, tmp())), label);
      });
    }
  }
}
