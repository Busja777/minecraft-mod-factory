// Hush: the most annoying everyday sounds get quieter without being removed. Each chosen sound
// event is redefined with "replace": true, keeping the vanilla sound files, weights, pitch,
// attenuation and subtitle, and only its volume is multiplied by the factor of its group.
// Hurt and death sounds are never touched: players rely on them.
import fs from 'fs';

// GROUPS is the one table to change for later updates (selectable levels, more sounds).
//   factor    how loud the group stays (0.35 = 35 % of vanilla), never 0
//   playedAt  only when the game itself plays the event louder than 1 (see below)
//   later     events that only newer Minecraft versions have: { since, events }. Each version's
//             sounds.json gets them when its own vanilla sounds.json has them; from `since` on
//             they must be there (a renamed event fails the build instead of staying loud).
//
// Thunder (not in V1.0, waits for a check in the game): the game plays it at volume 10000 (LightningBolt, checked in the 1.21.1 client jar), so
// it is heard everywhere and the loudness is cut at 1. A plain 0.5 in sounds.json would give 5000,
// still cut at 1, so nothing would change. Instead the sound gets volume 0.5 / 10000 (the game then
// plays it at 0.5) and an attenuation_distance that keeps the vanilla hearing range of
// 10000 × 16 blocks.
export const GROUPS = [
  { group: 'villagers', factor: 0.35, events: [
    'entity.villager.ambient', 'entity.villager.yes', 'entity.villager.no', 'entity.villager.trade',
    'entity.wandering_trader.ambient', 'entity.wandering_trader.yes', 'entity.wandering_trader.no', 'entity.wandering_trader.trade',
    // V1.2: the workstation sounds of every profession (the librarian's is vanilla volume 2).
    ...['armorer', 'butcher', 'cartographer', 'cleric', 'farmer', 'fisherman', 'fletcher', 'leatherworker',
      'librarian', 'mason', 'shepherd', 'toolsmith', 'weaponsmith'].map(p => `entity.villager.work_${p}`)
  ] },
  { group: 'farm animals', factor: 0.35, events: [
    'entity.cow.ambient', 'entity.sheep.ambient', 'entity.chicken.ambient', 'entity.pig.ambient',
    // V1.2
    'entity.chicken.egg', 'entity.goat.ambient', 'entity.goat.screaming.ambient'
  ], later: [
    // V1.3. 26.3 gives pigs, cows and chickens sound variants (data/minecraft/*_sound_variant):
    // big and mini pigs, moody cows, picky chickens, and own calls for piglets and chicks, which
    // used the adult sound in 1.21.1. Pig and chicken: played at volume 1 (no getSoundVolume);
    // cows at 0.4 for every variant (AbstractCow.getSoundVolume, 26.3 client jar), like entity.cow.ambient.
    { since: '26.3', events: [
      'entity.pig_big.ambient', 'entity.pig_mini.ambient', 'entity.baby_pig.ambient',
      'entity.cow_moody.ambient',
      'entity.chicken_picky.ambient', 'entity.baby_chicken.ambient'
    ] }
  ] },
  // V1.2. The game already plays bats at 0.1 (Bat.getSoundVolume, 26.3 client jar); this scales that.
  { group: 'bats', factor: 0.35, events: ['entity.bat.ambient', 'entity.bat.takeoff'] },
  // V1.2. The angry buzz (entity.bee.loop_aggressive) stays: it warns the player.
  { group: 'bees', factor: 0.4, events: ['entity.bee.loop', 'block.beehive.work'] },
  // V1.2. Played at volume 1 by the blocks themselves (26.3 client jar).
  { group: 'furnaces', factor: 0.4, events: ['block.furnace.fire_crackle', 'block.smoker.smoke', 'block.blastfurnace.fire_crackle'] },
  { group: 'nether portal', factor: 0.25, events: ['block.portal.ambient', 'block.portal.travel', 'block.portal.trigger'] },
  { group: 'rain', factor: 0.45, events: ['weather.rain', 'weather.rain.above'] },
  { group: 'minecart', factor: 0.35, events: ['entity.minecart.riding', 'entity.minecart.inside', 'entity.minecart.inside.underwater'] },
  { group: 'anvil', factor: 0.4, events: ['block.anvil.use', 'block.anvil.land', 'block.anvil.place'] },
  // V1.4. Wolves: idle bark, panting and whining. The growl (an angry wolf), howl, shake, hurt and
  // death stay as they are. 26.3 gives wolves sound variants (data/minecraft/wolf_sound_variant);
  // each has its own ambient/pant/whine. All played at volume 0.4 (Wolf.getSoundVolume, 26.3 client jar).
  { group: 'wolves', factor: 0.35, events: ['entity.wolf.ambient', 'entity.wolf.pant', 'entity.wolf.whine'], later: [
    { since: '26.3', events: ['angry', 'big', 'cute', 'grumpy', 'puglin', 'sad'].flatMap(v => ['ambient', 'pant', 'whine'].map(k => `entity.wolf_${v}.${k}`)) }
  ] },
  // V1.4. Horses, donkeys and mules: idle calls and the horse's breathing. Angry (taming), eating,
  // steps, gallop, hurt and death stay. Played at volume 0.8 (AbstractHorse.getSoundVolume, 26.3 client jar).
  { group: 'horses', factor: 0.35, events: ['entity.horse.ambient', 'entity.horse.breathe', 'entity.donkey.ambient', 'entity.mule.ambient'] },
  // V1.4. Pistons, so redstone machines are easier to live next to. Played at volume 0.5 (PistonBaseBlock, 26.3 client jar).
  { group: 'pistons', factor: 0.4, events: ['block.piston.extend', 'block.piston.contract'] }
];

// Lowest loudness a sound may keep, so nothing is ever silenced.
const MIN_VOLUME = 0.01;
// The game's default attenuation_distance when a sound does not set one.
const ATTENUATION = 16;
const round = v => Math.round(v * 1000) / 1000;
// Whether Minecraft version a ("26.4-snapshot-10" counts as 26.4) is at least b.
export function atLeast(a, b) {
  const [x, y] = [a, b].map(v => String(v).split('-')[0].split('.').map(Number));
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return true;
}

// One vanilla sound entry (a plain file name or an object) made quieter. The game plays a sound at
// playedAt × volume, cuts the loudness at 1 and hears it up to max(playedAt × volume, 1) ×
// attenuation_distance blocks away; the new entry keeps that range and scales the loudness.
export function quieter(entry, factor, playedAt = 1) {
  const sound = typeof entry === 'string' ? { name: entry } : { ...entry };
  const played = playedAt * (sound.volume ?? 1);
  const heard = Math.max(MIN_VOLUME, round(Math.min(1, played) * factor));
  sound.volume = heard / playedAt;
  const range = Math.round(Math.max(played, 1) * (sound.attenuation_distance ?? ATTENUATION));
  if (range !== Math.round(Math.max(heard, 1) * (sound.attenuation_distance ?? ATTENUATION))) sound.attenuation_distance = range;
  return sound;
}

// The events of one group that a Minecraft version has: all of `events`, plus the `later` ones
// its vanilla sounds.json (defs) knows.
export function eventsFor({ group, events, later = [] }, defs, version) {
  const extra = [];
  for (const { since, events: newer } of later) {
    for (const event of newer) {
      if (defs[event]) extra.push(event);
      else if (atLeast(version, since)) throw new Error(`${group}: Minecraft ${version} has no sound definition for ${event} (expected from ${since} on)`);
    }
  }
  return [...events, ...extra];
}

export default async function ({ vanilla, version }) {
  const defs = JSON.parse(fs.readFileSync(vanilla.sounds, 'utf-8'));
  const sounds = {};
  for (const g of GROUPS) {
    const { group, factor, playedAt = 1 } = g;
    if (!(factor > 0 && factor <= 1)) throw new Error(`${group}: factor ${factor} must be in (0, 1]`);
    for (const event of eventsFor(g, defs, version)) {
      const def = defs[event];
      if (!def) throw new Error(`${group}: vanilla has no sound definition for ${event}`);
      if (sounds[event]) throw new Error(`${event} is listed twice`);
      sounds[event] = {
        replace: true,
        ...(def.subtitle ? { subtitle: def.subtitle } : {}),
        sounds: def.sounds.map(s => quieter(s, factor, playedAt))
      };
    }
  }
  return { 'assets/minecraft/sounds.json': sounds };
}
