// Shared 3/4 drawing kit. Sprites sit on a top-down map the way a tycoon does:
// a front wall, a shaded side wall, and a roof plane.

export const W = 300;
export const H = 200;

export const INK = 'rgba(36,23,15,0.55)';

export function canvas(w = W, h = H) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = true;
  return c;
}

export function hash(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export function poly(g, pts, fill) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 1;
  g.stroke();
}

const KX = 0.62;
const KY = 0.34;

export function shadow(g, x, y, w) {
  g.fillStyle = 'rgba(16,12,8,0.32)';
  g.beginPath();
  g.ellipse(x, y, w, w * 0.28, 0, 0, Math.PI * 2);
  g.fill();
}

export function walls(g, x, y, w, d, h, face, side) {
  poly(g, [
    [x + w, y],
    [x + w + d * KX, y - d * KY],
    [x + w + d * KX, y - h - d * KY],
    [x + w, y - h]
  ], side);
  poly(g, [[x, y], [x + w, y], [x + w, y - h], [x, y - h]], face);
}

export function box(g, x, y, w, d, h, face, side, top) {
  walls(g, x, y, w, d, h, face, side);
  poly(g, [
    [x, y - h],
    [x + w, y - h],
    [x + w + d * KX, y - h - d * KY],
    [x + d * KX, y - h - d * KY]
  ], top);
}

export function gable(g, x, y, w, d, wall, rise, roof, roofSide) {
  const mid = x + w / 2;
  const peak = y - wall - rise;
  poly(g, [[x, y - wall], [mid, peak], [x + w, y - wall]], roofSide || roof);
  poly(g, [
    [x, y - wall],
    [mid, peak],
    [mid + d * KX, peak - d * KY],
    [x + d * KX, y - wall - d * KY]
  ], roof);
  poly(g, [
    [x + w, y - wall],
    [mid, peak],
    [mid + d * KX, peak - d * KY],
    [x + w + d * KX, y - wall - d * KY]
  ], roofSide || '#8a3224');
}

export function wins(g, x, y, n, night, lit) {
  for (let i = 0; i < n; i++) {
    const wx = x + i * 16;
    const glow = night || lit;
    if (glow) {
      g.fillStyle = 'rgba(255,206,110,0.35)';
      g.fillRect(wx - 3, y - 3, 14, 16);
    }
    g.fillStyle = glow ? '#ffd27a' : '#8ec4d4';
    g.fillRect(wx, y, 9, 11);
    g.strokeStyle = INK;
    g.strokeRect(wx, y, 9, 11);
  }
}

export function door(g, x, y, w, h, color = '#4e3018') {
  g.fillStyle = color;
  g.fillRect(x, y - h, w, h);
  g.strokeStyle = INK;
  g.strokeRect(x, y - h, w, h);
  g.fillStyle = '#e7d3a2';
  g.fillRect(x + w - 4, y - h / 2, 2, 2);
}

export function weeds(g, x, y) {
  g.strokeStyle = '#3f7a38';
  g.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    g.moveTo(x + i * 5, y);
    g.quadraticCurveTo(x + i * 5 + 2, y - 8, x + i * 5 - 1, y - 12);
    g.stroke();
  }
}

export function crate(g, x, y, s = 1, color = '#c4965a') {
  box(g, x, y, 16 * s, 12 * s, 12 * s, color, '#8a6238', '#e2c48a');
}

export function barrel(g, x, y, s = 1) {
  g.fillStyle = '#6b4428';
  g.beginPath();
  g.ellipse(x, y - 8 * s, 8 * s, 4 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.fillRect(x - 8 * s, y - 16 * s, 16 * s, 10 * s);
  g.fillStyle = '#c4a06a';
  g.fillRect(x - 8 * s, y - 14 * s, 16 * s, 2 * s);
  g.fillRect(x - 8 * s, y - 9 * s, 16 * s, 2 * s);
}

export function palm(g, x, y, s = 1) {
  g.strokeStyle = '#6b4428';
  g.lineWidth = 3 * s;
  g.beginPath();
  g.moveTo(x, y);
  g.quadraticCurveTo(x + 4 * s, y - 16 * s, x - 2 * s, y - 28 * s);
  g.stroke();
  const top = y - 28 * s;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.fillStyle = i % 2 ? '#2f6b34' : '#67a04a';
    g.beginPath();
    g.ellipse(x - 2 * s + Math.cos(a) * 12 * s, top + Math.sin(a) * 6 * s, 14 * s, 4 * s, a, 0, Math.PI * 2);
    g.fill();
  }
}

export function van(g, x, y, color = '#243044') {
  shadow(g, x + 16, y + 2, 22);
  box(g, x, y, 28, 16, 14, color, '#1a2430', '#d7dde4');
  g.fillStyle = '#8ec4d4';
  g.fillRect(x + 18, y - 12, 8, 6);
  g.fillStyle = '#1c140e';
  g.beginPath();
  g.arc(x + 6, y, 3, 0, Math.PI * 2);
  g.arc(x + 22, y, 3, 0, Math.PI * 2);
  g.fill();
}

export function guard(g, x, y) {
  g.fillStyle = '#2a241c';
  g.fillRect(x - 3, y - 14, 6, 8);
  g.fillStyle = '#e6c2a2';
  g.beginPath();
  g.arc(x, y - 16, 3.2, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#1c2838';
  g.fillRect(x - 4, y - 22, 8, 4);
  g.fillStyle = '#c4553a';
  g.fillRect(x + 3, y - 12, 7, 2);
}

export function badge(g, x, y, color) {
  poly(g, [[x, y + 8], [x + 8, y], [x + 16, y + 8], [x + 8, y + 16]], color);
  g.fillStyle = '#f7f1e4';
  g.fillRect(x + 6, y + 6, 4, 4);
}

export function saleSign(g, x, y) {
  g.fillStyle = '#6b4428';
  g.fillRect(x + 16, y - 26, 3, 26);
  g.fillStyle = '#f7f1e4';
  g.fillRect(x, y - 46, 42, 22);
  g.strokeStyle = '#c4553a';
  g.lineWidth = 2;
  g.strokeRect(x, y - 46, 42, 22);
  g.fillStyle = '#8a3224';
  g.fillRect(x + 5, y - 39, 32, 3);
  g.fillRect(x + 5, y - 32, 22, 3);
}

export function groundPad(g) {
  shadow(g, 150, 168, 120);
  g.fillStyle = 'rgba(120,86,48,0.35)';
  g.beginPath();
  g.ellipse(146, 172, 100, 22, 0, 0, Math.PI * 2);
  g.fill();
}

export function wash(g, sale) {
  if (!sale) return;
  g.fillStyle = 'rgba(70,60,40,0.16)';
  g.beginPath();
  g.ellipse(148, 118, 118, 72, 0, 0, Math.PI * 2);
  g.fill();
}
