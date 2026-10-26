// Presentation coordinates for zones and lots that are not BUILD_SLOTS.
// Gameplay prices and gates stay in sim.gameplayView().

export const MAP_W = 6400;
export const MAP_H = 2680;

export const ZONE_LAYOUT = {
  rio_plata: { x: 80, y: 160, w: 980, h: 1160 },
  jungle_alta: { x: 120, y: 1500, w: 1160, h: 980 },
  river_delta: { x: 1360, y: 1500, w: 1180, h: 980 },
  mesa_strip: { x: 2620, y: 1500, w: 1120, h: 980 },
  ps_barrio: { x: 2920, y: 180, w: 820, h: 820 },
  ps_downtown: { x: 3800, y: 180, w: 840, h: 820 },
  ps_beach: { x: 4700, y: 180, w: 760, h: 860 },
  ps_docks: { x: 2920, y: 1080, w: 1200, h: 680 },
  ps_airport: { x: 4200, y: 1140, w: 1240, h: 620 },
  ps_hills: { x: 3920, y: 1860, w: 1100, h: 640 }
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

export function zoneCenter(id) {
  const box = ZONE_LAYOUT[id];
  if (!box) return null;
  return { x: box.x + box.w / 2, y: box.y + 70 };
}
