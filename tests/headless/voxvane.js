/* Hook-free weather-vane taps: live sky ETA, linger, calls, and wager status, without moving the sky. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    for (const width of [1280, 768]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      await page.addInitScript(() => {
        localStorage.setItem('voxel-garden-v1', JSON.stringify({
          v: 1, seed: 1, savedAt: Date.now(),
          state: { helpSeen: true, muted: true, musicOff: true, coins: 100,
            level: 8, day: 4, buildings: { vane: { x: 4, z: 4 } }, vaneCalls: 3 },
          edits: [], wet: [], islets: [], plants: [], animals: [], workers: [],
        }));
      });
      await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
      await page.waitForFunction(() => typeof doAction === 'function' && W.buildingMeshes.vane && typeof reportVane === 'function');
      const reports = await page.evaluate(() => {
        let summer = 0, winter = 0;
        for (let d = 1; d < 40 && !(summer && winter); d++) {
          const k = seasonOf(d).key;
          if (!summer && k === 'summer') summer = d;
          if (!winter && k === 'winter') winter = d;
        }
        const snapshot = () => ({
          coins: state.coins,
          day: state.day,
          vaneCalls: state.vaneCalls || 0,
          cloudWins: state.cloudWins || 0,
          cloudLosses: state.cloudLosses || 0,
          rainT, rainLeft, rainActive, vaneCalled,
          cloudBet: cloudBet ? cloudBet.timeLeft : null,
        });
        const tap = (sky) => {
          state.day = sky.day;
          state.coins = 100;
          state.vaneCalls = sky.calls;
          state.cloudWins = 2;
          state.cloudLosses = 1;
          rainActive = sky.rainActive;
          rainT = sky.rainT;
          rainLeft = sky.rainLeft;
          vaneCalled = sky.vaneCalled;
          cloudBet = sky.wager == null ? null : { timeLeft: sky.wager };
          const before = snapshot();
          document.getElementById('toasts').replaceChildren();
          doAction({ object: W.buildingMeshes.vane });
          return { before, after: snapshot(),
            toasts: [...document.querySelectorAll('#toasts .toast')].map(el => el.textContent) };
        };
        return {
          summer, winter,
          rows: [
            tap({ day: summer, calls: 3, rainActive: false, rainT: 84.2, rainLeft: 0, vaneCalled: false, wager: null }),
            tap({ day: summer, calls: 3, rainActive: false, rainT: 30.01, rainLeft: 0, vaneCalled: false, wager: null }),
            tap({ day: summer, calls: 3, rainActive: false, rainT: 30, rainLeft: 0, vaneCalled: false, wager: null }),
            tap({ day: summer, calls: 3, rainActive: false, rainT: 12.1, rainLeft: 0, vaneCalled: true, wager: null }),
            tap({ day: summer, calls: 3, rainActive: false, rainT: 0.4, rainLeft: 0, vaneCalled: false, wager: null }),
            tap({ day: summer, calls: 3, rainActive: false, rainT: 0, rainLeft: 0, vaneCalled: true, wager: null }),
            tap({ day: summer, calls: 3, rainActive: false, rainT: -0.5, rainLeft: 0, vaneCalled: true, wager: null }),
            tap({ day: summer, calls: 3, rainActive: true, rainT: 0, rainLeft: 18.2, vaneCalled: false, wager: null }),
            tap({ day: summer, calls: 3, rainActive: true, rainT: 0, rainLeft: 0.2, vaneCalled: false, wager: null }),
            tap({ day: summer, calls: 3, rainActive: true, rainT: 0, rainLeft: 0, vaneCalled: false, wager: null }),
            tap({ day: summer, calls: 3, rainActive: true, rainT: 0, rainLeft: -1, vaneCalled: false, wager: null }),
            tap({ day: winter, calls: 0, rainActive: false, rainT: 40.1, rainLeft: 0, vaneCalled: false, wager: null }),
            tap({ day: winter, calls: 1, rainActive: false, rainT: 8, rainLeft: 0, vaneCalled: true, wager: 44.2 }),
            tap({ day: winter, calls: 5, rainActive: true, rainT: 0, rainLeft: 10.4, vaneCalled: false, wager: 11.2 }),
            tap({ day: summer, calls: 3, rainActive: false, rainT: 50, rainLeft: 0, vaneCalled: true, wager: 0 }),
          ],
        };
      });
      assert.equal(reports.summer > 0 && reports.winter > 0, true, 'calendar has a summer and a winter day');
      for (const report of reports.rows) {
        assert.deepEqual(report.after, report.before, 'tap leaves sky, wager, calls, coins and day unchanged');
        assert.equal(report.toasts.length, 1, 'one clear toast per tap');
        assert.doesNotMatch(report.toasts[0], /Reads the sky|Weather Vane/);
        assert.match(report.toasts[0], /Showers linger 25% longer/);
      }
      const t = reports.rows.map(r => r.toasts[0]);
      assert.match(t[0], /Next shower in 85s/);
      assert.match(t[0], /Calls inside 30s/);
      assert.match(t[0], /Calls 3/);
      assert.match(t[0], /No wager/);
      assert.doesNotMatch(t[0], /Called ·/);
      assert.match(t[1], /Next shower in 31s/);
      assert.match(t[1], /Calls inside 30s/);
      assert.match(t[2], /Called · Shower in 30s/);
      assert.doesNotMatch(t[2], /Calls inside/);
      assert.match(t[3], /Called · Shower in 13s/);
      assert.match(t[3], /Calls 3/);
      assert.match(t[3], /No wager/);
      assert.match(t[4], /Called · Shower in 1s/);
      assert.match(t[5], /The shower is about to land/);
      assert.match(t[5], /No wager/);
      assert.doesNotMatch(t[5], /Next shower|Called ·/);
      assert.match(t[6], /The shower is about to land/);
      assert.match(t[7], /Shower falling · 19s left/);
      assert.match(t[7], /No book on falling rain/);
      assert.doesNotMatch(t[7], /No wager|Next shower/);
      assert.match(t[8], /Shower falling · 1s left/);
      assert.match(t[9], /The shower is lifting/);
      assert.match(t[9], /No book on falling rain/);
      assert.match(t[10], /The shower is lifting/);
      assert.match(t[11], /Next snow in 41s/);
      assert.match(t[11], /Calls inside 30s/);
      assert.match(t[11], /Calls 0/);
      assert.match(t[11], /No wager/);
      assert.doesNotMatch(t[11], /Next shower|Shower falling|Called ·/);
      assert.match(t[12], /Called · Snow in 8s/);
      assert.match(t[12], /Calls 1/);
      assert.match(t[12], /Wager 45s/);
      assert.doesNotMatch(t[12], /No wager|No book|Calls inside/);
      assert.match(t[13], /Snow falling · 11s left/);
      assert.match(t[13], /Calls 5/);
      assert.match(t[13], /Wager 12s/);
      assert.doesNotMatch(t[13], /No book|No wager/);
      assert.match(t[14], /Called · Shower in 50s/);
      assert.match(t[14], /Wager 0s/);
      assert.doesNotMatch(t[14], /Calls inside|No wager/);
      assert.deepEqual(errors, [], 'zero page errors');
      console.log(`PASS ${width}px: sky ETA, falling seconds, call window, linger, calls, wager clock, no-book refusal, read-only taps, zero page errors`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
