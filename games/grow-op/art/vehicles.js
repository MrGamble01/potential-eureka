// Traffic, pedestrians, boats, and planes. City vehicles are top-down so
// they can face every side of the grid. Highway trucks stay on the life
// graphics layer through drawMiniTruck.

import { canvas } from './kit.js';

const LOOP = [
  [910, 330],
  [1580, 330],
  [1580, 1068],
  [910, 1068]
];

export const NEON = [
  { x: 1000, y: 210, color: 0xc4553a },
  { x: 1260, y: 210, color: 0xff4fbf },
  { x: 1420, y: 190, color: 0xffd27a },
  { x: 1360, y: 400, color: 0xff4fbf },
  { x: 700, y: 200, color: 0xe6c35a },
  { x: 640, y: 860, color: 0xff4fbf },
  { x: 1480, y: 640, color: 0x3ee0ff },
  { x: 1040, y: 900, color: 0x3ee0ff }
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

function wheel(g, x, y) {
  g.fillStyle = '#1c140e';
  g.beginPath();
  g.arc(x, y, 3.2, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#d7dde4';
  g.beginPath();
  g.arc(x, y, 1.2, 0, Math.PI * 2);
  g.fill();
}

export function renderCar(color, frame, kind) {
  const c = canvas(64, 36);
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(16,12,8,0.28)';
  g.beginPath();
  g.ellipse(32, 20, 22, 10, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = color;
  round(g, 14, 10, 36, 16, 4);
  g.fill();
  g.fillStyle = kind === 'police' ? '#f4f7fb' : '#1c2838';
  round(g, 24, 12, 16, 12, 2);
  g.fill();
  g.fillStyle = '#8ec4d4';
  g.fillRect(26, 14, 5, 8);
  g.fillRect(34, 14, 5, 8);
  g.fillStyle = '#fff4dc';
  g.fillRect(48, 13, 3, 3);
  g.fillRect(48, 20, 3, 3);
  const shift = frame ? 1 : 0;
  wheel(g, 18, 10 + shift);
  wheel(g, 46, 10 + shift);
  wheel(g, 18, 26 - shift);
  wheel(g, 46, 26 - shift);
  if (kind === 'police') {
    g.fillStyle = frame ? '#ff4d4d' : '#3ee0ff';
    g.fillRect(28, 8, 8, 3);
    g.fillStyle = frame ? '#3ee0ff' : '#ff4d4d';
    g.fillRect(28, 23, 8, 3);
  } else if (kind === 'taxi') {
    g.fillStyle = '#1c140e';
    g.fillRect(28, 6, 8, 3);
  }
  return c;
}

export function renderTruck(frame) {
  const c = canvas(78, 36);
  const g = c.getContext('2d');
  g.fillStyle = '#c47a4a';
  round(g, 8, 10, 34, 16, 2);
  g.fill();
  g.fillStyle = '#e7eef4';
  round(g, 40, 8, 28, 20, 3);
  g.fill();
  g.fillStyle = '#8ec4d4';
  g.fillRect(44, 12, 8, 8);
  g.fillStyle = '#1c140e';
  g.fillRect(62, 14, 4, 6);
  const shift = frame ? 1 : 0;
  wheel(g, 16, 10 + shift);
  wheel(g, 34, 26 - shift);
  wheel(g, 50, 10);
  wheel(g, 62, 26 - shift);
  return c;
}

export function renderBoat(frame) {
  const c = canvas(84, 40);
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(186,230,236,0.45)';
  g.beginPath();
  g.ellipse(30 - frame * 4, 22, 18, 5, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#c25038';
  g.beginPath();
  g.moveTo(16, 24);
  g.lineTo(70, 24);
  g.lineTo(62, 32);
  g.lineTo(22, 32);
  g.closePath();
  g.fill();
  g.fillStyle = '#2a3440';
  g.fillRect(34, 12, 22, 12);
  g.fillStyle = '#8ec4d4';
  g.fillRect(38, 15, 6, 5);
  g.fillRect(46, 15, 6, 5);
  g.fillStyle = '#e6c35a';
  g.fillRect(58, 16, 8, 6);
  return c;
}

export function renderPlane(frame) {
  const c = canvas(78, 48);
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(20,24,28,0.2)';
  g.beginPath();
  g.ellipse(40, 28, 24, 8, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#d5e4ee';
  g.beginPath();
  g.moveTo(12, 22);
  g.lineTo(62, 22);
  g.lineTo(70, 26);
  g.lineTo(62, 30);
  g.lineTo(12, 30);
  g.closePath();
  g.fill();
  g.fillStyle = '#8ec4d4';
  g.fillRect(40, 24, 10, 4);
  g.fillStyle = '#c25038';
  g.fillRect(18, 12, 28, 6);
  g.fillRect(18, 30, 28, 6);
  g.fillStyle = '#2a3440';
  g.beginPath();
  g.moveTo(58, 16);
  g.lineTo(66, 22);
  g.lineTo(58, 32);
  g.fill();
  if (frame) {
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.beginPath();
    g.arc(12, 26, 6, 0, Math.PI * 2);
    g.stroke();
  }
  return c;
}

export function renderPed(color, frame) {
  const c = canvas(28, 40);
  const g = c.getContext('2d');
  const step = frame ? 4 : -3;
  g.strokeStyle = '#2a241c';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(12, 22);
  g.lineTo(9 + step, 34);
  g.moveTo(16, 22);
  g.lineTo(18 - step, 34);
  g.stroke();
  g.fillStyle = color;
  g.fillRect(8, 14, 12, 10);
  g.fillStyle = '#e6c2a2';
  g.beginPath();
  g.arc(14, 10, 4.2, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#1c140e';
  g.fillRect(10, 6, 8, 3);
  return c;
}

export function renderWorker(frame) {
  const c = renderPed('#e07a3a', frame);
  const g = c.getContext('2d');
  g.fillStyle = '#f0c43a';
  g.beginPath();
  g.arc(14, 8, 4.4, Math.PI, 0);
  g.fill();
  g.fillStyle = '#f4f7fb';
  g.fillRect(8, 16, 12, 3);
  return c;
}

export function drawMiniTruck(g, x, y, color) {
  const c = typeof color === 'number' ? color : 0xc47a4a;
  g.fillStyle(0x140e08, 0.28);
  g.fillEllipse(x, y + 7, 20, 7);
  g.fillStyle(c, 1);
  g.fillRoundedRect(x - 16, y - 5, 22, 12, 2);
  g.fillStyle(0xe7eef4, 1);
  g.fillRoundedRect(x + 4, y - 4, 12, 10, 2);
  g.fillStyle(0x163044, 1);
  g.fillRect(x + 7, y - 2, 5, 4);
  g.fillStyle(0x1c140e, 1);
  g.fillCircle(x - 8, y + 6, 2.4);
  g.fillCircle(x + 8, y + 6, 2.4);
  g.fillCircle(x + 2, y + 6, 2.2);
}

function loopPoint(t) {
  const pts = LOOP;
  const segLens = [];
  let total = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segLens.push(len);
    total += len;
  }
  let dist = ((t % 1) + 1) % 1 * total;
  for (let i = 0; i < pts.length; i++) {
    if (dist <= segLens[i] || i === pts.length - 1) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const f = segLens[i] ? dist / segLens[i] : 0;
      return {
        x: a[0] + (b[0] - a[0]) * f,
        y: a[1] + (b[1] - a[1]) * f,
        a: Math.atan2(b[1] - a[1], b[0] - a[0])
      };
    }
    dist -= segLens[i];
  }
  return { x: pts[0][0], y: pts[0][1], a: 0 };
}

function ensure(scene, key, draw) {
  if (scene.textures.exists(key)) return;
  scene.textures.addCanvas(key, draw());
}

let prevPhase = null;

function bootFleet(scene) {
  const cars = [
    ['#f7c9d4', 'sedan', 0.02],
    ['#f0c43a', 'taxi', 0.18],
    ['#3ee0ff', 'sedan', 0.36],
    ['#f7f4ee', 'sedan', 0.52],
    ['#1c2838', 'police', 0.7],
    ['#c47a4a', 'truck', 0.86]
  ];
  for (let i = 0; i < cars.length; i++) {
    const kind = cars[i][1];
    const color = cars[i][0];
    for (let f = 0; f < 2; f++) {
      const key = `go-car-${i}-${f}`;
      ensure(scene, key, () => (kind === 'truck' ? renderTruck(f) : renderCar(color, f, kind)));
    }
  }
  const peds = ['#f2d2bf', '#2a3440', '#c4553a', '#3d6ea8', '#f7e7c4', '#6b3b58'];
  for (let i = 0; i < peds.length; i++) {
    for (let f = 0; f < 2; f++) {
      ensure(scene, `go-ped-${i}-${f}`, () => renderPed(peds[i], f));
    }
  }
  for (let f = 0; f < 2; f++) {
    ensure(scene, `go-worker-${f}`, () => renderWorker(f));
    ensure(scene, `go-boat-${f}`, () => renderBoat(f));
    ensure(scene, `go-plane-${f}`, () => renderPlane(f));
  }

  const fleet = [];
  for (let i = 0; i < cars.length; i++) {
    const img = scene.add.image(0, 0, `go-car-${i}-0`).setDepth(3).setScale(0.92);
    fleet.push({ img, at: cars[i][2], speed: 0.028 + (i % 3) * 0.006, keys: [`go-car-${i}-0`, `go-car-${i}-1`], frame: 0 });
  }
  const walkers = [];
  for (let i = 0; i < peds.length; i++) {
    const img = scene.add.image(0, 0, `go-ped-${i}-0`).setDepth(3);
    walkers.push({
      img,
      axis: i < 4 ? 'x' : 'y',
      origin: i < 4 ? 940 + i * 80 : 340 + (i - 4) * 120,
      cross: i < 4 ? 318 : 888,
      span: 140,
      speed: 18 + i * 4,
      frame: 0,
      keys: [`go-ped-${i}-0`, `go-ped-${i}-1`]
    });
  }
  const workers = [];
  for (let i = 0; i < 2; i++) {
    const img = scene.add.image(0, 0, 'go-worker-0').setDepth(3);
    workers.push({ img, at: i * 0.4, keys: ['go-worker-0', 'go-worker-1'], frame: 0 });
  }
  const boat = scene.add.image(900, 1264, 'go-boat-0').setDepth(2).setScale(0.9);
  const plane = scene.add.image(300, 140, 'go-plane-0').setDepth(6).setScale(0.8);
  scene._goLife = { fleet, walkers, workers, boat, plane };
}

export function paintAmbient(scene, g) {
  if (!scene || !scene.add) return;
  if (!scene._goLife) bootFleet(scene);
  const life = scene._goLife;
  const t = scene.phase || 0;
  const dt = prevPhase == null ? 0.016 : Math.min(0.05, Math.max(0, t - prevPhase));
  prevPhase = t;
  const frame = Math.floor(t * 6) % 2;

  for (let i = 0; i < life.fleet.length; i++) {
    const car = life.fleet[i];
    car.at = (car.at + car.speed * dt) % 1;
    const p = loopPoint(car.at);
    car.img.setPosition(p.x, p.y);
    car.img.setRotation(p.a);
    if (car.frame !== frame) {
      car.frame = frame;
      car.img.setTexture(car.keys[frame]);
    }
  }

  for (let i = 0; i < life.walkers.length; i++) {
    const ped = life.walkers[i];
    const wave = Math.sin(t * ped.speed * 0.05 + i);
    const dir = Math.cos(t * ped.speed * 0.05 + i) >= 0 ? 1 : -1;
    if (ped.axis === 'x') ped.img.setPosition(ped.origin + wave * ped.span, ped.cross);
    else ped.img.setPosition(ped.cross, ped.origin + wave * 70);
    ped.img.setScale(dir * 0.95, 0.95);
    if (ped.frame !== frame) {
      ped.frame = frame;
      ped.img.setTexture(ped.keys[frame]);
    }
  }

  for (let i = 0; i < life.workers.length; i++) {
    const w = life.workers[i];
    const u = (t * 0.05 + w.at) % 1;
    w.img.setPosition(1120 + u * 280, 1164 + i * 10);
    w.img.setScale(0.95, 0.95);
    if (w.frame !== frame) {
      w.frame = frame;
      w.img.setTexture(w.keys[frame]);
    }
  }

  const boatU = (t * 0.03) % 2;
  const boatP = boatU < 1 ? boatU : 2 - boatU;
  life.boat.setPosition(760 + boatP * 700, 1266 + Math.sin(t * 2) * 3);
  life.boat.setScale(boatU < 1 ? 0.9 : -0.9, 0.9);
  life.boat.setTexture(frame ? 'go-boat-1' : 'go-boat-0');

  const flight = (t * 0.045) % 1;
  life.plane.setPosition(180 + flight * 2100, 128 + Math.sin(flight * Math.PI * 2) * 16);
  life.plane.setRotation(Math.cos(flight * Math.PI * 2) * 0.18);
  life.plane.setTexture(frame ? 'go-plane-1' : 'go-plane-0');

  if (g && scene.isNight && scene.isNight()) {
    const pulse = 0.28 + Math.sin(t * 3) * 0.12;
    for (let i = 0; i < NEON.length; i++) {
      const n = NEON[i];
      g.fillStyle(n.color, pulse);
      g.fillCircle(n.x, n.y, 22);
      g.fillStyle(0xfff4dc, pulse * 0.45);
      g.fillCircle(n.x, n.y, 8);
    }
  }
}
