// More to Say: new dialogue lines for Linus and Willy (since 1.0), Pam and Gus (since 1.2), Marnie
// and Robin (since 1.3) and Evelyn, George and the Wizard (since 1.4), one per season for each of
// three moods (a
// greeting once you have met, a rain or snow day from 2 hearts, a closer word from 6 hearts). Every
// line is said once, by the villager it belongs to, and no vanilla dialogue key is touched.
//
// How the lines reach the villager (Stardew Valley 1.6, documented on the wiki, not tested in the game):
// - The lines are new entries in Characters/Dialogue/<NPC>. Their keys start with {{ModId}}_, so they
//   can never overwrite one of the game's own keys (Mon, spring_Fri6, Mountain …); Content Patcher's
//   EditData adds entries to the existing asset and only replaces entries with the same key
//   (Content Patcher author guide, action-editdata.md, "Entries").
//   https://stardewvalleywiki.com/Modding:Dialogue#Characters.5CDialogue.5C.7B.7Bt.7CNPC.7D.7D.xnb
// - A key that is not one of the game's own formats is only spoken when it is a conversation topic:
//   "A conversation topic is a temporary flag which … can trigger one-time NPC dialogue (if they have
//   a matching dialogue key)". Each topic ID names its villager and only that villager has the key,
//   so no one else reacts.
//   https://stardewvalleywiki.com/Modding:Dialogue#Conversation_topics
// - Each topic is started by one Data/TriggerActions entry: Trigger "DayStarted", Action
//   "AddConversationTopic <topic ID> <days>" (the trigger actions page shows the same pattern with
//   "AddConversationTopic {{ModId}}_LeoMoved 5"). Entries run once per player by default, so every
//   line comes once per save.
//   https://stardewvalleywiki.com/Modding:Trigger_actions#Data/TriggerActions
// - Conditions are game state queries: SEASON, DAY_OF_MONTH (a window, so a 7-day topic ends inside
//   its season and the 6-heart line does not start on the same morning as the greeting),
//   WEATHER Town Rain Storm / Snow (Town = the valley's weather, also when the day starts elsewhere),
//   PLAYER_HAS_MET and PLAYER_HEARTS Current <npc> <min>.
//   https://stardewvalleywiki.com/Modding:Game_state_queries
// - Topic IDs avoid "_memory_" (the game derives its topic-memory keys from that text) and contain no
//   spaces (trigger action arguments are space-delimited).
// - Text: dialogue format with #$b# (next box), $h / $s / $u portraits (Linus: happy, concerned,
//   surprised; Willy: happy, concerned, smoking — both villager pages, "Portraits"; Pam's and Gus's
//   third portrait is a second neutral face, so their lines use only $h and $s; Marnie's third is
//   "Neutral" and Robin's "Annoyed" on their pages, so their lines use only $h; Evelyn: Happy,
//   Concerned, then a second "Neutral", George: Happy, Concerned, Annoyed, so both use only $h and
//   $s; the Wizard has only "Wizard" and "Wizard Surprised", so his lines have no portrait command
//   and keep the neutral face — portraits are numbered left to right from $0, Modding:Dialogue
//   "Portrait commands"), @ = player name,
//   ${male^female}$ gender switch. https://stardewvalleywiki.com/Modding:Dialogue#Format
// - The text comes from i18n (Content Patcher translations.md); {{ModId}} keeps IDs unique (tokens.md).
//
// Spoilers: lines only use what the player already knows at that heart level. Linus's lines never
// mention his 0-heart (trash cans), 4-heart (camp, Wild Bait) or 8-heart (Robin) events; Willy's never
// mention the 6-heart crab event or legendary fish. Willy's pappy is known from his 3-heart recipe
// letter, the Fern Islands from his own 6+ heart line. Heart events depend on the player's route, so a
// 6-heart line does not assume that any event was seen. Fish facts follow the wiki's fish pages
// (catfish: river, spring/fall rain; pufferfish: ocean, summer sun, midday; red snapper: ocean, summer
// rain; salmon: river, fall; walleye and eel: fall rain; squid: ocean, winter nights).
// Pam (since 1.2, wiki page "Pam"): only her regular 0-heart dialogue is used (trailer by the river,
// Penny and her old books, parsnips, stiff legs, a messy yard, regular at the
// Saloon). Nothing from her 9-heart event or the trailer upgrade, nothing from heart events she
// appears in. The bus is only her old job ("Back in the day I drove …"), true whether or not the bus
// runs again, and no line says Penny still lives at home. Drinking stays out of her lines; the Saloon
// is mentioned once, as a warm place. Gus (since 1.2, wiki page "Gus"): Saloon owner and cook (first
// meeting), different dishes every week, Emily's help, cleans glasses from 12:00 (schedule), Saloon
// open 12:00–24:00, cooks for the town festivals (Desert Festival and Festival of Ice lines), fish taco
// as his loved gift with its recipe (Tuna, Tortilla, Red Cabbage, Mayonnaise). Nothing from his 4-heart
// (Pam's tab) or 5-heart (sauce, jukebox) events, no mention of Pam, no prices. Crops named are the
// wiki's season crops (summer: tomato, blueberry, hot pepper; fall: pumpkin, yam, cranberries).
// Marnie (since 1.3): only her regular (0-heart), rain, festival and gift-taste dialogue is used.
// Nothing from her heart events (3-heart goats and Cave Carrot, the recipe letters, the 6-heart
// event), no Lewis at all, no Shane at all (his story stays his), nothing about Jas's family.
// Facts: wiki page "Marnie" — ranch in Cindersap Forest, sells animals and animal supplies, shop 9:00
// to 16:00 except Monday and Tuesday ("most days"), first meeting "You should swing by some time",
// "Feel free to visit us any time", rain greeting "You look like you're soaked... you poor thing!",
// "Animals are so innocent... If I don't look after them, who will?", feed from grass with a scythe
// "or you can buy it from me", the Saloon most nights ("Animals are great company, but I need to
// spend some time with people, too"), cows (Green Rain line), Festival of Ice "I feel bad for all
// the poor, cold animals out there", loves Pumpkin Pie, likes all milk, lives with her niece Jas.
// Wiki page "Jas": "my favorite is the fresh ice cream from our cows' milk" and "Aunt Marnie won't
// let me go out after 6 o'clock" (both regular, 0 hearts). Wiki page "Silo": Robin builds it, it
// stores hay from cut grass, grass stops growing in winter and the animals rely on hay all winter.
// Robin (since 1.3): only her regular (0-heart), rain, seasonal and festival dialogue. Nothing from
// her 6-heart (carpentry secrets, blueprints) or 7-heart (grandma's recipe) events, nothing from
// Sebastian's, Maru's or Demetrius's events, no Pam's house, no Sebastian's room. Facts: wiki page
// "Robin" — town carpenter, family Demetrius, Maru, Sebastian (infobox), "I built our house from the
// ground up", "I love the fresh air of the mountains", "It can get pretty lonely up here in the
// mountains" (visit "even if you aren't shopping"), "daydreaming about some new carpentry projects
// ... How's the woodwork in your cottage holding up?", Demetrius's experiments and the
// "fire-resistant lacquer", rain line "soggy wood isn't a joy to work with" and the rain schedule (at
// the counter all day), summer "provide enough lumber and stone ... And it costs money, too", Egg
// Festival "Spring is a busy time of year", Spirit's Eve "a great time to stockpile wood and stone",
// winter "a perfect time of year to gather wood ... upgrade your house", "Everything looks still
// after a fresh snow", "My parents were bewildered when I told them I wanted to be a carpenter. They
// were pretty old-fashioned." Wiki page "Carpenter's Shop": 24 Mountain Road, builds and upgrades
// farm buildings and the farmhouse, does not work on festival days.
// Evelyn, George and the Wizard (since 1.4): only regular, seasonal, rain, festival and gift-taste
// dialogue and the schedules on their villager pages (wiki revisions: Evelyn 191129, George 193909,
// Wizard 193912). Nothing from heart events — Evelyn's 4-heart cookie event and 7-heart recipe
// letter, George's 3/7-heart recipe letters and 6-heart event, the Wizard's 4-heart basement — and
// nothing from events of other villagers they appear in. No Alex, no Clara, nothing about George's
// legs, health or past work, no clinic visits. Wizard: nothing about the Witch, family, the basement,
// the forest spirits or Junimos, the Community Center or his quests; only what his first-meeting and
// regular lines say (fate, mysteries, elementals, magical field, apprentice) and his gift reactions.
// The quotes below are only the SOURCES of the facts. The lines are new sentences in each villager's
// voice: none shares a run of 6 or more consecutive words (lower case, punctuation removed) with the
// villager's cached wiki page, English or German (checked once with a script for 1.4; the check
// reads the wiki cache, so it is not part of the build). Wiki page "Sweet Pea" (192753): a summer
// forage flower found around Pelican Town and Cindersap Forest.
// Evelyn (wiki page "Evelyn"): in charge of the town's public gardens, the flower beds "for weeks, so
//   don't step on them", "The good Mayor put me in charge" (Gardening); "The flowers seem to love this
//   rain" (Green Rain, year 2+); the rain schedule keeps her in her kitchen all day; cookie shapes:
//   flowers in spring, "coconut wonders shaped like little palm trees! Heehee" in summer, little
//   pumpkins in fall (seasonal lines); 6+ hearts "It's nice of you to take the time to visit George
//   and I. Without young people around, we'd age much faster"; spring "he really likes leeks! You can
//   find them in the mountains this time of year"; "Sweet peas are in bloom right now ... wonderful
//   fragrance", "Be careful out there, dear. You could get sunburnt!", "George is always a little
//   less grumpy in the summer. The warm weather softens his bones ... I've known him for sixty
//   years!" (summer); "I can smell fallen leaves and mushrooms. It reminds me of the forests I used
//   to play in as a girl", "The fall flowers are delicate, so don't go stomping on them!", "I've been
//   putting raisins in George's oatmeal... but he hasn't said a word. I wonder if he even notices",
//   "With every year I appreciate the seasons more and more. For young people it's easy to let them
//   slip by" (fall); "covered in snow. I still like to check up on them now and then", "Be careful
//   you don't slip on the ice", "wear a thicker jacket", "This weather isn't good for my joints",
//   "You should make some hot soup to stay warm" (winter); "You've made an old lady very happy"
//   (loved gift); Festival of Ice: George "pelted me with a snowball in this very festival. He was a
//   gentleman back then, and came over to see if I was okay".
// George (wiki page "George"): Egg Festival "Evelyn made eggs and leeks for breakfast, so I'm in a
//   good mood"; rain "It's awful cold, isn't it? What a rotten day", the rain schedule (at home,
//   watching TV), "I can't talk right now ... My favorite program is on"; 6+ hearts "I'm surprised
//   you want to be friends with an old-timer like me" and "Wanna watch the TV with me?"; "Hmmph...
//   Looks like another gloomy day"; "So you're a farmer, huh? At least it's honest work"; 4+ hearts
//   "My grand-pap was a farmer. It's a respectable profession. If I wasn't so darned old I'd come to
//   your farm and show you a thing or two"; loves Fried Mushroom and Leek; Winter 1 "When you're
//   young the cold doesn't bite as hard", "Aren't you cold? They don't make sweaters like they used
//   to"; Festival of Ice "Wife dragged me out into the cold for this?"; Night Market "I'm just here
//   for the free coffee", his and Evelyn's Winter 17 schedules (both go to the Night Market).
//   Evelyn's page: "George is always a little less grumpy in the summer" and "George spends the whole
//   day in front of that darned television set. I wish he'd go outside more." Wiki page "Maru": "a
//   rainy day is still the best tool for watering crops".
// Wizard (wiki page "Wizard"): lives in the Wizard's Tower in Cindersap Forest and does not leave it
//   except for some festivals; first meeting "I have predicted your arrival a long time ago, young
//   [Player]. However, your fate is ultimately in your own hands"; regular "I have seen many things
//   about your future ... there could be grave consequences", "If you have nothing important to tell
//   me, leave me be. I have much work to do", "It takes years of study to understand the language of
//   the elementals. To actually speak their language requires a lifetime", "There are many mysteries
//   around us. You must be patient if you wish to discover them", "I believe the townsfolk are afraid
//   of me ... it is human to be afraid of the unknown", "you are standing above a potent magical
//   field. I built my hut right here on purpose", "I sometimes observe the local villagers in secret.
//   I am hoping to find an apprentice. Some day I will leave this mortal plane, but my arcane pursuits
//   must continue"; rain "Stormy days are the only time I can commune with certain elementals. I
//   don't expect you to understand"; Festival of Ice "Sneaking off to visit my weird tower? You're
//   odd for a mundane"; Feast of the Winter Star "Ah, the mysterious Winter Star. One of the reasons
//   I chose this valley as the location for my... research"; gift reactions: loved "imbued with
//   potent arcane energies", liked "some very interesting properties", disliked "I'll cast it into
//   the flames and see what happens", hated "utterly mundane"; loves Purple Mushroom (The Mines),
//   dislikes Common Mushroom. Wiki page "Common Mushroom": foraged throughout the valley in fall.
// Timed words avoid festival dates that can fall inside a topic's 7 days.

import { LINES_DE } from './de.js';

export const SEASONS = ['spring', 'summer', 'fall', 'winter'];

// kind → hearts needed, topic length in days, day-of-month window, extra condition per season
export const KINDS = {
  weather: { hearts: 2, days: 2, window: [1, 27], weather: s => (s === 'winter' ? 'Snow' : 'Rain Storm') },
  met: { hearts: 0, days: 7, window: [1, 21] },
  friend: { hearts: 6, days: 7, window: [8, 21] }
};

// npc → season → kind → line (English, character voice)
export const LINES = {
  Linus: {
    spring: {
      met: 'The birds came back to the mountain this week. They never ask anyone if they may live here.#$b#I like that about them.',
      weather: "Spring rain is a gift. The creek gets loud, the mushrooms wake up, and nobody walks up the path to bother me.#$b#...You don't bother me, @. Not anymore.$h",
      friend: "I used to tell myself I'd move on from the valley by summer. That was a few summers ago.#$b#Some places hold on to you. I think the mountain decided to keep me.$h"
    },
    summer: {
      met: 'Summer nights are short, but the stars feel close. I sleep with the tent flap open.',
      weather: "When a summer storm rolls over the lake, I sit in my tent and count between the lightning and the thunder.#$b#It's an old habit. It keeps the mind calm.",
      friend: "There's a patch of wild grapes up here that no one else knows about.#$b#I'd tell you where... but some things are better found than given.$h"
    },
    fall: {
      met: 'The leaves are turning. Everything in nature lets go of something in the fall.#$b#People could learn from that.',
      weather: "Mushrooms love this kind of weather. So do I, though I'd never say it in town.#$b#They already think I'm strange.",
      friend: "I've started gathering firewood for the winter. You don't have to help.#$b#...But I wouldn't say no to the company.$h"
    },
    winter: {
      met: "Winter tests everyone who lives out here. I've passed the test before.#$b#I'll pass it again.",
      weather: 'Snow muffles the whole mountain. On days like this I can hear my own heartbeat.',
      friend: 'Winter used to be the loneliest season. Now someone stops by my tent from time to time.#$b#It makes the cold a lot easier.$h'
    }
  },
  Willy: {
    spring: {
      met: 'Ahoy, @! Spring tides bring the anchovies and sardines close to shore.#$b#Good time for a young angler to practice.',
      weather: "Hear that rain on the roof? That's the river callin'.#$b#Catfish get bold on days like this, ${lad^lass}$. Slippery devils, but worth the fight.$h",
      friend: "Me pappy used to say the sea keeps a ledger. Treat her fair, and she'll settle up with ya someday.#$b#Took me forty years to understand what he meant.$u"
    },
    summer: {
      met: 'Summer heat brings the pufferfish out around midday.#$b#Mind the sun, and mind your line.',
      weather: "Warm summer rain on the ocean... the red snappers like it.#$b#So do I, if I'm honest. Keeps the beach nice and quiet.",
      friend: "Some evenings I sit at the end of the dock with me pipe and watch the sun go down.#$b#If ya ever want to join me, there's room on the planks.$u"
    },
    fall: {
      met: "Salmon are runnin' up the river this time o' year. Big, strong fish.#$b#Bring a good rod.",
      weather: "Fall rain stirs up the eels and the walleye. Fishin' in the wet ain't for everyone...#$b#But you're not everyone, are ya?$h",
      friend: 'When you first walked into me shop, I figured you might last a season.#$b#Glad I was wrong.$h'
    },
    winter: {
      met: "Cold water slows the fish down, but the squid come up at night.#$b#Winter's got its own rewards.",
      weather: "Snow fallin' on the water... prettiest sight on the whole coast.#$b#Cold enough to freeze your whiskers, mind.",
      friend: "Winters used to be long and quiet in the shop. Now there's you, comin' round and askin' about bait and weather.#$b#Makes an old sailor feel useful.$h"
    }
  },
  // since 1.2
  Pam: {
    spring: {
      met: "Spring means parsnips. Bet you've got a whole field of 'em started already, huh?#$b#Just sayin'. A gal could use some decent grub now and then.",
      weather: "Rain on the trailer roof all night, like somebody playin' the drums. Can't sleep a wink through it.#$b#Stayin' dry, kid? Don't go catchin' a cold out there.",
      friend: "Penny's always got her nose in some old book. That girl's got brains I never had.#$b#Don't tell her I said this, but... I'm real proud of her.$h"
    },
    summer: {
      met: "Hot one today, kid. Hot enough to fry an egg on the road.#$b#Drink some water and keep your hat on.",
      weather: "Storm's rollin' in. Back in the day I drove through weather like this, wipers goin' full tilt, radio up loud.#$b#You learn to respect a wet road, kid.",
      friend: "You know what I like about you, kid? You don't look at me like I'm some old wreck.#$b#Most folks walk right past the trailer. You stop and talk.$h"
    },
    fall: {
      met: "Leaves are fallin' all over my yard again. Somebody's gonna complain, I just know it.#$b#Let 'em. I ain't rakin' today.",
      weather: "Cold rain gets right into these stiff old legs. Takes me twice as long just to get across town.#$b#Don't you laugh, kid. You'll creak too someday.$h",
      friend: "You keep showin' up, kid. Rain or shine, busy or not.#$b#Folks don't do that much anymore. Guess I'm doin' alright, havin' a friend like you.$h"
    },
    winter: {
      met: "Cold enough to freeze the whiskers off a cat. My skin's gone dry as old paper.#$b#The Saloon's warm, though. Gus always keeps a stool at the bar for me.",
      weather: "Snow day, huh? Penny's gonna be bundled up like a sack of potatoes. Got that from me.#$b#Keep your boots dry, kid. Wet feet'll put you in bed for a week.",
      friend: "Penny says I've been in a better mood lately. Can't imagine why.#$b#Don't let it go to your head, kid. ...But I reckon you've got somethin' to do with it.$h"
    }
  },
  // since 1.2
  Gus: {
    spring: {
      met: 'Welcome to spring, @! The first fresh greens are coming in, and my kitchen has never been happier.#$b#Stop by the Saloon sometime. There\'s always something new on the menu.',
      weather: "Rainy days are quiet at the Saloon. I polish glasses and dream up new recipes.#$b#Come by after noon and dry off, @. The kettle's on and the kitchen's warm.$h",
      friend: "I've cooked for this town for a lot of years, @. Birthdays, festivals, quiet weeknights...#$b#It's nice to have someone stop by just to see how the cook is doing.$h"
    },
    summer: {
      met: "Summer's here! Tomatoes, blueberries, hot peppers... a cook could weep with joy.#$b#If you grow any of those, I'd love to see them sometime.",
      weather: 'Hear that thunder? Folks come in from the storm dripping wet, and the whole Saloon smells of rain and something good from the oven.#$b#That\'s my favorite kind of evening, @.$h',
      friend: "Between you and me, @, nothing beats a good fish taco. Fresh tuna, crisp red cabbage, a dab of mayo...#$b#Bring me one sometime and I'll tell you if it passes the Gus test.$h"
    },
    fall: {
      met: "Fall is the cook's season, @. Pumpkins, yams, cranberries... I hardly know where to start.#$b#The Saloon's open from noon till midnight if you need warming up.",
      weather: "Cold rain and a hot bowl of pumpkin soup. If that isn't happiness, I don't know what is.#$b#Don't stay out in the wet too long, @. Even farmers need a warm meal.",
      friend: "Some nights after closing, I sit in the empty Saloon with a cup of tea and think about who came in that day.#$b#Lately, yours is one of the faces I'm gladdest to remember.$h"
    },
    winter: {
      met: "Brr! Winter's here. Good thing a kitchen is the warmest room in any house.#$b#Come in out of the cold sometime, @. The coffee's always hot.",
      weather: 'Snow piling up outside, and inside everyone squeezes a little closer to the bar.#$b#I keep a big pot of stew going and a mop by the door. Snowy boots, you know.$h',
      friend: "The Feast of the Winter Star is the busiest time of year in my kitchen. I plan the menu weeks ahead.#$b#Some years I wonder why I bother. Then I see the whole town eating together, and I remember.$h"
    }
  },
  // since 1.3
  Marnie: {
    spring: {
      met: "Spring at last! The grass is coming in green, and my animals can hardly wait to get at it.#$b#If you'd like some animals of your own, swing by the ranch. I'm at the counter most days from nine to four.",
      weather: "Look at you, soaked to the bone... you poor thing!#$b#Come dry off at the ranch whenever you like, @. The animals won't mind a little company.$h",
      friend: "You know, @, you're just the kind of neighbor I hoped would move onto that old farm.#$b#Friendly, hardworking, and you always stop to say hello. That means a lot out here in the forest.$h"
    },
    summer: {
      met: "Jas says the best thing about living on a farm is fresh ice cream from our cows' milk.#$b#I can't argue with that. A cold treat on a hot day never hurt anybody.$h",
      weather: "A storm like this makes me worry about every animal in the valley. Somebody has to watch out for them, and it might as well be me.#$b#If you have animals, make sure they're safe inside tonight, @.",
      friend: "Most evenings I head to the Saloon. I love my animals, but a body needs folks to talk to as well.#$b#Lately you're one of the people I'm happiest to see, @.$h"
    },
    fall: {
      met: "Fall's here! Time to cut grass and fill the silo. The animals eat hay all winter long.#$b#No silo yet? Robin can build you one. Or buy your hay from me, of course.",
      weather: "Cold rain, a warm kitchen and a slice of pumpkin pie... that's all I need.#$b#Well, that and healthy animals. Stay dry, @!$h",
      friend: "It's always nice when you stop by, @. Even the animals seem calmer.#$b#They can always tell who's kind to them. So can I.$h"
    },
    winter: {
      met: "Brr! This time of year my heart goes out to every creature stuck out in the cold.#$b#Whatever lives on your farm, @, a warm place and a kind word go a long way.",
      weather: "Snow day! Jas would play outside until dark if I let her. But the rule is home by six, snow or no snow.#$b#Stay warm, @. A cup of hot milk does wonders on a day like this.$h",
      friend: "Winter nights are long and quiet out here in the forest. I can hear every animal shuffle in the barn.#$b#It's nice when you drop by, @. Makes the long nights feel shorter.$h"
    }
  },
  // since 1.3
  Robin: {
    spring: {
      met: "Spring keeps me on my toes! Fresh mountain air and plenty of work for a carpenter.#$b#Need a coop, a barn or a bigger house? You know where to find me: 24 Mountain Road!$h",
      weather: "Rain again! I'll spend the day at the counter sorting lumber. Soggy wood is no joy to work with.#$b#Come up and dry off if you're passing by, @. The mountain air smells wonderful after a shower.$h",
      friend: "Have I told you this whole house is my own work? Every beam, every board, start to finish.#$b#Making something that lasts... there's no better feeling. I bet you know it from your farm, @.$h"
    },
    summer: {
      met: "Summer sun dries the lumber nicely. Perfect weather for a building project!#$b#Want something on your farm upgraded? Bring enough wood and stone, plus the fee, and I'll handle the rest.$h",
      weather: "Hear that thunder? Doesn't worry me. Between storms and my husband's experiments, I built this house to take a beating.#$b#Fire-resistant lacquer on every rafter. Best decision I ever made!$h",
      friend: "Living way up on the mountain, I can go days without much company. That's why I'm always glad when you drop by, @.#$b#Not to buy anything, just to chat. That's what friends do, right?$h"
    },
    fall: {
      met: "Fall's here! Now's the moment to pile up wood and stone, before the snow comes.#$b#Planning a building? Order early. I don't work on festival days!$h",
      weather: "Rainy days are for daydreaming about new carpentry projects. A new chair, maybe... or a whole set of furniture for the shop.#$b#How's the woodwork in your house holding up, @? Any creaky boards?",
      friend: "Fall always makes me thankful. Demetrius, Maru, Sebastian... a full house, and a job I love.#$b#And good friends like you, @. Don't you forget it.$h"
    },
    winter: {
      met: "Winter's ideal for gathering wood, if you ask me. All that chopping keeps you warm, too!#$b#Collect enough and you might upgrade your house before spring.$h",
      weather: "Everything looks so still after a fresh snow. I love this view from up on the mountain.#$b#Watch your step on the mountain path, @. Snow hides every root and rock.",
      friend: "When I said I wanted to build things for a living, my folks just stared at me. They had very traditional ideas.#$b#I'm glad I didn't listen. I can't imagine doing anything else, @.$h"
    }
  },
  // since 1.4
  Evelyn: {
    spring: {
      met: "Good morning, dear! The flower beds in town are mine to look after, and spring is when they need me most.#$b#If you see me on my knees in the dirt, don't worry. I'm only planting!$h",
      weather: "Such a soft spring rain. My flowers will be drinking it up all morning.#$b#I'm staying in with a bowl of cookie dough today. This time of year I cut them out as little flowers.$h",
      friend: "George and I don't get many young visitors, dear. Every time you come by, the house feels a little livelier.#$b#A tip, just between us: bring him a leek from the mountains. He'll grumble, but he'll be pleased.$h"
    },
    summer: {
      met: "The sweet peas are out, dear. If you find some on your walks, take a moment to smell them.#$b#And put a hat on in this sun. Farm work and sunburns don't mix.",
      weather: "Rain on a summer day! Well, that settles it. I'm baking.#$b#Coconut cookies this time, cut out like tiny palm trees. A little taste of the beach, even indoors.$h",
      friend: "Between you and me, dear, the warm months put George in a gentler mood. Watch him closely and you'll see.#$b#Sixty years together teaches you to read a man like a book.$h"
    },
    fall: {
      met: "Autumn air, dear! Damp leaves and mushrooms... one sniff and I'm a little girl running through the woods again.#$b#Mind the flower beds in town, please. The fall blooms bruise so easily.$h",
      weather: "A wet fall day, so I'm baking. Pumpkin-shaped cookies, to suit the season.#$b#I've also been sneaking raisins into George's breakfast. Not one word from him yet. Is he even tasting it?$s",
      friend: 'At my age, every season feels like a gift, dear. I try not to waste a single one.#$b#Spending a few of those days chatting with you is no waste at all.$h'
    },
    winter: {
      met: 'My poor gardens are asleep under the snow. I still go out to peek at them, though.#$b#Watch your footing on those icy paths, dear, and bundle up properly!',
      weather: "More snow, dear! This cold goes right into my old joints.#$b#Promise me you'll have something hot to eat today. A bowl of soup does wonders.$h",
      friend: "Shall I tell you a secret, dear? The first time George noticed me, it was with a snowball. At the Festival of Ice, of all places!#$b#He hurried over to make sure I wasn't hurt. Such manners! Heehee.$h"
    }
  },
  // since 1.4
  George: {
    spring: {
      met: "Evelyn cooked leeks with my eggs this morning. Best breakfast a man could ask for.#$b#So I'm in a decent mood. Enjoy it while it lasts.",
      weather: "Rain. Hmmph. Cold and wet, the whole miserable lot of it.#$b#I'll be in front of the TV. My show starts any minute, so say what you came to say.",
      friend: "Young folks don't usually bother with an old grouch like me. You're a strange one.#$b#Hmmph. Can't say I mind.$h"
    },
    summer: {
      met: 'Evelyn claims the summer heat makes me friendlier.#$b#Hmmph. That woman thinks she knows everything. ...She usually does.',
      weather: "Gray skies in the middle of summer. Hmmph. Figures.#$b#At least your fields won't need the watering can today. Somebody ought to be happy about it.",
      friend: "Pull up a chair, @. There's room in front of the TV.#$b#Evelyn keeps telling me to get out of the house more. I will. After this episode.$h"
    },
    fall: {
      met: "Farming, eh? Fall's when you find out if the work paid off. Good, honest living.#$b#Hmmph. Go on, you've got a harvest to bring in.",
      weather: "Wet, cold and gray. Hmmph. Days like this call for a plate of fried mushrooms.#$b#I'm not hinting. Just saying.",
      friend: "My grandfather farmed, you know. Good, solid people, farmers.#$b#A few decades younger, and I'd be out on your field this fall telling you what you're doing wrong.$h"
    },
    winter: {
      met: "Brr. The cold gets into you deeper every year, I'm telling you.#$b#And sweaters these days? Thin as paper. Not like the old wool ones.",
      weather: "Snow again. Hmmph. Bet Evelyn's already planning some reason to haul me outside.#$b#Not today. Today it's me, a blanket and the television.",
      friend: "Every winter Evelyn and I make the trip to the Night Market. She enjoys it. Me, I like that the coffee costs nothing.#$b#...And maybe running into you there, @. Don't tell her I said so.$h"
    }
  },
  // since 1.4; the Wizard's only other portrait is "Surprised" (wiki page "Wizard"), so his lines keep the neutral face
  Wizard: {
    spring: {
      met: 'Ah, young @. The forest wakes again, as it does each spring.#$b#Not every secret of this valley reveals itself at once. Patience will serve you well.',
      weather: 'Rain... and if fortune favors me, thunder by evening. Some elementals will only answer me when a storm is overhead.#$b#Do not ask me to explain. I must prepare.',
      friend: 'I keep a quiet eye on the people of this valley, young @. Someone must carry on my work one day.#$b#I will not be here forever, after all. Knowledge without an heir is knowledge lost.'
    },
    summer: {
      met: 'Summer warms the forest, young @. Beneath your feet lies a field of great magical power.#$b#That is why my tower stands exactly here. Now, unless your business is urgent, I have work to do.',
      weather: 'Rain drums on the tower, and the forest is loud today. A fine day for my studies.#$b#The tongue of the elementals cannot be learned in a season, young @. I have given my whole life to it, and I am not finished.',
      friend: 'Your future is not hidden from me, young @. But sharing what I have seen could do real harm.#$b#So I keep my silence. The choices are yours to make.'
    },
    fall: {
      met: 'The forest is full of mushrooms this time of year. Common ones, mostly. Mundane.#$b#A purple mushroom from the mines, now... that I could put to use.',
      weather: 'Rain again, young @. A good day to feed the fire with the duller gifts I have received.#$b#If you bring me something, let it hum with arcane power. Ordinary things bore me.',
      friend: 'I foresaw that you would come to this valley, young @. I did not foresee how often you would knock on my door.#$b#It is... not unwelcome.'
    },
    winter: {
      met: 'The Winter Star has always fascinated me, young @. It is part of why I settled in this valley at all.#$b#But that is all I will say. My work awaits.',
      weather: 'Through all this snow, just to reach my tower? Most people without magic would never bother, young @.#$b#You are a curious one. I mean that kindly.',
      friend: 'The people in town keep their distance from me. What they cannot explain makes them nervous.#$b#You, young @, never seemed to mind. In this cold, quiet season, your visits are welcome.'
    }
  }
};

const cap = s => s[0].toUpperCase() + s.slice(1);
const range = ([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
// "!DAY_OF_MONTH 22 … 28" for windows that start on day 1, else the window's days themselves.
const windowQuery = w => (w[0] === 1 ? `!DAY_OF_MONTH ${range([w[1] + 1, 28]).join(' ')}` : `DAY_OF_MONTH ${range(w).join(' ')}`);

export function checkLine(npc, key, text) {
  if (!text.trim()) throw new Error(`${npc} ${key}: empty line`);
  if (/[{}]{2}/.test(text)) throw new Error(`${npc} ${key}: braces would be read as a Content Patcher token`);
  for (const [, portrait] of text.matchAll(/\$([a-z0-9]+)(?=$|#)/g)) if (!['h', 's', 'u', '0', '1', '2', '3', 'b'].includes(portrait)) throw new Error(`${npc} ${key}: portrait $${portrait} is not one of the four standard ones`);
  for (const box of text.split('#$b#')) if (box.replace(/\$\w$/, '').length > 160) throw new Error(`${npc} ${key}: a dialogue box is too long`);
  if ((text.match(/\$\{/g) || []).length !== (text.match(/\}\$/g) || []).length) throw new Error(`${npc} ${key}: unbalanced \${…}$ gender switch`);
}

export default async function ({ npcs }) {
  const changes = [];
  const triggers = {};
  const i18n = {};
  const de = {};
  for (const [npc, seasons] of Object.entries(LINES)) {
    if (!npcs.npcs[npc]) throw new Error(`${npc} is not in npcs.json`);
    const entries = {};
    for (const season of SEASONS) {
      if (Object.keys(seasons[season] || {}).sort().join() !== Object.keys(KINDS).sort().join()) throw new Error(`${npc} ${season}: needs one line for each of ${Object.keys(KINDS).join(', ')}`);
    }
    // Weather lines first: on a morning where two topics start, the game finds the weather one first.
    for (const [kind, k] of Object.entries(KINDS)) {
      for (const season of SEASONS) {
        const text = seasons[season][kind];
        const id = `{{ModId}}_${npc}_${cap(season)}${cap(kind)}`;
        const key = `${npc.toLowerCase()}.${season}.${kind}`;
        checkLine(npc, key, text);
        if (id.includes('_memory_')) throw new Error(`${id}: "_memory_" is reserved for topic memory`);
        i18n[key] = text;
        // German (since 1.1): same markers, same box limits as the English line.
        const deText = LINES_DE[npc]?.[season]?.[kind];
        if (!deText) throw new Error(`${npc} ${key}: German line missing in de.js`);
        checkLine(npc, `${key} (de)`, deText);
        const markers = t => (t.match(/#\$b#|\$[hsu]$|\$\{|@/g) || []).sort().join(' ');
        if (markers(deText) !== markers(text)) throw new Error(`${npc} ${key}: the German line has other markers than the English one`);
        de[key] = deText;
        entries[id] = `{{i18n:${key}}}`;
        if (k.window[1] + k.days - 1 > 28) throw new Error(`${id}: the topic would outlast the season`);
        const condition = [
          `SEASON ${season}`,
          windowQuery(k.window),
          ...(k.weather ? [`WEATHER Town ${k.weather(season)}`] : []),
          `PLAYER_HAS_MET Current ${npc}`,
          ...(k.hearts ? [`PLAYER_HEARTS Current ${npc} ${k.hearts}`] : [])
        ].join(', ');
        triggers[id] = { Id: id, Trigger: 'DayStarted', Condition: condition, Actions: [`AddConversationTopic ${id} ${k.days}`] };
      }
    }
    changes.push({ LogName: `${npc}'s new lines`, Action: 'EditData', Target: `Characters/Dialogue/${npc}`, Entries: entries });
  }
  // the triggers in KINDS order across all villagers
  const ordered = {};
  for (const kind of Object.keys(KINDS)) for (const [id, t] of Object.entries(triggers)) if (id.endsWith(cap(kind))) ordered[id] = t;
  changes.push({ LogName: 'Start the topics', Action: 'EditData', Target: 'Data/TriggerActions', Entries: ordered });
  return {
    'content.json': { Format: '2.9.0', Changes: changes },
    'i18n/default.json': i18n,
    'i18n/de.json': de
  };
}
