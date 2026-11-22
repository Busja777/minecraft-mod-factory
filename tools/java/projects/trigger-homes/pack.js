// Trigger Homes: /trigger sethome, /trigger home, /trigger spawn, /trigger back and /trigger homes for every player, no operator
// rights needed. Plain functions and scoreboards, the same files for 1.21.1 and 26.3 (both read the
// commands below the same way; checked against reports/commands.json of each version).
//
// How it works
// - load: creates the three trigger objectives (what players type) and the pack's own dummy
//   objectives: per home the block position and dimension (1 Overworld, 2 Nether, 3 End, unset =
//   no home), th.cd (cooldown in ticks), th.n (the home number asked for) and th.tmp (scratch
//   values, constant #20).
// - Up to three homes per player (since V1.1). A trigger only carries a number, so the home is
//   picked with it: /trigger sethome (adds 1 to 0, so home 1), /trigger sethome set 2,
//   /trigger home set 3 … Home 1 keeps the objectives of V1.0 (th.x, th.y, th.z, th.dim), so every
//   home set with V1.0 simply is home 1, also for players who are offline during the update;
//   homes 2 and 3 use th.x2 … th.dim3.
// - tick: counts every cooldown down, runs the handler of each player who used a trigger, clears
//   negative values (/trigger home set -1) and enables the triggers again (the game disables a
//   trigger objective for a player after each use).
// - sethome (as and at the player): stores the block position (data get floors the coordinates)
//   and the dimension in the home asked for. Numbers other than 1 to 3 and other dimensions (from
//   other data packs) are refused.
// - home: copies the position of the home asked for into the storage trigger_homes:tp and calls the
//   macro function teleport "in" the stored dimension, so a home in the Nether works from the
//   Overworld too. Whole numbers in tp are block centres for x and z, so the player lands in the
//   middle of the block.
// - spawn: tick functions run as the server, whose position is the world spawn (1.21.1: the
//   Overworld spawn point; 26.x: the respawn point in its dimension), so `tp @s ~0.5 ~ ~0.5` from
//   there lands on the world spawn.
// - back (since V1.2): takes the player to the place of their last death, once per death. The
//   game keeps that place on the player as LastDeathLocation {dimension: "<id>", pos: [I; x, y, z]}
//   (both jars, 1.21.1 and 26.3, write and read the field; GlobalPos codec "dimension"/"pos").
//   A deathCount objective (th.deaths) counts deaths since the pack was added and is set back to 0
//   after a successful back, so the trigger is no free teleport to an old spot. Only the three
//   vanilla dimensions; a death below the dimension's bottom (fell into the void) and a death spot
//   in lava are refused, nothing is used up then.
// - home, spawn and back share one cooldown (also across homes); sethome has none.
// - homes (since V1.3): lists the player's set homes, one tellraw each with the position, the
//   dimension and the command that goes there ("No homes yet" when none is set), the cooldown left
//   if any, and a hint with the commands. No teleport, so it neither needs nor starts the cooldown.
// Text components are written so that both the JSON reader of 1.21.1 and the SNBT reader of 26.x
// accept them: quoted keys, strings only, lists that hold only compounds.
const NS = 'trigger_homes';
const fn = name => `${NS}:${name}`;

export const COOLDOWN_SECONDS = 30;
export const TRIGGERS = ['sethome', 'home', 'spawn', 'back', 'homes'];
// [score, dimension id, name in messages, lowest block (vanilla dimension types)]
export const DIMENSIONS = [
  [1, 'minecraft:overworld', 'the Overworld', -64],
  [2, 'minecraft:the_nether', 'the Nether', 0],
  [3, 'minecraft:the_end', 'the End', 0]
];
// Since V1.2: deaths since the last /trigger back (deathCount) and the death spot's height.
export const DEATHS = 'th.deaths';
export const BACK_Y = 'th.by';
// Functions that are macros (read $(x) … from the storage).
export const MACROS = ['teleport', 'back_tp'];
export const OBJ = { x: 'th.x', y: 'th.y', z: 'th.z', dim: 'th.dim', cd: 'th.cd', tmp: 'th.tmp' };
// Since V1.1: the home number asked for (the trigger value).
export const PICK = 'th.n';
export const HOMES = [1, 2, 3];
// The objectives of home k. Home 1 keeps the names of V1.0, so V1.0 homes are home 1.
export const homeObj = k => Object.fromEntries(['x', 'y', 'z', 'dim'].map(a => [a, k === 1 ? OBJ[a] : `${OBJ[a]}${k}`]));
const STORAGE = `${NS}:tp`;
const XYZ = ['x', 'y', 'z'];

// ── text ──────────────────────────────────────────────────────────────────────────────────────
const t = text => ({ text });
const score = objective => ({ score: { name: '@s', objective } });
const msg = (color, text, extra) => JSON.stringify(extra ? { text, color, extra } : { text, color });
const tell = (color, text, extra) => `tellraw @s ${msg(color, text, extra)}`;
const position = k => { const o = homeObj(k); return [score(o.x), t(' '), score(o.y), t(' '), score(o.z)]; };
// What a player types for home k: home 1 is the plain trigger, as in V1.0.
const typed = (trigger, k) => (k === 1 ? `/trigger ${trigger}` : `/trigger ${trigger} set ${k}`);
const home = k => (k === 1 ? 'Home' : `Home ${k}`);

// ── functions ─────────────────────────────────────────────────────────────────────────────────
export function functions() {
  const f = {};
  f.load = [
    ...TRIGGERS.map(name => `scoreboard objectives add ${name} trigger`),
    ...Object.values(OBJ).map(o => `scoreboard objectives add ${o} dummy`),
    `scoreboard players set #20 ${OBJ.tmp} 20`,
    `scoreboard objectives add ${PICK} dummy`,
    ...HOMES.filter(k => k !== 1).flatMap(k => Object.values(homeObj(k)).map(o => `scoreboard objectives add ${o} dummy`)),
    `scoreboard objectives add ${DEATHS} deathCount`,
    `scoreboard objectives add ${BACK_Y} dummy`
  ];
  // Copies the trigger value to th.n, resets the trigger and refuses numbers that are no home.
  const pick = (trigger, what) => [
    `scoreboard players operation @s ${PICK} = @s ${trigger}`,
    `scoreboard players set @s ${trigger} 0`,
    `execute unless score @s ${PICK} matches 1..${HOMES.length} run ${tell('red', `There are homes 1 to ${HOMES.length}: ${typed(trigger, 2)} ${what} home 2.`)}`,
    `execute unless score @s ${PICK} matches 1..${HOMES.length} run return fail`
  ];
  const isHome = k => `if score @s ${PICK} matches ${k}`;
  f.tick = [
    `scoreboard players remove @a[scores={${OBJ.cd}=1..}] ${OBJ.cd} 1`,
    `execute as @a[scores={sethome=1..}] at @s run function ${fn('sethome')}`,
    `execute as @a[scores={home=1..}] at @s run function ${fn('home')}`,
    // Not "at @s": the server's own position is the world spawn.
    `execute as @a[scores={spawn=1..}] run function ${fn('spawn')}`,
    `execute as @a[scores={back=1..}] run function ${fn('back')}`,
    `execute as @a[scores={homes=1..}] run function ${fn('homes')}`,
    ...TRIGGERS.map(name => `scoreboard players set @a[scores={${name}=..-1}] ${name} 0`),
    ...TRIGGERS.map(name => `scoreboard players enable @a ${name}`)
  ];
  f.sethome = [
    ...pick('sethome', 'saves'),
    `scoreboard players set @s ${OBJ.tmp} 0`,
    ...DIMENSIONS.map(([n, id]) => `execute if dimension ${id} run scoreboard players set @s ${OBJ.tmp} ${n}`),
    `execute if score @s ${OBJ.tmp} matches 0 run ${tell('red', 'Homes can only be set in the Overworld, the Nether and the End.')}`,
    `execute if score @s ${OBJ.tmp} matches 0 run return fail`,
    ...HOMES.flatMap(k => {
      const o = homeObj(k);
      return [
        `execute ${isHome(k)} run scoreboard players operation @s ${o.dim} = @s ${OBJ.tmp}`,
        ...XYZ.map((axis, i) => `execute ${isHome(k)} store result score @s ${o[axis]} run data get entity @s Pos[${i}]`),
        ...DIMENSIONS.map(([n, , name]) => `execute ${isHome(k)} if score @s ${o.dim} matches ${n} run ${tell('green', `${home(k)} set at `, [...position(k), t(` in ${name}. Type ${typed('home', k)} to come back.`)])}`)
      ];
    })
  ];
  const cooldownCheck = [
    `execute if score @s ${OBJ.cd} matches 1.. run function ${fn('cooldown')}`,
    `execute if score @s ${OBJ.cd} matches 1.. run return fail`
  ];
  const startCooldown = `scoreboard players set @s ${OBJ.cd} ${COOLDOWN_SECONDS * 20}`;
  const noHome = k => `execute ${isHome(k)} unless score @s ${homeObj(k).dim} matches 1..${DIMENSIONS.length}`;
  f.home = [
    ...pick('home', 'takes you to'),
    ...HOMES.flatMap(k => [
      `${noHome(k)} run ${tell('red', `You have no ${k === 1 ? 'home' : `home ${k}`} yet. Stand where you want it and type ${typed('sethome', k)}.`)}`,
      `${noHome(k)} run return fail`
    ]),
    ...cooldownCheck,
    ...HOMES.flatMap(k => XYZ.map(axis => `execute ${isHome(k)} store result storage ${STORAGE} ${axis} int 1 run scoreboard players get @s ${homeObj(k)[axis]}`)),
    ...HOMES.flatMap(k => DIMENSIONS.map(([n, id]) => `execute ${isHome(k)} if score @s ${homeObj(k).dim} matches ${n} in ${id} run function ${fn('teleport')} with storage ${STORAGE}`)),
    startCooldown,
    ...HOMES.map(k => `execute ${isHome(k)} run ${tell('green', k === 1 ? 'Welcome home.' : `Welcome to home ${k}.`)}`)
  ];
  f.spawn = [
    'scoreboard players set @s spawn 0',
    ...cooldownCheck,
    'tp @s ~0.5 ~ ~0.5',
    startCooldown,
    tell('green', 'Teleported to the world spawn.')
  ];
  const DEATH = 'LastDeathLocation';
  f.back = [
    'scoreboard players set @s back 0',
    `execute unless score @s ${DEATHS} matches 1.. run ${tell('red', 'You have not died since your last /trigger back (or since this pack was added).')}`,
    `execute unless score @s ${DEATHS} matches 1.. run return fail`,
    `execute unless data entity @s ${DEATH} run ${tell('red', 'The game has no death point for you.')}`,
    `execute unless data entity @s ${DEATH} run return fail`,
    `scoreboard players set @s ${OBJ.tmp} 0`,
    ...DIMENSIONS.map(([n, id]) => `execute if data entity @s ${DEATH}{dimension:"${id}"} run scoreboard players set @s ${OBJ.tmp} ${n}`),
    `execute if score @s ${OBJ.tmp} matches 0 run ${tell('red', '/trigger back only works for deaths in the Overworld, the Nether and the End.')}`,
    `execute if score @s ${OBJ.tmp} matches 0 run return fail`,
    `execute store result score @s ${BACK_Y} run data get entity @s ${DEATH}.pos[1]`,
    ...DIMENSIONS.map(([n, , , bottom]) => `execute if score @s ${OBJ.tmp} matches ${n} if score @s ${BACK_Y} matches ..${bottom - 1} run ${tell('red', 'You died below the world. /trigger back will not take you into the void.')}`),
    ...DIMENSIONS.map(([n, , , bottom]) => `execute if score @s ${OBJ.tmp} matches ${n} if score @s ${BACK_Y} matches ..${bottom - 1} run return fail`),
    ...cooldownCheck,
    ...XYZ.map((axis, i) => `execute store result storage ${STORAGE} ${axis} int 1 run data get entity @s ${DEATH}.pos[${i}]`),
    // back_tp returns 1 after the teleport and 0 when the spot is in lava.
    `scoreboard players set @s ${BACK_Y} 0`,
    ...DIMENSIONS.map(([n, id]) => `execute if score @s ${OBJ.tmp} matches ${n} in ${id} store result score @s ${BACK_Y} run function ${fn('back_tp')} with storage ${STORAGE}`),
    `execute unless score @s ${BACK_Y} matches 1 run ${tell('red', 'Your death point is in lava. /trigger back will not take you there.')}`,
    `execute unless score @s ${BACK_Y} matches 1 run return fail`,
    `scoreboard players set @s ${DEATHS} 0`,
    startCooldown,
    tell('green', 'Back where you died. Pick up your things before they vanish.')
  ];
  // Macro, run "in" the death dimension: refuse lava at the feet or head, else teleport.
  f.back_tp = [
    '$execute positioned $(x) $(y) $(z) if block ~ ~ ~ minecraft:lava run return 0',
    '$execute positioned $(x) $(y) $(z) if block ~ ~1 ~ minecraft:lava run return 0',
    '$tp @s $(x) $(y) $(z)',
    'return 1'
  ];
  // Since V1.3: the list of homes. Any positive value lists them; th.tmp counts the set homes.
  const isSet = k => `if score @s ${homeObj(k).dim} matches 1..${DIMENSIONS.length}`;
  f.homes = [
    'scoreboard players set @s homes 0',
    `scoreboard players set @s ${OBJ.tmp} 0`,
    ...HOMES.map(k => `execute ${isSet(k)} run scoreboard players add @s ${OBJ.tmp} 1`),
    `execute if score @s ${OBJ.tmp} matches 0 run ${tell('yellow', 'No homes yet. Stand where you want one and type /trigger sethome.')}`,
    `execute if score @s ${OBJ.tmp} matches 1.. run ${tell('gold', 'Your homes:')}`,
    ...HOMES.flatMap(k => DIMENSIONS.map(([n, , name]) => `execute if score @s ${homeObj(k).dim} matches ${n} run ${tell('green', `Home ${k}: `, [...position(k), t(` in ${name} (${typed('home', k)})`)])}`)),
    `execute if score @s ${OBJ.cd} matches 1.. run function ${fn('cooldown')}`,
    tell('gray', 'Commands: /trigger home, /trigger sethome, /trigger back, /trigger spawn. For homes 2 and 3 add set 2 or set 3, for example /trigger home set 2.')
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
    if (MACROS.includes(name) && !lines.some(l => l.startsWith('$'))) throw new Error(`${name}: a macro function needs a $ line`);
    for (const line of lines) {
      for (const m of line.matchAll(new RegExp(`function ${NS}:([a-z_/]+)`, 'g'))) {
        if (!f[m[1]]) throw new Error(`${name}: calls missing function ${m[1]}`);
      }
      if (line.startsWith('$') && !MACROS.includes(name)) throw new Error(`${name}: only ${MACROS.join(' and ')} are macro functions`);
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
