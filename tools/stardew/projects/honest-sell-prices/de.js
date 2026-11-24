// German config texts (i18n/de.json), the German half of CONFIG_TEXT in pack.js: field name,
// tooltip and the labels of the AllowValues values (Content Patcher author-guide/config.md,
// "Translations"). Du-form, short labels for the config menu.
//
// Game names are the official German names: the [[de:…]] link of the English wiki page
// (stardewvalleywiki.com, revision in brackets) and the German page of de.stardewvalleywiki.com
// (revision in brackets after "de").
//   Crops (193979) → Nutzpflanzen (de 29601) · Vegetables (174969) → Gemüse · Fruits (193430) →
//     Früchte · Flowers (171283) → Blumen
//   Animals (195447) → Tiere (de 29935, which calls the animal products "Tierprodukte")
//   Artisan Goods (195351) → Handwerkswaren (de 30390)
//   Animal products: Egg (195589) → Ei · Milk (190620) → Milch · Wool (195591) → Wolle ·
//     Duck Feather (194419) → Entenfeder · Rabbit's Foot (193161) → Hasenpfote · Truffle (195592) → Trüffel
//   Artisan goods: Cheese (189929) → Käse · Mayonnaise (190457) → Mayonnaise · Cloth (193456) → Stoff ·
//     Beer (177001) → Bier (de 30236) · Pale Ale (190580) → Helles Bier · Mead (190688) → Met ·
//     Green Tea (190423) → Grüner Tee · Truffle Oil (192751) → Trüffelöl · Caviar (193368) → Kaviar
//   Flavoured goods: Wine (192625) → Wein (de 29990) · Juice (190319) → Saft (de 29582) ·
//     Jellies and Pickles (191929) → Gelees und Eingelegtes (de 30213: "Gelee", "Eingelegtes") ·
//     Dried Fruit (189759) → Trockenfrüchte (de 27160) · Honey (193293) → Honig (de 29352)
//   Gus: villager names stay English in German.

export const CONFIG_DE = {
  Crops: {
    name: 'Preise für Nutzpflanzen',
    description: 'Verkaufspreis von Nutzpflanzen (Gemüse, Früchte und Blumen vom Feld) in Prozent des normalen Preises. Wein, Saft, Gelee, Eingelegtes, Trockenfrüchte und Honig von Blumen richten sich nach dem Preis der Nutzpflanze und ändern sich mit. 100 ist das normale Spiel.',
    values: { 75: '75 %', 100: '100 % (normal)', 125: '125 %', 150: '150 %' }
  },
  AnimalProducts: {
    name: 'Preise für Tierprodukte',
    description: 'Verkaufspreis von Tierprodukten (Eier, Milch, Wolle, Entenfedern, Hasenpfoten, Trüffel) in Prozent des normalen Preises. Käse und Mayonnaise sind Handwerkswaren und haben eine eigene Einstellung. 100 ist das normale Spiel.',
    values: { 75: '75 %', 100: '100 % (normal)', 125: '125 %', 150: '150 %' }
  },
  ArtisanGoods: {
    name: 'Preise für Handwerkswaren',
    description: 'Verkaufspreis von Handwerkswaren mit festem Preis (Käse, Mayonnaise, Stoff, Bier, Helles Bier, Met, Grüner Tee, Trüffelöl, Kaviar) in Prozent des normalen Preises. Bier bleibt unter den 400g, die Gus dafür verlangt. Wein, Saft, Gelee, Eingelegtes, Honig und Trockenfrüchte richten sich nach ihrer Zutat. 100 ist das normale Spiel.',
    values: { 75: '75 %', 100: '100 % (normal)', 125: '125 %', 150: '150 %' }
  }
};
