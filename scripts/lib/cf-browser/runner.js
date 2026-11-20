import fs from 'fs';
import { TARGETS, FORBIDDEN_CLICK, FORBIDDEN_AFTER_EDIT, PROJECT_ID_IN_URL } from './selectors.js';

// Executes step lists from steps.js in a Playwright page.
// - Guard before every step: login or "are you human" page → wait until the user solved it.
// - Never clicks a final button (FORBIDDEN_CLICK); "Add File"/"Add Media" only while the form is
//   untouched (FORBIDDEN_AFTER_EDIT), because CurseForge's submit buttons share those names.
// - Missing field → no crash: noted as "do it yourself"; missing navigation → asks the user.
// - waitFor steps pause until the user did the final click (URL change / element gone).
// - handsFree: nobody sits at the terminal (the run was started from the chat). Every pause then
//   watches the browser instead of waiting for Enter; the final clicks stay the operator's.

const sleep = ms => new Promise(r => setTimeout(r, ms));
const HANDS_FREE_WAIT = 15 * 60 * 1000; // how long a hands-free run waits for the operator's own click
const xpathLiteral = s => (s.includes("'") ? `concat('${s.split("'").join(`', "'", '`)}')` : `'${s}'`);
const INPUTS = "self::input[not(@type='hidden') and not(@type='file') and not(@type='checkbox') and not(@type='radio')] or self::textarea or self::select or @role='combobox' or @contenteditable='true'";

export function fieldXpath(label, kind) {
  const target = kind === 'file' ? "self::input[@type='file']" : INPUTS;
  return `xpath=(//*[not(self::script or self::style or self::option)][normalize-space(text())=${xpathLiteral(label)}])[1]/following::*[${target}][1]`;
}

export function buildLocator(page, spec) {
  let loc;
  if (spec.role) loc = page.getByRole(spec.role, { name: spec.name, exact: spec.exact });
  else if (spec.field) loc = page.locator(fieldXpath(spec.field, spec.kind));
  else if (spec.label) loc = page.getByLabel(spec.label, { exact: spec.exact });
  else if (spec.placeholder) loc = page.getByPlaceholder(spec.placeholder, { exact: spec.exact });
  else if (spec.text) loc = page.getByText(spec.text, { exact: spec.exact });
  else if (spec.css) loc = page.locator(spec.css);
  else throw new Error(`Ungültiges Ziel: ${JSON.stringify(spec)}`);
  return loc;
}

// The usable match of one spec: nth if given; otherwise the first (or with last: the last) match
// that is visible — pages keep hidden copies of tabs/forms around. hidden: true accepts invisible.
async function pick(loc, spec) {
  if (spec.nth !== undefined) return (await loc.nth(spec.nth).count()) ? loc.nth(spec.nth) : null;
  const n = Math.min(await loc.count(), 25);
  const order = [...Array(n).keys()];
  if (spec.last) order.reverse();
  for (const i of order) {
    const el = loc.nth(i);
    if (spec.hidden || await el.isVisible()) return el;
  }
  return null;
}

// First alternative that shows up within the timeout, or null.
export async function resolveTarget(page, specs, { timeout = 10000 } = {}) {
  const deadline = Date.now() + timeout;
  do {
    for (const spec of specs) {
      try {
        const el = await pick(buildLocator(page, spec), spec);
        if (el) return el;
      } catch { /* page navigating */ }
    }
    if (timeout > 0) await sleep(250);
  } while (Date.now() < deadline);
  return null;
}

export function targetSpecs(step, targets = TARGETS) {
  const t = targets[step.target];
  if (!t) throw new Error(`Unbekanntes Ziel "${step.target}" in selectors.js`);
  return typeof t === 'function' ? t(step.arg) : t;
}

export async function needsHuman(page) {
  const title = await page.title().catch(() => '');
  if (/just a moment|attention required|verify you are human|security check|checking your browser/i.test(title)) return 'eine Sicherheitsprüfung';
  if (await page.locator('iframe[src*="challenges.cloudflare.com"]').count().catch(() => 0)) return 'eine Sicherheitsprüfung';
  if (/\/(login|signin|sign-in|oauth|auth)(\/|\?|$)/i.test(page.url())) return 'der Login';
  return null;
}

async function visibleText(loc) {
  return loc.evaluate(el => (el.getAttribute('aria-label') || el.innerText || el.value || el.textContent || '').trim()).catch(() => '');
}

async function clickSafely(loc, state) {
  const name = await visibleText(loc);
  if (FORBIDDEN_CLICK.test(name)) throw new Error(`„${name}“ ist ein Abschicken-Knopf, den klickst du selbst`);
  if (state.dirty && FORBIDDEN_AFTER_EDIT.test(name)) throw new Error(`„${name}“ würde jetzt das Formular abschicken, den klickst du selbst`);
  await loc.click();
}

const optionSpecs = value => [
  { role: 'option', name: value, exact: true }, { role: 'menuitem', name: value, exact: true },
  { role: 'menuitemcheckbox', name: value, exact: true }, { role: 'option', name: value },
  { text: value, exact: true, last: true }
];

async function selectValue(page, loc, value) {
  const { tag, current } = await loc.evaluate(el => ({ tag: el.tagName, current: (el.value || el.innerText || '').trim() }));
  if (tag === 'SELECT') { await loc.selectOption({ label: value }); return; }
  if (current === value) return; // already set (e.g. default "Release")
  await loc.click();
  if (tag === 'INPUT') await loc.fill(value);
  const option = await resolveTarget(page, optionSpecs(value), { timeout: 4000 });
  if (!option) throw new Error(`Eintrag „${value}“ nicht in der Liste gefunden`);
  await option.click();
}

// Multi-select with checkboxes (Additional categories, Game versions): ticks missing values only,
// so values CurseForge pre-selected are never un-ticked by a second click.
async function multiSelect(page, loc, values) {
  await loc.click();
  const missing = [];
  for (const value of values) {
    const option = await resolveTarget(page, optionSpecs(value), { timeout: 3000 });
    if (!option) { missing.push(value); continue; }
    const selected = await option.evaluate(el => {
      const box = el.querySelector('input[type=checkbox]') || el.closest('label')?.querySelector('input[type=checkbox]');
      return !!(box?.checked || el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-checked') === 'true');
    });
    if (!selected) await option.click();
  }
  await page.keyboard.press('Escape');
  if (missing.length) throw new Error(`nicht in der Liste: ${missing.join(', ')}`);
}

async function checkBox(loc, state) {
  const info = await loc.evaluate(el => ({ type: el.type, checked: el.checked, aria: el.getAttribute('aria-checked') || el.getAttribute('aria-pressed') }));
  if (info.type === 'checkbox' || info.type === 'radio') { await loc.check(); return; }
  if (info.aria !== 'true') await clickSafely(loc, state);
}

async function perform(page, step, loc, state) {
  switch (step.action) {
    case 'click': return clickSafely(loc, state);
    case 'fill': state.dirty = true; return loc.fill(step.value);
    case 'select': state.dirty = true; return selectValue(page, loc, step.value);
    case 'multiselect': state.dirty = true; return multiSelect(page, loc, step.value);
    case 'upload': state.dirty = true; return loc.setInputFiles(step.value);
    case 'check': state.dirty = true; return checkBox(loc, state);
    default: throw new Error(`Unbekannte Aktion "${step.action}"`);
  }
}

// Waits until the user did the final click; → true when it was seen (or confirmed with Enter). until: { url: RegExp } | { gone: targetKey } | { check: name }
// check: an async function from `checks` that looks at the result itself (e.g. the Core API shows the
// new description). Without such a function the user confirms with Enter.
async function waitForUser(page, step, { ask, log, targets, checks = {}, poll = 1000, handsFree = false }) {
  log(`⏸  ${step.value}`);
  const check = step.until?.check ? checks[step.until.check] : null;
  if (step.until?.check && !check) { if (!handsFree) await ask('Wenn du gespeichert hast, hier Enter drücken.'); return !handsFree; }
  const deadline = Date.now() + Math.max(step.timeout ?? 20 * 60 * 1000, handsFree ? HANDS_FREE_WAIT : 0);
  let nextCheck = 0;
  while (Date.now() < deadline) {
    if (check && Date.now() >= nextCheck) {
      if (await check().catch(() => false)) return true;
      nextCheck = Date.now() + (step.checkEvery ?? 5000);
    }
    if (step.until?.url && step.until.url.test(page.url())) return true;
    if (step.until?.gone) {
      const loc = await resolveTarget(page, targets[step.until.gone], { timeout: 0 });
      if (!loc) return true;
    }
    await sleep(poll);
  }
  if (handsFree) { log('  Ich habe deinen Klick nicht erkannt und mache mit dem nächsten Punkt weiter.'); return false; }
  await ask(check ? 'CurseForge zeigt die Änderung noch nicht (das kann ein paar Minuten dauern). Wenn du gespeichert hast, Enter drücken.' : 'Ich habe deinen Klick nicht erkannt. Wenn du fertig bist, Enter drücken.');
  return true;
}

async function captureProjectId(page, { ask, handsFree }) {
  const m = PROJECT_ID_IN_URL.exec(page.url());
  if (m) return Number(m[1]);
  if (handsFree) return null;
  const typed = (await ask('Projekt-ID nicht in der Adresse gefunden. Bitte die Zahl von der Projektseite eintippen (oder Enter zum Überspringen):')) || '';
  return /^\d+$/.test(typed.trim()) ? Number(typed.trim()) : null;
}

// → { results: [{ title, status: 'ok'|'manual'|'skipped', detail? }], context: { projectId?, projectUrl? } }
export async function runSteps(page, steps, { ask, log = console.log, timeout = 10000, pause = 400, targets = TARGETS, context = {}, checks = {}, handsFree = false, humanWait = HANDS_FREE_WAIT } = {}) {
  const results = [];
  const state = { dirty: false };
  for (const step of steps) {
    let told = false;
    const humanDeadline = Date.now() + humanWait;
    for (let reason = await needsHuman(page); reason; reason = await needsHuman(page)) {
      if (!handsFree) { await ask(`⏸  Im Browser wartet ${reason}. Bitte selbst erledigen, dann hier Enter drücken.`); continue; }
      // Login and "are you human" checks are never automated: watch until the operator solved them.
      if (!told) { log(`⏸  Im Browser wartet ${reason}. Bitte selbst erledigen, ich warte.`); told = true; }
      if (Date.now() > humanDeadline) throw new Error(`Im Browser wartet weiter ${reason}. Abgebrochen, bitte neu starten, wenn du Zeit hast.`);
      await sleep(Math.min(2000, humanWait));
    }
    if (step.action !== 'waitFor') log(`→ ${step.title}`);
    try {
      if (step.action === 'goto') {
        await page.goto(typeof step.value === 'function' ? step.value(context) : step.value, { waitUntil: 'domcontentloaded' });
        state.dirty = false;
      } else if (step.action === 'manual') {
        if (handsFree) throw new Error(step.value);
        await ask(`👉 ${step.value} Danach Enter drücken.`);
        state.dirty = false;
      } else if (step.action === 'waitFor') {
        const seen = await waitForUser(page, step, { ask, log, targets, checks, handsFree });
        state.dirty = false;
        if (!seen) { results.push({ title: step.title, status: 'manual', detail: 'dein Klick wurde nicht erkannt' }); continue; }
      } else if (step.action === 'learnProjectUrl') {
        // After the user opened the project page by hand once, its address is remembered (cf.js).
        if (step.projectId && page.url().includes(String(step.projectId))) { context.projectId = step.projectId; context.projectUrl = page.url(); }
      } else if (step.action === 'captureProjectId') {
        context.projectId = await captureProjectId(page, { ask, handsFree });
        context.projectUrl = page.url();
        if (!context.projectId) throw new Error('Projekt-ID unbekannt, bitte selbst in data/cf-projects.json eintragen');
        log(`  ✓ Projekt-ID ${context.projectId}`);
      } else {
        if (step.action === 'upload' && !fs.existsSync(step.value)) throw new Error(`Datei fehlt: ${step.value}`);
        if (step.action === 'upload' && step.trigger) {
          // Prefer the file input; if the page only creates it on click, catch the file chooser.
          const input = await resolveTarget(page, targetSpecs(step, targets), { timeout: Math.min(timeout, 3000) });
          if (input) { state.dirty = true; await input.setInputFiles(step.value); results.push({ title: step.title, status: 'ok' }); if (pause) await sleep(pause); continue; }
          const trigger = await resolveTarget(page, targetSpecs({ target: step.trigger }, targets), { timeout });
          if (trigger) {
            const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout }), trigger.click()]);
            await chooser.setFiles(step.value);
            state.dirty = true;
            results.push({ title: step.title, status: 'ok' });
            if (pause) await sleep(pause);
            continue;
          }
        }
        const loc = await resolveTarget(page, targetSpecs(step, targets), { timeout });
        if (!loc) {
          if (step.optional) { results.push({ title: step.title, status: 'skipped' }); continue; }
          if (step.action === 'click') {
            // Navigation: without it the next steps make no sense, so let the user do it now.
            if (handsFree) throw new Error('Knopf nicht gefunden');
            await ask(`👉 „${step.title}“ nicht gefunden. Bitte im Browser selbst klicken, dann Enter drücken.`);
            results.push({ title: step.title, status: 'manual', detail: 'von dir geklickt' });
            continue;
          }
          throw new Error('Feld nicht gefunden');
        }
        await perform(page, step, loc, state);
      }
      results.push({ title: step.title, status: 'ok' });
    } catch (e) {
      if (step.optional) { results.push({ title: step.title, status: 'skipped', detail: e.message.split('\n')[0] }); continue; }
      const shown = Array.isArray(step.value) ? step.value.join(', ') : step.value;
      const value = shown && !['manual', 'waitFor'].includes(step.action) ? ` → ${String(shown).split('\n')[0].slice(0, 80)}` : '';
      results.push({ title: step.title, status: 'manual', detail: `${e.message.split('\n')[0]}${value}` });
      log(`  ⚠ ${e.message.split('\n')[0]}`);
    }
    if (pause) await sleep(pause);
  }
  return { results, context };
}

export function formatSummary(results, notes = []) {
  const ok = results.filter(r => r.status === 'ok').length;
  const manual = results.filter(r => r.status === 'manual');
  const lines = ['', `✓ ${ok} Schritte erledigt${manual.length ? `, ⚠ ${manual.length} bitte selbst prüfen:` : '.'}`];
  for (const r of manual) lines.push(`   ⚠ ${r.title}${r.detail ? `: ${r.detail}` : ''}`);
  if (notes.length) lines.push('', 'Noch zu tun:', ...notes.map(n => `   • ${n}`));
  lines.push('', '🛑 Alles, was abschickt (Create, Apply, Add File …), klickst du SELBST.', '   Das Fenster bleibt offen, schließ es, wenn du fertig bist.');
  return lines.join('\n');
}
