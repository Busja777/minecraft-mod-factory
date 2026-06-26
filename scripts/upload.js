import fs from 'fs';
import FormData from 'form-data';

// L1: Always use form.getBuffer() with Node.js native fetch — never body: form (stream)
// L2: Modrinth needs initial_versions + jar in ONE multipart POST
// L3: Modrinth gallery uses query params + raw image body, not multipart

const mod = JSON.parse(fs.readFileSync('./generated-mod.json', 'utf-8'));

const libsDir = './template/build/libs';
const jarFile = fs.readdirSync(libsDir)
  .find(f => f.endsWith('.jar') && !f.includes('sources') && !f.includes('javadoc'));
if (!jarFile) throw new Error('No .jar found in template/build/libs/');
const jarBytes = fs.readFileSync(`${libsDir}/${jarFile}`);
console.log(`Jar: ${jarFile} (${(jarBytes.length / 1024).toFixed(0)} KB)`);

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
  console.log('Icon: attached');
}

const projectRes = await fetch('https://api.modrinth.com/v2/project', {
  method: 'POST',
  headers: { 'Authorization': process.env.MODRINTH_API_TOKEN, ...form.getHeaders() },
  body: form.getBuffer()
});
if (!projectRes.ok) throw new Error(`Project creation failed (${projectRes.status}): ${await projectRes.text()}`);
const project = await projectRes.json();
console.log(`Modrinth project created: https://modrinth.com/mod/${slug}`);

for (const [filename, title] of [['screenshot1.png', 'Feature showcase'], ['screenshot2.png', 'UI overview']]) {
  if (!fs.existsSync(`./images/${filename}`)) { console.log(`${filename}: not found, skipping`); continue; }
  const params = new URLSearchParams({ ext: 'png', featured: 'false', title });
  const res = await fetch(`https://api.modrinth.com/v2/project/${project.id}/gallery?${params}`, {
    method: 'POST',
    headers: { 'Authorization': process.env.MODRINTH_API_TOKEN, 'Content-Type': 'image/png' },
    body: fs.readFileSync(`./images/${filename}`)
  });
  if (res.ok) console.log(`Gallery: ${filename} uploaded`);
  else console.log(`Gallery warning (${res.status}): ${await res.text()}`);
}

const publishedPath = './data/published-mods.json';
const published = fs.existsSync(publishedPath) ? JSON.parse(fs.readFileSync(publishedPath, 'utf-8')) : [];
published.push({
  name: mod.name,
  modId: mod.modId,
  description: mod.description,
  features: mod.features || [],
  publishedAt: new Date().toISOString(),
  modrinthSlug: slug
});
fs.writeFileSync(publishedPath, JSON.stringify(published, null, 2));
console.log(`Tracked in published-mods.json (${published.length} total)`);
