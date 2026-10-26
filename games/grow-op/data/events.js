// Story and sandbox event cards. Effects are named so the simulation
// applies them without parsing prose.

export const EVENTS = [
  {
    id: 'fiesta',
    title: 'Plaza Fiesta',
    body: 'Puerto Plata is stringing lights across the square. A sponsored band keeps the town on your side. Ignoring it reads as cheap.',
    choices: [
      { label: 'Sponsor the band ($220 Clean)', effect: 'fiesta_pay' },
      { label: 'Let the plaza fund itself', effect: 'fiesta_skip' }
    ]
  },
  {
    id: 'checkpoint',
    title: 'Highway Checkpoint',
    body: 'A new captain has a tent on the valley road. Pay him to wave the trucks through, or let the line sit and the heat climb.',
    choices: [
      { label: 'Pay the captain ($180 Dirty)', effect: 'checkpoint_pay' },
      { label: 'Hold the trucks and wait', effect: 'checkpoint_wait' }
    ]
  },
  {
    id: 'surge',
    title: 'Coast Demand',
    body: 'A buyer in the north is paying over list for anything that can move this week. The window is short.',
    choices: [
      { label: 'Push the piers', effect: 'surge_on' },
      { label: 'Keep the usual price', effect: 'none' }
    ]
  },
  {
    id: 'storm',
    title: 'Storm Over the Ridge',
    body: 'Rain is walking down Sierra Alta toward the valley. Fields slow. The river runs high enough to hide a boat.',
    choices: [
      { label: 'Work through it', effect: 'storm_on' },
      { label: 'Lay the crews low', effect: 'storm_hide' }
    ]
  },
  {
    id: 'informant',
    title: 'A Note from the Ridge',
    body: 'Someone inside Los Lobos will mark a weak gate. It costs clean cash and a little loyalty from the lieutenant who hates the idea.',
    choices: [
      { label: 'Buy the note ($300 Clean)', effect: 'informant_buy' },
      { label: 'Burn the note', effect: 'none' }
    ]
  }
];

export function eventById(id) {
  return EVENTS.find((card) => card.id === id) || null;
}
