/* HV-74 — Illness Spreading said everyone feels terrible and
 * morale never moved.
 *
 * The card: "A bug is going through the camp. Everyone feels
 * terrible." The effect dropped health and food. Theft,
 * Gentrification, the Cold Snap card and a sweep all hit morale.
 * Sickness did not. The 😞 pill stayed put while Health fell.
 *
 * This suite is write-first and source-driven.
 *
 * A. Source: the card still sells misery; the effect drops morale
 *    as well as health and food. ui.js is not touched.
 * B. Behaviour: fire the real effect. Health and food still fall.
 *    Morale falls too. Reverting the morale line fails the named
 *    drop.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const loop = fs.readFileSync(path.join(ROOT, 'homeless-village/js/gameloop.js'), 'utf8');
const ui   = fs.readFileSync(path.join(ROOT, 'homeless-village/js/ui.js'), 'utf8');

const sickAt = loop.indexOf("id:'sickness'");
const nextAt = loop.indexOf("id:'dumpster_locked'");
const sick = sickAt >= 0 ? loop.slice(sickAt, nextAt > sickAt ? nextAt : sickAt + 500) : '';
const gentrifyAt = loop.indexOf("id:'gentrify'");
const gentrify = gentrifyAt >= 0 ? loop.slice(gentrifyAt, sickAt > gentrifyAt ? sickAt : gentrifyAt + 400) : '';

ok(/Everyone feels terrible/.test(sick),
   'Illness Spreading still sells misery on the card');
ok(/G\.health\s*=/.test(sick) && /G\.food\s*=/.test(sick),
   'health and food still fall — guards the guard');
ok(/G\.morale\s*=/.test(gentrify),
   'Gentrification still hits morale — the pattern this ticket copies');
ok(/G\.morale\s*=/.test(sick),
   'HV-74: the sickness effect drops morale too');
ok(!/id:'sickness'/.test(ui) && !/Everyone feels terrible/.test(ui),
   'ui.js is not this ticket — it still only paints the banner');

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 880 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 110)));
  await page.addInitScript(() => {
    try { localStorage.setItem('hv-intro-seen', '1'); } catch (e) {}
  });
  await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(2500);

  const boot = await page.evaluate(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'sickness');
    return {
      intro: !!(document.getElementById('intro-modal') && document.getElementById('intro-modal').classList.contains('open')),
      title: ev && ev.title,
      desc: ev && ev.desc,
    };
  });
  ok(!boot.intro && boot.title === 'Illness Spreading' && /feels terrible/.test(boot.desc),
     'a returning camp still has the Illness Spreading card');

  const hit = await page.evaluate(() => {
    const ev = EVENTS_BAD.find(e => e.id === 'sickness');
    const real = Math.random;
    Math.random = () => 0.5;
    G.morale = 60; G.health = 80; G.food = 20;
    if (typeof logFeed !== 'undefined') logFeed.innerHTML = '';
    if (typeof logLines !== 'undefined') logLines.length = 0;
    ev.effect();
    Math.random = real;
    const feed = Array.from(document.querySelectorAll('.log-line')).map(el => el.textContent).join('\n');
    return { morale: G.morale, health: G.health, food: G.food, feed };
  });

  ok(hit.health < 80 && hit.food < 20,
     `health and food still fall (health ${hit.health}, food ${hit.food})`);
  ok(hit.morale < 60,
     `HV-74: everyone feels terrible — morale falls too (${hit.morale})`);
  ok(/Sickness hit the community/.test(hit.feed),
     'the log still names the sickness');

  ok(errs.length === 0, `no page errors through the whole flow${errs.length ? ' — ' + errs[0] : ''}`);

  await ctx.close();
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
