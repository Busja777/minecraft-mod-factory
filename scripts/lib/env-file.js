import fs from 'fs';

// Reads KEY=VALUE lines literally (no shell expansion, so "$2a$..." stays intact).
export function readEnvFile(file = './secrets.env') {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf-8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=(.*)$/.exec(line);
    if (!m) continue;
    const v = m[2].trim().replace(/^(['"])(.*)\1$/, '$2');
    if (v) out[m[1]] = v;
  }
  return out;
}

export function loadEnvFile(file) {
  for (const [k, v] of Object.entries(readEnvFile(file))) if (!process.env[k]) process.env[k] = v;
}
