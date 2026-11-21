// Ice Cave Advancements: a new advancement tab "Frozen Depths" with 18 goals around the ice caves
// of Minecraft 26.4: the biome, the Frostbite and its ice balls, the freezing effect and potion,
// icicles, ice crystals, brittle ice, the frosty music disc and the new ice, snow and calcite blocks.
// Prepared against the 26.4 test versions; the day-one machine rebuilds it against the release.
//
// Every criterion copies the shape of a vanilla 26.x advancement:
//   location + minecraft:location.biomes            (adventure/adventuring_time)
//   inventory_changed + items                        (story/smelt_iron)
//   player_killed_entity + minecraft:entity_type     (adventure/kill_a_mob)
//   effects_changed + effects                        (nether/all_effects)
//   brewed_potion + potion.potions                   (nether/brew_potion, PotionsPredicate)
// Only experience as rewards, never items. No recipes, functions or loot table changes.
const NS = 'ice_cave_advancements';
const id = name => `${NS}:${name}`;
const mc = s => `minecraft:${s}`;

// ── criteria in vanilla 26.x shape ────────────────────────────────────────────────────────────
const inBiome = biome => ({
  trigger: 'minecraft:location',
  conditions: { player: { type: 'minecraft:entity_properties', entity: 'this', predicate: { 'minecraft:location': { biomes: mc(biome) } } } }
});
const has = item => ({ trigger: 'minecraft:inventory_changed', conditions: { items: [{ items: mc(item) }] } });
const killed = (entity, player) => ({
  trigger: 'minecraft:player_killed_entity',
  conditions: {
    ...(player ? { player } : {}),
    entity: { type: 'minecraft:entity_properties', entity: 'this', predicate: { 'minecraft:entity_type': mc(entity) } }
  }
});
const affected = effect => ({ trigger: 'minecraft:effects_changed', conditions: { effects: { [mc(effect)]: {} } } });
// In 26.x the potion of brewed_potion is a potions predicate { potions: [ids] } (PotionsPredicate in
// the server jar: fields "potions" and "effects"), no longer a bare potion id.
const brewed = potions => ({ trigger: 'minecraft:brewed_potion', conditions: { potion: { potions: potions.map(mc) } } });
const freezingPlayer = { type: 'minecraft:entity_properties', entity: 'this', predicate: { 'minecraft:effects': { [mc('freezing')]: {} } } };

// ── the new building blocks of the ice caves (all craftable or mined, none needs silk touch) ──
export const BLOCKS = [
  'packed_ice_bricks', 'packed_ice_brick_slab', 'packed_ice_brick_stairs', 'packed_ice_brick_wall', 'chiseled_packed_ice',
  'snow_bricks', 'snow_brick_slab', 'snow_brick_stairs', 'snow_brick_wall',
  'polished_calcite', 'polished_calcite_slab', 'polished_calcite_stairs', 'polished_calcite_wall',
  'polished_calcite_bricks', 'polished_calcite_brick_slab', 'polished_calcite_brick_stairs', 'polished_calcite_brick_wall',
  'calcite_pillar', 'calcite_slab', 'calcite_stairs', 'calcite_wall'
];

// [name, parent, icon, title, description, criteria, frame, all criteria needed]
export function tree() {
  return [
    // Exploring
    ['explore/icicle', 'root', 'icicle', 'Mind Your Head', 'Collect an icicle', { icicle: has('icicle') }],
    ['explore/ice_crystal', 'explore/icicle', 'ice_crystal', 'Crystal Clear', 'Collect an ice crystal', { ice_crystal: has('ice_crystal') }],
    ['explore/brittle_ice', 'explore/ice_crystal', 'brittle_ice', 'Handle With Care', 'Mine brittle ice with Silk Touch', { brittle_ice: has('brittle_ice') }],
    ['explore/flurry', 'explore/icicle', 'music_disc_flurry', 'A Frosty Tune', 'Find the music disc hidden in an igloo', { flurry: has('music_disc_flurry') }],
    // Fighting the cold
    ['cold/frostbite', 'root', 'frostbite_spawn_egg', 'Frostbitten', 'Defeat a Frostbite', { frostbite: killed('frostbite') }],
    ['cold/ice_ball', 'cold/frostbite', 'ice_ball', 'Cold Shoulder', 'Pick up an ice ball', { ice_ball: has('ice_ball') }],
    ['cold/freezing', 'cold/frostbite', 'powder_snow_bucket', 'Chilled to the Bone', 'Suffer the Freezing effect', { freezing: affected('freezing') }],
    ['cold/potion', 'cold/ice_ball', 'brewing_stand', 'Bottled Winter', 'Brew a Potion of Freezing', { freezing: brewed(['freezing', 'long_freezing']) }],
    ['cold/revenge', 'cold/freezing', 'ice_ball', 'Return to Sender', 'Defeat a Frostbite while you are freezing', { frostbite: killed('frostbite', freezingPlayer) }, 'goal'],
    // Building
    ['build/packed_ice_bricks', 'root', 'packed_ice_bricks', 'Ice Mason', 'Craft packed ice bricks', { bricks: has('packed_ice_bricks') }],
    ['build/chiseled_packed_ice', 'build/packed_ice_bricks', 'chiseled_packed_ice', 'Carved in Ice', 'Craft chiseled packed ice', { chiseled: has('chiseled_packed_ice') }],
    ['build/snow_bricks', 'build/packed_ice_bricks', 'snow_bricks', 'Snow Mason', 'Craft snow bricks', { bricks: has('snow_bricks') }],
    ['build/polished_calcite', 'root', 'polished_calcite', 'Mountain Marble', 'Craft polished calcite', { polished: has('polished_calcite') }],
    ['build/polished_calcite_bricks', 'build/polished_calcite', 'polished_calcite_bricks', 'Fine Masonry', 'Craft polished calcite bricks', { bricks: has('polished_calcite_bricks') }],
    ['build/calcite_pillar', 'build/polished_calcite', 'calcite_pillar', 'Pillar of the Peaks', 'Craft a calcite pillar', { pillar: has('calcite_pillar') }],
    // Challenges
    ['build/all_blocks', 'build/chiseled_packed_ice', 'packed_ice_brick_stairs', 'Master Mason of the North', 'Collect every new ice, snow and calcite building block', Object.fromEntries(BLOCKS.map(b => [b, has(b)])), 'challenge', true],
    ['explore/veteran', 'explore/brittle_ice', 'icicle', 'Ice Cave Veteran', 'Collect an icicle, an ice crystal, brittle ice and an ice ball, and defeat a Frostbite', {
      icicle: has('icicle'), ice_crystal: has('ice_crystal'), brittle_ice: has('brittle_ice'), ice_ball: has('ice_ball'), frostbite: killed('frostbite')
    }, 'challenge', true]
  ].map(([name, parent, icon, title, description, criteria, frame = 'task', all = false]) => ({ name, parent, icon, title, description, criteria, frame, all }));
}

export const REWARDS = { 'cold/revenge': 50, 'build/all_blocks': 100, 'explore/veteran': 100 };

function checkTree(list) {
  const names = new Set(['root', ...list.map(a => a.name)]);
  for (const a of list) if (!names.has(a.parent)) throw new Error(`${a.name}: unknown parent ${a.parent}`);
  for (const key of Object.keys(REWARDS)) if (!names.has(key)) throw new Error(`reward for unknown advancement ${key}`);
  if (names.size !== list.length + 1) throw new Error('two advancements share a name');
}

const text = t => ({ text: t });
const requirements = (criteria, all) => (all ? Object.keys(criteria).map(k => [k]) : [Object.keys(criteria)]);

export default async function ({ format, registry }) {
  if (format < 121) throw new Error('Ice Cave Advancements is written for Minecraft 26.x (data pack format 121 or newer)');
  const list = tree();
  if (list.length !== 17) throw new Error(`expected 17 advancements below the root, got ${list.length}`);
  checkTree(list);
  // The ice caves only exist from 26.4 on; refuse a version without them instead of writing dead goals.
  const entities = registry('entity_type');
  const effects = registry('mob_effect');
  const potions = registry('potion');
  for (const e of ['frostbite']) if (!entities.has(e)) throw new Error(`this version has no ${e}`);
  for (const e of ['freezing']) if (!effects.has(e)) throw new Error(`this version has no ${e} effect`);
  for (const p of ['freezing', 'long_freezing']) if (!potions.has(p)) throw new Error(`this version has no ${p} potion`);

  const files = {};
  const rootCriteria = { ice_caves: inBiome('ice_caves') };
  files[`data/${NS}/advancement/root.json`] = {
    criteria: rootCriteria,
    display: {
      icon: { id: mc('packed_ice') },
      title: text('Frozen Depths'),
      description: text('Find your way into the ice caves'),
      frame: 'task',
      background: mc('block/packed_ice_bricks'),
      show_toast: false,
      announce_to_chat: false
    },
    requirements: requirements(rootCriteria, false)
  };
  for (const a of list) {
    const adv = {
      parent: id(a.parent),
      criteria: a.criteria,
      display: { icon: { id: mc(a.icon) }, title: text(a.title), description: text(a.description), frame: a.frame },
      requirements: requirements(a.criteria, a.all)
    };
    if (REWARDS[a.name]) adv.rewards = { experience: REWARDS[a.name] };
    files[`data/${NS}/advancement/${a.name}.json`] = adv;
  }
  return files;
}
