// Hushed World: villagers, cows, the nether portal hum and rain play more quietly. Nothing else
// changes: same sounds, same pitch, same distances and subtitles.
//
// Built from the vanilla resource pack's sounds/sound_definitions.json of the release. The pack's
// own sound_definitions.json holds only the events it changes; Bedrock merges a pack's
// sound_definitions.json with the ones below it event by event (a pack that adds one custom
// sound does not silence the rest of the game), and an event defined again replaces vanilla's
// whole entry. (Known from Microsoft's creator documentation and how custom sounds are added;
// the samples alone only show the event-keyed layout, not the merging.) So every event below is copied completely from vanilla and only its volumes are
// scaled: an entry without a volume plays at 1.0, so it gets the factor itself.
//
// Which entity events use these sound events: resource_pack/sounds.json (villager and
// villager_v2 ambient / haggle / haggle.yes / haggle.no; cow and mooshroom ambient, the cow's
// "moody" sound variant ambient; individual_event_sounds "portal" → portal.portal). Rain is
// played by the engine itself as ambient.weather.rain.
export const QUIETER = {
  // Villagers: idle chatter and the trading sounds. Hurt and death stay at full volume.
  'mob.villager.idle': 0.4,
  'mob.villager.haggle': 0.4,
  'mob.villager.yes': 0.4,
  'mob.villager.no': 0.4,
  // Cows (and mooshrooms, which share mob.cow.say): the moo of both sound variants.
  'mob.cow.say': 0.4,
  'mob.moody_cow.say': 0.4,
  // The hum of a lit nether portal (not the travel and trigger sounds).
  'portal.portal': 0.35,
  // Rain.
  'ambient.weather.rain': 0.5
};

const round = v => Math.round(v * 10000) / 10000;

// One vanilla sound entry (a path string or an object) with its volume scaled.
export function scaled(entry, factor) {
  if (typeof entry === 'string') return { name: entry, volume: round(factor) };
  if (!entry || typeof entry.name !== 'string') throw new Error(`unexpected sound entry ${JSON.stringify(entry)}`);
  if (entry.volume !== undefined && typeof entry.volume !== 'number') throw new Error(`unexpected volume in ${JSON.stringify(entry)}`);
  return { ...entry, volume: round((entry.volume ?? 1) * factor) };
}

export default async function ({ vanilla }) {
  const defs = vanilla('rp', 'sounds/sound_definitions.json');
  if (!defs?.format_version || !defs.sound_definitions) throw new Error('the vanilla sound_definitions.json has a new layout');
  const out = {};
  for (const [event, factor] of Object.entries(QUIETER)) {
    if (!(factor > 0 && factor < 1)) throw new Error(`${event}: factor ${factor} must be above 0 and below 1`);
    const def = defs.sound_definitions[event];
    if (!def) throw new Error(`no sound event ${event} in this release`);
    if (!Array.isArray(def.sounds) || !def.sounds.length) throw new Error(`${event} has no sounds in this release`);
    out[event] = { ...def, sounds: def.sounds.map(s => scaled(s, factor)) };
  }
  return {
    'rp/sounds/sound_definitions.json': { format_version: defs.format_version, sound_definitions: out }
  };
}
