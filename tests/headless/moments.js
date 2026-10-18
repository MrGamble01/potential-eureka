/* Photo mode + highlight replay.
 *
 * The buffer, GIF, filters, and the highlights switch run in Node.
 * The browser half opens photo mode on Voxel Isle and Hearthvale,
 * checks a full-colour desktop frame, and a trophy filed by name.
 */
const { chromium } = require('playwright');
const { spawnSync } = require('child_process');
const Moments = require('../../js/moments.js');
const Progress = require('../../js/progression.js');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

function memStore() {
  const m = new Map();
  return {
    getItem(k) { return m.has(k) ? m.get(k) : null; },
    setItem(k, v) { m.set(String(k), String(v)); },
  };
}

function lzwDecode(minCodeSize, data) {
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  let codeSize = minCodeSize + 1;
  let next = eoi + 1;
  const dict = [];
  for (let i = 0; i < clear; i++) dict[i] = [i];
  let bitPos = 0;
  function read() {
    let code = 0;
    for (let b = 0; b < codeSize; b++) {
      const byte = data[bitPos >> 3] || 0;
      if ((byte >> (bitPos & 7)) & 1) code |= 1 << b;
      bitPos++;
    }
    return code;
  }
  const out = [];
  let prev = null;
  let guard = 0;
  while (guard++ < data.length * 8) {
    const code = read();
    if (code === eoi) break;
    if (code === clear) {
      codeSize = minCodeSize + 1;
      next = eoi + 1;
      dict.length = clear;
      prev = null;
      continue;
    }
    let entry;
    if (dict[code] && code < next) entry = dict[code];
    else if (code === next && prev) entry = prev.concat([prev[0]]);
    else break;
    for (let i = 0; i < entry.length; i++) out.push(entry[i]);
    if (prev && next < 4096) {
      dict[next++] = prev.concat([entry[0]]);
      if (next >= (1 << codeSize) && codeSize < 12) codeSize++;
    }
    prev = entry;
  }
  return out;
}

function gifFrames(bytes) {
  if (bytes.length < 13) return [];
  let p = 6;
  p += 4;
  const packed = bytes[p++];
  p += 2;
  if (packed & 0x80) p += (2 << (packed & 7)) * 3;
  const frames = [];
  while (p < bytes.length) {
    const b = bytes[p++];
    if (b === 0x3B) break;
    if (b === 0x21) {
      p++;
      while (p < bytes.length) {
        const n = bytes[p++];
        if (!n) break;
        p += n;
      }
      continue;
    }
    if (b !== 0x2C) break;
    p += 8;
    const local = bytes[p++];
    if (local & 0x80) p += (2 << (local & 7)) * 3;
    const minCode = bytes[p++];
    const data = [];
    while (p < bytes.length) {
      const n = bytes[p++];
      if (!n) break;
      for (let i = 0; i < n; i++) data.push(bytes[p++]);
    }
    frames.push(lzwDecode(minCode, data));
  }
  return frames;
}

{
  const buf = Moments.createBuffer({ seconds: 12, fps: 4 });
  ok(buf.capacity === 48 && buf.seconds === 12 && buf.fps === 4, 'the reel holds 12 seconds at 4 fps');
  for (let i = 0; i < 60; i++) buf.push({ t: i * 250, w: 4, h: 2, idx: new Uint8Array([i & 255]) });
  const frames = buf.list();
  ok(frames.length === 48 && frames[0].t === 12 * 250 && frames[47].t === 59 * 250,
    'the ring keeps the newest 48 samples in order');
  const span = Moments.spanSeconds(frames);
  ok(span > 10 && span < 15, 'a full reel covers between 10 and 15 seconds (' + span.toFixed(2) + 's)');
  buf.clear();
  ok(buf.count() === 0 && buf.list().length === 0, 'clearing the reel drops every sample');
}

{
  const rec = Moments.createRecorder({ seconds: 12, fps: 4, enabled: true });
  ok(rec.note({ t: 0 }, 0) && !rec.note({ t: 1 }, 100) && rec.note({ t: 2 }, 250),
    'samples land on the 4 fps cadence and skip the frames in between');
  rec.setEnabled(false);
  ok(!rec.note({ t: 9 }, 10000) && rec.buffer.count() === 0, 'turning highlights off stops sampling and frees the reel');
}

{
  const buf = Moments.createBuffer({ seconds: 12, fps: 4 });
  buf.push({ t: 0, w: 2, h: 1, idx: new Uint8Array([1, 2]) });
  ok(Moments.flagClip(buf, [], 'short', 8) === null, 'a clip needs more than one frame');
  buf.push({ t: 250, w: 2, h: 1, idx: new Uint8Array([3, 4]) });
  const gallery = [];
  Moments.flagClip(buf, gallery, 'Trophy', 2);
  buf.list()[0].idx[0] = 9;
  buf.push({ t: 500, w: 2, h: 1, idx: new Uint8Array([7, 7]) });
  ok(gallery[0].frames[0].idx[0] === 1, 'a flagged clip keeps its own pixels after the reel moves on');
  Moments.flagClip(buf, gallery, 'Festival', 2);
  Moments.flagClip(buf, gallery, 'Harvest', 2);
  ok(gallery.length === 2 && gallery[0].label === 'Harvest' && gallery[1].label === 'Festival',
    'the gallery keeps the two newest clips');
}

{
  const rgba = new Uint8Array([10, 20, 30, 255, 200, 10, 10, 255]);
  const same = Moments.filterPixels(rgba, 'none');
  ok(same[0] === 10 && same[1] === 20 && same[2] === 30 && same[4] === 200, 'the plain filter leaves the pixels alone');
  const noir = Moments.filterPixels(rgba, 'noir');
  ok(noir[0] === noir[1] && noir[1] === noir[2] && noir[4] === noir[5] && noir[5] === noir[6],
    'noir collapses each pixel to grey');
  const warm = Moments.filterPixels(rgba, 'warm');
  ok(warm[0] > rgba[0] && warm[2] < rgba[2], 'warm lifts red and cools blue');
  const idx = Moments.indexFrame(rgba, 2, 1);
  ok(idx.length === 2 && idx[0] === Moments.quantizeIndex(10, 20, 30), 'indexing matches the palette quantizer');
}

{
  const w = 16, h = 8;
  const a = new Uint8Array(w * h);
  const b = new Uint8Array(w * h);
  for (let i = 0; i < a.length; i++) {
    a[i] = (i * 13) & 255;
    b[i] = (i * 7 + 40) & 255;
  }
  const gif = Moments.gifEncode([
    { t: 0, w: w, h: h, idx: a },
    { t: 250, w: w, h: h, idx: b },
  ]);
  const head = String.fromCharCode(gif[0], gif[1], gif[2], gif[3], gif[4], gif[5]);
  ok(head === 'GIF89a' && gif[gif.length - 1] === 0x3B, 'an export is a GIF89a that ends on the trailer');
  const sig = Buffer.from(gif).toString('latin1');
  ok(sig.indexOf('NETSCAPE2.0') > 0, 'the reel loops');
  const decoded = gifFrames(gif);
  ok(decoded.length === 2 && decoded[0].length === w * h && decoded[1].length === w * h
    && decoded[0].every(function (v, i) { return v === a[i]; })
    && decoded[1].every(function (v, i) { return v === b[i]; }),
    'the GIF decodes back to both frames');
  ok(Moments.gifEncode([]).length === 0, 'an empty reel exports nothing');

  const ff = spawnSync('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-f', 'null', '-'], { input: Buffer.from(gif) });
  if (ff.error && ff.error.code === 'ENOENT') {
    ok(true, 'ffmpeg is not installed here; the in-test decoder covered the GIF');
  } else {
    ok(ff.status === 0, 'ffmpeg accepts the exported GIF' + (ff.status ? ' — ' + String(ff.stderr).slice(0, 180) : ''));
  }
}

{
  const store = memStore();
  ok(Moments.readSettings(store.getItem.bind(store)).enabled === true, 'highlights start on');
  Moments.writeSettings(store.setItem.bind(store), false);
  ok(Moments.readSettings(store.getItem.bind(store)).enabled === false, 'the off switch is the same key the games read');
  store.setItem(Moments.STORE, '{');
  ok(Moments.readSettings(store.getItem.bind(store)).enabled === true, 'a broken setting falls back to on');
}

{
  function file() { return { name: 'a.gif' }; }
  ok(Moments.chooseExport({ file: file(), share: function () {}, canShare: function () { return true; } }) === 'share',
    'a phone that can share files uses the share sheet');
  ok(Moments.chooseExport({ file: file(), share: function () {}, canShare: function () { return false; } }) === 'download',
    'a browser without file sharing downloads the picture');
  ok(Moments.chooseExport({ file: file() }) === 'download', 'no share API means a download');
}

{
  const desk = Moments.frameSize(1280, 720, false);
  const phone = Moments.frameSize(1280, 720, true);
  ok(desk.w >= 480 && desk.w <= Moments.DESKTOP_W && desk.w % 2 === 0, 'a desktop reel is 480–640px wide (' + desk.w + ')');
  ok(phone.w <= Moments.PHONE_W && phone.w < desk.w && phone.h > 8, 'a phone reel is smaller than the desktop one (' + phone.w + ')');
  ok(Math.abs(desk.w / desk.h - 1280 / 720) < 0.05, 'the reel keeps the picture aspect');
  ok(Moments.storePlan(100, { indexedDB: {} }) === 'memory', 'a tiny note stays out of a database');
  ok(Moments.storePlan(80000, { indexedDB: {} }) === 'indexeddb', 'a full-colour reel uses IndexedDB');
  ok(Moments.storePlan(80000, {}) === 'memory', 'without IndexedDB the reel stays in memory');
  const titled = Moments.clipTitle({ label: 'First Harvest', game: 'Voxel Isle', when: Date.UTC(2026, 9, 17) });
  ok(titled.indexOf('First Harvest') === 0 && titled.indexOf('Voxel Isle') > 0 && titled.indexOf('2026') > 0,
    'a gallery title is the trophy, the game, and the date (' + titled + ')');
  ok(Moments.clipTitle({ label: 'Valley Founded', game: 'Hearthvale', when: Date.UTC(2026, 9, 17) }).indexOf('Valley Founded') === 0,
    'Valley Founded keeps its own name');
  const harvest = Progress.ACHIEVEMENTS.filter(function (a) { return a.name === 'First Harvest'; })[0];
  const valley = Progress.ACHIEVEMENTS.filter(function (a) { return a.name === 'Valley Founded'; })[0];
  ok(harvest && harvest.id === 'voxel-harvest' && valley && valley.game === 'hearthvale',
    'First Harvest and Valley Founded are real career trophies');
  const named = Moments.flagClip(Moments.createBuffer({ seconds: 12, fps: 4 }), [], 'First Harvest', 8, { game: 'Voxel Isle', when: Date.UTC(2026, 9, 17) });
  ok(named === null, 'a named trophy still needs two frames before it is filed');
}

async function barClearance(page) {
  return page.evaluate(() => {
    const bar = document.querySelector('#moments-photo:not([hidden]) .moments-bar, #moments-replay:not([hidden]) .moments-bar');
    if (!bar) return { ticker: false, hits: ['missing-bar'] };
    const br = bar.getBoundingClientRect();
    const ticker = document.getElementById('arcade-ai-ticker');
    const tickerOn = !!(ticker && !ticker.hidden && ticker.getBoundingClientRect().height > 8);
    function hit(sel) {
      const el = document.querySelector(sel);
      if (!el) return false;
      const cs = getComputedStyle(el);
      if (el.hidden || cs.display === 'none' || cs.visibility === 'hidden') return false;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return false;
      return !(br.right <= r.left + 0.5 || br.left >= r.right - 0.5 || br.bottom <= r.top + 0.5 || br.top >= r.bottom - 0.5);
    }
    const hits = ['#arcade-ai-ticker', '#hotbar', '#buildbar', '#buildtabs', '#lab-tray'].filter(hit);
    return { ticker: tickerOn, hits: hits };
  });
}

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errs = [];

  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push('voxel ' + String(e).slice(0, 240)));
    await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
    await page.waitForFunction(() => window.EurekaMoments && document.getElementById('moments-root'));
    await page.evaluate(() => {
      const help = document.getElementById('helpOv');
      if (help) help.classList.remove('open');
    });
    const quiet = await page.evaluate(async () => {
      EurekaMoments.setEnabled(false);
      const before = EurekaMoments.frameCount();
      EurekaMoments.afterFrame();
      await new Promise(r => setTimeout(r, 280));
      EurekaMoments.afterFrame();
      return EurekaMoments.frameCount() - before;
    });
    ok(quiet === 0, 'Voxel Isle records nothing while highlights are off');
    const grew = await page.evaluate(async () => {
      EurekaMoments.setEnabled(true);
      const before = EurekaMoments.frameCount();
      EurekaMoments.afterFrame();
      await new Promise(r => setTimeout(r, 280));
      EurekaMoments.afterFrame();
      return EurekaMoments.frameCount() - before;
    });
    ok(grew >= 1, 'Voxel Isle samples the island while highlights are on');
    const sharp = await page.evaluate(async () => {
      await new Promise(r => setTimeout(r, 600));
      if (window.EurekaProgress) EurekaProgress.emit('voxel', 'harvest');
      await new Promise(r => setTimeout(r, 40));
      const frames = EurekaMoments.frames();
      const last = frames[frames.length - 1];
      return {
        w: last ? last.w : 0,
        url: last && last.url ? last.url.slice(0, 22) : '',
        labels: EurekaMoments.gallery().map(g => g.label + ' · ' + (g.game || '')),
      };
    });
    ok(sharp.w >= 480 && sharp.w <= 640, 'Voxel Isle stores a sharp desktop frame (' + sharp.w + 'px)');
    ok(/^data:image\/(jpeg|webp)/.test(sharp.url), 'the frame is a full-colour JPEG or WebP');
    ok(sharp.labels.some(l => l.indexOf('First Harvest') === 0 && l.indexOf('Voxel Isle') > 0),
      'a career unlock is filed as First Harvest · Voxel Isle, not Trophy (' + sharp.labels.join('; ') + ')');
    await page.click('#momentsBtn');
    const photo = await page.evaluate(() => ({
      view: EurekaMoments.view(),
      hidden: document.body.classList.contains('photo'),
      stage: !!document.getElementById('moments-stage'),
      back: getComputedStyle(document.getElementById('back')).display,
    }));
    ok(photo.view === 'photo' && photo.hidden && photo.stage && photo.back === 'none',
      'photo mode pauses the HUD on Voxel Isle');
    await page.waitForFunction(() => {
      const t = document.getElementById('arcade-ai-ticker');
      return t && !t.hidden && t.getBoundingClientRect().height > 8;
    }, null, { timeout: 5000 });
    const voxelClear = await barClearance(page);
    ok(voxelClear.ticker && voxelClear.hits.length === 0,
      'the Voxel photo bar clears the announcer and the build bar' + (voxelClear.hits.length ? ' (' + voxelClear.hits.join(', ') + ')' : ''));
    await page.locator('#moments-photo button', { hasText: 'HUD off' }).click();
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const voxelHud = await barClearance(page);
    ok(voxelHud.hits.length === 0,
      'the Voxel photo bar stays clear when the HUD comes back' + (voxelHud.hits.length ? ' (' + voxelHud.hits.join(', ') + ')' : ''));
    await page.locator('#moments-photo button', { hasText: 'HUD on' }).click();
    await page.click('[data-moments-filter="noir"]');
    await page.click('[data-moments-frame="film"]');
    const look = await page.evaluate(() => ({
      filter: EurekaMoments.filter(),
      pressed: document.querySelector('[data-moments-filter="noir"]').getAttribute('aria-pressed'),
      frame: document.getElementById('moments-stage').getAttribute('data-frame'),
    }));
    ok(look.filter === 'noir' && look.pressed === 'true' && look.frame === 'film',
      'a filter and a frame can be picked from the bar');
    const box = await page.locator('#moments-photo .moments-row button').first().boundingBox();
    ok(box && box.height >= 44, 'photo controls are tall enough for a thumb');
    await page.locator('#moments-photo button', { hasText: 'Replay' }).click();
    await page.waitForFunction(() => {
      const c = document.querySelector('#moments-replay canvas');
      return c && c.dataset.smoothing === 'high' && c.width >= 480;
    });
    const replay = await page.evaluate(() => {
      const c = document.querySelector('#moments-replay canvas');
      return { w: c.width, smooth: c.dataset.smoothing, shown: !document.getElementById('moments-replay').hidden };
    });
    ok(replay.shown && replay.smooth === 'high' && replay.w >= 480, 'highlight replay draws the reel with smoothing (' + replay.w + 'px)');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    const closed = await page.evaluate(() => EurekaMoments.view() === 'live' && !document.body.classList.contains('photo'));
    ok(closed, 'Escape leaves photo mode and brings the HUD back');
    await ctx.close();
  }

  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push('hearth ' + String(e).slice(0, 240)));
    await page.goto(BASE + '/hearthvale.html', { waitUntil: 'load' });
    await page.waitForFunction(() => window.EurekaMoments && document.getElementById('moments-root'));
    await page.evaluate(() => EurekaMoments.openPhoto());
    await page.waitForFunction(() => {
      const t = document.getElementById('arcade-ai-ticker');
      return t && !t.hidden && t.getBoundingClientRect().height > 8;
    }, null, { timeout: 5000 });
    const valeClear = await barClearance(page);
    ok(valeClear.ticker && valeClear.hits.length === 0,
      'the Hearthvale photo bar clears the announcer and the build bar' + (valeClear.hits.length ? ' (' + valeClear.hits.join(', ') + ')' : ''));
    await page.locator('#moments-photo button', { hasText: 'HUD off' }).click();
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const valeHud = await barClearance(page);
    ok(valeHud.hits.length === 0,
      'the Hearthvale photo bar stays clear when the HUD comes back' + (valeHud.hits.length ? ' (' + valeHud.hits.join(', ') + ')' : ''));
    await page.keyboard.press('Escape');
    const phone = await page.evaluate(async () => {
      EurekaMoments.openPhoto();
      const hud = getComputedStyle(document.getElementById('hud')).visibility;
      const welcome = document.getElementById('welcome').classList.contains('show');
      EurekaMoments.setFilter('dusk');
      const stage = document.getElementById('moments-stage');
      stage.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 40, clientY: 200, bubbles: true }));
      stage.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 90, clientY: 240, bubbles: true }));
      stage.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 90, clientY: 240, bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return {
        hud: hud,
        welcome: welcome,
        filter: EurekaMoments.filter() === 'dusk',
        closed: EurekaMoments.view() === 'live',
        welcomeStill: document.getElementById('welcome').classList.contains('show'),
      };
    });
    ok(phone.hud === 'hidden' && phone.welcome && phone.filter, 'Hearthvale photo mode hides the HUD and keeps the welcome underneath');
    ok(phone.closed && phone.welcomeStill, 'closing photo mode leaves the valley where it was');
    const phoneReel = await page.evaluate(async () => {
      EurekaMoments.setEnabled(true);
      EurekaMoments.afterFrame();
      await new Promise(r => setTimeout(r, 300));
      EurekaMoments.afterFrame();
      const frames = EurekaMoments.frames();
      return frames.length ? frames[frames.length - 1].w : 0;
    });
    ok(phoneReel > 0 && phoneReel <= 400, 'a phone stores a smaller reel (' + phoneReel + 'px)');
    await page.evaluate(() => EurekaMoments.setEnabled(false));
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.EurekaMoments);
    const kept = await page.evaluate(() => EurekaMoments.enabled() === false);
    ok(kept, 'the highlights switch survives a reload');
    await ctx.close();
  }

  ok(errs.length === 0, 'no page errors' + (errs.length ? ' — ' + errs.slice(0, 3).join(' | ') : ''));
  await browser.close();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
