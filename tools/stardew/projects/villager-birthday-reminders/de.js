// German texts (i18n/de.json, since 1.3) for every letter of pack.js. Friendly Du-form, the same
// greeting as Joja Junk Mail's German letters ("Hallo @,"). @ = player name, ^ = line break.
//
// Grammatical gender: the gift is named without an article ("Geschenk-Tipp: Mango. Das mag Leo
// besonders gern."), so one template fits every item, singular or plural, and the item name stays
// exactly as in the German game. The villager is only used in the nominative.
//
// Villager names: the German wiki uses the English names for all villagers except two
// (interlanguage link [[de:…]] of each English villager page, cached revisions; the German pages
// themselves: https://de.stardewvalleywiki.com/Zauberer revision 30419, "Der Zauberer, auch unter
// dem Namen M. Rasmodius bekannt", and https://de.stardewvalleywiki.com/Zwerg revision 29995,
// "Der Zwerg ist ein Dorfbewohner"):
//   Wizard → Zauberer (https://stardewvalleywiki.com/Wizard revision 193912, [[de:Zauberer]])
//   Dwarf → Zwerg (https://stardewvalleywiki.com/Dwarf revision 191010, [[de:Zwerg]])
// Both take "der" in a sentence, like "the" in English.

// villager → [gift ID (must be the same as in GIFTS / ISLAND_GIFTS of pack.js), German item name,
// how the letter calls the villager (default: the name)].
// Source per item: "en <English page> r<revision> → [[de:<German page>]]" (interlanguage link in the
// wikitext of https://stardewvalleywiki.com/<English page>), then "de r<revision>": the German page
// https://de.stardewvalleywiki.com/<German page> at that revision, whose infobox and first sentence
// name the item the same way and which links back with [[en:<English page>]].
export const DE_GIFTS = {
  Abigail: ['(O)276', 'Kürbis'], // en Pumpkin r192033 → [[de:Kürbis]], de r29365
  Alex: ['(O)201', 'Volles Frühstück'], // en Complete Breakfast r177675 → [[de:Volles Frühstück]], de r29926
  Caroline: ['(O)614', 'Grüner Tee'], // en Green Tea r190423 → [[de:Grüner Tee]], de r29188
  Clint: ['(O)336', 'Goldbarren'], // en Gold Bar r192803 → [[de:Goldbarren]], de r30310
  Demetrius: ['(O)233', 'Eis'], // en Ice Cream r193503 → [[de:Eis]], de r30332 (infobox "name = Eis")
  Dwarf: ['(O)749', 'Omni-Geode', 'der Zwerg'], // en Omni Geode r190058 → [[de:Omni-Geode]], de r28428
  Elliott: ['(O)715', 'Hummer'], // en Lobster r193281 → [[de:Hummer]], de r26027
  Emily: ['(O)66', 'Amethyst'], // en Amethyst r190874 → [[de:Amethyst]], de r29092
  Evelyn: ['(O)591', 'Tulpe'], // en Tulip r192740 → [[de:Tulpe]], de r29893
  George: ['(O)20', 'Lauch'], // en Leek r192783 → [[de:Lauch]], de r29303
  Gus: ['(O)635', 'Orange'], // en Orange r193162 → [[de:Orange]], de r26266
  Haley: ['(O)421', 'Sonnenblume'], // en Sunflower r192716 → [[de:Sonnenblume]], de r29595
  Harvey: ['(O)395', 'Kaffee'], // en Coffee r184120 → [[de:Kaffee]], de r29361
  Jas: ['(O)595', 'Feenrose'], // en Fairy Rose r195217 → [[de:Feenrose]], de r29031
  Jodi: ['(O)211', 'Pfannkuchen'], // en Pancakes r190694 → [[de:Pfannkuchen]], de r29416 (infobox "name = Pfannkuchen")
  Kent: ['(O)607', 'Geröstete Haselnüsse'], // en Roasted Hazelnuts r190665 → [[de:Geröstete Haselnüsse]], de r28895 (infobox "name = Geröstete Haselnüsse")
  Krobus: ['(O)305', 'Schattenei'], // en Void Egg r192608 → [[de:Schattenei]], de r29529
  Leah: ['(O)196', 'Salat'], // en Salad r190451 → [[de:Salat]], de r29549 (infobox "name = Salat")
  Lewis: ['(O)260', 'Peperoni'], // en Hot Pepper r192919 → [[de:Peperoni]], de r30036
  Linus: ['(O)280', 'Süßkartoffel'], // en Yam r192644 → [[de:Süßkartoffel]], de r29568
  Marnie: ['(O)608', 'Kürbiskuchen'], // en Pumpkin Pie r190476 → [[de:Kürbiskuchen]], de r29196 (infobox "name = Kürbiskuchen")
  Maru: ['(O)190', 'Blumenkohl'], // en Cauliflower r191752 → [[de:Blumenkohl]], de r28944
  Pam: ['(O)24', 'Pastinake'], // en Parsnip r191123 → [[de:Pastinake]], de r30062
  Penny: ['(O)376', 'Mohn'], // en Poppy r193198 → [[de:Mohn]], de r29210
  Pierre: ['(O)202', 'Gebratener Tintenfisch'], // en Fried Calamari r192508 → [[de:Gebratener Tintenfisch]], de r29088 (infobox "name = Gebratener Tintenfisch")
  Robin: ['(O)224', 'Spaghetti'], // en Spaghetti r190691 → [[de:Spaghetti]], de r29593 (infobox "name = Spaghetti")
  Sam: ['(O)206', 'Pizza'], // en Pizza r190608 → [[de:Pizza]], de r29615 (infobox "name = Pizza")
  Sandy: ['(O)402', 'Edelwicke'], // en Sweet Pea r192753 → [[de:Edelwicke]], de r30237
  Sebastian: ['(O)84', 'Gefrorene Träne'], // en Frozen Tear r190415 → [[de:Gefrorene Träne]], de r28980
  Shane: ['(O)346', 'Bier'], // en Beer r177001 → [[de:Bier]], de r30236
  Vincent: ['(O)398', 'Weintraube'], // en Grape r192072 → [[de:Weintraube]], de r29967
  Willy: ['(O)143', 'Katzenfisch'], // en Catfish r194361 → [[de:Katzenfisch]], de r29726
  Wizard: ['(O)422', 'Violetter Pilz', 'der Zauberer'], // en Purple Mushroom r193142 → [[de:Violetter Pilz]], de r22686
  Leo: ['(O)834', 'Mango'] // en Mango r192967 → [[de:Mango]], de r24391
};

const cap = s => s[0].toUpperCase() + s.slice(1);

const tip = (call, gift) =>
  `Geschenk-Tipp: ${gift}. Das mag ${call} besonders gern. Geburtstagsgeschenke zählen für die Freundschaft achtmal so viel.`;

export const letterDe = (call, gift) =>
  `Hallo @,^^Heute hat ${call} Geburtstag!^^${tip(call, gift)}^^Viel Freude beim Schenken!`;

export const eveLetterDe = (call, gift) =>
  `Hallo @,^^Morgen hat ${call} Geburtstag!^^${tip(call, gift)}^^Du hast also noch einen Tag Zeit, um das Geschenk zu besorgen.`;

export const titleDe = call => `${cap(call)} hat Geburtstag`;
export const eveTitleDe = call => `Morgen hat ${call} Geburtstag`;
