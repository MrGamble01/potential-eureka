// San Verde ground. One continuous landmass is baked into a handful of
// textures. Zone edges are the polygons in map-layout.js, not rectangles.
// Lot silhouettes below stay as the fallback when the texture hook is absent.

import { BUILD_SLOTS, ROAD_NETWORK } from './data/missions.js';
import {
  CITY_AVENUES,
  CITY_GROUND,
  CITY_LOOP,
  COVE,
  contains,
  HARBOR_PTS,
  INLET_PTS,
  LAND,
  LOT_POS,
  MAP_H,
  MAP_W,
  MESA,
  onLand,
  RIDGE,
  RIVER_PTS,
  SCENIC_ROADS,
  ZONE_LAYOUT
} from './map-layout.js';
import { hash, palm } from './art/kit.js';

const TILE_W = 1600;
const TILE_H = 1340;

function trace(g, pts) {
  const n = pts.length;
  if (n < 3) return;
  g.beginPath();
  g.moveTo((pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2);
  for (let i = 1; i < n; i++) {
    const c = pts[i];
    const nxt = pts[(i + 1) % n];
    g.quadraticCurveTo(c[0], c[1], (c[0] + nxt[0]) / 2, (c[1] + nxt[1]) / 2);
  }
  const c0 = pts[0];
  const n1 = pts[1];
  g.quadraticCurveTo(c0[0], c0[1], (c0[0] + n1[0]) / 2, (c0[1] + n1[1]) / 2);
  g.closePath();
}

function fillShape(g, pts, color) {
  g.fillStyle = color;
  trace(g, pts);
  g.fill();
}

function ribbon(g, pts, width, color) {
  if (!pts || pts.length < 2) return;
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = color;
  g.lineWidth = width;
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.stroke();
  g.restore();
}

function curveSamples(pts) {
  const flat = pts[0] && pts[0].x != null ? pts.map((p) => [p.x, p.y]) : pts;
  if (flat.length < 3) return flat;
  const out = [];
  const n = flat.length;
  const slices = 6;
  for (let i = 0; i < n - 1; i++) {
    const p0 = flat[Math.max(0, i - 1)];
    const p1 = flat[i];
    const p2 = flat[i + 1];
    const p3 = flat[Math.min(n - 1, i + 2)];
    for (let s = 0; s < slices; s++) {
      const t = s / slices;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([
        0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
      ]);
    }
  }
  out.push(flat[n - 1]);
  return out;
}

function filletPts(flat, radius) {
  if (flat.length < 3) return flat;
  const out = [flat[0]];
  for (let i = 1; i < flat.length - 1; i++) {
    const prev = flat[i - 1];
    const cur = flat[i];
    const next = flat[i + 1];
    const d1 = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]) || 1;
    const d2 = Math.hypot(next[0] - cur[0], next[1] - cur[1]) || 1;
    const r = Math.min(radius, d1 * 0.45, d2 * 0.45);
    const ax = cur[0] + ((prev[0] - cur[0]) * r) / d1;
    const ay = cur[1] + ((prev[1] - cur[1]) * r) / d1;
    const bx = cur[0] + ((next[0] - cur[0]) * r) / d2;
    const by = cur[1] + ((next[1] - cur[1]) * r) / d2;
    out.push([ax, ay]);
    for (let s = 1; s <= 5; s++) {
      const t = s / 6;
      const u = 1 - t;
      out.push([u * u * ax + 2 * u * t * cur[0] + t * t * bx, u * u * ay + 2 * u * t * cur[1] + t * t * by]);
    }
    out.push([bx, by]);
  }
  out.push(flat[flat.length - 1]);
  return out;
}

function roadLine(g, pts, width) {
  const src = pts[0] && pts[0].x != null ? pts.map((p) => [p.x, p.y]) : pts;
  const flat = curveSamples(filletPts(src, width >= 16 ? 96 : 58));
  ribbon(g, flat, width + 14, '#b7a078');
  ribbon(g, flat, width, '#3a4148');
  g.save();
  g.lineCap = 'butt';
  g.setLineDash([14, 18]);
  g.strokeStyle = 'rgba(230,196,84,0.9)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(flat[0][0], flat[0][1]);
  for (let i = 1; i < flat.length; i++) g.lineTo(flat[i][0], flat[i][1]);
  g.stroke();
  g.restore();
}

function nearPath(x, y, paths, r) {
  const r2 = r * r;
  for (let p = 0; p < paths.length; p++) {
    const poly = paths[p];
    for (let i = 0; i < poly.length - 1; i++) {
      const a = poly[i];
      const b = poly[i + 1];
      const ax = a.x != null ? a.x : a[0];
      const ay = a.y != null ? a.y : a[1];
      const bx = b.x != null ? b.x : b[0];
      const by = b.y != null ? b.y : b[1];
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

function blocked(x, y, pad) {
  const extra = pad || 0;
  for (let i = 0; i < BUILD_SLOTS.length; i++) {
    const s = BUILD_SLOTS[i];
    const dx = s.x - x;
    const dy = s.y - y;
    if (dx * dx + dy * dy < (110 + extra) * (110 + extra)) return true;
  }
  const lots = Object.values(LOT_POS);
  for (let i = 0; i < lots.length; i++) {
    const dx = lots[i].x - x;
    const dy = lots[i].y - y;
    if (dx * dx + dy * dy < (140 + extra) * (140 + extra)) return true;
  }
  return false;
}

function patch(g, x, y, rx, ry, rot, color) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = 'rgba(20,16,8,0.2)';
  g.beginPath();
  g.ellipse(8, 8, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(36,58,22,0.38)';
  g.lineWidth = 2;
  for (let row = -ry + 10; row < ry - 6; row += 12) {
    g.beginPath();
    g.moveTo(-rx + 12, row);
    g.quadraticCurveTo(0, row + (row > 0 ? 5 : -4), rx - 12, row - 1);
    g.stroke();
  }
  g.restore();
}

function farmstead(g, x, y, rot, seed) {
  g.fillStyle = 'rgba(214,186,130,0.5)';
  g.beginPath();
  g.ellipse(x, y + 6, 86, 52, rot, 0, Math.PI * 2);
  g.fill();
  const crops = ['#7f9a3c', '#c6b15a', '#6e8a38', '#d8c56a'];
  for (let i = 0; i < 4; i++) {
    const along = -34 + i * 22;
    patch(g, x + Math.cos(rot) * along, y + Math.sin(rot) * along, 20, 12, rot + 0.15, crops[i]);
  }
  house(g, x + Math.cos(rot + 1.4) * 48, y + Math.sin(rot + 1.4) * 34, seed, 0.58);
}

function house(g, x, y, seed, scale) {
  const s = scale || 1;
  const tall = scale > 1.25 || (hash(seed, 3) > 0.78 && y < 780 && x > 3900);
  const w = (26 + hash(seed, 1) * 24) * s;
  const h = (18 + hash(seed, 2) * (tall ? 56 : 28)) * s;
  const faces = ['#f4e2c6', '#f7c9d4', '#e7f4f2', '#f7e7c4', '#e7d4f2', '#efe6dc'];
  const roofs = ['#c25038', '#8a3224', '#3d5566', '#6b4428', '#2a3440', '#c47a3a'];
  const face = faces[Math.floor(hash(seed, 4) * faces.length) % faces.length];
  const roof = roofs[Math.floor(hash(seed, 5) * roofs.length) % roofs.length];
  g.fillStyle = 'rgba(20,16,8,0.26)';
  g.beginPath();
  g.ellipse(x + w * 0.5, y + 7 * s, w * 0.72, 9 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#b89a78';
  g.fillRect(x + w - 5 * s, y - h + 4 * s, 7 * s, h - 4 * s);
  g.fillStyle = face;
  g.fillRect(x, y - h, w, h);
  g.fillStyle = roof;
  if (tall) {
    g.fillRect(x - 2, y - h - 6 * s, w + 8, 7 * s);
  } else {
    g.beginPath();
    g.moveTo(x - 3, y - h + 3);
    g.lineTo(x + w * 0.5, y - h - 12 * s);
    g.lineTo(x + w + 4, y - h + 3);
    g.closePath();
    g.fill();
  }
  const rows = Math.max(1, Math.floor((h - 8) / (11 * s)));
  for (let r = 0; r < rows; r++) {
    g.fillStyle = hash(seed + r, 7) > 0.58 ? '#ffd27a' : '#8ec4d4';
    g.fillRect(x + 4 * s, y - 9 * s - r * 11 * s, 5 * s, 6 * s);
    if (w > 32 * s) g.fillRect(x + w * 0.58, y - 9 * s - r * 11 * s, 5 * s, 6 * s);
  }
  g.fillStyle = '#4e3018';
  g.fillRect(x + w * 0.38, y - 11 * s, 7 * s, 11 * s);
}

function canopy(g, x, y, seed) {
  const big = hash(seed, 9) > 0.7;
  const rx = (big ? 54 : 24) + hash(seed, 1) * (big ? 46 : 26);
  const ry = (big ? 24 : 12) + hash(seed, 2) * (big ? 18 : 12);
  g.fillStyle = 'rgba(10,18,8,0.34)';
  g.beginPath();
  g.ellipse(x + 8, y + 12, rx * 0.92, ry * 0.62, 0, 0, Math.PI * 2);
  g.fill();
  const greens = ['#14381e', '#1d4a28', '#2f6b34', '#3d7a3e', '#16321c', '#4e8a42'];
  const blobs = big ? 5 : 3;
  for (let i = 0; i < blobs; i++) {
    g.fillStyle = greens[Math.floor(hash(seed, 3 + i) * greens.length) % greens.length];
    g.beginPath();
    g.ellipse(
      x + (hash(seed, 10 + i) - 0.5) * rx,
      y - i * 4,
      rx * (0.5 + hash(seed, 20 + i) * 0.38),
      ry * (0.7 + hash(seed, 30 + i) * 0.35),
      hash(seed, 8 + i),
      0,
      Math.PI * 2
    );
    g.fill();
  }
  g.fillStyle = 'rgba(190,214,126,0.38)';
  g.beginPath();
  g.ellipse(x - rx * 0.18, y - ry * 0.4, rx * 0.26, ry * 0.2, 0, 0, Math.PI * 2);
  g.fill();
}

function rock(g, x, y, s) {
  g.fillStyle = 'rgba(20,16,8,0.25)';
  g.beginPath();
  g.ellipse(x + 4, y + 4, 16 * s, 8 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#6e675c';
  g.beginPath();
  g.ellipse(x, y, 16 * s, 9 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#b1a898';
  g.beginPath();
  g.ellipse(x - 4 * s, y - 2 * s, 7 * s, 4 * s, 0, 0, Math.PI * 2);
  g.fill();
}

function coastChain() {
  const chain = [];
  for (let i = 0; i < LAND.length; i++) {
    const a = LAND[i];
    const b = LAND[(i + 1) % LAND.length];
    if (a[1] < 40 && b[1] < 40) continue;
    if (a[1] > 2640 && b[1] > 2640) continue;
    if (a[0] < 40 && b[0] < 40) continue;
    const mx = (a[0] + b[0]) / 2;
    if (mx < 4300) continue;
    if (!chain.length) chain.push(a);
    chain.push(b);
  }
  return curveSamples(chain);
}

function roundedRing(pts) {
  const n = pts.length;
  const out = [];
  const steps = 5;
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const c = pts[i];
    const nxt = pts[(i + 1) % n];
    const x0 = (prev[0] + c[0]) / 2;
    const y0 = (prev[1] + c[1]) / 2;
    const x1 = (c[0] + nxt[0]) / 2;
    const y1 = (c[1] + nxt[1]) / 2;
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const u = 1 - t;
      out.push([u * u * x0 + 2 * u * t * c[0] + t * t * x1, u * u * y0 + 2 * u * t * c[1] + t * t * y1]);
    }
  }
  return out;
}

function paintMottle(g) {
  for (let row = 0, y = 24; y < MAP_H; y += 36, row++) {
    const shift = (row % 2) * 18;
    for (let x = 24 + shift; x < 5720; x += 36) {
      const n = hash(x * 0.017, y * 0.013);
      const px = x + (n - 0.5) * 22;
      const py = y + (hash(x, y) - 0.5) * 16;
      if (!onLand(px, py) || contains(CITY_GROUND, px, py)) continue;
      const mesa = contains(MESA, px, py);
      const lift = n > 0.66 ? 18 : 0;
      g.fillStyle = mesa
        ? `rgba(${158 + lift},${126 + Math.floor(lift * 0.45)},${74},0.42)`
        : `rgba(${14 + Math.floor(n * 36)},${62 + Math.floor(n * 64)},${18},0.38)`;
      g.beginPath();
      g.ellipse(px, py, 14 + n * 16, 8 + n * 9, n * 3.1, 0, Math.PI * 2);
      g.fill();
      if (n > 0.42) {
        g.fillStyle = mesa ? 'rgba(196,164,108,0.28)' : 'rgba(34,92,40,0.28)';
        g.beginPath();
        g.ellipse(px + 8, py - 4, 8 + n * 7, 5 + n * 4, n, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
}

function paintRelief(g) {
  const bowls = [
    [420, 760, 560, 300, 0.15],
    [980, 1280, 480, 200, -0.2],
    [1900, 1960, 640, 240, 0.2],
    [2860, 1640, 420, 160, -0.1]
  ];
  const crests = [
    [1980, 260, 520, 180],
    [2360, 420, 340, 150],
    [860, 1980, 280, 140],
    [3280, 1980, 480, 200]
  ];
  g.save();
  g.globalCompositeOperation = 'multiply';
  for (let i = 0; i < bowls.length; i++) {
    const b = bowls[i];
    const rad = g.createRadialGradient(b[0], b[1], 30, b[0], b[1], Math.max(b[2], b[3]));
    rad.addColorStop(0, 'rgba(58,74,46,0.34)');
    rad.addColorStop(0.55, 'rgba(90,100,70,0.12)');
    rad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rad;
    g.beginPath();
    g.ellipse(b[0], b[1], b[2], b[3], b[4], 0, Math.PI * 2);
    g.fill();
  }
  g.globalCompositeOperation = 'soft-light';
  for (let i = 0; i < crests.length; i++) {
    const peak = crests[i];
    const rad = g.createRadialGradient(peak[0], peak[1], 12, peak[0], peak[1], Math.max(peak[2], peak[3]));
    rad.addColorStop(0, 'rgba(236,226,186,0.9)');
    rad.addColorStop(1, 'rgba(128,128,128,0)');
    g.fillStyle = rad;
    g.beginPath();
    g.ellipse(peak[0], peak[1], peak[2], peak[3], 0.18, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

function cliffFace(g, pts) {
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(232,224,206,0.5)';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.stroke();
  g.strokeStyle = 'rgba(36,28,18,0.55)';
  g.lineWidth = 2;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const steps = Math.max(1, Math.floor(len / 14));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = a[0] + dx * t;
      const y = a[1] + dy * t;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 8, y + 22);
      g.stroke();
    }
  }
  g.restore();
}

function bush(g, x, y, seed) {
  g.fillStyle = 'rgba(12,20,10,0.22)';
  g.beginPath();
  g.ellipse(x + 3, y + 4, 11, 6, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = hash(seed, 2) > 0.5 ? '#3f7a3a' : '#1f4e28';
  g.beginPath();
  g.ellipse(x, y, 10, 6, hash(seed, 4), 0, Math.PI * 2);
  g.fill();
  g.fillStyle = hash(seed, 6) > 0.7 ? '#6a8f3a' : '#2f6b34';
  g.beginPath();
  g.ellipse(x - 4, y - 2, 6, 4, 0, 0, Math.PI * 2);
  g.fill();
}

function offsetChain(pts, dist) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    out.push([pts[i][0] + (dy / len) * dist, pts[i][1] + (-dx / len) * dist]);
  }
  return out;
}

function paintCoast(g) {
  const shore = coastChain();
  if (shore.length < 2) return;
  ribbon(g, offsetChain(shore, 70), 130, 'rgba(64,206,214,0.9)');
  ribbon(g, offsetChain(shore, 130), 110, 'rgba(18,96,140,0.55)');
  ribbon(g, offsetChain(shore, 16), 78, '#f0ddb4');
  ribbon(g, offsetChain(shore, -6), 14, 'rgba(255,252,245,0.72)');
  g.fillStyle = 'rgba(255,252,245,0.82)';
  for (let i = 0; i < shore.length; i += 2) {
    const p = shore[i];
    const q = shore[Math.min(shore.length - 1, i + 1)];
    const j = hash(i, 7);
    g.beginPath();
    g.ellipse(p[0] + 6, p[1], 6 + j * 9, 2.5 + j * 2, Math.atan2(q[1] - p[1], q[0] - p[0]), 0, Math.PI * 2);
    g.fill();
  }
}

function paintFull(roads) {
  const c = document.createElement('canvas');
  c.width = MAP_W;
  c.height = MAP_H;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = true;

  const sea = g.createLinearGradient(4200, 0, MAP_W, MAP_H);
  sea.addColorStop(0, '#1a7e9a');
  sea.addColorStop(0.45, '#0e5674');
  sea.addColorStop(1, '#072c44');
  g.fillStyle = sea;
  g.fillRect(0, 0, MAP_W, MAP_H);
  g.fillStyle = 'rgba(86,206,206,0.28)';
  g.beginPath();
  g.ellipse(5980, 640, 460, 220, 0.5, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(6120, 1680, 520, 240, -0.3, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(10,40,64,0.45)';
  g.beginPath();
  g.ellipse(6300, 2200, 380, 260, 0.2, 0, Math.PI * 2);
  g.fill();

  paintCoast(g);
  g.fillStyle = '#24562c';
  g.fillRect(0, 0, 4700, MAP_H);
  fillShape(g, LAND, '#24562c');
  paintMottle(g);

  for (let i = 0; i < 220; i++) {
    const x = hash(i, 11) * 5200;
    const y = hash(i, 12) * MAP_H;
    if (!onLand(x, y) || contains(CITY_GROUND, x, y)) continue;
    const mesa = contains(MESA, x, y);
    const jungle = contains(ZONE_LAYOUT.jungle_alta.poly, x, y);
    const n = hash(i, 13);
    g.fillStyle = mesa
      ? `rgba(186,154,96,${0.16 + n * 0.14})`
      : jungle
        ? `rgba(12,48,24,${0.18 + n * 0.16})`
        : `rgba(70,128,52,${0.12 + n * 0.12})`;
    g.beginPath();
    g.ellipse(x, y, 36 + n * 70, 18 + n * 28, hash(i, 15) * 2.4, 0, Math.PI * 2);
    g.fill();
  }
  paintRelief(g);

  g.save();
  trace(g, MESA);
  g.clip();
  for (let i = 0; i < 420; i++) {
    const x = 2400 + hash(i, 71) * 1700;
    const y = 1620 + hash(i, 72) * 1000;
    if (!contains(MESA, x, y) || !onLand(x, y)) continue;
    const n = hash(i, 73);
    const dry = n > 0.62;
    g.fillStyle = dry ? `rgba(214,186,122,${0.35 + n * 0.3})` : `rgba(148,112,68,${0.28 + n * 0.22})`;
    g.beginPath();
    g.ellipse(x, y, 16 + n * 28, 9 + n * 14, n * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  cliffFace(g, MESA.slice(0, 4));
  cliffFace(g, RIDGE);

  g.save();
  trace(g, CITY_GROUND);
  g.clip();
  for (let i = 0; i < 520; i++) {
    const x = 2760 + hash(i, 91) * 2700;
    const y = 60 + hash(i, 92) * 1120;
    if (!contains(CITY_GROUND, x, y) || !onLand(x, y)) continue;
    const n = hash(i, 93);
    const downtown = x > 3920 && y < 780;
    g.fillStyle = downtown
      ? `rgba(214,196,164,${0.28 + n * 0.22})`
      : `rgba(168,142,102,${0.16 + n * 0.18})`;
    g.beginPath();
    g.ellipse(x, y, 18 + n * 34, 10 + n * 16, n * 2.6, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 36; i++) {
    const x = 2920 + hash(i, 21) * 2300;
    const y = 140 + hash(i, 22) * 900;
    if (!contains(CITY_GROUND, x, y) || !onLand(x, y)) continue;
    g.fillStyle = 'rgba(62,108,48,0.55)';
    g.beginPath();
    g.ellipse(x, y, 28 + hash(i, 23) * 46, 16 + hash(i, 24) * 18, hash(i, 25), 0, Math.PI * 2);
    g.fill();
  }
  g.restore();

  const coveShore = roundedRing(COVE);
  fillShape(g, COVE, '#0e5870');
  let coveX = 0;
  let coveY = 0;
  for (let i = 0; i < COVE.length; i++) {
    coveX += COVE[i][0];
    coveY += COVE[i][1];
  }
  coveX /= COVE.length;
  coveY /= COVE.length;
  const toward = (p, dist) => {
    const dx = coveX - p[0];
    const dy = coveY - p[1];
    const len = Math.hypot(dx, dy) || 1;
    return [p[0] + (dx / len) * dist, p[1] + (dy / len) * dist];
  };
  const shallows = coveShore.map((p) => toward(p, 30));
  ribbon(g, shallows.concat([shallows[0]]), 54, 'rgba(118,210,204,0.62)');
  ribbon(g, shallows.concat([shallows[0]]), 22, 'rgba(198,238,230,0.4)');
  const beach = coveShore.map((p) => toward(p, -16));
  ribbon(g, beach.concat([beach[0]]), 34, '#e6d2a6');
  ribbon(g, beach.concat([beach[0]]), 12, '#f4e7c8');
  g.fillStyle = 'rgba(255,252,245,0.75)';
  for (let i = 0; i < coveShore.length; i += 3) {
    const p = coveShore[i];
    const q = coveShore[(i + 1) % coveShore.length];
    const n = hash(i, 49);
    g.beginPath();
    g.ellipse(p[0], p[1], 5 + n * 6, 2.2, Math.atan2(q[1] - p[1], q[0] - p[0]), 0, Math.PI * 2);
    g.fill();
  }

  const river = curveSamples(RIVER_PTS);
  ribbon(g, river, 128, '#f0ddb4');
  ribbon(g, river, 96, '#c6a56c');
  ribbon(g, river, 54, '#0c6280');
  ribbon(g, river, 30, '#2aa4bc');
  ribbon(g, river, 8, 'rgba(232,250,250,0.7)');
  for (let i = 3; i < river.length; i += 6) {
    const p = river[i];
    const q = river[Math.min(river.length - 1, i + 1)];
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const len = Math.hypot(dx, dy) || 1;
    const n = hash(i, 55);
    const side = n > 0.5 ? 1 : -1;
    g.fillStyle = n > 0.72 ? '#f6e8c8' : '#e4cc90';
    g.beginPath();
    g.ellipse(p[0] + (-dy / len) * 50 * side, p[1] + (dx / len) * 50 * side, 26 + n * 22, 12 + n * 8, Math.atan2(dy, dx), 0, Math.PI * 2);
    g.fill();
  }
  const inlet = curveSamples(INLET_PTS);
  ribbon(g, inlet, 48, '#f0ddb4');
  ribbon(g, inlet, 22, '#187088');
  const deltaA = curveSamples([[1760, 1980], [1640, 2160], [1500, 2320]]);
  ribbon(g, deltaA, 28, '#f0ddb4');
  ribbon(g, deltaA, 12, '#1a6e86');
  const deltaB = curveSamples([[2220, 1880], [2400, 2060], [2340, 2260]]);
  ribbon(g, deltaB, 26, '#e7d2a4');
  ribbon(g, deltaB, 10, '#187488');

  ribbon(g, RIDGE, 22, '#4a4038');
  ribbon(g, RIDGE, 6, '#d9d0c2');
  for (let i = 0; i < RIDGE.length - 1; i++) {
    const a = RIDGE[i];
    const b = RIDGE[i + 1];
    g.strokeStyle = 'rgba(40,32,24,0.45)';
    g.lineWidth = 2;
    for (let t = 0.15; t < 1; t += 0.22) {
      const x = a[0] + (b[0] - a[0]) * t;
      const y = a[1] + (b[1] - a[1]) * t;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 10, y + 16);
      g.stroke();
    }
  }

  patch(g, 280, 640, 170, 78, -0.35, '#c2b15a');
  patch(g, 200, 860, 120, 58, 0.25, '#8eaa48');
  patch(g, 460, 340, 100, 48, 0.2, '#d2c06a');
  patch(g, 720, 2080, 180, 70, -0.18, '#7f9a3c');
  patch(g, 1680, 2100, 200, 72, 0.28, '#c6b25e');
  patch(g, 2140, 2180, 130, 52, -0.4, '#9aaa46');
  patch(g, 1040, 1720, 150, 52, 0.12, '#6e8a38');
  patch(g, 2480, 2060, 110, 46, 0.4, '#b7a84e');

  const roadPaths = ROAD_NETWORK.concat(SCENIC_ROADS.map((poly) => poly.map((p) => ({ x: p[0], y: p[1] })))).concat(CITY_AVENUES.map((poly) => poly.map((p) => ({ x: p[0], y: p[1] }))));
  if (roads) {
    for (let i = 0; i < roads.length; i++) roadLine(g, roads[i], i === 0 ? 18 : 12);
  }
  for (let i = 0; i < SCENIC_ROADS.length; i++) roadLine(g, SCENIC_ROADS[i], i === 2 ? 12 : 14);
  for (let i = 0; i < CITY_AVENUES.length; i++) roadLine(g, CITY_AVENUES[i], i < 3 ? 16 : 12);

  const farms = [[180, 1320, -0.4], [980, 1480, 0.3], [1480, 2140, 0.55], [2060, 2280, -0.2], [640, 1980, 0.15], [1760, 1280, -0.5], [2480, 1480, 0.4]];
  for (let i = 0; i < farms.length; i++) {
    const spot = farms[i];
    if (!onLand(spot[0], spot[1]) || contains(COVE, spot[0], spot[1]) || contains(CITY_GROUND, spot[0], spot[1])) continue;
    if (blocked(spot[0], spot[1], 10) || nearPath(spot[0], spot[1], roadPaths, 48)) continue;
    farmstead(g, spot[0], spot[1], spot[2], 30 + i);
  }

  g.fillStyle = '#3e4650';
  g.save();
  g.translate(3480, 2280);
  g.rotate(-0.08);
  g.fillRect(-280, -12, 560, 22);
  g.fillStyle = '#f4f1ea';
  for (let i = 0; i < 10; i++) g.fillRect(-250 + i * 52, -2, 22, 4);
  g.restore();
  g.fillStyle = '#3e4650';
  g.save();
  g.translate(4820, 1470);
  g.rotate(-0.04);
  g.fillRect(-260, -11, 540, 20);
  g.fillStyle = '#f7f4ee';
  for (let i = 0; i < 9; i++) g.fillRect(-230 + i * 54, -2, 20, 3);
  g.restore();

  g.save();
  trace(g, ZONE_LAYOUT.jungle_alta.poly);
  g.clip();
  g.fillStyle = 'rgba(10,36,18,0.42)';
  g.fillRect(0, 1300, 1700, 1400);
  g.restore();

  for (let i = 0; i < 160; i++) {
    const x = 60 + hash(i, 81) * 2500;
    const y = 40 + hash(i, 82) * 1600;
    if (!onLand(x, y) || blocked(x, y) || nearPath(x, y, roadPaths, 26)) continue;
    if (contains(CITY_GROUND, x, y) || contains(MESA, x, y)) continue;
    canopy(g, x, y, i + 90);
  }
  for (let i = 0; i < 280; i++) {
    const x = hash(i, 31) * 4300;
    const y = 80 + hash(i, 32) * 2500;
    if (!onLand(x, y) || blocked(x, y) || nearPath(x, y, roadPaths, 28)) continue;
    if (contains(MESA, x, y) && hash(i, 33) > 0.22) continue;
    if (contains(CITY_GROUND, x, y)) continue;
    canopy(g, x, y, i + 3);
  }
  for (let i = 0; i < 120; i++) {
    const x = 80 + hash(i, 101) * 1280;
    const y = 1480 + hash(i, 102) * 1080;
    if (!contains(ZONE_LAYOUT.jungle_alta.poly, x, y) || !onLand(x, y) || blocked(x, y) || nearPath(x, y, roadPaths, 24)) continue;
    canopy(g, x, y, i + 210);
    if (hash(i, 104) > 0.45) canopy(g, x + 22, y + 8, i + 410);
  }
  for (let i = 0; i < 220; i++) {
    const x = hash(i, 61) * 4300;
    const y = 80 + hash(i, 62) * 2500;
    if (!onLand(x, y) || blocked(x, y) || nearPath(x, y, roadPaths, 22)) continue;
    if (contains(CITY_GROUND, x, y)) continue;
    bush(g, x, y, i + 9);
  }
  for (let i = 0; i < 40; i++) {
    const x = 1500 + hash(i, 41) * 1100;
    const y = 160 + hash(i, 42) * 1100;
    if (!onLand(x, y) || blocked(x, y) || nearPath(x, y, roadPaths, 36)) continue;
    if (contains(CITY_GROUND, x, y)) continue;
    rock(g, x, y, 0.55 + hash(i, 43));
  }

  const villages = [[440, 1080], [780, 2040], [1860, 2140]];
  for (let v = 0; v < villages.length; v++) {
    for (let k = 0; k < 5; k++) {
      const x = villages[v][0] + (hash(v, k) - 0.5) * 90;
      const y = villages[v][1] + (hash(k, v) - 0.5) * 60;
      if (!onLand(x, y) || blocked(x, y, 20)) continue;
      house(g, x, y, v * 20 + k, 0.72);
    }
  }

  let houseN = 0;
  for (let a = 0; a < CITY_AVENUES.length; a++) {
    const poly = curveSamples(CITY_AVENUES[a]);
    for (let i = 0; i < poly.length - 1; i += 1) {
      const p = poly[i];
      const q = poly[Math.min(poly.length - 1, i + 1)];
      const dx = q[0] - p[0];
      const dy = q[1] - p[1];
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      for (let side = -1; side <= 1; side += 2) {
        houseN += 1;
        const downtown = p[0] > 3920 && p[1] < 760;
        const gap = downtown ? 40 + hash(houseN, 1) * 14 : 56 + hash(houseN, 1) * 20;
        const x = p[0] + nx * gap * side;
        const y = p[1] + ny * gap * side;
        if (!contains(CITY_GROUND, x, y) || !onLand(x, y) || contains(COVE, x, y)) continue;
        if (blocked(x, y) || nearPath(x, y, roadPaths, 30)) continue;
        const scale = downtown ? 1.55 + hash(houseN, 2) * 0.85 : 0.72 + hash(houseN, 3) * 0.4;
        house(g, x, y, houseN + 4, scale);
        if (downtown && hash(houseN, 8) > 0.35) {
          const packed = 18 + hash(houseN, 9) * 10;
          const px = x + nx * packed * side;
          const py = y + ny * packed * side;
          if (contains(CITY_GROUND, px, py) && onLand(px, py) && !blocked(px, py)) {
            house(g, px, py, houseN + 80, 1.15 + hash(houseN, 6) * 0.7);
          }
        }
      }
    }
  }

  for (let i = 0; i < 28; i++) {
    const x = 200 + hash(i, 51) * 900;
    const y = 200 + hash(i, 52) * 1000;
    if (blocked(x, y) || !onLand(x, y)) continue;
    palm(g, x, y, 0.48 + hash(i, 53) * 0.4);
  }
  const shore = coastChain();
  for (let i = 0; i < shore.length; i += 4) {
    const p = shore[i];
    const q = shore[Math.min(shore.length - 1, i + 1)];
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const len = Math.hypot(dx, dy) || 1;
    const x = p[0] + (-dy / len) * 48;
    const y = p[1] + (dx / len) * 48;
    if (!onLand(x, y) || blocked(x, y)) continue;
    palm(g, x, y, 0.62);
  }

  for (let i = 0; i < 4; i++) {
    const x = 3720 + i * 80;
    g.strokeStyle = '#8a6238';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(x, 1540);
    g.lineTo(x + 8, 1680);
    g.stroke();
    g.strokeStyle = '#c4a06a';
    g.lineWidth = 3;
    for (let k = 0; k < 5; k++) {
      g.beginPath();
      g.moveTo(x - 16, 1556 + k * 18);
      g.lineTo(x + 28, 1568 + k * 18);
      g.stroke();
    }
  }
  g.strokeStyle = '#e6b84a';
  g.lineWidth = 4;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(3780, 1560);
  g.lineTo(3800, 1440);
  g.lineTo(3900, 1430);
  g.stroke();
  g.beginPath();
  g.moveTo(4040, 1580);
  g.lineTo(4060, 1460);
  g.lineTo(4160, 1450);
  g.stroke();

  const crates = ['#c25038', '#3d6ea8', '#e6c35a', '#7d3b5c'];
  for (let i = 0; i < crates.length; i++) {
    const x = 3380 + i * 46;
    const y = 1505;
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(x + 3, y + 3, 34, 16);
    g.fillStyle = crates[i];
    g.fillRect(x, y, 34, 16);
  }

  g.save();
  g.globalCompositeOperation = 'soft-light';
  const sun = g.createLinearGradient(0, 0, MAP_W, MAP_H);
  sun.addColorStop(0, 'rgba(255,236,200,0.45)');
  sun.addColorStop(0.55, 'rgba(255,255,255,0)');
  sun.addColorStop(1, 'rgba(30,40,60,0.22)');
  g.fillStyle = sun;
  g.fillRect(0, 0, MAP_W, MAP_H);
  g.restore();
  return c;
}

export function paintTerrainTiles(roads) {
  const full = paintFull(roads || []);
  const tiles = [];
  for (let row = 0; row < MAP_H / TILE_H; row++) {
    for (let col = 0; col < MAP_W / TILE_W; col++) {
      const tile = document.createElement('canvas');
      tile.width = TILE_W;
      tile.height = TILE_H;
      const g = tile.getContext('2d');
      g.drawImage(full, col * TILE_W, row * TILE_H, TILE_W, TILE_H, 0, 0, TILE_W, TILE_H);
      tiles.push({ canvas: tile, x: col * TILE_W, y: row * TILE_H, key: `go-world-${col}-${row}` });
    }
  }
  return tiles;
}

export function drawExtended(g) {
  g.clear();
  g.fillStyle(0x0c4a62, 1);
  g.fillRect(0, 0, MAP_W, MAP_H);
  g.fillStyle(0x2f6b34, 1);
  g.beginPath();
  g.moveTo(LAND[0][0], LAND[0][1]);
  for (let i = 1; i < LAND.length; i++) g.lineTo(LAND[i][0], LAND[i][1]);
  g.closePath();
  g.fillPath();
  g.fillStyle(0x14627a, 1);
  g.beginPath();
  g.moveTo(COVE[0][0], COVE[0][1]);
  for (let i = 1; i < COVE.length; i++) g.lineTo(COVE[i][0], COVE[i][1]);
  g.closePath();
  g.fillPath();
}

export function bootAtmosphere(scene) {
  if (!scene || scene._goSky) return;
  const cloud = document.createElement('canvas');
  cloud.width = 256;
  cloud.height = 140;
  const cg = cloud.getContext('2d');
  const rad = cg.createRadialGradient(128, 70, 8, 128, 70, 120);
  rad.addColorStop(0, 'rgba(36,44,32,0.22)');
  rad.addColorStop(1, 'rgba(36,44,32,0)');
  cg.fillStyle = rad;
  cg.fillRect(0, 0, 256, 140);
  if (!scene.textures.exists('go-cloud')) scene.textures.addCanvas('go-cloud', cloud);
  const bird = document.createElement('canvas');
  bird.width = 28;
  bird.height = 16;
  const bg = bird.getContext('2d');
  bg.strokeStyle = '#24180f';
  bg.lineWidth = 2;
  bg.lineCap = 'round';
  bg.beginPath();
  bg.moveTo(2, 11);
  bg.quadraticCurveTo(8, 2, 14, 9);
  bg.quadraticCurveTo(20, 2, 26, 11);
  bg.stroke();
  if (!scene.textures.exists('go-bird')) scene.textures.addCanvas('go-bird', bird);
  const clouds = [];
  for (let i = 0; i < 4; i++) {
    clouds.push(scene.add.image(600 + i * 1500, 360 + (i % 2) * 700, 'go-cloud').setDepth(1).setScale(5 + i * 0.35).setAlpha(0.7));
  }
  const birds = [];
  for (let i = 0; i < 5; i++) birds.push(scene.add.image(0, 0, 'go-bird').setDepth(8));
  const shimmer = scene.add.graphics().setDepth(1);
  scene._goSky = { clouds, birds, shimmer };
}

export function driftAtmosphere(scene) {
  if (!scene) return;
  bootAtmosphere(scene);
  const sky = scene._goSky;
  if (!sky) return;
  const t = scene.phase || 0;
  for (let i = 0; i < sky.clouds.length; i++) {
    const img = sky.clouds[i];
    img.x = ((i * 1600 + t * (16 + i * 5)) % (MAP_W + 700)) - 200;
    img.y = 260 + (i % 3) * 560 + Math.sin(t * 0.12 + i) * 26;
  }
  for (let i = 0; i < sky.birds.length; i++) {
    const u = (t * 0.018 + i * 0.19) % 1;
    sky.birds[i].setPosition(180 + u * 5000, 160 + (i * 210) % 1200 + Math.sin(t * 0.7 + i) * 20);
    sky.birds[i].setScale(Math.cos(t * 0.4 + i) >= 0 ? 1 : -1, 1);
  }
  const sg = sky.shimmer;
  sg.clear();
  sg.fillStyle(0xf4fbfd, 0.55);
  for (let i = 0; i < RIVER_PTS.length - 1; i++) {
    const a = RIVER_PTS[i];
    const b = RIVER_PTS[i + 1];
    const u = (t * 0.2 + i * 0.17) % 1;
    sg.fillCircle(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, 3);
  }
  for (let i = 0; i < HARBOR_PTS.length - 1; i++) {
    const a = HARBOR_PTS[i];
    const b = HARBOR_PTS[i + 1];
    const u = (t * 0.25 + i * 0.2) % 1;
    sg.fillCircle(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, 2.4);
  }
}

export { CITY_LOOP };

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
