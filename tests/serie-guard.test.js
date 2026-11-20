import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { guardPullRequest, isContent, AUTO_BRANCH } from '../scripts/lib/serie-guard.js';

const repo = 'Busja777/minecraft-mod-factory';
const ok = { headRepo: repo, baseRepo: repo, headRef: 'serie/auto-2026-11-21', ciConclusion: 'success' };

test('content of the series is merged without the operator', () => {
  const files = [
    'tools/wow/projects/fishing-log/src/FishingLog/Core.lua',
    'tools/java/projects/ore-abundance/pack.js',
    'tools/stardew/projects/more-to-say/page.json',
    'tools/bedrock/projects/calm-creepers/pack.js',
    'data/projects/fishing-log/project.json',
    'data/projects/fishing-log/files/FishingLog-1.0.zip',
    'data/serie/wow.json',
    'data/radar/versions.json'
  ];
  assert.deepEqual(guardPullRequest({ ...ok, files }), { merge: true, reasons: [] });
});

test('anything that builds, checks, merges or uploads waits for the operator', () => {
  for (const file of [
    'scripts/release.js', 'scripts/lib/serie-guard.js', '.github/workflows/evening.yml', 'tests/serie.test.js',
    'tools/wow/lib.js', 'tools/wow/client/wow.lua', 'tools/java/vanilla.js', 'tools/serie/cover.js',
    'config.json', 'package.json', 'CLAUDE.md', 'data/cf-projects.json', 'secrets.env', 'tools/wow/BRIEF.md',
    'tools/wow/projects/x/package.json', 'tools/java/projects/x/.github/workflows/a.yml', 'tools/wow/projects/x/run.sh',
    'data/projects/x/files/../../cf-projects.json', 'data/skins/glowing-samurai/pack.json'
  ]) {
    assert.equal(isContent(file), false, file);
    const r = guardPullRequest({ ...ok, files: ['data/serie/wow.json', file] });
    assert.equal(r.merge, false, file);
    assert.match(r.reasons.join(' '), /more than content/);
  }
});

test('only green pull requests from serie/auto branches of this repository', () => {
  const files = ['data/serie/wow.json'];
  assert.match(guardPullRequest({ ...ok, files, headRepo: 'someone/fork' }).reasons[0], /not in this repository/);
  assert.match(guardPullRequest({ ...ok, files, headRef: 'feat/new-rules' }).reasons[0], /not serie\/auto/);
  assert.match(guardPullRequest({ ...ok, files, headRef: 'serie/auto-' }).reasons[0], /not serie\/auto/);
  assert.match(guardPullRequest({ ...ok, files, ciConclusion: 'failure' }).reasons[0], /tests are failure/);
  assert.match(guardPullRequest({ ...ok, files, ciConclusion: undefined }).reasons[0], /tests are missing/);
  assert.match(guardPullRequest({ ...ok, files: [] }).reasons[0], /changes no files/);
  assert.ok(AUTO_BRANCH.test('serie/auto-2026-11-21'));
});

test('the merge workflow decides on main and never runs the pull request\'s code', () => {
  const yml = fs.readFileSync('.github/workflows/serie-merge.yml', 'utf-8');
  assert.match(yml, /workflow_run:\s+workflows: \[Tests\]/);
  assert.match(yml, /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/);
  assert.doesNotMatch(yml, /ref: \$\{\{ github\.event\.workflow_run\.head/, 'never check out the PR head');
  assert.doesNotMatch(yml, /run:[^\n]*\$\{\{ github\.event\.workflow_run\.head_branch/, 'branch names only through env');
  assert.match(yml, /--match-head-commit/);
  assert.match(fs.readFileSync('.github/workflows/ci.yml', 'utf-8'), /^name: Tests$/m);
});
