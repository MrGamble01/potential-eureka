/* Grow Op strains, gear, and the street-tax event.
 *
 * Hook-free. The quote, the grow label and the heat line are checked
 * against the multipliers in drug-lab.html, so a retune that forgets
 * the board fails here. Broke clicks and the Act II gate are real
 * button presses. $0 must survive a reload. One random street event
 * has to open and resolve.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
const src = fs.readFileSync(path.join(ROOT, 'drug-lab.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const block = /const STRAINS = \[([\s\S]*?)\n\];/.exec(src);
const strains = block ? [...block[1].matchAll(/\{ id:'(\w+)',\s*name:'([^']+)',[\s\S]*?cost:(\d+),\s*act:(\d+),\s*grow:([\d.]+),\s*price:([\d.]+),\s*heat:([\d.]+)/g)]
  .map(m => ({ id: m[1], name: m[2], cost: +m[3], act: +m[4], grow: +m[5], price: +m[6], heat: +m[7] })) : [];
const byId = id => strains.find(s => s.id === id);
const cashRate = s => s.price / s.grow;
const heatRate = s => s.heat / s.grow;
const tenths = n => {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
};
const blurb = s => {
  if (s.grow === 1 && s.price === 1 && s.heat === 1) return 'The starter cut. Even grow, street price, and heat.';
  const time = Math.round(s.grow * 100);
  const heatPct = Math.round(Math.abs(s.heat - 1) * 100);
  const heatWord = s.heat > 1 ? heatPct + '% hotter' : heatPct + '% cooler';
  const act = s.act > 1 ? 'Act II genetics. ' : '';
  return act + 'Finishes in ' + time + '% of the time. Sells at ' + s.price.toFixed(2) + '× and runs ' + heatWord + '.';
};
function expectQuote(s, extra) {
  const drip = extra && extra.drip || 0;
  const grow = 18 * s.grow / (1 + drip * 0.15);
  const price = Math.floor(25 * s.price);
  const heat = 6 * s.heat;
  return { grow: tenths(grow), price, heat: tenths(heat) };
}

ok(strains.length === 4, `four strains parsed (${strains.length})`);
const fastest = strains.reduce((a, b) => a.grow < b.grow ? a : b);
const coolest = strains.reduce((a, b) => heatRate(a) < heatRate(b) ? a : b);
const richest = strains.reduce((a, b) => cashRate(a) > cashRate(b) ? a : b);
ok(fastest.id === 'diesel' && fastest.heat > 1, 'Sour Diesel is the fastest cut and it runs hot');
ok(coolest.id === 'haze' && coolest.price > 1 && heatRate(coolest) < 1, 'Purple Haze is the coolest per second and still pays more');
ok(richest.id === 'dawg' && richest.heat > 1 && richest.act === 2, 'Chem Dawg is the richest per second, hotter, and Act II');
ok(fastest.id !== richest.id && coolest.id !== richest.id && coolest.id !== fastest.id,
  'no cut wins more than one of speed, heat and cash');
ok(strains.filter(s => s.grow === 1 && s.price === 1 && s.heat === 1 && s.cost === 0).length === 1,
  'Garage Kush is the free even baseline');
ok(/Plants ripen on their own/.test(src) && !/Click a plot to plant/.test(src),
  'the crash course no longer says a click plants');
ok(/strain board/.test(src), 'the crash course mentions the strain board');
for (const id of ['tent_mold', 'clone_jar', 'smell_check', 'corner_tax']) {
  ok(src.includes("id:'" + id + "'"), `event ${id} is in the table`);
}
const sell = src.slice(src.indexOf('function sellToDealer'), src.indexOf('function updateDealers'));
ok((sell.match(/applyStreetTax/g) || []).length >= 2, 'street tax hits the Whale and a normal sale');
const saleFn = src.slice(src.indexOf('function salePrice'), src.indexOf('function salePrice') + 700);
ok(!saleFn.includes('applyStreetTax'), 'list price itself is not taxed, so contracts and the van stay clean');
ok(/SMELL_HEAT_FILTERED/.test(src) && /upgLv\('filter'\) > 0/.test(src),
  'a carbon filter softens the smell check');
ok(/Math\.round\(\(1 - TAX_RATE\) \* 100\)/.test(src) && /TAX_HANDS/.test(src),
  'the skim percent and the hand count are taken from the constants');
ok(/Number\.isFinite\(Number\(sv\.cash\)\)/.test(src), 'a $0 balance is not treated as a missing save');

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const kush = byId('kush'), diesel = byId('diesel'), haze = byId('haze'), dawg = byId('dawg');
    for (const width of [1280, 768]) {
      const context = await browser.newContext({ viewport: { width, height: 800 } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      await page.clock.install({ time: new Date('2026-09-25T12:00:00Z') });
      await page.clock.pauseAt(new Date('2026-09-25T12:00:01Z'));
      await page.goto(BASE + '/drug-lab.html');
      await page.click('#diff-careful');
      await page.click('#intro-go');
      const read = () => page.evaluate(() => {
        window.dispatchEvent(new Event('pagehide'));
        const save = JSON.parse(localStorage.getItem('drug-lab-v1'));
        const quote = document.getElementById('strain-quote').textContent;
        const heatRate = document.getElementById('heat-rate').textContent;
        const labels = [...document.querySelectorAll('#labels > div')].map(el => el.textContent);
        const toast = document.getElementById('toast-container').textContent;
        return { save, quote, heatRate, labels, toast,
          dieselTitle: document.getElementById('strain-diesel').title,
          kushOn: document.getElementById('strain-kush').classList.contains('on') };
      });
      const fresh = await read();
      const q0 = expectQuote(kush);
      ok(fresh.kushOn && fresh.quote.includes('Garage Kush') && fresh.quote.includes(`bag $${q0.price}`)
        && fresh.quote.includes(`heat +${q0.heat}`) && fresh.quote.includes(`grow ${q0.grow}s`),
        `${width}: fresh quote is Garage Kush at $${q0.price}, heat +${q0.heat}, grow ${q0.grow}s (${fresh.quote})`);
      ok(fresh.heatRate.includes('0.3/s') && fresh.heatRate.includes('+6/sale'),
        `${width}: heat line shows the bare drain and a single-bag sale`);
      ok(fresh.dieselTitle.includes(blurb(diesel)), `${width}: Diesel's hover matches its multipliers`);
      await page.getByRole('button', { name: /Sour Diesel/ }).click();
      const broke = await read();
      ok(broke.save.cash === 50 && broke.save.strain === 'kush' && /Need \$110 more for Sour Diesel/.test(broke.toast),
        `${width}: broke Diesel click names the shortfall and spends nothing`);

      const seed = fresh.save;
      const load = async overrides => {
        await page.goto(BASE + '/404.html');
        await page.evaluate(s => {
          s.savedAt = Date.now();
          localStorage.setItem('drug-lab-v1', JSON.stringify(s));
          localStorage.setItem('growop-intro-seen', '1');
        }, { ...seed, market: { mult: 1, target: 1, shiftIn: 100, surge: null, surgeIn: 400 }, ...overrides });
        await page.goto(BASE + '/drug-lab.html');
      };
      await load({ cash: 0, totalEarned: 0 });
      const zero = await read();
      ok(zero.save.cash === 0, `${width}: broke reload keeps the empty pocket ($${zero.save.cash})`);

      await load({ cash: 4000, totalEarned: 0, strain: 'kush', strainsOwned: ['kush'],
        plots: [{ r: 'garage', g: 0.31 }, { r: 'garage', g: 0.31 }] });
      await page.getByRole('button', { name: /Sour Diesel/ }).click();
      const bought = await read();
      const qd = expectQuote(diesel);
      ok(bought.save.cash === 4000 - diesel.cost && bought.save.strain === 'diesel'
        && bought.save.strainsOwned.includes('diesel')
        && bought.quote.includes(`bag $${qd.price}`) && bought.quote.includes(`heat +${qd.heat}`)
        && bought.quote.includes(`grow ${qd.grow}s`),
        `${width}: buying Diesel spends $${diesel.cost} and retimes the quote (${bought.quote})`);
      await page.clock.runFor(40);
      const growing = await read();
      const growSecs = s => {
        const cut = byId(s.strain || 'kush');
        const dur = 18 * cut.grow / (1 + ((s.upgrades && s.upgrades.drip) || 0) * 0.15) / (s.crunch ? 1.3 : 1);
        return Math.ceil(Math.max(0, (1 - s.plots[0].g) * dur));
      };
      ok(growing.labels.some(t => t === `🌿 ${growSecs(growing.save)}s`) && growSecs(growing.save) < 13,
        `${width}: the live plant label uses the Diesel grow time`);
      const cashAfterDiesel = bought.save.cash;
      await page.getByRole('button', { name: /Garage Kush/ }).click();
      const back = await read();
      ok(back.save.cash === cashAfterDiesel && back.save.strain === 'kush' && back.quote.includes('grow 18s'),
        `${width}: switching back to Kush is free and restores 18s`);
      await page.getByRole('button', { name: /Purple Haze/ }).click();
      const hazed = await read();
      const qh = expectQuote(haze);
      ok(hazed.save.cash === cashAfterDiesel - haze.cost && hazed.save.strain === 'haze'
        && hazed.quote.includes(`bag $${qh.price}`) && hazed.quote.includes(`heat +${qh.heat}`),
        `${width}: Haze pays more and runs cooler (${hazed.quote})`);
      const beforeDawg = hazed.save.cash;
      await page.getByRole('button', { name: /Chem Dawg/ }).click();
      const gated = await read();
      ok(gated.save.cash === beforeDawg && gated.save.strain === 'haze' && /Act II/.test(gated.toast),
        `${width}: Chem Dawg stays locked in Act I`);

      await load({ cash: 100, totalEarned: 0, strain: 'kush', strainsOwned: ['kush'] });
      const dripBtn = await page.getByRole('button', { name: /Drip Lines/ }).textContent();
      ok(/Need \$140/.test(dripBtn), `${width}: a broke Drip Lines button says what it costs (${dripBtn})`);
      await page.getByRole('button', { name: /Drip Lines/ }).click();
      const dripBroke = await read();
      ok(dripBroke.save.cash === 100 && !dripBroke.save.upgrades.drip && /Need \$140 more for Drip Lines/.test(dripBroke.toast),
        `${width}: the Drip Lines click toasts the shortfall`);

      await load({ cash: 5000, totalEarned: 2000, strain: 'kush', strainsOwned: ['kush'], heat: 40, stashCount: 0 });
      await page.getByRole('button', { name: /Chem Dawg/ }).click();
      const dawgBought = await read();
      const qdawg = expectQuote(dawg);
      ok(dawgBought.save.cash === 5000 - dawg.cost && dawgBought.save.strain === 'dawg'
        && dawgBought.quote.includes(`bag $${qdawg.price}`) && dawgBought.quote.includes(`grow ${qdawg.grow}s`),
        `${width}: Act II buys Chem Dawg (${dawgBought.quote})`);
      await page.getByRole('button', { name: /Drip Lines/ }).click();
      await page.getByRole('button', { name: /Carbon Filter/ }).click();
      const geared = await read();
      ok(geared.save.upgrades.drip === 1 && geared.save.upgrades.filter === 1
        && geared.quote.includes(`grow ${expectQuote(dawg, { drip: 1 }).grow}s`)
        && geared.heatRate.includes('0.5/s'),
        `${width}: drip shortens the Dawg cycle and the filter raises drain (${geared.quote} / ${geared.heatRate})`);

      if (width === 1280) {
        await load({ cash: 100, totalEarned: 0, heat: 50, stashCount: 0, trimQueue: 1, strain: 'kush', strainsOwned: ['kush'] });
        await page.clock.runFor(40);
        const plainTrim = await read();
        await load({ cash: 100, totalEarned: 0, heat: 50, stashCount: 0, trimQueue: 1, strain: 'kush', strainsOwned: ['kush'], upgrades: { fan: 1 } });
        await page.clock.runFor(40);
        const fanned = await read();
        const trimSecs = texts => {
          const hit = texts.find(t => t.includes('Trimming'));
          const m = hit && /(\d+)s/.exec(hit);
          return m ? +m[1] : null;
        };
        ok(trimSecs(plainTrim.labels) === 8 && trimSecs(fanned.labels) === 7,
          `fan cuts the trim countdown from ${trimSecs(plainTrim.labels)}s to ${trimSecs(fanned.labels)}s`);

        const heatDrop = async upgrades => {
          await load({ cash: 100, totalEarned: 0, heat: 50, stashCount: 0, strain: 'kush', strainsOwned: ['kush'], upgrades });
          await page.clock.runFor(200);
          const a = (await read()).save.heat;
          await page.clock.runFor(3000);
          const b = (await read()).save.heat;
          return a - b;
        };
        const bare = await heatDrop({});
        const filtered = await heatDrop({ filter: 1 });
        ok(filtered > bare + 0.3, `filter drain beats the bare tent (${filtered.toFixed(2)} vs ${bare.toFixed(2)})`);

        await load({ cash: 0, totalEarned: 0, strain: 'diesel', strainsOwned: ['kush', 'diesel'] });
        await page.goto(BASE + '/404.html');
        const kept = await page.evaluate(() => localStorage.getItem('drug-lab-v1'));
        await page.evaluate(raw => localStorage.setItem('drug-lab-v1', raw), kept);
        await page.goto(BASE + '/drug-lab.html');
        const reloaded = await read();
        ok(reloaded.save.strain === 'diesel' && reloaded.save.strainsOwned.includes('diesel'),
          'a bought cut survives a reload');

        await load({ cash: 8000, totalEarned: 500, heat: 10, stashCount: 0, strain: 'kush', strainsOwned: ['kush'] });
        let opened = false;
        let title = '';
        for (let i = 0; i < 90 && !opened; i++) {
          await page.clock.runFor(10000);
          const ev = await page.evaluate(() => {
            const m = document.getElementById('event-modal');
            return { open: !!(m && m.classList.contains('open')), title: document.getElementById('ev-title').textContent };
          });
          opened = ev.open;
          title = ev.title;
        }
        ok(opened, `a street event opened (${title || 'none'})`);
        if (opened) {
          const choice = page.locator('#ev-choices button:not([disabled])').last();
          await choice.click();
          const after = await page.evaluate(() => ({
            open: document.getElementById('event-modal').classList.contains('open'),
            cash: JSON.parse(localStorage.getItem('drug-lab-v1')).cash,
          }));
          ok(!after.open && after.cash >= 0, `the event choice closes the modal (cash $${after.cash})`);
        }
      }
      ok(errors.length === 0, `${width}: no page errors ${errors.join(' | ')}`);
      await context.close();
    }

    const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await phone.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(BASE + '/drug-lab.html');
    await page.click('#diff-careful');
    await page.click('#intro-go');
    await page.click('#manage-btn');
    await page.waitForTimeout(400);
    const box = await page.locator('#strain-quote').boundingBox();
    const seen = await page.locator('#strain-quote').innerText();
    ok(!!box && box.y >= 0 && box.y < 844 && box.x >= -1 && box.x < 390 && /Garage Kush/.test(seen),
      `390px: the strain quote is on the manage sheet (${seen})`);
    ok(errors.length === 0, `390px: no page errors ${errors.join(' | ')}`);
    await phone.close();
  } finally { await browser.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });
