/*
 * UI-7 — Esc closes the hub's two settings dialogs (re-runnable).
 *
 * The hub has four dialogs. The cheat-sheet and the patch notes have always
 * closed on Esc; the two settings dialogs — Connect Your Calendars on the
 * dashboard, Google Tasks on the productivity board — did not. Both are
 * `.modal-overlay` with `Utils.openModal`, which traps focus inside them and
 * drops the caret straight into a text field, so the only way back out was
 * the mouse: Esc did nothing, and neither did clicking the backdrop.
 *
 *  A. Calendar settings: opens with focus in the API-key field, Esc closes
 *     it, and focus returns to the ⚙ that opened it.
 *  B. Esc works from inside the text field, which is where the caret starts.
 *  C. Esc cancels — it does not save. The key you typed and escaped out of
 *     is not there when you come back; Save still saves.
 *  D. The Cancel button still closes it (the mouse path is untouched).
 *  E. Google Tasks settings: the same, on its own dialog and its own Close.
 *  F. Esc with nothing open is harmless, and the cheat-sheet still closes on
 *     Esc as it always has.
 *  G. Zero page errors.
 *
 * Hook-free: dialogs are read from their inline display, focus from
 * document.activeElement, saved settings from the value the dialog shows on
 * reopen — no test-only globals anywhere.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

const shown = (page, id) => page.evaluate(i => {
  const m = document.getElementById(i);
  return !!m && m.style.display === 'flex';
}, id);
const focusedId = page => page.evaluate(() => {
  const a = document.activeElement;
  return a ? (a.id || a.getAttribute('onclick') || a.tagName) : 'none';
});
const esc = async page => { await page.keyboard.press('Escape'); await page.waitForTimeout(200); };
// Keep the run going when Esc does nothing: the mouse path always works, so a
// broken build reports a full tally of named failures instead of dying on the
// first click the still-open dialog swallows.
async function ensureClosed(page, id, closeSel) {
  if (await shown(page, id)) { await page.click(closeSel); await page.waitForTimeout(200); }
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));

  // ---- A/B. Connect Your Calendars ------------------------------------
  await page.goto(BASE + '/index.html#dashboard', { waitUntil: 'load' });
  await page.waitForTimeout(1300);
  const gear = 'button[onclick="CalendarWidget.openSettings()"]';
  const cancel = 'button[onclick="CalendarWidget.closeSettings()"]';
  await page.click(gear);
  await page.waitForTimeout(250);
  ok(await shown(page, 'calendar-modal'), 'the ⚙ opens Connect Your Calendars');
  ok((await focusedId(page)) === 'cal-api-key',
    'it opens with the caret already in the API-key field');

  await esc(page);
  ok(!(await shown(page, 'calendar-modal')),
    'Esc closes it — from inside that very field, where the caret starts');
  ok((await focusedId(page)).includes('CalendarWidget.openSettings'),
    'and focus goes back to the ⚙ that opened it');

  // ---- C. Esc cancels, it does not save --------------------------------
  await ensureClosed(page, 'calendar-modal', cancel);
  await page.click(gear);
  await page.waitForTimeout(250);
  // Both fields, because saveSettings() only writes when it has an API key
  // AND a calendar id — a half-filled form would prove nothing about saving.
  await page.fill('#cal-api-key', 'AIzaSyESCAPED-not-saved');
  await page.fill('#cal-list .cal-id-input', 'escaped@example.com');
  await esc(page);
  ok(!(await shown(page, 'calendar-modal')), 'Esc closes it on a filled-in form too');
  await ensureClosed(page, 'calendar-modal', cancel);
  await page.click(gear);
  await page.waitForTimeout(250);
  const kept = await page.inputValue('#cal-api-key');
  const keptId = await page.inputValue('#cal-list .cal-id-input');
  ok(kept !== 'AIzaSyESCAPED-not-saved' && keptId !== 'escaped@example.com',
    `Esc cancels rather than saves (fields read "${kept}" / "${keptId}")`);

  // ---- D. the mouse path still works -----------------------------------
  if (!(await shown(page, 'calendar-modal'))) { await page.click(gear); await page.waitForTimeout(250); }
  await page.click(cancel);
  await page.waitForTimeout(200);
  ok(!(await shown(page, 'calendar-modal')), 'the Cancel button still closes it');

  // ---- E. Google Tasks --------------------------------------------------
  await page.goto(BASE + '/index.html#productivity', { waitUntil: 'load' });
  await page.waitForTimeout(1300);
  const gtGear = 'button[onclick="Productivity.openGTSettings()"]';
  const gtClose = 'button[onclick="Productivity.closeGTSettings()"]';
  await page.click(gtGear);
  await page.waitForTimeout(250);
  ok(await shown(page, 'gt-modal'), 'the ⚙ opens Google Tasks');
  ok((await focusedId(page)) === 'gt-client-id', 'with the caret in the client-ID field');

  await esc(page);
  ok(!(await shown(page, 'gt-modal')), 'Esc closes Google Tasks too');
  ok((await focusedId(page)).includes('Productivity.openGTSettings'),
    'and hands focus back to its ⚙');

  await ensureClosed(page, 'gt-modal', gtClose);
  if (!(await shown(page, 'gt-modal'))) { await page.click(gtGear); await page.waitForTimeout(250); }
  await page.click(gtClose);
  await page.waitForTimeout(200);
  ok(!(await shown(page, 'gt-modal')), 'its Close button still closes it');

  // ---- F. Esc where there is nothing to close ---------------------------
  const before = await page.evaluate(() => location.hash);
  await esc(page);
  await esc(page);
  ok((await page.evaluate(() => location.hash)) === before,
    'Esc with no dialog open changes nothing');

  await page.goto(BASE + '/index.html#arcade', { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  await page.keyboard.press('?');
  await page.waitForTimeout(200);
  ok(await shown(page, 'shortcuts-modal'), '? still opens the cheat-sheet');
  await esc(page);
  ok(!(await shown(page, 'shortcuts-modal')), 'and Esc still closes it, as it always has');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
