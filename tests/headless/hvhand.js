/*
 * HV-130 — Neighbors checked in with hand-warmers, and only left change.
 *
 * snapAtDawn's in-snap rally logs "hand-warmers and change" and only
 * paid goodwill (the change). The hand-warmers never warmed anyone.
 * hvsnap D already pins Respected +2 goodwill. This suite pins the
 * warmth half of the same sentence.
 *
 *  A. Source: the neighbor branch writes warmth AND goodwill, and the
 *     log still names hand-warmers.
 *  B. Known (rep 25): warmth 50 → 51, goodwill +1, HUD and log agree.
 *  C. Respected (rep 60): warmth +2, goodwill +2 (hvsnap D still holds).
 *  D. Beloved (rep 75) at 98 warmth caps at 100; goodwill still +3.
 *  E. A stranger (rep 0) gets neither warmth nor goodwill.
 *  F. The snap-break path and a quiet dawn do not gift warmth.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives snapAtDawn() on the production path — not
 * onNewDay(), so the season drain cannot hide the gift.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const src = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const fn = /function snapAtDawn\(\)\{([\s\S]*?)\n\}/.exec(src);
ok(!!fn, 'snapAtDawn is still in gameloop.js');
const neighbor = fn && /if\(snapActive\(\)\)\{[\s\S]*?if\(rt>=1\)\{([\s\S]*?)\}\s*return/.exec(fn[1]);
ok(!!neighbor, 'the in-snap neighbor check-in is still in snapAtDawn');
ok(neighbor && /G\.warmth/.test(neighbor[1]) && /G\.goodwill/.test(neighbor[1]),
  'HV-130: neighbor check-in writes warmth and goodwill');
ok(neighbor && /hand-warmers/.test(neighbor[1]) && /warmth/.test(neighbor[1]),
  'the check-in still names hand-warmers, and the log names the warmth');

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
    if (!sessionStorage.getItem('hvhand-init')) {
      sessionStorage.setItem('hvhand-init', '1');
      localStorage.setItem('hv-intro-seen', '1');
      localStorage.removeItem('homeless_village_v1');
    }
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const t = fn => page.evaluate(fn);

  const rally = (rep, warmth, goodwill) => page.evaluate(({ rep, warmth, goodwill }) => {
    const before = document.querySelectorAll('.log-line').length;
    G.rep = rep;
    G.snapUntil = G.days + 5;
    G.warmth = warmth;
    G.goodwill = goodwill;
    snapAtDawn();
    updateHUD();
    const added = Array.from(document.querySelectorAll('.log-line'))
      .slice(before)
      .map(d => d.textContent)
      .join('\n');
    return {
      warmth: G.warmth,
      gw: G.goodwill,
      hudW: document.getElementById('stat-warmth').textContent,
      hudG: document.getElementById('stat-goodwill').textContent,
      log: added,
      tier: repTier(),
      active: snapActive(),
    };
  }, { rep, warmth, goodwill });

  // B — Known
  const known = await rally(25, 50, 10);
  ok(known.tier === 1 && known.active, 'Known (rep 25) is tier 1 inside a gripping snap');
  ok(known.warmth === 51 && known.gw === 11,
    `HV-130: Known check-in pays +1 warmth and +1 goodwill (50/10 → ${known.warmth}/${known.gw})`);
  ok(known.hudW === '51' && known.hudG === '11',
    `the HUD agrees (${known.hudW} warmth, ${known.hudG} goodwill)`);
  ok(/hand-warmers/i.test(known.log) && /\+1 warmth/.test(known.log) && /\+1 goodwill/.test(known.log),
    `the log names hand-warmers and both gifts (${known.log.slice(-120)})`);

  // C — Respected (hvsnap D's goodwill pin, plus the warmth half)
  const respected = await rally(60, 50, 10);
  ok(respected.tier === 2 && respected.warmth === 52 && respected.gw === 12,
    `Respected pays +2 warmth and +2 goodwill (50/10 → ${respected.warmth}/${respected.gw})`);

  // D — Beloved, warmth cap
  const beloved = await rally(75, 98, 10);
  ok(beloved.tier === 3 && beloved.warmth === 100 && beloved.gw === 13,
    `Beloved pays +3 goodwill and warmth caps at 100 (98 → ${beloved.warmth}, gw ${beloved.gw})`);

  // E — stranger isolation (hvsnap C / hvcoats snap drain stay at rep 0)
  const stranger = await rally(0, 50, 10);
  ok(stranger.tier === 0 && stranger.warmth === 50 && stranger.gw === 10,
    `a stranger gets neither gift (warmth ${stranger.warmth}, goodwill ${stranger.gw})`);
  ok(!/hand-warmers/i.test(stranger.log),
    'a stranger dawn does not log a hand-warmer check-in');

  // F — break path and quiet dawn
  const broke = await t(() => {
    G.rep = 60;
    G.snapUntil = G.days;
    G.warmth = 50;
    G.morale = 50;
    G.goodwill = 10;
    snapAtDawn();
    return { warmth: G.warmth, morale: G.morale, until: G.snapUntil, gw: G.goodwill };
  });
  ok(broke.until === null && broke.morale === 54 && broke.warmth === 50 && broke.gw === 10,
    `the snap-break path still +4 morale and does not gift warmth (${broke.warmth})`);

  const quiet = await t(() => {
    G.rep = 60;
    G.snapUntil = null;
    G.warmth = 50;
    G.goodwill = 10;
    snapAtDawn();
    return { warmth: G.warmth, gw: G.goodwill, active: snapActive() };
  });
  ok(!quiet.active && quiet.warmth === 50 && quiet.gw === 10,
    'a quiet dawn does not gift hand-warmers');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
