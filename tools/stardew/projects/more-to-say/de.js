// German lines (i18n/de.json), same structure and markers as LINES in pack.js:
// #$b# = next dialogue box, $h/$u/$s = portrait, ${a^b}$ = male/female form, @ = player name.
// Linus and Willy (and since 1.3 Marnie and Robin) say "du" to the player, as in the German game.
//
// Game names are the official German names: the [[de:…]] link of the English wiki page
// (stardewvalleywiki.com, revision in brackets) and the German page of de.stardewvalleywiki.com.
// The Saloon is "die Kneipe" (short for "Kneipe zum Sternenfall", as Gus says on the German "Gus"
// page, rev 29216).
//   Grape (192072) → Weintraube · Anchovy (193184) → Sardelle · Sardine (193174) → Sardine
//   Catfish (194361) → Katzenfisch · Pufferfish (193312) → Kugelfisch · Red Snapper (194138) → Riffbarsch
//   Salmon (193177) → Lachs · Eel (193346) → Aal · Walleye (193033) → Glasaugenbarsch (de 29020)
//   Squid (193247) → Tintenfisch (de 26480) · Bait (187707) → Köder · Parsnip (191123) → Pastinake
//   The Stardrop Saloon (194225) → Kneipe zum Sternenfall (de 29163) · Tomato (192642) → Tomate
//   Blueberry (192090) → Blaubeere (de 29045) · Hot Pepper (192919) → Peperoni (de 30036)
//   Fish Taco (193286) → Fisch-Taco · Tuna (195394) → Thunfisch · Red Cabbage (190562) → Rotkohl
//   Mayonnaise (190457) → Mayonnaise ("Mayo" kept, like "mayo" in English) · Pumpkin (192033) → Kürbis
//   Yam (192644) → Süßkartoffel (de 29568) · Cranberries (192078) → Preiselbeere (de 29575)
//   Pumpkin Soup (190509) → Kürbissuppe · Coffee (184120) → Kaffee · Ice Cream (193503) → Eis
//   Feast of the Winter Star (179976) → Fest des Wintersterns · Marnie's Ranch (195237) → Marnies Ranch
//   Milk (190620) → Milch · Hay (195142) → Heu · Silo (190582) → Silo · Pumpkin Pie (190476) → Kürbiskuchen
//   Carpenter's Shop (195197) → Schreinerladen, address "Bergstraße 24" (de 29837)
//   Coop (193803) → Hühnerstall · Barn (193419) → Stall (de 29442) · Wood (192694) → Holz
//   Stone (192695) → Stein
// Since 1.4 (Evelyn, George and the Wizard say "du" to the player, as on their German pages:
// Evelyn rev 29403, George rev 28909, Zauberer rev 30419):
//   Evelyn (191129) → Evelyn · George (193909) → George · Wizard (193912) → Zauberer
//   Leek (192783) → Lauch (de 29303) · Sweet Pea (192753) → Edelwicke (de 30237)
//   Cookie (189088) → Kekse · Raisins (193433) → Rosinen · Pumpkin (192033) → Kürbis (de 29365)
//   Festival of Ice (192452) → Fest des Eises · Night Market (195534) → Nachtmarkt
//   Coffee (184120) → Kaffee (de 29361) · Fried Mushroom (190294) → Gebratene Pilze
//   Purple Mushroom (193142) → Violetter Pilz (de 22686) · Common Mushroom (191745) → Gewöhnlicher Pilz
//   The Mines (195228) → Minen · Wizard's Tower (192711) → Turm des Zauberers
//   Feast of the Winter Star (179976) → Fest des Wintersterns (the star itself: "Winterstern")
//   The German lines are new sentences, like the English ones: no run of 6 or more words from the
//   German villager pages (checked once with a script). Single words kept from those pages:
//   "banal" (the Wizard's hated-gift reaction on "Zauberer", for "mundane"), "arkane" and "Hmmph"
//   (George). "People without magic" → "die meisten ohne Magie", so no gender switch is needed.
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
      friend: 'Hier oben gibt es wilde Weintrauben, von denen sonst niemand weiß.#$b#Ich würde dir sagen, wo... aber manches findet man besser selbst.$h'
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
      weather: 'Hörst du den Regen auf dem Dach? Das ist der Fluss, der ruft.#$b#Katzenfische werden an solchen Tagen mutig, ${Junge^Mädel}$. Glitschige Biester, aber der Kampf lohnt sich.$h',
      friend: 'Mein Vater sagte immer, das Meer führt Buch. Behandle es fair, und eines Tages zahlt es dir alles zurück.#$b#Hat vierzig Jahre gedauert, bis ich verstanden hab, was er meinte.$u'
    },
    summer: {
      met: 'Die Sommerhitze lockt mittags die Kugelfische raus.#$b#Pass auf die Sonne auf, und auf deine Schnur.',
      weather: 'Warmer Sommerregen auf dem Meer... das mögen die Riffbarsche.#$b#Ich auch, ehrlich gesagt. Dann ist der Strand schön ruhig.',
      friend: 'Manche Abende sitz ich am Ende vom Steg mit meiner Pfeife und schau, wie die Sonne untergeht.#$b#Wenn du mal mitmachen willst, auf den Planken ist Platz.$u'
    },
    fall: {
      met: 'Um diese Zeit ziehen die Lachse den Fluss hinauf. Große, kräftige Fische.#$b#Bring eine gute Angel mit.',
      weather: 'Herbstregen weckt die Aale und die Glasaugenbarsche. Angeln im Nassen ist nicht für jeden...#$b#Aber du bist ja nicht jeder, oder?$h',
      friend: 'Als du zum ersten Mal in meinen Laden kamst, dachte ich, du hältst vielleicht eine Saison durch.#$b#Freut mich, dass ich mich geirrt hab.$h'
    },
    winter: {
      met: 'Kaltes Wasser macht die Fische träge, aber nachts kommen die Tintenfische hoch.#$b#Der Winter hat seinen eigenen Lohn.',
      weather: 'Schnee, der aufs Wasser fällt... der schönste Anblick an der ganzen Küste.#$b#Kalt genug, dass dir der Bart einfriert, wohlgemerkt.',
      friend: 'Früher waren die Winter im Laden lang und still. Jetzt kommst du vorbei und fragst nach Köder und Wetter.#$b#Da fühlt sich ein alter Seemann nützlich.$h'
    }
  },
  // since 1.2; Pam's "kid" is "Kleines" (fits every player without a gender switch)
  Pam: {
    spring: {
      met: 'Frühling heißt Pastinaken. Wette, du hast schon ein ganzes Feld davon angesetzt, was?#$b#Ich mein ja nur. Unsereins könnte ab und zu was Anständiges zu futtern gebrauchen.',
      weather: 'Die ganze Nacht Regen auf dem Wohnwagendach, als würde einer Schlagzeug spielen. Da krieg ich kein Auge zu.#$b#Bleibst du trocken, Kleines? Hol dir da draußen bloß keine Erkältung.',
      friend: 'Penny steckt die Nase immer in irgendein altes Buch. Das Mädel hat einen Grips, den ich nie hatte.#$b#Sag ihr nicht, dass ich das gesagt hab, aber... ich bin echt stolz auf sie.$h'
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
      met: 'Kalt genug, dass einer Katze die Schnurrhaare abfrieren. Meine Haut ist trocken wie altes Papier.#$b#In der Kneipe ist es aber warm. Gus hält mir immer einen Hocker an der Theke frei.',
      weather: 'Schneetag, was? Penny wird eingepackt sein wie ein Sack Kartoffeln. Das hat sie von mir.#$b#Halt deine Stiefel trocken, Kleines. Mit nassen Füßen liegst du eine Woche flach.',
      friend: 'Penny sagt, ich hätte in letzter Zeit bessere Laune. Keine Ahnung, woran das liegt.#$b#Bild dir bloß nichts drauf ein, Kleines. ...Aber ich glaub, du hast was damit zu tun.$h'
    }
  },
  // since 1.2
  Gus: {
    spring: {
      met: 'Willkommen im Frühling, @! Das erste frische Grün kommt rein, und meine Küche war nie glücklicher.#$b#Komm mal in der Kneipe vorbei. Auf der Karte gibt es immer etwas Neues.',
      weather: 'An Regentagen ist es in der Kneipe ruhig. Dann poliere ich Gläser und denke mir neue Rezepte aus.#$b#Komm ab Mittag vorbei und trockne dich, @. Der Kessel ist an, und die Küche ist warm.$h',
      friend: 'Ich koche schon seit vielen Jahren für diese Stadt, @. Geburtstage, Feste, ruhige Abende unter der Woche...#$b#Schön, wenn mal jemand vorbeikommt, nur um zu sehen, wie es dem Koch geht.$h'
    },
    summer: {
      met: 'Der Sommer ist da! Tomaten, Blaubeeren, Peperoni... da könnte ein Koch vor Freude weinen.#$b#Wenn du davon etwas anbaust, würde ich es gern mal sehen.',
      weather: 'Hörst du den Donner? Die Leute kommen klitschnass aus dem Gewitter, und die ganze Kneipe riecht nach Regen und etwas Gutem aus dem Ofen.#$b#So mag ich die Abende am liebsten, @.$h',
      friend: 'Unter uns, @: Nichts geht über einen guten Fisch-Taco. Frischer Thunfisch, knackiger Rotkohl, ein Klecks Mayo...#$b#Bring mir mal einen, dann sag ich dir, ob er den Gus-Test besteht.$h'
    },
    fall: {
      met: 'Der Herbst ist die Zeit der Köche, @. Kürbisse, Süßkartoffeln, Preiselbeeren... ich weiß kaum, wo ich anfangen soll.#$b#Die Kneipe hat von Mittag bis Mitternacht offen, falls du dich aufwärmen musst.',
      weather: 'Kalter Regen und eine heiße Schüssel Kürbissuppe. Wenn das kein Glück ist, weiß ich auch nicht.#$b#Bleib nicht zu lange im Nassen, @. Auch wer auf dem Hof schuftet, braucht eine warme Mahlzeit.',
      friend: 'Manchmal sitze ich nach Feierabend mit einer Tasse Tee in der leeren Kneipe und denke daran, wer heute da war.#$b#In letzter Zeit ist deins eins der Gesichter, an die ich mich am liebsten erinnere.$h'
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
      weather: 'Bei so einem Gewitter mache ich mir Sorgen um jedes Tier im Tal. Irgendwer muss auf sie aufpassen, also kann ich das genauso gut sein.#$b#Falls du Tiere hast, sorg dafür, dass sie heute Nacht sicher drinnen sind, @.',
      friend: 'Die meisten Abende gehe ich in die Kneipe. Ich liebe meine Tiere, aber man braucht auch Leute zum Reden.#$b#In letzter Zeit bist du einer der Menschen, die ich am liebsten sehe, @.$h'
    },
    fall: {
      met: 'Der Herbst ist da! Zeit, Gras zu mähen und das Silo zu füllen. Den ganzen Winter über fressen die Tiere Heu.#$b#Noch kein Silo? Robin baut dir eins. Oder du kaufst dein Heu bei mir, natürlich.',
      weather: 'Kalter Regen, eine warme Küche und ein Stück Kürbiskuchen... mehr brauche ich nicht.#$b#Na ja, und gesunde Tiere. Bleib trocken, @!$h',
      friend: 'Es ist immer schön, wenn du vorbeischaust, @. Sogar die Tiere wirken dann ruhiger.#$b#Die merken immer, wer gut zu ihnen ist. Ich auch.$h'
    },
    winter: {
      met: 'Brr! Um diese Jahreszeit fühle ich mit jedem Tier, das draußen in der Kälte ausharren muss.#$b#Was auch immer auf deiner Farm lebt, @: Ein warmer Platz und ein freundliches Wort helfen viel.',
      weather: 'Schneetag! Jas würde bis zum Dunkelwerden draußen spielen, wenn ich sie ließe. Aber die Regel heißt: um sechs zu Hause, Schnee hin oder her.#$b#Bleib schön warm, @. Eine Tasse heiße Milch wirkt an so einem Tag Wunder.$h',
      friend: 'Winternächte sind lang und still hier draußen im Wald. Ich höre jedes Tier im Stall rascheln.#$b#Schön, wenn du vorbeischaust, @. Dann kommen mir die langen Nächte kürzer vor.$h'
    }
  },
  // since 1.3
  Robin: {
    spring: {
      met: 'Im Frühling komme ich kaum zur Ruhe! Frische Bergluft und jede Menge zu tun in der Werkstatt.#$b#Du brauchst einen Hühnerstall, einen Stall oder ein größeres Haus? Du weißt ja, wo du mich findest: Bergstraße 24!$h',
      weather: 'Schon wieder Regen! Dann sortiere ich heute eben an der Theke Bretter. Mit nassem Holz arbeitet man nicht gern.#$b#Komm hoch und trockne dich, wenn du vorbeikommst, @. Nach einem Schauer riecht die Bergluft wunderbar.$h',
      friend: 'Hab ich dir erzählt, dass dieses ganze Haus mein eigenes Werk ist? Jeder Balken, jedes Brett, von Anfang bis Ende.#$b#Etwas zu schaffen, das bleibt... ein besseres Gefühl gibt es nicht. Ich wette, das kennst du von deiner Farm, @.$h'
    },
    summer: {
      met: 'Die Sommersonne trocknet das Holz schön durch. Perfektes Wetter für ein Bauprojekt!#$b#Soll auf deiner Farm etwas ausgebaut werden? Bring genug Holz und Stein mit, dazu das Geld, und um den Rest kümmere ich mich.$h',
      weather: 'Hörst du den Donner? Macht mir keine Sorgen. Bei Gewittern und den Experimenten meines Mannes habe ich das Haus so gebaut, dass es einiges aushält.#$b#Feuerfester Lack auf jedem Dachbalken. Meine beste Entscheidung!$h',
      friend: 'So weit oben am Berg habe ich manchmal tagelang kaum Gesellschaft. Deshalb freue ich mich immer, wenn du vorbeischaust, @.#$b#Nicht zum Einkaufen, einfach zum Plaudern. So machen das Freunde, oder?$h'
    },
    fall: {
      met: 'Der Herbst ist da! Jetzt ist der Moment, Holz und Stein aufzuhäufen, bevor der Schnee kommt.#$b#Du planst ein Gebäude? Bestell lieber früh. An Festtagen arbeite ich nicht!$h',
      weather: 'Regentage sind zum Träumen von neuen Holzprojekten da. Vielleicht ein neuer Stuhl... oder gleich eine ganze Reihe Möbel für den Laden.#$b#Wie hält sich das Holz in deinem Haus, @? Knarrt irgendwo ein Brett?',
      friend: 'Im Herbst bin ich immer besonders dankbar. Demetrius, Maru, Sebastian... ein volles Haus und eine Arbeit, die ich liebe.#$b#Und gute Freunde wie dich, @. Vergiss das nicht.$h'
    },
    winter: {
      met: 'Zum Holzsammeln ist der Winter ideal, finde ich. Vom Hacken wird einem auch gleich warm!#$b#Wenn du genug sammelst, kannst du vielleicht noch vor dem Frühling dein Haus ausbauen.$h',
      weather: 'Nach frischem Schnee wirkt alles so still. Ich liebe diesen Blick hier oben vom Berg.#$b#Pass auf dem Bergweg auf, @. Der Schnee versteckt jede Wurzel und jeden Stein.',
      friend: 'Als ich sagte, dass ich beruflich Dinge bauen will, haben mich meine Eltern nur angestarrt. Sie hatten sehr traditionelle Vorstellungen.#$b#Ich bin froh, dass ich nicht auf sie gehört habe. Ich kann mir nichts anderes vorstellen, @.$h'
    }
  },
  // since 1.4; Evelyn's "dear" is "Liebes"
  Evelyn: {
    spring: {
      met: 'Guten Morgen, Liebes! Die Blumenbeete in der Stadt sind meine Aufgabe, und im Frühling brauchen sie mich am meisten.#$b#Wenn du mich auf den Knien in der Erde siehst, keine Sorge. Ich pflanze nur!$h',
      weather: 'So ein sanfter Frühlingsregen. Meine Blumen trinken sich heute Vormittag richtig satt.#$b#Ich bleibe heute mit einer Schüssel Keksteig drinnen. Um diese Jahreszeit steche ich die Kekse als kleine Blumen aus.$h',
      friend: 'George und ich bekommen nicht viel jungen Besuch, Liebes. Jedes Mal, wenn du vorbeikommst, wird das Haus ein bisschen lebendiger.#$b#Ein Tipp unter uns: Bring ihm Lauch aus den Bergen. Er wird brummeln, aber er freut sich.$h'
    },
    summer: {
      met: 'Die Edelwicken blühen, Liebes. Wenn du unterwegs welche findest, nimm dir einen Moment und riech daran.#$b#Und setz in dieser Sonne einen Hut auf. Feldarbeit und Sonnenbrand passen nicht zusammen.',
      weather: 'Regen an einem Sommertag! Na, dann ist es beschlossen: Ich backe.#$b#Diesmal Kokoskekse, ausgestochen wie winzige Palmen. Ein bisschen Strand, sogar im Haus.$h',
      friend: 'Unter uns, Liebes: In den warmen Monaten ist George sanfter gestimmt. Pass gut auf, dann merkst du es.#$b#Nach sechzig gemeinsamen Jahren liest man einen Mann wie ein offenes Buch.$h'
    },
    fall: {
      met: 'Herbstluft, Liebes! Feuchtes Laub und Pilze... ein Atemzug, und ich bin wieder ein kleines Mädchen, das durch den Wald rennt.#$b#Pass bitte auf die Blumenbeete in der Stadt auf. Die Herbstblüten sind so empfindlich.$h',
      weather: 'Ein nasser Herbsttag, also backe ich. Kekse in Kürbisform, passend zur Jahreszeit.#$b#Außerdem schmuggle ich George Rosinen ins Frühstück. Bisher kein Wort von ihm. Schmeckt er das überhaupt?$s',
      friend: 'In meinem Alter fühlt sich jede Jahreszeit wie ein Geschenk an, Liebes. Ich will keine einzige vergeuden.#$b#Ein paar dieser Tage mit dir zu plaudern, ist ganz bestimmt keine Vergeudung.$h'
    },
    winter: {
      met: 'Meine armen Gärten schlafen unter dem Schnee. Ich gehe trotzdem hinaus und werfe einen Blick auf sie.#$b#Pass auf den glatten Wegen gut auf, Liebes, und zieh dich ordentlich warm an!',
      weather: 'Noch mehr Schnee, Liebes! Diese Kälte zieht mir direkt in die alten Gelenke.#$b#Versprich mir, dass du heute etwas Warmes isst. Eine Schüssel Suppe wirkt Wunder.$h',
      friend: 'Soll ich dir ein Geheimnis verraten, Liebes? Als George mich zum ersten Mal bemerkt hat, war ein Schneeball im Spiel. Ausgerechnet beim Fest des Eises!#$b#Er kam sofort herüber, um zu sehen, ob ich verletzt bin. Was für Manieren! Hihi.$h'
    }
  },
  // since 1.4
  George: {
    spring: {
      met: "Evelyn hat mir heute früh Lauch zu den Eiern gemacht. Ein besseres Frühstück gibt's nicht.#$b#Ich bin also halbwegs gut gelaunt. Genieß es, solange es anhält.",
      weather: 'Regen. Hmmph. Kalt und nass, das ganze elende Zeug.#$b#Ich sitz gleich vorm Fernseher. Meine Sendung fängt jeden Moment an, also sag, was du sagen willst.',
      friend: 'Junge Leute geben sich normalerweise nicht mit einem alten Griesgram wie mir ab. Du bist ein seltsamer Vogel.#$b#Hmmph. Stört mich aber nicht.$h'
    },
    summer: {
      met: "Evelyn behauptet, die Sommerwärme macht mich freundlicher.#$b#Hmmph. Die Frau meint, sie weiß alles. ...Meistens stimmt's sogar.",
      weather: 'Grauer Himmel mitten im Sommer. Hmmph. War ja klar.#$b#Wenigstens brauchen deine Felder heute keine Gießkanne. Irgendwer sollte sich ja darüber freuen.',
      friend: 'Nimm dir einen Stuhl, @. Vorm Fernseher ist noch Platz.#$b#Evelyn sagt ständig, ich soll öfter aus dem Haus. Mach ich auch. Nach dieser Folge.$h'
    },
    fall: {
      met: 'Landwirtschaft, was? Im Herbst zeigt sich, ob sich die Arbeit gelohnt hat. Ein anständiges Auskommen.#$b#Hmmph. Na los, du hast eine Ernte einzubringen.',
      weather: 'Nass, kalt und grau. Hmmph. Bei so einem Wetter muss ein Teller gebratene Pilze her.#$b#Das ist kein Wink. Nur so gesagt.',
      friend: 'Mein Großvater war übrigens Bauer. Gute, anständige Leute, die Bauern.#$b#Ein paar Jahrzehnte jünger, und ich stünde diesen Herbst auf deinem Feld und würde dir sagen, was du falsch machst.$h'
    },
    winter: {
      met: 'Brr. Die Kälte geht einem jedes Jahr tiefer in die Knochen, sag ich dir.#$b#Und die Pullover heutzutage? Dünn wie Papier. Nicht wie die alten aus Wolle.',
      weather: "Schon wieder Schnee. Hmmph. Wette, Evelyn plant schon einen Grund, mich nach draußen zu zerren.#$b#Heute nicht. Heute gibt's nur mich, eine Decke und den Fernseher.",
      friend: "Jeden Winter gehen Evelyn und ich auf den Nachtmarkt. Ihr gefällt's. Mir gefällt, dass der Kaffee nichts kostet.#$b#...Und dass ich dich da vielleicht treffe, @. Sag ihr bloß nicht, dass ich das gesagt hab.$h"
    }
  },
  // since 1.4; "young @" is just "@" (German "junger/junge" would need a gender switch the English line does not have)
  Wizard: {
    spring: {
      met: 'Ah, @. Der Wald erwacht wieder, wie in jedem Frühling.#$b#Nicht jedes Geheimnis dieses Tals zeigt sich sofort. Geduld wird dir gute Dienste leisten.',
      weather: 'Regen... und wenn das Glück mir hold ist, am Abend Donner. Manche Elementargeister antworten mir nur, wenn ein Gewitter über uns steht.#$b#Bitte mich nicht um eine Erklärung. Ich muss mich vorbereiten.',
      friend: 'Ich behalte die Menschen dieses Tals still im Auge, @. Eines Tages muss jemand meine Arbeit fortführen.#$b#Ich werde schließlich nicht ewig hier sein. Wissen ohne Erben ist verlorenes Wissen.'
    },
    summer: {
      met: 'Der Sommer wärmt den Wald, @. Unter deinen Füßen liegt ein Feld großer magischer Kraft.#$b#Darum steht mein Turm genau hier. Und nun, falls dein Anliegen nicht dringend ist, habe ich zu tun.',
      weather: 'Der Regen trommelt auf den Turm, und der Wald ist heute laut. Ein guter Tag für meine Studien.#$b#Die Sprache der Elementargeister lernt man nicht in einer Saison, @. Ich habe ihr mein ganzes Leben gewidmet und bin noch nicht fertig.',
      friend: 'Deine Zukunft ist mir nicht verborgen, @. Doch zu teilen, was ich gesehen habe, könnte echten Schaden anrichten.#$b#Also schweige ich. Die Entscheidungen triffst du selbst.'
    },
    fall: {
      met: 'Um diese Jahreszeit ist der Wald voller Pilze. Meist gewöhnliche. Banal.#$b#Ein Violetter Pilz aus den Minen dagegen... für den hätte ich Verwendung.',
      weather: 'Schon wieder Regen, @. Ein guter Tag, um die langweiligeren Geschenke dem Feuer zu übergeben.#$b#Wenn du mir etwas bringst, dann etwas, in dem arkane Kraft summt. Gewöhnliches langweilt mich.',
      friend: 'Ich habe vorausgesehen, dass du in dieses Tal kommst, @. Nicht vorausgesehen habe ich, wie oft du an meine Tür klopfen würdest.#$b#Es ist... nicht unwillkommen.'
    },
    winter: {
      met: 'Der Winterstern fasziniert mich seit jeher, @. Er ist einer der Gründe, warum ich mich überhaupt in diesem Tal niedergelassen habe.#$b#Mehr sage ich nicht. Meine Arbeit wartet.',
      weather: 'Durch all den Schnee, nur um zu meinem Turm zu kommen? Die meisten ohne Magie würden sich das nie antun, @.#$b#Du bist eigenartig. Das meine ich freundlich.',
      friend: 'Die Leute in der Stadt halten Abstand zu mir. Was sie nicht erklären können, macht sie nervös.#$b#Dich, @, scheint das nie gestört zu haben. In dieser kalten, stillen Zeit sind deine Besuche willkommen.'
    }
  }
};
