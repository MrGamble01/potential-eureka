/* Amber Lamp Glass — the Spark Shop look Grow Op actually wears.
 *
 * Hook-free. The catalog, the purse allowlist, and the tent meshes
 * are checked from source. The browser buys the glass, reads the
 * starter plots, and counts amber pixels on the grow lamps.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const ROOT = path.resolve(__dirname, '..', '..');
const cosmetics = fs.readFileSync(path.join(ROOT, 'js/cosmetics.js'), 'utf8');
const persist = fs.readFileSync(path.join(ROOT, 'js/persist.js'), 'utf8');
const lab = fs.readFileSync(path.join(ROOT, 'drug-lab.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const item = /id:\s*'glass-amber'[\s\S]{0,400}?games:\s*\['Grow Op'\]/.exec(cosmetics);
ok(!!item && /name:\s*'Amber Lamp Glass'/.test(item[0]) && /slot:\s*'glass'/.test(item[0]),
  'the catalog lists Amber Lamp Glass for Grow Op');
ok(/id:\s*'glass',\s*name:\s*'Lamp glass'/.test(cosmetics), 'the shop has a lamp glass filter');
ok(/skin:\s*1,\s*trail:\s*1,\s*palette:\s*1,\s*cards:\s*1,\s*title:\s*1,\s*badge:\s*1,\s*glass:\s*1/.test(persist),
  'the purse allowlist keeps a glass slot');
ok(/look\(\)\.glass/.test(lab) && /canopy/.test(lab), 'Grow Op reads look().glass and builds a canopy');

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      localStorage.setItem('growop-intro-seen', '1');
      localStorage.setItem('eureka-progress', JSON.stringify({
        v: 1,
        games: {},
        career: {
          sparks: 100,
          owned: {},
          equipped: {},
          ledger: {},
          unlocked: {},
          stats: {},
          xp: 0,
          name: '',
        },
      }));
    });
    await page.goto(BASE + '/drug-lab.html?world=day-clear', { waitUntil: 'load', timeout: 30000 });
    await page.waitForSelector('#diff-careful', { state: 'visible', timeout: 20000 });
    await page.click('#diff-careful');
    await page.waitForFunction(() => {
      return window.EurekaCosmetics && window.LAB_LAMPS
        && LAB_LAMPS.plots && LAB_LAMPS.plots.length >= 2
        && LAB_LAMPS.plots[0].shade && LAB_LAMPS.plots[0].canopy
        && !document.getElementById('diff-modal').classList.contains('open');
    });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

    const bare = await page.evaluate(() => {
      const plots = LAB_LAMPS.plots;
      const hidden = plots.length >= 2 && plots.every((p) => p.shade && p.canopy && !p.shade.visible && !p.canopy.visible);
      const { scene, camera, renderer } = LAB_LAMPS;
      renderer.render(scene, camera);
      const src = renderer.domElement;
      const w = Math.min(src.width || 640, 720);
      const h = Math.max(1, Math.round((src.height || 400) * (w / Math.max(1, src.width || w))));
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(src, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;
      let amber = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (r > 170 && g > 80 && b < 100 && r > g + 20) amber++;
      }
      return {
        glass: EurekaCosmetics.look().glass,
        hidden: hidden,
        plots: plots.length,
        amber: amber,
        sparks: EurekaCosmetics.purse().sparks,
      };
    });
    ok(bare.glass == null && bare.hidden, `starter tents hide the glass (${bare.plots} plots)`);

    const bought = await page.evaluate(() => {
      const before = EurekaCosmetics.purse().sparks;
      const res = EurekaCosmetics.buy('glass-amber');
      const after = EurekaCosmetics.purse().sparks;
      const worn = EurekaCosmetics.look().glass;
      return { ok: !!(res && res.ok), before: before, after: after, id: worn && worn.id };
    });
    ok(bought.ok && bought.before - bought.after === 44 && bought.id === 'glass-amber',
      `buying Amber Lamp Glass spends 44 (${bought.before} -> ${bought.after}, ${bought.id})`);

    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

    const worn = await page.evaluate(() => {
      const plots = LAB_LAMPS.plots;
      const rows = plots.map((p) => ({
        shade: !!(p.shade && p.shade.visible),
        canopy: !!(p.canopy && p.canopy.visible),
        hex: p.canopy && p.canopy.material.color.getHex(),
      }));
      const { scene, camera, renderer } = LAB_LAMPS;
      renderer.render(scene, camera);
      const src = renderer.domElement;
      const w = Math.min(src.width || 640, 720);
      const h = Math.max(1, Math.round((src.height || 400) * (w / Math.max(1, src.width || w))));
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(src, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;
      let amber = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (r > 170 && g > 80 && b < 100 && r > g + 20) amber++;
      }
      return { rows: rows, amber: amber };
    });
    const both = worn.rows.length >= 2 && worn.rows.every((row) => row.shade && row.canopy);
    const amberMat = worn.rows.length >= 2 && worn.rows.every((row) => Math.abs((row.hex || 0) - 0xffb020) <= 0x020202);
    ok(both && amberMat, `both tents wear an amber canopy (${worn.rows.map((row) => row.hex && row.hex.toString(16)).join(',')})`);
    ok(worn.amber > bare.amber + 40, `worn lamps read amber (${worn.amber} px > bare ${bare.amber} px)`);

    const off = await page.evaluate(() => {
      EurekaCosmetics.unequip('glass');
      return new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const plots = LAB_LAMPS.plots;
          resolve({
            hidden: plots.every((p) => p.canopy && !p.canopy.visible),
            emissive: plots.map((p) => p.bar.material.emissive.getHex()),
          });
        }));
      });
    });
    ok(off.hidden && off.emissive.length >= 2 && off.emissive.every((hex) => hex === 0x220033),
      `taking the glass off restores the purple bar (${off.emissive.map((hex) => hex.toString(16)).join(',')})`);
  } finally {
    await browser.close();
  }
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors[0] : ''}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(1); });
