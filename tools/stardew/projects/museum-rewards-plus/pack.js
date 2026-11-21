// Museum Rewards Plus: Gunther hands out ten more small rewards for donations to the museum, at
// donation milestones that the vanilla rewards do not use. Vanilla rewards are never edited or
// removed; the pack only adds new entries with its own IDs. Since 1.1 Gunther also sends a short
// thank-you letter the morning after each of these rewards has been collected.
//
// How it works (Stardew Valley 1.6, documented on the wiki, not run in the game):
// - Data/MuseumRewards is a string → model lookup; the key is a unique string ID for the reward
//   group. TargetContextTags is a list of { Tag, Count }: "The minimum number of items matching
//   the context tags that must be donated", and "The player must fulfill every entry in the list
//   to unlock the reward". RewardItemId is a qualified item ID, RewardItemCount the stack size.
//   FlagOnCompletion adds the ID to the player's received mail "to track whether the player has
//   collected the reward, and should almost always be true" (without it the reward could be
//   collected again and again). The wiki example gives an item for "item_type_minerals" with
//   Count 18 exactly this way.
//   https://stardewvalleywiki.com/Modding:Museum (revision 191457)
// - The groups use the automatic context tag item_type_<type>, "based on the Type field in
//   Data/Objects. The tag is checked in a few places (e.g. the museum to check if an item is an
//   artifact or mineral)" (https://stardewvalleywiki.com/Modding:Context_tags, revision 193554).
//   The vanilla types are Arch (artifact) and Minerals
//   (https://stardewvalleywiki.com/Modding:Objects, revision 193966, field Type), so the tags are
//   item_type_arch and item_type_minerals (lower case like the wiki example).
// - The entries are added with EditData "Entries" (Content Patcher docs, action-editdata.md);
//   {{ModId}} keeps every ID unique (tokens.md#ModId), so no vanilla key is ever touched.
// - FlagOnCompletion is set like the wiki recommends; the reward itself is handed over by Gunther
//   at his desk, like the vanilla ones.
// - 1.1, letters from Gunther: the morning after the player has collected one of the rewards above,
//   a short thank-you letter from Gunther waits in the mailbox, one per reward, sent once. The
//   letters only thank the player: no items or money (no %item / %action commands); the reward is
//   still the one from the museum desk.
//   - Letters are Data/mail entries ("<text>[#]<letter name>", @ = player name, ^ = line break),
//     text and title from i18n. https://stardewvalleywiki.com/Modding:Mail_data (revision
//     194194) and Content Patcher translations.md.
//   - Each letter is sent by one Data/TriggerActions entry: Trigger "DayStarted", Condition
//     "PLAYER_HAS_MAIL Current {{ModId}}_<reward>" and Action "AddMail Current <letter> Now".
//     The condition reads the flag the reward sets: FlagOnCompletion "add[s] the ID value to the
//     player's received mail. This is used to track whether the player has collected the reward"
//     (Modding:Museum, revision 191457). PLAYER_HAS_MAIL checks "the given mail flag"; its default
//     type Any includes the received list, and an ID without a Data/mail letter is "added to the
//     received list directly" (https://stardewvalleywiki.com/Modding:Game_state_queries#Player_info_.26_progress,
//     revision 193977). The letter IDs (…_Thanks_<reward>) are therefore never the reward IDs.
//   - No MarkActionApplied field: the default true runs each entry once per player ("the action
//     won't run again"), so every letter comes exactly once.
//     https://stardewvalleywiki.com/Modding:Trigger_actions#Data/TriggerActions (revision 190039)
//   - Why not MUSEUM_DONATIONS (the donation count query on the same page): the pack check in
//     tools/stardew/lib.js does not list it yet. The reward flag marks the same milestone, only
//     tied to the moment the reward is collected, which also suits a thank-you letter.
//
// Vanilla milestones (https://stardewvalleywiki.com/Museum, "Donation Rewards", revision 190472):
// total donations 5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 90, 95; minerals 11, 21, 31, 41,
// 50; artifacts 15, 20, and 3, 5 or 11 artifacts together with specific artifacts. 53 minerals and
// 42 artifacts can be donated. The new milestones below avoid every one of these counts.

export const TAGS = { minerals: 'item_type_minerals', artifacts: 'item_type_arch' };
export const TOTALS = { minerals: 53, artifacts: 42 };
export const VANILLA_COUNTS = { minerals: [11, 21, 31, 41, 50], artifacts: [3, 5, 11, 15, 20] };

// ID suffix → { needs: { group: count }, item: name, count } (items: tools/stardew/data/items.json)
export const REWARDS = {
  Minerals06: { needs: { minerals: 6 }, item: 'Geode', count: 3 },
  Minerals16: { needs: { minerals: 16 }, item: 'Frozen Geode', count: 3 },
  Minerals26: { needs: { minerals: 26 }, item: 'Magma Geode', count: 3 },
  Minerals36: { needs: { minerals: 36 }, item: 'Omni Geode', count: 2 },
  Minerals46: { needs: { minerals: 46 }, item: 'Gold Bar', count: 3 },
  Artifacts06: { needs: { artifacts: 6 }, item: 'Clay', count: 20 },
  Artifacts10: { needs: { artifacts: 10 }, item: 'Mixed Seeds', count: 10 },
  Artifacts25: { needs: { artifacts: 25 }, item: 'Rare Seed', count: 1 },
  Artifacts35: { needs: { artifacts: 35 }, item: 'Artifact Trove', count: 1 },
  Collector10: { needs: { minerals: 10, artifacts: 10 }, item: 'Blueberry Seeds', count: 9 }
};
// Upper bound per reward stack (fair values: small rewards, no item flood).
export const MAX_COUNT = 20;

// 1.1: one thank-you letter per reward: suffix → [title, text] (@ = player name, ^ = line break,
// signed by Gunther). Written in Gunther's polite, slightly scholarly voice.
export const LETTERS = {
  Minerals06: ['A Sparkling Start',
    'Dear @,^^Six minerals now rest in the museum cases, and I could not resist polishing the glass twice last night.^^I hope the geodes I gave you hold something wonderful. Perhaps one of them hides the next piece for our collection.'],
  Minerals16: ['Sixteen and Counting',
    'Dear @,^^With sixteen minerals donated, the mineral shelves finally look like a real collection. Visitors have started to stop and stare, which delights me.^^The frozen geodes come from the colder depths of the mines. I am curious what you will find inside.'],
  Minerals26: ['A Fiery Collection',
    'Dear @,^^Twenty-six minerals! I have started writing new labels for the cases, and my handwriting has never been neater.^^I hope the magma geodes bring you something as bright as the stones you have shared with us.'],
  Minerals36: ['A Little Mystery',
    'Dear @,^^Thirty-six minerals in the collection. When I started working here, I could only dream of such a number.^^Omni geodes are my favorite kind of puzzle: no one knows what waits inside until it is opened. Enjoy the surprise.'],
  Minerals46: ['Nearly Complete',
    'Dear @,^^Forty-six minerals! Only a handful of empty spaces remain on the mineral shelves, and I check them every morning.^^I hope the gold bars prove useful. Clint will surely know what to make of them.'],
  Artifacts06: ['Pieces of the Past',
    'Dear @,^^Six artifacts already! Each one tells a small story about the people who lived in this valley long before us.^^The clay is a humble gift, I know, but a great deal of history began as clay. I hope it serves you well.'],
  Artifacts10: ['Old Fields, New Seeds',
    'Dear @,^^Ten artifacts are now on display. I like to imagine that the people of the past farmed the very same soil as you do.^^May the mixed seeds grow into something unexpected. That is half the fun of farming, I am told.'],
  Artifacts25: ['A Rare Find',
    'Dear @,^^Twenty-five artifacts! The museum has never had so many visitors asking questions, and I have never been happier to answer them.^^The rare seed is a curious thing. Plant it in the fall and see what it becomes.'],
  Artifacts35: ['A Treasure to Open',
    'Dear @,^^Thirty-five artifacts! Our little museum is becoming a true archive of the history of the valley.^^Clint can open the artifact trove for you. I confess I already wonder whether something inside will find its way into my cases.'],
  Collector10: ['Two Halves of a Museum',
    'Dear @,^^Ten minerals and ten artifacts! Both halves of the museum are growing side by side, just as I always hoped.^^I hope the blueberry seeds bring you a sweet summer harvest.']
};
export const SIGNATURE = '^^With warm thanks,^-Gunther';
export const letterId = suffix => `{{ModId}}_Thanks_${suffix}`;

export default async function ({ items }) {
  const idOf = {};
  for (const [id, name] of Object.entries(items.items)) if (!(name in idOf)) idOf[name] = id;
  const entries = {};
  const seen = new Set();
  for (const [suffix, { needs, item, count }] of Object.entries(REWARDS)) {
    const id = idOf[item];
    if (!id) throw new Error(`${suffix}: ${item} is not in items.json`);
    if (!(Number.isInteger(count) && count >= 1 && count <= MAX_COUNT)) throw new Error(`${suffix}: count ${count} is outside 1 to ${MAX_COUNT}`);
    if (!Object.keys(needs).length) throw new Error(`${suffix}: no requirement`);
    for (const [group, n] of Object.entries(needs)) {
      if (!TAGS[group]) throw new Error(`${suffix}: unknown group ${group}`);
      if (!(Number.isInteger(n) && n >= 1 && n < TOTALS[group])) throw new Error(`${suffix}: ${n} ${group} is outside 1 to ${TOTALS[group] - 1}`);
      if (VANILLA_COUNTS[group].includes(n)) throw new Error(`${suffix}: vanilla already rewards ${n} ${group}`);
    }
    const key = JSON.stringify(Object.entries(needs).sort());
    if (seen.has(key)) throw new Error(`${suffix}: another reward has the same milestone`);
    seen.add(key);
    entries[`{{ModId}}_${suffix}`] = {
      TargetContextTags: Object.entries(needs).map(([group, n]) => ({ Tag: TAGS[group], Count: n })),
      RewardItemId: id,
      RewardItemCount: count,
      FlagOnCompletion: true
    };
  }

  // 1.1: Gunther's thank-you letters, one per reward
  const mail = {};
  const triggers = {};
  const i18n = {};
  const titles = new Set();
  for (const suffix of Object.keys(LETTERS)) if (!REWARDS[suffix]) throw new Error(`letter ${suffix}: no reward with that ID`);
  for (const suffix of Object.keys(REWARDS)) {
    const [title, text] = LETTERS[suffix] || [];
    if (!title || !text) throw new Error(`${suffix}: Gunther's letter is missing`);
    if (/[%[\]¦{}#$]/.test(text + title)) throw new Error(`${suffix}: mail command characters in the letter (letters only thank, they attach nothing)`);
    if (!text.startsWith('Dear @,^^')) throw new Error(`${suffix}: letters greet the player by name`);
    if (titles.has(title)) throw new Error(`${suffix}: title "${title}" is used twice`);
    titles.add(title);
    const id = letterId(suffix);
    const flag = `{{ModId}}_${suffix}`;
    if (id === flag || entries[id]) throw new Error(`${suffix}: the letter ID must differ from the reward ID`);
    i18n[`letter.${suffix}`] = text + SIGNATURE;
    i18n[`title.${suffix}`] = title;
    mail[id] = `{{i18n:letter.${suffix}}}[#]{{i18n:title.${suffix}}}`;
    triggers[id] = {
      Id: id,
      Trigger: 'DayStarted',
      Condition: `PLAYER_HAS_MAIL Current ${flag}`,
      Actions: [`AddMail Current ${id} Now`]
    };
  }
  return {
    'content.json': {
      Format: '2.9.0',
      Changes: [
        {
          LogName: `Museum rewards (${Object.keys(entries).length} new)`,
          Action: 'EditData',
          Target: 'Data/MuseumRewards',
          Entries: entries
        },
        { LogName: "Gunther's thank-you letters", Action: 'EditData', Target: 'Data/mail', Entries: mail },
        { LogName: 'Send a thank-you letter the morning after a reward', Action: 'EditData', Target: 'Data/TriggerActions', Entries: triggers }
      ]
    },
    'i18n/default.json': i18n
  };
}
