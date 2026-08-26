/* QA — a damaged save must never brick a game.
 *
 * The battery already guards geometry, leaked hooks, console errors,
 * chain integrity and pacing. None of it covered the one input every
 * player supplies and nobody validates: their own localStorage save.
 * A save is untrusted input. It survives browser crashes, quota
 * evictions, extensions, hand-edits and plain bit-rot, and it is read
 * back on the boot path — before any UI exists to say "that went
 * wrong". A save that throws during load doesn't degrade the run; it
 * takes the game away, permanently, with no in-game way back.
 *
 * Writing this suite found three such bugs on three flagships, all the
 * same shape: a number read out of the save, used as an array index,
 * with no check that it was in range.
 *
 *   Hearthvale   day:-1  -> SEASONS[Math.floor(-2/6) % 4] -> SEASONS[-1]
 *                (JS keeps the sign through %) -> undefined.name -> throw
 *                in updateHUD, on the first frame. Also goalIndex:-1 ->
 *                GOALS[-1]: the `>= GOALS.length` guard covered the top
 *                of that index and nothing covered the bottom.
 *   Voxel Isle   the same season formula, reached through a blanket
 *                Object.assign(state, data.state) — so day:0 crashed too.
 *   Grow Op      goalIndex:-1 -> GOALS[-1].label, same missing floor.
 *
 * Two questions, because they fail differently:
 *
 *   A. Garbage in the whole slot — truncated, non-JSON, null, an array,
 *      wrong types, empty. Tests the parse/shape path.
 *   B. Hostile *numbers* in real fields. This is the one that found
 *      everything: the JSON parses, the shape is right, and a single
 *      out-of-range integer walks straight into an array lookup.
 *
 * Each row also asserts the game ACTUALLY READ THE KEY (Storage.getItem
 * is instrumented). The first draft of this probe used save keys I had
 * assumed rather than read out of the source, three of five were wrong,
 * and it came back perfectly clean — proving only that the games ignore
 * keys nothing writes. A green run has to mean the payload was seen.
 */
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

// Keys read out of each game's source, not guessed. Keep them that way:
// see the header for what happens when they drift.
//   Startup Tycoon   tycoon/play.html      VARIANT.saveKey || 'startup-tycoon-v7'
//   Grow Op          drug-lab.html         LS_KEY
//   Homeless Village homeless-village/js/config.js  SAVE_KEY
//   Hearthvale       hearthvale.html       SAVE_KEY
//   Voxel Isle       voxel-garden.html     SAVE_KEY
const GAMES = [
  { name: 'Startup Tycoon',   url: '/tycoon/play.html',      key: 'startup-tycoon-v7' },
  { name: 'Grow Op',          url: '/drug-lab.html',         key: 'drug-lab-v1' },
  { name: 'Homeless Village', url: '/homeless-village.html', key: 'homeless_village_v1' },
  { name: 'Hearthvale',       url: '/hearthvale.html',       key: 'hearthvale-v1' },
  { name: 'Voxel Isle',       url: '/voxel-garden.html',     key: 'voxel-garden-v1' },
];

// A — the slot itself is garbage.
const SHAPES = [
  ['truncated JSON',  '{"cash":100,'],
  ['not JSON at all', 'garbage not json'],
  ['null',            'null'],
  ['an array',        '[1,2,3]'],
  ['wrong types',     '{"cash":"lots","day":null,"buildings":"nope"}'],
  ['empty string',    ''],
  ['deep nulls',      '{"cash":null,"upgrades":null,"plots":null,"buildings":null,"villagers":null}'],
];

// B — valid JSON, right shape, hostile numbers. -1 and 0 are the ones
// that bite: both are ordinary-looking, and both index out of range
// through a floor-divide-and-modulo. Infinity covers 1e999, which is
// what JSON.parse makes of an overflowing literal.
const BAD_NUMS = [-1, -999, 0, 1e999, -1e999];
const numCases = (game, fields, extra) => BAD_NUMS.map(v => {
  const body = Object.assign({}, extra || {});
  fields.forEach(f => { body[f] = v; });
  // Voxel keeps its run state one level down and version-gates the load.
  const payload = game === 'Voxel Isle'
    ? { v: 1, seed: 7, state: body }
    : body;
  return { label: fields.join('/') + '=' + v, json: JSON.stringify(payload) };
});

const FIELDS = [
  { game: 'Hearthvale',       fields: ['day'],                        extra: { seed: 12345 } },
  { game: 'Hearthvale',       fields: ['time'],                       extra: { seed: 12345 } },
  { game: 'Hearthvale',       fields: ['goalIndex', 'happy', '_nextId'], extra: { seed: 12345 } },
  { game: 'Voxel Isle',       fields: ['day', 'time'] },
  { game: 'Voxel Isle',       fields: ['questIdx', 'townRank', 'level'] },
  { game: 'Grow Op',          fields: ['goalIndex'] },
  { game: 'Grow Op',          fields: ['cash', 'heat'] },
  { game: 'Homeless Village', fields: ['days', 'timeOfDay', 'season'] },
  { game: 'Startup Tycoon',   fields: ['day', 'cash'] },
];

async function boot(browser, game, json) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
  await page.addInitScript(([k, v]) => {
    try { localStorage.setItem(k, v); } catch (e) { /* private mode */ }
    window.__sawKey = false;
    const orig = Storage.prototype.getItem;
    Storage.prototype.getItem = function (n) {
      if (n === k) window.__sawKey = true;
      return orig.call(this, n);
    };
  }, [game.key, json]);
  try {
    await page.goto(BASE + game.url, { waitUntil: 'load', timeout: 25000 });
    await page.waitForTimeout(2200);
  } catch (e) { errs.push('NAV: ' + String(e).slice(0, 70)); }
  const st = await page.evaluate(() => ({
    alive: !!(document.body && document.body.children.length > 0),
    read: !!window.__sawKey,
  })).catch(() => ({ alive: false, read: false }));
  await ctx.close();
  if (errs.length) return errs[0];
  if (!st.alive) return 'no DOM';
  if (!st.read) return `the game never read "${game.key}" — this suite's key list has drifted from the source`;
  return null;
}

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });

  // A — malformed slot.
  for (const game of GAMES) {
    const bad = [];
    for (const [label, json] of SHAPES) {
      const why = await boot(browser, game, json);
      if (why) bad.push(`${label}: ${why}`);
    }
    ok(bad.length === 0,
      `${game.name} boots with a malformed save (${SHAPES.length} shapes)${bad.length ? ' — ' + bad.join(' | ') : ''}`);
  }

  // B — hostile numbers in real fields.
  for (const spec of FIELDS) {
    const game = GAMES.find(g => g.name === spec.game);
    const bad = [];
    for (const { label, json } of numCases(spec.game, spec.fields, spec.extra)) {
      const why = await boot(browser, game, json);
      if (why) bad.push(`${label}: ${why}`);
    }
    ok(bad.length === 0,
      `${game.name} boots with hostile ${spec.fields.join('/')} (${BAD_NUMS.length} values)${bad.length ? ' — ' + bad.join(' | ') : ''}`);
  }

  // C — guard the guard. If the shape or field tables were emptied, every
  // assertion above would pass vacuously.
  ok(GAMES.length === 5, `all five saving flagships are covered (got ${GAMES.length})`);
  ok(SHAPES.length >= 7, `the malformed-shape table is populated (got ${SHAPES.length})`);
  ok(BAD_NUMS.includes(-1) && BAD_NUMS.includes(0),
    'the hostile-number list still contains -1 and 0, the two that found the bugs');
  ok(FIELDS.filter(f => f.game === 'Hearthvale').length >= 3
     && FIELDS.some(f => f.fields.includes('goalIndex')),
     'the field table still covers the fields the three bugs were found in');

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
