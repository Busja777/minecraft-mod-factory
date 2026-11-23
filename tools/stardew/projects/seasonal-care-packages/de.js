// German texts (i18n/de.json, since 1.1) for every letter of pack.js. The villagers say "du" to the
// player, as on their German pages (Evelyn rev 29403, Gus rev 29216, Caroline rev 29056, Marnie
// rev 29182). Same greeting as Joja Junk Mail's German letters ("Hallo @,"). @ = player name,
// ^ = line break, same as English. The letters name no item, as in English (the parcel is a surprise).
//
// Game names are the official German names: the [[de:…]] link of the English wiki page
// (stardewvalleywiki.com, revision in brackets) and the German page of de.stardewvalleywiki.com
// (revision after "de"), which links back with [[en:…]].
//   Evelyn (191129) → Evelyn (de 29403) · George (193909) → George (de 28909) · Gus (195359) → Gus
//   (de 29216) · Caroline (195373) → Caroline (de 29056) · Marnie (191544) → Marnie (de 29182)
//   The Stardrop Saloon (194225) → Kneipe zum Sternenfall (de 29163); "die Kneipe" for short, as
//   Gus says on his German page (like More to Say's German lines)
//   Seasons (194195) → Jahreszeiten (de 29775: Frühling, Sommer, Herbst, Winter)
// No run of 6 or more words from the cached German wiki pages (checked once with a script).

// season → [German letter text (signed), title]
export const DE = {
  spring: ['Hallo @,^^der Garten wacht auf, und ich auch, ganz langsam! George sagt, ich mache viel zu viel Aufhebens um die Neuen in der Stadt, aber ich wollte dir eine Kleinigkeit zur Jahreszeit schicken.^^Pflanz es, koch es oder stell es in eine Vase ... ganz wie es deinen Tag schöner macht.^^   -Evelyn',
    'Ein Frühlingspaket von Evelyn'],
  summer: ['Hallo @!^^Es ist so heiß, dass man auf den Stufen der Kneipe ein Spiegelei braten könnte. Ich habe dir ein paar Leckereien für den Sommer eingepackt. Arbeite nicht zu hart da draußen in der Sonne, und komm mal auf ein kaltes Getränk vorbei.^^   -Dein Freund Gus',
    'Ein Sommerpaket von Gus'],
  fall: ['Hallo @,^^auf meinen Spaziergängen in diesem Herbst habe ich ein paar Dinge gesammelt und dabei an dich gedacht. Das Tal ist um diese Jahreszeit so großzügig, da wäre es doch falsch, nicht zu teilen.^^Gönn dir ab und zu eine Pause bei einer Tasse Tee, ja?^^   -Caroline',
    'Ein Herbstpaket von Caroline'],
  winter: ['Hallo @,^^der Winter ist da, und die Tiere und ich machen es uns gemütlich. Unter dem Schnee habe ich ein paar Leckereien für den Winter gefunden und das Beste davon für dich beiseitegelegt. So eine Nachbarschaft hat man schließlich nicht alle Tage.^^Lass den Ofen nicht ausgehen, und hol deine Tiere in den kalten Nächten herein.^^   -Marnie',
    'Ein Winterpaket von Marnie']
};

// season → its German name (Jahreszeiten, de 29775); every title names it
export const SEASONS_DE = { spring: 'Frühling', summer: 'Sommer', fall: 'Herbst', winter: 'Winter' };
