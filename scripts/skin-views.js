import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { openRenderer, flatten, composeRow } from '../tools/skin-render/render.js';
import { VIEWS, viewFor } from '../tools/skin-render/views.js';
import { loadPack, packDir } from './lib/skinpacks.js';
import { arg } from './lib/github-output.js';

// Renders every skin of a pack in every prepared view into previews/<slug>/ (gitignored) and
// writes previews/<slug>/index.html to flip through them: ←/→ view, ↑/↓ skin, version picker.
// node scripts/skin-views.js --pack <slug> [--version 1.2]
const argv = process.argv.slice(2);
const slug = arg(argv, '--pack');
if (!slug) throw new Error('Usage: node scripts/skin-views.js --pack <slug> [--version <v>]');
const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
const background = config.skinRender?.background;
const pack = loadPack(slug);
const wanted = arg(argv, '--version');
const versions = wanted ? pack.versions.filter(v => v.version === wanted) : pack.versions;
if (!versions.length) throw new Error(`Pack ${slug} has no version ${wanted}`);
const out = path.join('previews', slug);
const viewNames = Object.keys(VIEWS);

const data = { slug, name: pack.name, views: viewNames.map(n => ({ name: n, label: VIEWS[n].label })), current: {}, versions: [] };
const renderer = await openRenderer();
try {
  for (const v of versions) {
    data.current[v.version] = viewFor(pack, v, config.skinRender?.defaultView || 'editor');
    const skins = v.skins.map(s => ({ ...s, png: fs.readFileSync(path.join(packDir(slug), 'skins', v.version, s.file)) }));
    const entry = { version: v.version, skins: skins.map(s => s.name), rows: {}, singles: {} };
    for (const view of viewNames) {
      const dir = path.join(out, v.version, view);
      fs.mkdirSync(dir, { recursive: true });
      const renders = [];
      for (const s of skins) renders.push(await renderer.render(s, view));
      entry.singles[view] = [];
      for (let i = 0; i < renders.length; i++) {
        const file = path.join(dir, skins[i].file);
        fs.writeFileSync(file, await sharp(await flatten(renders[i], background)).resize({ height: 600 }).png().toBuffer());
        entry.singles[view].push(path.relative(out, file));
      }
      const row = path.join(out, v.version, `${view}-row.png`);
      fs.writeFileSync(row, await composeRow(renders, { background, cellHeight: 300 }));
      entry.rows[view] = path.relative(out, row);
    }
    data.versions.push(entry);
    console.log(`V${v.version}: ${skins.length} skins × ${viewNames.length} views`);
  }
} finally {
  await renderer.close();
}

const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${pack.name} – Ansichten</title>
<style>
:root{--bg:#14141f;--panel:#1d1d2c;--line:#2a2a4a;--text:#e8e8f0;--muted:#9a9ab0;--accent:#ffb347}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.4 system-ui,sans-serif;padding:16px}
h1{font-size:20px;margin:0 0 12px}.bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}
button,select{background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:6px 10px;font:inherit;cursor:pointer}
button.on{border-color:var(--accent);color:var(--accent)}.row img{max-width:100%;border-radius:8px;border:1px solid var(--line)}
.single{display:flex;gap:16px;align-items:flex-start;margin-top:16px;flex-wrap:wrap}.single img{height:420px;max-width:100%;border-radius:8px;border:1px solid var(--line)}
.muted{color:var(--muted)}code{display:block;background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:8px;margin:6px 0;white-space:pre-wrap;word-break:break-all}
</style></head><body>
<h1>${pack.name} – Positionen durchblättern</h1>
<div class="bar"><label>Version <select id="ver"></select></label><span class="muted">← → Position · ↑ ↓ Skin</span></div>
<div class="bar" id="views"></div>
<div class="row"><img id="row" alt="Alle Skins der Version"></div>
<div class="single"><img id="one" alt="Einzelner Skin"><div><div id="skin" style="font-weight:600"></div><div class="muted" id="state"></div>
<p>Diese Position für das ganze Pack übernehmen:</p><code id="cmdAll"></code><button data-copy="cmdAll">Kopieren</button>
<p>Nur für diese Version:</p><code id="cmdOne"></code><button data-copy="cmdOne">Kopieren</button></div></div>
<script>
const D=${JSON.stringify(data)};
let vi=0, wi=Math.max(0,D.views.findIndex(w=>w.name===D.current[D.versions[0].version])), si=0;
const $=id=>document.getElementById(id);
D.versions.forEach((v,i)=>{const o=document.createElement('option');o.value=i;o.textContent='V'+v.version+' ('+v.skins.length+' Skins)';$('ver').appendChild(o)});
D.views.forEach((w,i)=>{const b=document.createElement('button');b.textContent=w.label;b.onclick=()=>{wi=i;show()};$('views').appendChild(b)});
$('ver').onchange=e=>{vi=+e.target.value;si=0;show()};
function show(){const v=D.versions[vi],w=D.views[wi];
 [...$('views').children].forEach((b,i)=>b.classList.toggle('on',i===wi));
 $('row').src=v.rows[w.name];$('one').src=v.singles[w.name][si];
 $('skin').textContent=v.skins[si]+' ('+(si+1)+'/'+v.skins.length+')';
 $('state').textContent='Position: '+w.label+' ('+w.name+') · aktuell gespeichert: '+D.current[v.version];
 $('cmdAll').textContent='node scripts/render-skins.js --pack '+D.slug+' --view '+w.name+' --all';
 $('cmdOne').textContent='node scripts/render-skins.js --pack '+D.slug+' --version '+v.version+' --view '+w.name;}
document.addEventListener('keydown',e=>{const v=D.versions[vi];
 if(e.key==='ArrowRight')wi=(wi+1)%D.views.length;else if(e.key==='ArrowLeft')wi=(wi-1+D.views.length)%D.views.length;
 else if(e.key==='ArrowDown')si=(si+1)%v.skins.length;else if(e.key==='ArrowUp')si=(si-1+v.skins.length)%v.skins.length;else return;
 e.preventDefault();show()});
document.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>{try{navigator.clipboard.writeText($(b.dataset.copy).textContent);b.textContent='Kopiert'}catch{}});
show();
</script></body></html>`;
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log(`Preview: ${path.resolve(out, 'index.html')}`);
