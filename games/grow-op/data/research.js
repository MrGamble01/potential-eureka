// Research tree. Clean cash buys a lasting edge. Each node names the
// simulation field it changes so the effect cannot drift from the copy.

export const RESEARCH = [
  {
    id: 'lights',
    name: 'Sodium Grow Lamps',
    cost: 2000,
    requires: null,
    column: 0,
    desc: 'Valley plots finish 20% faster. The first lamp is the one every garage already wanted.'
  },
  {
    id: 'filters',
    name: 'Carbon Filter Banks',
    cost: 2500,
    requires: 'lights',
    column: 1,
    desc: 'Production throws off 25% less district heat. The block smells like coffee, not solvent.'
  },
  {
    id: 'manifests',
    name: 'Clean Manifests',
    cost: 4000,
    requires: 'filters',
    column: 2,
    desc: 'Export runs generate 30% less heat. Paperwork does what bribes used to.'
  },
  {
    id: 'radios',
    name: 'Fleet Radios',
    cost: 2000,
    requires: null,
    column: 0,
    desc: 'Trucks run 30% faster and stop idling at the crossroads.'
  },
  {
    id: 'seal',
    name: 'Vacuum Seal Line',
    cost: 3000,
    requires: 'radios',
    column: 1,
    desc: 'Every smuggled crate sells for 20% more. The brick looks like a legal export.'
  },
  {
    id: 'pilots',
    name: 'Bush Pilots',
    cost: 5000,
    requires: 'seal',
    column: 2,
    desc: 'Aerodrome runs pay another 15% and a plane starts flying the highland loop.'
  },
  {
    id: 'irrigation',
    name: 'Ditch Irrigation',
    cost: 2000,
    requires: 'lights',
    column: 1,
    desc: 'Plantations hold 4 more crates and the valley stops stalling at the shed.'
  },
  {
    id: 'cold_store',
    name: 'Cold Storage',
    cost: 3000,
    requires: 'filters',
    column: 2,
    desc: 'Warehouses hold 12 more crates. The chain stops backing up at the crossroads.'
  },
  {
    id: 'bribe_net',
    name: 'Bribe Network',
    cost: 4000,
    requires: 'manifests',
    column: 3,
    desc: 'Cooling a district costs less and drops a little more heat.'
  },
  {
    id: 'decoys',
    name: 'Decoy Manifests',
    cost: 2500,
    requires: 'radios',
    column: 1,
    desc: 'Planned truck, boat, and plane runs are 6% less likely to be stopped.'
  },
  {
    id: 'hulls',
    name: 'Reinforced Hulls',
    cost: 3000,
    requires: 'seal',
    column: 2,
    desc: 'Boats carry 4 more crates.'
  },
  {
    id: 'night_ops',
    name: 'Night Approaches',
    cost: 5000,
    requires: 'pilots',
    column: 3,
    desc: 'Planes are a little safer and a little faster.'
  }
];

export function researchById(id) {
  return RESEARCH.find((node) => node.id === id) || null;
}
