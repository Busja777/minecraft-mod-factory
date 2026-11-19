// What the CurseForge project page already shows, compared with what has been released.
// The file upload has an API, the description does not, so after each upload the description
// "lags behind" until the operator saved it once with the browser helper (npm run cf -- seite).
// The gallery is NOT part of this: for skin packs it only gets images when a project is new
// (cover titled MCPEDL); screenshots of updates belong in the description.
// Pure functions: the HTML comes from the Core API (platforms/curseforge-core.js).

const minor = version => Number(String(version).split('.')[1]);
const ENTITIES = { '&nbsp;': ' ', '&amp;': '&', '&quot;': '"', '&#39;': "'", '&#x27;': "'", '&apos;': "'", '&lt;': '<', '&gt;': '>' };

// HTML → lower-case plain text with single spaces (CurseForge stores the description as HTML).
export function plainText(html) {
  return String(html || '')
    .replace(/<\/?(b|i|em|strong|span|a|u|s|code)\b[^>]*>/gi, '') // inline tags sit inside words and sentences
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(nbsp|amp|quot|apos|lt|gt|#39|#x27);/gi, m => ENTITIES[m.toLowerCase()] || ' ')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

export const publishedSorted = pack => pack.versions.filter(v => v.status === 'published').sort((a, b) => minor(a.version) - minor(b.version));
export const latestPublished = pack => publishedSorted(pack).at(-1) || null;

// The base release counts as "on the page" when the description starts with our legend; an update
// when its "Added in V1.x" heading is there.
const squash = text => text.replace(/[^a-z0-9]+/g, '');

function describes(text, pack, v) {
  if (minor(v.version) === 0) {
    // punctuation and spacing differ between our Markdown and CurseForge's HTML, letters do not
    const opening = squash(plainText(pack.legend)).slice(0, 40);
    return opening.length >= 20 && squash(text).includes(opening);
  }
  return new RegExp(`added in v${v.version.replace('.', '\\.')}(?!\\d)`).test(text);
}

// → { descriptionThrough, externalImages, hostedImages }
//   descriptionThrough: newest published version the description already covers (null = none)
//   externalImages / hostedImages: description images still loaded from GitHub vs. copied to CurseForge
export function pageState(pack, { html = '' } = {}) {
  const text = plainText(html);
  let descriptionThrough = null;
  for (const v of publishedSorted(pack)) if (describes(text, pack, v)) descriptionThrough = v.version;
  const sources = [...String(html).matchAll(/<img[^>]+src="([^"]+)"/gi)].map(m => m[1]);
  return {
    descriptionThrough,
    externalImages: sources.filter(s => /githubusercontent\.com/i.test(s)).length,
    hostedImages: sources.filter(s => /forgecdn\.net/i.test(s)).length
  };
}

// Only releases that went through the pipeline ask for a follow-up, and only once their file is on
// CurseForge (fileId): versions merely found there by the sync keep their hand-written page, and a
// file still waiting for a manual upload comes first.
export function tracksPage(pack) {
  const latest = latestPublished(pack);
  return !!latest && latest.manual !== undefined && !!latest.fileId;
}

// Is the description behind the newest release? pack.page is the last pageState (null = never checked).
// → null when it is up to date, else { version, filled: bool }
export function pageBehind(pack) {
  const latest = latestPublished(pack);
  if (!latest || !Number.isInteger(pack.cfProjectId)) return null;
  if (!tracksPage(pack)) return null;
  const page = pack.page || {};
  if (page.descriptionThrough === latest.version) return null;
  // filled: the helper already put this version into the form; CurseForge just does not show it yet.
  return { version: latest.version, filled: page.filled?.version === latest.version };
}
