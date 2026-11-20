// Farmers Advancements: a new advancement tab "Farmer's Almanac" with 30 goals about crops, animals,
// farm food and farm tools, so a peaceful farm world has something to work towards.
// Every criterion copies the shape of a vanilla 1.21.1 advancement:
//   placed_block + block_state_property      (husbandry/plant_seed)
//   inventory_changed + items                 (husbandry/obtain_netherite_hoe; "count" is the item predicate's stack size)
//   bred_animals + child entity_properties    (husbandry/bred_all_animals)
//   tame_animal + entity entity_properties    (husbandry/complete_catalogue)
//   consume_item + item                       (husbandry/balanced_diet)
//   item_used_on_block + location_check       (husbandry/safely_harvest_honey)
// Only experience as rewards, never items. No recipes, functions or loot table changes.
const NS = 'farmers_advancements';
const id = name => `${NS}:${name}`;

// ── criteria in vanilla shape ─────────────────────────────────────────────────────────────────
const planted = block => ({
  trigger: 'minecraft:placed_block',
  conditions: { location: [{ condition: 'minecraft:block_state_property', block: `minecraft:${block}` }] }
});
const has = (item, count) => ({
  trigger: 'minecraft:inventory_changed',
  conditions: { items: [{ items: item.startsWith('#') ? item : `minecraft:${item}`, ...(count ? { count: { min: count } } : {}) }] }
});
const bred = entity => ({
  trigger: 'minecraft:bred_animals',
  conditions: { child: [{ condition: 'minecraft:entity_properties', entity: 'this', predicate: { type: `minecraft:${entity}` } }] }
});
const tamed = entity => ({
  trigger: 'minecraft:tame_animal',
  conditions: { entity: [{ condition: 'minecraft:entity_properties', entity: 'this', predicate: { type: `minecraft:${entity}` } }] }
});
const ate = item => ({ trigger: 'minecraft:consume_item', conditions: { item: { items: `minecraft:${item}` } } });
const usedOn = block => ({
  trigger: 'minecraft:item_used_on_block',
  conditions: { location: [{ condition: 'minecraft:location_check', predicate: { block: { blocks: `minecraft:${block}` } } }] }
});

// ── tables ────────────────────────────────────────────────────────────────────────────────────
// Planting: [name, placed block, icon item, parent, title, description]
export const PLANTING = [
  ['wheat', 'wheat', 'wheat_seeds', 'root', 'Rows of Gold', 'Plant wheat seeds on farmland'],
  ['carrots', 'carrots', 'carrot', 'planting/wheat', 'Orange Underground', 'Plant a carrot'],
  ['potatoes', 'potatoes', 'potato', 'planting/carrots', 'Spud Planter', 'Plant a potato'],
  ['beetroots', 'beetroots', 'beetroot_seeds', 'planting/potatoes', 'Deep Red Rows', 'Plant beetroot seeds'],
  ['pumpkin', 'pumpkin_stem', 'pumpkin_seeds', 'planting/wheat', 'Patch Work', 'Plant pumpkin seeds'],
  ['melon', 'melon_stem', 'melon_seeds', 'planting/pumpkin', 'Summer Vines', 'Plant melon seeds'],
  ['sweet_berries', 'sweet_berry_bush', 'sweet_berries', 'planting/melon', 'Prickly Hedge', 'Plant a sweet berry bush'],
  ['nether_wart', 'nether_wart', 'nether_wart', 'planting/beetroots', 'Hot Gardening', 'Plant nether wart on soul sand'],
  ['torchflower', 'torchflower_crop', 'torchflower_seeds', 'planting/nether_wart', 'Ancient Bloom', 'Plant torchflower seeds'],
  ['pitcher', 'pitcher_crop', 'pitcher_pod', 'planting/torchflower', 'Pitcher Perfect', 'Plant a pitcher pod']
];

// The crops of the planting branch as items, for "collect every crop".
export const CROPS = ['wheat', 'carrot', 'potato', 'beetroot', 'pumpkin', 'melon_slice', 'sweet_berries', 'nether_wart', 'torchflower', 'pitcher_plant'];

// Farm animals bred in the animals branch: [entity, name, parent, title, description]
export const BREEDING = [
  ['cow', 'breed_cow', 'root', 'Herd Beginnings', 'Breed two cows'],
  ['sheep', 'breed_sheep', 'animals/breed_cow', 'Woolly Family', 'Breed two sheep'],
  ['pig', 'breed_pig', 'animals/breed_sheep', 'Pig Pen', 'Breed two pigs'],
  ['chicken', 'breed_chicken', 'animals/breed_pig', 'Chicken Coop', 'Breed two chickens'],
  ['rabbit', 'breed_rabbit', 'animals/breed_chicken', 'Bunny Hutch', 'Breed two rabbits']
];
const BREED_ICON = { cow: 'wheat', sheep: 'white_wool', pig: 'carrot', chicken: 'wheat_seeds', rabbit: 'dandelion' };

// Farm food eaten in the cooking branch: [item, name, parent, title, description]
export const COOKING = [
  ['bread', 'bread', 'root', 'Daily Bread', 'Eat a loaf of bread'],
  ['baked_potato', 'baked_potato', 'cooking/bread', 'Hot Potato', 'Eat a baked potato'],
  ['pumpkin_pie', 'pumpkin_pie', 'cooking/baked_potato', 'Harvest Pie', 'Eat a pumpkin pie'],
  ['beetroot_soup', 'beetroot_soup', 'cooking/pumpkin_pie', 'Red Soup', 'Eat a bowl of beetroot soup']
];
export const FEAST = ['bread', 'baked_potato', 'pumpkin_pie', 'beetroot_soup', 'cookie', 'golden_carrot', 'rabbit_stew', 'carrot', 'melon_slice', 'sweet_berries'];

// Experience rewards: small for goals, larger for challenges. Nothing else is ever given.
export const REWARDS = {
  'planting/pitcher': 20,
  'harvest/wheat_stack': 10,
  'harvest/potato_stack': 10,
  'harvest/every_crop': 100,
  'animals/eggs': 10,
  'animals/breed_all': 50,
  'tools/diamond_hoe': 20,
  'cooking/feast': 50
};

// ── the tree ──────────────────────────────────────────────────────────────────────────────────
// Each entry: { name, parent, icon, title, description, frame, criteria, all }
// all = true: every criterion is needed; otherwise any one of them is enough.
export function tree() {
  const list = [];
  const add = (name, parent, icon, title, description, criteria, { frame = 'task', all = false } = {}) =>
    list.push({ name, parent, icon, title, description, frame, criteria, all });

  for (const [name, block, icon, parent, title, desc] of PLANTING) {
    add(`planting/${name}`, parent, icon, title, desc, { [name]: planted(block) }, { frame: name === 'pitcher' ? 'goal' : 'task' });
  }

  add('harvest/wheat_stack', 'planting/wheat', 'wheat', 'Full Sheaf', 'Hold a full stack of 64 wheat', { wheat: has('wheat', 64) }, { frame: 'goal' });
  add('harvest/potato_stack', 'harvest/wheat_stack', 'potato', 'Root Cellar', 'Hold a full stack of 64 potatoes', { potato: has('potato', 64) }, { frame: 'goal' });
  add('harvest/every_crop', 'harvest/potato_stack', 'hay_block', 'Almanac Complete',
    'Collect every crop at least once: wheat, carrot, potato, beetroot, pumpkin, melon slice, sweet berries, nether wart, torchflower and pitcher plant',
    Object.fromEntries(CROPS.map(c => [c, has(c)])), { frame: 'challenge', all: true });

  for (const [entity, name, parent, title, desc] of BREEDING) add(`animals/${name}`, parent, BREED_ICON[entity], title, desc, { [entity]: bred(entity) });
  add('animals/milk', 'animals/breed_cow', 'milk_bucket', 'Fresh From the Cow', 'Fill a bucket with milk', { milk: has('milk_bucket') });
  add('animals/eggs', 'animals/breed_chicken', 'egg', 'Egg Basket', 'Hold a full stack of 16 eggs', { eggs: has('egg', 16) }, { frame: 'goal' });
  add('animals/breed_all', 'animals/breed_rabbit', 'golden_carrot', 'Full Barnyard', 'Breed cows, sheep, pigs, chickens and rabbits',
    Object.fromEntries(BREEDING.map(([entity]) => [entity, bred(entity)])), { frame: 'challenge', all: true });
  add('animals/tame_horse', 'root', 'saddle', 'Plow Horse', 'Tame a horse', { horse: tamed('horse') });

  for (const [item, name, parent, title, desc] of COOKING) add(`cooking/${name}`, parent, item, title, desc, { [item]: ate(item) });
  add('cooking/feast', 'cooking/beetroot_soup', 'cake', 'Harvest Feast',
    'Eat bread, a baked potato, pumpkin pie, beetroot soup, a cookie, a golden carrot, rabbit stew, a carrot, a melon slice and sweet berries',
    Object.fromEntries(FEAST.map(f => [f, ate(f)])), { frame: 'challenge', all: true });

  add('tools/any_hoe', 'root', 'wooden_hoe', 'Hoe Down', 'Get any hoe', { hoe: has('#minecraft:hoes') });
  add('tools/compost', 'tools/any_hoe', 'composter', 'Nothing Goes to Waste', 'Put something into a composter', { compost: usedOn('composter') });
  add('tools/diamond_hoe', 'tools/any_hoe', 'diamond_hoe', 'Diamond Harvest', 'Get a diamond hoe', { diamond_hoe: has('diamond_hoe') }, { frame: 'goal' });
  return list;
}

// Throws if the tree is not a proper tree below the root: unknown parents, cycles, duplicates,
// missing display parts or unknown reward keys.
export function checkTree(list) {
  const names = new Set(['root']);
  for (const a of list) {
    if (names.has(a.name)) throw new Error(`${a.name}: defined twice`);
    names.add(a.name);
  }
  const parentOf = Object.fromEntries(list.map(a => [a.name, a.parent]));
  for (const a of list) {
    if (!names.has(a.parent)) throw new Error(`${a.name}: parent ${a.parent} does not exist`);
    const seen = new Set();
    for (let n = a.name; n !== 'root'; n = parentOf[n]) {
      if (seen.has(n)) throw new Error(`${a.name}: cycle through ${n}`);
      seen.add(n);
    }
    if (!a.icon || !a.title || !a.description || !['task', 'goal', 'challenge'].includes(a.frame)) throw new Error(`${a.name}: incomplete display`);
  }
  for (const key of Object.keys(REWARDS)) if (!names.has(key)) throw new Error(`reward for unknown advancement ${key}`);
}

const text = t => ({ text: t });
const requirements = (criteria, all) => (all ? Object.keys(criteria).map(k => [k]) : [Object.keys(criteria)]);

export default async function () {
  const list = tree();
  if (list.length !== 30) throw new Error(`expected 30 advancements below the root, got ${list.length}`);
  checkTree(list);

  const files = {};
  const rootCriteria = { wheat_seeds: has('wheat_seeds') };
  files[`data/${NS}/advancement/root.json`] = {
    criteria: rootCriteria,
    display: {
      icon: { id: 'minecraft:wheat', count: 1 },
      title: text("Farmer's Almanac"),
      description: text('Pick up wheat seeds and start a farm'),
      frame: 'task',
      background: 'minecraft:textures/block/farmland_moist.png',
      show_toast: false,
      announce_to_chat: false
    },
    requirements: requirements(rootCriteria, false)
  };
  for (const a of list) {
    const adv = {
      parent: id(a.parent),
      criteria: a.criteria,
      display: { icon: { id: `minecraft:${a.icon}`, count: 1 }, title: text(a.title), description: text(a.description), frame: a.frame },
      requirements: requirements(a.criteria, a.all)
    };
    if (REWARDS[a.name]) adv.rewards = { experience: REWARDS[a.name] };
    files[`data/${NS}/advancement/${a.name}.json`] = adv;
  }
  return files;
}
