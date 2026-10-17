/* ============================================
   FEEL — shared game-feel for the flagships.
   Particles, screen shake, hit-stop, easing
   tweens, number pop-ups, scene transitions,
   and optional haptics (navigator.vibrate).

   Motion is auto (follow the OS), full, or
   reduced. Reduced skips particles, shake,
   hit-stop and tweens. Haptics are a separate
   switch. The choice lives in eureka-feel-v1,
   one key for every game on this origin.
   ============================================ */

(function (root) {
  const STORE = 'eureka-feel-v1';
  const EASE = {
    linear: function (t) { return t; },
    outCubic: function (t) { return 1 - Math.pow(1 - t, 3); },
    inOutQuad: function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
    outBack: function (t) {
      const c = 1.70158;
      return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
    },
  };
  const KINDS = {
    hire:      { color: '#58A6FF', mag: 5, stop: 40, n: 16, buzz: 15 },
    purchase:  { color: '#F7C948', mag: 4, stop: 30, n: 12, buzz: 10 },
    sprint:    { color: '#FF7B72', mag: 8, stop: 55, n: 22, buzz: 28 },
    milestone: { color: '#F7C948', mag: 7, stop: 60, n: 24, buzz: [20, 50, 20] },
    win:       { color: '#F7C948', mag: 9, stop: 80, n: 28, buzz: [24, 40, 24, 40, 24] },
    ship:      { color: '#7ee787', mag: 6, stop: 45, n: 18, buzz: 12 },
    build:     { color: '#7DCE7A', mag: 6, stop: 50, n: 18, buzz: 16 },
    upgrade:   { color: '#f2c14e', mag: 7, stop: 55, n: 20, buzz: 18 },
    coin:      { color: '#f2c14e', mag: 4, stop: 30, n: 12, buzz: 10 },
    harvest:   { color: '#3FB950', mag: 6, stop: 40, n: 16, buzz: 14 },
    heal:      { color: '#F07178', mag: 6, stop: 45, n: 16, buzz: 14 },
    sell:      { color: '#7ee787', mag: 6, stop: 45, n: 18, buzz: 16 },
    sting:     { color: '#F85149', mag: 10, stop: 80, n: 20, buzz: [16, 36, 18] },
    hit:       { color: '#F7C948', mag: 5, stop: 36, n: 14, buzz: 12 },
    trap:      { color: '#F85149', mag: 9, stop: 70, n: 16, buzz: [14, 32, 16] },
  };

  let motion = 'auto';
  let haptics = true;
  let hitUntil = 0;
  let shakeToken = 0;
  let dripAt = 0;
  let canvas = null;
  let ctx = null;
  let particles = [];
  let raf = 0;
  const tweens = new Set();

  function readStore() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (raw && (raw.motion === 'auto' || raw.motion === 'full' || raw.motion === 'reduced')) motion = raw.motion;
      if (raw && typeof raw.haptics === 'boolean') haptics = raw.haptics;
    } catch (e) { /* private mode */ }
  }

  function writeStore() {
    try { localStorage.setItem(STORE, JSON.stringify({ motion: motion, haptics: haptics })); }
    catch (e) { /* private mode */ }
    applyRoot();
    emit();
  }

  function osReduced() {
    try {
      return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  function reduced() {
    if (motion === 'reduced') return true;
    if (motion === 'full') return false;
    return osReduced();
  }

  function applyRoot() {
    const el = document.documentElement;
    if (!el) return;
    el.dataset.feelMotion = motion;
    el.dataset.feelReduced = reduced() ? '1' : '0';
    el.dataset.feelHaptics = haptics ? '1' : '0';
  }

  function emit() {
    try { document.dispatchEvent(new CustomEvent('eureka-feel-change')); }
    catch (e) { /* no document */ }
  }

  function motionLabel() {
    if (motion === 'reduced') return 'Motion: Reduced';
    if (motion === 'full') return 'Motion: Full';
    return reduced() ? 'Motion: Auto (reduced)' : 'Motion: Auto';
  }

  function hapticsLabel() {
    return haptics ? 'Haptics: On' : 'Haptics: Off';
  }

  function setMotion(mode) {
    if (mode !== 'auto' && mode !== 'full' && mode !== 'reduced') return motion;
    motion = mode;
    writeStore();
    return motion;
  }

  function cycleMotion() {
    const order = ['auto', 'full', 'reduced'];
    const i = order.indexOf(motion);
    return setMotion(order[(i + 1) % order.length]);
  }

  function setHaptics(on) {
    haptics = !!on;
    writeStore();
    return haptics;
  }

  function cycleHaptics() {
    return setHaptics(!haptics);
  }

  function timeScale() {
    if (reduced()) return 1;
    return performance.now() < hitUntil ? 0 : 1;
  }

  function resize() {
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, root.devicePixelRatio || 1);
    canvas.width = Math.floor(root.innerWidth * dpr);
    canvas.height = Math.floor(root.innerHeight * dpr);
    canvas.style.width = root.innerWidth + 'px';
    canvas.style.height = root.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function ensureCanvas() {
    if (canvas) return canvas;
    if (!document.body) return null;
    const host = document.createElement('div');
    host.id = 'feel-layer';
    host.setAttribute('aria-hidden', 'true');
    canvas = document.createElement('canvas');
    canvas.id = 'feel-fx';
    canvas.className = 'feel-fx';
    canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(canvas);
    document.body.appendChild(host);
    ctx = canvas.getContext('2d');
    if (!ctx) return null;
    resize();
    root.addEventListener('resize', resize);
    return canvas;
  }

  function kick() {
    if (raf || !ctx) return;
    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.034, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, root.innerWidth, root.innerHeight);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.age += dt;
        if (p.age >= p.life) { particles.splice(i, 1); continue; }
        p.vy += 320 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const t = 1 - p.age / p.life;
        ctx.globalAlpha = Math.max(0, t);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (0.55 + t), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (particles.length) raf = requestAnimationFrame(frame);
      else {
        raf = 0;
        ctx.clearRect(0, 0, root.innerWidth, root.innerHeight);
      }
    }
    raf = requestAnimationFrame(frame);
  }

  function burst(x, y, color, n) {
    if (reduced()) return 0;
    if (!ensureCanvas() || !ctx) return 0;
    const count = Math.max(4, Math.min(32, n || 14));
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const sp = 80 + Math.random() * 180;
      particles.push({
        x: x, y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 50,
        life: 0.45 + Math.random() * 0.28,
        age: 0,
        r: 2 + Math.random() * 2.4,
        color: color || '#F7C948',
      });
    }
    if (particles.length > 220) particles.splice(0, particles.length - 220);
    kick();
    return count;
  }

  let shakeBase = null;
  function shake(target, mag, ms) {
    if (reduced()) return;
    const el = target && target.style ? target : null;
    if (!el) return;
    const token = ++shakeToken;
    if (!shakeBase || shakeBase.el !== el) {
      if (shakeBase && shakeBase.el) shakeBase.el.style.transform = shakeBase.transform;
      shakeBase = { el: el, transform: el.style.transform || '' };
    }
    const start = performance.now();
    const dur = ms || 180;
    const amp = mag || 6;
    const base = shakeBase;
    function frame(now) {
      if (token !== shakeToken) return;
      const t = (now - start) / dur;
      if (t >= 1) {
        el.style.transform = base.transform;
        if (shakeBase === base) shakeBase = null;
        return;
      }
      const damp = 1 - t;
      const x = Math.round(Math.sin(t * 42) * amp * damp);
      const y = Math.round(Math.cos(t * 34) * amp * 0.65 * damp);
      el.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function ensureFlash() {
    let el = document.getElementById('feel-flash');
    if (el) return el;
    if (!document.body) return null;
    el = document.createElement('div');
    el.id = 'feel-flash';
    el.className = 'feel-flash';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
    return el;
  }

  function hitStop(ms) {
    if (reduced()) return 0;
    const hold = Math.max(16, Math.min(120, ms || 40));
    hitUntil = Math.max(hitUntil, performance.now() + hold);
    const flash = ensureFlash();
    if (flash) flash.classList.add('on');
    document.documentElement.classList.add('feel-hitstop');
    setTimeout(function () {
      if (performance.now() >= hitUntil) {
        document.documentElement.classList.remove('feel-hitstop');
        if (flash) flash.classList.remove('on');
      }
    }, hold + 20);
    return hold;
  }

  function tween(from, to, ms, ease, onUpdate, onDone) {
    const easeFn = typeof ease === 'function' ? ease : (EASE[ease] || EASE.outCubic);
    const dur = Math.max(0, ms || 0);
    if (reduced() || dur === 0) {
      try { if (onUpdate) onUpdate(to, 1); } catch (e) {}
      try { if (onDone) onDone(); } catch (e) {}
      return function () {};
    }
    const start = performance.now();
    let dead = false;
    const job = { cancel: function () { dead = true; tweens.delete(job); } };
    tweens.add(job);
    function frame(now) {
      if (dead) return;
      const t = Math.min(1, (now - start) / dur);
      const v = from + (to - from) * easeFn(t);
      try { if (onUpdate) onUpdate(v, t); } catch (e) {}
      if (t < 1) requestAnimationFrame(frame);
      else {
        tweens.delete(job);
        try { if (onDone) onDone(); } catch (e) {}
      }
    }
    requestAnimationFrame(frame);
    return job.cancel;
  }

  function popup(x, y, text, color) {
    if (!document.body || text == null || text === '') return null;
    const el = document.createElement('div');
    el.className = 'feel-popup';
    el.textContent = String(text);
    el.style.left = (x || root.innerWidth / 2) + 'px';
    el.style.top = (y || root.innerHeight / 2) + 'px';
    el.style.color = color || '#fff';
    document.body.appendChild(el);
    if (reduced()) {
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 420);
      return el;
    }
    const y0 = y || root.innerHeight / 2;
    tween(0, 1, 620, 'outCubic', function (v) {
      el.style.top = (y0 - 52 * EASE.outCubic(v)) + 'px';
      el.style.opacity = String(Math.max(0, 1 - v * v));
      const s = 0.86 + 0.28 * EASE.outBack(Math.min(1, v * 1.4));
      el.style.transform = 'translate(-50%, -100%) scale(' + s.toFixed(3) + ')';
    }, function () { if (el.parentNode) el.parentNode.removeChild(el); });
    return el;
  }

  function transition(opts, done) {
    const o = opts || {};
    const finish = function () { try { if (done) done(); } catch (e) {} };
    if (!document.body) { finish(); return; }
    const el = document.createElement('div');
    el.className = 'feel-transition';
    el.setAttribute('role', 'presentation');
    const card = document.createElement('div');
    card.className = 'feel-transition-card';
    const title = document.createElement('div');
    title.className = 'feel-transition-title';
    title.textContent = o.title || '';
    const sub = document.createElement('div');
    sub.className = 'feel-transition-sub';
    sub.textContent = o.sub || '';
    card.appendChild(title);
    if (o.sub) card.appendChild(sub);
    el.appendChild(card);
    document.body.appendChild(el);
    function remove() { if (el.parentNode) el.parentNode.removeChild(el); }
    if (reduced()) {
      finish();
      setTimeout(remove, 20);
      return;
    }
    el.style.opacity = '0';
    tween(0, 1, 180, 'outCubic', function (v) { el.style.opacity = String(v); }, function () {
      finish();
      const hold = o.hold == null ? 180 : o.hold;
      setTimeout(function () {
        tween(1, 0, 200, 'outCubic', function (v) { el.style.opacity = String(v); }, remove);
      }, hold);
    });
  }

  function haptic(pattern) {
    if (!haptics) return false;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern || 12);
        return true;
      }
    } catch (e) { /* unsupported */ }
    return false;
  }

  function point(opts) {
    const o = opts || {};
    return {
      x: typeof o.x === 'number' ? o.x : root.innerWidth / 2,
      y: typeof o.y === 'number' ? o.y : root.innerHeight * 0.4,
    };
  }

  function punch(kind, opts) {
    const spec = KINDS[kind] || KINDS.hit;
    const o = opts || {};
    const p = point(o);
    const color = o.color || spec.color;
    try {
      burst(p.x, p.y, color, o.n || spec.n);
      shake(o.target, o.mag || spec.mag, o.ms || 170);
      hitStop(o.stop || spec.stop);
      if (o.text) popup(p.x, p.y, o.text, color);
      if (o.haptic !== false) haptic(o.buzz || spec.buzz);
    } catch (e) { /* juice never takes the game down */ }
  }

  function drip(opts) {
    if (reduced()) return;
    const now = performance.now();
    if (now - dripAt < 140) return;
    dripAt = now;
    const o = opts || {};
    const p = point(o);
    try {
      burst(p.x, p.y, o.color || '#7ee787', 6);
      if (o.text) popup(p.x, p.y, o.text, o.color || '#7ee787');
    } catch (e) {}
  }

  function paintBound() {
    const nodes = document.querySelectorAll('[data-feel-bound]');
    for (let i = 0; i < nodes.length; i++) {
      const btn = nodes[i];
      const which = btn.dataset.feelBound;
      btn.textContent = which === 'haptics' ? hapticsLabel() : motionLabel();
      btn.setAttribute('aria-pressed', which === 'haptics'
        ? (haptics ? 'true' : 'false')
        : (motion === 'reduced' ? 'true' : 'false'));
    }
  }

  function bindButton(btn, which) {
    if (!btn) return;
    btn.dataset.feelBound = which === 'haptics' ? 'haptics' : 'motion';
    if (!btn.dataset.feelClick) {
      btn.dataset.feelClick = '1';
      btn.addEventListener('click', function () {
        if (btn.dataset.feelBound === 'haptics') {
          cycleHaptics();
          if (haptics) haptic(12);
        } else cycleMotion();
        paintBound();
      });
    }
    if (!root.__feelBoundListen) {
      root.__feelBoundListen = true;
      document.addEventListener('eureka-feel-change', paintBound);
    }
    paintBound();
  }

  readStore();
  applyRoot();
  try {
    const mq = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq && mq.addEventListener) mq.addEventListener('change', function () { applyRoot(); emit(); });
  } catch (e) {}

  root.EurekaFeel = {
    STORE: STORE,
    EASE: EASE,
    reduced: reduced,
    motion: function () { return motion; },
    hapticsOn: function () { return haptics; },
    motionLabel: motionLabel,
    hapticsLabel: hapticsLabel,
    setMotion: setMotion,
    cycleMotion: cycleMotion,
    setHaptics: setHaptics,
    cycleHaptics: cycleHaptics,
    timeScale: timeScale,
    burst: burst,
    shake: shake,
    hitStop: hitStop,
    tween: tween,
    popup: popup,
    transition: transition,
    haptic: haptic,
    punch: punch,
    drip: drip,
    bindButton: bindButton,
    particleCount: function () { return particles.length; },
  };
})(typeof window !== 'undefined' ? window : globalThis);
