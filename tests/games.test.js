import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { gameOf, tokenEnvName, gameKeyOf, accountOf, tokenFor, activeAccounts } from '../scripts/lib/games.js';

const config = {
  games: {
    java: { name: 'Minecraft Java', account: 'minecraft', tokenEnv: 'CF_API_TOKEN', gameEndpoint: 'minecraft' },
    bedrock: { name: 'Minecraft Bedrock', account: 'minecraft', tokenEnv: 'CF_API_TOKEN', gameEndpoint: 'minecraft-bedrock' },
    stardewvalley: { name: 'Stardew Valley', gameEndpoint: 'stardewvalley' },
    'hogwarts-legacy': { name: 'Hogwarts Legacy', gameEndpoint: 'hogwarts-legacy' }
  }
};
const published = (modId, extra) => ({ modId, status: 'published', projectId: 1, ...extra });

test('a game without its own settings is its own account with its own token name', () => {
  const g = gameOf(config, 'stardewvalley');
  assert.equal(g.key, 'stardewvalley');
  assert.equal(g.account, 'stardewvalley');
  assert.equal(g.tokenEnv, 'CF_API_TOKEN_STARDEWVALLEY');
  assert.equal(gameOf(config, 'hogwarts-legacy').tokenEnv, 'CF_API_TOKEN_HOGWARTS_LEGACY');
  assert.equal(tokenEnvName('sims4'), 'CF_API_TOKEN_SIMS4');
  assert.throws(() => gameOf(config, 'tetris'), /Unknown game "tetris"/);
});

test('Java and Bedrock share the Minecraft account and its token', () => {
  assert.equal(gameOf(config, 'java').account, 'minecraft');
  assert.equal(gameOf(config, 'bedrock').tokenEnv, 'CF_API_TOKEN');
  assert.equal(accountOf(config, { kind: 'skinpack' }), 'minecraft');
  assert.equal(accountOf(config, { kind: 'file', game: 'stardewvalley' }), 'stardewvalley');
});

test('entries from before the register: skin packs are Bedrock, mods are Java', () => {
  assert.equal(gameKeyOf({ kind: 'skinpack' }), 'bedrock');
  assert.equal(gameKeyOf({}), 'java');
  assert.equal(gameKeyOf({ kind: 'file', game: 'wow' }), 'wow');
});

test('tokenFor reads the token of the game\'s own account only', () => {
  const env = { CF_API_TOKEN: 'main', CF_API_TOKEN_STARDEWVALLEY: 'stardew' };
  assert.equal(tokenFor(gameOf(config, 'bedrock'), env), 'main');
  assert.equal(tokenFor(gameOf(config, 'stardewvalley'), env), 'stardew');
  assert.equal(tokenFor(gameOf(config, 'hogwarts-legacy'), env), null, 'never falls back to another account');
});

test('activeAccounts lists each account with a published project once', () => {
  const projects = [
    published('a', { kind: 'skinpack', game: 'bedrock' }),
    published('b', { kind: 'mod' }),
    published('c', { kind: 'file', game: 'stardewvalley' }),
    { modId: 'd', kind: 'file', game: 'hogwarts-legacy', status: 'pending', projectId: 5 },
    { modId: 'e', kind: 'mod', status: 'published', projectId: null }
  ];
  assert.deepEqual(activeAccounts(config, projects), [
    { account: 'minecraft', tokenEnv: 'CF_API_TOKEN' },
    { account: 'stardewvalley', tokenEnv: 'CF_API_TOKEN_STARDEWVALLEY' }
  ]);
  assert.deepEqual(activeAccounts(config, []), []);
});

test('config.json: every game is complete and every project belongs to a known game', () => {
  const real = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
  const keys = Object.keys(real.games);
  assert.ok(keys.includes('java') && keys.includes('bedrock'));
  for (const k of keys) {
    const g = gameOf(real, k);
    assert.ok(g.name && g.gameEndpoint && g.urlSection && Number.isInteger(g.gameId), `game ${k} is incomplete`);
    assert.match(g.tokenEnv, /^CF_API_TOKEN(_[A-Z0-9_]+)?$/);
  }
  assert.equal(gameOf(real, 'bedrock').gameEndpoint, real.bedrock.gameEndpoint);
  assert.equal(gameOf(real, 'java').account, gameOf(real, 'bedrock').account, 'one account, one update per day');
  for (const p of JSON.parse(fs.readFileSync('./data/cf-projects.json', 'utf-8'))) gameOf(real, gameKeyOf(p));
});
