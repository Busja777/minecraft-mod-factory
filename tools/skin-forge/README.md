# Skin forge

Builds new skins for an existing skin pack, checks them against the operator's skin rules and records
them as due versions, so the evening run can upload them one update at a time.

```bash
npm run forge -- --pack <slug>            # build, check, render → data/skins/<slug>/
npm run forge -- --pack <slug> --no-render
```

Rules come from the operator's skills in `~/Desktop/Alles/MCPE/Skills Für Claude MC/`
(`New updated mc skin/SKILL.md` for glow, `Skills- MC Classic Skin/` for classic). The key ones are
enforced by `validate.js`; the rest is taste and is checked by looking at the renders.

## A design file: `tools/skin-forge/packs/<slug>.js`

```js
export default {
  style: 'glow',            // glow | accent | hair | minimal | clothing  (overlay strategy, see below)
  minDistinct: 3,           // optional; how many of 6 dimensions must differ from every other skin
  updates: [                // each entry becomes one version (V1.x after the last real one), 2–4 skins each
    {
      title: "The Shogun's Guard",
      note: 'One or two English sentences in the voice of the pack legend: what this update adds.',
      skins: [
        {
          name: 'Sakura Blade',                          // English, unique within the pack
          story: 'One English sentence: who this character is, matching the colours.',
          slim: false,                                   // optional
          build: ({ glow, human, Skin, color, PATTERNS, palette, existing }) => glow({ … })  // → Skin
        }
      ]
    }
  ]
};
```

Re-running replaces the versions the forge made before (`forged: true` in `pack.json`); real versions stay.
`data/skins/<slug>/forge-report.json` lists every skin with its checks.

## The kit

- **`glow({ neon, neon2, archetype, eyes, body, arms, legs, back, seed, slim, bleed, sparkle })`**: glow/neon skins.
  - `archetype`: `armor | kabuto | creature | cracked | marionette | headband` (the overlay concept; decide it first).
  - `eyes`: `slit | wide | visor | fox | asym | hollow | bar`.
  - `body`: `plates | diagonal | constellation | threads | circles | zigzag | emblem`.
  - `arms`: `rings | joints | diagonal | edge`. `legs`: `plates | joints | stripes | edge`.
  - `back`: `spine | sigil | banner | same`.
  - `bleed` / `sparkle` give the soft glow of the hand-made packs.
- **`human({ … })`**: classic shaded characters. All options are listed at the top of `human.js`:
  - skin tone, face (`eyes`, `style`, `mouth`, `beard`, `blush`), hair (`style`).
  - `head.kind`: `helmet | greathelm | hood | cap | beanie | crown | wizard | bandana | mask | ears | strawhat | headband | nightcap | circlet | horns | halo`.
  - `top.kind`: `shirt | armor | robe | hoodie | jersey | sweater | tunic | coat | overalls | tabard | suit | dress | vest`, with `pattern.kind` from `PATTERNS`.
  - `sleeves`, `gloves`, `belt`, `pants`, `boots`, `cape`, `scarf`.
- **Low level** (for anything the builders do not cover, and for finishing touches):
  - `skin.face(part, face, layer)` gives a `Face` with `paint(rows, map, {x, y})`, `fill`, `rect`, `row`, `col`, `shaded(ramp)`, `texture(choices, seed)`, `noise(amount, seed)` and `flipX`.
  - In `paint`, `'.'` keeps a pixel and `' '` clears it (overlay).
  - Parts: `head, body, rightArm, leftArm, rightLeg, leftLeg`. Faces: `top, bottom, right, front, left, back`. Layers: `inner, outer`.
  - `skin.band(part, row, colour)` paints a ring around a part.
  - `skin.mirrorLimbs()` copies the right arm and leg to the left. `human()` and `glow()` already do this, so paint limbs before it or paint both sides.
  - `skin.revealBright()` clears black overlay pixels over bright inner pixels.
- **`existing(name)`**: a copy of an existing skin of the pack. Use it as material for a sequel (a new
  helmet on the old body, an ascended form), not for recolours; the distinctness check rejects recolours.
- **`color`**: `hex`, `shade(c, f)`, `mix`, `ramp(base, n)`, `neonRamp(neon)`, `rng(seed)`, `T` (transparent), `BLACK`, `WHITE`.

## Rules (enforced)

- 64×64, inner layer 100 % opaque, no half-transparent pixels.
- Overlay transparency per style:
  - glow 30–80 % (hand-made ninjas: 71–77 %)
  - accent 60–92 % (knights: 80–81 %)
  - hair 85–100 %, minimal 90–100 %, clothing 15–70 %
- Glow: ≥ 70 % black, 3–15 % neon (ninjas: 89–94 % black, 3.5–5.6 % neon).
- **No recolours.** Every new skin must differ from every skin of the pack, old and new, in at least
  3 of 6 dimensions: hat shape, face, body pattern, arms, legs, colour family.

## Rules (taste — look at the renders)

- Match the pack: compare `data/skins/<slug>/media/v1.0-skins.png` with the new rows.
- Same material language, similar level of detail, similar palette range.
- Every skin needs one idea a player can see from the front: a helmet, ears, a crest, an emblem, a mask, a number, a hood.
- Names and stories are English. A story is one sentence, written in the voice of the pack legend.
- No real people, no brands, no characters from films, games or anime.
