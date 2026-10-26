// Hand-built map and structure drawing for San Verde. One graphics pass
// for the ground, then a structure centered on each lot.

import { BUILD_SLOTS } from './data/missions.js';

export const WORLD_W = 2520;
export const WORLD_H = 1360;

export const RIVER = [
  [120, 160], [180, 320], [220, 520], [250, 740], [280, 960], [340, 1120], [480, 1280]
];
export const HARBOR = [
  [280, 960], [480, 1040], [760, 1000], [1040, 1060], [1280, 960], [1460, 1120]
];

function hash(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function nearLot(x, y) {
  return BUILD_SLOTS.some((s) => Math.hypot(s.x - x, s.y - y) < 150);
}

function poly(g, pts) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.strokePath();
}

export function drawWorld(g, roads) {
  g.clear();
  g.fillStyle(0x4a6234, 1);
  g.fillRect(0, 0, WORLD_W, WORLD_H);
  g.fillStyle(0x5c5338, 1);
  g.fillRect(860, 0, 740, WORLD_H);
  g.fillStyle(0x5a6244, 1);
  g.fillRect(1600, 0, WORLD_W - 1600, WORLD_H);
  for (let i = 0; i < 420; i++) {
    const x = hash(i, 21) * WORLD_W;
    const y = hash(i, 22) * WORLD_H;
    const rx = 70 + hash(i, 23) * 180;
    const ry = 40 + hash(i, 24) * 90;
    const sierra = x > 1600;
    const town = x > 860 && x < 1600;
    const roll = hash(i, 25);
    const color = sierra
      ? (roll > 0.55 ? 0x6e6550 : 0x4e6840)
      : town
        ? (roll > 0.5 ? 0x74664a : 0x5a7040)
        : (roll > 0.66 ? 0x6d8a48 : roll > 0.33 ? 0x3e5a2e : 0xc4b48a);
    g.fillStyle(color, 0.72);
    g.fillEllipse(x, y, rx, ry);
  }
  for (let i = 0; i < 700; i++) {
    const x = hash(i, 31) * WORLD_W;
    const y = hash(i, 32) * WORLD_H;
    g.fillStyle(hash(i, 33) > 0.5 ? 0x1a2414 : 0xe6d7b0, 0.07);
    g.fillCircle(x, y, 1.5 + hash(i, 34) * 3.5);
  }

  // Valley crop quilts
  const fields = [
    [360, 560, 260, 140, 0x6f8f46],
    [620, 600, 200, 120, 0x87a45a],
    [300, 820, 180, 100, 0x5e7c3c],
    [700, 820, 160, 90, 0x78944c]
  ];
  for (const [x, y, w, h, color] of fields) {
    g.fillStyle(0x2a2014, 0.25);
    g.fillEllipse(x + 8, y + 10, w, h);
    g.fillStyle(color, 0.92);
    g.fillEllipse(x, y, w, h);
    g.fillStyle(0x2f4a22, 0.28);
    for (let row = -h / 2 + 16; row < h / 2 - 8; row += 16) {
      for (let col = -w / 2 + 20; col < w / 2 - 16; col += 14) {
        if (hash(x + col, y + row) > 0.35) g.fillCircle(x + col, y + row, 2.2);
      }
    }
  }

  // Sierra terraces
  const terraces = [
    [1900, 340, 420, 0x6a6248],
    [1960, 390, 360, 0x5d7344],
    [1880, 450, 300, 0x7d8a52],
    [2040, 620, 280, 0x6a5a40],
    [1920, 680, 240, 0x587848]
  ];
  for (const [x, y, w, color] of terraces) {
    g.fillStyle(0x2a2418, 0.55);
    g.fillRect(x - w / 2, y + 10, w, 14);
    g.fillStyle(color, 1);
    g.fillRect(x - w / 2, y, w, 16);
    g.fillStyle(0xe6d7b0, 0.25);
    g.fillRect(x - w / 2, y, w, 3);
  }

  // Jungle, palms, rocks. Skip the lots so structures stay readable.
  for (let i = 0; i < 220; i++) {
    const x = 30 + hash(i, 4) * (WORLD_W - 60);
    const y = 40 + hash(i, 9) * (WORLD_H - 80);
    if (nearLot(x, y)) continue;
    const kind = hash(i, 2);
    const sierra = x > 1600;
    const riverish = Math.abs(x - 220) < 80;
    if (riverish && kind > 0.4) palm(g, x, y, 0.8 + hash(i, 6));
    else if (sierra && kind > 0.72) rock(g, x, y, 0.8 + hash(i, 5));
    else if (kind > 0.55) canopy(g, x, y, 0.7 + hash(i, 3) * 0.9, i);
    else shrub(g, x, y, 0.6 + hash(i, 7));
  }

  town(g, 500, 280, 6, 2, 'colonial');
  town(g, 1080, 280, 7, 3, 'port');
  town(g, 1540, 300, 4, 2, 'port');
  town(g, 1880, 250, 4, 2, 'stone');
  town(g, 980, 860, 5, 2, 'port');
  plaza(g, 1240, 340);

  // River banks, then water
  g.lineStyle(54, 0xcbb892, 0.9);
  poly(g, RIVER);
  poly(g, HARBOR);
  g.lineStyle(40, 0x8d7350, 0.55);
  poly(g, RIVER);
  g.lineStyle(30, 0x1b4558, 1);
  poly(g, RIVER);
  g.lineStyle(22, 0x163e4e, 1);
  poly(g, HARBOR);
  g.lineStyle(3, 0x9fd4e4, 0.35);
  poly(g, RIVER);

  for (const road of roads) {
    const pts = road.map((p) => [p.x, p.y]);
    g.lineStyle(22, 0x3d3224, 0.9);
    poly(g, pts);
    g.lineStyle(14, 0xb09572, 1);
    poly(g, pts);
    g.lineStyle(2, 0xf0e2c4, 0.45);
    for (let i = 0; i < road.length - 1; i++) dash(g, road[i], road[i + 1]);
  }
}

function canopy(g, x, y, s, seed) {
  g.fillStyle(0x10160c, 0.4);
  g.fillEllipse(x + 8 * s, y + 14 * s, 46 * s, 18 * s);
  const blobs = [[0, 0, 18], [-14, 6, 14], [12, 4, 13], [-4, -10, 11]];
  const greens = [0x1c3a18, 0x2d5a28, 0x3f7040, 0x6a9450];
  blobs.forEach(([dx, dy, r], i) => {
    g.fillStyle(greens[(i + seed) % greens.length], 1);
    g.fillCircle(x + dx * s, y + dy * s, r * s);
  });
  g.fillStyle(0x8fb86a, 0.55);
  g.fillCircle(x - 8 * s, y - 8 * s, 5 * s);
}

function palm(g, x, y, s) {
  g.fillStyle(0x10160c, 0.3);
  g.fillEllipse(x + 4, y + 16 * s, 20 * s, 8 * s);
  g.fillStyle(0x6b4428, 1);
  g.fillRect(x - 2 * s, y - 4 * s, 4 * s, 20 * s);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.fillStyle(i % 2 ? 0x2f6a32 : 0x4e8a40, 1);
    g.fillEllipse(x + Math.cos(a) * 12 * s, y + Math.sin(a) * 6 * s, 16 * s, 5 * s);
  }
}

function shrub(g, x, y, s) {
  g.fillStyle(0x244028, 1);
  g.fillCircle(x, y, 8 * s);
  g.fillStyle(0x4e7a38, 1);
  g.fillCircle(x - 4 * s, y - 2 * s, 5 * s);
}

function rock(g, x, y, s) {
  g.fillStyle(0x2a261f, 0.45);
  g.fillEllipse(x + 4, y + 6, 22 * s, 10 * s);
  g.fillStyle(0x6a6258, 1);
  g.fillEllipse(x, y, 18 * s, 10 * s);
  g.fillStyle(0xa09888, 0.7);
  g.fillEllipse(x - 3 * s, y - 2 * s, 8 * s, 4 * s);
}

function town(g, x, y, cols, rows, style) {
  const roofs = style === 'stone'
    ? [0x6a6258, 0x8a8074, 0x4a4038]
    : style === 'port'
      ? [0x3d5566, 0x8c4030, 0x2a3440]
      : [0x8c4030, 0xc4a06a, 0x6e3458, 0x4a6740];
  if (style === 'stone') {
    g.fillStyle(0x6a5a40, 1);
    g.fillRect(x - 8, y - 28, 28, 36);
    g.fillStyle(0x3a3228, 1);
    g.fillRect(x + 2, y - 40, 8, 16);
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const n = hash(x + c * 19, y + r * 23);
      const w = 18 + Math.floor(n * 16);
      const h = 14 + Math.floor(hash(c, r + y) * 12);
      const px = x + c * 34;
      const py = y + r * 30;
      g.fillStyle(0x140e08, 0.35);
      g.fillRect(px + 3, py + 4, w, h);
      g.fillStyle(0xe6d3b4, 1);
      g.fillRect(px, py, w, h);
      g.fillStyle(roofs[(c + r) % roofs.length], 1);
      g.fillRect(px - 2, py - 7, w + 4, 8);
      g.fillStyle(0x163044, 0.85);
      g.fillRect(px + 4, py + 4, 5, 5);
    }
  }
}

function plaza(g, x, y) {
  g.fillStyle(0xcbb892, 0.85);
  g.fillEllipse(x, y, 90, 54);
  g.fillStyle(0x8d7350, 1);
  g.fillCircle(x, y, 8);
  g.lineStyle(2, 0x6a5438, 0.6);
  g.strokeEllipse(x, y, 70, 40);
}

function dash(g, a, b) {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(1, Math.floor(len / 18));
  for (let i = 0; i < n; i += 2) {
    const t0 = i / n;
    const t1 = Math.min(1, (i + 0.65) / n);
    g.lineBetween(a.x + (b.x - a.x) * t0, a.y + (b.y - a.y) * t0, a.x + (b.x - a.x) * t1, a.y + (b.y - a.y) * t1);
  }
}

export function drawFog(g, regions) {
  g.clear();
  for (const reg of regions) {
    if (!reg.unlockCostClean) continue;
    const b = reg.bounds;
    g.fillStyle(0x12160e, 0.22);
    g.fillRect(b.x, b.y, b.w, b.h);
    g.lineStyle(2, reg.id === 'sierra_alta' ? 0x8a5a3a : 0x1c2838, 0.22);
    for (let o = 0; o < b.w + b.h; o += 26) {
      g.lineBetween(b.x + Math.min(o, b.w), b.y + Math.max(0, o - b.w), b.x + Math.max(0, o - b.h), b.y + Math.min(o, b.h));
    }
  }
}

function shadow(g, w, h) {
  g.fillStyle(0x0c1008, 0.42);
  g.fillEllipse(12, 36, w, h);
}

export function paintStructure(g, buildingId, rival) {
  g.clear();
  if (rival) {
    drawRival(g);
    return;
  }
  if (!buildingId) {
    drawPlot(g);
    return;
  }
  const fn = KINDS[buildingId] || drawBarn;
  fn(g);
}

function drawPlot(g) {
  g.fillStyle(0x6a5438, 0.22);
  g.fillEllipse(0, 16, 150, 70);
  g.lineStyle(2, 0xe6d3ae, 0.4);
  for (let i = 0; i < 28; i += 2) {
    g.beginPath();
    g.arc(0, 16, 62, (i / 28) * Math.PI * 2, ((i + 0.8) / 28) * Math.PI * 2, false);
    g.strokePath();
  }
}

function drawPlantation(g) {
  shadow(g, 230, 70);
  g.fillStyle(0x3a2a1c, 1);
  g.fillRoundedRect(-100, 4, 150, 70, 4);
  g.fillStyle(0x5a432c, 1);
  g.fillRoundedRect(-110, -8, 140, 78, 4);
  g.lineStyle(2, 0x8d7350, 0.7);
  g.strokeRoundedRect(-112, -6, 146, 84, 4);
  for (let i = 0; i < 6; i++) {
    g.fillStyle(0x2c5224, 1);
    g.fillRect(-104, -2 + i * 12, 128, 8);
    g.fillStyle(0x8fd08a, 0.9);
    for (let x = -98; x < 18; x += 12) g.fillCircle(x, 2 + i * 12, 3.2);
  }
  g.fillStyle(0xc4b496, 1);
  g.fillRect(100, -40, 16, 58);
  g.fillStyle(0xead8b8, 1);
  g.fillRect(36, -46, 70, 64);
  g.fillStyle(0x6a2e22, 1);
  g.fillTriangle(40, -46, 71, -84, 112, -46);
  g.fillStyle(0x8c3a28, 1);
  g.fillTriangle(30, -46, 71, -84, 102, -46);
  g.fillStyle(0xffffff, 0.16);
  g.fillTriangle(48, -50, 71, -78, 71, -50);
  g.fillStyle(0x5a4030, 1);
  g.fillRect(60, -10, 16, 28);
  g.fillStyle(0x9fd8e8, 0.95);
  g.fillRect(44, -30, 14, 12);
  g.fillRect(84, -30, 14, 12);
  g.fillStyle(0x4a4034, 1);
  g.fillRect(96, -78, 8, 22);
  g.fillStyle(0x8a9098, 1);
  g.fillRect(-8, 28, 22, 18);
  g.fillEllipse(3, 28, 24, 10);
  g.fillStyle(0x8d7350, 1);
  g.fillCircle(-70, 62, 7);
  g.fillCircle(-56, 64, 6);
  g.fillStyle(0xc4a06a, 1);
  g.fillRect(-40, 56, 12, 10);
}

function drawCoffee(g) {
  shadow(g, 230, 70);
  g.fillStyle(0x3d5228, 1);
  g.fillRoundedRect(-116, -20, 130, 80, 6);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 6; c++) {
      g.fillStyle(c % 2 ? 0x2f6a32 : 0x4e8a40, 1);
      g.fillCircle(-100 + c * 18, -8 + r * 16, 6);
    }
  }
  g.fillStyle(0xd7c4a2, 1);
  g.fillRect(-110, 48, 70, 6);
  g.fillRect(-110, 58, 70, 6);
  g.fillStyle(0xf0e2c8, 1);
  g.fillRect(28, -40, 78, 58);
  g.fillStyle(0x8c4030, 1);
  g.fillRect(22, -52, 90, 14);
  g.fillStyle(0x6b4428, 1);
  g.fillRect(20, 12, 94, 8);
  g.fillStyle(0x4a3024, 1);
  g.fillRect(58, -8, 16, 26);
}

function drawHighland(g) {
  shadow(g, 220, 60);
  const bands = [[-100, 28, 200, 0x6a5a40], [-90, 8, 180, 0x5d7a3c], [-78, -12, 156, 0x7d9448], [-66, -32, 130, 0x4e6a34]];
  for (const [x, y, w, color] of bands) {
    g.fillStyle(0x2a2418, 1);
    g.fillRect(x, y + 16, w, 8);
    g.fillStyle(color, 1);
    g.fillRect(x, y, w, 16);
    g.fillStyle(0xe7dcc4, 0.35);
    g.fillRect(x, y, w, 3);
  }
  g.fillStyle(0xd7c4a2, 1);
  g.fillRect(40, -56, 28, 28);
  g.fillStyle(0x8c4030, 1);
  g.fillRect(36, -66, 36, 10);
}

function drawBarn(g) {
  shadow(g, 240, 70);
  g.fillStyle(0xb7a88c, 1);
  g.fillRect(70, -8, 18, 62);
  g.fillStyle(0xe6d4b4, 1);
  g.fillRect(-100, -16, 180, 70);
  g.fillStyle(0x7a3424, 1);
  g.fillTriangle(-110, -16, -10, -78, 90, -16);
  g.fillStyle(0x4a4034, 1);
  g.fillRect(40, -70, 12, 28);
  g.fillStyle(0x3a3028, 1);
  g.fillRect(-20, 16, 28, 38);
  g.fillStyle(0xc4a06a, 1);
  g.fillRect(-90, 28, 28, 18);
  g.fillRect(-58, 34, 24, 14);
  g.lineStyle(3, 0x6b4428, 0.8);
  for (let x = -88; x < 70; x += 16) g.lineBetween(x, -8, x + 8, -40);
  g.fillStyle(0x8a9098, 1);
  g.fillRect(70, 8, 36, 8);
  g.fillRect(78, 0, 6, 22);
}

function drawMill(g) {
  shadow(g, 240, 70);
  g.fillStyle(0xe4d6bc, 1);
  g.fillRect(-40, -20, 130, 64);
  g.fillStyle(0x6e4030, 1);
  g.fillRect(-46, -34, 142, 16);
  g.fillStyle(0xb7b1a4, 1);
  g.fillCircle(70, -30, 22);
  g.fillRect(58, -16, 24, 48);
  g.fillStyle(0x8c4030, 1);
  g.fillRect(-100, 6, 52, 36);
  g.fillStyle(0x5a4632, 1);
  g.fillRect(-48, 18, 28, 6);
  g.fillStyle(0x3a4250, 0.9);
  g.fillRect(-20, 0, 22, 16);
  g.fillRect(10, 0, 22, 16);
}

function drawLab(g) {
  shadow(g, 250, 74);
  g.fillStyle(0xd9d4c8, 1);
  g.fillRect(-110, -20, 170, 72);
  g.fillStyle(0x355860, 1);
  g.fillRect(-116, -36, 182, 18);
  g.fillStyle(0x7ec8d4, 0.95);
  for (let i = 0; i < 4; i++) g.fillRect(-90 + i * 32, -4, 20, 16);
  g.fillStyle(0x6aa8b0, 1);
  g.fillCircle(78, -8, 16);
  g.fillCircle(104, 4, 12);
  g.fillRect(74, 4, 36, 28);
  g.fillStyle(0x2c3e44, 1);
  g.fillRect(20, -52, 10, 24);
  g.fillStyle(0xc4553a, 1);
  g.fillRect(-100, 30, 40, 8);
  g.fillStyle(0xf0d36a, 1);
  g.fillRect(-100, 38, 40, 8);
}

function drawWarehouse(g) {
  shadow(g, 260, 80);
  g.fillStyle(0xa89b84, 1);
  g.fillRect(96, -16, 18, 66);
  g.fillStyle(0xd2c8b4, 1);
  g.fillRect(-120, -28, 110, 78);
  g.fillRect(0, -28, 110, 78);
  g.fillStyle(0x4e5864, 1);
  g.fillRect(-126, -42, 122, 16);
  g.fillRect(-6, -42, 122, 16);
  g.fillStyle(0x2c3440, 0.95);
  g.fillRect(-100, 10, 60, 32);
  g.fillRect(20, 10, 60, 32);
  g.fillStyle(0x8a7352, 1);
  g.fillRect(-70, 48, 140, 14);
  forklift(g, -20, 52);
  forklift(g, 30, 56);
  g.fillStyle(0xc4a06a, 1);
  g.fillRect(-110, 46, 22, 16);
  g.fillRect(90, 48, 22, 16);
}

function forklift(g, x, y) {
  g.fillStyle(0xe07a32, 1);
  g.fillRect(x, y, 18, 10);
  g.fillStyle(0x2a241c, 1);
  g.fillRect(x + 16, y - 8, 3, 16);
  g.fillRect(x + 16, y - 8, 10, 3);
  g.fillCircle(x + 4, y + 10, 3);
  g.fillCircle(x + 14, y + 10, 3);
}

function drawDepot(g) {
  shadow(g, 250, 70);
  g.fillStyle(0xd7cdb8, 1);
  g.fillRect(-110, -30, 210, 60);
  g.fillStyle(0x3e4a56, 1);
  g.fillRect(-116, -44, 222, 16);
  g.fillStyle(0x1e2630, 1);
  g.fillRect(-96, -8, 40, 30);
  g.fillRect(-40, -8, 40, 30);
  g.fillRect(16, -8, 40, 30);
  g.fillRect(72, -8, 28, 30);
}

function drawPier(g) {
  shadow(g, 240, 80);
  g.fillStyle(0x1b4558, 0.95);
  g.fillRoundedRect(-120, -10, 240, 90, 8);
  g.fillStyle(0x8d6a42, 1);
  g.fillRect(-16, -70, 32, 140);
  g.lineStyle(3, 0xe6d3ae, 0.55);
  for (let y = -60; y <= 60; y += 12) g.lineBetween(-16, y, 16, y);
  g.fillStyle(0x5a4030, 1);
  g.fillRect(-4, -74, 8, 12);
  g.fillRect(-4, 62, 8, 12);
  boat(g, -70, 10, 0xc4553a, 54);
  boat(g, 64, 28, 0xe8eef4, 46);
  g.fillStyle(0xead8b8, 1);
  g.fillRect(-100, -48, 40, 28);
  g.fillStyle(0x8c4030, 1);
  g.fillRect(-104, -58, 48, 12);
}

function boat(g, x, y, color, w) {
  g.fillStyle(color, 1);
  g.fillEllipse(x, y, w, 16);
  g.fillStyle(0x2a3440, 1);
  g.fillRect(x - 6, y - 14, 16, 12);
  g.fillStyle(0x9fd4e4, 0.8);
  g.fillRect(x - 2, y - 10, 8, 6);
}

function drawStrip(g) {
  shadow(g, 280, 80);
  g.fillStyle(0x2a3138, 1);
  g.fillRect(-130, -6, 260, 28);
  g.fillStyle(0xe8eef4, 0.9);
  for (let x = -110; x <= 90; x += 22) g.fillRect(x, 6, 12, 4);
  g.fillStyle(0xd7c4a2, 1);
  g.fillRect(-120, -50, 70, 36);
  g.fillStyle(0x3e5860, 1);
  g.fillRect(-126, -62, 82, 14);
  plane(g, 40, -8, 1);
  g.fillStyle(0xf0d36a, 1);
  g.fillRect(110, -40, 4, 28);
  g.fillTriangle(114, -40, 128, -32, 114, -24);
}

function plane(g, x, y, s) {
  g.fillStyle(0xd5e4ee, 1);
  g.fillEllipse(x, y, 36 * s, 12 * s);
  g.fillRect(x - 28 * s, y - 3 * s, 20 * s, 6 * s);
  g.fillTriangle(x + 8 * s, y, x + 28 * s, y - 16 * s, x + 28 * s, y + 16 * s);
  g.fillStyle(0x3a4a58, 1);
  g.fillRect(x - 4 * s, y - 4 * s, 10 * s, 6 * s);
}

function drawTaxi(g) {
  shadow(g, 230, 70);
  g.fillStyle(0xf0e4cc, 1);
  g.fillRect(-20, -40, 100, 56);
  g.fillStyle(0x2f4e6a, 1);
  g.fillRect(-26, -52, 112, 14);
  g.fillStyle(0x8ec5ff, 0.95);
  g.fillRect(0, -22, 60, 10);
  g.fillStyle(0xf0d36a, 1);
  cab(g, -100, 20);
  cab(g, -50, 28);
  cab(g, 90, 18);
  g.fillStyle(0x4a3024, 1);
  g.fillRect(20, -8, 16, 24);
}

function cab(g, x, y) {
  g.fillStyle(0xf4f7fb, 1);
  g.fillRect(x, y, 34, 14);
  g.fillStyle(0xf0d36a, 1);
  g.fillRect(x, y, 34, 4);
  g.fillStyle(0x163044, 0.8);
  g.fillRect(x + 22, y + 4, 8, 6);
  g.fillCircle(x + 8, y + 14, 3);
  g.fillCircle(x + 26, y + 14, 3);
}

function drawClub(g) {
  shadow(g, 240, 70);
  g.fillStyle(0x241c2c, 1);
  g.fillRect(-110, -16, 210, 64);
  g.fillStyle(0x6e3458, 1);
  g.fillRect(-116, -30, 222, 16);
  g.fillStyle(0xbc8cff, 1);
  g.fillRect(-80, -4, 150, 12);
  g.fillStyle(0xf0d36a, 1);
  g.fillRect(-70, 16, 130, 6);
  g.fillStyle(0xe8eef4, 1);
  g.fillRect(-12, 16, 24, 32);
  g.fillCircle(-40, 22, 4);
  g.fillCircle(40, 22, 4);
}

function drawBank(g) {
  shadow(g, 250, 74);
  g.fillStyle(0xb3a890, 1);
  g.fillRect(100, 4, 18, 52);
  g.fillStyle(0xd9d0bc, 1);
  g.fillRect(-110, -8, 220, 64);
  g.fillStyle(0x8aa0b4, 1);
  g.fillTriangle(-120, -8, 0, -62, 120, -8);
  g.fillStyle(0xf6f1e6, 1);
  for (let i = 0; i < 6; i++) g.fillRect(-90 + i * 30, 4, 10, 44);
  g.fillStyle(0x1d4a5c, 1);
  g.fillRect(-16, 16, 32, 40);
  g.fillStyle(0x8d7350, 1);
  g.fillRect(-120, 52, 240, 8);
}

function drawRival(g) {
  shadow(g, 220, 64);
  g.fillStyle(0x6a4038, 1);
  g.fillRect(-90, -16, 180, 64);
  g.fillStyle(0x3a221e, 1);
  g.fillRect(-100, -64, 36, 56);
  g.fillRect(64, -72, 36, 64);
  g.lineStyle(3, 0xf85149, 0.85);
  g.strokeRect(-90, -16, 180, 64);
  g.fillStyle(0xf85149, 1);
  g.fillTriangle(82, -72, 82, -48, 108, -60);
  g.fillStyle(0x2a241c, 1);
  g.fillRect(-20, 12, 28, 36);
}

const KINDS = {
  plantation: drawPlantation,
  coffee_estate: drawCoffee,
  highland_farm: drawHighland,
  drying_barn: drawBarn,
  packaging_mill: drawMill,
  chem_lab: drawLab,
  warehouse: drawWarehouse,
  transport_depot: drawDepot,
  river_pier: drawPier,
  aerodrome: drawStrip,
  taxi_co: drawTaxi,
  salsa_club: drawClub,
  banco_regional: drawBank
};

export function drawMiniTruck(g, x, y, color) {
  g.fillStyle(color, 1);
  g.fillRect(x - 12, y - 6, 24, 12);
  g.fillStyle(0xe8eef4, 1);
  g.fillRect(x + 8, y - 5, 8, 10);
  g.fillStyle(0x1c140e, 1);
  g.fillCircle(x - 6, y + 6, 2.5);
  g.fillCircle(x + 8, y + 6, 2.5);
}
