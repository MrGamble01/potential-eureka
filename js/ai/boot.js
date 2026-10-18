/* Flagship booth. Loaded by persist.js on every page that
   already shares settings. Mounts only on the six games
   (Beagle Sim is Startup Tycoon with ?theme=beagle).
   The page uses the stub. createAiProvider switches to the
   remote adapter only when AI_API_KEY is in an environment,
   which is what api/ai.js does. The page does not call that
   route: the key stays on the server, and a missing route
   would be a console error on the static host. */
(function () {
  if (typeof document === 'undefined' || !window.ArcadeAI) return;
  if (document.getElementById('arcade-ai-root')) return;

  const AI = window.ArcadeAI;

  function detectGame() {
    const path = (location.pathname || '/').replace(/\/+$/, '') || '/';
    const theme = new URLSearchParams(location.search).get('theme');
    if (/\/tycoon\/play(?:\.html)?$/.test(path)) return theme === 'beagle' ? 'beagle' : 'tycoon';
    if (path === '/ageofwar' || /\/ageofwar\/index(?:\.html)?$/.test(path)) return 'ageofwar';
    if (path === '/drug-lab' || path === '/drug-lab.html') return 'growop';
    if (path === '/homeless-village' || path === '/homeless-village.html') return 'homeless';
    if (path === '/hearthvale' || path === '/hearthvale.html') return 'hearthvale';
    if (path === '/voxel-garden' || path === '/voxel-garden.html') return 'voxel';
    return null;
  }

  const gameId = detectGame();
  if (!gameId) return;

  const meta = AI.describe(gameId);
  const people = AI.npcs(gameId);
  const stub = AI.createStubProvider();
  let provider = stub;
  let turn = 0;
  const calls = [];
  let mapDrawn = false;
  let talked = false;

  const ACCENTS = {
    ageofwar: '#f0c14a',
    tycoon: '#7eb6ff',
    beagle: '#e0b07a',
    growop: '#5dcc72',
    homeless: '#f0a05a',
    hearthvale: '#8fbf6a',
    voxel: '#8fd0ff',
  };

  const WATCH = {
    ageofwar: [
      { sel: '#aow-wave-num', type: 'wave' },
      { sel: '#aow-overlay', type: 'banner' },
      { sel: '#aow-era-name', type: 'era' },
      { sel: '#aow-sky', type: 'weather' },
    ],
    tycoon: [
      { sel: '#feed-list', type: 'feed' },
      { sel: '#event-label', type: 'event' },
    ],
    beagle: [
      { sel: '#feed-list', type: 'feed' },
      { sel: '#event-label', type: 'event' },
    ],
    growop: [
      { sel: '#feed-list', type: 'feed' },
      { sel: '#ev-title', type: 'event' },
      { sel: '#wave-val', type: 'crackdown' },
      { sel: '#lab-sky', type: 'weather' },
    ],
    homeless: [
      { sel: '#log-feed', type: 'log' },
      { sel: '#ev-title', type: 'event' },
      { sel: '#days-counter', type: 'day' },
    ],
    hearthvale: [
      { sel: '#toasts', type: 'toast' },
      { sel: '#ev-title', type: 'event' },
      { sel: '#r-day', type: 'day' },
    ],
    voxel: [
      { sel: '#toasts', type: 'toast' },
      { sel: '#day', type: 'day' },
      { sel: '#qText', type: 'goal' },
    ],
  };

  function textOf(sel) {
    const el = document.querySelector(sel);
    if (!el) return '';
    return (el.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function scrape() {
    switch (gameId) {
      case 'ageofwar':
        return { era: textOf('#aow-era-name'), wave: textOf('#aow-wave-num'), gold: textOf('#aow-gold'), base: textOf('#aow-base-hp') };
      case 'tycoon':
      case 'beagle':
        return { cash: textOf('#cash-val'), status: textOf('#session-chip') };
      case 'growop':
        return { cash: textOf('#cash-val'), heat: textOf('#heat-val'), goal: textOf('#goal-text') };
      case 'homeless':
        return { food: textOf('#stat-food'), days: textOf('#days-counter'), warmth: textOf('#stat-warmth'), scraps: textOf('#stat-scraps') };
      case 'hearthvale':
        return { day: textOf('#r-day'), food: textOf('#r-food'), wood: textOf('#r-wood'), gold: textOf('#r-gold'), pop: textOf('#r-pop') };
      case 'voxel':
        return { day: textOf('#day'), coins: textOf('#coins'), goal: textOf('#qText') };
      default:
        return {};
    }
  }

  const style = document.createElement('style');
  style.textContent = [
    '#arcade-ai-root{position:fixed;z-index:1200;left:8px;top:var(--hud-top-safe,8px)}',
    '#arcade-ai-launch{font:600 12px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.12em;text-transform:uppercase;',
    'color:#f6f1e6;background:rgba(10,12,16,.9);border:1px solid var(--ai-accent,#e0c9a0);border-radius:999px;',
    'padding:8px 12px;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.35)}',
    '#arcade-ai-launch:focus-visible{outline:2px solid var(--ai-accent,#e0c9a0);outline-offset:2px}',
    '#arcade-ai-launch[aria-expanded="true"]{background:#17140f}',
    '#arcade-ai-ticker{position:fixed;z-index:1190;left:50%;bottom:calc(var(--hud-bottom-safe,18px) + 8px);transform:translateX(-50%);max-width:min(440px,calc(100vw - 24px));',
    'pointer-events:none;background:rgba(8,10,14,.88);color:#f6f1e6;border:1px solid rgba(255,255,255,.16);',
    'border-left:3px solid var(--ai-accent,#e0c9a0);border-radius:10px;padding:8px 36px 8px 12px;font:13px/1.35 Georgia,Palatino,serif;',
    'box-shadow:0 10px 28px rgba(0,0,0,.35)}',
    '#arcade-ai-ticker[hidden]{display:none}',
    '#arcade-ai-ticker b{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;display:block;margin-bottom:2px;color:var(--ai-accent,#e0c9a0)}',
    '#arcade-ai-ticker-line{display:block;pointer-events:none}',
    '#arcade-ai-ticker *{pointer-events:none}',
    '#arcade-ai-ticker #arcade-ai-ticker-close{position:absolute;top:6px;right:6px;pointer-events:auto;width:28px;height:28px;padding:0;',
    'background:transparent;color:#f6f1e6;border:1px solid rgba(255,255,255,.28);border-radius:8px;cursor:pointer;',
    'font:16px/1 ui-monospace,SFMono-Regular,Menlo,monospace}',
    '#arcade-ai-panel{position:fixed;z-index:7000;top:52px;right:12px;width:min(400px,calc(100vw - 24px));',
    'max-height:min(580px,calc(100vh - 68px));overflow:auto;background:rgba(10,12,16,.96);color:#f4efe6;',
    'border:1px solid rgba(255,255,255,.14);border-radius:16px;box-shadow:0 22px 60px rgba(0,0,0,.5);padding:12px 12px 14px;',
    'font:14px/1.45 Georgia,Palatino,serif}',
    '#arcade-ai-panel[hidden]{display:none}',
    '#arcade-ai-head{display:flex;align-items:baseline;gap:8px;margin-bottom:8px}',
    '#arcade-ai-head strong{font-family:ui-monospace,Menlo,monospace;font-size:13px;letter-spacing:.04em}',
    '#arcade-ai-badge{font-family:ui-monospace,Menlo,monospace;font-size:10px;letter-spacing:.06em;',
    'color:#1a140c;background:var(--ai-accent,#e0c9a0);border-radius:999px;padding:2px 7px}',
    '#arcade-ai-close{margin-left:auto;background:transparent;color:#f4efe6;border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:2px 8px;cursor:pointer}',
    '#arcade-ai-tabs{display:flex;gap:6px;margin-bottom:10px}',
    '#arcade-ai-tabs button{flex:1;background:rgba(255,255,255,.04);color:#f4efe6;border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:6px 8px;cursor:pointer;font:600 12px/1 ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase}',
    '#arcade-ai-tabs button[aria-selected="true"]{background:var(--ai-accent,#e0c9a0);color:#1a140c;border-color:transparent}',
    '.ai-pane[hidden]{display:none}',
    '#arcade-ai-people{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}',
    '#arcade-ai-people button{background:rgba(255,255,255,.04);color:#f4efe6;border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:5px 10px;cursor:pointer;font:13px/1.2 Georgia,serif}',
    '#arcade-ai-people button[aria-pressed="true"]{border-color:var(--ai-accent,#e0c9a0)}',
    '#arcade-ai-line{margin:0;padding:10px 12px;background:rgba(255,255,255,.04);border-radius:12px;border-left:3px solid var(--ai-accent,#e0c9a0)}',
    '#arcade-ai-who{font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--ai-accent,#e0c9a0);margin-bottom:4px}',
    '#arcade-ai-map-form{display:grid;grid-template-columns:64px 1fr;gap:6px 8px;align-items:center;margin-bottom:8px}',
    '#arcade-ai-map-form label{font-family:ui-monospace,Menlo,monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#c9bfae}',
    '#arcade-ai-map-form input{background:#0c0e12;color:#f4efe6;border:1px solid rgba(255,255,255,.16);border-radius:8px;padding:6px 8px;font:13px/1.3 ui-monospace,Menlo,monospace;min-width:0}',
    '#arcade-ai-generate{grid-column:1 / -1;justify-self:start;background:var(--ai-accent,#e0c9a0);color:#1a140c;border:0;border-radius:999px;padding:7px 12px;cursor:pointer;font:600 12px/1 ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase}',
    '#arcade-ai-canvas{display:block;width:min(100%,240px);height:auto;border-radius:8px;image-rendering:pixelated;background:#111}',
    '#arcade-ai-map-title{margin:8px 0 2px;font-size:16px}',
    '#arcade-ai-map-summary{margin:0 0 8px;color:#ddd4c6}',
    '#arcade-ai-legend{display:flex;flex-wrap:wrap;gap:6px 10px;font:11px/1.2 ui-monospace,Menlo,monospace}',
    '#arcade-ai-legend i{display:inline-block;width:10px;height:10px;margin-right:4px;vertical-align:-1px;border-radius:2px}',
    '#arcade-ai-calls{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}',
    '#arcade-ai-calls li{padding:8px 10px;background:rgba(255,255,255,.04);border-radius:10px}',
    '#arcade-ai-empty{color:#c9bfae;margin:0}',
  ].join('');
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'arcade-ai-root';
  root.style.setProperty('--ai-accent', ACCENTS[gameId] || '#e0c9a0');
  root.innerHTML = '<button type="button" id="arcade-ai-launch" aria-expanded="false" aria-controls="arcade-ai-panel" title="Talk, a generated map, and the announcer">Booth</button>';
  document.body.appendChild(root);

  const ticker = document.createElement('div');
  ticker.id = 'arcade-ai-ticker';
  ticker.hidden = true;
  ticker.setAttribute('role', 'status');
  ticker.setAttribute('aria-live', 'polite');
  ticker.innerHTML = '<b>Announcer</b><span id="arcade-ai-ticker-line"></span><button type="button" id="arcade-ai-ticker-close" aria-label="Dismiss announcement">\u00d7</button>';
  document.body.appendChild(ticker);
  const tickerLine = ticker.querySelector('#arcade-ai-ticker-line');
  let tickerTimer = 0;

  function dismissTicker() {
    ticker.hidden = true;
    if (tickerTimer) {
      clearTimeout(tickerTimer);
      tickerTimer = 0;
    }
  }

  ticker.querySelector('#arcade-ai-ticker-close').addEventListener('click', dismissTicker);

  const panel = document.createElement('div');
  panel.id = 'arcade-ai-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', meta.label + ' booth');
  panel.style.setProperty('--ai-accent', ACCENTS[gameId] || '#e0c9a0');
  panel.innerHTML = [
    '<div id="arcade-ai-head"><strong></strong><span id="arcade-ai-badge">offline stub</span>',
    '<button type="button" id="arcade-ai-close">Close</button></div>',
    '<div id="arcade-ai-tabs" role="tablist">',
    '<button type="button" id="arcade-ai-tab-talk" role="tab" aria-selected="true" aria-controls="arcade-ai-talk">Talk</button>',
    '<button type="button" id="arcade-ai-tab-map" role="tab" aria-selected="false" aria-controls="arcade-ai-map">Map</button>',
    '<button type="button" id="arcade-ai-tab-calls" role="tab" aria-selected="false" aria-controls="arcade-ai-calls-pane">Calls</button>',
    '</div>',
    '<section class="ai-pane" id="arcade-ai-talk" role="tabpanel">',
    '<div id="arcade-ai-people"></div>',
    '<div id="arcade-ai-who"></div>',
    '<p id="arcade-ai-line">Choose someone. The line comes from the booth, using what is on the board right now.</p>',
    '</section>',
    '<section class="ai-pane" id="arcade-ai-map" role="tabpanel" hidden>',
    '<form id="arcade-ai-map-form">',
    '<label for="arcade-ai-seed">Seed</label>',
    '<input id="arcade-ai-seed" name="seed" autocomplete="off" maxlength="80">',
    '<label for="arcade-ai-prompt">Prompt</label>',
    '<input id="arcade-ai-prompt" name="prompt" autocomplete="off" maxlength="160" placeholder="river, orchard, a quiet shore">',
    '<button type="submit" id="arcade-ai-generate">Generate</button>',
    '</form>',
    '<canvas id="arcade-ai-canvas" width="192" height="128" aria-label="Generated layout"></canvas>',
    '<h2 id="arcade-ai-map-title"></h2>',
    '<p id="arcade-ai-map-summary"></p>',
    '<div id="arcade-ai-legend"></div>',
    '</section>',
    '<section class="ai-pane" id="arcade-ai-calls-pane" role="tabpanel" hidden>',
    '<p id="arcade-ai-empty">No calls yet.</p>',
    '<ul id="arcade-ai-calls"></ul>',
    '</section>',
  ].join('');
  document.body.appendChild(panel);
  panel.querySelector('#arcade-ai-head strong').textContent = meta.label;

  const peopleBox = panel.querySelector('#arcade-ai-people');
  people.forEach((person, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.npc = person.id;
    btn.setAttribute('aria-pressed', 'false');
    btn.textContent = person.icon + ' ' + person.name;
    btn.title = person.role;
    btn.addEventListener('click', function () { speak(person.id); });
    peopleBox.appendChild(btn);
    if (i === 0) btn.dataset.first = '1';
  });

  const SEEDS = {
    ageofwar: 'ridge-4',
    tycoon: 'floor-2',
    beagle: 'yard-1',
    growop: 'lamp-6',
    homeless: 'span-3',
    hearthvale: 'hearth-7',
    voxel: 'cove-5',
  };
  const PROMPTS = {
    ageofwar: 'mud trench and a banner',
    tycoon: 'server row and a kitchen',
    beagle: 'yard, bones, and a long nap',
    growop: 'lamps, vents, and a locked safe',
    homeless: 'tents by the barrel',
    hearthvale: 'foggy river and orchards',
    voxel: 'a sandy cove and high grass',
  };
  panel.querySelector('#arcade-ai-seed').value = SEEDS[gameId];
  panel.querySelector('#arcade-ai-prompt').value = PROMPTS[gameId];

  function showTab(name) {
    const panes = { talk: 'arcade-ai-talk', map: 'arcade-ai-map', calls: 'arcade-ai-calls-pane' };
    Object.keys(panes).forEach((tab) => {
      const on = tab === name;
      document.getElementById('arcade-ai-tab-' + tab).setAttribute('aria-selected', on ? 'true' : 'false');
      document.getElementById(panes[tab]).hidden = !on;
    });
    if (name === 'talk' && !talked && people[0]) speak(people[0].id);
    if (name === 'map' && !mapDrawn) generate();
  }

  function openPanel(tab) {
    panel.hidden = false;
    document.getElementById('arcade-ai-launch').setAttribute('aria-expanded', 'true');
    showTab(tab || 'talk');
  }

  function closePanel() {
    panel.hidden = true;
    document.getElementById('arcade-ai-launch').setAttribute('aria-expanded', 'false');
  }

  document.getElementById('arcade-ai-launch').addEventListener('click', function () {
    if (panel.hidden) openPanel('talk');
    else closePanel();
  });
  document.getElementById('arcade-ai-close').addEventListener('click', closePanel);
  document.getElementById('arcade-ai-tab-talk').addEventListener('click', function () { showTab('talk'); });
  document.getElementById('arcade-ai-tab-map').addEventListener('click', function () { showTab('map'); });
  document.getElementById('arcade-ai-tab-calls').addEventListener('click', function () { showTab('calls'); });
  panel.querySelector('#arcade-ai-map-form').addEventListener('submit', function (e) {
    e.preventDefault();
    generate();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !panel.hidden) {
      e.preventDefault();
      e.stopPropagation();
      closePanel();
    }
  }, true);

  function renderCalls() {
    const list = document.getElementById('arcade-ai-calls');
    const empty = document.getElementById('arcade-ai-empty');
    list.textContent = '';
    empty.hidden = calls.length > 0;
    calls.forEach((call) => {
      const li = document.createElement('li');
      li.textContent = call.line;
      list.appendChild(li);
    });
  }

  function pushCall(result) {
    if (!result || !result.line) return;
    calls.unshift(result);
    if (calls.length > 8) calls.pop();
    renderCalls();
    tickerLine.textContent = result.line;
    ticker.dataset.shownAt = String(Date.now());
    ticker.hidden = false;
    placeTicker();
    if (tickerTimer) clearTimeout(tickerTimer);
    tickerTimer = setTimeout(dismissTicker, 4000);
  }

  function speak(npcId) {
    talked = true;
    peopleBox.querySelectorAll('button').forEach((btn) => {
      btn.setAttribute('aria-pressed', btn.dataset.npc === npcId ? 'true' : 'false');
    });
    const req = { game: gameId, npcId: npcId, context: scrape(), turn: turn };
    turn += 1;
    provider.talk(req).then((result) => {
      document.getElementById('arcade-ai-who').textContent = result.name + ' · ' + result.role + ' · ' + result.mood;
      document.getElementById('arcade-ai-line').textContent = result.line;
    }).catch(function () { /* the provider already falls back; ignore a double fault */ });
  }

  function drawMap(map) {
    const canvas = document.getElementById('arcade-ai-canvas');
    const cell = 16;
    canvas.width = map.width * cell;
    canvas.height = map.height * cell;
    const ctx = canvas.getContext('2d');
    const color = {};
    map.legend.forEach((item) => { color[item.id] = item.color; });
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        ctx.fillStyle = color[map.tiles[y][x]] || '#333';
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    document.getElementById('arcade-ai-map-title').textContent = map.title;
    document.getElementById('arcade-ai-map-summary').textContent = map.summary;
    const legend = document.getElementById('arcade-ai-legend');
    legend.textContent = '';
    map.legend.forEach((item) => {
      const span = document.createElement('span');
      const swatch = document.createElement('i');
      swatch.style.background = item.color;
      span.appendChild(swatch);
      span.appendChild(document.createTextNode(item.label));
      legend.appendChild(span);
    });
    canvas.setAttribute('aria-label', map.title + '. ' + map.summary);
  }

  function generate() {
    mapDrawn = true;
    const req = {
      game: gameId,
      seed: document.getElementById('arcade-ai-seed').value,
      prompt: document.getElementById('arcade-ai-prompt').value,
    };
    provider.generateMap(req).then((map) => {
      drawMap(map);
      window.ArcadeAI.lastMap = map;
      try {
        document.dispatchEvent(new CustomEvent('arcade-ai-map', { detail: map }));
      } catch (e) { /* events are a courtesy */ }
    }).catch(function () {});
  }

  function safePx(name, fallback) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  }

  function shownBox(el) {
    if (!el) return null;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    if (r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) return null;
    if (r.height > innerHeight * 0.7 && r.width > innerWidth * 0.7) return null;
    return r;
  }

  function overlapsRect(box, rect, pad) {
    return !(box.right + pad <= rect.left || box.left >= rect.right + pad || box.bottom + pad <= rect.top || box.top >= rect.bottom + pad);
  }

  function miniRect() {
    return shownBox(document.getElementById('minimap'));
  }

  function readSafeBand(height) {
    if (window.HudSafe && typeof window.HudSafe.apply === 'function') window.HudSafe.apply();
    let topSafe = Math.max(8, safePx('--hud-top-safe', 8));
    const bottomSafe = Math.max(8, safePx('--hud-bottom-safe', 18));
    let maxBottom = innerHeight - bottomSafe;
    if (topSafe + height + 8 > maxBottom) {
      const slack = topSafe + height + 8 - maxBottom;
      topSafe = Math.max(8, topSafe - Math.ceil(slack / 2));
      maxBottom = Math.min(innerHeight - 8, maxBottom + Math.ceil(slack / 2));
    }
    return { topSafe: topSafe, bottomSafe: bottomSafe, maxBottom: maxBottom };
  }

  // Sit the announcer in the shared bottom band, and never on a build
  // or action bar. The inline offset wins over the stylesheet, so the
  // measured bar and --hud-bottom-safe both have to be honored here.
  function placeTicker() {
    const band = readSafeBand(48);
    const bars = document.querySelectorAll('#buildbar, #buildtabs, #hotbar, #buildBar, #lab-tray, .aow-actionbar, .aow-tabs, #aow-spawn-list, #bottom-bar, #next-action-card');
    let top = Infinity;
    let barHeight = 0;
    let safe = 0;
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;left:0;bottom:0;padding-bottom:env(safe-area-inset-bottom);visibility:hidden;pointer-events:none';
    document.body.appendChild(probe);
    safe = parseFloat(getComputedStyle(probe).paddingBottom) || 0;
    probe.remove();
    bars.forEach((el) => {
      if (el.hidden) return;
      const r = shownBox(el);
      if (!r || r.top < innerHeight * 0.45) return;
      if (r.top < top) {
        top = r.top;
        barHeight = r.height;
      }
    });
    let offset = band.bottomSafe;
    if (top < Infinity) {
      offset = Math.max(offset, barHeight + safe + 8, innerHeight - top + 8);
    }
    ticker.style.bottom = offset + 'px';
    if (window.HudSafe && typeof window.HudSafe.liftToasts === 'function') window.HudSafe.liftToasts();
  }

  function place() {
    if (!panel.hidden) return;
    const launch = document.getElementById('arcade-ai-launch');
    const width = Math.ceil(launch.offsetWidth || 92);
    const height = Math.ceil(launch.offsetHeight || 34);
    const band = readSafeBand(height);
    const topSafe = band.topSafe;
    const maxBottom = band.maxBottom;
    const blockers = [];
    document.querySelectorAll('button, a, input, select, [role="button"], #hud, #top-bar, #topbar, #status-bar, #cash-hud, #metrics-hud, #goal-hud, #heat-hud, #goals, #back, #lab-tray, #vox-tray, #bottom-bar, #left-panel, #next-action-card, #bgl-yard, .aow-topbar, #aow-topbar, .aow-battle-strip, .aow-actionbar, .aow-tabs, .aow-spawn-list, #minimap, #zoom-ctl, #buildbar, #buildtabs, #menu, #panel, #speedctl, #vale-talk').forEach((el) => {
      if (root.contains(el) || panel.contains(el) || ticker.contains(el)) return;
      const r = shownBox(el);
      if (r) blockers.push(r);
    });
    const mini = miniRect();
    function overlapArea(x, y) {
      const box = { left: x, top: y, right: x + width, bottom: y + height };
      if (box.left < 4 || box.top < topSafe - 1 || box.right > innerWidth - 4 || box.bottom > maxBottom + 1) return Infinity;
      if (mini && overlapsRect(box, mini, 8)) return Infinity;
      let area = 0;
      for (let i = 0; i < blockers.length; i++) {
        const b = blockers[i];
        const pad = 6;
        const w = Math.min(box.right + pad, b.right) - Math.max(box.left - pad, b.left);
        const h = Math.min(box.bottom + pad, b.bottom) - Math.max(box.top - pad, b.top);
        if (w > 0 && h > 0) area += w * h;
      }
      return area;
    }
    const spots = [];
    const back = document.querySelector('.ea-back');
    if (back) {
      const r = back.getBoundingClientRect();
      if (r.width > 2 && r.right > 0 && r.left < innerWidth) {
        spots.push({ x: Math.round(r.right + 10), y: Math.round(Math.max(topSafe, r.top)) });
      }
    }
    spots.push({ x: 8, y: Math.round(topSafe) });
    spots.push({ x: Math.max(8, innerWidth - width - 8), y: Math.round(topSafe) });
    spots.push({ x: 8, y: Math.round(topSafe + 56) });
    spots.push({ x: Math.max(8, innerWidth - width - 8), y: Math.round(topSafe + 64) });
    for (let y = Math.round(topSafe); y < maxBottom - height; y += 28) {
      spots.push({ x: 8, y: y });
      spots.push({ x: Math.max(8, innerWidth - width - 8), y: y });
    }
    let chosen = null;
    let best = Infinity;
    for (let i = 0; i < spots.length; i++) {
      const area = overlapArea(spots[i].x, spots[i].y);
      if (area < best) {
        best = area;
        chosen = spots[i];
        if (area === 0) break;
      }
    }
    if ((!chosen || best === Infinity) && mini) {
      const beside = { x: Math.round(Math.min(innerWidth - width - 8, Math.max(8, mini.right + 10))), y: Math.round(Math.max(topSafe, mini.top)) };
      const below = { x: Math.round(Math.max(8, mini.left)), y: Math.round(Math.min(maxBottom - height, Math.max(topSafe, mini.bottom + 10))) };
      const besideArea = overlapArea(beside.x, beside.y);
      const belowArea = overlapArea(below.x, below.y);
      if (besideArea === 0) chosen = beside;
      else if (belowArea === 0) chosen = below;
      else if (besideArea < belowArea) chosen = beside;
      else chosen = below;
    }
    if (!chosen) {
      chosen = { x: Math.max(8, innerWidth - width - 8), y: Math.max(topSafe, Math.min(maxBottom - height, innerHeight - height - 16)) };
      if (mini && overlapsRect({ left: chosen.x, top: chosen.y, right: chosen.x + width, bottom: chosen.y + height }, mini, 8)) {
        chosen.x = Math.round(Math.min(innerWidth - width - 8, Math.max(8, mini.right + 10)));
        if (overlapsRect({ left: chosen.x, top: chosen.y, right: chosen.x + width, bottom: chosen.y + height }, mini, 8)) {
          chosen.y = Math.round(Math.min(maxBottom - height, Math.max(topSafe, mini.bottom + 10)));
        }
      }
    }
    root.style.left = chosen.x + 'px';
    root.style.top = chosen.y + 'px';
  }

  const watched = new WeakSet();

  function watch() {
    const specs = WATCH[gameId] || [];
    let lastAt = 0;
    specs.forEach((spec) => {
      const el = document.querySelector(spec.sel);
      if (!el || watched.has(el)) return;
      watched.add(el);
      let seen = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160);
      const obs = new MutationObserver(function () {
        const next = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160);
        if (!next || next === seen) return;
        seen = next;
        const now = Date.now();
        if (now - lastAt < 7000) return;
        lastAt = now;
        provider.announce({ game: gameId, event: { type: spec.type, detail: next } }).then(pushCall).catch(function () {});
      });
      obs.observe(el, { childList: true, subtree: true, characterData: true });
    });
  }

  function openingCall() {
    const c = scrape();
    const bit = function (value, suffix) {
      if (value == null || String(value).trim() === '') return '';
      return String(value).trim() + (suffix || '');
    };
    let detail = '';
    if (gameId === 'ageofwar') detail = [c.era, c.wave, bit(c.gold, ' gold'), c.base ? ('base ' + c.base) : ''].filter(Boolean).join(', ');
    else if (gameId === 'tycoon') detail = [bit(c.cash, ' cash'), c.status].filter(Boolean).join(', ');
    else if (gameId === 'beagle') detail = [bit(c.cash, ' in the bowl fund'), c.status].filter(Boolean).join(', ');
    else if (gameId === 'growop') detail = [bit(c.cash, ' cash'), bit(c.heat, ' heat'), c.goal].filter(Boolean).join(', ');
    else if (gameId === 'homeless') detail = [c.days, bit(c.food, ' food'), bit(c.warmth, ' warmth')].filter(Boolean).join(', ');
    else if (gameId === 'hearthvale') detail = [bit(c.day, '' ) && ('Day ' + c.day), bit(c.food, ' food'), bit(c.wood, ' wood'), bit(c.pop, ' villagers')].filter(Boolean).join(', ');
    else if (gameId === 'voxel') detail = [c.day ? ('Day ' + c.day) : '', bit(c.coins, ' coins'), c.goal].filter(Boolean).join(', ');
    if (!detail) return;
    provider.announce({ game: gameId, event: { type: 'state', detail: detail } }).then(pushCall).catch(function () {});
  }

  function layoutChrome() {
    place();
    placeTicker();
  }
  layoutChrome();
  setTimeout(layoutChrome, 400);
  setTimeout(layoutChrome, 1400);
  setTimeout(layoutChrome, 2800);
  window.addEventListener('resize', layoutChrome);
  let ro = null;
  if (window.ResizeObserver) {
    ro = new ResizeObserver(layoutChrome);
    ['#minimap', '#buildbar', '#buildtabs', '#hotbar', '#lab-tray', '#hud', '#topbar', '#bgl-yard', '.aow-actionbar', '#aow-spawn-list', '#next-action-card', '#metrics-hud', '#bottom-bar'].forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) ro.observe(el);
    });
  }
  const lateChrome = new WeakSet();
  const watchLate = new MutationObserver(() => {
    const yard = document.getElementById('bgl-yard');
    if (!yard || lateChrome.has(yard)) return;
    lateChrome.add(yard);
    if (ro) ro.observe(yard);
    layoutChrome();
  });
  watchLate.observe(document.body, { childList: true, subtree: true });
  setTimeout(watch, 600);
  setTimeout(openingCall, 700);

  const requested = new URLSearchParams(location.search).get('booth');
  if (requested === 'talk' || requested === 'map' || requested === 'calls') openPanel(requested);

  window.ArcadeAI.booth = {
    game: gameId,
    open: openPanel,
    close: closePanel,
    scrape: scrape,
    talk: function (npcId, turn) {
      return provider.talk({ game: gameId, npcId: npcId, context: scrape(), turn: turn || 0 });
    },
  };

  if (gameId === 'ageofwar' || gameId === 'homeless') {
    const world = document.createElement('script');
    world.src = '/js/ai/inworld.js';
    world.async = false;
    world.setAttribute('data-arcade-ai', 'inworld');
    document.head.appendChild(world);
  }
})();
