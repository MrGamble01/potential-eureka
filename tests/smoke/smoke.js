/*
 * Smoke: load every game and every static page, confirm it renders and
 * reaches a started state, and fail on a product console error or an
 * uncaught exception.
 *
 * This file lives outside tests/headless/ so the battery's suite discovery
 * does not have to list it. Run it with tests/smoke/run.sh.
 *
 * A console line is environmental only when this sandbox (or a rate limit)
 * explains it: cross-origin network failures, the studio's GitHub fetches,
 * and the optional local chat backend on localhost:3001. Same-origin
 * failures and every pageerror still fail the run.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../..');
const BASE = process.env.BASE || 'http://127.0.0.1:8123';
const BASE_ORIGIN = new URL(BASE).origin;

const PAINT_JS = `window.__smokePaint = function (sel) {
  var c = document.querySelector(sel);
  if (!c || c.width < 8 || c.height < 8) return null;
  var ctx = null;
  try { ctx = c.getContext('2d'); } catch (e) { ctx = null; }
  if (!ctx) return null;
  var data = ctx.getImageData(0, 0, c.width, c.height).data;
  var pixels = data.length / 4;
  var step = Math.max(1, Math.floor(pixels / 2500));
  var colors = {};
  var n = 0;
  var hash = 2166136261;
  for (var p = 0; p < pixels; p += step) {
    var i = p * 4;
    var r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    hash ^= (r + (g << 8) + (b << 16) + (a << 24)) >>> 0;
    hash = Math.imul(hash, 16777619);
    if (a > 16) {
      var key = (r & 240) + ((g & 240) << 8) + ((b & 240) << 16);
      if (!colors[key]) { colors[key] = 1; n++; }
    }
  }
  return { colors: n, hash: hash >>> 0, w: c.width, h: c.height };
};
window.__smokeGl = function (sel) {
  var list = sel ? [document.querySelector(sel)] : Array.prototype.slice.call(document.querySelectorAll('canvas'));
  var c = null;
  for (var i = 0; i < list.length; i++) {
    var el = list[i];
    if (el && el.clientWidth > 200 && el.clientHeight > 150) { c = el; break; }
  }
  if (!c) return null;
  var gl = c.getContext('webgl2') || c.getContext('webgl');
  return { w: c.clientWidth, h: c.clientHeight, gl: !!(gl && !gl.isContextLost()) };
};`;

function isCrossOrigin(text) {
  const m = text.match(/https?:\/\/[^\s)'"]+/);
  if (!m) return false;
  try { return new URL(m[0]).origin !== BASE_ORIGIN; } catch (e) { return false; }
}

function isEnvironmental(text) {
  const t = String(text || '');
  if (/localhost:3001/.test(t) && /ERR_|Failed to load resource|ECONNREFUSED|fetch/i.test(t)) return true;
  if (/fonts\.(googleapis|gstatic)\.com/.test(t) && /ERR_|Failed to load resource/.test(t)) return true;
  if (/api\.github\.com/.test(t) && /ERR_|Failed to load resource|403|429|rate/i.test(t)) return true;
  if (/^Failed to load resource: net::ERR_(CONNECTION_RESET|CERT_AUTHORITY_INVALID|CONNECTION_REFUSED|NAME_NOT_RESOLVED|INTERNET_DISCONNECTED|ABORTED|TIMED_OUT)$/.test(t.trim())) return true;
  if (/net::ERR_(CONNECTION_RESET|CERT_AUTHORITY_INVALID|CONNECTION_REFUSED|NAME_NOT_RESOLVED|INTERNET_DISCONNECTED|ABORTED|TIMED_OUT)/.test(t) && isCrossOrigin(t)) return true;
  return false;
}

function hubCanvas(spec) {
  return {
    name: spec.name,
    view: spec.view,
    path: '/#' + spec.view,
    check: (page) => assertHubCanvas(page, spec),
  };
}

async function paint(page, sel) {
  return page.evaluate((s) => window.__smokePaint(s), sel);
}

async function assertPainted(page, sel, label) {
  await page.waitForFunction((s) => {
    const stats = window.__smokePaint(s);
    return !!(stats && stats.colors >= 2);
  }, sel, { timeout: 15000 });
  const stats = await paint(page, sel);
  if (!stats || stats.colors < 2) {
    throw new Error(`${label} did not render (${JSON.stringify(stats)})`);
  }
  return stats;
}

async function assertMoves(page, sel, fromHash, label) {
  try {
    await page.waitForFunction(({ s, hash }) => {
      const stats = window.__smokePaint(s);
      return !!(stats && stats.colors >= 2 && stats.hash !== hash);
    }, { s: sel, hash: fromHash }, { timeout: 4000 });
  } catch (e) {
    throw new Error(`${label} did not start (the canvas did not change after the start control)`);
  }
}

async function assertHubCanvas(page, spec) {
  const sel = spec.canvas;
  await page.waitForSelector(`#view-${spec.view}.active ${sel}`, { timeout: 15000 });
  const first = await assertPainted(page, sel, spec.name);
  await page.waitForTimeout(220);
  const mid = await paint(page, sel);
  await spec.start(page);
  if (spec.proof === 'level') {
    const after = await paint(page, sel);
    if (!after || after.colors < 2) throw new Error(`${spec.name} canvas went blank`);
    const level = (await page.locator('#crate-level').innerText()).trim();
    if (!/^\d+$/.test(level)) throw new Error(`${spec.name} did not start a level (got ${JSON.stringify(level)})`);
    return;
  }
  const origin = mid ? mid.hash : first.hash;
  await assertMoves(page, sel, origin, spec.name);
}

function press(key) {
  return (page) => page.keyboard.press(key);
}
function clickSel(sel) {
  return (page) => page.locator(sel).click();
}

const TARGETS = [
  hubCanvas({ name: 'Snake', view: 'snake', canvas: '#snake-canvas', start: clickSel('#view-snake button.primary') }),
  hubCanvas({ name: 'Light Cycles', view: 'lightcycles', canvas: '#cycles-canvas', start: press(' ') }),
  hubCanvas({ name: 'Pong++', view: 'pong', canvas: '#pong-canvas', start: clickSel('#pong-canvas') }),
  hubCanvas({ name: 'Stacker', view: 'stacker', canvas: '#stacker-canvas', start: clickSel('#stacker-canvas') }),
  hubCanvas({
    name: 'Crate Escape',
    view: 'crateescape',
    canvas: '#crate-canvas',
    proof: 'level',
    start: press('ArrowRight'),
  }),
  hubCanvas({ name: 'Vector Defense', view: 'vectordefense', canvas: '#vd-canvas', start: clickSel('#vd-canvas') }),
  hubCanvas({ name: 'Word Cascade', view: 'wordcascade', canvas: '#wc-canvas', start: clickSel('#wc-canvas') }),
  hubCanvas({ name: 'Memory Matrix', view: 'memorymatrix', canvas: '#mm-canvas', start: clickSel('#mm-canvas') }),
  hubCanvas({ name: 'Inkflip', view: 'inkflip', canvas: '#inkflip-canvas', start: press('ArrowRight') }),
  hubCanvas({ name: 'Gutterlight', view: 'gutterlight', canvas: '#gutter-canvas', start: press('ArrowRight') }),
  hubCanvas({ name: 'Snip', view: 'snip', canvas: '#snip-canvas', start: press(' ') }),
  hubCanvas({ name: 'Peg', view: 'peg', canvas: '#peg-canvas', start: press(' ') }),
  hubCanvas({ name: 'Clasp', view: 'clasp', canvas: '#clasp-canvas', start: press(' ') }),
  hubCanvas({ name: 'Rivet', view: 'rivet', canvas: '#rivet-canvas', start: press(' ') }),
  hubCanvas({
    name: 'Maze Runner',
    view: 'maze',
    canvas: '#maze-canvas',
    start: async (page) => {
      for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) {
        await page.keyboard.press(key);
      }
    },
  }),
  hubCanvas({ name: 'Tetris', view: 'tetris', canvas: '#tetris-canvas', start: clickSel('#view-tetris button.primary') }),
  hubCanvas({ name: '2048', view: '2048', canvas: '#g2048-canvas', start: clickSel('#view-2048 button.primary') }),
  hubCanvas({ name: 'Neon Breaker', view: 'breakout', canvas: '#breakout-canvas', start: clickSel('#view-breakout button.primary') }),
  hubCanvas({ name: 'Drop Four', view: 'connect4', canvas: '#c4-canvas', start: clickSel('#c4-canvas') }),
  hubCanvas({ name: 'Minefield', view: 'minesweeper', canvas: '#mines-canvas', start: clickSel('#mines-canvas') }),
  hubCanvas({ name: 'Vector Storm', view: 'asteroids', canvas: '#asteroids-canvas', start: clickSel('#view-asteroids button.primary') }),
  {
    name: 'Game of Life',
    view: 'life',
    path: '/#life',
    check: async (page) => {
      await page.waitForSelector('#view-life.active #life-canvas', { timeout: 15000 });
      await page.locator('#view-life button', { hasText: /^Glider$/ }).click();
      const first = await assertPainted(page, '#life-canvas', 'Game of Life');
      await page.locator('#life-play-btn').click();
      await page.waitForFunction(() => document.getElementById('life-play-btn').textContent === 'Pause');
      await assertMoves(page, '#life-canvas', first.hash, 'Game of Life');
    },
  },
  {
    name: 'Word Five',
    view: 'word5',
    path: '/#word5',
    check: async (page) => {
      await page.waitForSelector('#view-word5.active #word5-grid .w5-tile', { timeout: 15000 });
      const tiles = await page.locator('#word5-grid .w5-tile').count();
      const keys = await page.locator('#word5-kb button.w5-key').count();
      if (tiles < 30) throw new Error(`Word Five rendered ${tiles} tiles, expected 30`);
      if (keys < 28) throw new Error(`Word Five keyboard rendered ${keys} keys`);
      await page.locator('#word5-kb button.w5-key', { hasText: /^A$/ }).click();
      await page.waitForFunction(() => document.getElementById('w5-0-0').textContent === 'A');
    },
  },
  {
    name: 'Arcade hub',
    view: 'arcade',
    path: '/#arcade',
    check: async (page) => {
      await page.waitForSelector('#view-arcade.active .arcade-card', { timeout: 15000 });
      const cards = await page.locator('#view-arcade .arcade-card').count();
      const flagship = await page.locator('a.arcade-flagship').count();
      if (cards < 15) throw new Error(`hub rendered ${cards} cards`);
      if (flagship < 1) throw new Error('hub did not render the flagship link');
    },
  },
  {
    name: 'Dashboard',
    view: 'dashboard',
    path: '/#dashboard',
    check: async (page) => {
      await page.waitForSelector('#view-dashboard.active #clock-time', { timeout: 15000 });
      await page.waitForFunction(() => {
        const t = document.getElementById('clock-time');
        return t && t.textContent && t.textContent !== '--:--:--';
      });
    },
  },
  {
    name: 'Productivity',
    view: 'productivity',
    path: '/#productivity',
    check: async (page) => {
      await page.waitForSelector('#view-productivity.active #pomo-toggle', { timeout: 15000 });
      const before = (await page.locator('#pomo-time').innerText()).trim();
      if (!/^\d+:\d\d$/.test(before)) throw new Error(`pomodoro did not render (${before})`);
      await page.locator('#pomo-toggle').click();
      await page.waitForFunction(() => document.getElementById('pomo-toggle').textContent === 'Pause');
    },
  },
  {
    name: 'Studio Crew',
    view: 'orgchart',
    path: '/#orgchart',
    check: async (page) => {
      await page.waitForSelector('#view-orgchart.active #orgchart-canvas', { timeout: 15000 });
      await assertPainted(page, '#orgchart-canvas', 'Studio Crew');
    },
  },
  {
    name: 'Personal',
    view: 'personal',
    path: '/#personal',
    check: async (page) => {
      await page.waitForSelector('#view-personal.active #lock-btn', { timeout: 15000 });
      const label = (await page.locator('#lock-subtitle').innerText()).trim();
      if (!/ACCESS CODE/i.test(label)) throw new Error(`lock screen did not render (${label})`);
    },
  },
  {
    name: 'Hall of Fame',
    view: 'halloffame',
    path: '/#halloffame',
    check: async (page) => {
      await page.waitForSelector('#view-halloffame.active #hof-board .hof-row', { timeout: 15000 });
      const rows = await page.locator('#hof-board .hof-row').count();
      if (rows < 21) throw new Error(`Hall of Fame rendered ${rows} rows, expected 21`);
    },
  },
  {
    name: 'Trophy Room',
    view: 'trophy',
    path: '/#trophy',
    check: async (page) => {
      await page.waitForSelector('#view-trophy.active .trophy-card', { timeout: 15000 });
      const cards = await page.locator('.trophy-card').count();
      if (cards < 20) throw new Error(`Trophy room rendered ${cards} cards`);
      const chip = (await page.locator('#career-chip').innerText()).replace(/\s+/g, ' ').trim();
      if (!/Lv 1/.test(chip)) throw new Error(`career chip did not render (${chip})`);
    },
  },
  {
    name: '404',
    path: '/404.html',
    file: '404.html',
    check: async (page) => {
      await page.waitForSelector('.notfound-code', { timeout: 10000 });
      const code = (await page.locator('.notfound-code').innerText()).trim();
      if (code !== '404') throw new Error(`404 page rendered ${JSON.stringify(code)}`);
    },
  },
  {
    name: 'Age of War',
    path: '/ageofwar/index.html',
    file: 'ageofwar/index.html',
    check: async (page) => {
      await page.waitForSelector('#aow-canvas', { timeout: 20000 });
      const first = await assertPainted(page, '#aow-canvas', 'Age of War');
      await page.locator('#aow-welcome-close').click({ timeout: 8000 });
      await page.waitForFunction(() => {
        const m = document.getElementById('aow-welcome-modal');
        return m && getComputedStyle(m).display === 'none';
      });
      const gold = (await page.locator('#aow-gold').innerText()).trim();
      if (!/^\d+$/.test(gold)) throw new Error(`Age of War gold did not start (${gold})`);
      await assertMoves(page, '#aow-canvas', first.hash, 'Age of War');
    },
  },
  {
    name: 'Startup Tycoon',
    path: '/tycoon/index.html',
    file: 'tycoon/index.html',
    check: async (page) => {
      await page.waitForSelector('a.play-btn[href="/tycoon/play.html"]', { timeout: 10000 });
      const title = await page.title();
      if (!/Tycoon/i.test(title)) throw new Error(`landing title was ${JSON.stringify(title)}`);
    },
  },
  {
    name: 'Startup Tycoon play',
    path: '/tycoon/play.html',
    file: 'tycoon/play.html',
    check: (page) => assertTycoon(page, 'Startup Tycoon'),
  },
  {
    name: 'Beagle Sim',
    path: '/tycoon/play.html?theme=beagle',
    file: 'tycoon/play.html',
    check: (page) => assertTycoon(page, 'Beagle Sim'),
  },
  {
    name: 'Grow Op',
    path: '/drug-lab.html',
    file: 'drug-lab.html',
    check: async (page) => {
      await page.locator('#diff-careful').click({ timeout: 20000 });
      await page.locator('#intro-go').click({ timeout: 8000 });
      await page.waitForFunction(() => {
        const d = document.getElementById('diff-modal');
        const i = document.getElementById('intro-modal');
        return d && !d.classList.contains('open') && i && !i.classList.contains('open');
      });
      await assertGl(page, 'Grow Op');
      const cash = (await page.locator('#cash-val').innerText()).replace(/[^0-9]/g, '');
      if (!cash) throw new Error('Grow Op cash HUD did not render');
    },
  },
  {
    name: 'Homeless Village',
    path: '/homeless-village.html',
    file: 'homeless-village.html',
    check: async (page) => {
      await page.waitForSelector('#three-canvas', { timeout: 20000 });
      await page.locator('#intro-go').click({ timeout: 8000 });
      await page.waitForFunction(() => !document.getElementById('intro-modal').classList.contains('open'));
      await assertGl(page, 'Homeless Village', '#three-canvas');
      const days = (await page.locator('#days-counter').innerText()).trim();
      if (!/Days Survived:\s*\d+/.test(days)) throw new Error(`camp did not start (${days})`);
    },
  },
  {
    name: 'Hearthvale',
    path: '/hearthvale.html',
    file: 'hearthvale.html',
    check: async (page) => {
      await page.waitForSelector('#game', { timeout: 20000 });
      await assertPainted(page, '#game', 'Hearthvale');
      await page.locator('#welcome-close').click({ timeout: 8000 });
      await page.waitForFunction(() => !document.getElementById('welcome').classList.contains('show'));
      const gold = (await page.locator('#r-gold').innerText()).replace(/[^0-9]/g, '');
      if (!gold) throw new Error('Hearthvale gold did not render after Begin building');
      if (await page.locator('#stillroom').count() !== 1) throw new Error('Hearthvale stillroom board is missing');
      if (await page.locator('#hollow').count() !== 1) throw new Error('Hearthvale hollow is missing');
      await page.locator('#buildtabs button', { hasText: 'Industry' }).click();
      const still = page.locator('#buildbar .btn[data-type="stillroom"]');
      await still.waitFor({ timeout: 8000 });
      if (!(await still.evaluate(el => el.classList.contains('locked')))) {
        throw new Error('Stillroom should stay locked until the town grows');
      }
      await page.locator('#buildtabs button', { hasText: 'Town' }).click();
      for (const type of ['watchtower', 'beacon']) {
        if (await page.locator(`#buildbar .btn[data-type="${type}"]`).count() !== 1) {
          throw new Error(`Hearthvale ${type} is missing from the build bar`);
        }
      }
    },
  },
  {
    name: 'Voxel Isle',
    path: '/voxel-garden.html',
    file: 'voxel-garden.html',
    check: async (page) => {
      await page.locator('#helpClose').click({ timeout: 20000 });
      await page.waitForFunction(() => !document.getElementById('helpOv').classList.contains('open'));
      await assertGl(page, 'Voxel Isle');
      const coins = (await page.locator('#coins').innerText()).trim();
      if (!/^\d+$/.test(coins)) throw new Error(`Voxel Isle coins did not render (${coins})`);
    },
  },
  {
    name: 'Ashmarch',
    path: '/games/ashmarch/index.html',
    file: 'games/ashmarch/index.html',
    check: async (page) => {
      await page.waitForSelector('#player-name', { timeout: 15000 });
      await page.locator('[data-book="lumenferry"]').click();
      const ferry = (await page.locator('.party-intro').innerText());
      if (!/Bram Holt/.test(ferry) || !/Ness Kite/.test(ferry) || !/Pell/.test(ferry)) {
        throw new Error('Lumenferry party did not render');
      }
      await page.locator('[data-book="ashmarch"]').click();
      const ashParty = (await page.locator('.party-intro').innerText());
      if (!/Mara Voss/.test(ashParty) || !/Ivo Quill/.test(ashParty) || !/Sable/.test(ashParty)) {
        throw new Error('Ashmarch party did not render');
      }
      await page.locator('#player-name').fill('Nim');
      await page.locator('#motive').fill('To pay a debt');
      await page.locator('#ash-begin button[type="submit"]').click();
      await page.waitForSelector('#ash-transcript .narration p', { timeout: 15000 });
      const before = (await page.locator('#ash-transcript .narration').innerText()).trim();
      if (before.length < 40) throw new Error('Ashmarch did not narrate (' + before.length + ' chars)');
      if (!/Chronicle/i.test(await page.locator('.brand').innerText())) throw new Error('Chronicle is missing');
      const journal = (await page.locator('#ash-journal').innerText()).trim();
      if (journal.length < 8) throw new Error('Journal did not open');
      const plate = await page.locator('#ash-plate').getAttribute('src');
      if (!plate || !plate.startsWith('data:image/svg+xml')) throw new Error('Scene plate is not an SVG');
      const colors = new Set((decodeURIComponent(plate).match(/#[0-9a-fA-F]{3,8}/g) || []));
      if (colors.size < 2) throw new Error('Scene plate has ' + colors.size + ' colors');
      await page.locator('#ash-choices button').first().click();
      await page.waitForFunction((text) => {
        const el = document.querySelector('#ash-transcript .narration');
        return el && el.textContent && el.textContent.trim() !== text;
      }, before);
    },
  },
  {
    name: 'The Ledger',
    path: '/games/ledger/index.html',
    file: 'games/ledger/index.html',
    check: async (page) => {
      await page.locator('#haul').selectOption('mara');
      await page.locator('#drop').selectOption('ivo');
      await page.waitForFunction(() => {
        const cash = document.getElementById('cash');
        return cash && Number((cash.textContent || '').replace(/\D/g, '')) > 100;
      }, null, { timeout: 8000 });
      const mid = Number(((await page.locator('#cash').innerText()) || '').replace(/\D/g, ''));
      await page.locator('#pause').click();
      await page.waitForTimeout(900);
      const held = Number(((await page.locator('#cash').innerText()) || '').replace(/\D/g, ''));
      if (held !== mid) throw new Error('The Ledger kept paying while paused (' + mid + ' → ' + held + ')');
      if ((await page.locator('#pause').innerText()).trim() !== 'Resume') throw new Error('Pause did not arm resume');
    },
  },
  phoneTarget('Phone 390×844', { width: 390, height: 844 }),
  phoneTarget('Phone 375×667', { width: 375, height: 667 }),
  phoneTarget('Phone 844×390', { width: 844, height: 390 }),
  {
    name: 'Eureka Studio',
    path: '/agentic-os.html',
    file: 'agentic-os.html',
    check: async (page) => {
      // The island loop starts before GitHub answers. The splash stays up
      // until that sync settles, and headless Chromium can leave the
      // request hanging when it cannot reach api.github.com. A live scene
      // is the start signal; a three.js load failure is not.
      await page.waitForSelector('#world canvas', { timeout: 20000 });
      await assertGl(page, 'Eureka Studio', '#world canvas');
      const status = (await page.locator('#splash .s').innerText()).trim();
      if (/failed to load/i.test(status)) throw new Error(status);
      const title = (await page.locator('#splash .t').innerText()).trim();
      if (title !== 'EUREKA STUDIO') throw new Error(`studio splash rendered ${JSON.stringify(title)}`);
    },
  },
];

async function assertGl(page, label, sel) {
  await page.waitForFunction((s) => {
    const info = window.__smokeGl(s || '');
    return !!(info && info.gl);
  }, sel || '', { timeout: 15000 });
  const info = await page.evaluate((s) => window.__smokeGl(s || ''), sel || '');
  if (!info || !info.gl) throw new Error(`${label} WebGL scene did not start (${JSON.stringify(info)})`);
}

async function assertTycoon(page, expectedTitle) {
  await page.waitForFunction(() => document.title && document.title.length > 0, null, { timeout: 20000 });
  const title = await page.title();
  if (title !== expectedTitle) throw new Error(`title was ${JSON.stringify(title)}, expected ${expectedTitle}`);
  await page.locator('#welcome-start-btn').click({ timeout: 15000 });
  await page.waitForFunction(() => !document.getElementById('welcome-modal').classList.contains('open'));
  await assertGl(page, expectedTitle);
  const cash = (await page.locator('#cash-val').innerText()).replace(/[^0-9]/g, '');
  if (!cash) throw new Error(`${expectedTitle} cash HUD did not render`);
  if (expectedTitle === 'Beagle Sim') await assertBeagle(page);
  else {
    const yards = await page.locator('#bgl-yard').count();
    if (yards) throw new Error('Startup Tycoon rendered the Beagle yard');
    const saved = await page.evaluate(() => localStorage.getItem('beagle:yard'));
    if (saved) throw new Error('Startup Tycoon wrote a Beagle yard save');
  }
}

async function assertBeagle(page) {
  await page.waitForFunction(() => window.__beagle && window.__beagle.ready === true);
  const base = await page.evaluate(() => window.__beagle.workMult());
  if (Math.abs(base - 1) > 0.001) throw new Error('fresh pack speed was ' + base);
  const hint = (await page.locator('#bgl-banner').innerText()).trim();
  if (!/dirt/i.test(hint)) throw new Error('yard hint was ' + JSON.stringify(hint));
  const solo = await page.evaluate(() => window.__beagle.park());
  if (solo.unlocked) throw new Error('dog park opened before Scout');
  if (!solo.companions[0] || !solo.companions[0].stray) throw new Error('solo visit had no stray companion ' + JSON.stringify(solo.companions));

  await page.locator('#hire-btn').click();
  await page.waitForFunction(() => {
    const t = document.getElementById('emp-count');
    return t && /^\s*1\s*\//.test(t.textContent || '');
  });
  const dogs = await page.evaluate(() => window.__beagle.dogs());
  if (dogs < 1) throw new Error('hired worker was not a beagle');
  const tip = page.locator('#tip-modal.open #tip-ok');
  if (await tip.count()) await tip.click();

  await page.locator('#bgl-mounds button.ready').first().click();
  await page.waitForFunction(() => window.__beagle.dug() >= 1 && window.__beagle.bones() >= 1);
  await page.waitForFunction(() => {
    const raw = localStorage.getItem('beagle:yard');
    if (!raw) return false;
    try { return JSON.parse(raw).dug >= 1; } catch (e) { return false; }
  });

  await page.evaluate(() => window.__beagle.grant(40));
  const ranked = await page.evaluate(() => window.__beagle.rank());
  if (ranked === 'Pup') throw new Error('grant did not raise the pack rank');
  await page.locator('#bgl-act-shop').click();
  await page.locator('#bgl-shop button[data-buy="bowl"]').click();
  const shop = await page.evaluate(() => window.__beagle.shop());
  if (!shop || shop.bowl !== 1) throw new Error('water bowl did not buy ' + JSON.stringify(shop));
  const bowed = await page.evaluate(() => window.__beagle.workMult());
  if (bowed < 1.029) throw new Error('bowl did not speed the pack (' + bowed + ')');

  await page.locator('#bgl-act-ball').click();
  const zoom = await page.evaluate(() => ({ z: window.__beagle.zoomies(), m: window.__beagle.workMult() }));
  if (zoom.z <= 0) throw new Error('tennis ball did not start zoomies');
  if (zoom.m < 1.3) throw new Error('zoomies multiplier was ' + zoom.m);

  await page.locator('#bgl-act-howl').click();
  const howl = await page.evaluate(() => ({ h: window.__beagle.howl(), m: window.__beagle.workMult() }));
  if (howl.h <= 0) throw new Error('howl did not start');
  if (howl.m < 1.8) throw new Error('howl multiplier was ' + howl.m);

  await page.locator('#bgl-act-pet').click();
  const bond = await page.evaluate(() => window.__beagle.bond());
  if (bond <= 0) throw new Error('belly rub did not raise bond');

  const gate = await page.evaluate(() => window.__beagle.park());
  if (!gate.unlocked) throw new Error('Scout did not open the dog park');
  if (!gate.companions.length || gate.companions[0].stray) throw new Error('hired pack did not show up at the park');
  await page.locator('#bgl-park').click();
  await page.locator('#bgl-alpha-start').click();
  await page.locator('#bgl-park-throw').click();
  const fight = await page.evaluate(() => {
    const step = window.__beagle.companionStep();
    const view = window.__beagle.park();
    return { step, grit: view.grit, line: view.lastLine, running: view.running };
  });
  if (!fight.running || fight.grit >= 100) throw new Error('Duke did not take a hit ' + JSON.stringify(fight));
  if (!fight.line) throw new Error('companion did not act');
  await page.evaluate(() => window.__beagle.routAlpha());
  await page.waitForFunction(() => {
    const view = window.__beagle.park();
    if (!view.patrol || view.wins < 1) return false;
    const raw = localStorage.getItem('beagle:yard');
    if (!raw) return false;
    try { return JSON.parse(raw).patrol === true; } catch (e) { return false; }
  });
  await page.locator('#bgl-park-close').click();
  await page.waitForFunction(() => document.getElementById('bgl-park-overlay').hidden);

  const dug = await page.evaluate(() => {
    for (let i = 0; i < 8; i++) window.__beagle.dig(i);
    return window.__beagle.dug();
  });
  if (dug < 2) throw new Error('digging the yard did not count (' + dug + ')');

  const tags = await page.evaluate(() => window.__beagle.forceBone());
  if (tags < 1) throw new Error('office bone did not spawn');
  const tagCount = await page.locator('.bgl-bone-tag').count();
  if (tagCount < 1) throw new Error('office bone has no marker');

  await page.locator('body > canvas').click({ position: { x: 700, y: 340 } });

  if (await page.locator('#bgl-shop:not([hidden])').count()) {
    await page.locator('#bgl-act-shop').click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(320);
  await page.locator('#bgl-park').click();
  await page.waitForFunction(() => !document.getElementById('bgl-park-overlay').hidden);
  const parkFit = await page.evaluate(() => {
    const fails = [];
    if (document.documentElement.scrollWidth > innerWidth + 1) fails.push('park scrolls sideways');
    const sheet = document.querySelector('.bgl-park-sheet').getBoundingClientRect();
    if (sheet.left < -1 || sheet.top < -1 || sheet.right > innerWidth + 1 || sheet.bottom > innerHeight + 1) {
      fails.push('park sheet leaves the screen');
    }
    if (sheet.height < 200) fails.push('park sheet is ' + Math.round(sheet.height) + 'px tall');
    const buttons = [...document.querySelectorAll('#bgl-park-overlay button')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && !el.hidden && !el.closest('[hidden]');
    });
    if (buttons.length < 2) fails.push('park actions missing');
    for (const el of buttons) {
      const r = el.getBoundingClientRect();
      if (r.height < 44 || r.width < 44) fails.push((el.id || 'park button') + ' is ' + Math.round(r.width) + '×' + Math.round(r.height));
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!hit || !el.contains(hit)) fails.push((el.id || 'park button') + ' is covered');
    }
    const duke = document.getElementById('bgl-duke').getBoundingClientRect();
    if (duke.height < 40) fails.push('Duke is not on the hill');
    return fails;
  });
  if (parkFit.length) throw new Error('phone park: ' + parkFit.join('; '));
  await page.locator('#bgl-park-close').click();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.locator('#joy-enabled').check();
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 375, height: 667 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => {
      const panel = document.getElementById('left-panel');
      if (panel && panel.classList.contains('open')) panel.classList.remove('open');
      const backdrop = document.getElementById('drawer-backdrop');
      if (backdrop) backdrop.classList.remove('open');
    });
    await page.waitForTimeout(320);
    const problems = await page.evaluate(() => {
      const fails = [];
      const vw = innerWidth;
      const vh = innerHeight;
      if (document.documentElement.scrollWidth > vw + 1) {
        fails.push('page scrolls sideways ' + document.documentElement.scrollWidth + ' > ' + vw);
      }
      const yard = document.getElementById('bgl-yard');
      const yb = yard.getBoundingClientRect();
      if (yb.width < 120 || yb.height < 44) fails.push('yard is ' + Math.round(yb.width) + '×' + Math.round(yb.height));
      if (yb.left < -1 || yb.top < -1 || yb.right > vw + 1 || yb.bottom > vh + 1) {
        fails.push('yard leaves the screen');
      }
      const buttons = [...yard.querySelectorAll('button')].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && !el.closest('[hidden]');
      });
      for (const el of buttons) {
        const r = el.getBoundingClientRect();
        if (r.height < 44 || r.width < 36) fails.push(el.id || el.className || 'button' + ' is ' + Math.round(r.width) + '×' + Math.round(r.height));
        if (r.top < -1 || r.left < -1 || r.bottom > vh + 1 || r.right > vw + 1) {
          fails.push((el.id || 'button') + ' leaves the screen');
        }
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const hit = document.elementFromPoint(cx, cy);
        if (!hit || !el.contains(hit)) {
          fails.push((el.id || el.className || 'button') + ' is covered');
        }
      }
      const overlap = (a, b) => {
        const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        return x * y;
      };
      const box = (id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return null;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return null;
        return r;
      };
      for (const id of ['joystick', 'sprint-btn', 'next-action-card']) {
        const other = box(id);
        if (other && overlap(yb, other) > 8) fails.push('yard overlaps ' + id);
      }
      return fails.slice(0, 8);
    });
    if (problems.length) throw new Error(viewport.width + '×' + viewport.height + ': ' + problems.join('; '));
  }
}

// Vite source for the local chat app. It is not a static arcade page and
// it needs its own server plus an API key, so the static smoke suite does
// not load it. A new HTML file that is not listed here fails the run.
const EXCLUDED_HTML = new Set(['agentic-os-chat/client/index.html']);

function listHtml(dir, acc) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.git') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) listHtml(full, acc);
    else if (ent.name.endsWith('.html')) acc.push(path.relative(ROOT, full).split(path.sep).join('/'));
  }
  return acc;
}

function assertCoverage() {
  const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const views = [...index.matchAll(/id="view-([^"]+)"/g)].map((m) => m[1]);
  const missingViews = views.filter((id) => !TARGETS.some((t) => t.view === id));
  if (missingViews.length) {
    throw new Error('smoke catalog is missing hub views: ' + missingViews.join(', '));
  }
  const files = listHtml(ROOT, []);
  const covered = new Set(TARGETS.filter((t) => t.file).map((t) => t.file));
  covered.add('index.html');
  const missingFiles = files.filter((f) => !covered.has(f) && !EXCLUDED_HTML.has(f));
  if (missingFiles.length) {
    throw new Error('smoke catalog is missing pages: ' + missingFiles.join(', '));
  }
}

function attach(page, bucket) {
  bucket.http = [];
  page.on('response', (res) => {
    if (res.status() < 400) return;
    bucket.http.push({ status: res.status(), url: res.url() });
  });
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    bucket.push({ kind: 'console', text: msg.text() });
  });
  page.on('pageerror', (err) => {
    bucket.push({ kind: 'pageerror', text: String(err && err.stack || err) });
  });
}

// Chromium's "Failed to load resource" console line often omits the URL,
// so a GitHub 403 looks like a same-origin failure. After the page has
// settled, stamp the matching response URL onto that line. A same-origin
// hit wins, so a real 403 is never excused by a cross-origin one.
function attributeResourceErrors(bucket) {
  const http = bucket.http || [];
  for (const item of bucket) {
    if (item.kind !== 'console') continue;
    if (!/^Failed to load resource:/.test(item.text) || /https?:\/\//.test(item.text)) continue;
    const m = item.text.match(/status of (\d+)/);
    const status = m ? Number(m[1]) : 0;
    const hits = http.filter((h) => h.status === status);
    if (!hits.length) continue;
    const same = hits.filter((h) => {
      try { return new URL(h.url).origin === BASE_ORIGIN; } catch (e) { return true; }
    });
    const hit = (same.length ? same : hits)[ (same.length ? same : hits).length - 1 ];
    item.text = item.text + ' ' + hit.url;
  }
}

const PHONE_BOARDS = [
  ['snake', '#snake-canvas'],
  ['lightcycles', '#cycles-canvas'],
  ['pong', '#pong-canvas'],
  ['stacker', '#stacker-canvas'],
  ['crateescape', '#crate-canvas'],
  ['vectordefense', '#vd-canvas'],
  ['wordcascade', '#wc-canvas'],
  ['memorymatrix', '#mm-canvas'],
  ['maze', '#maze-canvas'],
  ['tetris', '#tetris-canvas'],
  ['2048', '#g2048-canvas'],
  ['breakout', '#breakout-canvas'],
  ['connect4', '#c4-canvas'],
  ['minesweeper', '#mines-canvas'],
  ['asteroids', '#asteroids-canvas'],
  ['life', '#life-canvas'],
  ['inkflip', '#inkflip-canvas'],
  ['gutterlight', '#gutter-canvas'],
  ['snip', '#snip-canvas'],
];

function phoneTarget(name, viewport) {
  return {
    name,
    path: '/#snake',
    mobile: true,
    viewport,
    check: (page) => assertPhone(page),
  };
}

async function assertPhone(page) {
  const failures = [];
  const openHash = async (hash) => {
    await page.evaluate((h) => { location.hash = h; }, hash);
    await page.waitForFunction((h) => {
      const view = h.startsWith('view-') ? h : null;
      if (view) return document.getElementById(view)?.classList.contains('active');
      return true;
    }, hash.startsWith('#') ? 'view-' + hash.slice(1) : hash);
    await page.waitForTimeout(80);
  };

  for (const [view, sel] of PHONE_BOARDS) {
    await openHash(view);
    await page.waitForFunction((s) => {
      const el = document.querySelector(s);
      return el && el.getBoundingClientRect().width > 40;
    }, sel);
    const box = await page.evaluate((s) => {
      const el = document.querySelector(s);
      const b = el.getBoundingClientRect();
      return {
        w: b.width, h: b.height, top: b.top, left: b.left, right: b.right, bottom: b.bottom,
        touch: getComputedStyle(el).touchAction,
        doc: document.documentElement.scrollWidth,
        vw: innerWidth, vh: innerHeight,
      };
    }, sel);
    if (box.doc > box.vw + 1) failures.push(`${view} scrolls sideways (${box.doc} > ${box.vw})`);
    if (box.touch !== 'none') failures.push(`${view} canvas touch-action is ${box.touch}`);
    if (box.w < 64 || box.h < 64) failures.push(`${view} board is ${Math.round(box.w)}×${Math.round(box.h)}`);
    if (box.left < -1 || box.right > box.vw + 1 || box.top < -1 || box.bottom > box.vh + 1) {
      failures.push(`${view} board leaves the screen (${Math.round(box.left)},${Math.round(box.top)}–${Math.round(box.right)},${Math.round(box.bottom)} in ${box.vw}×${box.vh})`);
    }
  }

  for (const id of ['tetris-touch', 'ast-touch']) {
    const view = id === 'tetris-touch' ? 'tetris' : 'asteroids';
    await openHash(view);
    const pad = await page.evaluate((padId) => {
      const el = document.getElementById(padId);
      const cs = getComputedStyle(el);
      const buttons = [...el.querySelectorAll('button')].map((btn) => {
        const b = btn.getBoundingClientRect();
        return b.width > 8 && b.height > 8 && b.left >= -1 && b.top >= -1 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1;
      });
      return { shown: cs.display !== 'none', ok: buttons.length >= (padId === 'tetris-touch' ? 7 : 5) && buttons.every(Boolean), n: buttons.length };
    }, id);
    if (!pad.shown || !pad.ok) failures.push(`${view} touch pad is not fully on screen (${pad.n} buttons, shown ${pad.shown})`);
  }

  await openHash('word5');
  await page.waitForSelector('#word5-kb button.w5-key');
  const w5 = await page.evaluate(() => {
    const kb = document.getElementById('word5-kb');
    const b = kb.getBoundingClientRect();
    const key = kb.querySelector('button.w5-key');
    return {
      fits: b.left >= -1 && b.right <= innerWidth + 1 && b.width > 40,
      touch: getComputedStyle(key).touchAction,
      doc: document.documentElement.scrollWidth <= innerWidth + 1,
    };
  });
  if (!w5.fits || !w5.doc) failures.push('Word Five keyboard does not fit the phone');
  if (w5.touch !== 'manipulation') failures.push(`Word Five keys touch-action is ${w5.touch}`);

  const pages = [
    ['/homeless-village.html', '#three-canvas'],
    ['/hearthvale.html', '#game'],
    ['/drug-lab.html', 'canvas'],
    ['/voxel-garden.html', 'canvas'],
    ['/ageofwar/index.html', '#aow-canvas'],
    ['/tycoon/play.html', 'canvas'],
    ['/agentic-os.html', '#world canvas'],
  ];
  for (const [path, sel] of pages) {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(400);
    const box = await page.evaluate((selector) => {
      const list = [...document.querySelectorAll(selector)];
      const el = list.sort((a, b) => (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight))[0];
      if (!el) return null;
      const b = el.getBoundingClientRect();
      const world = document.getElementById('world');
      return {
        w: b.width, h: b.height, right: b.right, bottom: b.bottom, left: b.left, top: b.top,
        touch: getComputedStyle(el).touchAction,
        doc: document.documentElement.scrollWidth,
        vw: innerWidth, vh: innerHeight,
        worldW: world ? world.getBoundingClientRect().width : 0,
      };
    }, sel);
    const label = path;
    if (!box) { failures.push(`${label} has no canvas`); continue; }
    if (box.doc > box.vw + 1) failures.push(`${label} scrolls sideways (${Math.round(box.doc)} > ${box.vw})`);
    if (box.touch !== 'none') failures.push(`${label} canvas touch-action is ${box.touch}`);
    if (box.w < 80 || box.h < 80) failures.push(`${label} canvas is ${Math.round(box.w)}×${Math.round(box.h)}`);
    if (box.left < -1 || box.top < -1 || box.right > box.vw + 1 || box.bottom > box.vh + 1) {
      failures.push(`${label} canvas leaves the screen (${Math.round(box.right)}×${Math.round(box.bottom)} in ${box.vw}×${box.vh})`);
    }
    if (path === '/agentic-os.html' && box.w > box.worldW + 2) {
      failures.push(`studio canvas is wider than the island (${Math.round(box.w)} > ${Math.round(box.worldW)})`);
    }
  }

  if (failures.length) throw new Error(failures.slice(0, 8).join('; '));
}

async function runTarget(browser, target) {
  const context = await browser.newContext({
    viewport: target.viewport || { width: 1280, height: 800 },
    deviceScaleFactor: target.mobile ? 2 : 1,
    isMobile: !!target.mobile,
    hasTouch: !!target.mobile,
  });
  await context.addInitScript(PAINT_JS);
  const page = await context.newPage();
  const bucket = [];
  attach(page, bucket);
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  let failure = null;
  try {
    await page.goto(BASE + target.path, { waitUntil: 'load', timeout: 45000 });
    await target.check(page);
  } catch (e) {
    failure = String(e && e.message || e).split('\n')[0];
  }
  attributeResourceErrors(bucket);
  const product = bucket.filter((i) => !isEnvironmental(i.text));
  const env = bucket.filter((i) => isEnvironmental(i.text));
  await context.close();
  return { name: target.name, path: target.path, failure, product, env };
}

(async () => {
  try {
    assertCoverage();
  } catch (e) {
    console.error(String(e.message || e));
    process.exit(1);
  }

  const browser = await chromium.launch({
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });

  const results = [];
  for (const target of TARGETS) {
    process.stdout.write(`… ${target.name}\n`);
    results.push(await runTarget(browser, target));
  }
  await browser.close();

  let failed = 0;
  let envCount = 0;
  for (const r of results) {
    envCount += r.env.length;
    const bad = r.failure || r.product.length;
    if (!bad) {
      const extra = r.env.length ? ` (${r.env.length} environmental)` : '';
      console.log(`OK    ${r.name}${extra}`);
      continue;
    }
    failed++;
    console.log(`FAIL  ${r.name}  ${r.path}`);
    if (r.failure) console.log(`        ${r.failure}`);
    for (const i of r.product.slice(0, 8)) {
      console.log(`        [${i.kind}] ${i.text.slice(0, 400)}`);
    }
    if (r.product.length > 8) console.log(`        … ${r.product.length - 8} more`);
  }
  if (envCount) console.log(`\n${envCount} environmental console line(s) ignored`);
  console.log(`\n${results.length - failed}/${results.length} smoke targets passed`);
  if (failed) {
    console.log('FAILED: ' + results.filter((r) => r.failure || r.product.length).map((r) => r.name).join(', '));
    process.exit(1);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
