// More to Say: new dialogue lines for Linus and Willy, one per season for each of three moods (a
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
//   a matching dialogue key)". Only Linus and Willy have these keys, so no one else reacts.
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
//   surprised; Willy: happy, concerned, smoking — both villager pages, "Portraits"), @ = player name,
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
  // the triggers in KINDS order across both villagers
  const ordered = {};
  for (const kind of Object.keys(KINDS)) for (const [id, t] of Object.entries(triggers)) if (id.endsWith(cap(kind))) ordered[id] = t;
  changes.push({ LogName: 'Start the topics', Action: 'EditData', Target: 'Data/TriggerActions', Entries: ordered });
  return {
    'content.json': { Format: '2.9.0', Changes: changes },
    'i18n/default.json': i18n,
    'i18n/de.json': de
  };
}
