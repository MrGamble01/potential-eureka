/* RESET — "Reset progress" clears the arcade, and only the arcade (QA-28).
 *
 * The Hall of Fame's reset used a hand-kept list of 27 key names. The backup
 * button beside it deliberately does NOT: it takes the whole origin, with the
 * comment "new games' keys are covered automatically without a registry to
 * forget". Forty-eight rounds of memory-chain keys later the registry had
 * forgotten 27 of the 34 keys a played arcade holds — including
 * `hearthvale-v1`, a whole flagship town — so the button promised a clean
 * slate and delivered a blend of a fresh arcade and an old one.
 *
 * The fix inverts the list: everything on the origin goes except the few
 * things that are not a game. This suite guards both halves of that.
 *
 *  A. Drift guard (static). Every key the productivity/personal/Studio apps
 *     write is on RESET_KEEP; no game key is; no entry on it is stale. This
 *     is the half that survives future rounds — a new memory key is cleared
 *     by default, and a new app key that nobody kept fails here by name.
 *  B. A real played arcade: five flagships booted so their own saves exist,
 *     plus a deep player's meta layer and app data. Reset takes every game
 *     key and leaves every app key untouched.
 *  C. The wipe sticks across the reload it triggers.
 *  D. Nothing to clear is said, not done — app data is never touched.
 *  E. Zero page errors throughout.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const jsIn = dir => {
  const d = path.join(ROOT, dir);
  return fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith('.js')).sort().map(f => path.join(dir, f)) : [];
};

/* ── A. the drift guard ─────────────────────────────────────────────────
 * The keep-list is read out of the shipped page, not restated here: a suite
 * that carries its own copy of the thing under test guards nothing.
 */
const hub = read('index.html');
const keepBlock = hub.match(/const RESET_KEEP = \[([\s\S]*?)\];/);
const prefixBlock = hub.match(/const RESET_KEEP_PREFIX = \[([^\]]*)\];/);
const KEEP = keepBlock ? [...keepBlock[1].matchAll(/'([^']+)'/g)].map(m => m[1]) : [];
const KEEP_PREFIX = prefixBlock ? [...prefixBlock[1].matchAll(/'([^']+)'/g)].map(m => m[1]) : [];
ok(KEEP.length > 0 && KEEP_PREFIX.length > 0,
  `RESET_KEEP parsed from index.html — ${KEEP.length} keys, ${KEEP_PREFIX.length} prefix(es)`);
const kept = k => KEEP.includes(k) || KEEP_PREFIX.some(p => k.startsWith(p));

// Keys are reached three ways in this repo: localStorage directly, the
// Utils.store wrapper the hub modules use, and a *_KEY constant.
function keysOf(files) {
  const blob = files.map(read).join('\n');
  const w = new Set();
  for (const m of blob.matchAll(/setItem\(\s*'([^']+)'/g)) w.add(m[1]);
  for (const m of blob.matchAll(/store\.(?:set|setRaw)\(\s*'([^']+)'/g)) w.add(m[1]);
  for (const m of blob.matchAll(/(?:const|let|var)\s+(\w*KEY\w*)\s*=\s*'([^']+)'/g)) {
    const [, name, key] = m;
    // A constant is written either straight through localStorage or through
    // the Utils.store wrapper — js/calendar.js uses the second, and a guard
    // that only knew the first reported its key as a stale keep-entry.
    if (new RegExp(`(?:setItem|store\\.set|store\\.setRaw)\\(\\s*${name}\\s*,`).test(blob)) w.add(key);
  }
  return w;
}

const APP_FILES = ['js/notes.js', 'js/todo.js', 'js/bookmarks.js', 'js/pomodoro.js',
  'js/calendar.js', 'js/personal-auth.js', 'js/personal-content.js', 'js/productivity.js',
  'agentic-os.html'].filter(f => fs.existsSync(path.join(ROOT, f)));
const GAME_FILES = ['index.html', 'tycoon/play.html', 'drug-lab.html', 'hearthvale.html',
  'voxel-garden.html', 'homeless-village.html', 'ageofwar/index.html', 'ageofwar/ageofwar.js',
  ...jsIn('js'), ...jsIn('homeless-village/js')]
  .filter(f => !APP_FILES.includes(f) && fs.existsSync(path.join(ROOT, f)));

const appKeys = keysOf(APP_FILES);
const gameKeys = keysOf(GAME_FILES);

// A1 — an app's data must never be collateral damage from a game reset.
const unkeptApp = [...appKeys].filter(k => !kept(k)).sort();
ok(unkeptApp.length === 0,
  `every key the apps write is kept (${appKeys.size} checked)` +
  (unkeptApp.length ? ` — a game reset would delete: ${unkeptApp.join(', ')}` : ''));

// A2 — and no game key may hide on the list. The three site-wide preferences
// are the deliberate exception: they describe the browser, not the run, and
// are named here so a fourth cannot join them quietly.
const SITE_PREFS = ['eureka-theme', 'arcade-muted', 'eureka-weather-optin'];
const keptGameKeys = [...gameKeys].filter(k => kept(k) && !appKeys.has(k)).sort();
const unexpected = keptGameKeys.filter(k => !SITE_PREFS.includes(k));
ok(unexpected.length === 0,
  `no game key survives the reset` +
  (unexpected.length ? ` — but these are on RESET_KEEP: ${unexpected.join(', ')}` : ''));
ok(SITE_PREFS.every(k => keptGameKeys.includes(k)),
  `the three declared site preferences are kept and still written: ${SITE_PREFS.join(', ')}`);

// A3 — a stale entry is a lie in the other direction: it reads as protection
// for something no longer there.
const stale = KEEP.filter(k => !appKeys.has(k) && !gameKeys.has(k));
ok(stale.length === 0,
  `no stale RESET_KEEP entry` + (stale.length ? ` — nothing writes: ${stale.join(', ')}` : ''));

/* ── B–E. the button, on a real arcade ─────────────────────────────────── */

// Booted for their genuine save, not a seeded imitation of one. Age of War
// writes nothing until it is played, so its keys are seeded below.
const FLAGSHIPS = [
  ['/tycoon/play.html', 'startup-tycoon-v7'],
  ['/drug-lab.html', 'drug-lab-v1'],
  ['/homeless-village.html', 'homeless_village_v1'],
  ['/hearthvale.html', 'hearthvale-v1'],
  ['/voxel-garden.html', 'voxel-garden-v1'],
];

// A long-time player's meta layer and memory arc — the part the old registry
// forgot wholesale.
const SEED_GAME = {
  'arcade-achievements': '{"snake-10":1,"first-blood":1}',
  'arcade-coins': '{"balance":420,"paid":{},"owned":{"indigo":true},"equipped":"indigo"}',
  'eureka-stats': '{"plays":{"snake":40},"secs":{},"days":{}}',
  'arcade-rivals': '{"ana":{"s":900}}',
  'rival-name': 'MrGamble',
  'snake-high': '4321', 'tetris-high': '99000', 'g2048-best': '8192',
  'aow-achievements': '["first-blood"]', 'aow-best-run': '17', 'aow-muted': '1',
  'tyc-bench': '{"sits":3}', 'growop-stoop': '{"sits":3}', 'aow-bench': '{"sits":3}',
  'hv-bench': '{"sits":3}', 'hvale-bench': '{"sits":3}', 'vox-bench': '{"sits":3}',
  'tyc-mark': '{"marks":3}', 'vox-mark': '{"marks":3}', 'hvale-hearth': '{"up":1}',
};
// Everything on this origin that is not a game.
const SEED_APP = {
  'eureka-notes': 'buy milk',
  'eureka-todos': '[{"t":"ship the round","done":false}]',
  'eureka-bookmarks': '[{"u":"https://example.com"}]',
  'eureka-pomo-sessions': '12',
  'eureka-calendar-config': '{"tz":"UTC"}',
  'eureka-gt-clientid': 'client-123',
  'eureka-personal-pin': 'hashed-pin',
  'eureka-personal-journal': 'private',
  'studio-token': 'ghp_dont_delete_me',
  'studio-chat-v1': '[{"role":"user"}]',
  'eureka-theme': 'crt',
};

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });

  // ── B / C. a played arcade
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    let confirmText = '';
    page.on('dialog', d => { if (d.type() === 'confirm') confirmText = d.message(); d.accept(); });

    for (const [url, key] of FLAGSHIPS) {
      await page.goto(BASE + url, { waitUntil: 'load' });
      await page.waitForFunction(k => localStorage.getItem(k) !== null, key, { timeout: 30000 })
        .catch(() => {});
      const wrote = await page.evaluate(k => localStorage.getItem(k) !== null, key);
      ok(wrote, `${url} wrote its own save (${key})`);
    }

    await page.goto(BASE + '/index.html#halloffame', { waitUntil: 'load' });
    await page.evaluate(s => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); },
      { ...SEED_GAME, ...SEED_APP });
    await page.waitForTimeout(1200);

    const before = await page.evaluate(() => {
      const o = {};
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); }
      return o;
    });
    ok(Object.keys(before).length >= 30,
      `a played arcade holds ${Object.keys(before).length} keys before the reset`);

    await page.click('#hof-reset');
    await page.waitForLoadState('load');
    await page.waitForTimeout(1500);

    const after = await page.evaluate(() => {
      const o = {};
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); }
      return o;
    });

    // The confirm must state the real number and point at the way out.
    const expectedCount = Object.keys(before).filter(k => !kept(k)).length;
    ok(confirmText.includes(String(expectedCount)),
      `the confirm names the real count (${expectedCount}) — "${confirmText.split('\n')[0].slice(0, 80)}…"`);
    ok(/Backup/.test(confirmText), 'the confirm points at Backup before it destroys anything');

    // The whole arcade goes. Named, because "some of it went" is the bug.
    const survivors = Object.keys(before).filter(k => !kept(k) && after[k] !== undefined);
    ok(survivors.length === 0,
      `every game key is cleared` + (survivors.length ? ` — survived: ${survivors.sort().join(' ')}` : ''));

    // The five the old registry forgot, called out by name: a flagship town,
    // the hub's four meta stores, and the memory arc.
    for (const k of ['hearthvale-v1', 'arcade-achievements', 'arcade-coins', 'eureka-stats',
      'arcade-rivals', 'tyc-bench', 'vox-mark', 'aow-best-run']) {
      ok(after[k] === undefined, `"${k}" is gone (the old registry kept it)`);
    }

    // C. and nothing writes itself back. The flagship saves and memory keys
    // are only written by their own pages, so the reloaded hub must not
    // resurrect them.
    ok(['hearthvale-v1', 'startup-tycoon-v7', 'drug-lab-v1', 'voxel-garden-v1',
      'homeless_village_v1', 'tyc-bench', 'vox-mark'].every(k => after[k] === undefined),
      'the wipe survives the reload the reset triggers');

    // The other half of the promise: nothing that is not a game was touched.
    const damaged = Object.keys(SEED_APP).filter(k => after[k] !== SEED_APP[k]);
    ok(damaged.length === 0,
      `notes, to-dos, bookmarks, the personal vault, Studio's token and the theme all survive`
      + (damaged.length ? ` — damaged: ${damaged.join(', ')}` : ''));

    ok(errs.length === 0, `no page errors (reset)${errs.length ? ' — ' + errs[0] : ''}`);
    await ctx.close();
  }

  // ── D. nothing to clear
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    const dialogs = [];
    page.on('dialog', d => { dialogs.push([d.type(), d.message()]); d.accept(); });
    await page.addInitScript(s => {
      if (sessionStorage.getItem('reset-suite-seeded')) return;   // re-runs on reload
      sessionStorage.setItem('reset-suite-seeded', '1');
      for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
    }, SEED_APP);
    await page.goto(BASE + '/index.html#halloffame', { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    // Booting the hub legitimately writes its own stats/theme keys; clear the
    // game side so only app data is left, which is the case under test.
    await page.evaluate(keep => {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (!keep.list.includes(k) && !keep.prefix.some(p => k.startsWith(p))) localStorage.removeItem(k);
      }
    }, { list: KEEP, prefix: KEEP_PREFIX });

    await page.click('#hof-reset');
    await page.waitForTimeout(800);
    ok(dialogs.length === 1 && dialogs[0][0] === 'alert' && /Nothing to clear/i.test(dialogs[0][1]),
      `an empty arcade says so instead of asking — "${(dialogs[0] || [])[1] || 'no dialog'}"`);
    const intact = await page.evaluate(s => Object.keys(s).every(k => localStorage.getItem(k) === s[k]), SEED_APP);
    ok(intact, 'and it touches nothing on the way past');
    ok(errs.length === 0, `no page errors (empty)${errs.length ? ' — ' + errs[0] : ''}`);
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
