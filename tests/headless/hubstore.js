/* QA — a corrupt shared key must not take down the arcade.
 *
 * Sibling of `saves.js`, one layer up and with a wider blast radius. A
 * flagship's save belongs to that flagship: corrupt it and you lose one
 * town. The hub's shared keys are read by the front page and the Hall
 * of Fame — the board that carries all six flagship records — so one
 * bad write there is not one town, it is the way in to all of them.
 *
 * Probing it found 13 crashes across three shared modules, every one
 * the same half-a-guard: a try/catch around JSON.parse, and nothing
 * checking the SHAPE of what parsed.
 *
 *   js/rivals.js       list() returned whatever parsed. `null` parses
 *                      fine, and Object.entries(null) throws; `[1,2,3]`
 *                      and `"hi"` parse fine and yield entries whose
 *                      `.s` is undefined, which Object.keys() throws on.
 *                      Blank Hall of Fame.
 *   js/telemetry.js    load() checked `typeof s === 'object'` — which an
 *                      ARRAY passes, and which says nothing about the
 *                      three sub-maps every reader indexes directly.
 *                      A stored `[1,2,3]` blanked the hub's FRONT PAGE.
 *   js/achievements.js unlocked() returned a stored `null` straight
 *                      through into Object.keys(). Front page again.
 *
 * All three are fixed at the module's single read function rather than
 * at each caller, so a consumer added later inherits the guard instead
 * of having to remember it.
 *
 * Note the two views are not redundant: `eureka-stats` and
 * `arcade-achievements` fail on the hub root as well as the Hall of
 * Fame, and that difference is the whole severity argument. Losing the
 * Hall of Fame is losing a screen; losing the root is losing the arcade.
 */
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

// Keys read out of the modules that own them, not guessed:
//   js/rivals.js       STORE_KEY / NAME_KEY
//   js/coins.js        KEY
//   js/telemetry.js    KEY
//   js/achievements.js STORE_KEY
const KEYS = [
  { key: 'arcade-rivals',       owner: 'js/rivals.js' },
  { key: 'rival-name',          owner: 'js/rivals.js' },
  { key: 'arcade-coins',        owner: 'js/coins.js' },
  { key: 'eureka-stats',        owner: 'js/telemetry.js' },
  { key: 'arcade-achievements', owner: 'js/achievements.js' },
];

// Every one of these is valid JSON except the last two. That is the
// point: the parse is not where this class of bug lives.
const PAYLOADS = [
  ['null',          'null'],
  ['an array',      '[1,2,3]'],
  ['a bare string', '"hello"'],
  ['a number',      '42'],
  ['nulls inside',  '{"BOB":null,"AMY":null}'],
  ['nested wrong',  '{"BOB":{"s":null,"t":"x"}}'],
  ['truncated',     '{"BOB":'],
  ['not JSON',      'zzz'],
];

const VIEWS = [
  { label: 'hub root',     url: '/index.html' },
  { label: 'hall of fame', url: '/index.html#halloffame' },
];

async function boot(browser, key, json, url) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 100)));
  await page.addInitScript(([k, v]) => {
    try { localStorage.setItem(k, v); } catch (e) { /* private mode */ }
  }, [key, json]);
  try {
    await page.goto(BASE + url, { waitUntil: 'load', timeout: 25000 });
    await page.waitForTimeout(1400);
  } catch (e) { errs.push('NAV: ' + String(e).slice(0, 70)); }
  const alive = await page.evaluate(
    () => !!(document.body && document.body.children.length > 0)
  ).catch(() => false);
  await ctx.close();
  return errs.length ? errs[0] : (alive ? null : 'no DOM');
}

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });

  for (const { key, owner } of KEYS) {
    for (const view of VIEWS) {
      const bad = [];
      for (const [label, json] of PAYLOADS) {
        const why = await boot(browser, key, json, view.url);
        if (why) bad.push(`${label}: ${why}`);
      }
      ok(bad.length === 0,
        `${view.label} survives a corrupt "${key}" (${owner}, ${PAYLOADS.length} payloads)${bad.length ? ' — ' + bad.join(' | ') : ''}`);
    }
  }

  // Guard the guard: emptying either table would make every assertion
  // above pass without booting anything hostile.
  ok(KEYS.length === 5, `all five shared hub keys are covered (got ${KEYS.length})`);
  ok(PAYLOADS.length >= 8, `the payload table is populated (got ${PAYLOADS.length})`);
  ok(PAYLOADS.filter(([, j]) => { try { JSON.parse(j); return true; } catch { return false; } }).length >= 6,
    'most payloads are still VALID JSON — the parse is not where this bug class lives');
  ok(VIEWS.length === 2 && VIEWS.some(v => v.url.includes('halloffame')),
    'both the hub root and the Hall of Fame are exercised');

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
