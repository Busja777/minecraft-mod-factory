// Seasonal Care Packages: once a season a friendly villager sends a short letter with a small parcel of
// seasonal goods. Four letters (spring, summer, fall, winter), each once per save, on day 10 of its
// season. No money, nothing beyond a few forage items or treats.
//
// How the letters are sent (Stardew Valley 1.6, documented on the wiki, not tested in the game):
// - The letters are Data/mail entries ("<text>[#]<letter name>", @ = player name, ^ = line break).
//   https://stardewvalleywiki.com/Modding:Mail_data#Format
// - The parcel is the 1.6 mail command "%item id [<item ID> <count>]+ %%": "If multiple items are
//   listed … one set will be picked randomly", so every parcel holds one of three small seasonal
//   stacks (a surprise, like a real care package). Item IDs are qualified (O) IDs from
//   Modding:Objects/Object sprites (tools/stardew/data/items.json).
//   https://stardewvalleywiki.com/Modding:Mail_data#Value
// - The mail page advises against the date keys ("spring_10") and points to trigger actions, so each
//   letter is sent by one Data/TriggerActions entry: Trigger "DayStarted", Condition
//   "SEASON_DAY <season> 10, PLAYER_HAS_MET Current <sender>", Action "AddMail Current <id> Now".
//   Entries run once per player by default, so each letter comes once per save: on day 10 of the first
//   matching season in which the player has met the sender.
//   https://stardewvalleywiki.com/Modding:Trigger_actions#Data/TriggerActions
//   https://stardewvalleywiki.com/Modding:Game_state_queries#Date_.26_time
// - Content Patcher only applies the EditData patches; {{ModId}} keeps the IDs unique (tokens.md) and
//   the text comes from i18n (translations.md).
//
// Fairness: every choice is worth at most 300g at its base sell price (prices from each item's wiki
// page, checked 2026-11-21), less than a single early-game crop harvest, and the senders are villagers
// the player meets in town during the first days.
//
// 1.1, German: i18n/de.json has every letter and title in German (texts and the German names with
// their wiki sources in de.js). Content Patcher picks the file for the game language and falls back
// to default.json (author-guide/translations.md); every key here has a German text. Same parcels,
// same senders, same day; the English texts stay as in 1.0.

import { DE, SEASONS_DE } from './de.js';

export const DAY = 10; // no festival falls on day 10 of any season (https://stardewvalleywiki.com/Festivals)
export const MAX_VALUE = 300;

// sell prices (base quality) from the item pages on the wiki
export const PRICES = {
  '(O)472': 10, '(O)20': 60, '(O)18': 30,
  '(O)396': 80, '(O)398': 80, '(O)233': 120,
  '(O)410': 20, '(O)408': 90, '(O)404': 40,
  '(O)412': 70, '(O)416': 100, '(O)414': 150
};

// season → sender, the three possible parcels [item ID, count], letter text, title
export const PACKAGES = {
  spring: {
    from: 'Evelyn',
    items: [['(O)472', 5], ['(O)20', 3], ['(O)18', 3]],
    text: "Dear @,^^The garden is waking up, and so am I, slowly! George says I fuss too much over the new folks in town, but I wanted you to have a little something for the season.^^Plant it, cook it or put it in a vase... whatever makes your day brighter.^^   -Evelyn",
    title: 'A Spring Parcel From Evelyn'
  },
  summer: {
    from: 'Gus',
    items: [['(O)396', 3], ['(O)398', 3], ['(O)233', 2]],
    text: "Hey there, @!^^It's hot enough to fry an egg on the saloon steps. I packed a few summer treats for you. Don't work too hard out in that sun, and stop by for a cold drink sometime.^^   -Your friend, Gus",
    title: 'A Summer Parcel From Gus'
  },
  fall: {
    from: 'Caroline',
    items: [['(O)410', 5], ['(O)408', 2], ['(O)404', 4]],
    text: "Dear @,^^I gathered a few things on my walks this fall and thought of you. The valley is so generous this time of year, it seems wrong not to share.^^Take a break for a cup of tea now and then, okay?^^   -Caroline",
    title: 'A Fall Parcel From Caroline'
  },
  winter: {
    from: 'Marnie',
    items: [['(O)412', 2], ['(O)416', 2], ['(O)414', 1]],
    text: "Dear @,^^Winter's here, and the animals and I are hunkering down. I found a few winter treats under the snow and set some aside for my favorite neighbor.^^Keep your stove lit, and keep your animals inside on the cold nights.^^   -Marnie",
    title: 'A Winter Parcel From Marnie'
  }
};

const cap = s => s[0].toUpperCase() + s.slice(1);

export default async function ({ items, npcs }) {
  const mail = {};
  const triggers = {};
  const i18n = {};
  const de = {};
  if (Object.keys(PACKAGES).join() !== 'spring,summer,fall,winter') throw new Error('one parcel per season, in order');
  for (const [season, p] of Object.entries(PACKAGES)) {
    if (!npcs.npcs[p.from]) throw new Error(`${p.from} is not in npcs.json`);
    if (npcs.npcs[p.from].island) throw new Error(`${p.from} lives on Ginger Island`);
    if (!p.text.includes(`-${p.from}`) && !p.text.includes(`, ${p.from}`)) throw new Error(`${season}: the letter is not signed by ${p.from}`);
    if (/%|\[#\]/.test(p.text + p.title)) throw new Error(`${season}: no mail commands in the text`);
    for (const [id, count] of p.items) {
      if (!items.items[id]) throw new Error(`${id} is not in items.json`);
      if (!(id in PRICES)) throw new Error(`${id} (${items.items[id]}) has no price`);
      if (PRICES[id] * count > MAX_VALUE) throw new Error(`${season}: ${count} × ${items.items[id]} is worth more than ${MAX_VALUE}g`);
    }
    const id = `{{ModId}}_${cap(season)}`;
    const parcel = p.items.map(([item, count]) => `${item} ${count}`).join(' ');
    i18n[`letter.${season}`] = p.text;
    i18n[`title.${season}`] = p.title;
    // German (since 1.1): same sender, greeting, Du-form, no mail commands (as in Joja Junk Mail).
    const [deText, deTitle] = DE[season] || [];
    if (!deText || !deTitle) throw new Error(`${season}: German text missing in de.js`);
    if (/[%[\]¦{}#$]/.test(deText + deTitle)) throw new Error(`${season}: mail command characters in the German text`);
    if (!deText.startsWith('Hallo @')) throw new Error(`${season}: the German letter must greet the player ("Hallo @,")`);
    if (/\b(Sie|Ihnen|Ihr|Ihre)\b/.test(deText)) throw new Error(`${season}: German letters use the Du-form`);
    if (!new RegExp(`(-|\\s)${p.from}$`).test(deText)) throw new Error(`${season}: the German letter is not signed by ${p.from}`);
    if (!deTitle.includes(SEASONS_DE[season]) || !deTitle.endsWith(` ${p.from}`)) throw new Error(`${season}: the German title must name ${SEASONS_DE[season]} and ${p.from}`);
    de[`letter.${season}`] = deText;
    de[`title.${season}`] = deTitle;
    mail[id] = `{{i18n:letter.${season}}}%item id ${parcel} %%[#]{{i18n:title.${season}}}`;
    triggers[id] = {
      Id: id,
      Trigger: 'DayStarted',
      Condition: `SEASON_DAY ${season} ${DAY}, PLAYER_HAS_MET Current ${p.from}`,
      Actions: [`AddMail Current ${id} Now`]
    };
  }
  if (Object.keys(DE).join() !== Object.keys(PACKAGES).join()) throw new Error('de.js must have exactly the seasons of PACKAGES');
  if (Object.keys(de).sort().join() !== Object.keys(i18n).sort().join()) throw new Error('i18n/de.json must have exactly the keys of default.json');
  return {
    'content.json': {
      Format: '2.9.0',
      Changes: [
        { LogName: 'Care package letters', Action: 'EditData', Target: 'Data/mail', Entries: mail },
        { LogName: 'Send a parcel on day 10 of each season', Action: 'EditData', Target: 'Data/TriggerActions', Entries: triggers }
      ]
    },
    'i18n/default.json': i18n,
    'i18n/de.json': de
  };
}
