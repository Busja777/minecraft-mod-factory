// Iron Sanguine Knight's Skinpack — classic armoured knights. Existing: Purple Epic, Green, Golden Lord,
// Yellow, Blue (full plate, visor), Knight Magic (cyan glow), Knight Gold, Fire Knight, Silver Paladin,
// Netherite, Copper, Bone. New knights differ in helmet, heraldry, cape and colour.

const visorGlow = (s, c) => s.face('head', 'front').paint(['........', '........', '........', '........', '.c....c.'], { c });

export default {
  style: 'accent',
  updates: [
    {
      title: 'Order of the Frost',
      note: 'From the frozen north ride two knights of the Frost Order: a warden in ice-blue plate and a lancer whose beard is white with rime.',
      skins: [
        {
          name: 'Frost Warden', story: 'He guards the pass where winter never ends, his ice-blue plate cold enough to freeze the blade that strikes it.',
          build: ({ human }) => {
            const s = human({ seed: 101, head: { kind: 'greathelm', color: '#a9d6f0', trim: '#ffffff', eyes: '#5ff3ff' }, top: { kind: 'armor', color: '#7fb6dc', trim: '#e8f6ff', pattern: { kind: 'diamond', color: '#e8f6ff', second: '#5ff3ff' } }, gloves: '#5d8fb3', boots: '#4f7898', cape: '#eef6fb' });
            visorGlow(s, [95, 243, 255, 255]);
            return s;
          }
        },
        {
          name: 'Rime Lancer', story: 'An old knight with a frost-white beard who has ridden into every blizzard since the order was founded.',
          build: ({ human }) => human({ seed: 102, skin: '#e0ac84', face: { eyes: '#3a7bd0', style: 'angry', beard: '#e8eef2', brows: '#e8eef2' }, head: { kind: 'helmet', color: '#c9d3dc', trim: '#3a7bd0' }, top: { kind: 'armor', color: '#b9c4cf', trim: '#3a7bd0', pattern: { kind: 'chevron', color: '#3a7bd0' } }, gloves: '#7a8692', boots: '#5d6772' })
        }
      ]
    },
    {
      title: 'The Emerald Vow',
      note: 'Three knights swear the Emerald Vow: a sentinel with a golden lion, a thorn knight over chainmail and a paladin of roses.',
      skins: [
        {
          name: 'Jade Sentinel', story: 'Keeper of the emerald gate, he wears the golden lion of his house and has never once stepped back.',
          build: ({ human }) => human({ seed: 111, head: { kind: 'greathelm', color: '#2f9a6a', trim: '#e2b33c', eyes: '#ffe680' }, top: { kind: 'armor', color: '#2e8a60', trim: '#e2b33c', pattern: { kind: 'lion', color: '#e2b33c', second: '#a0741a' } }, gloves: '#1f5e42', boots: '#174a34', cape: '#1d5a3f' })
        },
        {
          name: 'Thorn Knight', story: 'His tabard carries a black thorn on dark green, a warning to anyone who thinks the forest is undefended.',
          build: ({ human }) => human({ seed: 112, skin: '#c69c6d', face: { eyes: '#2c6a2c', style: 'angry' }, hair: { color: '#2a1a10', style: 'short' }, head: { kind: 'greathelm', color: '#5c6168', trim: '#2f6b3a', eyes: '#9be564' }, top: { kind: 'tabard', color: '#2f6b3a', trim: '#141414', pattern: { kind: 'fleur', color: '#141414' }, mail: '#7d848c' }, belt: '#3b2716', gloves: '#3b2716', boots: '#2b2b2b' })
        },
        {
          name: 'Rose Paladin', story: 'She rides into battle with roses woven into her armour, and every knight she saves gets one to keep.',
          build: ({ human }) => {
            const s = human({ seed: 113, skin: '#f0c8a4', face: { eyes: '#c0306a', style: 'normal', mouth: 'smile' }, hair: { color: '#e8d27a', style: 'long' }, head: { kind: 'circlet', trim: '#e8e8ee', gem: '#e0306a' }, top: { kind: 'armor', color: '#e3e6ea', trim: '#d0306a', pattern: { kind: 'heart', color: '#d0306a', second: '#9a1c48' } }, gloves: '#b0b7bf', boots: '#9aa2ab', cape: '#c02a5a' });
            return s;
          }
        }
      ]
    },
    {
      title: 'Night Watch',
      note: 'When the sun goes down, the Night Watch takes the walls: an obsidian guard with horns, a herald of the sun and a knight who carries the storm.',
      skins: [
        {
          name: 'Obsidian Guard', story: 'Forged from volcanic glass, he only opens his violet eyes when an enemy reaches the castle walls.',
          build: ({ human }) => {
            const s = human({ seed: 121, head: { kind: 'greathelm', color: '#2b2433', trim: '#8a4bd8', eyes: '#c27bff' }, top: { kind: 'armor', color: '#2d2638', trim: '#8a4bd8', pattern: { kind: 'skull', color: '#8a4bd8', second: '#c27bff' } }, gloves: '#1d1924', boots: '#16131c' });
            s.face('head', 'top', 'outer').paint(['H......H', 'H......H'], { H: [230, 220, 200, 255] });
            s.face('head', 'front', 'outer').paint(['H......H'], { H: [210, 200, 180, 255] });
            visorGlow(s, [194, 123, 255, 255]);
            return s;
          }
        },
        {
          name: 'Sun Herald', story: 'His white-gold armour catches the last light of the day and keeps it burning on his chest all night long.',
          build: ({ human }) => human({ seed: 122, skin: '#c69c6d', face: { eyes: '#d89a20', style: 'glow' }, hair: { color: '#f0e0b0', style: 'side' }, head: { kind: 'halo', color: '#ffe27a' }, top: { kind: 'armor', color: '#f2efe6', trim: '#e2b33c', pattern: { kind: 'star', color: '#f2b51c' } }, gloves: '#d6c08a', boots: '#b89c5a', cape: '#f2b51c' })
        },
        {
          name: 'Storm Knight', story: 'Lightning chose him on the battlefield, and the yellow bolt on his dark-blue plate has never stopped crackling.',
          build: ({ human }) => {
            const s = human({ seed: 123, skin: '#c69c6d', face: { eyes: '#ffd21c', style: 'glow' }, hair: { color: '#20283a', style: 'spiky' }, head: { kind: 'helmet', color: '#2c4a8a', trim: '#ffd21c' }, top: { kind: 'armor', color: '#26407a', trim: '#ffd21c' }, gloves: '#1a2b52', boots: '#14213f', cape: '#18284a' });
            const bolt = ['....X...', '...X....', '..XXXX..', '....X...', '...X....', '..X.....'];
            s.face('body', 'front').paint(bolt, { X: [255, 214, 28, 255] }, { y: 1 });
            return s;
          }
        }
      ]
    }
  ]
};
