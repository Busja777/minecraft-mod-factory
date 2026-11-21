// German lines (i18n/de.json), same structure and markers as LINES in pack.js:
// #$b# = next dialogue box, $h/$u/$s = portrait, ${a^b}$ = male/female form, @ = player name.
// Linus and Willy say "du" to the player, as in the German game.
export const LINES_DE = {
  Linus: {
    spring: {
      met: 'Die Vögel sind diese Woche zurück auf den Berg gekommen. Sie fragen niemanden, ob sie hier wohnen dürfen.#$b#Das mag ich an ihnen.',
      weather: 'Frühlingsregen ist ein Geschenk. Der Bach wird laut, die Pilze wachen auf, und niemand kommt den Weg herauf, um mich zu stören.#$b#...Du störst mich nicht, @. Nicht mehr.$h',
      friend: 'Früher habe ich mir gesagt, ich ziehe bis zum Sommer weiter. Das war vor ein paar Sommern.#$b#Manche Orte halten einen fest. Ich glaube, der Berg hat beschlossen, mich zu behalten.$h'
    },
    summer: {
      met: 'Sommernächte sind kurz, aber die Sterne fühlen sich nah an. Ich schlafe mit offenem Zelt.',
      weather: 'Wenn ein Sommergewitter über den See zieht, sitze ich im Zelt und zähle zwischen Blitz und Donner.#$b#Eine alte Gewohnheit. Sie beruhigt den Kopf.',
      friend: 'Hier oben gibt es wilde Trauben, von denen sonst niemand weiß.#$b#Ich würde dir sagen, wo... aber manches findet man besser selbst.$h'
    },
    fall: {
      met: 'Die Blätter färben sich. Im Herbst lässt alles in der Natur etwas los.#$b#Davon könnten die Menschen lernen.',
      weather: 'Pilze lieben dieses Wetter. Ich auch, aber das würde ich in der Stadt nie sagen.#$b#Die halten mich sowieso schon für seltsam.',
      friend: 'Ich sammle schon Feuerholz für den Winter. Du musst nicht helfen.#$b#...Aber Gesellschaft würde ich nicht ablehnen.$h'
    },
    winter: {
      met: 'Der Winter prüft jeden, der hier draußen lebt. Ich habe die Prüfung schon bestanden.#$b#Ich bestehe sie wieder.',
      weather: 'Schnee dämpft den ganzen Berg. An Tagen wie diesem höre ich meinen eigenen Herzschlag.',
      friend: 'Früher war der Winter die einsamste Zeit. Jetzt schaut ab und zu jemand an meinem Zelt vorbei.#$b#Das macht die Kälte viel leichter.$h'
    }
  },
  Willy: {
    spring: {
      met: 'Ahoi, @! Die Frühlingsflut bringt Sardellen und Sardinen nah an die Küste.#$b#Gute Zeit für junge Angler zum Üben.',
      weather: 'Hörst du den Regen auf dem Dach? Das ist der Fluss, der ruft.#$b#Welse werden an solchen Tagen mutig, ${Junge^Mädel}$. Glitschige Biester, aber der Kampf lohnt sich.$h',
      friend: 'Mein Vater sagte immer, das Meer führt Buch. Behandle es fair, und eines Tages zahlt es dir alles zurück.#$b#Hat vierzig Jahre gedauert, bis ich verstanden hab, was er meinte.$u'
    },
    summer: {
      met: 'Die Sommerhitze lockt mittags die Kugelfische raus.#$b#Pass auf die Sonne auf, und auf deine Schnur.',
      weather: 'Warmer Sommerregen auf dem Meer... das mögen die Riffbarsche.#$b#Ich auch, ehrlich gesagt. Dann ist der Strand schön ruhig.',
      friend: 'Manche Abende sitz ich am Ende vom Steg mit meiner Pfeife und schau, wie die Sonne untergeht.#$b#Wenn du mal mitmachen willst, auf den Planken ist Platz.$u'
    },
    fall: {
      met: 'Um diese Zeit ziehen die Lachse den Fluss hinauf. Große, kräftige Fische.#$b#Bring eine gute Angel mit.',
      weather: 'Herbstregen weckt die Aale und die Zander. Angeln im Nassen ist nicht für jeden...#$b#Aber du bist ja nicht jeder, oder?$h',
      friend: 'Als du zum ersten Mal in meinen Laden kamst, dachte ich, du hältst vielleicht eine Saison durch.#$b#Freut mich, dass ich mich geirrt hab.$h'
    },
    winter: {
      met: 'Kaltes Wasser macht die Fische träge, aber nachts kommen die Kalmare hoch.#$b#Der Winter hat seinen eigenen Lohn.',
      weather: 'Schnee, der aufs Wasser fällt... der schönste Anblick an der ganzen Küste.#$b#Kalt genug, dass dir der Bart einfriert, wohlgemerkt.',
      friend: 'Früher waren die Winter im Laden lang und still. Jetzt kommst du vorbei und fragst nach Köder und Wetter.#$b#Da fühlt sich ein alter Seemann nützlich.$h'
    }
  }
};
