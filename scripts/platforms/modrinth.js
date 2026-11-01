import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

// Modrinth v2 — creates a NEW project with its first version in one multipart request.
// Kept for when PLATFORMS includes "modrinth" again; behaviour unchanged from the old upload.js.
// L1: form.getBuffer(); L2: initial_versions + jar in one POST; L3: gallery = query params + raw body; L13: icon in same POST.

export async function createProject({ token, mod, jarPath, iconPath, screenshots = [], releaseType = 'release', version = '1.0.0', changelog, fetchImpl = fetch }) {
  if (!token) throw new Error('MODRINTH_API_TOKEN is missing');
  const jarFile = path.basename(jarPath);
  const slug = `${mod.modId}-${Date.now()}`.slice(0, 64);
  const profileUrl = 'https://modrinth.com/user/madeforaisimba';
  const body = [
    `# ${mod.name}`, '', mod.pageDescription || mod.description, '', '## Changelog', '', changelog, '', '---',
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
      name: `v${version}`,
      version_number: version,
      changelog,
      dependencies: [{ project_id: 'P7dR8mSH', dependency_type: 'required' }],
      game_versions: ['1.21.1'],
      version_type: releaseType,
      loaders: ['fabric'],
      featured: true,
      file_parts: ['mod-file']
    }]
  }), { contentType: 'application/json', filename: 'data.json' });
  form.append('mod-file', fs.readFileSync(jarPath), { filename: jarFile, contentType: 'application/java-archive' });
  if (iconPath && fs.existsSync(iconPath)) {
    form.append('icon', fs.readFileSync(iconPath), { filename: 'icon.png', contentType: 'image/png' });
  }

  const res = await fetchImpl('https://api.modrinth.com/v2/project', {
    method: 'POST',
    headers: { Authorization: token, ...form.getHeaders() },
    body: form.getBuffer()
  });
  if (!res.ok) throw new Error(`Modrinth project creation failed (${res.status}): ${await res.text()}`);
  const project = await res.json();
  console.log(`Modrinth project created: https://modrinth.com/mod/${slug}`);

  for (const [file, title] of screenshots) {
    if (!fs.existsSync(file)) continue;
    const params = new URLSearchParams({ ext: 'png', featured: 'false', title });
    const g = await fetchImpl(`https://api.modrinth.com/v2/project/${project.id}/gallery?${params}`, {
      method: 'POST', headers: { Authorization: token, 'Content-Type': 'image/png' }, body: fs.readFileSync(file)
    });
    if (!g.ok) console.log(`Modrinth gallery warning (${g.status}): ${await g.text()}`);
  }
  return { slug, projectId: project.id };
}
