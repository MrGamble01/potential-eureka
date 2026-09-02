/*
 * HUD-1 — the three hub games whose destroy() rewinds the run must rewind
 * their info bar with it (re-runnable, no hooks).
 *
 * Stacker, Vector Defense and Word Cascade are the only hub games that call
 * reset(false) from destroy(). Every one of them repainted the board and left
 * the info bar showing the abandoned run's numbers, so returning to the view
 * showed a fresh board captioned with a run that no longer existed.
 *
 *  A. Vector Defense: play into wave 1 and buy a turret, leave, come back —
 *     cash/lives/wave read the pre-run values the board was actually reset to.
 *  B. Stacker: land a block (height + block width both move), leave, come
 *     back — height and block width read the idle tower's values.
 *  C. Word Cascade: score a word, leave, come back — score, words and the
 *     last-words strip are all empty again.
 *  D. The rewound HUD is the truthful one: pressing SPACE to start the next
 *     run leaves those same numbers in place instead of snapping them back.
 *  E. Zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

const text = (page, id) => page.evaluate(i => {
  const el = document.getElementById(i);
  return el ? el.textContent.trim() : null;
}, id);
const html = (page, id) => page.evaluate(i => {
  const el = document.getElementById(i);
  return el ? el.innerHTML.trim() : null;
}, id);
const go = async (page, hash) => {
  await page.evaluate(h => { location.hash = h; }, hash);
  await page.waitForTimeout(700);
};
// Leave the view (which is what runs destroy()) and come back.
const roundTrip = async (page, hash) => {
  await go(page, '#arcade');
  await go(page, hash);
};

// Stacker's slider crosses the platform on a clock the headless rAF doesn't
// keep, so aim the drop off the canvas instead of off a timer: sample the
// slider row and the platform row and fire when their centres line up.
async function alignedDrop(page) {
  const aligned = await page.waitForFunction(() => {
    const c = document.getElementById('stacker-canvas');
    const x = c.getContext('2d');
    const s = c.width / 420;                       // device px per CSS px
    const span = yCss => {
      const d = x.getImageData(0, Math.round(yCss * s), c.width, 1).data;
      let lo = -1, hi = -1;
      for (let i = 0; i < c.width; i++) {
        if (d[i * 4] > 30 || d[i * 4 + 1] > 30 || d[i * 4 + 2] > 40) { if (lo < 0) lo = i; hi = i; }
      }
      return lo < 0 ? null : (lo + hi) / 2 / s;
    };
    const platform = span(545);                    // the base block's row
    const slider = span(515);                      // the row above it
    return platform != null && slider != null && Math.abs(slider - platform) < 25;
  }, { timeout: 20000, polling: 16 }).then(() => true).catch(() => false);
  if (aligned) await page.keyboard.press(' ');
  await page.waitForTimeout(250);
  return aligned;
}

// Word Cascade only scores on a word clear, so drop tiles into shuffled
// columns until one lands. Restarts en route are fine — we stop on the first
// non-zero score, whichever run produced it.
async function scoreAWord(page) {
  for (let drop = 0; drop < 260; drop++) {
    for (let k = 0; k < Math.floor(Math.random() * 8); k++) await page.keyboard.press('ArrowLeft');
    for (let k = 0; k < Math.floor(Math.random() * 8); k++) await page.keyboard.press('ArrowRight');
    await page.keyboard.press(' ');
    await page.waitForTimeout(45);
    if (await text(page, 'wc-score') !== '0') return true;
  }
  return false;
}

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));

  // ---- A. Vector Defense ----
  await page.goto(BASE + '/index.html#vectordefense', { waitUntil: 'load' });
  await page.waitForTimeout(1300);
  const vdIdle = {
    cash: await text(page, 'vd-cash'),
    lives: await text(page, 'vd-lives'),
    wave: await text(page, 'vd-wave'),
  };
  ok(vdIdle.cash === '$120' && vdIdle.wave === '0 / 10',
    `VD idle HUD is the pre-run state (${vdIdle.cash}, wave ${vdIdle.wave})`);

  await page.keyboard.press(' ');            // start the run
  await page.waitForTimeout(400);
  await page.keyboard.press(' ');            // launch wave 1
  await page.waitForTimeout(1800);
  const pad = await page.locator('#vd-canvas').boundingBox();
  await page.mouse.click(pad.x + pad.width * (200 / 640), pad.y + pad.height * (150 / 480));  // buy a Pulse
  await page.waitForTimeout(400);
  const vdPlaying = {
    cash: await text(page, 'vd-cash'),
    wave: await text(page, 'vd-wave'),
  };
  ok(vdPlaying.cash !== vdIdle.cash, `VD: buying a turret moved cash (${vdIdle.cash} → ${vdPlaying.cash})`);
  ok(vdPlaying.wave !== vdIdle.wave, `VD: the run reached wave ${vdPlaying.wave}`);

  await roundTrip(page, '#vectordefense');
  ok(await text(page, 'vd-cash') === vdIdle.cash, 'VD: cash rewinds with the board on return');
  ok(await text(page, 'vd-lives') === vdIdle.lives, 'VD: lives rewind with the board on return');
  ok(await text(page, 'vd-wave') === vdIdle.wave, 'VD: wave rewinds with the board on return');

  // D. the rewound numbers are the real ones — starting the next run keeps them.
  await page.keyboard.press(' ');
  await page.waitForTimeout(400);
  ok(await text(page, 'vd-cash') === vdIdle.cash && await text(page, 'vd-wave') === vdIdle.wave,
    'VD: the next run starts from exactly the numbers the HUD was showing');

  // ---- B. Stacker ----
  await go(page, '#stacker');
  const stIdle = { height: await text(page, 'stacker-height'), block: await text(page, 'stacker-width') };
  ok(stIdle.height === '0' && stIdle.block === '180', `Stacker idle HUD is the base tower (${stIdle.block}px)`);

  await page.keyboard.press(' ');            // start
  await page.waitForTimeout(300);
  ok(await alignedDrop(page), 'Stacker: a block landed on the tower');
  const stPlaying = { height: await text(page, 'stacker-height'), block: await text(page, 'stacker-width') };
  ok(stPlaying.height === '1', `Stacker: height climbed to ${stPlaying.height}`);
  ok(stPlaying.block !== stIdle.block, `Stacker: the slice narrowed the block (${stIdle.block} → ${stPlaying.block})`);

  await roundTrip(page, '#stacker');
  ok(await text(page, 'stacker-height') === stIdle.height, 'Stacker: height rewinds with the board on return');
  ok(await text(page, 'stacker-width') === stIdle.block, 'Stacker: block width rewinds with the board on return');

  // ---- C. Word Cascade ----
  await go(page, '#wordcascade');
  const wcIdle = { score: await text(page, 'wc-score'), words: await text(page, 'wc-words') };
  ok(wcIdle.score === '0' && wcIdle.words === '0', 'Word Cascade idle HUD is a blank run');

  await page.keyboard.press(' ');            // start
  await page.waitForTimeout(300);
  ok(await scoreAWord(page), 'Word Cascade: a word cleared and scored');
  ok(await html(page, 'wc-lastwords') !== '', 'Word Cascade: the last-words strip filled in');

  await roundTrip(page, '#wordcascade');
  ok(await text(page, 'wc-score') === wcIdle.score, 'Word Cascade: score rewinds with the board on return');
  ok(await text(page, 'wc-words') === wcIdle.words, 'Word Cascade: word count rewinds with the board on return');
  ok(await html(page, 'wc-lastwords') === '', 'Word Cascade: the last-words strip empties with the board');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
