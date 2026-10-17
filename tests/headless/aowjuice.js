/* Hook-free: combat juice on a seeded duel.
 * Full motion paints flashes, knock, numbers, death puffs, impacts
 * and a light shake, and the shared feel kit gets a burst plus a popup.
 * Reduced motion — the feel setting, or the OS preference while the
 * setting is Auto — keeps the number and the popup and skips the rest.
 * A skirmisher into a shield pays the 1.5 counter (80 → 120). */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const SESSION = {
  v: 2, waveNum: 2, gold: 800, xp: 10, playerEra: 0, enemyEra: 0,
  playerBaseHp: 1500, playerBaseMax: 1500, enemyBaseHp: 1500, enemyBaseMax: 1500,
  waveBreatherT: 8, waveEnemiesRemaining: 0,
  units: [
    { side: 'player', key: 'runner', x: 640, hp: 200, hpMax: 200, dmg: 80 },
    { side: 'enemy', key: 'bulwark', x: 660, hp: 40, hpMax: 40, dmg: 9 },
  ],
};

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const errors = [];

  async function duel(label, feel, media) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      reducedMotion: media || 'no-preference',
    });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(label + ': ' + e));
    await page.addInitScript(seed => {
      localStorage.setItem('aow-welcome-seen', '1');
      localStorage.setItem('aow-coach-done', '1');
      localStorage.setItem('eureka-feel-v1', JSON.stringify({ motion: seed.feel, haptics: false }));
      localStorage.setItem('aow-session', JSON.stringify(seed.session));
    }, { feel, session: SESSION });
    await page.goto(BASE + '/ageofwar/', { waitUntil: 'load' });
    await page.click('#aow-resume-cta');
    const hit = await page.waitForFunction(() => {
      const c = document.getElementById('aow-canvas');
      if (!c) return false;
      const number = Number(c.dataset.juiceNumber || 0);
      const popup = document.querySelectorAll('.feel-popup').length;
      if (number < 1 || popup < 1) return false;
      return {
        flash: Number(c.dataset.juiceFlash || 0),
        knock: Number(c.dataset.juiceKnock || 0),
        number,
        puff: Number(c.dataset.juicePuff || 0),
        impact: Number(c.dataset.juiceImpact || 0),
        shake: Number(c.dataset.juiceShake || 0),
        dealt: c.dataset.lastDealt || '',
        particles: window.EurekaFeel ? window.EurekaFeel.particleCount() : -1,
        popup,
        reduced: window.EurekaFeel ? window.EurekaFeel.reduced() : null,
      };
    }, null, { timeout: 4000 }).then(h => h.jsonValue());
    await context.close();
    return hit;
  }

  const full = await duel('full', 'full', null);
  ok(full.reduced === false, 'full motion is not reduced');
  ok(full.flash > 0 && full.knock > 0 && full.number > 0 && full.puff > 0 && full.impact > 0 && full.shake > 0,
    `full motion counts flash/knock/number/puff/impact/shake (${full.flash}/${full.knock}/${full.number}/${full.puff}/${full.impact}/${full.shake})`);
  ok(full.dealt === '120', `skirmisher vs shield deals 120 (${full.dealt})`);
  ok(full.particles > 0 && full.popup > 0, `feel kit burst and popup (${full.particles} particles)`);

  for (const spec of [
    { label: 'feel-reduced', feel: 'reduced', media: null },
    { label: 'os-reduced', feel: 'auto', media: 'reduce' },
  ]) {
    const quiet = await duel(spec.label, spec.feel, spec.media);
    ok(quiet.reduced === true, `${spec.label}: reduced motion is on`);
    ok(quiet.number > 0 && quiet.popup > 0, `${spec.label}: damage number and popup stay`);
    ok(quiet.impact === 0 && quiet.shake === 0 && quiet.puff === 0 && quiet.knock === 0,
      `${spec.label}: impact/shake/puff/knock stay off (${quiet.impact}/${quiet.shake}/${quiet.puff}/${quiet.knock})`);
    ok(quiet.particles === 0, `${spec.label}: feel particles stay off`);
    ok(quiet.dealt === '120', `${spec.label}: the counter still deals 120`);
  }

  await browser.close();
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });
