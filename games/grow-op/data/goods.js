// Grow Op: San Verde '84 — Goods & Commodities Catalog
// Inspired by Cartel Tycoon (Moon Moose, 2022) production chains + Grow Op strains/products.

export const GOODS = {
  // Raw agricultural outputs
  raw_herb: {
    id: 'raw_herb',
    name: 'Raw Botanicals',
    shortName: 'Raw Crop',
    category: 'raw',
    unitValueDirty: 35,
    unitValueClean: 0,
    heatPerUnit: 0.25,
    color: 0x4ca65a,
    strokeColor: 0x24582e,
    badgeBg: '#274d2e',
    badgeInk: '#9ce6a8',
    desc: 'Freshly harvested high-altitude botanicals from valley plantations. Needs drying and trimming before export.'
  },
  coca_leaf: {
    id: 'coca_leaf',
    name: 'Alkaloid Leaf',
    shortName: 'Leaf Bale',
    category: 'raw',
    unitValueDirty: 65,
    unitValueClean: 0,
    heatPerUnit: 0.45,
    color: 0x6ebd52,
    strokeColor: 0x336322,
    badgeBg: '#2f4f23',
    badgeInk: '#b7f09e',
    desc: 'Dense mountain leaf bales cultivated on terraced highland plots. Feedstock for chemical extraction labs.'
  },
  coffee_cherry: {
    id: 'coffee_cherry',
    name: 'Estate Coffee',
    shortName: 'Coffee',
    category: 'legal',
    unitValueDirty: 0,
    unitValueClean: 45,
    heatPerUnit: -0.15,
    color: 0xb86f3c,
    strokeColor: 0x5c3216,
    badgeBg: '#4a2d1b',
    badgeInk: '#f0b892',
    desc: 'Legal shade-grown Arabica coffee. Generates clean export revenue and masks illicit cargo manifests.'
  },

  // Processed / Packaged goods
  cured_pack: {
    id: 'cured_pack',
    name: 'Vac-Sealed Reserve',
    shortName: 'Cured Pack',
    category: 'processed',
    unitValueDirty: 130,
    unitValueClean: 0,
    heatPerUnit: 0.55,
    color: 0x3ddc97,
    strokeColor: 0x176342,
    badgeBg: '#184a36',
    badgeInk: '#7ef7c2',
    desc: 'Kiln-dried, trimmed, and vacuum-sealed bricks ready for river pier or checkpoint smuggling.'
  },
  refined_extract: {
    id: 'refined_extract',
    name: 'Refined Distillate',
    shortName: 'Distillate',
    category: 'processed',
    unitValueDirty: 290,
    unitValueClean: 0,
    heatPerUnit: 1.15,
    color: 0x56b6c2,
    strokeColor: 0x1d5259,
    badgeBg: '#1b3f47',
    badgeInk: '#9beaf5',
    desc: 'High-purity laboratory distillate bricks. Massive street value at coastal seaports and highland airstrips, but draws intense DEA heat.'
  },
  smuggled_coffee: {
    id: 'smuggled_coffee',
    name: 'Concealed Export Crate',
    shortName: 'Masked Crate',
    category: 'concealed',
    unitValueDirty: 220,
    unitValueClean: 55,
    heatPerUnit: 0.15,
    color: 0xd4915a,
    strokeColor: 0x6b411e,
    badgeBg: '#4d331e',
    badgeInk: '#ffd0a6',
    desc: 'Processed contraband sealed inside legal estate coffee crates. Passes customs checkpoints with minimal heat.'
  }
};

// Grow Op classic strain modifiers (applicable to plantations)
export const STRAINS = [
  {
    id: 'kush',
    name: 'Garage Kush',
    act: 1,
    unlockCostClean: 0,
    speedMult: 1.0,
    valueMult: 1.0,
    heatMult: 1.0,
    tint: 0x4ca65a,
    desc: 'Balanced heirloom valley cultivar. Reliable cycle speed, standard market return, baseline heat.'
  },
  {
    id: 'diesel',
    name: 'Sierra Diesel',
    act: 1,
    unlockCostClean: 600,
    speedMult: 1.35,
    valueMult: 0.92,
    heatMult: 1.25,
    tint: 0x9ec944,
    desc: 'Aggressive fast-flowering cut (+35% harvest speed, +25% regional heat, 0.92x price).'
  },
  {
    id: 'haze',
    name: 'Oaxaca Haze',
    act: 2,
    unlockCostClean: 1200,
    speedMult: 0.85,
    valueMult: 1.45,
    heatMult: 0.75,
    tint: 0x8e6bbd,
    desc: 'Aromatic highland reserve (+45% export value, -25% heat signature, slightly slower cycle).'
  },
  {
    id: 'dawg',
    name: 'San Verde Chem',
    act: 2,
    unlockCostClean: 2400,
    speedMult: 1.15,
    valueMult: 1.75,
    heatMult: 1.4,
    tint: 0x3ddc97,
    desc: 'Potent hybrid bred for laboratory refinement (+75% value, +15% speed, +40% heat).'
  }
];
