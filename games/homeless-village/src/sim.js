// Camp rules for the Phaser rebuild. Same pressures as the original:
// warmth and food at dawn, work that costs time, a camp that can grow
// or fail, Biscuit, Dena's housing arc, and the goal ladder.

import { RECIPES, BUILDER_CRAFT_MULT, COATS_CUT, BARREL_CAP } from '../data/recipes.js';
import {
  WORKER_DEFS, REGULARS, FAVORS, PETITIONS, REP_TIERS, ODD_JOBS,
  MURAL_PANELS, MURAL_LINES, CLINIC_CONSTANTS, STORM_CONSTANTS
} from '../data/npcs.js';
import { WEATHERS, SEASONS, GOALS, getChainState } from '../data/missions.js';

export const SAVE_KEY = 'hv_phaser_camp_v1';
export const INTRO_KEY = 'hv_phaser_intro_seen';
export const SOUND_KEY = 'hv_phaser_sound';
export const DAY_MS = 80000;

const CD = {
  scavenge: 5000,
  forage: 6000,
  panhandle: 8000,
  rest: 9000,
  trade: 8000,
  feed: 4000,
  mural: 0,
  meeting: 0,
  busk: 0,
  deposit: 0,
  oddjob: 0,
  dress: 7000
};

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function rngOf(rng) { return typeof rng === 'function' ? rng : Math.random; }
function roll(rng, min, max) { return min + Math.floor(rng() * (max - min + 1)); }
function weatherOf(id) { return WEATHERS[id] || WEATHERS.clear; }

export function freshState() {
  return {
    days: 0,
    timeOfDay: 0.3,
    season: 0,
    weather: 'clear',
    forecast: 'clear',
    fireLit: true,
    food: 1,
    scraps: 0,
    cans: 0,
    cardboard: 0,
    wood: 0,
    goodwill: 0,
    health: 100,
    warmth: 76,
    hope: 54,
    population: 1,
    peakPopulation: 1,
    bandages: 0,
    bandagesRolled: 0,
    dressings: 0,
    care: 0,
    june: 0,
    clinicSteady: 0,
    dog: 0,
    dogMetDay: 0,
    dogHungry: false,
    workers: { scrapper: false, builder: false, cook: false, lookout: false },
    structures: {
      barrel_fire: true, workbench: false, tent: false, soup_kitchen: false,
      garden: false, radio: false, stash: false, guitar: false, cart: false,
      pantry: false, coats: false, toolbox: false, compost: false, awning: false,
      barrel: false, clinic: false, gate: false
    },
    regulars: { marisol: 0, ray: 0, dee: 0 },
    rep: 0,
    mural: 0,
    muralDay: -1,
    meetings: 0,
    meetingDay: -9,
    petitions: {},
    favor: null,
    favorsDone: 0,
    lastFavorDay: -9,
    oddJobDay: -1,
    soupNights: 0,
    ticketsSent: 0,
    ticketAsk: null,
    ticketLastDay: -9,
    newcomerAsk: null,
    newcomerLastDay: -9,
    welcomes: 0,
    busks: 0,
    buskDay: -9,
    deposits: 0,
    depositDay: -9,
    pantryFills: 0,
    coldCut: 0,
    benchSaves: 0,
    compostDays: 0,
    awningSaves: 0,
    barrelWater: 0,
    barrelDays: 0,
    rainBetOn: false,
    rainBetDay: -9,
    rainBetsWon: 0,
    garageCover: false,
    garageSaves: 0,
    rayDebt: 0,
    rayLoans: 0,
    snapsSurvived: 0,
    snapUntil: null,
    sweepWarned: false,
    sweepUntil: 0,
    packedUp: false,
    dumpsterLockDay: -1,
    injuredUntil: 0,
    sickUntil: -1,
    gentrifyDay: -1,
    lastEventDay: -2,
    goalIndex: 0,
    arcStage: 0,
    arcDone: false,
    over: false,
    totalScavenged: 0,
    totalCrafted: 0,
    timesSwept: 0,
    stormsCleared: 0,
    stormDue: false,
    rio: 0,
    storm: null,
    activeCraft: null,
    cooldowns: {},
    log: []
  };
}

function mergeStructures(saved) {
  const base = freshState().structures;
  if (!saved || typeof saved !== 'object') return base;
  Object.keys(base).forEach((k) => { if (typeof saved[k] === 'boolean') base[k] = saved[k]; });
  base.barrel_fire = true;
  return base;
}

export function normalize(raw) {
  const g = freshState();
  if (!raw || typeof raw !== 'object') return g;
  const keep = ['log', 'structures', 'workers', 'regulars', 'petitions', 'cooldowns', 'activeCraft', 'favor', 'storm', 'ticketAsk', 'newcomerAsk'];
  Object.keys(g).forEach((k) => {
    if (keep.includes(k)) return;
    if (typeof g[k] === 'number' && typeof raw[k] === 'number' && isFinite(raw[k])) g[k] = raw[k];
    else if (typeof g[k] === 'boolean' && typeof raw[k] === 'boolean') g[k] = raw[k];
    else if (raw[k] === null && g[k] === null) g[k] = null;
    else if (typeof raw[k] === 'string') g[k] = raw[k];
  });
  g.structures = mergeStructures(raw.structures);
  if (raw.workers && typeof raw.workers === 'object') {
    Object.keys(g.workers).forEach((k) => { if (raw.workers[k]) g.workers[k] = true; });
  }
  if (raw.regulars && typeof raw.regulars === 'object') {
    Object.keys(g.regulars).forEach((k) => {
      const n = raw.regulars[k];
      if (typeof n === 'number') g.regulars[k] = clamp(n, 0, 10);
    });
  }
  g.petitions = raw.petitions && typeof raw.petitions === 'object' ? { ...raw.petitions } : {};
  g.cooldowns = raw.cooldowns && typeof raw.cooldowns === 'object' ? { ...raw.cooldowns } : {};
  g.log = Array.isArray(raw.log) ? raw.log.slice(-14) : [];
  if (raw.activeCraft && raw.activeCraft.id && typeof raw.activeCraft.start === 'number') {
    g.activeCraft = { id: raw.activeCraft.id, start: raw.activeCraft.start, duration: raw.activeCraft.duration || 1000 };
  }
  if (raw.favor && FAVORS[raw.favor.who]) g.favor = { who: raw.favor.who, day: raw.favor.day || 0 };
  if (raw.storm && typeof raw.storm.phase === 'number') g.storm = raw.storm;
  if (raw.ticketAsk && typeof raw.ticketAsk.day === 'number') g.ticketAsk = raw.ticketAsk;
  if (raw.newcomerAsk && typeof raw.newcomerAsk.day === 'number') g.newcomerAsk = raw.newcomerAsk;
  if (!WEATHERS[g.weather]) g.weather = 'clear';
  if (g.forecast && !WEATHERS[g.forecast]) g.forecast = 'clear';
  g.timeOfDay = clamp(typeof g.timeOfDay === 'number' && isFinite(g.timeOfDay) ? g.timeOfDay : 0.3, 0, 0.999);
  g.health = clamp(g.health, 0, 100);
  g.warmth = clamp(g.warmth, 0, 100);
  g.hope = clamp(g.hope, 0, 100);
  g.rep = clamp(g.rep, 0, 100);
  g.population = clamp(Math.floor(g.population) || 1, 1, 8);
  g.days = Math.max(0, Math.floor(g.days) || 0);
  g.goalIndex = Math.max(0, Math.floor(g.goalIndex) || 0);
  if (g.health <= 0) g.over = true;
  return g;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return normalize(JSON.parse(raw));
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

export function saveState(g) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(g)); } catch (e) { /* private mode */ }
}

export function clearState() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
}

export function introSeen() {
  try { return localStorage.getItem(INTRO_KEY) === '1'; } catch (e) { return false; }
}
export function markIntro() {
  try { localStorage.setItem(INTRO_KEY, '1'); } catch (e) {}
}

function say(g, logs, text) {
  logs.push(text);
  g.log = g.log || [];
  g.log.push({ t: Date.now(), text });
  if (g.log.length > 14) g.log.shift();
}

function tierIndex(rep) {
  let t = 0;
  for (let i = 0; i < REP_TIERS.length; i++) if (rep >= REP_TIERS[i].at) t = i;
  return t;
}

function addRep(g, n, logs) {
  const before = tierIndex(g.rep);
  g.rep = clamp(g.rep + n, 0, 100);
  const after = tierIndex(g.rep);
  if (after !== before) {
    say(g, logs, 'Word gets around. The block counts this camp as ' + REP_TIERS[after].name + ' now.');
  }
}

export function currentGoal(g) {
  return g.goalIndex < GOALS.length ? GOALS[g.goalIndex] : null;
}

function checkGoals(g, logs) {
  let goal = currentGoal(g);
  while (goal && goal.getValue(g) >= goal.target) {
    g.goalIndex += 1;
    g.goodwill += goal.reward;
    say(g, logs, 'Done — ' + goal.desc + '. +' + goal.reward + ' goodwill.');
    goal = currentGoal(g);
  }
}

function rollWeather(g, rng) {
  const r = rng();
  if (g.season === 3) return r < 0.4 ? 'cold' : (r < 0.7 ? 'clear' : 'rain');
  if (g.season === 1) return r < 0.34 ? 'heat' : (r < 0.72 ? 'clear' : 'rain');
  if (g.season === 2) return r < 0.5 ? 'clear' : (r < 0.78 ? 'rain' : 'cold');
  return r < 0.62 ? 'clear' : (r < 0.9 ? 'rain' : 'clear');
}

function snapActive(g) {
  return typeof g.snapUntil === 'number' && g.days < g.snapUntil;
}

function cooling(g, id) {
  const until = g.cooldowns[id] || 0;
  return Date.now() < until ? Math.ceil((until - Date.now()) / 1000) : 0;
}
function arm(g, id, ms) {
  g.cooldowns[id] = Date.now() + ms;
}

function result(g, logs, extra) {
  checkGoals(g, logs);
  const over = g.health <= 0 && !g.over;
  if (g.health <= 0) g.over = true;
  return { ok: !extra || extra.ok !== false, logs, floats: (extra && extra.floats) || [], built: extra && extra.built, open: extra && extra.open, over, recruit: extra && extra.recruit };
}

function blocked(g, logs, text) {
  say(g, logs, text);
  return result(g, logs, { ok: false });
}

export function timeLabel(t) {
  const labels = ['Dawn', 'Morning', 'Midday', 'Afternoon', 'Dusk', 'Night'];
  return labels[Math.min(labels.length - 1, Math.floor(clamp(t, 0, 0.999) * labels.length))];
}

export function hudModel(g) {
  const goal = currentGoal(g);
  const w = weatherOf(g.weather);
  const see = !!(g.workers.lookout || g.structures.radio);
  const next = see && g.forecast ? weatherOf(g.forecast) : null;
  return {
    day: g.days,
    season: SEASONS[g.season] || 'SPRING',
    time: timeLabel(g.timeOfDay),
    clock: g.timeOfDay,
    weatherIcon: w.icon,
    weatherName: w.name,
    forecast: next ? next.icon + ' ' + next.name : '',
    warmth: Math.round(g.warmth),
    food: Math.floor(g.food),
    foodMeter: clamp((g.food / 12) * 100, 0, 100),
    health: Math.round(g.health),
    hope: Math.round(g.hope),
    scraps: Math.floor(g.scraps),
    cans: Math.floor(g.cans),
    wood: Math.floor(g.wood),
    cardboard: Math.floor(g.cardboard),
    goodwill: Math.floor(g.goodwill),
    pop: g.population,
    dog: g.dog,
    june: g.june,
    goal: goal ? goal.desc + '  ' + Math.min(goal.getValue(g), goal.target) + '/' + goal.target : 'The ladder is done. Keep the fire.',
    goalReward: goal ? goal.reward : 0,
    rep: REP_TIERS[tierIndex(g.rep)].name + ' · ' + Math.floor(g.rep),
    fireLit: g.fireLit,
    sweep: !!g.sweepWarned,
    sweepLeft: g.sweepWarned ? Math.max(0, Math.ceil(((g.sweepUntil || 0) - Date.now()) / 1000)) : 0,
    storm: g.storm,
    stormDue: !!g.stormDue && !g.storm,
    crafting: craftProgress(g)
  };
}

function craftProgress(g) {
  if (!g.activeCraft) return null;
  const rec = RECIPES.find((r) => r.id === g.activeCraft.id);
  const p = clamp((Date.now() - g.activeCraft.start) / g.activeCraft.duration, 0, 1);
  return { id: g.activeCraft.id, name: rec ? rec.name : 'Work', p };
}

export function recipeRows(g) {
  return RECIPES.map((r) => {
    const reason = craftBlockReason(g, r);
    const busy = g.activeCraft && g.activeCraft.id === r.id;
    return {
      id: r.id,
      icon: r.icon,
      name: r.name,
      category: r.category,
      desc: r.desc,
      cost: costLine(r),
      reason,
      ok: !reason,
      busy,
      p: busy ? craftProgress(g).p : 0
    };
  });
}

function costLine(r) {
  return Object.entries(r.cost).map(([k, v]) => v + ' ' + k).join(' · ');
}

export function craftBlockReason(g, r) {
  if (r.gives && r.gives.structure && g.structures[r.gives.structure]) return r.name + ' already stands.';
  if (r.requires && !g.structures[r.requires]) {
    const need = RECIPES.find((x) => x.gives && x.gives.structure === r.requires);
    return 'Needs a ' + (need ? need.name : r.requires) + ' first.';
  }
  if (r.id === 'meal' && !g.fireLit) return 'The barrel is dark. Feed it before anyone cooks.';
  const missing = Object.entries(r.cost).filter(([k, v]) => (g[k] || 0) < v);
  if (missing.length) return 'Short ' + missing.map(([k, v]) => (v - (g[k] || 0)) + ' ' + k).join(', ') + '.';
  if (g.activeCraft && g.activeCraft.id !== r.id) return 'Finish what is already in your hands.';
  return '';
}

export function peopleRows(g) {
  const hires = WORKER_DEFS.map((w) => ({
    kind: 'hire',
    id: w.id,
    icon: w.icon,
    name: w.name,
    desc: w.desc,
    hired: !!g.workers[w.id],
    cost: w.cost,
    ok: !g.workers[w.id] && g.goodwill >= w.cost
  }));
  const regulars = REGULARS.map((r) => ({
    kind: 'regular',
    id: r.id,
    icon: r.icon,
    name: (g.regulars[r.id] || 0) >= 1 ? r.name : 'Someone on the block',
    desc: r.how + '. ' + r.perk,
    hearts: Math.min(5, Math.floor((g.regulars[r.id] || 0) / 2)),
    known: (g.regulars[r.id] || 0) >= 1
  }));
  const favor = g.favor && FAVORS[g.favor.who] ? {
    kind: 'favor',
    id: g.favor.who,
    text: FAVORS[g.favor.who].ask,
    ok: Object.entries(FAVORS[g.favor.who].need).every(([k, v]) => (g[k] || 0) >= v)
  } : null;
  const petitions = tierIndex(g.rep) >= 2 ? PETITIONS.map((p) => ({
    kind: 'petition',
    id: p.id,
    icon: p.icon,
    name: p.name,
    desc: p.desc,
    cost: p.cost,
    won: !!g.petitions[p.id],
    ok: !g.petitions[p.id] && g.goodwill >= p.cost
  })) : [];
  return { hires, regulars, favor, petitions };
}

function todaysJob(g) {
  return ODD_JOBS[((g.days % ODD_JOBS.length) + ODD_JOBS.length) % ODD_JOBS.length];
}

export function spotActions(g, spotId) {
  const list = [];
  const add = (id, label, detail, ok) => list.push({ id, label, detail, ok: ok !== false });
  if (spotId === 'dumpster') {
    const lock = g.dumpsterLockDay === g.days;
    const wait = cooling(g, 'scavenge');
    add('scavenge', 'Scavenge', lock ? 'Locked for the day.' : wait ? 'Hands need a moment (' + wait + 's).' : 'Cans, scraps, sometimes food.', !lock && !wait);
  }
  if (spotId === 'forage') {
    const lock = g.dumpsterLockDay === g.days;
    const hot = g.weather === 'heat';
    const wait = cooling(g, 'forage');
    add('forage', 'Forage', hot ? 'Too hot to search the brush.' : lock ? 'Nothing loose today.' : 'Wood and cardboard.', !hot && !lock && !wait);
  }
  if (spotId === 'corner') {
    const wait = cooling(g, 'panhandle');
    add('panhandle', 'Ask for change', wait ? 'Not again yet.' : 'Some people stop. Some don’t.', !wait);
    const tw = cooling(g, 'trade');
    add('trade', 'Trade 3 cans', g.cans < 3 ? 'Needs 3 cans.' : tw ? 'The corner is quiet.' : 'Honest dealing. Food comes back.', g.cans >= 3 && !tw);
    if (g.structures.guitar) {
      add('busk', 'Play a set', g.buskDay === g.days ? 'One set a day.' : 'The take follows the camp’s spirits.', g.buskDay !== g.days);
    }
    if (g.structures.cart && g.cans >= 5) {
      add('deposit', 'Haul the cans', g.depositDay === g.days ? 'The center took a load already.' : g.cans + ' cans in the cart.', g.depositDay !== g.days);
    }
    if ((g.regulars.dee || 0) >= 1) {
      add('rainbet', 'Bet on rain', g.rainBetOn ? 'Waiting on the morning.' : 'Stake 2 goodwill with Dee.', !g.rainBetOn && g.rainBetDay !== g.days && g.goodwill >= 2);
    }
    if ((g.regulars.marisol || 0) >= 5 && g.sweepWarned) {
      add('garage', 'Ask for the garage', g.garageCover ? 'Already inside.' : 'She will hide the pile.', !g.garageCover);
    }
  }
  if (spotId === 'barrel') {
    const wait = cooling(g, 'rest');
    add('rest', 'Rest by the fire', g.fireLit ? 'A little health, a little hope.' : 'The barrel is dark. Rest is thin.', !wait);
    add('feed', 'Feed the barrel', g.wood >= 3 ? 'Three wood. The flame stands up.' : 'Needs 3 wood.', g.wood >= 3 && !g.activeCraft);
    if (g.population >= 2 && g.days - g.meetingDay >= 3) {
      add('meeting', 'Hold a meeting', g.weather === 'heat' ? 'Nobody wants the fire on a scorcher.' : 'Every voice, then something for the pot.', g.weather !== 'heat');
    }
    if ((g.regulars.ray || 0) >= 5) {
      add('borrow', 'Ask Ray for a front', g.rayDebt > 0 ? 'The ledger is still open.' : '4 goodwill, a point back each dawn.', g.rayDebt <= 0);
    }
  }
  if (spotId === 'workbench') add('open-craft', 'Use the bench', 'Blankets, meals, and anything the camp can raise.', true);
  if (spotId === 'board') {
    const job = todaysJob(g);
    add('oddjob', job.label, g.oddJobDay === g.days ? 'Posted again at dawn.' : job.desc, g.oddJobDay !== g.days);
  }
  if (spotId === 'mural') {
    if (tierIndex(g.rep) < 1) add('mural', 'The wall', 'The block paints with people it knows.', false);
    else if (g.mural >= MURAL_PANELS) add('mural', 'The mural', 'Four panels. People slow down for it.', false);
    else add('mural', 'Paint a panel (' + g.mural + '/' + MURAL_PANELS + ')', 'Two scraps of salvaged paint. Not in rain or a scorcher.', g.muralDay !== g.days && g.scraps >= 2 && g.weather !== 'rain' && g.weather !== 'heat');
  }
  if (spotId === 'clinic') {
    add('gauze', 'Roll gauze', g.structures.clinic ? 'Two rolls from scrap cloth.' : 'Raise the tarp first.', !!g.structures.clinic && !craftBlockReason(g, RECIPES.find((r) => r.id === 'gauze')));
    add('dress', 'Dress a wound', (g.bandages || 0) < 1 ? 'The shelf is empty.' : 'One roll. Care and health.', (g.bandages || 0) >= 1 && cooling(g, 'dress') === 0);
  }
  if (spotId === 'dog') {
    if (g.dog === 0) add('dog', 'The fence', 'Nobody there yet.', false);
    else {
      add('pet', g.dog === 2 ? 'Sit with Biscuit' : 'Leave food where he can see it', g.dog === 2 ? 'He leans in.' : 'He won’t come closer hungry.', g.food >= 1 || g.dog === 2);
      if (g.dog === 1) add('befriend', 'Offer two meals', g.food >= 3 ? 'He has been watching.' : 'Needs 3 food set aside.', g.food >= 3);
    }
  }
  if (spotId === 'gate') {
    if (g.storm) add('storm', 'The line', 'Hold what the wind is taking.', true);
    else if (g.stormDue) add('storm', 'Call the storm night', 'Rio is at the gate.', true);
    else add('storm', 'The river lot', g.rio >= 2 ? 'Rio is staying.' : 'Quiet water.', false);
  }
  if (spotId === 'newcomer' && g.newcomerAsk) {
    add('welcome', 'Make room', '6 food and 4 wood. A bed and a first bowl.', g.food >= 6 && g.wood >= 4 && !!g.structures.tent && g.population < 8);
  }
  if (spotId === 'ticket' && g.ticketAsk) {
    add('ticket', 'Buy the bus ticket', '12 goodwill and 8 scraps. Someone goes home.', g.goodwill >= 12 && g.scraps >= 8 && g.population >= 2);
  }
  if (spotId === 'wall') add('wall', 'Read the wall', 'What this bridge still remembers.', true);
  return list;
}

export function perform(g, actionId, rng) {
  if (g.over && actionId !== 'wall') return blocked(g, [], 'The camp is still. Start again when you can.');
  const R = rngOf(rng);
  if (actionId && actionId.indexOf('craft:') === 0) return startCraft(g, actionId.slice(6));
  switch (actionId) {
    case 'scavenge': return doScavenge(g, R);
    case 'forage': return doForage(g, R);
    case 'panhandle': return doPanhandle(g, R);
    case 'rest': return doRest(g, R);
    case 'trade': return doTrade(g);
    case 'rainbet': return doRainBet(g);
    case 'borrow': return doBorrow(g);
    case 'garage': return doGarage(g);
    case 'feed': return startCraft(g, 'fire_ration');
    case 'meeting': return doMeeting(g, R);
    case 'oddjob': return doOddJob(g, R);
    case 'mural': return doMural(g);
    case 'busk': return doBusk(g);
    case 'deposit': return doDeposit(g);
    case 'pet': return doPet(g);
    case 'befriend': return doBefriend(g);
    case 'dress': return doDress(g);
    case 'gauze': return startCraft(g, 'gauze');
    case 'welcome': return doWelcome(g);
    case 'ticket': return doTicket(g);
    case 'hire': return { ok: false, logs: [], floats: [] };
    case 'storm': return g.storm ? { ok: true, logs: [], floats: [], open: 'storm' } : beginStorm(g);
    case 'pack': return doPack(g);
    case 'wall': return doWall(g);
    default: return { ok: false, logs: [], floats: [] };
  }
}

export function performHire(g, id) {
  const def = WORKER_DEFS.find((w) => w.id === id);
  const logs = [];
  if (!def) return blocked(g, logs, 'Nobody by that name.');
  if (g.workers[id]) return blocked(g, logs, def.name + ' is already here.');
  if (g.goodwill < def.cost) return blocked(g, logs, 'Need ' + Math.ceil(def.cost - g.goodwill) + ' more goodwill to ask ' + def.name + '.');
  g.goodwill -= def.cost;
  g.workers[id] = true;
  g.population = Math.min(8, g.population + 1);
  g.peakPopulation = Math.max(g.peakPopulation, g.population);
  say(g, logs, def.name + ' joins the camp.');
  return result(g, logs, { floats: ['+' + def.name], recruit: id });
}

export function performFavor(g) {
  const logs = [];
  if (!g.favor || !FAVORS[g.favor.who]) return blocked(g, logs, 'Nobody is waiting on a favor.');
  const f = FAVORS[g.favor.who];
  const who = REGULARS.find((r) => r.id === g.favor.who);
  if (!Object.entries(f.need).every(([k, v]) => (g[k] || 0) >= v)) return blocked(g, logs, 'Not enough to spare yet.');
  Object.entries(f.need).forEach(([k, v]) => { g[k] -= v; });
  g.goodwill += f.give.goodwill;
  g.favorsDone += 1;
  g.favor = null;
  addRep(g, 2, logs);
  say(g, logs, (who ? who.name : 'They') + ' has what they needed. +' + f.give.goodwill + ' goodwill.');
  return result(g, logs, { floats: ['+' + f.give.goodwill + ' goodwill'] });
}

export function performPetition(g, id) {
  const logs = [];
  const p = PETITIONS.find((x) => x.id === id);
  if (!p) return blocked(g, logs, 'That petition is not on the board.');
  if (tierIndex(g.rep) < 2) return blocked(g, logs, 'The city reads petitions from camps it respects.');
  if (g.petitions[id]) return blocked(g, logs, p.name + ' already went through.');
  if (g.goodwill < p.cost) return blocked(g, logs, 'Need ' + p.cost + ' goodwill behind it.');
  g.goodwill -= p.cost;
  g.petitions[id] = true;
  if (id === 'grant') {
    const wet = g.weather === 'rain' ? 0.5 : 1;
    g.food += Math.round(8 * wet);
    g.wood += Math.round(8 * wet);
    g.scraps += Math.round(8 * wet);
    say(g, logs, wet < 1 ? 'The grant lands. Rain got into the crates.' : 'The grant lands: food, wood, and scraps.');
  } else say(g, logs, p.name + '. ' + p.desc);
  addRep(g, 2, logs);
  return result(g, logs, { floats: ['+' + p.name] });
}

function bumpRegular(g, id, logs) {
  const before = g.regulars[id] || 0;
  g.regulars[id] = Math.min(10, before + 1);
  const d = REGULARS.find((r) => r.id === id);
  const stage = (n) => (n >= 5 ? 2 : n >= 1 ? 1 : 0);
  if (d && stage(g.regulars[id]) !== stage(before)) {
    if (stage(g.regulars[id]) === 1) say(g, logs, 'You learn a name. ' + d.name + ' ' + d.who + '.');
    else {
      say(g, logs, d.name + ' counts you as a friend. ' + d.perk + '.');
      addRep(g, 5, logs);
    }
  }
}

function doScavenge(g, rng) {
  const logs = [];
  if (g.dumpsterLockDay === g.days) return blocked(g, logs, 'The dumpsters are locked today.');
  const wait = cooling(g, 'scavenge');
  if (wait) return blocked(g, logs, 'Scavenge is ready in ' + wait + 's.');
  arm(g, 'scavenge', g.injuredUntil > Date.now() ? CD.scavenge * 1.6 : CD.scavenge);
  const wm = (g.season === 3 ? 0.55 : 1) * weatherOf(g.weather).scav * (snapActive(g) ? 0.75 : 1);
  const empty = rng() < 0.18 * (g.season === 3 ? 0.5 : 1) * ((g.regulars.ray || 0) >= 5 ? 0.5 : 1);
  if (empty) {
    say(g, logs, 'This dumpster is empty.');
    return result(g, logs);
  }
  const cans = Math.floor(roll(rng, 0, 3) * wm);
  const scraps = Math.max(1, Math.floor(roll(rng, 1, 4) * wm));
  const food = rng() < 0.42 ? Math.floor(roll(rng, 1, 2) * wm) : 0;
  g.cans += cans;
  g.scraps += scraps;
  g.food += food;
  g.totalScavenged += 1;
  const bits = [];
  if (scraps) bits.push('+' + scraps + ' scraps');
  if (cans) bits.push('+' + cans + ' cans');
  if (food) bits.push('+' + food + ' food');
  say(g, logs, 'Scavenged ' + bits.join(', ') + '.');
  return result(g, logs, { floats: bits });
}

function doForage(g, rng) {
  const logs = [];
  if (g.weather === 'heat') return blocked(g, logs, 'A scorcher. The brush can wait.');
  if (g.dumpsterLockDay === g.days) return blocked(g, logs, 'Nothing loose to forage today.');
  const wait = cooling(g, 'forage');
  if (wait) return blocked(g, logs, 'Forage is ready in ' + wait + 's.');
  arm(g, 'forage', CD.forage);
  const fm = snapActive(g) ? 0.75 : 1;
  let wood = Math.max(1, Math.floor(roll(rng, 1, 3) * fm));
  let card = Math.max(1, Math.floor(roll(rng, 2, 5) * fm));
  if (g.weather === 'rain') card = Math.max(1, Math.floor(card / 2));
  g.wood += wood;
  g.cardboard += card;
  say(g, logs, 'Found ' + wood + ' wood and ' + card + ' cardboard' + (g.weather === 'rain' ? '. The cardboard came home wet.' : '.'));
  return result(g, logs, { floats: ['+' + wood + ' wood', '+' + card + ' cardboard'] });
}

function doPanhandle(g, rng) {
  const logs = [];
  const wait = cooling(g, 'panhandle');
  if (wait) return blocked(g, logs, 'Give it a minute.');
  arm(g, 'panhandle', CD.panhandle);
  let chance = 0.52 * weatherOf(g.weather).pan;
  if (g.structures.awning && g.weather === 'rain') chance *= 2;
  if (g.dog === 2 && !g.dogHungry) chance *= 1.2;
  if (tierIndex(g.rep) >= 1) chance *= 1.12;
  if ((g.mural || 0) >= MURAL_PANELS) chance *= 1.08;
  if (snapActive(g)) chance *= 0.75;
  if (g.sickUntil >= g.days) chance *= 0.7;
  if (rng() < chance) {
    let n = roll(rng, 1, 4);
    if (g.gentrifyDay === g.days) n = Math.max(1, Math.floor(n * 0.6));
    g.goodwill += n;
    say(g, logs, 'Someone stops. +' + n + ' goodwill.');
    if (g.structures.awning && g.weather === 'rain') {
      g.awningSaves += 1;
      say(g, logs, 'Dry under the awning. The corner stayed open.');
    }
    const night = g.timeOfDay < 0.18 || g.timeOfDay > 0.82;
    if (night) bumpRegular(g, 'dee', logs);
    else if ((g.regulars.dee || 0) >= 1) say(g, logs, 'Dee is on the night shift. Her walk home is later.');
    addRep(g, 1, logs);
    return result(g, logs, { floats: ['+' + n + ' goodwill'] });
  }
  g.hope = Math.max(0, g.hope - 3);
  say(g, logs, 'People pass. Hope thins a little.');
  return result(g, logs);
}

function doRest(g, rng) {
  const logs = [];
  const wait = cooling(g, 'rest');
  if (wait) return blocked(g, logs, 'Rest again in ' + wait + 's.');
  arm(g, 'rest', CD.rest);
  let h = roll(rng, 6, 14);
  let m = roll(rng, 3, 8);
  if (g.sickUntil >= g.days) { h = Math.max(1, Math.floor(h / 2)); m = Math.max(1, Math.floor(m / 2)); }
  if (g.weather === 'cold' || !g.fireLit) { h = Math.max(1, Math.floor(h / 2)); m = Math.max(1, Math.floor(m / 2)); }
  g.health = Math.min(100, g.health + h);
  g.hope = Math.min(100, g.hope + m);
  g.warmth = Math.min(100, g.warmth + (g.fireLit ? 4 : 0));
  say(g, logs, g.fireLit ? 'You rest by the barrel. Health +' + h + '.' : 'You rest, but the barrel is dark. It doesn’t reach far.');
  bumpRegular(g, 'ray', logs);
  return result(g, logs, { floats: ['+' + h + ' health'] });
}

function doRainBet(g) {
  const logs = [];
  if ((g.regulars.dee || 0) < 1) return blocked(g, logs, 'Dee has not stopped to talk yet.');
  if (g.rainBetOn) return blocked(g, logs, 'The bet is already with Dee.');
  if (g.rainBetDay === g.days) return blocked(g, logs, 'One bet a day.');
  if (g.goodwill < 2) return blocked(g, logs, 'The stake is 2 goodwill.');
  g.goodwill -= 2;
  g.rainBetOn = true;
  g.rainBetDay = g.days;
  say(g, logs, 'You stake 2 goodwill on rain. Dee takes the other side.');
  return result(g, logs, { floats: ['-2 goodwill'] });
}

function doBorrow(g) {
  const logs = [];
  if ((g.regulars.ray || 0) < 5) return blocked(g, logs, 'Ray fronts friends. Rest by the fire until he knows you.');
  if (g.rayDebt > 0) return blocked(g, logs, 'The ledger is still open.');
  g.goodwill += 4;
  g.rayDebt = 4;
  say(g, logs, 'Ray fronts 4 goodwill. It comes back a point each dawn.');
  return result(g, logs, { floats: ['+4 goodwill'] });
}

function doGarage(g) {
  const logs = [];
  if ((g.regulars.marisol || 0) < 5) return blocked(g, logs, 'Marisol stows goods for friends.');
  if (!g.sweepWarned) return blocked(g, logs, 'The garage opens when a sweep is coming.');
  if (g.garageCover) return blocked(g, logs, 'The pile is already inside.');
  g.garageCover = true;
  say(g, logs, 'Marisol opens the garage. The pile goes inside.');
  return result(g, logs, { floats: ['covered'] });
}

function doTrade(g) {
  const logs = [];
  if (g.cans < 3) return blocked(g, logs, 'Trade takes 3 cans.');
  const wait = cooling(g, 'trade');
  if (wait) return blocked(g, logs, 'The corner is quiet for ' + wait + 's.');
  arm(g, 'trade', CD.trade);
  g.cans -= 3;
  const hostile = g.gentrifyDay === g.days;
  const food = hostile ? 1 : 2;
  g.food += food;
  say(g, logs, hostile ? 'Traded 3 cans for ' + food + ' food. The corner is sharp today.' : 'Traded 3 cans for 2 food.');
  bumpRegular(g, 'marisol', logs);
  addRep(g, 1, logs);
  return result(g, logs, { floats: ['+' + food + ' food'] });
}

function doMeeting(g, rng) {
  const logs = [];
  if (g.population < 2) return blocked(g, logs, 'A meeting needs more than one voice.');
  if (g.days - g.meetingDay < 3) return blocked(g, logs, 'The circle met recently.');
  if (g.weather === 'heat') return blocked(g, logs, 'Nobody circles a barrel in this heat.');
  const gain = 2 * g.population;
  g.hope = Math.min(100, g.hope + gain);
  const keys = ['food', 'cans', 'scraps', 'wood', 'cardboard'];
  const pot = {};
  for (let i = 1; i < g.population; i++) {
    const k = keys[roll(rng, 0, keys.length - 1)];
    g[k] = (g[k] || 0) + 1;
    pot[k] = (pot[k] || 0) + 1;
  }
  g.meetings += 1;
  g.meetingDay = g.days;
  addRep(g, 2, logs);
  say(g, logs, 'The camp circles the fire. Hope +' + gain + '.');
  return result(g, logs, { floats: ['+' + gain + ' hope'] });
}

function doOddJob(g, rng) {
  const logs = [];
  const job = todaysJob(g);
  if (g.oddJobDay === g.days) return blocked(g, logs, 'Today’s posting is done.');
  if (job.id === 'dogwalk' && snapActive(g)) return blocked(g, logs, 'The snap kept the dogs inside.');
  if (job.id === 'flyers' && g.weather === 'rain') {
    g.oddJobDay = g.days;
    return blocked(g, logs, 'Rain pulped the flyers. The shop called it off.');
  }
  const floats = [];
  Object.entries(job.gives).forEach(([k, amt]) => {
    let n = amt;
    if ((job.id === 'scrapyd' || job.id === 'depot') && (g.weather === 'cold' || g.weather === 'rain' || g.season === 3)) n = Math.max(1, Math.floor(n * 0.6));
    if (g.weather === 'heat' && job.id !== 'dogwalk') n = Math.max(1, Math.floor(n * 0.8));
    if (job.id === 'dogwalk' && g.weather === 'heat' && k === 'morale') n = 0;
    if (job.id === 'flyers' && g.gentrifyDay === g.days && k === 'morale') n = 0;
    if (k === 'morale') g.hope = Math.min(100, g.hope + n);
    else g[k] = (g[k] || 0) + n;
    if (n) floats.push('+' + n + ' ' + (k === 'morale' ? 'hope' : k));
  });
  if (g.structures.toolbox) {
    g.goodwill += 2;
    floats.push('+2 goodwill');
  }
  g.oddJobDay = g.days;
  addRep(g, 3, logs);
  say(g, logs, 'Odd job done: ' + job.label.toLowerCase() + '.');
  return result(g, logs, { floats });
}

function doMural(g) {
  const logs = [];
  if (tierIndex(g.rep) < 1) return blocked(g, logs, 'The wall waits until the block knows you.');
  if (g.mural >= MURAL_PANELS) return blocked(g, logs, 'The mural is finished.');
  if (g.muralDay === g.days) return blocked(g, logs, 'Today’s paint has to dry.');
  if (g.weather === 'rain') return blocked(g, logs, 'Wet paint won’t hold in this rain.');
  if (g.weather === 'heat') return blocked(g, logs, 'The wall is too hot to paint.');
  if (g.scraps < 2) return blocked(g, logs, 'Need 2 scraps to mix paint.');
  g.scraps -= 2;
  g.mural += 1;
  g.muralDay = g.days;
  g.hope = Math.min(100, g.hope + 3);
  addRep(g, 2, logs);
  say(g, logs, MURAL_LINES[g.mural - 1]);
  if (g.mural >= MURAL_PANELS) {
    g.goodwill += 5;
    addRep(g, 5, logs);
    say(g, logs, 'The mural is finished. People slow down to look.');
  }
  return result(g, logs, { floats: ['+panel'], built: 'mural' });
}

function doBusk(g) {
  const logs = [];
  if (!g.structures.guitar) return blocked(g, logs, 'There is no guitar yet.');
  if (g.buskDay === g.days) return blocked(g, logs, 'One set a day.');
  let take = 1 + Math.floor(g.hope / 25);
  if (g.weather === 'heat') take *= 2;
  if (g.weather === 'rain' && !g.structures.awning) take = Math.max(1, Math.floor(take / 2));
  if (g.gentrifyDay === g.days) take = Math.max(1, Math.floor(take / 2));
  g.goodwill += take;
  g.hope = Math.min(100, g.hope + 2);
  g.busks += 1;
  g.buskDay = g.days;
  addRep(g, 1, logs);
  say(g, logs, 'A set on the corner. +' + take + ' goodwill.');
  return result(g, logs, { floats: ['+' + take + ' goodwill'] });
}

function doDeposit(g) {
  const logs = [];
  if (!g.structures.cart) return blocked(g, logs, 'The cart is what makes the run possible.');
  if (g.cans < 5) return blocked(g, logs, 'Five cans minimum. The walk has to be worth it.');
  if (g.depositDay === g.days) return blocked(g, logs, 'One run a day.');
  const hauled = g.cans;
  let gw = Math.floor(hauled / 2);
  if (g.weather === 'rain' || g.weather === 'cold') gw = Math.floor(gw / 2);
  if (g.weather === 'heat') gw = Math.floor(gw * 0.75);
  g.cans = 0;
  g.goodwill += gw;
  g.deposits += 1;
  g.depositDay = g.days;
  addRep(g, Math.max(1, Math.floor(hauled / 10)), logs);
  say(g, logs, 'Hauled ' + hauled + ' cans in. +' + gw + ' goodwill.');
  return result(g, logs, { floats: ['+' + gw + ' goodwill'] });
}

function doPet(g) {
  const logs = [];
  if (g.dog < 1) return blocked(g, logs, 'The fence line is empty.');
  if (g.dog === 1) {
    if (g.food < 1) return blocked(g, logs, 'Set a little food out first.');
    g.food -= 1;
    g.hope = Math.min(100, g.hope + 2);
    say(g, logs, 'You leave food at the fence. Biscuit waits until you step back.');
    return result(g, logs, { floats: ['+hope'] });
  }
  g.hope = Math.min(100, g.hope + 2);
  say(g, logs, 'Biscuit leans into your knee, then watches the road again.');
  return result(g, logs, { floats: ['+hope'] });
}

function doBefriend(g) {
  const logs = [];
  if (g.dog !== 1) return blocked(g, logs, 'He has already chosen.');
  if (g.food < 3) return blocked(g, logs, 'He needs to see that the camp can spare food.');
  g.food -= 2;
  g.dog = 2;
  g.dogHungry = false;
  g.hope = Math.min(100, g.hope + 10);
  say(g, logs, 'Biscuit walks in, eats, and sleeps against the barrel. He stays.');
  return result(g, logs, { floats: ['Biscuit'], built: 'dog' });
}

function doDress(g) {
  const logs = [];
  if (!g.structures.clinic) return blocked(g, logs, 'The clinic tarp is down.');
  if ((g.bandages || 0) < 1) return blocked(g, logs, 'No gauze on the shelf.');
  const wait = cooling(g, 'dress');
  if (wait) return blocked(g, logs, 'Give the cot a moment.');
  arm(g, 'dress', CD.dress);
  g.bandages -= 1;
  g.care = Math.min(CLINIC_CONSTANTS.CARE_MAX, (g.care || 0) + CLINIC_CONSTANTS.DRESS_CARE);
  g.health = Math.min(100, g.health + CLINIC_CONSTANTS.DRESS_HEALTH);
  g.hope = Math.min(100, g.hope + 2);
  g.dressings += 1;
  say(g, logs, 'Wound dressed. The tarp holds.');
  if (g.june === 1 && g.dressings >= CLINIC_CONSTANTS.JUNE_AT) {
    g.june = 2;
    say(g, logs, 'June folds her bag under the table. She is staying for the night shift.');
  }
  return result(g, logs, { floats: ['+health'] });
}

function doWelcome(g) {
  const logs = [];
  if (!g.newcomerAsk) return blocked(g, logs, 'Nobody is waiting.');
  if (!g.structures.tent) return blocked(g, logs, 'The tent is down. There is no bed.');
  if (g.population >= 8) return blocked(g, logs, 'The fire is full.');
  if (g.food < 6 || g.wood < 4) return blocked(g, logs, 'A bed takes 6 food and 4 wood.');
  g.food -= 6;
  g.wood -= 4;
  g.newcomerAsk = null;
  g.population += 1;
  g.peakPopulation = Math.max(g.peakPopulation, g.population);
  g.welcomes += 1;
  g.hope = Math.min(100, g.hope + 6);
  addRep(g, 2, logs);
  say(g, logs, 'A bed by the fire and a bowl. The camp is one bigger.');
  return result(g, logs, { floats: ['+1 camp'], recruit: 'resident' });
}

function doTicket(g) {
  const logs = [];
  if (!g.ticketAsk) return blocked(g, logs, 'Nobody is asking to go.');
  if (g.population < 2) return blocked(g, logs, 'There is no one to put on the bus.');
  if (g.goodwill < 12 || g.scraps < 8) return blocked(g, logs, 'The fare is 12 goodwill and 8 scraps.');
  g.goodwill -= 12;
  g.scraps -= 8;
  g.ticketAsk = null;
  g.population = Math.max(1, g.population - 1);
  g.ticketsSent += 1;
  g.hope = Math.min(100, g.hope + 8);
  addRep(g, 3, logs);
  say(g, logs, 'The morning bus pulls away. The camp waves it out of sight.');
  return result(g, logs, { floats: ['home'], built: 'ticket' });
}

function doPack(g) {
  const logs = [];
  if (!g.sweepWarned || g.packedUp) return blocked(g, logs, 'Nothing to pack for.');
  g.packedUp = true;
  g.hope = Math.max(0, g.hope - 5);
  say(g, logs, 'Everyone stashes what they can. The camp is packed.');
  return result(g, logs);
}

function doWall(g) {
  const logs = [];
  const st = getChainState();
  say(g, logs, 'The bridge remembers ' + st.doneCount + ' of ' + st.total + ' things, counted across every camp that slept here.');
  if (st.nextIdx >= 0) say(g, logs, 'Next: ' + st.rows[st.nextIdx].name + '.');
  else if (st.doneCount === 0) say(g, logs, 'The chalk is still faint. Hold the camp, and the wall starts keeping score.');
  return result(g, logs);
}

export function startCraft(g, id) {
  const logs = [];
  const r = RECIPES.find((x) => x.id === id);
  if (!r) return blocked(g, logs, 'That recipe is gone.');
  if (g.activeCraft && g.activeCraft.id === id) return blocked(g, logs, r.name + ' is already underway.');
  const why = craftBlockReason(g, r);
  if (why) return blocked(g, logs, why);
  Object.entries(r.cost).forEach(([k, v]) => { g[k] -= v; });
  let dur = r.time * 0.55;
  if (g.workers.builder) dur *= BUILDER_CRAFT_MULT;
  if (g.injuredUntil > Date.now()) dur *= 1.4;
  g.activeCraft = { id: r.id, start: Date.now(), duration: dur };
  say(g, logs, 'Working on ' + r.name + '.');
  return result(g, logs, { floats: [r.name] });
}

function finishCraft(g) {
  const logs = [];
  const job = g.activeCraft;
  if (!job) return [];
  const r = RECIPES.find((x) => x.id === job.id);
  g.activeCraft = null;
  if (!r) return [];
  if (r.gives.structure) g.structures[r.gives.structure] = true;
  if (r.gives.warmth) g.warmth = Math.min(100, g.warmth + r.gives.warmth);
  if (r.gives.goodwill) g.goodwill += r.gives.goodwill;
  if (r.gives.bandages) {
    g.bandages += r.gives.bandages;
    g.bandagesRolled += r.gives.bandages;
  }
  if (r.id === 'fire_ration') g.fireLit = true;
  if (r.id === 'clinic') {
    g.june = g.june >= 1 ? g.june : 1;
    g.care = Math.max(g.care || 0, 60);
    say(g, logs, 'A tarp, a cot, a red cross cut from a reflector. June watches from the sidewalk.');
  } else if (r.id === 'gate') {
    g.rio = Math.max(g.rio, 1);
    say(g, logs, 'The storm gate stands. Rio comes up from the water and waits.');
  } else if (r.id === 'tent') {
    say(g, logs, 'The tent goes up. A roof of sorts.');
  } else {
    say(g, logs, 'Finished ' + r.name + '.');
  }
  g.totalCrafted += 1;
  checkGoals(g, logs);
  logs._built = r.gives.structure || r.id;
  return logs;
}

function lossFraction(g) {
  let keep = g.packedUp ? 0.28 : 1;
  if (g.structures.stash) keep *= 0.5;
  if (g.garageCover) {
    g.garageCover = false;
    g.garageSaves += 1;
    return 0;
  }
  return keep;
}

function applySweep(g, rng) {
  const logs = [];
  g.timesSwept += 1;
  g.lastEventDay = g.days;
  g.sweepWarned = false;
  g.sweepUntil = 0;
  if (g.structures.tent) { g.structures.tent = false; say(g, logs, 'The tent was taken down.'); }
  if (g.structures.garden) { g.structures.garden = false; say(g, logs, 'The garden was trampled.'); }
  if (g.structures.soup_kitchen && rng() < 0.65) { g.structures.soup_kitchen = false; say(g, logs, 'The soup kitchen was torn down.'); }
  if (g.structures.clinic && rng() < 0.7) {
    g.structures.clinic = false;
    say(g, logs, 'The night clinic was pulled down.');
  }
  const frac = lossFraction(g);
  if (frac === 0) say(g, logs, 'The sweep found nothing loose. It spent the night across the street.');
  else {
    const cut = (n, a, b) => Math.floor(n * (a + rng() * (b - a)) * frac);
    const wood = cut(g.wood, 0.25, 0.55);
    const scraps = cut(g.scraps, 0.25, 0.55);
    const food = cut(g.food, 0.15, 0.4);
    g.wood = Math.max(0, g.wood - wood);
    g.scraps = Math.max(0, g.scraps - scraps);
    g.food = Math.max(0, g.food - food);
    if (wood || scraps || food) say(g, logs, 'Supplies were hauled off.');
  }
  g.hope = Math.max(0, g.hope - roll(rng, 12, 22));
  if ((g.mural || 0) >= MURAL_PANELS) {
    g.hope = Math.min(100, g.hope + 5);
    say(g, logs, 'The mural still stands over the wreckage. It helps.');
  }
  if (g.packedUp) say(g, logs, 'Packing up saved most of what mattered.');
  g.packedUp = false;
  say(g, logs, 'A sweep came through the underpass.');
  return logs;
}

function maybeEvent(g, rng, logs) {
  if (g.days < 2 || rng() > 0.5) return;
  if (g.days - g.lastEventDay < 1) return;
  const sweepChance = 0.16 * (tierIndex(g.rep) >= 2 ? 0.5 : 1);
  if (rng() < sweepChance && !g.sweepWarned) {
    if (g.workers.lookout || g.dog === 2) {
      g.sweepWarned = true;
      g.sweepUntil = Date.now() + (g.workers.lookout ? 14000 : 8000);
      say(g, logs, g.workers.lookout
        ? 'The lookout hears radios. A sweep is close. Pack what you can.'
        : 'Biscuit will not stop barking at the road. Something is coming.');
      return;
    }
    applySweep(g, rng).forEach((line) => logs.push(line));
    g.log.push({ t: Date.now(), text: logs[logs.length - 1] });
    return;
  }
  const pool = [];
  const bad = [
    ['cold', 10], ['theft', 8], ['injury', 7], ['fire', 8], ['sick', 7], ['locked', 6], ['hostility', 5]
  ];
  const good = [
    ['kind', 9], ['bill', 8], ['clear', 8], ['church', 7]
  ];
  bad.forEach(([id, w]) => { for (let i = 0; i < w; i++) pool.push(id); });
  good.forEach(([id, w]) => { for (let i = 0; i < w; i++) pool.push(id); });
  const pick = pool[Math.floor(rng() * pool.length)];
  g.lastEventDay = g.days;
  if (pick === 'cold') {
    let hit = roll(rng, 12, 24);
    if (g.structures.coats) { hit = Math.floor(hit * COATS_CUT); g.coldCut += 1; }
    g.warmth = Math.max(0, g.warmth - hit);
    g.health = Math.max(0, g.health - roll(rng, 4, 10));
    say(g, logs, 'A cold snap drops through the camp.');
  } else if (pick === 'theft') {
    const dm = g.dog === 2 && !g.dogHungry ? 0.45 : 1;
    const sm = (g.structures.stash ? 0.5 : 1) * (g.petitions.streetlight ? 0.5 : 1);
    g.food = Math.max(0, g.food - Math.floor(g.food * 0.25 * dm * sm));
    g.scraps = Math.max(0, g.scraps - Math.floor(g.scraps * 0.2 * dm * sm));
    g.cans = Math.max(0, g.cans - Math.floor(g.cans * 0.3 * dm * sm));
    g.hope = Math.max(0, g.hope - 8);
    say(g, logs, dm < 1 ? 'Someone came through in the night. Biscuit ran them off early.' : 'Someone came through in the night.');
  } else if (pick === 'injury') {
    g.health = Math.max(0, g.health - roll(rng, 8, 16));
    g.injuredUntil = Date.now() + 50000;
    say(g, logs, 'A bad step. Moving will be slower for a while.');
  } else if (pick === 'fire') {
    if (g.warmth >= 70 && g.fireLit) return;
    g.fireLit = false;
    g.warmth = Math.max(0, g.warmth - roll(rng, 8, 16));
    say(g, logs, 'The barrel went out. It is darker than it should be.');
  } else if (pick === 'sick') {
    const cut = g.petitions.sanitation ? 0.5 : 1;
    g.health = Math.max(0, g.health - Math.floor(roll(rng, 8, 16) * cut));
    g.sickUntil = g.days + 1;
    say(g, logs, cut < 1 ? 'A bug moves through. The sanitation unit keeps it smaller.' : 'A bug moves through the camp.');
  } else if (pick === 'locked') {
    g.dumpsterLockDay = g.days;
    say(g, logs, 'Locks on the dumpsters today. Forage and scavenge wait for dawn.');
  } else if (pick === 'hostility') {
    g.gentrifyDay = g.days;
    g.hope = Math.max(0, g.hope - roll(rng, 8, 14));
    addRep(g, -3, logs);
    say(g, logs, 'New buildings nearby. The sidewalk is less kind today.');
  } else if (pick === 'kind') {
    if (g.weather === 'rain') say(g, logs, 'Someone left a bag by the bridge. The rain got to it.');
    else {
      const f = roll(rng, 2, 5);
      g.food += f;
      g.hope = Math.min(100, g.hope + 4);
      say(g, logs, 'Someone left a bag of food by the bridge. +' + f + ' food.');
    }
  } else if (pick === 'bill') {
    const n = g.weather === 'rain' ? 2 : 5;
    g.goodwill += n;
    g.hope = Math.min(100, g.hope + 3);
    say(g, logs, g.weather === 'rain' ? 'A soaked bill on the sidewalk. +2 goodwill.' : 'A five on the sidewalk. +5 goodwill.');
  } else if (pick === 'clear') {
    g.weather = 'clear';
    g.warmth = Math.min(100, g.warmth + roll(rng, 6, 12));
    g.hope = Math.min(100, g.hope + 4);
    say(g, logs, 'The sky clears. An easier stretch.');
  } else if (pick === 'church') {
    g.food += roll(rng, 3, 6);
    g.scraps += roll(rng, 1, 3);
    g.cardboard += roll(rng, 1, 3);
    g.hope = Math.min(100, g.hope + 4);
    say(g, logs, 'A church van leaves food, scraps, and cardboard. No sermon. Just the boxes.');
  }
}

function gardenAtDawn(g, logs, rng) {
  if (!g.structures.garden) return;
  if (g.weather === 'cold' || snapActive(g) || g.season === 3) {
    if (g.structures.compost && g.season !== 3) {
      g.food += 1;
      g.compostDays += 1;
      say(g, logs, 'Frost on the beds. The compost kept one of them alive.');
    } else if (g.season === 3) say(g, logs, 'Winter on the beds. The garden sleeps.');
    else say(g, logs, 'The beds gave nothing this morning.');
    return;
  }
  let y = roll(rng, 1, 3);
  if (g.structures.compost) { y += 1; g.compostDays += 1; }
  if (g.weather !== 'rain' && g.barrelWater > 0 && !snapActive(g)) {
    g.barrelWater -= 1;
    y += 1;
    g.barrelDays += 1;
    say(g, logs, 'A stored rainfall waters the beds.');
  }
  g.food += y;
  say(g, logs, 'The garden yields ' + y + ' food.');
}

function onDawn(g, rng) {
  const logs = [];
  g.days += 1;
  g.season = Math.floor(g.days / 7) % 4;
  g.weather = g.forecast && WEATHERS[g.forecast] ? g.forecast : rollWeather(g, rng);
  g.forecast = rollWeather(g, rng);
  g.sweepWarned = false;
  g.packedUp = false;

  if (g.rainBetOn) {
    g.rainBetOn = false;
    if (g.weather === 'rain') {
      g.goodwill += 5;
      g.rainBetsWon += 1;
      say(g, logs, 'Rain on the tarps. Dee pays the bet.');
    } else say(g, logs, 'A dry morning. Dee keeps the stake.');
  }
  if (g.rayDebt > 0 && g.goodwill > 0) {
    g.goodwill -= 1;
    g.rayDebt -= 1;
    if (g.rayDebt <= 0) {
      g.rayLoans += 1;
      say(g, logs, 'Ray’s ledger clears.');
    }
  }
  if (typeof g.snapUntil === 'number' && g.days >= g.snapUntil) {
    g.snapUntil = null;
    g.snapsSurvived += 1;
    g.hope = Math.min(100, g.hope + 4);
    say(g, logs, 'The cold snap breaks. The camp came through it.');
  } else if (!snapActive(g) && g.season === 3 && rng() < 0.22) {
    g.snapUntil = g.days + 2;
    say(g, logs, 'A cold snap settles on the block. Two hard days.');
  }

  g.food = Math.max(0, g.food - g.population * 1.5);
  let bite = Math.max(0, weatherOf(g.weather).warmth);
  let snapBite = snapActive(g) ? 8 : 0;
  if (g.structures.coats && (bite > 0 || snapBite > 0)) {
    if (bite > 0) bite *= COATS_CUT;
    snapBite *= COATS_CUT;
    g.coldCut += 1;
    say(g, logs, 'Coats off the rack. The morning cuts less.');
  }
  const base = g.season === 3 ? 14 : 6;
  const fireHelp = g.fireLit ? 0 : 6;
  g.warmth = clamp(g.warmth - base - bite - snapBite - fireHelp, 0, 100);
  if (g.warmth >= 48 && g.fireLit) {
    g.hope = Math.min(100, g.hope + 2);
    say(g, logs, g.weather === 'heat' ? 'A warm morning. That was the sky, not the barrel.' : 'The fire held. The camp wakes warm.');
  }
  g.hope = Math.max(0, g.hope - 2);

  gardenAtDawn(g, logs, rng);
  if (g.structures.pantry && g.weather !== 'rain' && rng() < 0.45) {
    g.food += 2;
    g.pantryFills += 1;
    say(g, logs, 'Someone left food in the pantry box.');
  }
  if (g.structures.barrel && g.weather === 'rain' && g.barrelWater < BARREL_CAP) {
    g.barrelWater += 1;
    say(g, logs, 'The rain barrel catches the morning. ' + g.barrelWater + '/' + BARREL_CAP + ' stored.');
  }
  if (g.food <= 0) {
    g.health = Math.max(0, g.health - roll(rng, 4, 9));
    say(g, logs, 'The pot is empty. People feel it.');
  }
  if (g.warmth < 22) {
    g.health = Math.max(0, g.health - roll(rng, 4, 10));
    say(g, logs, 'The cold got in overnight.');
  }
  if (g.structures.tent && rng() < (g.weather === 'rain' ? 0.08 : 0.04)) {
    g.structures.tent = false;
    g.newcomerAsk = null;
    say(g, logs, 'The tent tore in the wind.');
  }
  if (g.structures.workbench && rng() < 0.04) {
    if (g.structures.toolbox) {
      g.benchSaves += 1;
      say(g, logs, 'The workbench wobbled. The tools pulled it true.');
    } else {
      g.structures.workbench = false;
      say(g, logs, 'The workbench fell apart.');
    }
  }
  if (g.workers.scrapper && g.dumpsterLockDay !== g.days) {
    g.scraps += g.weather === 'cold' ? 1 : 2;
    g.cans += 1;
    say(g, logs, 'The scrapper is back with a small haul.');
  }
  if (g.structures.soup_kitchen && g.weather !== 'heat' && g.food >= g.population) {
    g.food -= g.population;
    g.hope = Math.min(100, g.hope + 4);
    g.health = Math.min(100, g.health + 2);
    g.soupNights += 1;
    say(g, logs, 'Soup night carried into morning. Everyone ate hot.');
  }
  if (g.workers.cook && g.food >= 3 && g.weather !== 'heat' && !(g.sickUntil >= g.days)) {
    g.food -= 3;
    g.goodwill += 2;
    say(g, logs, 'The cook plated breakfast. +2 goodwill.');
  }
  if ((g.regulars.marisol || 0) >= 5 && rng() < 0.28 && g.weather !== 'rain') {
    const f = roll(rng, 2, 3);
    g.food += f;
    say(g, logs, 'Marisol left tamales on the post. +' + f + ' food.');
  }
  if (g.dog === 2) {
    if (g.food >= 1) {
      g.food -= 1;
      g.dogHungry = false;
      g.hope = Math.min(100, g.hope + 2);
      g.warmth = Math.min(100, g.warmth + 3);
    } else {
      g.dogHungry = true;
      g.hope = Math.max(0, g.hope - 2);
      say(g, logs, 'Nothing left for Biscuit. He curls up hungry.');
    }
  }
  if (g.days > 1 && g.rep > 0) addRep(g, -1, logs);
  if ((g.mural || 0) >= MURAL_PANELS) g.hope = Math.min(100, g.hope + 2);
  if (g.structures.clinic) {
    const drop = g.june === 2 ? CLINIC_CONSTANTS.JUNE_DROP : CLINIC_CONSTANTS.DROP;
    g.care = Math.max(0, (g.care || 0) - drop);
    if (g.care <= 0) {
      g.health = Math.max(0, g.health - CLINIC_CONSTANTS.NEGLECT_HEALTH);
      g.clinicSteady = 0;
      say(g, logs, 'The clinic was neglected. People are worse for it.');
    } else if (g.care >= CLINIC_CONSTANTS.STEADY_LINE) g.clinicSteady += 1;
    else g.clinicSteady = 0;
  }
  if (g.structures.gate && g.days > 0 && g.days % 5 === 0 && !g.storm) {
    g.stormDue = true;
    say(g, logs, 'The river lot is going under. Rio is at the gate.');
  }
  if (g.dog === 0 && g.days >= 4) {
    g.dog = 1;
    g.dogMetDay = g.days;
    say(g, logs, 'A thin dog with one torn ear watches from the fence. Someone starts calling him Biscuit.');
  } else if (g.dog === 1 && g.days >= g.dogMetDay + 2 && g.food >= 4) {
    g.dog = 2;
    g.food -= 2;
    g.hope = Math.min(100, g.hope + 8);
    say(g, logs, 'Biscuit comes in on his own and sleeps against the barrel.');
  }
  if (!g.newcomerAsk && g.structures.tent && tierIndex(g.rep) >= 2 && g.population < 6 && g.days - g.newcomerLastDay >= 6 && g.weather !== 'rain') {
    g.newcomerAsk = { day: g.days };
    g.newcomerLastDay = g.days;
    say(g, logs, 'Someone stands at the edge of the light and asks to stay.');
  } else if (g.newcomerAsk && g.days - g.newcomerAsk.day >= 3) {
    g.newcomerAsk = null;
    say(g, logs, 'The stranger moves on.');
  }
  if (!g.ticketAsk && g.population >= 3 && tierIndex(g.rep) >= 2 && g.days - g.ticketLastDay >= 8 && g.weather !== 'rain') {
    g.ticketAsk = { day: g.days };
    g.ticketLastDay = g.days;
    say(g, logs, 'By the fire, someone talks about family a bus ride away.');
  } else if (g.ticketAsk && g.days - g.ticketAsk.day >= 4) {
    g.ticketAsk = null;
    say(g, logs, 'The talk of home fades.');
  }
  if (!g.favor && g.days - g.lastFavorDay >= 3) {
    const friends = REGULARS.filter((r) => (g.regulars[r.id] || 0) >= 5);
    if (friends.length) {
      const r = friends[Math.floor(rng() * friends.length)];
      g.favor = { who: r.id, day: g.days };
      g.lastFavorDay = g.days;
      say(g, logs, FAVORS[r.id].ask);
    }
  } else if (g.favor && g.days - g.favor.day >= 2) {
    g.favor = null;
    say(g, logs, 'A favor goes quietly unasked.');
  }
  if (!g.arcDone && g.arcStage === 0 && g.days >= 10 && g.goodwill >= 15) {
    g.arcStage = 1;
    g.hope = Math.min(100, g.hope + 6);
    say(g, logs, 'Dena, a county case worker, leaves her card. "This isn’t nothing," she says.');
  } else if (!g.arcDone && g.arcStage === 1 && g.structures.soup_kitchen && g.population >= 4) {
    g.arcStage = 2;
    say(g, logs, 'Dena comes back with forms. Keep hope up, and goodwill set aside.');
  } else if (!g.arcDone && g.arcStage === 2 && g.goodwill >= 25 && g.hope > 60) {
    g.arcStage = 3;
    say(g, logs, 'Dena came through. There are keys.');
  }
  const w = weatherOf(g.weather);
  say(g, logs, 'Day ' + g.days + '. ' + (SEASONS[g.season] || 'Spring') + '. ' + w.name + '.');
  maybeEvent(g, rng, logs);
  checkGoals(g, logs);
  if (g.health <= 0) g.over = true;
  return logs;
}

export function beginStorm(g) {
  const logs = [];
  if (!g.structures.gate || !g.stormDue || g.storm) return blocked(g, logs, 'No storm is waiting.');
  g.storm = { phase: 0, strikes: 0, deadline: Date.now() + STORM_CONSTANTS.PHASE_MS };
  g.stormDue = false;
  say(g, logs, 'Storm night. ' + STORM_CONSTANTS.PHASES[0].title + '.');
  return result(g, logs, { open: 'storm' });
}

export function stormHold(g) {
  const logs = [];
  if (!g.storm) return blocked(g, logs, 'The night is quiet.');
  const phase = STORM_CONSTANTS.PHASES[g.storm.phase];
  if (!phase) return finishStorm(g, logs);
  if (phase.need && (g[phase.need] || 0) < phase.cost) {
    return blocked(g, logs, 'Not enough ' + phase.need + '. Rio is still watching.');
  }
  if (phase.need) g[phase.need] -= phase.cost;
  say(g, logs, phase.player);
  return advanceStorm(g, logs, false);
}

function advanceStorm(g, logs, failed) {
  if (failed) {
    g.storm.strikes += 1;
    g.warmth = Math.max(0, g.warmth - STORM_CONSTANTS.FAIL_WARMTH);
    g.health = Math.max(0, g.health - STORM_CONSTANTS.FAIL_HEALTH);
    say(g, logs, 'The line gives.');
  }
  g.storm.phase += 1;
  if (g.storm.phase >= STORM_CONSTANTS.PHASES.length || g.storm.strikes >= 2) return finishStorm(g, logs);
  g.storm.deadline = Date.now() + STORM_CONSTANTS.PHASE_MS;
  say(g, logs, 'Next: ' + STORM_CONSTANTS.PHASES[g.storm.phase].title + '.');
  return result(g, logs, { open: 'storm' });
}

function finishStorm(g, logs) {
  const won = g.storm && g.storm.strikes < 2;
  g.storm = null;
  if (won) {
    g.stormsCleared += 1;
    g.rio = 2;
    g.hope = Math.min(100, g.hope + 6);
    say(g, logs, 'The storm passes. Rio stays. The gate held.');
  } else say(g, logs, 'Two breaks in the line. Call it again when the pile can bear it.');
  checkGoals(g, logs);
  return result(g, logs, { open: 'storm-done', built: won ? 'storm' : null });
}

export function tick(g, dt, rng) {
  const logs = [];
  if (!g || g.over) return { logs, dawn: false, built: null, over: !!g && g.over, sweep: false };
  const R = rngOf(rng);
  if (g.sweepWarned && g.sweepUntil && Date.now() >= g.sweepUntil) {
    const swept = applySweep(g, R);
    swept.forEach((line) => say(g, [], line));
    checkGoals(g, swept);
    return { logs: swept, dawn: false, built: 'sweep', over: g.health <= 0, sweep: true };
  }
  if (g.storm && Date.now() >= g.storm.deadline) {
    const phase = STORM_CONSTANTS.PHASES[g.storm.phase];
    const can = phase && (!phase.need || (g[phase.need] || 0) >= phase.cost);
    if (can && phase && phase.need) g[phase.need] -= phase.cost;
    if (can && phase) say(g, logs, phase.rio);
    const stepped = advanceStorm(g, logs, !can);
    return { logs: stepped.logs, dawn: false, built: stepped.built || null, over: g.health <= 0, sweep: false, open: 'storm' };
  }
  let built = null;
  if (g.activeCraft && Date.now() >= g.activeCraft.start + g.activeCraft.duration) {
    const crafted = finishCraft(g);
    built = crafted._built || null;
    crafted.forEach((line) => logs.push(line));
  }
  // Night and bad weather lean on warmth while you are awake, not only at dawn.
  const night = g.timeOfDay > 0.78 || g.timeOfDay < 0.16;
  let drain = 0;
  if (night) drain += g.fireLit ? 0.22 : 0.7;
  if (g.weather === 'cold' || snapActive(g)) drain += 0.18;
  if (!g.fireLit) drain += 0.25;
  if (g.weather === 'heat') g.warmth = Math.min(100, g.warmth + (dt / 1000) * 0.12);
  if (drain) g.warmth = Math.max(0, g.warmth - (dt / 1000) * drain);
  if (g.warmth < 8) g.health = Math.max(0, g.health - (dt / 1000) * 0.35);
  if (g.food <= 0 && night) g.health = Math.max(0, g.health - (dt / 1000) * 0.12);
  g.timeOfDay += dt / DAY_MS;
  let dawn = false;
  if (g.timeOfDay >= 1) {
    g.timeOfDay -= 1;
    const morning = onDawn(g, R);
    morning.forEach((line) => logs.push(line));
    dawn = true;
    built = built || 'dawn';
  }
  if (g.health <= 0) g.over = true;
  return { logs, dawn, built, over: g.over, sweep: false };
}

export function chainView() {
  return getChainState();
}

export function spotBlurb(spotId) {
  const blurbs = {
    dumpster: ['Dumpster', 'The bins along the service road. You have to be next to one.'],
    forage: ['Brush and pallets', 'Cardboard, broken chairs, anything that burns or covers.'],
    corner: ['The corner', 'Foot traffic off the avenue. Ask, trade, or play.'],
    barrel: ['Barrel fire', 'The camp’s center. Feed it. Sleep near it. Meet at it.'],
    workbench: ['Workbench', 'Most of what the camp becomes starts on this bench.'],
    board: ['Bulletin', 'One posted job a day. Honest work, remembered.'],
    mural: ['Underpass wall', 'Paint, once the block knows your name.'],
    clinic: ['Night clinic', 'A cot and a red cross. Care falls every dawn it stands.'],
    dog: ['Biscuit', 'One torn ear. He decides on his own time.'],
    gate: ['Storm gate', 'The path to the river lot. Rio watches the water.'],
    newcomer: ['At the light’s edge', 'They heard this camp treats people right.'],
    ticket: ['Talk of home', 'A sister, two towns over. A bus would do it.'],
    wall: ['The chalk wall', 'Holds, names, and the things the rain has not taken.']
  };
  return blurbs[spotId] || ['Camp', 'Under the overpass.'];
}
