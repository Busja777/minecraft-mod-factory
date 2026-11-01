import fs from 'fs';

// Appends key=value pairs to $GITHUB_OUTPUT when running in Actions; always logs them.
export function setOutputs(values) {
  for (const [k, v] of Object.entries(values)) {
    console.log(`::output ${k}=${v}`);
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`);
  }
}

export function arg(argv, name, fallback = undefined) {
  const i = argv.indexOf(name);
  if (i === -1) return fallback;
  return argv[i + 1] ?? fallback;
}

export function flag(argv, name) {
  return argv.includes(name);
}
