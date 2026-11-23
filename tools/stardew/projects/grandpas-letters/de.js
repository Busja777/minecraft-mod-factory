// German texts (i18n/de.json, since 1.1) for every letter of pack.js. Grandpa says "du", as in his
// letter on the German page "Opa" (rev 25621: "Wenn du das hier liest …"); warm and plain, new
// sentences, nothing taken from that letter. @ = player name, ^ = line break, same as English.
// The player is his grandchild: "Enkelkind" is neuter, so no gender switch is needed.
//
// Game names are the official German names: the [[de:…]] link of the English wiki page
// (stardewvalleywiki.com, revision in brackets) and the German page of de.stardewvalleywiki.com
// (revision after "de"), which links back with [[en:…]].
//   Grandpa (182923) → Opa (de 25621; titles "Opas …", like the page's "Opas Brief")
//   The Farm (195355) → Der Hof (de 30166, "der Hof")
//   Seasons (194195) → Jahreszeiten (de 29775: Frühling, Sommer, Herbst, Winter)
//   The Beach (192724) → Der Strand (de 30016)
//   Acorn (193200) → Eichel (de 30230)
//   Sunflower Seeds (193137) → Sonnenblumen-Saat (de 29429)
//   Maple Seed (193278) → Ahornsamen (de 30201, its tree: "Ahornbaum")
//   Pine Cone (193239) → Kiefernzapfen (de 16485)
// No run of 6 or more words from the cached German wiki pages (checked once with a script).

export const SIGN = '   -Dein Opa';

// letter name (season + day, as in pack.js) → [keepsake item ID or null, German item name, text, title]
export const DE = {
  spring3: ['(O)309', 'Eichel',
    'Mein liebes Enkelkind @,^^wenn dich dieser Brief erreicht, bist du auf dem Hof angekommen. Vor langer Zeit habe ich ein paar Briefe geschrieben und sie einem alten Freund gegeben, der dir jede Jahreszeit einen davon schickt. So hast du ein wenig Gesellschaft von mir.^^Ein Rat für die ersten Wochen: Pflanze nicht mehr, als du gießen kannst, geh vor Mitternacht ins Bett und sag deinen Nachbarn Hallo. Das Tal belohnt Geduld.^^Ich lege dir eine Eichel bei. Pflanz sie dort, wo du ihr beim Wachsen zusehen kannst.',
    'Opas Frühlingsbrief'],
  summer1: ['(O)431', 'Sonnenblumen-Saat',
    'Liebes Enkelkind @,^^schon Sommer! Die Tage sind lang, und der Boden ist warm. Manche Pflanzen des Sommers tragen die ganze Saison über immer wieder, wenn sie einmal ausgewachsen sind, also lohnt es sich, sie früh zu setzen. Und wenn es regnet, lass den Himmel gießen und nimm dir den Tag für dich.^^Wenn du eine Pause brauchst, sind der Fluss und der Strand gute Gesellschaft.^^Hier ist ein wenig Sonnenblumen-Saat, damit neben deiner Tür etwas Fröhliches blüht.',
    'Opas Sommerbrief'],
  fall1: ['(O)310', 'Ahornsamen',
    'Liebes Enkelkind @,^^der Herbst war auf dem Hof immer meine liebste Jahreszeit. Die Wälder hängen voller Beeren und Pilze, und die Luft riecht nach Holzfeuer.^^Behalte den Kalender im Blick: Was die Kälte nicht verträgt und bei Winteranfang noch auf dem Feld steht, verdorrt. Plane deine letzte Aussaat nach den Tagen, die dir noch bleiben.^^Ich lege einen Ahornsamen bei. Unter einem Ahornbaum sitzt man im schönsten Schatten.',
    'Opas Herbstbrief'],
  winter1: ['(O)311', 'Kiefernzapfen',
    'Liebes Enkelkind @,^^im Winter wächst draußen nur wenig, und das ist in Ordnung. Repariere, was repariert werden muss, besuch deine Freunde, geh angeln, sieh dich um. Auch Ruhe gehört zur Arbeit auf dem Hof.^^Halte dich warm und vergiss nicht, ordentlich zu essen.^^Hier ist ein Kiefernzapfen. Heb ihn bis zum Frühling auf und gib ihm dann einen eigenen Platz.',
    'Opas Winterbrief'],
  winter28: [null, null,
    'Mein liebes Enkelkind @,^^ein ganzes Jahr. Inzwischen hast du jede Jahreszeit auf dem Hof erlebt, die arbeitsreichen und die stillen.^^Dies ist der letzte meiner Briefe. Ich hoffe, das Tal fühlt sich langsam wie ein Zuhause an und du hast hier gefunden, was ich gefunden habe: guten Boden, gute Menschen und ein bisschen Frieden.^^Wie die Geschichte weitergeht, schreibst du jetzt selbst.^^In Liebe,^',
    'Opas letzter Brief']
};
