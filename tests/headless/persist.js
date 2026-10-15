/* Shared save/settings layer.
 *
 * The schema tests run in plain Node against an in-memory Storage: version
 * bumps, legacy mute flags, corrupt blobs, and a newer document that must
 * survive a read. The browser half then checks the flagships actually share
 * that document — volume and mute set in Age of War are still there after a
 * reload and in Hearthvale, and Reset progress drops the kept town without
 * wiping the shared levels.
 */
const { chromium } = require('playwright');
const Persist = require('../../js/persist.js');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

function mem() {
  const m = new Map();
  return {
    getItem(k) { return m.has(k) ? m.get(k) : null; },
    setItem(k, v) { m.set(String(k), String(v)); },
    removeItem(k) { m.delete(k); },
  };
}

function fresh() {
  return Persist.create(mem());
}

// --- schema ---------------------------------------------------------------
{
  const store = mem();
  const a = Persist.create(store);
  const first = a.settings.get();
  ok(first.muted === false && first.sfx === 1 && first.music === 1 && first.musicOn === true && first.touched === false,
    'a fresh store reads default levels and does not mark them as chosen');
  ok(store.getItem(Persist.SETTINGS_KEY) == null, 'reading defaults does not write a document');

  a.settings.update({ sfx: 0.4, music: 0.25, touched: true });
  const again = Persist.create(store).settings.get();
  ok(again.sfx === 0.4 && again.music === 0.25 && again.touched === true && again.v === Persist.SCHEMA,
    'levels survive a second open, the way a reload does');

  a.settings.update({ sfx: 5, music: -2, muted: '1', touched: true });
  const clamped = a.settings.get();
  ok(clamped.sfx === 1 && clamped.music === 0.25 && clamped.muted === true,
    'volume clamps into 0..1 and a string mute still counts; music level is kept when the slider hits zero');
}

{
  const store = mem();
  store.setItem(Persist.SETTINGS_KEY, JSON.stringify({ mute: true, sound: 0.4, musicVolume: 0.2, extra: 'keep' }));
  const api = Persist.create(store);
  const s = api.settings.get();
  ok(s.v === 1 && s.muted === true && s.sfx === 0.4 && s.music === 0.2 && s.touched === true,
    'an unversioned mute/sound/musicVolume object migrates onto the current schema');
  const raw = JSON.parse(store.getItem(Persist.SETTINGS_KEY));
  ok(raw.v === 1 && raw.extra === 'keep' && raw.muted === true, 'migration keeps fields it does not understand');
}

{
  const store = mem();
  store.setItem(Persist.SETTINGS_KEY, JSON.stringify('1'));
  const s = Persist.create(store).settings.get();
  ok(s.muted === true && s.touched === true && s.v === 1, 'a legacy "1" blob migrates to muted');
}

{
  const store = mem();
  store.setItem('arcade-muted', '1');
  store.setItem('aow-muted', '0');
  const api = Persist.create(store);
  const s = api.settings.get();
  ok(s.muted === true && s.touched === true, 'arcade-muted migrates into the shared mute');
  ok(JSON.parse(store.getItem(Persist.SETTINGS_KEY)).muted === true, 'the migrated mute is what the next game reads');
  const quiet = mem();
  quiet.setItem('tycoon:sfxEnabled', '0');
  ok(Persist.create(quiet).settings.get().muted === true, 'a muted tycoon sfx flag migrates too');
  const loud = mem();
  loud.setItem('arcade-muted', '0');
  loud.setItem('aow-muted', '0');
  ok(Persist.create(loud).settings.get().touched === false && loud.getItem(Persist.SETTINGS_KEY) == null,
    'explicitly unmuted legacy flags do not invent a shared document');
}

{
  const store = mem();
  store.setItem(Persist.SETTINGS_KEY, '{oops');
  const api = Persist.create(store);
  let threw = false;
  let s = null;
  try { s = api.settings.get(); } catch (e) { threw = true; }
  ok(!threw && s && s.muted === false && s.sfx === 1, 'corrupt settings do not throw and fall back to defaults');
  ok(store.getItem(Persist.SETTINGS_KEY) === '{oops', 'a corrupt blob is left in place until the player changes something');
  api.settings.update({ sfx: 0.5, touched: true });
  ok(JSON.parse(store.getItem(Persist.SETTINGS_KEY)).sfx === 0.5, 'the next change replaces the corrupt blob');
}

{
  const store = mem();
  store.setItem(Persist.SETTINGS_KEY, JSON.stringify({
    v: 9, muted: true, sfx: 0.5, music: 0.3, musicOn: false, touched: true, futureFlag: 'keep',
  }));
  const api = Persist.create(store);
  const s = api.settings.get();
  ok(s.muted === true && s.sfx === 0.5 && s.musicOn === false, 'a newer settings document is still readable');
  ok(JSON.parse(store.getItem(Persist.SETTINGS_KEY)).v === 9, 'reading a newer document does not downgrade it');
  api.settings.update({ sfx: 0.2 });
  const raw = JSON.parse(store.getItem(Persist.SETTINGS_KEY));
  ok(raw.v === 9 && raw.futureFlag === 'keep' && raw.sfx === 0.2 && raw.music === 0.3,
    'a change on a newer document keeps its version and unknown fields');
}

{
  const store = mem();
  const api = Persist.create(store);
  ok(api.progress.note('../no', { day: 1 }) === false, 'a progress id has to be a short slug');
  ok(api.progress.note('hearthvale', { day: 4, name: 'Mill', pop: 3, bad: { nested: true }, drop: 'x'.repeat(200) }) === true,
    'a flagship can record a continue');
  const got = api.progress.get('hearthvale');
  ok(got && got.summary.day === 4 && got.summary.name === 'Mill' && got.summary.pop === 3
    && got.summary.bad == null && got.summary.drop.length === 80,
    'the summary keeps plain fields and drops nested ones');
  const re = Persist.create(store);
  ok(re.progress.has('hearthvale') && re.progress.get('hearthvale').summary.day === 4,
    'continue metadata survives a reload');
  ok(re.progress.clear('hearthvale') === true && re.progress.has('hearthvale') === false,
    'reset drops that game and leaves the document readable');
  ok(store.getItem(Persist.PROGRESS_KEY) != null, 'clearing one game does not throw the index away');
}

{
  const store = mem();
  store.setItem(Persist.PROGRESS_KEY, JSON.stringify({
    v: 4,
    extra: true,
    games: { hearthvale: { savedAt: 5, summary: { day: 2 }, badge: 'oak' }, 'nope!': { savedAt: 1 } },
  }));
  const api = Persist.create(store);
  ok(api.progress.has('hearthvale') && !api.progress.has('nope!'),
    'a newer progress index loads real games and drops a bad id');
  ok(JSON.parse(store.getItem(Persist.PROGRESS_KEY)).v === 4, 'reading newer progress does not rewrite it');
  api.progress.note('ageofwar', { wave: 3 });
  const raw = JSON.parse(store.getItem(Persist.PROGRESS_KEY));
  ok(raw.v === 4 && raw.extra === true && raw.games.hearthvale.badge === 'oak' && raw.games.ageofwar.summary.wave === 3,
    'noting a game on a newer index keeps the version, unknown fields, and the other game');
  store.setItem(Persist.PROGRESS_KEY, '{nope');
  const broken = Persist.create(store);
  let threw = false;
  try { ok(broken.progress.has('hearthvale') === false, 'corrupt progress reads as no continues'); }
  catch (e) { threw = true; }
  ok(!threw, 'corrupt progress does not throw');
}

{
  const api = fresh();
  let heard = 0;
  const stop = api.settings.subscribe(() => { heard++; });
  api.settings.update({ muted: true, touched: true });
  api.settings.update({ muted: true, touched: true });
  ok(heard === 1, 'listeners hear a real change and not a duplicate write');
  stop();
  api.settings.update({ muted: false, touched: true });
  ok(heard === 1, 'an unsubscribed listener stays quiet');
}
{
  const api = fresh();
  ok(api.audio.sfx(false) === 1 && api.audio.sfx(true) === 0, 'before a choice, only that game\'s own mute silences it');
  api.settings.update({ muted: true, sfx: 0.5, touched: true });
  ok(api.audio.sfx(false) === 0 && api.audio.apply(false, false).muted === true,
    'once chosen, the shared mute wins');
  api.settings.update({ muted: false, musicOn: false, touched: true });
  ok(api.audio.music(false, false) === 0 && api.audio.sfx(false) === 0.5,
    'music can be off while sound keeps its level');
}

// --- flagships share one document ----------------------------------------
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errs = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 240)));
    page.on('dialog', (d) => d.accept());

    await page.goto(BASE + '/ageofwar/index.html', { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.EurekaPersist && document.getElementById('aow-audio'));
    const welcome = page.locator('#aow-welcome-close');
    if (await welcome.isVisible().catch(() => false)) await welcome.click();
    await page.locator('#aow-settings-btn').click();
    await page.locator('#aow-audio input[data-ep="sfx"]').fill('40');
    await page.locator('#aow-audio input[data-ep="music"]').fill('20');
    await page.locator('#aow-mute-toggle').click();
    const set = await page.evaluate(() => {
      const s = EurekaPersist.settings.get();
      return { s, legacy: localStorage.getItem('aow-muted') };
    });
    ok(set.s.touched === true && set.s.muted === true && set.s.sfx === 0.4 && set.s.music === 0.2 && set.s.musicOn === true,
      `Age of War writes the shared levels (sfx ${set.s.sfx}, music ${set.s.music}, muted ${set.s.muted})`);
    ok(set.legacy === '1', 'Age of War still mirrors its own mute key');

    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.EurekaPersist);
    const kept = await page.evaluate(() => EurekaPersist.settings.get());
    ok(kept.muted === true && kept.sfx === 0.4 && kept.music === 0.2,
      'Age of War settings survive a reload');

    await page.goto(BASE + '/hearthvale.html', { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.EurekaPersist && document.getElementById('hv-audio'));
    const hv = await page.evaluate(() => ({
      label: document.getElementById('m-sound').textContent,
      settings: EurekaPersist.settings.get(),
    }));
    ok(hv.settings.muted === true && /Off/.test(hv.label) && hv.settings.sfx === 0.4,
      `Hearthvale picks up the shared mute (${hv.label})`);

    await page.locator('#welcome-close').click();
    await page.waitForFunction(() => {
      try { return !!localStorage.getItem('hearthvale-v1') && EurekaPersist.progress.has('hearthvale'); }
      catch (e) { return false; }
    });
    const noted = await page.evaluate(() => EurekaPersist.progress.get('hearthvale'));
    ok(noted && noted.summary && noted.summary.day >= 1, 'Begin building records a Hearthvale continue');

    await page.evaluate(() => document.getElementById('m-sound').click());
    const unmuted = await page.evaluate(() => EurekaPersist.settings.get());
    ok(unmuted.muted === false && unmuted.sfx === 0.4 && unmuted.music === 0.2,
      'unmuting in Hearthvale keeps the shared volumes');

    const reloaded = page.waitForEvent('load', { timeout: 20000 });
    await page.evaluate(() => document.querySelector('#hv-audio [data-ep="reset"]').click());
    await reloaded;
    await page.waitForFunction(() => window.EurekaPersist);
    const after = await page.evaluate(() => ({
      save: localStorage.getItem('hearthvale-v1'),
      has: EurekaPersist.progress.has('hearthvale'),
      settings: EurekaPersist.settings.get(),
    }));
    ok(after.save == null && after.has === false, 'Reset progress drops the town and its continue');
    ok(after.settings.muted === false && after.settings.sfx === 0.4 && after.settings.music === 0.2,
      'reset does not wipe the shared sound levels');

    await page.goto(BASE + '/ageofwar/index.html', { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.EurekaPersist);
    const back = await page.evaluate(() => ({
      muted: EurekaPersist.settings.get().muted,
      pressed: document.getElementById('aow-mute-toggle').getAttribute('aria-pressed'),
    }));
    ok(back.muted === false && back.pressed === 'false',
      'Age of War hears the unmute from Hearthvale');

    await page.goto(BASE + '/drug-lab.html', { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.EurekaPersist && document.getElementById('lab-audio'));
    const lab = await page.evaluate(() => ({
      reset: !!document.querySelector('#lab-audio [data-ep="reset"]'),
      sfx: !!document.querySelector('#lab-audio input[data-ep="sfx"]'),
      music: !!document.querySelector('#lab-audio input[data-ep="music"]'),
      mute: !!document.querySelector('#lab-audio input[data-ep="mute"]'),
    }));
    ok(lab.reset && lab.sfx && lab.music && lab.mute, 'Grow Op mounts mute, both volumes, and reset');

    await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.EurekaPersist && document.getElementById('vox-audio'));
    await page.goto(BASE + '/homeless-village.html', { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.EurekaPersist && document.getElementById('camp-audio'));
    await page.goto(BASE + '/tycoon/play.html', { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.EurekaPersist && document.getElementById('tycoon-audio'));
    const ty = await page.evaluate(() => {
      const s = EurekaPersist.settings.get();
      return { sfx: s.sfx, music: s.music, muted: s.muted, box: !!document.querySelector('#tycoon-audio input[data-ep="sfx"]') };
    });
    ok(ty.box && ty.sfx === 0.4 && ty.music === 0.2 && ty.muted === false,
      'Startup Tycoon shows the same levels');

    await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    try {
      await page.waitForFunction(() => typeof EurekaPersist !== 'undefined' && typeof SFX !== 'undefined', null, { timeout: 15000 });
    } catch (e) {
      const info = await page.evaluate(() => ({
        href: location.href,
        ready: document.readyState,
        persist: typeof EurekaPersist,
        sfx: typeof SFX,
      })).catch((err) => String(err));
      throw new Error(String(e.message || e).split('\n')[0] + ' hub=' + JSON.stringify(info));
    }
    const hub = await page.evaluate(() => ({
      muted: SFX.isMuted(),
      sfx: EurekaPersist.settings.get().sfx,
    }));
    ok(hub.muted === false && hub.sfx === 0.4, 'the arcade hub uses the same mute and sound level');

    await ctx.close();
  } catch (e) {
    ok(false, 'flagship round trip: ' + String(e && e.message || e).split('\n')[0]);
  } finally {
    await browser.close();
  }
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
