/* Desktop: Help and Sound covered the last upgrade rows.
 *
 * fitLeftPanel() used to leave #left-panel at full height whenever the
 * tray was still on the right. Help and Sound are fixed over that
 * column, so Electric Trimmer and Trim Fan could not be clicked.
 * The column now stops above those two buttons. On a phone the
 * stylesheet sheet is left alone. Hook-free.
 */
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

async function shop(browser, viewport, mobile) {
  const ctx = await browser.newContext({
    viewport,
    isMobile: !!mobile,
    hasTouch: !!mobile,
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).split('\n')[0]));
  await page.addInitScript(() => {
    localStorage.removeItem('drug-lab-v1');
    localStorage.removeItem('growop-intro-seen');
  });
  await page.goto(BASE + '/drug-lab.html', { waitUntil: 'load' });
  await page.click('#diff-careful');
  await page.click('#intro-go');
  await page.waitForFunction(() => !document.getElementById('intro-modal').classList.contains('open'));
  return { ctx, page, errs };
}

(async () => {
  const launch = {
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);

  const desk = await shop(browser, { width: 1280, height: 800 }, false);
  const geo = await desk.page.evaluate(() => {
    const panelEl = document.getElementById('left-panel');
    const panel = panelEl.getBoundingClientRect();
    const own = id => {
      const el = document.getElementById(id);
      const b = el.getBoundingClientRect();
      const x = b.left + b.width / 2, y = b.top + b.height / 2;
      const top = document.elementFromPoint(x, y);
      return {
        id,
        top: Math.round(b.top),
        self: !!(top && (top === el || el.contains(top) || top.contains(el))),
        hit: top && (top.id || top.className || top.tagName),
      };
    };
    // Only the painted part of a row counts. A row past the scrollport
    // is reached by scrolling, not covered by Help.
    const covered = [];
    for (const el of panelEl.querySelectorAll('button')) {
      const b = el.getBoundingClientRect();
      const top = Math.max(b.top, panel.top);
      const bottom = Math.min(b.bottom, panel.bottom);
      const left = Math.max(b.left, panel.left);
      const right = Math.min(b.right, panel.right);
      if (right - left < 2 || bottom - top < 2) continue;
      let samples = 0, miss = 0;
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 3; j++) {
          const x = left + ((right - left) * (i + 0.5)) / 5;
          const y = top + ((bottom - top) * (j + 0.5)) / 3;
          samples++;
          const hit = document.elementFromPoint(x, y);
          if (!(hit === el || el.contains(hit))) miss++;
        }
      }
      if (samples && miss / samples > 0.08) {
        covered.push((el.innerText || '').replace(/\s+/g, ' ').slice(0, 36) + ' ' + miss + '/' + samples);
      }
    }
    const fan = [...panelEl.querySelectorAll('button')].find(el => /Trim Fan/.test(el.innerText));
    const placed = fan.getBoundingClientRect();
    panelEl.scrollTop += placed.top - panel.top - 24;
    const fb = fan.getBoundingClientRect();
    const fhit = document.elementFromPoint(fb.left + fb.width / 2, fb.top + fb.height / 2);
    const helpTop = document.getElementById('lab-help-btn').getBoundingClientRect().top;
    return {
      panelBottom: Math.round(panel.bottom),
      help: own('lab-help-btn'),
      sfx: own('sfx-btn'),
      covered,
      fanOnButton: !!(fhit && (fhit === fan || fan.contains(fhit))),
      fanAboveHelp: fb.bottom <= helpTop + 1,
      fanHit: fhit && (fhit.id || fhit.className || fhit.tagName),
    };
  });
  ok(geo.panelBottom <= geo.sfx.top + 1 && geo.panelBottom <= geo.help.top + 1,
    `the column stops above Help and Sound (panel ${geo.panelBottom}, help ${geo.help.top}, sound ${geo.sfx.top})`);
  ok(geo.help.self && geo.sfx.self, `Help and Sound still own their centres (${geo.help.hit}, ${geo.sfx.hit})`);
  ok(geo.covered.length === 0, `painted upgrade rows are clickable${geo.covered.length ? ' — ' + geo.covered.join('; ') : ''}`);
  ok(geo.fanOnButton && geo.fanAboveHelp,
    `scrolling brings Trim Fan above Help (${geo.fanHit}, above=${geo.fanAboveHelp})`);
  ok(desk.errs.length === 0, `desktop page errors (${desk.errs.join('; ')})`);
  await desk.ctx.close();

  const phone = await shop(browser, { width: 390, height: 844 }, true);
  await phone.page.click('#manage-btn');
  await phone.page.waitForFunction(() => {
    const panel = document.getElementById('left-panel');
    const b = panel.getBoundingClientRect();
    return panel.classList.contains('mobile-open') && b.top < 500 && b.bottom > 800;
  });
  const sheet = await phone.page.evaluate(() => {
    const panel = document.getElementById('left-panel');
    return {
      open: panel.classList.contains('mobile-open'),
      max: panel.style.maxHeight,
      top: Math.round(panel.getBoundingClientRect().top),
    };
  });
  ok(sheet.open && sheet.max === '' && sheet.top < 844,
    `the phone sheet still opens on the stylesheet height (${sheet.max || 'css'}, y${sheet.top})`);
  ok(phone.errs.length === 0, `phone page errors (${phone.errs.join('; ')})`);
  await phone.ctx.close();

  await browser.close();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
