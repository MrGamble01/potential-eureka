import { createProvider } from './providers.js';

const SAVE = 'ashmarch-v1';
const provider = createProvider();

const stage = document.getElementById('ash-stage');
const ctx = stage.getContext('2d');
const textEl = document.getElementById('ash-text');
const itemsEl = document.getElementById('ash-items');
const choicesEl = document.getElementById('ash-choices');
const kickerEl = document.getElementById('ash-kicker');

let state = load() || { scene: 'gate', items: [] };
let frame = 0;
let reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

function load() {
  try {
    const raw = localStorage.getItem(SAVE);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.scene !== 'string') return null;
    return data;
  } catch (e) {
    return null;
  }
}

function persist() {
  try { localStorage.setItem(SAVE, JSON.stringify({ scene: state.scene, items: state.items })); } catch (e) {}
}

function resize() {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const w = stage.clientWidth || 640;
  const h = Math.round(w * 0.62);
  stage.width = Math.round(w * ratio);
  stage.height = Math.round(h * ratio);
  stage.style.height = h + 'px';
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function draw() {
  const w = stage.clientWidth || 640;
  const h = Math.round(w * 0.62);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#1a140c');
  sky.addColorStop(1, '#3a3328');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const drift = reduced ? 0 : Math.sin(frame / 40) * 6;
  ctx.fillStyle = '#14110e';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.72);
  ctx.lineTo(w, h * 0.66 + drift);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();
  ctx.strokeStyle = 'rgba(227,179,65,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w * 0.08, h * 0.78);
  ctx.quadraticCurveTo(w * 0.5, h * 0.7, w * 0.92, h * 0.8);
  ctx.stroke();
  const motif = state.motif || 'gate';
  ctx.fillStyle = '#0c0c10';
  if (motif === 'gate' || motif === 'fork') {
    ctx.fillRect(w * 0.38, h * 0.28, 14, h * 0.44);
    ctx.fillRect(w * 0.62, h * 0.28, 14, h * 0.44);
    ctx.fillRect(w * 0.38, h * 0.28, w * 0.24, 12);
  } else if (motif === 'figure') {
    ctx.beginPath();
    ctx.arc(w * 0.58, h * 0.42, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(w * 0.54, h * 0.48, 22, 48);
  } else if (motif === 'beacon') {
    ctx.fillRect(w * 0.48, h * 0.22, 16, h * 0.5);
    ctx.fillStyle = '#e3b341';
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.2, 16 + (reduced ? 0 : Math.sin(frame / 12) * 2), 0, Math.PI * 2);
    ctx.fill();
  } else if (motif === 'ditch' || motif === 'wade') {
    ctx.fillStyle = '#2a241c';
    ctx.fillRect(w * 0.2, h * 0.62, w * 0.6, 28);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.fillStyle = 'rgba(230, 220, 200, 0.45)';
  for (let i = 0; i < 28; i++) {
    const x = (i * 97 + frame * (reduced ? 0 : 0.4)) % w;
    const y = (i * 53) % (h * 0.7);
    ctx.fillRect(x, y, 2, 2);
  }
}

async function render(action) {
  const next = await provider.turn(state, action);
  state = next;
  persist();
  textEl.textContent = next.text;
  itemsEl.textContent = next.items.length ? 'Carrying ' + next.items.join(', ') : 'Your pockets are empty.';
  kickerEl.textContent = next.ending ? 'The march ends' : 'Ashmarch';
  choicesEl.replaceChildren();
  for (const choice of next.choices) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = choice.label;
    button.addEventListener('click', () => render(choice));
    choicesEl.appendChild(button);
  }
}

function tick() {
  frame += 1;
  draw();
  if (!reduced) requestAnimationFrame(tick);
}
resize();
window.addEventListener('resize', () => { resize(); draw(); });
render(null).then(() => { if (reduced) draw(); else requestAnimationFrame(tick); });

document.getElementById('ash-reset').addEventListener('click', () => {
  state = { scene: 'gate', items: [] };
  render(null);
});
