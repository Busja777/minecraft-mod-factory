import './lib/load-secrets.js';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { createStudioServer } from './lib/studio-server.js';
import { loadUnits } from './lib/review-items.js';
import { markDue, saveReview } from './lib/review.js';

// Minecraft Studio – lokales Freigabe-Dashboard.
//   npm run studio                          Studio starten und im Browser öffnen (http://127.0.0.1:4747)
//   npm run studio -- tick                  Termine prüfen: Fälliges markieren + Mac-Mitteilung (läuft per Zeitplan)
//   npm run studio -- zeitplan-installieren tick alle 30 Minuten per macOS-launchd (wie früher der GitHub-Cron)
//   npm run studio -- zeitplan-entfernen    Zeitplan wieder entfernen
// Umgebungsvariablen: STUDIO_PORT (Standard 4747), NOW (Testzeit, ISO), STUDIO_NOTIFY=log (Mitteilung nur ausgeben)

const REPO = process.cwd();
const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
const command = process.argv[2] || 'start';
const now = () => (process.env.NOW ? new Date(process.env.NOW) : new Date());
const PORT = Number(process.env.STUDIO_PORT || 4747);
const LABEL = 'de.minecraft-studio.tick';
const PLIST = path.join(os.homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);

const appleString = s => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

function notify(title, text) {
  if (process.env.STUDIO_NOTIFY === 'log') return console.log(`[Mitteilung] ${title}: ${text}`);
  spawnSync('osascript', ['-e', `display notification ${appleString(text)} with title ${appleString(title)} sound name "Glass"`]);
}

function openTerminal(cmd) {
  const script = `cd '${REPO.replace(/'/g, `'\\''`)}' && ${cmd}`;
  spawnSync('osascript', ['-e', `tell application "Terminal" to do script ${appleString(script)}`, '-e', 'tell application "Terminal" to activate']);
}

async function start() {
  const studio = createStudioServer({ config, now, openTerminal });
  let url;
  try {
    url = await studio.listen(PORT);
  } catch (e) {
    if (e.code !== 'EADDRINUSE') throw e;
    url = `http://127.0.0.1:${PORT}`;
    console.log(`Studio läuft schon – öffne ${url}`);
    spawnSync('open', [url]);
    return;
  }
  console.log(`\n✓ Minecraft Studio läuft: ${url}\n  Dieses Fenster offen lassen. Beenden mit Ctrl+C.\n`);
  if (process.env.STUDIO_NO_OPEN !== '1') spawnSync('open', [url]);
}

function tick() {
  const due = [];
  for (const u of loadUnits({ now: now() })) {
    if (markDue(u.review, now())) {
      saveReview(u.dir, u.review);
      due.push(u.kind === 'skinpack' ? u.pack.name : u.meta.name);
    }
  }
  const waiting = loadUnits({ now: now(), persist: false }).filter(u => u.review.status === 'faellig').length;
  for (const name of due) notify('Minecraft Studio', `Jetzt veröffentlichen: ${name} – Studio öffnen`);
  console.log(`${now().toISOString()} tick: ${due.length} neu fällig, ${waiting} insgesamt fällig`);
  // The helper's daily reminder: after the evening upload it says what waits for the operator
  // (descriptions, due new projects). Real runs only; it pulls and reads CurseForge.
  if (!process.env.NOW) spawnSync(process.execPath, [path.join(REPO, 'scripts', 'cf.js'), 'heute', '--melden', '--ohne-enter'], { cwd: REPO, stdio: 'inherit' });
}

function installSchedule() {
  const node = process.execPath;
  const log = path.join(os.homedir(), 'Library', 'Logs', 'minecraft-studio.log');
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key><array><string>${node}</string><string>${path.join(REPO, 'scripts', 'studio.js')}</string><string>tick</string></array>
  <key>WorkingDirectory</key><string>${REPO}</string>
  <key>StartInterval</key><integer>1800</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>${log}</string>
  <key>StandardErrorPath</key><string>${log}</string>
</dict></plist>
`;
  fs.mkdirSync(path.dirname(PLIST), { recursive: true });
  fs.writeFileSync(PLIST, plist);
  const uid = process.getuid();
  spawnSync('launchctl', ['bootout', `gui/${uid}`, PLIST]);
  const r = spawnSync('launchctl', ['bootstrap', `gui/${uid}`, PLIST], { encoding: 'utf-8' });
  if (r.status !== 0) throw new Error(`launchctl: ${r.stderr || r.stdout}`);
  console.log(`✓ Zeitplan aktiv: alle 30 Minuten werden Termine geprüft; nach dem Abend-Upload kommt eine Mitteilung, was auf dich wartet.\n  Protokoll: ${log}\n  Entfernen: npm run studio -- zeitplan-entfernen`);
}

function removeSchedule() {
  spawnSync('launchctl', ['bootout', `gui/${process.getuid()}`, PLIST]);
  if (fs.existsSync(PLIST)) fs.unlinkSync(PLIST);
  console.log('✓ Zeitplan entfernt.');
}

const commands = { start, tick, 'zeitplan-installieren': installSchedule, 'zeitplan-entfernen': removeSchedule };
if (!commands[command]) {
  console.error(`Unbekannter Befehl "${command}". Möglich: ${Object.keys(commands).join(', ')}`);
  process.exit(1);
}
await commands[command]();
