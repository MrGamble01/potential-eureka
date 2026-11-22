/* Voxel Isle's terrain and motion math.
   The garden script used to keep these as one-line helpers beside
   the renderer. They are pure, so the island can call them and
   the tests can replay a seed without starting WebGL. */

function clamp(value, lo, hi) {
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeOutBack(t) {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
}

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function hash3(x, y, z, seed) {
  let h = (seed | 0) ^ Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647 - 1329);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smoothStep(t) {
  return t * t * (3 - 2 * t);
}

function noise2(x, y, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const a = hash3(xi, 0, yi, seed);
  const b = hash3(xi + 1, 0, yi, seed);
  const c = hash3(xi, 0, yi + 1, seed);
  const d = hash3(xi + 1, 0, yi + 1, seed);
  const u = smoothStep(xf);
  const v = smoothStep(yf);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

function fbm(x, y, seed) {
  return noise2(x, y, seed) * 0.62
    + noise2(x * 2.17 + 7.3, y * 2.17 + 3.1, seed ^ 0x9e37) * 0.26
    + noise2(x * 4.9 + 13.7, y * 4.9 + 11.2, seed ^ 0x51ab) * 0.12;
}

function colScale(hex, factor) {
  const r = clamp(((hex >> 16) & 255) * factor, 0, 255);
  const g = clamp(((hex >> 8) & 255) * factor, 0, 255);
  const b = clamp((hex & 255) * factor, 0, 255);
  return [r / 255, g / 255, b / 255];
}
