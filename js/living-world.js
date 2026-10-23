/* ============================================
   LIVING WORLD — day, night, and weather.

   One clock for the flagships that opt in.
   Age of War and Grow Op read the same
   modifiers: rain feeds a crop and wets a
   bow, night makes the enemy meaner and the
   street pay more, fog shortens sight, a
   storm slows the march and favors heavies.
   Startup Tycoon watches the same sky in the
   office windows and names none of those
   rules, so a deal stays a deal.

   The first stretch of a visit is a clear
   morning, so a saved war and a saved corner
   load with the same numbers they had before
   this file existed. Nothing here is written
   into those saves. A ?world= query pins a
   sky for a look, or tours the cycle.

   Particles stay on a short budget and drop
   to none when motion is reduced. The paint
   helper is optional; the rules stand alone.
   ============================================ */

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.EurekaWorld = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const PHASE = {
    dawn:  { id: 'dawn', name: 'Dawn', icon: '🌅', foe: 1, vision: 0.9, move: 1, growth: 1, price: 1, heatGain: 0.92, buyers: 1, spawn: 1 },
    day:   { id: 'day', name: 'Day', icon: '🌤️', foe: 1, vision: 1, move: 1, growth: 1, price: 1, heatGain: 1, buyers: 1, spawn: 1 },
    dusk:  { id: 'dusk', name: 'Dusk', icon: '🌇', foe: 1.08, vision: 0.88, move: 1, growth: 1, price: 1.06, heatGain: 1.08, buyers: 1.05, spawn: 0.94 },
    night: { id: 'night', name: 'Night', icon: '🌙', foe: 1.24, vision: 0.78, move: 0.94, growth: 0.9, price: 1.18, heatGain: 1.28, buyers: 0.8, spawn: 0.82 },
  };

  const WEATHER = {
    clear: { id: 'clear', name: 'Clear', icon: '☀️', growth: 1, move: 1, vision: 1, foe: 1, heavy: 1, ranged: 1, heatGain: 1, heatDrain: 1, buyers: 1, price: 1, spawn: 1 },
    rain:  { id: 'rain', name: 'Rain', icon: '🌧️', growth: 1.45, move: 0.9, vision: 0.92, foe: 1, heavy: 1, ranged: 0.84, heatGain: 0.85, heatDrain: 1.45, buyers: 1.25, price: 1, spawn: 1 },
    fog:   { id: 'fog', name: 'Fog', icon: '🌫️', growth: 0.92, move: 0.96, vision: 0.52, foe: 1.06, heavy: 1, ranged: 0.9, heatGain: 0.95, heatDrain: 1.05, buyers: 1.55, price: 1.06, spawn: 1 },
    storm: { id: 'storm', name: 'Storm', icon: '⛈️', growth: 1.12, move: 0.72, vision: 0.74, foe: 1.12, heavy: 1.25, ranged: 0.7, heatGain: 1.22, heatDrain: 0.85, buyers: 1.7, price: 1.08, spawn: 0.9 },
    snow:  { id: 'snow', name: 'Snow', icon: '❄️', growth: 0.58, move: 0.78, vision: 0.8, foe: 1.05, heavy: 1.08, ranged: 0.88, heatGain: 0.8, heatDrain: 1.3, buyers: 1.35, price: 1.12, spawn: 1 },
  };

  const PROFILES = {
    ageofwar: {
      id: 'ageofwar',
      dayLength: 150,
      holdClear: 100,
      start: 0.28,
      weathers: ['clear', 'rain', 'fog', 'storm', 'snow'],
      show: ['move', 'foe', 'heavy', 'ranged', 'vision', 'spawn'],
    },
    growop: {
      id: 'growop',
      dayLength: 150,
      holdClear: 100,
      start: 0.28,
      weathers: ['clear', 'rain', 'fog', 'storm', 'snow'],
      show: ['growth', 'move', 'price', 'heatGain', 'heatDrain', 'buyers', 'vision'],
    },
    // Visual only. show: [] keeps the chip on "open sky"
    // so rain and night never get named as deal effects.
    tycoon: {
      id: 'tycoon',
      dayLength: 150,
      holdClear: 100,
      start: 0.28,
      weathers: ['clear', 'rain', 'fog', 'storm', 'snow'],
      show: [],
    },
  };

  const PHASE_AT = [
    { id: 'dawn', until: 0.16 },
    { id: 'day', until: 0.62 },
    { id: 'dusk', until: 0.74 },
    { id: 'night', until: 1 },
  ];

  const PHASE_CLOCK = { dawn: 0.08, day: 0.36, dusk: 0.68, night: 0.86 };
  const WEIGHT = { clear: 3, rain: 3, fog: 2, storm: 2, snow: 2 };
  const TOUR = [
    { phase: 'day', weather: 'clear' },
    { phase: 'day', weather: 'rain' },
    { phase: 'dusk', weather: 'fog' },
    { phase: 'night', weather: 'clear' },
    { phase: 'night', weather: 'storm' },
    { phase: 'day', weather: 'snow' },
  ];
  const CAP = { clear: 0, fog: 0, rain: 40, storm: 36, snow: 26 };

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function phaseAt(t) {
    const x = ((t % 1) + 1) % 1;
    for (let i = 0; i < PHASE_AT.length; i++) {
      if (x < PHASE_AT[i].until) return PHASE_AT[i].id;
    }
    return 'night';
  }

  function parseQuery(query) {
    const out = { tour: false, fast: false, phase: null, weather: null };
    if (!query) return out;
    const raw = String(query);
    const q = raw.indexOf('world=') >= 0
      ? (raw.split('world=')[1] || '').split('&')[0]
      : raw;
    const parts = decodeURIComponent(q).toLowerCase().split(/[^a-z]+/).filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p === 'tour' || p === 'demo') out.tour = true;
      else if (p === 'fast') out.fast = true;
      else if (PHASE[p]) out.phase = p;
      else if (WEATHER[p]) out.weather = p;
    }
    return out;
  }

  function combine(phaseId, weatherId) {
    const p = PHASE[phaseId] || PHASE.day;
    const w = WEATHER[weatherId] || WEATHER.clear;
    return {
      growth: round2(p.growth * w.growth),
      move: round2(p.move * w.move),
      vision: round2(p.vision * w.vision),
      foe: round2(p.foe * w.foe),
      heavy: w.heavy,
      ranged: w.ranged,
      heatGain: round2(p.heatGain * w.heatGain),
      heatDrain: w.heatDrain,
      buyers: round2(p.buyers * w.buyers),
      price: round2(p.price * w.price),
      spawn: round2(p.spawn * w.spawn),
    };
  }

  function pct(n) {
    return Math.round(n * 100) + '%';
  }

  function effectLine(mods, show) {
    const bits = [];
    const want = function (key) { return !show || show.indexOf(key) >= 0; };
    if (want('growth') && mods.growth > 1.02) bits.push('crops ' + pct(mods.growth));
    if (want('growth') && mods.growth < 0.98) bits.push('crops ' + pct(mods.growth));
    if (want('move') && mods.move < 0.98) bits.push('march ' + pct(mods.move));
    if (want('foe') && mods.foe > 1.02) bits.push('foes ' + pct(mods.foe));
    if (want('heavy') && mods.heavy > 1.02) bits.push('heavies ' + pct(mods.heavy));
    if (want('ranged') && mods.ranged < 0.98) bits.push('ranged ' + pct(mods.ranged));
    if (want('vision') && mods.vision < 0.98) bits.push('sight ' + pct(mods.vision));
    if (want('price') && mods.price > 1.02) bits.push('street ' + pct(mods.price));
    if (want('heatGain') && mods.heatGain > 1.02) bits.push('heat ' + pct(mods.heatGain));
    if (want('heatGain') && mods.heatGain < 0.98) bits.push('heat ' + pct(mods.heatGain));
    if (want('heatDrain') && mods.heatDrain > 1.02) bits.push('cools ' + pct(mods.heatDrain));
    if (want('buyers') && mods.buyers > 1.02) bits.push('buyers slower');
    if (want('buyers') && mods.buyers < 0.98) bits.push('buyers sooner');
    if (want('spawn') && mods.spawn < 0.98) bits.push('waves sooner');
    if (!bits.length) bits.push('open sky');
    return bits.slice(0, 3).join(' · ');
  }

  function moodFor(snap) {
    if (!snap) return 'calm';
    if (snap.weather === 'storm' || snap.phase === 'night') return 'tense';
    if (snap.weather === 'rain' || snap.weather === 'snow' || snap.weather === 'fog' || snap.phase === 'dusk' || snap.phase === 'dawn') return 'busy';
    return 'calm';
  }

  function particleBudget(weather, reduced) {
    if (reduced) return 0;
    return CAP[weather] || 0;
  }

  function paintCap(weather, reduced, width) {
    const n = particleBudget(weather, reduced);
    if (width && width < 800) return Math.min(n, 22);
    return n;
  }

  function pickWeather(rng, allowed, current) {
    const pool = [];
    let total = 0;
    for (let i = 0; i < allowed.length; i++) {
      const id = allowed[i];
      if (id === current) continue;
      const w = WEIGHT[id] || 1;
      total += w;
      pool.push({ id: id, at: total });
    }
    if (!pool.length) return current || 'clear';
    const roll = rng() * total;
    for (let i = 0; i < pool.length; i++) {
      if (roll < pool[i].at) return pool[i].id;
    }
    return pool[pool.length - 1].id;
  }

  function veilFor(phase, weather) {
    if (phase === 'night') return { color: 'rgba(5,8,22,0.5)', alpha: 1 };
    if (phase === 'dusk') return { color: 'rgba(64,28,72,0.28)', alpha: 1 };
    if (phase === 'dawn') return { color: 'rgba(255,140,64,0.2)', alpha: 1 };
    if (weather === 'storm') return { color: 'rgba(12,18,32,0.28)', alpha: 1 };
    if (weather === 'rain') return { color: 'rgba(40,70,110,0.16)', alpha: 1 };
    if (weather === 'fog') return { color: 'rgba(186,194,204,0.08)', alpha: 1 };
    if (weather === 'snow') return { color: 'rgba(170,190,220,0.16)', alpha: 1 };
    return { color: 'rgba(0,0,0,0)', alpha: 0 };
  }

  function create(opts) {
    opts = opts || {};
    const profile = PROFILES[opts.profile] || PROFILES.ageofwar;
    const query = parseQuery(opts.query || '');
    const seed = opts.seed == null ? 1 : (opts.seed >>> 0);
    const rng = mulberry32(seed);
    const vis = mulberry32(seed ^ 0x9e3779b9);
    const allowed = (opts.weathers || profile.weathers).slice();
    const show = profile.show;
    let dayLength = opts.dayLength || profile.dayLength;
    let hold = opts.holdClear == null ? profile.holdClear : opts.holdClear;
    if (query.fast || opts.fast) {
      dayLength = 36;
      hold = 8;
    }
    let t = opts.start == null ? profile.start : opts.start;
    let day = 1;
    let weather = 'clear';
    let weatherLeft = hold;
    let pinPhase = null;
    let pinWeather = null;
    let tour = !!query.tour;
    let tourI = 0;
    let tourT = 0;
    const tourEvery = opts.tourEvery || 6;
    let flash = 0;
    let flashIn = 1.4;
    const drops = [];
    let dropWeather = '';

    if (query.phase) {
      pinPhase = query.phase;
      t = PHASE_CLOCK[pinPhase];
    }
    if (query.weather && allowed.indexOf(query.weather) >= 0) {
      pinWeather = query.weather;
      weather = pinWeather;
      weatherLeft = 1e9;
    }
    if (tour) {
      const beat = TOUR[0];
      pinPhase = null;
      pinWeather = null;
      t = PHASE_CLOCK[beat.phase];
      weather = allowed.indexOf(beat.weather) >= 0 ? beat.weather : 'clear';
    }

    function mods() {
      return combine(phaseAt(t), weather);
    }

    function snapshot() {
      const phase = phaseAt(t);
      const m = combine(phase, weather);
      const effect = effectLine(m, show);
      const phaseName = PHASE[phase].name;
      const weatherName = WEATHER[weather].name;
      return {
        phase: phase,
        phaseName: phaseName,
        phaseIcon: PHASE[phase].icon,
        weather: weather,
        weatherName: weatherName,
        weatherIcon: WEATHER[weather].icon,
        day: day,
        clock: round2(t),
        mods: m,
        mood: moodFor({ phase: phase, weather: weather }),
        effect: effect,
        label: PHASE[phase].icon + ' ' + phaseName + ' · ' + WEATHER[weather].icon + ' ' + weatherName + ' — ' + effect,
        detail: phaseName + ' ' + weatherName.toLowerCase() + ' — ' + effect,
        key: phase + '|' + weather,
        flash: flash,
        veil: veilFor(phase, weather),
        pinned: !!(pinPhase || pinWeather) && !tour,
        tour: tour,
      };
    }

    function tick(dt) {
      const before = phaseAt(t) + '|' + weather;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt < 0) dt = 0;
      if (dt > 1) dt = 1;
      if (tour) {
        tourT += dt;
        if (tourT >= tourEvery) {
          tourT = 0;
          tourI = (tourI + 1) % TOUR.length;
          const beat = TOUR[tourI];
          t = PHASE_CLOCK[beat.phase];
          weather = allowed.indexOf(beat.weather) >= 0 ? beat.weather : 'clear';
        }
      } else if (!pinPhase) {
        t += dt / dayLength;
        while (t >= 1) { t -= 1; day += 1; }
      }
      if (!tour && !pinWeather) {
        weatherLeft -= dt;
        if (weatherLeft <= 0) {
          weather = pickWeather(rng, allowed, weather);
          weatherLeft = 26 + rng() * 18;
        }
      }
      if (weather === 'storm') {
        flashIn -= dt;
        if (flashIn <= 0) {
          flash = 1;
          flashIn = 5.5 + rng() * 3;
        } else {
          flash = Math.max(0, flash - dt * 1.6);
        }
      } else {
        flash = Math.max(0, flash - dt * 2);
      }
      return before !== (phaseAt(t) + '|' + weather);
    }

    function force(next) {
      next = next || {};
      tour = false;
      if (next.phase && PHASE[next.phase]) {
        pinPhase = next.phase;
        t = PHASE_CLOCK[next.phase];
      }
      if (next.weather && WEATHER[next.weather]) {
        pinWeather = next.weather;
        weather = next.weather;
        weatherLeft = 1e9;
      }
      if (next.weather === 'storm') flashIn = 0.8;
      return snapshot();
    }

    function unitDamage(raw, unit) {
      const m = mods();
      let d = Number(raw);
      if (!Number.isFinite(d)) d = 0;
      if (unit && unit.side === 'enemy') d *= m.foe;
      if (unit && unit.line === 'heavy') d *= m.heavy;
      if (unit && (unit.line === 'ranged' || unit.range > 60)) d *= m.ranged;
      const rounded = Math.round(d);
      return rounded < 0 ? 0 : rounded;
    }

    function moveStep(speed) {
      const n = Number(speed);
      if (!Number.isFinite(n)) return 0;
      return n * mods().move;
    }

    function limitRange(range) {
      const n = Number(range);
      if (!Number.isFinite(n)) return 0;
      const v = mods().vision;
      if (v >= 0.999) return n;
      return n * Math.max(0.35, v);
    }

    function unitSees(distance, range) {
      const v = mods().vision;
      if (v >= 0.999) return true;
      const d = Number(distance);
      const r = Number(range);
      if (!Number.isFinite(d) || !Number.isFinite(r)) return true;
      return d <= r * Math.max(0.35, v);
    }

    function growSeconds(seconds) {
      const n = Number(seconds);
      if (!Number.isFinite(n)) return 0;
      const g = mods().growth || 1;
      return n / g;
    }

    function saleValue(price) {
      const n = Number(price);
      if (!Number.isFinite(n)) return 0;
      return Math.floor(n * mods().price);
    }

    function heatGain(amount) {
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0) return n || 0;
      return n * mods().heatGain;
    }

    function spawnGap(base) {
      const n = Number(base);
      if (!Number.isFinite(n)) return 0;
      return n * mods().spawn;
    }

    function paint(ctx, w, h, dt, reduced) {
      const snap = snapshot();
      if (!ctx || !(w > 0) || !(h > 0)) return snap;
      if (snap.phase === 'day' && snap.weather === 'clear') {
        drops.length = 0;
        return snap;
      }
      const step = Number.isFinite(dt) ? clamp(dt, 0, 0.05) : 0.016;
      const veil = snap.veil;
      if (veil && veil.alpha > 0 && veil.color.indexOf('0)') === -1) {
        ctx.save();
        ctx.fillStyle = veil.color;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
      if (snap.phase === 'night') {
        const mx = w * 0.78;
        const my = Math.max(36, h * 0.14);
        ctx.save();
        ctx.fillStyle = 'rgba(244,236,210,0.95)';
        ctx.beginPath();
        ctx.arc(mx, my, Math.max(10, Math.min(18, w * 0.014)), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      if (snap.weather === 'fog') {
        const g = ctx.createLinearGradient(0, h * 0.2, 0, h);
        g.addColorStop(0, 'rgba(210,216,224,0)');
        g.addColorStop(0.4, 'rgba(198,206,214,0.22)');
        g.addColorStop(1, 'rgba(176,184,194,0.48)');
        ctx.save();
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
      if (!reduced && snap.flash > 0.08) {
        ctx.save();
        ctx.fillStyle = 'rgba(226,236,255,' + (snap.flash * 0.38).toFixed(3) + ')';
        ctx.fillRect(0, 0, w, h);
        if (snap.flash > 0.55) {
          const bx = (Math.floor(snap.clock * 1000) % 1000) / 1000 * w;
          ctx.strokeStyle = 'rgba(240,246,255,0.85)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(bx, 0);
          ctx.lineTo(bx + 18, h * 0.28);
          ctx.lineTo(bx - 8, h * 0.46);
          ctx.lineTo(bx + 24, h * 0.72);
          ctx.stroke();
        }
        ctx.restore();
      }
      const cap = paintCap(snap.weather, !!reduced, w);
      if (dropWeather !== snap.weather) {
        drops.length = 0;
        dropWeather = snap.weather;
      }
      while (drops.length > cap) drops.pop();
      while (drops.length < cap) {
        drops.push({
          x: vis() * w,
          y: vis() * h,
          vy: snap.weather === 'snow' ? 28 + vis() * 22 : 420 + vis() * 220,
          vx: snap.weather === 'snow' ? -18 + vis() * 36 : -40 - vis() * 30,
          len: snap.weather === 'snow' ? 1.5 + vis() * 2.2 : 8 + vis() * 10,
        });
      }
      if (cap > 0) {
        ctx.save();
        ctx.strokeStyle = snap.weather === 'snow' ? 'rgba(255,255,255,0.9)' : 'rgba(186,214,255,0.7)';
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = snap.weather === 'storm' ? 1.6 : 1.15;
        for (let i = 0; i < drops.length; i++) {
          const d = drops[i];
          d.y += d.vy * step;
          d.x += d.vx * step;
          if (d.y > h + 8) { d.y = -8; d.x = vis() * w; }
          if (d.x < -20) d.x = w + 10;
          if (snap.weather === 'snow') {
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.len, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d.x + d.vx * 0.02, d.y + d.len);
            ctx.stroke();
          }
        }
        ctx.restore();
      }
      return snap;
    }

    return {
      profile: profile.id,
      tick: tick,
      force: force,
      snapshot: snapshot,
      mods: mods,
      unitDamage: unitDamage,
      moveStep: moveStep,
      limitRange: limitRange,
      unitSees: unitSees,
      growSeconds: growSeconds,
      saleValue: saleValue,
      heatGain: heatGain,
      spawnGap: spawnGap,
      paint: paint,
    };
  }

  return {
    create: create,
    PHASE: PHASE,
    WEATHER: WEATHER,
    PROFILES: PROFILES,
    parseQuery: parseQuery,
    combine: combine,
    moodFor: moodFor,
    particleBudget: particleBudget,
    paintCap: paintCap,
    phaseAt: phaseAt,
  };
});
