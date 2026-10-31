import fs from 'fs';
import path from 'path';
import { loadMod, modDir } from './lib/mods.js';
import { arg } from './lib/github-output.js';

// Writes the "project creation kit" for a stored mod: data/mods/<id>/kit.md plus
// ./kit-issue.json, which the workflow turns into a GitHub issue for the manual step.
const modId = arg(process.argv.slice(2), '--mod');
if (!modId) throw new Error('Usage: node scripts/kit.js --mod <modId>');

const { meta } = loadMod(modId);
const repo = process.env.GITHUB_REPOSITORY || 'Busja777/minecraft-mod-factory';
const branch = process.env.GITHUB_REF_NAME || 'main';
const iconUrl = `https://github.com/${repo}/blob/${branch}/data/mods/${modId}/icon.png?raw=true`;
const alt = (meta.altNames || []).length ? meta.altNames.join(' · ') : '—';

const kit = `# Projekt-Kit: ${meta.name}

Dieses Kit enthält alles, um das CurseForge-Projekt in 2–3 Minuten anzulegen.

## Checkliste
1. https://authors.curseforge.com → **Start Project** → Minecraft → **Mods**
2. Name: **${meta.name}** (Ausweichnamen, falls vergeben: ${alt})
3. Summary (Kurzbeschreibung): ${meta.description}
4. Kategorie: **${meta.cfCategory}** (Mod Loader: Fabric · Game Version: 1.21.1)
5. Lizenz: MIT
6. Icon (400×400): [icon.png](${iconUrl}) herunterladen und hochladen
7. Beschreibung: Markdown unten einfügen
8. Projekt speichern, numerische **Project ID** aus der URL/Settings kopieren
9. In \`data/cf-projects.json\` beim Eintrag \`"modId": "${modId}"\` setzen: \`"projectId": <ID>\` (und optional \`"cfName"\`), committen, pushen → der Upload läuft automatisch.

## Beschreibung (Markdown)

${meta.pageDescription}

---
*Features:* ${(meta.features || []).join(', ')}
`;

fs.writeFileSync(path.join(modDir(modId), 'kit.md'), kit);

const issue = {
  title: `CurseForge-Projekt anlegen: ${meta.name} (${modId})`,
  labels: ['cf-project-needed'],
  body: `${kit}

---
Kit-Datei: \`data/mods/${modId}/kit.md\` · Quellcode: \`data/mods/${modId}/ModMain.java\`

Nach dem Eintragen der Project ID und dem Push schließt der Workflow **publish-pending** dieses Issue automatisch.`
};
fs.writeFileSync('./kit-issue.json', JSON.stringify(issue, null, 2));
console.log(`Kit written: data/mods/${modId}/kit.md and ./kit-issue.json`);
