// Grandpa's Letters: five short letters from Grandpa during the first year, one at the start of each
// season and one on the last day of the year, each with a gentle tip. The four seasonal letters hold a
// single tree or flower seed as a keepsake; the last one holds nothing.
//
// How the letters are sent (Stardew Valley 1.6, documented on the wiki, not tested in the game):
// - The letters are Data/mail entries ("<text>[#]<letter name>", @ = player name, ^ = line break).
//   https://stardewvalleywiki.com/Modding:Mail_data#Format
// - The keepsake is the 1.6 mail command "%item id <item ID> 1 %%" with a qualified (O) ID from
//   Modding:Objects/Object sprites (tools/stardew/data/items.json).
//   https://stardewvalleywiki.com/Modding:Mail_data#Value
// - The mail page advises against the date keys ("summer_1_1") and points to trigger actions, so each
//   letter is sent by one Data/TriggerActions entry: Trigger "DayStarted", Condition
//   "SEASON_DAY <season> <day>, YEAR 1 1" (first year only), Action "AddMail Current <id> Now".
//   Entries run once per player by default.
//   https://stardewvalleywiki.com/Modding:Trigger_actions#Data/TriggerActions
//   https://stardewvalleywiki.com/Modding:Game_state_queries#Date_.26_time
// - Content Patcher only applies the EditData patches; {{ModId}} keeps the IDs unique (tokens.md) and
//   the text comes from i18n (translations.md).
//
// Grandpa's story (https://stardewvalleywiki.com/Grandpa): he wrote the opening letter before he died,
// and his shrine note says he returns on spring 1 of year 3 to evaluate the farm. These letters are
// framed as letters he wrote long ago and left with an old friend to post, one per season. They never
// mention the evaluation, the shrine, candles or a return, never judge the farm and never promise
// anything about year 3, so they cannot contradict it. The tips are true for 1.6: crops that are not
// of the new season wither when it changes, going to bed by midnight restores full energy (Day Cycle
// page), rain waters crops, several summer crops keep producing after the first harvest (Crops page),
// and wild trees do not grow in winter (Trees page).

// [season, day, keepsake item ID or null, letter text, title]
export const LETTERS = [
  ['spring', 3, '(O)309',
    "My dear @,^^If this letter has found you, you've made it to the farm. I wrote a few letters long ago and left them with an old friend, to be posted one each season, so you'd have a little company from me.^^A word for the first weeks: don't plant more than you can water, get to bed by midnight, and say hello to your neighbors. The valley rewards patience.^^I've tucked in an acorn. Plant it somewhere you'll see it grow.^^   -Grandpa",
    "Grandpa's Spring Letter"],
  ['summer', 1, '(O)431',
    "Dear @,^^Summer already! The days are long and the soil is warm. Some summer crops keep giving all season once they're grown, so they're worth planting early. And when it rains, let the sky do your watering and take the day for yourself.^^When you need a rest, the river and the beach are fine company.^^Here's a sunflower seed, for a bit of cheer by the door.^^   -Grandpa",
    "Grandpa's Summer Letter"],
  ['fall', 1, '(O)310',
    "Dear @,^^Fall was always my favorite season on the farm. The woods are full of berries and mushrooms, and the air smells of woodsmoke.^^Mind the calendar: anything still in the field that can't take the cold will wither when winter comes, so plan your last planting with the days you have left.^^A maple seed is enclosed. Maples make the best shade.^^   -Grandpa",
    "Grandpa's Fall Letter"],
  ['winter', 1, '(O)311',
    "Dear @,^^Little grows outside in winter, and that's alright. Mend what needs mending, visit your friends, fish, explore. Rest is part of farming too.^^Keep warm, and don't forget to eat a proper meal.^^Here's a pine cone. Keep it until spring, then give it a spot of its own.^^   -Grandpa",
    "Grandpa's Winter Letter"],
  ['winter', 28, null,
    "My dear @,^^A whole year. By now you've seen every season on the farm, the busy ones and the quiet ones.^^This is the last of my letters. I hope the valley has started to feel like home, and that you found what I found here: good soil, good people and a little peace.^^The rest of the story is yours to write.^^With love,^   -Grandpa",
    "Grandpa's Last Letter"]
];

// the game's own Grandpa story must not be contradicted (see above)
const FORBIDDEN = /evaluat|shrine|candle|year (two|three|3)|come back|return|watching over|judge/i;

export default async function ({ items }) {
  const mail = {};
  const triggers = {};
  const i18n = {};
  const seen = new Set();
  for (const [season, day, keepsake, text, title] of LETTERS) {
    const name = `${season}${day}`;
    if (seen.has(name)) throw new Error(`two letters on ${season} ${day}`);
    seen.add(name);
    if (FORBIDDEN.test(text)) throw new Error(`${name}: "${text.match(FORBIDDEN)[0]}" touches Grandpa's evaluation story`);
    if (/%|\[#\]/.test(text + title)) throw new Error(`${name}: no mail commands in the text`);
    if (!text.trim().endsWith('-Grandpa')) throw new Error(`${name}: not signed by Grandpa`);
    if (keepsake && !items.items[keepsake]) throw new Error(`${keepsake} is not in items.json`);
    if (keepsake && !text.toLowerCase().includes(items.items[keepsake].toLowerCase().replace(/s$/, ''))) throw new Error(`${name}: the letter does not name its keepsake ${items.items[keepsake]}`);

    const id = `{{ModId}}_${season[0].toUpperCase()}${season.slice(1)}${day}`;
    i18n[`letter.${name}`] = text;
    i18n[`title.${name}`] = title;
    mail[id] = `{{i18n:letter.${name}}}${keepsake ? `%item id ${keepsake} 1 %%` : ''}[#]{{i18n:title.${name}}}`;
    triggers[id] = {
      Id: id,
      Trigger: 'DayStarted',
      Condition: `SEASON_DAY ${season} ${day}, YEAR 1 1`,
      Actions: [`AddMail Current ${id} Now`]
    };
  }
  return {
    'content.json': {
      Format: '2.9.0',
      Changes: [
        { LogName: "Grandpa's letters", Action: 'EditData', Target: 'Data/mail', Entries: mail },
        { LogName: 'Send them through the first year', Action: 'EditData', Target: 'Data/TriggerActions', Entries: triggers }
      ]
    },
    'i18n/default.json': i18n
  };
}
