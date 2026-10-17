/* ============================================
   CAREER — hub-wide profile, XP, trophies.

   Flagship pages emit a game id and an event.
   This file is the only thing that awards them.
   The record lives on the shared progress
   document (js/persist.js), beside each game's
   continue index — not in a second save.
   ============================================ */

(function (root, factory) {
  const exported = factory();
  if (typeof module === 'object' && module.exports) module.exports = exported;
  try {
    if (root && root.document && root.EurekaPersist) {
      root.EurekaProgress = exported.attach(root);
    }
  } catch (e) { /* a career toast cannot take a game down */ }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // XP at which each level begins. Level 1 is 0. Past the table,
  // every further level is 400 XP so the bar never dead-ends.
  const LEVEL_XP = [0, 40, 100, 180, 280, 420, 600, 820, 1100, 1450];
  const LEVEL_STEP = 400;

  const GAMES = [
    { id: 'tycoon', name: 'Startup Tycoon', icon: '💼', href: 'tycoon/play.html', blurb: 'Hire, ship, ring the bell.', accent: '#58A6FF' },
    { id: 'beagle', name: 'Beagle Sim', icon: '🐶', href: 'tycoon/play.html?theme=beagle', blurb: 'The goodest startup.', accent: '#E8A87C' },
    { id: 'hearthvale', name: 'Hearthvale', icon: '🏡', href: 'hearthvale.html', blurb: 'A valley that remembers you.', accent: '#7fbf63' },
    { id: 'voxel', name: 'Voxel Isle', icon: '🌱', href: 'voxel-garden.html', blurb: 'A floating patch of sky.', accent: '#7EC8FF' },
    { id: 'growop', name: 'Grow Op', icon: '🌿', href: 'drug-lab.html', blurb: 'Room by room. Watch the heat.', accent: '#3FB950' },
    { id: 'clinic', name: 'Night Clinic', icon: '🌙', href: 'homeless-village.html', blurb: 'Under the bridge after dark.', accent: '#E3B341' },
  ];

  // max: high-water mark (safe to emit on every boot).
  // inc: one action, one tick (emit only when it happens).
  const STATS = {
    'tycoon.visit': 'max', 'tycoon.hire': 'inc', 'tycoon.ship': 'inc', 'tycoon.ipo': 'inc',
    'beagle.visit': 'max', 'beagle.hire': 'inc', 'beagle.ship': 'inc', 'beagle.ipo': 'inc',
    'hearthvale.found': 'max', 'hearthvale.build': 'max', 'hearthvale.pop': 'max', 'hearthvale.festival': 'max',
    'voxel.visit': 'max', 'voxel.harvest': 'max', 'voxel.level': 'max', 'voxel.build': 'max',
    'growop.visit': 'max', 'growop.sale': 'max', 'growop.earned': 'max', 'growop.hire': 'max',
    'clinic.visit': 'max', 'clinic.dawn': 'max', 'clinic.rest': 'max',
  };

  function stat(doc, key) { return doc && doc.stats && doc.stats[key] ? doc.stats[key] : 0; }

  function gamesTouched(doc) {
    let n = 0;
    for (let i = 0; i < GAMES.length; i++) {
      const prefix = GAMES[i].id + '.';
      const keys = Object.keys(doc.stats || {});
      for (let k = 0; k < keys.length; k++) {
        if (keys[k].indexOf(prefix) === 0 && doc.stats[keys[k]] > 0) { n++; break; }
      }
    }
    return n;
  }

  const ACHIEVEMENTS = [
    { id: 'tycoon-open', game: 'tycoon', icon: '🏢', name: 'First Desk', xp: 20,
      desc: 'Open the office.', test: function (d) { return stat(d, 'tycoon.visit') >= 1; } },
    { id: 'tycoon-hire', game: 'tycoon', icon: '🧑‍💻', name: 'Headcount', xp: 30,
      desc: 'Hire an engineer.', test: function (d) { return stat(d, 'tycoon.hire') >= 1; } },
    { id: 'tycoon-ship', game: 'tycoon', icon: '📦', name: 'Shipped It', xp: 40,
      desc: 'Ship a feature.', test: function (d) { return stat(d, 'tycoon.ship') >= 1; } },
    { id: 'tycoon-ipo', game: 'tycoon', icon: '🔔', name: 'Bell Rung', xp: 80,
      desc: 'Take the company public.', test: function (d) { return stat(d, 'tycoon.ipo') >= 1; } },

    { id: 'beagle-open', game: 'beagle', icon: '🌅', name: 'Good Morning', xp: 20,
      desc: 'Open the kennel.', test: function (d) { return stat(d, 'beagle.visit') >= 1; } },
    { id: 'beagle-hire', game: 'beagle', icon: '🦴', name: 'First Adopt', xp: 30,
      desc: 'Adopt a beagle.', test: function (d) { return stat(d, 'beagle.hire') >= 1; } },
    { id: 'beagle-ship', game: 'beagle', icon: '🎾', name: 'Buried Treasure', xp: 40,
      desc: 'Finish a dig.', test: function (d) { return stat(d, 'beagle.ship') >= 1; } },
    { id: 'beagle-ipo', game: 'beagle', icon: '🏆', name: 'Pack IPO', xp: 80,
      desc: 'Take the pack public.', test: function (d) { return stat(d, 'beagle.ipo') >= 1; } },

    { id: 'hearth-found', game: 'hearthvale', icon: '🪵', name: 'Valley Founded', xp: 25,
      desc: 'Name the town and begin.', test: function (d) { return stat(d, 'hearthvale.found') >= 1; } },
    { id: 'hearth-roof', game: 'hearthvale', icon: '🏠', name: 'First Roof', xp: 30,
      desc: 'Raise a building.', test: function (d) { return stat(d, 'hearthvale.build') >= 1; } },
    { id: 'hearth-folk', game: 'hearthvale', icon: '👥', name: 'Five Hearths', xp: 50,
      desc: 'House 5 villagers.', test: function (d) { return stat(d, 'hearthvale.pop') >= 5; } },
    { id: 'hearth-fair', game: 'hearthvale', icon: '🎪', name: 'Fair Day', xp: 60,
      desc: 'Throw a festival.', test: function (d) { return stat(d, 'hearthvale.festival') >= 1; } },

    { id: 'voxel-land', game: 'voxel', icon: '🏝️', name: 'Feet on the Isle', xp: 20,
      desc: 'Step onto the island.', test: function (d) { return stat(d, 'voxel.visit') >= 1; } },
    { id: 'voxel-harvest', game: 'voxel', icon: '🌾', name: 'First Harvest', xp: 30,
      desc: 'Pick a ripe crop.', test: function (d) { return stat(d, 'voxel.harvest') >= 1; } },
    { id: 'voxel-level', game: 'voxel', icon: '🌿', name: 'Green Thumb', xp: 40,
      desc: 'Reach garden level 3.', test: function (d) { return stat(d, 'voxel.level') >= 3; } },
    { id: 'voxel-sky', game: 'voxel', icon: '🏘️', name: 'Raising the Skyline', xp: 45,
      desc: 'Raise a town building.', test: function (d) { return stat(d, 'voxel.build') >= 1; } },

    { id: 'grow-open', game: 'growop', icon: '💡', name: 'Lights On', xp: 20,
      desc: 'Open the grow.', test: function (d) { return stat(d, 'growop.visit') >= 1; } },
    { id: 'grow-sale', game: 'growop', icon: '💵', name: 'First Sale', xp: 30,
      desc: 'Sell a bag.', test: function (d) { return stat(d, 'growop.sale') >= 1; } },
    { id: 'grow-weight', game: 'growop', icon: '📦', name: 'Moving Weight', xp: 50,
      desc: 'Earn $500.', test: function (d) { return stat(d, 'growop.earned') >= 500; } },
    { id: 'grow-crew', game: 'growop', icon: '👥', name: 'On the Crew', xp: 35,
      desc: 'Hire someone.', test: function (d) { return stat(d, 'growop.hire') >= 1; } },

    { id: 'clinic-in', game: 'clinic', icon: '🩺', name: 'Clocked In', xp: 20,
      desc: 'Raise the Night Clinic.', test: function (d) { return stat(d, 'clinic.visit') >= 1; } },
    { id: 'clinic-dawn', game: 'clinic', icon: '🌄', name: 'Through the Night', xp: 30,
      desc: 'Keep the tarp through a dawn.', test: function (d) { return stat(d, 'clinic.dawn') >= 1; } },
    { id: 'clinic-three', game: 'clinic', icon: '🌙', name: 'Three Dawns', xp: 45,
      desc: 'Three steady dawns.', test: function (d) { return stat(d, 'clinic.dawn') >= 3; } },
    { id: 'clinic-rest', game: 'clinic', icon: '🩹', name: 'First Dressing', xp: 25,
      desc: 'Dress a wound.', test: function (d) { return stat(d, 'clinic.rest') >= 1; } },

    { id: 'cross-two', game: 'cross', icon: '🚶', name: 'Making the Rounds', xp: 40,
      desc: 'Play 2 different flagships.', test: function (d) { return gamesTouched(d) >= 2; } },
    { id: 'cross-four', game: 'cross', icon: '🎟️', name: 'Studio Regular', xp: 70,
      desc: 'Play 4 different flagships.', test: function (d) { return gamesTouched(d) >= 4; } },
    { id: 'cross-all', game: 'cross', icon: '🌌', name: 'Full Circuit', xp: 120,
      desc: 'Touch every flagship shelf.', test: function (d) { return gamesTouched(d) >= GAMES.length; } },
    { id: 'cross-name', game: 'cross', icon: '✍️', name: 'Signed the Ledger', xp: 15,
      desc: 'Give yourself a name.', test: function (d) { return String(d.name || '').trim().length >= 2; } },
    { id: 'cross-warm', game: 'cross', icon: '🔥', name: 'Warming Up', xp: 25,
      desc: 'Reach level 3.', test: function (d) { return levelFor(d.xp) >= 3; } },
  ];

  function trophyCount(doc) {
    let n = 0;
    for (let i = 0; i < ACHIEVEMENTS.length; i++) if (doc.unlocked[ACHIEVEMENTS[i].id]) n++;
    return n;
  }

  const AVATARS = [
    { id: 'joy', glyph: '🕹️', name: 'Joystick', hint: 'Yours from the start.', unlock: function () { return true; } },
    { id: 'case', glyph: '💼', name: 'Briefcase', hint: 'Hire someone in Startup Tycoon.', unlock: function (d) { return stat(d, 'tycoon.hire') >= 1; } },
    { id: 'pup', glyph: '🐶', name: 'Beagle', hint: 'Open Beagle Sim.', unlock: function (d) { return stat(d, 'beagle.visit') >= 1; } },
    { id: 'home', glyph: '🏡', name: 'Cottage', hint: 'Found a valley.', unlock: function (d) { return stat(d, 'hearthvale.found') >= 1; } },
    { id: 'sprout', glyph: '🌱', name: 'Sprout', hint: 'Harvest on Voxel Isle.', unlock: function (d) { return stat(d, 'voxel.harvest') >= 1; } },
    { id: 'leaf', glyph: '🌿', name: 'Leaf', hint: 'Open Grow Op.', unlock: function (d) { return stat(d, 'growop.visit') >= 1; } },
    { id: 'moon', glyph: '🌙', name: 'Moon', hint: 'Clock in at Night Clinic.', unlock: function (d) { return stat(d, 'clinic.visit') >= 1; } },
    { id: 'cup', glyph: '🏆', name: 'Cup', hint: 'Reach level 6.', unlock: function (d) { return levelFor(d.xp) >= 6; } },
  ];

  const TITLES = [
    { id: 'newcomer', name: 'Newcomer', hint: 'Yours from the start.', unlock: function () { return true; } },
    { id: 'regular', name: 'Regular', hint: 'Earn 3 trophies.', unlock: function (d) { return trophyCount(d) >= 3; } },
    { id: 'founder', name: 'Founder', hint: 'Ring a bell — Tycoon or Beagle.', unlock: function (d) { return stat(d, 'tycoon.ipo') >= 1 || stat(d, 'beagle.ipo') >= 1; } },
    { id: 'keeper', name: 'Keeper', hint: 'Throw a fair, or reach garden level 3.', unlock: function (d) { return stat(d, 'hearthvale.festival') >= 1 || stat(d, 'voxel.level') >= 3; } },
    { id: 'nightowl', name: 'Night Owl', hint: 'See a dawn, or make a sale.', unlock: function (d) { return stat(d, 'clinic.dawn') >= 1 || stat(d, 'growop.sale') >= 1; } },
    { id: 'legend', name: 'Legend', hint: 'Reach level 7.', unlock: function (d) { return levelFor(d.xp) >= 7; } },
  ];

  const THEMES = [
    { id: 'lantern', name: 'Lantern', hint: 'Earn 3 trophies.', swatch: '#f0a04b',
      unlock: function (d) { return trophyCount(d) >= 3; } },
    { id: 'glacier', name: 'Glacier', hint: 'Reach level 4.', swatch: '#7ec8ff',
      unlock: function (d) { return levelFor(d.xp) >= 4; } },
    { id: 'hearth', name: 'Orchard', hint: 'Throw a festival, or earn 8 trophies.', swatch: '#8fce6a',
      unlock: function (d) { return stat(d, 'hearthvale.festival') >= 1 || trophyCount(d) >= 8; } },
  ];

  function levelFloor(level) {
    if (level <= 1) return 0;
    if (level - 1 < LEVEL_XP.length) return LEVEL_XP[level - 1];
    return LEVEL_XP[LEVEL_XP.length - 1] + (level - LEVEL_XP.length) * LEVEL_STEP;
  }

  function levelFor(xp) {
    const n = Number(xp);
    const value = Number.isFinite(n) && n > 0 ? n : 0;
    let lv = 1;
    while (lv < 99 && levelFloor(lv + 1) <= value) lv++;
    return lv;
  }

  function levelSpan(xp) {
    const level = levelFor(xp);
    const start = levelFloor(level);
    const next = levelFloor(level + 1);
    const span = Math.max(1, next - start);
    return { level: level, xp: xp | 0, start: start, next: next, pct: Math.max(0, Math.min(1, ((xp | 0) - start) / span)) };
  }

  function emptyDoc() {
    return { name: '', avatar: '', title: '', theme: '', xp: 0, unlocked: {}, stats: {} };
  }

  function cloneDoc(raw) {
    const doc = emptyDoc();
    if (!raw) return doc;
    doc.name = raw.name || '';
    doc.avatar = raw.avatar || '';
    doc.title = raw.title || '';
    doc.theme = raw.theme || '';
    doc.xp = raw.xp || 0;
    doc.unlocked = Object.assign({}, raw.unlocked || {});
    doc.stats = Object.assign({}, raw.stats || {});
    return doc;
  }

  function award(doc) {
    const fresh = [];
    let guard = 0;
    while (guard++ < 8) {
      let hit = false;
      for (let i = 0; i < ACHIEVEMENTS.length; i++) {
        const ach = ACHIEVEMENTS[i];
        if (doc.unlocked[ach.id]) continue;
        let ok = false;
        try { ok = !!ach.test(doc); } catch (e) { ok = false; }
        if (!ok) continue;
        doc.unlocked[ach.id] = Date.now();
        doc.xp += ach.xp;
        fresh.push(ach);
        hit = true;
      }
      if (!hit) break;
    }
    return fresh;
  }

  function applyStat(doc, key, value) {
    const mode = STATS[key];
    if (!mode) return false;
    const prev = doc.stats[key] || 0;
    let next;
    if (mode === 'max') {
      const n = Number(value);
      const incoming = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 1;
      next = Math.max(prev, incoming);
    } else {
      next = prev + 1;
    }
    if (next === prev) return false;
    doc.stats[key] = Math.min(1e9, next);
    return true;
  }

  function create(persist, env) {
    env = env || {};
    const listeners = [];
    let queue = [];
    let toastOn = false;
    let cssReady = false;

    function load() {
      try { return cloneDoc(persist.progress.career()); }
      catch (e) { return emptyDoc(); }
    }

    function save(doc) {
      try { return cloneDoc(persist.progress.saveCareer(doc)); }
      catch (e) { return doc; }
    }

    function emitChange() {
      for (let i = 0; i < listeners.length; i++) {
        try { listeners[i](); } catch (e) { /* a repaint cannot break a save */ }
      }
    }

    function ensureCss() {
      const document = env.document;
      if (!document || cssReady || document.getElementById('career-toast-css')) { cssReady = true; return; }
      const st = document.createElement('style');
      st.id = 'career-toast-css';
      st.textContent = [
        '.career-toast{position:fixed;z-index:100000;left:50%;bottom:max(16px,env(safe-area-inset-bottom));',
        'transform:translateX(-50%) translateY(0);width:min(420px,calc(100vw - 24px));',
        'display:flex;align-items:center;gap:12px;pointer-events:none;',
        'background:rgba(12,12,16,.94);color:#f4f1ea;border:1px solid rgba(247,201,72,.7);',
        'border-radius:14px;padding:12px 14px;box-shadow:0 12px 40px rgba(0,0,0,.45);',
        'font:600 13px/1.35 system-ui,sans-serif;animation:careerToastIn .28s ease}',
        '.career-toast strong{display:block;color:#f7c948;font-size:11px;letter-spacing:.08em;text-transform:uppercase}',
        '.career-toast-name{display:block;font-size:16px;font-weight:800}',
        '.career-toast-xp{display:block;color:#9ad07a;font-size:12px;margin-top:2px}',
        '.career-toast-icon{font-size:28px;line-height:1;flex:0 0 auto}',
        '.career-toast-out{opacity:0;transform:translateX(-50%) translateY(10px);transition:opacity .45s,transform .45s}',
        '@keyframes careerToastIn{from{opacity:0;transform:translateX(-50%) translateY(16px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}',
      ].join('');
      document.head.appendChild(st);
      cssReady = true;
    }

    function pump() {
      const document = env.document;
      if (!document || !document.body) { queue = []; toastOn = false; return; }
      const item = queue.shift();
      if (!item) { toastOn = false; return; }
      toastOn = true;
      ensureCss();
      const el = document.createElement('div');
      el.className = 'career-toast';
      el.setAttribute('role', 'status');
      const icon = document.createElement('span');
      icon.className = 'career-toast-icon';
      icon.textContent = item.icon || '🏆';
      const text = document.createElement('span');
      const strong = document.createElement('strong');
      strong.textContent = item.levelUp ? 'Level up' : 'Achievement unlocked';
      const name = document.createElement('span');
      name.className = 'career-toast-name';
      name.textContent = item.name;
      text.appendChild(strong);
      text.appendChild(name);
      if (!item.levelUp) {
        const xp = document.createElement('span');
        xp.className = 'career-toast-xp';
        xp.textContent = '+' + item.xp + ' XP';
        text.appendChild(xp);
      }
      el.appendChild(icon);
      el.appendChild(text);
      document.body.appendChild(el);
      try {
        const sfx = env.sfx && env.sfx();
        if (sfx && sfx.play) sfx.play('bonus');
      } catch (e) { /* sound is optional */ }
      setTimeout(function () { el.classList.add('career-toast-out'); }, 2600);
      setTimeout(function () { el.remove(); pump(); }, 3200);
    }

    function announce(ach) {
      queue.push(ach);
      if (!toastOn) pump();
    }

    function announceLevel(level) {
      queue.push({ icon: '⬆️', name: 'Level ' + level, levelUp: true });
      if (!toastOn) pump();
    }

    function commit(doc, prevLevel) {
      const saved = save(doc);
      const nextLevel = levelFor(saved.xp);
      if (nextLevel > prevLevel) announceLevel(nextLevel);
      emitChange();
      paintChip();
      const document = env.document;
      if (document && document.getElementById('view-trophy') && document.getElementById('view-trophy').classList.contains('active')) {
        render(document.getElementById('trophy-room'));
      }
      return saved;
    }

    function emit(game, event, value) {
      const doc = load();
      const prevLevel = levelFor(doc.xp);
      if (!applyStat(doc, String(game || '') + '.' + String(event || ''), value)) return [];
      const fresh = award(doc);
      for (let i = 0; i < fresh.length; i++) announce(fresh[i]);
      commit(doc, prevLevel);
      return fresh.map(function (a) { return a.id; });
    }

    function setName(name) {
      const doc = load();
      const prevLevel = levelFor(doc.xp);
      doc.name = String(name || '').replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
      const fresh = award(doc);
      for (let i = 0; i < fresh.length; i++) announce(fresh[i]);
      commit(doc, prevLevel);
      return profile();
    }

    function setAvatar(id) {
      const doc = load();
      const avatar = AVATARS.filter(function (a) { return a.id === id; })[0];
      if (!avatar || !avatar.unlock(doc)) return profile();
      doc.avatar = id === AVATARS[0].id ? '' : id;
      commit(doc, levelFor(doc.xp));
      return profile();
    }

    function setTitle(id) {
      const doc = load();
      const title = TITLES.filter(function (t) { return t.id === id; })[0];
      if (!title || !title.unlock(doc)) return profile();
      doc.title = id === TITLES[0].id ? '' : id;
      commit(doc, levelFor(doc.xp));
      return profile();
    }

    function applyThemeDom(id) {
      const document = env.document;
      if (!document || !document.documentElement) return;
      if (id) document.documentElement.dataset.theme = id;
      else delete document.documentElement.dataset.theme;
      try {
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta && document.defaultView && document.defaultView.getComputedStyle) {
          const token = document.defaultView.getComputedStyle(document.documentElement).getPropertyValue('--theme-color').trim();
          if (token) meta.content = token;
        }
      } catch (e) { /* theme color is cosmetic */ }
    }

    function writeThemeKey(id) {
      if (!env.localStorage) return;
      try { env.localStorage.setItem('eureka-theme', id || ''); } catch (e) { /* private mode */ }
    }

    function setTheme(id) {
      const doc = load();
      if (id) {
        const theme = THEMES.filter(function (t) { return t.id === id; })[0];
        if (!theme || !theme.unlock(doc)) return profile();
        doc.theme = id;
      } else {
        doc.theme = '';
      }
      save(doc);
      applyThemeDom(doc.theme);
      writeThemeKey(doc.theme);
      emitChange();
      paintChip();
      const document = env.document;
      if (document) render(document.getElementById('trophy-room'));
      return profile();
    }

    // The nav cycler owns the four built-in looks. Picking one drops
    // a career theme so the next boot does not put it back.
    function noteTheme(id) {
      const doc = load();
      const careerTheme = THEMES.some(function (t) { return t.id === id; });
      const next = careerTheme ? id : '';
      if ((doc.theme || '') === next) return profile();
      doc.theme = next;
      save(doc);
      emitChange();
      return profile();
    }

    function equippedAvatar(doc) {
      const found = AVATARS.filter(function (a) { return a.id === doc.avatar; })[0];
      if (found && found.unlock(doc)) return found;
      return AVATARS[0];
    }

    function equippedTitle(doc) {
      const found = TITLES.filter(function (t) { return t.id === doc.title; })[0];
      if (found && found.unlock(doc)) return found;
      return TITLES[0];
    }

    function profile() {
      const doc = load();
      const span = levelSpan(doc.xp);
      const avatar = equippedAvatar(doc);
      const title = equippedTitle(doc);
      return {
        name: doc.name,
        displayName: doc.name || 'Player',
        avatar: avatar.id,
        glyph: avatar.glyph,
        title: title.id,
        titleName: title.name,
        theme: doc.theme || '',
        xp: doc.xp,
        level: span.level,
        levelStart: span.start,
        nextXp: span.next,
        pct: span.pct,
        trophies: trophyCount(doc),
        trophyTotal: ACHIEVEMENTS.length,
        unlocked: Object.assign({}, doc.unlocked),
        stats: Object.assign({}, doc.stats),
      };
    }

    function paintChip() {
      const document = env.document;
      if (!document) return;
      const chip = document.getElementById('career-chip');
      if (!chip) return;
      const snap = profile();
      const face = chip.querySelector('.career-chip-face');
      const text = chip.querySelector('.career-chip-text');
      if (face) face.textContent = snap.glyph;
      if (text) text.textContent = 'Lv ' + snap.level;
      chip.setAttribute('aria-label', snap.displayName + ', level ' + snap.level + ', ' + snap.titleName + '. Open trophy room');
    }

    function el(document, tag, className, text) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text != null) node.textContent = text;
      return node;
    }

    function render(target) {
      const document = env.document;
      if (!document) return;
      const rootEl = typeof target === 'string' ? document.getElementById(target) : target;
      if (!rootEl) return;
      const doc = load();
      const snap = profile();
      rootEl.textContent = '';

      const head = el(document, 'header', 'trophy-profile');
      const face = el(document, 'div', 'trophy-face', snap.glyph);
      face.setAttribute('aria-hidden', 'true');
      const ident = el(document, 'div', 'trophy-ident');
      const kicker = el(document, 'div', 'trophy-kicker', snap.titleName);
      const title = el(document, 'h1', 'trophy-title', 'Trophy Room');
      const nameRow = el(document, 'form', 'trophy-name-row');
      nameRow.setAttribute('autocomplete', 'off');
      const nameInput = document.createElement('input');
      nameInput.className = 'trophy-name-input';
      nameInput.type = 'text';
      nameInput.maxLength = 16;
      nameInput.placeholder = 'Your name';
      nameInput.value = doc.name || '';
      nameInput.setAttribute('aria-label', 'Player name');
      nameInput.autocomplete = 'nickname';
      const saveBtn = el(document, 'button', 'trophy-btn', 'Save');
      saveBtn.type = 'submit';
      nameRow.appendChild(nameInput);
      nameRow.appendChild(saveBtn);
      nameRow.addEventListener('submit', function (e) {
        e.preventDefault();
        setName(nameInput.value);
      });
      const bar = el(document, 'div', 'trophy-bar');
      bar.setAttribute('role', 'progressbar');
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', String(snap.nextXp));
      bar.setAttribute('aria-valuenow', String(snap.xp));
      bar.setAttribute('aria-label', 'Level ' + snap.level + ' experience');
      const fill = el(document, 'span', 'trophy-bar-fill');
      fill.style.width = Math.round(snap.pct * 100) + '%';
      bar.appendChild(fill);
      const meta = el(document, 'p', 'trophy-meta',
        'Level ' + snap.level + '  ·  ' + snap.xp + ' / ' + snap.nextXp + ' XP  ·  ' + snap.trophies + ' / ' + snap.trophyTotal + ' trophies');
      ident.appendChild(kicker);
      ident.appendChild(title);
      ident.appendChild(nameRow);
      ident.appendChild(bar);
      ident.appendChild(meta);
      head.appendChild(face);
      head.appendChild(ident);
      rootEl.appendChild(head);

      rootEl.appendChild(cosmeticBlock(document, doc, 'Avatar', AVATARS, snap.avatar, function (id) { setAvatar(id); }, true));
      rootEl.appendChild(cosmeticBlock(document, doc, 'Title', TITLES, snap.title, function (id) { setTitle(id); }, false));
      rootEl.appendChild(themeBlock(document, doc));

      for (let i = 0; i < GAMES.length; i++) rootEl.appendChild(shelf(document, doc, GAMES[i]));
      rootEl.appendChild(shelf(document, doc, { id: 'cross', name: 'Around the Arcade', icon: '✨', blurb: 'The nights you came back.', accent: '#F7C948' }));
      paintChip();
    }

    function cosmeticBlock(document, doc, label, list, equipped, onPick, isAvatar) {
      const section = el(document, 'section', 'trophy-cosmetics');
      section.appendChild(el(document, 'h2', 'trophy-h', label));
      const row = el(document, 'div', isAvatar ? 'trophy-avatars' : 'trophy-titles');
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        const open = !!item.unlock(doc);
        const on = equipped === item.id;
        const btn = el(document, 'button', 'trophy-pick' + (on ? ' is-on' : '') + (open ? '' : ' is-locked'));
        btn.type = 'button';
        btn.disabled = !open;
        if (isAvatar) {
          btn.appendChild(el(document, 'span', 'trophy-pick-glyph', item.glyph));
          if (!open) {
            const lock = el(document, 'span', 'trophy-lock', '🔒');
            lock.setAttribute('aria-hidden', 'true');
            btn.appendChild(lock);
          }
        }
        const name = el(document, 'span', 'trophy-pick-name', open ? item.name : item.hint);
        if (isAvatar) name.setAttribute('aria-hidden', 'true');
        btn.appendChild(name);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        btn.setAttribute('aria-label', (open ? item.name : item.hint) + (on ? ', equipped' : ''));
        if (open) btn.addEventListener('click', function () { onPick(item.id); });
        row.appendChild(btn);
      }
      section.appendChild(row);
      return section;
    }

    function themeBlock(document, doc) {
      const section = el(document, 'section', 'trophy-cosmetics');
      section.appendChild(el(document, 'h2', 'trophy-h', 'Hub theme'));
      const row = el(document, 'div', 'trophy-themes');
      const midnight = el(document, 'button', 'trophy-theme' + (!doc.theme ? ' is-on' : ''));
      midnight.type = 'button';
      midnight.appendChild(el(document, 'span', 'trophy-swatch'));
      midnight.querySelector('.trophy-swatch').style.background = '#6C63FF';
      midnight.appendChild(el(document, 'span', 'trophy-pick-name', 'Midnight'));
      midnight.setAttribute('aria-pressed', !doc.theme ? 'true' : 'false');
      midnight.addEventListener('click', function () { setTheme(''); });
      row.appendChild(midnight);
      for (let i = 0; i < THEMES.length; i++) {
        const theme = THEMES[i];
        const open = !!theme.unlock(doc);
        const on = doc.theme === theme.id;
        const btn = el(document, 'button', 'trophy-theme' + (on ? ' is-on' : '') + (open ? '' : ' is-locked'));
        btn.type = 'button';
        btn.disabled = !open;
        const sw = el(document, 'span', 'trophy-swatch');
        sw.style.background = open ? theme.swatch : '#444';
        btn.appendChild(sw);
        btn.appendChild(el(document, 'span', 'trophy-pick-name', open ? theme.name : theme.hint));
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        btn.setAttribute('aria-label', open ? theme.name + ' theme' : theme.hint);
        if (open) btn.addEventListener('click', function () { setTheme(theme.id); });
        row.appendChild(btn);
      }
      section.appendChild(row);
      const note = el(document, 'p', 'trophy-note', 'Themes sit on top of the hub. The paintbrush in the nav still cycles Midnight, CRT, Synthwave, and Daylight.');
      section.appendChild(note);
      return section;
    }

    function shelf(document, doc, game) {
      const section = el(document, 'section', 'trophy-shelf');
      section.style.setProperty('--shelf', game.accent || '#F7C948');
      const head = el(document, 'div', 'trophy-shelf-head');
      const h = el(document, 'h2', 'trophy-h', game.icon + '  ' + game.name);
      head.appendChild(h);
      if (game.href) {
        const play = el(document, 'a', 'trophy-play', 'Play');
        play.href = game.href;
        play.setAttribute('aria-label', 'Play ' + game.name);
        head.appendChild(play);
      }
      section.appendChild(head);
      section.appendChild(el(document, 'p', 'trophy-blurb', game.blurb || ''));
      const grid = el(document, 'div', 'trophy-grid');
      for (let i = 0; i < ACHIEVEMENTS.length; i++) {
        const ach = ACHIEVEMENTS[i];
        if (ach.game !== game.id) continue;
        const at = doc.unlocked[ach.id];
        const card = el(document, 'article', 'trophy-card' + (at ? ' is-got' : ''));
        card.appendChild(el(document, 'span', 'trophy-card-icon', at ? ach.icon : '🔒'));
        card.appendChild(el(document, 'span', 'trophy-card-name', ach.name));
        card.appendChild(el(document, 'span', 'trophy-card-desc', ach.desc));
        card.appendChild(el(document, 'span', 'trophy-card-xp', at ? '+' + ach.xp + ' XP' : ach.xp + ' XP'));
        if (at) {
          let when = '';
          try { when = new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch (e) { when = ''; }
          if (when) card.appendChild(el(document, 'span', 'trophy-card-when', when));
        }
        grid.appendChild(card);
      }
      section.appendChild(grid);
      return section;
    }

    function bootTheme() {
      const doc = load();
      if (!doc.theme) return;
      const theme = THEMES.filter(function (t) { return t.id === doc.theme; })[0];
      if (!theme || !theme.unlock(doc)) {
        doc.theme = '';
        save(doc);
        return;
      }
      applyThemeDom(doc.theme);
      writeThemeKey(doc.theme);
    }

    bootTheme();
    paintChip();

    return {
      emit: emit,
      profile: profile,
      setName: setName,
      setAvatar: setAvatar,
      setTitle: setTitle,
      setTheme: setTheme,
      noteTheme: noteTheme,
      render: render,
      paintChip: paintChip,
      onChange: function (fn) {
        if (typeof fn !== 'function') return function () {};
        listeners.push(fn);
        return function () {
          const i = listeners.indexOf(fn);
          if (i >= 0) listeners.splice(i, 1);
        };
      },
    };
  }

  function attach(root) {
    return create(root.EurekaPersist, {
      document: root.document,
      localStorage: root.localStorage,
      sfx: function () { return root.SFX; },
    });
  }

  return {
    create: create,
    attach: attach,
    levelFor: levelFor,
    levelSpan: levelSpan,
    LEVEL_XP: LEVEL_XP,
    GAMES: GAMES,
    ACHIEVEMENTS: ACHIEVEMENTS,
    AVATARS: AVATARS,
    TITLES: TITLES,
    THEMES: THEMES,
    STATS: STATS,
  };
});
