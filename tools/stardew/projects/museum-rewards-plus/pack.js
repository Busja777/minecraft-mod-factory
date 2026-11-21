// Museum Rewards Plus: Gunther hands out ten more small rewards for donations to the museum, at
// donation milestones that the vanilla rewards do not use. Vanilla rewards are never edited or
// removed; the pack only adds new entries with its own IDs.
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
// - No letter: vanilla rewards are handed over by Gunther directly; FlagOnCompletion is the only
//   flag the format has and is set like the wiki recommends.
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
  return {
    'content.json': {
      Format: '2.9.0',
      Changes: [
        {
          LogName: `Museum rewards (${Object.keys(entries).length} new)`,
          Action: 'EditData',
          Target: 'Data/MuseumRewards',
          Entries: entries
        }
      ]
    }
  };
}
