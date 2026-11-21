// Trigger Homes: /trigger sethome, /trigger home and /trigger spawn for every player, no operator
// rights needed. Plain functions and scoreboards, the same files for 1.21.1 and 26.3 (both read the
// commands below the same way; checked against reports/commands.json of each version).
//
// How it works
// - load: creates the three trigger objectives (what players type) and the pack's own dummy
//   objectives th.x, th.y, th.z (block position), th.dim (1 Overworld, 2 Nether, 3 End, unset =
//   no home), th.cd (cooldown in ticks) and th.tmp (scratch values, constant #20).
// - tick: counts every cooldown down, runs the handler of each player who used a trigger, clears
//   negative values (/trigger home set -1) and enables the triggers again (the game disables a
//   trigger objective for a player after each use).
// - sethome (as and at the player): stores the block position (data get floors the coordinates)
//   and the dimension. Other dimensions (from other data packs) are refused.
// - home: copies the position into the storage trigger_homes:tp and calls the macro function
//   teleport "in" the stored dimension, so a home in the Nether works from the Overworld too.
//   Whole numbers in tp are block centres for x and z, so the player lands in the middle of the block.
// - spawn: tick functions run as the server, whose position is the world spawn (1.21.1: the
//   Overworld spawn point; 26.x: the respawn point in its dimension), so `tp @s ~0.5 ~ ~0.5` from
//   there lands on the world spawn.
// - home and spawn share one cooldown; sethome has none.
// Text components are written so that both the JSON reader of 1.21.1 and the SNBT reader of 26.x
// accept them: quoted keys, strings only, lists that hold only compounds.
const NS = 'trigger_homes';
const fn = name => `${NS}:${name}`;

export const COOLDOWN_SECONDS = 30;
export const TRIGGERS = ['sethome', 'home', 'spawn'];
// [score, dimension id, name in messages]
export const DIMENSIONS = [
  [1, 'minecraft:overworld', 'the Overworld'],
  [2, 'minecraft:the_nether', 'the Nether'],
  [3, 'minecraft:the_end', 'the End']
];
export const OBJ = { x: 'th.x', y: 'th.y', z: 'th.z', dim: 'th.dim', cd: 'th.cd', tmp: 'th.tmp' };
const STORAGE = `${NS}:tp`;

// ── text ──────────────────────────────────────────────────────────────────────────────────────
const t = text => ({ text });
const score = objective => ({ score: { name: '@s', objective } });
const msg = (color, text, extra) => JSON.stringify(extra ? { text, color, extra } : { text, color });
const tell = (color, text, extra) => `tellraw @s ${msg(color, text, extra)}`;
const position = [score(OBJ.x), t(' '), score(OBJ.y), t(' '), score(OBJ.z)];

// ── functions ─────────────────────────────────────────────────────────────────────────────────
export function functions() {
  const f = {};
  f.load = [
    ...TRIGGERS.map(name => `scoreboard objectives add ${name} trigger`),
    ...Object.values(OBJ).map(o => `scoreboard objectives add ${o} dummy`),
    `scoreboard players set #20 ${OBJ.tmp} 20`
  ];
  f.tick = [
    `scoreboard players remove @a[scores={${OBJ.cd}=1..}] ${OBJ.cd} 1`,
    `execute as @a[scores={sethome=1..}] at @s run function ${fn('sethome')}`,
    `execute as @a[scores={home=1..}] at @s run function ${fn('home')}`,
    // Not "at @s": the server's own position is the world spawn.
    `execute as @a[scores={spawn=1..}] run function ${fn('spawn')}`,
    ...TRIGGERS.map(name => `scoreboard players set @a[scores={${name}=..-1}] ${name} 0`),
    ...TRIGGERS.map(name => `scoreboard players enable @a ${name}`)
  ];
  f.sethome = [
    'scoreboard players set @s sethome 0',
    `scoreboard players set @s ${OBJ.tmp} 0`,
    ...DIMENSIONS.map(([n, id]) => `execute if dimension ${id} run scoreboard players set @s ${OBJ.tmp} ${n}`),
    `execute if score @s ${OBJ.tmp} matches 0 run ${tell('red', 'Homes can only be set in the Overworld, the Nether and the End.')}`,
    `execute if score @s ${OBJ.tmp} matches 0 run return fail`,
    `scoreboard players operation @s ${OBJ.dim} = @s ${OBJ.tmp}`,
    ...['x', 'y', 'z'].map((axis, i) => `execute store result score @s ${OBJ[axis]} run data get entity @s Pos[${i}]`),
    ...DIMENSIONS.map(([n, , name]) => `execute if score @s ${OBJ.dim} matches ${n} run ${tell('green', 'Home set at ', [...position, t(` in ${name}. Type /trigger home to come back.`)])}`)
  ];
  const cooldownCheck = [
    `execute if score @s ${OBJ.cd} matches 1.. run function ${fn('cooldown')}`,
    `execute if score @s ${OBJ.cd} matches 1.. run return fail`
  ];
  const startCooldown = `scoreboard players set @s ${OBJ.cd} ${COOLDOWN_SECONDS * 20}`;
  f.home = [
    'scoreboard players set @s home 0',
    `execute unless score @s ${OBJ.dim} matches 1..${DIMENSIONS.length} run ${tell('red', 'You have no home yet. Stand where you want it and type /trigger sethome.')}`,
    `execute unless score @s ${OBJ.dim} matches 1..${DIMENSIONS.length} run return fail`,
    ...cooldownCheck,
    ...['x', 'y', 'z'].map(axis => `execute store result storage ${STORAGE} ${axis} int 1 run scoreboard players get @s ${OBJ[axis]}`),
    ...DIMENSIONS.map(([n, id]) => `execute if score @s ${OBJ.dim} matches ${n} in ${id} run function ${fn('teleport')} with storage ${STORAGE}`),
    startCooldown,
    tell('green', 'Welcome home.')
  ];
  f.spawn = [
    'scoreboard players set @s spawn 0',
    ...cooldownCheck,
    'tp @s ~0.5 ~ ~0.5',
    startCooldown,
    tell('green', 'Teleported to the world spawn.')
  ];
  f.cooldown = [
    // seconds left, rounded up
    `scoreboard players operation @s ${OBJ.tmp} = @s ${OBJ.cd}`,
    `scoreboard players add @s ${OBJ.tmp} 19`,
    `scoreboard players operation @s ${OBJ.tmp} /= #20 ${OBJ.tmp}`,
    tell('yellow', 'You can teleport again in ', [score(OBJ.tmp), t(' s.')])
  ];
  // Macro: whole block coordinates from the storage; the caller sets the dimension with "execute in".
  f.teleport = ['$tp @s $(x) $(y) $(z)'];
  return f;
}

// Every "function <ns>:<name>" must point to a function of the pack.
export function checkFunctions(f) {
  for (const [name, lines] of Object.entries(f)) {
    for (const line of lines) {
      for (const m of line.matchAll(new RegExp(`function ${NS}:([a-z_/]+)`, 'g'))) {
        if (!f[m[1]]) throw new Error(`${name}: calls missing function ${m[1]}`);
      }
      if (line.startsWith('$') !== (name === 'teleport')) throw new Error(`${name}: only "teleport" is a macro function`);
      if (/[^\x20-\x7E]/.test(line)) throw new Error(`${name}: non-ASCII text in "${line}"`);
    }
  }
}

export default async function () {
  const f = functions();
  checkFunctions(f);
  const files = {
    'data/minecraft/tags/function/load.json': { values: [fn('load')] },
    'data/minecraft/tags/function/tick.json': { values: [fn('tick')] }
  };
  for (const [name, lines] of Object.entries(f)) files[`data/${NS}/function/${name}.mcfunction`] = lines.join('\n') + '\n';
  return files;
}
