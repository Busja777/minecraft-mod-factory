// Villager Birthday Reminders: on the morning of a villager's birthday a short letter waits in the
// mailbox, every year, with one gift that villager loves. Since 1.1 a second, optional letter comes
// the morning before ("tomorrow is …'s birthday", same gift idea), switchable in the config.
//
// How the letter is sent (Stardew Valley 1.6, documented on the wiki, not tested in the game):
// - The letters are Data/mail entries ("<text>[#]<letter name>", @ = player name, ^ = line break).
//   https://stardewvalleywiki.com/Modding:Mail_data#Format
//   That page advises against the date keys ("spring_15") and points to trigger actions for mail on a
//   specific date, so each letter is sent by one Data/TriggerActions entry:
// - Trigger "DayStarted" (raised when the player starts a day, after sleeping or loading),
//   Condition "SEASON_DAY <season> <day>, PLAYER_HAS_MET Current <npc>" (game state queries),
//   Actions "RemoveMail Current <id> Received" + "AddMail Current <id> Now".
//   https://stardewvalleywiki.com/Modding:Trigger_actions#Data/TriggerActions
//   https://stardewvalleywiki.com/Modding:Game_state_queries#Date_.26_time
// - "MarkActionApplied": false, because entries otherwise run only once per player ("Make
//   Data/TriggerActions repeat" on the trigger actions page). The RemoveMail of the received copy
//   makes sure last year's letter does not stop this year's (whether AddMail checks the received
//   list is not documented).
// - PLAYER_HAS_MET keeps villagers the player has not talked to yet (Kent before year 2, Krobus,
//   the Dwarf, Sandy, the Wizard) out of the mailbox, so nothing is spoiled.
// - 1.1, the reminder the day before: same mechanism (one more Data/mail entry and one more
//   Data/TriggerActions entry per villager), with SEASON_DAY on the eve. The eve of day 1 is day 28
//   of the season before (https://stardewvalleywiki.com/Seasons, revision 194195: spring, summer,
//   fall, winter, "Each Season lasts 28 days", the year moves on when spring starts again), so the
//   eve of spring 1 is winter 28 of the year before; SEASON_DAY has no year, so that letter comes
//   every winter 28. Of the current villagers only Krobus (winter 1 → fall 28) is affected; eve()
//   below handles every date and is checked for the edges.
// - The eve letters can be switched off: config option "DayBefore" ("true, false", default true;
//   author-guide/config.md: "true, false" is a boolean and shows as a checkbox). Only the trigger
//   patch carries "When": { "DayBefore": "true" } (author-guide.md#conditions). The eve letter texts
//   stay defined either way, so a letter already in the mailbox never loses its text when the
//   option is switched off during a day.
// - Content Patcher only applies the EditData patches; the {{ModId}} token keeps all IDs unique
//   (Content Patcher author guide, tokens.md#ModId) and the text comes from i18n (translations.md).
//
// Gifts: one loved gift per villager. The ID must be in that villager's loved list in
// Data/NPCGiftTastes (raw data as of 1.6.15 on the wiki) and its name in the villager page's
// "favorites"; both are in tools/stardew/data/npcs.json and checked below.

// name → [gift ID, how the letter names it, how the letter calls the villager]
export const GIFTS = {
  Abigail: ['(O)276', 'a Pumpkin'],
  Alex: ['(O)201', 'a Complete Breakfast'],
  Caroline: ['(O)614', 'some Green Tea'],
  Clint: ['(O)336', 'a Gold Bar'],
  Demetrius: ['(O)233', 'some Ice Cream'],
  Dwarf: ['(O)749', 'an Omni Geode', 'the Dwarf'],
  Elliott: ['(O)715', 'a Lobster'],
  Emily: ['(O)66', 'an Amethyst'],
  Evelyn: ['(O)591', 'a Tulip'],
  George: ['(O)20', 'a Leek'],
  Gus: ['(O)635', 'an Orange'],
  Haley: ['(O)421', 'a Sunflower'],
  Harvey: ['(O)395', 'a cup of Coffee'],
  Jas: ['(O)595', 'a Fairy Rose'],
  Jodi: ['(O)211', 'some Pancakes'],
  Kent: ['(O)607', 'some Roasted Hazelnuts'],
  Krobus: ['(O)305', 'a Void Egg'],
  Leah: ['(O)196', 'a Salad'],
  Lewis: ['(O)260', 'a Hot Pepper'],
  Linus: ['(O)280', 'a Yam'],
  Marnie: ['(O)608', 'a Pumpkin Pie'],
  Maru: ['(O)190', 'a Cauliflower'],
  Pam: ['(O)24', 'a Parsnip'],
  Penny: ['(O)376', 'a Poppy'],
  Pierre: ['(O)202', 'some Fried Calamari'],
  Robin: ['(O)224', 'a plate of Spaghetti'],
  Sam: ['(O)206', 'a Pizza'],
  Sandy: ['(O)402', 'a Sweet Pea'],
  Sebastian: ['(O)84', 'a Frozen Tear'],
  Shane: ['(O)346', 'a Beer'],
  Vincent: ['(O)398', 'some Grapes'],
  Willy: ['(O)143', 'a Catfish'],
  Wizard: ['(O)422', 'a Purple Mushroom', 'the Wizard']
};

const cap = s => s[0].toUpperCase() + s.slice(1);

export const letter = (call, phrase) =>
  `Dear @,^^Today is ${call}'s birthday!^^Gift idea: ${phrase}, one of ${call}'s favorite things. Birthday gifts count eight times as much for friendship.^^Happy gifting!`;

export const eveLetter = (call, phrase) =>
  `Dear @,^^Tomorrow is ${call}'s birthday!^^Gift idea: ${phrase}, one of ${call}'s favorite things. Birthday gifts count eight times as much for friendship.^^There is still a day to get it ready.`;

// The day before a date: day 1 → day 28 of the season before, spring 1 → winter 28.
export const SEASONS = ['spring', 'summer', 'fall', 'winter'];
export const DAYS = 28;
export function eve({ season, day }) {
  const s = SEASONS.indexOf(season);
  if (s < 0 || !(day >= 1 && day <= DAYS)) throw new Error(`no such date: ${season} ${day}`);
  return day > 1 ? { season, day: day - 1 } : { season: SEASONS[(s + 3) % 4], day: DAYS };
}

export default async function ({ items, npcs }) {
  for (const [date, want] of [[['spring', 1], ['winter', 28]], [['winter', 1], ['fall', 28]], [['summer', 1], ['spring', 28]], [['fall', 13], ['fall', 12]]]) {
    const got = eve({ season: date[0], day: date[1] });
    if (got.season !== want[0] || got.day !== want[1]) throw new Error(`eve of ${date.join(' ')} is ${got.season} ${got.day}, expected ${want.join(' ')}`);
  }
  const mail = {};
  const triggers = {};
  const eveMail = {};
  const eveTriggers = {};
  const i18n = {};
  for (const [name, [gift, phrase, call = name]] of Object.entries(GIFTS)) {
    const npc = npcs.npcs[name];
    if (!npc) throw new Error(`${name} is not in npcs.json`);
    if (npc.island) throw new Error(`${name} lives on Ginger Island (planned for a later version)`);
    if (!npc.loves.includes(gift)) throw new Error(`${name} does not love ${gift} (Data/NPCGiftTastes)`);
    const itemName = items.items[gift];
    if (!itemName || !npc.favorites.includes(itemName)) throw new Error(`${gift} (${itemName}) is not among ${name}'s favorites on the wiki`);
    if (!phrase.includes(itemName.replace(/s$/, ''))) throw new Error(`${name}: "${phrase}" does not name ${itemName}`);

    const id = `{{ModId}}_Birthday_${name}`;
    const { season, day } = npc.birthday;
    i18n[`letter.${name}`] = letter(call, phrase);
    i18n[`title.${name}`] = `${cap(call)}'s Birthday`;
    mail[id] = `{{i18n:letter.${name}}}[#]{{i18n:title.${name}}}`;
    triggers[id] = {
      Id: id,
      Trigger: 'DayStarted',
      Condition: `SEASON_DAY ${season} ${day}, PLAYER_HAS_MET Current ${name}`,
      Actions: [`RemoveMail Current ${id} Received`, `AddMail Current ${id} Now`],
      MarkActionApplied: false
    };

    const eveId = `{{ModId}}_BirthdayEve_${name}`;
    const before = eve(npc.birthday);
    i18n[`eve.${name}`] = eveLetter(call, phrase);
    i18n[`eveTitle.${name}`] = `${cap(call)}'s Birthday Tomorrow`;
    eveMail[eveId] = `{{i18n:eve.${name}}}[#]{{i18n:eveTitle.${name}}}`;
    eveTriggers[eveId] = {
      Id: eveId,
      Trigger: 'DayStarted',
      Condition: `SEASON_DAY ${before.season} ${before.day}, PLAYER_HAS_MET Current ${name}`,
      Actions: [`RemoveMail Current ${eveId} Received`, `AddMail Current ${eveId} Now`],
      MarkActionApplied: false
    };
  }
  const missing = Object.entries(npcs.npcs).filter(([n, v]) => !v.island && !GIFTS[n]).map(([n]) => n);
  if (missing.length) throw new Error(`no letter for ${missing.join(', ')}`);
  return {
    'content.json': {
      Format: '2.9.0',
      ConfigSchema: {
        DayBefore: {
          AllowValues: 'true, false',
          Default: 'true',
          Description: 'Also send a short reminder letter the morning before each birthday, with the same gift idea. The letter on the birthday itself always comes.'
        }
      },
      Changes: [
        { LogName: 'Birthday letters', Action: 'EditData', Target: 'Data/mail', Entries: mail },
        { LogName: 'Reminder letters for the day before', Action: 'EditData', Target: 'Data/mail', Entries: eveMail },
        { LogName: 'Send the letter on the birthday', Action: 'EditData', Target: 'Data/TriggerActions', Entries: triggers },
        { LogName: 'Send the reminder the day before', Action: 'EditData', Target: 'Data/TriggerActions', Entries: eveTriggers, When: { DayBefore: 'true' } }
      ]
    },
    'i18n/default.json': i18n
  };
}
