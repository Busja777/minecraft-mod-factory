// German config texts (i18n/de.json, since 1.2), the German half of CONFIG_TEXT in pack.js: field
// name, tooltip and the labels of the AllowValues values (Content Patcher author-guide/config.md,
// "Translations"). Du-form, short labels for the config menu.
//
// Game names are the official German names: the [[de:…]] link of the English wiki page
// (stardewvalleywiki.com, revision in brackets) and the German page of de.stardewvalleywiki.com.
//   Pierre (192883) → Pierre · Sandy (191345) → Sandy (villager names stay English in German)
//   Seeds are "Saat" in the German item names: Parsnip Seeds (193542) → Pastinaken-Saat,
//     Sunflower Seeds (193137) → Sonnenblumen-Saat, Blueberry Seeds (193154) → Blaubeeren-Saat
//   Season: Seasons (194195) → Jahreszeiten; the German pages say "Saison" for a crop's or the
//     shop's season ("nach ihrer eigentlichen Saison", Jahreszeiten rev 29775; "von Saison zu
//     Saison", Pierres Gemischtwarenladen rev 30415, the [[de:]] link of Pierre's General Store 195226)

export const CONFIG_DE = {
  Surcharge: {
    name: 'Aufpreis außerhalb der Saison',
    description: 'Aufpreis in Prozent für Saat, die Pierre und Sandy außerhalb ihrer Saison verkaufen. Gepflanzt wächst sie trotzdem nur in ihrer eigenen Saison.',
    values: { 25: '+25 %', 50: '+50 %', 100: '+100 % (doppelter Preis)' }
  }
};
