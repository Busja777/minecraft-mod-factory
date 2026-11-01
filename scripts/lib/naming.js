// File and URL naming shared by mods and skin packs.
// Images are named after the pack, matching the user's Graphics convention:
//   "<Name>.png" (logo) and "<Name> Cover.png" (gallery cover, titled "MCPEDL" on Bedrock).

const FORBIDDEN = /[\\/:*?"<>|\u0000-\u001f]/g;

export function fileBase(name) {
  const base = String(name || '').replace(FORBIDDEN, '').replace(/\s+/g, ' ').trim();
  if (!base) throw new Error(`Cannot derive a file name from "${name}"`);
  return base;
}

export const logoFileName = name => `${fileBase(name)}.png`;
export const coverFileName = name => `${fileBase(name)} Cover.png`;

export function slugify(name) {
  return String(name || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 64);
}

export function pascalCase(name) {
  return String(name || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ').split(/[^A-Za-z0-9]+/).filter(Boolean)
    .map(w => w[0].toUpperCase() + w.slice(1)).join('');
}

// Public raw URL for a repo file; every path segment is encoded (spaces, &, umlauts).
export function rawUrl(relPath, { repo = process.env.GITHUB_REPOSITORY || 'Busja777/minecraft-mod-factory', branch = process.env.GITHUB_REF_NAME || 'main' } = {}) {
  const clean = String(relPath).replace(/^\.?\//, '');
  return `https://raw.githubusercontent.com/${repo}/${branch}/${clean.split('/').map(encodeURIComponent).join('/')}`;
}
