// German texts (i18n/de.json) for the config setting of pack.js: field → name, description and a
// label for each AllowValues value. The German game says "du" to the player, so these texts do too.
//
// Game names are the official German names: the [[de:…]] link of the English wiki page
// (stardewvalleywiki.com, revision in brackets) and the German page of de.stardewvalleywiki.com.
//   Festivals (194215) → German page Festivals (rev 29880), which calls them "Feste"
//   Pierre's General Store (195226) → Pierres Gemischtwarenladen · Pierre (192883) → Pierre

const VALUES = { Fair: 'Günstig', Normal: 'Normal', Steep: 'Teuer' };

// levels: price level → multiple of the sell price (pack.js, PRICE_LEVELS)
export const configDe = ({ levels }) => ({
  Prices: {
    name: 'Preise',
    description: `Was die Stände auf den Festen für die Waren dieses Packs verlangen, als Vielfaches des Verkaufspreises: ${Object.entries(levels).map(([level, markup]) => `${VALUES[level]} ${String(markup).replace('.', ',')}x`).join(', ')}. Samen kosten immer so viel wie in Pierres Gemischtwarenladen, und das eigene Angebot der Stände bleibt unverändert.`,
    values: VALUES
  }
});
