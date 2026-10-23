/* ============================================
   SPARK SHOP — hub currency and cosmetics.

   Sparks are minted from the career document
   (XP, trophies, boss kills) and from the daily
   challenges. They spend here, on this device,
   on looks the flagships actually draw: banners,
   cloaks, trails, lamp glass, hub-card themes, titles, badges,
   the cloth over the Homeless Village soup kitchen,
   the canvas on a Homeless Village tent,
   the brass lamp on the Startup Tycoon desk,
   and the glass on every Startup Tycoon ceiling pendant.

   Older progress files have no purse. Reading
   one fills the new fields with zeros and does
   not rewrite it until the career is saved.
   ============================================ */

(function (root, factory) {
  const exported = factory();
  if (typeof module === 'object' && module.exports) module.exports = exported;
  try {
    if (root && root.EurekaPersist) root.EurekaCosmetics = exported.attach(root);
  } catch (e) { /* a shop cannot take a game down */ }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const RATES = { xp: 5, ach: 12, flag: 30, arcade: 15, boss: 40 };
  const BOSS_KEYS = ['hearthvale.boss', 'tycoon.boss', 'beagle.boss'];
  const FLAG_KEY = 'eureka-flag-daily-v1';

  const CATALOG = [
    { id: 'badge-spark', slot: 'badge', name: 'First Spark', glyph: '✦', cost: 15,
      blurb: 'A spark pinned to your profile.', games: ['Profile'] },
    { id: 'trail-cinder', slot: 'trail', name: 'Cinder Trail', cost: 30, color: '#ffb020', style: 'cinder',
      blurb: 'Embers follow your Age of War line and every Hearthvale villager.', games: ['Age of War', 'Hearthvale'] },
    { id: 'title-ember', slot: 'title', name: 'Ember', cost: 36,
      blurb: 'A second title beside the one you earned.', games: ['Profile'] },
    { id: 'badge-wolf', slot: 'badge', name: 'Wolf Badge', glyph: '🐺', cost: 40,
      blurb: 'The Hollow Wolf, worn on your profile.', games: ['Profile'] },
    { id: 'glass-amber', slot: 'glass', name: 'Amber Lamp Glass', cost: 44, color: '#ffb020', accent: '#ff7a18',
      blurb: 'Amber glass on every grow lamp, and a shade over the tent.', games: ['Grow Op'] },
    { id: 'palette-orchard', slot: 'palette', name: 'Orchard Cloak', cost: 48, color: '#7fbf63',
      blurb: 'A green cloak in the valley and a ring under your army.', games: ['Hearthvale', 'Age of War'] },
    { id: 'cards-lantern', slot: 'cards', name: 'Lantern Cards', cost: 55, color: '#f0a04b',
      blurb: 'Warm edges on every game card in the hub.', games: ['Hub'] },
    { id: 'skin-banner', slot: 'skin', name: 'Gold Banner', cost: 64, color: '#f7c948', accent: '#8a5a12',
      blurb: 'A gold pennant on friendly units and a ribbon on villagers.', games: ['Age of War', 'Hearthvale'] },
    { id: 'palette-glacier', slot: 'palette', name: 'Glacier Cloak', cost: 72, color: '#7ec8ff',
      blurb: 'Ice-blue cloth on the field and in the valley.', games: ['Age of War', 'Hearthvale'] },
    { id: 'title-warden', slot: 'title', name: 'Warden', cost: 80,
      blurb: 'For the nights you stayed.', games: ['Profile'] },
    { id: 'cards-ink', slot: 'cards', name: 'Ink Cards', cost: 88, color: '#7ec8ff',
      blurb: 'A cool hairline on the hub cards.', games: ['Hub'] },
    { id: 'trail-firefly', slot: 'trail', name: 'Firefly Trail', cost: 96, color: '#d6ff6b', style: 'firefly',
      blurb: 'Soft lights on the march and on the walk home.', games: ['Age of War', 'Hearthvale'] },
    { id: 'skin-void', slot: 'skin', name: 'Void Banner', cost: 120, color: '#b388ff', accent: '#3a2466',
      blurb: 'A violet standard. The other side sees it coming.', games: ['Age of War', 'Hearthvale'] },
    { id: 'kitchen-supper', slot: 'kitchen', name: 'Supper Cloth', cost: 44, color: '#e23b6a', accent: '#3ef0d0',
      blurb: 'A cloth over the soup kitchen. The pot still costs what it cost.', games: ['Homeless Village'] },
    { id: 'tent-lantern', slot: 'tent', name: 'Lantern Canvas', cost: 44, color: '#e8a04a', accent: '#ffe38a',
      blurb: 'A warm fly over the camp tent. Raising the tent still costs the same cardboard, scraps, and wood.', games: ['Homeless Village'] },
    { id: 'lamp-founder', slot: 'lamp', name: 'Founder Lamp', cost: 44, color: '#ffb24a', accent: '#ffe7a8',
      blurb: 'A brass lamp on the CEO desk. Deals still pay what they paid.', games: ['Startup Tycoon'] },
    { id: 'pendant-tide', slot: 'pendant', name: 'Tide Glass', cost: 44, color: '#149e86', accent: '#2ee6c7',
      blurb: 'Sea-glass on every ceiling pendant. Deals still pay what they paid.', games: ['Startup Tycoon'] },
  ];

  const BY_ID = {};
  for (let i = 0; i < CATALOG.length; i++) BY_ID[CATALOG[i].id] = CATALOG[i];

  const SLOTS = [
    { id: 'all', name: 'All' },
    { id: 'skin', name: 'Banners' },
    { id: 'trail', name: 'Trails' },
    { id: 'palette', name: 'Cloaks' },
    { id: 'glass', name: 'Lamp glass' },
    { id: 'cards', name: 'Hub cards' },
    { id: 'title', name: 'Titles' },
    { id: 'badge', name: 'Badges' },
    { id: 'kitchen', name: 'Soup kitchen' },
    { id: 'tent', name: 'Tent canvas' },
    { id: 'lamp', name: 'Desk lamp' },
    { id: 'pendant', name: 'Pendants' },
  ];

  function itemById(id) { return BY_ID[id] || null; }

  function create(persist, env) {
    env = env || {};
    let pending = [];
    let filter = 'all';
    let cssReady = false;
    let lookAt = 0;
    let lookCached = null;
    let raf = 0;
    let modalItem = null;
    let revealAt = 0;
    let lastFocus = null;

    function now() {
      try { if (env.now) return env.now(); } catch (e) { /* clock fallback */ }
      return Date.now();
    }

    function document() { return env.document || null; }

    function storage() {
      return env.storage || env.localStorage || null;
    }

    function achievementIds() {
      try {
        const list = env.achievementIds ? env.achievementIds() : [];
        return Array.isArray(list) ? list : [];
      } catch (e) { return []; }
    }

    function load() {
      try { return persist.progress.career(); }
      catch (e) {
        return { name: '', sparks: 0, ledger: { xp: 0, ach: {}, boss: {}, daily: {} }, owned: {}, equipped: {}, unlocked: {}, stats: {}, xp: 0 };
      }
    }

    function save(doc) {
      lookAt = 0;
      try { return persist.progress.saveCareer(doc); }
      catch (e) { return doc; }
    }

    function bust() { lookAt = 0; lookCached = null; }

    function dailyKey(kind, date) {
      if (kind !== 'flag' && kind !== 'arcade') return '';
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
      return kind + ':' + date;
    }

    function payDaily(doc, key) {
      if (!key || doc.ledger.daily[key]) return 0;
      doc.ledger.daily[key] = 1;
      const pay = key.indexOf('arcade:') === 0 ? RATES.arcade : RATES.flag;
      doc.sparks += pay;
      return pay;
    }

    function scanDailies(doc) {
      let gained = 0;
      const box = storage();
      if (!box || !box.getItem) return 0;
      try {
        const raw = JSON.parse(box.getItem(FLAG_KEY) || 'null');
        const days = raw && raw.days && typeof raw.days === 'object' ? raw.days : null;
        if (days) {
          const dates = Object.keys(days);
          for (let i = 0; i < dates.length; i++) {
            if (days[dates[i]] && days[dates[i]].met) gained += payDaily(doc, dailyKey('flag', dates[i]));
          }
        }
      } catch (e) { /* a bad daily file does not pay */ }
      if (typeof box.key === 'function' && typeof box.length === 'number') {
        try {
          for (let i = 0; i < box.length; i++) {
            const k = box.key(i);
            const m = k && /^arcade-daily-.+-(\d{4}-\d{2}-\d{2})$/.exec(k);
            if (m) gained += payDaily(doc, dailyKey('arcade', m[1]));
          }
        } catch (e) { /* key iteration is optional */ }
      }
      return gained;
    }

    function fold(doc) {
      if (!doc || typeof doc !== 'object') return 0;
      if (!doc.ledger || typeof doc.ledger !== 'object') doc.ledger = { xp: 0, ach: {}, boss: {}, daily: {} };
      if (!doc.ledger.ach) doc.ledger.ach = {};
      if (!doc.ledger.boss) doc.ledger.boss = {};
      if (!doc.ledger.daily) doc.ledger.daily = {};
      if (!doc.unlocked) doc.unlocked = {};
      if (!doc.stats) doc.stats = {};
      let gained = 0;
      const xp = doc.xp > 0 ? Math.floor(doc.xp) : 0;
      const xpSparks = Math.floor(xp / RATES.xp);
      const paidXp = doc.ledger.xp > 0 ? Math.floor(doc.ledger.xp) : 0;
      if (xpSparks > paidXp) {
        gained += xpSparks - paidXp;
        doc.ledger.xp = xpSparks;
      }
      const ids = achievementIds();
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        if (!doc.unlocked[id] || doc.ledger.ach[id]) continue;
        doc.ledger.ach[id] = 1;
        gained += RATES.ach;
      }
      for (let i = 0; i < BOSS_KEYS.length; i++) {
        const key = BOSS_KEYS[i];
        const n = doc.stats[key] > 0 ? Math.floor(doc.stats[key]) : 0;
        const prev = doc.ledger.boss[key] > 0 ? Math.floor(doc.ledger.boss[key]) : 0;
        if (n > prev) {
          doc.ledger.boss[key] = n;
          gained += (n - prev) * RATES.boss;
        }
      }
      const queued = pending.splice(0, pending.length);
      for (let i = 0; i < queued.length; i++) gained += payDaily(doc, queued[i]);
      gained += scanDailies(doc);
      if (gained > 0) {
        doc.sparks = Math.min(1e7, (doc.sparks > 0 ? Math.floor(doc.sparks) : 0) + gained);
        toast(gained);
      }
      return gained;
    }

    function settle() {
      const doc = load();
      const before = doc.sparks | 0;
      const gained = fold(doc);
      if (gained > 0) save(doc);
      else if ((doc.sparks | 0) !== before) save(doc);
      return gained;
    }

    function grantDaily(kind, date) {
      const key = dailyKey(kind, date);
      if (!key) return 0;
      pending.push(key);
      return settle();
    }

    function purse() {
      const doc = load();
      return {
        sparks: doc.sparks | 0,
        owned: Object.assign({}, doc.owned || {}),
        equipped: Object.assign({}, doc.equipped || {}),
        ledger: {
          xp: doc.ledger && doc.ledger.xp || 0,
          ach: Object.assign({}, doc.ledger && doc.ledger.ach || {}),
          boss: Object.assign({}, doc.ledger && doc.ledger.boss || {}),
          daily: Object.assign({}, doc.ledger && doc.ledger.daily || {}),
        },
      };
    }

    function owned(doc, id) { return !!(doc.owned && doc.owned[id]); }

    function look() {
      const t = now();
      if (lookCached && t - lookAt < 250) return lookCached;
      const doc = load();
      function take(slot) {
        const id = doc.equipped && doc.equipped[slot];
        const item = id && itemById(id);
        if (!item || item.slot !== slot || !owned(doc, id)) return null;
        return item;
      }
      const skin = take('skin');
      const trail = take('trail');
      const palette = take('palette');
      const cards = take('cards');
      const title = take('title');
      const badge = take('badge');
      const kitchen = take('kitchen');
      const glass = take('glass');
      const tent = take('tent');
      const lamp = take('lamp');
      const pendant = take('pendant');
      lookCached = {
        skin: skin ? { id: skin.id, name: skin.name, color: skin.color, accent: skin.accent } : null,
        trail: trail ? { id: trail.id, name: trail.name, color: trail.color, style: trail.style } : null,
        palette: palette ? { id: palette.id, name: palette.name, color: palette.color } : null,
        cards: cards ? { id: cards.id, name: cards.name, color: cards.color } : null,
        title: title ? { id: title.id, name: title.name } : null,
        badge: badge ? { id: badge.id, name: badge.name, glyph: badge.glyph } : null,
        kitchen: kitchen ? { id: kitchen.id, name: kitchen.name, color: kitchen.color, accent: kitchen.accent } : null,
        glass: glass ? { id: glass.id, name: glass.name, color: glass.color, accent: glass.accent } : null,
        tent: tent ? { id: tent.id, name: tent.name, color: tent.color, accent: tent.accent } : null,
        lamp: lamp ? { id: lamp.id, name: lamp.name, color: lamp.color, accent: lamp.accent } : null,
        pendant: pendant ? { id: pendant.id, name: pendant.name, color: pendant.color, accent: pendant.accent } : null,
        sparks: doc.sparks | 0,
      };
      lookAt = t;
      return lookCached;
    }

    function apply() {
      const docEl = document() && document().documentElement;
      if (!docEl) return look();
      const cards = look().cards;
      if (cards) docEl.dataset.cardTheme = cards.id;
      else delete docEl.dataset.cardTheme;
      return look();
    }

    function preview(id) {
      const item = itemById(id);
      return item ? Object.assign({}, item) : null;
    }

    function buy(id) {
      const item = itemById(id);
      const doc = load();
      if (!item) return { ok: false, reason: 'unknown', sparks: doc.sparks | 0 };
      if (owned(doc, id)) return { ok: false, reason: 'owned', sparks: doc.sparks | 0 };
      if ((doc.sparks | 0) < item.cost) {
        return { ok: false, reason: 'broke', sparks: doc.sparks | 0, need: item.cost - (doc.sparks | 0) };
      }
      doc.sparks -= item.cost;
      if (!doc.owned) doc.owned = {};
      if (!doc.equipped) doc.equipped = {};
      doc.owned[id] = now();
      doc.equipped[item.slot] = id;
      const saved = save(doc);
      if (!saved.owned || !saved.owned[id]) return { ok: false, reason: 'save', sparks: purse().sparks };
      bust();
      apply();
      playReveal();
      openModal(item, true);
      repaint();
      return { ok: true, sparks: saved.sparks | 0, id: id };
    }

    function equip(id) {
      const item = itemById(id);
      const doc = load();
      if (!item || !owned(doc, id)) return { ok: false, reason: 'locked', sparks: doc.sparks | 0 };
      if (!doc.equipped) doc.equipped = {};
      doc.equipped[item.slot] = id;
      save(doc);
      bust();
      apply();
      playCue('bonus');
      repaint();
      return { ok: true, sparks: doc.sparks | 0, id: id };
    }

    function unequip(slot) {
      const doc = load();
      if (!doc.equipped || !doc.equipped[slot]) return { ok: true, sparks: doc.sparks | 0 };
      delete doc.equipped[slot];
      save(doc);
      bust();
      apply();
      repaint();
      return { ok: true, sparks: doc.sparks | 0 };
    }

    function playCue(name) {
      try {
        const sfx = env.sfx && env.sfx();
        if (sfx && sfx.play) sfx.play(name);
      } catch (e) { /* sound is optional */ }
    }

    function playReveal() {
      playCue('reveal');
      try {
        const audio = env.audio && env.audio();
        if (audio && audio.sfx) audio.sfx('levelup');
      } catch (e) { /* the flagship score is optional on the hub */ }
    }

    function reducedMotion() {
      try {
        const doc = document();
        const view = doc && doc.defaultView;
        return !!(view && view.matchMedia && view.matchMedia('(prefers-reduced-motion: reduce)').matches);
      } catch (e) { return false; }
    }

    function ensureCss() {
      const doc = document();
      if (!doc || cssReady || doc.getElementById('spark-shop-css')) { cssReady = true; return; }
      const st = doc.createElement('style');
      st.id = 'spark-shop-css';
      st.textContent = [
        '#spark-shop{margin:4px 0 18px;padding:14px;border-radius:var(--hud-radius-card,16px);',
        'max-width:100%;min-width:0;box-sizing:border-box;color:var(--hud-text,#f7f4ee);',
        'font-family:var(--hud-font-display, "Outfit", "Inter", sans-serif);',
        'border:1px solid color-mix(in srgb,var(--hud-gold,#e3b341) 45%,var(--hud-border,rgba(255,255,255,.12)));',
        'background-color:var(--hud-card,#0c0e14);',
        'background-image:linear-gradient(180deg,color-mix(in srgb,var(--hud-gold,#e3b341) 14%,transparent),transparent 48%)}',
        '#spark-shop .spark-head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:8px}',
        '#spark-shop .spark-balance{font-weight:800;color:var(--hud-gold-bright,#f0c552);font-variant-numeric:tabular-nums}',
        '#spark-shop .trophy-h,#spark-shop h2,#spark-shop h3{color:var(--hud-text,#f7f4ee);font-family:inherit}',
        '.spark-rules{margin:8px 0 0;color:var(--hud-dim,#8b949e);font-size:13px;line-height:1.45}',
        '.spark-filters{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}',
        '.spark-filter,.spark-preview,.spark-buy,.spark-actions button{min-height:44px;min-width:44px;touch-action:manipulation;',
        'border-radius:10px;border:1px solid var(--hud-border-strong,rgba(255,255,255,.18));',
        'background:color-mix(in srgb,var(--hud-text,#f7f4ee) 8%,var(--hud-bg,#060608));',
        'color:var(--hud-text,#f7f4ee);font-weight:700;font-size:16px;line-height:1.2;font-family:inherit;padding:8px 12px;cursor:pointer}',
        '.spark-filter.is-on{background:var(--hud-text,#f7f4ee);color:var(--hud-ink,#060608);border-color:var(--hud-text,#f7f4ee);box-shadow:none}',
        '.spark-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(210px,100%),1fr));gap:10px;margin-top:12px;min-width:0}',
        '.spark-card{display:flex;flex-direction:column;gap:6px;min-width:0;padding:10px;border-radius:14px;',
        'border:1px solid var(--hud-border,rgba(255,255,255,.12));background-color:var(--hud-bg,#060608);color:var(--hud-text,#f7f4ee);overflow:hidden}',
        '.spark-card.is-on{border-color:var(--hud-gold,#e3b341)}',
        '.spark-thumb{width:100%;height:84px;border-radius:10px;background:var(--hud-bg-deep,#020203);display:block}',
        '.spark-card h3{margin:0;font-size:16px;color:var(--hud-text,#f7f4ee)}',
        '.spark-card p{margin:0;color:var(--hud-dim,#8b949e);font-size:13px;line-height:1.35}',
        '.spark-card-actions{display:flex;gap:8px;margin-top:auto}',
        '.spark-card-actions button{flex:1}',
        '.spark-buy:disabled{opacity:1;color:var(--hud-dim,#8b949e);cursor:default}',
        '.trophy-face{position:relative}',
        '.trophy-badge{position:absolute;right:-6px;bottom:-6px;font-size:18px;line-height:1;',
        'background:var(--hud-card,#0c0e14);color:var(--hud-gold-bright,#f0c552);border-radius:999px;padding:2px;',
        'border:1px solid color-mix(in srgb,var(--hud-gold,#e3b341) 55%,var(--hud-border,rgba(255,255,255,.12)))}',
        '.spark-reveal{position:fixed;inset:0;z-index:100002;display:flex;align-items:flex-end;justify-content:center;',
        'background:rgba(4,4,8,.72);padding:12px;padding-bottom:max(12px,env(safe-area-inset-bottom))}',
        '.spark-sheet{width:min(460px,100%);background:var(--hud-surface,rgba(10,10,15,.94));color:var(--hud-text,#f7f4ee);',
        'font-family:var(--hud-font-display, "Outfit", "Inter", sans-serif);',
        'border:1px solid color-mix(in srgb,var(--hud-gold,#e3b341) 55%,var(--hud-border,rgba(255,255,255,.12)));',
        'border-radius:var(--hud-radius-sheet,18px);padding:16px;box-shadow:0 24px 70px rgba(0,0,0,.55)}',
        '.spark-sheet.is-reveal{animation:sparkPop .48s cubic-bezier(.2,1.35,.36,1)}',
        '@keyframes sparkPop{0%{transform:scale(.72) translateY(28px);opacity:0}100%{transform:none;opacity:1}}',
        '.spark-kicker{margin:0;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--hud-gold-bright,#f0c552)}',
        '.spark-sheet h2{margin:4px 0 8px;font-size:28px;line-height:1.1;color:var(--hud-text,#f7f4ee);font-family:inherit}',
        '#spark-reveal-stage{width:100%;height:200px;border-radius:12px;background:var(--hud-bg-deep,#020203);display:block}',
        '.spark-actions{display:flex;gap:8px;margin-top:12px}',
        '.spark-actions button{flex:1}',
        '.spark-toast{position:fixed;z-index:100001;top:var(--hud-top-safe,72px);left:0;right:0;margin:0 auto;width:max-content;max-width:calc(100% - 24px);text-align:center;pointer-events:none;',
        'background:var(--hud-surface,rgba(10,10,15,.94));color:var(--hud-gold-bright,#f0c552);',
        'border:1px solid color-mix(in srgb,var(--hud-gold,#e3b341) 55%,var(--hud-border,rgba(255,255,255,.12)));border-radius:999px;',
        'padding:10px 16px;font:800 14px/1.2 var(--hud-font-display, "Outfit", sans-serif);box-shadow:0 10px 30px rgba(0,0,0,.45)}',
        'html[data-card-theme="cards-lantern"] .arcade-card,html[data-card-theme="cards-lantern"] a.arcade-flagship{',
        'box-shadow:0 0 0 2px rgba(240,160,75,.8),0 12px 28px rgba(240,140,40,.18)}',
        'html[data-card-theme="cards-ink"] .arcade-card,html[data-card-theme="cards-ink"] a.arcade-flagship{',
        'box-shadow:0 0 0 2px rgba(126,200,255,.75),0 12px 28px rgba(40,90,150,.22)}',
        '@media(max-width:640px){.spark-grid{grid-template-columns:1fr}.spark-sheet h2{font-size:24px}}',
        '@media(prefers-reduced-motion:reduce){.spark-sheet.is-reveal{animation:none}}',
      ].join('');
      doc.head.appendChild(st);
      cssReady = true;
    }

    function toast(gained) {
      const doc = document();
      if (!doc || !doc.body || !gained) return;
      ensureCss();
      let el = doc.getElementById('spark-toast');
      if (!el) {
        el = doc.createElement('div');
        el.id = 'spark-toast';
        el.className = 'spark-toast';
        el.setAttribute('role', 'status');
        doc.body.appendChild(el);
      }
      el.textContent = '✦ +' + gained + ' Sparks';
      try {
        const view = doc.defaultView;
        if (view && view.HudSafe && view.HudSafe.apply) view.HudSafe.apply();
      } catch (e) { /* the pill still shows if the safe zone is late */ }
      clearTimeout(toast._t);
      toast._t = setTimeout(function () {
        if (el.parentNode) el.remove();
        try {
          const view = doc.defaultView;
          if (view && view.HudSafe && view.HudSafe.schedule) view.HudSafe.schedule();
        } catch (e) { /* the shelf returns when the next measure runs */ }
      }, 2400);
    }

    function el(doc, tag, className, text) {
      const node = doc.createElement(tag);
      if (className) node.className = className;
      if (text != null) node.textContent = text;
      return node;
    }

    function paintStage(ctx, w, h, item, t, revealing) {
      ctx.clearRect(0, 0, w, h);
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#2a2118');
      sky.addColorStop(1, '#100e12');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      const ground = h * 0.78;
      ctx.strokeStyle = 'rgba(247,201,72,.28)';
      ctx.beginPath();
      ctx.moveTo(8, ground);
      ctx.lineTo(w - 8, ground);
      ctx.stroke();
      if (!item) return;
      if (item.slot === 'cards') return paintCard(ctx, w, h, item, t);
      if (item.slot === 'badge') return paintBadge(ctx, w, h, item, t, revealing);
      if (item.slot === 'title') return paintPlaque(ctx, w, h, item, t, revealing);
      if (item.slot === 'kitchen') return paintKitchen(ctx, w, h, item, t, revealing);
      if (item.slot === 'tent') return paintTent(ctx, w, h, item, t, revealing);
      if (item.slot === 'lamp') return paintLamp(ctx, w, h, item, t, revealing);
      if (item.slot === 'pendant') return paintPendant(ctx, w, h, item, t, revealing);
      const x = w * (0.32 + Math.sin(t * 1.3) * 0.18);
      paintMarch(ctx, x, ground, h, item, t, revealing);
      if (revealing) paintBurst(ctx, w, h, t);
    }

    function paintBurst(ctx, w, h, t) {
      const u = Math.max(0, Math.min(1, t));
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        const rad = 16 + u * Math.min(w, h) * 0.42;
        ctx.globalAlpha = 1 - u;
        ctx.fillStyle = i % 2 ? '#f7c948' : '#fff6d0';
        ctx.beginPath();
        ctx.arc(w / 2 + Math.cos(a) * rad, h * 0.5 + Math.sin(a) * rad * 0.55, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function paintMarch(ctx, x, ground, h, item, t, revealing) {
      const scale = Math.max(1, h / 200);
      const color = item.color || '#f7c948';
      if (item.slot === 'palette') {
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.ellipse(x, ground - 2, 28 * scale, 8 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (item.slot === 'trail') {
        for (let i = 6; i >= 1; i--) {
          const px = x - i * 14 * scale;
          const age = i / 7;
          const rise = item.style === 'firefly' ? Math.sin(t * 4 + i) * 8 : (1 - age) * 16;
          ctx.globalAlpha = 1 - age;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(px, ground - 18 * scale - rise, (item.style === 'firefly' ? 3.4 : 4.2) * (1 - age * 0.4), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = '#c9845a';
      ctx.fillRect(x - 7 * scale, ground - 46 * scale, 14 * scale, 16 * scale);
      ctx.fillStyle = item.slot === 'palette' ? color : '#3d6ea8';
      ctx.fillRect(x - 11 * scale, ground - 32 * scale, 22 * scale, 20 * scale);
      ctx.fillStyle = '#2a241c';
      ctx.fillRect(x - 5 * scale, ground - 14 * scale, 4 * scale, 14 * scale);
      ctx.fillRect(x + 1 * scale, ground - 14 * scale, 4 * scale, 14 * scale);
      if (item.slot === 'skin') {
        const wave = Math.sin(t * 3) * 4;
        ctx.strokeStyle = item.accent || '#5a3a12';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 16 * scale, ground - 4);
        ctx.lineTo(x - 16 * scale, ground - 52 * scale);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x - 16 * scale, ground - 52 * scale);
        ctx.lineTo(x - 42 * scale, ground - 40 * scale + wave);
        ctx.lineTo(x - 16 * scale, ground - 30 * scale);
        ctx.fill();
      }
      if (item.slot === 'glass') {
        const accent = item.accent || '#ff7a18';
        // Shade over the figure, then the lamp bar. Offsets stay inside a
        // short shop thumb, where the ground sits near the bottom.
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(x - 28 * scale, ground - 54 * scale, 56 * scale, 10 * scale);
        ctx.globalAlpha = 1;
        ctx.fillStyle = color;
        ctx.fillRect(x - 20 * scale, ground - 64 * scale, 40 * scale, 7 * scale);
        ctx.fillStyle = accent;
        ctx.fillRect(x - 16 * scale, ground - 62 * scale, 32 * scale, 3 * scale);
      }
      if (revealing) {
        ctx.strokeStyle = 'rgba(247,201,72,.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, ground - 28 * scale, 30 * scale + Math.sin(t * 6) * 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    function paintTent(ctx, w, h, item, t, revealing) {
      const color = item.color || '#e8a04a';
      const accent = item.accent || '#ffe38a';
      const ground = h * 0.78;
      const cx = w * 0.52;
      const rise = Math.sin(t * 2) * 2;
      ctx.fillStyle = '#2a4030';
      ctx.beginPath();
      ctx.moveTo(cx - 78, ground);
      ctx.lineTo(cx, ground - 86 + rise);
      ctx.lineTo(cx + 78, ground);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.92;
      ctx.beginPath();
      ctx.moveTo(cx - 70, ground - 2);
      ctx.lineTo(cx, ground - 96 + rise);
      ctx.lineTo(cx + 70, ground - 2);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(4, h * 0.035);
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - 46, ground - 14);
      ctx.lineTo(cx, ground - 78 + rise);
      ctx.lineTo(cx + 46, ground - 14);
      ctx.stroke();
      if (revealing) paintBurst(ctx, w, h, t);
    }

    function paintBadge(ctx, w, h, item, t, revealing) {
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(w, h) * 0.28;
      ctx.fillStyle = '#3a2a12';
      ctx.beginPath();
      ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f7c948';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a140c';
      ctx.font = '700 ' + Math.round(r) + 'px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.glyph || '✦', cx, cy + 1);
      if (revealing) paintBurst(ctx, w, h, t);
    }

    function paintPlaque(ctx, w, h, item, t, revealing) {
      const bw = Math.min(w - 32, 280);
      const bh = 54;
      const x = (w - bw) / 2;
      const y = h / 2 - bh / 2 + Math.sin(t * 2) * 3;
      ctx.fillStyle = '#3a2a12';
      ctx.fillRect(x, y, bw, bh);
      ctx.strokeStyle = '#f7c948';
      ctx.strokeRect(x + 4, y + 4, bw - 8, bh - 8);
      ctx.fillStyle = '#f7c948';
      ctx.font = '800 22px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.name, w / 2, y + bh / 2);
      if (revealing) paintBurst(ctx, w, h, t);
    }

    function paintKitchen(ctx, w, h, item, t, revealing) {
      const scale = Math.max(1, h / 160);
      const x = w * 0.5;
      const ground = h * 0.78;
      const sway = Math.sin(t * 2) * 3;
      ctx.fillStyle = '#6a4820';
      ctx.fillRect(x - 46 * scale, ground - 10 * scale, 92 * scale, 8 * scale);
      ctx.fillStyle = item.color || '#e23b6a';
      ctx.beginPath();
      ctx.moveTo(x - 50 * scale, ground - 36 * scale);
      ctx.lineTo(x + 50 * scale, ground - 36 * scale);
      ctx.lineTo(x + 40 * scale, ground - 18 * scale + sway);
      ctx.lineTo(x - 40 * scale, ground - 18 * scale - sway);
      ctx.fill();
      ctx.fillStyle = item.accent || '#3ef0d0';
      ctx.fillRect(x - 40 * scale, ground - 20 * scale, 80 * scale, 6 * scale);
      if (revealing) paintBurst(ctx, w, h, t);
    }

    function paintLamp(ctx, w, h, item, t, revealing) {
      const scale = Math.max(1, h / 160);
      const bob = Math.sin(t * 2) * 2;
      const x = w * 0.5;
      const ground = h * 0.78;
      ctx.fillStyle = '#5c3d1e';
      ctx.fillRect(x - 54 * scale, ground - 8 * scale, 108 * scale, 10 * scale);
      ctx.fillStyle = '#c48a3a';
      ctx.fillRect(x - 4 * scale, ground - 46 * scale + bob, 8 * scale, 38 * scale);
      ctx.fillStyle = item.color || '#ffb24a';
      ctx.fillRect(x - 28 * scale, ground - 62 * scale + bob, 56 * scale, 18 * scale);
      ctx.fillStyle = item.accent || '#ffe7a8';
      ctx.beginPath();
      ctx.arc(x, ground - 50 * scale + bob, 5 * scale, 0, Math.PI * 2);
      ctx.fill();
      if (revealing) paintBurst(ctx, w, h, t);
    }

    function paintPendant(ctx, w, h, item, t, revealing) {
      const scale = Math.max(1, h / 160);
      const x = w * 0.5;
      const y = h * 0.42 + Math.sin(t * 2) * 2;
      ctx.strokeStyle = '#2a2a2e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y - 28 * scale);
      ctx.lineTo(x, y - 8 * scale);
      ctx.stroke();
      ctx.fillStyle = item.color || '#149e86';
      ctx.beginPath();
      ctx.moveTo(x - 28 * scale, y + 10 * scale);
      ctx.lineTo(x, y - 8 * scale);
      ctx.lineTo(x + 28 * scale, y + 10 * scale);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = item.accent || '#2ee6c7';
      ctx.fillRect(x - 30 * scale, y + 8 * scale, 60 * scale, 5 * scale);
      if (revealing) paintBurst(ctx, w, h, t);
    }

    function paintCard(ctx, w, h, item, t) {
      const cw = Math.min(w * 0.62, 240);
      const ch = Math.min(h * 0.62, 120);
      const x = (w - cw) / 2;
      const y = (h - ch) / 2 + Math.sin(t) * 3;
      ctx.fillStyle = '#1c2430';
      ctx.fillRect(x, y, cw, ch);
      ctx.strokeStyle = item.color || '#f0a04b';
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 1.5, y + 1.5, cw - 3, ch - 3);
      ctx.fillStyle = item.color || '#f0a04b';
      ctx.fillRect(x, y, 8, ch);
      ctx.fillStyle = '#f4f1ea';
      ctx.font = '800 16px system-ui,sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.name, x + 20, y + ch / 2);
    }

    function drawThumb(canvas, item) {
      const doc = document();
      if (!canvas || !doc) return;
      const w = canvas.clientWidth || 200;
      const h = canvas.clientHeight || 84;
      const dpr = 1;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      paintStage(ctx, w, h, item, 0.8, false);
    }

    function mount(rootEl) {
      const doc = document();
      if (!doc || !rootEl) return;
      ensureCss();
      const old = rootEl.querySelector('#spark-shop');
      if (old) old.remove();
      const docCareer = load();
      const snap = look();
      const section = el(doc, 'section', '');
      section.id = 'spark-shop';
      const head = el(doc, 'div', 'spark-head');
      head.appendChild(el(doc, 'h2', 'trophy-h', 'Spark Shop'));
      const bal = el(doc, 'div', 'spark-balance', '✦ ' + (docCareer.sparks | 0));
      bal.setAttribute('aria-live', 'polite');
      head.appendChild(bal);
      section.appendChild(head);
      section.appendChild(el(doc, 'p', 'spark-rules',
        'Sparks stay on this device. 1 per ' + RATES.xp + ' XP, ' + RATES.ach + ' per trophy, ' +
        RATES.flag + ' for a flagship daily, ' + RATES.arcade + ' for an arcade daily, ' + RATES.boss + ' per boss.'));
      const filters = el(doc, 'div', 'spark-filters');
      for (let i = 0; i < SLOTS.length; i++) {
        const slot = SLOTS[i];
        const btn = el(doc, 'button', 'spark-filter' + (filter === slot.id ? ' is-on' : ''), slot.name);
        btn.type = 'button';
        btn.setAttribute('aria-pressed', filter === slot.id ? 'true' : 'false');
        btn.addEventListener('click', function () { filter = slot.id; mount(rootEl); });
        filters.appendChild(btn);
      }
      section.appendChild(filters);
      const grid = el(doc, 'div', 'spark-grid');
      for (let i = 0; i < CATALOG.length; i++) {
        const item = CATALOG[i];
        if (filter !== 'all' && item.slot !== filter) continue;
        const have = owned(docCareer, item.id);
        const worn = snap[item.slot] && snap[item.slot].id === item.id;
        const card = el(doc, 'article', 'spark-card' + (worn ? ' is-on' : ''));
        card.setAttribute('data-id', item.id);
        const thumb = doc.createElement('canvas');
        thumb.className = 'spark-thumb';
        thumb.width = 2;
        thumb.height = 2;
        thumb.setAttribute('aria-hidden', 'true');
        card.appendChild(thumb);
        card.appendChild(el(doc, 'h3', '', item.name));
        card.appendChild(el(doc, 'p', '', item.blurb));
        card.appendChild(el(doc, 'p', '', item.games.join(' · ') + (have ? ' · owned' : ' · ✦ ' + item.cost)));
        const actions = el(doc, 'div', 'spark-card-actions');
        const previewBtn = el(doc, 'button', 'spark-preview', 'Preview');
        previewBtn.type = 'button';
        previewBtn.addEventListener('click', function () { openModal(item, false); });
        const buyBtn = el(doc, 'button', 'spark-buy', have ? (worn ? 'Take off' : 'Wear') : '✦ ' + item.cost);
        buyBtn.type = 'button';
        if (!have && (docCareer.sparks | 0) < item.cost) {
          buyBtn.disabled = true;
          buyBtn.textContent = 'Need ' + (item.cost - (docCareer.sparks | 0));
          buyBtn.title = 'Need ' + (item.cost - (docCareer.sparks | 0)) + ' more Sparks';
        }
        buyBtn.addEventListener('click', function () {
          if (!have) buy(item.id);
          else if (worn) unequip(item.slot);
          else equip(item.id);
        });
        actions.appendChild(previewBtn);
        actions.appendChild(buyBtn);
        card.appendChild(actions);
        grid.appendChild(card);
      }
      section.appendChild(grid);
      const profile = rootEl.querySelector('.trophy-profile');
      if (profile && profile.nextSibling) rootEl.insertBefore(section, profile.nextSibling);
      else rootEl.appendChild(section);
      const cards = section.querySelectorAll('.spark-card');
      for (let i = 0; i < cards.length; i++) {
        drawThumb(cards[i].querySelector('canvas'), itemById(cards[i].getAttribute('data-id')));
      }
      decorate(rootEl);
      apply();
      try {
        const view = doc.defaultView;
        if (view && view.HudSafe && view.HudSafe.schedule) view.HudSafe.schedule();
      } catch (e) { /* the shop still paints if the safe zone is late */ }
    }

    function decorate(rootEl) {
      const doc = document();
      if (!doc || !rootEl) return;
      const worn = look();
      const kicker = rootEl.querySelector('.trophy-kicker');
      if (kicker) {
        const base = kicker.dataset.careerTitle || kicker.textContent;
        kicker.textContent = worn.title ? base + ' · ' + worn.title.name : base;
      }
      const face = rootEl.querySelector('.trophy-face');
      if (face) {
        let mark = face.querySelector('.trophy-badge');
        if (worn.badge) {
          if (!mark) {
            mark = doc.createElement('span');
            mark.className = 'trophy-badge';
            face.appendChild(mark);
          }
          mark.textContent = worn.badge.glyph;
          mark.setAttribute('aria-label', worn.badge.name + ', equipped');
          mark.setAttribute('role', 'img');
        } else if (mark) mark.remove();
      }
    }

    function fitCanvas(canvas) {
      const w = canvas.clientWidth || 320;
      const h = canvas.clientHeight || 200;
      const dpr = Math.min(2, (document() && document().defaultView && document().defaultView.devicePixelRatio) || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { ctx: ctx, w: w, h: h };
    }

    function stopLoop() {
      if (!raf) return;
      const view = document() && document().defaultView;
      if (view && view.cancelAnimationFrame) view.cancelAnimationFrame(raf);
      raf = 0;
    }

    function closeModal() {
      stopLoop();
      const doc = document();
      const layer = doc && doc.getElementById('spark-reveal');
      if (layer) layer.remove();
      modalItem = null;
      if (doc && doc.removeEventListener) doc.removeEventListener('keydown', onKey);
      if (lastFocus && lastFocus.focus) {
        try { lastFocus.focus(); } catch (e) { /* focus is a courtesy */ }
      }
      lastFocus = null;
    }

    function onKey(e) {
      if (e && e.key === 'Escape') closeModal();
    }

    function openModal(item, revealing) {
      const doc = document();
      if (!doc || !doc.body || !item) return;
      ensureCss();
      closeModal();
      modalItem = item;
      revealAt = revealing ? now() : 0;
      lastFocus = doc.activeElement;
      const layer = el(doc, 'div', 'spark-reveal');
      layer.id = 'spark-reveal';
      layer.setAttribute('role', 'dialog');
      layer.setAttribute('aria-modal', 'true');
      layer.setAttribute('aria-labelledby', 'spark-reveal-name');
      if (revealing) layer.classList.add('is-reveal');
      const sheet = el(doc, 'div', 'spark-sheet' + (revealing ? ' is-reveal' : ''));
      const kicker = el(doc, 'p', 'spark-kicker', revealing ? 'Unlocked' : 'Preview');
      kicker.id = 'spark-reveal-kicker';
      const title = el(doc, 'h2', '', item.name);
      title.id = 'spark-reveal-name';
      const stage = doc.createElement('canvas');
      stage.id = 'spark-reveal-stage';
      const blurb = el(doc, 'p', 'spark-rules', item.blurb + ' Shows in ' + item.games.join(' and ') + '.');
      const actions = el(doc, 'div', 'spark-actions');
      const primary = el(doc, 'button', '', 'Close');
      primary.type = 'button';
      primary.id = 'spark-reveal-buy';
      const closeBtn = el(doc, 'button', '', 'Close');
      closeBtn.type = 'button';
      closeBtn.id = 'spark-reveal-close';
      closeBtn.addEventListener('click', closeModal);
      actions.appendChild(primary);
      actions.appendChild(closeBtn);
      sheet.appendChild(kicker);
      sheet.appendChild(title);
      sheet.appendChild(stage);
      sheet.appendChild(blurb);
      sheet.appendChild(actions);
      layer.appendChild(sheet);
      layer.addEventListener('click', function (e) { if (e.target === layer) closeModal(); });
      doc.body.appendChild(layer);
      doc.addEventListener('keydown', onKey);
      paintModal(stage, primary, item);
      const view = doc.defaultView;
      const still = reducedMotion();
      if (!still && view && view.requestAnimationFrame) {
        const started = view.performance ? view.performance.now() : now();
        function frame(ts) {
          if (!doc.getElementById('spark-reveal')) return;
          const elapsed = ((ts || 0) - started) / 1000;
          const fit = fitCanvas(stage);
          if (fit.ctx) paintStage(fit.ctx, fit.w, fit.h, item, revealing ? Math.min(1, elapsed / 0.9) : elapsed, revealing && elapsed < 1.1);
          raf = view.requestAnimationFrame(frame);
        }
        raf = view.requestAnimationFrame(frame);
      }
      wirePrimary(primary, item);
      try { primary.focus(); } catch (e) { /* focus is a courtesy */ }
    }

    function paintModal(stage, primary, item) {
      const fit = fitCanvas(stage);
      if (fit.ctx) paintStage(fit.ctx, fit.w, fit.h, item, revealAt ? 0.2 : 0.8, !!revealAt);
      wirePrimary(primary, item);
    }

    function wirePrimary(primary, item) {
      const docCareer = load();
      const have = owned(docCareer, item.id);
      const worn = docCareer.equipped && docCareer.equipped[item.slot] === item.id;
      if (revealAt && have) {
        primary.disabled = false;
        primary.textContent = "It's mine";
        primary.onclick = function () { closeModal(); };
        return;
      }
      primary.onclick = function () {
        if (!have) {
          const res = buy(item.id);
          if (res && res.ok) return;
          paintModal(document().getElementById('spark-reveal-stage'), primary, item);
          return;
        }
        if (worn) unequip(item.slot);
        else equip(item.id);
        closeModal();
      };
      if (!have) {
        if ((docCareer.sparks | 0) < item.cost) {
          primary.disabled = true;
          primary.textContent = 'Need ' + (item.cost - (docCareer.sparks | 0)) + ' Sparks';
        } else {
          primary.disabled = false;
          primary.textContent = 'Buy · ✦ ' + item.cost;
        }
      } else if (worn) {
        primary.disabled = false;
        primary.textContent = 'Wearing';
      } else {
        primary.disabled = false;
        primary.textContent = 'Wear';
      }
    }

    function repaint() {
      const doc = document();
      if (!doc) return;
      const view = doc.getElementById('view-trophy');
      try {
        const progress = env.progress && env.progress();
        if (view && view.classList.contains('active') && progress && progress.render) {
          progress.render('trophy-room');
          return;
        }
      } catch (e) { /* fall through to a local rebuild */ }
      const room = doc.getElementById('trophy-room');
      if (room && room.querySelector('#spark-shop')) mount(room);
      else decorate(room);
    }

    return {
      fold: fold,
      settle: settle,
      grantDaily: grantDaily,
      purse: purse,
      look: look,
      apply: apply,
      preview: preview,
      buy: buy,
      equip: equip,
      unequip: unequip,
      mount: mount,
      CATALOG: CATALOG,
    };
  }

  function attach(root) {
    const api = create(root.EurekaPersist, {
      document: root.document,
      storage: root.localStorage,
      sfx: function () { return root.SFX; },
      audio: function () { return root.EurekaAudio; },
      progress: function () { return root.EurekaProgress; },
      achievementIds: function () {
        try {
          if (root.EurekaProgress && root.EurekaProgress.achievementIds) return root.EurekaProgress.achievementIds();
        } catch (e) { /* the list arrives with the career script */ }
        return [];
      },
    });
    try {
      if (root.EurekaProgress && root.EurekaProgress.onChange) {
        root.EurekaProgress.onChange(function () { api.settle(); });
      }
    } catch (e) { /* settle still runs on boot */ }
    try { api.settle(); api.apply(); } catch (e) { /* a purse cannot block boot */ }
    return api;
  }

  return { create: create, attach: attach, CATALOG: CATALOG, RATES: RATES, BOSS_KEYS: BOSS_KEYS.slice() };
});
