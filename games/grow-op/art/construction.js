// Construction and demolition sprites. Same 300×200 3/4 stage as the
// map buildings, so a lot can swap these in by texture key.
//
//   go-s-cleared-d / go-s-cleared-n     bare dirt after the crew leaves
//   go-fx-foundation-d / -n             formed slab and rebar
//   go-fx-scaffold-0 / -1               frame, tarp, workers
//   go-fx-crane-0 / -1                  crane and cement truck
//   go-fx-crumble-0 … -3                building coming down, dust rising
//   go-fx-pop-0 … -2                    finished shell with a celebration pop
//
// go-fx-dust-0 … -3 are the same crumble frames, kept so older callers still resolve.

import { canvas, groundPad, box, crate, shadow, gable, door } from './kit.js';

function worker(g, x, y, pose, hat = '#e6b84a') {
  const up = pose === 1;
  g.fillStyle = '#1e3a5f';
  g.fillRect(x - 6, y - 14, 5, 14);
  g.fillRect(x + 1, y - 14, 5, 14);
  g.fillStyle = '#c4553a';
  g.fillRect(x - 7, y - 26, 14, 13);
  g.fillStyle = '#e7c2a4';
  g.beginPath();
  g.arc(x, y - 30, 4.4, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = hat;
  g.beginPath();
  g.ellipse(x, y - 34, 6, 2.6, 0, 0, Math.PI * 2);
  g.fill();
  g.fillRect(x - 6, y - 35, 12, 2.4);
  g.strokeStyle = '#e7c2a4';
  g.lineWidth = 2.4;
  g.beginPath();
  g.moveTo(x + 6, y - 22);
  g.lineTo(x + (up ? 4 : 12), y - (up ? 36 : 14));
  g.stroke();
  if (up) {
    g.strokeStyle = '#6b4428';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x + 2, y - 36);
    g.lineTo(x + 14, y - 40);
    g.stroke();
    g.fillStyle = '#8a939c';
    g.fillRect(x + 12, y - 44, 7, 5);
  } else {
    g.fillStyle = '#c4965a';
    g.fillRect(x + 10, y - 16, 12, 3);
  }
}

function dirt(g, night) {
  groundPad(g);
  g.fillStyle = night ? '#3a3228' : '#c4a36a';
  g.beginPath();
  g.ellipse(150, 156, 112, 32, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = night ? '#2a241c' : '#8d6840';
  g.beginPath();
  g.ellipse(150, 162, 78, 16, 0.04, 0, Math.PI * 2);
  g.fill();
}

function stakes(g) {
  g.strokeStyle = 'rgba(244,241,234,0.8)';
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(70, 150);
  g.lineTo(226, 142);
  g.stroke();
  g.fillStyle = '#f4f1ea';
  g.fillRect(66, 140, 4, 22);
  g.fillRect(222, 132, 4, 22);
  g.fillStyle = '#c4553a';
  g.fillRect(64, 136, 8, 6);
  g.fillRect(220, 128, 8, 6);
}

function forms(g) {
  g.fillStyle = '#6b4428';
  g.fillRect(74, 150, 148, 6);
  g.fillRect(92, 136, 6, 22);
  g.fillRect(208, 128, 6, 24);
  g.fillStyle = '#c4a06a';
  g.fillRect(74, 148, 148, 3);
}

function slab(g, wet) {
  forms(g);
  g.fillStyle = wet ? '#b9bbb6' : '#e4e2da';
  g.beginPath();
  g.moveTo(84, 146);
  g.lineTo(204, 146);
  g.lineTo(228, 132);
  g.lineTo(108, 132);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(36,23,15,0.4)';
  g.lineWidth = 1;
  g.stroke();
  g.strokeStyle = 'rgba(36,23,15,0.18)';
  g.beginPath();
  g.moveTo(120, 144);
  g.lineTo(140, 134);
  g.moveTo(156, 145);
  g.lineTo(176, 135);
  g.stroke();
  if (wet) {
    g.fillStyle = 'rgba(186,214,220,0.55)';
    g.beginPath();
    g.ellipse(170, 140, 34, 7, 0.15, 0, Math.PI * 2);
    g.fill();
  }
}

function rebar(g) {
  g.strokeStyle = '#a85a3a';
  g.lineWidth = 2;
  const xs = [118, 146, 174, 198];
  for (const x of xs) {
    g.beginPath();
    g.moveTo(x, 136);
    g.lineTo(x + 3, 116);
    g.stroke();
    g.beginPath();
    g.arc(x + 3, 116, 2.6, Math.PI * 0.15, Math.PI * 1.15);
    g.stroke();
  }
}

export function renderFoundation(night) {
  const c = canvas();
  const g = c.getContext('2d');
  dirt(g, night);
  slab(g, false);
  rebar(g);
  g.fillStyle = '#9a8b72';
  g.beginPath();
  g.ellipse(58, 166, 16, 7, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#6e6256';
  g.beginPath();
  g.ellipse(62, 164, 8, 3, 0.2, 0, Math.PI * 2);
  g.fill();
  stakes(g);
  crate(g, 236, 168, 0.75);
  if (night) {
    g.fillStyle = 'rgba(255,210,122,0.4)';
    g.beginPath();
    g.arc(232, 108, 22, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#243044';
    g.fillRect(226, 118, 4, 28);
    g.fillStyle = '#ffd27a';
    g.fillRect(222, 104, 14, 10);
  }
  return c;
}

function poles(g) {
  g.strokeStyle = '#c5ced6';
  g.lineWidth = 3;
  const posts = [[78, 168, 96, 52], [118, 166, 132, 48], [164, 164, 174, 44], [206, 162, 214, 40]];
  for (const [x, y, tx, ty] of posts) {
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(tx, ty);
    g.stroke();
  }
  g.strokeStyle = '#8a939c';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(98, 70);
  g.lineTo(214, 56);
  g.moveTo(92, 108);
  g.lineTo(210, 94);
  g.moveTo(100, 78);
  g.lineTo(128, 104);
  g.moveTo(128, 74);
  g.lineTo(100, 102);
  g.moveTo(150, 70);
  g.lineTo(176, 98);
  g.moveTo(176, 66);
  g.lineTo(150, 94);
  g.stroke();
}

function tarp(g, frame) {
  const drop = frame ? 18 : 0;
  g.fillStyle = '#e25a28';
  g.beginPath();
  g.moveTo(96, 62);
  g.lineTo(214, 48);
  g.lineTo(228, 70 + drop);
  g.lineTo(112, 86 + drop * 0.35);
  g.closePath();
  g.fill();
  g.fillStyle = '#c4471c';
  g.beginPath();
  g.moveTo(206, 54);
  g.lineTo(228, 70 + drop);
  g.lineTo(222, 124);
  g.lineTo(200, 108);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(90,30,16,0.5)';
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(124, 72);
  g.lineTo(196, 58);
  if (frame) {
    g.moveTo(150, 78);
    g.quadraticCurveTo(170, 96, 188, 84);
  }
  g.stroke();
}

export function renderScaffold(frame) {
  const step = frame ? 1 : 0;
  const c = canvas();
  const g = c.getContext('2d');
  dirt(g, false);
  slab(g, false);
  box(g, 108, 150, 72, 26, 24, '#e7d3b0', '#c9aa84', '#d7c4a2');
  g.fillStyle = '#8ec4d4';
  g.fillRect(122, 132, 12, 10);
  g.strokeStyle = 'rgba(36,23,15,0.4)';
  g.strokeRect(122, 132, 12, 10);
  poles(g);
  g.fillStyle = '#c4965a';
  g.fillRect(96, 104, 118, 6);
  g.fillRect(104, 72, 100, 6);
  if (step) g.fillRect(118, 100, 28, 4);
  tarp(g, step);
  g.strokeStyle = '#6b4428';
  g.lineWidth = 2.4;
  g.beginPath();
  g.moveTo(70, 166);
  g.lineTo(96, 108);
  g.moveTo(78, 166);
  g.lineTo(104, 108);
  for (let i = 0; i < 5; i++) {
    g.moveTo(70 + i * 2, 166 - i * 12);
    g.lineTo(78 + i * 2, 166 - i * 12);
  }
  g.stroke();
  worker(g, 132, step ? 100 : 108, step, '#e6b84a');
  worker(g, step ? 64 : 46, 164, step ? 0 : 1, '#f4f7fb');
  crate(g, 28, 170, 0.7);
  g.fillStyle = '#e6b84a';
  g.beginPath();
  g.ellipse(40, 156, 6, 2.4, 0, 0, Math.PI * 2);
  g.fill();
  return c;
}

function mixer(g, frame) {
  shadow(g, 232, 176, 36);
  g.fillStyle = '#e6b84a';
  g.fillRect(198, 160, 62, 14);
  g.fillStyle = '#b88820';
  g.fillRect(198, 172, 62, 4);
  g.fillStyle = '#243044';
  g.fillRect(244, 148, 20, 16);
  g.fillStyle = '#8ec4d4';
  g.fillRect(248, 151, 12, 7);
  g.fillStyle = '#1c140e';
  g.beginPath();
  g.arc(214, 178, 5, 0, Math.PI * 2);
  g.arc(252, 178, 5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#f4f7fb';
  g.beginPath();
  g.arc(214, 178, 2, 0, Math.PI * 2);
  g.arc(252, 178, 2, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#d7dde4';
  g.beginPath();
  g.ellipse(224, 152, 20, 13, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#8a939c';
  g.lineWidth = 1;
  g.stroke();
  g.save();
  g.translate(224, 152);
  g.rotate(frame ? -0.9 : 0.5);
  g.strokeStyle = '#c4553a';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(-14, 0);
  g.lineTo(14, 0);
  g.moveTo(-8, -8);
  g.lineTo(8, 8);
  g.stroke();
  g.restore();
  g.strokeStyle = '#6a6258';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(206, 156);
  g.quadraticCurveTo(168, 168, 176, 142);
  g.stroke();
  if (frame) {
    g.strokeStyle = '#b7b8b4';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(176, 142);
    g.lineTo(166, 154);
    g.stroke();
    g.fillStyle = 'rgba(186,214,220,0.7)';
    g.beginPath();
    g.ellipse(164, 156, 10, 4, 0, 0, Math.PI * 2);
    g.fill();
  }
}

function crane(g, frame) {
  const drop = frame ? 36 : 0;
  shadow(g, 58, 168, 28);
  g.fillStyle = '#e6b84a';
  g.fillRect(28, 146, 48, 16);
  g.fillStyle = '#b88820';
  g.fillRect(28, 158, 48, 4);
  g.fillStyle = '#243044';
  g.fillRect(58, 132, 18, 16);
  g.fillStyle = '#8ec4d4';
  g.fillRect(62, 135, 10, 7);
  g.fillStyle = '#1c140e';
  g.beginPath();
  g.arc(40, 166, 5, 0, Math.PI * 2);
  g.arc(64, 166, 5, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#e6b84a';
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(48, 144);
  g.lineTo(64, 70);
  g.lineTo(156, 48);
  g.stroke();
  g.strokeStyle = '#8a6a18';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(52, 128);
  g.lineTo(78, 74);
  g.stroke();
  g.strokeStyle = '#1c140e';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(138, 54);
  g.lineTo(138, 86 + drop);
  g.stroke();
  g.fillStyle = '#c4553a';
  g.fillRect(132, 86 + drop, 12, 7);
  if (frame) {
    g.fillStyle = '#9aa0a6';
    g.fillRect(128, 93 + drop, 20, 12);
    g.fillStyle = '#d5d3cc';
    g.beginPath();
    g.moveTo(130, 105 + drop);
    g.lineTo(146, 105 + drop);
    g.lineTo(140, 118 + drop);
    g.closePath();
    g.fill();
  }
}

export function renderCrane(frame) {
  const step = frame ? 1 : 0;
  const c = canvas();
  const g = c.getContext('2d');
  dirt(g, false);
  slab(g, true);
  if (step) {
    g.fillStyle = 'rgba(186,214,220,0.45)';
    g.beginPath();
    g.ellipse(150, 142, 22, 6, 0, 0, Math.PI * 2);
    g.fill();
  }
  crane(g, step);
  mixer(g, step);
  worker(g, 112, 164, step);
  return c;
}

function shell(g, h, lean, broken) {
  if (h < 8) return;
  const x = 92 + lean;
  const y = 158;
  box(g, x, y, 104, 38, h, '#f4e2c6', '#c9aa84', broken ? '#a89078' : '#c25038');
  if (!broken && h > 36) {
    gable(g, x, y, 104, 38, h, 16, '#c25038', '#8a3224');
  }
  if (h > 30 && !broken) {
    g.fillStyle = '#8ec4d4';
    g.fillRect(x + 16, y - h + 16, 14, 16);
    g.fillRect(x + 42, y - h + 16, 14, 16);
    g.strokeStyle = 'rgba(36,23,15,0.45)';
    g.strokeRect(x + 16, y - h + 16, 14, 16);
    g.strokeRect(x + 42, y - h + 16, 14, 16);
    door(g, x + 72, y, 16, 24);
  }
}

function bricks(g, pieces) {
  g.fillStyle = '#8a3224';
  for (const [x, y, w, h] of pieces) g.fillRect(x, y, w, h);
  g.fillStyle = '#c25038';
  for (const [x, y, w, h] of pieces) g.fillRect(x, y, w, 2);
}

function dustCloud(g, frame) {
  const puff = [
    [168, 108, 22, 0.28],
    [196, 92, 30, 0.34],
    [150, 78, 18, 0.22],
    [214, 118, 26, 0.3]
  ];
  const grow = 0.7 + frame * 0.38;
  const lift = frame * 14;
  for (let i = 0; i < puff.length; i++) {
    if (frame === 0 && i > 0) continue;
    if (frame === 1 && i > 1) continue;
    const [x, y, r, a] = puff[i];
    g.fillStyle = `rgba(214,196,168,${Math.min(0.62, a + frame * 0.08)})`;
    g.beginPath();
    g.ellipse(x + frame * 8, y - lift, r * grow, r * 0.55 * grow, 0, 0, Math.PI * 2);
    g.fill();
  }
}

export function renderCrumble(frame) {
  const step = Math.max(0, Math.min(3, frame | 0));
  const c = canvas();
  const g = c.getContext('2d');
  dirt(g, false);
  if (step === 0) {
    shell(g, 56, 0, false);
    g.strokeStyle = '#8a3224';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(124, 148);
    g.lineTo(136, 120);
    g.lineTo(130, 96);
    g.stroke();
    bricks(g, [[108, 152, 14, 5]]);
  } else if (step === 1) {
    shell(g, 40, 8, true);
    g.fillStyle = '#c25038';
    g.beginPath();
    g.moveTo(128, 108);
    g.lineTo(198, 86);
    g.lineTo(210, 100);
    g.lineTo(138, 122);
    g.closePath();
    g.fill();
    g.fillStyle = '#8a3224';
    g.beginPath();
    g.moveTo(198, 86);
    g.lineTo(214, 96);
    g.lineTo(206, 104);
    g.closePath();
    g.fill();
    bricks(g, [[168, 70, 16, 6], [112, 150, 14, 5], [176, 154, 10, 4]]);
  } else if (step === 2) {
    box(g, 96, 158, 52, 34, 34, '#f4e2c6', '#c9aa84', '#a89078');
    box(g, 148, 158, 44, 28, 12, '#e7d3b0', '#b7a48a', '#8a7560');
    g.fillStyle = '#a68458';
    g.beginPath();
    g.ellipse(168, 156, 40, 12, 0, 0, Math.PI * 2);
    g.fill();
    bricks(g, [[78, 62, 16, 5], [104, 78, 12, 4], [126, 150, 14, 5], [186, 148, 12, 5]]);
  } else {
    g.fillStyle = '#a68458';
    g.beginPath();
    g.ellipse(152, 158, 64, 16, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#8a7560';
    g.fillRect(118, 148, 22, 8);
    g.fillRect(148, 152, 14, 6);
    bricks(g, [[96, 150, 12, 5], [170, 146, 16, 5], [200, 156, 10, 4]]);
  }
  dustCloud(g, step);
  return c;
}

function finished(g) {
  box(g, 88, 158, 112, 42, 54, '#f4e2c6', '#c9aa84', '#c25038');
  gable(g, 88, 158, 112, 42, 54, 18, '#c25038', '#8a3224');
  g.fillStyle = '#8ec4d4';
  g.fillRect(106, 116, 14, 16);
  g.fillRect(132, 116, 14, 16);
  g.strokeStyle = 'rgba(36,23,15,0.45)';
  g.strokeRect(106, 116, 14, 16);
  g.strokeRect(132, 116, 14, 16);
  door(g, 164, 158, 16, 26);
  g.fillStyle = '#e6c35a';
  g.fillRect(168, 140, 3, 3);
}

export function renderPop(frame) {
  const step = Math.max(0, Math.min(2, frame | 0));
  const c = canvas();
  const g = c.getContext('2d');
  dirt(g, false);
  finished(g);
  if (step === 0) {
    g.fillStyle = 'rgba(255,244,220,0.55)';
    g.beginPath();
    g.ellipse(146, 112, 48, 26, 0, 0, Math.PI * 2);
    g.fill();
  }
  const ring = 16 + step * 34;
  g.strokeStyle = step === 2 ? 'rgba(255,244,220,0.28)' : 'rgba(255,236,180,0.95)';
  g.lineWidth = step === 0 ? 5 : 2.5;
  g.beginPath();
  g.ellipse(146, 108, ring, ring * 0.42, 0, 0, Math.PI * 2);
  g.stroke();
  const bits = ['#ff4fbf', '#3ee0ff', '#e6c35a', '#f4f7fb', '#c25038', '#7dcea0'];
  for (let i = 0; i < bits.length; i++) {
    const spread = step === 0 ? 0 : step === 1 ? 1 : 1.7;
    const x = 146 + Math.cos(i * 1.05) * (18 + spread * 36);
    const y = 96 + Math.sin(i * 1.05) * (8 + spread * 22) - (step === 0 ? 0 : 6);
    g.save();
    g.translate(x, y);
    g.rotate(i + step);
    g.fillStyle = bits[i];
    g.fillRect(-3, -1.5, 7, 3);
    g.restore();
  }
  if (step > 0) {
    worker(g, 62, 164, 1, '#f4f7fb');
    worker(g, 230, 164, 1);
  }
  return c;
}
