// Farmers Advancements: a new advancement tab "Farmer's Almanac" with 60 goals about crops, animals,
// farm food and farm tools, so a peaceful farm world has something to work towards.
// 1.0: 30 advancements. 1.2: 15 more about breeding and caring for animals (ANIMAL_CARE below).
// 1.3: 15 more about cooking and eating farm food (DISHES, CRAFTED, SMOKED, CAMPFIRE_FOOD, FARM_FOODS).
// Every criterion copies the shape of a vanilla advancement of the Minecraft version it is written for:
//   placed_block + "is this block"            (husbandry/plant_seed)
//   inventory_changed + items                 (husbandry/obtain_netherite_hoe; "count" is the item predicate's stack size)
//   bred_animals + child entity_properties    (husbandry/bred_all_animals)
//   tame_animal + entity entity_properties    (husbandry/complete_catalogue)
//   consume_item + item                       (husbandry/balanced_diet)
//   item_used_on_block + location_check       (husbandry/safely_harvest_honey)
//   player_interacted_with_entity + item + entity entity_properties (adventure/brush_armadillo,
//                                             husbandry/feed_snifflet for the baby flag)
//   recipe_crafted + recipe                   (adventure/trim_with_any_armor_pattern; it also fires when a
//                                             player takes the result out of a furnace or smoker)
//   item_used_on_block + location_check with block state + match_tool (adventure/lighten_up)
//   default_block_use + location_check        (no vanilla advancement uses it; it fires when a block is used
//                                             with the hand, like eating a slice of cake, and takes the same
//                                             "location" as item_used_on_block)
// Only experience as rewards, never items. No recipes, functions or loot table changes.
import fs from 'fs';
import path from 'path';

const NS = 'farmers_advancements';
const id = name => `${NS}:${name}`;

// ── what the Minecraft versions read differently ──────────────────────────────────────────────
// Compared in the vanilla files of data pack format 48 (Minecraft 1.21.1) and 121 (Minecraft 26.3):
//                           format 48                                   format 121
//   conditions of a trigger a list: [{ condition: "minecraft:x", … }]   one object: { type: "minecraft:x", … }
//   "is this block"         block_state_property + "block"              match_block + "blocks" (block_state_property is gone)
//   entity type             predicate { type: … }                       predicate { "minecraft:entity_type": … }
//   display icon            { id, count: 1 }                            { id }
//   background of the root  minecraft:textures/block/x.png              minecraft:block/x
//   baby flag of an entity  predicate { flags: { is_baby } }            predicate { "minecraft:flags": { is_baby } }
//   recipe of recipe_crafted "recipe_id": "minecraft:x"                 "recipes": "minecraft:x"
//   two conditions at once  a list of both                              { type: "minecraft:all_of", terms: [both] }
// The same in both: item predicates (items, count { min }), location_check and its block predicate
// (with "state"), match_tool, text components, frames, requirements, rewards and all nine trigger ids.
// checkVanilla() below compares the 1.3 spellings with each version's own vanilla files.
// The versions between the two have not been looked at, so the pack refuses to guess for them.
const OLD_SHAPE = 48;
const NEW_SHAPE = 121;
function isNew(format) {
  if (format <= OLD_SHAPE) return false;
  if (format >= NEW_SHAPE) return true;
  throw new Error(`farmers-advancements is written for data pack format ${OLD_SHAPE} (Minecraft 1.21.1) and ${NEW_SHAPE} or newer (26.3); format ${format} has not been compared with its vanilla files`);
}
const condition = (format, type, fields) => (isNew(format) ? { type: `minecraft:${type}`, ...fields } : [{ condition: `minecraft:${type}`, ...fields }]);
const isBlock = (format, block) => (isNew(format)
  ? condition(format, 'match_block', { blocks: `minecraft:${block}` })
  : condition(format, 'block_state_property', { block: `minecraft:${block}` }));
const isEntity = (format, entity) => condition(format, 'entity_properties', {
  entity: 'this',
  predicate: isNew(format) ? { 'minecraft:entity_type': `minecraft:${entity}` } : { type: `minecraft:${entity}` }
});
// An entity of one type that is (true) or is not (false) a baby; the shape of husbandry/feed_snifflet.
const isEntityAged = (format, entity, baby) => condition(format, 'entity_properties', {
  entity: 'this',
  predicate: isNew(format)
    ? { 'minecraft:entity_type': `minecraft:${entity}`, 'minecraft:flags': { is_baby: baby } }
    : { type: `minecraft:${entity}`, flags: { is_baby: baby } }
});
const icon = (format, item) => (isNew(format) ? { id: `minecraft:${item}` } : { id: `minecraft:${item}`, count: 1 });
const texture = (format, name) => (isNew(format) ? `minecraft:${name}` : `minecraft:textures/${name}.png`);

// ── criteria in vanilla shape ─────────────────────────────────────────────────────────────────
const planted = (format, block) => ({ trigger: 'minecraft:placed_block', conditions: { location: isBlock(format, block) } });
const has = (item, count) => ({
  trigger: 'minecraft:inventory_changed',
  conditions: { items: [{ items: item.startsWith('#') ? item : `minecraft:${item}`, ...(count ? { count: { min: count } } : {}) }] }
});
const bred = (format, entity) => ({ trigger: 'minecraft:bred_animals', conditions: { child: isEntity(format, entity) } });
const tamed = (format, entity) => ({ trigger: 'minecraft:tame_animal', conditions: { entity: isEntity(format, entity) } });
const ate = item => ({ trigger: 'minecraft:consume_item', conditions: { item: { items: `minecraft:${item}` } } });
// The player used an item on an entity (the item as it was before the use); baby: true/false/undefined (any age).
const usedOnEntity = (format, item, entity, baby) => ({
  trigger: 'minecraft:player_interacted_with_entity',
  conditions: { entity: baby === undefined ? isEntity(format, entity) : isEntityAged(format, entity, baby), item: { items: `minecraft:${item}` } }
});
const usedOn = (format, block) => ({
  trigger: 'minecraft:item_used_on_block',
  conditions: { location: condition(format, 'location_check', { predicate: { block: { blocks: `minecraft:${block}` } } }) }
});
// Both conditions must hold; the shape of adventure/lighten_up.
const allOf = (format, terms) => (isNew(format)
  ? { type: 'minecraft:all_of', terms: terms.map(([type, fields]) => ({ type: `minecraft:${type}`, ...fields })) }
  : terms.map(([type, fields]) => ({ condition: `minecraft:${type}`, ...fields })));
const ids = list => (list.length === 1 ? `minecraft:${list[0]}` : list.map(x => `minecraft:${x}`));
// One of the items used on one of the blocks in the given state.
const usedItemOn = (format, items, blocks, state) => ({
  trigger: 'minecraft:item_used_on_block',
  conditions: { location: allOf(format, [['location_check', { predicate: { block: { blocks: ids(blocks), ...(state ? { state } : {}) } } }], ['match_tool', { predicate: { items: ids(items) } }]]) }
});
// The player crafted (or took out of a furnace, smoker or campfire … with a player) the result of this recipe.
const crafted = (format, recipe) => ({ trigger: 'minecraft:recipe_crafted', conditions: { [isNew(format) ? 'recipes' : 'recipe_id']: `minecraft:${recipe}` } });
// The player used a block with the hand and it did something (cake: took a bite). The block is read
// after the use, so the last slice of a cake (which leaves air) does not count.
const usedBlock = (format, block) => ({
  trigger: 'minecraft:default_block_use',
  conditions: { location: condition(format, 'location_check', { predicate: { block: { blocks: `minecraft:${block}` } } }) }
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

// 1.2: more animals to breed, tame and care for, all in the animals branch. Every entity exists in
// Minecraft 1.21.1 and 26.3. Left out on purpose: turtles, frogs and sniffers (they lay eggs, so their
// breeding has no child to match), brushing an armadillo (vanilla's own "Isn't It Scute?") and leading
// frogs or riding with goats (vanilla husbandry advancements).
// [name, parent, icon, title, description, kind, entity, item (for use)]
//   kind: breed = bred_animals, tame = tame_animal, use = item used on a grown-up animal, feed_baby = item used on a baby
export const ANIMAL_CARE = [
  ['feed_calf', 'animals/breed_cow', 'wheat', 'Growing Up Fast', 'Feed wheat to a calf', 'feed_baby', 'cow', 'wheat'],
  ['breed_mooshroom', 'animals/breed_cow', 'red_mushroom', 'Mushroom Ranch', 'Breed two mooshrooms', 'breed', 'mooshroom'],
  ['mushroom_stew', 'animals/breed_mooshroom', 'mushroom_stew', 'Soup on Hooves', 'Fill a bowl with stew from a mooshroom', 'use', 'mooshroom', 'bowl'],
  ['shear_sheep', 'animals/breed_sheep', 'shears', 'Fresh Trim', 'Shear a sheep', 'use', 'sheep', 'shears'],
  ['breed_goat', 'animals/breed_sheep', 'goat_horn', 'Mountain Kids', 'Breed two goats', 'breed', 'goat'],
  ['milk_goat', 'animals/breed_goat', 'milk_bucket', 'Mountain Dairy', 'Fill a bucket with milk from a goat', 'use', 'goat', 'bucket'],
  ['breed_bee', 'animals/breed_rabbit', 'honeycomb', 'Birds and the Bees', 'Breed two bees', 'breed', 'bee'],
  ['breed_armadillo', 'animals/breed_bee', 'armadillo_scute', 'Tiny Tanks', 'Breed two armadillos', 'breed', 'armadillo'],
  ['breed_horse', 'animals/tame_horse', 'golden_apple', 'Foal Play', 'Breed two horses', 'breed', 'horse'],
  ['tame_donkey', 'animals/tame_horse', 'chest', 'Stubborn Friend', 'Tame a donkey', 'tame', 'donkey'],
  ['breed_donkey', 'animals/tame_donkey', 'golden_carrot', 'Long Ears, Short Legs', 'Breed two donkeys', 'breed', 'donkey'],
  ['tame_llama', 'animals/tame_horse', 'lead', 'No Spitting, Please', 'Tame a llama', 'tame', 'llama'],
  ['breed_llama', 'animals/tame_llama', 'white_carpet', 'Llama Drama', 'Breed two llamas', 'breed', 'llama'],
  ['breed_camel', 'animals/breed_llama', 'cactus', 'Desert Caravan', 'Breed two camels', 'breed', 'camel']
];
// The 15th: breed every animal of the list above.
export const RANCH = ANIMAL_CARE.filter(a => a[5] === 'breed').map(a => a[6]);

// Farm food eaten in the cooking branch: [item, name, parent, title, description]
export const COOKING = [
  ['bread', 'bread', 'root', 'Daily Bread', 'Eat a loaf of bread'],
  ['baked_potato', 'baked_potato', 'cooking/bread', 'Hot Potato', 'Eat a baked potato'],
  ['pumpkin_pie', 'pumpkin_pie', 'cooking/baked_potato', 'Harvest Pie', 'Eat a pumpkin pie'],
  ['beetroot_soup', 'beetroot_soup', 'cooking/pumpkin_pie', 'Red Soup', 'Eat a bowl of beetroot soup']
];
export const FEAST = ['bread', 'baked_potato', 'pumpkin_pie', 'beetroot_soup', 'cookie', 'golden_carrot', 'rabbit_stew', 'carrot', 'melon_slice', 'sweet_berries'];

// 1.3: cooking. Every item, block and recipe exists in Minecraft 1.21.1 and 26.3, and every food below
// is part of vanilla's husbandry/balanced_diet in both, so consume_item fires for it.
// Left out on purpose: eating golden carrots, rabbit stew, cookies and the raw crops on their own (part
// of the Harvest Feast already), golden apples and glow berries (not farm food), and the campfire's
// own cooking (it cooks without a player, so no trigger can see it; putting the food on counts instead).
// Food eaten on its own: [item, name, parent, title, description]
export const DISHES = [
  ['cooked_beef', 'steak', 'cooking/smoker', 'Steak Night', 'Eat a steak'],
  ['cooked_porkchop', 'porkchop', 'cooking/steak', 'Sunday Roast', 'Eat a cooked porkchop'],
  ['cooked_chicken', 'roast_chicken', 'cooking/porkchop', 'Chicken Dinner', 'Eat a cooked chicken'],
  ['cooked_mutton', 'mutton', 'cooking/roast_chicken', "Shepherd's Supper", 'Eat cooked mutton'],
  ['cooked_rabbit', 'rabbit', 'cooking/mutton', 'Bunny Roast', 'Eat a cooked rabbit'],
  ['mushroom_stew', 'mushroom_stew', 'cooking/beetroot_soup', 'Forest Bowl', 'Eat a bowl of mushroom stew'],
  ['suspicious_stew', 'suspicious_stew', 'cooking/mushroom_stew', 'Mystery Soup', 'Eat a suspicious stew'],
  ['honey_bottle', 'honey', 'cooking/pumpkin_pie', 'Sweet Sip', 'Drink a bottle of honey']
];
// Crafted at a crafting table: [recipe, name, parent, title, description]
export const CRAFTED = [
  ['cake', 'bake_cake', 'cooking/bread', 'Layer by Layer', 'Bake a cake'],
  ['golden_carrot', 'golden_carrot', 'cooking/bread', 'Gilded Harvest', 'Craft a golden carrot'],
  ['glistering_melon_slice', 'glistering_melon', 'cooking/golden_carrot', 'Shimmering Slice', 'Craft a glistering melon slice']
];
// The vanilla smoker recipes (result + "_from_smoking"); taking any of them out of a smoker counts.
export const SMOKED = ['baked_potato', 'cooked_beef', 'cooked_chicken', 'cooked_cod', 'cooked_mutton', 'cooked_porkchop', 'cooked_rabbit', 'cooked_salmon', 'dried_kelp'];
// What a campfire cooks: raw item → result (the vanilla recipe result + "_from_campfire_cooking").
export const CAMPFIRE_FOOD = { beef: 'cooked_beef', chicken: 'cooked_chicken', mutton: 'cooked_mutton', porkchop: 'cooked_porkchop', rabbit: 'cooked_rabbit', potato: 'baked_potato', cod: 'cooked_cod', salmon: 'cooked_salmon', kelp: 'dried_kelp' };
export const CAMPFIRES = ['campfire', 'soul_campfire'];
// The 15th: every farm food eaten once (consume_item), plus a slice of cake (default_block_use).
export const FARM_FOODS = ['carrot', 'potato', 'baked_potato', 'beetroot', 'beetroot_soup', 'bread', 'cookie', 'pumpkin_pie', 'melon_slice', 'sweet_berries',
  'golden_carrot', 'honey_bottle', 'mushroom_stew', 'suspicious_stew', 'rabbit_stew', 'cooked_beef', 'cooked_porkchop', 'cooked_chicken', 'cooked_mutton', 'cooked_rabbit'];

// Experience rewards: small for goals, larger for challenges. Nothing else is ever given.
export const REWARDS = {
  'planting/pitcher': 20,
  'harvest/wheat_stack': 10,
  'harvest/potato_stack': 10,
  'harvest/every_crop': 100,
  'animals/eggs': 10,
  'animals/breed_all': 50,
  'tools/diamond_hoe': 20,
  'cooking/feast': 50,
  'animals/breed_armadillo': 20,
  'animals/breed_camel': 20,
  'animals/breed_ranch': 50,
  'cooking/suspicious_stew': 20,
  'cooking/glistering_melon': 20,
  'cooking/rabbit': 10,
  'cooking/farm_to_table': 100
};
const GOALS = new Set(['animals/breed_armadillo', 'animals/breed_camel', 'cooking/suspicious_stew', 'cooking/glistering_melon', 'cooking/rabbit']);

// ── the tree ──────────────────────────────────────────────────────────────────────────────────
// Each entry: { name, parent, icon, title, description, frame, criteria, all }
// all = true: every criterion is needed; otherwise any one of them is enough.
// format: the data pack format the criteria are written for; the tree itself is the same for every version.
export function tree(format) {
  const list = [];
  const add = (name, parent, icon, title, description, criteria, { frame = 'task', all = false } = {}) =>
    list.push({ name, parent, icon, title, description, frame, criteria, all });

  for (const [name, block, icon, parent, title, desc] of PLANTING) {
    add(`planting/${name}`, parent, icon, title, desc, { [name]: planted(format, block) }, { frame: name === 'pitcher' ? 'goal' : 'task' });
  }

  add('harvest/wheat_stack', 'planting/wheat', 'wheat', 'Full Sheaf', 'Hold a full stack of 64 wheat', { wheat: has('wheat', 64) }, { frame: 'goal' });
  add('harvest/potato_stack', 'harvest/wheat_stack', 'potato', 'Root Cellar', 'Hold a full stack of 64 potatoes', { potato: has('potato', 64) }, { frame: 'goal' });
  add('harvest/every_crop', 'harvest/potato_stack', 'hay_block', 'Almanac Complete',
    'Collect every crop at least once: wheat, carrot, potato, beetroot, pumpkin, melon slice, sweet berries, nether wart, torchflower and pitcher plant',
    Object.fromEntries(CROPS.map(c => [c, has(c)])), { frame: 'challenge', all: true });

  for (const [entity, name, parent, title, desc] of BREEDING) add(`animals/${name}`, parent, BREED_ICON[entity], title, desc, { [entity]: bred(format, entity) });
  add('animals/milk', 'animals/breed_cow', 'milk_bucket', 'Fresh From the Cow', 'Fill a bucket with milk', { milk: has('milk_bucket') });
  add('animals/eggs', 'animals/breed_chicken', 'egg', 'Egg Basket', 'Hold a full stack of 16 eggs', { eggs: has('egg', 16) }, { frame: 'goal' });
  add('animals/breed_all', 'animals/breed_rabbit', 'golden_carrot', 'Full Barnyard', 'Breed cows, sheep, pigs, chickens and rabbits',
    Object.fromEntries(BREEDING.map(([entity]) => [entity, bred(format, entity)])), { frame: 'challenge', all: true });
  add('animals/tame_horse', 'root', 'saddle', 'Plow Horse', 'Tame a horse', { horse: tamed(format, 'horse') });
  for (const [name, parent, ico, title, desc, kind, entity, item] of ANIMAL_CARE) {
    const criterion = kind === 'breed' ? bred(format, entity)
      : kind === 'tame' ? tamed(format, entity)
        : usedOnEntity(format, item, entity, kind === 'feed_baby');
    add(`animals/${name}`, parent, ico, title, desc, { [entity]: criterion }, { frame: GOALS.has(`animals/${name}`) ? 'goal' : 'task' });
  }
  add('animals/breed_ranch', 'animals/breed_camel', 'hay_block', 'Wide Open Range',
    'Breed mooshrooms, goats, bees, armadillos, horses, donkeys, llamas and camels',
    Object.fromEntries(RANCH.map(entity => [entity, bred(format, entity)])), { frame: 'challenge', all: true });

  for (const [item, name, parent, title, desc] of COOKING) add(`cooking/${name}`, parent, item, title, desc, { [item]: ate(item) });
  add('cooking/feast', 'cooking/beetroot_soup', 'cake', 'Harvest Feast',
    'Eat bread, a baked potato, pumpkin pie, beetroot soup, a cookie, a golden carrot, rabbit stew, a carrot, a melon slice and sweet berries',
    Object.fromEntries(FEAST.map(f => [f, ate(f)])), { frame: 'challenge', all: true });

  add('tools/any_hoe', 'root', 'wooden_hoe', 'Hoe Down', 'Get any hoe', { hoe: has('#minecraft:hoes') });
  add('tools/compost', 'tools/any_hoe', 'composter', 'Nothing Goes to Waste', 'Put something into a composter', { compost: usedOn(format, 'composter') });
  add('tools/diamond_hoe', 'tools/any_hoe', 'diamond_hoe', 'Diamond Harvest', 'Get a diamond hoe', { diamond_hoe: has('diamond_hoe') }, { frame: 'goal' });

  // 1.3: cooking
  const frame = name => (GOALS.has(name) ? 'goal' : 'task');
  add('cooking/smoker', 'cooking/baked_potato', 'smoker', 'Smokehouse', 'Take cooked food out of a smoker',
    Object.fromEntries(SMOKED.map(r => [r, crafted(format, `${r}_from_smoking`)])));
  add('cooking/campfire', 'cooking/smoker', 'campfire', 'Open Fire', 'Put raw food on a lit campfire',
    { campfire: usedItemOn(format, Object.keys(CAMPFIRE_FOOD), CAMPFIRES, { lit: 'true' }) });
  for (const [item, name, parent, title, desc] of DISHES) add(`cooking/${name}`, parent, item, title, desc, { [item]: ate(item) }, { frame: frame(`cooking/${name}`) });
  for (const [recipe, name, parent, title, desc] of CRAFTED) add(`cooking/${name}`, parent, recipe, title, desc, { [recipe]: crafted(format, recipe) }, { frame: frame(`cooking/${name}`) });
  add('cooking/cake_slice', 'cooking/bake_cake', 'cake', 'Piece of Cake', 'Eat a slice of cake', { cake: usedBlock(format, 'cake') });
  add('cooking/farm_to_table', 'cooking/feast', 'rabbit_stew', 'Farm to Table',
    'Eat carrot, potato, baked potato, beetroot, beetroot soup, bread, a cookie, pumpkin pie, a slice of cake, melon, sweet berries, a golden carrot, honey, mushroom stew, suspicious stew, rabbit stew and cooked beef, porkchop, chicken, mutton and rabbit',
    { ...Object.fromEntries(FARM_FOODS.map(f => [f, ate(f)])), cake: usedBlock(format, 'cake') }, { frame: 'challenge', all: true });
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

// The 1.3 spellings, compared with this version's own vanilla files; the build stops if one differs.
// Also checks that every recipe the cooking branch names exists and cooks what the tables say.
export function checkVanilla(vanilla, format) {
  const read = rel => {
    const file = path.join(vanilla.data, 'minecraft', rel);
    if (!fs.existsSync(file)) throw new Error(`farmers-advancements: vanilla ${rel} is missing`);
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const trim = read('advancement/adventure/trim_with_any_armor_pattern.json').criteria;
  const trimKey = Object.keys(trim).find(k => k.endsWith('bolt_armor_trim_smithing_template_smithing_trim'));
  if (!trimKey || !same(trim[trimKey], { conditions: crafted(format, 'bolt_armor_trim_smithing_template_smithing_trim').conditions, trigger: 'minecraft:recipe_crafted' })) {
    throw new Error(`farmers-advancements: vanilla recipe_crafted is written as ${JSON.stringify(trim[trimKey])}`);
  }
  const light = read('advancement/adventure/lighten_up.json').criteria.lighten_up.conditions.location;
  const [where, tool] = isNew(format) ? (light.type === 'minecraft:all_of' ? light.terms : []) : light;
  if (!where || (isNew(format) ? where.type : where.condition) !== 'minecraft:location_check' || !same(where.predicate.block.state, { lit: 'true' })
    || (isNew(format) ? tool.type : tool.condition) !== 'minecraft:match_tool' || !Array.isArray(tool.predicate.items)) {
    throw new Error(`farmers-advancements: vanilla adventure/lighten_up is written as ${JSON.stringify(light)}`);
  }
  for (const r of SMOKED) if (read(`recipe/${r}_from_smoking.json`).type !== 'minecraft:smoking') throw new Error(`farmers-advancements: ${r}_from_smoking is not a smoker recipe`);
  for (const [raw, result] of Object.entries(CAMPFIRE_FOOD)) {
    const recipe = read(`recipe/${result}_from_campfire_cooking.json`);
    if (recipe.type !== 'minecraft:campfire_cooking' || !JSON.stringify(recipe.ingredient).includes(`"minecraft:${raw}"`)) throw new Error(`farmers-advancements: ${result}_from_campfire_cooking does not cook ${raw}`);
  }
  for (const [recipe] of CRAFTED) if (read(`recipe/${recipe}.json`).result?.id !== `minecraft:${recipe}`) throw new Error(`farmers-advancements: recipe ${recipe} does not make ${recipe}`);
  const diet = read('advancement/husbandry/balanced_diet.json').criteria;
  for (const f of new Set([...FARM_FOODS, ...DISHES.map(d => d[0])])) {
    if (!diet[f] || diet[f].trigger !== 'minecraft:consume_item') throw new Error(`farmers-advancements: ${f} is not eaten in vanilla husbandry/balanced_diet`);
  }
}

// Called once per Minecraft version; the same 61 files under the same paths for every version.
export default async function ({ format, vanilla }) {
  const list = tree(format);
  if (list.length !== 60) throw new Error(`expected 60 advancements below the root, got ${list.length}`);
  checkTree(list);
  checkVanilla(vanilla, format);

  const files = {};
  const rootCriteria = { wheat_seeds: has('wheat_seeds') };
  files[`data/${NS}/advancement/root.json`] = {
    criteria: rootCriteria,
    display: {
      icon: icon(format, 'wheat'),
      title: text("Farmer's Almanac"),
      description: text('Pick up wheat seeds and start a farm'),
      frame: 'task',
      background: texture(format, 'block/farmland_moist'),
      show_toast: false,
      announce_to_chat: false
    },
    requirements: requirements(rootCriteria, false)
  };
  for (const a of list) {
    const adv = {
      parent: id(a.parent),
      criteria: a.criteria,
      display: { icon: icon(format, a.icon), title: text(a.title), description: text(a.description), frame: a.frame },
      requirements: requirements(a.criteria, a.all)
    };
    if (REWARDS[a.name]) adv.rewards = { experience: REWARDS[a.name] };
    files[`data/${NS}/advancement/${a.name}.json`] = adv;
  }
  return files;
}
