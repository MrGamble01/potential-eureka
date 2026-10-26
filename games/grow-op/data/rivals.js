// Two crews. Los Lobos hold the high country. Costa Negra holds the water.

export const RIVALS = {
  lobos: {
    id: 'lobos',
    name: 'Los Lobos',
    fullName: 'Los Lobos Syndicate',
    home: 'jungle_alta',
    threatStart: 48,
    threatReset: 55,
    zones: ['rio_plata', 'jungle_alta', 'mesa_strip', 'ps_airport', 'ps_hills', 'sierra_alta']
  },
  costa: {
    id: 'costa',
    name: 'Costa Negra',
    fullName: 'Costa Negra',
    home: 'ps_beach',
    threatStart: 40,
    threatReset: 48,
    zones: ['river_delta', 'ps_barrio', 'ps_docks', 'ps_beach', 'san_marco']
  }
};

export function createRivalBook() {
  const book = {};
  for (const rival of Object.values(RIVALS)) {
    book[rival.id] = {
      id: rival.id,
      name: rival.name,
      threat: rival.threatStart,
      attacks: 0
    };
  }
  return book;
}
