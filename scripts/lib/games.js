import { kindOf } from './cf-projects.js';

// Game register (config.games): every game whose updates run through the CurseForge upload API.
//   { name, gameEndpoint, gameId, urlSection, versionTypes?, account?, tokenEnv? }
// account: the upload leg of the game (default: the game key). Games on the same leg share the
//   "at most one upload per day" rule. Java and Bedrock are two legs with the same token.
// carryNewer: false → a file only gets the versions it was built for (Minecraft Java).
// tokenEnv: name of the secret with that account's upload token (default: CF_API_TOKEN_<ACCOUNT>).

export const tokenEnvName = account => `CF_API_TOKEN_${String(account).toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;

export function gameOf(config, key) {
  const g = config.games?.[key];
  if (!g) throw new Error(`Unknown game "${key}" — add it under "games" in config.json`);
  const account = g.account || key;
  return { key, ...g, account, tokenEnv: g.tokenEnv || tokenEnvName(account) };
}

// Entries written before the register existed have no `game`: skin packs are Bedrock, mods are Java.
export const gameKeyOf = p => p.game || (kindOf(p) === 'skinpack' ? 'bedrock' : 'java');

export const accountOf = (config, project) => gameOf(config, gameKeyOf(project)).account;

// The upload token of the game's account, or null. Never log the value.
export const tokenFor = (game, env = process.env) => env[game.tokenEnv] || null;

// A series project whose page exists (ID entered = the operator's Go) and that waits for its first file.
export const awaitsFirstFile = p => kindOf(p) === 'file' && p.status === 'pending' && p.autoStart === true && Number.isInteger(p.projectId);

// Accounts that own at least one project the evening run could upload to. → [{ account, tokenEnv }]
export function activeAccounts(config, projects) {
  const seen = new Map();
  for (const p of projects) {
    if (!Number.isInteger(p.projectId) || !(p.status === 'published' || awaitsFirstFile(p))) continue;
    const g = gameOf(config, gameKeyOf(p));
    if (!seen.has(g.account)) seen.set(g.account, { account: g.account, tokenEnv: g.tokenEnv });
  }
  return [...seen.values()].sort((a, b) => a.account.localeCompare(b.account));
}
