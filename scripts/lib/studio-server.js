import fs from 'fs';
import http from 'http';
import path from 'path';
import { loadUnits, findUnit, unitDetail, overview } from './review-items.js';
import { markPart, clearPart, returnToClaude, approve, withdraw, planSlot, takenDaysOf, saveReview, APPROVED } from './review.js';

// Der lokale Studio-Server: liefert die Oberfläche (tools/studio) und eine kleine JSON-API.
// Sicherheit:
//   - lauscht nur auf 127.0.0.1 (von außen nicht erreichbar)
//   - /files/ liefert nur Dateien unter data/ und previews/ (kein ../, keine secrets.env)
//   - Aktionen (POST) nur mit Origin des Studios selbst: fremde Webseiten im Browser können nichts auslösen

const UI_DIR = path.resolve('tools/studio');
const FILE_ROOTS = () => ['data', 'previews'].map(d => path.resolve(d));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.svg': 'image/svg+xml' };

const send = (res, code, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

function sendFile(res, file) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, { error: 'nicht gefunden' });
  send(res, 200, fs.readFileSync(file), TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream');
}

// /files/<pfad> → absoluter Pfad, nur innerhalb von data/ und previews/; sonst null.
export function safeFilePath(urlPath) {
  let decoded;
  try { decoded = decodeURIComponent(urlPath.replace(/^\/files\//, '')); } catch { return null; }
  if (decoded.includes('\0')) return null;
  const abs = path.resolve(decoded);
  return FILE_ROOTS().some(root => abs.startsWith(root + path.sep)) ? abs : null;
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) { body += chunk; if (body.length > 100000) throw new Error('Anfrage zu groß'); }
  return body ? JSON.parse(body) : {};
}

// config: config.json · now(): aktuelle Zeit (Tests) · openTerminal(cmd): startet den Komplettlauf sichtbar
export function createStudioServer({ config, now = () => new Date(), openTerminal = () => {}, uiDir = UI_DIR }) {
  let origins = []; // wird nach listen() gesetzt

  const actions = {
    part(u, body) {
      if (body.note === null) clearPart(u.review, body.part, now());
      else markPart(u.review, body.part, body.note, now());
    },
    return(u) { returnToClaude(u.review, now()); },
    async go(u) {
      const detail = await unitDetail(u, config);
      const others = loadUnits({ now: now() }).filter(x => !(x.kind === u.kind && x.key === u.key)).map(x => x.review);
      const { slot } = planSlot({ config, now: now(), takenDays: takenDaysOf(others, config) });
      approve(u.review, { checks: detail.checks, slot, now: now() });
    },
    withdraw(u) { withdraw(u.review, now()); },
    publish(u) {
      if (!APPROVED.includes(u.review.status)) throw new Error('Erst Go geben');
      openTerminal(`npm run cf -- publish --${u.kind} ${u.key}`);
      return { started: true };
    }
  };

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      const p = url.pathname;
      if (req.method === 'GET') {
        if (p === '/' || p === '/index.html') return sendFile(res, path.join(uiDir, 'index.html'));
        if (p === '/studio.js' || p === '/studio.css') return sendFile(res, path.join(uiDir, p.slice(1)));
        if (p.startsWith('/files/')) {
          const file = safeFilePath(p);
          return file ? sendFile(res, file) : send(res, 403, { error: 'verboten' });
        }
        if (p === '/api/overview') return send(res, 200, overview(loadUnits({ now: now() })));
        const m = /^\/api\/item\/(skinpack|mod)\/([a-z0-9-]+)$/.exec(p);
        if (m) {
          const u = findUnit(m[1], m[2], { now: now() });
          return u ? send(res, 200, await unitDetail(u, config)) : send(res, 404, { error: 'unbekannt' });
        }
        return send(res, 404, { error: 'nicht gefunden' });
      }
      if (req.method === 'POST') {
        if (!origins.includes(req.headers.origin)) return send(res, 403, { error: 'Aktion nur aus dem Studio erlaubt' });
        const m = /^\/api\/item\/(skinpack|mod)\/([a-z0-9-]+)\/(part|return|go|withdraw|publish)$/.exec(p);
        if (!m) return send(res, 404, { error: 'nicht gefunden' });
        const u = findUnit(m[1], m[2], { now: now() });
        if (!u) return send(res, 404, { error: 'unbekannt' });
        const body = await readJson(req);
        const extra = await actions[m[3]](u, body);
        saveReview(u.dir, u.review);
        return send(res, 200, { ok: true, ...(extra || {}), item: await unitDetail(u, config) });
      }
      send(res, 405, { error: 'Methode nicht erlaubt' });
    } catch (e) {
      send(res, 400, { error: e.message });
    }
  });

  return {
    server,
    listen(port = 4747) {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => {
          const port = server.address().port;
          origins = [`http://127.0.0.1:${port}`, `http://localhost:${port}`];
          resolve(origins[0]);
        });
      });
    },
    close: () => new Promise(r => { server.closeAllConnections?.(); server.close(r); })
  };
}
