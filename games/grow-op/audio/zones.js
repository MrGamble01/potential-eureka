// Where the camera hears each zone. Anchors follow the pinned map so a
// pan from Río Plata into Puerto Sol crossfades the Latin bed into the
// synthwave score. Sigma is the softness of that crossfade, in world pixels.

import { ZONE_LAYOUT } from '../map-layout.js';

export const ZONE_SIGMA = 460;

const HEARD = {
  rio_plata: ['rural', 'valley'],
  jungle_alta: ['rural', 'jungle'],
  river_delta: ['rural', 'delta'],
  mesa_strip: ['rural', 'mesa'],
  ps_barrio: ['city', 'barrio'],
  ps_docks: ['city', 'docks'],
  ps_downtown: ['city', 'downtown'],
  ps_beach: ['city', 'beach'],
  ps_airport: ['city', 'airport'],
  ps_hills: ['city', 'hills']
};

function centerOf(id) {
  const box = ZONE_LAYOUT[id];
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}

export const ZONE_ANCHORS = Object.fromEntries(Object.entries(HEARD).map(([id, kind]) => {
  const at = centerOf(id);
  return [id, { x: at.x, y: at.y, kind: kind[0], flavor: kind[1] }];
}));

export const CONTROL_MARKS = [45, 60, 75];

export function zoneAnchor(id) {
  return ZONE_ANCHORS[id] || ZONE_ANCHORS.rio_plata;
}

export function zoneMix(x, y) {
  const px = Number.isFinite(x) ? x : ZONE_ANCHORS.rio_plata.x;
  const py = Number.isFinite(y) ? y : ZONE_ANCHORS.rio_plata.y;
  const sigma2 = 2 * ZONE_SIGMA * ZONE_SIGMA;
  const weights = {};
  let sum = 0;
  for (const [id, anchor] of Object.entries(ZONE_ANCHORS)) {
    const dx = px - anchor.x;
    const dy = py - anchor.y;
    const w = Math.exp(-(dx * dx + dy * dy) / sigma2);
    weights[id] = w;
    sum += w;
  }
  let rural = 0;
  let city = 0;
  const flavors = {};
  for (const [id, anchor] of Object.entries(ZONE_ANCHORS)) {
    const w = sum > 0 ? weights[id] / sum : 0;
    weights[id] = w;
    if (anchor.kind === 'city') {
      city += w;
      flavors[anchor.flavor] = (flavors[anchor.flavor] || 0) + w;
    } else {
      rural += w;
    }
  }
  return { weights, rural, city, flavors };
}

export function ambienceLevels(mix, night) {
  const weights = (mix && mix.weights) || {};
  const rural = mix ? mix.rural : 1;
  const city = mix ? mix.city : 0;
  const riverW = (weights.rio_plata || 0) + (weights.river_delta || 0);
  const gullW = (weights.ps_docks || 0) + (weights.ps_beach || 0) * 0.65;
  const dark = night ? 1 : 0;
  return {
    insects: rural * (0.3 + dark * 0.7),
    river: riverW * (night ? 0.6 : 0.85),
    traffic: city * (night ? 0.42 : 0.9),
    gulls: gullW * (night ? 0.18 : 1),
    neon: city * (0.04 + dark * 0.9)
  };
}

export function crossedControl(prev, next) {
  const from = Number(prev) || 0;
  const to = Number(next) || 0;
  if (to <= from) return false;
  return CONTROL_MARKS.some((mark) => from < mark && to >= mark);
}
