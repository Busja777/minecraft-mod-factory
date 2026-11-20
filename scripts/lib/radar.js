// The day-one machine, pure parts: what is new at the sources, and what a new game version adds.
// scripts/radar.js does the fetching, building and writing.

// Mojang's version manifest → the newest release and, when one is newer than it, the newest test version.
export function latestJava(manifest) {
  const { release, snapshot } = manifest.latest;
  return { release, snapshot: snapshot && snapshot !== release ? snapshot : null };
}

// GitHub releases of Mojang/bedrock-samples (newest first) → { release, preview } tag names.
export function latestBedrockSamples(releases) {
  const tags = releases.map(r => r.tag_name).filter(Boolean);
  return { release: tags.find(t => !/preview/i.test(t)) || null, preview: tags.find(t => /preview/i.test(t)) || null };
}

// What changed against the baseline in data/radar/versions.json. Only keys present in `now` are
// compared, so a source that could not be read today is not reported as a change.
export function changes(baseline, now) {
  const out = [];
  for (const [source, values] of Object.entries(now)) {
    for (const [key, to] of Object.entries(values)) {
      const from = baseline?.[source]?.[key] ?? null;
      if (to !== undefined && from !== to) out.push({ source, key, from, to });
    }
  }
  return out;
}

// The baseline with today's values written over it; sources and notes that were not read stay.
export function merged(baseline, now, date) {
  const out = { ...baseline, checked: date };
  for (const [source, values] of Object.entries(now)) out[source] = { ...(baseline[source] || {}), ...values };
  return out;
}

// ids that `after` has and `before` does not, sorted.
export const added = (before, after) => [...after].filter(id => !before.has(id)).sort();

// What the next Minecraft version brings, per registry: { item: [...], block: [...], … } (empty lists left out).
export function nextContent(before, after) {
  const out = {};
  for (const name of Object.keys(after)) {
    const list = added(before[name] || new Set(), after[name]);
    if (list.length) out[name] = list;
  }
  return out;
}

// One line per pack and version for the console and the report issue.
export function compatLine(slug, version, result) {
  if (result.ok) return `✓ ${slug} on ${version}${result.loaded ? ' (loaded by the game)' : ' (checked against the data)'}`;
  return `✗ ${slug} on ${version}: ${result.problems.length + (result.more || 0)} problem(s), first: ${String(result.problems[0]).slice(0, 200)}`;
}
