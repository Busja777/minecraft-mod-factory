// German texts (i18n/de.json, since 1.1) for every order of pack.js: board title, note and objective
// line, with the same counts as the English texts. The villagers say "du" to the player, as on their
// German pages (Gus rev 29216, Pierre rev 29511, Shane rev 29576, Jodi rev 29319, Evelyn rev 29403,
// Leah rev 29327). No command characters, like the English texts.
//
// Game names are the official German names: the [[de:…]] link of the English wiki page
// (stardewvalleywiki.com, revision in brackets) and the German page of de.stardewvalleywiki.com
// (revision after "de"), which links back with [[en:…]].
//   Gus (195359) → Gus · Pierre (192883) → Pierre (de 29511) · Shane (195349) → Shane (de 29576)
//   Jodi (191546) → Jodi (de 29319) · Evelyn (191129) → Evelyn · Leah (195341) → Leah (de 29327)
//   Sam (195335) → Sam · Vincent (195212) → Vincent · George (193909) → George (de 28909)
//   The Stardrop Saloon (194225) → Kneipe zum Sternenfall (de 29163); "die Kneipe" for short, as
//   Gus says on his German page (rev 29216)
//   Cheese (189929) → Käse (de 29288) · Goat Cheese (190347) → Ziegenkäse (de 29993)
//   Jellies and Pickles (191929) → Gelees und Eingelegtes (de 30213: "Gelee oder Eingelegtem")
//   Egg (195589) → Ei (de 29106, plural "Eier") · Chicken (195314) → Huhn (de 29368, "Hühner")
//   Coop (193803) → Hühnerstall (de 29264)
//   Milk (190620) → Milch (de 29148) · Goat Milk (190400) → Ziegenmilch (de 29888, from "Ziegen")
//   Flowers (171283) → Blumen (de 24822)
//   Foraging (195239) → Sammeln (de 29787: "Gesammelte Gegenstände"; Jahreszeiten de 29775:
//   "gesammelte Gegenstände")
//   The Farm (195355) → Der Hof (de 30166)
// No run of 6 or more words from the cached German wiki pages (checked once with a script), among
// them the German quest page Aufträge (rev 30389) with the game's own special orders.

// order key (as in ORDERS of pack.js) → { name, text, goal }
export const DE = {
  Cheese: {
    name: 'Käseplatte für die Kneipe',
    text: 'Ich möchte freitagabends eine richtige Käseplatte auf die Karte setzen. Die Leute fragen ständig nach etwas, das hier im Tal gemacht wird, und nichts geht über Käse vom Hof zu einem kühlen Getränk. Kannst du mir 10 Laibe bringen? Käse oder Ziegenkäse, beides ist willkommen!',
    goal: 'Bring Gus 10 Käse oder Ziegenkäse'
  },
  Preserves: {
    name: 'Ein Regal voll Hausgemachtem',
    text: 'Meine Kundschaft fragt dauernd nach selbst Eingemachtem, und am Fenster steht ein leeres Regal, das dafür perfekt wäre. Bring mir 12 Gläser Gelee oder Eingelegtes von deinem Hof, und ich zahle dir einen guten Preis. Ware aus der Gegend verkauft sich von selbst!',
    goal: 'Bring Pierre 12 Gläser Gelee oder Eingelegtes'
  },
  Eggs: {
    name: 'Glückliche Hühner',
    text: 'Okay, also ... ich mag Hühner. Sehr. Zu wissen, dass ein Hof hier in der Gegend glückliche Hühner hält, würde mir ehrlich gesagt die Woche retten. Versende 40 Eier und zeig, dass es in deinem Hühnerstall gut läuft. Das war\'s. Mach keine große Sache draus.',
    goal: 'Versende 40 Eier'
  },
  Milk: {
    name: 'Milch für hungrige Jungs',
    text: 'Sam und Vincent trinken die Milch schneller, als ich sie nach Hause tragen kann! Frische Milch von einem Hof wäre für die beiden etwas ganz Besonderes. Kannst du mir 8 Flaschen bringen? Milch oder Ziegenmilch, beides ist in Ordnung.',
    goal: 'Bring Jodi 8 Flaschen Milch'
  },
  Flowers: {
    name: 'Blumen für den Platz',
    text: 'Die Blumenbeete in der Stadt sehen ein bisschen kahl aus, mein Schatz. Wenn du mir 15 Blumen von deinen Feldern bringst, pflanze ich sie dort ein, wo die ganze Stadt sich daran freuen kann. George sagt, das ist Zeitverschwendung. Ist es nicht.',
    goal: 'Bring Evelyn 15 Blumen'
  },
  Forage: {
    name: 'Geschenke des Waldes',
    text: 'Ich male ein Stillleben von allem, was uns das Tal umsonst schenkt. Beeren, Pilze, Wurzeln, wildes Grün ... alles, was du da draußen findest. Kannst du mir 15 gesammelte Gegenstände bringen? Was das Malen übersteht, koche ich hinterher.',
    goal: 'Bring Leah 15 gesammelte Gegenstände'
  }
};
