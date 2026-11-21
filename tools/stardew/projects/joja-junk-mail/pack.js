// Joja Junk Mail: JojaMart advertising letters in the mailbox, one a week (on Wednesday), sixteen
// different ones per year, plus (since 1.2) one the day before each festival, every year, until
// JojaMart's story in the valley is over.
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
// - Festival letters (since 1.2): "SEASON <season>, DAY_OF_MONTH <day>" plus the same two stop
//   queries, one letter the day before each festival. Festival dates from
//   https://stardewvalleywiki.com/Festivals (1.6): Egg Festival spring 13, Flower Dance spring 24,
//   Luau summer 11, Trout Derby summer 20-21, Dance of the Moonlight Jellies summer 28, Stardew
//   Valley Fair fall 16, Spirit's Eve fall 27, Festival of Ice winter 8, SquidFest winter 12-13,
//   Night Market winter 15-17, Feast of the Winter Star winter 25. The Desert Festival (spring
//   15-17) is left out: it can only be reached once the bus is repaired
//   (https://stardewvalleywiki.com/Desert_Festival), so it is not open to every player.
//   Every season has 28 days and starts on a Monday (https://stardewvalleywiki.com/Days_of_the_Week),
//   so the Wednesday letters always fall on days 3, 10, 17 and 24. A festival letter whose day
//   before is a Wednesday goes out two days before instead (Luau, Feast of the Winter Star).
// - Never two letters on one day: checkDates() reads the conditions of all triggers back (season,
//   days, weekday, year) and fails the build if two letters can arrive on the same date.
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

// One letter before each festival: [season, first festival day, letter]. The letter goes out the day
// before, or two days before if that day is a Wednesday (the weekly letter's day).
export const FESTIVALS = [
  ['spring', 13, ['EggFestival', 'Joja Pre-Found Eggs',
    'Dear @,^^The Egg Festival is almost here, and with it the big egg hunt around the town square.^^Why run around looking for eggs when JojaMart has already found them for you? Joja Pre-Found Eggs come twelve to a carton, every one painted the same cheerful shade of Joja blue.^^Please do not hide them again. That would void the carton warranty.']],
  ['spring', 24, ['FlowerDance', 'Joja Meadow Mist',
    'Dear @,^^The Flower Dance is coming, out in the meadow in the forest where the whole town dances among the spring flowers.^^Get in the mood with Joja Meadow Mist: the smell of fresh flowers, in a can!^^Spray it generously before the dance. Surrounded by all those real flowers, nobody will ever notice the difference.^^Contains no flowers. Dance partner not included.']],
  ['summer', 11, ['Luau', 'Joja Potluck Powder',
    'Hello @,^^Soon the whole town meets at the beach for the Luau, where everyone adds something to one big pot of soup for the Governor.^^Make your contribution unforgettable with Joja Potluck Powder! One spoonful turns any soup into Joja-flavored soup.^^What does Joja flavor taste like? Our lawyers have asked us not to say.']],
  ['summer', 20, ['TroutDerby', 'Joja Gold-Colored Tags',
    'Dear @,^^The Trout Derby is coming to the river in the forest. Catch a rainbow trout, and you might find a Golden Tag to trade for prizes.^^Why wait for luck? Joja Gold-Colored Tags come in packs of twenty, already shiny, no fish required.^^Not accepted at the derby booth. Or anywhere else.']],
  ['summer', 28, ['MoonlightJellies', 'Joja Jelly Viewing Deck',
    'Dear @,^^Every summer the town gathers on the docks at night to watch the Moonlight Jellies drift past, drawn by a single light on the water.^^This year, enjoy the view from the new Joja Jelly Viewing Deck! Comfortable seats, a vending machine and three hundred Joja floodlights.^^Our engineers say the jellies may like our lights so much that they never leave. We consider this a success.']],
  ['fall', 16, ['Fair', 'Joja Display-in-a-Box',
    'Hello @,^^The Stardew Valley Fair is almost here! Games, Star Tokens and the grange display contest, where judges look for quality and variety.^^Save yourself the work with the Joja Display-in-a-Box: nine wax vegetables in nine slightly different shades of beige.^^That is variety. Our marketing department checked.']],
  ['fall', 27, ['SpiritsEve', 'Joja Maze Map',
    'Dear @,^^Spirit\'s Eve is coming, and with it the spooky hedge maze in town.^^Never get lost again with the Joja Maze Map! It has one big, clear arrow, and it always points to the nearest JojaMart.^^Still lost? That is the spirit of the season. Happy haunting!']],
  ['winter', 8, ['FestivalOfIce', 'Joja Ice Fishing Kit',
    'Hello @,^^The Festival of Ice is almost here, with ice sculptures, igloos and the big ice fishing contest.^^Be ready with the Joja Ice Fishing Kit: one bucket, one bag of JojaFresh Ice Cubes and one pre-caught Joja Ocean Stick, frozen for authenticity.^^Drop the stick into the bucket and pull it out again. Congratulations, you are an ice fisher!']],
  ['winter', 12, ['SquidFest', 'The Joja Squid Tier',
    'Dear @,^^SquidFest is coming to the beach, with copper, iron, gold and iridium prizes for the best squid catchers.^^JojaMart proudly presents its own unofficial fifth tier: the Joja Tier! Catch one squid and win a coupon for 5 percent off Joja Ocean Sticks.^^Catch no squid at all and win the same coupon. At Joja, everyone is a winner.']],
  ['winter', 15, ['NightMarket', 'Joja Submarine Experience',
    'Dear @,^^The Night Market is opening at the beach, with boats full of goods, a mermaid show and a submarine ride down to the deep-sea fish.^^Why get seasick? Try the Joja Submarine Experience instead: sit in our dark storage room while a staff member slowly holds up a picture of a fish.^^Open during regular business hours. Floor may be damp.']],
  ['winter', 25, ['WinterStar', 'Joja Gift Wrap',
    'Hello @,^^The Feast of the Winter Star is almost here, and somebody in town is counting on your secret gift.^^Whatever you picked, make it shine with Joja Gift Wrap! It is so bright and so blue that nobody will look at what is inside.^^Works especially well on Joja Gift Cards.']]
];

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
// Day 1 of every season is a Monday.
export const weekday = day => WEEKDAYS[(day - 1) % 7];

// The day a festival letter goes out: the day before, or two days before if that is a Wednesday.
export const festivalLetterDay = festivalDay => {
  const day = weekday(festivalDay - 1) === 'Wednesday' ? festivalDay - 2 : festivalDay - 1;
  if (day < 1) throw new Error(`festival on day ${festivalDay}: the letter would fall into the previous season`);
  return day;
};

export const festivalWhen = (season, day) =>
  [`SEASON ${season}`, `DAY_OF_MONTH ${day}`, '!IS_COMMUNITY_CENTER_COMPLETE', '!IS_JOJA_MART_COMPLETE'].join(', ');

// Reads back which dates a condition can match: { season, days, years: [min, max] }. Only the
// queries this pack writes are understood, anything else about the date fails the build.
export const sendDates = condition => {
  const q = {};
  for (const part of condition.split(', ')) {
    const [name, ...args] = part.split(' ');
    if (q[name]) throw new Error(`${condition}: ${name} twice`);
    q[name] = args;
  }
  if (q.SEASON?.length !== 1 || !q.DAY_OF_MONTH?.length) throw new Error(`${condition}: every letter needs one SEASON and DAY_OF_MONTH`);
  for (const name of Object.keys(q)) if (!['SEASON', 'DAY_OF_MONTH', 'DAY_OF_WEEK', 'YEAR', '!IS_COMMUNITY_CENTER_COMPLETE', '!IS_JOJA_MART_COMPLETE'].includes(name)) throw new Error(`${condition}: unexpected query ${name}`);
  const days = q.DAY_OF_MONTH.map(Number).filter(d => !q.DAY_OF_WEEK || q.DAY_OF_WEEK.includes(weekday(d)));
  if (!days.length || days.some(d => !(d >= 1 && d <= 28))) throw new Error(`${condition}: no valid day`);
  const [min = 1, max = Infinity] = (q.YEAR || []).map(Number);
  return { season: q.SEASON[0], days, years: [min, max] };
};

// Fails if two letters can arrive on the same date (same season and day, overlapping years).
export const checkDates = triggers => {
  const all = Object.values(triggers).map(t => ({ id: t.Id, ...sendDates(t.Condition) }));
  all.forEach((a, i) => all.slice(i + 1).forEach(b => {
    if (a.season !== b.season || a.years[1] < b.years[0] || b.years[1] < a.years[0]) return;
    const day = a.days.find(d => b.days.includes(d));
    if (day) throw new Error(`${a.id} and ${b.id} can both arrive on ${a.season} ${day}`);
  }));
};

const weekDays = week => Array.from({ length: 7 }, (_, i) => 7 * (week - 1) + i + 1).join(' ');

// The condition for the letter of week <week> (1 to 4) of <season>.
export const when = (season, week, year = null) =>
  [`SEASON ${season}`, `DAY_OF_MONTH ${weekDays(week)}`, 'DAY_OF_WEEK Wednesday', ...(year ? [year] : []), '!IS_COMMUNITY_CENTER_COMPLETE', '!IS_JOJA_MART_COMPLETE'].join(', ');

export default async function () {
  const mail = {};
  const triggers = {};
  const festivalTriggers = {};
  const i18n = {};
  const de = {};
  const titles = new Set();
  const add = ([key, title, text], condition, target = triggers) => {
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
    target[id] = {
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
  for (const [season, day, letter] of FESTIVALS) add(letter, festivalWhen(season, festivalLetterDay(day)), festivalTriggers);
  if (Object.keys(festivalTriggers).length !== FESTIVALS.length) throw new Error('one letter per festival');
  if (Object.keys(mail).length < 12) throw new Error('at least 12 letters');
  checkDates({ ...triggers, ...festivalTriggers });
  return {
    'content.json': {
      Format: '2.9.0',
      Changes: [
        { LogName: 'Joja advertising letters', Action: 'EditData', Target: 'Data/mail', Entries: mail },
        { LogName: 'Send one letter every Wednesday', Action: 'EditData', Target: 'Data/TriggerActions', Entries: triggers },
        { LogName: 'Send one letter before each festival', Action: 'EditData', Target: 'Data/TriggerActions', Entries: festivalTriggers }
      ]
    },
    'i18n/default.json': i18n,
    'i18n/de.json': de
  };
}
