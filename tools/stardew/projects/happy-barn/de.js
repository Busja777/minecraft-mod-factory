// German config texts (i18n/de.json), the German half of CONFIG_TEXT in pack.js: field name,
// tooltip and the labels of the AllowValues values (Content Patcher author-guide/config.md,
// "Translations"). Du-form, short labels for the config menu, German decimal comma.
//
// PREPARED FOR THE PLANNED UPDATE "Deutsch" (data/serie/stardew.json, Nr. 24), NOT PART OF 1.0:
// pack.js does not import this file yet. To ship it, import CONFIG_DE in pack.js and add
// 'i18n/de.json': configKeys(CONFIG, CONFIG_DE, 'German') to the returned files.
//
// Game names are the official German names: the [[de:…]] link of the English wiki page
// (stardewvalleywiki.com, revision in brackets) and the German page of de.stardewvalleywiki.com
// (revision after "de").
//   Duck (195334) → Ente (de 30108) · Goat (195332) → Ziege (de 29916) · Sheep (195321) → Schaf
//   (de 29563) · Rabbit (195310) → Hase (de 29336) · Ostrich (195338) → Strauß (de 29467) ·
//   Dinosaur (195336) → Dinosaurier (de 29869) · Chicken (195314) → Huhn · Cow (195327) → Kuh
//   (de 29302) · Pig (195340) → Schwein (de 29483) · Wool (195591) → Wolle
//   Plurals as the German page Tiere writes them (de 29935, the [[de:]] link of Animals 195447):
//   "Hühner, Enten, Hasen und Dinosaurier", "Ziegen", "Schafe", "Kühe", "Schweine", heading
//   "Strauße"; "Freundschaft" and "Herzen" ("600 Freundschaft (3 Herzen)") from the same page.
//   Level names Sanft / Großzügig as in Fish Pond Bounty's de.js.

export const CONFIG_DE = {
  Production: {
    name: 'Produktion',
    description: 'Wie viel früher Tiere, die nicht jeden Tag etwas produzieren, ihre Erzeugnisse bringen. Ab Großzügig bekommen Schafe ihre schnellere Wolle schon ab 1 Herz statt ab 4,5 Herzen. Hühner, Kühe und Schweine produzieren schon jeden Tag und bleiben unverändert.',
    values: {
      Gentle: 'Sanft: Hasen, Strauße, Dinosaurier 1 Tag früher',
      Generous: 'Großzügig: Enten und Ziegen täglich, andere 1 Tag früher',
      Abundant: 'Üppig: wie Großzügig, Hasen, Strauße, Dinosaurier 2 Tage früher'
    }
  }
};
