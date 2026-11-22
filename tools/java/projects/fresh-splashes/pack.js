// Fresh Splashes: the yellow splash texts on the title screen are replaced by a new list of
// original lines. The game reads assets/minecraft/texts/splashes.txt (one splash per line, UTF-8)
// only from the highest resource pack that has it (ResourceManager.openAsReader, checked in the
// 1.21.1 and 26.3 client jars), so this file replaces the vanilla list instead of adding to it.
// The fixed date splashes (24 December, 1 January, 31 October) and the rare "<NAME> IS YOU" are
// written into the game's code and still appear.
import fs from 'fs';
import path from 'path';

// SPLASHES is the one table to change for later updates: one list of lines per theme.
// Every line: English, short (the game shrinks long lines, so they stay readable up to about 35
// characters), plain ASCII, original, family-friendly.
export const SPLASHES = {
  mining: [
    'Fresh from the deepslate!',
    'One more ore, then bed!',
    'Hear lava? Walk the other way!',
    'Iron today, diamonds someday!',
    'Pickaxe polished and ready!',
    'Gravel has no manners!',
    'Coal, the humble hero!',
    'Copper turns green with time!',
    'Redstone dust in every pocket!',
    'Deeper means shinier!',
    'Emeralds hide in the mountains!',
    'Amethyst chimes say hello!',
    'Ancient debris, ancient patience!',
    'Always pack a water bucket!',
    'Who needs this much cobble?',
    'This mine is not haunted!',
    'The best ores live below zero!',
    'Fortune favors the pickaxe!',
    'Silk touch, gentle grip!',
    'A geode a day!',
    'Glow lichen lights the way!',
    'Dripstone drips on schedule!',
    'Mind the ceiling sand!',
    'Ore veins run deep!'
  ],
  crafting: [
    'Two sticks and a dream!',
    'Crafted with square hands!',
    'Four planks, endless options!',
    'Planks before tools!',
    'The furnace is warm today!',
    'Smelting while you wait!',
    'Anvils love gravity!',
    'The stonecutter saves planks!',
    'Shift-click responsibly!',
    'Stacks of sixty-four!',
    'Never enough sticks!',
    'Labeled chests are happy chests!',
    'Barrels never roll away!',
    'Smithing table glow-up!',
    'Hoppers never sleep!',
    'Item frames frame items!',
    'Sort your inventory today!',
    'Hotbar slot nine is for snacks!',
    'Crafting grid, three by three!'
  ],
  farming: [
    'Wheat waits for no one!',
    'Crunchy carrots, crisp mornings!',
    'Bone meal, instant garden!',
    'Pumpkins grow next door!',
    'Melons like a little space!',
    'One water block, eighty crops!',
    'Sugar cane loves the shore!',
    'Cocoa beans hug jungle logs!',
    'Beetroot soup appreciation day!',
    'Hoedown at the farm!',
    'Composters are recycling heroes!',
    'Bees keep the flowers busy!',
    'Sweet berries, prickly bushes!',
    'Seeds in, bread out!',
    'Farmland is fragile, tiptoe!',
    'Mushrooms like it dim!',
    'Bamboo reaches for the clouds!',
    'Cactus hugs not recommended!',
    'Plant a sapling, grow a forest!',
    'Fences keep the crops safe!'
  ],
  animals: [
    'Pet the wolf, gently!',
    'Cats keep creepers away!',
    'Axolotls play dead, then win!',
    'Llamas spit, but mean well!',
    'Sheep come in sixteen colors!',
    'Pink sheep are rare treasure!',
    'Horses need hay and hugs!',
    'Turtles always return home!',
    'Foxes love sweet berries!',
    'Pandas sneeze sometimes!',
    'Parrots dance to jukeboxes!',
    'Frogs snack on tiny slimes!',
    'Goats ram without warning!',
    'Dolphins lead you to treasure!',
    'Allays bring things back!',
    'Sniffers dig up the past!',
    'Armadillos roll up when shy!',
    'Camels carry two riders!',
    'Bats just hang around!',
    'Squids are ink-credible!',
    'Polar bears guard their cubs!',
    'Striders love warm lava baths!',
    'Mooshrooms share their stew!',
    'Ocelots trust slowly!'
  ],
  monsters: [
    'Creepers are just shy!',
    'Skeletons rattle politely!',
    'Zombies hate sunrise!',
    'Endermen dislike eye contact!',
    'Phantoms mean: go to bed!',
    'Slimes bounce in swamps!',
    'Drowned love tridents!',
    'Pillagers? Ring the bell!',
    'Guardians zap from afar!',
    'Ghasts cry a lot!',
    'Piglins prefer gold!',
    'Hoglins avoid warped fungus!',
    'Silverfish hide in stone!',
    'Vexes are tiny trouble!',
    'Tiptoe past the warden!',
    'Sneak through the deep dark!',
    'Shulkers float you upward!',
    'Husks stay in the desert!',
    'Strays shoot slow arrows!',
    'Breezes bounce around!',
    'The iron golem has your back!',
    'Snow golems leave snowy trails!'
  ],
  villages: [
    'Hmm! Hrrm! Hmm!',
    'Villagers love a good bed!',
    'Trade emeralds, not secrets!',
    'The librarian has a deal!',
    'Fletchers buy your sticks!',
    'Wandering traders wander!',
    'Ring the bell, everyone hides!',
    'Every village needs a lamppost!',
    'Cartographers sell adventure!',
    'Clerics sell redstone!',
    'Farmers buy your carrots!',
    'Nitwits are lovely too!',
    'Village gossip spreads fast!',
    'Iron golems give poppies!'
  ],
  nether: [
    'Bring fire resistance!',
    'Netherite never burns!',
    'Soul sand slows you down!',
    'Basalt deltas, bumpy roads!',
    'Crimson forest, warm welcome!',
    'Warped forest, cool calm!',
    'No beds in the Nether!',
    'Gold boots keep piglins calm!',
    'Bartering is an art!',
    'Fortress halls go on forever!',
    'Quartz, the marble of the Nether!',
    'One block there, eight here!',
    'Portal frames need ten obsidian!',
    'Shroomlights glow softly!',
    'Bastions hold big treasure!',
    'Respawn anchors need glowstone!',
    'Nether wart grows on soul sand!'
  ],
  end: [
    'Pack slow falling for the End!',
    'End cities float in the void!',
    'Elytra, wings for builders!',
    'Chorus fruit, random hops!',
    'Twelve eyes for one portal!',
    'Follow the eye of ender!',
    'Dragon eggs never hatch!',
    'End rods light the sky!',
    'Ender pearls, quick trips!',
    'Strongholds have libraries!',
    'Silverfish guard the portal!',
    'End stone is pale but proud!'
  ],
  ocean: [
    'Conduit power is cozy!',
    'Shipwrecks hide maps!',
    'Buried treasure is closer!',
    'X marks a sandy spot!',
    'Sea pickles glow in clusters!',
    'Turtle shells breathe longer!',
    'Boats are faster on ice!',
    'Bubble columns go up!',
    'Magma blocks pull you down!',
    'Kelp forests sway softly!',
    'Heart of the sea, found!'
  ],
  redstone: [
    'Redstone is just fancy wire!',
    'Clocks that never tell time!',
    'Pistons push, sticky ones pull!',
    'Observers see everything!',
    'Repeaters repeat, repeaters repeat!',
    'Daylight sensors love sunrise!',
    'Tripwire, watch your step!',
    'Levers go click!',
    'One tick at a time!',
    'Flying machines fly away!',
    'Target blocks love arrows!',
    'Sculk sensors hear everything!',
    'Crafters craft by themselves!',
    'Powered rails every few blocks!',
    'Copper bulbs flicker on!'
  ],
  building: [
    'Gradients are art!',
    'Add depth to your walls!',
    'Stairs make great roofs!',
    'Slabs make it cozy!',
    'Trapdoors as shutters!',
    'Dirt houses have charm!',
    'Every base needs a garden!',
    'Leaves make great hedges!',
    'Lanterns over torches!',
    'Mixed wood, fancy look!',
    'Wax your copper!',
    'Terracotta in sixteen colors!',
    'Glass, but stained!',
    'Concrete sets in water!',
    'Banners on every tower!',
    'Paths for wandering feet!',
    'Big doors, bigger dreams!',
    'Symmetry is soothing!',
    'Mud bricks for cozy walls!',
    'Cherry blossoms everywhere!',
    'The perfect block for that spot!'
  ],
  exploring: [
    'Maps fill as you walk!',
    'Recovery compass, never lost!',
    'Desert temples hide traps!',
    'Jungle temples love puzzles!',
    'Ancient cities whisper!',
    'Trail ruins hold pottery!',
    'Brush gently!',
    'Archaeology is slow fun!',
    'Trial chambers await!',
    'Trial keys open vaults!',
    'Badlands come in stripes!',
    'Snowy peaks, cold feet!',
    'Mushroom islands are peaceful!',
    'Every seed is a new world!',
    'Stop and smell the poppies!',
    'Write your coordinates down!',
    'Leave a torch trail home!',
    'Pillar up for a better view!',
    'Lost? Follow the river!',
    'Igloos keep a secret!',
    'Ruined portals, half built!',
    'Lush caves glow green!'
  ],
  sky: [
    'Sunrise in cubes!',
    'Twenty minutes per day!',
    'Rain makes fish bite faster!',
    'Thunder brings charged creepers!',
    'The moon has phases here!',
    'Square stars twinkle too!',
    'Rainy days, cozy builds!'
  ],
  food: [
    'Golden carrots, best snack!',
    'Cookies need cocoa!',
    'Pumpkin pie season!',
    'Rabbit stew, full meal!',
    'Suspicious stew, surprise!',
    'Honey cures poison!',
    'Milk clears every effect!',
    'Dried kelp, tiny snack!',
    'Eat before you mine!',
    'Glow berries light up caves!',
    'Apples fall from oak leaves!',
    'Baked potatoes, warm hands!',
    'Pufferfish? Bad idea!'
  ],
  magic: [
    'Bookshelves boost magic!',
    'Fifteen shelves for level thirty!',
    'Mending saves the day!',
    'Unbreaking, mostly!',
    'Lapis for luck!',
    'Brewing stands bubble!',
    'Night vision for caves!',
    'Water breathing, sea explorer!',
    'Lingering clouds, lasting effect!',
    'Blaze powder fuels brewing!',
    'Awkward potions are not awkward!',
    'Experience orbs, green and shiny!',
    'Grindstones give some XP back!',
    'Curse of binding? Oops!'
  ],
  adventure: [
    'Raise your shield!',
    'Crossbows reload slowly!',
    'Loyal tridents come back!',
    'Totems for second chances!',
    'Armor trims look sharp!',
    'Maces from heavy cores!',
    'Wind charges, big jumps!',
    'First night, first shelter!',
    'Wooden pickaxe, big plans!',
    'Beds set your spawn!',
    'Always carry a bed!',
    'Bring a boat for rivers!'
  ],
  cozy: [
    'Blocky and proud!',
    'Square sun, round dreams!',
    'Smooth stone, smooth day!',
    'Floating trees are fine!',
    'Hand-picked splashes!',
    'Freshly baked words!',
    'Read me at an angle!',
    'Yellow is the best color!',
    'Tilted for your pleasure!',
    'Welcome back, builder!',
    'Hello again, explorer!',
    'Have you fed your cat?',
    'Did you eat today?',
    'Drink water, not lava!',
    'You are doing great!',
    'Build something kind today!',
    'Small builds are big too!',
    'Every crafter was a beginner!',
    'Undo is called a pickaxe!',
    'A good day to mine!',
    'Chunks load just for you!',
    'Infinite world, finite snacks!',
    'Respawn and try again!',
    'Sneaking is a lifestyle!',
    'Hop on a minecart!',
    'Fishing for treasure!',
    'Caught a boot again!',
    'Name tags make friends!',
    'Paintings hide doors!',
    'Flower pots for cozy homes!',
    'Campfires cook slowly!',
    'Beacons beam to the sky!',
    'Shulker boxes, pocket storage!'
  ]
};

// The number of lines this version of the pack ships (V1.0: 300).
export const COUNT = 300;
const MAX_LENGTH = 40;
// The game drops the one line whose Java hashCode is this (SplashManager, 1.21.1 and 26.3).
const DROPPED_HASH = 125780783;

// Java's String.hashCode (32-bit), to make sure no line is the one the game hides.
export const javaHash = s => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 0);
// Two lines count as the same when they only differ in case, spaces or punctuation.
export const key = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

// Every problem of a splash list: duplicates, lines the game would show badly, copies of vanilla.
export function problems(lines, vanillaLines = []) {
  const out = [];
  const seen = new Map();
  const vanilla = new Set(vanillaLines.map(key));
  for (const line of lines) {
    if (typeof line !== 'string' || !line.trim()) { out.push(`empty line ${JSON.stringify(line)}`); continue; }
    if (line !== line.trim()) out.push(`"${line}": leading or trailing spaces`);
    if (!/^[\x20-\x7e]+$/.test(line)) out.push(`"${line}": only plain ASCII characters`);
    if (line.length > MAX_LENGTH) out.push(`"${line}": ${line.length} characters, at most ${MAX_LENGTH}`);
    if (javaHash(line) === DROPPED_HASH) out.push(`"${line}": the game never shows this line`);
    if (seen.has(key(line))) out.push(`"${line}": same as "${seen.get(key(line))}"`);
    else seen.set(key(line), line);
    if (vanilla.has(key(line))) out.push(`"${line}": is a vanilla splash`);
  }
  return out;
}

export const allLines = () => Object.values(SPLASHES).flat();

export default async function ({ vanilla, version }) {
  // The vanilla list of this version lies at the same path; if Mojang ever moves it, the build stops here.
  const own = path.join(vanilla.assets, 'minecraft', 'texts', 'splashes.txt');
  if (!fs.existsSync(own)) throw new Error(`Minecraft ${version} has no assets/minecraft/texts/splashes.txt`);
  const vanillaLines = fs.readFileSync(own, 'utf-8').split('\n').map(l => l.trim()).filter(Boolean);
  const lines = allLines();
  const found = problems(lines, vanillaLines);
  if (lines.length !== COUNT) found.push(`${lines.length} lines, expected ${COUNT}`);
  if (found.length) throw new Error(`fresh-splashes (Minecraft ${version}):\n${found.join('\n')}`);
  return { 'assets/minecraft/texts/splashes.txt': lines.join('\n') + '\n' };
}
