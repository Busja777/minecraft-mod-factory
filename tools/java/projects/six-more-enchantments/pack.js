// Enchanting Extras (formerly Six More Enchantments): new enchantments in the data-driven enchantment format of 1.21+ (six in
// V1.0, three more in V1.1). Each one only changes attributes of the player while the enchanted
// item is worn or held ("minecraft:attributes", the effect vanilla uses for Swift Sneak and
// Respiration), so nothing is scripted and nothing runs every tick. No new items, no functions.
//
//   Reach       pickaxe, axe, shovel, hoe, shears (main hand)  block reach +0.5 / +1.0 (vanilla 4.5)
//   Stepping    boots                                          step height +0.5 (0.6 → 1.1: walk up full blocks)
//   Leaping     boots                                          jump strength +0.04 / +0.08 (vanilla 0.42) and
//                                                               safe fall distance +1 / +2 (as Jump Boost does)
//   Vitality    chestplate                                     max health +2 / +4 (one / two hearts)
//   Swiftness   leggings                                       walking speed +5 % / +10 % of the base speed
//   Steadfast   leggings                                       knockback resistance +10 % / +20 %
// V1.1:
//   Quickstrike sword, axe (26.3: also spear) (main hand)      attack speed +10 % / +20 % of the weapon's own speed
//                                                               (sword 1.6 → 1.76 / 1.92, axe 1.0 → 1.1 / 1.2)
//   Outreach    sword, axe (26.3: also spear) (main hand)      attack reach +0.5 (entity interaction range, vanilla 3)
//   Tempered    helmet                                         armour toughness +1 / +2 (diamond helmet has 2)
//
// Jump heights (simulated with the game's jump physics, gravity 0.08, drag 0.98 per tick):
//   0.42 → 1.25 blocks (vanilla), 0.46 → 1.48 (Leaping I, a fence of 1.5 still stops you),
//   0.50 → 1.71 (Leaping II, clears fences and walls like Jump Boost I).
// Tempered, worked through the damage formula (reduction = clamp(armour − 4·damage / (toughness + 8),
// armour / 5, 20) / 25): a 20-damage hit on full iron armour (15 points, toughness 0) is reduced
// by 20 % without and 28 % with Tempered II; on full diamond 60 % → 62 %. Small hits do not change.
//
// Fairness: every enchantment has a small effect, at most two levels, rare weight (2) and the anvil
// cost vanilla gives rare enchantments (4); Steadfast and Tempered are the weakest and therefore
// uncommon (weight 5, anvil cost 2). Choices instead of stacking:
//   Stepping    ↔ Leaping    (own set exclusive_set/boots)
//   Swiftness   ↔ Steadfast  (own set exclusive_set/legs)
//   Quickstrike ↔ Outreach   (own set exclusive_set/weapon)
//   Vitality  ↔ Protection, Fire/Blast/Projectile Protection (vanilla #minecraft:exclusive_set/armor),
//               so the extra hearts cost the chestplate's protection enchantment.
// Tempered stacks with Protection on purpose: it only helps against big hits and is weaker than any
// protection enchantment, so excluding them would leave it without a use.
// Not built, because vanilla already has an enchantment for the same attribute or effect:
// mining_efficiency / block_break_speed (Efficiency), submerged_mining_speed (Aqua Affinity),
// oxygen_bonus (Respiration), sneaking_speed (Swift Sneak), safe_fall_distance and
// fall_damage_multiplier (Feather Falling, and Leaping already uses it), luck (only fishing reads it:
// Luck of the Sea), movement_efficiency (Soul Speed, Depth Strider), water_movement_efficiency
// (Depth Strider), attack_damage (Sharpness), attack_knockback (Knockback),
// explosion_knockback_resistance (Blast Protection), burning_time (Fire Protection),
// sweeping_damage_ratio (Sweeping Edge).
// Where they appear: only in the enchanting table (and so on books from the table, and through the
// anvil). They are added to #minecraft:in_enchanting_table directly, not to #minecraft:non_treasure,
// because vanilla's on_random_loot, tradeable, on_traded_equipment and on_mob_spawn_equipment all
// include non_treasure: they stay out of chest loot, librarian trades and mob gear.
//
// The game reads two spellings: the attribute ids are e.g. "minecraft:generic.step_height" /
// "minecraft:player.block_interaction_range" in 1.21.1 and "minecraft:step_height" /
// "minecraft:block_interaction_range" in 26.3. The id is never guessed: it is taken from the
// version's attribute registry and checked against what the version's own vanilla enchantments
// (Respiration, Swift Sneak, Fire Protection) write. Item tags are the ones both versions have
// (enchantable/sharp_weapon: swords and axes, in 26.3 also spears; 26.3 has no enchantable/sword).
// Everything else is the same in both versions, and the build stops if a vanilla enchantment is
// shaped differently than this file expects.
import fs from 'fs';
import path from 'path';

const NS = 'six_more_enchantments';

// [base, per level above the first] of the enchanting power range in which a level can be rolled.
// Every level must fit below the table's highest power (30 levels plus the item's enchantability).
export const ENCHANTMENTS = [
  {
    name: 'reach', title: 'Reach', items: 'mining', slot: 'mainhand',
    maxLevel: 2, weight: 2, anvilCost: 4, minCost: [10, 10], maxCost: [40, 10],
    attributes: [{ attribute: 'block_interaction_range', operation: 'add_value', base: 0.5, perLevel: 0.5 }]
  },
  {
    name: 'stepping', title: 'Stepping', items: 'foot_armor', slot: 'feet',
    maxLevel: 1, weight: 2, anvilCost: 4, minCost: [10, 0], maxCost: [40, 0], exclusive: 'boots',
    attributes: [{ attribute: 'step_height', operation: 'add_value', base: 0.5, perLevel: 0 }]
  },
  {
    name: 'leaping', title: 'Leaping', items: 'foot_armor', slot: 'feet',
    maxLevel: 2, weight: 2, anvilCost: 4, minCost: [10, 10], maxCost: [40, 10], exclusive: 'boots',
    attributes: [
      { attribute: 'jump_strength', operation: 'add_value', base: 0.04, perLevel: 0.04 },
      { attribute: 'safe_fall_distance', operation: 'add_value', base: 1, perLevel: 1 }
    ]
  },
  {
    name: 'vitality', title: 'Vitality', items: 'chest_armor', slot: 'chest',
    maxLevel: 2, weight: 2, anvilCost: 4, minCost: [15, 15], maxCost: [45, 15], exclusive: '#minecraft:exclusive_set/armor',
    attributes: [{ attribute: 'max_health', operation: 'add_value', base: 2, perLevel: 2 }]
  },
  {
    name: 'swiftness', title: 'Swiftness', items: 'leg_armor', slot: 'legs',
    sharesVanilla: 'movement_speed', // Soul Speed: only on soul sand and soul soil
    maxLevel: 2, weight: 2, anvilCost: 4, minCost: [10, 10], maxCost: [40, 10], exclusive: 'legs',
    attributes: [{ attribute: 'movement_speed', operation: 'add_multiplied_base', base: 0.05, perLevel: 0.05 }]
  },
  {
    name: 'steadfast', title: 'Steadfast', items: 'leg_armor', slot: 'legs',
    maxLevel: 2, weight: 5, anvilCost: 2, minCost: [5, 8], maxCost: [35, 8], exclusive: 'legs',
    attributes: [{ attribute: 'knockback_resistance', operation: 'add_value', base: 0.1, perLevel: 0.1 }]
  },
  // V1.1
  {
    name: 'quickstrike', title: 'Quickstrike', items: 'sharp_weapon', slot: 'mainhand',
    maxLevel: 2, weight: 2, anvilCost: 4, minCost: [10, 10], maxCost: [40, 10], exclusive: 'weapon',
    attributes: [{ attribute: 'attack_speed', operation: 'add_multiplied_total', base: 0.1, perLevel: 0.1 }]
  },
  {
    name: 'outreach', title: 'Outreach', items: 'sharp_weapon', slot: 'mainhand',
    maxLevel: 1, weight: 2, anvilCost: 4, minCost: [15, 0], maxCost: [45, 0], exclusive: 'weapon',
    attributes: [{ attribute: 'entity_interaction_range', operation: 'add_value', base: 0.5, perLevel: 0 }]
  },
  {
    name: 'tempered', title: 'Tempered', items: 'head_armor', slot: 'head',
    maxLevel: 2, weight: 5, anvilCost: 2, minCost: [5, 8], maxCost: [35, 8],
    attributes: [{ attribute: 'armor_toughness', operation: 'add_value', base: 1, perLevel: 1 }]
  }
];

// The highest enchanting power a table can reach: 30 bookshelves' worth of levels, plus at most
// half of the best enchantability among the items (netherite/gold armour 25, gold tools 22) + 1,
// times the ±15 % random factor. A level whose min cost lies above it could never be rolled.
const TABLE_MAX_POWER = Math.floor((30 + 1 + Math.floor(25 / 4) * 2) * 1.15);

const fail = msg => { throw new Error(`six-more-enchantments: ${msg}`); };
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf-8'));
const sameKeys = (object, keys) => Object.keys(object).sort().join() === [...keys].sort().join();

// "step_height" → "minecraft:generic.step_height" (1.21.1) or "minecraft:step_height" (26.3),
// whichever the version's attribute registry has; exactly one must exist.
export function attributeId(attributes, name) {
  const found = [name, `generic.${name}`, `player.${name}`].filter(n => attributes.has(n));
  if (found.length !== 1) fail(`attribute ${name}: ${found.length ? `two spellings (${found.join(', ')})` : 'not in this version'}`);
  return `minecraft:${found[0]}`;
}

// The shape of a vanilla attribute enchantment of this version; stops on anything new.
function checkVanilla(vanilla, attributes) {
  const dir = path.join(vanilla.data, 'minecraft', 'enchantment');
  const TOP = ['anvil_cost', 'description', 'effects', 'max_cost', 'max_level', 'min_cost', 'slots', 'supported_items', 'weight'];
  for (const [name, attribute, keys] of [
    ['respiration', 'oxygen_bonus', TOP],
    ['swift_sneak', 'sneaking_speed', TOP],
    ['fire_protection', 'burning_time', [...TOP, 'exclusive_set']]
  ]) {
    const file = path.join(dir, `${name}.json`);
    if (!fs.existsSync(file)) fail(`vanilla enchantment ${name} is missing`);
    const j = readJson(file);
    if (!sameKeys(j, keys)) fail(`vanilla ${name} has the keys ${Object.keys(j).join(', ')}`);
    const effect = j.effects['minecraft:attributes']?.[0];
    if (!effect || !sameKeys(effect, ['amount', 'attribute', 'id', 'operation'])) fail(`vanilla ${name}: attribute effect is shaped differently`);
    if (effect.amount.type !== 'minecraft:linear' || !sameKeys(effect.amount, ['type', 'base', 'per_level_above_first'])) fail(`vanilla ${name}: amount is not linear`);
    if (effect.attribute !== attributeId(attributes, attribute)) fail(`vanilla ${name} names its attribute ${effect.attribute}, not ${attributeId(attributes, attribute)}`);
    if (!sameKeys(j.min_cost, ['base', 'per_level_above_first']) || !Array.isArray(j.slots) || typeof j.supported_items !== 'string') fail(`vanilla ${name}: costs, slots or items changed shape`);
    if (j.exclusive_set !== undefined && typeof j.exclusive_set !== 'string') fail(`vanilla ${name}: exclusive_set is not a tag`);
  }
  const table = readJson(path.join(vanilla.data, 'minecraft', 'tags', 'enchantment', 'in_enchanting_table.json'));
  if (!Array.isArray(table.values)) fail('vanilla in_enchanting_table is not a plain tag');
  // No enchantment of this pack changes an attribute a vanilla enchantment of this version already
  // changes (anywhere in its effects, also inside location_changed), except where the vanilla one
  // only works in a special place (sharesVanilla).
  const used = new Set();
  const collect = node => {
    if (Array.isArray(node)) node.forEach(collect);
    else if (node && typeof node === 'object') {
      if (typeof node.attribute === 'string') used.add(node.attribute);
      Object.values(node).forEach(collect);
    }
  };
  for (const file of fs.readdirSync(dir)) collect(readJson(path.join(dir, file)).effects);
  if (used.size < 5) fail(`only ${used.size} attributes found in vanilla enchantments`);
  for (const e of ENCHANTMENTS) {
    for (const a of e.attributes) {
      if (used.has(attributeId(attributes, a.attribute)) && e.sharesVanilla !== a.attribute) fail(`${e.name}: a vanilla enchantment already changes ${a.attribute}`);
    }
  }
}

// Values and their combinations, independent of the version.
export function checkDesign(list = ENCHANTMENTS) {
  const names = new Set();
  for (const e of list) {
    if (names.has(e.name)) fail(`${e.name} is defined twice`);
    names.add(e.name);
    if (!(e.maxLevel >= 1 && e.maxLevel <= 2)) fail(`${e.name}: at most two levels`);
    if (![1, 2, 5, 10].includes(e.weight)) fail(`${e.name}: weight ${e.weight} is not a vanilla rarity`);
    if (e.anvilCost !== { 10: 1, 5: 2, 2: 4, 1: 8 }[e.weight]) fail(`${e.name}: anvil cost ${e.anvilCost} does not match weight ${e.weight} as in vanilla`);
    for (let level = 1; level <= e.maxLevel; level++) {
      const min = e.minCost[0] + e.minCost[1] * (level - 1);
      const max = e.maxCost[0] + e.maxCost[1] * (level - 1);
      if (!(min >= 1 && max > min)) fail(`${e.name} ${level}: cost range ${min}–${max}`);
      if (min > TABLE_MAX_POWER) fail(`${e.name} ${level}: needs power ${min}, a table reaches ${TABLE_MAX_POWER}`);
    }
    if (e.maxLevel === 1 && (e.minCost[1] || e.maxCost[1] || e.attributes.some(a => a.perLevel))) fail(`${e.name}: one level, so nothing per level`);
  }
  // Own exclusive sets: every member names the set, and a set is a real choice (two or more).
  const sets = {};
  for (const e of list) if (e.exclusive && !e.exclusive.startsWith('#')) (sets[e.exclusive] ||= []).push(e.name);
  for (const [set, members] of Object.entries(sets)) if (members.length < 2) fail(`exclusive set ${set} has only ${members.join()}`);
  // Two enchantments for the same slot that change the same attribute would add up.
  for (const a of list) for (const b of list) {
    if (a !== b && a.slot === b.slot && a.attributes.some(x => b.attributes.some(y => y.attribute === x.attribute))) fail(`${a.name} and ${b.name} both change the same attribute`);
  }
  return sets;
}

export default async function ({ vanilla, registry }) {
  const attributes = registry('attribute');
  checkVanilla(vanilla, attributes);
  const sets = checkDesign();

  const files = {};
  for (const e of ENCHANTMENTS) {
    const itemTag = path.join(vanilla.data, 'minecraft', 'tags', 'item', 'enchantable', `${e.items}.json`);
    if (!fs.existsSync(itemTag)) fail(`${e.name}: no item tag enchantable/${e.items}`);
    let exclusive;
    if (e.exclusive?.startsWith('#minecraft:')) {
      const tag = path.join(vanilla.data, 'minecraft', 'tags', 'enchantment', `${e.exclusive.slice('#minecraft:'.length)}.json`);
      if (!fs.existsSync(tag)) fail(`${e.name}: vanilla has no enchantment tag ${e.exclusive}`);
      exclusive = e.exclusive;
    } else if (e.exclusive) exclusive = `#${NS}:exclusive_set/${e.exclusive}`;
    // Keys in the order vanilla writes them.
    files[`data/${NS}/enchantment/${e.name}.json`] = {
      anvil_cost: e.anvilCost,
      description: { translate: `enchantment.${NS}.${e.name}`, fallback: e.title },
      effects: {
        'minecraft:attributes': e.attributes.map(a => ({
          amount: { type: 'minecraft:linear', base: a.base, per_level_above_first: a.perLevel },
          attribute: attributeId(attributes, a.attribute),
          id: `${NS}:enchantment.${e.name}`,
          operation: a.operation
        }))
      },
      ...(exclusive ? { exclusive_set: exclusive } : {}),
      max_cost: { base: e.maxCost[0], per_level_above_first: e.maxCost[1] },
      max_level: e.maxLevel,
      min_cost: { base: e.minCost[0], per_level_above_first: e.minCost[1] },
      slots: [e.slot],
      supported_items: `#minecraft:enchantable/${e.items}`,
      weight: e.weight
    };
  }
  for (const [set, members] of Object.entries(sets)) {
    files[`data/${NS}/tags/enchantment/exclusive_set/${set}.json`] = { values: members.map(m => `${NS}:${m}`) };
  }
  // Appended to the vanilla tag ("replace": false keeps vanilla's own entries and other packs' additions).
  files['data/minecraft/tags/enchantment/in_enchanting_table.json'] = { replace: false, values: ENCHANTMENTS.map(e => `${NS}:${e.name}`) };
  return files;
}
