// Runs the shared Gradle build of the Fabric mods (tools/java/fabric/) for one mod of the series.
// Gradle itself and every download (Minecraft, mappings, Fabric) live in ~/.gradle; the wrapper
// pins Gradle 8.8 because Loom 1.7 needs Gradle 8.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

export const FABRIC = path.dirname(fileURLToPath(import.meta.url));
const GRADLEW = path.join(FABRIC, 'gradlew');

// Java 21 for Gradle: JAVA_21 (a java binary, as in vanilla.js), then a JAVA_HOME that is 21, then Homebrew.
export function javaHome() {
  const candidates = [];
  if (process.env.JAVA_21) candidates.push(path.resolve(process.env.JAVA_21, '..', '..'));
  if (process.env.JAVA_HOME) candidates.push(process.env.JAVA_HOME);
  candidates.push('/opt/homebrew/opt/openjdk@21', '/usr/local/opt/openjdk@21');
  for (const home of candidates) {
    const java = path.join(home, 'bin', 'java');
    if (!fs.existsSync(java)) continue;
    const r = spawnSync(java, ['-version'], { encoding: 'utf-8' });
    if (r.status === 0 && /version "21[."]/.test(r.stderr)) return home;
  }
  return null;
}

// → { status, output }. Throws when Java 21 is missing.
export function gradle(args, { quiet = false } = {}) {
  const home = javaHome();
  if (!home) throw new Error('Java 21 is missing; brew install openjdk@21 (or set JAVA_21 to its java binary)');
  const r = spawnSync(GRADLEW, ['--console=plain', ...args], {
    cwd: FABRIC,
    env: { ...process.env, JAVA_HOME: home },
    encoding: 'utf-8',
    stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    maxBuffer: 64 * 1024 * 1024
  });
  if (r.error) throw r.error;
  return { status: r.status, output: `${r.stdout || ''}${r.stderr || ''}` };
}

// The remapped (upload-ready) jar Gradle builds for a mod and version.
export const builtJar = (mod, version) => path.join(mod.dir, 'build', 'libs', `${mod.slug}-${version}.jar`);

// Whether a mod has in-world tests (src/gametest, run on a headless game test server).
export const hasGameTests = mod => fs.existsSync(path.join(mod.dir, 'src', 'gametest'));
