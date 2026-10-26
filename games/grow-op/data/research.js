// Research tree. Clean cash buys a lasting edge. Each node names the
// simulation field it changes so the effect cannot drift from the copy.

export const RESEARCH = [
  {
    id: 'lights',
    name: 'Sodium Grow Lamps',
    cost: 400,
    requires: null,
    column: 0,
    desc: 'Valley plots finish 20% faster. The first lamp is the one every garage already wanted.'
  },
  {
    id: 'filters',
    name: 'Carbon Filter Banks',
    cost: 550,
    requires: 'lights',
    column: 1,
    desc: 'Production throws off 25% less district heat. The block smells like coffee, not solvent.'
  },
  {
    id: 'manifests',
    name: 'Clean Manifests',
    cost: 900,
    requires: 'filters',
    column: 2,
    desc: 'Export runs generate 30% less heat. Paperwork does what bribes used to.'
  },
  {
    id: 'radios',
    name: 'Fleet Radios',
    cost: 450,
    requires: null,
    column: 0,
    desc: 'Trucks run 30% faster and stop idling at the crossroads.'
  },
  {
    id: 'seal',
    name: 'Vacuum Seal Line',
    cost: 700,
    requires: 'radios',
    column: 1,
    desc: 'Every smuggled crate sells for 20% more. The brick looks like a legal export.'
  },
  {
    id: 'pilots',
    name: 'Bush Pilots',
    cost: 1200,
    requires: 'seal',
    column: 2,
    desc: 'Aerodrome runs pay another 15% and a plane starts flying the highland loop.'
  }
];

export function researchById(id) {
  return RESEARCH.find((node) => node.id === id) || null;
}
