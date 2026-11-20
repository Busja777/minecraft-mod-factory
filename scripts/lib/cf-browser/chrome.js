// How the helper's Chrome is started.
//
// Google refuses sign-ins in a browser that is remote-controlled (Playwright). That check is not
// worked around: the operator logs in once in a plain Chrome window on the helper's own profile,
// with no automation attached (`npm run cf -- login`). The helper then reuses the CurseForge session
// stored in that profile and never touches the Google sign-in.
//
// For the session to survive the switch, both ways must store cookies the same way: Playwright's
// defaults put cookies under a mock keychain, plain Chrome uses the macOS keychain. So the helper
// drops those two storage switches, and runs with Chrome's normal sandbox instead of --no-sandbox.
import fs from 'fs';

export const CHROME_BIN = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Playwright launch options for the helper window.
export function helperLaunchOptions() {
  return {
    channel: 'chrome',
    headless: false,
    slowMo: 250,
    viewport: null,
    chromiumSandbox: true,
    ignoreDefaultArgs: ['--use-mock-keychain', '--password-store=basic']
  };
}

// Arguments for a plain Chrome window on the helper profile (no automation, no debugging port).
export function plainChromeArgs(profile, url) {
  return [`--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--new-window', url];
}

// True while a Chrome instance holds the profile. Chrome's SingletonLock is a symlink "<host>-<pid>";
// a lock left behind by a crash (pid gone) does not count.
export function profileInUse(profile, { alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } } } = {}) {
  let target;
  try { target = fs.readlinkSync(`${profile}/SingletonLock`); } catch { return false; }
  const pid = Number(String(target).split('-').pop());
  return Number.isInteger(pid) && pid > 0 ? alive(pid) : true;
}

export const LOGIN_HINT = 'Du bist im Helfer-Fenster nicht bei CurseForge eingeloggt. Google erlaubt dort keine Anmeldung. '
  + 'Bitte dieses Fenster schließen, im Terminal `npm run cf -- login` ausführen (öffnet ein normales Chrome) und danach neu starten.';
