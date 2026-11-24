// Fresh Splashes: a new list of splash texts for the title screen (the yellow, tilted line next to
// the logo). The game reads them from assets/minecraft/texts/splashes.txt, one splash per line
// (SplashManager: lines are trimmed, every line counts, an empty one would show as an empty splash).
// A resource pack replaces the whole file, so the vanilla lines are not shown while the pack is on.
// They are not copied in either: the file holds only the lines below, all written for this pack.
// Same file, same path and same reading in 1.21.1 and 26.3 (checked in both client jars).
// Hard-coded by the game and not part of the file, so they stay: "Merry X-mas!" (24 December),
// "Happy new year!" (1 January), "OOoooOOOoooo! Spooky!" (31 October), and now and then
// "<PLAYER NAME> IS YOU" (a 1 in <number of lines> chance).
import fs from 'fs';
import path from 'path';

// SPLASHES is the one table to change for later updates (more lines, holidays, other languages).
// Rules every line has to meet (checked below, the build fails otherwise): plain printable ASCII
// (no § formatting codes), at most 60 characters, no line twice, and no line equal or close to a
// vanilla splash of the version the pack is built for.
export const SPLASHES = {
  mining: [
    "Diamonds are a miner's best friend!",
    'Two more blocks, then bed!',
    'Just one more cave!',
    'Mined it myself!',
    'Gravel: the original jump scare!',
    'Lava is not a swimming pool!',
    'Torches sold separately!',
    'Strip mining since breakfast!',
    'Found coal. Celebrated anyway!',
    'Redstone dust gets everywhere!',
    'Lapis is the new blue!',
    'Ancient debris, modern joy!',
    'Deepslate takes its time!',
    'The cave was louder than expected!',
    'Bring a water bucket!',
    'Pickaxe at the ready!',
    'Copper turns green with envy!',
    'Emeralds are for trading!',
    'Mind the gravel above!',
    'Every ore counts!',
    'Shiny rocks in the dark!',
    'Down we go, carefully!',
    'Silk touch, gentle touch!',
    'Fortune favors the miner!',
    'Amethyst sings when you walk!',
    "Geodes: nature's surprise eggs!",
    'Dug a hole. Proud of it!',
    'Stone, stone, stone, diamond!',
    'Ladders are for going home!',
    'Obsidian takes patience!',
    'Bedrock does not budge!',
    'Mine your own business!',
    'Smelt you later!'
  ],
  mobs: [
    'Creepers just want a hug!',
    'Hiss means run!',
    'Skeletons never skip arm day!',
    'Zombies hate sunny mornings!',
    'Endermen prefer no eye contact!',
    'Please return my grass block!',
    'Slimes bounce back!',
    'Spiders: great climbers, poor guests!',
    'The witch is brewing again!',
    'Pillagers ruin picnics!',
    'Phantoms say: go to bed!',
    'Ghasts cry a lot!',
    'Piglins love gold!',
    'Blazes run hot!',
    'Wardens appreciate silence!',
    'Tiptoe past the sculk!',
    'Axolotls play dead!',
    'Frogs snack on magma cubes!',
    'Goats will push you off!',
    'Llamas spit with style!',
    'Pandas sneeze, slimeballs drop!',
    'Foxes steal your stuff!',
    'Parrots dance to music!',
    'Cats scare creepers!',
    'Bees are busy, let them work!',
    'Turtles always go home!',
    'Dolphins lead to treasure!',
    'Squid ink for every book and quill!',
    'Cows give milk, not opinions!',
    'Sheep come in sixteen colors!',
    'Pigs fly, briefly!',
    'Striders shiver out of lava!',
    'Snow golems hate warm biomes!',
    'Iron golems hand out poppies!',
    'The wandering trader is back!',
    'Allays bring you things!',
    'Sniffers smell the past!',
    'Camels seat two!',
    'Armadillos roll up when shy!',
    'Breezes love a good gust!',
    'Bats just hang out!',
    'Silverfish hide in stone!',
    'Endermites: tiny, purple, rude!',
    'Vexes are vexing!',
    'Shulkers give you a lift!',
    'Guardians stare back!',
    'Drowned keep the good tridents!',
    'Strays bring frosty arrows!',
    'Mooshrooms: soup on legs!',
    'Horses jump fences!',
    'Rabbits hop everywhere!',
    'Polar bears protect their cubs!',
    'Glow squid light the deep!',
    'Tadpoles grow up fast!',
    'Bogged: skeletons with moss!',
    'Hoglins are not huggable!',
    'A frog for every swamp!',
    'Wear a pumpkin, stare freely!'
  ],
  crafting: [
    'Two sticks, three planks, endless joy!',
    'Four planks make a table!',
    'Crafted with care!',
    'Smelting since sunrise!',
    'Craft first, ask later!',
    'The recipe book knows!',
    'Eight cobblestone, one furnace!',
    'Anvils hold a grudge!',
    'Bookshelves make better magic!',
    'Brewing stands bubble happily!',
    'Nether wart first!',
    'Smithing makes it shine!',
    'Hoppers move it along!',
    'Bundles of joy!',
    'Banners for every mood!',
    'Grindstone, clean slate!',
    'Stonecutter saves stone!',
    'Composters turn scraps into bone meal!',
    'Barrels hold a lot!',
    'Enchanted book, mystery inside!',
    'Name tags make friends!',
    'Tamed and named!'
  ],
  building: [
    'Build big, build small, just build!',
    'Slabs make everything better!',
    'Stairs are not just for walking!',
    'A roof is a promise!',
    'Dirt huts are a valid style!',
    'Symmetry is optional!',
    'Fences keep the cows in!',
    'Glass panes, great views!',
    'Lanterns for cozy nights!',
    'One block at a time!',
    'Measure twice, place once!',
    'Undo is called a pickaxe!',
    'Your castle needs a moat!',
    'Terracotta comes in many colors!',
    'Concrete powder plus water!',
    'Bridges over everything!',
    'Scaffolding up, scaffolding down!',
    'Flower pots for every shelf!',
    'Spruce and stone, a classic!',
    'Cherry wood is pink on purpose!',
    'Bamboo builds fast!',
    'Moss carpet, cozy floors!',
    'Trapdoors make great shutters!',
    'Blueprint? Never heard of it!',
    'The village needs a wall!',
    'Brick by brick!',
    'Big plans, small blocks!',
    'Spruce it up!',
    'Carved pumpkins see all!',
    "Jack o'lanterns light the path!"
  ],
  farming: [
    'Water within four blocks!',
    'Bone meal: instant gardening!',
    'Carrots on a stick!',
    'Pumpkin pie for everyone!',
    'Cake is best shared!',
    'Eat your beetroot!',
    'Sweet berries, ouch!',
    'Melons for a summer day!',
    'Golden carrots are worth it!',
    'Cookies need cocoa!',
    'Suspicious stew, suspicious results!',
    'Honey bottles are sticky!',
    'Kelp is crunchy when dried!',
    'Patience catches fish!',
    'Rabbit stew is a lot of work!',
    'Bowls first, soup second!',
    'Glow berries light the way!',
    'Sugar cane grows near water!',
    'Hay bales soften the fall!',
    'Cactus: do not hug!',
    'Chorus fruit, random trip!',
    'Potatoes: bake them first!',
    'Hay there, farmer!',
    'Fish, fish, treasure, fish!',
    'Throw an egg, maybe a chick!'
  ],
  redstone: [
    'Redstone: it just works, sometimes!',
    'Observers are watching!',
    'Pistons push, sticky ones pull!',
    'Repeaters keep the beat!',
    'Tick tock, redstone clock!',
    'Daylight detectors know the time!',
    'Note blocks make music!',
    'Tripwires, watch your step!',
    'TNT is a tool, not a toy!',
    'Minecart tracks to everywhere!',
    'Powered rails, go faster!',
    'Copper bulbs glow!',
    'The crafter crafts for you!',
    'Target blocks love arrows!',
    'Honey blocks hold on tight!',
    'Lightning rods protect your roof!'
  ],
  exploring: [
    'Every seed is a new world!',
    'Over the hills and through the biomes!',
    'Mushroom islands, no monsters!',
    'Deserts hide temples!',
    'Jungle temples, mind the arrows!',
    'Ancient cities, quiet please!',
    'Trial chambers await!',
    'Ocean monuments, bring doors!',
    'Shipwrecks have maps!',
    'Buried treasure marks the spot!',
    'The stronghold is closer than you think!',
    'Badlands hide old mineshafts!',
    'Cherry groves in bloom!',
    'Lush caves, lush vibes!',
    'Woodland mansions are huge!',
    'The map is never finished!',
    'Compasses point home!',
    'The recovery compass knows the way!',
    'Sail the boat, mind the ice!',
    'Elytra: wings for the brave!',
    'Rockets not included!',
    'Blue ice is the fastest road!',
    'Spyglass: look far away!',
    'Trial keys open vaults!',
    'Ominous bottles, ominous plans!',
    'Wind charges, big leaps!',
    'Maces for the high jumpers!',
    'Your next adventure starts here!',
    'All roads lead to spawn!'
  ],
  nether_and_end: [
    'The Nether is hot, bring snacks!',
    'Gold armor keeps piglins calm!',
    'Do not sleep in the Nether!',
    'Beds explode in the End too!',
    'The dragon is just misunderstood!',
    'End cities float!',
    'Purpur is the new purple!',
    'Respawn anchors need glowstone!',
    'Soul sand slows you down!',
    'Basalt deltas: magma cubes ahead!',
    'Bastions are full of gold!',
    'Netherite floats in lava!',
    'Portals need ten obsidian!',
    'Ender pearls, short trips!',
    'Glowstone: the ceiling lamp of the Nether!',
    'The End is only the beginning!',
    'Credits roll, adventure continues!'
  ],
  survival: [
    'Sleep through the night!',
    'The first night is the hardest!',
    'Shields up!',
    'Crouch at the edge!',
    'Always carry a bucket!',
    'Write down your coordinates!',
    'Label your chests!',
    'Armor on, worries off!',
    'Mending fixes everything!',
    'Keep a spare pickaxe!',
    'Totems save lives!',
    'Hunger bar says eat!',
    'Night falls, torches up!',
    'Dawn is the best time!',
    'Bed first, then adventure!',
    'Respawn and try again!',
    'Nobody likes fall damage!',
    'Water breaks every fall!',
    'Mind the void!',
    'Feather falling for the win!',
    'Experience is worth collecting!',
    'Rain makes fishing better!',
    'Thunderstorms are no picnic!',
    'Lightning makes things interesting!',
    'Snacks are part of the plan!',
    'Count the sheep, then sleep!',
    'Arrows come back, sometimes!',
    'Crossbows, now with fireworks!',
    'Tridents return to sender!',
    'Snowballs, harmless fun!'
  ],
  blocks: [
    'Everything is a cube!',
    'Round things are a myth!',
    'Pixels with feelings!',
    'Gravity is for sand and gravel!',
    'Floating trees are fine!',
    'Water flows, lava glows!',
    'Nobody counts the cobblestone!',
    'Cobblestone: always too much!',
    'Dirt is underrated!',
    'Gravel is a gamble!',
    'Sand falls, so do you!',
    'Moss spreads, so does joy!',
    'Sponge, the thirstiest block!',
    'Waxed and ready!',
    'Oxidized and proud!',
    'Every block has a story!'
  ],
  splash: [
    'This splash is yellow!',
    'Fresh out of the oven!',
    'Brand new splash, still warm!',
    'A splash a day!',
    'Freshly squeezed splash!',
    'Hundreds of new splashes!',
    'Slightly tilted!',
    'Sorry, this splash is shy!',
    'Yellow text, big dreams!',
    'You found a splash!',
    'Collect them all!',
    'Welcome back, builder!',
    'Hi, crafter!',
    'Good to see you!',
    'Your world missed you!',
    'The blocks are waiting!',
    'Today is a good day to build!',
    'Loading fresh ideas!',
    'Infinite worlds, finite time!',
    'Dig, build, repeat!',
    'Explore, craft, nap!',
    'Craft something silly today!',
    'Have a nice day, and a nicer night!',
    'Let it snow, with snow golems!'
  ]
};

export const MAX_LENGTH = 60;

// Lowercase letters and digits only, words separated by one space: "Don't!" and "dont" compare equal.
export const normalize = s => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
// Dice coefficient of the letter pairs of two normalized lines (1 = the same letters in the same pairs).
function pairs(s) {
  const t = s.replace(/ /g, '');
  const out = new Map();
  for (let i = 0; i < t.length - 1; i++) out.set(t.slice(i, i + 2), (out.get(t.slice(i, i + 2)) || 0) + 1);
  return out;
}
export function similarity(a, b) {
  const [x, y] = [pairs(a), pairs(b)];
  const total = [...x.values(), ...y.values()].reduce((s, n) => s + n, 0);
  if (!total) return a === b ? 1 : 0;
  let common = 0;
  for (const [k, n] of x) common += Math.min(n, y.get(k) || 0);
  return (2 * common) / total;
}
// Close enough to count as the same splash: equal when normalized, or at least this similar.
export const NEAR = 0.75;

// Every problem of a list of splashes, compared with each other and with the vanilla lines. → [texts]
export function problemsOf(lines, vanillaLines = []) {
  const problems = [];
  const seen = [];
  const vanilla = vanillaLines.map(v => [v, normalize(v)]).filter(([, n]) => n);
  for (const line of lines) {
    if (typeof line !== 'string' || !line.trim()) { problems.push(`empty splash: ${JSON.stringify(line)}`); continue; }
    if (line !== line.trim()) problems.push(`"${line}": spaces at the start or end`);
    if (!/^[\x20-\x7E]+$/.test(line)) problems.push(`"${line}": only plain printable ASCII`);
    if (line.length > MAX_LENGTH) problems.push(`"${line}": ${line.length} characters (at most ${MAX_LENGTH})`);
    const n = normalize(line);
    const twin = seen.find(([, m]) => m === n || similarity(m, n) >= NEAR);
    if (twin) problems.push(`"${line}" is (nearly) the same as "${twin[0]}"`);
    const theirs = vanilla.find(([, m]) => m === n || similarity(m, n) >= NEAR);
    if (theirs) problems.push(`"${line}" is (nearly) the vanilla splash "${theirs[0]}"`);
    seen.push([line, n]);
  }
  return problems;
}

export const allSplashes = () => Object.values(SPLASHES).flat();

export default async function ({ vanilla }) {
  const lines = allSplashes();
  const file = path.join(vanilla.assets, 'minecraft', 'texts', 'splashes.txt');
  if (!fs.existsSync(file)) throw new Error(`no vanilla splashes.txt in ${vanilla.assets}: the game reads the file from elsewhere now`);
  const vanillaLines = fs.readFileSync(file, 'utf-8').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const problems = problemsOf(lines, vanillaLines);
  if (problems.length) throw new Error(`splashes: ${problems.join('; ')}`);
  return { 'assets/minecraft/texts/splashes.txt': lines.join('\n') + '\n' };
}
