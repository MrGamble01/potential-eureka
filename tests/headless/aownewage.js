/* Hook-free: Eclipse, the age after Singularity, plus the new
 * skirmisher/shield pair on every earlier age. The Ridge, the
 * company, the booth, and the career note stay where they were. */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const PAIRS = [
  ['Runner', 'Bulwark'],
  ['Outrider', 'Shieldman'],
  ['Dragoon', 'Ironclad'],
  ['Raider', 'Riot Guard'],
  ['Blink Knife', 'Aegis'],
  ['Shard Dancer', 'Phase Bastion'],
];
const ECLIPSE_LOCK = '🔒 ECLIPSE — reach the Singularity once to unlock the next age';

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const errors = [];

  async function boot(width, height, seed) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript(s => {
      localStorage.setItem('aow-welcome-seen', '1');
      localStorage.setItem('aow-coach-done', '1');
      if (s.ach) localStorage.setItem('aow-achievements', JSON.stringify(s.ach));
      if (s.session) localStorage.setItem('aow-session', JSON.stringify(s.session));
    }, seed || {});
    await page.goto(BASE + '/ageofwar/', { waitUntil: 'load' });
    if (seed && seed.session) await page.click('#aow-resume-cta');
    return { context, page };
  }

  {
    const { context, page } = await boot(1280, 800, {});
    const first = await page.locator('.aow-spawn-btn').first().innerText();
    ok(/Clubman/.test(first), 'stone age still leads with Clubman');
    const titles = await page.locator('.aow-spawn-btn').evaluateAll(els => els.map(el => el.title));
    ok(titles.some(t => t.startsWith('Runner — HP 46') && t.includes('Fast skirmisher')),
      'Runner keeps the stat line and adds the skirmisher blurb');
    ok(titles.some(t => t.startsWith('Bulwark — HP 220') && t.includes('Shielded tank')),
      'Bulwark keeps the stat line and adds the tank blurb');
    await context.close();
  }

  {
    const { context, page } = await boot(1280, 800, {
      session: { v: 2, waveNum: 4, gold: 5000, xp: 99999, playerEra: 5, enemyEra: 4 },
    });
    const age = page.locator('#aow-ageup-btn');
    ok(await age.getAttribute('title') === ECLIPSE_LOCK, 'eclipse stays locked until Singularity has been reached');
    const eraName = () => page.locator('#aow-era-name').evaluate(el => el.textContent);
    const before = await eraName();
    await page.keyboard.press('q');
    await page.click('#aow-ageup-btn');
    const after = await eraName();
    ok(before === 'Singularity' && after === 'Singularity', `Q and the button do not spend the eclipse gate (${before} → ${after})`);
    const names = await page.locator('.aow-spawn-name').allInnerTexts();
    for (const [fast, tank] of PAIRS) {
      ok(names.includes(fast) && names.includes(tank), `${fast} and ${tank} are on the recruit row`);
    }
    await context.close();
  }

  {
    const { context, page } = await boot(1280, 900, {
      ach: { max_age: 1, void_walk: 1 },
      session: {
        v: 2, waveNum: 4, gold: 90000, xp: 99999, playerEra: 5, enemyEra: 4,
        playerBaseHp: 4000, playerBaseMax: 4000, enemyBaseHp: 4000, enemyBaseMax: 4000,
        waveBreatherT: 8,
      },
    });
    const noted = await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('eureka-progress') || '{}');
      return !!(raw.games && raw.games.ageofwar);
    });
    ok(noted, 'resume still notes the ageofwar career hook');
    await page.keyboard.press('q');
    await page.waitForFunction(() => document.getElementById('aow-era-name').textContent === 'Eclipse');
    ok((await page.locator('#aow-era-name').getAttribute('data-age-cue')) === 'eclipse', 'eclipse sets the age cue');
    const mood = await page.evaluate(() => window.EurekaAudio && window.EurekaAudio.mood());
    ok(mood === 'victory', `eclipse music cue is the victory hold (${mood})`);
    ok((await page.locator('#aow-special-btn').innerText()).includes('Corona'), 'eclipse special is Corona');
    const names = await page.locator('.aow-spawn-name').allInnerTexts();
    for (const name of ['Dusk Blade', 'Corona', 'Star Colossus', 'Comet', 'Umbra', 'Event Horizon']) {
      ok(names.includes(name), `${name} recruits in Eclipse`);
    }
    await page.click('[data-tab="turrets"]');
    ok((await page.locator('#aow-turrets-tab').innerText()).includes('Eclipse Lens'), 'eclipse turret is the Eclipse Lens');
    await page.waitForFunction(() => {
      const c = document.getElementById('aow-canvas');
      if (!c) return false;
      const ctx = c.getContext('2d');
      const band = ctx.getImageData(0, 0, c.width, Math.min(28, c.height)).data;
      for (let i = 0; i < band.length; i += 16) {
        const dist = Math.abs(band[i] - 18) + Math.abs(band[i + 1] - 8) + Math.abs(band[i + 2] - 24);
        if (dist < 24) return true;
      }
      return false;
    }, null, { timeout: 3000 });
    const sky = await page.evaluate(() => {
      const c = document.getElementById('aow-canvas');
      const ctx = c.getContext('2d');
      const band = ctx.getImageData(0, 0, c.width, Math.min(28, c.height)).data;
      let best = 999, rgb = [0, 0, 0];
      for (let i = 0; i < band.length; i += 16) {
        const p = [band[i], band[i + 1], band[i + 2]];
        const dist = Math.abs(p[0] - 18) + Math.abs(p[1] - 8) + Math.abs(p[2] - 24);
        if (dist < best) { best = dist; rgb = p; }
      }
      return { top: c.dataset.skyTop || '', best, rgb };
    });
    ok(sky.top === '#120818' && sky.best < 36,
      `eclipse sky is #120818 (${sky.top}, nearest ${sky.rgb.join(',')} dist ${sky.best})`);
    ok((await page.locator('#aow-ageup-btn').innerText()).includes('Max Age'), 'Eclipse is the last age');
    await context.close();
  }

  {
    const { context, page } = await boot(1280, 800, {
      session: { v: 2, waveNum: 2, gold: 800, xp: 40, playerEra: 1, enemyEra: 0, fieldOrder: 'levy' },
    });
    await page.waitForSelector('#aow-ridge-btn.aow-show');
    ok(true, 'a standing levy still opens the Ridge');
    const booth = await page.locator('#arcade-ai-speakers .ai-speaker').evaluateAll(els =>
      els.map(el => ({ id: el.dataset.npc, shown: !el.hidden && el.getBoundingClientRect().width > 8 })));
    ok(booth.filter(b => b.shown).map(b => b.id).sort().join(',') === 'bram,holt,lira',
      'Bram, Lira and Holt are still on the field (' + booth.map(b => b.id + (b.shown ? '' : ' hidden')).join(', ') + ')');
    await page.click('#aow-ridge-btn');
    const card = await page.locator('#aow-ridge').innerText();
    ok(card.includes('Squire') && card.includes('Archer'), 'the Squire and the Archer still march with the Ridge');
    await context.close();
  }

  await browser.close();
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });
