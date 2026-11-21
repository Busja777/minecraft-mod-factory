// Joja Junk Mail: JojaMart advertising letters in the mailbox, one a week (on Wednesday), sixteen
// different ones per year, every year, until JojaMart's story in the valley is over.
//
// How the letters are sent (Stardew Valley 1.6, documented on the wiki, not run in the game):
// - The letters are Data/mail entries ("<text>[#]<letter name>", @ = player name, ^ = line break).
//   "[letterbg 4]" before the [#] switches to the JojaMart letter background and its text colour
//   ("Custom mail formatting"). https://stardewvalleywiki.com/Modding:Mail_data
//   No letter attaches items or money (no %item / %action commands).
// - The mail data page advises against date keys and points to trigger actions, so each letter is
//   sent by one Data/TriggerActions entry: Trigger "DayStarted", Actions
//   "RemoveMail Current <id> Received" + "AddMail Current <id> Now", "MarkActionApplied": false so
//   it repeats every year (same pattern as Villager Birthday Reminders).
//   https://stardewvalleywiki.com/Modding:Trigger_actions#Data/TriggerActions
// - When: "SEASON <season>, DAY_OF_MONTH <7 days of week n>, DAY_OF_WEEK Wednesday" matches the one
//   Wednesday in week n of that season, whichever date it falls on, so there is exactly one letter
//   per week and never two on the same day (four weeks of seven days per 28-day season).
//   https://stardewvalleywiki.com/Modding:Game_state_queries#Date_.26_time
//   Wednesday because Pierre's shop is closed that day (https://stardewvalleywiki.com/Days_of_the_Week).
//   The welcome letter only goes out in year 1 ("YEAR 1 1"); from year 2 on ("YEAR 2", min year
//   without max) an anniversary letter takes its week.
// - Stop: "!IS_COMMUNITY_CENTER_COMPLETE" ("Whether the community center has been repaired"; after
//   that JojaMart closes, https://stardewvalleywiki.com/JojaMart) and "!IS_JOJA_MART_COMPLETE"
//   ("Whether the Joja community development form has been completed"), both documented world
//   queries. The mail data page warns that the "ccIsComplete" mail flag is not set reliably, which
//   is why the queries are used and not the flag.
//   https://stardewvalleywiki.com/Modding:Game_state_queries#World
// - Content Patcher only applies the EditData patches; {{ModId}} keeps the IDs unique (tokens.md)
//   and all text comes from i18n (translations.md).

import { DE, SIGN } from './de.js';

export const SEASONS = ['spring', 'summer', 'fall', 'winter'];

// One letter per season and week: [key, title, text]. Text: @ = player name, ^ = line break.
// Letters listed in LATER_YEARS are only sent in year 1 (YEAR 1 1); from year 2 on (YEAR 2) the
// replacement goes out in the same week instead.
export const LATER_YEARS = {
  Welcome: ['Anniversary', 'Happy Joja Anniversary',
    'Dear @,^^Can you believe it? Another year on that farm of yours!^^To celebrate, JojaMart is offering you an exclusive anniversary deal: the same prices as last year, presented with a brand-new smile.^^Thank you for staying in the valley. We are watching your progress with great interest.']
};

export const LETTERS = {
  spring: [
    ['Welcome', 'Joja Welcomes You',
      'Dear Valued Future Customer @,^^Welcome to Pelican Town! We noticed you moved onto an old farm. Brave!^^Why grow your own food when JojaMart has already grown it, washed it, wrapped it in three layers of plastic and put a sticker on it?^^Come see us. We are open on Wednesdays, unlike some small shops we could mention.'],
    ['Cola', 'Joja Cola Extra Fizz',
      'Dear @,^^Introducing Joja Cola Extra Fizz, now with 40 percent more bubbles and 0 percent more flavor!^^Customers say it tastes "exactly like regular Joja Cola, but louder."^^Pick up a six-pack today. Recycling bins sold separately.'],
    ['Corsage', 'Joja Everbloom Corsage',
      'Dear @,^^Planning to dance this spring? Look your best with the Joja Everbloom Corsage!^^Made from 100 percent real imitation flowers. It never wilts, never fades and smells faintly of the factory.^^Available at the JojaMart checkout, next to the gum.'],
    ['Lawn', 'Joja Lawn Solutions',
      'Hello @,^^Tired of pulling weeds every morning?^^Joja Lawn Solutions presents the Joja Everlawn: a green plastic carpet that never grows, never wilts and never needs watering.^^Simply roll it over your field and enjoy a farm that is finally under control.^^Crops not compatible with Everlawn.']
  ],
  summer: [
    ['Sunscreen', 'Joja Sun Guard',
      'Dear @,^^Summer is here, and so is Joja Sun Guard SPF 2!^^Our scientists have proven that it is slightly better than nothing.^^For best results, apply generously and then stay indoors at JojaMart, where the air conditioning is always on.'],
    ['IceCubes', 'JojaFresh Ice Cubes',
      'Hello @,^^Hot day? Try new JojaFresh Ice Cubes, now pre-frozen for your convenience!^^Each bag contains genuine water, carefully shaped into cubes by our Zuzu City experts.^^Please keep frozen. Joja is not responsible for puddles.'],
    ['FishSticks', 'Joja Ocean Sticks',
      'Dear @,^^Why stand on a dock all day waiting for a fish to bite?^^Joja Ocean Sticks bring the taste of the sea straight to your kitchen. Each stick contains real fish flavor and at least some fish.^^Leave your fishing rod at home. The fish will thank you.'],
    ['Survey', 'Joja Customer Survey',
      'Dear @,^^Joja values your opinion! Please rate your last JojaMart visit on a scale from 10 to 10.^^Your answers help us confirm that everything is already perfect.^^Thank you for completing this survey. By reading this letter, you have completed this survey.^^-Morris^Joja Customer Satisfaction Representative']
  ],
  fall: [
    ['PumpkinCola', 'Pumpkin Spice Joja Cola',
      'Dear @,^^Fall is here, and so is our most requested product of all time: Pumpkin Spice Joja Cola!^^It contains no pumpkin and very little spice, but it is orange, and that is what matters.^^Limited edition. Available until we run out of orange.'],
    ['Harvest', 'Joja Instant Harvest',
      'Hello @,^^Harvest season can be stressful. That is why we created the Joja Instant Harvest Kit!^^Just open the box and find a ready-to-eat harvest inside.^^Note: the kit contains a coupon for vegetables, not vegetables. Coupon redeemable at JojaMart only.'],
    ['Costume', 'Joja Spooky Costume',
      'Dear @,^^Still looking for a costume? The scariest outfit in the valley is now available at JojaMart:^^The Official Joja Employee Vest.^^Guaranteed to frighten anyone who has ever worked a double shift. Name tag included.'],
    ['Rewards', 'Joja Rewards Card',
      'Dear @,^^Join the Joja Rewards program today! Every purchase earns you Joja Points.^^Joja Points can be exchanged for more Joja Points, or saved for a future reward that will be announced at a later date.^^Start collecting now. Experts agree that points are fun.']
  ],
  winter: [
    ['Snow', 'Joja Canned Snow',
      'Dear @,^^Snowflakes are unpredictable. Joja Canned Snow is not!^^Each can contains a perfectly consistent white powder, ready to sprinkle wherever you need winter.^^Not for eating. Not for snowmen. Not for anything, really, but it looks lovely on a shelf.'],
    ['GiftCard', 'Joja Gift Cards',
      'Hello @,^^Not sure what to bring to the Feast of the Winter Star?^^Give the gift that says "I thought about you for exactly one second": a Joja Gift Card!^^Available in all amounts. The card itself is very shiny.'],
    ['SelfHelp', 'Joja Book Club',
      'Dear @,^^This month the Joja Book Club recommends the bestseller "Put Down the Hoe: Seven Steps Back to Your Desk Job."^^Readers call it "very long" and "printed on paper."^^Your old cubicle at Joja Corporation is still available. We kept your chair warm.'],
    ['YearEnd', 'A Joja Year in Review',
      'Dear @,^^What a year! Thank you for opening every single one of our letters.^^We are proud to announce that next year there will be even more letters, with even more exciting offers.^^Until then, stay cozy, stay hydrated and stay loyal.^^-Morris^Joja Customer Satisfaction Representative']
  ]
};

const weekDays = week => Array.from({ length: 7 }, (_, i) => 7 * (week - 1) + i + 1).join(' ');

// The condition for the letter of week <week> (1 to 4) of <season>.
export const when = (season, week, year = null) =>
  [`SEASON ${season}`, `DAY_OF_MONTH ${weekDays(week)}`, 'DAY_OF_WEEK Wednesday', ...(year ? [year] : []), '!IS_COMMUNITY_CENTER_COMPLETE', '!IS_JOJA_MART_COMPLETE'].join(', ');

export default async function () {
  const mail = {};
  const triggers = {};
  const i18n = {};
  const de = {};
  const titles = new Set();
  const add = ([key, title, text], condition) => {
    if (/[%[\]¦{}#$]/.test(text)) throw new Error(`${key}: mail command characters in the text`);
    if (!/^(Dear|Hello|Dear Valued Future Customer) @,\^\^/.test(text)) throw new Error(`${key}: letters greet the player by name`);
    if (titles.has(title)) throw new Error(`${key}: title "${title}" is used twice`);
    titles.add(title);
    const id = `{{ModId}}_${key}`;
    if (mail[id]) throw new Error(`${key}: used twice`);
    i18n[`letter.${key}`] = /-Morris\^/.test(text) ? text : `${text}^^-JojaMart Marketing Team`;
    i18n[`title.${key}`] = title;
    // German (since 1.1): every letter has its translation, signed the same way as the English one.
    const [deTitle, deText] = DE[key] || [];
    if (!deTitle || !deText) throw new Error(`${key}: German text missing in de.js`);
    if (/[%[\]¦{}#$]/.test(deText) || !deText.startsWith('Hallo ')) throw new Error(`${key}: German letter must greet the player and contain no mail commands`);
    de[`letter.${key}`] = /-Morris\^/.test(deText) ? deText : `${deText}${SIGN}`;
    de[`title.${key}`] = deTitle;
    mail[id] = `{{i18n:letter.${key}}}[letterbg 4][#]{{i18n:title.${key}}}`;
    triggers[id] = {
      Id: id,
      Trigger: 'DayStarted',
      Condition: condition,
      Actions: [`RemoveMail Current ${id} Received`, `AddMail Current ${id} Now`],
      MarkActionApplied: false
    };
  };
  for (const season of SEASONS) {
    const letters = LETTERS[season];
    if (letters.length !== 4) throw new Error(`${season}: needs one letter per week (4)`);
    letters.forEach((letter, i) => {
      const later = LATER_YEARS[letter[0]];
      if (!later) return add(letter, when(season, i + 1));
      add(letter, when(season, i + 1, 'YEAR 1 1'));
      add(later, when(season, i + 1, 'YEAR 2'));
    });
  }
  if (Object.keys(mail).length < 12) throw new Error('at least 12 letters');
  return {
    'content.json': {
      Format: '2.9.0',
      Changes: [
        { LogName: 'Joja advertising letters', Action: 'EditData', Target: 'Data/mail', Entries: mail },
        { LogName: 'Send one letter every Wednesday', Action: 'EditData', Target: 'Data/TriggerActions', Entries: triggers }
      ]
    },
    'i18n/default.json': i18n,
    'i18n/de.json': de
  };
}
