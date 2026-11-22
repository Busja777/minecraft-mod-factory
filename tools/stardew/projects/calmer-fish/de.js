// German texts (i18n/de.json) for the config settings of pack.js: field → name, description and a
// label for each AllowValues value. The German game says "du" to the player, so these texts do too.
//
// Game names are the official German names: the [[de:…]] link of the English wiki page
// (stardewvalleywiki.com, revision in brackets) and the German page of de.stardewvalleywiki.com.
//   Fish (195502) → Fisch; "legendäre Fische": German page Fisch (rev 30174), sections "Legendäre
//   Fische" and "Legendäre Fische II"
//   Angel-Minispiel: German page Fischteich (rev 30320: "ohne das Angel-Minispiel"; Fish Pond
//   194160 → Fischteich)

// percent: how much the Legendaries switch lowers the difficulty (pack.js, LEGENDARY_FACTOR)
export const configDe = ({ percent }) => ({
  Level: {
    name: 'Stufe',
    description: 'Wie viel ruhiger die Fische im Angel-Minispiel sind. Leicht senkt die Schwierigkeit um 15 %, Mittel um 30 %, Stark um 45 %. Legendäre Fische bleiben dabei unverändert.',
    values: { Light: 'Leicht', Medium: 'Mittel', Strong: 'Stark' }
  },
  Legendaries: {
    name: 'Auch legendäre Fische',
    description: `Macht auch die legendären Fische etwas ruhiger: Ihre Schwierigkeit sinkt um ${percent} %, egal welche Stufe du gewählt hast. Standardmäßig aus.`,
    values: { true: 'An', false: 'Aus' }
  }
});
