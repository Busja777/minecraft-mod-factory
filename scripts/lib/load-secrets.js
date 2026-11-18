import { loadEnvFile } from './env-file.js';

// Side-effect import for entry scripts: `import './lib/load-secrets.js';` as the FIRST import.
// Loads ./secrets.env literally (keeps "$2a$..." intact) without overriding variables that are
// already set, so GitHub Actions secrets still win. No file → nothing happens.
loadEnvFile('./secrets.env');
