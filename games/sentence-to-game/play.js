import { createCompiler } from './compile.js';

const compiler = createCompiler();
const canvas = document.getElementById('stg-canvas');
const ctx = canvas.getContext('2d');
const titleEl = document.getElementById('stg-title');
const statusEl = document.getElementById('stg-status');
const promptEl = document.getElementById('stg-prompt');

let spec = null;
let loop = 0;
let running = false;
const keys = new Set();
const pointers = { left: false, right: false, action: false };

function resize() {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || 640;
  const h = Math.round(Math.min(w * 0.62, window.innerHeight * 0.46));
  canvas.width = Math.round(w * ratio);
  canvas.height = Math.round(Math.max(180, h) * ratio);
  canvas.style.height = Math.max(180, h) + 'px';
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function world() {
  return { w: canvas.clientWidth || 640, h: parseFloat(canvas.style.height) || 320 };
}

function fresh(next) {
  spec = next;
  spec.score = 0;
  spec.over = false;
  spec.t = 0;
  const box = world();
  spec.player = { x: box.w * 0.5, y: box.h * 0.72, vx: 0, vy: 0 };
  spec.bits = [];
  for (let i = 0; i < 6; i++) seedBit(box);
  if (spec.kind === 'break') {
    spec.bricks = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 8; c++) spec.bricks.push({ c, r, alive: true });
    }
    spec.ball = { x: box.w * 0.5, y: box.h * 0.55, vx: 2.2, vy: -2.4 };
  }
  if (spec.kind === 'snake') {
    spec.snake = [{ x: 8, y: 8 }];
    spec.dir = { x: 1, y: 0 };
    spec.food = { x: 12, y: 8 };
    spec.tick = 0;
  }
}

function seedBit(box) {
  spec.bits.push({
    x: 20 + Math.random() * (box.w - 40),
    y: spec.kind === 'dodge' ? -Math.random() * box.h : 30 + Math.random() * (box.h - 80),
    v: 1.2 + Math.random() * 1.6,
    r: 8,
  });
}

function inputX() {
  if (keys.has('arrowleft') || keys.has('a') || pointers.left) return -1;
  if (keys.has('arrowright') || keys.has('d') || pointers.right) return 1;
  return 0;
}

function step() {
  if (!spec || spec.over) return;
  const box = world();
  spec.t += 1;
  const axis = inputX();
  const p = spec.player;
  if (spec.kind === 'hop') {
    p.vx = axis * 3.2;
    p.vy += 0.18;
    if ((keys.has(' ') || keys.has('arrowup') || pointers.action) && p.y > box.h - 48) p.vy = -5.2;
    p.x = Math.max(16, Math.min(box.w - 16, p.x + p.vx));
    p.y += p.vy;
    if (p.y > box.h - 36) { p.y = box.h - 36; p.vy = 0; }
  } else if (spec.kind !== 'snake') {
    p.x = Math.max(18, Math.min(box.w - 18, p.x + axis * 4.2));
  }
  if (spec.kind === 'collect' || spec.kind === 'dodge' || spec.kind === 'hop') {
    for (const bit of spec.bits) {
      if (spec.kind === 'dodge' || spec.kind === 'hop') bit.y += bit.v;
      const hit = Math.hypot(bit.x - p.x, bit.y - p.y) < 18;
      if (hit && spec.kind !== 'dodge') {
        spec.score += 1;
        bit.y = -10;
        bit.x = 20 + Math.random() * (box.w - 40);
      } else if (hit && spec.kind === 'dodge') {
        spec.over = true;
      }
      if (bit.y > box.h + 10) {
        bit.y = -10;
        bit.x = 20 + Math.random() * (box.w - 40);
        if (spec.kind === 'dodge') spec.score += 1;
      }
    }
  }
  if (spec.kind === 'break') {
    const b = spec.ball;
    b.x += b.vx;
    b.y += b.vy;
    if (b.x < 8 || b.x > box.w - 8) b.vx *= -1;
    if (b.y < 8) b.vy *= -1;
    if (b.y > p.y - 8 && b.y < p.y + 10 && Math.abs(b.x - p.x) < 36) b.vy = -Math.abs(b.vy);
    if (b.y > box.h) spec.over = true;
    const bw = (box.w - 40) / 8;
    for (const brick of spec.bricks) {
      if (!brick.alive) continue;
      const x = 20 + brick.c * bw;
      const y = 24 + brick.r * 22;
      if (b.x > x && b.x < x + bw - 4 && b.y > y && b.y < y + 16) {
        brick.alive = false;
        b.vy *= -1;
        spec.score += 1;
      }
    }
  }
  if (spec.kind === 'snake') {
    spec.tick += 1;
    if (axis < 0 && spec.dir.x === 0) spec.dir = { x: -1, y: 0 };
    if (axis > 0 && spec.dir.x === 0) spec.dir = { x: 1, y: 0 };
    if ((keys.has('arrowup') || keys.has('w') || pointers.action) && spec.dir.y === 0) spec.dir = { x: 0, y: -1 };
    if ((keys.has('arrowdown') || keys.has('s')) && spec.dir.y === 0) spec.dir = { x: 0, y: 1 };
    if (spec.tick % 8 === 0) {
      const head = { x: spec.snake[0].x + spec.dir.x, y: spec.snake[0].y + spec.dir.y };
      const cols = Math.floor(box.w / 16);
      const rows = Math.floor(box.h / 16);
      if (head.x < 0 || head.y < 0 || head.x >= cols || head.y >= rows) spec.over = true;
      if (spec.snake.some((part) => part.x === head.x && part.y === head.y)) spec.over = true;
      spec.snake.unshift(head);
      if (head.x === spec.food.x && head.y === spec.food.y) {
        spec.score += 1;
        spec.food = { x: 1 + Math.floor(Math.random() * (cols - 2)), y: 1 + Math.floor(Math.random() * (rows - 2)) };
      } else spec.snake.pop();
    }
  }
  if (!spec.over && spec.score >= spec.goal) spec.over = true;
  statusEl.textContent = spec.over
    ? (spec.score >= spec.goal ? 'Cleared. ' : 'Down. ') + spec.score + ' / ' + spec.goal
    : spec.score + ' / ' + spec.goal;
}

function draw() {
  const box = world();
  ctx.fillStyle = '#07080d';
  ctx.fillRect(0, 0, box.w, box.h);
  if (!spec) {
    ctx.fillStyle = '#8b949e';
    ctx.font = '16px sans-serif';
    ctx.fillText('Describe a game. The stub builds one you can play.', 24, box.h / 2);
    return;
  }
  ctx.fillStyle = spec.accent;
  if (spec.kind === 'break') {
    const bw = (box.w - 40) / 8;
    for (const brick of spec.bricks) {
      if (!brick.alive) continue;
      ctx.fillRect(20 + brick.c * bw, 24 + brick.r * 22, bw - 6, 14);
    }
    ctx.beginPath();
    ctx.arc(spec.ball.x, spec.ball.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  if (spec.kind === 'snake') {
    for (const part of spec.snake) ctx.fillRect(part.x * 16 + 1, part.y * 16 + 1, 14, 14);
    ctx.fillStyle = '#e3b341';
    ctx.fillRect(spec.food.x * 16 + 3, spec.food.y * 16 + 3, 10, 10);
  } else {
    for (const bit of spec.bits) {
      ctx.beginPath();
      ctx.arc(bit.x, bit.y, bit.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#e6edf3';
    ctx.fillRect(spec.player.x - 22, spec.player.y - 8, 44, 12);
  }
}

function frame() {
  step();
  draw();
  loop = requestAnimationFrame(frame);
}

async function build(prompt) {
  const next = await compiler.compile(prompt);
  titleEl.textContent = next.title;
  fresh(next);
  running = true;
  statusEl.textContent = '0 / ' + next.goal;
  if (!loop) loop = requestAnimationFrame(frame);
}

document.getElementById('stg-form').addEventListener('submit', (event) => {
  event.preventDefault();
  build(promptEl.value);
});
document.querySelectorAll('[data-prompt]').forEach((button) => {
  button.addEventListener('click', () => {
    promptEl.value = button.dataset.prompt;
    build(button.dataset.prompt);
  });
});
window.addEventListener('keydown', (event) => keys.add(event.key.toLowerCase()));
window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
document.querySelectorAll('[data-hold]').forEach((button) => {
  const set = (down) => { pointers[button.dataset.hold] = down; };
  button.addEventListener('pointerdown', (event) => { event.preventDefault(); set(true); });
  button.addEventListener('pointerup', () => set(false));
  button.addEventListener('pointerleave', () => set(false));
  button.addEventListener('pointercancel', () => set(false));
});
window.addEventListener('resize', resize);
resize();
draw();
