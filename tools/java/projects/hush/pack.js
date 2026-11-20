// Hush: the most annoying everyday sounds get quieter without being removed. Each chosen sound
// event is redefined with "replace": true, keeping the vanilla sound files, weights, pitch,
// attenuation and subtitle, and only its volume is multiplied by the factor of its group.
// Hurt and death sounds are never touched: players rely on them.
import fs from 'fs';

// GROUPS is the one table to change for later updates (selectable levels, more sounds).
//   factor    how loud the group stays (0.35 = 35 % of vanilla), never 0
//   playedAt  only when the game itself plays the event louder than 1 (see below)
//
// Thunder (not in V1.0, waits for a check in the game): the game plays it at volume 10000 (LightningBolt, checked in the 1.21.1 client jar), so
// it is heard everywhere and the loudness is cut at 1. A plain 0.5 in sounds.json would give 5000,
// still cut at 1, so nothing would change. Instead the sound gets volume 0.5 / 10000 (the game then
// plays it at 0.5) and an attenuation_distance that keeps the vanilla hearing range of
// 10000 × 16 blocks.
export const GROUPS = [
  { group: 'villagers', factor: 0.35, events: [
    'entity.villager.ambient', 'entity.villager.yes', 'entity.villager.no', 'entity.villager.trade',
    'entity.wandering_trader.ambient', 'entity.wandering_trader.yes', 'entity.wandering_trader.no', 'entity.wandering_trader.trade'
  ] },
  { group: 'farm animals', factor: 0.35, events: ['entity.cow.ambient', 'entity.sheep.ambient', 'entity.chicken.ambient', 'entity.pig.ambient'] },
  { group: 'nether portal', factor: 0.25, events: ['block.portal.ambient', 'block.portal.travel', 'block.portal.trigger'] },
  { group: 'rain', factor: 0.45, events: ['weather.rain', 'weather.rain.above'] },
  { group: 'minecart', factor: 0.35, events: ['entity.minecart.riding', 'entity.minecart.inside', 'entity.minecart.inside.underwater'] },
  { group: 'anvil', factor: 0.4, events: ['block.anvil.use', 'block.anvil.land', 'block.anvil.place'] }
];

// Lowest loudness a sound may keep, so nothing is ever silenced.
const MIN_VOLUME = 0.01;
// The game's default attenuation_distance when a sound does not set one.
const ATTENUATION = 16;
const round = v => Math.round(v * 1000) / 1000;

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

export default async function ({ vanilla }) {
  const defs = JSON.parse(fs.readFileSync(vanilla.sounds, 'utf-8'));
  const sounds = {};
  for (const { group, factor, playedAt = 1, events } of GROUPS) {
    if (!(factor > 0 && factor <= 1)) throw new Error(`${group}: factor ${factor} must be in (0, 1]`);
    for (const event of events) {
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
