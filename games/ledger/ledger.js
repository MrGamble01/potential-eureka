const SAVE_KEY = 'ledger-v1';
const TICK_MS = 400;
const HEAT_MAX = 100;
const SALE = 20;
const HEAT_PER_SALE = 12;
const LAY_TICKS = 8;
const LAY_DRAIN = 10;
const YARD_CAP = 8;

const COMPANIONS = [
  { id: 'mara', name: 'Mara Voss' },
  { id: 'ivo', name: 'Ivo Quill' },
  { id: 'sable', name: 'Sable' },
  { id: 'bram', name: 'Bram Holt' },
  { id: 'ness', name: 'Ness Kite' },
  { id: 'pell', name: 'Pell' },
];

const $ = (id) => document.getElementById(id);

function fresh() {
  return {
    cash: 100,
    heat: 0,
    paused: false,
    lay: 0,
    boss: 'The Founder',
    bossId: '',
    heirN: 0,
    cousinN: 0,
    stock: { yard: 4, dock: 0, corner: 0 },
    legs: { haul: '', drop: '' },
    crew: [
      { id: 'mara', name: 'Mara Voss', alive: true },
      { id: 'ivo', name: 'Ivo Quill', alive: true },
    ],
    log: ['The book is open. Staff the haul and the drop.'],
    armUntil: 0,
  };
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (!raw || !raw.stock || !Array.isArray(raw.crew)) return fresh();
    const next = fresh();
    next.cash = Math.max(0, Math.floor(raw.cash) || 0);
    next.heat = Math.max(0, Math.min(HEAT_MAX, Math.floor(raw.heat) || 0));
    next.paused = !!raw.paused;
    next.lay = Math.max(0, Math.floor(raw.lay) || 0);
    next.boss = typeof raw.boss === 'string' && raw.boss ? raw.boss : next.boss;
    next.bossId = typeof raw.bossId === 'string' ? raw.bossId : '';
    next.heirN = Math.max(0, Math.floor(raw.heirN) || 0);
    next.cousinN = Math.max(0, Math.floor(raw.cousinN) || 0);
    for (const key of ['yard', 'dock', 'corner']) {
      next.stock[key] = Math.max(0, Math.floor(raw.stock[key]) || 0);
    }
    next.legs.haul = typeof raw.legs?.haul === 'string' ? raw.legs.haul : '';
    next.legs.drop = typeof raw.legs?.drop === 'string' ? raw.legs.drop : '';
    if (Array.isArray(raw.crew) && raw.crew.length) {
      next.crew = raw.crew.filter((c) => c && typeof c.id === 'string').map((c) => ({
        id: c.id,
        name: typeof c.name === 'string' ? c.name : c.id,
        alive: !!c.alive,
      }));
    }
    if (Array.isArray(raw.log)) next.log = raw.log.filter((line) => typeof line === 'string').slice(0, 12);
    return next;
  } catch (e) {
    return fresh();
  }
}

let state = load();

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* private mode */ }
}

function pushLog(line) {
  state.log.unshift(line);
  if (state.log.length > 12) state.log.length = 12;
}

function living() {
  return state.crew.filter((c) => c.alive);
}

function personName(id) {
  const person = state.crew.find((c) => c.id === id && c.alive);
  return person ? person.name : '';
}

function nowLine() {
  if (state.paused) return 'Paused. Crates stay where they are.';
  if (state.lay > 0) return 'Laying low. Heat is leaving, and the routes hold.';
  const haul = personName(state.legs.haul);
  const drop = personName(state.legs.drop);
  if (!haul || !drop) return 'Staff both legs. Crates sit in the yard until someone hauls and someone sells.';
  if (state.heat >= 80) return haul + ' is hauling. ' + drop + ' is selling. The authorities are close.';
  return haul + ' is hauling. ' + drop + ' is selling. Heat ' + state.heat + '.';
}

function takenIds() {
  const ids = new Set(state.crew.map((c) => c.id));
  if (state.bossId) ids.add(state.bossId);
  return ids;
}

function mintPerson() {
  const used = takenIds();
  const companion = COMPANIONS.find((c) => !used.has(c.id));
  if (companion) return { id: companion.id, name: companion.name };
  state.cousinN += 1;
  return { id: 'cousin-' + state.cousinN, name: 'Cousin ' + state.cousinN };
}

function staff(leg, id) {
  const person = state.crew.find((c) => c.id === id && c.alive);
  if (id && !person) return;
  const other = leg === 'haul' ? 'drop' : 'haul';
  if (id && state.legs[other] === id) state.legs[other] = '';
  state.legs[leg] = id;
  save();
  paint();
}

function layLow() {
  if (state.paused) {
    pushLog('Unpause the book before you lay low.');
    paint();
    return;
  }
  if (state.lay > 0) return;
  state.lay = LAY_TICKS;
  pushLog('The routes hold. Heat starts to leave the street.');
  save();
  paint();
}

function togglePause() {
  state.paused = !state.paused;
  pushLog(state.paused ? 'The book is paused.' : 'The book is moving again.');
  save();
  paint();
}

function armRestart() {
  const now = Date.now();
  if (state.armUntil > now) {
    state = fresh();
    save();
    paint(true);
    return;
  }
  state.armUntil = now + 2500;
  paint();
}

function raid() {
  const working = state.crew.find((c) => c.alive && (state.legs.haul === c.id || state.legs.drop === c.id));
  const fallen = working || state.crew.find((c) => c.alive);
  if (fallen) {
    fallen.alive = false;
    if (state.legs.haul === fallen.id) state.legs.haul = '';
    if (state.legs.drop === fallen.id) state.legs.drop = '';
    pushLog(fallen.name + ' does not come back.');
  }
  const heir = mintPerson();
  state.boss = heir.name;
  state.bossId = heir.id;
  state.heirN += 1;
  state.cash = Math.floor(state.cash / 2);
  state.heat = 20;
  state.lay = 0;
  while (living().length < 2) {
    const next = mintPerson();
    state.crew.push({ id: next.id, name: next.name, alive: true });
    pushLog(next.name + ' joins the book.');
  }
  pushLog(heir.name + ' takes the book. The routes go quiet.');
}

function tick() {
  if (state.paused) return;
  if (state.lay > 0) {
    state.lay -= 1;
    state.heat = Math.max(0, state.heat - LAY_DRAIN);
    if (state.lay === 0) pushLog('The street is quiet enough to move again.');
    save();
    paint();
    return;
  }
  if (state.stock.yard < YARD_CAP) state.stock.yard += 1;
  const haul = state.crew.find((c) => c.alive && c.id === state.legs.haul);
  const drop = state.crew.find((c) => c.alive && c.id === state.legs.drop);
  if (haul && state.stock.yard > 0) {
    state.stock.yard -= 1;
    state.stock.dock += 1;
  }
  if (drop && state.stock.dock > 0) {
    state.stock.dock -= 1;
    state.stock.corner += 1;
  }
  if (state.stock.corner > 0) {
    state.stock.corner -= 1;
    state.cash += SALE;
    state.heat = Math.min(HEAT_MAX, state.heat + HEAT_PER_SALE);
  }
  if (state.heat >= HEAT_MAX) raid();
  save();
  paint();
}

let crewSig = '';

function paint(forceCrew) {
  $('boss').textContent = state.boss;
  $('cash').textContent = '$' + state.cash;
  $('heat-num').textContent = String(state.heat);
  $('heat-fill').style.width = state.heat + '%';
  $('heat-num').parentElement.classList.toggle('hot', state.heat >= 80);
  $('now').textContent = nowLine();
  $('yard').textContent = String(state.stock.yard);
  $('dock').textContent = String(state.stock.dock);
  $('corner').textContent = String(state.stock.corner);
  $('pause').textContent = state.paused ? 'Resume' : 'Pause';
  $('laylow').textContent = state.lay > 0 ? 'Laying low' : 'Lay low';
  $('restart').textContent = state.armUntil > Date.now() ? 'Restart? Click again' : 'Restart';
  const sig = state.crew.map((c) => c.id + (c.alive ? '1' : '0')).join(',') + '|' + state.legs.haul + '|' + state.legs.drop;
  if (forceCrew || sig !== crewSig) {
    crewSig = sig;
    fillSelect($('haul'), 'haul');
    fillSelect($('drop'), 'drop');
    $('crew').innerHTML = state.crew.map((c) => {
      let role = '';
      if (c.alive && state.legs.haul === c.id) role = ' — hauling';
      else if (c.alive && state.legs.drop === c.id) role = ' — selling';
      else if (!c.alive) role = ' — gone';
      return '<li class="' + (c.alive ? '' : 'dead') + '">' + c.name + role + '</li>';
    }).join('');
  }
  $('log').innerHTML = state.log.map((line) => '<li>' + line + '</li>').join('');
}

function fillSelect(el, leg) {
  const current = state.legs[leg];
  const options = ['<option value="">Nobody</option>'].concat(living().map((c) =>
    '<option value="' + c.id + '"' + (c.id === current ? ' selected' : '') + '>' + c.name + '</option>'
  ));
  el.innerHTML = options.join('');
}

$('haul').addEventListener('change', (e) => staff('haul', e.target.value));
$('drop').addEventListener('change', (e) => staff('drop', e.target.value));
$('pause').addEventListener('click', togglePause);
$('laylow').addEventListener('click', layLow);
$('restart').addEventListener('click', armRestart);

paint(true);
setInterval(tick, TICK_MS);
