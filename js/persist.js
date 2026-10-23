/* ============================================
   PERSIST — shared settings and progress index
   for the flagship games.

   One origin, one pair of keys, owned here so
   the games do not each invent a mute flag.
   The document is versioned. A newer document
   is read and left untouched; a corrupt one
   cannot throw the boot path.

   Settings (sound, music, mute) are shared.
   Progress stays in each game's own save; this
   index only records that a continue exists
   and clears with Reset progress.
   ============================================ */

(function (root, factory) {
  const exported = factory();
  if (typeof module === 'object' && module.exports) module.exports = exported;
  try {
    if (root && root.document && root.localStorage) {
      root.EurekaPersist = exported.create(root.localStorage);
    }
  } catch (e) { /* storage blocked — games keep their own saves */ }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SCHEMA = 1;
  const SETTINGS_KEY = 'eureka-settings';
  const PROGRESS_KEY = 'eureka-progress';
  const GAME_ID = /^[a-z0-9-]{1,32}$/;

  const DEFAULTS = {
    v: SCHEMA,
    muted: false,
    sfx: 1,
    music: 1,
    musicOn: true,
    touched: false,
  };

  function clamp01(n, dflt) {
    const x = Number(n);
    if (!Number.isFinite(x)) return dflt;
    return Math.min(1, Math.max(0, x));
  }

  function asBool(v, dflt) {
    if (typeof v === 'boolean') return v;
    if (v === 1 || v === '1' || v === 'true') return true;
    if (v === 0 || v === '0' || v === 'false') return false;
    return dflt;
  }

  function readRaw(storage, key) {
    let text = null;
    try { text = storage.getItem(key); } catch (e) { return { ok: false, text: null, value: undefined }; }
    if (text == null || text === '') return { ok: true, text: text, value: undefined, empty: true };
    try { return { ok: true, text: text, value: JSON.parse(text), empty: false }; }
    catch (e) { return { ok: false, text: text, value: undefined, corrupt: true }; }
  }

  function writeRaw(storage, key, value) {
    try {
      storage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function legacyMuted(storage) {
    const checks = [
      ['arcade-muted', '1'],
      ['aow-muted', '1'],
      ['tycoon:sfxEnabled', '0'],
      ['beagle:sfxEnabled', '0'],
    ];
    for (let i = 0; i < checks.length; i++) {
      try {
        if (storage.getItem(checks[i][0]) === checks[i][1]) return true;
      } catch (e) { /* private mode */ }
    }
    return false;
  }

  function pickNumber(obj, keys, dflt) {
    for (let i = 0; i < keys.length; i++) {
      if (obj[keys[i]] != null && obj[keys[i]] !== '') return clamp01(obj[keys[i]], dflt);
    }
    return dflt;
  }

  // Known fields, plus anything a newer build stored beside them.
  function normalizeSettings(value, storage) {
    if (value == null || value === '') {
      if (legacyMuted(storage)) {
        return { doc: Object.assign({}, DEFAULTS, { muted: true, touched: true }), migrated: true };
      }
      return { doc: Object.assign({}, DEFAULTS), migrated: false };
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      const muted = asBool(value, false);
      return { doc: Object.assign({}, DEFAULTS, { muted: muted, touched: true }), migrated: true };
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
      return { doc: Object.assign({}, DEFAULTS), migrated: false, replace: false };
    }

    const muted = asBool(
      value.muted != null ? value.muted : value.mute,
      DEFAULTS.muted
    );
    const sfx = pickNumber(value, ['sfx', 'sound', 'volume'], DEFAULTS.sfx);
    const music = pickNumber(value, ['music', 'musicVolume'], DEFAULTS.music);
    let musicOn = asBool(value.musicOn, music > 0);
    if (value.musicOn == null && (value.music === 0 || value.musicVolume === 0)) musicOn = false;
    const touched = asBool(value.touched, value.v == null ? (muted || sfx !== 1 || music !== 1 || !musicOn) : DEFAULTS.touched);
    const storedV = Number(value.v);
    const newer = Number.isFinite(storedV) && storedV > SCHEMA;
    const doc = {
      v: newer ? storedV : SCHEMA,
      muted: muted,
      sfx: sfx,
      music: musicOn ? music : (music > 0 ? music : DEFAULTS.music),
      musicOn: musicOn,
      touched: !!touched,
    };
    // A missing version, or a version we understand, is rewritten once
    // so the next read is the current shape. A newer version is not.
    const migrated = !newer && (value.v !== SCHEMA || value.muted !== doc.muted || value.sfx !== doc.sfx
      || value.music !== doc.music || value.musicOn !== doc.musicOn || value.touched !== doc.touched);
    return { doc: doc, migrated: migrated, previous: value, keepVersion: newer };
  }

  function cleanSummary(summary) {
    const out = {};
    if (!summary || typeof summary !== 'object' || Array.isArray(summary)) return out;
    const keys = Object.keys(summary).slice(0, 12);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (!/^[a-zA-Z][a-zA-Z0-9]{0,24}$/.test(k)) continue;
      const v = summary[k];
      if (typeof v === 'boolean') out[k] = v;
      else if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
      else if (typeof v === 'string') out[k] = v.slice(0, 80);
    }
    return out;
  }

  function normEntry(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const savedAt = Number(raw.savedAt);
    let summary = raw.summary;
    if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
      summary = {};
      const keys = Object.keys(raw);
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (k === 'savedAt' || k === 'v' || k === 'summary') continue;
        summary[k] = raw[k];
      }
    }
    const entry = {
      savedAt: Number.isFinite(savedAt) ? savedAt : 0,
      summary: cleanSummary(summary),
    };
    const keys = Object.keys(raw);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (k === 'savedAt' || k === 'summary') continue;
      entry[k] = raw[k];
    }
    entry.savedAt = Number.isFinite(savedAt) ? savedAt : 0;
    entry.summary = cleanSummary(summary);
    return entry;
  }

  function normalizeProgress(value) {
    const empty = { v: SCHEMA, games: {} };
    if (value == null) return { doc: empty, previous: null, keepVersion: false };
    if (typeof value !== 'object' || Array.isArray(value)) return { doc: empty, previous: null, keepVersion: false };
    const storedV = Number(value.v);
    const newer = Number.isFinite(storedV) && storedV > SCHEMA;
    const source = value.games && typeof value.games === 'object' && !Array.isArray(value.games)
      ? value.games
      : (value.v == null ? value : {});
    const games = {};
    const ids = Object.keys(source);
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (!GAME_ID.test(id) || id === 'v' || id === 'games') continue;
      const entry = normEntry(source[id]);
      if (entry) games[id] = entry;
    }
    return {
      doc: { v: newer ? storedV : SCHEMA, games: games },
      previous: value,
      keepVersion: newer,
    };
  }

  function mergeWrite(previous, doc, keepVersion) {
    const base = previous && typeof previous === 'object' && !Array.isArray(previous) ? previous : {};
    const out = {};
    const keys = Object.keys(base);
    for (let i = 0; i < keys.length; i++) out[keys[i]] = base[keys[i]];
    const nextKeys = Object.keys(doc);
    for (let i = 0; i < nextKeys.length; i++) out[nextKeys[i]] = doc[nextKeys[i]];
    out.v = keepVersion && Number(base.v) > SCHEMA ? base.v : doc.v;
    return out;
  }

  function create(storage) {
    if (!storage) throw new Error('EurekaPersist.create requires a Storage');
    let settingsCache = null;
    let progressCache = null;
    const listeners = [];

    function loadSettings() {
      const raw = readRaw(storage, SETTINGS_KEY);
      if (raw.corrupt) {
        settingsCache = Object.assign({}, DEFAULTS);
        return settingsCache;
      }
      const norm = normalizeSettings(raw.empty ? undefined : raw.value, storage);
      settingsCache = norm.doc;
      if (norm.migrated) {
        const payload = mergeWrite(norm.previous, norm.doc, norm.keepVersion);
        if (writeRaw(storage, SETTINGS_KEY, payload)) settingsCache = norm.doc;
      }
      return settingsCache;
    }

    function loadProgress() {
      const raw = readRaw(storage, PROGRESS_KEY);
      if (raw.corrupt || raw.empty || raw.value == null) {
        progressCache = { v: SCHEMA, games: {} };
        return progressCache;
      }
      const norm = normalizeProgress(raw.value);
      progressCache = norm.doc;
      progressCache._previous = norm.previous;
      progressCache._keepVersion = norm.keepVersion;
      return progressCache;
    }

    function settings() {
      if (!settingsCache) loadSettings();
      return {
        v: settingsCache.v,
        muted: !!settingsCache.muted,
        sfx: settingsCache.sfx,
        music: settingsCache.music,
        musicOn: !!settingsCache.musicOn,
        touched: !!settingsCache.touched,
      };
    }

    function notify() {
      const snap = settings();
      for (let i = 0; i < listeners.length; i++) {
        try { listeners[i](snap); } catch (e) { /* a listener cannot break a save */ }
      }
    }

    function update(patch) {
      const cur = settings();
      const next = {
        v: settingsCache.v > SCHEMA ? settingsCache.v : SCHEMA,
        muted: patch && patch.muted != null ? asBool(patch.muted, cur.muted) : cur.muted,
        sfx: patch && patch.sfx != null ? clamp01(patch.sfx, cur.sfx) : cur.sfx,
        music: patch && patch.music != null ? clamp01(patch.music, cur.music) : cur.music,
        musicOn: patch && patch.musicOn != null ? asBool(patch.musicOn, cur.musicOn) : cur.musicOn,
        touched: patch && patch.touched != null ? asBool(patch.touched, cur.touched) : cur.touched,
      };
      if (next.music === 0) next.music = cur.music > 0 ? cur.music : DEFAULTS.music;
      if (next.muted === cur.muted && next.sfx === cur.sfx && next.music === cur.music
          && next.musicOn === cur.musicOn && next.touched === cur.touched) {
        return settings();
      }
      const raw = readRaw(storage, SETTINGS_KEY);
      const previous = raw.ok && raw.value && typeof raw.value === 'object' && !Array.isArray(raw.value) ? raw.value : null;
      const keepVersion = !!(previous && Number(previous.v) > SCHEMA);
      const payload = mergeWrite(previous, next, keepVersion);
      if (!writeRaw(storage, SETTINGS_KEY, payload)) return settings();
      settingsCache = {
        v: payload.v,
        muted: next.muted,
        sfx: next.sfx,
        music: next.music,
        musicOn: next.musicOn,
        touched: next.touched,
      };
      notify();
      return settings();
    }

    function subscribe(fn) {
      if (typeof fn !== 'function') return function () {};
      listeners.push(fn);
      return function () {
        const i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      };
    }

    function audioSfx(localMuted) {
      const s = settings();
      if (s.touched) return s.muted ? 0 : s.sfx;
      if (localMuted) return 0;
      return s.sfx;
    }

    function audioMusic(localMuted, localOff) {
      const s = settings();
      if (s.touched) {
        if (s.muted || !s.musicOn) return 0;
        return s.music;
      }
      if (localMuted || localOff) return 0;
      return s.music;
    }

    function apply(localMuted, localMusicOff) {
      const s = settings();
      if (!s.touched) return { muted: !!localMuted, musicOff: !!localMusicOff };
      return { muted: !!s.muted, musicOff: !!s.muted || !s.musicOn };
    }

    function progressState() {
      if (!progressCache) loadProgress();
      return progressCache;
    }

    function writeProgress(games) {
      const state = progressState();
      const previous = state._previous && typeof state._previous === 'object' ? state._previous : null;
      const keepVersion = !!state._keepVersion;
      const payload = mergeWrite(previous, { v: keepVersion ? state.v : SCHEMA, games: games }, keepVersion);
      payload.games = games;
      if (!writeRaw(storage, PROGRESS_KEY, payload)) return false;
      progressCache = { v: payload.v, games: games, _previous: payload, _keepVersion: keepVersion };
      return true;
    }

    // The career (name, level, trophies) lives on the same progress
    // document as the continue index. Games still own their saves.
    // A read never writes. A bad blob cannot throw the boot path.
    function cleanName(value) {
      return String(value || '').replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
    }

    function cleanId(value) {
      return typeof value === 'string' && /^[a-z0-9-]{1,24}$/.test(value) ? value : '';
    }

    function cleanCountMap(raw, keyOk, limit, cap) {
      const out = {};
      const max = Number.isFinite(cap) ? cap : 1e9;
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
      const keys = Object.keys(raw).slice(0, limit);
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (!keyOk.test(k)) continue;
        const n = Number(raw[k]);
        if (!Number.isFinite(n) || n <= 0) continue;
        out[k] = Math.min(max, Math.floor(n));
      }
      return out;
    }

    function cleanLedger(raw) {
      const xp = raw && Number(raw.xp);
      return {
        xp: Number.isFinite(xp) ? Math.min(1e7, Math.max(0, Math.floor(xp))) : 0,
        ach: cleanCountMap(raw && raw.ach, /^[a-z0-9-]{1,32}$/, 80, 1),
        boss: cleanCountMap(raw && raw.boss, /^[a-z][a-z0-9.-]{0,40}$/, 12, 1e6),
        daily: cleanCountMap(raw && raw.daily, /^[a-z0-9:-]{1,48}$/, 64, 1),
      };
    }

    function cleanEquipped(raw) {
      const slots = { skin: 1, trail: 1, palette: 1, cards: 1, title: 1, badge: 1, kitchen: 1, glass: 1, tent: 1, lamp: 1, pendant: 1, tarp: 1 };
      const out = {};
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
      const keys = Object.keys(raw);
      for (let i = 0; i < keys.length; i++) {
        if (!slots[keys[i]]) continue;
        const id = cleanId(raw[keys[i]]);
        if (id) out[keys[i]] = id;
      }
      return out;
    }

    function cleanCareer(raw) {
      const empty = {
        name: '', avatar: '', title: '', theme: '', xp: 0, unlocked: {}, stats: {},
        sparks: 0, ledger: cleanLedger(null), owned: {}, equipped: {},
      };
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return empty;
      const xp = Number(raw.xp);
      const sparks = Number(raw.sparks);
      return {
        name: cleanName(raw.name),
        avatar: cleanId(raw.avatar),
        title: cleanId(raw.title),
        theme: cleanId(raw.theme),
        xp: Number.isFinite(xp) ? Math.min(1e7, Math.max(0, Math.floor(xp))) : 0,
        // Unlock times are epoch milliseconds. Counts stay small.
        unlocked: cleanCountMap(raw.unlocked, /^[a-z0-9-]{1,32}$/, 80, 1e13),
        stats: cleanCountMap(raw.stats, /^[a-z][a-z0-9.-]{0,40}$/, 80, 1e9),
        // Hub Sparks and the cosmetics they buy. Missing on older saves.
        sparks: Number.isFinite(sparks) ? Math.min(1e7, Math.max(0, Math.floor(sparks))) : 0,
        ledger: cleanLedger(raw.ledger),
        owned: cleanCountMap(raw.owned, /^[a-z0-9-]{1,24}$/, 40, 1e13),
        equipped: cleanEquipped(raw.equipped),
      };
    }

    function career() {
      const state = progressState();
      const raw = state._previous && state._previous.career;
      return cleanCareer(raw);
    }

    function saveCareer(next) {
      const cleaned = cleanCareer(next);
      const state = progressState();
      const previous = state._previous && typeof state._previous === 'object' && !Array.isArray(state._previous)
        ? state._previous
        : null;
      const keepVersion = !!state._keepVersion;
      const games = state.games || {};
      const payload = mergeWrite(previous, {
        v: keepVersion ? (Number(state.v) || SCHEMA) : SCHEMA,
        games: games,
        career: cleaned,
      }, keepVersion);
      payload.games = games;
      payload.career = cleaned;
      if (!writeRaw(storage, PROGRESS_KEY, payload)) return career();
      progressCache = { v: payload.v, games: games, _previous: payload, _keepVersion: keepVersion };
      return career();
    }

    function note(id, summary) {
      if (!GAME_ID.test(String(id || ''))) return false;
      const games = Object.assign({}, progressState().games);
      const prev = games[id] && typeof games[id] === 'object' ? games[id] : {};
      const entry = {};
      const keys = Object.keys(prev);
      for (let i = 0; i < keys.length; i++) entry[keys[i]] = prev[keys[i]];
      entry.savedAt = Date.now();
      entry.summary = cleanSummary(summary);
      games[id] = entry;
      return writeProgress(games);
    }

    function has(id) {
      if (!GAME_ID.test(String(id || ''))) return false;
      return !!progressState().games[id];
    }

    function getProgress(id) {
      if (!has(id)) return null;
      const entry = progressState().games[id];
      return {
        savedAt: entry.savedAt,
        summary: Object.assign({}, entry.summary || {}),
      };
    }

    function clear(id) {
      if (!GAME_ID.test(String(id || ''))) return false;
      const games = Object.assign({}, progressState().games);
      if (!games[id]) return true;
      delete games[id];
      return writeProgress(games);
    }

    function displayed(opts) {
      const s = settings();
      opts = opts || {};
      if (s.touched) {
        return { muted: s.muted, sfx: s.sfx, music: s.musicOn ? s.music : 0 };
      }
      const localMuted = typeof opts.localMuted === 'function' ? !!opts.localMuted() : false;
      const localOff = typeof opts.localMusicOff === 'function' ? !!opts.localMusicOff() : false;
      return { muted: localMuted, sfx: s.sfx, music: localOff ? 0 : s.music };
    }

    function ensureCss() {
      if (typeof document === 'undefined' || document.getElementById('ep-css')) return;
      const st = document.createElement('style');
      st.id = 'ep-css';
      st.textContent = [
        '.ep-box{display:flex;flex-direction:column;gap:6px;font:12px/1.3 inherit;color:inherit;min-width:168px;padding:2px 0}',
        '.ep-row{display:flex;align-items:center;justify-content:space-between;gap:8px}',
        '.ep-row input[type=range]{width:108px;accent-color:currentColor}',
        '.ep-reset{margin-top:2px;cursor:pointer;font:inherit;color:inherit;background:transparent;border:1px solid currentColor;border-radius:6px;padding:4px 8px;opacity:.9}',
      ].join('');
      document.head.appendChild(st);
    }

    function mount(el, opts) {
      if (!el || typeof document === 'undefined') return null;
      opts = opts || {};
      ensureCss();
      el.textContent = '';
      const box = document.createElement('div');
      box.className = 'ep-box';
      let muteEl = null;
      if (opts.showMute !== false) {
        const row = document.createElement('label');
        row.className = 'ep-row';
        muteEl = document.createElement('input');
        muteEl.type = 'checkbox';
        muteEl.setAttribute('data-ep', 'mute');
        const span = document.createElement('span');
        span.textContent = 'Mute';
        row.appendChild(span);
        row.appendChild(muteEl);
        box.appendChild(row);
      }
      function slider(label, name) {
        const row = document.createElement('label');
        row.className = 'ep-row';
        const span = document.createElement('span');
        span.textContent = label;
        const input = document.createElement('input');
        input.type = 'range';
        input.min = '0';
        input.max = '100';
        input.step = '1';
        input.setAttribute('data-ep', name);
        input.setAttribute('aria-label', label + ' volume');
        row.appendChild(span);
        row.appendChild(input);
        box.appendChild(row);
        return input;
      }
      const sfxEl = opts.showVolumes === false ? null : slider('Sound', 'sfx');
      const musicEl = opts.showVolumes === false ? null : slider('Music', 'music');
      if (typeof opts.onReset === 'function') {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ep-reset';
        btn.setAttribute('data-ep', 'reset');
        btn.textContent = opts.resetLabel || 'Reset progress';
        btn.addEventListener('click', function () {
          if (!confirm('Reset progress for this game? This cannot be undone.')) return;
          opts.onReset();
        });
        box.appendChild(btn);
      }
      el.appendChild(box);

      function paint() {
        const view = displayed(opts);
        if (muteEl) muteEl.checked = view.muted;
        if (sfxEl) sfxEl.value = String(Math.round(view.sfx * 100));
        if (musicEl) musicEl.value = String(Math.round(view.music * 100));
      }

      function commit() {
        const cur = settings();
        const muted = muteEl ? muteEl.checked : (typeof opts.localMuted === 'function' ? !!opts.localMuted() : cur.muted);
        const sfx = sfxEl ? Number(sfxEl.value) / 100 : cur.sfx;
        const musicPct = musicEl ? Number(musicEl.value) / 100 : (cur.musicOn ? cur.music : 0);
        const patch = { muted: muted, sfx: sfx, touched: true, musicOn: musicPct > 0 };
        if (musicPct > 0) patch.music = musicPct;
        update(patch);
        if (typeof opts.onChange === 'function') {
          try { opts.onChange(settings()); } catch (e) { /* UI sync is best-effort */ }
        }
      }

      if (muteEl) muteEl.addEventListener('change', commit);
      if (sfxEl) sfxEl.addEventListener('input', commit);
      if (musicEl) musicEl.addEventListener('input', commit);
      const unsub = subscribe(paint);
      paint();
      return { destroy: unsub, paint: paint };
    }

    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('storage', function (e) {
        if (!e || !e.key || e.key === SETTINGS_KEY || e.key === PROGRESS_KEY) {
          settingsCache = null;
          progressCache = null;
          notify();
        }
      });
    }

    return {
      settings: { get: settings, update: update, subscribe: subscribe },
      audio: { sfx: audioSfx, music: audioMusic, apply: apply },
      progress: { note: note, has: has, get: getProgress, clear: clear, career: career, saveCareer: saveCareer },
      mount: mount,
    };
  }

  return {
    create: create,
    SCHEMA: SCHEMA,
    SETTINGS_KEY: SETTINGS_KEY,
    PROGRESS_KEY: PROGRESS_KEY,
  };
});

// The flagship pages already load this file. The booth stays in
// js/ai so the game shells other branches are rewriting can stay
// untouched. Node never sees document, so the require() tests do not.
(function () {
  if (typeof document === 'undefined' || !document.head) return;
  if (!document.querySelector('script[data-hud-safe]')) {
    var safe = document.createElement('script');
    safe.src = '/js/hud-safe.js';
    safe.async = false;
    safe.setAttribute('data-hud-safe', '1');
    document.head.appendChild(safe);
  }
  if (document.querySelector('script[data-arcade-ai]')) return;
  var core = document.createElement('script');
  core.src = '/js/ai/arcade-ai.js';
  core.async = false;
  core.setAttribute('data-arcade-ai', 'core');
  core.onload = function () {
    var boot = document.createElement('script');
    boot.src = '/js/ai/boot.js';
    boot.async = false;
    boot.setAttribute('data-arcade-ai', 'boot');
    document.head.appendChild(boot);
  };
  document.head.appendChild(core);
})();
