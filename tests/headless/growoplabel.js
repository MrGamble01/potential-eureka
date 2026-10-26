/*
 * Grow Op labels are one screen-space pill. At every size, the text sits
 * inside that pill, the pill sits inside the viewport, and pills do not overlap.
 */
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8124';
const SIZES = [
  [390, 844],
  [744, 1133],
  [1366, 768],
  [1920, 1080],
];

let pass = 0;
let fail = 0;
const ok = (cond, name) => {
  if (cond) pass += 1;
  else fail += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
};

function labelProblems() {
  const problems = [];
  const els = [...document.querySelectorAll('.go-pin, .go-badge, .go-plate')].filter((el) => !el.hidden);
  if (!els.length) problems.push('no labels');
  const boxes = els.map((el) => ({
    r: el.getBoundingClientRect(),
    text: (el.innerText || '').replace(/\s+/g, ' ').trim(),
    el,
  }));
  for (const box of boxes) {
    const r = box.r;
    const text = box.text;
    if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) {
      problems.push('clipped ' + text);
    }
    for (const child of box.el.querySelectorAll('strong, span, .go-pin-bar')) {
      if (child.hidden) continue;
      const c = child.getBoundingClientRect();
      if (c.width < 1 || c.height < 1) continue;
      if (c.left < r.left - 1 || c.right > r.right + 1 || c.top < r.top - 1 || c.bottom > r.bottom + 1) {
        problems.push('text outside plate ' + text);
      }
    }
    const family = getComputedStyle(box.el.querySelector('strong')).fontFamily;
    if (!/Outfit/i.test(family)) problems.push('font ' + family);
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].r;
      const b = boxes[j].r;
      const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (x > 1 && y > 1) problems.push('overlap ' + boxes[i].text + ' / ' + boxes[j].text);
    }
  }
  return problems;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    for (const [width, height] of SIZES) {
      const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 800, hasTouch: width < 800 });
      page.setDefaultTimeout(20000);
      await page.addInitScript(() => localStorage.removeItem('growop-cartel-v1'));
      await page.goto(BASE + '/games/grow-op/index.html', { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await page.locator('#btn-start-operation').click();
      await page.evaluate(() => {
        const g = window.__growOp;
        g.fastForward(8);
        g.dismissChrome();
        g.frameValley();
      });
      await page.waitForTimeout(400);
      const valley = await page.evaluate(labelProblems);
      ok(!valley.length, width + 'x' + height + ' valley labels ' + (valley.join('; ') || 'fit'));
      await page.evaluate(() => window.__growOp.frameOverview());
      await page.waitForTimeout(600);
      const overview = await page.evaluate(labelProblems);
      ok(!overview.length, width + 'x' + height + ' overview labels ' + (overview.join('; ') || 'fit'));
      await page.close();
    }
  } catch (err) {
    ok(false, String(err && err.message || err).split('\n')[0]);
  }
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
})();
