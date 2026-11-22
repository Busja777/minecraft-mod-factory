// German config texts (i18n/de.json, since 1.2), the German half of CONFIG_TEXT in pack.js: field
// name, tooltip and the labels of the AllowValues values (Content Patcher author-guide/config.md,
// "Translations"). Du-form, short labels for the config menu, German decimal comma.
//
// Game names are the official German names: the [[de:…]] link of the English wiki page
// (stardewvalleywiki.com, revision in brackets), here in the plural.
//   Keg (195253) → Fass, plural Fässer · Preserves Jar (195389) → Einmachgefäß, plural Einmachgefäße
//   Cheese Press (183811) → Käsepresse, plural Käsepressen · Loom (190254) → Webstuhl, plural Webstühle

export const CONFIG_DE = {
  Speed: {
    name: 'Maschinentempo',
    description: 'Wie viel schneller Fässer, Einmachgefäße, Käsepressen und Webstühle arbeiten. 1,0 ist das normale Tempo, 2,0 halbiert die Zeit.',
    values: {
      '1.0': 'Normales Tempo (1,0)',
      '1.25': '1,25-mal so schnell',
      '1.5': '1,5-mal so schnell',
      '2.0': 'Doppelt so schnell (2,0)'
    }
  }
};
