// Ground and lot silhouettes outside the original valley art.
// Structures stay simple so a later art pass can replace them via drawKeyed.

import { LOT_POS, ZONE_LAYOUT } from './map-layout.js';

function box(g, x, y, w, h, fill, alpha) {
  g.fillStyle(fill, alpha == null ? 1 : alpha);
  g.fillRect(x, y, w, h);
}

function ellipse(g, x, y, w, h, fill, alpha) {
  g.fillStyle(fill, alpha == null ? 1 : alpha);
  g.fillEllipse(x, y, w, h);
}

export function drawExtended(g) {
  g.clear();
  const alta = ZONE_LAYOUT.jungle_alta;
  const delta = ZONE_LAYOUT.river_delta;
  const mesa = ZONE_LAYOUT.mesa_strip;
  box(g, 0, 1360, 6400, 1320, 0x243628);
  ellipse(g, alta.x + 400, alta.y + 420, 980, 720, 0x1e3d28);
  ellipse(g, alta.x + 780, alta.y + 300, 640, 480, 0x2c5434);
  ellipse(g, alta.x + 260, alta.y + 700, 420, 280, 0x3d6a3a, 0.85);
  for (let i = 0; i < 18; i++) {
    ellipse(g, alta.x + 80 + (i % 6) * 170, alta.y + 180 + Math.floor(i / 6) * 240, 90, 50, 0x14301c, 0.55);
  }

  box(g, delta.x, delta.y + 80, delta.w, delta.h - 80, 0x2a6e72, 0.55);
  ellipse(g, delta.x + 520, delta.y + 560, 900, 420, 0x1a5560, 0.8);
  box(g, delta.x + 80, delta.y + 200, delta.w - 160, 36, 0x6a5a3e);
  box(g, 1680, delta.y + 360, 28, 420, 0x8d7350);

  box(g, mesa.x, mesa.y + 40, mesa.w, mesa.h - 80, 0x6d6248);
  ellipse(g, mesa.x + 500, mesa.y + 280, 860, 360, 0x7d7054);
  box(g, mesa.x + 180, mesa.y + 620, 760, 28, 0x3e4650);
  box(g, mesa.x + 180, mesa.y + 600, 760, 6, 0xe7e1d4, 0.7);

  const cityX = 2860;
  box(g, cityX, 140, 3520, 1680, 0xc4b8a4);
  box(g, 5520, 140, 880, 1100, 0x1d6d8c);
  box(g, 5340, 200, 220, 980, 0xe4d2b0);
  ellipse(g, 5480, 700, 180, 900, 0x2f86a4, 0.45);
  box(g, 2920, 1000, 2480, 90, 0x2a6a78, 0.85);

  strokeGrid(g, ZONE_LAYOUT.ps_downtown, 150);
  g.lineStyle(8, 0x3a414c, 0.95);
  g.lineBetween(3100, 420, 3600, 420);
  g.lineBetween(3280, 260, 3280, 860);
  g.lineBetween(4880, 280, 4880, 960);
  box(g, 4700, 300, 22, 680, 0x4a4038);
  box(g, 3000, 1180, 980, 16, 0x8a8175);
  box(g, 3180, 1280, 18, 280, 0x6d6256);
  box(g, 3480, 1280, 18, 220, 0x6d6256);
  box(g, 4380, 1320, 920, 26, 0x2c343c);
  box(g, 4380, 1308, 920, 5, 0xf4f7fb, 0.75);
  box(g, 4700, 1260, 70, 150, 0xd9c6a3);

  ellipse(g, ZONE_LAYOUT.ps_hills.x + 480, ZONE_LAYOUT.ps_hills.y + 280, 980, 420, 0x3d5a34);
  ellipse(g, ZONE_LAYOUT.ps_hills.x + 200, ZONE_LAYOUT.ps_hills.y + 180, 360, 220, 0x4e6b3c);

  g.lineStyle(10, 0x5c5346, 0.9);
  g.beginPath();
  g.moveTo(900, 1280);
  g.lineTo(520, 1620);
  g.lineTo(900, 1760);
  g.lineTo(2000, 1760);
  g.lineTo(3300, 1760);
  g.strokePath();
  g.lineStyle(12, 0x3a414c, 1);
  g.beginPath();
  g.moveTo(2480, 500);
  g.lineTo(3100, 480);
  g.lineTo(4300, 460);
  g.lineTo(5200, 500);
  g.strokePath();

  fillerBlocks(g);
}

function strokeGrid(g, zone, step) {
  g.lineStyle(8, 0x3a414c, 0.95);
  for (let x = zone.x + 40; x < zone.x + zone.w - 20; x += step) {
    g.lineBetween(x, zone.y + 24, x, zone.y + zone.h - 24);
  }
  for (let y = zone.y + 36; y < zone.y + zone.h - 16; y += step) {
    g.lineBetween(zone.x + 16, y, zone.x + zone.w - 16, y);
  }
}

function fillerBlocks(g) {
  const specs = [
    [3080, 520, 46, 34, 0x8d7358],
    [3380, 560, 54, 40, 0xb9a48c],
    [3960, 560, 40, 64, 0x6e8eae],
    [4580, 280, 36, 70, 0x7f93a8],
    [5080, 280, 48, 28, 0xd27a62],
    [3040, 1500, 70, 36, 0x6a6258],
    [5600, 420, 30, 18, 0xf2efe6]
  ];
  for (const [x, y, w, h, color] of specs) {
    if (nearLot(x, y)) continue;
    box(g, x, y, w, h, color);
  }
}

function nearLot(x, y) {
  return Object.values(LOT_POS).some((lot) => Math.hypot(lot.x - x, lot.y - y) < 120);
}

export function paintOpen(g) {
  g.clear();
  g.lineStyle(2, 0x8ec5ff, 0.9);
  g.strokeEllipse(0, 8, 120, 64);
  g.lineStyle(2, 0x8ec5ff, 0.45);
  g.lineBetween(-36, 8, 36, 8);
  g.lineBetween(0, -16, 0, 32);
}

export function paintProperty(g, type) {
  g.clear();
  g.fillStyle(0x000000, 0.18);
  g.fillEllipse(0, 18, 120, 36);
  if (type === 'gas_station') return gas(g);
  if (type === 'diner') return diner(g);
  if (type === 'laundromat') return shop(g, 0x7f93a8, 0xd9c6a3);
  if (type === 'pawn') return shop(g, 0x8d5a44, 0xe7d3a1);
  if (type === 'apartments') return tower(g, 0xb7a48c, 0x6e6256, 78);
  if (type === 'warehouse_old') return shed(g, 0x6a6258, 120);
  if (type === 'fish_house') return shed(g, 0x3d6d78, 100);
  if (type === 'garage') return shop(g, 0x4a4038, 0xc4b8a4);
  if (type === 'office') return tower(g, 0x8aa4bc, 0xdfe7ef, 96);
  if (type === 'car_lot') return cars(g);
  if (type === 'bank') return tower(g, 0x39546e, 0xe7e1d4, 88);
  if (type === 'motel') return motel(g);
  if (type === 'nightclub') return club(g);
  if (type === 'casino') return tower(g, 0x6a4a78, 0xf2efe6, 70);
  if (type === 'hangar') return hangar(g);
  if (type === 'freight_shed') return shed(g, 0x5c5346, 110);
  if (type === 'villa') return villa(g);
  if (type === 'hacienda') return villa(g);
  if (type === 'farmhouse') return shop(g, 0x8d7358, 0xd7c4a2);
  if (type === 'sawmill') return shed(g, 0x6b4428, 118);
  if (type === 'river_dock') return dock(g);
  if (type === 'airstrip') return strip(g);
  return shop(g, 0x8d7358, 0xd7c4a2);
}

function shop(g, roof, wall) {
  g.fillStyle(wall, 1);
  g.fillRect(-40, -28, 80, 36);
  g.fillStyle(roof, 1);
  g.fillTriangle(-48, -28, 48, -28, 0, -58);
  g.fillStyle(0x243044, 1);
  g.fillRect(-8, -8, 16, 16);
}

function gas(g) {
  g.fillStyle(0xd9c6a3, 1);
  g.fillRect(-28, -22, 56, 28);
  g.fillStyle(0xc4553a, 1);
  g.fillRect(-46, -48, 92, 8);
  g.fillStyle(0x2a3440, 1);
  g.fillRect(-40, -40, 4, 22);
  g.fillRect(36, -40, 4, 22);
  g.fillRect(-22, 2, 14, 12);
  g.fillRect(8, 2, 14, 12);
}

function diner(g) {
  shop(g, 0xd27a62, 0xf2efe6);
  g.fillStyle(0x8ec5ff, 0.85);
  g.fillRect(-22, -22, 18, 10);
}

function shed(g, roof, w) {
  g.fillStyle(0xcbb692, 1);
  g.fillRect(-w / 2, -24, w, 40);
  g.fillStyle(roof, 1);
  g.fillRect(-w / 2 - 6, -36, w + 12, 14);
  g.fillStyle(0x243044, 1);
  g.fillRect(-10, -6, 22, 22);
}

function tower(g, wall, glass, h) {
  g.fillStyle(wall, 1);
  g.fillRect(-28, -h, 56, h + 8);
  g.fillStyle(glass, 0.9);
  for (let y = -h + 10; y < -8; y += 14) {
    g.fillRect(-18, y, 10, 8);
    g.fillRect(6, y, 10, 8);
  }
}

function motel(g) {
  g.fillStyle(0xf2efe6, 1);
  g.fillRect(-52, -32, 104, 40);
  g.fillStyle(0xd27a62, 1);
  g.fillRect(-56, -40, 112, 10);
  g.fillStyle(0x58a6ff, 0.8);
  g.fillRect(-40, -22, 12, 10);
  g.fillRect(-16, -22, 12, 10);
  g.fillRect(10, -22, 12, 10);
  g.fillRect(30, -22, 12, 10);
}

function club(g) {
  g.fillStyle(0x2a2438, 1);
  g.fillRect(-48, -36, 96, 48);
  g.fillStyle(0xbc8cff, 0.9);
  g.fillRect(-48, -8, 96, 6);
  g.fillRect(-20, -28, 40, 12);
}

function cars(g) {
  g.fillStyle(0x8d7358, 0.35);
  g.fillRect(-56, -20, 112, 40);
  g.fillStyle(0xc4553a, 1);
  g.fillRect(-40, -8, 22, 12);
  g.fillStyle(0x7f93a8, 1);
  g.fillRect(-8, -14, 26, 14);
  g.fillStyle(0xf2efe6, 1);
  g.fillRect(24, -6, 22, 12);
}

function hangar(g) {
  g.fillStyle(0x8a8175, 1);
  g.fillRect(-70, -10, 140, 28);
  g.fillStyle(0x5c5346, 1);
  g.fillEllipse(0, -10, 140, 48);
  g.fillStyle(0x243044, 1);
  g.fillRect(-18, -4, 36, 18);
}

function villa(g) {
  g.fillStyle(0xf2efe6, 1);
  g.fillRect(-58, -26, 116, 36);
  g.fillStyle(0xb5523a, 1);
  g.fillTriangle(-66, -26, 66, -26, 0, -58);
  g.fillStyle(0x243044, 1);
  g.fillRect(-8, -8, 16, 18);
  g.fillRect(-36, -16, 14, 12);
  g.fillRect(22, -16, 14, 12);
}

function dock(g) {
  g.fillStyle(0x1d6d8c, 0.85);
  g.fillEllipse(10, 16, 130, 40);
  g.fillStyle(0x8d7358, 1);
  g.fillRect(-50, -6, 90, 12);
  g.fillRect(20, -6, 10, 28);
  g.fillStyle(0xcbb692, 1);
  g.fillRect(-36, -28, 28, 22);
}

function strip(g) {
  g.fillStyle(0x3e4650, 1);
  g.fillRect(-78, -4, 156, 16);
  g.fillStyle(0xf4f7fb, 0.8);
  g.fillRect(-70, 2, 16, 4);
  g.fillRect(-30, 2, 16, 4);
  g.fillRect(10, 2, 16, 4);
  g.fillRect(48, 2, 16, 4);
  g.fillStyle(0xcbb692, 1);
  g.fillRect(-20, -28, 36, 20);
}

export function paintScaffold(g, progress) {
  g.clear();
  g.lineStyle(3, 0xb08968, 1);
  g.strokeRect(-46, -78, 92, 74);
  g.lineBetween(-46, -52, 46, -52);
  g.lineBetween(-46, -30, 46, -30);
  g.lineBetween(-16, -78, -16, -4);
  g.lineBetween(16, -78, 16, -4);
  g.fillStyle(0x8d6a43, 1);
  g.fillRect(-48, -54, 96, 5);
  g.fillRect(-48, -32, 96, 5);
  g.fillStyle(0x79b8ff, 0.55);
  g.fillRect(-36, -76, 28, 14);
  g.fillStyle(0x1b212d, 0.92);
  g.fillRect(-40, 16, 80, 6);
  g.fillStyle(0x58a6ff, 1);
  g.fillRect(-40, 16, 80 * Math.max(0, Math.min(1, progress)), 6);
}

export function paintRubble(g, progress) {
  const u = Math.max(0, Math.min(1, progress));
  g.clear();
  const h = 36 * (1 - u);
  g.fillStyle(0x8a8175, 1 - u * 0.4);
  g.fillRect(-42, -h, 84, h);
  g.fillStyle(0x6b635a, 0.9);
  g.fillCircle(-18, 4, 8 + u * 8);
  g.fillCircle(8, 6, 6 + u * 6);
  g.fillCircle(26, 2, 5 + u * 4);
  g.fillStyle(0xc4b8a4, 0.5);
  g.fillCircle(0, -h - 6, 10 + u * 16);
}
