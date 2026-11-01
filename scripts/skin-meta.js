import fs from 'fs';
import path from 'path';
import { callTool } from './lib/claude.js';
import { loadPack, savePack, packDir } from './lib/skinpacks.js';
import { arg, flag } from './lib/github-output.js';

// Writes the story and store texts of a skin pack via Claude, looking at the real skin renders:
// legend, one-sentence summary, alternative names, logo/cover prompts and a short note per version.
// Existing texts are kept unless --force. node scripts/skin-meta.js --pack <slug> [--force]
const argv = process.argv.slice(2);
const slug = arg(argv, '--pack');
if (!slug) throw new Error('Usage: node scripts/skin-meta.js --pack <slug> [--force]');
const force = flag(argv, '--force');
const pack = loadPack(slug);
const dir = packDir(slug);

const needPackTexts = force || !pack.legend || !pack.summary || !pack.logoPrompt || !pack.coverPrompt;
const needNotes = pack.versions.filter(v => force || !v.note);
if (!needPackTexts && !needNotes.length) { console.log(`${slug}: all texts present`); process.exit(0); }

const images = pack.versions
  .filter(v => v.media?.[0] && fs.existsSync(path.join(dir, v.media[0])))
  .slice(0, 6)
  .map(v => ({ data: fs.readFileSync(path.join(dir, v.media[0])).toString('base64') }));

const versionList = pack.versions.map((v, i) =>
  `- V${v.version}${v.title ? ` "${v.title}"` : ''} (image ${i + 1}): ${v.skins.map(s => s.name).join(', ')}`).join('\n');

const result = await callTool({
  tool: {
    name: 'write_pack_texts',
    description: 'Store texts for a Minecraft Bedrock skin pack on CurseForge.',
    input_schema: {
      type: 'object',
      properties: {
        legend: { type: 'string', description: 'Mini story ("legend") of the pack in English, 80-150 words, mysterious and atmospheric, names 2-3 of the skins, ends with a teaser. No markdown headings.' },
        summary: { type: 'string', description: 'ONE English teaser line, max 120 characters, in the style of "These are glowing samurai. It seems like there is more than just skill inside ..."; NO skin counts or version numbers (they change with every update); must not copy the legend.' },
        altNames: { type: 'array', items: { type: 'string' }, description: 'Exactly 2 alternative CurseForge project names, without the words skin, pack, minecraft or version.' },
        logoPrompt: { type: 'string', description: 'Image prompt for a square logo: one character from the pack as a blocky Minecraft-style figure, dramatic glow, dark background, NO text.' },
        coverPrompt: { type: 'string', description: 'Image prompt for a wide cover: 3 characters of the pack side by side as blocky Minecraft-style figures in their exact glow colours, cinematic background, with the title text in big stylised letters.' },
        notes: {
          type: 'array',
          description: 'One entry per requested version.',
          items: {
            type: 'object',
            properties: {
              version: { type: 'string' },
              note: { type: 'string', description: 'One or two English sentences on what this release adds, in the voice of the legend.' }
            },
            required: ['version', 'note'],
            additionalProperties: false
          }
        }
      },
      required: ['legend', 'summary', 'altNames', 'logoPrompt', 'coverPrompt', 'notes'],
      additionalProperties: false
    }
  },
  images,
  effort: 'medium',
  maxTokens: 8000,
  prompt: `The images show 3D renders of every release of the Minecraft Bedrock skin pack "${pack.name}" (in-game pack name "${pack.packName}"), in this order:
${versionList}

Write the store texts for its CurseForge page. Look closely at the renders: colours, armour, eyes and glow patterns must match what you see. Keep the tone of the skin names (e.g. Japanese terms with English epithets).
Write notes for these versions: ${needNotes.map(v => v.version).join(', ') || 'none (return an empty list)'}.
Call the write_pack_texts tool with the result.`
});

if (needPackTexts) {
  Object.assign(pack, { legend: result.legend.trim(), summary: result.summary.trim(), altNames: result.altNames.slice(0, 2), logoPrompt: result.logoPrompt, coverPrompt: result.coverPrompt });
}
for (const { version, note } of result.notes) {
  const v = pack.versions.find(x => x.version === version.replace(/^V/i, ''));
  if (v && (force || !v.note)) v.note = note.trim();
}
savePack(pack);
console.log(`${slug}: legend ${pack.legend.split(/\s+/).length} words, summary "${pack.summary}"`);
for (const v of pack.versions) console.log(`  V${v.version}: ${v.note || '(no note)'}`);
