/* ============================================
   CLIMAX — a telegraph fight for two flagships.

   Hearthvale stands the Hollow Wolf. Startup
   Tycoon (and Beagle Sim, the same office in a
   yard skin) answers a hostile takeover.

   The mechanic is the tell. A lane lights, the
   open window is when a press counts, and the
   later phases feint: the first lane is a lie
   and the real one snaps in before the strike.
   Four hearts. Misses are yours. A perfect
   string is a combo. A late-but-legal press is
   a near miss, not a death.

   Lines come from the bank below. That bank is
   the whole announcer when nothing else is
   loaded. If the arcade AI stub is on the page
   it may add a booth line; the bank line is
   already on screen, and a failed or missing
   provider never blocks the fight. No request
   leaves the machine unless a caller passes a
   provider that does that itself.
   ============================================ */

(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.EurekaClimax = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  const SPECS = {
    hearthvale: {
      id: 'hearthvale',
      game: 'hearthvale',
      scene: 'vale',
      kicker: 'Night raid',
      title: 'The Hollow Wolf',
      boss: 'Hollow Wolf',
      companion: { name: 'Wren', role: 'Night watch', icon: '🦊' },
      blurb: 'Match the gate it commits to. A feint flips. You have four hearts.',
      accent: '#f2c14e',
      maxHp: 96,
      hearts: 4,
      intro: 1.35,
      recover: 0.48,
      near: 0.2,
      lanes: [
        { id: 'west', label: 'West gate', glyph: '◀', keys: ['a', 'arrowleft', '1'] },
        { id: 'hearth', label: 'The hearth', glyph: '●', keys: ['s', 'arrowdown', '2'] },
        { id: 'east', label: 'East gate', glyph: '▶', keys: ['d', 'arrowright', '3'] },
      ],
      phases: [
        { id: 'stalk', name: 'Stalk', above: 60, windup: 1.45, open: 1.55, damage: 16, feint: 0 },
        { id: 'charge', name: 'Charge', above: 30, windup: 1.15, open: 1.25, damage: 18, feint: 0.42 },
        { id: 'frenzy', name: 'Frenzy', above: 0, windup: 1.0, open: 1.15, damage: 20, feint: 0.5 },
      ],
    },
    tycoon: {
      id: 'tycoon',
      game: 'tycoon',
      scene: 'office',
      kicker: 'Hostile takeover',
      title: 'The Bid',
      boss: 'Rival board',
      companion: { name: 'Quinn', role: 'General counsel', icon: '⚖️' },
      blurb: 'Counter the move they commit to. A feint flips. You have four hearts.',
      accent: '#79c0ff',
      maxHp: 96,
      hearts: 4,
      intro: 1.35,
      recover: 0.48,
      near: 0.2,
      lanes: [
        { id: 'press', label: 'Statement', glyph: '📣', keys: ['a', 'arrowleft', '1'] },
        { id: 'poach', label: 'Retain', glyph: '🤝', keys: ['s', 'arrowdown', '2'] },
        { id: 'suit', label: 'Counsel', glyph: '📜', keys: ['d', 'arrowright', '3'] },
      ],
      phases: [
        { id: 'rumor', name: 'Rumor', above: 60, windup: 1.45, open: 1.55, damage: 16, feint: 0 },
        { id: 'bid', name: 'The bid', above: 30, windup: 1.15, open: 1.25, damage: 18, feint: 0.42 },
        { id: 'squeeze', name: 'Squeeze', above: 0, windup: 1.0, open: 1.15, damage: 20, feint: 0.5 },
      ],
    },
    beagle: {
      id: 'beagle',
      game: 'beagle',
      scene: 'yard',
      kicker: 'Yard raid',
      title: 'Pug Ventures',
      boss: 'Pug Ventures',
      companion: { name: 'Biscuit', role: 'Head of pack', icon: '🐶' },
      blurb: 'Cover the hole they commit to. A feint flips. You have four hearts.',
      accent: '#e8a87c',
      maxHp: 96,
      hearts: 4,
      intro: 1.35,
      recover: 0.48,
      near: 0.2,
      lanes: [
        { id: 'bowl', label: 'The bowl', glyph: '🥣', keys: ['a', 'arrowleft', '1'] },
        { id: 'sofa', label: 'The sofa', glyph: '🛋️', keys: ['s', 'arrowdown', '2'] },
        { id: 'gate', label: 'The gate', glyph: '🚪', keys: ['d', 'arrowright', '3'] },
      ],
      phases: [
        { id: 'sniff', name: 'Sniff', above: 60, windup: 1.45, open: 1.55, damage: 16, feint: 0 },
        { id: 'dash', name: 'Dash', above: 30, windup: 1.15, open: 1.25, damage: 18, feint: 0.42 },
        { id: 'zoomies', name: 'Zoomies', above: 0, windup: 1.0, open: 1.15, damage: 20, feint: 0.5 },
      ],
    },
  };

  const LINES = {
    hearthvale: {
      start: [
        'Wren: Hollow wolf on the lane. Read the gate.',
        'Wren: It left the trees. Watch which gate it picks.',
        'Wren: Night watch is up. Match the charge.',
      ],
      'phase:charge': [
        'Wren: Stalk is over. Now it charges.',
        'Wren: Second phase. The tells get shorter.',
      ],
      'phase:frenzy': [
        'Wren: Frenzy. It will feint. Wait for the real gate.',
        'Wren: Last phase. The first step is a lie.',
      ],
      phase: ['Wren: New phase. Read it again.'],
      feint: [
        'Wren: Feint! That first step is a lie.',
        'Wren: Don\'t bite it. The real gate is next.',
      ],
      hit: [
        'Wren: Gate held. It felt that.',
        'Wren: Clean brace. The palisade stays.',
        'Wren: Good read. It wheels off.',
      ],
      nearmiss: [
        'Wren: Barely! The bar nearly gave.',
        'Wren: Late, but the gate held.',
      ],
      combo: [
        'Wren: Three straight. The watch is singing.',
        'Wren: Rhythm. Keep matching it.',
      ],
      miss: [
        'Wren: Wrong gate. The palisade splinters.',
        'Wren: That was the other side.',
      ],
      late: [
        'Wren: Too late. It was already through.',
        'Wren: The window closed. Heart gone.',
      ],
      early: [
        'Wren: Not yet. Wait until it commits.',
        'Wren: Hold. The strike is not open.',
      ],
      win: [
        'Wren: The wolf breaks. The valley keeps the night.',
        'Wren: It runs. Hang the night banner.',
      ],
      lose: [
        'Wren: Fall back to the hearth. We can stand again.',
        'Wren: Not this pass. The lane is still there.',
      ],
    },
    tycoon: {
      start: [
        'Quinn: They filed. Counter the move they commit to.',
        'Quinn: Takeover on the wire. Read the tell.',
        'Quinn: I have the clock. You have the answer.',
      ],
      'phase:bid': [
        'Quinn: Rumors are done. This is the bid.',
        'Quinn: Second phase. Shorter clock.',
      ],
      'phase:squeeze': [
        'Quinn: Squeeze. They will fake a headline first.',
        'Quinn: Last phase. Wait out the decoy.',
      ],
      phase: ['Quinn: New phase. Read it again.'],
      feint: [
        'Quinn: Decoy filing. That is not the real move.',
        'Quinn: Feint. Don\'t spend the answer yet.',
      ],
      hit: [
        'Quinn: Answer landed. Their stake slips.',
        'Quinn: Clean counter. The bid thins.',
        'Quinn: That one stuck.',
      ],
      nearmiss: [
        'Quinn: Barely filed in time.',
        'Quinn: Late stamp, but it counts.',
      ],
      combo: [
        'Quinn: Three straight. The board is rattled.',
        'Quinn: Keep the rhythm. They are slipping.',
      ],
      miss: [
        'Quinn: Wrong counter. They take a point.',
        'Quinn: That answer did not match the move.',
      ],
      late: [
        'Quinn: Clock ran out. They take the point.',
        'Quinn: Too late. The window shut.',
      ],
      early: [
        'Quinn: Not yet. Let the tell finish.',
        'Quinn: Hold the answer until they commit.',
      ],
      win: [
        'Quinn: The bid breaks. The company stays ours.',
        'Quinn: They withdraw. Hang the charter.',
      ],
      lose: [
        'Quinn: They have the room. We can answer again.',
        'Quinn: Not this round. The bid is still open.',
      ],
    },
    beagle: {
      start: [
        'Biscuit: Pug Ventures is in the yard. Cover the hole.',
        'Biscuit: Pack call. Watch which spot they commit to.',
        'Biscuit: I have the nose. You have the paws.',
      ],
      'phase:dash': [
        'Biscuit: Sniffing is over. Now they dash.',
        'Biscuit: Second phase. Shorter tells.',
      ],
      'phase:zoomies': [
        'Biscuit: Zoomies. The first hole is a fake.',
        'Biscuit: Last phase. Wait for the real dash.',
      ],
      phase: ['Biscuit: New phase. Read it again.'],
      feint: [
        'Biscuit: Feint! That first hole is a trick.',
        'Biscuit: Don\'t dive yet. The real spot is next.',
      ],
      hit: [
        'Biscuit: Covered. They bounce off.',
        'Biscuit: Good paws. The yard holds.',
        'Biscuit: That dig was ours.',
      ],
      nearmiss: [
        'Biscuit: Barely! The dirt was already flying.',
        'Biscuit: Late paws, but the hole is filled.',
      ],
      combo: [
        'Biscuit: Three straight. The pack is howling.',
        'Biscuit: Rhythm. Keep covering.',
      ],
      miss: [
        'Biscuit: Wrong spot. They got a paw in.',
        'Biscuit: That was the other hole.',
      ],
      late: [
        'Biscuit: Too late. They were already through.',
        'Biscuit: The window shut. Heart gone.',
      ],
      early: [
        'Biscuit: Not yet. Wait until they commit.',
        'Biscuit: Hold. The dash is not open.',
      ],
      win: [
        'Biscuit: They bolt. The yard keeps its name.',
        'Biscuit: Pack holds. Hang the charter on the gate.',
      ],
      lose: [
        'Biscuit: Back to the sofa. We can stand again.',
        'Biscuit: Not this pass. The yard is still ours to cover.',
      ],
    },
  };

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function specOf(id) {
    if (id && typeof id === 'object' && id.lanes) return id;
    const spec = SPECS[id];
    if (!spec) throw new Error('unknown climax: ' + id);
    return spec;
  }

  function laneById(spec, id) {
    for (let i = 0; i < spec.lanes.length; i++) {
      if (spec.lanes[i].id === id) return spec.lanes[i];
    }
    return null;
  }

  function keyLane(specOrId, key) {
    const spec = specOf(specOrId);
    const k = String(key || '').toLowerCase();
    for (let i = 0; i < spec.lanes.length; i++) {
      if (spec.lanes[i].keys.indexOf(k) >= 0) return spec.lanes[i].id;
    }
    return null;
  }

  function bank(game) {
    const src = LINES[game];
    if (!src) return null;
    const out = {};
    Object.keys(src).forEach(function (key) { out[key] = src[key].slice(); });
    return out;
  }

  function line(game, kind, salt, extra) {
    const bank = LINES[game];
    if (!bank) return 'Hold.';
    const phaseKey = kind === 'phase' && extra ? ('phase:' + extra) : '';
    const list = (phaseKey && bank[phaseKey]) || bank[kind] || bank.hit || ['Hold.'];
    const n = list.length || 1;
    const i = Math.abs(Number(salt) || 0) % n;
    return list[i];
  }

  function defaultProvider() {
    const AI = root && root.ArcadeAI;
    if (!AI || typeof AI.createStubProvider !== 'function') return null;
    try {
      if (typeof AI.withStubFallback === 'function' && typeof AI.createAiProvider === 'function') {
        return AI.withStubFallback(AI.createAiProvider({}), AI.createStubProvider());
      }
    } catch (e) { /* the bank is already on screen */ }
    try { return AI.createStubProvider(); } catch (e2) { return null; }
  }

  function flavor(game, event, provider) {
    const p = provider === undefined ? defaultProvider() : provider;
    if (!p || typeof p.announce !== 'function') return Promise.resolve(null);
    const ev = event || {};
    return Promise.resolve()
      .then(function () {
        return p.announce({
          game: game,
          event: {
            type: String(ev.type || 'event'),
            detail: String(ev.detail || '').slice(0, 100),
          },
        });
      })
      .then(function (res) {
        if (!res || !res.line) return null;
        if (res.game !== game) {
          const AI = root && root.ArcadeAI;
          const generic = !res.game && AI && AI.systemLines && AI.systemLines.indexOf(res.line) !== -1;
          if (!generic) return null;
        }
        return String(res.line).replace(/\s+/g, ' ').trim().slice(0, 170);
      })
      .catch(function () { return null; });
  }

  function create(id, opts) {
    const spec = specOf(id);
    opts = opts || {};
    const seed = opts.seed == null ? ((Date.now() ^ ((Math.random() * 0xffffffff) >>> 0)) >>> 0) : (Number(opts.seed) >>> 0);
    const rng = mulberry32(seed || 1);
    let status = 'idle';
    let hp = spec.maxHp;
    let hearts = spec.hearts;
    let phaseIndex = 0;
    let lane = spec.lanes[0].id;
    let shown = lane;
    let feinting = false;
    let timer = 0;
    let windupTotal = 0;
    let streak = 0;
    let beat = 0;
    let resolved = false;

    function phase() { return spec.phases[phaseIndex]; }

    function phaseFor(value) {
      for (let i = 0; i < spec.phases.length; i++) {
        if (value > spec.phases[i].above) return i;
      }
      return spec.phases.length - 1;
    }

    function pick(avoid) {
      const lanes = spec.lanes;
      if (lanes.length < 2) return lanes[0].id;
      for (let n = 0; n < 8; n++) {
        const idPicked = lanes[Math.floor(rng() * lanes.length)].id;
        if (idPicked !== avoid) return idPicked;
      }
      for (let i = 0; i < lanes.length; i++) {
        if (lanes[i].id !== avoid) return lanes[i].id;
      }
      return lanes[0].id;
    }

    function snapshot() {
      const p = phase();
      return {
        id: spec.id,
        game: spec.game,
        status: status,
        hp: hp,
        maxHp: spec.maxHp,
        hearts: hearts,
        maxHearts: spec.hearts,
        phase: p.id,
        phaseName: p.name,
        phaseIndex: phaseIndex,
        lane: lane,
        shown: shown,
        feinting: feinting,
        timer: timer,
        streak: streak,
        beat: beat,
        title: spec.title,
        boss: spec.boss,
      };
    }

    function beginBeat() {
      const events = [];
      const idx = phaseFor(hp);
      if (idx !== phaseIndex) {
        phaseIndex = idx;
        events.push({ type: 'phase', phase: phase().id, name: phase().name, beat: beat });
      }
      const p = phase();
      lane = pick(null);
      const fake = p.feint > 0 ? pick(lane) : lane;
      feinting = fake !== lane;
      shown = feinting ? fake : lane;
      windupTotal = p.windup;
      timer = p.windup;
      status = 'windup';
      beat += 1;
      resolved = false;
      events.push({
        type: 'beat',
        beat: beat,
        phase: p.id,
        lane: lane,
        shown: shown,
        feint: feinting,
      });
      return events;
    }

    function finish(kind, pressed) {
      if (resolved) return [];
      resolved = true;
      const events = [];
      const p = phase();
      if (kind === 'hit' || kind === 'nearmiss') {
        let dmg = p.damage;
        if (kind === 'nearmiss') {
          dmg = Math.max(1, Math.ceil(dmg * 0.5));
          streak = 0;
        } else {
          streak += 1;
          if (streak >= 3) dmg += 8;
        }
        hp = Math.max(0, hp - dmg);
        events.push({ type: kind, damage: dmg, hp: hp, streak: streak, lane: lane, beat: beat });
        if (kind === 'hit' && streak >= 3 && streak % 3 === 0) {
          events.push({ type: 'combo', streak: streak, beat: beat });
        }
        if (hp <= 0) {
          status = 'won';
          timer = 0;
          events.push({ type: 'win', hp: 0, hearts: hearts, beat: beat });
          return events;
        }
      } else {
        hearts = Math.max(0, hearts - 1);
        streak = 0;
        events.push({ type: kind, hearts: hearts, lane: pressed || lane, beat: beat });
        if (hearts <= 0) {
          status = 'lost';
          timer = 0;
          events.push({ type: 'lose', hearts: 0, hp: hp, beat: beat });
          return events;
        }
      }
      status = 'recover';
      timer = spec.recover;
      return events;
    }

    function start() {
      hp = spec.maxHp;
      hearts = spec.hearts;
      phaseIndex = 0;
      streak = 0;
      beat = 0;
      resolved = false;
      feinting = false;
      lane = spec.lanes[0].id;
      shown = lane;
      status = 'intro';
      timer = spec.intro;
      windupTotal = 0;
      return [{ type: 'start', phase: phase().id, name: phase().name }];
    }

    function advance(dt) {
      if (status === 'idle' || status === 'won' || status === 'lost') return [];
      const events = [];
      timer -= dt;
      if (status === 'windup' && feinting && shown !== lane) {
        const elapsed = windupTotal - timer;
        if (elapsed >= windupTotal * phase().feint - 1e-9) {
          const from = shown;
          shown = lane;
          feinting = false;
          events.push({ type: 'feint', from: from, lane: lane, beat: beat, phase: phase().id });
        }
      }
      if (timer > 0) return events;
      if (status === 'intro' || status === 'recover') {
        return events.concat(beginBeat());
      }
      if (status === 'windup') {
        shown = lane;
        feinting = false;
        status = 'open';
        timer = phase().open;
        resolved = false;
        events.push({ type: 'open', lane: lane, beat: beat, phase: phase().id });
        return events;
      }
      if (status === 'open') return events.concat(finish('late'));
      return events;
    }

    function step(dt) {
      let left = Number(dt);
      if (!Number.isFinite(left) || left <= 0) return [];
      const events = [];
      let guard = 0;
      while (left > 1e-8 && guard++ < 2000) {
        if (status === 'won' || status === 'lost' || status === 'idle') break;
        const slice = Math.min(left, 0.05);
        const batch = advance(slice);
        for (let i = 0; i < batch.length; i++) events.push(batch[i]);
        left -= slice;
        if (status === 'won' || status === 'lost') break;
      }
      return events;
    }

    function press(id) {
      if (status === 'windup') {
        return [{ type: 'early', lane: id, beat: beat }];
      }
      if (status !== 'open' || resolved) return [];
      if (id === lane) return finish(timer <= spec.near ? 'nearmiss' : 'hit', id);
      return finish('miss', id);
    }

    return {
      spec: spec,
      seed: seed || 1,
      start: start,
      step: step,
      press: press,
      snapshot: snapshot,
    };
  }

  const LOUD = {
    win: 100, lose: 90, combo: 80, feint: 70, phase: 60,
    nearmiss: 50, hit: 40, miss: 30, late: 30, early: 20, start: 10,
  };

  function loudest(events) {
    let best = null;
    let rank = -1;
    for (let i = 0; i < events.length; i++) {
      const n = LOUD[events[i].type] || 0;
      if (n >= rank) { rank = n; best = events[i]; }
    }
    return best;
  }

  function detailFor(spec, ev) {
    if (!ev) return '';
    const lane = laneById(spec, ev.lane);
    const name = lane ? lane.label : (ev.name || ev.phase || '');
    if (ev.type === 'phase') return ev.name || ev.phase || '';
    if (ev.type === 'feint') return 'real lane ' + name;
    if (ev.type === 'combo') return 'combo ' + (ev.streak || 3);
    return name;
  }

  function cue(type) {
    const A = root && root.EurekaAudio;
    if (!A) return;
    try {
      if (type === 'win' && A.celebrate) { A.celebrate(8); return; }
      if (type === 'start' || type === 'phase') {
        if (A.setMood) A.setMood('tense');
        if (A.sfx) A.sfx('build');
        return;
      }
      if (type === 'feint' && A.sfx) { A.sfx('buy'); return; }
      if ((type === 'hit' || type === 'combo') && A.sfx) { A.sfx('harvest'); return; }
      if (type === 'nearmiss' && A.sfx) { A.sfx('build'); return; }
      if ((type === 'miss' || type === 'late' || type === 'lose') && A.sfx) A.sfx('fail');
    } catch (e) { /* the fight still resolves in silence */ }
  }

  const CSS = [
    '#climax-root{position:fixed;inset:0;z-index:8000;display:flex;flex-direction:column;',
    'justify-content:flex-end;gap:8px;padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px));',
    'background:rgba(6,8,12,.94);color:#f6f1e6;font-family:Georgia,Palatino,serif;',
    'touch-action:manipulation}',
    '#climax-root *{box-sizing:border-box}',
    '.cx-scene{position:absolute;inset:0 0 46% 0;display:flex;align-items:flex-end;justify-content:center;pointer-events:none}',
    '#climax-scene{width:min(720px,100%);height:auto;image-rendering:auto}',
    '.cx-top{position:relative;z-index:1;display:flex;justify-content:space-between;align-items:flex-end;gap:12px}',
    '.cx-kicker{font:700 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.16em;text-transform:uppercase;color:var(--cx,#f2c14e)}',
    '.cx-title{font-weight:800;font-size:clamp(22px,4vw,34px);line-height:1.05;margin-top:4px}',
    '.cx-hearts{font-size:22px;letter-spacing:3px;text-shadow:0 2px 8px #000}',
    '.cx-phase{position:relative;z-index:1;font:700 12px/1 ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:#d9d0c3}',
    '.cx-bar{position:relative;z-index:1;height:14px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden;border:1px solid rgba(255,255,255,.16)}',
    '#climax-fill{display:block;height:100%;width:100%;background:linear-gradient(90deg,#F85149,#fdba74);transform-origin:left center}',
    '.cx-hp{position:relative;z-index:1;font:600 12px/1 ui-monospace,Menlo,monospace;color:#d9d0c3}',
    '#climax-tell{position:relative;z-index:1;min-height:46px;display:flex;align-items:center;justify-content:center;',
    'font-weight:800;font-size:clamp(18px,3vw,26px);letter-spacing:.04em;text-align:center;',
    'border:1px dashed rgba(255,255,255,.28);border-radius:12px;padding:8px 12px;background:rgba(255,255,255,.04)}',
    '#climax-tell.is-feint{color:#f0c14a;border-style:dashed}',
    '#climax-tell.is-open{color:#fff;border-style:solid;border-color:var(--cx,#f2c14e);background:rgba(242,193,78,.12)}',
    '#climax-call{position:relative;z-index:1;min-height:2.6em;font-size:clamp(16px,2.4vw,20px);line-height:1.35;text-align:center}',
    '#climax-booth{position:relative;z-index:1;min-height:1.3em;font:13px/1.35 ui-monospace,Menlo,monospace;color:#c9bfae;text-align:center}',
    '.cx-lanes{position:relative;z-index:1;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}',
    '.cx-lane{min-height:64px;border-radius:14px;border:2px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);',
    'color:#f6f1e6;font:700 15px/1.2 inherit;cursor:pointer;padding:8px 6px;touch-action:manipulation}',
    '.cx-lane small{display:block;font:600 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.08em;opacity:.75;margin-top:4px}',
    '.cx-lane.is-tell{border-color:var(--cx,#f2c14e);transform:translateY(-2px)}',
    '.cx-lane.is-open{background:var(--cx,#f2c14e);color:#1a140c;border-color:transparent}',
    '.cx-lane:focus-visible{outline:3px solid #fff;outline-offset:2px}',
    '.cx-end{position:relative;z-index:2;display:flex;flex-direction:column;gap:8px}',
    '.cx-end[hidden]{display:none}',
    '.cx-reward{margin:0;text-align:center;font-size:16px;line-height:1.4}',
    '.cx-end button{min-height:52px;border-radius:12px;border:0;font:800 16px/1 inherit;cursor:pointer;touch-action:manipulation}',
    '#climax-again{background:var(--cx,#f2c14e);color:#1a140c}',
    '#climax-close{background:transparent;color:#f6f1e6;border:1px solid rgba(255,255,255,.3)!important}',
    '@media (prefers-reduced-motion: reduce){.cx-lane.is-tell{transform:none}}',
  ].join('');

  function ensureStyle(doc) {
    if (doc.getElementById('climax-style')) return;
    const style = doc.createElement('style');
    style.id = 'climax-style';
    style.textContent = CSS;
    doc.head.appendChild(style);
  }

  function drawScene(canvas, spec, snap, shake) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    if (spec.scene === 'office') {
      sky.addColorStop(0, '#0e1726');
      sky.addColorStop(1, '#1c2838');
    } else if (spec.scene === 'yard') {
      sky.addColorStop(0, '#243044');
      sky.addColorStop(1, '#3d4a32');
    } else {
      sky.addColorStop(0, '#101820');
      sky.addColorStop(1, '#1d3328');
    }
    ctx.fillStyle = sky;
    ctx.fillRect(-8, -8, w + 16, h + 16);
    const ground = h * 0.72;
    ctx.fillStyle = spec.scene === 'office' ? '#121820' : (spec.scene === 'yard' ? '#3e4a2c' : '#1a2a20');
    ctx.fillRect(0, ground, w, h - ground);
    const lanes = spec.lanes;
    const xs = [w * 0.2, w * 0.5, w * 0.8];
    for (let i = 0; i < lanes.length; i++) {
      const hot = lanes[i].id === snap.shown && (snap.status === 'windup' || snap.status === 'open');
      const open = hot && snap.status === 'open';
      ctx.fillStyle = open ? spec.accent : (hot ? 'rgba(242,193,78,.55)' : 'rgba(255,255,255,.16)');
      ctx.fillRect(xs[i] - 28, ground - 70, 56, 78);
      ctx.fillStyle = '#f6f1e6';
      ctx.font = '12px ui-monospace, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(lanes[i].label, xs[i], ground + 22);
    }
    let bossX = w * 0.5;
    const shownIndex = Math.max(0, lanes.findIndex(function (l) { return l.id === snap.shown; }));
    if (snap.status === 'windup' || snap.status === 'open') {
      const total = snap.status === 'open' ? 1 : Math.max(0.001, (spec.phases[snap.phaseIndex] || spec.phases[0]).windup);
      const along = snap.status === 'open' ? 1 : Math.max(0, Math.min(1, 1 - (snap.timer / total)));
      bossX = w * 0.5 + (xs[shownIndex] - w * 0.5) * along;
    }
    const bossY = ground - 110 - (snap.status === 'open' ? 16 : 0);
    ctx.fillStyle = snap.feinting ? '#f0c14a' : '#e24b4b';
    ctx.beginPath();
    ctx.arc(bossX, bossY, snap.status === 'open' ? 26 : 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a120c';
    ctx.fillRect(bossX - 10, bossY - 4, 6, 4);
    ctx.fillRect(bossX + 4, bossY - 4, 6, 4);
    ctx.restore();
  }

  function mount(doc, opts) {
    doc = doc || (root && root.document);
    if (!doc || !doc.body) throw new Error('climax mount needs a document');
    opts = opts || {};
    if (doc.getElementById('climax-root')) return doc.getElementById('climax-root').__view;
    ensureStyle(doc);
    const enc = create(opts.spec || 'hearthvale', { seed: opts.seed });
    const spec = enc.spec;
    const wrap = doc.createElement('div');
    wrap.id = 'climax-root';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-label', spec.title);
    wrap.style.setProperty('--cx', spec.accent);
    wrap.innerHTML = [
      '<div class="cx-scene"><canvas id="climax-scene" width="720" height="320"></canvas></div>',
      '<div class="cx-top"><div><div class="cx-kicker"></div><div class="cx-title"></div></div><div class="cx-hearts"></div></div>',
      '<div class="cx-phase"></div>',
      '<div class="cx-bar" role="progressbar" aria-valuemin="0"><span id="climax-fill"></span></div>',
      '<div class="cx-hp"></div>',
      '<div id="climax-tell"></div>',
      '<div id="climax-call" aria-live="polite"></div>',
      '<div id="climax-booth"></div>',
      '<div class="cx-lanes"></div>',
      '<div class="cx-end" hidden><p class="cx-reward"></p>',
      '<button type="button" id="climax-again">Stand again</button>',
      '<button type="button" id="climax-close">Back</button></div>',
    ].join('');
    doc.body.appendChild(wrap);
    const lanesEl = wrap.querySelector('.cx-lanes');
    spec.lanes.forEach(function (lane, i) {
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'cx-lane';
      btn.dataset.lane = lane.id;
      btn.innerHTML = lane.glyph + ' ' + lane.label + '<small>' + (i + 1) + ' · ' + lane.keys[0].toUpperCase() + '</small>';
      btn.addEventListener('click', function () { onPress(lane.id); });
      lanesEl.appendChild(btn);
    });
    const tell = wrap.querySelector('#climax-tell');
    const call = wrap.querySelector('#climax-call');
    const booth = wrap.querySelector('#climax-booth');
    const fill = wrap.querySelector('#climax-fill');
    const canvas = wrap.querySelector('#climax-scene');
    const end = wrap.querySelector('.cx-end');
    const reward = wrap.querySelector('.cx-reward');
    let closed = false;
    let paused = false;
    let raf = 0;
    let last = 0;
    let shake = 0;
    let token = 0;
    let rewardText = '';

    function paint() {
      const snap = enc.snapshot();
      wrap.dataset.status = snap.status;
      wrap.querySelector('.cx-kicker').textContent = spec.companion.icon + ' ' + spec.companion.name + ' · ' + spec.kicker;
      wrap.querySelector('.cx-title').textContent = spec.title;
      let hearts = '';
      for (let i = 0; i < snap.maxHearts; i++) hearts += i < snap.hearts ? '♥' : '♡';
      wrap.querySelector('.cx-hearts').textContent = hearts;
      wrap.querySelector('.cx-hearts').setAttribute('aria-label', snap.hearts + ' hearts left');
      wrap.querySelector('.cx-phase').textContent = snap.phaseName + ' · beat ' + Math.max(1, snap.beat);
      const pct = Math.max(0, Math.min(100, Math.round((snap.hp / snap.maxHp) * 100)));
      fill.style.width = pct + '%';
      const bar = wrap.querySelector('.cx-bar');
      bar.setAttribute('aria-valuemax', String(snap.maxHp));
      bar.setAttribute('aria-valuenow', String(snap.hp));
      bar.setAttribute('aria-label', spec.boss + ' ' + snap.hp + ' of ' + snap.maxHp);
      wrap.querySelector('.cx-hp').textContent = spec.boss + '  ' + snap.hp + ' / ' + snap.maxHp;
      const shown = laneById(spec, snap.shown);
      tell.dataset.lane = snap.shown || '';
      tell.classList.toggle('is-feint', snap.status === 'windup' && snap.feinting);
      tell.classList.toggle('is-open', snap.status === 'open');
      if (snap.status === 'intro') tell.textContent = spec.blurb;
      else if (snap.status === 'windup' && snap.feinting) tell.textContent = 'Feint — ' + (shown ? shown.label : '');
      else if (snap.status === 'windup') tell.textContent = (shown ? shown.label : '') + ' is stirring';
      else if (snap.status === 'open') tell.textContent = 'NOW · ' + (shown ? shown.label : '');
      else if (snap.status === 'won') tell.textContent = 'Broken';
      else if (snap.status === 'lost') tell.textContent = 'Driven through';
      else tell.textContent = 'Resetting';
      const buttons = wrap.querySelectorAll('.cx-lane');
      for (let i = 0; i < buttons.length; i++) {
        const mine = buttons[i].dataset.lane === snap.shown && (snap.status === 'windup' || snap.status === 'open');
        buttons[i].classList.toggle('is-tell', mine && snap.status === 'windup');
        buttons[i].classList.toggle('is-open', mine && snap.status === 'open');
      }
      const over = snap.status === 'won' || snap.status === 'lost';
      end.hidden = !over;
      lanesEl.hidden = over;
      if (over) reward.textContent = rewardText || (snap.status === 'won' ? 'The stand holds.' : 'The stand broke. Try the lane again.');
      if (shake > 0) shake *= 0.82;
      drawScene(canvas, spec, snap, shake);
    }

    function say(ev) {
      if (!ev) return;
      token += 1;
      const mine = token;
      const extra = ev.phase || ev.name || '';
      call.textContent = line(spec.game, ev.type, ev.beat || 0, extra);
      cue(ev.type);
      if (ev.type === 'miss' || ev.type === 'late') shake = 10;
      const provider = opts.provider === undefined ? undefined : opts.provider;
      flavor(spec.game, { type: ev.type, detail: detailFor(spec, ev) }, provider).then(function (text) {
        if (closed || mine !== token || !text) return;
        booth.textContent = 'Booth · ' + text;
      });
    }

    function react(events) {
      const loud = loudest(events || []);
      if (loud) say(loud);
      const snap = enc.snapshot();
      if (snap.status === 'won' && events.some(function (e) { return e.type === 'win'; })) {
        try { rewardText = (opts.onWin && opts.onWin(snap)) || rewardText || 'The stand holds.'; }
        catch (e) { rewardText = rewardText || 'The stand holds.'; }
      }
      if (snap.status === 'lost' && events.some(function (e) { return e.type === 'lose'; })) {
        rewardText = 'Hearts gone. The lane is still there.';
      }
      paint();
    }

    function onPress(id) {
      if (closed) return;
      react(enc.press(id));
    }

    function onKey(e) {
      if (closed || !wrap.isConnected) return;
      const k = String(e.key || '').toLowerCase();
      const lane = keyLane(spec, k);
      if (k !== 'escape' && k !== ' ' && !lane) return;
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      if (k === 'escape') { close(); return; }
      if (lane) onPress(lane);
    }

    function frame(ts) {
      if (closed || paused) return;
      if (!last) last = ts;
      let dt = (ts - last) / 1000;
      last = ts;
      if (dt > 0.05) dt = 0.05;
      const events = enc.step(dt);
      if (events.length) react(events);
      else paint();
      const snap = enc.snapshot();
      if (snap.status === 'won' || snap.status === 'lost') return;
      raf = doc.defaultView.requestAnimationFrame(frame);
    }

    function open() {
      closed = false;
      paused = false;
      rewardText = '';
      end.hidden = true;
      booth.textContent = '';
      react(enc.start());
      last = 0;
      const win = doc.defaultView;
      raf = win.requestAnimationFrame(frame);
    }

    function close() {
      if (closed) return;
      closed = true;
      paused = true;
      const win = doc.defaultView;
      if (raf) win.cancelAnimationFrame(raf);
      doc.removeEventListener('keydown', onKey, true);
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      try { if (opts.onClose) opts.onClose(); } catch (e) { /* closing still closes */ }
    }

    function playout() {
      paused = true;
      if (raf) doc.defaultView.cancelAnimationFrame(raf);
      let guard = 0;
      while (guard++ < 5000) {
        const snap = enc.snapshot();
        if (snap.status === 'won' || snap.status === 'lost') break;
        const events = enc.step(0.05);
        const now = enc.snapshot();
        let batch = events;
        if (now.status === 'open') batch = batch.concat(enc.press(now.lane));
        if (batch.length) react(batch);
      }
      paint();
      return enc.snapshot();
    }

    wrap.querySelector('#climax-close').addEventListener('click', close);
    wrap.querySelector('#climax-again').addEventListener('click', function () {
      rewardText = '';
      booth.textContent = '';
      open();
    });
    doc.addEventListener('keydown', onKey, true);
    function hold() {
      paused = true;
      if (raf && doc.defaultView) doc.defaultView.cancelAnimationFrame(raf);
    }
    const view = { open: open, close: close, hold: hold, playout: playout, encounter: enc, element: wrap };
    wrap.__view = view;
    return view;
  }

  return {
    SPECS: SPECS,
    create: create,
    line: line,
    bank: bank,
    flavor: flavor,
    keyLane: keyLane,
    mount: mount,
  };
});
