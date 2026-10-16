/*
 * Age of War — first minute, end-of-war sheet, Tent and Armor clicks.
 *
 * A new player used to get a welcome sheet and then a silent field: the
 * hint line is hidden on phones and short laptops, Tent and Armor ignored
 * clicks, and the victory headline could paint transparent. This drives
 * the production page.
 */
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

(async () => {
  const launch = {
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);
  const errs = [];

  async function open(vp, seed) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(String(e).slice(0, 240)));
    if (typeof seed === 'function') await page.addInitScript(seed);
    else if (seed) {
      await page.addInitScript(
        `localStorage.setItem('aow-welcome-seen','1');` +
        `localStorage.setItem('aow-coach-done','1');` +
        `localStorage.setItem('aow-session', ${JSON.stringify(JSON.stringify(seed))});`
      );
    }
    await page.goto(BASE + '/ageofwar/index.html', { waitUntil: 'load' });
    await page.waitForTimeout(400);
    return { ctx, page };
  }

  // A — welcome, then a battlefield tip that advances when you send a unit
  {
    const { ctx, page } = await open({ width: 1280, height: 800 });
    const welcome = await page.locator('#aow-welcome-modal').evaluate(el => getComputedStyle(el).display !== 'none');
    const coachHidden = await page.locator('#aow-coach').evaluate(el => el.hidden);
    ok(welcome, 'first visit shows the welcome sheet');
    ok(coachHidden, 'the battlefield tip waits until the welcome sheet closes');
    const welcomeCopy = await page.locator('#aow-welcome-modal').innerText();
    ok(/left/i.test(welcomeCopy) && /Clubman|clubman|1/.test(welcomeCopy),
      'welcome says which side you are and how to send a soldier');
    await page.click('#aow-welcome-close');
    await page.waitForFunction(() => {
      const c = document.getElementById('aow-coach');
      const t = document.getElementById('aow-coach-text');
      return c && !c.hidden && t && /Clubman/.test(t.textContent);
    });
    const pointed = await page.locator('.aow-spawn-btn.aow-spawn-next').count();
    ok(pointed === 1, 'Clubman is marked as the next click');
    const spec = await page.locator('#aow-special-btn').getAttribute('title');
    ok(/Boulder/.test(spec || '') && /Space/.test(spec || ''), 'Special explains Boulder (' + spec + ')');
    const before = Number(await page.locator('#aow-gold').innerText());
    await page.locator('.aow-spawn-btn').filter({ hasText: 'Clubman' }).click();
    const tip = await page.locator('#aow-coach-text').innerText();
    const status = await page.locator('#aow-train-status').innerText();
    const after = Number(await page.locator('#aow-gold').innerText());
    // The treasury trickles +9 about once a second, so the purse can move
    // by 25 or by 25−9 depending on whether a tick lands mid-click.
    ok((before - after === 25 || before - after === 16) && /1\/5 queued/.test(status),
      `sending Clubman queues a recruit and spends 25 gold (${before} → ${after}; ${status})`);
    ok(/coin/i.test(tip), 'the tip moves on to coins after you send a soldier');
    await page.click('#aow-coach-dismiss');
    const dismissed = await page.evaluate(() => ({
      hidden: document.getElementById('aow-coach').hidden,
      flag: localStorage.getItem('aow-coach-done'),
    }));
    ok(dismissed.hidden && dismissed.flag === '1', 'Got it hides the tip and remembers it');
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(400);
    const stayed = await page.locator('#aow-coach').evaluate(el => el.hidden);
    ok(stayed, 'a dismissed tip stays dismissed on the next war');
    await ctx.close();
  }

  // B — Tent and Armor respond to a click, not only V and N
  {
    const { ctx, page } = await open({ width: 1280, height: 800 }, () => {
      localStorage.setItem('aow-welcome-seen', '1');
      localStorage.setItem('aow-coach-done', '1');
      localStorage.setItem('aow-session', JSON.stringify({
        v: 2, waveNum: 3, gold: 2000, xp: 20, playerEra: 1, enemyEra: 0,
        playerBaseHp: 1400, playerBaseMax: 1500, enemyBaseHp: 1400, enemyBaseMax: 1500,
      }));
    });
    await page.click('#aow-resume-cta');
    await page.waitForTimeout(200);
    const before = Number(await page.locator('#aow-gold').innerText());
    await page.locator('#aow-tent-btn').click();
    await page.waitForTimeout(150);
    const mid = Number(await page.locator('#aow-gold').innerText());
    const tent = await page.locator('#aow-tent-cd').innerText();
    ok(before - mid === 400, `clicking Tent spends 400 gold (${before} → ${mid})`);
    ok(/up/i.test(tent), 'Tent reads as raised after the click (' + tent + ')');
    await page.locator('#aow-armor-btn').click();
    await page.waitForTimeout(150);
    const after = Number(await page.locator('#aow-gold').innerText());
    const armor = await page.locator('#aow-armor-cd').innerText();
    ok(mid - after === 300, `clicking Armor spends 300 gold (${mid} → ${after})`);
    ok(/issued/i.test(armor), 'Armor reads as issued after the click (' + armor + ')');
    await ctx.close();
  }

  async function fightToEnd(seed, label) {
    const { ctx, page } = await open({ width: 1100, height: 640 }, seed);
    await page.click('#aow-resume-cta');
    await page.waitForFunction(() => {
      const ov = document.getElementById('aow-overlay');
      return ov && ov.style.display !== 'none' && /VICTORY|DEFEAT/.test(ov.innerText || '');
    }, null, { timeout: 8000 });
    const end = await page.evaluate(() => {
      const ov = document.getElementById('aow-overlay');
      const h = ov.querySelector('h2');
      const hs = getComputedStyle(h);
      const ob = ov.getBoundingClientRect();
      const hb = h.getBoundingClientRect();
      return {
        text: ov.innerText,
        color: hs.color,
        fill: hs.webkitTextFillColor,
        hTop: hb.top,
        oTop: ob.top,
        focus: document.activeElement && document.activeElement.id,
      };
    });
    const win = label === 'victory';
    ok(win ? /VICTORY/.test(end.text) && /enemy base is destroyed/i.test(end.text)
           : /DEFEAT/.test(end.text) && /hit zero/i.test(end.text),
      label + ' sheet says what happened');
    ok(/you win|you lose/i.test(end.text), label + ' sheet says you win or you lose in words');
    ok(end.fill !== 'rgba(0, 0, 0, 0)' && end.color !== 'rgba(0, 0, 0, 0)',
      label + ' headline is a solid color (' + end.color + ' / ' + end.fill + ')');
    ok(end.hTop >= end.oTop - 2, label + ' headline sits inside the sheet, not clipped above it');
    ok(end.focus === 'aow-again-cta', label + ' moves focus to Play again');
    await ctx.close();
  }

  await fightToEnd({
    v: 2, waveNum: 2, gold: 200, xp: 0, playerEra: 0, enemyEra: 0,
    playerBaseHp: 20, playerBaseMax: 1500, enemyBaseHp: 1500, enemyBaseMax: 1500,
    waveEnemiesRemaining: 4, waveBreatherT: 0, lastStandUsed: true,
    units: [{ side: 'enemy', key: 'club', x: 170, hp: 400, hpMax: 400, dmg: 500 }],
  }, 'defeat');

  await fightToEnd({
    v: 2, waveNum: 2, gold: 200, xp: 0, playerEra: 0, enemyEra: 0,
    playerBaseHp: 1500, playerBaseMax: 1500, enemyBaseHp: 20, enemyBaseMax: 1500,
    waveEnemiesRemaining: 4, waveBreatherT: 0, lastStandUsed: true,
    units: [{ side: 'player', key: 'club', x: 1100, hp: 400, hpMax: 400, dmg: 500 }],
  }, 'victory');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
