// More Trim Materials: eight more items work as armor trim materials in the smithing table. Each one
// is a new trim material (data/<ns>/trim_material) with its own colour palette (assets), so worn
// armor shows the trim in that colour, the armor icon shows it too and the tooltip names it.
//
// How the smithing table learns the new materials:
// Up to Minecraft 1.21.4 a trim material names its item ("ingredient") and the item tag
// minecraft:trim_materials lets the smithing table accept it. From 1.21.5 on the item itself says
// which material it gives (the item component minecraft:provides_trim_material, read by
// SmithingTrimRecipe.applyTrim), and a data pack cannot give a vanilla item a component. So this
// pack does not use the vanilla trim recipe at all, in no version: for every armor piece, trim
// pattern and material it has one smithing_transform recipe (template + armor + material) whose
// result is the same armor with the minecraft:trim component set. The game copies all components
// of the armor (enchantments, damage, name, dye) into the result and then sets the trim
// (26.3: TransmuteRecipe.createWithOriginalComponents → ItemStackTemplate.apply). Template, armor
// and material are used up like in the vanilla trim recipe. The items are not added to the tag:
// from 1.21.5 on the vanilla trim recipe would then accept them and give nothing.
//
// Armor: the 25 pieces that every served version has. Copper armor (1.21.9 and newer) is left out:
// every file of the newest version must also exist for 1.21.1, where copper armor does not exist.
//
// Formats, each copied from that version's own vanilla files:
//   trim_material  1.21.1–1.21.3: asset_name, description, ingredient, item_model_index
//                  (1.21.4 drops item_model_index, 1.21.5 drops ingredient; both read the 1.21.2
//                  files and ignore the extra fields), 26.3: description, palette_id
//   recipe         like recipe/netherite_helmet_smithing.json: { "item": … } up to format 56, plain ids from 57
//   palettes       1.21.1–26.2: textures/trims/color_palettes/<name>.png through the atlases armor_trims
//                  (worn), blocks or items (icon); 26.3: textures/palettes/trim/<name>.png, named by
//                  palette_id (worn) and the items atlas (icon)
//   armor icons    1.21.1–1.21.3: models/item/<armor>.json "overrides" on trim_type (item_model_index);
//                  1.21.4 on: items/<armor>.json, a select on minecraft:trim_material. Both replace
//                  the vanilla file of the armor piece with vanilla's content plus the new cases.
import fs from 'fs';
import path from 'path';
import { ensureVanilla } from '../../vanilla.js';

const NS = 'more_trim_materials';

// The materials: the item, the colour of the name in the tooltip and the palette (8 colours,
// light to dark, the shape of the vanilla palettes). Names: assets/<ns>/lang/en_us.json.
export const MATERIALS = [
  { name: 'coal', item: 'coal', title: 'Coal', color: '#4E5158', palette: ['#7d8088', '#5b5e65', '#43464c', '#33353a', '#26282c', '#1b1c1f', '#111214', '#08090a'] },
  { name: 'obsidian', item: 'obsidian', title: 'Obsidian', color: '#6A4FA0', palette: ['#6a52a0', '#4f3a7c', '#3b2a5e', '#2c1f47', '#211838', '#18112a', '#0f0a1c', '#07040e'] },
  { name: 'echo', item: 'echo_shard', title: 'Echo', color: '#1F8A96', palette: ['#4fd0d8', '#2aa4b0', '#1a8290', '#126675', '#0c4f5d', '#083c48', '#052a34', '#02181f'] },
  { name: 'slime', item: 'slime_ball', title: 'Slime', color: '#7CC95A', palette: ['#c4f5a0', '#9be27a', '#7cc95a', '#5faa44', '#488b34', '#356c27', '#244d1a', '#142f0e'] },
  { name: 'breeze', item: 'breeze_rod', title: 'Breeze', color: '#959EE0', palette: ['#e6e8ff', '#c0c6f6', '#9ba3e2', '#7c84c8', '#6067a8', '#474d88', '#323666', '#1e2144'] },
  { name: 'nether_brick', item: 'nether_brick', title: 'Nether Brick', color: '#8E3A46', palette: ['#a8505c', '#8e3a46', '#742d37', '#5c222b', '#481a21', '#361318', '#250c10', '#160608'] },
  { name: 'chorus', item: 'popped_chorus_fruit', title: 'Chorus', color: '#C796CB', palette: ['#f4dcf4', '#ddb6de', '#c796cb', '#ab7aaf', '#8d6092', '#6e4973', '#503354', '#331f36'] },
  { name: 'prismarine', item: 'prismarine_shard', title: 'Prismarine', color: '#63A893', palette: ['#b8e4d6', '#8ecbb9', '#69ae9b', '#4f917f', '#3c7566', '#2c5b4f', '#1e4238', '#122a24'] }
];

export const ARMOR = [
  ...['leather', 'chainmail', 'iron', 'golden', 'diamond', 'netherite'].flatMap(m => ['helmet', 'chestplate', 'leggings', 'boots'].map(p => `${m}_${p}`)),
  'turtle_helmet'
];
// The trim texture of an armor icon (trims/items/<slot>_trim).
const SLOT = armor => armor.split('_').at(-1);

// The key of a material in the atlases and its 1.21.x asset_name: with the namespace, so another
// pack's "coal" palette cannot replace this one.
export const assetKey = m => `${NS}_${m.name}`;
const materialId = m => `${NS}:${m.name}`;
const translationKey = m => `trim_material.${NS}.${m.name}`;

// ---- reading vanilla ---------------------------------------------------------------------------

const read = (...parts) => JSON.parse(fs.readFileSync(path.join(...parts), 'utf-8'));
const has = (...parts) => fs.existsSync(path.join(...parts));
const data = (vanilla, ...parts) => read(vanilla.data, 'minecraft', ...parts);
const assets = (vanilla, ...parts) => path.join(vanilla.assets, 'minecraft', ...parts);
const strip = id => String(id).replace(/^minecraft:/, '');
const items = (vanilla, tag) => data(vanilla, 'tags', 'item', `${tag}.json`).values
  .flatMap(v => v.startsWith('#') ? items(vanilla, strip(v.slice(1))) : [strip(v)]);

// Trim pattern → its smithing template: from 1.21.5 on the trim recipe names the pattern, before
// that the pattern names its template (trim_pattern/<p>.json "template_item").
export function templates(vanilla) {
  const dir = path.join(vanilla.data, 'minecraft', 'recipe');
  const out = {};
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('_smithing_trim.json'))) {
    const r = read(dir, f);
    if (r.type !== 'minecraft:smithing_trim') continue;
    const template = strip(typeof r.template === 'string' ? r.template : r.template.item);
    const pattern = r.pattern ? strip(r.pattern) : Object.entries(patternFiles(vanilla)).find(([, p]) => strip(p.template_item) === template)?.[0];
    if (!pattern) throw new Error(`${f}: no trim pattern found for ${template}`);
    out[pattern] = template;
  }
  return out;
}
const patternFiles = vanilla => Object.fromEntries(fs.readdirSync(path.join(vanilla.data, 'minecraft', 'trim_pattern'))
  .map(f => [f.replace(/\.json$/, ''), data(vanilla, 'trim_pattern', f)]));

// The atlas source that colours a list of trim textures (vanilla's paletted_permutations), or null.
function trimSource(vanilla, atlas) {
  const file = assets(vanilla, 'atlases', `${atlas}.json`);
  if (!fs.existsSync(file)) return null;
  const sources = JSON.parse(fs.readFileSync(file, 'utf-8')).sources.filter(s => /paletted_permutations$/.test(s.type) && /trim/.test(JSON.stringify(s.textures)));
  if (sources.length > 1) throw new Error(`atlases/${atlas}.json: more than one trim source`);
  return sources[0] || null;
}

// ---- the files ---------------------------------------------------------------------------------

// trim_material/<name>.json in the version's own format: vanilla amethyst.json (no armor overrides)
// field by field. A field this pack does not know stops the build.
export function trimMaterial(vanillaAmethyst, m, index) {
  const out = {};
  for (const key of Object.keys(vanillaAmethyst)) {
    if (key === 'asset_name') out[key] = assetKey(m);
    else if (key === 'description') out[key] = { color: m.color, translate: translationKey(m) };
    else if (key === 'ingredient') out[key] = `minecraft:${m.item}`;
    else if (key === 'item_model_index') out[key] = index;
    else if (key === 'palette_id') out[key] = `${NS}:trim/${m.name}`;
    else throw new Error(`trim_material/amethyst.json has a field this pack does not know: ${key}`);
  }
  return out;
}

// One smithing recipe in the spelling of the version's own netherite_helmet_smithing.json.
// The result's "count": 1 is written with the old ingredient spelling only (1.21.1). Vanilla 1.21.2
// to 1.21.4 write it too, but the field is optional there (decoded as 1, like in the count-less
// root files Stonecutter Woodworks serves to those versions), and the file set of 1.21.2 is also
// read by 1.21.5 to 26.2, whose vanilla leaves it out. Without it the 3600 recipes of 1.21.2 are
// the same as those of 26.3 and lie in the zip once.
export function trimRecipe(vanillaTransform, { template, armor, m, pattern }) {
  const plain = typeof vanillaTransform.base === 'string';
  const ing = id => plain ? `minecraft:${id}` : { item: `minecraft:${id}` };
  const result = { components: { 'minecraft:trim': { material: materialId(m), pattern: `minecraft:${pattern}` } } };
  if (!plain && vanillaTransform.result.count !== undefined) result.count = 1;
  result.id = `minecraft:${armor}`;
  return { type: 'minecraft:smithing_transform', addition: ing(m.item), base: ing(armor), result, template: ing(template) };
}

// item_model_index of the materials (1.21.1–1.21.3): below every vanilla one, so the armor models
// can list them first (the game takes the last override whose trim_type the item reaches).
export function modelIndexes(vanillaIndexes) {
  const lowest = Math.min(...vanillaIndexes);
  const step = Math.round(lowest / (MATERIALS.length + 1) * 1000) / 1000;
  const out = MATERIALS.map((_, i) => Math.round((i + 1) * step * 1000) / 1000);
  if (!(step > 0) || out.at(-1) >= lowest) throw new Error(`no room for ${MATERIALS.length} item_model_index values below ${lowest}`);
  return out;
}

const png = async colors => {
  const sharp = (await import('sharp')).default;
  const raw = Buffer.from(colors.flatMap(c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))));
  return sharp(raw, { raw: { width: colors.length, height: 1, channels: 3 } }).png().toBuffer();
};

// pack.json: the newest version this zip serves ("also") and the releases that read the file set
// of each version ("alsoLoads"), for files a version does not read itself but the newer releases
// reading its file set do.
const PACK = read(path.dirname(new URL(import.meta.url).pathname), 'pack.json');
const NEWEST = (PACK.also || []).at(-1) || PACK.mc;
const cached = (vanilla, mc) => fs.existsSync(path.join(path.dirname(vanilla.dir), mc, '.complete')) ? path.join(path.dirname(vanilla.dir), mc) : null;

export default async function ({ vanilla, version, registry }) {
  const files = {};
  const known = registry('item');
  const vanillaTrimItems = new Set(items(vanilla, 'trim_materials'));
  const armorHere = new Set(items(vanilla, 'trimmable_armor'));
  for (const m of MATERIALS) {
    if (!known.has(m.item)) throw new Error(`Minecraft ${version} has no item ${m.item}`);
    if (vanillaTrimItems.has(m.item)) throw new Error(`${m.item} is a vanilla trim material in Minecraft ${version}`);
    if (has(vanilla.data, 'minecraft', 'trim_material', `${m.name}.json`)) throw new Error(`Minecraft ${version} has its own trim material ${m.name}`);
    if (m.palette.length !== 8) throw new Error(`${m.name}: a palette has 8 colours`);
  }
  for (const a of ARMOR) if (!armorHere.has(a)) throw new Error(`${a} is not trimmable armor in Minecraft ${version}`);

  // ---- data ----
  const amethyst = data(vanilla, 'trim_material', 'amethyst.json');
  const indexes = 'item_model_index' in amethyst
    ? modelIndexes(fs.readdirSync(path.join(vanilla.data, 'minecraft', 'trim_material')).map(f => data(vanilla, 'trim_material', f).item_model_index))
    : [];
  MATERIALS.forEach((m, i) => { files[`data/${NS}/trim_material/${m.name}.json`] = trimMaterial(amethyst, m, indexes[i]); });

  const transform = data(vanilla, 'recipe', 'netherite_helmet_smithing.json');
  if (transform.type !== 'minecraft:smithing_transform') throw new Error('netherite_helmet_smithing.json is no smithing_transform recipe');
  const byPattern = templates(vanilla);
  if (Object.keys(byPattern).length !== 18) throw new Error(`Minecraft ${version} has ${Object.keys(byPattern).length} trim patterns, the pack is built for the 18 of 1.21.1 to 26.3`);
  for (const m of MATERIALS) for (const [pattern, template] of Object.entries(byPattern)) for (const armor of ARMOR) {
    files[`data/${NS}/recipe/${m.name}/${pattern}/${armor}.json`] = trimRecipe(transform, { template, armor, m, pattern });
  }

  // ---- assets ----
  // Palettes where every version looks for them (the same 8×1 picture twice).
  for (const m of MATERIALS) {
    const picture = await png(m.palette);
    files[`assets/${NS}/textures/trims/color_palettes/${m.name}.png`] = picture;
    files[`assets/${NS}/textures/palettes/trim/${m.name}.png`] = picture;
  }
  files[`assets/${NS}/lang/en_us.json`] = Object.fromEntries(MATERIALS.map(m => [translationKey(m), `${m.title} Material`]));

  // Atlas sources: vanilla's own trim source with only the new palettes. The game adds every
  // pack's sources to an atlas, so the vanilla trims stay. The palette path follows vanilla's.
  const atlas = source => {
    const dir = Object.values(source.permutations)[0].replace(/^[a-z0-9_.-]+:/, '').replace(/[^/]+$/, '');
    return { sources: [{ ...source, permutations: Object.fromEntries(MATERIALS.map(m => [assetKey(m), `${NS}:${dir}${m.name}`])) }] };
  };
  const armorTrims = trimSource(vanilla, 'armor_trims');   // worn armor, up to 26.2
  if (armorTrims) files['assets/minecraft/atlases/armor_trims.json'] = atlas(armorTrims);
  const blocks = trimSource(vanilla, 'blocks');             // armor icons up to 1.21.10
  if (blocks) files['assets/minecraft/atlases/blocks.json'] = atlas(blocks);
  // Armor icons from 1.21.11 on. A version without an items atlas writes its blocks source here:
  // the releases from 1.21.11 to 26.2 read the file set of 1.21.2 and take the same trim source
  // (textures, palette_key) from their items atlas.
  const itemsAtlas = trimSource(vanilla, 'items') || blocks;
  if (!itemsAtlas) throw new Error(`Minecraft ${version}: no atlas colours the armor icons`);
  files['assets/minecraft/atlases/items.json'] = atlas(itemsAtlas);
  if (!armorTrims && !has(vanilla.assets, 'minecraft', 'textures', 'palettes', 'trim', 'amethyst.png')) throw new Error(`Minecraft ${version}: worn trims are coloured neither by the armor_trims atlas nor by textures/palettes`);

  // Armor icons: one model per armor piece and material, like vanilla's <armor>_quartz_trim.
  for (const armor of ARMOR) {
    const quartz = read(assets(vanilla, 'models', 'item', `${armor}_quartz_trim.json`));
    for (const m of MATERIALS) {
      const textures = Object.fromEntries(Object.entries(quartz.textures).map(([k, t]) => [k, t.replace(new RegExp(`trims/items/${SLOT(armor)}_trim_quartz$`), `trims/items/${SLOT(armor)}_trim_${assetKey(m)}`)]));
      if (JSON.stringify(textures) === JSON.stringify(quartz.textures)) throw new Error(`${armor}_quartz_trim.json: no trim texture to replace`);
      files[`assets/${NS}/models/item/${armor}_${m.name}_trim.json`] = { ...quartz, textures };
    }
  }
  // 1.21.4 on: the item definition picks the model by trim material. Versions before 1.21.4 do not
  // read items/, but the newer releases reading their file set do: they get the definition of the
  // newest version. It must be the one each of those releases has (the same file from 1.21.4 to
  // 26.3); checked against every one of them that is downloaded (npm run java -- test --zwischen).
  const definitions = has(vanilla.assets, 'minecraft', 'items') ? vanilla : await ensureVanilla(NEWEST);
  const readers = (PACK.alsoLoads?.[version] || []).map(mc => cached(vanilla, mc)).filter(dir => dir && has(dir, 'assets', 'minecraft', 'items'));
  for (const armor of ARMOR) {
    const def = read(assets(definitions, 'items', `${armor}.json`));
    for (const dir of readers) {
      if (JSON.stringify(def) !== JSON.stringify(read(dir, 'assets', 'minecraft', 'items', `${armor}.json`))) throw new Error(`items/${armor}.json of Minecraft ${path.basename(dir)} differs from the one this file set carries`);
    }
    const select = def.model;
    if (select.type !== 'minecraft:select' || select.property !== 'minecraft:trim_material') throw new Error(`items/${armor}.json: expected a select on minecraft:trim_material`);
    const quartz = select.cases.find(c => c.when === 'minecraft:quartz');
    if (!quartz) throw new Error(`items/${armor}.json: no case for quartz`);
    const cases = MATERIALS.map(m => ({ ...quartz, model: { ...quartz.model, model: `${NS}:item/${armor}_${m.name}_trim` }, when: materialId(m) }));
    files[`assets/minecraft/items/${armor}.json`] = { ...def, model: { ...select, cases: [...select.cases, ...cases] } };
  }
  // 1.21.1–1.21.3: the armor model picks the trim model by item_model_index (trim_type).
  if (indexes.length) {
    for (const armor of ARMOR) {
      const model = read(assets(vanilla, 'models', 'item', `${armor}.json`));
      if (!model.overrides?.some(o => o.model === `minecraft:item/${armor}_quartz_trim`)) throw new Error(`models/item/${armor}.json: no trim overrides`);
      const ours = MATERIALS.map((m, i) => ({ model: `${NS}:item/${armor}_${m.name}_trim`, predicate: { trim_type: indexes[i] } }));
      files[`assets/minecraft/models/item/${armor}.json`] = { ...model, overrides: [...ours, ...model.overrides] };
    }
  }
  return files;
}
