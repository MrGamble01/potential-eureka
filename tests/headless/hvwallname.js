/* HV-209 — Add a Name said it went up on the wall of names,
 * then Read the Wall never read them.
 *
 * The ✍️ tooltip puts a newcomer’s own name on the wall of names,
 * in their hand. Read the Wall is the action that reads the wall
 * out loud. composeHvWall cites the fridge, the longest hold, and
 * the notes in the door. It never reads loadHvMark(). A name that
 * is not on the wall when you read the wall is not on the wall.
 *
 * #768 / #771 are Read the Wall when the wall is bare.
 * #803 is the fire never feeling a reading.
 * #789 is rain editing unroofed names.
 * This is the missing citation.
 *
 *  A. Source: Add a Name still writes on the wall of names.
 *     Read the Wall still composeHvWall. The mural is not this.
 *  B. Source: composeHvWall reads loadHvMark / names.
 *     ui.js does not.
 *  C. Live: two names on a humming fridge — the chalk cites them.
 *     A reading logs the names.
 *  D. Zero names still cites fridge / hold / notes, and does not
 *     invent a hand on the wall.
 *  E. Add a Name still pays food and ticks the tally.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives production composeHvWall and finishAction.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const cfg = fs.readFileSync(path.join(ROOT, 'homeless-village/js/config.js'), 'utf8');
const player = fs.readFileSync(path.join(ROOT, 'homeless-village/js/player.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const compose = /function composeHvWall\(\)\{([\s\S]*?)\n\}/.exec(cfg);
const body = compose ? compose[1] : '';

ok(/id:\s*'mark'/.test(cfg) && /wall of names/.test(cfg)
  && /A NAME ON THE WALL/.test(player)
  && /function composeHvWall/.test(cfg)
  && /THE WRITING ON THE WALL/.test(player),
  'Add a Name still writes on the wall; Read the Wall still reads it out');
ok(body && (/loadHvMark/.test(body) || /\.names/.test(body)),
  'HV-209: composeHvWall reads the names that went up');
ok(!/loadHvMark/.test(ui) && !/newcomer's hand/.test(ui),
  'ui.js untouched — the missing names live on the wall');

(async () => {
  const launch = {
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('hvwallname-init')) {
      sessionStorage.setItem('hvwallname-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
      localStorage.removeItem('hv-fridge');
      localStorage.removeItem('hv-record');
      localStorage.removeItem('hv-letter');
      localStorage.removeItem('hv-history');
      localStorage.removeItem('hv-mark');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const cited = await page.evaluate(() => {
    saveFridge({ built: true, camps: 3 });
    saveHvRec({ days: 14, beats: 2 });
    saveHvNote({ read: 2 });
    saveHvMark({ names: 2 });
    const lines = composeHvWall();
    log('HV209-WALL');
    finishAction({ id: 'wall' });
    const feed = Array.from(document.querySelectorAll('.log-line')).map(d => d.textContent);
    const at = feed.findLastIndex(t => /HV209-WALL/.test(t));
    const newest = (at >= 0 ? feed.slice(at + 1) : feed.slice(-8)).join('\n');
    return {
      chalk: lines.join(' | '),
      names: /2 names/.test(lines.join(' ')) && /hand/.test(lines.join(' ')),
      fridge: /3 camps/.test(lines.join(' ')),
      spoken: /2 names/.test(newest) && /hand/.test(newest),
    };
  });
  ok(cited.fridge && cited.names,
    `HV-209: two names on the wall are chalked (${cited.chalk})`);
  ok(cited.spoken, 'a reading says the names out loud');

  const none = await page.evaluate(() => {
    saveHvMark({ names: 0 });
    const lines = composeHvWall().join(' | ');
    return {
      lines,
      fridge: /3 camps/.test(lines),
      hold: /14 dawns/.test(lines),
      notes: /2 notes/.test(lines),
      invented: /newcomer's hand|in a newcomer/.test(lines) || /2 names/.test(lines),
    };
  });
  ok(none.fridge && none.hold && none.notes && !none.invented,
    `zero names still cites fridge / hold / notes (${none.lines})`);

  const paid = await page.evaluate(() => {
    saveHvWalk({ walks: 3 });
    saveHvMark({ names: 0 });
    markAdded = false;
    G.food = 10;
    finishAction({ id: 'mark' });
    return { food: G.food, names: loadHvMark().names };
  });
  ok(paid.food === 24 && paid.names === 1,
    `Add a Name still pays and ticks (food ${paid.food}, names ${paid.names})`);

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
