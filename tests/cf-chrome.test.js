import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { helperLaunchOptions, plainChromeArgs, profileInUse } from '../scripts/lib/cf-browser/chrome.js';

test('helper Chrome: keychain cookies like plain Chrome, normal sandbox, automation stays visible', () => {
  const o = helperLaunchOptions();
  assert.equal(o.channel, 'chrome');
  assert.equal(o.chromiumSandbox, true);
  assert.deepEqual(o.ignoreDefaultArgs, ['--use-mock-keychain', '--password-store=basic']);
  assert.ok(!o.ignoreDefaultArgs.includes('--enable-automation'), 'the automation banner is never hidden');
  assert.ok(!(o.args || []).some(a => /AutomationControlled/.test(a)), 'no switch that hides automation');
});

test('plain Chrome login: own profile, the start page, no automation or debugging port', () => {
  const args = plainChromeArgs('/p/profile', 'https://authors.curseforge.com/');
  assert.equal(args[0], '--user-data-dir=/p/profile');
  assert.equal(args.at(-1), 'https://authors.curseforge.com/');
  assert.ok(!args.some(a => /remote-debugging|enable-automation/.test(a)));
});

test('profileInUse: a live lock counts, a lock left by a crash does not', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-profile-'));
  assert.equal(profileInUse(dir), false, 'no lock');
  fs.symlinkSync('mac.local-4242', path.join(dir, 'SingletonLock'));
  assert.equal(profileInUse(dir, { alive: pid => pid === 4242 }), true);
  assert.equal(profileInUse(dir, { alive: () => false }), false);
  fs.rmSync(dir, { recursive: true, force: true });
});
