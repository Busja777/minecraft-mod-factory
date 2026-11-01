import { loadProjects, findPending } from './lib/cf-projects.js';

// Prints the modIds that have a CurseForge projectId but no uploaded file yet (space separated).
const pending = findPending(loadProjects());
console.error(`${pending.length} pending mod(s) ready to publish`);
process.stdout.write(pending.map(p => p.modId).join(' '));
