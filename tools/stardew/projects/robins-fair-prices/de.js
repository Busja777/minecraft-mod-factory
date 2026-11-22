// German config texts (i18n/de.json, since 1.1), the German half of CONFIG_TEXT in pack.js: field
// name, tooltip and the labels of the AllowValues values (Content Patcher author-guide/config.md,
// "Translations"). Du-form, short labels for the config menu.
//
// Game names are the official German names: the [[de:…]] link of the English wiki page
// (stardewvalleywiki.com, revision in brackets) and the German page of de.stardewvalleywiki.com.
//   Carpenter's Shop (195197) → Schreinerladen; its German page (rev 29837) calls the farm
//     buildings "Hofgebäude" (section "Hofgebäude", English "Farm Buildings") and Robin "die
//     Dorfschreinerin"
//   Wizard (193912) → Zauberer · Wizard's Tower (192711) → Turm des Zauberers ("die Gebäude des
//     Zauberers" for the Wizard's buildings, which the English description calls magical buildings)

export const CONFIG_DE = {
  CostPercent: {
    name: 'Baukosten',
    description: 'Anteil an den normalen Kosten für die Hofgebäude aus dem Schreinerladen, in Prozent: Gold, Material und Bautage. Gold und Material werden aufgerundet, der Bau dauert mindestens einen Tag. Die Gebäude des Zauberers bleiben, wie sie sind.',
    values: { 75: '75 %', 50: '50 % (die Hälfte)', 25: '25 % (ein Viertel)' }
  }
};
