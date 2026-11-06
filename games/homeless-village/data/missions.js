// games/homeless-village/data/missions.js
// Preserves the sequential goal ladder, Case Worker housing arc, Biscuit arc,
// weather definitions, random events, and The Bridge 16-link memory chain.

export const WEATHERS = {
  clear: { id: 'clear', icon: '☀️', name: 'Clear',     warmth: 0,  pan: 1,    scav: 1 },
  rain:  { id: 'rain',  icon: '🌧️', name: 'Rain',      warmth: 5,  pan: 0.5,  scav: 1.25 },
  cold:  { id: 'cold',  icon: '❄️', name: 'Cold Snap', warmth: 12, pan: 0.75, scav: 0.75 },
  heat:  { id: 'heat',  icon: '🥵', name: 'Heat Wave', warmth: -8, pan: 1.5,  scav: 1 }
};

export const SEASONS = ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'];

export const GOALS = [
  { id: 'survive3',   desc: 'Survive 3 days',                                 target: 3,  reward: 3,  getValue: (G) => G.days },
  { id: 'craft5',     desc: 'Craft 5 items',                                  target: 5,  reward: 3,  getValue: (G) => G.totalCrafted },
  { id: 'residents3', desc: 'Reach 3 residents',                              target: 3,  reward: 4,  getValue: (G) => G.population },
  { id: 'workbench',  desc: 'Build the Workbench',                            target: 1,  reward: 4,  getValue: (G) => G.structures.workbench ? 1 : 0 },
  { id: 'survive14',  desc: 'Survive 14 days',                                target: 14, reward: 6,  getValue: (G) => G.days },
  { id: 'village5',   desc: 'Full village: 5 residents',                      target: 5,  reward: 6,  getValue: (G) => G.population },
  { id: 'kitchen',    desc: 'Build the Soup Kitchen',                         target: 1,  reward: 8,  getValue: (G) => G.structures.soup_kitchen ? 1 : 0 },
  { id: 'survive30',  desc: 'Survive 30 days',                                target: 30, reward: 10, getValue: (G) => G.days },
  { id: 'dog',        desc: 'Befriend Biscuit the stray dog',                 target: 1,  reward: 5,  getValue: (G) => G.dog === 2 ? 1 : 0 },
  { id: 'respected',  desc: 'Become Respected (50 rep)',                      target: 50, reward: 8,  getValue: (G) => Math.floor(G.rep || 0) },
  { id: 'soup7',      desc: 'Serve 7 soup nights',                            target: 7,  reward: 6,  getValue: (G) => G.soupNights || 0 },
  { id: 'mural',      desc: 'Finish the community mural (4 panels)',          target: 4,  reward: 8,  getValue: (G) => G.mural || 0 },
  { id: 'meet3',      desc: 'Hold 3 camp meetings',                           target: 3,  reward: 5,  getValue: (G) => G.meetings || 0 },
  { id: 'petition1',  desc: 'Win a city petition',                            target: 1,  reward: 6,  getValue: (G) => Object.keys(G.petitions || {}).length },
  { id: 'favor3',     desc: 'Do 3 favors for friends',                        target: 3,  reward: 5,  getValue: (G) => G.favorsDone || 0 },
  { id: 'ticket1',    desc: 'Send someone home on the morning bus',           target: 1,  reward: 10, getValue: (G) => G.ticketsSent || 0 },
  { id: 'snap2',      desc: 'Weather 2 cold snaps',                           target: 2,  reward: 8,  getValue: (G) => G.snapsSurvived || 0 },
  { id: 'busk5',      desc: 'Play 5 sets on the corner',                      target: 5,  reward: 6,  getValue: (G) => G.busks || 0 },
  { id: 'deposit3',   desc: 'Make 3 deposit runs',                            target: 3,  reward: 5,  getValue: (G) => G.deposits || 0 },
  { id: 'welcome2',   desc: 'Welcome 2 newcomers',                            target: 2,  reward: 5,  getValue: (G) => G.welcomes || 0 },
  { id: 'pantry10',   desc: 'See the pantry filled 10 times',                 target: 10, reward: 5,  getValue: (G) => G.pantryFills || 0 },
  { id: 'coldcut6',   desc: 'Blunt 6 cold dawns with the coat rack',          target: 6,  reward: 5,  getValue: (G) => G.coldCut || 0 },
  { id: 'bench5',     desc: 'Tighten the workbench back up 5 times',          target: 5,  reward: 5,  getValue: (G) => G.benchSaves || 0 },
  { id: 'compost8',   desc: 'Feed the beds through 8 garden days',            target: 8,  reward: 5,  getValue: (G) => G.compostDays || 0 },
  { id: 'awning5',    desc: 'Earn 5 rainy-day coins under the awning',        target: 5,  reward: 5,  getValue: (G) => G.awningSaves || 0 },
  { id: 'barrel6',    desc: 'Water the beds from the barrel 6 times',         target: 6,  reward: 5,  getValue: (G) => G.barrelDays || 0 },
  { id: 'rainbet3',   desc: 'Win 3 rain bets against Dee',                    target: 3,  reward: 6,  getValue: (G) => G.rainBetsWon || 0 },
  { id: 'garage2',    desc: 'Ride out 2 sweeps covered by Marisol’s garage',  target: 2,  reward: 6,  getValue: (G) => G.garageSaves || 0 },
  { id: 'borrow2',    desc: 'Repay 2 of Ray’s loans in full',                 target: 2,  reward: 6,  getValue: (G) => G.rayLoans || 0 },
  { id: 'clinic1',    desc: 'Raise the Night Clinic',                         target: 1,  reward: 6,  getValue: (G) => G.structures.clinic ? 1 : 0 },
  { id: 'gauze4',     desc: 'Roll 4 gauze rolls',                             target: 4,  reward: 4,  getValue: (G) => G.bandagesRolled || 0 },
  { id: 'dress6',     desc: 'Dress 6 wounds',                                 target: 6,  reward: 6,  getValue: (G) => G.dressings || 0 },
  { id: 'june1',      desc: 'June takes the night shift',                     target: 1,  reward: 8,  getValue: (G) => G.june === 2 ? 1 : 0 },
  { id: 'care5',      desc: 'Keep the clinic steady 5 dawns',                 target: 5,  reward: 8,  getValue: (G) => G.clinicSteady || 0 },
  { id: 'storm1',     desc: 'Ride out a storm night',                         target: 1,  reward: 8,  getValue: (G) => (G.stormsCleared || 0) >= 1 ? 1 : 0 }
];

export const DOG_EVENTS = {
  stray: {
    id: 'dog_stray',
    title: 'A Stray Dog',
    type: 'good',
    desc: 'A thin dog with one torn ear watches the camp from the fence line. He keeps his distance, but he doesn’t leave. Someone starts calling him Biscuit.'
  },
  joins: {
    id: 'dog_joins',
    title: 'Biscuit Comes Closer',
    type: 'good',
    desc: 'The dog walks into camp like he’s always lived here, eats what’s offered, and falls asleep against the barrel fire. That’s that, then.'
  }
};

export const ARC_EVENTS = {
  card: {
    id: 'arc_card',
    title: 'The Case Worker',
    type: 'good',
    desc: 'A county case worker named Dena stops by. She looks around — people fed, fire going, something like order. "This isn’t nothing," she says, and leaves her card.'
  },
  paperwork: {
    id: 'arc_paperwork',
    title: 'Paperwork, Hope',
    type: 'good',
    desc: 'Dena is back with forms. A transitional-housing pilot wants people who can hold a community together. "Keep spirits up and put some goodwill aside — I’ll file it."'
  }
};

// Persistent cross-camp keys (shared with original Homeless Village so legacy stories carry over)
export const LEGACY_KEYS = {
  FRIDGE: 'hv-fridge',
  FESTIVAL: 'hv-festival',
  RECORD: 'hv-record',
  PLAQUE: 'hv-plaque',
  LETTER: 'hv-letter',
  HISTORY: 'hv-history',
  THERMOS: 'hv-thermos',
  VISITOR: 'hv-visitor',
  KEEPSAKE: 'hv-keepsake',
  REUNION: 'hv-reunion',
  PORTRAIT: 'hv-portrait',
  ANNIV: 'hv-anniversary',
  GUESTBOOK: 'hv-guestbook',
  BENCH: 'hv-bench',
  STORY: 'hv-storyhour',
  SONG: 'hv-song',
  CAPSULE: 'hv-capsule',
  MURAL5: 'hv-mural',
  DOCENT: 'hv-docent',
  MARK: 'hv-mark',
  DRY: 'hv-drycorner',
  HOOK: 'hv-emptyhook',
  LEDGER: 'hv-night-ledger'
};

function readJson(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return v && typeof v === 'object' ? v : fallback;
  } catch (e) {
    return fallback;
  }
}

export function writeJson(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {}
}

export const Legacy = {
  fridge: () => { const f = readJson(LEGACY_KEYS.FRIDGE, {}); return { built: !!f.built, camps: Math.max(0, Math.floor(f.camps || 0)) }; },
  rec: () => { const r = readJson(LEGACY_KEYS.RECORD, {}); return { days: Math.max(0, Math.floor(r.days || 0)), beats: Math.max(0, Math.floor(r.beats || 0)) }; },
  star: () => { const s = readJson(LEGACY_KEYS.PLAQUE, {}); return { cheers: Math.max(0, Math.floor(s.cheers || 0)) }; },
  note: () => { const n = readJson(LEGACY_KEYS.LETTER, {}); return { read: Math.max(0, Math.floor(n.read || 0)) }; },
  wall: () => { const w = readJson(LEGACY_KEYS.HISTORY, {}); return { opens: Math.max(0, Math.floor(w.opens || 0)) }; },
  thermos: () => { const t = readJson(LEGACY_KEYS.THERMOS, {}); return { uses: Math.max(0, Math.floor(t.uses || 0)) }; },
  marisol: () => { const m = readJson(LEGACY_KEYS.VISITOR, {}); return { visits: Math.max(0, Math.floor(m.visits || 0)) }; },
  keep: () => { const k = readJson(LEGACY_KEYS.KEEPSAKE, {}); return { pays: Math.max(0, Math.floor(k.pays || 0)) }; },
  reunion: () => { const r = readJson(LEGACY_KEYS.REUNION, {}); return { held: Math.max(0, Math.floor(r.held || 0)) }; },
  snap: () => { const s = readJson(LEGACY_KEYS.PORTRAIT, {}); return { looks: Math.max(0, Math.floor(s.looks || 0)) }; },
  anniv: () => { const a = readJson(LEGACY_KEYS.ANNIV, {}); return { toasts: Math.max(0, Math.floor(a.toasts || 0)) }; },
  gb: () => { const g = readJson(LEGACY_KEYS.GUESTBOOK, {}); return { leafs: Math.max(0, Math.floor(g.leafs || 0)) }; },
  bench: () => { const b = readJson(LEGACY_KEYS.BENCH, {}); return { sits: Math.max(0, Math.floor(b.sits || 0)) }; },
  story: () => { const s = readJson(LEGACY_KEYS.STORY, {}); return { tellings: Math.max(0, Math.floor(s.tellings || 0)) }; },
  song: () => { const s = readJson(LEGACY_KEYS.SONG, {}); return { plays: Math.max(0, Math.floor(s.plays || 0)) }; },
  can: () => { const c = readJson(LEGACY_KEYS.CAPSULE, {}); return { digs: Math.max(0, Math.floor(c.digs || 0)) }; },
  panel: () => { const p = readJson(LEGACY_KEYS.MURAL5, {}); return { stands: Math.max(0, Math.floor(p.stands || 0)) }; },
  walk: () => { const w = readJson(LEGACY_KEYS.DOCENT, {}); return { walks: Math.max(0, Math.floor(w.walks || 0)) }; },
  mark: () => { const m = readJson(LEGACY_KEYS.MARK, {}); return { names: Math.max(0, Math.floor(m.names || 0)) }; },
  dry: () => { const d = readJson(LEGACY_KEYS.DRY, {}); return { built: !!d.built, sits: Math.max(0, Math.floor(d.sits || 0)) }; },
  hook: () => { const h = readJson(LEGACY_KEYS.HOOK, {}); return { up: !!h.up }; }
};

export const HV_CHAIN = [
  { id: 'rec',     icon: '📈', name: 'The Long Memory',         tally: () => Legacy.rec().beats,     gate: null,                                                       prev: null,               need: 0, desc: 'Outlast the bridge’s longest hold.' },
  { id: 'star',    icon: '⭐', name: 'The Chalk Star',          tally: () => Legacy.star().cheers,   gate: () => Legacy.rec().beats >= 3,                              prev: 'rec',              need: 3, desc: 'Three beaten holds earn a chalk star on the wall.' },
  { id: 'marisol', icon: '🚗', name: 'Marisol Drops By',        tally: () => Legacy.marisol().visits,gate: () => Legacy.rec().days > 0 || Legacy.note().read > 0,      prev: null,               need: 0, desc: 'Wave Marisol down once the bridge has a story.' },
  { id: 'reunion', icon: '🎂', name: 'The Bridge Reunion',      tally: () => Legacy.reunion().held,  gate: () => Legacy.star().cheers >= 3 && Legacy.marisol().visits >= 3, prev: ['star', 'marisol'], need: 3, desc: 'Everyone who ever slept here comes back through.' },
  { id: 'snap',    icon: '📷', name: 'The Snapshot',            tally: () => Legacy.snap().looks,    gate: () => Legacy.reunion().held >= 3,                           prev: 'reunion',          need: 3, desc: 'A photo from the reunion tucked into the fridge door.' },
  { id: 'anniv',   icon: '🕯️', name: 'The Anniversary',         tally: () => Legacy.anniv().toasts,  gate: () => Legacy.snap().looks >= 3,                             prev: 'snap',             need: 3, desc: 'A candle lit for a whole year held under the bridge.' },
  { id: 'gb',      icon: '📓', name: 'The Spiral Notebook',     tally: () => Legacy.gb().leafs,      gate: () => Legacy.anniv().toasts >= 3,                           prev: 'anniv',            need: 3, desc: 'Everyone who ever slept here signs it on the way through.' },
  { id: 'bench',   icon: '🪑', name: 'The Bench by the Fridge', tally: () => Legacy.bench().sits,    gate: () => Legacy.gb().leafs >= 3,                               prev: 'gb',               need: 3, desc: 'Scrap wood and good intentions, a seat with every name at its back.' },
  { id: 'story',   icon: '🔥', name: 'The Fire Story',          tally: () => Legacy.story().tellings,gate: () => Legacy.bench().sits >= 3,                             prev: 'bench',            need: 3, desc: 'The whole bridge story told by heart around the barrel.' },
  { id: 'song',    icon: '🎸', name: 'The Bridge Ballad',       tally: () => Legacy.song().plays,    gate: () => Legacy.story().tellings >= 3,                         prev: 'story',            need: 3, desc: 'Three chords, the whole story, everybody hums along.' },
  { id: 'can',     icon: '📦', name: 'The Coffee Can',          tally: () => Legacy.can().digs,      gate: () => Legacy.song().plays >= 3,                             prev: 'song',             need: 3, desc: 'Buried by the piling: a notebook page, a snapshot, a guitar pick.' },
  { id: 'panel',   icon: '🎨', name: 'The Fifth Panel',         tally: () => Legacy.panel().stands,  gate: () => Legacy.can().digs >= 3,                               prev: 'can',              need: 3, desc: 'Primed beside the finished mural, painting the whole bridge story.' },
  { id: 'walk',    icon: '🧭', name: 'The Walk Down',           tally: () => Legacy.walk().walks,    gate: () => Legacy.panel().stands >= 3,                           prev: 'panel',            need: 3, desc: 'Walking every newcomer down the whole underpass on their first night.' },
  { id: 'mark',    icon: '✍️', name: 'A Name on the Wall',      tally: () => Legacy.mark().names,    gate: () => Legacy.walk().walks >= 3,                             prev: 'walk',             need: 3, desc: 'A newcomer takes the chalk and writes their own name in their hand.' },
  { id: 'dry',     icon: '⛱️', name: 'The Dry Corner',          tally: () => Legacy.dry().sits,      gate: () => Legacy.mark().names >= 3,                             prev: 'mark',             need: 3, desc: 'A roofed, sheeted corner by the piling out of the weather.' },
  { id: 'hook',    icon: '🧣', name: 'The Empty Hook',          tally: () => Legacy.hook().up ? 1 : 0, gate: () => Legacy.dry().sits >= 3,                             prev: 'dry',              need: 3, desc: 'A spare blanket on a hook by the door. Every dawn bites 2 less.' }
];

export function getChainState() {
  const rows = HV_CHAIN.map((r) => {
    const open = !r.gate || !!r.gate();
    const n = Math.max(0, Math.floor(r.tally() || 0));
    const prev = r.prev == null ? [] : (Array.isArray(r.prev) ? r.prev : [r.prev]);
    return { id: r.id, icon: r.icon, name: r.name, desc: r.desc, open, tally: n, need: r.need, prev };
  });
  let nextIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].open && rows[i].tally === 0) {
      nextIdx = i;
      break;
    }
  }
  const doneCount = rows.filter((r) => r.tally > 0).length;
  return { rows, nextIdx, doneCount, total: rows.length };
}
