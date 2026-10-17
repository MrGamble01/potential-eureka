/* ============================================
   MOMENTS — photo mode and a short replay
   for the flagships that opt in.

   The highlight reel is a ring of full-colour
   frames, about twelve seconds at four frames
   a second. A desktop frame is about 640px
   wide; a phone stores a smaller copy. Each
   sample is a JPEG or WebP, drawn with
   smoothing when it plays back. Sampling
   happens only when the game calls
   afterFrame(), and only on that cadence.
   Turn it off and the sampler never reads
   pixels.

   The on/off choice lives in eureka-moments-v1.
   Flagged clips are too big for localStorage,
   so they go to IndexedDB when it is there
   and stay in memory when it is not.
   ============================================ */

(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) root.EurekaMoments = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  const STORE = 'eureka-moments-v1';
  const SECONDS = 12;
  const FPS = 4;
  const DESKTOP_W = 640;
  const PHONE_W = 400;
  const CLIP_DB = 'eureka-moments-clips';
  const CLIP_STORE = 'clips';
  const IDB_CLIP_CAP = 4;
  const GAME_TITLE = {
    voxel: 'Voxel Isle',
    hearthvale: 'Hearthvale',
    aow: 'Age of War',
  };
  const FILTERS = ['none', 'warm', 'noir', 'vivid', 'dusk'];
  const FRAMES = ['none', 'polaroid', 'film', 'arcade'];
  const FILTER_LABEL = { none: 'None', warm: 'Warm', noir: 'Noir', vivid: 'Vivid', dusk: 'Dusk' };
  const FRAME_LABEL = { none: 'Clean', polaroid: 'Polaroid', film: 'Film', arcade: 'Arcade' };

  const PALETTE = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    PALETTE[i * 3] = Math.round(((i >> 5) & 7) * 255 / 7);
    PALETTE[i * 3 + 1] = Math.round(((i >> 2) & 7) * 255 / 7);
    PALETTE[i * 3 + 2] = Math.round((i & 3) * 255 / 3);
  }

  function quantizeIndex(r, g, b) {
    return ((r >> 5) << 5) | ((g >> 5) << 2) | (b >> 6);
  }

  function clampByte(v) {
    return v < 0 ? 0 : v > 255 ? 255 : v | 0;
  }

  function filterPixels(rgba, name) {
    const out = new Uint8Array(rgba.length);
    for (let i = 0; i < rgba.length; i += 4) {
      let r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
      const a = rgba[i + 3];
      if (name === 'noir') {
        const y = (r * 0.299 + g * 0.587 + b * 0.114) | 0;
        r = g = b = y;
      } else if (name === 'warm') {
        r = clampByte(r * 1.12 + 14);
        g = clampByte(g * 1.04 + 4);
        b = clampByte(b * 0.8);
      } else if (name === 'vivid') {
        r = clampByte((r - 128) * 1.38 + 128);
        g = clampByte((g - 128) * 1.28 + 128);
        b = clampByte((b - 128) * 1.38 + 128);
      } else if (name === 'dusk') {
        r = clampByte(r * 0.72 + 8);
        g = clampByte(g * 0.8 + 6);
        b = clampByte(b * 1.12 + 22);
      }
      out[i] = r;
      out[i + 1] = g;
      out[i + 2] = b;
      out[i + 3] = a;
    }
    return out;
  }

  function indexFrame(rgba, w, h) {
    const idx = new Uint8Array(w * h);
    const n = Math.min(idx.length, (rgba.length / 4) | 0);
    for (let p = 0, i = 0; p < n; p++, i += 4) {
      idx[p] = quantizeIndex(rgba[i], rgba[i + 1], rgba[i + 2]);
    }
    return idx;
  }

  function createBuffer(opts) {
    const seconds = (opts && opts.seconds) || SECONDS;
    const fps = (opts && opts.fps) || FPS;
    const capacity = Math.max(2, Math.round(seconds * fps));
    const slots = new Array(capacity);
    let head = 0;
    let count = 0;
    function push(frame) {
      slots[head] = frame;
      head = (head + 1) % capacity;
      if (count < capacity) count++;
    }
    function list() {
      const out = [];
      const start = count < capacity ? 0 : head;
      for (let i = 0; i < count; i++) out.push(slots[(start + i) % capacity]);
      return out;
    }
    function clear() {
      for (let i = 0; i < capacity; i++) slots[i] = undefined;
      head = 0;
      count = 0;
    }
    return {
      push: push,
      list: list,
      clear: clear,
      capacity: capacity,
      seconds: seconds,
      fps: fps,
      count: function () { return count; },
    };
  }

  function spanSeconds(frames) {
    if (!frames || frames.length < 2) return 0;
    return (frames[frames.length - 1].t - frames[0].t) / 1000;
  }

  function createRecorder(opts) {
    const buffer = createBuffer(opts);
    const interval = 1000 / buffer.fps;
    let enabled = !opts || opts.enabled !== false;
    let last = -1e15;
    function note(frame, now) {
      if (!enabled) return false;
      if (now - last < interval - 0.5) return false;
      last = now;
      buffer.push(frame);
      return true;
    }
    return {
      buffer: buffer,
      note: note,
      interval: interval,
      setEnabled: function (v) {
        enabled = !!v;
        if (!enabled) buffer.clear();
      },
      enabled: function () { return enabled; },
    };
  }

  function frameSize(canvasW, canvasH, phone) {
    const maxW = phone ? PHONE_W : DESKTOP_W;
    const aspect = canvasW > 0 && canvasH > 0 ? canvasW / canvasH : 16 / 9;
    let w = maxW;
    let h = Math.max(8, Math.round(w / aspect));
    if (h > maxW) { h = maxW; w = Math.max(8, Math.round(h * aspect)); }
    if (w % 2) w -= 1;
    if (h % 2) h -= 1;
    return { w: Math.max(8, w), h: Math.max(8, h) };
  }

  function formatWhen(ms) {
    const d = new Date(ms);
    if (!d || isNaN(d.getTime())) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  function clipTitle(item) {
    if (!item) return '';
    const parts = [];
    if (item.label) parts.push(String(item.label));
    if (item.game) parts.push(String(item.game));
    const when = item.when ? formatWhen(item.when) : '';
    if (when) parts.push(when);
    return parts.join(' · ');
  }

  // Pixel reels do not belong in localStorage. A few kilobytes can
  // stay in memory; anything larger uses IndexedDB when the browser
  // has it, and memory alone when it does not.
  function storePlan(bytes, env) {
    const n = bytes | 0;
    if (n < 4096) return 'memory';
    if (env && env.indexedDB) return 'indexeddb';
    return 'memory';
  }

  function flagClip(buffer, gallery, label, limit, meta) {
    const frames = buffer.list();
    if (frames.length < 2) return null;
    const copy = [];
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      const row = { t: f.t, w: f.w, h: f.h };
      if (f.url) row.url = f.url;
      if (f.idx) row.idx = f.idx.slice();
      copy.push(row);
    }
    gallery.unshift({
      label: label || 'Highlight',
      game: (meta && meta.game) || '',
      at: copy[copy.length - 1].t,
      when: (meta && meta.when) || Date.now(),
      frames: copy,
    });
    const cap = limit || 8;
    while (gallery.length > cap) gallery.pop();
    return gallery[0];
  }

  function readSettings(getItem) {
    try {
      const raw = JSON.parse(getItem(STORE) || 'null');
      if (raw && typeof raw.enabled === 'boolean') return { enabled: raw.enabled };
    } catch (e) { /* private mode or junk */ }
    return { enabled: true };
  }

  function writeSettings(setItem, enabled) {
    try { setItem(STORE, JSON.stringify({ enabled: !!enabled })); }
    catch (e) { /* private mode */ }
  }

  function chooseExport(env) {
    const file = env && env.file;
    try {
      if (env && env.share && env.canShare && env.canShare({ files: [file] })) return 'share';
    } catch (e) { /* share sheet unavailable */ }
    return 'download';
  }

  // GIF89a LZW. Code-size growth matches the decoder: the width
  // increases after a code is emitted, before the table entry that
  // would no longer fit is stored. A full 12-bit table emits Clear.
  function lzwEncode(minCodeSize, index) {
    const clear = 1 << minCodeSize;
    const eoi = clear + 1;
    const mask = clear - 1;
    let codeSize = minCodeSize + 1;
    let next = eoi + 1;
    const table = new Map();
    const bytes = [];
    let acc = 0;
    let bits = 0;
    function emit(code) {
      acc |= code << bits;
      bits += codeSize;
      while (bits >= 8) {
        bytes.push(acc & 255);
        acc >>>= 8;
        bits -= 8;
      }
    }
    if (!index || !index.length) return bytes;
    emit(clear);
    let ib = index[0] & mask;
    for (let i = 1; i < index.length; i++) {
      const k = index[i] & mask;
      const key = (ib << 8) | k;
      const found = table.get(key);
      if (found === undefined) {
        emit(ib);
        if (next === 4096) {
          emit(clear);
          table.clear();
          next = eoi + 1;
          codeSize = minCodeSize + 1;
        } else {
          if (next >= (1 << codeSize)) codeSize++;
          table.set(key, next++);
        }
        ib = k;
      } else {
        ib = found;
      }
    }
    emit(ib);
    emit(eoi);
    if (bits > 0) bytes.push(acc & 255);
    return bytes;
  }

  function packSub(bytes) {
    const out = [];
    for (let i = 0; i < bytes.length; i += 255) {
      const n = Math.min(255, bytes.length - i);
      out.push(n);
      for (let j = 0; j < n; j++) out.push(bytes[i + j]);
    }
    out.push(0);
    return out;
  }

  function push16(out, n) {
    out.push(n & 255, (n >> 8) & 255);
  }

  function gifEncode(frames) {
    if (!frames || !frames.length) return new Uint8Array(0);
    const w = frames[0].w | 0;
    const h = frames[0].h | 0;
    const out = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
    push16(out, w);
    push16(out, h);
    out.push(0xF7, 0, 0);
    for (let i = 0; i < PALETTE.length; i++) out.push(PALETTE[i]);
    out.push(0x21, 0xFF, 0x0B);
    const sig = 'NETSCAPE2.0';
    for (let i = 0; i < sig.length; i++) out.push(sig.charCodeAt(i));
    out.push(3, 1, 0, 0, 0);
    for (let f = 0; f < frames.length; f++) {
      let delay = 25;
      if (f + 1 < frames.length) {
        delay = Math.round((frames[f + 1].t - frames[f].t) / 10);
        if (delay < 2) delay = 2;
        if (delay > 50) delay = 50;
      }
      out.push(0x21, 0xF9, 4, 0x04, delay & 255, (delay >> 8) & 255, 0, 0);
      out.push(0x2C);
      push16(out, 0);
      push16(out, 0);
      push16(out, w);
      push16(out, h);
      out.push(0);
      const lzw = lzwEncode(8, frames[f].idx);
      out.push(8);
      const packed = packSub(lzw);
      for (let i = 0; i < packed.length; i++) out.push(packed[i]);
    }
    out.push(0x3B);
    return new Uint8Array(out);
  }

  function paintFrame(ctx, w, h, name) {
    if (!name || name === 'none') return;
    if (name === 'polaroid') {
      const side = Math.max(8, Math.round(Math.min(w, h) * 0.04));
      const bot = Math.round(side * 2.7);
      ctx.fillStyle = '#f4f1ea';
      ctx.fillRect(0, 0, w, side);
      ctx.fillRect(0, 0, side, h);
      ctx.fillRect(w - side, 0, side, h);
      ctx.fillRect(0, h - bot, w, bot);
    } else if (name === 'film') {
      const bar = Math.max(10, Math.round(h * 0.09));
      ctx.fillStyle = '#141414';
      ctx.fillRect(0, 0, w, bar);
      ctx.fillRect(0, h - bar, w, bar);
      ctx.fillStyle = '#f3f3f3';
      const hole = Math.max(4, Math.round(bar * 0.28));
      for (let x = hole; x < w - hole; x += hole * 3) {
        ctx.fillRect(x, Math.round((bar - hole) / 2), hole, hole);
        ctx.fillRect(x, h - bar + Math.round((bar - hole) / 2), hole, hole);
      }
    } else if (name === 'arcade') {
      const t = Math.max(6, Math.round(Math.min(w, h) * 0.014));
      ctx.strokeStyle = '#141018';
      ctx.lineWidth = t * 2;
      ctx.strokeRect(t, t, w - t * 2, h - t * 2);
      ctx.strokeStyle = '#7ec8ff';
      ctx.lineWidth = Math.max(2, t * 0.7);
      ctx.strokeRect(t * 2.4, t * 2.4, w - t * 4.8, h - t * 4.8);
    }
  }

  let active = null;

  function attach(opts) {
    const doc = (opts && opts.document) || (typeof document !== 'undefined' ? document : null);
    if (!doc || !doc.body) return null;
    const o = opts || {};
    const buffer = createBuffer({ seconds: SECONDS, fps: FPS });
    const gallery = [];
    let enabled = true;
    try {
      const store = (o.localStorage) || (typeof localStorage !== 'undefined' ? localStorage : null);
      if (store) enabled = readSettings(function (k) { return store.getItem(k); }).enabled;
    } catch (e) { enabled = true; }
    let view = 'live';
    let backTo = 'live';
    let filterName = 'none';
    let frameName = 'none';
    let camMode = (o.camera && o.camera.modes && o.camera.modes[0]) || 'orbit';
    let hudOn = false;
    let lastShot = -1e15;
    let shotWait = null;
    let playTimer = 0;
    let clip = null;

    const style = doc.createElement('style');
    style.textContent = [
      '#moments-root{position:fixed;inset:0;z-index:16000;pointer-events:none}',
      '#moments-root[hidden]{display:none!important}',
      '#moments-photo,#moments-replay,#moments-gallery,#moments-gate{position:absolute;inset:0;display:flex;flex-direction:column;pointer-events:none}',
      '#moments-photo[hidden],#moments-replay[hidden],#moments-gallery[hidden],#moments-gate[hidden]{display:none!important}',
      '#moments-stage{flex:1;pointer-events:auto;touch-action:none}',
      '#moments-stage[data-filter="noir"]{backdrop-filter:grayscale(1) contrast(1.05)}',
      '#moments-stage[data-filter="warm"]{backdrop-filter:sepia(.45) saturate(1.25)}',
      '#moments-stage[data-filter="vivid"]{backdrop-filter:saturate(1.75) contrast(1.08)}',
      '#moments-stage[data-filter="dusk"]{backdrop-filter:sepia(.3) hue-rotate(190deg) saturate(1.2) brightness(.92)}',
      '#moments-stage[data-frame="polaroid"]{box-shadow:inset 0 0 0 16px #f4f1ea, inset 0 -42px 0 #f4f1ea}',
      '#moments-stage[data-frame="film"]{box-shadow:inset 0 26px 0 #141414, inset 0 -26px 0 #141414}',
      '#moments-stage[data-frame="arcade"]{box-shadow:inset 0 0 0 8px #141018, inset 0 0 0 12px #7ec8ff}',
      '.moments-bar{pointer-events:auto;background:rgba(12,14,18,.92);color:#eef3ea;padding:8px 8px calc(8px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:6px;max-height:48vh;overflow:auto}',
      '.moments-row{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}',
      '.moments-row button,.moments-gate button{min-height:44px;min-width:44px;padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.16);background:#24303a;color:#eef3ea;font:600 14px/1.2 system-ui,sans-serif;flex:0 0 auto;touch-action:manipulation;cursor:pointer}',
      '.moments-row button[aria-pressed="true"]{border-color:#7ec8ff;color:#d7f1ff;background:#1c3a4a}',
      '.moments-status{font:12px/1.3 system-ui,sans-serif;color:#c5d0c8;padding:0 4px}',
      '#moments-replay canvas{width:100%;height:100%;object-fit:contain;background:#0c1014;pointer-events:none;image-rendering:auto}',
      '#moments-gallery .moments-list{pointer-events:auto;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px}',
      '#moments-gate{align-items:center;justify-content:center;background:rgba(8,10,14,.55)}',
      '#moments-gate .card{pointer-events:auto;background:#182028;border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:16px;width:min(360px,92vw);display:flex;flex-direction:column;gap:10px}',
      '#moments-gate p{margin:0;font:15px/1.45 system-ui,sans-serif;color:#eef3ea}',
      '@media (pointer:coarse){.moments-hint{display:none}}',
    ].join('');
    doc.head.appendChild(style);
    if (o.hud) {
      const parts = String(o.hud).split(',').map(function (s) { return 'body.moments-hide ' + s.trim(); });
      const hudCss = doc.createElement('style');
      hudCss.textContent = parts.join(',') + '{visibility:hidden!important}';
      doc.head.appendChild(hudCss);
    }

    const rootEl = doc.createElement('div');
    rootEl.id = 'moments-root';
    rootEl.hidden = true;
    const photo = doc.createElement('div');
    photo.id = 'moments-photo';
    photo.hidden = true;
    const stage = doc.createElement('div');
    stage.id = 'moments-stage';
    stage.setAttribute('data-filter', 'none');
    stage.setAttribute('data-frame', 'none');
    const bar = doc.createElement('div');
    bar.className = 'moments-bar';
    const status = doc.createElement('div');
    status.className = 'moments-status';
    status.textContent = 'Drag to move the camera';
    photo.appendChild(stage);
    photo.appendChild(bar);
    const replay = doc.createElement('div');
    replay.id = 'moments-replay';
    replay.hidden = true;
    const replayCanvas = doc.createElement('canvas');
    replayCanvas.width = 160;
    replayCanvas.height = 90;
    const replayBar = doc.createElement('div');
    replayBar.className = 'moments-bar';
    replay.appendChild(replayCanvas);
    replay.appendChild(replayBar);
    const galleryEl = doc.createElement('div');
    galleryEl.id = 'moments-gallery';
    galleryEl.hidden = true;
    const galleryList = doc.createElement('div');
    galleryList.className = 'moments-list';
    const galleryBar = doc.createElement('div');
    galleryBar.className = 'moments-bar';
    galleryEl.appendChild(galleryList);
    galleryEl.appendChild(galleryBar);
    const gate = doc.createElement('div');
    gate.id = 'moments-gate';
    gate.hidden = true;
    const gateCard = doc.createElement('div');
    gateCard.className = 'card';
    const gateText = doc.createElement('p');
    gateText.textContent = 'Photo mode and highlight replay are off, so nothing is recorded.';
    gateCard.appendChild(gateText);
    gate.appendChild(gateCard);
    rootEl.appendChild(photo);
    rootEl.appendChild(replay);
    rootEl.appendChild(galleryEl);
    rootEl.appendChild(gate);
    doc.body.appendChild(rootEl);

    function btn(label, title) {
      const b = doc.createElement('button');
      b.type = 'button';
      b.textContent = label;
      if (title) b.title = title;
      return b;
    }
    function row() {
      const r = doc.createElement('div');
      r.className = 'moments-row';
      return r;
    }
    function setStatus(text) { status.textContent = text; }

    const filterRow = row();
    const frameRow = row();
    const toolRow = row();
    FILTERS.forEach(function (name) {
      const b = btn(FILTER_LABEL[name]);
      b.setAttribute('aria-pressed', name === 'none' ? 'true' : 'false');
      b.addEventListener('click', function () { setFilter(name); });
      b.dataset.momentsFilter = name;
      filterRow.appendChild(b);
    });
    FRAMES.forEach(function (name) {
      const b = btn(FRAME_LABEL[name]);
      b.setAttribute('aria-pressed', name === 'none' ? 'true' : 'false');
      b.addEventListener('click', function () { setFrame(name); });
      b.dataset.momentsFrame = name;
      frameRow.appendChild(b);
    });

    const modeBtn = btn('Orbit', 'Switch the camera');
    const hudBtn = btn('HUD off', 'Show or hide the game HUD');
    const zoomIn = btn('+', 'Closer');
    const zoomOut = btn('−', 'Farther');
    const saveBtn = btn('Save PNG', 'Save a picture. On a phone this opens the share sheet.');
    const replayBtn = btn('Replay', 'Play the last few seconds');
    const galleryBtn = btn('Gallery');
    const closeBtn = btn('Close');
    const powerBtn = btn('Highlights on', 'Turn photo mode and replay off');
    [modeBtn, hudBtn, zoomOut, zoomIn, saveBtn, replayBtn, galleryBtn, powerBtn, closeBtn].forEach(function (b) {
      toolRow.appendChild(b);
    });
    const hint = doc.createElement('div');
    hint.className = 'moments-hint moments-status';
    hint.textContent = 'Arrows move the camera · +/− zoom · H hides the HUD · Esc closes';
    bar.appendChild(filterRow);
    bar.appendChild(frameRow);
    bar.appendChild(toolRow);
    bar.appendChild(status);
    bar.appendChild(hint);

    function paintPressed(container, attr, value) {
      const nodes = container.querySelectorAll('button');
      for (let i = 0; i < nodes.length; i++) {
        nodes[i].setAttribute('aria-pressed', nodes[i].getAttribute(attr) === value ? 'true' : 'false');
      }
    }
    function setFilter(name) {
      filterName = name;
      stage.setAttribute('data-filter', name);
      paintPressed(filterRow, 'data-moments-filter', name);
    }
    function setFrame(name) {
      frameName = name;
      stage.setAttribute('data-frame', name);
      paintPressed(frameRow, 'data-moments-frame', name);
    }
    function paintPower() {
      powerBtn.textContent = enabled ? 'Highlights on' : 'Highlights off';
      powerBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    }
    function paintMode() {
      const modes = (o.camera && o.camera.modes) || [];
      modeBtn.hidden = modes.length < 2;
      modeBtn.textContent = camMode === 'free' ? 'Free' : 'Orbit';
      const hasCam = !!(o.camera && (o.camera.orbit || o.camera.pan || o.camera.zoom));
      zoomIn.hidden = zoomOut.hidden = !hasCam;
    }
    paintPower();
    paintMode();

    function persist(on) {
      try {
        const store = o.localStorage || localStorage;
        writeSettings(function (k, v) { store.setItem(k, v); }, on);
      } catch (e) { /* private mode */ }
    }
    function applyHud(on) {
      hudOn = !on;
      doc.body.classList.toggle('moments-hide', !!on);
      if (o.hideClass) doc.body.classList.toggle(o.hideClass, !!on);
      hudBtn.textContent = on ? 'HUD off' : 'HUD on';
      hudBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    function hold(on) {
      try {
        if (on) { if (o.pause) o.pause(); }
        else if (o.resume) o.resume();
      } catch (e) { /* a camera pause cannot take the game down */ }
    }
    function show(which) {
      photo.hidden = which !== 'photo';
      replay.hidden = which !== 'replay';
      galleryEl.hidden = which !== 'gallery';
      gate.hidden = which !== 'gate';
      rootEl.hidden = which === 'live';
      view = which;
    }
    function openPhoto() {
      if (!enabled) { openGate(); return; }
      stopPlay();
      if (o.onOpen) try { o.onOpen(); } catch (e) {}
      backTo = 'live';
      show('photo');
      hold(true);
      applyHud(true);
      setStatus('Drag to move the camera');
    }
    function openGate() {
      stopPlay();
      show('gate');
    }
    function closeAll() {
      stopPlay();
      show('live');
      applyHud(false);
      hold(false);
      shotWait = null;
      if (o.onClose) try { o.onClose(); } catch (e) {}
    }
    function closeTop() {
      if (view === 'gallery' || view === 'replay') {
        stopPlay();
        if (backTo === 'photo' && enabled) show('photo');
        else closeAll();
        return;
      }
      closeAll();
    }
    function togglePhoto() {
      if (view !== 'live') { closeAll(); return; }
      openPhoto();
    }
    function canvasOf() {
      try {
        const c = o.canvas ? o.canvas() : null;
        return c && c.width ? c : null;
      } catch (e) { return null; }
    }
    function phone() {
      try {
        return (root.matchMedia && root.matchMedia('(pointer: coarse)').matches) || (root.innerWidth || 800) < 800;
      } catch (e) { return false; }
    }
    function captureSize(canvas) {
      return frameSize(canvas.width, canvas.height, phone());
    }
    const scratch = doc.createElement('canvas');
    const scratchCtx = scratch.getContext('2d', { willReadFrequently: true });
    function sample(canvas, now) {
      const size = captureSize(canvas);
      if (scratch.width !== size.w || scratch.height !== size.h) {
        scratch.width = size.w;
        scratch.height = size.h;
      }
      scratchCtx.imageSmoothingEnabled = true;
      scratchCtx.imageSmoothingQuality = 'high';
      scratchCtx.drawImage(canvas, 0, 0, size.w, size.h);
      let url = '';
      try { url = scratch.toDataURL('image/webp', 0.8); } catch (e) { url = ''; }
      if (!url || url.indexOf('data:image/webp') !== 0) {
        try { url = scratch.toDataURL('image/jpeg', 0.82); } catch (e2) { url = ''; }
      }
      if (!url) return;
      buffer.push({ t: now, w: size.w, h: size.h, url: url });
    }
    function composeCanvas(src) {
      const maxEdge = phone() ? 1280 : 1600;
      const scale = Math.min(1, maxEdge / Math.max(src.width, src.height));
      const w = Math.max(2, Math.round(src.width * scale));
      const h = Math.max(2, Math.round(src.height * scale));
      const c = doc.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(src, 0, 0, w, h);
      if (filterName !== 'none') {
        const img = ctx.getImageData(0, 0, w, h);
        const next = filterPixels(img.data, filterName);
        img.data.set(next);
        ctx.putImageData(img, 0, 0);
      }
      paintFrame(ctx, w, h, frameName);
      return c;
    }
    function afterFrame() {
      const canvas = canvasOf();
      if (shotWait && canvas) {
        const finish = shotWait;
        shotWait = null;
        try { finish(composeCanvas(canvas)); }
        catch (e) { finish(null); }
      }
      if (!enabled || view !== 'live' || !canvas) return;
      try { if (doc.hidden) return; } catch (e) {}
      const now = (root.performance && root.performance.now) ? root.performance.now() : Date.now();
      if (now - lastShot < (1000 / FPS) - 0.5) return;
      lastShot = now;
      try { sample(canvas, now); }
      catch (e) { /* a lost WebGL buffer is not a crash */ }
    }
    function fileName(ext) {
      const game = (o.game || 'moment').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      return game + '-' + ext;
    }
    function saveBlob(blob, filename, title) {
      const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
      const nav = root.navigator;
      const plan = chooseExport({
        file: file,
        share: nav && nav.share,
        canShare: nav && nav.canShare ? function (payload) { return nav.canShare(payload); } : null,
      });
      if (plan === 'share') {
        return nav.share({ files: [file], title: title || filename }).then(function () { return 'shared'; }, function (err) {
          if (err && err.name === 'AbortError') return 'aborted';
          return download(blob, filename);
        });
      }
      return Promise.resolve(download(blob, filename));
    }
    function download(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = doc.createElement('a');
      a.href = url;
      a.download = filename;
      doc.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      return 'downloaded';
    }
    function takePhoto() {
      const canvas = canvasOf();
      if (!canvas) return Promise.resolve(null);
      return new Promise(function (resolve) {
        let settled = false;
        function finish(shot) {
          if (settled) return;
          settled = true;
          shotWait = null;
          if (!shot) { resolve(null); return; }
          shot.toBlob(function (blob) { resolve(blob); }, 'image/png');
        }
        shotWait = finish;
        setTimeout(function () { if (!settled) finish(composeCanvas(canvas)); }, 350);
      });
    }
    function paintIndexed(ctx, frame) {
      const img = ctx.createImageData(frame.w, frame.h);
      const px = img.data;
      const idx = frame.idx;
      for (let p = 0, i = 0; p < idx.length; p++, i += 4) {
        const c = idx[p] * 3;
        px[i] = PALETTE[c];
        px[i + 1] = PALETTE[c + 1];
        px[i + 2] = PALETTE[c + 2];
        px[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    }
    function loadImage(frame) {
      if (!frame) return null;
      if (frame.image) return frame.image;
      if (!frame.url || !root.Image) return null;
      const img = new root.Image();
      img.decoding = 'async';
      img.src = frame.url;
      frame.image = img;
      return img;
    }
    function paintShot(ctx, frame, dw, dh) {
      ctx.imageSmoothingEnabled = true;
      try { ctx.imageSmoothingQuality = 'high'; } catch (e) {}
      const img = loadImage(frame);
      if (img && img.complete && img.naturalWidth) {
        ctx.drawImage(img, 0, 0, dw, dh);
        return true;
      }
      if (frame && frame.idx) {
        paintIndexed(ctx, frame);
        return true;
      }
      return false;
    }
    function stopPlay() {
      if (playTimer) { clearTimeout(playTimer); playTimer = 0; }
    }
    function play(frames) {
      if (!frames || frames.length < 2) {
        setStatus('Nothing recorded yet — play a few seconds first');
        return;
      }
      stopPlay();
      clip = frames;
      backTo = view === 'photo' || view === 'gallery' ? 'photo' : 'live';
      if (view === 'live') hold(true);
      show('replay');
      const box = stage.getBoundingClientRect();
      const aspect = frames[0].w / frames[0].h || 16 / 9;
      let dw = Math.max(frames[0].w, Math.round(box.width || frames[0].w));
      let dh = Math.round(dw / aspect);
      const maxH = Math.max(frames[0].h, Math.round(box.height || dh));
      if (dh > maxH && maxH > 8) { dh = maxH; dw = Math.max(2, Math.round(dh * aspect)); }
      replayCanvas.width = Math.max(2, dw);
      replayCanvas.height = Math.max(2, dh);
      const ctx = replayCanvas.getContext('2d');
      let i = 0;
      function step() {
        const painted = paintShot(ctx, frames[i], replayCanvas.width, replayCanvas.height);
        replayCanvas.dataset.smoothing = ctx.imageSmoothingEnabled ? 'high' : 'off';
        const wait = !painted ? 40 : (i + 1 < frames.length ? Math.max(40, Math.min(400, frames[i + 1].t - frames[i].t)) : 240);
        if (painted) i = (i + 1) % frames.length;
        playTimer = setTimeout(step, wait);
      }
      step();
    }
    function currentClip() {
      if (clip && clip.length > 1) return clip;
      const live = buffer.list();
      return live.length > 1 ? live : null;
    }
    function recordWebm(frames) {
      const nav = root.MediaRecorder;
      if (!nav || !replayCanvas.captureStream) return Promise.resolve(null);
      let mime = '';
      if (nav.isTypeSupported && nav.isTypeSupported('video/webm;codecs=vp8')) mime = 'video/webm;codecs=vp8';
      else if (nav.isTypeSupported && nav.isTypeSupported('video/webm')) mime = 'video/webm';
      else return Promise.resolve(null);
      return new Promise(function (resolve) {
        const c = doc.createElement('canvas');
        c.width = frames[0].w;
        c.height = frames[0].h;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        let stream;
        try { stream = c.captureStream(8); }
        catch (e) { resolve(null); return; }
        let rec;
        try { rec = new nav(stream, { mimeType: mime, videoBitsPerSecond: 700000 }); }
        catch (e) { resolve(null); return; }
        const chunks = [];
        rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = function () { resolve(new Blob(chunks, { type: 'video/webm' })); };
        rec.onerror = function () { resolve(null); };
        try { rec.start(); }
        catch (e) { resolve(null); return; }
        let i = 0;
        function step() {
          paintShot(ctx, frames[i], c.width, c.height);
          i++;
          if (i >= frames.length) { try { rec.stop(); } catch (err) { resolve(null); } return; }
          const wait = Math.max(40, Math.min(400, frames[i].t - frames[i - 1].t));
          setTimeout(step, wait);
        }
        let left = 0;
        let started = false;
        function begin() { if (started) return; started = true; step(); }
        for (let n = 0; n < frames.length; n++) {
          const img = loadImage(frames[n]);
          if (img && !img.complete) {
            left++;
            const tick = function () { left--; if (!left) begin(); };
            img.addEventListener('load', tick);
            img.addEventListener('error', tick);
          }
        }
        if (!left) begin();
        else setTimeout(begin, 800);
      });
    }
    function exportClip(frames) {
      if (!frames || frames.length < 2) {
        setStatus('Nothing recorded yet');
        return Promise.resolve(null);
      }
      const gifOk = !!(frames[0] && frames[0].idx);
      return recordWebm(frames).then(function (webm) {
        if (webm && webm.size > 32) return saveBlob(webm, fileName('replay.webm'), 'Replay');
        if (!gifOk) { setStatus('Could not export the clip'); return null; }
        const gif = gifEncode(frames);
        return saveBlob(new Blob([gif], { type: 'image/gif' }), fileName('replay.gif'), 'Replay');
      });
    }
    function renderGallery() {
      galleryList.textContent = '';
      if (!gallery.length) {
        const p = doc.createElement('p');
        p.style.cssText = 'color:#eef3ea;font:15px/1.45 system-ui,sans-serif;margin:8px';
        p.textContent = 'Play a little. Trophies and big moments land here, and you can replay them.';
        galleryList.appendChild(p);
        return;
      }
      for (let i = 0; i < gallery.length; i++) {
        const item = gallery[i];
        const b = btn(clipTitle(item) || item.label);
        b.addEventListener('click', function () { play(item.frames); });
        galleryList.appendChild(b);
      }
    }
    function openGallery() {
      if (!enabled) { openGate(); return; }
      backTo = view === 'photo' ? 'photo' : 'live';
      if (view === 'live') hold(true);
      renderGallery();
      show('gallery');
    }
    function gameTitle() {
      return o.gameTitle || GAME_TITLE[o.game] || o.game || '';
    }
    function clipBytes(item) {
      if (!item || !item.frames) return 0;
      let n = 0;
      for (let i = 0; i < item.frames.length; i++) {
        const url = item.frames[i].url;
        n += url ? url.length : (item.frames[i].idx ? item.frames[i].idx.length : 0);
      }
      return n;
    }
    function openClipDb() {
      return new Promise(function (resolve, reject) {
        if (!root.indexedDB) { reject(new Error('no indexedDB')); return; }
        let req;
        try { req = root.indexedDB.open(CLIP_DB, 1); }
        catch (e) { reject(e); return; }
        req.onupgradeneeded = function () {
          const db = req.result;
          if (!db.objectStoreNames.contains(CLIP_STORE)) db.createObjectStore(CLIP_STORE, { keyPath: 'id' });
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error || new Error('indexedDB')); };
      });
    }
    function persistGallery() {
      const bytes = gallery.reduce(function (sum, item) { return sum + clipBytes(item); }, 0);
      if (storePlan(bytes, root) !== 'indexeddb') return;
      const slim = [];
      for (let i = 0; i < gallery.length && slim.length < IDB_CLIP_CAP; i++) {
        const item = gallery[i];
        const frames = [];
        for (let f = 0; f < item.frames.length; f++) {
          const fr = item.frames[f];
          if (!fr.url) continue;
          frames.push({ t: fr.t, w: fr.w, h: fr.h, url: fr.url });
        }
        if (frames.length < 2) continue;
        slim.push({ id: item.when || (Date.now() + i), label: item.label, game: item.game || '', when: item.when, frames: frames });
      }
      openClipDb().then(function (db) {
        const tx = db.transaction(CLIP_STORE, 'readwrite');
        const store = tx.objectStore(CLIP_STORE);
        store.clear();
        for (let i = 0; i < slim.length; i++) store.put(slim[i]);
        tx.oncomplete = function () { try { db.close(); } catch (e) {} };
      }).catch(function () { /* memory gallery still works */ });
    }
    function restoreClips() {
      openClipDb().then(function (db) {
        const tx = db.transaction(CLIP_STORE, 'readonly');
        const req = tx.objectStore(CLIP_STORE).getAll();
        req.onsuccess = function () {
          if (gallery.length) { try { db.close(); } catch (e) {} return; }
          const rows = req.result || [];
          rows.sort(function (a, b) { return (a.when || 0) - (b.when || 0); });
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row || !row.frames || row.frames.length < 2) continue;
            gallery.unshift({
              label: row.label || 'Highlight',
              game: row.game || '',
              at: row.frames[row.frames.length - 1].t,
              when: row.when || Date.now(),
              frames: row.frames,
            });
          }
          while (gallery.length > 8) gallery.pop();
          try { db.close(); } catch (e) {}
        };
        req.onerror = function () { try { db.close(); } catch (e) {} };
      }).catch(function () {});
    }
    function mark(label, meta) {
      if (!enabled) return null;
      const item = flagClip(buffer, gallery, label, 8, {
        game: (meta && meta.game) || gameTitle(),
        when: (meta && meta.when) || Date.now(),
      });
      if (item) persistGallery();
      return item;
    }
    function nudge(dx, dy) {
      if (!o.camera) return;
      try {
        if (camMode === 'free' && o.camera.pan) o.camera.pan(dx, dy);
        else if (o.camera.orbit) o.camera.orbit(dx, dy);
        else if (o.camera.pan) o.camera.pan(dx, dy);
      } catch (e) {}
    }
    function zoomBy(scale) {
      if (o.camera && o.camera.zoom) {
        try { o.camera.zoom(scale); } catch (e) {}
      }
    }
    modeBtn.addEventListener('click', function () {
      const modes = (o.camera && o.camera.modes) || ['orbit'];
      const i = modes.indexOf(camMode);
      camMode = modes[(i + 1) % modes.length];
      paintMode();
      setStatus(camMode === 'free' ? 'Free camera — drag to slide' : 'Orbit camera — drag to turn');
    });
    hudBtn.addEventListener('click', function () { applyHud(hudOn); });
    zoomIn.addEventListener('click', function () { zoomBy(1.12); });
    zoomOut.addEventListener('click', function () { zoomBy(1 / 1.12); });
    saveBtn.addEventListener('click', function () {
      setStatus('Saving…');
      takePhoto().then(function (blob) {
        if (!blob) { setStatus('Could not grab the picture'); return null; }
        return saveBlob(blob, fileName('photo.png'), 'Photo');
      }).then(function (how) {
        if (how === 'shared') setStatus('Shared');
        else if (how === 'downloaded') setStatus('Saved to your device');
        else if (how === 'aborted') setStatus('Save cancelled');
      });
    });
    replayBtn.addEventListener('click', function () { play(buffer.list()); });
    galleryBtn.addEventListener('click', openGallery);
    closeBtn.addEventListener('click', closeAll);
    powerBtn.addEventListener('click', function () {
      enabled = !enabled;
      persist(enabled);
      if (!enabled) buffer.clear();
      paintPower();
      if (!enabled) {
        closeAll();
        openGate();
      }
    });

    const replaySave = btn('Save clip', 'Saves a short video, or a GIF if the browser cannot record one');
    const replayPhoto = btn('Photo');
    const replayClose = btn('Close');
    replaySave.addEventListener('click', function () {
      const frames = currentClip();
      setStatus('Exporting…');
      exportClip(frames).then(function (how) {
        if (how === 'shared') setStatus('Shared');
        else if (how === 'downloaded') setStatus('Saved');
      });
    });
    replayPhoto.addEventListener('click', function () { stopPlay(); show('photo'); });
    replayClose.addEventListener('click', closeTop);
    const replayRow = row();
    [replaySave, replayPhoto, replayClose].forEach(function (b) { replayRow.appendChild(b); });
    const replayStatus = doc.createElement('div');
    replayStatus.className = 'moments-status';
    replayStatus.textContent = 'Last few seconds, looping';
    replayBar.appendChild(replayRow);
    replayBar.appendChild(replayStatus);

    const galleryClose = btn('Close');
    galleryClose.addEventListener('click', closeTop);
    const galleryRow = row();
    galleryRow.appendChild(galleryClose);
    galleryBar.appendChild(galleryRow);

    const enableBtn = btn('Turn highlights on');
    const gateClose = btn('Close');
    enableBtn.addEventListener('click', function () {
      enabled = true;
      persist(true);
      paintPower();
      openPhoto();
    });
    gateClose.addEventListener('click', closeAll);
    const gateRow = row();
    gateRow.appendChild(enableBtn);
    gateRow.appendChild(gateClose);
    gateCard.appendChild(gateRow);

    const pointers = new Map();
    let pinch = 0;
    let dragX = 0;
    let dragY = 0;
    let dragged = false;
    stage.addEventListener('pointerdown', function (e) {
      stage.setPointerCapture && stage.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      dragX = e.clientX;
      dragY = e.clientY;
      dragged = false;
      if (pointers.size === 2) {
        const ps = Array.from(pointers.values());
        pinch = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
      }
    });
    stage.addEventListener('pointermove', function (e) {
      if (!pointers.has(e.pointerId)) return;
      const prev = pointers.get(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size >= 2 && pinch) {
        const ps = Array.from(pointers.values());
        const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
        if (d > 0) zoomBy(d / pinch);
        pinch = d;
        return;
      }
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      if (Math.abs(e.clientX - dragX) + Math.abs(e.clientY - dragY) > (e.pointerType === 'touch' ? 10 : 4)) dragged = true;
      if (dragged) nudge(dx, dy);
    });
    function endPointer(e) { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = 0; }
    stage.addEventListener('pointerup', endPointer);
    stage.addEventListener('pointercancel', endPointer);

    const hotkey = o.hotkey === undefined
      ? { key: 'p', shift: false }
      : (o.hotkey ? { key: String(o.hotkey.key || o.hotkey), shift: !!o.hotkey.shift } : null);
    function hotkeyMatch(e) {
      if (!hotkey || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return false;
      if (!!e.shiftKey !== !!hotkey.shift) return false;
      return String(e.key || '').toLowerCase() === String(hotkey.key || '').toLowerCase();
    }
    function typing(e) {
      const t = e.target;
      if (!t || !t.tagName) return false;
      return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable;
    }
    doc.addEventListener('keydown', function (e) {
      if (typing(e)) return;
      const open = view !== 'live';
      if (open) {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'Escape') { closeTop(); return; }
        if (hotkeyMatch(e)) { togglePhoto(); return; }
        if (view === 'photo') {
          if (e.key === 'ArrowLeft') nudge(-26, 0);
          else if (e.key === 'ArrowRight') nudge(26, 0);
          else if (e.key === 'ArrowUp') nudge(0, -26);
          else if (e.key === 'ArrowDown') nudge(0, 26);
          else if (e.key === '+' || e.key === '=') zoomBy(1.12);
          else if (e.key === '-') zoomBy(1 / 1.12);
          else if (e.key === 'h' || e.key === 'H') applyHud(hudOn);
        }
        return;
      }
      if (hotkeyMatch(e)) {
        if (o.blocked && o.blocked()) return;
        e.preventDefault();
        e.stopPropagation();
        togglePhoto();
      }
    }, true);

    function bindLaunch(node) {
      if (!node || node.dataset.momentsBound) return;
      node.dataset.momentsBound = '1';
      node.addEventListener('click', function () { togglePhoto(); });
    }
    if (o.button) bindLaunch(typeof o.button === 'string' ? doc.getElementById(o.button) : o.button);
    bindLaunch(doc.getElementById('momentsBtn'));
    bindLaunch(doc.getElementById('m-moments'));

    function watchCareer() {
      const progress = root.EurekaProgress;
      if (!progress || !progress.onChange || !progress.profile) return;
      let seen = {};
      try { seen = Object.assign({}, progress.profile().unlocked || {}); }
      catch (e) { seen = {}; }
      progress.onChange(function () {
        if (!enabled) return;
        let unlocked = {};
        try { unlocked = progress.profile().unlocked || {}; }
        catch (e) { return; }
        const fresh = [];
        const ids = Object.keys(unlocked);
        for (let i = 0; i < ids.length; i++) if (!seen[ids[i]]) fresh.push(ids[i]);
        seen = Object.assign({}, unlocked);
        if (!fresh.length) return;
        const names = [];
        for (let i = 0; i < fresh.length; i++) {
          let name = '';
          try { if (progress.awardName) name = progress.awardName(fresh[i]); } catch (e) { name = ''; }
          names.push(name || 'Trophy');
        }
        mark(names.join(' & '));
      });
    }
    watchCareer();
    restoreClips();

    const session = {
      afterFrame: afterFrame,
      openPhoto: openPhoto,
      closePhoto: closeAll,
      togglePhoto: togglePhoto,
      mark: mark,
      setEnabled: function (on) {
        enabled = !!on;
        persist(enabled);
        if (!enabled) buffer.clear();
        paintPower();
        if (!enabled && view !== 'live' && view !== 'gate') closeAll();
        return enabled;
      },
      enabled: function () { return enabled; },
      frameCount: function () { return buffer.count(); },
      frames: function () { return buffer.list(); },
      span: function () { return spanSeconds(buffer.list()); },
      gallery: function () { return gallery.slice(); },
      filter: function () { return filterName; },
      setFilter: setFilter,
      frameStyle: function () { return frameName; },
      view: function () { return view; },
    };
    active = session;
    return session;
  }

  return {
    STORE: STORE,
    SECONDS: SECONDS,
    FPS: FPS,
    FILTERS: FILTERS,
    FRAMES: FRAMES,
    palette: PALETTE,
    quantizeIndex: quantizeIndex,
    filterPixels: filterPixels,
    indexFrame: indexFrame,
    createBuffer: createBuffer,
    createRecorder: createRecorder,
    spanSeconds: spanSeconds,
    flagClip: flagClip,
    frameSize: frameSize,
    clipTitle: clipTitle,
    storePlan: storePlan,
    DESKTOP_W: DESKTOP_W,
    PHONE_W: PHONE_W,
    CLIP_DB: CLIP_DB,
    readSettings: readSettings,
    writeSettings: writeSettings,
    chooseExport: chooseExport,
    gifEncode: gifEncode,
    lzwEncode: lzwEncode,
    attach: attach,
    afterFrame: function () { if (active) active.afterFrame(); },
    openPhoto: function () { if (active) active.openPhoto(); },
    closePhoto: function () { if (active) active.closePhoto(); },
    togglePhoto: function () { if (active) active.togglePhoto(); },
    mark: function (label) { return active ? active.mark(label) : null; },
    setEnabled: function (on) { return active ? active.setEnabled(on) : on; },
    enabled: function () { return active ? active.enabled() : true; },
    frameCount: function () { return active ? active.frameCount() : 0; },
    frames: function () { return active ? active.frames() : []; },
    gallery: function () { return active ? active.gallery() : []; },
    setFilter: function (name) { if (active) active.setFilter(name); },
    filter: function () { return active ? active.filter() : 'none'; },
    view: function () { return active ? active.view() : 'live'; },
  };
});
