// Small card thumbnails and role icons. Thumbnails are the map sprites,
// scaled into a card. Icons are the same palette at a size that stays
// readable on a button.
//
//   go-card-front | stash | lab | distribution | warehouse | safehouse | hq
//   go-card-plantation | go-card-coffee_estate | go-card-highland_farm
//   go-icon-… with the same suffixes
//
// Aliases: launder → front, coffee → coffee_estate, highland → highland_farm.

import { canvas } from './kit.js';
import { renderStructure } from './buildings.js';

export const CARD_KIND = {
  front: 'laundromat',
  launder: 'laundromat',
  stash: 'stash',
  lab: 'chem_lab',
  distribution: 'transport_depot',
  warehouse: 'warehouse',
  safehouse: 'farmhouse',
  hq: 'hq',
  plantation: 'plantation',
  coffee: 'coffee_estate',
  coffee_estate: 'coffee_estate',
  highland: 'highland_farm',
  highland_farm: 'highland_farm'
};

export const CARD_IDS = [
  'front',
  'stash',
  'lab',
  'distribution',
  'warehouse',
  'safehouse',
  'hq',
  'plantation',
  'coffee_estate',
  'highland_farm'
];

function round(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function renderCard(id) {
  const kind = CARD_KIND[id] || 'warehouse';
  const src = renderStructure(kind, 'held', false, 1);
  const c = canvas(176, 120);
  const g = c.getContext('2d');
  g.fillStyle = '#1c241c';
  round(g, 2, 2, 172, 116, 10);
  g.fill();
  g.save();
  round(g, 8, 8, 160, 104, 8);
  g.clip();
  g.fillStyle = '#6f8f46';
  g.fillRect(8, 8, 160, 104);
  g.drawImage(src, 24, 18, 252, 168, 8, 4, 160, 112);
  g.restore();
  g.strokeStyle = '#c9aa84';
  g.lineWidth = 2;
  round(g, 8, 8, 160, 104, 8);
  g.stroke();
  return c;
}

function tile(g) {
  g.fillStyle = '#1c241c';
  round(g, 2, 2, 60, 60, 12);
  g.fill();
  g.strokeStyle = '#c9aa84';
  g.lineWidth = 2;
  round(g, 2, 2, 60, 60, 12);
  g.stroke();
}

function iconFront(g) {
  g.fillStyle = '#f4e2c6';
  g.fillRect(14, 28, 36, 22);
  g.fillStyle = '#c25038';
  g.fillRect(12, 22, 40, 8);
  g.fillStyle = '#8ec4d4';
  g.fillRect(18, 32, 8, 8);
  g.fillRect(30, 32, 8, 8);
  g.fillStyle = '#4e3018';
  g.fillRect(40, 36, 6, 14);
}

function iconStash(g) {
  g.fillStyle = '#c4965a';
  g.fillRect(16, 22, 32, 26);
  g.fillStyle = '#e2c48a';
  g.fillRect(16, 22, 32, 6);
  g.strokeStyle = '#6b4428';
  g.strokeRect(16, 22, 32, 26);
  g.fillStyle = '#1c2838';
  g.beginPath();
  g.arc(32, 36, 4, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#e6c35a';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(32, 34, 4, Math.PI, 0);
  g.stroke();
}

function iconLab(g) {
  g.fillStyle = '#d7dde4';
  g.beginPath();
  g.moveTo(24, 16);
  g.lineTo(28, 30);
  g.lineTo(18, 48);
  g.lineTo(46, 48);
  g.lineTo(36, 30);
  g.lineTo(40, 16);
  g.closePath();
  g.fill();
  g.fillStyle = '#3ee0ff';
  g.fillRect(20, 36, 24, 12);
  g.strokeStyle = '#1c2838';
  g.stroke();
}

function iconDistribution(g) {
  g.fillStyle = '#e6b84a';
  g.fillRect(10, 28, 28, 16);
  g.fillStyle = '#f4f7fb';
  g.fillRect(36, 30, 16, 14);
  g.fillStyle = '#8ec4d4';
  g.fillRect(40, 33, 8, 6);
  g.fillStyle = '#1c140e';
  g.beginPath();
  g.arc(20, 46, 4, 0, Math.PI * 2);
  g.arc(42, 46, 4, 0, Math.PI * 2);
  g.fill();
}

function iconWarehouse(g) {
  g.fillStyle = '#e4dccb';
  g.fillRect(12, 20, 40, 30);
  g.fillStyle = '#5c656e';
  g.fillRect(10, 16, 44, 8);
  g.fillStyle = '#2e3844';
  g.fillRect(26, 30, 14, 20);
  g.strokeStyle = 'rgba(36,23,15,0.4)';
  g.strokeRect(12, 20, 40, 30);
}

function iconSafehouse(g) {
  g.fillStyle = '#c25038';
  g.beginPath();
  g.moveTo(10, 30);
  g.lineTo(32, 14);
  g.lineTo(54, 30);
  g.closePath();
  g.fill();
  g.fillStyle = '#f4e2c6';
  g.fillRect(16, 30, 32, 20);
  g.fillStyle = '#243044';
  g.fillRect(20, 34, 8, 8);
  g.fillRect(36, 34, 8, 8);
  g.fillStyle = '#6b4428';
  g.fillRect(28, 38, 8, 12);
}

function iconHq(g) {
  g.fillStyle = '#39546e';
  g.fillRect(14, 18, 36, 32);
  g.fillStyle = '#e7e2d6';
  g.fillRect(18, 28, 6, 22);
  g.fillRect(28, 28, 6, 22);
  g.fillRect(40, 28, 6, 22);
  g.fillStyle = '#c4553a';
  g.fillRect(30, 12, 2, 10);
  g.fillRect(32, 14, 8, 5);
}

function iconPlantation(g) {
  g.fillStyle = '#5a3b24';
  g.fillRect(12, 40, 40, 6);
  g.fillRect(12, 30, 40, 6);
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i % 2 ? '#67a04a' : '#2f6b34';
    g.beginPath();
    g.ellipse(18 + i * 10, 28, 5, 4, 0, 0, Math.PI * 2);
    g.ellipse(18 + i * 10, 38, 5, 4, 0, 0, Math.PI * 2);
    g.fill();
  }
}

function iconCoffee(g) {
  g.fillStyle = '#2f6b34';
  g.beginPath();
  g.arc(32, 34, 14, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#c4553a';
  g.beginPath();
  g.arc(26, 32, 2.2, 0, Math.PI * 2);
  g.arc(36, 30, 2.2, 0, Math.PI * 2);
  g.arc(32, 40, 2.2, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#6b4428';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(32, 48);
  g.lineTo(32, 54);
  g.stroke();
}

function iconHighland(g) {
  const bands = ['#4e6a34', '#6d8a48', '#87a45a'];
  for (let i = 0; i < 3; i++) {
    g.fillStyle = '#9a8b72';
    g.fillRect(14 + i * 4, 18 + i * 12, 36 - i * 6, 10);
    g.fillStyle = bands[i];
    g.fillRect(16 + i * 4, 16 + i * 12, 32 - i * 6, 6);
  }
}

const ICONS = {
  front: iconFront,
  launder: iconFront,
  stash: iconStash,
  lab: iconLab,
  distribution: iconDistribution,
  warehouse: iconWarehouse,
  safehouse: iconSafehouse,
  hq: iconHq,
  plantation: iconPlantation,
  coffee: iconCoffee,
  coffee_estate: iconCoffee,
  highland: iconHighland,
  highland_farm: iconHighland
};

export function renderIcon(id) {
  const draw = ICONS[id] || iconWarehouse;
  const c = canvas(64, 64);
  const g = c.getContext('2d');
  tile(g);
  draw(g);
  return c;
}
