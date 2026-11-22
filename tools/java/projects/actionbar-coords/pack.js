// Actionbar Coords: shows each player's block coordinates, the direction they face and the time of
// day above the hotbar ("X 120  Y 64  Z -33 · NE · 14:05"), on by default, /trigger coords switches
// it off and on per player.
// Plain functions and scoreboards. 1.21.1 and 26.3 get the same files except one line: the time
// query (1.21.1: `time query daytime`; 26.x replaced it with world clocks and timelines:
// `time of minecraft:overworld query minecraft:day`, which returns the same 0..23999).
//
// How it works
// - load: creates the trigger objective "coords" (what players type) and the pack's own dummy
//   objectives ac.hide (1 = this player switched the display off) and ac.tmp (scratch values and
//   the constants #6, #10, #24, #60, #1000), then starts the update loop.
// - update (every UPDATE_TICKS ticks through `schedule`, nothing runs in the ticks between):
//   handles /trigger coords, turns the time of day into the four digits of hh:mm once for everyone
//   (a digit as a score, so 05:07 needs no extra variants of the line), then
//   runs "show" as every player who has not switched the display off. It schedules itself again
//   with "replace", so /reload never starts a second loop.
// - show (as the player): copies Pos into storage once (one entity read per player), floors the
//   three values into scores, finds the direction (V1.1) and sends one actionbar line.
// - Direction: the player's yaw through the selector option y_rotation (no NBT read; the game
//   wraps the yaw to -180..180 and a range like 157.5..-157.5 wraps across ±180). Eight sectors of
//   45°, yaw 0 = south (+Z), 90 = west, ±180 = north, -90 = east, as on the F3 screen. Each sector
//   sets #dir (a yaw exactly on a border matches two, the later one wins, so exactly one line is
//   sent), then one of eight lines is shown.
// - The biome is not shown: no command returns the biome as a value in either version. The only
//   way is one `execute if biome ~ ~ ~ <id>` per biome (64 in 1.21.1, more in 26.3, none for biomes
//   of other data packs) for every player four times a second, which is not cheap.
// - toggle: flips ac.hide, clears the actionbar when switching off and says how to switch back.
// - Colour styles (since V1.2): ac.style per player (unset = 0 = the colours of 1.0/1.1).
//   /trigger coords (value 1) still switches the display, /trigger coords set 2 moves on to the
//   next style and names it, other values print a short help. show picks one of
//   STYLES × DIRECTIONS lines through #sel = style * 8 + direction, so it stays one actionbar
//   command per player and update.
// - Compact line (since V1.3): ac.compact per player (unset = 0 = the full line of 1.0 to 1.2,
//   1 = only "X 120  Y 64  Z -33" in the player's colour style). /trigger coords set 3 switches it.
//   show sends the compact line right after reading the position and returns, so the direction
//   is not worked out for those players. Values 4 and up print the help, which names 1, 2 and 3.
// Text components are written so that the JSON reader of 1.21.1 and the SNBT reader of 26.x both
// accept them: quoted keys, strings only, lists that hold only compounds. Every command line is
// checked against reports/commands.json of the version it is built for (checkCommands below).
import fs from 'fs';
import path from 'path';

const NS = 'actionbar_coords';
const fn = name => `${NS}:${name}`;

export const UPDATE_TICKS = 5; // four updates per second; the actionbar itself stays for 3 s
export const TRIGGER = 'coords';
export const OBJ = { hide: 'ac.hide', tmp: 'ac.tmp', style: 'ac.style', compact: 'ac.compact' };
const STORAGE = `${NS}:pos`;
const CONSTANTS = [6, 8, 10, 24, 60, 1000];

// Colour styles (since V1.2): [name, labels, numbers, direction, time, separators]. Style 0 is the
// look of 1.0 and 1.1, so nothing changes for anyone who does not pick another one.
export const STYLES = [
  ['Classic', 'gray', 'white', 'aqua', 'yellow', 'dark_gray'],
  ['Plain', 'white', 'white', 'white', 'white', 'gray'],
  ['Gold', 'gold', 'yellow', 'gold', 'yellow', 'dark_gray'],
  ['Green', 'dark_green', 'green', 'green', 'green', 'dark_gray'],
  ['Blue', 'dark_aqua', 'aqua', 'aqua', 'aqua', 'dark_gray'],
  ['Quiet', 'dark_gray', 'gray', 'gray', 'gray', 'dark_gray']
];
const COLOURS = ['black', 'dark_blue', 'dark_green', 'dark_aqua', 'dark_red', 'dark_purple', 'gold', 'gray', 'dark_gray', 'blue', 'green', 'aqua', 'red', 'light_purple', 'yellow', 'white'];

// The eight directions: name and yaw range (degrees, inclusive, min > max wraps across ±180).
export const DIRECTIONS = [
  ['S', '-22.5..22.5'], ['SW', '22.5..67.5'], ['W', '67.5..112.5'], ['NW', '112.5..157.5'],
  ['N', '157.5..-157.5'], ['NE', '-157.5..-112.5'], ['E', '-112.5..-67.5'], ['SE', '-67.5..-22.5']
];

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

// The coordinates part of the line in one colour style: "X 120  Y 64  Z -33".
const coords = ([, lab, num]) => [
  t('X ', lab), score('#x', num),
  t('  Y ', lab), score('#y', num),
  t('  Z ', lab), score('#z', num)
];
// The compact line (since V1.3): only the coordinates.
export const compactLine = (style = STYLES[0]) => json(coords(style));

// One actionbar line for one direction and colour style; the time is four one-digit scores (hh:mm).
export function line(dir, style = STYLES[0]) {
  const [, , , dirC, time, sep] = style;
  return json([
    ...coords(style),
    t(' · ', sep), t(dir, dirC), t(' · ', sep),
    score('#h10', time), score('#h1', time), t(':', time), score('#m10', time), score('#m1', time)
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
    `execute as @a[scores={${TRIGGER}=1..}] run function ${fn('trigger')}`,
    `scoreboard players set @a[scores={${TRIGGER}=..-1}] ${TRIGGER} 0`,
    // the game disables a trigger for a player after each use, and new players start disabled
    `scoreboard players enable @a ${TRIGGER}`,
    `execute store result score #time ${OBJ.tmp} run ${query}`,
    // hour = (ticks / 1000 + 6) mod 24, minute = (ticks mod 1000) * 60 / 1000
    op('hour', '=', 'time'), op('hour', '/=', '1000'), op('hour', '+=', '6'), op('hour', '%=', '24'),
    op('min', '=', 'time'), op('min', '%=', '1000'), op('min', '*=', '60'), op('min', '/=', '1000'),
    // the digits: tens = value / 10, ones = value mod 10 (both 0..9, the values are never negative)
    ...['hour', 'min'].flatMap(v => {
      const d = v === 'hour' ? 'h' : 'm';
      return [op(`${d}10`, '=', v), op(`${d}10`, '/=', '10'), op(`${d}1`, '=', v), op(`${d}1`, '%=', '10')];
    }),
    `execute as @a unless score @s ${OBJ.hide} matches 1 run function ${fn('show')}`,
    `schedule function ${fn('update')} ${UPDATE_TICKS}t replace`
  ];
  f.show = [
    `data modify storage ${STORAGE} p set from entity @s Pos`,
    // data get floors a double, so -32.3 becomes -33, the block the player stands in (as on F3)
    ...['x', 'y', 'z'].map((axis, i) => `execute store result score #${axis} ${OBJ.tmp} run data get storage ${STORAGE} p[${i}]`),
    // #sel = the style (unset counts as 0)
    `scoreboard players set #sel ${OBJ.tmp} 0`,
    `execute if score @s ${OBJ.style} matches 1..${STYLES.length - 1} run scoreboard players operation #sel ${OBJ.tmp} = @s ${OBJ.style}`,
    // compact line (V1.3): one line per style, then done for this player
    ...STYLES.map((style, s) => `execute if score @s ${OBJ.compact} matches 1 if score #sel ${OBJ.tmp} matches ${s} run title @s actionbar ${compactLine(style)}`),
    `execute if score @s ${OBJ.compact} matches 1 run return 0`,
    ...DIRECTIONS.map(([, range], i) => `execute if entity @s[y_rotation=${range}] run scoreboard players set #dir ${OBJ.tmp} ${i}`),
    // #sel = style * 8 + direction
    `scoreboard players operation #sel ${OBJ.tmp} *= #8 ${OBJ.tmp}`,
    `scoreboard players operation #sel ${OBJ.tmp} += #dir ${OBJ.tmp}`,
    ...STYLES.flatMap((style, s) => DIRECTIONS.map(([name], i) => `execute if score #sel ${OBJ.tmp} matches ${s * DIRECTIONS.length + i} run title @s actionbar ${line(name, style)}`))
  ];
  // /trigger coords → 1 switches the display, set 2 → next colour style, set 3 → compact line on
  // or off, anything else → help.
  f.trigger = [
    `execute if score @s ${TRIGGER} matches 1 run function ${fn('toggle')}`,
    `execute if score @s ${TRIGGER} matches 2 run function ${fn('style')}`,
    `execute if score @s ${TRIGGER} matches 3 run function ${fn('compact')}`,
    `execute if score @s ${TRIGGER} matches 4.. run ${tell('gray', 'Type /trigger coords set <number>: 1 = show or hide the line, 2 = next colour style, 3 = coordinates only on or off. /trigger coords alone is the same as 1.')}`,
    `scoreboard players set @s ${TRIGGER} 0`
  ];
  f.compact = [
    `execute unless score @s ${OBJ.compact} matches 0..1 run scoreboard players set @s ${OBJ.compact} 0`,
    // 0 (full) + 1 = 1 (compact); compact + 1 = 2, back to 0 (full)
    `scoreboard players add @s ${OBJ.compact} 1`,
    `execute if score @s ${OBJ.compact} matches 2.. run scoreboard players set @s ${OBJ.compact} 0`,
    `execute if score @s ${OBJ.compact} matches 1 run ${tell('gray', 'Compact line: coordinates only. Type /trigger coords set 3 for the full line again.')}`,
    `execute if score @s ${OBJ.compact} matches 0 run ${tell('gray', 'Full line: coordinates, direction and time. Type /trigger coords set 3 for coordinates only.')}`,
    `execute if score @s ${OBJ.hide} matches 1 run ${tell('gray', 'The line is hidden at the moment. Type /trigger coords to show it.')}`
  ];
  f.style = [
    `execute unless score @s ${OBJ.style} matches 0..${STYLES.length - 1} run scoreboard players set @s ${OBJ.style} 0`,
    `scoreboard players add @s ${OBJ.style} 1`,
    `execute if score @s ${OBJ.style} matches ${STYLES.length}.. run scoreboard players set @s ${OBJ.style} 0`,
    ...STYLES.map(([name], s) => `execute if score @s ${OBJ.style} matches ${s} run ${tell('gray', `Colour style: ${name} (${s + 1} of ${STYLES.length}). Type /trigger coords set 2 for the next one.`)}`)
  ];
  f.toggle = [
    `scoreboard players set @s ${TRIGGER} 0`,
    // unset (shown) + 1 = 1 (hidden); hidden + 1 = 2, back to 0 (shown)
    `scoreboard players add @s ${OBJ.hide} 1`,
    `execute if score @s ${OBJ.hide} matches 2.. run scoreboard players set @s ${OBJ.hide} 0`,
    `execute if score @s ${OBJ.hide} matches 1 run title @s actionbar ${JSON.stringify(t(''))}`,
    `execute if score @s ${OBJ.hide} matches 1 run ${tell('gray', 'Coordinates hidden. Type /trigger coords to show them again.')}`,
    `execute if score @s ${OBJ.hide} matches 0 run ${tell('gray', 'Coordinates shown. Type /trigger coords to hide them, /trigger coords set 2 for another colour style, /trigger coords set 3 for coordinates only.')}`
  ];
  return f;
}

// ── checks ────────────────────────────────────────────────────────────────────────────────────
// Every "function <ns>:<name>" must point to a function of the pack.
export function checkFunctions(f) {
  for (const [, ...colours] of STYLES) for (const c of colours) if (!COLOURS.includes(c)) throw new Error(`style colour ${c} is not a text colour`);
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
