// Presentation coordinates for zones and lots that are not BUILD_SLOTS.
// Gameplay prices and gates stay in sim.gameplayView().
// Zone ids and unlock order live in data/zones.js. Polygons here are the
// geographic edges: the valley, the highlands, the delta, the mesa, and
// the Puerto Sol neighborhoods carved out of one coastline.

export const MAP_W = 6400;
export const MAP_H = 2680;

function wobble(poly, amp, seed) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const x = poly[i][0];
    const y = poly[i][1];
    const n = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
    const f = n - Math.floor(n);
    const ang = f * Math.PI * 2;
    const mag = amp * (0.35 + f * 0.65);
    out.push([x + Math.cos(ang) * mag, y + Math.sin(ang) * mag * 0.72]);
  }
  return out;
}

function bounds(poly) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const x = poly[i][0];
    const y = poly[i][1];
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
    cx += x;
    cy += y;
  }
  return {
    x: x0,
    y: y0,
    w: x1 - x0,
    h: y1 - y0,
    poly,
    focusX: cx / poly.length,
    focusY: cy / poly.length
  };
}

function zone(raw, amp, seed) {
  return bounds(wobble(raw, amp, seed));
}

export function contains(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    const denom = (yj - yi) || 1e-9;
    const hit = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / denom + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

const LAND_RAW = [
  [0, 0],
  [5480, 20],
  [5720, 160],
  [5860, 340],
  [5680, 500],
  [5420, 680],
  [5280, 860],
  [5520, 1040],
  [5340, 1200],
  [5160, 1320],
  [5380, 1420],
  [5520, 1540],
  [5340, 1660],
  [5560, 1780],
  [5740, 1920],
  [5620, 2140],
  [5480, 2360],
  [5220, 2540],
  [4980, 2680],
  [0, 2680]
];

export const LAND = wobble(LAND_RAW, 48, 4);

export const COVE = wobble([
  [3380, 1680],
  [3540, 1600],
  [3760, 1560],
  [3980, 1620],
  [4220, 1550],
  [4480, 1610],
  [4700, 1570],
  [4900, 1680],
  [4980, 1820],
  [4840, 1940],
  [4580, 1880],
  [4320, 1980],
  [4040, 1880],
  [3780, 1960],
  [3540, 1860],
  [3360, 1760]
], 20, 9);

export const RIVER_PTS = [
  [120, 50],
  [190, 240],
  [150, 460],
  [220, 700],
  [180, 920],
  [280, 1140],
  [460, 1320],
  [760, 1500],
  [1120, 1640],
  [1380, 1920],
  [1760, 1980],
  [2220, 1880],
  [2680, 1940],
  [3120, 1880],
  [3520, 1740],
  [3980, 1680]
];

export const INLET_PTS = [
  [1080, 980],
  [1280, 1080],
  [1520, 1160],
  [1760, 1280],
  [1680, 1460]
];

export const HARBOR_PTS = [
  [3980, 1680],
  [4300, 1640],
  [4620, 1700],
  [4440, 1780],
  [4080, 1740]
];

export const RIDGE = [
  [1580, 220],
  [1860, 160],
  [2140, 240],
  [2380, 180],
  [2520, 320]
];

export const MESA = wobble([
  [2520, 1760],
  [3180, 1660],
  [3880, 1780],
  [3960, 2280],
  [3400, 2560],
  [2680, 2460],
  [2460, 2060]
], 30, 6);

export const CITY_GROUND = wobble([
  [2860, 160],
  [3600, 80],
  [4480, 120],
  [5200, 240],
  [5360, 620],
  [5080, 980],
  [4560, 1120],
  [3680, 1040],
  [3000, 860],
  [2780, 480]
], 26, 8);

export const CITY_AVENUES = [
  [[2960, 250], [3480, 190], [4040, 280], [4580, 210], [5000, 200], [5280, 250]],
  [[2880, 620], [3400, 560], [3920, 660], [4460, 580], [4780, 720], [5000, 940], [5320, 860], [5400, 820]],
  [[2940, 980], [3460, 1080], [4000, 1000], [4520, 1120], [4980, 1040], [5300, 920]],
  [[2880, 620], [3000, 420], [2960, 250]],
  [[3340, 180], [3280, 460], [3380, 760], [3260, 1060]],
  [[3840, 160], [3920, 440], [3780, 740], [3900, 1080]],
  [[4340, 180], [4260, 480], [4400, 780], [4300, 1100]],
  [[4680, 220], [4740, 500], [4620, 820], [4720, 1080]],
  [[5280, 250], [5420, 260], [5480, 500], [5400, 820]]
];

export const CITY_LOOP = [
  [2960, 250],
  [3480, 190],
  [4040, 280],
  [4580, 210],
  [5000, 200],
  [5280, 250],
  [5420, 260],
  [5480, 500],
  [5400, 820],
  [5320, 860],
  [5000, 940],
  [4780, 720],
  [4460, 580],
  [3920, 660],
  [3400, 560],
  [2880, 620],
  [3000, 420]
];

export const SCENIC_ROADS = [
  [[640, 980], [400, 1100], [520, 1360], [540, 1560], [720, 1880], [1200, 2040], [1600, 2100], [1960, 2180], [2520, 2080], [2920, 2000], [3360, 1800], [3520, 1280], [3680, 1020]],
  [[2140, 520], [2360, 780], [2480, 1100], [2620, 1420], [2740, 1580]],
  [[5080, 220], [5380, 280], [5520, 480], [5440, 760], [5280, 980], [5040, 1180]]
];

export const ZONE_LAYOUT = {
  rio_plata: zone([
    [40, 140],
    [560, 80],
    [920, 180],
    [1100, 460],
    [1360, 900],
    [1320, 1320],
    [900, 1460],
    [360, 1280],
    [80, 980],
    [40, 480]
  ], 24, 11),
  jungle_alta: zone([
    [60, 1460],
    [520, 1380],
    [980, 1500],
    [1280, 1720],
    [1160, 2140],
    [780, 2520],
    [240, 2560],
    [40, 2100],
    [50, 1700]
  ], 28, 12),
  river_delta: zone([
    [1120, 1500],
    [1680, 1420],
    [2280, 1540],
    [2620, 1820],
    [2460, 2280],
    [1860, 2480],
    [1280, 2200],
    [1080, 1820]
  ], 26, 13),
  mesa_strip: zone([
    [2480, 1700],
    [3180, 1600],
    [3860, 1740],
    [3980, 2200],
    [3480, 2560],
    [2700, 2460],
    [2420, 2060]
  ], 24, 14),
  ps_barrio: zone([
    [2860, 200],
    [3460, 140],
    [3780, 320],
    [3720, 760],
    [3480, 1080],
    [3000, 1000],
    [2760, 620]
  ], 20, 15),
  ps_downtown: zone([
    [3660, 160],
    [4320, 120],
    [4760, 280],
    [4680, 780],
    [4300, 1100],
    [3720, 1020],
    [3580, 560]
  ], 20, 16),
  ps_beach: zone([
    [4660, 160],
    [5280, 180],
    [5460, 460],
    [5220, 820],
    [4860, 1040],
    [4560, 760],
    [4580, 360]
  ], 18, 17),
  ps_docks: zone([
    [2920, 1100],
    [3600, 1060],
    [4080, 1220],
    [3920, 1580],
    [3320, 1660],
    [2880, 1420]
  ], 20, 18),
  ps_airport: zone([
    [4120, 1240],
    [4860, 1180],
    [5380, 1380],
    [5280, 1760],
    [4560, 1860],
    [4080, 1620]
  ], 18, 19),
  ps_hills: zone([
    [3920, 1860],
    [4680, 1780],
    [5280, 1960],
    [5160, 2380],
    [4420, 2520],
    [3880, 2280]
  ], 22, 20)
};

export const DISTRICT_EDGE = {
  san_marco: wobble([
    [760, 260],
    [1100, 180],
    [1500, 260],
    [1640, 560],
    [1560, 920],
    [1320, 1160],
    [920, 1120],
    [760, 780],
    [720, 460]
  ], 22, 21),
  sierra_alta: wobble([
    [1480, 180],
    [1900, 120],
    [2360, 220],
    [2540, 520],
    [2460, 940],
    [2140, 1200],
    [1720, 1120],
    [1520, 760],
    [1460, 400]
  ], 24, 22)
};

export const LOT_POS = {
  lot_rp_gas: { x: 720, y: 1220 },
  lot_rp_hacienda: { x: 1080, y: 1220 },
  lot_ja_clearing: { x: 420, y: 1780 },
  lot_ja_hacienda: { x: 880, y: 1700 },
  lot_ja_farm: { x: 640, y: 2160 },
  lot_rd_plot: { x: 1620, y: 1760 },
  lot_rd_dock: { x: 2080, y: 2060 },
  lot_rd_mill: { x: 2300, y: 1720 },
  lot_ms_plot: { x: 2920, y: 1760 },
  lot_ms_strip: { x: 3380, y: 2140 },
  lot_ba_laundry: { x: 3160, y: 400 },
  lot_ba_diner: { x: 3520, y: 400 },
  lot_ba_pawn: { x: 3160, y: 720 },
  lot_ba_apts: { x: 3520, y: 740 },
  lot_dt_office: { x: 4040, y: 380 },
  lot_dt_cars: { x: 4400, y: 400 },
  lot_dt_bank: { x: 4220, y: 740 },
  lot_bh_motel: { x: 4960, y: 380 },
  lot_bh_club: { x: 5240, y: 560 },
  lot_bh_casino: { x: 5000, y: 800 },
  lot_dk_wh: { x: 3220, y: 1320 },
  lot_dk_fish: { x: 3660, y: 1460 },
  lot_dk_garage: { x: 3220, y: 1600 },
  lot_ap_hangar: { x: 4560, y: 1400 },
  lot_ap_freight: { x: 5080, y: 1520 },
  lot_hi_villa: { x: 4280, y: 2100 },
  lot_hi_motel: { x: 4720, y: 2240 }
};

export const LOT_ZONE = {
  lot_rp_gas: 'rio_plata',
  lot_rp_hacienda: 'rio_plata',
  lot_ja_clearing: 'jungle_alta',
  lot_ja_hacienda: 'jungle_alta',
  lot_ja_farm: 'jungle_alta',
  lot_rd_plot: 'river_delta',
  lot_rd_dock: 'river_delta',
  lot_rd_mill: 'river_delta',
  lot_ms_plot: 'mesa_strip',
  lot_ms_strip: 'mesa_strip',
  lot_ba_laundry: 'ps_barrio',
  lot_ba_diner: 'ps_barrio',
  lot_ba_pawn: 'ps_barrio',
  lot_ba_apts: 'ps_barrio',
  lot_dt_office: 'ps_downtown',
  lot_dt_cars: 'ps_downtown',
  lot_dt_bank: 'ps_downtown',
  lot_bh_motel: 'ps_beach',
  lot_bh_club: 'ps_beach',
  lot_bh_casino: 'ps_beach',
  lot_dk_wh: 'ps_docks',
  lot_dk_fish: 'ps_docks',
  lot_dk_garage: 'ps_docks',
  lot_ap_hangar: 'ps_airport',
  lot_ap_freight: 'ps_airport',
  lot_hi_villa: 'ps_hills',
  lot_hi_motel: 'ps_hills'
};

export function zoneCenter(id) {
  const box = ZONE_LAYOUT[id];
  if (!box) return null;
  return { x: box.focusX, y: box.focusY };
}

export function onLand(x, y) {
  return contains(LAND, x, y) && !contains(COVE, x, y);
}
