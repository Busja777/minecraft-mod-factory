// German config texts (i18n/de.json) for the setting of pack.js: field → name, description and a
// label for each AllowValues value. The texts do not address the player; if they did, the German
// game says "du".
//
// Game names are the official German names: the [[de:…]] link of the English wiki page
// (stardewvalleywiki.com, revision in brackets) and the German page of de.stardewvalleywiki.com.
//   Cindersap Forest (194137) → Zundersaftwald (de 29970: "Der Zundersaftwald", "im Zundersaftwald")
//   The Beach (192724) → Der Strand (de 30016: "am Strand", "Sammelbares", "Limitierung der 6
//     Gegenstände pro Karte")
//   Foraging (195239) → Sammeln (de 29787: "Sammelbare Gegenstände", "in jedem Kartenabschnitt")
export const DE = {
  MoreForage: {
    name: 'Mehr Sammelbares',
    description: 'Wie viel mehr Sammelbares im Zundersaftwald und am Strand erscheinen kann: Die Versuche pro Tag (sonst bis zu 4) und die Grenze für Sammelbares je Karte (sonst 6) steigen um diesen Prozentsatz, aufgerundet. Welche Gegenstände erscheinen, bleibt wie im Grundspiel.',
    values: { 25: '+25 % (Grenze 8)', 50: '+50 % (Grenze 9)', 100: '+100 % (Grenze 12)' }
  }
};
