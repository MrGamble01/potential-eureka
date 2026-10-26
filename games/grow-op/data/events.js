// Story and sandbox event cards. Effects are named so the simulation
// applies them without parsing prose. speaker is a CAST id.

export const EVENTS = [
  {
    id: 'fiesta',
    speaker: 'cesar',
    title: 'Plaza Fiesta',
    body: 'César says Puerto Plata is stringing lights across the square. A sponsored band keeps the town on your side. Ignoring it reads as cheap.',
    choices: [
      { label: 'Sponsor the band ($220 Clean)', effect: 'fiesta_pay' },
      { label: 'Let the plaza fund itself', effect: 'fiesta_skip' }
    ]
  },
  {
    id: 'checkpoint',
    speaker: 'ruiz',
    title: 'Highway Checkpoint',
    body: 'Helen Ruiz has a new captain in a tent on the valley road. Pay him to wave the trucks through, or let the line sit and the heat climb.',
    choices: [
      { label: 'Pay the captain ($180 Dirty)', effect: 'checkpoint_pay' },
      { label: 'Hold the trucks and wait', effect: 'checkpoint_wait' }
    ]
  },
  {
    id: 'surge',
    speaker: 'cesar',
    title: 'Coast Demand',
    body: 'César has a buyer in the north paying over list for anything that can move this week. The window is short.',
    choices: [
      { label: 'Push the piers', effect: 'surge_on' },
      { label: 'Keep the usual price', effect: 'none' }
    ]
  },
  {
    id: 'storm',
    speaker: 'cesar',
    title: 'Storm Over the Ridge',
    body: 'Rain is walking down Sierra Alta toward the valley. Fields slow. The river runs high enough to hide a boat.',
    choices: [
      { label: 'Work through it', effect: 'storm_on' },
      { label: 'Lay the crews low', effect: 'storm_hide' }
    ]
  },
  {
    id: 'informant',
    speaker: 'garza',
    title: 'A Note from the Ridge',
    body: 'Someone inside Don Emilio Garza\'s Los Lobos will mark a weak gate. It costs clean cash and a little loyalty from the lieutenant who hates the idea.',
    choices: [
      { label: 'Buy the note ($300 Clean)', effect: 'informant_buy' },
      { label: 'Burn the note', effect: 'none' }
    ]
  },
  {
    id: 'gas_widow',
    requiresMap: true,
    minAct: 1,
    once: true,
    speaker: 'nia',
    title: 'The Widow at the Pump',
    body: 'Nia says the gas station at mile 4 belongs to the widow. Pay what she asks and she prices the deed to move. Walk off and the valley notices.',
    choices: [
      { label: 'Pay her price ($200 Clean)', effect: 'widow_pay' },
      { label: 'Walk away', effect: 'widow_walk' }
    ]
  },
  {
    id: 'army_column',
    minAct: 1,
    speaker: 'valeria',
    title: 'Army Column',
    body: 'Valeria clocks a truck column using the valley road as a shortcut. Money sends them around. Darkness makes them miss the turn.',
    choices: [
      { label: 'Pay the sergeant ($260 Dirty)', effect: 'army_pay' },
      { label: 'Cut the lights', effect: 'army_dark' }
    ]
  },
  {
    id: 'sol_rumor',
    requiresMap: true,
    minAct: 2,
    once: true,
    speaker: 'reina',
    title: 'A Name in Puerto Sol',
    body: 'Reina Solano says a dock clerk will speak your name in Barrio Sol. It is not a purchase. It is a reputation.',
    choices: [
      { label: 'Let him talk', effect: 'sol_rumor' },
      { label: 'Stay unknown', effect: 'none' }
    ]
  },
  {
    id: 'inspection',
    requiresMap: true,
    minAct: 2,
    speaker: 'ruiz',
    title: 'Federal Inspection',
    body: 'Special Agent Helen Ruiz is on the sidewalk in Barrio Sol with a clipboard and two uniforms. She will take a payment, or she will take notes for the file.',
    choices: [
      { label: 'Pay the inspection ($240 Clean)', effect: 'inspection_pay' },
      { label: 'Refuse the clipboard', effect: 'inspection_refuse' }
    ]
  },
  {
    id: 'turf_war',
    requiresMap: true,
    minAct: 2,
    speaker: 'reina',
    title: 'Turf on the Line',
    body: 'Reina Solano and Don Emilio Garza both want the same block. Money buys time with one crew. Silence makes both of them hurry.',
    choices: [
      { label: 'Pay Costa Negra ($200 Dirty)', effect: 'turf_costa' },
      { label: 'Pay Los Lobos ($200 Dirty)', effect: 'turf_lobos' },
      { label: 'Ignore both crews', effect: 'turf_ignore' }
    ]
  },
  {
    id: 'city_informant',
    requiresMap: true,
    minAct: 2,
    speaker: 'ruiz',
    title: 'Two Informants',
    body: 'Ruiz has a witness who will talk. Costa Negra has a bookkeeper who will talk about Ruiz. You can buy one silence. Buying neither feeds the file.',
    choices: [
      { label: 'Pay off Ruiz\'s witness ($280 Clean)', effect: 'witness_pay' },
      { label: 'Buy Costa\'s books ($220 Dirty)', effect: 'books_buy' },
      { label: 'Let both talk', effect: 'informants_talk' }
    ]
  },
  {
    id: 'hurricane',
    requiresMap: true,
    minAct: 2,
    speaker: 'cesar',
    title: 'Hurricane Notice',
    body: 'A hurricane is turning toward Puerto Sol. César can spend to board the docks, or the water takes the warehouses and the heat comes with it.',
    choices: [
      { label: 'Board the docks ($300 Dirty)', effect: 'hurricane_secure' },
      { label: 'Ride it out', effect: 'hurricane_ride' }
    ]
  },
  {
    id: 'election',
    requiresMap: true,
    minAct: 3,
    speaker: 'ruiz',
    title: 'Election-Year Crackdown',
    body: 'The mayor wants a headline and Helen Ruiz has the task force. A donation buys a quiet month. Going dark cools the streets and tells both crews you are hiding.',
    choices: [
      { label: 'Donate to the quiet ($350 Clean)', effect: 'election_donate' },
      { label: 'Go dark', effect: 'election_dark' }
    ]
  }
];

export function eventById(id) {
  return EVENTS.find((card) => card.id === id) || null;
}
