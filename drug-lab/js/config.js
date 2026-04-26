export const LS_KEY = 'drug-lab-v1';

export const GROW_TIME_BASE = 18;
export const TRIM_TIME = 8;
export const CHEM_TIME = 12;
export const PLAYER_SPEED_BASE = 3.5;
export const ZOOM_MIN = 6;
export const ZOOM_MAX = 22;
export const DEALER_COLORS = [0x1a1a1a, 0x2a1a1a, 0x1a2a22, 0x221a2a, 0x1a1a2a];
export const ACT_LABELS = {1:'ACT I — THE GARAGE', 2:'ACT II — THE RISE', 3:'ACT III — THE EMPIRE'};

export const state = {
  cash: 50,
  totalEarned: 0,
  totalSold: 0,
  heat: 0,
  upgrades: {},
  ownedRooms: ['garage'],
  trimmers: 0,
  lookouts: 0,
  runners: 0,
  cooks: 0,
  batches: 0,
  sessionStart: Date.now(),
};

// Mutable gameplay globals — object so any module can mutate fields directly
export const G = {
  stashCount: 0,
  trimProgress: 0,
  trimQueue: 0,
  trimBags: 0,
  chemProgress: 0,
  chemQueue: 0,
  chemProduct: 0,
  activeEvent: null,
  eventCooldown: 60,
  raidActive: false,
  raidTimer: 0,
  dealerSpawnTimer: 0,
};

export const UPG = [
  {id:'lights1',   name:'Better Grow Lights',   icon:'💡', cat:'Grow Op',        maxLv:3, base:120,  mult:2.2, desc:'Plants grow 30% faster per level'},
  {id:'yield1',    name:'Bigger Yield',          icon:'🌿', cat:'Grow Op',        maxLv:4, base:200,  mult:2.0, desc:'+20% product per harvest per level'},
  {id:'potsize',   name:'Larger Pots',           icon:'🪴', cat:'Grow Op',        maxLv:2, base:350,  mult:2.5, desc:'Double the plant capacity'},
  {id:'trim',      name:'Electric Trimmer',      icon:'✂️', cat:'Processing',     maxLv:3, base:180,  mult:2.0, desc:'Trim 25% faster per level'},
  {id:'bags',      name:'Vac-Seal Bags',         icon:'📦', cat:'Processing',     maxLv:3, base:250,  mult:2.0, desc:'+15% sale price per level'},
  {id:'network',   name:'Distribution Network',  icon:'🚗', cat:'Sales',          maxLv:4, base:400,  mult:1.8, desc:'Buyers arrive 30% faster per level'},
  {id:'price',     name:'Premium Product',       icon:'💎', cat:'Sales',          maxLv:3, base:500,  mult:2.2, desc:'+40% sale price per level'},
  {id:'lookout_sys',name:'Lookout System',       icon:'📡', cat:'Security',       maxLv:3, base:300,  mult:2.0, desc:'Heat builds 20% slower per level'},
  {id:'cleanup',   name:'Clean Operation',       icon:'🧹', cat:'Security',       maxLv:2, base:600,  mult:2.5, desc:'Heat drains 25% faster per level'},
  {id:'chemistry', name:'Chemistry Equipment',   icon:'⚗️', cat:'The Next Level', maxLv:1, base:2500, mult:1.0, desc:'Unlock the cook station — harder product, way more $'},
];

export const ROOM_DEFS = [
  {id:'garage',    gx: 0, gz: 0, cost:     0, label:'🏠 The Garage',    act:1},
  {id:'growroom',  gx: 1, gz: 0, cost:   600, label:'🌿 Grow Room',     act:1},
  {id:'basement',  gx: 0, gz: 1, cost:  2000, label:'🔒 The Basement',  act:2},
  {id:'security',  gx:-1, gz: 0, cost:  4000, label:'👁️ Security Post', act:2},
  {id:'lab',       gx: 0, gz:-1, cost: 12000, label:'⚗️ The Lab',       act:3},
  {id:'warehouse', gx: 1, gz: 1, cost:  8000, label:'📦 Warehouse',     act:2},
  {id:'front',     gx:-1, gz: 1, cost: 20000, label:'💈 Laundry Front', act:3},
  {id:'penthouse', gx: 1, gz:-1, cost: 50000, label:'👑 Penthouse',     act:3},
];

export const PALETTE = {
  garage:    {floor:0x2a2a22, wall:0x3a3530},
  growroom:  {floor:0x1a2a1a, wall:0x243824},
  basement:  {floor:0x1e1e24, wall:0x2a2a30},
  security:  {floor:0x1e1e1e, wall:0x282828},
  lab:       {floor:0x1a2420, wall:0x203028},
  warehouse: {floor:0x242420, wall:0x302e28},
  front:     {floor:0x282418, wall:0x383020},
  penthouse: {floor:0x181820, wall:0x242230},
};

export function upgLv(id) { return state.upgrades[id] || 0; }

export function currentAct() {
  if (state.totalEarned >= 15000) return 3;
  if (state.totalEarned >= 2000)  return 2;
  return 1;
}

export function fmtCash(n) {
  if (n >= 1e6) return (n/1e6).toFixed(1)+'M';
  if (n >= 1e3) return (n/1e3).toFixed(1)+'k';
  return Math.floor(n).toString();
}

export function salePrice(hasChemStation) {
  const base = 25;
  const purity = 1 + upgLv('bags')*0.15 + upgLv('price')*0.4;
  const chemiBonus = hasChemStation ? 1.8 : 1;
  return Math.floor(base * purity * chemiBonus);
}

export function heatGainPerSale() { return Math.max(1, 6 - upgLv('lookout_sys')*1.5); }
export function heatDrainPerSec() { return 0.3 + state.lookouts * 0.4 + upgLv('cleanup')*0.5; }
export function growTime()        { return GROW_TIME_BASE / (1 + upgLv('lights1') * 0.3); }
export function yieldCount()      { return 1 + Math.floor(upgLv('yield1') * 0.4); }
export function dealerArrivalTime(){ return 25 / (1 + upgLv('network')*0.3); }
export function playerSpeed()     { return PLAYER_SPEED_BASE * (1 + upgLv('lights1')*0.05); }
export function upgCost(u)        { return Math.floor(u.base * Math.pow(u.mult, upgLv(u.id))); }
export function now()             { return performance.now()/1000; }
