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
  HILL_RIDGE,
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
import { box, gable, hash, palm, shadow } from './art/kit.js';

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

function roadFlat(pts, width) {
  const src = pts[0] && pts[0].x != null ? pts.map((p) => [p.x, p.y]) : pts;
  return curveSamples(filletPts(src, width >= 16 ? 96 : 58));
}

function roadLine(g, pts, width) {
  const flat = roadFlat(pts, width);
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

function dirtRoad(g, pts, width) {
  const flat = roadFlat(pts, width);
  ribbon(g, flat, width + 18, '#cbb892');
  ribbon(g, flat, width, '#a67c4a');
  ribbon(g, flat, Math.max(3, width * 0.22), 'rgba(86,58,30,0.45)');
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

function edgeDistance(x, y, poly) {
  let best = 1e9;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy || 1;
    let t = ((x - a[0]) * dx + (y - a[1]) * dy) / len2;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const px = a[0] + dx * t - x;
    const py = a[1] + dy * t - y;
    const d = px * px + py * py;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

function pushFlat(segs, flat) {
  for (let i = 0; i < flat.length - 1; i++) {
    const ax = flat[i][0];
    const ay = flat[i][1];
    const bx = flat[i + 1][0];
    const by = flat[i + 1][1];
    const dx = bx - ax;
    const dy = by - ay;
    segs.push({ ax, ay, dx, dy, len2: dx * dx + dy * dy || 1 });
  }
}

function indexRoads(roads, cell) {
  const segs = [];
  for (let i = 0; i < CITY_AVENUES.length; i++) pushFlat(segs, roadFlat(CITY_AVENUES[i], i < 3 ? 16 : 12));
  for (let i = 0; i < SCENIC_ROADS.length; i++) pushFlat(segs, roadFlat(SCENIC_ROADS[i], i === 2 ? 12 : 14));
  const dirt = roads && roads.length ? roads : [];
  for (let i = 0; i < dirt.length; i++) pushFlat(segs, roadFlat(dirt[i], i === 0 ? 16 : 11));
  const buckets = new Map();
  for (let s = 0; s < segs.length; s++) {
    const seg = segs[s];
    const minx = Math.min(seg.ax, seg.ax + seg.dx);
    const maxx = Math.max(seg.ax, seg.ax + seg.dx);
    const miny = Math.min(seg.ay, seg.ay + seg.dy);
    const maxy = Math.max(seg.ay, seg.ay + seg.dy);
    const x0 = Math.floor(minx / cell);
    const x1 = Math.floor(maxx / cell);
    const y0 = Math.floor(miny / cell);
    const y1 = Math.floor(maxy / cell);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const key = (x + 128) * 8192 + (y + 128);
        let bucket = buckets.get(key);
        if (!bucket) buckets.set(key, (bucket = []));
        bucket.push(seg);
      }
    }
  }
  return { buckets, cell };
}

function segDist(x, y, index) {
  const cell = index.cell;
  const cx = Math.floor(x / cell);
  const cy = Math.floor(y / cell);
  let best = cell * cell * 4;
  for (let ix = cx - 1; ix <= cx + 1; ix++) {
    for (let iy = cy - 1; iy <= cy + 1; iy++) {
      const bucket = index.buckets.get((ix + 128) * 8192 + (iy + 128));
      if (!bucket) continue;
      for (let i = 0; i < bucket.length; i++) {
        const s = bucket[i];
        let t = ((x - s.ax) * s.dx + (y - s.ay) * s.dy) / s.len2;
        if (t < 0) t = 0;
        else if (t > 1) t = 1;
        const px = s.ax + s.dx * t - x;
        const py = s.ay + s.dy * t - y;
        const d = px * px + py * py;
        if (d < best) best = d;
      }
    }
  }
  return Math.sqrt(best);
}

function lotClear(x, y) {
  let best = 1e9;
  for (let i = 0; i < BUILD_SLOTS.length; i++) {
    const s = BUILD_SLOTS[i];
    const d = Math.hypot(s.x - x, s.y - y);
    if (d < best) best = d;
  }
  const lots = Object.values(LOT_POS);
  for (let i = 0; i < lots.length; i++) {
    const d = Math.hypot(lots[i].x - x, lots[i].y - y);
    if (d < best) best = d;
  }
  return best;
}

function ramp(dist, inner, outer) {
  if (dist <= inner) return 0;
  if (dist >= outer) return 1;
  return (dist - inner) / (outer - inner);
}

function coverScale(x, y, index, fields) {
  const road = segDist(x, y, index);
  let field = 1e9;
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    let d;
    if (f.ell) {
      const n = Math.hypot((x - f.cx) / f.rx, (y - f.cy) / f.ry);
      d = n <= 1 ? 0 : (n - 1) * Math.min(f.rx, f.ry);
    } else {
      const dx = Math.max(f.x0 - x, 0, x - f.x1);
      const dy = Math.max(f.y0 - y, 0, y - f.y1);
      d = dx === 0 && dy === 0 ? 0 : Math.hypot(dx, dy);
    }
    if (d < field) field = d;
  }
  const city = contains(CITY_GROUND, x, y) ? 0 : edgeDistance(x, y, CITY_GROUND);
  const lotRaw = lotClear(x, y);
  const lot = lotRaw < 78 ? 0 : lotRaw - 78;
  return Math.min(ramp(road, 22, 210), ramp(field, 10, 210), ramp(city, 16, 180), ramp(lot, 8, 150));
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

function organic(g, rx, ry, spin) {
  g.beginPath();
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const wob = 0.76 + 0.24 * Math.sin(a * 3 + spin);
    const px = Math.cos(a) * rx * wob;
    const py = Math.sin(a) * ry * (0.86 + 0.18 * Math.cos(a * 2 + spin * 0.7));
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
}

function patch(g, x, y, rx, ry, rot, color) {
  g.save();
  g.translate(x + 8, y + 10);
  g.rotate(rot);
  g.fillStyle = 'rgba(16,20,8,0.22)';
  organic(g, rx * 1.04, ry * 1.1, x * 0.01);
  g.fill();
  g.restore();
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = 'rgba(62,92,40,0.42)';
  organic(g, rx * 1.16, ry * 1.22, x * 0.01 + 1.2);
  g.fill();
  g.fillStyle = color;
  organic(g, rx, ry, x * 0.01);
  g.fill();
  g.save();
  organic(g, rx * 0.94, ry * 0.9, x * 0.01);
  g.clip();
  g.strokeStyle = 'rgba(62,48,18,0.48)';
  g.lineWidth = 1.5;
  const rows = Math.max(5, Math.round((ry * 2) / 13));
  for (let i = 1; i < rows; i++) {
    const t = i / rows;
    const py = -ry * 0.86 + t * ry * 1.72;
    const half = Math.sqrt(Math.max(0.04, 1 - (py / ry) * (py / ry))) * rx * 0.78;
    const bow = Math.sin(t * 5.2 + rot) * ry * 0.12;
    g.beginPath();
    g.moveTo(-half, py + bow * 0.3);
    g.quadraticCurveTo(0, py + bow, half, py - bow * 0.25);
    g.stroke();
  }
  g.restore();
  g.restore();
}

function plotFrame(w, h, seed) {
  return {
    ang: (hash(seed, 2) - 0.5) * 0.5,
    sw: w * (0.82 + hash(seed, 3) * 0.36),
    sh: h * (0.8 + hash(seed, 4) * 0.38)
  };
}

function plotField(plot) {
  const frame = plotFrame(plot.w, plot.h, plot.seed);
  const c = Math.abs(Math.cos(frame.ang));
  const s = Math.abs(Math.sin(frame.ang));
  const hw = (frame.sw * c + frame.sh * s) / 2 + 12;
  const hh = (frame.sw * s + frame.sh * c) / 2 + 12;
  const cx = plot.x + plot.w / 2;
  const cy = plot.y + plot.h / 2;
  return { x0: cx - hw, y0: cy - hh, x1: cx + hw, y1: cy + hh };
}

function placePlots(roadPaths) {
  const plots = [];
  const planted = [];
  const farmAnchors = [
    [280, 460],
    [760, 680],
    [1780, 480],
    [1080, 1220],
    [420, 1780],
    [880, 1700],
    [640, 2160],
    [1620, 1760],
    [2920, 1760]
  ];
  const farmShifts = [[160, 36], [-160, 48], [36, 150], [48, -150], [170, 110], [-150, 120]];
  for (let i = 0; i < farmAnchors.length; i++) {
    const anchor = farmAnchors[i];
    for (let s = 0; s < farmShifts.length; s++) {
      const x = anchor[0] + farmShifts[s][0];
      const y = anchor[1] + farmShifts[s][1];
      if (!onLand(x, y) || contains(COVE, x, y) || contains(CITY_GROUND, x, y)) continue;
      if (nearPath(x, y, roadPaths, 42)) continue;
      plots.push({ x: x - 130, y: y - 72, w: 260, h: 148, seed: 40 + i });
      planted.push([x, y]);
      break;
    }
  }
  const compounds = [[200, 1320], [1540, 300], [2060, 2280], [2360, 1240], [520, 860]];
  for (let i = 0; i < compounds.length; i++) {
    const spot = compounds[i];
    if (!onLand(spot[0], spot[1]) || contains(COVE, spot[0], spot[1]) || contains(CITY_GROUND, spot[0], spot[1])) continue;
    if (blocked(spot[0], spot[1], 10) || nearPath(spot[0], spot[1], roadPaths, 70)) continue;
    plots.push({
      x: spot[0] - 40,
      y: spot[1] - 30,
      w: 220,
      h: 130,
      seed: 90 + i,
      hx: spot[0] + 190,
      hy: spot[1] + 24,
      house: 110 + i
    });
    planted.push(spot);
  }
  return { plots, planted };
}

function crowdLot(x, y) {
  const r2 = 74 * 74;
  for (let i = 0; i < BUILD_SLOTS.length; i++) {
    const s = BUILD_SLOTS[i];
    const dx = s.x - x;
    const dy = s.y - y;
    if (dx * dx + dy * dy < r2) return true;
  }
  const lots = Object.values(LOT_POS);
  for (let i = 0; i < lots.length; i++) {
    const dx = lots[i].x - x;
    const dy = lots[i].y - y;
    if (dx * dx + dy * dy < r2) return true;
  }
  return false;
}

function packTown(g, index) {
  const KX = 0.62;
  const KY = 0.34;
  let row = 0;
  for (let y = 70; y <= 1140; y += 8) {
    row += 1;
    let col = 0;
    for (let x = 2740; x <= 5380; x += 15) {
      col += 1;
      const jx = x + (hash(row, col) - 0.5) * 8;
      const jy = y + (hash(col, row + 5) - 0.5) * 3;
      if (!contains(CITY_GROUND, jx, jy) || !onLand(jx, jy) || contains(COVE, jx, jy)) continue;
      const depth = edgeDistance(jx, jy, CITY_GROUND);
      if (depth < 24) continue;
      const t = Math.min(1, (depth - 24) / 200);
      if (hash(row + 3, col + 9) > 0.28 + t * 0.7) continue;
      const bump = hash(row, col + 11) > 0.94 ? 1.28 : 1;
      const scale = (0.64 + t * 0.38) * (0.84 + hash(row, col + 2) * 0.3) * bump;
      const seed = row * 17 + col * 3;
      const span = townSpan(seed, scale);
      const cx = jx + span.w * 0.55;
      const cy = jy - span.d * KY * 0.4;
      if (crowdLot(cx, cy)) continue;
      const center = segDist(cx, cy, index);
      if (center < 16) continue;
      if (center < 84) {
        const pts = [
          [jx, jy],
          [jx + span.w, jy],
          [jx + span.w + span.d * KX, jy - span.d * KY],
          [jx + span.d * KX, jy - span.h - span.d * KY]
        ];
        let onStreet = false;
        for (let p = 0; p < pts.length; p++) {
          if (segDist(pts[p][0], pts[p][1], index) < 13) {
            onStreet = true;
            break;
          }
        }
        if (onStreet) continue;
      }
      house(g, jx, jy, seed, scale, 'town');
    }
  }
}

function cropPlot(g, x, y, w, h, seed) {
  const frame = plotFrame(w, h, seed);
  const left = -frame.sw / 2;
  const top = -frame.sh / 2;
  g.save();
  g.translate(x + w / 2, y + h / 2);
  g.rotate(frame.ang);
  g.fillStyle = 'rgba(28,16,8,0.4)';
  g.fillRect(left + 8, top + 10, frame.sw + 8, frame.sh + 8);
  for (let i = 5; i >= 1; i--) {
    const pad = 4 + i * 6;
    g.fillStyle = `rgba(58,36,18,${0.07 + (5 - i) * 0.045})`;
    g.fillRect(left - pad, top - pad, frame.sw + pad * 2, frame.sh + pad * 2);
  }
  g.fillStyle = '#5c3c24';
  g.fillRect(left - 10, top - 10, frame.sw + 20, frame.sh + 20);
  g.fillStyle = '#b08958';
  g.fillRect(left, top, frame.sw, frame.sh);
  g.fillStyle = '#8a6238';
  g.fillRect(left + 5, top + 5, frame.sw - 10, 5);
  g.fillRect(left, top + frame.sh - 8, frame.sw, 8);
  const plants = ['#8a3424', '#a3462c', '#6e3a22', '#c25830', '#7a3e28', '#3f6e32'];
  for (let row = 10; row < frame.sh - 10; row += 11) {
    g.fillStyle = '#7a5434';
    g.fillRect(left + 6, top + row + 3, frame.sw - 12, 2);
    for (let col = 8; col < frame.sw - 6; col += 12) {
      const n = hash(seed + col, row);
      g.fillStyle = plants[Math.floor(n * plants.length) % plants.length];
      g.beginPath();
      g.ellipse(left + col, top + row, 4.2, 2.5, (n - 0.5) * 0.8, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
}

function townSpan(seed, scale) {
  const s = scale || 1;
  return {
    w: (32 + hash(seed, 1) * 18) * s,
    d: (38 + hash(seed, 2) * 16) * s,
    h: (2 + hash(seed, 3) * 2) * s
  };
}

function house(g, x, y, seed, scale, kind) {
  const s = scale || 1;
  const town = kind === 'town';
  const span = town
    ? townSpan(seed, s)
    : {
        w: (30 + hash(seed, 1) * 14) * s,
        d: (18 + hash(seed, 2) * 8) * s,
        h: (14 + hash(seed, 3) * 10) * s
      };
  const ww = span.w;
  const dd = span.d;
  const hh = span.h;
  const face = town ? '#9aabba' : '#f4e2c6';
  const side = town ? '#7d8c9c' : '#c9aa84';
  const townRoofs = ['#4a6278', '#3e5670', '#5a7084', '#2f4560', '#607488', '#3a4e62'];
  const ruralRoofs = ['#c25038', '#8a4034', '#5c6e80', '#6b4428', '#4a5c6c'];
  const roofs = town ? townRoofs : ruralRoofs;
  const roof = roofs[Math.floor(hash(seed, 5) * roofs.length) % roofs.length];
  const roofSide = town ? '#3a4a58' : '#6a3024';
  shadow(g, x + ww * 0.62, y + 5 * s, Math.max(16, ww * 0.58));
  box(g, x, y, ww, dd, hh, face, side, roof);
  if (!town || hash(seed, 6) > 0.78) gable(g, x, y, ww, dd, hh, 7 * s, roof, roofSide);
  if (!town) {
    g.fillStyle = '#7eb4c4';
    g.fillRect(x + 5 * s, y - hh * 0.62, 5 * s, 4 * s);
    g.fillStyle = '#4e3018';
    g.fillRect(x + ww * 0.4, y - 7 * s, 5 * s, 7 * s);
  }
}

function yard(g, x, y, seed) {
  g.fillStyle = 'rgba(16,28,10,0.24)';
  g.beginPath();
  g.ellipse(x + 8, y + 10, 72, 36, 0.08, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#c4a36e';
  g.beginPath();
  g.ellipse(x, y, 66, 32, 0.08, 0, Math.PI * 2);
  g.fill();
  const count = 3 + Math.floor(hash(seed, 2) * 3);
  for (let i = 0; i < count; i++) {
    const a = hash(seed, 10 + i) * Math.PI * 2;
    const hx = x + Math.cos(a) * (22 + hash(seed, 20 + i) * 28);
    const hy = y + Math.sin(a) * (12 + hash(seed, 30 + i) * 16);
    if (!onLand(hx, hy)) continue;
    house(g, hx, hy, seed + i * 9, 0.85, 'rural');
  }
}

function canopy(g, x, y, seed, scale) {
  const sc = scale || 1;
  const kind = hash(seed, 9);
  const rx = (kind > 0.7 ? 62 + hash(seed, 1) * 34 : kind > 0.35 ? 36 + hash(seed, 1) * 20 : 20 + hash(seed, 1) * 12) * sc;
  const ry = rx * (0.48 + hash(seed, 2) * 0.14);
  g.save();
  g.globalAlpha = 0.34;
  g.fillStyle = '#14321c';
  g.beginPath();
  g.ellipse(x, y - ry * 0.02, rx * 1.42, ry * 1.55, 0.1, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.fillStyle = 'rgba(48,40,22,0.26)';
  g.beginPath();
  g.ellipse(x + rx * 0.42, y + ry * 0.9, rx * 0.95, ry * 0.5, 0.3, 0, Math.PI * 2);
  g.fill();
  const greens = ['#1a4024', '#245632', '#16361e', '#2d6238', '#1e4a2c', '#14321c', '#326840', '#1c4428'];
  const blobs = kind > 0.7 ? 5 : kind > 0.35 ? 4 : 3;
  for (let i = 0; i < blobs; i++) {
    g.fillStyle = i === 0 ? '#2f4c32' : greens[Math.floor(hash(seed, 3 + i) * greens.length) % greens.length];
    g.beginPath();
    g.ellipse(
      x + (hash(seed, 10 + i) - 0.45) * rx * 0.8,
      y + (hash(seed, 20 + i) - 0.62) * ry * 0.55 - i * 1.1,
      rx * (0.38 + hash(seed, 30 + i) * 0.36),
      ry * (0.55 + hash(seed, 40 + i) * 0.38),
      (hash(seed, 8 + i) - 0.5) * 1.4,
      0,
      Math.PI * 2
    );
    g.fill();
  }
  g.fillStyle = 'rgba(120,168,64,0.22)';
  g.beginPath();
  g.ellipse(x - rx * 0.24, y - ry * 0.48, rx * 0.24, ry * 0.16, -0.45, 0, Math.PI * 2);
  g.fill();
}

function clump(g, x, y, seed, scale) {
  const sc = scale || 1;
  canopy(g, x, y, seed, sc);
  if (sc > 0.6 && hash(seed, 11) > 0.22) {
    canopy(g, x + (20 + hash(seed, 16) * 26) * sc, y + (8 + hash(seed, 18) * 10) * sc, seed + 19, sc * 0.9);
  }
  if (sc > 0.78 && hash(seed, 12) > 0.58) {
    canopy(g, x - (22 + hash(seed, 17) * 14) * sc, y + 12 * sc, seed + 37, sc * 0.86);
  }
}

function plantTree(g, x, y, seed, scale) {
  if (scale < 0.08) return;
  if (hash(seed, 8) > scale * 0.82 + 0.18) return;
  let sc = scale;
  if (hash(Math.floor(x / 280), Math.floor(y / 200) + 3) > 0.9) sc *= 0.55;
  if (sc < 0.42) {
    bush(g, x, y, seed);
    return;
  }
  clump(g, x, y, seed, 0.4 + sc * 0.6);
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

function coastChains() {
  const n = LAND.length;
  const runs = [];
  let cur = null;
  for (let i = 0; i < n; i++) {
    const a = LAND[i];
    const b = LAND[(i + 1) % n];
    const border = (a[1] < 48 && b[1] < 48) || (a[0] < 48 && b[0] < 48) || (a[1] > MAP_H - 90 && b[1] > MAP_H - 90);
    if (border) {
      cur = null;
      continue;
    }
    if (!cur) {
      cur = [a, b];
      runs.push(cur);
    } else cur.push(b);
  }
  const pieces = [];
  for (let r = 0; r < runs.length; r++) {
    const run = runs[r];
    let piece = [run[0]];
    for (let i = 1; i < run.length - 1; i++) {
      piece.push(run[i]);
      const a = run[i - 1];
      const b = run[i];
      const c = run[i + 1];
      const d1x = b[0] - a[0];
      const d1y = b[1] - a[1];
      const d2x = c[0] - b[0];
      const d2y = c[1] - b[1];
      const ang = Math.abs(Math.atan2(d1x * d2y - d1y * d2x, d1x * d2x + d1y * d2y));
      if (ang > 1.05) {
        pieces.push(piece);
        piece = [b];
      }
    }
    piece.push(run[run.length - 1]);
    if (piece.length >= 2) pieces.push(piece);
  }
  return pieces.map((pts) => (pts.length >= 3 ? curveSamples(pts) : pts));
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
      const dry = !mesa && n > 0.93;
      const lift = n > 0.66 ? 18 : 0;
      g.fillStyle = mesa || dry
        ? `rgba(${168 + Math.floor(lift * 0.4)},${142 + Math.floor(lift * 0.2)},${78},0.36)`
        : `rgba(${28 + Math.floor(n * 36)},${118 + Math.floor(n * 48) + lift},${32},0.34)`;
      g.beginPath();
      g.ellipse(px, py, 14 + n * 16, 8 + n * 9, n * 3.1, 0, Math.PI * 2);
      g.fill();
      if (n > 0.42 && !dry) {
        g.fillStyle = mesa ? 'rgba(186,158,108,0.22)' : 'rgba(70,150,58,0.22)';
        g.beginPath();
        g.ellipse(px - 6, py - 4, 8 + n * 7, 5 + n * 4, n, 0, Math.PI * 2);
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
    rad.addColorStop(0, 'rgba(18,58,24,0.34)');
    rad.addColorStop(0.55, 'rgba(40,80,36,0.12)');
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
    rad.addColorStop(0, 'rgba(230,236,170,0.4)');
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

function paintHills(g) {
  g.save();
  g.globalCompositeOperation = 'multiply';
  for (let i = 0; i < HILL_RIDGE.length; i++) {
    const p = HILL_RIDGE[i];
    const rad = g.createRadialGradient(p[0] + 36, p[1] + 70, 20, p[0] + 36, p[1] + 70, 260);
    rad.addColorStop(0, 'rgba(72,58,36,0.55)');
    rad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rad;
    g.beginPath();
    g.ellipse(p[0] + 30, p[1] + 64, 240, 90, 0.08, 0, Math.PI * 2);
    g.fill();
  }
  g.globalCompositeOperation = 'soft-light';
  for (let i = 0; i < HILL_RIDGE.length; i++) {
    const p = HILL_RIDGE[i];
    const rad = g.createRadialGradient(p[0] - 20, p[1] - 24, 10, p[0] - 20, p[1] - 24, 180);
    rad.addColorStop(0, 'rgba(236,214,160,0.85)');
    rad.addColorStop(1, 'rgba(128,128,128,0)');
    g.fillStyle = rad;
    g.beginPath();
    g.ellipse(p[0] - 16, p[1] - 18, 180, 60, -0.05, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  const soils = ['#b89a52', '#6f8a3e', '#c6ae64', '#5f7838', '#a68448'];
  for (let i = 0; i < HILL_RIDGE.length - 1; i++) {
    const a = HILL_RIDGE[i];
    const b = HILL_RIDGE[i + 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const rot = Math.atan2(dy, dx);
    let nx = dy / len;
    let ny = -dx / len;
    if (ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    for (let step = 0; step < 4; step++) {
      const along = 0.32 + (step % 2) * 0.34;
      const midX = a[0] + dx * along + nx * (step * 34 - 18);
      const midY = a[1] + dy * along + ny * (step * 26 - 8);
      if (!onLand(midX, midY) || contains(COVE, midX, midY)) continue;
      patch(g, midX, midY, 148 + (i % 2) * 22, 26, rot, soils[(i + step) % soils.length]);
    }
  }
  cliffFace(g, HILL_RIDGE);
}

function segCross(a, b, c, d) {
  const cross = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = cross(a, b, c);
  const d2 = cross(a, b, d);
  const d3 = cross(c, d, a);
  const d4 = cross(c, d, b);
  if (!(((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0)))) return null;
  const den = (a[0] - b[0]) * (c[1] - d[1]) - (a[1] - b[1]) * (c[0] - d[0]);
  if (!den) return null;
  const t = ((a[0] - c[0]) * (c[1] - d[1]) - (a[1] - c[1]) * (c[0] - d[0])) / den;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function paintBridges(g, polylines) {
  const river = curveSamples(RIVER_PTS);
  const hits = [];
  for (let p = 0; p < polylines.length; p++) {
    const road = curveSamples(polylines[p]);
    for (let i = 0; i < road.length - 1; i++) {
      for (let j = 0; j < river.length - 1; j++) {
        const hit = segCross(road[i], road[i + 1], river[j], river[j + 1]);
        if (!hit) continue;
        let near = false;
        for (let k = 0; k < hits.length; k++) {
          if (Math.hypot(hits[k][0] - hit[0], hits[k][1] - hit[1]) < 90) near = true;
        }
        if (near) continue;
        const dx = road[i + 1][0] - road[i][0];
        const dy = road[i + 1][1] - road[i][1];
        const len = Math.hypot(dx, dy) || 1;
        hits.push([hit[0], hit[1], dx / len, dy / len]);
      }
    }
  }
  for (let i = 0; i < hits.length; i++) {
    const x = hits[i][0];
    const y = hits[i][1];
    const ux = hits[i][2];
    const uy = hits[i][3];
    const nx = -uy;
    const ny = ux;
    const half = 54;
    g.fillStyle = 'rgba(16,12,6,0.35)';
    g.beginPath();
    g.moveTo(x - ux * half + nx * 16 + 8, y - uy * half + ny * 16 + 8);
    g.lineTo(x + ux * half + nx * 16 + 8, y + uy * half + ny * 16 + 8);
    g.lineTo(x + ux * half - nx * 16 + 8, y + uy * half - ny * 16 + 8);
    g.lineTo(x - ux * half - nx * 16 + 8, y - uy * half - ny * 16 + 8);
    g.closePath();
    g.fill();
    g.fillStyle = '#6e5438';
    g.beginPath();
    g.moveTo(x - ux * half + nx * 14, y - uy * half + ny * 14);
    g.lineTo(x + ux * half + nx * 14, y + uy * half + ny * 14);
    g.lineTo(x + ux * half - nx * 14, y + uy * half - ny * 14);
    g.lineTo(x - ux * half - nx * 14, y - uy * half - ny * 14);
    g.closePath();
    g.fill();
    g.strokeStyle = '#efe6d4';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x - ux * half + nx * 12, y - uy * half + ny * 12);
    g.lineTo(x + ux * half + nx * 12, y + uy * half + ny * 12);
    g.moveTo(x - ux * half - nx * 12, y - uy * half - ny * 12);
    g.lineTo(x + ux * half - nx * 12, y + uy * half - ny * 12);
    g.stroke();
    g.fillStyle = '#f4efe4';
    for (let s = -1; s <= 1; s += 2) {
      for (let t = -1; t <= 1; t += 2) {
        g.fillRect(x + ux * half * s + nx * 12 * t - 2, y + uy * half * s + ny * 12 * t - 2, 4, 4);
      }
    }
  }
}

function bush(g, x, y, seed) {
  g.fillStyle = 'rgba(12,20,10,0.22)';
  g.beginPath();
  g.ellipse(x + 3, y + 4, 11, 6, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = hash(seed, 2) > 0.5 ? '#6d8a44' : '#3f6840';
  g.beginPath();
  g.ellipse(x, y, 10, 6, hash(seed, 4), 0, Math.PI * 2);
  g.fill();
  g.fillStyle = hash(seed, 6) > 0.7 ? '#9aaa68' : '#5c7a42';
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
  const chains = coastChains();
  g.fillStyle = 'rgba(255,252,245,0.82)';
  for (let c = 0; c < chains.length; c++) {
    const shore = chains[c];
    if (shore.length < 2) continue;
    ribbon(g, offsetChain(shore, 22), 26, 'rgba(56,176,186,0.5)');
    ribbon(g, offsetChain(shore, 12), 28, '#f0ddb4');
    ribbon(g, offsetChain(shore, -3), 8, 'rgba(255,252,245,0.65)');
    for (let i = 0; i < shore.length; i += 2) {
      const p = shore[i];
      const q = shore[Math.min(shore.length - 1, i + 1)];
      const j = hash(i + c * 17, 7);
      g.beginPath();
      g.ellipse(p[0] + 6, p[1], 6 + j * 8, 2.4 + j * 2, Math.atan2(q[1] - p[1], q[0] - p[0]), 0, Math.PI * 2);
      g.fill();
    }
  }
}

function paintFull(roads) {
  const c = document.createElement('canvas');
  c.width = MAP_W;
  c.height = MAP_H;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = true;

  const sea = g.createLinearGradient(2800, 0, MAP_W, MAP_H);
  sea.addColorStop(0, '#1c7f9c');
  sea.addColorStop(0.22, '#146888');
  sea.addColorStop(0.48, '#0c4e72');
  sea.addColorStop(0.74, '#08344e');
  sea.addColorStop(1, '#041c30');
  g.fillStyle = sea;
  g.fillRect(0, 0, MAP_W, MAP_H);
  const pools = [
    [4580, 1860, 980, 'rgba(6,32,52,0.42)'],
    [5900, 1100, 1280, 'rgba(4,28,46,0.28)'],
    [6200, 2500, 1500, 'rgba(3,18,32,0.5)'],
    [1500, 3720, 980, 'rgba(36,150,168,0.22)'],
    [900, 4080, 760, 'rgba(3,16,28,0.48)'],
    [2600, 4240, 1100, 'rgba(2,12,22,0.5)'],
    [2100, 3900, 1500, 'rgba(4,26,44,0.22)']
  ];
  for (let i = 0; i < pools.length; i++) {
    const pool = pools[i];
    const rad = g.createRadialGradient(pool[0], pool[1], pool[2] * 0.12, pool[0], pool[1], pool[2]);
    rad.addColorStop(0, pool[3]);
    rad.addColorStop(1, 'rgba(4,24,40,0)');
    g.fillStyle = rad;
    g.beginPath();
    g.arc(pool[0], pool[1], pool[2], 0, Math.PI * 2);
    g.fill();
  }

  paintCoast(g);
  g.fillStyle = '#3c8a40';
  g.fillRect(0, 0, 340, 3400);
  g.fillRect(0, 0, 2400, 140);
  fillShape(g, LAND, '#3c8a40');
  paintMottle(g);

  for (let i = 0; i < 220; i++) {
    const x = hash(i, 11) * 5200;
    const y = hash(i, 12) * MAP_H;
    if (!onLand(x, y) || contains(CITY_GROUND, x, y)) continue;
    const mesa = contains(MESA, x, y);
    const jungle = contains(ZONE_LAYOUT.jungle_alta.poly, x, y);
    const n = hash(i, 13);
    g.fillStyle = mesa
      ? `rgba(176,150,96,${0.14 + n * 0.12})`
      : jungle
        ? `rgba(18,72,30,${0.16 + n * 0.12})`
        : `rgba(36,128,46,${0.12 + n * 0.1})`;
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
  paintHills(g);

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
    if (edgeDistance(x, y, CITY_GROUND) > 150) continue;
    g.fillStyle = 'rgba(40,120,48,0.32)';
    g.beginPath();
    g.ellipse(x, y, 28 + hash(i, 23) * 46, 16 + hash(i, 24) * 18, hash(i, 25), 0, Math.PI * 2);
    g.fill();
  }
  g.restore();

  const river = curveSamples(RIVER_PTS);
  ribbon(g, river, 128, '#f0ddb4');
  ribbon(g, river, 96, '#c6a56c');
  ribbon(g, river, 54, '#0c6280');
  ribbon(g, river, 30, '#2aa4bc');
  g.fillStyle = 'rgba(232,250,250,0.55)';
  for (let i = 4; i < river.length; i += 9) {
    const p = river[i];
    g.beginPath();
    g.ellipse(p[0], p[1], 7, 2.2, 0, 0, Math.PI * 2);
    g.fill();
  }
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

  const roadPaths = ROAD_NETWORK.concat(SCENIC_ROADS.map((poly) => poly.map((p) => ({ x: p[0], y: p[1] })))).concat(CITY_AVENUES.map((poly) => poly.map((p) => ({ x: p[0], y: p[1] }))));
  if (roads) {
    for (let i = 0; i < roads.length; i++) dirtRoad(g, roads[i], i === 0 ? 16 : 11);
  }
  for (let i = 0; i < SCENIC_ROADS.length; i++) roadLine(g, SCENIC_ROADS[i], i === 2 ? 12 : 14);
  for (let i = 0; i < CITY_AVENUES.length; i++) roadLine(g, CITY_AVENUES[i], i < 3 ? 16 : 12);
  const bridgePaths = SCENIC_ROADS.concat(CITY_AVENUES);
  if (roads) {
    for (let i = 0; i < roads.length; i++) bridgePaths.push(roads[i]);
  }
  paintBridges(g, bridgePaths);

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

  const roadIndex = indexRoads(roads, 200);
  const fields = [
    { x0: -4000, y0: -4000, x1: 2500, y1: 1280 },
    { x0: 2860, y0: 1080, x1: 4100, y1: 1760 },
    { ell: true, cx: 480, cy: 1640, rx: 210, ry: 120 },
    { ell: true, cx: 900, cy: 1980, rx: 180, ry: 110 },
    { ell: true, cx: 1320, cy: 2160, rx: 160, ry: 96 },
    { ell: true, cx: 2140, cy: 2460, rx: 170, ry: 96 },
    { ell: true, cx: 3680, cy: 2260, rx: 150, ry: 86 }
  ];
  const placed = placePlots(roadPaths);
  for (let i = 0; i < placed.plots.length; i++) fields.push(plotField(placed.plots[i]));
  for (let i = 0; i < 200; i++) {
    const x = 60 + hash(i, 81) * 2500;
    const y = 40 + hash(i, 82) * 1600;
    if (!onLand(x, y) || contains(MESA, x, y)) continue;
    plantTree(g, x, y, i + 90, coverScale(x, y, roadIndex, fields));
  }
  for (let i = 0; i < 360; i++) {
    const x = hash(i, 31) * 4300;
    const y = 80 + hash(i, 32) * 2500;
    if (!onLand(x, y)) continue;
    if (contains(MESA, x, y) && hash(i, 33) > 0.28) continue;
    plantTree(g, x, y, i + 3, coverScale(x, y, roadIndex, fields));
  }
  for (let i = 0; i < 360; i++) {
    const x = 40 + hash(i, 101) * 1500;
    const y = 1360 + hash(i, 102) * 1280;
    if (!contains(ZONE_LAYOUT.jungle_alta.poly, x, y) || !onLand(x, y)) continue;
    plantTree(g, x, y, i + 210, coverScale(x, y, roadIndex, fields));
  }
  for (let i = 0; i < 100; i++) {
    const x = 60 + hash(i, 121) * 4300;
    const y = 2620 + hash(i, 122) * 980;
    if (!onLand(x, y)) continue;
    plantTree(g, x, y, i + 420, coverScale(x, y, roadIndex, fields));
  }
  for (let i = 0; i < 220; i++) {
    const x = hash(i, 61) * 4300;
    const y = 80 + hash(i, 62) * 2500;
    if (!onLand(x, y)) continue;
    const sc = coverScale(x, y, roadIndex, fields);
    if (sc < 0.12) continue;
    bush(g, x, y, i + 9);
  }
  const planted = placed.planted;
  for (let i = 0; i < placed.plots.length; i++) {
    const plot = placed.plots[i];
    cropPlot(g, plot.x, plot.y, plot.w, plot.h, plot.seed);
    if (plot.house) house(g, plot.hx, plot.hy, plot.house, 1, 'rural');
  }
  for (let i = 0; i < 40; i++) {
    const x = 1500 + hash(i, 41) * 1100;
    const y = 160 + hash(i, 42) * 1100;
    if (!onLand(x, y) || blocked(x, y) || nearPath(x, y, roadPaths, 36)) continue;
    if (contains(CITY_GROUND, x, y)) continue;
    rock(g, x, y, 0.55 + hash(i, 43));
  }

  const hamlets = [];
  const hamletTaken = (x, y) => {
    for (let i = 0; i < hamlets.length; i++) {
      const dx = hamlets[i][0] - x;
      const dy = hamlets[i][1] - y;
      if (dx * dx + dy * dy < 420 * 420) return true;
    }
    for (let i = 0; i < planted.length; i++) {
      const dx = planted[i][0] - x;
      const dy = planted[i][1] - y;
      if (dx * dx + dy * dy < 220 * 220) return true;
    }
    return false;
  };
  let hamletN = 0;
  const countryRoads = roads || [];
  for (let r = 0; r < countryRoads.length && hamlets.length < 12; r++) {
    const poly = countryRoads[r];
    let carry = 180;
    for (let i = 0; i < poly.length - 1 && hamlets.length < 12; i++) {
      const a = poly[i];
      const b = poly[i + 1];
      const ax = a.x != null ? a.x : a[0];
      const ay = a.y != null ? a.y : a[1];
      const bx = b.x != null ? b.x : b[0];
      const by = b.y != null ? b.y : b[1];
      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.hypot(dx, dy) || 1;
      carry += len;
      if (carry < 280) continue;
      carry = 0;
      hamletN += 1;
      if (hash(hamletN, 3) > 0.62) continue;
      const side = hash(hamletN, 4) > 0.5 ? 1 : -1;
      const off = 96 + hash(hamletN, 5) * 36;
      const x = (ax + bx) / 2 + (-dy / len) * off * side;
      const y = (ay + by) / 2 + (dx / len) * off * side;
      if (!onLand(x, y) || contains(CITY_GROUND, x, y) || contains(COVE, x, y) || contains(MESA, x, y)) continue;
      if (blocked(x, y, 8) || nearPath(x, y, roadPaths, 52) || hamletTaken(x, y)) continue;
      yard(g, x, y, 200 + hamletN);
      hamlets.push([x, y]);
    }
  }

  packTown(g, roadIndex);

  for (let i = 0; i < 28; i++) {
    const x = 200 + hash(i, 51) * 900;
    const y = 200 + hash(i, 52) * 1000;
    if (blocked(x, y) || !onLand(x, y)) continue;
    palm(g, x, y, 0.48 + hash(i, 53) * 0.4);
  }
  const shores = coastChains();
  for (let c = 0; c < shores.length; c++) {
    const shore = shores[c];
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
  }

  const wharf = [[3300, 1580], [3420, 1640], [3540, 1610], [3660, 1590], [3780, 1610], [3480, 1520]];
  for (let i = 0; i < wharf.length; i++) {
    const spot = wharf[i];
    if (!onLand(spot[0], spot[1]) || blocked(spot[0], spot[1], 8)) continue;
    house(g, spot[0], spot[1], 70 + i, 1.05, 'town');
  }

  const piers = [[3360, 1720, 1880], [3480, 1688, 1860], [3600, 1664, 1840], [3720, 1656, 1824]];
  for (let i = 0; i < piers.length; i++) {
    const pier = piers[i];
    const x = pier[0];
    const y0 = pier[1];
    const y1 = pier[2];
    g.strokeStyle = '#8a6238';
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(x, y0);
    g.lineTo(x + 10, y1);
    g.stroke();
    g.strokeStyle = '#c4a06a';
    g.lineWidth = 3;
    const span = y1 - y0;
    const planks = 5;
    for (let k = 0; k < planks; k++) {
      const y = y0 + 10 + (span - 20) * (k / (planks - 1));
      g.beginPath();
      g.moveTo(x - 16, y);
      g.lineTo(x + 28, y + 6);
      g.stroke();
    }
  }
  g.strokeStyle = '#d7a441';
  g.lineWidth = 3;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(3600, 1664);
  g.lineTo(3612, 1596);
  g.lineTo(3688, 1588);
  g.stroke();
  g.beginPath();
  g.moveTo(3480, 1688);
  g.lineTo(3490, 1624);
  g.lineTo(3554, 1616);
  g.stroke();

  const crates = ['#c25038', '#3d6ea8', '#e6c35a', '#7d3b5c'];
  for (let i = 0; i < crates.length; i++) {
    const x = 3320 + i * 42;
    const y = 1648;
    if (!onLand(x, y)) continue;
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(x + 3, y + 3, 28, 14);
    g.fillStyle = crates[i];
    g.fillRect(x, y, 28, 14);
  }

  g.save();
  g.globalCompositeOperation = 'soft-light';
  const sun = g.createLinearGradient(0, 0, MAP_W, MAP_H);
  sun.addColorStop(0, 'rgba(255,244,210,0.16)');
  sun.addColorStop(0.55, 'rgba(255,255,255,0)');
  sun.addColorStop(1, 'rgba(16,42,18,0.12)');
  g.fillStyle = sun;
  g.fillRect(0, 0, MAP_W, MAP_H);
  g.restore();
  return c;
}

export function paintTerrainTiles(roads) {
  const full = paintFull(roads || []);
  const tiles = [];
  const rows = Math.ceil(MAP_H / TILE_H);
  const cols = Math.ceil(MAP_W / TILE_W);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * TILE_W;
      const y = row * TILE_H;
      const w = Math.min(TILE_W, MAP_W - x);
      const h = Math.min(TILE_H, MAP_H - y);
      const tile = document.createElement('canvas');
      tile.width = w;
      tile.height = h;
      const g = tile.getContext('2d');
      g.drawImage(full, x, y, w, h, 0, 0, w, h);
      tiles.push({ canvas: tile, x, y, key: `go-world-${col}-${row}` });
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
