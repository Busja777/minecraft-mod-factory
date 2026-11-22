// German config texts (i18n/de.json, since 1.1), the German half of CONFIG_TEXT in pack.js: field
// name, tooltip and the labels of the AllowValues values (Content Patcher author-guide/config.md,
// "Translations"). Du-form, short labels for the config menu. pack.js adds the share in percent to
// each label, "Sanft (60 %)", and checks that the description names every level with its share.
//
// Game names are the official German names: the [[de:…]] link of the English wiki page
// (stardewvalleywiki.com, revision in brackets) and the German page of de.stardewvalleywiki.com.
//   Geode (190877) → Geode, plural "Geoden" (German page Geode rev 29117: "Die Geode ist ein
//     Mineralvorkommen, das Mineralien, Artefakte, Erze, oder Basisressourcen enthält")
//   Frozen Geode (190881) → Gefrorene Geode · Magma Geode (185672) → Magma-Geode
//   Minerals (195242) → Mineralien · Artifacts (186104) → Artefakte · Stone (192695) → Stein
//   Clay (192470) → Lehm · ore: "Erze" (German page Geode rev 29117, see above; Iridium Ore
//     (193934) → Iridiumerz)

export const CONFIG_DE = {
  Generosity: {
    name: 'Großzügigkeit der Geoden',
    description: 'Wie oft Geoden, Gefrorene Geoden und Magma-Geoden ein Mineral oder Artefakt statt Stein, Lehm oder Erz enthalten. Sanft 60 %, Großzügig 70 %, Üppig 80 % (normales Spiel: 50 %).',
    values: { Gentle: 'Sanft', Generous: 'Großzügig', Lavish: 'Üppig' }
  }
};
