/*
 * SITE-4 — the hub explained none of itself.
 *
 * Twenty-one games, six flagships and a whole meta-layer on top — daily
 * seeds, trophies, coins, rivals, backup, offline — and the only thing
 * the front page said to a first-time visitor was PICK A GAME. All of it
 * was documented in the README, which players do not read.
 *
 *  A. Source: the primer exists and does not re-claim the ? key, which
 *     is the shortcuts cheat-sheet's (P7-HUB-3).
 *  B. A visitor with no play history gets it once, automatically.
 *  C. Escape, the backdrop and the button all dismiss it and mark it seen.
 *  D. ✨ START HERE reopens it afterwards.
 *  E. A returning player with play history is NEVER interrupted by it,
 *     even having never seen it — the point is to greet newcomers, not
 *     to ambush somebody mid-session.
 *  F. ? still opens the shortcuts sheet and not this.
 *  G. Every claim it makes about the meta-layer points at something that
 *     actually exists on the page.
 *  Z. Zero page errors.
 *
 * Hook-free. Drives the production hub.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const hub = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
ok(/id="primer-modal"/.test(hub) && /id="primer-btn"/.test(hub) && /id="primer-hint"/.test(hub),
  'SITE-4: the hub has a primer, a first-visit strip and a way back into it');
ok(!/e\.key === '\?'[\s\S]{0,200}primer-modal/.test(hub),
  'the primer does not re-claim ? — that is the shortcuts sheet');

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
    localStorage.removeItem('eureka-primer-seen');
    localStorage.removeItem('eureka-stats');
  });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(2500);

  const greeted = await page.evaluate(() => ({
    hint: !document.getElementById('primer-hint').hidden,
    modal: document.getElementById('primer-modal').style.display || 'none',
  }));
  ok(greeted.hint && greeted.modal !== 'flex',
    'a first-time visitor is offered it in a strip — never ambushed by an overlay');

  // The whole reason it is a strip: an overlay here would sit on top of
  // every click the page wants. resume and theme both broke on exactly
  // that before this changed.
  const clickable = await page.evaluate(() => {
    const card = document.querySelector('.arcade-card');
    const r = card.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!(top && top.closest('.arcade-card'));
  });
  ok(clickable, 'the game cards are still clickable with the strip showing');

  await page.click('#primer-hint-open');
  await page.waitForTimeout(300);
  const shown = await page.evaluate(() => document.getElementById('primer-modal').style.display);
  ok(shown === 'flex', 'the strip opens the full primer');

  // It opens at the top. trapFocus focuses the first control — the button
  // at the bottom — which on a phone scrolls the panel past its own title
  // and opens it mid-sentence.
  const opensAtTop = await page.evaluate(() => {
    const c = document.querySelector('#primer-modal .modal-content');
    return c.scrollTop === 0 && c.querySelector('h3').getBoundingClientRect().top >= 0;
  });
  ok(opensAtTop, 'it opens at its own title, not scrolled to the bottom');

  // G. the claims are anchored to things that exist.
  const anchored = await page.evaluate(() => {
    const t = document.getElementById('primer-modal').textContent;
    return {
      daily: /daily challenge/i.test(t) && !!document.getElementById('daily-banner'),
      hof: /Hall of Fame/i.test(t) && !!document.querySelector('[data-view="halloffame"]'),
      search: !!document.getElementById('card-search'),
      shortcuts: /\?/.test(t) && !!document.getElementById('shortcuts-modal'),
      games: document.querySelectorAll('.arcade-card').length,
    };
  });
  ok(anchored.daily, 'the daily it describes is the banner that is really there');
  ok(anchored.hof, 'the Hall of Fame it describes is really linked from the hero');
  ok(anchored.shortcuts, 'the ? it points at is the cheat-sheet that really exists');
  // The hero kicker and the primer both count the catalogue; if a new game
  // lands and only one of them is updated, that is drift on the first
  // sentence a newcomer reads.
  const counts = await page.evaluate(() => {
    const word = s => (String(s).match(/\b(TWENTY-ONE|Twenty-one|twenty-one)\b/) || [])[0] || null;
    return {
      hero: word(document.querySelector('.arcade-hero-kicker').textContent),
      primer: word(document.getElementById('primer-modal').textContent),
      cards: document.querySelectorAll('.arcade-card').length,
    };
  });
  ok(!!counts.hero && !!counts.primer,
    `the primer counts the catalogue the same way the hero does (${counts.hero} / ${counts.primer})`);
  ok(counts.cards >= 21,
    `the catalogue really has that many cards, plus the studio (${counts.cards})`);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const closed = await page.evaluate(() => ({
    display: document.getElementById('primer-modal').style.display,
    seen: localStorage.getItem('eureka-primer-seen'),
  }));
  ok(closed.display === 'none' && closed.seen === '1', 'Escape dismisses it and marks it seen');

  const hintGone = await page.evaluate(() => document.getElementById('primer-hint').hidden);
  ok(hintGone, 'and the strip does not come back once it has been taken up');

  await page.click('#primer-btn');
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => document.getElementById('primer-modal').style.display === 'flex'),
    'START HERE reopens it after it has been dismissed');

  await page.click('#primer-go');
  await page.waitForTimeout(250);
  await page.keyboard.press('?');
  await page.waitForTimeout(300);
  const keys = await page.evaluate(() => ({
    sc: document.getElementById('shortcuts-modal').style.display,
    pm: document.getElementById('primer-modal').style.display,
  }));
  ok(keys.sc === 'flex' && keys.pm === 'none',
    '? still opens the shortcuts sheet, not the primer');

  // E. somebody who has played is not interrupted, even unseen.
  const ctx2 = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page2 = await ctx2.newPage();
  const errs2 = [];
  page2.on('pageerror', e => errs2.push(String(e).slice(0, 300)));
  await page2.addInitScript(() => {
    localStorage.removeItem('eureka-primer-seen');
    localStorage.setItem('eureka-stats', JSON.stringify({ seconds: { snake: 600 }, launches: { snake: 3 } }));
  });
  await page2.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page2.waitForTimeout(2500);
  const veteran = await page2.evaluate(() => ({
    pm: document.getElementById('primer-modal').style.display || 'none',
    hint: !document.getElementById('primer-hint').hidden,
    btn: !!document.getElementById('primer-btn'),
  }));
  ok(veteran.pm !== 'flex' && !veteran.hint && veteran.btn,
    'a player with history gets neither strip nor overlay, and can still open it on purpose');

  await browser.close();
  ok(errs.length === 0 && errs2.length === 0,
    `no page errors${errs.length ? ' — ' + errs[0] : errs2.length ? ' — ' + errs2[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
