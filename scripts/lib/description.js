// Builds the CurseForge project description (Markdown) for mods and skin packs.
// Order (user spec): legend → AI note → base content → one section per update → install/compat.

export const AI_NOTE = '*(The logo and cover inside the gallery are AI-generated.)*';

const img = (url, alt) => `![${alt}](${url})`;

// "RAIJIN — Thunder Samurai" → "RAIJIN"
export function shortName(name) {
  return String(name).split(/\s+[—–-]\s+/)[0].trim();
}

export function versionLabel(version) {
  return `V${version}`;
}

export function updateHeading(v, kind) {
  const what = kind === 'skinpack' ? (v.skins || []).map(s => shortName(s.name)).join(', ') : (v.title || '');
  return `## Added in ${versionLabel(v.version)}${what ? `: ${what}` : ''}`;
}

export function renderUpdateSection(v, kind) {
  const parts = [updateHeading(v, kind)];
  if (v.note) parts.push(v.note);
  if (kind === 'skinpack' && v.skins?.length) parts.push(v.skins.map(s => `**${s.name}**`).join(' · '));
  for (const url of v.images || []) parts.push(img(url, `${versionLabel(v.version)} preview`));
  return parts.join('\n\n');
}

const SKIN_FOOTER = `## How to install
1. Download the **.mcpack** file and open it. Minecraft imports the pack automatically.
2. In Minecraft open **Dressing Room → Classic Skins** and pick a skin from the pack.

Made for Minecraft Bedrock Edition.`;

// versions: published + current versions in chronological order. The first one is the base release.
export function renderDescription({ kind, name, legend, versions = [], body = '', footer }) {
  if (!['mod', 'skinpack'].includes(kind)) throw new Error(`Unknown project kind "${kind}"`);
  if (!legend || !legend.trim()) throw new Error(`Description for ${name} needs a legend`);
  const [base, ...updates] = versions;
  const out = [`# ${name}`, legend.trim(), AI_NOTE];

  if (kind === 'skinpack') {
    if (!base) throw new Error(`Skin pack ${name} has no base version`);
    out.push(`## The Skins`);
    if (base.note) out.push(base.note);
    out.push(base.skins.map(s => `**${s.name}**`).join(' · '));
    for (const url of base.images || []) out.push(img(url, `${name} skins`));
  } else {
    if (body) out.push(body.trim());
    for (const url of base?.images || []) out.push(img(url, `${name} in-game`));
  }

  for (const v of updates) out.push(renderUpdateSection(v, kind));
  const foot = footer ?? (kind === 'skinpack' ? SKIN_FOOTER : '');
  if (foot) out.push(foot);
  return out.join('\n\n') + '\n';
}
