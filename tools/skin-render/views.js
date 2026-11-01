import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Prepared camera positions ("views") for skin screenshots, based on the skin editor's poses.
const here = path.dirname(fileURLToPath(import.meta.url));
export const POSES = JSON.parse(fs.readFileSync(path.join(here, 'poses.json'), 'utf-8'));
export const VIEWS = JSON.parse(fs.readFileSync(path.join(here, 'views.json'), 'utf-8'));
export const BACKGROUND = '#252538';

export function resolveView(name) {
  const v = VIEWS[name];
  if (!v) throw new Error(`Unknown view "${name}". Valid views: ${Object.keys(VIEWS).join(', ')}`);
  const pose = POSES[v.pose];
  if (!pose) throw new Error(`View "${name}" uses unknown pose "${v.pose}"`);
  return { name, label: v.label, pose, azimuth: v.azimuth, elevation: v.elevation, distance: v.distance || 40 };
}

// Version-level view wins over pack-level view, then the configured default.
export function viewFor(pack, version, defaultView = 'editor') {
  return version?.view || pack?.view || defaultView;
}
