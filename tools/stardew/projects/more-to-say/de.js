// German lines (i18n/de.json), same structure and markers as LINES in pack.js:
// #$b# = next dialogue box, $h/$u/$s = portrait, ${a^b}$ = male/female form, @ = player name.
// Linus and Willy (and since 1.3 Marnie and Robin) say "du" to the player, as in the German game.
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
  },
  // since 1.2; Pam's "kid" is "Kleines" (fits every player without a gender switch)
  Pam: {
    spring: {
      met: 'Frühling heißt Pastinaken. Wette, du hast schon ein ganzes Feld davon angesetzt, was?#$b#Ich mein ja nur. Unsereins könnte ab und zu was Anständiges zu futtern gebrauchen.',
      weather: 'Die ganze Nacht Regen auf dem Wohnwagendach, als würde einer Schlagzeug spielen. Da krieg ich kein Auge zu.#$b#Bleibst du trocken, Kleines? Hol dir da draußen bloß keine Erkältung.',
      friend: 'Penny steckt die Nase immer in irgendein altes Buch. Die ist um einiges klüger, als ich je war.#$b#Sag ihr nicht, dass ich das gesagt hab, aber... ich bin echt stolz auf das Mädel.$h'
    },
    summer: {
      met: 'Heiß heute, Kleines. Da könnte man auf der Straße ein Ei braten.#$b#Trink genug Wasser und lass den Hut auf.',
      weather: 'Da zieht ein Gewitter auf. Früher bin ich durch so ein Wetter gefahren, Scheibenwischer auf volle Pulle, Radio laut.#$b#Vor einer nassen Straße lernt man Respekt, Kleines.',
      friend: 'Weißt du, was ich an dir mag, Kleines? Du guckst mich nicht an, als wär ich ein altes Wrack.#$b#Die meisten laufen einfach am Wohnwagen vorbei. Du bleibst stehen und redest.$h'
    },
    fall: {
      met: 'Schon wieder liegt überall in meinem Hof Laub. Irgendwer wird sich beschweren, das weiß ich jetzt schon.#$b#Sollen sie doch. Heute wird nicht geharkt.',
      weather: 'Kalter Regen zieht mir direkt in die steifen alten Beine. Da brauch ich doppelt so lang quer durch die Stadt.#$b#Lach nicht, Kleines. Du knarzt auch irgendwann.$h',
      friend: 'Du kommst immer wieder vorbei, Kleines. Bei Regen und Sonne, ob du viel zu tun hast oder nicht.#$b#Das machen nicht mehr viele. Mit so einer Freundschaft steh ich wohl ganz gut da.$h'
    },
    winter: {
      met: 'Kalt genug, dass einer Katze die Schnurrhaare abfrieren. Meine Haut ist trocken wie altes Papier.#$b#Im Saloon ist es aber warm. Gus hält mir immer einen Hocker an der Theke frei.',
      weather: 'Schneetag, was? Penny wird eingepackt sein wie ein Sack Kartoffeln. Das hat sie von mir.#$b#Halt deine Stiefel trocken, Kleines. Mit nassen Füßen liegst du eine Woche flach.',
      friend: 'Penny sagt, ich hätte in letzter Zeit bessere Laune. Keine Ahnung, woran das liegt.#$b#Bild dir bloß nichts drauf ein, Kleines. ...Aber ich glaub, du hast was damit zu tun.$h'
    }
  },
  // since 1.2
  Gus: {
    spring: {
      met: 'Willkommen im Frühling, @! Das erste frische Grün kommt rein, und meine Küche war nie glücklicher.#$b#Komm mal im Saloon vorbei. Auf der Karte gibt es immer etwas Neues.',
      weather: 'An Regentagen ist es im Saloon ruhig. Dann poliere ich Gläser und denke mir neue Rezepte aus.#$b#Komm ab Mittag vorbei und trockne dich, @. Der Kessel ist an, und die Küche ist warm.$h',
      friend: 'Ich koche schon seit vielen Jahren für diese Stadt, @. Geburtstage, Feste, ruhige Abende unter der Woche...#$b#Schön, wenn mal jemand vorbeikommt, nur um zu sehen, wie es dem Koch geht.$h'
    },
    summer: {
      met: 'Der Sommer ist da! Tomaten, Heidelbeeren, Chilis... da könnte ein Koch vor Freude weinen.#$b#Wenn du davon etwas anbaust, würde ich es gern mal sehen.',
      weather: 'Hörst du den Donner? Die Leute kommen klitschnass aus dem Gewitter, und der ganze Saloon riecht nach Regen und etwas Gutem aus dem Ofen.#$b#So mag ich die Abende am liebsten, @.$h',
      friend: 'Unter uns, @: Nichts geht über einen guten Fisch-Taco. Frischer Thunfisch, knackiger Rotkohl, ein Klecks Mayo...#$b#Bring mir mal einen, dann sag ich dir, ob er den Gus-Test besteht.$h'
    },
    fall: {
      met: 'Der Herbst ist die Zeit der Köche, @. Kürbisse, Yamswurzeln, Cranberrys... ich weiß kaum, wo ich anfangen soll.#$b#Der Saloon hat von Mittag bis Mitternacht offen, falls du dich aufwärmen musst.',
      weather: 'Kalter Regen und eine heiße Schüssel Kürbissuppe. Wenn das kein Glück ist, weiß ich auch nicht.#$b#Bleib nicht zu lange im Nassen, @. Auch wer auf dem Hof schuftet, braucht eine warme Mahlzeit.',
      friend: 'Manchmal sitze ich nach Feierabend mit einer Tasse Tee im leeren Saloon und denke daran, wer heute da war.#$b#In letzter Zeit ist deins eins der Gesichter, an die ich mich am liebsten erinnere.$h'
    },
    winter: {
      met: 'Brr! Der Winter ist da. Gut, dass die Küche der wärmste Raum in jedem Haus ist.#$b#Komm mal aus der Kälte rein, @. Der Kaffee ist immer heiß.',
      weather: 'Draußen türmt sich der Schnee, und drinnen rücken alle ein bisschen näher an die Theke.#$b#Ich lasse einen großen Topf Eintopf köcheln und stelle einen Mopp an die Tür. Schneestiefel, du weißt ja.$h',
      friend: 'Das Fest des Wintersterns ist die geschäftigste Zeit des Jahres in meiner Küche. Ich plane das Menü wochenlang im Voraus.#$b#Manchmal frage ich mich, wozu der Aufwand. Dann sehe ich die ganze Stadt zusammen essen und weiß es wieder.$h'
    }
  },
  // since 1.3
  Marnie: {
    spring: {
      met: 'Endlich Frühling! Das Gras wird grün, und meine Tiere können es kaum erwarten.#$b#Wenn du selbst Tiere haben möchtest, schau mal auf der Ranch vorbei. Ich stehe fast jeden Tag von neun bis vier an der Theke.',
      weather: 'Sieh dich an, nass bis auf die Knochen... du armes Ding!#$b#Komm jederzeit auf die Ranch und trockne dich, @. Die Tiere freuen sich über ein bisschen Gesellschaft.$h',
      friend: 'Weißt du, @, du bist genau so, wie ich mir die neuen Leute auf der alten Farm gewünscht habe.#$b#Freundlich, fleißig, und du bleibst immer kurz stehen, um Hallo zu sagen. Das bedeutet viel, hier draußen im Wald.$h'
    },
    summer: {
      met: 'Jas sagt, das Beste am Leben auf dem Hof ist frisches Eis aus der Milch unserer Kühe.#$b#Da kann ich nicht widersprechen. Etwas Kaltes an einem heißen Tag hat noch niemandem geschadet.$h',
      weather: 'Bei so einem Gewitter mache ich mir Sorgen um jedes Tier im Tal. Wenn ich mich nicht um sie kümmere, wer dann?#$b#Falls du Tiere hast, sorg dafür, dass sie heute Nacht sicher drinnen sind, @.',
      friend: 'Die meisten Abende gehe ich in den Saloon. Tiere sind tolle Gesellschaft, aber ich brauche auch Menschen um mich.#$b#In letzter Zeit bist du einer der Menschen, die ich am liebsten sehe, @.$h'
    },
    fall: {
      met: 'Der Herbst ist da! Zeit, Gras zu mähen und das Silo zu füllen. Den ganzen Winter über fressen die Tiere Heu.#$b#Noch kein Silo? Robin baut dir eins. Oder du kaufst dein Heu bei mir, natürlich.',
      weather: 'Kalter Regen, eine warme Küche und ein Stück Kürbiskuchen... mehr brauche ich nicht.#$b#Na ja, und gesunde Tiere. Bleib trocken, @!$h',
      friend: 'Es ist immer schön, wenn du vorbeischaust, @. Sogar die Tiere wirken dann ruhiger.#$b#Die merken immer, wer gut zu ihnen ist. Ich auch.$h'
    },
    winter: {
      met: 'Brr! Um diese Jahreszeit tun mir all die armen, frierenden Tiere da draußen leid.#$b#Was auch immer auf deiner Farm lebt, @: Ein warmer Platz und ein freundliches Wort helfen viel.',
      weather: 'Schneetag! Jas würde bis zum Dunkelwerden draußen spielen, wenn ich sie ließe. Aber die Regel heißt: um sechs zu Hause, Schnee hin oder her.#$b#Bleib schön warm, @. Eine Tasse heiße Milch wirkt an so einem Tag Wunder.$h',
      friend: 'Winternächte sind lang und still hier draußen im Wald. Ich höre jedes Tier im Stall rascheln.#$b#Schön, wenn du vorbeischaust, @. Dann kommen mir die langen Nächte kürzer vor.$h'
    }
  },
  // since 1.3
  Robin: {
    spring: {
      met: 'Der Frühling ist eine arbeitsreiche Zeit! Frische Bergluft und jede Menge zu tun in der Werkstatt.#$b#Du brauchst einen Hühnerstall, eine Scheune oder ein größeres Haus? Du weißt ja, wo du mich findest: Bergstraße 24!$h',
      weather: 'Schon wieder Regen! Dann sortiere ich heute eben an der Theke Bretter. Mit nassem Holz arbeitet man nicht gern.#$b#Komm hoch und trockne dich, wenn du vorbeikommst, @. Nach einem Schauer riecht die Bergluft wunderbar.$h',
      friend: 'Hab ich dir erzählt, dass ich unser Haus von Grund auf selbst gebaut habe? Jeden Balken, jedes Brett.#$b#Etwas zu schaffen, das bleibt... ein besseres Gefühl gibt es nicht. Ich wette, das kennst du von deiner Farm, @.$h'
    },
    summer: {
      met: 'Die Sommersonne trocknet das Holz schön durch. Perfektes Wetter für ein Bauprojekt!#$b#Soll auf deiner Farm etwas ausgebaut werden? Bring genug Holz und Stein mit, dazu das Geld, und um den Rest kümmere ich mich.$h',
      weather: 'Hörst du den Donner? Macht mir keine Sorgen. Bei Gewittern und den Experimenten meines Mannes habe ich das Haus so gebaut, dass es einiges aushält.#$b#Feuerfester Lack auf jedem Dachbalken. Meine beste Entscheidung!$h',
      friend: 'Hier oben in den Bergen kann es ziemlich einsam werden. Deshalb freue ich mich immer, wenn du vorbeischaust, @.#$b#Nicht zum Einkaufen, einfach zum Plaudern. So machen das Freunde, oder?$h'
    },
    fall: {
      met: 'Der Herbst ist da! Die beste Zeit, vor dem Winter Holz und Stein zu horten.#$b#Du planst ein Gebäude? Bestell lieber früh. An Festtagen arbeite ich nicht!$h',
      weather: 'Regentage sind zum Träumen von neuen Holzprojekten da. Vielleicht ein neuer Stuhl... oder gleich eine ganze Reihe Möbel für den Laden.#$b#Wie hält sich das Holz in deinem Haus, @? Knarrt irgendwo ein Brett?',
      friend: 'Im Herbst bin ich immer besonders dankbar. Demetrius, Maru, Sebastian... ein volles Haus und eine Arbeit, die ich liebe.#$b#Und gute Freunde wie dich, @. Vergiss das nicht.$h'
    },
    winter: {
      met: 'Der Winter ist die perfekte Zeit zum Holzsammeln. Vom Hacken wird einem auch gleich warm!#$b#Wenn du genug sammelst, kannst du vielleicht noch vor dem Frühling dein Haus ausbauen.$h',
      weather: 'Nach frischem Schnee wirkt alles so still. Ich liebe diesen Blick hier oben vom Berg.#$b#Pass auf dem Bergweg auf, @. Der Schnee versteckt jede Wurzel und jeden Stein.',
      friend: 'Meine Eltern waren ganz verdutzt, als ich ihnen sagte, dass ich mit Holz arbeiten will. Sie waren ziemlich altmodisch.#$b#Ich bin froh, dass ich nicht auf sie gehört habe. Ich kann mir nichts anderes vorstellen, @.$h'
    }
  }
};
