/* ============================================
   FLAGSHIP DAILY — one seeded sprint a day.
   The calendar picks Startup Tycoon or
   Homeless Village. Everyone who
   plays that date gets the same board, goal
   and clock. Best score, history and streak
   stay in this browser (eureka-flag-daily-v1).

   The quick-arcade daily (js/daily.js) is a
   different banner and a different key.
   ============================================ */

(function (root) {
  const KEY = 'eureka-flag-daily-v1';
  const ALL_GAMES = [
    {
      id: 'tycoon',
      name: 'Startup Tycoon',
      href: '/tycoon/play.html?daily=1',
      accent: '#58A6FF',
      unit: '$',
      title: 'Ship Sprint',
      blurb: 'Ship the clean builds. A bug on the board costs the hand.',
      good: ['📦', '🚀', '💻'],
      trap: '🐛',
      trapName: 'bug',
    },
    {
      id: 'hearthvale',
      name: 'Hearthvale',
      href: '/hearthvale.html?daily=1',
      accent: '#7DCE7A',
      unit: '',
      title: 'Market Morning',
      blurb: 'Sell the morning stall. Wolves take the coin.',
      good: ['🍎', '🪵', '🪨'],
      trap: '🐺',
      trapName: 'wolf',
    },
    {
      id: 'clinic',
      name: 'Night Clinic',
      href: '/homeless-village.html?daily=1',
      accent: '#F07178',
      unit: '',
      title: 'Tarp Shift',
      blurb: 'Dress the waiting wounds. A sweep takes the hand.',
      good: ['🩹', '💊', '❤️'],
      trap: '🚓',
      trapName: 'sweep',
    },
  ];
  const FALLBACK_SHOWCASE = { tycoon: 1, hearthvale: 1 };
  const GAMES = ALL_GAMES.filter(function (g) {
    if (root && root.HubRoutes && typeof root.HubRoutes.isShowcase === 'function') {
      return root.HubRoutes.isShowcase(g.id);
    }
    return !!FALLBACK_SHOWCASE[g.id];
  });
  const BY_ID = {};
  for (let i = 0; i < ALL_GAMES.length; i++) BY_ID[ALL_GAMES[i].id] = ALL_GAMES[i];

  function pad(n) { return String(n).padStart(2, '0'); }

  function todayKey(d) {
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    const dt = d instanceof Date ? d : new Date();
    return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
  }

  function prevDate(key) {
    const parts = todayKey(key).split('-').map(Number);
    const dt = new Date(parts[0], parts[1] - 1, parts[2]);
    dt.setDate(dt.getDate() - 1);
    return todayKey(dt);
  }

  function hashStr(s) {
    let h = 1779033703 ^ s.length;
    for (let i = 0; i < s.length; i++) {
      h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
      h = h << 13 | h >>> 19;
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    let t = a >>> 0;
    return function () {
      t = t + 0x6D2B79F5 | 0;
      let r = Math.imul(t ^ t >>> 15, 1 | t);
      r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r;
      return ((r ^ r >>> 14) >>> 0) / 4294967296;
    };
  }

  function challengeFor(dateStr) {
    const date = todayKey(dateStr || new Date());
    const seed = hashStr('flagship:' + date);
    const rng = mulberry32(seed);
    const game = GAMES[Math.floor(rng() * GAMES.length)];
    const seconds = [36, 42, 48][Math.floor(rng() * 3)];
    const goal = 450 + Math.floor(rng() * 8) * 50;
    const tiles = [];
    for (let i = 0; i < 180; i++) {
      const trap = rng() < 0.2;
      const value = (trap ? 60 : 40) + Math.floor(rng() * 5) * (trap ? 20 : 15);
      const face = trap ? game.trap : game.good[Math.floor(rng() * game.good.length)];
      tiles.push({ trap: trap, value: value, face: face });
    }
    return { date: date, seed: seed, game: game, seconds: seconds, goal: goal, tiles: tiles };
  }

  function load() {
    const empty = { v: 1, days: {} };
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!raw || typeof raw !== 'object' || !raw.days || typeof raw.days !== 'object' || Array.isArray(raw.days)) {
        return empty;
      }
      return { v: 1, days: raw.days };
    } catch (e) { return empty; }
  }

  function save(data) {
    try { localStorage.setItem(KEY, JSON.stringify({ v: 1, days: data.days || {} })); }
    catch (e) { /* private mode */ }
  }

  function computeStreak(days, fromDate) {
    let n = 0;
    let cursor = todayKey(fromDate);
    while (days[cursor] && days[cursor].met) {
      n += 1;
      cursor = prevDate(cursor);
      if (n > 400) break;
    }
    return n;
  }

  function liveStreak(days, date) {
    const key = todayKey(date);
    if (days[key]) return days[key].met ? computeStreak(days, key) : 0;
    return computeStreak(days, prevDate(key));
  }

  function historyList(data, date) {
    const out = [];
    let cursor = todayKey(date);
    for (let i = 0; i < 7; i++) {
      const row = data.days[cursor];
      out.push({
        date: cursor,
        game: row && row.game || '',
        best: row && typeof row.best === 'number' ? row.best : null,
        met: !!(row && row.met),
        played: !!row,
      });
      cursor = prevDate(cursor);
    }
    return out;
  }

  function record(opts) {
    const o = opts || {};
    const date = todayKey(o.date || new Date());
    const score = Math.max(0, Math.floor(Number(o.score) || 0));
    const goal = Math.max(1, Math.floor(Number(o.goal) || 1));
    const game = BY_ID[o.game] ? o.game : (GAMES[0].id);
    const data = load();
    const prev = data.days[date];
    const met = score >= goal || !!(prev && prev.met);
    const prevBest = prev && typeof prev.best === 'number' ? prev.best : 0;
    const best = Math.max(score, prevBest);
    data.days[date] = {
      game: game,
      best: best,
      last: score,
      goal: goal,
      met: met,
      plays: (prev && prev.plays || 0) + 1,
    };
    const keys = Object.keys(data.days).sort();
    while (keys.length > 21) delete data.days[keys.shift()];
    save(data);
    if (met && !(prev && prev.met)) {
      try {
        if (root.EurekaCosmetics && root.EurekaCosmetics.grantDaily) root.EurekaCosmetics.grantDaily('flag', date);
      } catch (e) { /* a spark purse cannot blank the daily */ }
    }
    return {
      date: date,
      best: best,
      last: score,
      met: met,
      streak: liveStreak(data.days, date),
      improved: !prev || score > prevBest,
      plays: data.days[date].plays,
      history: historyList(data, date),
    };
  }

  function snapshot(date) {
    const key = todayKey(date || new Date());
    const data = load();
    const row = data.days[key];
    return {
      date: key,
      best: row && typeof row.best === 'number' ? row.best : 0,
      met: !!(row && row.met),
      played: !!row,
      streak: liveStreak(data.days, key),
      atRisk: !row && liveStreak(data.days, key) > 0,
      history: historyList(data, key),
    };
  }

  function seedLabel(seed) {
    return (seed >>> 0).toString(16).toUpperCase().padStart(8, '0');
  }

  function clock(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    return Math.floor(s / 60) + ':' + pad(s % 60);
  }

  function goalLine(spec) {
    const unit = spec.game.unit === '$' ? '$' : '';
    return spec.game.title + ' · reach ' + unit + spec.goal + ' in ' + clock(spec.seconds);
  }

  function streakLine(snap) {
    if (snap.played && snap.met) return 'Streak ' + snap.streak;
    if (snap.played && !snap.met) return 'Streak broken';
    if (snap.atRisk) return 'Streak ' + snap.streak + ' · play to keep it';
    return 'Streak ' + snap.streak;
  }

  function pageGame() {
    const path = (root.location && root.location.pathname) || '';
    const q = new URLSearchParams((root.location && root.location.search) || '');
    if (/hearthvale\.html$/.test(path) || /\/hearthvale\/?$/.test(path)) return 'hearthvale';
    if (/drug-lab\.html$/.test(path) || /\/drug-lab\/?$/.test(path)) return 'growop';
    if (/homeless-village\.html$/.test(path) || /\/homeless-village\/?$/.test(path)) return 'clinic';
    if (/\/tycoon\/play\.html$/.test(path) || /\/tycoon\/play\/?$/.test(path)) {
      return q.get('theme') === 'beagle' ? 'beagle' : 'tycoon';
    }
    return null;
  }

  function asof() {
    try {
      const v = new URLSearchParams(root.location.search).get('asof');
      return /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null;
    } catch (e) { return null; }
  }

  function activeDate() { return asof() || todayKey(new Date()); }

  function hrefFor(game, date) {
    const base = game.href;
    if (!asof() && (!date || date === todayKey(new Date()))) return base;
    const join = base.indexOf('?') >= 0 ? '&' : '?';
    return base + join + 'asof=' + encodeURIComponent(date || activeDate());
  }

  function paintHub() {
    const rootEl = document.getElementById('flag-daily');
    if (!rootEl) return;
    const date = todayKey(new Date());
    const spec = challengeFor(date);
    const snap = snapshot(date);
    rootEl.style.setProperty('--fd-accent', spec.game.accent);
    rootEl.dataset.game = spec.game.id;
    rootEl.dataset.seed = String(spec.seed);
    rootEl.innerHTML = '';

    const top = document.createElement('div');
    top.className = 'flag-daily-top';
    const kicker = document.createElement('span');
    kicker.className = 'flag-daily-kicker';
    kicker.textContent = 'FLAGSHIP DAILY';
    const meta = document.createElement('span');
    meta.className = 'flag-daily-date';
    meta.id = 'flag-daily-date';
    meta.textContent = date + ' · seed ' + seedLabel(spec.seed);
    top.appendChild(kicker);
    top.appendChild(meta);

    const name = document.createElement('h2');
    name.className = 'flag-daily-name';
    name.id = 'flag-daily-name';
    name.textContent = spec.game.name;

    const goal = document.createElement('p');
    goal.className = 'flag-daily-goal';
    goal.id = 'flag-daily-goal';
    goal.textContent = goalLine(spec) + '. ' + spec.game.blurb;

    const stats = document.createElement('div');
    stats.className = 'flag-daily-stats';
    function stat(id, text) {
      const s = document.createElement('span');
      s.className = 'flag-daily-stat';
      s.id = id;
      s.textContent = text;
      stats.appendChild(s);
    }
    stat('flag-daily-time', clock(spec.seconds));
    stat('flag-daily-best', snap.played ? 'Best ' + snap.best : 'Best —');
    stat('flag-daily-streak', streakLine(snap));

    const actions = document.createElement('div');
    actions.className = 'flag-daily-actions';
    const play = document.createElement('a');
    play.className = 'flag-daily-play';
    play.id = 'flag-daily-play';
    play.href = hrefFor(spec.game, date);
    play.textContent = 'Play ' + spec.game.title;
    const motion = document.createElement('button');
    motion.type = 'button';
    motion.className = 'flag-daily-toggle';
    motion.id = 'feel-motion-btn';
    const haptic = document.createElement('button');
    haptic.type = 'button';
    haptic.className = 'flag-daily-toggle';
    haptic.id = 'feel-haptic-btn';
    actions.appendChild(play);
    actions.appendChild(motion);
    actions.appendChild(haptic);

    const history = document.createElement('div');
    history.className = 'flag-daily-history';
    history.id = 'flag-daily-history';
    const played = snap.history.filter(function (row) { return row.played; });
    if (!played.length) {
      const empty = document.createElement('span');
      empty.className = 'flag-daily-day';
      empty.textContent = 'No scores yet — today’s run starts the history.';
      history.appendChild(empty);
    } else {
      played.slice(0, 5).forEach(function (row) {
        const chip = document.createElement('span');
        chip.className = 'flag-daily-day ' + (row.met ? 'is-met' : 'is-miss');
        const g = BY_ID[row.game];
        chip.textContent = row.date.slice(5) + ' ' + (g ? g.name : row.game) + ' ' + row.best;
        history.appendChild(chip);
      });
    }

    rootEl.appendChild(top);
    rootEl.appendChild(name);
    rootEl.appendChild(goal);
    rootEl.appendChild(stats);
    rootEl.appendChild(actions);
    rootEl.appendChild(history);

    if (root.EurekaFeel) {
      EurekaFeel.bindButton(motion, 'motion');
      EurekaFeel.bindButton(haptic, 'haptics');
    } else {
      motion.textContent = 'Motion';
      haptic.textContent = 'Haptics';
    }

    const search = document.getElementById('card-search');
    const filtering = !!(search && search.value.trim());
    rootEl.hidden = filtering && rootEl.dataset.tucked === '1';
    if (!filtering) rootEl.hidden = false;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function openChallenge(pageId) {
    if (!document.body || document.getElementById('flag-daily-layer')) return;
    const date = activeDate();
    const spec = challengeFor(date);
    const official = pageId === spec.game.id;
    const layer = el('div', 'flag-daily-layer');
    layer.id = 'flag-daily-layer';
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-modal', 'true');
    layer.style.setProperty('--fd-accent', (official ? spec.game : BY_ID[pageId] || spec.game).accent);
    layer.dataset.official = official ? '1' : '0';
    layer.dataset.game = spec.game.id;
    layer.dataset.seed = String(spec.seed);
    document.body.appendChild(layer);

    function showGate() {
      layer.innerHTML = '';
      const here = BY_ID[pageId];
      layer.appendChild(el('div', 'flag-daily-kicker', 'FLAGSHIP DAILY · ' + date));
      layer.appendChild(el('h1', '', 'Today is ' + spec.game.name));
      layer.appendChild(el('p', 'fd-blurb', goalLine(spec) + '. The score counts in that game. This page is ' + (here ? here.name : 'another game') + '.'));
      const actions = el('div', 'fd-result-actions');
      const go = el('a', 'fd-again', 'Play ' + spec.game.title);
      go.href = hrefFor(spec.game, date);
      const back = el('a', 'fd-hub', 'Back to the hub');
      back.href = '/';
      actions.appendChild(go);
      actions.appendChild(back);
      layer.appendChild(actions);
    }

    if (!official) {
      const feel = root.EurekaFeel;
      if (feel) feel.transition({ title: spec.game.name, sub: 'Not today’s flagship' }, showGate);
      else showGate();
      return;
    }

    const lanes = spec.tiles.slice(0, 9);
    const cursor = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    let score = 0;
    let left = spec.seconds;
    let over = false;
    let last = 0;
    let raf = 0;

    const hud = el('div', 'flag-daily-hud');
    const titles = el('div', '');
    titles.appendChild(el('div', 'flag-daily-kicker', 'FLAGSHIP DAILY · ' + date + ' · seed ' + seedLabel(spec.seed)));
    titles.appendChild(el('h1', '', spec.game.title));
    titles.appendChild(el('p', 'fd-blurb', spec.game.blurb + ' Tap the goods. Leave the ' + spec.game.trapName + '.'));
    const meters = el('div', 'fd-meters');
    const timeEl = el('div', 'fd-time', clock(left));
    timeEl.id = 'flag-daily-time-live';
    const scoreEl = el('div', 'fd-score', '0');
    scoreEl.id = 'flag-daily-score-live';
    const goalEl = el('div', 'fd-goal-line', 'Goal ' + (spec.game.unit === '$' ? '$' : '') + spec.goal);
    const bar = el('div', 'fd-bar');
    const barFill = document.createElement('span');
    bar.appendChild(barFill);
    meters.appendChild(timeEl);
    meters.appendChild(scoreEl);
    meters.appendChild(goalEl);
    meters.appendChild(bar);
    hud.appendChild(titles);
    hud.appendChild(meters);

    const toggles = el('div', 'flag-daily-actions');
    const motion = el('button', 'flag-daily-toggle');
    motion.type = 'button';
    motion.id = 'feel-motion-btn-game';
    const haptic = el('button', 'flag-daily-toggle');
    haptic.type = 'button';
    haptic.id = 'feel-haptic-btn-game';
    toggles.appendChild(motion);
    toggles.appendChild(haptic);

    const grid = el('div', 'fd-grid');
    grid.id = 'flag-daily-grid';
    const buttons = [];

    function paintLane(i) {
      const tile = lanes[i];
      const btn = buttons[i];
      btn.classList.toggle('is-trap', !!tile.trap);
      btn.querySelector('.fd-face').textContent = tile.face;
      btn.querySelector('.fd-val').textContent = (tile.trap ? '−' : '+') + tile.value;
      btn.dataset.value = String(tile.value);
      btn.dataset.trap = tile.trap ? '1' : '0';
    }

    function advance(i) {
      cursor[i] += 9;
      const next = spec.tiles[cursor[i] % spec.tiles.length];
      lanes[i] = next;
      paintLane(i);
    }

    for (let i = 0; i < 9; i++) {
      const btn = el('button', 'fd-tile');
      btn.type = 'button';
      btn.appendChild(el('span', 'fd-face', ''));
      btn.appendChild(el('span', 'fd-val', ''));
      buttons.push(btn);
      paintLane(i);
      (function (index) {
        btn.addEventListener('click', function () {
          if (over) return;
          const tile = lanes[index];
          const rect = btn.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const y = rect.top + rect.height / 2;
          if (tile.trap) score = Math.max(0, score - tile.value);
          else score += tile.value;
          const feel = root.EurekaFeel;
          if (feel) {
            feel.punch(tile.trap ? 'trap' : 'hit', {
              x: x,
              y: y,
              text: (tile.trap ? '−' : '+') + tile.value,
              color: tile.trap ? '#F85149' : spec.game.accent,
              target: layer,
            });
          }
          advance(index);
          paintScore();
        });
      })(i);
      grid.appendChild(btn);
    }

    function paintScore() {
      scoreEl.textContent = String(score);
      const pct = Math.max(0, Math.min(100, (score / spec.goal) * 100));
      barFill.style.width = pct + '%';
    }

    const foot = el('div', 'fd-foot');
    const streakEl = el('span', 'flag-daily-stat', '');
    streakEl.id = 'flag-daily-streak-live';
    const bank = el('button', 'fd-bank', 'Bank it');
    bank.type = 'button';
    bank.id = 'flag-daily-bank';
    const back = el('a', 'fd-hub', 'Hub');
    back.href = '/';
    foot.appendChild(streakEl);
    foot.appendChild(bank);
    foot.appendChild(back);

    function paintStreak() {
      streakEl.textContent = streakLine(snapshot(date));
    }

    function showResults(rec) {
      if (raf) cancelAnimationFrame(raf);
      grid.remove();
      foot.remove();
      const box = el('div', 'flag-daily-results');
      box.id = 'flag-daily-results';
      const big = el('div', 'fd-big ' + (rec.met ? 'is-met' : 'is-miss'), String(rec.last));
      big.id = 'flag-daily-score';
      const line = el('p', 'fd-blurb', (rec.met ? 'Goal cleared' : 'Short of the goal') + ' · today’s best ' + rec.best);
      const streak = el('p', 'fd-goal-line', 'Streak ' + rec.streak);
      streak.id = 'flag-daily-streak-result';
      const list = el('ol', 'fd-history');
      list.id = 'flag-daily-history-result';
      rec.history.forEach(function (row) {
        const li = document.createElement('li');
        const g = BY_ID[row.game];
        const left = document.createElement('span');
        left.textContent = row.played ? (row.date + ' · ' + (g ? g.name : '')) : (row.date + ' · —');
        const right = document.createElement('span');
        right.className = row.played ? (row.met ? 'is-met' : 'is-miss') : '';
        right.textContent = row.played ? (String(row.best) + (row.met ? ' ✓' : '')) : 'no run';
        li.appendChild(left);
        li.appendChild(right);
        list.appendChild(li);
      });
      const actions = el('div', 'fd-result-actions');
      const again = el('button', 'fd-again', 'Same seed again');
      again.type = 'button';
      again.id = 'flag-daily-again';
      const hub = el('a', 'fd-hub', 'Back to the hub');
      hub.href = '/';
      actions.appendChild(again);
      actions.appendChild(hub);
      box.appendChild(big);
      box.appendChild(line);
      box.appendChild(streak);
      box.appendChild(list);
      box.appendChild(actions);
      layer.appendChild(box);
      again.addEventListener('click', function () {
        box.remove();
        score = 0;
        left = spec.seconds;
        over = false;
        for (let i = 0; i < 9; i++) {
          cursor[i] = i;
          lanes[i] = spec.tiles[i];
          paintLane(i);
        }
        paintScore();
        paintStreak();
        layer.appendChild(grid);
        layer.appendChild(foot);
        last = performance.now();
        raf = requestAnimationFrame(loop);
        buttons[0].focus();
      });
    }

    function finish() {
      if (over) return;
      over = true;
      const rec = record({ date: date, game: spec.game.id, score: score, goal: spec.goal });
      paintHub();
      const feel = root.EurekaFeel;
      const title = rec.met ? 'Goal cleared' : 'Banked';
      if (feel) feel.transition({ title: title, sub: String(rec.last) }, function () { showResults(rec); });
      else showResults(rec);
    }

    function loop(now) {
      if (over) return;
      if (!last) last = now;
      const scale = root.EurekaFeel ? EurekaFeel.timeScale() : 1;
      const dt = Math.min(0.05, (now - last) / 1000) * scale;
      last = now;
      if (scale > 0) {
        left -= dt;
        if (left <= 0) {
          left = 0;
          timeEl.textContent = '0:00';
          finish();
          return;
        }
      }
      timeEl.textContent = clock(left);
      raf = requestAnimationFrame(loop);
    }

    bank.addEventListener('click', finish);
    layer.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        finish();
      }
    });

    function mount() {
      layer.appendChild(hud);
      layer.appendChild(toggles);
      layer.appendChild(grid);
      layer.appendChild(foot);
      paintScore();
      paintStreak();
      if (root.EurekaFeel) {
        EurekaFeel.bindButton(motion, 'motion');
        EurekaFeel.bindButton(haptic, 'haptics');
      }
      last = performance.now();
      raf = requestAnimationFrame(loop);
      buttons[0].focus();
    }

    const feel = root.EurekaFeel;
    if (feel) feel.transition({ title: spec.game.title, sub: spec.game.name }, mount);
    else mount();
  }

  function boot() {
    try {
      if (document.getElementById('flag-daily')) paintHub();
      const page = pageGame();
      const daily = new URLSearchParams(root.location.search).get('daily');
      if (page && daily === '1') openChallenge(page);
    } catch (e) { /* a daily board must not blank the game */ }
  }

  root.FlagDaily = {
    KEY: KEY,
    GAMES: GAMES,
    todayKey: todayKey,
    prevDate: prevDate,
    challengeFor: challengeFor,
    load: load,
    record: record,
    snapshot: snapshot,
    streakLine: streakLine,
    seedLabel: seedLabel,
    pageGame: pageGame,
    activeDate: activeDate,
    paintHub: paintHub,
    boot: boot,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
