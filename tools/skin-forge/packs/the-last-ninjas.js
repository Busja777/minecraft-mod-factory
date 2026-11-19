// The Last Ninjas — glow pack. Existing: Shadow (cyan armor), Oni (red armor), Phantom (purple armor),
// Kitsune (orange creature), Storm Ronin (ice-blue headband), Void Wraith (green cracked),
// Neon Shogun (gold/red kabuto), Cursed Marionette (white marionette).
// Every new ninja takes an archetype/eyes/body/colour combination none of them has.

const horns = (s, c) => { // two neon horn tips on the hat overlay
  s.face('head', 'top', 'outer').paint(['K......K', 'N......N'], { K: [0, 0, 0, 255], N: c });
  s.face('head', 'front', 'outer').paint(['N......N'], { N: c });
};

export default {
  style: 'glow',
  updates: [
    {
      title: "The Shogun's Guard",
      note: 'The Neon Shogun does not walk alone any more: three guards answer his banner, a pink blade, a lantern bearer and a ninja who moves like the tide.',
      skins: [
        {
          name: 'Sakura Blade', story: 'She trained under the cherry trees that burned with the dojo, and her blade still leaves pink petals of light in the air.',
          build: ({ glow, color }) => {
            const s = glow({ neon: '#ff3c9a', archetype: 'headband', eyes: 'fox', body: 'diagonal', arms: 'diagonal', legs: 'stripes', back: 'sigil', seed: 11 });
            s.face('body', 'front').paint(['........', '.....p..', '....p.p.', '.....p..'], { p: color.neonRamp('#ff3c9a')[5] }, { y: 7 });
            return s;
          }
        },
        {
          name: 'Iron Lantern', story: 'He carries the last flame of the dojo inside his chest, a ring of amber light that guides the lost through the dark.',
          build: ({ glow }) => glow({ neon: '#ffb020', neon2: '#ff4a00', archetype: 'armor', eyes: 'bar', body: 'circles', arms: 'joints', legs: 'joints', back: 'banner', seed: 12 })
        },
        {
          name: 'Tide Walker', story: 'Nobody hears him coming; the blue light just rises around your feet like water, and then he is already behind you.',
          build: ({ glow }) => glow({ neon: '#2a7bff', archetype: 'cracked', eyes: 'wide', body: 'zigzag', arms: 'edge', legs: 'stripes', back: 'spine', seed: 13 })
        }
      ]
    },
    {
      title: 'Ashes of the Dojo',
      note: 'Two students come back from the ashes: a monk who never stopped praying and a beast that learned to hunt with lightning.',
      skins: [
        {
          name: 'Ember Monk', story: 'He kneels in the ruins every night, and the prayer beads on his chest glow brighter with each name he remembers.',
          build: ({ glow, color }) => {
            const s = glow({ neon: '#ff5a1f', archetype: 'headband', eyes: 'visor', body: 'threads', arms: 'rings', legs: 'edge', back: 'sigil', seed: 21 });
            const R = color.neonRamp('#ff5a1f');
            s.face('body', 'front').paint(['.o....o.', '..o..o..', '...oo...'], { o: R[7] }, { y: 1 });
            return s;
          }
        },
        {
          name: 'Thunder Fang', story: 'Half ninja, half storm beast, he bares lime-green fangs and strikes before the thunder can reach your ears.',
          build: ({ glow, color }) => {
            const s = glow({ neon: '#c8ff00', archetype: 'creature', eyes: 'asym', body: 'zigzag', arms: 'rings', legs: 'plates', back: 'banner', seed: 22 });
            horns(s, color.neonRamp('#c8ff00')[7]);
            s.face('head', 'front').paint(['.7.77.7.'], { 7: color.neonRamp('#c8ff00')[7] }, { y: 6 });
            return s;
          }
        }
      ]
    },
    {
      title: 'The Last Light',
      note: 'When the night is darkest, three final lights appear: an eclipse shogun, a ghost made of mirrors and a knight bound by a crimson oath.',
      skins: [
        {
          name: 'Eclipse Shogun', story: 'The Neon Shogun’s rival, crowned in violet, who swallowed the moon and wears its hollow light as eyes.',
          build: ({ glow }) => glow({ neon: '#b44cff', neon2: '#ffffff', archetype: 'kabuto', eyes: 'hollow', body: 'emblem', arms: 'joints', legs: 'stripes', back: 'spine', seed: 31 })
        },
        {
          name: 'Mirror Ghost', story: 'Look into its pale silver visor and you see yourself, a moment before it vanishes and leaves only scattered stars.',
          build: ({ glow }) => glow({ neon: '#c8f0ff', archetype: 'cracked', eyes: 'visor', body: 'constellation', arms: 'diagonal', legs: 'joints', back: 'sigil', seed: 32 })
        },
        {
          name: 'Crimson Oath', story: 'He swore to protect the last students with his life, and the red threads of that oath run from his heart to his hands.',
          build: ({ glow }) => glow({ neon: '#ff1840', neon2: '#ffcc33', archetype: 'marionette', eyes: 'slit', body: 'threads', arms: 'edge', legs: 'plates', back: 'banner', seed: 33 })
        }
      ]
    }
  ]
};
