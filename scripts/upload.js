import fs from 'fs';
import FormData from 'form-data';

// L1: Always use form.getBuffer() with Node.js native fetch — never body: form (stream)
// L2: Modrinth needs initial_versions + jar in ONE request
// L3: Modrinth gallery uses query params + raw image body, not multipart

const mod = JSON.parse(fs.readFileSync('./generated-mod.json', 'utf-8'));

const libsDir = './template/build/libs';
const jarFile = fs.readdirSync(libsDir)
  .find(f => f.endsWith('.jar') && !f.includes('sources') && !f.includes('javadoc'));
if (!jarFile) throw new Error('No .jar found in template/build/libs/');
const jarPath = `${libsDir}/${jarFile}`;
const jarBytes = fs.readFileSync(jarPath);
console.log(`Found jar: ${jarFile} (${(jarBytes.length / 1024).toFixed(0)} KB)`);

async function uploadCurseForge() {
  const projectIds = (process.env.CF_PROJECT_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!projectIds.length) throw new Error('CF_PROJECT_IDS is empty');

  const usedPath = './data/used-cf-projects.json';
  const used = fs.existsSync(usedPath) ? JSON.parse(fs.readFileSync(usedPath, 'utf-8')) : [];
  const projectId = projectIds.find(id => !used.includes(id));
  if (!projectId) throw new Error('All CurseForge project IDs used — add more to CF_PROJECT_IDS secret.');

  const form = new FormData();
  form.append('metadata', JSON.stringify({
    changelog: mod.changelog,
    changelogType: 'markdown',
    displayName: `${mod.name} v1.0.0`,
    gameVersions: [],
    releaseType: process.env.RELEASE_TYPE || 'alpha'
  }), { contentType: 'application/json' });
  form.append('file', jarBytes, { filename: jarFile, contentType: 'application/java-archive' });

  const res = await fetch(`https://minecraft.curseforge.com/api/projects/${projectId}/upload-file`, {
    method: 'POST',
    headers: { 'X-Api-Token': process.env.CF_API_TOKEN, ...form.getHeaders() },
    body: form.getBuffer()
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status}): ${await res.text()}`);

  used.push(projectId);
  fs.writeFileSync(usedPath, JSON.stringify(used, null, 2));
  const result = await res.json();
  console.log(`CurseForge ✓ — project ${projectId}, file ${result.id}`);
}

async function uploadModrinth() {
  const slug = `${mod.modId}-${Date.now()}`.slice(0, 64);

  const profileUrl = 'https://modrinth.com/user/madeforaisimba';
  const body = [
    `# ${mod.name}`,
    '',
    mod.description,
    '',
    '## Changelog',
    '',
    mod.changelog,
    '',
    '---',
    `*Crafted by SevFactory · [See all mods](${profileUrl})*`
  ].join('\n');

  const form = new FormData();
  form.append('data', JSON.stringify({
    slug,
    title: mod.name,
    description: mod.description,
    categories: ['utility'],
    client_side: 'optional',
    server_side: 'optional',
    body,
    project_type: 'mod',
    license_id: 'MIT',
    is_draft: false,
    link_urls: { issues: 'https://github.com/Busja777/minecraft-mod-factory/issues' },
    initial_versions: [{
      name: 'v1.0.0',
      version_number: '1.0.0',
      changelog: mod.changelog,
      dependencies: [{ project_id: 'P7dR8mSH', dependency_type: 'required' }],
      game_versions: ['1.21.1'],
      version_type: process.env.RELEASE_TYPE || 'alpha',
      loaders: ['fabric'],
      featured: true,
      file_parts: ['mod-file']
    }]
  }), { contentType: 'application/json', filename: 'data.json' });
  form.append('mod-file', jarBytes, { filename: jarFile, contentType: 'application/java-archive' });
  if (fs.existsSync('./images/icon.png')) {
    form.append('icon', fs.readFileSync('./images/icon.png'), { filename: 'icon.png', contentType: 'image/png' });
  }

  const projectRes = await fetch('https://api.modrinth.com/v2/project', {
    method: 'POST',
    headers: { 'Authorization': process.env.MODRINTH_API_TOKEN, ...form.getHeaders() },
    body: form.getBuffer()
  });
  if (!projectRes.ok) throw new Error(`Project creation failed (${projectRes.status}): ${await projectRes.text()}`);
  const project = await projectRes.json();
  console.log(`Modrinth ✓ — https://modrinth.com/mod/${slug}`);

  for (const [filename, title] of [['screenshot1.png', 'Feature showcase'], ['screenshot2.png', 'UI overview']]) {
    if (!fs.existsSync(`./images/${filename}`)) continue;
    const params = new URLSearchParams({ ext: 'png', featured: 'false', title });
    const galleryRes = await fetch(`https://api.modrinth.com/v2/project/${project.id}/gallery?${params}`, {
      method: 'POST',
      headers: { 'Authorization': process.env.MODRINTH_API_TOKEN, 'Content-Type': 'image/png' },
      body: fs.readFileSync(`./images/${filename}`)
    });
    if (galleryRes.ok) console.log(`Modrinth gallery ✓ — ${filename}`);
    else console.log(`Modrinth gallery warning (${galleryRes.status}): ${await galleryRes.text()}`);
  }
}

await uploadCurseForge().catch(e => console.error('CurseForge error (non-fatal):', e.message));
await uploadModrinth().catch(e => console.error('Modrinth error (non-fatal):', e.message));
