// Regional ground for San Verde: jungle valley, river delta, misty
// highlands, then a 1980s coastal city with a street grid, beach, and port.
// One canvas becomes the Phaser texture "go-world".

import { BUILD_SLOTS } from '../data/missions.js';
import { hash, palm } from './kit.js';
import { renderStructure } from './buildings.js';

export const WORLD_W = 2520;
export const WORLD_H = 1360;

export const RIVER = [
  [120, 160], [180, 320], [220, 520], [250, 740], [280, 960], [340, 1120], [480, 1280]
];
export const HARBOR = [
  [280, 960], [480, 1040], [760, 1000], [1040, 1060], [1280, 960], [1460, 1120], [1680, 1240]
];

const STAMPS = [
  { kind: 'warehouse_sm', x: 380, y: 280, s: 0.46 },
  { kind: 'diner', x: 1000, y: 250, s: 0.46 },
  { kind: 'motel', x: 1260, y: 250, s: 0.44 },
  { kind: 'casino', x: 1420, y: 240, s: 0.44 },
  { kind: 'pawn', x: 700, y: 240, s: 0.46 },
  { kind: 'laundromat', x: 1000, y: 650, s: 0.46 },
  { kind: 'car_lot', x: 820, y: 980, s: 0.48 },
  { kind: 'mansion', x: 1040, y: 960, s: 0.48 },
  { kind: 'apartments', x: 1680, y: 960, s: 0.46 },
  { kind: 'town_house', x: 480, y: 1000, s: 0.48 },
  { kind: 'sawmill', x: 1980, y: 660, s: 0.48 },
  { kind: 'terrace', x: 1980, y: 300, s: 0.5 },
  { kind: 'terrace', x: 2320, y: 430, s: 0.5 }
];

const stampCache = new Map();

function nearSlot(x, y, r) {
  for (let i = 0; i < BUILD_SLOTS.length; i++) {
    const s = BUILD_SLOTS[i];
    const dx = s.x - x;
    const dy = s.y - y;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

function nearRoad(x, y, roads, r) {
  if (!roads) return false;
  const r2 = r * r;
  for (let p = 0; p < roads.length; p++) {
    const poly = roads[p];
    for (let i = 0; i < poly.length - 1; i++) {
      const ax = poly[i].x;
      const ay = poly[i].y;
      const bx = poly[i + 1].x;
      const by = poly[i + 1].y;
      const dx = bx - ax;
      const dy = by - ay;
      const len = dx * dx + dy * dy || 1;
      let t = ((x - ax) * dx + (y - ay) * dy) / len;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = ax + dx * t - x;
      const py = ay + dy * t - y;
      if (px * px + py * py < r2) return true;
    }
  }
  return false;
}

function ribbon(g, pts, width, color, hi) {
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = color;
  g.lineWidth = width;
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.stroke();
  if (hi) {
    g.strokeStyle = hi;
    g.lineWidth = Math.max(2, width * 0.22);
    g.stroke();
  }
  g.restore();
}

function road(g, pts, width, asphalt, shoulder) {
  const flat = pts.map((p) => [p.x, p.y]);
  ribbon(g, flat, width + 10, shoulder);
  ribbon(g, flat, width, asphalt);
  g.save();
  g.lineCap = 'butt';
  g.setLineDash([12, 16]);
  g.strokeStyle = 'rgba(244,236,210,0.7)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(flat[0][0], flat[0][1]);
  for (let i = 1; i < flat.length; i++) g.lineTo(flat[i][0], flat[i][1]);
  g.stroke();
  g.restore();
}

function rock(g, x, y, s) {
  g.fillStyle = '#6a6258';
  g.beginPath();
  g.ellipse(x, y, 16 * s, 9 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#a09888';
  g.beginPath();
  g.ellipse(x - 4 * s, y - 2 * s, 7 * s, 4 * s, 0, 0, Math.PI * 2);
  g.fill();
}

function field(g, x, y, w, h, color) {
  g.fillStyle = 'rgba(30,24,12,0.22)';
  g.beginPath();
  g.ellipse(x + 6, y + 6, w, h, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(30,50,20,0.35)';
  for (let row = -h + 10; row < h - 6; row += 12) {
    g.fillRect(x - w + 8, y + row, w * 2 - 16, 2);
  }
}

function cityBlock(g, x, y, seed) {
  const downtown = x > 1260 && y < 480;
  const h = (downtown ? 42 : 18) + Math.floor(hash(seed, 3) * (downtown ? 54 : 30));
  const w = 24 + Math.floor(hash(seed, 4) * 18);
  const faces = ['#f4e2c6', '#f7c9d4', '#d5efe8', '#f7e7c4', '#e7d4f2', '#f2d2bf'];
  const roofs = ['#c25038', '#7d3b5c', '#3d5566', '#c4a06a', '#2a3440'];
  const face = faces[seed % faces.length];
  const roof = roofs[(seed * 3) % roofs.length];
  g.fillStyle = 'rgba(20,16,12,0.22)';
  g.fillRect(x + 4, y - h + 6, w, h);
  g.fillStyle = '#c9aa84';
  g.fillRect(x + w, y - h + 6, 8, h - 4);
  g.fillStyle = face;
  g.fillRect(x, y - h, w, h);
  g.fillStyle = roof;
  g.fillRect(x - 2, y - h - 7, w + 12, 8);
  if (downtown) {
    g.fillStyle = '#d7dde4';
    g.fillRect(x + w * 0.35, y - h - 16, 10, 10);
  }
  const rows = Math.max(1, Math.floor((h - 8) / 11));
  for (let r = 0; r < rows; r++) {
    g.fillStyle = hash(seed + r, 7) > 0.62 ? '#ffd27a' : '#8ec4d4';
    g.fillRect(x + 4, y - 10 - r * 11, 5, 6);
    if (w > 30) g.fillRect(x + 14, y - 10 - r * 11, 5, 6);
  }
}

function crane(g, x, y) {
  g.strokeStyle = '#e6b84a';
  g.lineWidth = 4;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + 4, y - 78);
  g.lineTo(x + 62, y - 78);
  g.stroke();
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x + 4, y - 48);
  g.lineTo(x + 22, y - 78);
  g.moveTo(x + 48, y - 78);
  g.lineTo(x + 48, y - 46);
  g.stroke();
  g.fillStyle = '#c25038';
  g.fillRect(x + 36, y - 44, 26, 14);
  g.fillStyle = '#1c2838';
  g.fillRect(x + 38, y - 42, 22, 4);
  g.fillStyle = '#3e4450';
  g.fillRect(x - 10, y - 8, 28, 10);
}

function container(g, x, y, color) {
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(x + 3, y + 3, 32, 16);
  g.fillStyle = color;
  g.fillRect(x, y, 32, 16);
  g.strokeStyle = 'rgba(255,255,255,0.4)';
  g.strokeRect(x + 2, y + 2, 28, 12);
}

function stamp(g, kind, x, y, scale) {
  let c = stampCache.get(kind);
  if (!c) {
    c = renderStructure(kind, 'ambient', false, 1);
    stampCache.set(kind, c);
  }
  g.drawImage(c, x - 150 * scale, y - 168 * scale, 300 * scale, 200 * scale);
}

function paintWorld(roads) {
  const c = document.createElement('canvas');
  c.width = WORLD_W;
  c.height = WORLD_H;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = true;

  const jungle = g.createLinearGradient(0, 0, 0, WORLD_H);
  jungle.addColorStop(0, '#3f6b34');
  jungle.addColorStop(0.55, '#2f5428');
  jungle.addColorStop(1, '#3d6a32');
  g.fillStyle = jungle;
  g.fillRect(0, 0, WORLD_W, WORLD_H);

  const sierra = g.createLinearGradient(1560, 0, WORLD_W, WORLD_H);
  sierra.addColorStop(0, '#6d7358');
  sierra.addColorStop(0.4, '#5c6848');
  sierra.addColorStop(1, '#7a6e58');
  g.fillStyle = sierra;
  g.fillRect(1560, 0, WORLD_W - 1560, WORLD_H);

  for (let i = 0; i < 220; i++) {
    const x = hash(i, 21) * 860;
    const y = hash(i, 22) * WORLD_H;
    const rx = 50 + hash(i, 23) * 140;
    const ry = 28 + hash(i, 24) * 70;
    g.fillStyle = hash(i, 25) > 0.5 ? 'rgba(47,107,52,0.55)' : 'rgba(30,70,32,0.45)';
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 80; i++) {
    const x = 1560 + hash(i, 41) * 900;
    const y = hash(i, 42) * 700;
    g.fillStyle = 'rgba(226,232,224,0.18)';
    g.beginPath();
    g.ellipse(x, y, 80 + hash(i, 43) * 120, 24 + hash(i, 44) * 20, 0, 0, Math.PI * 2);
    g.fill();
  }

  g.fillStyle = '#8a7d62';
  g.beginPath();
  g.moveTo(1680, 80);
  g.lineTo(1960, 40);
  g.lineTo(2140, 120);
  g.lineTo(2360, 60);
  g.lineTo(2520, 160);
  g.lineTo(2520, 280);
  g.lineTo(1680, 220);
  g.fill();
  g.fillStyle = '#6e6550';
  g.beginPath();
  g.moveTo(1880, 120);
  g.lineTo(2100, 70);
  g.lineTo(2280, 150);
  g.lineTo(1900, 190);
  g.fill();

  field(g, 200, 640, 90, 48, '#6f8f46');
  field(g, 180, 820, 70, 40, '#5e7c3c');
  field(g, 390, 360, 60, 34, '#87a45a');

  ribbon(g, RIVER, 36, '#1c6e86', 'rgba(186,230,236,0.55)');
  ribbon(g, HARBOR, 44, '#18748c', 'rgba(186,230,236,0.4)');
  ribbon(g, [[400, 1180], [520, 1260], [640, 1230], [760, 1320]], 22, '#1a7890', 'rgba(186,230,236,0.35)');
  ribbon(g, [[460, 1220], [560, 1300], [500, 1360]], 16, '#176880', null);

  const ocean = g.createLinearGradient(0, 1160, 0, WORLD_H);
  ocean.addColorStop(0, '#3aa0b8');
  ocean.addColorStop(1, '#0c4a62');
  g.fillStyle = ocean;
  g.beginPath();
  g.moveTo(640, 1188);
  for (let x = 640; x <= WORLD_W; x += 40) {
    g.lineTo(x, 1172 + Math.sin(x * 0.02) * 8);
  }
  g.lineTo(WORLD_W, WORLD_H);
  g.lineTo(640, WORLD_H);
  g.fill();
  g.fillStyle = '#e6d2a4';
  g.beginPath();
  g.moveTo(700, 1048);
  g.lineTo(2100, 1040);
  g.lineTo(2200, 1180);
  g.lineTo(640, 1190);
  g.fill();
  g.fillStyle = 'rgba(58,160,184,0.35)';
  g.beginPath();
  g.ellipse(1400, 1168, 420, 16, 0, 0, Math.PI * 2);
  g.fill();

  g.fillStyle = '#e7d3b0';
  g.fillRect(860, 230, 740, 820);
  for (let i = 0; i < 26; i++) {
    g.fillStyle = hash(i, 61) > 0.5 ? 'rgba(244,226,198,0.45)' : 'rgba(215,196,168,0.4)';
    g.fillRect(880 + (i % 5) * 140, 250 + Math.floor(i / 5) * 150, 120, 110);
  }

  g.fillStyle = '#7fa15a';
  g.beginPath();
  g.ellipse(1240, 560, 70, 40, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#cbb892';
  g.beginPath();
  g.ellipse(1240, 560, 22, 12, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#1c6e86';
  g.beginPath();
  g.ellipse(1240, 560, 8, 4, 0, 0, Math.PI * 2);
  g.fill();

  for (let gy = 0; gy < 9; gy++) {
    for (let gx = 0; gx < 7; gx++) {
      const x = 900 + gx * 100 + (gy % 2) * 16;
      const y = 270 + gy * 86;
      if (x > 1560 || y > 1000) continue;
      if (nearSlot(x, y, 108)) continue;
      if (nearRoad(x, y, roads, 32)) continue;
      if (Math.hypot(x - 1240, y - 560) < 78) continue;
      let crowded = false;
      for (let s = 0; s < STAMPS.length; s++) {
        if (Math.hypot(STAMPS[s].x - x, STAMPS[s].y - y) < 72) crowded = true;
      }
      if (crowded) continue;
      cityBlock(g, x, y, gx * 17 + gy * 13 + 3);
    }
  }

  for (let i = 0; i < STAMPS.length; i++) {
    const s = STAMPS[i];
    if (nearSlot(s.x, s.y, 150)) continue;
    stamp(g, s.kind, s.x, s.y, s.s);
  }

  for (let i = 0; i < 36; i++) {
    const x = 80 + hash(i, 71) * 760;
    const y = 200 + hash(i, 72) * 980;
    if (nearSlot(x, y, 96)) continue;
    palm(g, x, y, 0.5 + hash(i, 73) * 0.45);
  }
  for (let x = 820; x < 1700; x += 46) {
    if (nearSlot(x, 1076, 96)) continue;
    palm(g, x, 1076, 0.68);
  }
  for (let y = 280; y < 1000; y += 58) {
    if (!nearSlot(888, y, 96)) palm(g, 888, y, 0.58);
    if (!nearSlot(1568, y, 96)) palm(g, 1568, y, 0.58);
  }
  for (let i = 0; i < 18; i++) {
    const x = 1700 + hash(i, 81) * 700;
    const y = 240 + hash(i, 82) * 800;
    if (nearSlot(x, y, 100)) continue;
    rock(g, x, y, 0.6 + hash(i, 83));
  }
  for (let i = 0; i < 8; i++) {
    rock(g, 140 + i * 30, 200 + hash(i, 84) * 40, 0.7);
  }

  const piers = [1180, 1280, 1390, 1500];
  for (let i = 0; i < piers.length; i++) {
    g.fillStyle = '#8a6238';
    g.fillRect(piers[i], 1160, 18, 110);
    g.fillStyle = '#c4a06a';
    for (let k = 0; k < 8; k++) g.fillRect(piers[i] - 16, 1170 + k * 12, 50, 4);
  }
  crane(g, 1210, 1236);
  crane(g, 1420, 1248);
  container(g, 1120, 1204, '#c25038');
  container(g, 1156, 1210, '#3d6ea8');
  container(g, 1330, 1220, '#e6c35a');
  container(g, 1366, 1214, '#3aa07a');
  container(g, 1540, 1196, '#7d3b5c');

  g.fillStyle = '#6a6258';
  g.fillRect(1620, 1128, 240, 18);
  g.fillStyle = '#f4f1ea';
  for (let i = 0; i < 8; i++) g.fillRect(1640 + i * 28, 1134, 12, 3);
  g.fillStyle = '#e7e2d6';
  g.fillRect(1860, 1104, 36, 22);
  g.fillStyle = '#c25038';
  g.fillRect(1860, 1098, 40, 6);
  g.strokeStyle = '#e6b84a';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(1904, 1104);
  g.lineTo(1904, 1084);
  g.stroke();
  g.fillStyle = '#f4f7fb';
  g.beginPath();
  g.moveTo(1904, 1084);
  g.lineTo(1918, 1090);
  g.lineTo(1904, 1094);
  g.fill();

  for (let i = 0; i < 5; i++) {
    const x = 980 + i * 90;
    g.strokeStyle = '#6b4428';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x, 1096);
    g.lineTo(x, 1078);
    g.stroke();
    g.fillStyle = i % 2 ? '#ff4fbf' : '#3ee0ff';
    g.beginPath();
    g.ellipse(x, 1076, 12, 5, 0, Math.PI, 0, true);
    g.fill();
  }

  const streets = [
    [[880, 330], [1580, 330]],
    [[880, 800], [1580, 800]],
    [[910, 250], [910, 1040]],
    [[1100, 250], [1100, 1040]],
    [[1580, 250], [1580, 1080]],
    [[760, 1068], [2000, 1068]]
  ];
  for (let i = 0; i < streets.length; i++) {
    road(g, [{ x: streets[i][0][0], y: streets[i][0][1] }, { x: streets[i][1][0], y: streets[i][1][1] }], 14, '#3e4450', '#cbb892');
  }
  if (roads) {
    for (let i = 0; i < roads.length; i++) road(g, roads[i], i === 0 ? 20 : 14, '#3a4048', '#b7a078');
  }

  g.fillStyle = 'rgba(255,244,220,0.85)';
  const crosses = [[1100, 460], [1360, 330], [1280, 800], [1020, 800]];
  for (let i = 0; i < crosses.length; i++) {
    const x = crosses[i][0];
    const y = crosses[i][1];
    for (let k = -2; k <= 2; k++) g.fillRect(x + k * 8, y - 16, 3, 8);
  }

  return c;
}

export function drawWorld(g, roads) {
  const scene = g.scene;
  if (!scene || !scene.textures) return;
  if (!scene.textures.exists('go-world')) {
    scene.textures.addCanvas('go-world', paintWorld(roads || []));
  }
  if (!scene.children.getByName('go-world-map')) {
    scene.add.image(0, 0, 'go-world').setOrigin(0, 0).setDepth(-2).setName('go-world-map');
  }
  g.clear();
  g.setVisible(false);
}

export function drawFog(g, regions, simState) {
  g.clear();
  if (!regions) return;
  for (let i = 0; i < regions.length; i++) {
    const reg = regions[i];
    if (!reg.unlockCostClean) continue;
    const row = simState && simState.regions && simState.regions[reg.id];
    if (row && row.unlocked) continue;
    const b = reg.bounds;
    g.fillStyle(0xb7c0b4, 0.36);
    g.fillRect(b.x, b.y, b.w, b.h);
    g.fillStyle(0xe7eee8, 0.14);
    for (let band = 0; band < 4; band++) {
      g.fillEllipse(b.x + b.w * (0.25 + band * 0.18), b.y + 90 + band * 120, 200, 34);
    }
    g.lineStyle(3, 0xf4efe4, 0.28);
    g.strokeRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
    const x = b.x + b.w * 0.5;
    const y = b.y + 78;
    g.fillStyle(0xf7f1e4, 0.94);
    g.fillCircle(x, y, 16);
    g.lineStyle(3, 0x8a3224, 1);
    g.strokeCircle(x, y, 16);
    g.fillStyle(0x8a3224, 1);
    g.fillRoundedRect(x - 7, y - 1, 14, 10, 2);
    g.lineStyle(2, 0x8a3224, 1);
    g.beginPath();
    g.arc(x, y - 1, 5, Math.PI, 0, false);
    g.strokePath();
  }
}
