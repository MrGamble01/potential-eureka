// Lot sprites for San Verde. Each kind is a 3/4 building on a 300×200 canvas.
// Sale lots keep the old structure, a dull wash, and a small board.
// Owned lots add a role badge, a guard, and a van. Demolition is dust, then
// a cleared pad. Construction is a scaffold frame over a new foundation.

import * as K from './kit.js';

export const LOT_PRESET = {
  slot_rp_south: 'farmhouse',
  slot_rp_town1: 'gas_station',
  slot_sm_west: 'warehouse_lg',
  slot_sm_plaza: 'nightclub',
  slot_sm_hub: 'warehouse_md',
  slot_sm_bank: 'office_tower',
  slot_sm_port: 'river_dock',
  slot_sa_town: 'hacienda',
  slot_sa_airstrip: 'abandoned_strip'
};

const CREAM = '#f4e2c6';
const SIDE = '#c9aa84';
const TERRA = '#c25038';
const TERRA_D = '#8a3224';
const WOOD = '#6b4428';
const WOOD_L = '#c4a06a';
const STUCCO = '#f7efe2';

const BADGE = {
  plantation: '#3d8a46',
  coffee_estate: '#c4553a',
  highland_farm: '#67a04a',
  drying_barn: '#c47a3a',
  packaging_mill: '#c47a3a',
  chem_lab: '#3aa0b8',
  warehouse: '#3d6ea8',
  warehouse_sm: '#3d6ea8',
  warehouse_md: '#3d6ea8',
  warehouse_lg: '#3d6ea8',
  transport_depot: '#3d6ea8',
  river_pier: '#1c6e86',
  river_dock: '#1c6e86',
  aerodrome: '#3d6ea8',
  abandoned_strip: '#8a7560',
  taxi_co: '#e0b43a',
  salsa_club: '#ff4fbf',
  nightclub: '#ff4fbf',
  banco_regional: '#e0b43a',
  office_tower: '#3ee0ff',
  rival: '#c4553a',
  casino: '#e0b43a',
  mansion: '#ff4fbf',
  laundromat: '#3ee0ff',
  diner: '#c4553a',
  motel: '#ff4fbf',
  pawn: '#e0b43a',
  gas_station: '#c4553a',
  farmhouse: '#8a6238',
  hacienda: '#c25038',
  sawmill: '#6b4428',
  car_lot: '#3ee0ff',
  apartments: '#f7c9d4',
  town_house: '#c25038',
  terrace: '#67a04a'
};

const VAN = {
  taxi_co: '#f0c43a',
  plantation: '#2f6b34',
  coffee_estate: '#6b4428',
  salsa_club: '#2a2038',
  nightclub: '#2a2038',
  gas_station: '#c4553a',
  diner: '#f4f7fb',
  casino: '#1c140e',
  mansion: '#f7f4ee',
  banco_regional: '#1c2838',
  chem_lab: '#d7dde4'
};

const NO_VAN = new Set(['rival', 'river_pier', 'river_dock', 'aerodrome', 'abandoned_strip', 'terrace']);

function glass(g, x, y, n, ctx) {
  const night = !!(ctx.owned && ctx.night);
  const lit = !!(ctx.owned && (ctx.night || ctx.level >= 2));
  K.wins(g, x, y, n, night, lit);
  if (!ctx.sale) return;
  g.fillStyle = 'rgba(36,32,28,0.28)';
  for (let i = 0; i < n; i++) g.fillRect(x + i * 16, y, 9, 11);
  g.strokeStyle = WOOD;
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + 9, y + 11);
  g.moveTo(x + 9, y);
  g.lineTo(x, y + 11);
  g.stroke();
}

function gear(g, x, y, ctx) {
  if (!ctx.owned || ctx.level < 2) return;
  K.box(g, x, y, 18, 12, 11, '#d5dde4', '#8a939c', '#f4f7fa');
  g.fillStyle = ctx.night ? '#ffd27a' : '#8ec4d4';
  g.fillRect(x + 4, y - 8, 6, 5);
}

function awning(g, x, y, w, color) {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + w, y);
  g.lineTo(x + w - 3, y + 9);
  g.lineTo(x + 3, y + 9);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(36,23,15,0.35)';
  g.lineWidth = 1;
  for (let i = 8; i < w; i += 8) {
    g.beginPath();
    g.moveTo(x + i, y);
    g.lineTo(x + i - 1, y + 9);
    g.stroke();
  }
}

function sign(g, x, y, text, bg, fg = '#fff8ea') {
  g.font = '700 11px sans-serif';
  const w = Math.ceil(g.measureText(text).width + 10);
  g.fillStyle = bg;
  g.fillRect(x, y - 11, w, 15);
  g.strokeStyle = 'rgba(36,23,15,0.45)';
  g.strokeRect(x, y - 11, w, 15);
  g.fillStyle = fg;
  g.fillText(text, x + 5, y);
}

function chimney(g, x, y) {
  g.fillStyle = '#6e3458';
  g.fillRect(x, y - 16, 8, 16);
  g.fillStyle = '#4a2438';
  g.fillRect(x - 1, y - 19, 10, 4);
  g.fillStyle = 'rgba(230,226,220,0.75)';
  g.beginPath();
  g.arc(x + 8, y - 26, 5, 0, Math.PI * 2);
  g.arc(x + 14, y - 30, 3.5, 0, Math.PI * 2);
  g.fill();
}

function cropRows(g, x, y, rows, cols, leaf, fruit) {
  for (let r = 0; r < rows; r++) {
    const ry = y + r * 11;
    g.fillStyle = '#5a3b24';
    g.fillRect(x, ry, cols * 12, 8);
    for (let c = 0; c < cols; c++) {
      g.fillStyle = (c + r) % 2 ? leaf : '#2f6b34';
      g.beginPath();
      g.ellipse(x + 6 + c * 12, ry + 1, 5, 3.4, 0, 0, Math.PI * 2);
      g.fill();
      if (!fruit) continue;
      g.fillStyle = fruit;
      g.beginPath();
      g.arc(x + 7 + c * 12, ry, 1.4, 0, Math.PI * 2);
      g.fill();
    }
  }
}

function fence(g, x, y, posts) {
  g.strokeStyle = WOOD;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x, y - 11);
  g.lineTo(x + posts * 12, y - 11);
  g.moveTo(x, y - 5);
  g.lineTo(x + posts * 12, y - 5);
  g.stroke();
  g.fillStyle = WOOD_L;
  for (let i = 0; i <= posts; i++) g.fillRect(x + i * 12 - 1, y - 15, 3, 15);
}

function miniCar(g, x, y, color) {
  K.shadow(g, x + 14, y + 2, 16);
  K.box(g, x, y, 28, 14, 10, color, '#1a2430', '#e7eef4');
  g.fillStyle = '#8ec4d4';
  g.fillRect(x + 15, y - 8, 8, 5);
  g.fillStyle = '#1c140e';
  g.beginPath();
  g.arc(x + 6, y, 2.4, 0, Math.PI * 2);
  g.arc(x + 20, y, 2.4, 0, Math.PI * 2);
  g.fill();
}

function bulbs(g, x, y, n, ctx) {
  for (let i = 0; i < n; i++) {
    const pink = i % 2 === 0;
    const on = ctx.night || ctx.owned;
    if (ctx.night) {
      g.fillStyle = pink ? 'rgba(255,79,191,0.32)' : 'rgba(62,224,255,0.32)';
      g.beginPath();
      g.arc(x + i * 11, y, on ? 8 : 4, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = on ? (pink ? '#ff4fbf' : '#3ee0ff') : '#5c4e58';
    g.beginPath();
    g.arc(x + i * 11, y, 2.7, 0, Math.PI * 2);
    g.fill();
  }
}

function inlet(g, y = 170) {
  g.fillStyle = '#1c6e86';
  g.beginPath();
  g.ellipse(168, y, 118, 26, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(186,230,236,0.4)';
  g.beginPath();
  g.ellipse(150, y - 6, 46, 7, 0, 0, Math.PI * 2);
  g.fill();
}

function warehouseBody(g, ctx, opt) {
  const w = opt.w;
  const h = opt.h;
  const x = opt.x;
  const y = opt.y;
  const face = opt.old ? '#b7a48a' : '#e4dccb';
  const side = opt.old ? '#8a7560' : '#b3a894';
  const roof = opt.old ? '#6a5a4e' : '#5c656e';
  K.box(g, x, y, w, opt.d || 46, h, face, side, roof);
  g.strokeStyle = 'rgba(50,36,24,0.22)';
  g.lineWidth = 1;
  for (let i = 8; i < w - 4; i += 8) {
    g.beginPath();
    g.moveTo(x + i, y - 2);
    g.lineTo(x + i, y - h + 4);
    g.stroke();
  }
  g.fillStyle = opt.old ? '#3a342c' : '#2e3844';
  g.fillRect(x + 14, y - 30, 28, 30);
  g.strokeStyle = K.INK;
  g.strokeRect(x + 14, y - 30, 28, 30);
  if (opt.doors === 2) {
    g.fillStyle = opt.old ? '#4a4038' : '#3a4450';
    g.fillRect(x + w - 46, y - 32, 28, 32);
    g.strokeRect(x + w - 46, y - 32, 28, 32);
  }
  glass(g, x + w - 42, y - h + 14, 2, ctx);
  if (opt.old) {
    g.fillStyle = '#8a3224';
    g.fillRect(x + 6, y - h + 8, 22, 9);
    g.fillStyle = '#6e5a3a';
    g.fillRect(x + w - 30, y - 18, 16, 10);
  } else {
    g.fillStyle = '#3d6ea8';
    g.fillRect(x + 8, y - h + 6, w - 16, 4);
  }
  K.crate(g, x + w + 8, y, opt.old ? 0.8 : 1);
  K.barrel(g, x - 6, y);
  if (opt.old) K.weeds(g, x + 8, y + 2);
  gear(g, x + w - 36, y - h, ctx);
}

const PAINTERS = {
  plantation(g, ctx) {
    cropRows(g, 28, 118, 4, 8, '#67a04a', null);
    fence(g, 24, 162, 8);
    K.box(g, 168, 156, 62, 36, 40, CREAM, SIDE, TERRA);
    K.gable(g, 168, 156, 62, 36, 40, 16, TERRA, TERRA_D);
    glass(g, 180, 128, 2, ctx);
    K.door(g, 208, 156, 14, 22);
    chimney(g, 214, 100);
    K.crate(g, 146, 160, 0.7);
    gear(g, 196, 108, ctx);
  },

  coffee_estate(g, ctx) {
    cropRows(g, 26, 124, 3, 7, '#2f6b34', '#c4553a');
    g.fillStyle = '#e7d3b0';
    g.fillRect(118, 132, 46, 28);
    g.strokeStyle = K.INK;
    g.strokeRect(118, 132, 46, 28);
    K.box(g, 164, 158, 78, 40, 44, STUCCO, SIDE, TERRA);
    glass(g, 176, 126, 3, ctx);
    K.door(g, 214, 158, 14, 24, '#4e3018');
    chimney(g, 210, 104);
    sign(g, 168, 108, 'CAFE', TERRA);
    gear(g, 200, 112, ctx);
  },

  highland_farm(g, ctx) {
    const bands = ['#6d8a48', '#5e7c3c', '#7fa15a', '#4e6a34'];
    for (let i = 0; i < 4; i++) {
      g.fillStyle = '#8a7a62';
      g.fillRect(36 + i * 8, 112 + i * 14, 150 - i * 10, 12);
      g.fillStyle = bands[i];
      g.fillRect(40 + i * 8, 108 + i * 14, 142 - i * 10, 8);
      for (let c = 0; c < 8 - i; c++) {
        g.fillStyle = c % 2 ? '#67a04a' : '#2f6b34';
        g.beginPath();
        g.ellipse(52 + i * 8 + c * 14, 112 + i * 14, 5, 3, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    K.box(g, 188, 158, 52, 30, 34, '#d9cbb4', '#b7a48a', '#8a7560');
    glass(g, 198, 136, 2, ctx);
    K.door(g, 220, 158, 12, 20);
    gear(g, 200, 122, ctx);
  },

  drying_barn(g, ctx) {
    K.walls(g, 46, 160, 150, 48, 48, WOOD_L, '#8a6238');
    K.gable(g, 46, 160, 150, 48, 48, 26, TERRA, TERRA_D);
    g.strokeStyle = 'rgba(70,40,20,0.28)';
    for (let y = 122; y < 158; y += 7) {
      g.beginPath();
      g.moveTo(50, y);
      g.lineTo(192, y);
      g.stroke();
    }
    g.fillStyle = '#3a342c';
    g.fillRect(96, 128, 22, 32);
    glass(g, 64, 126, 2, ctx);
    glass(g, 150, 126, 1, ctx);
    g.fillStyle = '#67a04a';
    for (let i = 0; i < 4; i++) g.fillRect(58 + i * 10, 118, 6, 10);
    K.barrel(g, 214, 160);
    K.barrel(g, 232, 162);
    chimney(g, 78, 96);
    gear(g, 150, 100, ctx);
  },

  packaging_mill(g, ctx) {
    K.box(g, 58, 160, 120, 50, 50, '#e7dcc8', '#b7a48a', '#7d4e38');
    glass(g, 74, 124, 3, ctx);
    K.door(g, 140, 160, 22, 28, '#3a342c');
    chimney(g, 86, 108);
    K.box(g, 186, 160, 40, 28, 28, CREAM, SIDE, TERRA);
    sign(g, 64, 104, 'ROAST', '#7d4e38');
    K.crate(g, 196, 168, 0.8, '#e2c48a');
    K.crate(g, 214, 166, 0.65);
    gear(g, 130, 108, ctx);
  },

  chem_lab(g, ctx) {
    K.box(g, 70, 158, 112, 48, 48, '#d9d5cc', '#a8a498', '#3b6973');
    glass(g, 86, 122, 4, ctx);
    K.door(g, 154, 158, 16, 26, '#245058');
    g.fillStyle = '#1c6e86';
    g.fillRect(78, 108, 70, 5);
    K.box(g, 40, 156, 22, 16, 28, '#d7dde4', '#8aa0a8', '#c5d4dc');
    K.box(g, 196, 156, 26, 18, 34, '#b7d4c8', '#6a9088', '#d5ece4');
    g.strokeStyle = '#c4553a';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(48, 132);
    g.lineTo(70, 132);
    g.lineTo(70, 120);
    g.stroke();
    g.fillStyle = '#e6c35a';
    g.fillRect(92, 112, 10, 8);
    sign(g, 118, 100, 'LAB', '#245058');
    gear(g, 150, 108, ctx);
  },

  warehouse(g, ctx) {
    warehouseBody(g, ctx, { x: 58, y: 160, w: 128, h: 54, old: false, doors: 2 });
  },
  warehouse_sm(g, ctx) {
    warehouseBody(g, ctx, { x: 78, y: 158, w: 92, h: 40, old: true, doors: 1, d: 36 });
  },
  warehouse_md(g, ctx) {
    warehouseBody(g, ctx, { x: 60, y: 160, w: 124, h: 50, old: true, doors: 1 });
  },
  warehouse_lg(g, ctx) {
    warehouseBody(g, ctx, { x: 40, y: 162, w: 156, h: 62, old: true, doors: 2, d: 52 });
  },

  transport_depot(g, ctx) {
    K.box(g, 40, 156, 168, 46, 42, '#d9d3c4', '#a39888', '#4b5663');
    for (let i = 0; i < 3; i++) {
      g.fillStyle = i === 1 ? '#2a3440' : '#3a4450';
      g.fillRect(56 + i * 46, 124, 32, 32);
      g.strokeStyle = K.INK;
      g.strokeRect(56 + i * 46, 124, 32, 32);
      g.fillStyle = '#e6c35a';
      g.fillRect(58 + i * 46, 122, 28, 3);
    }
    glass(g, 168, 112, 1, ctx);
    miniCar(g, 196, 162, '#c47a4a');
    sign(g, 48, 100, 'DEPOT', '#2a3440');
    gear(g, 150, 112, ctx);
  },

  river_pier(g, ctx) {
    inlet(g, 168);
    g.fillStyle = '#a67c52';
    for (let i = 0; i < 7; i++) g.fillRect(96, 118 + i * 7, 92, 5);
    g.fillStyle = WOOD;
    g.fillRect(100, 112, 5, 56);
    g.fillRect(176, 112, 5, 56);
    K.box(g, 48, 140, 52, 30, 32, CREAM, SIDE, '#3b5866');
    glass(g, 58, 118, 2, ctx);
    K.door(g, 82, 140, 12, 18);
    K.crate(g, 128, 132, 0.7);
    g.fillStyle = '#e8eef4';
    g.beginPath();
    g.ellipse(210, 156, 22, 8, 0.2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#2a3440';
    g.fillRect(200, 146, 16, 8);
    gear(g, 70, 106, ctx);
  },

  river_dock(g, ctx) {
    inlet(g, 170);
    g.fillStyle = '#8a7560';
    for (let i = 0; i < 6; i++) {
      if (i === 3) continue;
      g.fillRect(110, 124 + i * 8, 86, 5);
    }
    g.save();
    g.translate(118, 150);
    g.rotate(-0.08);
    g.fillStyle = '#6b4428';
    g.fillRect(0, 0, 5, 40);
    g.restore();
    g.fillRect(186, 118, 5, 52);
    K.box(g, 42, 146, 58, 28, 30, '#b7a48a', '#8a7560', '#6a5a4e');
    g.fillStyle = '#8a3224';
    g.fillRect(50, 122, 18, 8);
    glass(g, 52, 126, 1, ctx);
    K.barrel(g, 112, 140);
    g.fillStyle = '#c4b496';
    g.beginPath();
    g.ellipse(214, 158, 20, 7, -0.3, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#d7c4a2';
    g.beginPath();
    g.moveTo(160, 136);
    g.quadraticCurveTo(190, 150, 200, 154);
    g.stroke();
    K.weeds(g, 70, 156);
  },

  aerodrome(g, ctx) {
    g.fillStyle = '#8d8374';
    g.fillRect(28, 150, 200, 14);
    g.fillStyle = '#f4f1ea';
    for (let i = 0; i < 6; i++) g.fillRect(40 + i * 28, 155, 12, 3);
    K.box(g, 48, 146, 92, 40, 40, '#e4dccb', '#b3a894', '#42525c');
    g.fillStyle = '#2a3440';
    g.beginPath();
    g.moveTo(70, 146);
    g.lineTo(118, 146);
    g.quadraticCurveTo(122, 120, 70, 146);
    g.fill();
    glass(g, 58, 118, 2, ctx);
    g.fillStyle = '#d5e4ee';
    g.fillRect(150, 142, 46, 8);
    g.fillRect(168, 132, 16, 18);
    g.fillStyle = '#8ec4d4';
    g.fillRect(172, 136, 8, 5);
    g.strokeStyle = '#c4553a';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(230, 120);
    g.lineTo(236, 108);
    g.stroke();
    g.fillStyle = '#f4f7fb';
    g.beginPath();
    g.moveTo(236, 108);
    g.lineTo(250, 112);
    g.lineTo(236, 116);
    g.fill();
    gear(g, 96, 104, ctx);
  },

  abandoned_strip(g, ctx) {
    g.fillStyle = '#7a7268';
    g.fillRect(24, 152, 210, 12);
    g.strokeStyle = 'rgba(40,32,24,0.45)';
    g.beginPath();
    g.moveTo(40, 154);
    g.lineTo(90, 162);
    g.moveTo(120, 156);
    g.lineTo(160, 150);
    g.stroke();
    K.weeds(g, 36, 164);
    K.weeds(g, 150, 166);
    K.box(g, 52, 150, 80, 34, 34, '#a89880', '#7a6a58', '#6a5344');
    g.fillStyle = '#8a3224';
    g.fillRect(64, 122, 26, 10);
    g.fillRect(96, 128, 8, 22);
    glass(g, 60, 124, 1, ctx);
    g.save();
    g.translate(176, 146);
    g.rotate(0.18);
    g.fillStyle = '#8a8478';
    g.fillRect(0, 0, 40, 7);
    g.fillRect(16, -8, 12, 14);
    g.restore();
    K.barrel(g, 150, 156);
  },

  taxi_co(g, ctx) {
    K.box(g, 40, 156, 92, 40, 44, CREAM, SIDE, '#c4a06a');
    awning(g, 48, 124, 70, '#f0c43a');
    glass(g, 56, 128, 3, ctx);
    K.door(g, 104, 156, 16, 24);
    g.fillStyle = '#1c140e';
    for (let i = 0; i < 8; i++) g.fillRect(50 + i * 8, 132, 4, 4);
    g.strokeStyle = '#5a5348';
    g.beginPath();
    g.moveTo(78, 112);
    g.lineTo(78, 92);
    g.stroke();
    g.fillStyle = '#c4553a';
    g.beginPath();
    g.arc(78, 90, 4, 0, Math.PI * 2);
    g.fill();
    miniCar(g, 150, 160, '#f0c43a');
    miniCar(g, 196, 164, '#f0c43a');
    sign(g, 46, 104, 'TAXI', '#1c2838', '#f0c43a');
    gear(g, 96, 110, ctx);
  },

  salsa_club(g, ctx) {
    K.box(g, 62, 158, 118, 48, 52, '#f2d2bf', '#d7b49a', '#7d3b5c');
    awning(g, 78, 118, 86, '#ff4fbf');
    glass(g, 84, 124, 3, ctx);
    K.door(g, 148, 158, 16, 26, '#2a1420');
    bulbs(g, 86, 108, 7, ctx);
    K.palm(g, 36, 162, 0.55);
    g.fillStyle = '#6b4428';
    g.fillRect(196, 150, 16, 3);
    g.fillRect(214, 154, 16, 3);
    sign(g, 90, 96, 'SALSA', '#7d3b5c');
    gear(g, 140, 104, ctx);
  },

  nightclub(g, ctx) {
    K.box(g, 78, 160, 108, 50, 68, '#2a2038', '#1a1428', '#3a2850');
    g.strokeStyle = ctx.night ? '#ff4fbf' : '#c45a98';
    g.lineWidth = 3;
    g.strokeRect(90, 104, 84, 48);
    g.strokeStyle = ctx.night ? '#3ee0ff' : '#6aa8b0';
    g.lineWidth = 2;
    g.strokeRect(102, 116, 60, 24);
    K.door(g, 122, 160, 18, 28, '#140e18');
    g.fillStyle = '#140e18';
    g.fillRect(96, 86, 72, 14);
    bulbs(g, 104, 93, 6, ctx);
    if (ctx.night) {
      g.fillStyle = 'rgba(255,79,191,0.18)';
      g.beginPath();
      g.ellipse(140, 130, 54, 28, 0, 0, Math.PI * 2);
      g.fill();
    }
    K.palm(g, 40, 164, 0.6);
    sign(g, 108, 78, 'NEON', '#ff4fbf', '#1a1424');
    gear(g, 150, 90, ctx);
  },

  banco_regional(g, ctx) {
    g.fillStyle = '#cbb892';
    g.fillRect(70, 154, 120, 10);
    K.box(g, 78, 154, 108, 46, 62, '#e7e2d6', '#b7b0a2', '#39546e');
    K.poly(g, [[78, 92], [132, 68], [186, 92]], '#39546e');
    for (let i = 0; i < 4; i++) {
      g.fillStyle = STUCCO;
      g.fillRect(90 + i * 22, 112, 6, 42);
      g.fillStyle = '#d9d0c0';
      g.fillRect(88 + i * 22, 108, 10, 5);
    }
    K.door(g, 124, 154, 18, 28, '#8a6d32');
    glass(g, 96, 96, 2, ctx);
    sign(g, 96, 80, 'BANCO', '#1c2838', '#e6c35a');
    gear(g, 150, 86, ctx);
  },

  office_tower(g, ctx) {
    const floors = ctx.owned && ctx.level >= 2 ? 8 : 7;
    const h = floors * 12;
    K.box(g, 104, 168, 78, 40, h, '#f7c9d4', '#d7a8b4', '#efe6ea');
    for (let i = 0; i < floors; i++) {
      const wy = 168 - 16 - i * 12;
      glass(g, 114, wy, 3, ctx);
      g.fillStyle = i % 2 ? 'rgba(62,224,255,0.45)' : 'rgba(255,79,191,0.28)';
      g.fillRect(104, wy + 10, 78, 3);
    }
    g.strokeStyle = '#d7dde4';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(156, 168 - h);
    g.lineTo(156, 168 - h - 18);
    g.stroke();
    g.fillStyle = '#c4553a';
    g.beginPath();
    g.arc(156, 168 - h - 18, 3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1c2838';
    g.fillRect(118, 156, 36, 12);
    sign(g, 112, 168 - h - 8, 'PLAZA', '#3ee0ff', '#1a1424');
  },

  laundromat(g, ctx) {
    K.box(g, 58, 158, 128, 44, 46, '#e7f4f2', '#b7ccc8', '#d5efe8');
    awning(g, 66, 122, 108, '#3ee0ff');
    glass(g, 74, 128, 4, ctx);
    K.door(g, 154, 158, 16, 24, '#245058');
    g.fillStyle = '#d7dde4';
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.arc(86 + i * 16, 142, 5, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#5a6a72';
      g.stroke();
    }
    sign(g, 78, 108, 'WASH', '#145e86');
    gear(g, 150, 110, ctx);
  },

  car_lot(g, ctx) {
    g.strokeStyle = WOOD;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(36, 96);
    g.lineTo(230, 112);
    g.stroke();
    bulbs(g, 48, 104, 12, ctx);
    miniCar(g, 40, 156, '#f7c9d4');
    miniCar(g, 96, 160, '#3ee0ff');
    miniCar(g, 154, 158, '#f0c43a');
    K.box(g, 206, 150, 40, 24, 32, '#e4dccb', '#b3a894', '#5c656e');
    glass(g, 214, 128, 1, ctx);
    K.door(g, 226, 150, 12, 18);
    sign(g, 40, 84, 'AUTOS', '#c4553a');
    gear(g, 214, 116, ctx);
  },

  motel(g, ctx) {
    K.box(g, 46, 160, 150, 42, 64, '#f7e7c4', '#d7c4a2', '#c45a6a');
    g.fillStyle = '#cbb892';
    g.fillRect(46, 124, 150, 5);
    g.strokeStyle = '#8a7560';
    g.beginPath();
    g.moveTo(46, 124);
    g.lineTo(196, 124);
    g.stroke();
    glass(g, 58, 136, 4, ctx);
    glass(g, 58, 100, 4, ctx);
    for (let i = 0; i < 4; i++) {
      K.door(g, 62 + i * 28, 160, 10, 16, '#6b4428');
    }
    g.fillStyle = '#1c6e86';
    g.beginPath();
    g.ellipse(230, 156, 22, 10, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(186,230,236,0.55)';
    g.beginPath();
    g.ellipse(226, 154, 10, 4, 0, 0, Math.PI * 2);
    g.fill();
    sign(g, 168, 86, ctx.owned ? 'NO VAC' : 'VACANCY', ctx.night ? '#ff4fbf' : '#7d3b5c');
    if (ctx.night) bulbs(g, 170, 96, 4, ctx);
    gear(g, 70, 94, ctx);
  },

  diner(g, ctx) {
    K.box(g, 40, 160, 156, 48, 40, '#f7f4ee', '#d9cfc2', '#f2f5f7');
    g.fillStyle = '#c4553a';
    g.fillRect(40, 136, 156, 6);
    g.fillStyle = '#d7dde4';
    g.fillRect(40, 154, 156, 4);
    glass(g, 52, 118, 5, ctx);
    K.door(g, 156, 160, 18, 26, '#8a3224');
    g.fillStyle = '#c4553a';
    g.beginPath();
    g.ellipse(118, 100, 34, 14, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff8ea';
    g.font = '700 12px sans-serif';
    g.fillText('DINER', 98, 104);
    g.strokeStyle = '#c4553a';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(118, 114);
    g.lineTo(118, 120);
    g.stroke();
    miniCar(g, 206, 164, '#9fd0c8');
    K.palm(g, 250, 166, 0.45);
    gear(g, 70, 118, ctx);
  },

  pawn(g, ctx) {
    K.box(g, 64, 158, 112, 42, 48, '#e7d8c0', '#c9b496', '#8a6d32');
    awning(g, 72, 120, 96, '#e0b43a');
    glass(g, 80, 128, 3, ctx);
    g.strokeStyle = '#1c140e';
    g.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(82 + i * 16, 128);
      g.lineTo(82 + i * 16, 139);
      g.moveTo(86 + i * 16, 128);
      g.lineTo(86 + i * 16, 139);
      g.stroke();
    }
    K.door(g, 146, 158, 16, 24, '#3a342c');
    g.fillStyle = '#e6c35a';
    g.beginPath();
    g.arc(118, 102, 8, 0, Math.PI * 2);
    g.arc(132, 102, 8, 0, Math.PI * 2);
    g.arc(125, 112, 8, 0, Math.PI * 2);
    g.fill();
    sign(g, 78, 92, 'PAWN', '#1c140e', '#e6c35a');
    K.crate(g, 196, 160, 0.6);
    gear(g, 150, 108, ctx);
  },

  apartments(g, ctx) {
    K.box(g, 70, 164, 120, 46, 86, '#d5efe8', '#b7ccc4', '#c9e6df');
    for (let floor = 0; floor < 4; floor++) {
      const wy = 150 - floor * 20;
      glass(g, 82, wy, 3, ctx);
      g.fillStyle = '#cbb892';
      g.fillRect(78, wy + 12, 70, 3);
      g.fillStyle = floor % 2 ? '#f7c9d4' : '#f0c43a';
      g.fillRect(154, wy + 2, 6, 5);
    }
    K.door(g, 118, 164, 16, 20, '#245058');
    g.fillStyle = '#8a939c';
    g.fillRect(168, 100, 8, 6);
    g.fillRect(168, 124, 8, 6);
    K.palm(g, 40, 166, 0.5);
    sign(g, 86, 70, 'FLATS', '#145e86');
    gear(g, 150, 76, ctx);
  },

  casino(g, ctx) {
    g.fillStyle = '#6b1d2a';
    g.fillRect(96, 150, 80, 14);
    for (let i = 0; i < 4; i++) {
      g.fillStyle = i % 2 ? '#e6c35a' : '#f7f1e4';
      g.fillRect(100 + i * 18, 146 - i * 3, 16, 6 + i * 3);
    }
    K.box(g, 70, 150, 130, 48, 58, '#f7e7c4', '#d7c4a2', '#7d3b5c');
    glass(g, 86, 112, 4, ctx);
    K.door(g, 126, 150, 20, 28, '#e6c35a');
    g.fillStyle = '#1a1424';
    g.fillRect(86, 84, 100, 16);
    bulbs(g, 96, 92, 8, ctx);
    g.fillStyle = '#fff8ea';
    g.fillRect(196, 118, 16, 16);
    g.fillStyle = '#1c140e';
    g.fillRect(200, 122, 3, 3);
    g.fillRect(206, 128, 3, 3);
    sign(g, 96, 76, 'CASINO', '#e6c35a', '#1a1424');
    K.palm(g, 36, 162, 0.55);
    gear(g, 160, 90, ctx);
  },

  mansion(g, ctx) {
    K.box(g, 78, 150, 120, 50, 52, '#f7f4ee', '#d9d3c6', '#f7c9d4');
    K.gable(g, 78, 150, 120, 50, 52, 22, '#f7c9d4', '#d7a0b0');
    for (let i = 0; i < 4; i++) {
      g.fillStyle = STUCCO;
      g.fillRect(96 + i * 22, 112, 6, 38);
    }
    glass(g, 92, 108, 2, ctx);
    glass(g, 150, 108, 2, ctx);
    K.door(g, 128, 150, 16, 26, '#6b4428');
    g.fillStyle = '#8a7560';
    g.fillRect(36, 140, 4, 22);
    g.fillRect(60, 140, 4, 22);
    g.fillRect(36, 140, 28, 3);
    g.fillStyle = '#1c6e86';
    g.beginPath();
    g.ellipse(230, 156, 26, 12, 0, 0, Math.PI * 2);
    g.fill();
    K.palm(g, 250, 150, 0.5);
    g.fillStyle = '#c4553a';
    g.beginPath();
    g.arc(70, 156, 3, 0, Math.PI * 2);
    g.arc(214, 156, 3, 0, Math.PI * 2);
    g.fill();
    gear(g, 150, 86, ctx);
  },

  gas_station(g, ctx) {
    K.box(g, 36, 158, 78, 40, 42, CREAM, SIDE, TERRA);
    glass(g, 48, 128, 2, ctx);
    K.door(g, 88, 158, 14, 22);
    sign(g, 44, 108, 'SHOP', TERRA);
    K.box(g, 124, 128, 108, 40, 8, '#e23b32', '#a61f18', '#ff6a58');
    g.fillStyle = '#f7f1e4';
    g.fillRect(140, 128, 4, 32);
    g.fillRect(204, 128, 4, 32);
    K.box(g, 156, 160, 14, 10, 20, '#f4e2c6', SIDE, '#3ee0ff');
    K.box(g, 186, 160, 14, 10, 20, '#f4e2c6', SIDE, '#ff4fbf');
    g.fillStyle = '#1c2838';
    g.fillRect(236, 96, 28, 40);
    g.fillStyle = '#f7f1e4';
    g.fillRect(248, 132, 4, 30);
    g.fillStyle = '#ffd27a';
    g.font = '700 10px sans-serif';
    g.fillText('GAS', 241, 114);
    g.font = '700 8px sans-serif';
    g.fillText('1.19', 240, 128);
    gear(g, 70, 114, ctx);
  },

  farmhouse(g, ctx) {
    fence(g, 28, 164, 6);
    K.walls(g, 78, 158, 110, 46, 42, '#e7d3b0', '#c9aa84');
    K.gable(g, 78, 158, 110, 46, 42, 22, '#8a5344', TERRA_D);
    g.fillStyle = '#cbb892';
    g.fillRect(96, 140, 40, 18);
    g.fillStyle = WOOD;
    g.fillRect(100, 146, 3, 14);
    g.fillRect(130, 146, 3, 14);
    glass(g, 92, 124, 2, ctx);
    glass(g, 150, 124, 1, ctx);
    K.door(g, 124, 158, 14, 22);
    chimney(g, 160, 100);
    g.fillStyle = '#f4f7fb';
    g.beginPath();
    g.ellipse(40, 160, 5, 4, 0, 0, Math.PI * 2);
    g.ellipse(52, 164, 4, 3, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#c4553a';
    g.beginPath();
    g.arc(40, 160, 1.2, 0, Math.PI * 2);
    g.fill();
    K.barrel(g, 210, 160);
    gear(g, 120, 104, ctx);
  },

  hacienda(g, ctx) {
    K.box(g, 86, 124, 108, 34, 34, CREAM, SIDE, TERRA);
    glass(g, 104, 100, 3, ctx);
    K.box(g, 58, 162, 40, 36, 44, STUCCO, SIDE, TERRA);
    K.box(g, 176, 162, 42, 30, 44, '#f7c9d4', '#d7a8b4', TERRA);
    glass(g, 66, 132, 1, ctx);
    glass(g, 186, 132, 1, ctx);
    g.fillStyle = '#e7c98a';
    g.beginPath();
    g.moveTo(98, 162);
    g.lineTo(176, 162);
    g.lineTo(160, 132);
    g.lineTo(112, 132);
    g.closePath();
    g.fill();
    g.fillStyle = '#1c6e86';
    g.beginPath();
    g.ellipse(138, 148, 12, 6, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#d7dde4';
    g.fillRect(136, 134, 4, 14);
    g.fillStyle = CREAM;
    g.fillRect(118, 146, 8, 16);
    g.fillRect(148, 146, 8, 16);
    g.fillStyle = TERRA;
    g.beginPath();
    g.arc(137, 146, 14, Math.PI, 0);
    g.fill();
    K.door(g, 128, 162, 14, 16, '#4e3018');
    chimney(g, 150, 90);
    gear(g, 120, 88, ctx);
  },

  sawmill(g, ctx) {
    K.box(g, 48, 156, 100, 42, 40, '#c4a06a', '#8a6238', '#6a5344');
    glass(g, 60, 128, 2, ctx);
    K.door(g, 112, 156, 18, 24, '#3a342c');
    g.fillStyle = '#6b4428';
    g.beginPath();
    g.ellipse(40, 150, 16, 8, 0, 0, Math.PI * 2);
    g.ellipse(36, 144, 14, 7, 0, 0, Math.PI * 2);
    g.ellipse(44, 140, 12, 6, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#d7dde4';
    g.beginPath();
    g.arc(176, 132, 16, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#8a939c';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(176, 132, 16, 0, Math.PI * 2);
    g.moveTo(176, 118);
    g.lineTo(176, 146);
    g.moveTo(162, 132);
    g.lineTo(190, 132);
    g.stroke();
    g.fillStyle = '#e6d3b0';
    g.fillRect(168, 146, 40, 6);
    K.crate(g, 210, 160, 0.8);
    sign(g, 56, 108, 'MILL', WOOD);
    gear(g, 100, 114, ctx);
  },

  rival(g, ctx) {
    K.box(g, 70, 158, 100, 46, 36, '#8a8074', '#5c564c', '#4a4038');
    K.box(g, 156, 150, 36, 28, 70, '#6a6258', '#3a342c', '#4a4038');
    glass(g, 164, 100, 1, ctx);
    g.fillStyle = '#c4553a';
    g.beginPath();
    g.moveTo(174, 80);
    g.lineTo(174, 64);
    g.lineTo(196, 72);
    g.lineTo(174, 78);
    g.fill();
    g.fillStyle = '#6b4428';
    for (let i = 0; i < 5; i++) {
      g.fillRect(40 + i * 16, 156, 14, 8);
      g.fillRect(44 + i * 16, 152, 14, 6);
    }
    g.strokeStyle = '#3a342c';
    g.lineWidth = 1.5;
    g.beginPath();
    for (let x = 36; x < 200; x += 10) {
      g.moveTo(x, 168);
      g.lineTo(x + 6, 160);
      g.lineTo(x + 12, 168);
    }
    g.stroke();
    g.fillStyle = ctx.night ? '#ffd27a' : '#e6c35a';
    g.beginPath();
    g.arc(168, 112, 3, 0, Math.PI * 2);
    g.fill();
    if (ctx.night) {
      g.fillStyle = 'rgba(255,210,122,0.2)';
      g.beginPath();
      g.moveTo(168, 112);
      g.lineTo(40, 170);
      g.lineTo(90, 176);
      g.fill();
    }
  },

  town_house(g, ctx) {
    const faces = [CREAM, '#f7c9d4', '#d5efe8'];
    const roofs = [TERRA, '#7d3b5c', '#3b6973'];
    for (let i = 0; i < 3; i++) {
      const x = 36 + i * 74;
      K.box(g, x, 160, 66, 32, 48, faces[i], SIDE, roofs[i]);
      glass(g, x + 10, 124, 2, ctx);
      K.door(g, x + 40, 160, 12, 22, WOOD);
      g.fillStyle = '#c4553a';
      g.fillRect(x + 18, 154, 4, 4);
    }
    K.palm(g, 250, 164, 0.45);
  },

  terrace(g, ctx) {
    const greens = ['#6d8a48', '#87a45a', '#4e6a34', '#7fa15a'];
    for (let i = 0; i < 4; i++) {
      g.fillStyle = '#9a8b72';
      g.beginPath();
      g.moveTo(40 + i * 14, 150 - i * 16);
      g.lineTo(230 - i * 18, 150 - i * 16);
      g.lineTo(210 - i * 18, 138 - i * 16);
      g.lineTo(56 + i * 14, 138 - i * 16);
      g.closePath();
      g.fill();
      g.fillStyle = greens[i];
      g.fillRect(52 + i * 14, 140 - i * 16, 150 - i * 28, 8);
    }
    K.box(g, 196, 112, 36, 22, 24, '#d9cbb4', '#b7a48a', TERRA);
    glass(g, 204, 96, 1, ctx);
    K.weeds(g, 48, 156);
  }
};

function paintKind(g, kind, ctx) {
  const fn = PAINTERS[kind] || PAINTERS.warehouse;
  fn(g, ctx);
}

export function renderStructure(kind, mode, night, level) {
  const c = K.canvas();
  const g = c.getContext('2d');
  const ctx = {
    sale: mode === 'sale',
    owned: mode === 'owned',
    night: !!night,
    level: Math.max(1, level || 1)
  };
  K.groundPad(g);
  paintKind(g, kind, ctx);
  if (ctx.sale) {
    K.weeds(g, 44, 176);
    K.weeds(g, 188, 178);
    K.saleSign(g, 236, 126);
    K.wash(g, true);
  } else if (ctx.owned) {
    if (!NO_VAN.has(kind)) K.van(g, 186, 160, VAN[kind] || '#243044');
    K.guard(g, 156, 158);
    K.badge(g, 18, 14, BADGE[kind] || '#c4553a');
  }
  return c;
}

export function renderScaffold(frame) {
  const c = K.canvas();
  const g = c.getContext('2d');
  K.groundPad(g);
  g.fillStyle = '#cbb892';
  g.beginPath();
  g.ellipse(146, 162, 78, 16, 0, 0, Math.PI * 2);
  g.fill();
  K.walls(g, 84, 160, 112, 40, 18, '#e7d3b0', '#c9aa84');
  const lift = frame ? 8 : 0;
  g.strokeStyle = '#d7dde4';
  g.lineWidth = 3;
  const poles = [72, 112, 156, 196, 228];
  for (const x of poles) {
    g.beginPath();
    g.moveTo(x, 170);
    g.lineTo(x + 6, 62);
    g.stroke();
  }
  g.strokeStyle = '#8a6238';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(72, 166);
  g.lineTo(220, 78 + lift);
  g.moveTo(220, 166);
  g.lineTo(78, 86 - lift);
  g.stroke();
  g.fillStyle = WOOD_L;
  g.fillRect(68, 118 - lift, 156, 6);
  g.fillRect(80, 86 + (frame ? 0 : 6), 120, 5);
  g.fillStyle = '#e24b3a';
  g.fillRect(150 + (frame ? 18 : 0), 70, 8, 8);
  g.strokeStyle = '#1c140e';
  g.beginPath();
  g.moveTo(154 + (frame ? 18 : 0), 70);
  g.lineTo(154, 52);
  g.stroke();
  K.guard(g, frame ? 168 : 120, 150);
  K.crate(g, 40, 164, 0.7);
  return c;
}

export function renderDust(frame) {
  const c = K.canvas();
  const g = c.getContext('2d');
  K.groundPad(g);
  g.fillStyle = '#8a7a68';
  const piles = 8 - frame;
  for (let i = 0; i < piles; i++) {
    g.fillRect(78 + ((i * 37) % 120), 150 - (i % 3) * 5 - frame, 12, 7);
  }
  g.fillStyle = TERRA_D;
  g.fillRect(96 + frame * 4, 146, 14, 6);
  g.fillRect(150 - frame * 3, 152, 10, 5);
  const alpha = 0.62 - frame * 0.1;
  const grow = 1 + frame * 0.28;
  const clouds = [[120, 118, 28], [160, 100, 36], [100, 96, 22], [186, 124, 30]];
  for (const [x, y, r] of clouds) {
    g.fillStyle = `rgba(176,156,128,${alpha})`;
    g.beginPath();
    g.ellipse(x + frame * 8, y - frame * 10, r * grow, r * 0.62 * grow, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = `rgba(90,70,48,${alpha * 0.55})`;
  g.beginPath();
  g.ellipse(150, 132 - frame * 6, 40 * grow, 16 * grow, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = WOOD;
  g.fillRect(130 + frame * 10, 78 - frame * 14, 8, 4);
  g.fillRect(96 - frame * 8, 88 - frame * 12, 6, 5);
  return c;
}

export function renderCleared(night) {
  const c = K.canvas();
  const g = c.getContext('2d');
  K.groundPad(g);
  g.fillStyle = night ? '#3a3228' : '#c4a36a';
  g.beginPath();
  g.ellipse(150, 150, 96, 28, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = night ? '#2a241c' : '#a68458';
  g.beginPath();
  g.ellipse(150, 154, 70, 16, 0.08, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(70,48,28,0.4)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(70, 156);
  g.quadraticCurveTo(140, 146, 220, 158);
  g.moveTo(78, 164);
  g.quadraticCurveTo(150, 154, 214, 166);
  g.stroke();
  g.fillStyle = TERRA_D;
  g.fillRect(96, 146, 12, 6);
  g.fillRect(110, 150, 8, 4);
  g.fillStyle = SIDE;
  g.fillRect(186, 144, 14, 6);
  g.fillStyle = '#f4f1ea';
  g.fillRect(64, 142, 3, 16);
  g.fillRect(228, 140, 3, 16);
  g.fillStyle = '#c4553a';
  g.fillRect(62, 140, 7, 5);
  g.fillRect(226, 138, 7, 5);
  K.weeds(g, 78, 160);
  K.weeds(g, 200, 166);
  if (night) {
    g.fillStyle = 'rgba(255,210,122,0.28)';
    g.beginPath();
    g.arc(214, 118, 16, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffd27a';
    g.fillRect(210, 112, 5, 8);
  }
  return c;
}
