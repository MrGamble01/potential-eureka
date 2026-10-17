/* ============================================
   ARCADE AI — one provider for the flagships.

   Talking NPCs, seeded layouts, and the
   announcer all go through this interface.
   The stub is the default: deterministic,
   offline, no key. A remote adapter is built
   only when AI_API_KEY is set in the environment
   passed to createAiProvider. The browser never
   receives that key; /api/ai is the only door.
   ============================================ */

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ArcadeAI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const WIDTH = 12;
  const HEIGHT = 8;
  const STAMP = 0.55;

  // id, label, color, and the prompt words that pull this tile forward.
  // Words match on boundaries so "depot" does not count as "pot".
  const GAMES = {
    ageofwar: {
      label: 'Age of War',
      noun: 'battlefield',
      titles: ['Ash Ford', 'The Low Wall', 'Banner Hill', 'Mud Reach', 'Last Redoubt'],
      tiles: [
        { id: 'plain', label: 'plain', color: '#6d7d45', words: ['plain', 'field', 'open'] },
        { id: 'mud', label: 'mud', color: '#6b4a2e', words: ['mud', 'river', 'rain', 'ford'] },
        { id: 'rubble', label: 'rubble', color: '#8e8778', words: ['rubble', 'ruin', 'broken'] },
        { id: 'trench', label: 'trench', color: '#3c3328', words: ['trench', 'fort', 'wall', 'ditch'] },
        { id: 'banner', label: 'banner', color: '#c6a03a', words: ['banner', 'charge', 'flag'] },
        { id: 'supply', label: 'supply', color: '#8d5b3e', words: ['supply', 'camp', 'gold', 'wagon'] },
      ],
      npcs: [
        npc('bram', 'Bram', 'Quartermaster', '🛡️', [
          { when: (c) => low(c.gold, 40), mood: 'terse', text: (c) => 'Gold is ' + shown(c.gold, 'gone') + '. Buy bodies, not banners.' },
          { when: (c) => high(c.gold, 200), mood: 'pleased', text: (c) => shown(c.gold, 'The purse') + ' gold. I can plate the next file.' },
          { mood: 'steady', text: (c) => (c.era || 'This age') + ' still needs a wall before it needs a speech.' },
        ]),
        npc('lira', 'Lira', 'Scout', '🏹', [
          { when: (c) => /wave\s*[3-9]/i.test(String(c.wave || '')), mood: 'urgent', text: (c) => (c.wave || 'The next wave') + ' is already on the road. I counted them twice.' },
          { mood: 'quiet', text: (c) => 'I walked the ' + (c.wave || 'first wave') + ' line. Nothing past the ridge yet.' },
        ]),
        npc('holt', 'Holt', 'Banner captain', '🚩', [
          { when: (c) => low(c.base, 600), mood: 'sharp', text: (c) => 'The base is at ' + shown(c.base, 'a bad number') + '. Sound the repair before the speech.' },
          { mood: 'bold', text: () => 'Hold the standard where they can see it. The line follows a flag, not a plan.' },
        ]),
      ],
      calls: {
        state: 'From the ridge: {detail}. Hold the base.',
        wave: 'Wave call: {detail}. Dress the line.',
        era: 'The age turns. {detail}.',
        banner: 'Banner on the field. {detail}.',
        default: 'The field heard it. {detail}.',
      },
    },
    tycoon: {
      label: 'Startup Tycoon',
      noun: 'floor plan',
      titles: ['North Stack', 'The Mezzanine', 'Seed Floor', 'Late Room', 'Open Office'],
      tiles: [
        { id: 'desk', label: 'desk', color: '#3d6f9a', words: ['desk', 'hire', 'engineer'] },
        { id: 'aisle', label: 'aisle', color: '#2c3340', words: ['aisle', 'floor', 'open'] },
        { id: 'plant', label: 'plant', color: '#3f8f55', words: ['plant', 'green', 'quiet'] },
        { id: 'server', label: 'server', color: '#7a5cff', words: ['server', 'code', 'rack'] },
        { id: 'kitchen', label: 'kitchen', color: '#c47b3a', words: ['kitchen', 'snack', 'coffee'] },
        { id: 'meeting', label: 'meeting', color: '#a33b4a', words: ['meeting', 'board', 'pitch'] },
        { id: 'window', label: 'window', color: '#8ec6e6', words: ['window', 'view', 'light'] },
      ],
      npcs: [
        npc('casey', 'Casey', 'Intern', '💻', [
          { when: (c) => low(c.cash, 500), mood: 'nervous', text: (c) => 'Cash reads ' + shown(c.cash, 'empty') + '. I can staple the pitch, I cannot fund it.' },
          { when: (c) => high(c.cash, 5000), mood: 'bright', text: (c) => shown(c.cash, 'That') + ' in the account. Should I order the good coffee?' },
          { mood: 'eager', text: () => 'I labeled the desks again. Tell me who sits where and I will pretend it was the plan.' },
        ]),
        npc('nia', 'Nia', 'Board observer', '📋', [
          { mood: 'dry', text: (c) => (c.status || 'The floor is busy') + '. I am writing that down as traction.' },
        ]),
        npc('omar', 'Omar', 'Office lead', '🪑', [
          { mood: 'calm', text: () => 'Leave a path to the kitchen. A floor that traps people does not ship.' },
        ]),
      ],
      calls: {
        state: 'Floor note: {detail}.',
        feed: 'On the wire: {detail}.',
        event: 'House call: {detail}.',
        default: 'The office heard it. {detail}.',
      },
    },
    beagle: {
      label: 'Beagle Sim',
      noun: 'kennel plan',
      titles: ['Good Yard', 'The Long Nap', 'Bone Annex', 'Soft Office', 'Hydrant Row'],
      tiles: [
        { id: 'bed', label: 'bed', color: '#c4895b', words: ['bed', 'nap', 'sleep'] },
        { id: 'bowl', label: 'bowl', color: '#d6c07a', words: ['bowl', 'food', 'dinner'] },
        { id: 'yard', label: 'yard', color: '#6ea84a', words: ['yard', 'park', 'grass'] },
        { id: 'hydrant', label: 'hydrant', color: '#c4473a', words: ['hydrant', 'walk'] },
        { id: 'sofa', label: 'sofa', color: '#7d6aaf', words: ['sofa', 'office', 'couch'] },
        { id: 'door', label: 'door', color: '#8d6b45', words: ['door', 'gate'] },
        { id: 'bone', label: 'bone', color: '#efe6d4', words: ['bone', 'dig', 'treasure'] },
      ],
      npcs: [
        npc('biscuit', 'Biscuit', 'Head of pack', '🐶', [
          { when: (c) => low(c.cash, 80), mood: 'serious', text: (c) => 'The bowl fund is ' + shown(c.cash, 'low') + '. Adopt later. Feed first.' },
          { mood: 'proud', text: () => 'Every beagle on payroll gets a nap and a job. In that order.' },
        ]),
        npc('mabel', 'Mabel', 'Vet', '🩺', [
          { mood: 'kind', text: () => 'Ears look fine. If the pack gets loud, that is morale, not a fever.' },
        ]),
        npc('pip', 'Pip', 'Puppy intern', '🦴', [
          { mood: 'wiggly', text: (c) => (c.status || 'The office smells like work') + '. I already found the best spot on the sofa.' },
        ]),
      ],
      calls: {
        state: 'Pack call: {detail}.',
        feed: 'From the yard: {detail}.',
        event: 'Kennel call: {detail}.',
        default: 'The pack heard it. {detail}.',
      },
    },
    growop: {
      label: 'Grow Op',
      noun: 'room plan',
      titles: ['Lamp Row', 'The Quiet Bay', 'Vent Side', 'Back Table', 'Garage Two'],
      tiles: [
        { id: 'floor', label: 'floor', color: '#3a3f36', words: ['floor', 'room', 'open'] },
        { id: 'pot', label: 'pot', color: '#3f8f4a', words: ['pot', 'plant', 'tray', 'crop'] },
        { id: 'lamp', label: 'lamp', color: '#e0b34d', words: ['lamp', 'light', 'bright'] },
        { id: 'vent', label: 'vent', color: '#6aa8c9', words: ['vent', 'air', 'cool'] },
        { id: 'table', label: 'table', color: '#8a6244', words: ['table', 'trim'] },
        { id: 'door', label: 'door', color: '#c46a4a', words: ['door', 'garage', 'gate'] },
        { id: 'safe', label: 'safe', color: '#b9a06a', words: ['safe', 'stash', 'lock'] },
      ],
      npcs: [
        npc('rook', 'Rook', 'Lookout', '🕶️', [
          { when: (c) => high(c.heat, 50), mood: 'low', text: (c) => 'Heat is ' + shown(c.heat, 'up') + '. Sit the next sale. I can spot a badge, I cannot cool a room.' },
          { when: (c) => low(c.heat, 10), mood: 'easy', text: (c) => 'Heat is ' + shown(c.heat, 'quiet') + '. The street is bored, which is how we like it.' },
          { mood: 'flat', text: () => 'I watch the door. You watch the number. We do not trade jobs.' },
        ]),
        npc('june', 'June', 'Trimmer', '✂️', [
          { when: (c) => low(c.cash, 200), mood: 'practical', text: (c) => 'Cash is ' + shown(c.cash, 'thin') + '. The trays can wait if the street is loud.' },
          { mood: 'focused', text: (c) => (c.goal || 'The next goal') + ' is the only thing on my bench.' },
        ]),
        npc('dispatch', 'Dispatch', 'Wire', '📻', [
          { mood: 'clipped', text: (c) => 'Board says ' + (c.goal || 'keep the room small') + '. I will repeat it when it changes.' },
        ]),
      ],
      calls: {
        state: 'Dispatch: {detail}.',
        feed: 'Wire: {detail}.',
        event: 'Room call: {detail}.',
        heat: 'Heat check: {detail}.',
        crackdown: 'Crackdown: {detail}. Keep the door shut.',
        default: 'The room heard it. {detail}.',
      },
    },
    homeless: {
      label: 'Homeless Village',
      noun: 'camp map',
      titles: ['Under the Span', 'Barrel Court', 'Tarp Lane', 'The Third Bent', 'Pallet Row'],
      tiles: [
        { id: 'concrete', label: 'concrete', color: '#6e675e', words: ['concrete', 'bridge', 'span'] },
        { id: 'tent', label: 'tent', color: '#c4a15a', words: ['tent', 'camp', 'sleep'] },
        { id: 'barrel', label: 'barrel', color: '#a85a32', words: ['barrel', 'fire', 'warm'] },
        { id: 'dumpster', label: 'dumpster', color: '#3f6b45', words: ['dumpster', 'scavenge', 'alley'] },
        { id: 'tarp', label: 'tarp', color: '#3d7ea6', words: ['tarp', 'rain', 'awning'] },
        { id: 'pallet', label: 'pallet', color: '#8b6840', words: ['pallet', 'wood'] },
        { id: 'lot', label: 'lot', color: '#8d8a72', words: ['lot', 'open', 'yard'] },
      ],
      npcs: [
        npc('marisol', 'Marisol', 'Taquería', '🌮', [
          { when: (c) => low(c.food, 1), mood: 'worried', text: (c) => 'Food is ' + shown(c.food, 'gone') + '. Trade me something honest and I will send leftovers.' },
          { when: (c) => high(c.food, 8), mood: 'pleased', text: (c) => shown(c.food, 'The shelf') + ' food. The recycling run can wait until you are ready.' },
          { mood: 'warm', text: (c) => (c.days || 'Another day') + ' under the bridge. I am still on the corner.' },
        ]),
        npc('ray', 'Old Ray', 'Bench', '🎖️', [
          { when: (c) => low(c.warmth, 35), mood: 'gravel', text: (c) => 'Warmth is ' + shown(c.warmth, 'failing') + '. Sit by the barrel before you sit by me.' },
          { mood: 'fond', text: () => 'Rest a minute. The dumpsters will still be wrong when you get up.' },
        ]),
        npc('dee', 'Dee', 'Night shift', '🩺', [
          { mood: 'tired', text: (c) => 'I am walking home. ' + (c.days || 'Tonight') + ' looks like a night for dry socks and no heroics.' },
        ]),
      ],
      calls: {
        state: 'From the span: {detail}.',
        log: 'Camp log: {detail}.',
        event: 'Someone at the fire: {detail}.',
        day: 'Dawn line: {detail}.',
        default: 'The camp heard it. {detail}.',
      },
    },
    hearthvale: {
      label: 'Hearthvale',
      noun: 'valley map',
      titles: ['Willow Reach', 'North Pasture', 'Millwater', 'Cinder Fold', 'The Low Orchard'],
      tiles: [
        { id: 'meadow', label: 'meadow', color: '#7ea64a', words: ['meadow', 'field', 'grass'] },
        { id: 'wood', label: 'wood', color: '#2f6b3a', words: ['wood', 'forest', 'tree'] },
        { id: 'cottage', label: 'cottage', color: '#c4b08a', words: ['cottage', 'house', 'village', 'home'] },
        { id: 'river', label: 'river', color: '#3d88c4', words: ['river', 'water', 'fog', 'mill'] },
        { id: 'orchard', label: 'orchard', color: '#d07a45', words: ['orchard', 'apple', 'farm'] },
        { id: 'road', label: 'road', color: '#b9a27a', words: ['road', 'path', 'lane'] },
        { id: 'rock', label: 'rock', color: '#8a8580', words: ['rock', 'quarry', 'stone'] },
      ],
      npcs: [
        npc('wren', 'Elder Wren', 'Hearth', '🔥', [
          { when: (c) => low(c.food, 4), mood: 'grave', text: (c) => 'The stores show ' + shown(c.food, 'no') + ' food. A valley that skips supper does not stay a valley.' },
          { when: (c) => high(c.pop, 8), mood: 'proud', text: (c) => shown(c.pop, 'The') + ' souls on the green. Learn their names before the next roof.' },
          { mood: 'soft', text: (c) => 'Day ' + shown(c.day, 'one') + '. The hearth is lit. That is the whole job until it is not.' },
        ]),
        npc('ada', 'Reeve Ada', 'Watch', '🪵', [
          { when: (c) => low(c.wood, 6), mood: 'brisk', text: (c) => 'Wood is ' + shown(c.wood, 'short') + '. No new hall until the cutters catch up.' },
          { mood: 'plain', text: () => 'I walked the palisade. It is a fence until someone stands on it.' },
        ]),
        npc('sable', 'Sable', 'Merchant', '🧳', [
          { when: (c) => low(c.gold, 5), mood: 'wry', text: (c) => 'Coin is ' + shown(c.gold, 'a story') + '. I still have thread, if you have patience.' },
          { mood: 'bright', text: (c) => 'Day ' + shown(c.day, 'one') + ' and the road is open. I buy what the valley can spare.' },
        ]),
      ],
      calls: {
        state: 'Town crier: {detail}.',
        toast: 'On the green: {detail}.',
        event: 'The valley stops for this. {detail}.',
        day: 'Dawn in the vale: {detail}.',
        default: 'Hearthvale heard it. {detail}.',
      },
    },
    voxel: {
      label: 'Voxel Isle',
      noun: 'isle map',
      titles: ['Shoal Garden', 'East Blocks', 'Lantern Cove', 'The Long Shed', 'High Grass'],
      tiles: [
        { id: 'grass', label: 'grass', color: '#63a844', words: ['grass', 'isle', 'meadow', 'green'] },
        { id: 'sand', label: 'sand', color: '#e0c98a', words: ['sand', 'beach', 'shore'] },
        { id: 'water', label: 'water', color: '#3aa0d8', words: ['water', 'cove', 'sea', 'river'] },
        { id: 'tree', label: 'tree', color: '#2d6a34', words: ['tree', 'forest', 'wood'] },
        { id: 'farm', label: 'farm', color: '#c4a03a', words: ['farm', 'crop', 'wheat'] },
        { id: 'path', label: 'path', color: '#c2b49a', words: ['path', 'road', 'lane'] },
        { id: 'stone', label: 'stone', color: '#8e9298', words: ['stone', 'rock', 'cliff'] },
      ],
      npcs: [
        npc('fern', 'Fern', 'Villager', '🧑‍🌾', [
          { when: (c) => low(c.coins, 5), mood: 'hopeful', text: (c) => 'The purse is ' + shown(c.coins, 'empty') + '. A row of crops will fix that faster than a speech.' },
          { when: (c) => high(c.coins, 40), mood: 'cheerful', text: (c) => shown(c.coins, 'Those') + ' coins. We could raise a shed and still eat.' },
          { mood: 'sunny', text: (c) => 'Day ' + shown(c.day, 'one') + ' on the blocks. Tell me what to plant and I will argue about the color.' },
        ]),
        npc('ivo', 'Ivo', 'Keeper', '🏮', [
          { mood: 'quiet', text: (c) => (c.goal || 'Keep the shore lit') + '. I will say it again at dusk.' },
        ]),
        npc('moss', 'Captain Moss', 'Harbor', '⚓', [
          { mood: 'salty', text: () => 'Build on the high grass. The cove takes anything you leave on the sand.' },
        ]),
      ],
      calls: {
        state: 'From the shore: {detail}.',
        toast: 'Isle call: {detail}.',
        day: 'The sun moved. {detail}.',
        goal: 'Garden goal: {detail}.',
        default: 'The isle heard it. {detail}.',
      },
    },
  };

  const GAME_IDS = Object.keys(GAMES);

  function npc(id, name, role, icon, lines) {
    return { id: id, name: name, role: role, icon: icon, lines: lines };
  }

  function num(v) {
    if (v == null || v === '') return NaN;
    const m = String(v).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : NaN;
  }

  function low(v, max) {
    const n = num(v);
    return Number.isFinite(n) && n <= max;
  }

  function high(v, min) {
    const n = num(v);
    return Number.isFinite(n) && n >= min;
  }

  function shown(v, fallback) {
    if (v == null || String(v).trim() === '') return fallback;
    return String(v).replace(/\s+/g, ' ').trim();
  }

  function clip(text, max) {
    const s = String(text || '').replace(/\s+/g, ' ').trim();
    if (s.length <= max) return s;
    const cut = s.slice(0, max - 1);
    const sp = cut.lastIndexOf(' ');
    return (sp > 40 ? cut.slice(0, sp) : cut).replace(/[.,;:\s]+$/, '') + '…';
  }

  function hashString(s) {
    let h = 2166136261;
    const str = String(s);
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function cleanSeed(seed) {
    const s = String(seed == null ? '' : seed).trim().slice(0, 80);
    return s || 'seed';
  }

  function cleanPrompt(prompt) {
    return String(prompt == null ? '' : prompt).replace(/\s+/g, ' ').trim().slice(0, 160);
  }

  function gameOf(id) {
    return GAMES[id] || null;
  }

  function wordHit(prompt, word) {
    const re = new RegExp('(^|[^a-z0-9])' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)', 'i');
    return re.test(prompt);
  }

  function favoredIds(game, prompt) {
    const hits = [];
    for (let i = 0; i < game.tiles.length; i++) {
      const tile = game.tiles[i];
      for (let w = 0; w < tile.words.length; w++) {
        if (wordHit(prompt, tile.words[w])) {
          hits.push(tile.id);
          break;
        }
      }
    }
    return hits;
  }

  function stableContext(ctx) {
    if (!ctx || typeof ctx !== 'object') return '';
    return Object.keys(ctx).sort().map((k) => k + '=' + String(ctx[k] == null ? '' : ctx[k])).join('|');
  }

  function findNpc(game, npcId) {
    const list = game.npcs;
    for (let i = 0; i < list.length; i++) if (list[i].id === npcId) return list[i];
    return list[0];
  }

  function talkStub(req) {
    const game = gameOf(req.game) || GAMES.hearthvale;
    const person = findNpc(game, req.npcId);
    const ctx = req.context || {};
    const turn = Number.isFinite(Number(req.turn)) ? Math.max(0, Math.floor(Number(req.turn))) : 0;
    const specific = [];
    const fallback = [];
    for (let i = 0; i < person.lines.length; i++) {
      const line = person.lines[i];
      if (line.when) {
        try { if (line.when(ctx)) specific.push(line); } catch (e) { /* a bad context skips the line */ }
      } else fallback.push(line);
    }
    const pool = specific.length ? specific : fallback;
    const idx = hashString(person.id + '|' + turn + '|' + stableContext(ctx)) % pool.length;
    const chosen = pool[idx];
    return {
      provider: 'stub',
      game: req.game && GAMES[req.game] ? req.game : 'hearthvale',
      npcId: person.id,
      name: person.name,
      role: person.role,
      icon: person.icon,
      mood: chosen.mood,
      line: clip(chosen.text(ctx), 160),
    };
  }

  function mapStub(req) {
    const id = req.game && GAMES[req.game] ? req.game : 'hearthvale';
    const game = GAMES[id];
    const seed = cleanSeed(req.seed);
    const prompt = cleanPrompt(req.prompt);
    const rng = mulberry32(hashString(id + '|' + seed + '|' + prompt));
    const n = WIDTH * HEIGHT;
    const flat = new Array(n);
    for (let i = 0; i < n; i++) flat[i] = game.tiles[Math.floor(rng() * game.tiles.length)].id;
    const favored = favoredIds(game, prompt);
    if (favored.length) {
      const order = [];
      for (let i = 0; i < n; i++) order.push(i);
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = order[i];
        order[i] = order[j];
        order[j] = tmp;
      }
      const k = Math.ceil(n * STAMP);
      for (let i = 0; i < k; i++) flat[order[i]] = favored[i % favored.length];
    }
    const tiles = [];
    for (let y = 0; y < HEIGHT; y++) tiles.push(flat.slice(y * WIDTH, (y + 1) * WIDTH));
    const counts = {};
    for (let i = 0; i < flat.length; i++) counts[flat[i]] = (counts[flat[i]] || 0) + 1;
    let top = flat[0];
    Object.keys(counts).forEach((key) => { if (counts[key] > counts[top]) top = key; });
    const pct = Math.round((counts[top] / flat.length) * 100);
    const titleBase = game.titles[hashString(id + '|' + seed) % game.titles.length];
    const lead = favored.length ? favored[0] : '';
    const title = lead ? (lead.charAt(0).toUpperCase() + lead.slice(1) + ' — ' + titleBase) : titleBase;
    const promptBit = prompt ? (' Prompt “' + prompt + '”.') : '';
    const summary = 'Seed ' + seed + '.' + promptBit + ' ' + top + ' covers ' + pct + '% of this ' + game.noun + '.';
    return {
      provider: 'stub',
      game: id,
      seed: seed,
      prompt: prompt,
      title: title,
      summary: clip(summary, 220),
      width: WIDTH,
      height: HEIGHT,
      tiles: tiles,
      legend: game.tiles.map((t) => ({ id: t.id, label: t.label, color: t.color })),
    };
  }

  function announceStub(req) {
    const id = req.game && GAMES[req.game] ? req.game : 'hearthvale';
    const game = GAMES[id];
    const event = req.event || {};
    const type = String(event.type || 'default');
    const templates = game.calls[type] ? [game.calls[type]] : [game.calls.default];
    const detail = clip(String(event.detail || '').trim(), 100);
    const template = templates[hashString(id + '|' + type + '|' + detail) % templates.length];
    let line;
    if (!detail) line = game.label + ' is quiet. The booth is listening.';
    else line = template.replace('{detail}', detail).replace(/\s+/g, ' ').trim();
    return {
      provider: 'stub',
      game: id,
      event: { type: type, detail: detail },
      line: clip(line, 170),
    };
  }

  function createStubProvider() {
    return {
      id: 'stub',
      label: 'offline stub',
      talk: function (req) { return Promise.resolve(talkStub(req || {})); },
      generateMap: function (req) { return Promise.resolve(mapStub(req || {})); },
      announce: function (req) { return Promise.resolve(announceStub(req || {})); },
    };
  }

  function keyFrom(env) {
    if (!env) return '';
    const raw = env.AI_API_KEY;
    if (raw == null) return '';
    return String(raw).trim();
  }

  function parseModelJson(text) {
    if (!text) throw new Error('empty model response');
    let s = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start < 0 || end < start) throw new Error('model response was not JSON');
    return JSON.parse(s.slice(start, end + 1));
  }

  function createRemoteProvider(env, opts) {
    const key = keyFrom(env);
    const base = String((env && env.AI_API_BASE_URL) || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const model = String((env && env.AI_MODEL) || 'gpt-4o-mini');
    const fetchImpl = (opts && opts.fetch) || (typeof fetch === 'function' ? fetch : null);

    async function complete(system, user) {
      if (!fetchImpl) throw new Error('AI provider has no fetch');
      const res = await fetchImpl(base + '/chat/completions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer ' + key,
        },
        body: JSON.stringify({
          model: model,
          temperature: 0.4,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
      if (!res || !res.ok) {
        const status = res && res.status ? res.status : 0;
        const err = new Error('AI provider request failed (' + status + ')');
        err.status = status;
        throw err;
      }
      const data = await res.json();
      const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      return parseModelJson(content);
    }

    return {
      id: 'remote',
      label: 'live model',
      talk: async function (req) {
        const game = gameOf(req && req.game) || GAMES.hearthvale;
        const person = findNpc(game, req && req.npcId);
        const data = await complete(
          'You write one short line of dialogue for a fictional browser game. Reply with JSON only: {"line":"...","mood":"..."}. At most 140 characters. Stay inside the game. No real-world instructions.',
          JSON.stringify({ game: game.label, name: person.name, role: person.role, context: (req && req.context) || {} })
        );
        if (!data || !data.line) throw new Error('model omitted the line');
        return {
          provider: 'remote',
          game: req && req.game,
          npcId: person.id,
          name: person.name,
          role: person.role,
          icon: person.icon,
          mood: clip(data.mood || 'even', 24),
          line: clip(data.line, 160),
        };
      },
      generateMap: async function (req) {
        const id = req && req.game && GAMES[req.game] ? req.game : 'hearthvale';
        const game = GAMES[id];
        const ids = game.tiles.map((t) => t.id).join(', ');
        const data = await complete(
          'You lay out a fictional game map. Reply with JSON only: {"title":"...","summary":"...","tiles":[[...]]}. tiles is an 8-row by 12-column grid. Use only these ids: ' + ids + '.',
          JSON.stringify({ game: game.label, seed: cleanSeed(req && req.seed), prompt: cleanPrompt(req && req.prompt) })
        );
        if (!data || !data.tiles || data.tiles.length !== HEIGHT) throw new Error('model map has the wrong shape');
        const allowed = {};
        game.tiles.forEach((t) => { allowed[t.id] = true; });
        const tiles = [];
        for (let y = 0; y < HEIGHT; y++) {
          const row = data.tiles[y];
          if (!row || row.length !== WIDTH) throw new Error('model map has the wrong shape');
          const out = [];
          for (let x = 0; x < WIDTH; x++) {
            if (!allowed[row[x]]) throw new Error('model map used an unknown tile');
            out.push(row[x]);
          }
          tiles.push(out);
        }
        return {
          provider: 'remote',
          game: id,
          seed: cleanSeed(req && req.seed),
          prompt: cleanPrompt(req && req.prompt),
          title: clip(data.title || game.titles[0], 80),
          summary: clip(data.summary || '', 220),
          width: WIDTH,
          height: HEIGHT,
          tiles: tiles,
          legend: game.tiles.map((t) => ({ id: t.id, label: t.label, color: t.color })),
        };
      },
      announce: async function (req) {
        const id = req && req.game && GAMES[req.game] ? req.game : 'hearthvale';
        const data = await complete(
          'You are the announcer of a fictional browser game. Reply with JSON only: {"line":"..."}. One sentence, at most 140 characters, calling the event. No real-world instructions.',
          JSON.stringify({ game: GAMES[id].label, event: (req && req.event) || {} })
        );
        if (!data || !data.line) throw new Error('model omitted the line');
        return {
          provider: 'remote',
          game: id,
          event: {
            type: String((req && req.event && req.event.type) || 'default'),
            detail: clip((req && req.event && req.event.detail) || '', 100),
          },
          line: clip(data.line, 170),
        };
      },
    };
  }

  function createAiProvider(env, opts) {
    if (keyFrom(env)) return createRemoteProvider(env, opts);
    return createStubProvider();
  }

  function withStubFallback(primary, stub) {
    const backup = stub || createStubProvider();
    if (!primary || primary.id === 'stub') return backup;
    async function run(method, req) {
      try {
        const out = await primary[method](req);
        if (!out) throw new Error('empty provider result');
        if (method === 'generateMap') {
          if (!out.tiles || !out.tiles.length) throw new Error('empty map');
        } else if (!out.line) throw new Error('empty line');
        return out;
      } catch (e) {
        const fallback = await backup[method](req);
        fallback.fallback = true;
        return fallback;
      }
    }
    return {
      id: primary.id,
      label: primary.label || primary.id,
      talk: function (req) { return run('talk', req); },
      generateMap: function (req) { return run('generateMap', req); },
      announce: function (req) { return run('announce', req); },
    };
  }

  function dispatchAi(provider, body) {
    const op = body && body.op;
    const req = (body && body.req) || {};
    if (op === 'ping') return Promise.resolve({ provider: provider.id });
    if (op === 'talk') return provider.talk(req);
    if (op === 'generateMap') return provider.generateMap(req);
    if (op === 'announce') return provider.announce(req);
    const err = new Error('unknown op');
    err.status = 400;
    throw err;
  }

  function npcs(gameId) {
    const game = GAMES[gameId];
    if (!game) return [];
    return game.npcs.map((p) => ({ id: p.id, name: p.name, role: p.role, icon: p.icon }));
  }

  function describe(gameId) {
    const game = GAMES[gameId];
    if (!game) return null;
    return { id: gameId, label: game.label, noun: game.noun };
  }

  // In-world speakers. Age of War spots are logical field pixels
  // (1280×560, feet on the ground). Homeless Village spots are
  // world x/z on the camp ground. r is the tap radius.
  const SPEAKERS = {
    ageofwar: [
      { id: 'bram', x: 170, y: 448, r: 46 },
      { id: 'lira', x: 400, y: 448, r: 46 },
      { id: 'holt', x: 630, y: 448, r: 46 },
    ],
    homeless: [
      { id: 'marisol', x: 4.2, z: 2.4, r: 1.3 },
      { id: 'ray', x: -4.2, z: 1.6, r: 1.3 },
      { id: 'dee', x: 3.2, z: -4.2, r: 1.3 },
    ],
  };

  function speakers(gameId) {
    const list = SPEAKERS[gameId] || [];
    return list.map(function (s) {
      return { id: s.id, x: s.x, y: s.y, z: s.z, r: s.r };
    });
  }

  function speakerAt(gameId, point) {
    const list = SPEAKERS[gameId];
    if (!list || !point) return null;
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      const dx = Number(point.x) - s.x;
      const dy = s.z != null ? Number(point.z) - s.z : Number(point.y) - s.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= s.r && d < bestD) {
        best = s;
        bestD = d;
      }
    }
    if (!best) return null;
    return { id: best.id, x: best.x, y: best.y, z: best.z };
  }

  return {
    createStubProvider: createStubProvider,
    createRemoteProvider: createRemoteProvider,
    createAiProvider: createAiProvider,
    withStubFallback: withStubFallback,
    dispatchAi: dispatchAi,
    games: GAME_IDS,
    npcs: npcs,
    describe: describe,
    speakers: speakers,
    speakerAt: speakerAt,
    WIDTH: WIDTH,
    HEIGHT: HEIGHT,
    STAMP: STAMP,
  };
});
