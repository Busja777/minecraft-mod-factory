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
  form.append('metadata', JSON.stringify(metadata), { contentType: 'application/json' });
  form.append('file', fs.readFileSync(jarPath), { filename: jarFile, contentType: 'application/java-archive' });

  const res = await fetch(`https://minecraft.curseforge.com/api/projects/${projectId}/upload-file`, {
    method: 'POST',
    headers: { 'X-Api-Token': process.env.CF_API_TOKEN, ...form.getHeaders() },
    body: form.getBuffer()
  });
  if (!res.ok) throw new Error(`CurseForge upload failed (${res.status}): ${await res.text()}`);

  used.push(projectId);
  fs.writeFileSync(usedPath, JSON.stringify(used, null, 2));
  const result = await res.json();
  console.log(`CurseForge ✓ — project ${projectId}, file ${result.id}`);
}

function streamToBuffer(form) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    form.on('data', c => chunks.push(c));
    form.on('end', () => resolve(Buffer.concat(chunks)));
    form.on('error', reject);
  });
}

async function uploadModrinth() {
  const slug = `${mod.modId}-${Date.now()}`.slice(0, 64);

  // Modrinth requires initial_versions + the jar file in one single multipart POST
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
    is_draft: false,
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
  projectForm.append('mod-file', fs.readFileSync(jarPath), { filename: jarFile, contentType: 'application/java-archive' });

  const projectRes = await fetch('https://api.modrinth.com/v2/project', {
    method: 'POST',
    headers: { 'Authorization': process.env.MODRINTH_API_TOKEN, ...projectForm.getHeaders() },
    body: projectForm.getBuffer()
  });
  if (!projectRes.ok) throw new Error(`Modrinth project creation failed (${projectRes.status}): ${await projectRes.text()}`);
  const project = await projectRes.json();
  console.log(`Modrinth ✓ — https://modrinth.com/mod/${slug}`);

  for (const [filename, title] of [['screenshot1.png', 'Feature showcase'], ['screenshot2.png', 'UI overview']]) {
    if (!fs.existsSync(`./images/${filename}`)) continue;
    const imgData = fs.readFileSync(`./images/${filename}`);
    const params = new URLSearchParams({ ext: 'png', featured: 'false', title });
    const galleryRes = await fetch(`https://api.modrinth.com/v2/project/${project.id}/gallery?${params}`, {
      method: 'POST',
      headers: { 'Authorization': process.env.MODRINTH_API_TOKEN, 'Content-Type': 'image/png' },
      body: imgData
    });
    if (galleryRes.ok) console.log(`Modrinth gallery: ${filename}`);
    else console.log(`Modrinth gallery warning (${galleryRes.status}): ${await galleryRes.text()}`);
  }
}

await uploadCurseForge().catch(e => console.error('CurseForge error (non-fatal):', e.message));
await uploadModrinth().catch(e => console.error('Modrinth error (non-fatal):', e.message));
