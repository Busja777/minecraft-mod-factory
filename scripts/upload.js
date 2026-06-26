import fs from 'fs';
import FormData from 'form-data';

const mod = JSON.parse(fs.readFileSync('./generated-mod.json', 'utf-8'));

const libsDir = './template/build/libs';
const jarFile = fs.readdirSync(libsDir)
  .find(f => f.endsWith('.jar') && !f.includes('sources') && !f.includes('javadoc'));
if (!jarFile) throw new Error('No .jar found in template/build/libs/');
const jarPath = `${libsDir}/${jarFile}`;
console.log(`Found jar: ${jarFile}`);

async function uploadCurseForge() {
  const projectIds = (process.env.CF_PROJECT_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!projectIds.length) throw new Error('CF_PROJECT_IDS is empty');

  const usedPath = './data/used-cf-projects.json';
  const used = fs.existsSync(usedPath) ? JSON.parse(fs.readFileSync(usedPath, 'utf-8')) : [];
  const projectId = projectIds.find(id => !used.includes(id));
  if (!projectId) throw new Error('All CurseForge project IDs used. Add more to CF_PROJECT_IDS.');

  // CF game versions endpoint is unreliable; use empty array so CurseForge
  // falls back to the project's default game versions.
  const metadata = {
    changelog: mod.changelog,
    changelogType: 'markdown',
    displayName: `${mod.name} v1.0.0`,
    gameVersions: [],
    releaseType: process.env.RELEASE_TYPE || 'alpha'
  };

  const form = new FormData();
  form.append('metadata', JSON.stringify(metadata));
  form.append('file', fs.createReadStream(jarPath), { filename: jarFile });

  const res = await fetch(`https://minecraft.curseforge.com/api/projects/${projectId}/upload-file`, {
    method: 'POST',
    headers: { 'X-Api-Token': process.env.CF_API_TOKEN, ...form.getHeaders() },
    body: form
  });
  if (!res.ok) throw new Error(`CurseForge upload failed (${res.status}): ${await res.text()}`);

  used.push(projectId);
  fs.writeFileSync(usedPath, JSON.stringify(used, null, 2));
  const result = await res.json();
  console.log(`CurseForge ✓ — project ${projectId}, file ${result.id}`);
}

async function uploadModrinth() {
  const slug = `${mod.modId}-${Date.now()}`.slice(0, 64);

  const projectForm = new FormData();
  projectForm.append('data', JSON.stringify({
    slug,
    title: mod.name,
    description: mod.description,
    categories: ['utility'],
    client_side: 'optional',
    server_side: 'optional',
    body: `# ${mod.name}\n\n${mod.description}\n\n## Changelog\n\n${mod.changelog}`,
    project_type: 'mod',
    license_id: 'MIT',
    is_draft: false
  }));

  const projectRes = await fetch('https://api.modrinth.com/v2/project', {
    method: 'POST',
    headers: { 'Authorization': process.env.MODRINTH_API_TOKEN, ...projectForm.getHeaders() },
    body: projectForm
  });
  if (!projectRes.ok) throw new Error(`Modrinth project creation failed (${projectRes.status}): ${await projectRes.text()}`);
  const project = await projectRes.json();
  console.log(`Modrinth project created: ${project.id}`);

  for (const [filename, title] of [['screenshot1.png', 'Feature showcase'], ['screenshot2.png', 'UI overview']]) {
    if (!fs.existsSync(`./images/${filename}`)) continue;
    const imgForm = new FormData();
    imgForm.append('ext', 'png');
    imgForm.append('featured', 'true');
    imgForm.append('title', title);
    imgForm.append('image', fs.createReadStream(`./images/${filename}`), { filename });
    const galleryRes = await fetch(`https://api.modrinth.com/v2/project/${project.id}/gallery`, {
      method: 'POST',
      headers: { 'Authorization': process.env.MODRINTH_API_TOKEN, ...imgForm.getHeaders() },
      body: imgForm
    });
    if (galleryRes.ok) console.log(`Modrinth gallery: ${filename}`);
  }

  const versionForm = new FormData();
  const versionData = {
    name: 'v1.0.0',
    version_number: '1.0.0',
    changelog: mod.changelog,
    dependencies: [{ project_id: 'P7dR8mSH', dependency_type: 'required' }],
    game_versions: ['1.21.1'],
    version_type: process.env.RELEASE_TYPE || 'alpha',
    loaders: ['fabric'],
    featured: true,
    project_id: project.id,
    file_parts: ['file']
  };
  versionForm.append('data', JSON.stringify(versionData));
  versionForm.append('file', fs.createReadStream(jarPath), { filename: jarFile });

  const versionRes = await fetch('https://api.modrinth.com/v2/version', {
    method: 'POST',
    headers: { 'Authorization': process.env.MODRINTH_API_TOKEN, ...versionForm.getHeaders() },
    body: versionForm
  });
  if (!versionRes.ok) throw new Error(`Modrinth version upload failed (${versionRes.status}): ${await versionRes.text()}`);
  console.log(`Modrinth ✓ — https://modrinth.com/mod/${slug}`);
}

await uploadCurseForge().catch(e => console.error('CurseForge error (non-fatal):', e.message));
await uploadModrinth().catch(e => console.error('Modrinth error (non-fatal):', e.message));
