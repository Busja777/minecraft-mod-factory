// Actionbar Coords: shows each player's block coordinates and the time of day above the hotbar
// ("X 120  Y 64  Z -33 · 14:05"), on by default, /trigger coords switches it off and on per player.
// Plain functions and scoreboards. 1.21.1 and 26.3 get the same files except one line: the time
// query (1.21.1: `time query daytime`; 26.x replaced it with world clocks and timelines:
// `time of minecraft:overworld query minecraft:day`, which returns the same 0..23999).
//
// How it works
// - load: creates the trigger objective "coords" (what players type) and the pack's own dummy
//   objectives ac.hide (1 = this player switched the display off) and ac.tmp (scratch values and
//   the constants #6, #24, #60, #1000), then starts the update loop.
// - update (every UPDATE_TICKS ticks through `schedule`, nothing runs in the ticks between):
//   handles /trigger coords, turns the time of day into hours and minutes once for everyone, then
//   runs "show" as every player who has not switched the display off. It schedules itself again
//   with "replace", so /reload never starts a second loop.
// - show (as the player): copies Pos into storage once (one entity read per player), floors the
//   three values into scores and sends one actionbar line. Four variants of the line pad hours
//   and minutes below 10 with a leading zero.
// - toggle: flips ac.hide, clears the actionbar when switching off and says how to switch back.
// Text components are written so that the JSON reader of 1.21.1 and the SNBT reader of 26.x both
// accept them: quoted keys, strings only, lists that hold only compounds. Every command line is
// checked against reports/commands.json of the version it is built for (checkCommands below).
import fs from 'fs';
import path from 'path';

const NS = 'actionbar_coords';
const fn = name => `${NS}:${name}`;

export const UPDATE_TICKS = 5; // four updates per second; the actionbar itself stays for 3 s
export const TRIGGER = 'coords';
export const OBJ = { hide: 'ac.hide', tmp: 'ac.tmp' };
const STORAGE = `${NS}:pos`;
const CONSTANTS = [6, 24, 60, 1000];

// The command that returns the time of day in ticks (0 = 6:00, 6000 = noon, 18000 = midnight).
export function timeQuery(commands) {
  const time = commands.children.time?.children || {};
  if (time.query?.children?.daytime?.executable) return 'time query daytime';
  // 26.x: the overworld clock's position in the 24000-tick "day" timeline (the argument node is
  // called "timeline"; naming the clock makes it independent of the dimension the command runs in)
  const timeline = time.of?.children?.clock?.children?.query?.children?.timeline;
  if (timeline?.type === 'argument' && timeline.executable) return 'time of minecraft:overworld query minecraft:day';
  throw new Error('this Minecraft version has no known way to query the time of day');
}

// ── text ──────────────────────────────────────────────────────────────────────────────────────
const t = (text, color) => (color ? { text, color } : { text });
const score = (name, color) => ({ score: { name, objective: OBJ.tmp }, color });
const json = parts => JSON.stringify([t(''), ...parts]);
const tell = (color, text) => `tellraw @s ${JSON.stringify(t(text, color))}`;

// One actionbar line; padHour/padMin put a 0 in front of a one-digit hour or minute.
export function line(padHour, padMin) {
  const label = s => t(s, 'gray');
  return json([
    label('X '), score('#x', 'white'),
    label('  Y '), score('#y', 'white'),
    label('  Z '), score('#z', 'white'),
    t(' · ', 'dark_gray'),
    ...(padHour ? [t('0', 'yellow')] : []), score('#hour', 'yellow'),
    t(':', 'yellow'),
    ...(padMin ? [t('0', 'yellow')] : []), score('#min', 'yellow')
  ]);
}

// ── functions ─────────────────────────────────────────────────────────────────────────────────
export function functions(query) {
  const f = {};
  f.load = [
    `scoreboard objectives add ${TRIGGER} trigger`,
    ...Object.values(OBJ).map(o => `scoreboard objectives add ${o} dummy`),
    ...CONSTANTS.map(n => `scoreboard players set #${n} ${OBJ.tmp} ${n}`),
    `function ${fn('update')}`
  ];
  const op = (a, o, b) => `scoreboard players operation #${a} ${OBJ.tmp} ${o} #${b} ${OBJ.tmp}`;
  f.update = [
    `execute as @a[scores={${TRIGGER}=1..}] run function ${fn('toggle')}`,
    `scoreboard players set @a[scores={${TRIGGER}=..-1}] ${TRIGGER} 0`,
    // the game disables a trigger for a player after each use, and new players start disabled
    `scoreboard players enable @a ${TRIGGER}`,
    `execute store result score #time ${OBJ.tmp} run ${query}`,
    // hour = (ticks / 1000 + 6) mod 24, minute = (ticks mod 1000) * 60 / 1000
    op('hour', '=', 'time'), op('hour', '/=', '1000'), op('hour', '+=', '6'), op('hour', '%=', '24'),
    op('min', '=', 'time'), op('min', '%=', '1000'), op('min', '*=', '60'), op('min', '/=', '1000'),
    `execute as @a unless score @s ${OBJ.hide} matches 1 run function ${fn('show')}`,
    `schedule function ${fn('update')} ${UPDATE_TICKS}t replace`
  ];
  const h = (pad, then) => `execute if score #hour ${OBJ.tmp} matches ${pad ? '..9' : '10..'} ${then}`;
  const m = (pad, then) => `if score #min ${OBJ.tmp} matches ${pad ? '..9' : '10..'} ${then}`;
  f.show = [
    `data modify storage ${STORAGE} p set from entity @s Pos`,
    // data get floors a double, so -32.3 becomes -33, the block the player stands in (as on F3)
    ...['x', 'y', 'z'].map((axis, i) => `execute store result score #${axis} ${OBJ.tmp} run data get storage ${STORAGE} p[${i}]`),
    ...[false, true].flatMap(padHour => [false, true].map(padMin => h(padHour, m(padMin, `run title @s actionbar ${line(padHour, padMin)}`))))
  ];
  f.toggle = [
    `scoreboard players set @s ${TRIGGER} 0`,
    // unset (shown) + 1 = 1 (hidden); hidden + 1 = 2, back to 0 (shown)
    `scoreboard players add @s ${OBJ.hide} 1`,
    `execute if score @s ${OBJ.hide} matches 2.. run scoreboard players set @s ${OBJ.hide} 0`,
    `execute if score @s ${OBJ.hide} matches 1 run title @s actionbar ${JSON.stringify(t(''))}`,
    `execute if score @s ${OBJ.hide} matches 1 run ${tell('gray', 'Coordinates hidden. Type /trigger coords to show them again.')}`,
    `execute if score @s ${OBJ.hide} matches 0 run ${tell('gray', 'Coordinates shown. Type /trigger coords to hide them.')}`
  ];
  return f;
}

// ── checks ────────────────────────────────────────────────────────────────────────────────────
// Every "function <ns>:<name>" must point to a function of the pack.
export function checkFunctions(f) {
  for (const [name, lines] of Object.entries(f)) {
    for (const l of lines) {
      for (const m of l.matchAll(new RegExp(`function ${NS}:([a-z_/]+)`, 'g'))) {
        if (!f[m[1]]) throw new Error(`${name}: calls missing function ${m[1]}`);
      }
      if (l.startsWith('$')) throw new Error(`${name}: no macro lines in this pack`);
    }
  }
}

// Splits a command line into tokens; a token that starts with { or [ runs to its matching bracket
// (selectors keep their [..] with the @ token), so a JSON text component is one token.
export function tokens(l) {
  const out = [];
  let i = 0;
  while (i < l.length) {
    if (l[i] === ' ') { i++; continue; }
    let j = i, depth = 0, quoted = false;
    for (; j < l.length; j++) {
      const c = l[j];
      if (quoted) { if (c === '\\') j++; else if (c === '"') quoted = false; continue; }
      if (c === '"') quoted = true;
      else if (c === '{' || c === '[') depth++;
      else if (c === '}' || c === ']') depth--;
      else if (c === ' ' && depth === 0) break;
    }
    out.push(l.slice(i, j));
    i = j;
  }
  return out;
}

// Walks one command through the version's command tree (reports/commands.json). Literals must
// match, each argument takes one token, text components must be valid JSON; the walk must end on
// an executable node. → null when the line is a valid command, else the reason.
export function checkCommand(root, l) {
  const toks = tokens(l);
  const at = p => p.reduce((n, k) => n.children[k], root);
  const walk = (node, i) => {
    if (i === toks.length) return node.executable ? null : 'incomplete command';
    let why = `no "${toks[i]}" here`;
    for (const [name, child] of Object.entries(node.children || {})) {
      if (child.type === 'literal' && name !== toks[i]) continue;
      if (child.type === 'argument' && child.parser === 'minecraft:component') {
        try { JSON.parse(toks[i]); } catch { why = `bad text component ${toks[i]}`; continue; }
      }
      // a node without children that is not executable continues at its redirect (none: the root)
      const next = child.redirect ? at(child.redirect) : (!child.children && !child.executable ? root : child);
      const r = i + 1 === toks.length && next !== child ? (child.executable ? null : 'incomplete command') : walk(next, i + 1);
      if (r === null) return null;
      why = r;
    }
    return why;
  };
  return walk(root, 0);
}

export default async function ({ vanilla }) {
  const commands = JSON.parse(fs.readFileSync(path.join(vanilla.reports, 'commands.json'), 'utf-8'));
  const f = functions(timeQuery(commands));
  checkFunctions(f);
  for (const [name, lines] of Object.entries(f)) {
    for (const l of lines) {
      const why = checkCommand(commands, l);
      if (why) throw new Error(`${name}: "${l}" is not a command of this version (${why})`);
    }
  }
  const files = {
    'data/minecraft/tags/function/load.json': { values: [fn('load')] }
  };
  for (const [name, lines] of Object.entries(f)) files[`data/${NS}/function/${name}.mcfunction`] = lines.join('\n') + '\n';
  return files;
}
