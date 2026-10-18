/* Announcer scope — each game speaks only from its own bank.
 *
 * A missing or unknown game id used to fall through to Hearthvale,
 * and a geometry harness used to paint an Age of War sentence onto
 * every ticker. This loads the six flagships, Beagle (same page,
 * own bank), and the hub, triggers the announcer, and checks the
 * line against every bank.
 */
const { chromium } = require('playwright');
const AI = require('../../js/ai/arcade-ai.js');
const Climax = require('../../js/climax.js');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

function fill(template, detail) {
  return template.replace('{detail}', detail).replace(/\s+/g, ' ').trim();
}

function explained(bank, line) {
  if (!bank || !line) return false;
  if (line === bank.quiet) return true;
  const templates = Object.keys(bank.calls).map((key) => bank.calls[key]);
  return templates.some((template) => {
    const at = template.indexOf('{detail}');
    if (at < 0) return line === template;
    const pre = template.slice(0, at);
    const post = template.slice(at + '{detail}'.length);
    if (!line.startsWith(pre) || !line.endsWith(post)) return false;
    if (line.length < pre.length + post.length) return false;
    const detail = line.slice(pre.length, line.length - post.length);
    return detail.trim().length > 0;
  });
}

function climaxSentences(id) {
  const bank = Climax.bank(id);
  if (!bank) return [];
  const all = [];
  Object.keys(bank).forEach((key) => bank[key].forEach((line) => all.push(line)));
  return all;
}

function foreignBank(id, line) {
  if (!line || AI.systemLines.indexOf(line) !== -1) return '';
  const games = AI.games.filter((other) => other !== id);
  for (let i = 0; i < games.length; i++) {
    const other = games[i];
    if (explained(AI.callBank(other), line)) return other + ' calls';
    if (climaxSentences(other).indexOf(line) !== -1) return other + ' climax';
  }
  return '';
}

function owns(id, line) {
  if (!line) return false;
  if (AI.systemLines.indexOf(line) !== -1) return true;
  if (explained(AI.callBank(id), line)) return true;
  return climaxSentences(id).indexOf(line) !== -1;
}

const PAGES = [
  {
    id: 'ageofwar',
    url: '/ageofwar/',
    seed: () => localStorage.setItem('aow-welcome-seen', '1'),
    async ready(page) {
      const resume = page.locator('#aow-resume-cta');
      if (await resume.count() && await resume.isVisible()) await resume.click();
      await page.waitForSelector('.aow-spawn-btn', { timeout: 8000 });
    },
  },
  {
    id: 'tycoon',
    url: '/tycoon/play.html',
    seed: () => {
      localStorage.setItem('tycoon:welcomeSeen-v1', '1');
      localStorage.setItem('tycoon:tipsEnabled', '0');
    },
    async ready(page) {
      await page.waitForSelector('#hire-btn', { timeout: 8000 });
    },
  },
  {
    id: 'beagle',
    url: '/tycoon/play.html?theme=beagle',
    seed: () => {
      localStorage.setItem('tycoon:welcomeSeen-v1', '1');
      localStorage.setItem('tycoon:tipsEnabled', '0');
    },
    async ready(page) {
      await page.waitForSelector('#hire-btn', { timeout: 8000 });
    },
  },
  {
    id: 'homeless',
    url: '/homeless-village.html',
    async ready(page) {
      const go = page.locator('#intro-go');
      if (await go.count() && await go.isVisible()) await go.click();
      await page.waitForSelector('#top-bar', { timeout: 8000 });
    },
  },
  {
    id: 'hearthvale',
    url: '/hearthvale.html',
    async ready(page) {
      const begin = page.locator('#welcome-close');
      if (await begin.count() && await begin.isVisible()) await begin.click();
      await page.waitForSelector('#hud', { timeout: 8000 });
    },
  },
  {
    id: 'voxel',
    url: '/voxel-garden.html',
    async ready(page) {
      await page.waitForSelector('#topbar', { timeout: 8000 });
    },
  },
  {
    id: 'growop',
    url: '/drug-lab.html',
    async ready(page) {
      const close = page.locator('#intro-close');
      if (await close.count() && await close.isVisible()) await close.click();
      await page.waitForSelector('#lab-tray', { timeout: 8000 });
    },
  },
];

(async () => {
  const seen = {};
  AI.games.forEach((id) => {
    const bank = AI.callBank(id);
    ok(!!bank && bank.id === id && bank.quiet.indexOf(bank.label) === 0, id + ' publishes its own call bank');
    Object.keys(bank.calls).forEach((type) => {
      const line = fill(bank.calls[type], 'scope-mark');
      ok(!seen[line], line + ' belongs only to ' + id + (seen[line] ? ' (also ' + seen[line] + ')' : ''));
      seen[line] = id + ':' + type;
    });
  });
  ok(AI.callBank('nope') == null && AI.callBank('') == null, 'an unknown id has no bank');

  const stub = AI.createStubProvider();
  const missing = await stub.announce({});
  const unknown = await stub.announce({ game: 'hearthvale-nope', event: { type: 'state', detail: 'Wren on the ridge' } });
  ok(missing.line === 'Saved.' && missing.game === '' && unknown.line === 'Saved.' && unknown.game === '',
    'a missing id returns the system line (' + missing.line + ' / ' + unknown.line + ')');
  ok(foreignBank('tycoon', missing.line) === '' && !/Wren|ridge|Hearthvale|office|Floor note/.test(unknown.line),
    'the system line is not another game\'s copy');

  for (const id of AI.games) {
    const bank = AI.callBank(id);
    const state = await stub.announce({ game: id, event: { type: 'state', detail: 'scope-mark' } });
    const odd = await stub.announce({ game: id, event: { type: 'not-a-call', detail: 'scope-mark' } });
    const quiet = await stub.announce({ game: id, event: { type: 'state', detail: '   ' } });
    ok(state.game === id && state.line === fill(bank.calls.state, 'scope-mark'),
      id + ' state line stays in its bank (' + state.line + ')');
    ok(odd.game === id && odd.line === fill(bank.calls.default, 'scope-mark'),
      id + ' unknown event uses its own default (' + odd.line + ')');
    ok(quiet.game === id && quiet.line === bank.quiet, id + ' quiet line names itself');
    ok(owns(id, state.line) && foreignBank(id, state.line) === '', id + ' state line is not in a foreign bank');
  }

  ok(Climax.line('ageofwar', 'start', 0) === 'Hold.' && Climax.line('voxel', 'hit', 1) === 'Hold.' && Climax.line('', 'win', 0) === 'Hold.',
    'a climax without its own bank says Hold.');
  ok(Climax.line('hearthvale', 'hit', 0).indexOf('Wren') === 0 && Climax.line('tycoon', 'win', 0).indexOf('Quinn') === 0
    && Climax.line('beagle', 'feint', 1).indexOf('Biscuit') === 0, 'Wren, Quinn, and Biscuit keep their own climax lines');
  ok(Climax.line('tycoon', 'hit', 0).indexOf('Wren') === -1 && Climax.line('hearthvale', 'hit', 0).indexOf('Quinn') === -1,
    'climax lines do not borrow the other valley');

  const seasoned = await Climax.flavor('tycoon', { type: 'event', detail: 'West gate held' }, stub);
  ok(seasoned && seasoned.indexOf('House call:') === 0 && seasoned.indexOf('Wren') === -1 && seasoned.indexOf('Hearthvale heard') === -1,
    'tycoon climax flavor uses the office bank (' + seasoned + ')');
  const unnamed = await Climax.flavor('', { type: 'hit', detail: 'West gate held' }, stub);
  ok(unnamed === 'Saved.', 'climax flavor without a game id stays on the system line (' + unnamed + ')');

  let fetched = false;
  let body = '';
  const remote = AI.createRemoteProvider({ AI_API_KEY: 'k', AI_API_BASE_URL: 'http://example.test/v1' }, {
    fetch: function (url, init) {
      fetched = true;
      body = init.body || '';
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async function () { return { choices: [{ message: { content: '{"line":"Floor is open."}' } }] }; },
      });
    },
  });
  const refused = await remote.announce({ game: 'not-a-game', event: { type: 'wave', detail: 'WAVE 4' } });
  ok(!fetched && refused.line === 'Saved.' && refused.game === '', 'remote announce does not invent a game or call the model');
  const asked = await remote.announce({ game: 'tycoon', event: { type: 'state', detail: 'cash' } });
  ok(fetched && asked.game === 'tycoon' && body.indexOf('Startup Tycoon') !== -1
    && body.indexOf('Hearthvale') === -1 && body.indexOf('Age of War') === -1,
    'a tycoon request names Startup Tycoon only');

  const broken = AI.createRemoteProvider({ AI_API_KEY: 'k' }, {
    fetch: function () { return Promise.reject(new Error('down')); },
  });
  const wrapped = AI.withStubFallback(broken, stub);
  const backed = await wrapped.announce({ game: 'tycoon', event: { type: 'state', detail: 'scope-mark' } });
  ok(backed.fallback === true && backed.game === 'tycoon' && backed.line === fill(AI.callBank('tycoon').calls.state, 'scope-mark'),
    'a failed model falls back inside the same game (' + backed.line + ')');

  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });

  for (const game of PAGES) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    if (game.seed) await page.addInitScript(game.seed);
    await page.goto(BASE + game.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await game.ready(page);
    await page.waitForFunction((id) => window.ArcadeAI && window.ArcadeAI.booth && window.ArcadeAI.booth.game === id, game.id, { timeout: 8000 });
    await page.waitForFunction(() => {
      const line = document.getElementById('arcade-ai-ticker-line');
      return line && line.textContent.trim().length > 0;
    }, { timeout: 4000 }).catch(() => {});
    let live = await page.evaluate(() => {
      const line = document.getElementById('arcade-ai-ticker-line');
      return line ? line.textContent.replace(/\s+/g, ' ').trim() : '';
    });
    if (!live) {
      await page.evaluate(() => {
        const selectors = ['#feed-list', '#event-label', '#log-feed', '#aow-wave-num', '#toasts', '#day', '#ev-title', '#r-day', '#qText', '#wave-val', '#lab-sky', '#aow-sky'];
        for (let i = 0; i < selectors.length; i++) {
          const el = document.querySelector(selectors[i]);
          if (el) {
            el.appendChild(document.createTextNode(' scope-mark'));
            return;
          }
        }
      });
      await page.waitForFunction(() => {
        const line = document.getElementById('arcade-ai-ticker-line');
        return line && line.textContent.trim().length > 0;
      }, { timeout: 4000 }).catch(() => {});
      live = await page.evaluate(() => {
        const line = document.getElementById('arcade-ai-ticker-line');
        return line ? line.textContent.replace(/\s+/g, ' ').trim() : '';
      });
    }
    const leak = foreignBank(game.id, live);
    ok(!!live && owns(game.id, live) && !leak,
      game.id + ' ticker is its own line (' + live + ')' + (leak ? ' leaked from ' + leak : ''));
    ok(live.indexOf('The line holds') === -1 && live.indexOf('Reinforcements are on the way') === -1,
      game.id + ' ticker is not the Age of War harness sentence');

    const probe = await page.evaluate(async (id) => {
      const api = window.ArcadeAI;
      const provider = api.createStubProvider();
      const bank = api.callBank(id);
      const types = Object.keys(bank.calls);
      const calls = [];
      for (let i = 0; i < types.length; i++) {
        const type = types[i];
        const res = await provider.announce({ game: id, event: { type: type, detail: 'scope-mark' } });
        calls.push({ type: type, game: res.game, line: res.line, template: bank.calls[type] });
      }
      const odd = await provider.announce({ game: id, event: { type: 'not-a-call', detail: 'scope-mark' } });
      const missingCall = await provider.announce({});
      const unknownCall = await provider.announce({ game: 'not-a-game', event: { type: 'state', detail: 'The line holds. Reinforcements are on the way.' } });
      return {
        calls: calls,
        odd: { game: odd.game, line: odd.line, template: bank.calls.default },
        missing: { game: missingCall.game, line: missingCall.line },
        unknown: { game: unknownCall.game, line: unknownCall.line },
        booth: api.booth.game,
      };
    }, game.id);
    ok(probe.booth === game.id, game.id + ' booth id is ' + probe.booth);
    probe.calls.forEach((call) => {
      ok(call.game === game.id && call.line === fill(call.template, 'scope-mark') && foreignBank(game.id, call.line) === '',
        game.id + ' ' + call.type + ' is ' + call.line);
    });
    ok(probe.odd.game === game.id && probe.odd.line === fill(probe.odd.template, 'scope-mark'),
      game.id + ' page default stays in bank (' + probe.odd.line + ')');
    ok(probe.missing.line === 'Saved.' && probe.missing.game === '' && probe.unknown.line === 'Saved.' && probe.unknown.game === '',
      game.id + ' page refuses a foreign id (' + probe.unknown.line + ')');
    ok(errors.length === 0, game.id + ' page has no errors' + (errors.length ? ': ' + errors[0] : ''));
    await context.close();
  }

  const hub = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const hubPage = await hub.newPage();
  const hubErrors = [];
  hubPage.on('pageerror', (error) => hubErrors.push(String(error)));
  await hubPage.goto(BASE + '/', { waitUntil: 'load', timeout: 30000 });
  await hubPage.waitForFunction(() => window.ArcadeAI && typeof window.ArcadeAI.createStubProvider === 'function', { timeout: 8000 });
  const hubProbe = await hubPage.evaluate(async () => {
    const api = window.ArcadeAI;
    const provider = api.createStubProvider();
    const rows = [];
    const ids = api.games.slice();
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const res = await provider.announce({ game: id, event: { type: 'state', detail: 'scope-mark' } });
      rows.push({ id: id, game: res.game, line: res.line, template: api.callBank(id).calls.state });
    }
    const missingCall = await provider.announce({});
    const unknownCall = await provider.announce({ game: 'ageofwar', event: { type: 'wave', detail: 'should-not-run' } });
    const explicit = unknownCall;
    const blank = await provider.announce({ event: { type: 'wave', detail: 'The line holds. Reinforcements are on the way.' } });
    const host = document.getElementById('arcade-ai-ticker');
    const line = document.getElementById('arcade-ai-ticker-line');
    return {
      rows: rows,
      missing: { game: missingCall.game, line: missingCall.line },
      blank: { game: blank.game, line: blank.line },
      explicitGame: explicit.game,
      explicitLine: explicit.line,
      mounted: !!host,
      ticker: line ? line.textContent.trim() : '',
      booth: api.booth ? api.booth.game : '',
    };
  });
  ok(!hubProbe.mounted && !hubProbe.booth && !hubProbe.ticker, 'the hub does not mount a game announcer');
  hubProbe.rows.forEach((row) => {
    ok(row.game === row.id && row.line === fill(row.template, 'scope-mark') && foreignBank(row.id, row.line) === '',
      'hub ' + row.id + ' state is ' + row.line);
  });
  ok(hubProbe.missing.line === 'Saved.' && hubProbe.blank.line === 'Saved.' && hubProbe.blank.game === '',
    'the hub announcer does not invent a game (' + hubProbe.blank.line + ')');
  ok(hubProbe.explicitGame === 'ageofwar' && explained(AI.callBank('ageofwar'), hubProbe.explicitLine)
    && foreignBank('ageofwar', hubProbe.explicitLine) === '',
    'an explicit ageofwar id on the hub stays on the field bank (' + hubProbe.explicitLine + ')');
  ok(hubErrors.length === 0, 'hub page has no errors' + (hubErrors.length ? ': ' + hubErrors[0] : ''));
  await hub.close();
  await browser.close();

  console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
  process.exit(fail ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
