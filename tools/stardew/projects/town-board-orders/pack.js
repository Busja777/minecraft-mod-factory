// Town Board Orders: six new special orders for the town's Special Orders board (installed on
// fall 2 of year 1, new orders every Monday, https://stardewvalleywiki.com/Quests), all about farm
// life: cheese, preserves, eggs, milk, flowers and forage, each from a villager it suits, with a
// fair duration and a fair reward (money and friendship, no items).
//
// How it works (Stardew Valley 1.6, documented on the wiki, not run in the game):
// - Data/SpecialOrders: one entry per order, keyed by its ID. Field shapes copied from the raw
//   data on the special orders page (Gus, Pierre, Pam, Robin, Emily, Lewis entries) and the
//   "Basic Fields" table: https://stardewvalleywiki.com/Modding:Special_orders#Format
//   - Name, Text, objective Text: "in brackets, referring to a string in
//     Strings/SpecialOrderStrings" (Basic Fields, Objectives). The pack adds those strings itself
//     (EditData on Strings/SpecialOrderStrings) and fills them from i18n, the same way the game's
//     own orders use "[Gus_Name]", "[Gus_Text]", "[Gus_Objective_0_Text]".
//   - Requester: "The name of the NPC the order is for."
//   - Duration: "OneDay, ThreeDays, Week, TwoWeeks, or Month".
//   - Repeatable: "Either true or false"; 1.6 made Duration and Repeatable "strongly-typed and
//     case-insensitive" (https://stardewvalleywiki.com/Modding:Migrate_to_Stardew_Valley_1.6#Quests),
//     so Repeatable is a JSON boolean here, not the "True"/"False" text of the 1.5.1 dump.
//   - OrderType "": "blank (for the town board), Qi (for Qi's board) or DesertFestivalMarlon".
//   - RequiredTags: "season_<season>" with "!" to invert (Evelyn's flowers: "!season_winter",
//     shape of Lewis' "!season_winter").
//   - Condition: "A game state query which determines whether this order can appear", added in 1.6
//     (Migrate to 1.6, "Other item changes"). Used so an order only shows up once the farm makes
//     the goods: PLAYER_STAT Host <stat> 1 with the documented stats CheeseMade, GoatCheeseMade,
//     PreservesMade, ChickenEggsLayed, DuckEggsLayed, CowMilkProduced, GoatMilkProduced
//     (https://stardewvalleywiki.com/Modding:Stats; the farm-animal stats are "primarily tracked
//     for the main player", hence Host) and ANY "<query>" "<query>" for "either of them"
//     (https://stardewvalleywiki.com/Modding:Game_state_queries#Meta, #Player_info_.26_progress).
//   - SpecialRule "", ItemToRemoveOnEnd null, MailToRemoveOnEnd null, RandomizedElements null:
//     the empty values of the vanilla entries.
//   - Objectives: "Deliver" (give matching items to TargetName, does not count towards the gift
//     limit) and "Ship" (ship matching items through the shipping bin), each with Type, Text,
//     RequiredCount (text, like "24") and Data { AcceptedContextTags[, TargetName] } as in the
//     Emily (Deliver) and Lewis (Ship) entries.
//   - AcceptedContextTags ("A/B" = at least one of them): item_cheese/item_goat_cheese (item_<name>,
//     added automatically), jelly_item/pickle_item (added for preserves jar products),
//     egg_item (vanilla Gus order), category_milk and category_flowers (Modding:Items#Categories),
//     forage_item (vanilla Pierre order uses !forage_item).
//     https://stardewvalleywiki.com/Modding:Context_tags
//   - Rewards: "Money" { Amount } and "Friendship" {} ("by default 250 points (1 heart) and for the
//     requesting NPC"), shapes from the Pam and Robin entries. No item rewards.
// - Content Patcher only applies two EditData patches (dictionary entries, action-editdata.md);
//   {{ModId}} keeps every order and string ID unique (tokens.md#ModId), all text comes from i18n
//   (translations.md).
// - No order uses a drop box, so none can block or be blocked by a vanilla order's drop box.
// - 1.1, German: i18n/de.json has the title, note and objective line of every order in German (texts
//   and the German names with their wiki sources in de.js). Content Patcher picks the file for the
//   game language and falls back to default.json (author-guide/translations.md); the strings in
//   Strings/SpecialOrderStrings are i18n tokens, so they follow the game language too. Same orders,
//   same counts and rewards; the English texts stay as in 1.0.

import { DE } from './de.js';

// Documented values (Modding:Special_orders#Format).
export const DURATIONS = ['OneDay', 'ThreeDays', 'Week', 'TwoWeeks', 'Month'];
export const OBJECTIVES = ['Collect', 'Deliver', 'Fish', 'Gift', 'JKScore', 'ReachMineFloor', 'Ship', 'Donate', 'Slay'];
export const STATS = ['CheeseMade', 'GoatCheeseMade', 'PreservesMade', 'ChickenEggsLayed', 'DuckEggsLayed', 'CowMilkProduced', 'GoatMilkProduced'];
// Context tags this pack may use, each documented on Modding:Context_tags / Modding:Items or used by
// a vanilla order on Modding:Special_orders.
export const TAGS = ['item_cheese', 'item_goat_cheese', 'jelly_item', 'pickle_item', 'egg_item', 'category_milk', 'category_flowers', 'forage_item'];

const stat = name => `PLAYER_STAT Host ${name} 1`;
const anyOf = (...queries) => `ANY ${queries.map(q => `"${q}"`).join(' ')}`;

// key → order. `objective` is [Type, count, tags]; Deliver goes to the requester.
// Texts: name (board title), text (the note), goal (objective line, contains the count).
export const ORDERS = {
  Cheese: {
    requester: 'Gus', duration: 'TwoWeeks', money: 3000,
    objective: ['Deliver', 10, 'item_cheese/item_goat_cheese'],
    condition: anyOf(stat('CheeseMade'), stat('GoatCheeseMade')),
    name: "Saloon Cheese Board",
    text: "I want to put a proper cheese board on the menu for Friday nights. Folks keep asking for something made right here in the valley, and nothing beats farm cheese with a cold drink. Could you bring me 10 wheels? Cow or goat, both are welcome!",
    goal: "Bring Gus 10 cheese or goat cheese",
  },
  Preserves: {
    requester: 'Pierre', duration: 'TwoWeeks', money: 2500,
    objective: ['Deliver', 12, 'jelly_item/pickle_item'],
    condition: stat('PreservesMade'),
    name: "Homemade Shelf",
    text: "Customers keep asking for homemade preserves, and I have an empty shelf by the window that would be perfect for them. Bring me 12 jars of jelly or pickles from your farm and I'll pay you a good price. Local goods sell themselves!",
    goal: "Bring Pierre 12 jars of jelly or pickles",
  },
  Eggs: {
    requester: 'Shane', duration: 'TwoWeeks', money: 1500,
    objective: ['Ship', 40, 'egg_item'],
    condition: anyOf(stat('ChickenEggsLayed'), stat('DuckEggsLayed')),
    name: "Happy Hens",
    text: "Okay, so... I like chickens. A lot. Knowing a farm around here keeps happy birds would honestly make my week. Ship 40 eggs and prove your coop is doing well. That's all. Don't make it a big deal.",
    goal: "Ship 40 eggs",
  },
  Milk: {
    requester: 'Jodi', duration: 'TwoWeeks', money: 1200,
    objective: ['Deliver', 8, 'category_milk'],
    condition: anyOf(stat('CowMilkProduced'), stat('GoatMilkProduced')),
    name: "Milk for Growing Boys",
    text: "Sam and Vincent go through milk faster than I can carry it home! Fresh milk from a farm would be such a treat for them. Could you bring me 8 bottles? Cow or goat milk is fine.",
    goal: "Bring Jodi 8 bottles of milk",
  },
  Flowers: {
    requester: 'Evelyn', duration: 'TwoWeeks', money: 1500, tags: '!season_winter',
    objective: ['Deliver', 15, 'category_flowers'],
    name: "Flowers for the Square",
    text: "The flower beds around town are looking a little bare, dear. If you could bring me 15 flowers from your fields, I'd plant them where the whole town can enjoy them. George says it's a waste of time. It isn't.",
    goal: "Bring Evelyn 15 flowers",
  },
  Forage: {
    requester: 'Leah', duration: 'Week', money: 1000,
    objective: ['Deliver', 15, 'forage_item'],
    name: "Gifts of the Forest",
    text: "I'm painting a still life of everything the valley gives us for free. Berries, mushrooms, roots, wild greens... anything you find out there. Could you bring me 15 foraged things? I'll cook whatever survives the painting.",
    goal: "Bring Leah 15 foraged items",
  }
};

const QUERY_NAMES = ['ANY', 'PLAYER_STAT'];

export function checkOrder(key, o, npcs) {
  const where = `order ${key}`;
  if (!/^[A-Z][A-Za-z]+$/.test(key)) throw new Error(`${where}: key must be one word`);
  if (!npcs[o.requester]) throw new Error(`${where}: unknown villager ${o.requester}`);
  if (!DURATIONS.includes(o.duration)) throw new Error(`${where}: duration ${o.duration}`);
  const [type, count, tags] = o.objective;
  if (!['Deliver', 'Ship'].includes(type) || !OBJECTIVES.includes(type)) throw new Error(`${where}: objective ${type}`);
  if (!(Number.isInteger(count) && count > 0 && count <= 100)) throw new Error(`${where}: count ${count}`);
  for (const t of tags.split(/[,/]/).map(s => s.trim().replace(/^!/, ''))) if (!TAGS.includes(t)) throw new Error(`${where}: tag ${t} is not in the documented list`);
  if (!(Number.isInteger(o.money) && o.money >= 500 && o.money <= 3000)) throw new Error(`${where}: money ${o.money} (fair: 500 to 3000)`);
  if (o.tags && !/^!?season_(spring|summer|fall|winter)$/.test(o.tags)) throw new Error(`${where}: RequiredTags ${o.tags}`);
  if (o.condition) {
    const queries = o.condition.startsWith('ANY ') ? [...o.condition.slice(4).matchAll(/"([^"]+)"/g)].map(m => m[1]) : [o.condition];
    for (const q of queries) {
      const [name, player, statKey, min] = q.split(' ');
      if (!QUERY_NAMES.includes(name) || player !== 'Host' || !STATS.includes(statKey) || min !== '1') throw new Error(`${where}: condition "${q}"`);
    }
  }
  for (const f of ['name', 'text', 'goal']) {
    if (!o[f] || /[[\]{}^@#%$|]/.test(o[f])) throw new Error(`${where}: ${f} is empty or has command characters`);
  }
  if (o.name.length > 30) throw new Error(`${where}: name too long for the board`);
  if (!o.text.includes(String(count)) || !o.goal.includes(String(count))) throw new Error(`${where}: text and goal must name ${count}`);
  if (type === 'Deliver' && !o.goal.includes(o.requester)) throw new Error(`${where}: goal must name ${o.requester}`);
}

// The German texts get the same checks as the English ones (checkOrder), in the Du-form.
export function checkOrderDe(key, o, d) {
  const where = `order ${key} (de.js)`;
  if (!d) throw new Error(`${where}: German texts missing`);
  if (Object.keys(d).sort().join() !== 'goal,name,text') throw new Error(`${where}: needs exactly name, text and goal`);
  for (const f of ['name', 'text', 'goal']) {
    if (!d[f] || /[[\]{}^@#%$|¦]/.test(d[f])) throw new Error(`${where}: ${f} is empty or has command characters`);
    if (/\b(Sie|Ihnen|Ihr|Ihre)\b/.test(d[f])) throw new Error(`${where}: ${f} must use the Du-form`);
  }
  if (d.name.length > 30) throw new Error(`${where}: name too long for the board`);
  const [type, count] = o.objective;
  if (!d.text.includes(String(count)) || !d.goal.includes(String(count))) throw new Error(`${where}: text and goal must name ${count}`);
  if (type === 'Deliver' && !d.goal.includes(o.requester)) throw new Error(`${where}: goal must name ${o.requester}`);
}

export default async function ({ npcs }) {
  const strings = {};
  const orders = {};
  const i18n = {};
  const de = {};
  const requesters = new Set();
  for (const [key, o] of Object.entries(ORDERS)) {
    checkOrder(key, o, npcs.npcs);
    if (requesters.has(o.requester)) throw new Error(`${o.requester} has two orders`);
    requesters.add(o.requester);
    const id = `{{ModId}}_${key}`;
    const str = part => {
      strings[`${id}_${part}`] = `{{i18n:order.${key}.${part}}}`;
      return `[${id}_${part}]`;
    };
    i18n[`order.${key}.Name`] = o.name;
    i18n[`order.${key}.Text`] = o.text;
    i18n[`order.${key}.Objective_0_Text`] = o.goal;
    checkOrderDe(key, o, DE[key]);
    de[`order.${key}.Name`] = DE[key].name;
    de[`order.${key}.Text`] = DE[key].text;
    de[`order.${key}.Objective_0_Text`] = DE[key].goal;
    const [type, count, tags] = o.objective;
    orders[id] = {
      Name: str('Name'),
      Requester: o.requester,
      Duration: o.duration,
      Repeatable: true,
      RequiredTags: o.tags || '',
      OrderType: '',
      SpecialRule: '',
      Condition: o.condition || null,
      Text: str('Text'),
      ItemToRemoveOnEnd: null,
      MailToRemoveOnEnd: null,
      RandomizedElements: null,
      Objectives: [{
        Type: type,
        Text: str('Objective_0_Text'),
        RequiredCount: String(count),
        Data: type === 'Deliver' ? { AcceptedContextTags: tags, TargetName: o.requester } : { AcceptedContextTags: tags }
      }],
      Rewards: [
        { Type: 'Money', Data: { Amount: String(o.money) } },
        { Type: 'Friendship', Data: {} }
      ]
    };
  }
  if (Object.keys(orders).length !== 6) throw new Error('the pack has six orders');
  if (Object.keys(DE).sort().join() !== Object.keys(ORDERS).sort().join()) throw new Error('de.js must have exactly the orders of ORDERS');
  if (Object.keys(de).sort().join() !== Object.keys(i18n).sort().join()) throw new Error('i18n/de.json must have exactly the keys of default.json');
  return {
    'content.json': {
      Format: '2.9.0',
      Changes: [
        { LogName: 'Town board order texts', Action: 'EditData', Target: 'Strings/SpecialOrderStrings', Entries: strings },
        { LogName: 'Six farm orders on the town board', Action: 'EditData', Target: 'Data/SpecialOrders', Entries: orders }
      ]
    },
    'i18n/default.json': i18n,
    'i18n/de.json': de
  };
}
