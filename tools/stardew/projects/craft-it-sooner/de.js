// German texts (i18n/de.json) for the config setting of pack.js: field → name, description and a
// label for each AllowValues value. The German game says "du" to the player, so these texts do too.
//
// Game names are the official German names: the [[de:…]] link of the English wiki page
// (stardewvalleywiki.com, revision in brackets) and the German page of de.stardewvalleywiki.com.
//   Sprinkler (193884) → Sprinkler · Quality Sprinkler (193821) → Qualitätssprinkler
//   Quality Fertilizer (190611) → Qualitätsdünger · Tapper (193620) → Zapfhahn (de 29964)
//   Iridium Sprinkler (193822) → Iridium-Sprinkler · Keg (195253) → Fass
//   Farming (191914) → Hofarbeit (de 29146, "Hofarbeit-Fähigkeit") · Foraging (195239) → Sammeln
//   (de 29787, "Sammeln-Fähigkeit"); both skills under these names on the German page Fähigkeiten
//   (rev 28856)
export const DE = {
  Level: {
    name: 'Stufe',
    description: 'Wie viel früher die Rezepte freigeschaltet werden. Mittel: Sprinkler ab Hofarbeit 1, Qualitätssprinkler ab 4, Qualitätsdünger ab 7, Zapfhahn ab Sammeln 2. Leicht bleibt näher an den normalen Stufen, Stark geht noch tiefer. Iridium-Sprinkler und Fass bleiben unverändert.',
    values: { Light: 'Leicht', Medium: 'Mittel', Strong: 'Stark' }
  }
};
